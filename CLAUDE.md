# Tesorería Adapsys

Sistema web de tesorería y control presupuestario para reemplazar Quicken (escritorio, archivo local)
más una planilla Excel de control presupuestario que hoy se arma a mano.

**Idioma del proyecto: español.** Código, comentarios, nombres de tabla y de columna en español.
Es el idioma en que el equipo piensa el negocio y traducirlo introduce ambigüedad.

---

## 1. Contexto

Adapsys (CLA Adaptación Ltda) es una consultora chilena. Administración y finanzas la llevan
**3 personas**, todas con permiso de escritura. No hay necesidad de roles complejos al día uno.

### El problema real

No es que falten funcionalidades: Quicken funciona. El problema es que

1. **está en un archivo local**, así que solo una persona puede trabajarlo a la vez y el respaldo depende de que alguien se acuerde;
2. **el control presupuestario se arma a mano en Excel** con datos exportados de Quicken, y se desactualiza apenas se registra un movimiento nuevo.

El objetivo es que el presupuesto vs. real **exista** en vez de armarse, y que los 3 puedan entrar
en cualquier momento a revisar, conciliar o sacar reportes.

### Lo que NO es el problema

- No necesitan integración bancaria automática. Los movimientos son pocos y específicos; se cargan a mano.
- No necesitan contabilidad de partida doble. Es tesorería: registro por cuenta con saldo corriente.
- No necesitan multi-idioma ni escalar a muchos usuarios.

---

## 2. Empresas y cuentas

Cinco entidades legales, agrupadas en dos:

**Grupo Adapsys** (las 4 operativas, comparten presupuesto)
- CLA ADAPTACIÓN — cuenta CLP + cuenta USD
- CLA CONSULTORES — cuenta CLP + cuenta USD
- CLA CONSULTING — cuenta CLP + cuenta USD
- CLA CONSULTORIA — solo CLP

**Empresas relacionadas**
- SANTA MARÍA — CLP + USD. Fuera del presupuesto consolidado.

Además existen cuentas auxiliares en Quicken (`FACTURAS POR COBRAR`, `PROY. EGRESOS CLP/USD`,
`PROYECTOS APROBADOS`) que **no deben replicarse como cuentas**. Ver §4.

---

## 3. Modelo de datos

```sql
empresas        (id, nombre, corto, grupo)              -- grupo: 'Adapsys' | 'Relacionadas'
cuentas         (id, empresa_id, nombre, moneda, tipo, saldo_inicial, principal)
                -- moneda: 'CLP'|'USD'  tipo: 'banco'|'cxc'

categorias      (id, nombre, orden, controlado)
subcategorias   (id, categoria_id, nombre, naturaleza, activa)
                -- naturaleza: 'ingreso'|'inversion'|'operativo'

movimientos     (id, fecha, empresa_id, cuenta_id, contraparte, glosa,
                 monto, moneda, tipo_cambio, estado, doc_tipo,
                 creado_por, creado_en, actualizado_en)
                -- estado: 'proyectado'|'pagado'|'conciliado'
                -- doc_tipo: 'exento'|'afecta'|'honorario'
                -- monto = líquido que entra o sale del banco

movimiento_lineas (id, movimiento_id, subcategoria_id, monto, glosa, orden)
                -- suma de líneas DEBE igualar movimientos.monto

presupuesto     (id, anio, subcategoria_id, monto, monto_anterior, responsable, nota)
                -- consolidado: NO lleva empresa_id

parametros      (clave, valor, vigencia_desde)          -- tasa_iva, tasa_bhe, tc_presupuesto
reportes_guardados (id, usuario_id, nombre, config jsonb)
auditoria       (id, tabla, registro_id, accion, antes jsonb, despues jsonb, usuario_id, cuando)
```

### Reglas de integridad

- Si `movimiento_lineas` existe para un movimiento, la suma **debe** cuadrar con `movimientos.monto`.
  Validar en la base (trigger o constraint diferida), no solo en la UI.
- Un movimiento sin líneas se trata como una línea única implícita. Toda agregación por subcategoría
  debe expandir líneas primero — nunca agregar por el movimiento.
- Borrar una subcategoría con movimientos deja huérfanos. Marcar `activa=false` en vez de borrar,
  y exponer una vista de "sin clasificar" para reasignar.

---

## 4. Reglas de negocio (críticas — se descubrieron una por una)

### 4.1 La proyección es un estado, no una cuenta

Quicken obliga a que todo movimiento viva en un registro, por eso existen las cuentas espejo
`PROY. EGRESOS (CLP)` y `PROY. EGRESOS (USD)`. Cuando algo se paga hay que sacarlo de la cuenta
espejo y meterlo en la cuenta real: dos asientos manuales.

**En este sistema el movimiento es uno solo y cambia de estado:**

```
proyectado  →  pagado  →  conciliado
```

- `proyectado`: compromiso futuro. No afecta el saldo de la cuenta. Es lo que alimenta la proyección de caja.
- `pagado`: salió del banco. Afecta el saldo. Aún no cuadrado contra cartola.
- `conciliado`: cuadrado contra cartola.

La diferencia entre el saldo del sistema y el de la cartola es exactamente la lista de `pagado`.

### 4.2 La naturaleza vive en la subcategoría, no en la categoría

`inversion` / `operativo` / `ingreso` es propiedad de **cada subcategoría**. Una misma categoría
puede tener líneas de las dos naturalezas — p. ej. "2 GASTOS ADMINISTRACIÓN" tiene arriendo
(operativo) y equipamiento de oficina (inversión). Al menos 6 de las 16 categorías reales son mixtas.

Consecuencia: en el presupuesto, una categoría mixta aparece en ambas secciones, cada vez con
solo las líneas que le corresponden.

### 4.3 Los splits son la norma, no la excepción

Casi todos los movimientos tienen varias líneas. Dos patrones dominantes:

**Impuestos y retenciones.** El impuesto va en su propia línea, con signo propio, y el monto
del movimiento es el líquido que efectivamente se transfirió.

| Tipo | Base que se ingresa | Línea de impuesto | Resultado |
|---|---|---|---|
| `afecta` | neto | IVA compras = neto × 19% (mismo signo) | total a pagar **mayor** |
| `honorario` | bruto | Retención BHE = −bruto × 15,25% (signo opuesto) | líquido a pagar **menor** |
| `exento` | monto final | — | sin línea de impuesto |

Ejemplo real (factura GTD): neto −306.745 + IVA −58.281 = **−365.026** transferidos.
Ejemplo real (boleta): bruto −1.253.118 + retención +191.100 = **−1.062.018** transferidos.

**El documento manda sobre la fórmula.** 306.745 × 19% = 58.281,55 pero la factura dice 58.281.
Los helpers calculan, pero el monto de cada línea siempre debe quedar editable.

**Tarjetas de crédito.** Un movimiento (el pago del estado de cuenta) con muchas líneas, cada una
con su propia glosa y categoría. Necesita carga masiva por pegado.

### 4.4 Los impuestos llegan a "4 IMPUESTOS"

Las líneas de IVA y retención se clasifican en subcategorías de la categoría `4 IMPUESTOS`
(`IVA compras`, `IVA mensual`, `Retención BHE`). En el flujo de caja aparecen como categoría
propia, y `Retención BHE` suele salir en **positivo** porque resta de los egresos.

### 4.5 El flujo de caja se lleva solo en CLP

Los movimientos y saldos en dólares **no entran** al flujo. Se muestran aparte, en su moneda,
sin convertir. Debe existir un modo opcional "CLP + USD" que convierta, pero no es el default.

Nunca convertir destructivamente: guardar siempre `monto` + `moneda` + `tipo_cambio` usado.
Un movimiento en USD conserva el TC del día en que ocurrió; no se recalcula cuando el dólar cambia.

### 4.6 El presupuesto es anual, consolidado y dividido en inversión / operativo

- **Uno solo para las 4 empresas Adapsys.** No hay presupuesto por sociedad. El filtro global de
  empresas no aplica a esta vista.
- Se fija a fines del año anterior y se compara contra el real durante todo el año.
- Estructura: Ingresos / Gastos de Inversión / Gastos Operativos → categoría → subcategoría.
- Campos por línea: presupuesto del año, presupuesto del año anterior, **responsable**, **notas**.
  La variación nominal y porcentual se calculan.
- Montos en magnitud (sin signo), como en la planilla.
- **% utilizado se compara contra el avance del año, no contra el mes.** Una línea al 80% en
  agosto (63% del año transcurrido) va sobre ritmo aunque no llegue al 100%.
- Debe existir "proyección de cierre" = ejecutado + proyectado restante del año.
- Líneas fuera del control presupuestario (retiros de socios, préstamos, inversiones) se excluyen
  pero se muestran en una banda aparte para que nadie olvide que existen.

**TC presupuestario fijo.** El presupuesto usa un tipo de cambio fijo definido al armar el año.
Si el TC flota, la desviación por gasto y la desviación por dólar se mezclan y ninguna se explica.

### 4.7 Otras

- **Transferencias entre cuentas propias no son flujo.** Detectar el par y neutralizarlo, o el
  consolidado queda inflado en ambos sentidos. Existe una subcategoría "Traspaso entre empresas".
- **Deduplicación:** hash de (cuenta + fecha + monto + glosa normalizada) **más un secuencial**,
  porque puede haber dos cargos idénticos legítimos el mismo día.
- **Horizonte:** las proyecciones pasan del año calendario (hay movimientos a enero 2027).
  Los rangos de fecha no deben amarrarse al año en curso.

---

## 5. Catálogo de categorías

**16 categorías, 284 subcategorías**, importadas de Quicken.

```
INGRESOS
  A INGRESOS CLIENTES ............ 193 subcategorías (¡son clientes!)
  B OTROS INGRESOS ............... 5
EGRESOS
  1 COSTO DE VENTA ............... 11    2.3 GASTOS SISTEMAS DIGITALES .. 5
  1 DESARROLLO ORGANIZACIONAL .... 9     2.4 EQUIPOS COMPUTACIONALES .... 2
  2 GASTOS ADMINISTRACIÓN ........ 16    3 RECURSOS HUMANOS ............. 6
  2.0 COMERCIAL Y MARKETING ...... 9     4 IMPUESTOS .................... 4
  2.1 POSICIONAMIENTO NUEVA MARCA  5     5 BANCOS ....................... 3
  2.2 COMPRA ACTIVOS ............. 5     6 PRESTAMOS BANCARIOS .......... 1
                                         7 INVERSIONES .................. 5
                                         8 RELACIONADOS Y SOCIOS ........ 5
```

Los **193 clientes bajo A INGRESOS CLIENTES** son la contraparte, no una categoría contable.
Están así porque Quicken no tiene dimensión de cliente. **El equipo decidió mantenerlos así**
porque el reporte de flujo que revisan funciona bien con esa estructura y separarlos complicaría
la migración. No re-litigar esto sin que lo pidan.

Consecuencias prácticas: cualquier selector de subcategorías necesita **buscador y colapso por
categoría**. Una lista plana de 284 ítems es inusable.

---

## 6. Vistas

| Vista | Qué hace |
|---|---|
| **Flujo de caja** | Réplica mejorada del reporte de Quicken. Rango de fechas libre, columnas semanales o mensuales, secciones por naturaleza → categoría → subcategoría. **Solo aparecen las líneas con movimiento en el rango.** Filtro por estado. Cada monto es clicable y abre el detalle con los movimientos que lo componen, reclasificables ahí mismo. |
| **Movimientos** | Registro único de todas las empresas. Empresa y subcategoría editables inline. Editor de splits con líneas, glosa, botones de IVA/retención, pegado masivo, y detector de descuadre. |
| **Conciliación** | Lista de `pagado` sin cuadrar. El total es exactamente la diferencia contra la cartola. |
| **Presupuesto anual** | Dos modos: *construcción* (responsable, ppto año anterior, ppto año, variación, notas) y *control* (ejecutado, % utilizado con marca de avance del año, disponible, proyección de cierre). |
| **Reportes** | Armador configurable: filas (subcategoría / categoría / naturaleza / empresa / proveedor), columnas (mes / trimestre / empresa / categoría / naturaleza / total), rango de fechas con presets, filtro de estados y de subcategorías. Configuraciones guardables. Export CSV. |
| **Categorías** | Mantenedor del catálogo, con importador que acepta pegar listados en varios formatos. |

---

## 7. Stack

- **Postgres vía Supabase** — auth con Google corporativo, Row Level Security para permisos,
  backup diario automático (esto resuelve el "respaldado en la nube" mejor que un archivo local).
- **Next.js** desplegado en Vercel.
- Mantener export a CSV/Sheets para quien prefiera seguir trabajando ahí.

Costo esperado: entre USD 0 y ~25/mes con este volumen.

---

## 8. Convenciones

### Formato
- Montos: `Intl.NumberFormat('es-CL')` — punto de miles, coma decimal.
- Fechas: ISO en la base (`YYYY-MM-DD`), `DD-MM-YY` en pantalla.
- Egresos negativos internamente. En vistas de presupuesto se muestran en magnitud.
- Números tabulares en todas las tablas (`font-variant-numeric: tabular-nums`).

### UI
El prototipo (`tesoreria.jsx`) define la dirección visual: densa, tipo instrumento financiero,
tipografía IBM Plex Sans + IBM Plex Mono, paleta ink/paper/teal/brick sobre off-white.
No es sagrado, pero la densidad sí: es una herramienta de trabajo diario, no una landing.

### Verificación obligatoria
**Compilar no basta.** El bundler valida sintaxis pero no detecta referencias a variables usadas
antes de su declaración ni identificadores inexistentes — un error real de este proyecto fue una
constante usada 55 líneas antes de declararse, que reventaba al cargar el módulo y compilaba sin quejas.

Antes de entregar cualquier cambio: renderizar de verdad, recorriendo todas las vistas y con los
paneles expandidos. En el prototipo eso se hizo con `react-dom/server` y un `window`/`document`
mínimo. En la app real, tests de render por ruta.

---

## 9. Parámetros a verificar (no hardcodear)

- **Tasa de retención BHE.** Se usó 15,25% para 2026 según la escala de la Ley 21.133, que sube
  hasta 17% en 2028. **Verificar la vigente con el SII** — puede haber cambiado. Debe ser un
  parámetro con vigencia por año, no una constante.
- **IVA 19%** — estable, pero igual parametrizado.
- **Tipo de cambio.** La fuente correcta es el **dólar observado del Banco Central de Chile**
  (el que usa el SII). Disponible por la API de su Base de Datos Estadísticos; `mindicador.cl`
  es un envoltorio gratuito de la misma serie, útil para prototipar pero no oficial.
  Definir el criterio: TC del día de operación para movimientos, TC fijo para presupuesto.

---

## 10. Pendientes y preguntas abiertas

**Definidos, sin implementar**
- Cierre de período: bloquear meses ya reportados para que nadie "arregle" marzo en julio.
- Auditoría: quién cambió qué y cuándo. Nada se borra, se anula con contraasiento.
- Distribución mensual del presupuesto anual: hoy la comparación contra el avance del año es
  lineal, y las líneas estacionales (retiros de socios en marzo/junio/agosto) dan falsa alarma.
- Movimientos recurrentes por regla, en vez de escribirse uno a uno para todo el año.
  Los pagos caen en fechas fijas (sueldos día 25, IVA día 30, honorarios día 20).
- Autoclasificación por diccionario de proveedores. Ya existe uno construido para la conciliación
  de la tarjeta corporativa; reutilizarlo.

**Por preguntar al equipo**
- Estado de cuenta de tarjeta: ¿se carga como un movimiento con todas sus líneas al llegar, o se
  van cargando las compras a medida que ocurren y el pago mensual es un traspaso?
- Reembolsos de gastos a personas: el gasto es del proyecto pero el pago va a un empleado. ¿Siempre
  se clasifican al proyecto o a veces se separan?
- `7 INVERSIONES` aparece en Outflows con montos positivos (rescates de depósitos a plazo).
  ¿Debería ser una sección aparte de movimientos de tesorería en vez de estar entre los egresos?
  Mezclada ahí distorsiona el total de gastos.
- Cuentas en dólares: ¿los pagos desde esas cuentas entran a algún control o se manejan aparte?

---

## 11. Migración desde Quicken

Quicken Classic exporta a CSV/QIF. Traer el histórico completo y **validar que los saldos calzan**
antes de dar el sistema por bueno.

Al reemplazar el catálogo de categorías, los movimientos cuyas subcategorías desaparezcan quedan
huérfanos. No fallar en silencio: contarlos, marcarlos visiblemente y ofrecer una pantalla de
reclasificación. Esto va a pasar de verdad en la migración.

---

## 12. Archivo de referencia

`tesoreria.jsx` — prototipo funcional de una sola pieza, con el catálogo real de 284 subcategorías,
datos de ejemplo que reproducen movimientos reales del Quicken actual (incluidos los splits de GTD
y las boletas de honorarios con retención), y las seis vistas implementadas.

Sirve como especificación ejecutable: si hay duda sobre cómo debería comportarse algo, está ahí.
No sirve como base de código para producción — usa estado en memoria y `window.storage`, no
tiene backend, permisos ni validación.
