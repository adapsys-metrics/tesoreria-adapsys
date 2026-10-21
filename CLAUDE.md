# Tesorería Adapsys

Sistema web de tesorería y control presupuestario para reemplazar Quicken (escritorio, archivo local)
más una planilla Excel de control presupuestario que hoy se arma a mano.

**En pantalla la app se llama ADARA Finance.** El nombre sale de una sola constante
(`lib/marca.ts`) porque aparece en la barra superior, en el login y en el título de cada
pestaña: repartido, el día que cambie queda a medias en alguna de las tres y nadie lo nota
hasta verlo en una captura. Va **sin caja alta**, que es como se escribe — el rótulo de la
barra la tenía y lo habría vuelto "ADARA FINANCE".

El repositorio, la carpeta y las tablas siguen diciendo `tesoreria`, a propósito: el nombre
de pantalla lo decide el negocio y puede volver a cambiar; renombrar el proyecto y la base
para seguirlo costaría migraciones y links rotos sin que nadie vea una diferencia.

**Idioma del proyecto: español.** Código, comentarios, nombres de tabla y de columna en español.
Es el idioma en que el equipo piensa el negocio y traducirlo introduce ambigüedad.

---

## 1. Contexto

Adapsys (CLA Adaptación Ltda) es una consultora chilena. Administración y finanzas la llevan
**3 personas**, todas con permiso de escritura. No hay necesidad de roles complejos al día uno.

**Son 3 personas, no "el dominio".** El acceso va por lista explícita en la tabla
`usuarios_autorizados`, administrable desde el panel de Supabase. Esa misma tabla lleva el
**nombre**, y es de ahí que sale el que se ve en la barra superior — no del perfil de
Google, que dice lo que cada quien tenga puesto ahí. El correo no se pierde: va en el
title, y **pasa al frente cuando el nombre no se resuelve**, que es justo el caso en que
alguien está averiguando con qué cuenta entró. La política `propia_fila` ya permite esa
lectura, así que no hizo falta tocar permisos. Filtrar solo por
`@adapsysgroup.com` dejaría entrar a consultores y operaciones a ver los saldos de las cinco
sociedades, los sueldos por persona y los retiros de socios. Los dos filtros conviven: hay que
estar en la lista **y** tener correo corporativo.

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

Y existe un **registro de control**, `CLA ADAPTACIÓN CC PERÚ`, que tampoco es una cuenta
y además no entra a ninguna vista. Ver §10.

**Dónde vive la empresa depende del tipo de cuenta**, y confundirlo mueve movimientos sin
que nadie lo pida:

- En una **cuenta del banco** manda la cuenta: ella determina empresa y moneda. Cambiar de
  empresa **mueve** el movimiento de una cuenta a otra y cambia el saldo de las dos, así que
  se confirma antes.
- En una **auxiliar** es al revés: son de las cuatro empresas a la vez y cuelgan de CLA
  ADAPTACIÓN solo porque en Quicken todo tiene que vivir en un registro. Ahí la empresa es un
  dato del movimiento y cambiarla **no lo mueve de cuenta**.

---

## 3. Modelo de datos

```sql
empresas        (id, nombre, corto, grupo)              -- grupo: 'Adapsys' | 'Relacionadas'
cuentas         (id, empresa_id, nombre, moneda, tipo, saldo_inicial, principal, numero)
                -- moneda: 'CLP'|'USD'  tipo: 'banco'|'cxc'|'control'
                -- numero: cuenta en el banco, para la nómina de pago. Nulo en las auxiliares
proveedores     (id, nombre, rut, cod_banco, cuenta, correo, activo)
                -- rut sin puntos ni guion; cod_banco es el código del portal, no el nombre

-- El catálogo tiene TRES niveles (§3.1)
grupos          (id, nombre, orden, controlado)         -- "2 GASTOS ADMINISTRACIÓN"
categorias      (id, grupo_id, nombre, naturaleza, activa)
                -- "Jornadas y eventos organización"
                -- naturaleza: 'ingreso'|'inversion'|'operativo'
subcategorias   (id, categoria_id, nombre, naturaleza, activa)  -- "Offsite internacional"
                -- naturaleza null = la de su categoría; un valor la sobrescribe

movimientos     (id, fecha, empresa_id, cuenta_id, contraparte, glosa,
                 monto, moneda, tipo_cambio, estado, doc_tipo, hito,
                 creado_por, creado_en, actualizado_en)
                -- hito: cuota del plan de pagos pactado con el cliente (§4.8)
                -- estado: 'proyectado'|'pagado'|'conciliado'
                -- doc_tipo: 'exento'|'afecta'|'honorario'
                -- monto = líquido que entra o sale del banco

movimiento_lineas (id, movimiento_id, categoria_id, subcategoria_id, doc_tipo, monto, glosa, orden)
                -- suma de líneas DEBE igualar movimientos.monto
                -- subcategoria_id es opcional y debe colgar de categoria_id
                -- doc_tipo null = el del movimiento; un valor lo sobrescribe (§4.3)

presupuesto     (id, anio, categoria_id, subcategoria_id, monto, monto_anterior, responsable, nota)
                -- consolidado: NO lleva empresa_id
                -- subcategoria_id nulo = la línea de la categoría en sí, lo que se
                --   gasta en ella sin precisar subcategoría (el "(Other)" de Quicken)

parametros      (clave, valor, vigencia_desde)          -- tasa_iva, tasa_bhe, tc_presupuesto
reportes_guardados (id, usuario_id, nombre, config jsonb)
auditoria       (id, tabla, registro_id, accion, antes jsonb, despues jsonb, usuario_id, cuando)
```

### 3.1 Los tres niveles del catálogo

Quicken los llama `Grupo:Categoría:Subcategoría` y así los piensa el equipo:

```
2 GASTOS ADMINISTRACIÓN            ← grupo      (16)
  Jornadas y eventos organización  ← categoría  (290)
    Offsite internacional          ← subcategoría (3, y creciendo)
```

**Se clasifica en la categoría.** Es el nivel al que apunta toda línea de movimiento
y el que agrupan el flujo, el presupuesto y los reportes. La naturaleza vive ahí
(§4.2) y por eso un grupo puede ser mixto.

**La subcategoría es detalle en el flujo, y nivel propio en el presupuesto.** Es
opcional y no lleva naturaleza —la hereda—. En el flujo no abre fila: se ve al abrir
el detalle de un monto. **En el presupuesto sí**, porque es ahí donde se decide el
número y el equipo lo decide en la subcategoría: *"en la totalidad de los casos son
las subcategorías las que representan el total de las categorías"*. Una categoría con
subcategorías muestra la suma y deja de ser editable; el monto se escribe abajo.

**Y la fila "sin subcategoría" existe y hay que mostrarla.** En seis años hay 15.649
clasificaciones de dos niveles y 21 de tres, y las dos conviven — "Jornadas y eventos
organización" tiene 342 movimientos propios además de los 6 de su subcategoría. Si esa
fila se escondiera, ese gasto quedaría dentro de un total sin línea contra la cual
compararse. Mostrarla además delata lo que importa: gasto ahí sin presupuesto significa
que alguien clasificó sin elegir subcategoría.

**Todo esto se indexa por la clave de reporte** —`categoria` o `categoria>subcategoria`—,
que tiene **una sola definición** (`clave` en `lib/catalogo-indices.ts`, con su inversa
`partesDeClave`). Si la carga arma la clave de una forma y el cálculo del ejecutado de
otra, el presupuesto y el gasto dejan de encontrarse: la línea aparece con gasto y sin
presupuesto y nada falla. Ese fue un bug real — `cargarPresupuesto` agrupaba solo por
`categoria_id` y plegaba las líneas de subcategoría dentro de su madre en silencio.

Consecuencia práctica: agregarle subcategorías a una categoría **no invalida nada de
lo ya clasificado** en ella, y no hay que migrar nada al abrir una nueva.

**El importador de Quicken aplastó las tres ramas que usaban el tercer nivel**, y las
dejó como categorías hermanas colgando del grupo. La migración `0012` las devuelve a
su lugar. Si aparece otra al recargar, hay que revisar `lib/quicken.ts`.

### Reglas de integridad

- Si `movimiento_lineas` existe para un movimiento, la suma **debe** cuadrar con `movimientos.monto`.
  Validar en la base (trigger o constraint diferida), no solo en la UI.
- Un movimiento sin líneas se trata como una línea única implícita. Toda agregación por categoría
  debe expandir líneas primero — nunca agregar por el movimiento.
- `movimiento_lineas.subcategoria_id`, cuando viene, **debe colgar de** `categoria_id` de la misma
  línea. Lo valida un trigger: si no, el detalle diría una cosa y el reporte otra.
- Borrar una **categoría** con movimientos deja huérfanos. Marcar `activa=false` en vez de borrar,
  y exponer una vista de "sin clasificar" para reasignar.
- Borrar una **subcategoría** sí se puede aunque esté en uso: la línea conserva categoría, monto
  y glosa, y solo pierde el detalle (`on delete set null`). Se pierde precisión, no gasto.

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

**En la práctica el equipo no usa `pagado`.** El banco se revisa todos los días y un movimiento
se marca pagado justamente porque ya está en la cartola con esa fecha: la verificación ocurre al
registrar. Así que la app pasa de `proyectado` a `conciliado` directamente, y no hay conciliación
mensual ni semanal. Un estado intermedio solo dejaría un contador de pendientes que crece y que
nadie baja nunca.

El estado sigue existiendo en la base y en el modelo: si algún día se cuadra contra un extracto
en vez de al día, vuelve a tener sentido sin necesidad de migrar nada.

**Lo que sí se mira todos los días son los vencidos:** fecha pasada y todavía `proyectado`. O ya
ocurrió y falta registrarlo, o hay que mover la fecha — una factura que el cliente no pagó se
reprograma al futuro. En Quicken eso se ve como un cambio de tono en el registro de proyecciones,
y es el equivalente de lo que en otros sistemas sería la conciliación.

### 4.2 La naturaleza baja hasta donde haga falta

`inversion` / `operativo` / `ingreso` vive en la **categoría**, y una **subcategoría**
puede sobrescribirla. La misma regla en dos niveles:

- Un **grupo** es mixto cuando sus categorías no coinciden. "2 GASTOS ADMINISTRACIÓN"
  tiene arriendo (operativo) y equipamiento (inversión); al menos 6 de los 16 lo son.
- Una **categoría** es mixta cuando alguna subcategoría difiere de ella.

**Mixta no se elige: es derivada.** Aparece cuando hay desacuerdo y desaparece cuando se
vuelve a elegir el tipo en la categoría, que arrastra a todas sus subcategorías. Por eso
`subcategorias.naturaleza` es nullable: null es "la de mi categoría" y un valor es un
override. Guardar el valor repetido en vez de null haría que la hija dejara de seguir a
la madre sin que nadie lo pidiera.

**Y la categoría conserva la suya siempre.** Una línea puede tener categoría y no tener
subcategoría —15.649 de 15.670 en el histórico— y sin eso quedaría sin saber de qué lado
cae. Un valor "mixta" guardado en la categoría no diría qué hacer con esas líneas.

Consecuencia: en el flujo y en el presupuesto, un grupo mixto aparece en ambas secciones
y una categoría mixta también, cada vez sumando solo lo que le corresponde. Eso se
resuelve con la **clave de reporte** (`lib/catalogo-indices.ts`): una línea se agrupa por
su categoría, o por el par categoría-subcategoría cuando la subcategoría sobrescribe.

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

**Ningún campo del alta trae un valor por defecto que se guarde.** La categoría arrancaba
en "Sueldos" y quien no la mirara clasificaba ahí sin enterarse. Y los ejemplos de los
campos vacíos van en cursiva y atenuados: eran realistas —"GTD", "FA3109609"— y en el gris
por defecto del navegador se leían como datos ya escritos.

**El documento manda sobre la fórmula.** 306.745 × 19% = 58.281,55 pero la factura dice 58.281.
Los helpers calculan, pero el monto de cada línea siempre debe quedar editable.

**La línea de impuesto se calcula en un solo lugar** (`lineaDeImpuesto` en `lib/dominio.ts`),
porque la usan el alta y el editor. Si divergen, el monto del movimiento deja de ser el que
salió del banco y **nada lo delata**: la suma de líneas igual cuadra.

**El tipo de documento puede variar dentro de un mismo pago.** Un proveedor manda tres
facturas —dos afectas y una exenta— y se pagan en una transferencia. Cobrar IVA sobre
las tres es plata que no existe, y el detector de descuadre no lo delata: la suma de
líneas igual cuadra con el monto, solo que el monto quedó mal.

Por eso `movimiento_lineas.doc_tipo` es nullable, con la misma forma que la naturaleza
en la subcategoría (§4.2): null es "el del movimiento" y un valor lo sobrescribe. La
base del impuesto son las líneas de ese tipo; **si ninguna lo dice, son todas** —
apretar el botón ya es decir "esto es afecto", que es el caso corriente y no debería
obligar a marcar nada.

**Tarjetas de crédito.** Un movimiento (el pago del estado de cuenta) con muchas líneas, cada una
con su propia glosa y categoría. Necesita carga masiva por pegado.

### 4.4 Los impuestos llegan a "4 IMPUESTOS"

Las líneas de IVA y retención se clasifican en categorías del grupo `4 IMPUESTOS`
(`IVA compras`, `IVA mensual`, `Retención BHE`). En el flujo de caja aparecen como grupo
propio, y `Retención BHE` suele salir en **positivo** porque resta de los egresos.

### 4.5 El flujo de caja se lleva solo en CLP

Los movimientos y saldos en dólares **no entran** al flujo. Se muestran aparte, en su moneda,
sin convertir. Debe existir un modo opcional "CLP + USD" que convierta, pero no es el default.

**En el registro manda el dólar; en el flujo manda el peso.** No es inconsistencia: en
Movimientos se cuadra contra la cartola, que viene en dólares, así que el monto grande es el
dólar y el peso va debajo en chico, con su TC, como referencia. En el detalle que se abre
desde una celda del flujo es al revés, porque el total del encabezado es en pesos y las filas
tienen que sumarlo.

**El movimiento no lleva tipo de cambio.** Las cuentas en dólares se llevan en dólares porque
reflejan la cartola del banco, donde no hay conversión. El TC hace falta en un solo lugar —el
control presupuestario— y ahí es un parámetro fijo del año (§4.6), aplicado al consultar y no al
registrar. Se define a mano, año a año o cuando haga falta sacar los datos.

`movimientos.tipo_cambio` existe pero es opcional: se llena solo cuando la operación tuvo un TC
concreto y conocido. Nunca convertir destructivamente — `monto` y `moneda` siempre se guardan
como vinieron.

### 4.6 El presupuesto es anual, consolidado y dividido en inversión / operativo

- **Uno solo para las 4 empresas Adapsys.** No hay presupuesto por sociedad. El filtro global de
  empresas no aplica a esta vista.
- Se fija a fines del año anterior y se compara contra el real durante todo el año.
- Estructura: Ingresos / Gastos de Inversión / Gastos Operativos → grupo → categoría.
- Campos por línea (una línea = una categoría, o una subcategoría suya — §3.1): presupuesto del año, presupuesto del año anterior, **responsable**, **notas**.
  La variación nominal y porcentual se calculan.
- Montos en magnitud (sin signo), como en la planilla.
- **% utilizado se compara contra el avance del año, no contra el mes.** Una línea al 80% en
  agosto (63% del año transcurrido) va sobre ritmo aunque no llegue al 100%.
- Debe existir "proyección de cierre" = ejecutado + proyectado restante del año.
- Líneas fuera del control presupuestario (retiros de socios, préstamos, inversiones) se excluyen
  pero se muestran en una banda aparte para que nadie olvide que existen.

### El año siguiente se arma desde los doce meses ya cerrados

*Generar operativo* suma los movimientos operativos de una ventana por categoría y los
deja como presupuesto, **repartidos en el mes en que ocurrió cada uno**. Eso es lo que
hace que lo trimestral, lo semestral y lo anual aterricen solos en su mes — la parte que
armar a mano cuesta.

La ventana por defecto depende del año que se esté armando:

- **Un año que todavía no empezó** → los **doce meses ya cerrados**. Tomar "su propio
  año" no daría nada, y tomar el año en curso a mitad de año dejaría fuera noviembre y
  diciembre, que es donde están el aguinaldo y los cierres. Cada movimiento cae en **su
  mes del calendario** sin importar de qué año venga, así que con una ventana de octubre
  a septiembre los meses 10, 11 y 12 salen del año anterior y el resto del actual.
- **El año en curso o uno pasado** → ese mismo año, que es lo que uno espera al pararse
  en él.

La ventana se puede cambiar a mano, y hay un **reajuste en %** que sube o baja todos los
meses conservando la forma del reparto.

**Un proyectado vencido no entra; uno a futuro sí.** Lo que se planeó para una fecha que
ya pasó y no ocurrió no es base de nada. Lo que está por delante sí, porque para los
meses que faltan es el único dato que hay — por eso generar el año en curso a mitad de
año no devuelve un número que encoge con cada mes.

**Una ventana de más de doce meses sumaría el mismo mes dos veces** y el anual saldría
inflado sin que nada falle, así que se avisa antes de generar (`mesesRepetidos`).

Y no se puede generar en bloque sobre un año **aprobado**: pisaría la línea base. Ahí se
ajusta línea por línea, con su motivo.

### Una categoría puede llevarse por cargos

`Sueldos` no se controla por lo que se le paga a cada persona sino por lo que cuesta cada
**cargo**: el cargo persiste aunque cambie quién lo ocupa, y es la unidad en que se
presupuesta y en que se presenta al comité. Los cargos son **subcategorías** de `Sueldos`
(§3.1), y cada una lleva además el nombre de quien lo ocupa.

**El cargo y la persona son dos datos.** Si fueran uno, el día que alguien se va habría
que renombrar la subcategoría y todo el histórico del presupuesto pasaría a llamarse por
otra persona — justo lo que se quiere poder comparar entre años. Un cargo sin titular es
un cargo vacante: existe, se presupuesta y todavía no lo ocupa nadie.

Va como marca en la categoría (`categorias.por_cargos`) y no amarrado al id `sueldos`,
porque es **una forma de llevar una categoría y no una excepción**: el día que quieran
controlar otra así —honorarios por rol, por ejemplo— es una casilla y no un cambio de
código. No cambia nada de lo ya clasificado: un cargo es una subcategoría como cualquier
otra, y el flujo, el presupuesto y los reportes la agregan igual.

**El ejecutado de estas líneas se escribe a mano.** Es una excepción deliberada a "el
real se calcula de los movimientos", y se decidió después de descartar las alternativas:
del banco salen el líquido y el pago a PREVIRED, y **PREVIRED es un total para todos**,
así que no hay forma de atribuirlo por cargo sin que alguien cargue el desglose. Se
evaluó el libro de remuneraciones y se descartó por depender del formato del proveedor de
RR.HH. Ver §10.

### El presupuesto se aprueba, y desde ahí se ajusta dejando registro

Antes de aprobar, editar el anual es **construir**: se reparte sobre los doce meses y no hay
nada que anotar. **Aprobar el año es un acto explícito** —no "la primera vez que alguien
edita"— y congela una copia de los doce meses en `presupuesto_inicial`. Desde ahí, editar es
**ajustar**, y cambian tres cosas:

- **Los meses que ya pasaron no se tocan.** Son el plan contra el que se midió el gasto de esos
  meses: reescribirlos haría que el % utilizado de marzo cambie en octubre. Un ajuste mueve el
  cupo de aquí en adelante (`ajustarDesde` en `lib/presupuesto.ts`), conservando la forma del
  tramo igual que `reescalar` — bajar el anual no debe aplanar el aguinaldo de diciembre.
- **Puede no haber nada que repartir, y no se tapa.** Si el nuevo anual queda por debajo de lo
  ya presupuestado hasta el mes en curso, no hay reparto posible sin reescribir el pasado o
  poner meses en negativo. Se dice cuál es el mínimo alcanzable; quien de verdad quiera bajar
  más edita los meses a mano y lo deja dicho en el motivo.
- **Hay que decir por qué**, y lo exige la base. Cada mes que cambia deja una fila en
  `presupuesto_cambios` con el antes, el después, quién y el motivo. Un mes que no cambió no
  deja fila: si anotara los doce siempre, la bitácora diría que se ajustó el año entero cada
  vez que alguien corrige un mes.

El respaldo es **una copia y no la bitácora reproducida al revés**: la bitácora puede tener
huecos —una carga directa por SQL, una fila borrada— y el inicial es justamente lo que no puede
depender de eso. Son 3.600 filas al año.

En pantalla: la línea ajustada lleva su delta al lado del anual, y ese delta abre la bitácora de
esa línea. "Dónde se está ajustando" se lee, no se calcula.

**TC presupuestario fijo.** El presupuesto usa un tipo de cambio fijo definido al armar el año.
Si el TC flota, la desviación por gasto y la desviación por dólar se mezclan y ninguna se explica.

### 4.8 El hito es la cuota del plan de pagos

La columna `Action` de Quicken significa **dos cosas** según el registro: en los
espejos de proyección trae la empresa, y en PROYECTOS APROBADOS y en los registros de
banco trae un número. Ese número es la cuota del plan de pagos pactado con el
cliente — CUÁL, no cuántas: dentro de un proyecto forman secuencia, y "Escuela de
Liderazgo" del Banco de Chile tiene cobros del 1 al 11.

El importador tomaba la empresa y descartaba el número, así que 1.477 movimientos lo
perdieron. La migración `0013` agrega la columna y `scripts/recuperar-hito.mjs`
genera los UPDATE para devolverlo sin recargar nada.

Lo llevan solo los cobros de proyectos, así que es nulo en la enorme mayoría: por eso
se muestra como marca al lado del número de documento y no como columna propia.

### 4.7 Otras

- **Transferencias entre cuentas propias no son flujo.** Detectar el par y neutralizarlo, o el
  consolidado queda inflado en ambos sentidos. Existe una categoría "Traspaso entre empresas".
- **Deduplicación:** hash de (cuenta + fecha + monto + glosa normalizada) **más un secuencial**,
  porque puede haber dos cargos idénticos legítimos el mismo día.
- **Horizonte:** las proyecciones pasan del año calendario (hay movimientos a enero 2027).
  Los rangos de fecha no deben amarrarse al año en curso.

---

## 5. Catálogo de categorías

**16 grupos, 290 categorías y 3 subcategorías**, importados de Quicken. Ver §3.1 para
qué significa cada nivel.

```
INGRESOS
  A INGRESOS CLIENTES ............ 193 categorías (¡son clientes!)
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

Consecuencias prácticas: cualquier selector de categorías necesita **buscador**. Una lista
plana de 290 ítems es inusable, y un `<select>` nativo no alcanza: solo salta a lo que
*empieza* igual, así que escribir "internet" no encuentra "Telefonía e internet".

`components/ui/SelectorCategoria.tsx` filtra por cualquier palabra del nombre **o del
grupo**, en cualquier orden y sin tildes, y muestra arriba las últimas usadas — en un
registro se clasifica varias veces seguidas en lo mismo. Cada resultado lleva su grupo
encima porque dos categorías pueden llamarse igual en grupos distintos.

---

## 6. Vistas

| Vista | Qué hace |
|---|---|
| **Flujo de caja** | Réplica mejorada del reporte de Quicken. Rango de fechas libre, columnas semanales o mensuales, secciones por naturaleza → grupo → categoría. **Solo aparecen las líneas con movimiento en el rango.** Filtro por estado. Cada monto es clicable y abre el detalle con los movimientos que lo componen, reclasificables y seleccionables ahí mismo. |
| **Movimientos** | Registro único de todas las empresas. La **columna de Estado solo aparece cuando dice algo**: dentro de un registro los movimientos comparten estado casi siempre —una cuenta del banco es toda `conciliado`, la cartera toda `proyectado`— y la pastilla repetía la misma palabra en doscientas filas. Si en una cuenta hay algo que no corresponde, lo que no cuadra es el saldo contra la cartola, no la pastilla. Así que la pastilla sale cuando los estados **difieren** y la columna entera desaparece cuando además no hay ninguna acción que ofrecer (facturar, cobrar, marcar pagado). Es derivado, no una opción: si un `pagado` se cuela en una cuenta del banco, la columna vuelve sola y esa fila resalta. Con un registro abierto el **encabezado toma su nombre y su número**, como en Quicken: así se sabe en qué cuenta se está parado sin leer la barra lateral. El rótulo del número distingue lo que es — *Saldo de hoy* en el banco, *Total por cobrar* en la cartera, *Total comprometido* en las proyecciones, *Saldo del registro* en los de control — porque solo el del banco se cuadra contra una cartola. El alta abre en **la cuenta del registro que se está mirando**, y pide la empresa solo cuando la cuenta no la determina — sin proponer ninguna. Trae **una lista de líneas**: un movimiento puede nacer como split, que es como llega un pago que junta tres facturas. La categoría **no trae valor por defecto** — uno real, guardable, es peor que ninguno. Selección múltiple con suma de lo elegido —para cuadrar varias facturas contra una sola transferencia—. Empresa y categoría editables inline. Editor de splits con líneas, glosa, botones de IVA/retención, pegado masivo, y detector de descuadre. |
| **Conciliación** | Lista de `pagado` sin cuadrar. El total es exactamente la diferencia contra la cartola. |
| **Presupuesto anual** | Dos modos: *construcción* (responsable, ppto año anterior, ppto año, variación, notas) y *control* (ejecutado, % utilizado con marca de avance del año, disponible, proyección de cierre). |
| **Reportes** | Armador configurable: filas (categoría / grupo / naturaleza / empresa / proveedor), columnas (mes / trimestre / empresa / grupo / naturaleza / total), rango de fechas con presets, filtro de estados y de categorías. Configuraciones guardables. Export CSV. |
| **Maestros** | Empresas con el número de cuenta que paga, y proveedores con RUT, banco y cuenta. Se cargan pegando las filas del Excel —acá el importador sí se muestra, al revés que en Categorías: los datos ya existen en una planilla—. El RUT se valida con su dígito verificador: el portal rechaza la nómina completa, no la línea mala. Un proveedor se desactiva en vez de borrarse, para conservar sus datos por si vuelve. |
| **Categorías** | Mantenedor de los tres niveles. Lo que está en uso no se borra: se desactiva. Existe un importador por pegado (`components/categorias/Importador.tsx`) que **no se muestra**: el equipo crea las categorías caso a caso y el panel estorbaba. Se conserva probado, para devolverlo si aparece una carga masiva. |

---

## 7. Stack

- **Postgres vía Supabase** — auth con Google corporativo, Row Level Security para permisos.

  **El respaldo automático depende del plan contratado**, no viene por el solo hecho de usar
  Supabase: en el gratuito no hay ninguno. Hay que verificarlo en el panel (Database → Backups)
  y no darlo por hecho. Además, un respaldo del proveedor no cubre el caso que de verdad ocurre
  en una operación de tres personas: alguien borra algo sin querer y no hay deshacer (§10).

  Por eso Maestros tiene **"Descargar todo"**, que baja un JSON con todas las tablas a tu
  computador. Pasa por la sesión de quien lo pide, así que respeta RLS y no necesita la llave
  de service_role — que se sacó de Vercel a propósito porque se la salta.
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
Identidad institucional de Adapsys — `docs/Adapsys_Kit_Proyecto_Claude.md`. **Poppins** en toda
la interfaz y paleta teal (`#006379` · `#00B8B8` · `#B6E6E6`) con magenta `#C20C5B` para los
montos negativos, sobre fondo `#F3F3F3`.

**Los números van en monoespaciada** (`--font-cifras`), y no es una desviación del kit sino algo
que el kit no contempla: está escrito para presentaciones. En una tabla de 10.530 movimientos los
dígitos tienen que caer en columna para poder comparar `−1.253.118` con `−306.745` de un vistazo.
El token se llama por su función, no por su forma, justamente para que no se cuele en una etiqueta.

Del kit **no se aplican** dos cosas, a propósito:
- Círculos, grids de puntos y gradientes: son para portadas de slides. Acá serían ruido sobre el dato.
- El mínimo de 24px: es para leer proyectado a distancia. Acá vaciaría la pantalla.

La densidad no se negocia: esto es una herramienta de trabajo diario, no una landing. Cuando el kit
y la densidad choquen, gana la densidad — el kit resuelve cómo se ve Adapsys, no cómo se lee una
tabla de tesorería.

**La barra lateral tiene que caber entera**, porque abajo del todo están los vencidos y son lo que
se mira todos los días: si hay que desplazarla, el número que importa queda fuera de la pantalla.
Tres cosas la estiraban y ninguna decía nada nuevo, y conviene no volver a meterlas:

- **La moneda, pegada al nombre.** "Egresos proyectados · CLP" no entraba en el ancho y envolvía
  la fila a dos líneas. Va como marca aparte, en **columna de ancho fijo** igual que el monto: sin
  eso cada marca queda pegada a su número, y como los números miden distinto —`$−834.974.751`
  contra `US$−4.520`— terminan en posiciones distintas y la lista se ve desprolija.
- **Glosas de dos y tres líneas** explicando cada bloque. Se leen una vez en la vida; viven en el
  `title` del rótulo de su sección. La única que quedó en pantalla es la de §4.5, abajo y en una
  línea, porque explica por qué el saldo en dólares no cuadra con nada del flujo.
- **El total de la empresa y su cuenta en pesos eran el mismo número.** El total es la suma de las
  cuentas CLP y hay una sola por empresa, así que estaba escrito dos veces, una abreviado y otra
  entero. Ya no está: la lista son las siete cuentas, **cada una con su nombre entero**, como en
  Quicken. Hubo un paso intermedio en que la de pesos tomaba el nombre de la empresa y la de
  dólares decía solo "USD", sangrada debajo, y se leía como un encabezado de grupo con una cuenta
  adentro cuando son dos cuentas hermanas. Lo único que agrupa por empresa es el respiro entre una
  y la siguiente.

**El color estructura en vez de decorar.** Los rótulos de sección y los saldos del banco van en
teal oscuro, el registro abierto lleva barra teal y fondo `#B6E6E6`, y el magenta queda reservado
a negativos y vencidos. Es lo que permite distinguir los tres bloques sin las glosas.

**Y la barra no filtra por empresa.** Una fila abre un registro y nada más. El nombre de la
empresa filtraba el selector global de arriba, que apaga las otras empresas en *todas* las
vistas: se activaba sin querer al apuntar al nombre, dejaba el selector diciendo "1 EMPRESAS"
sin nombrar cuál, y el "Ver todo" de la barra no lo deshacía. Dos acciones distintas en una
misma fila es una de más. Filtrar es del selector de arriba, que ahora sí nombra la empresa
cuando hay una sola elegida.

### Las migraciones se corren a mano, así que tienen que ser repetibles

No hay CLI de migraciones: se pegan en el editor SQL de Supabase. Ahí una corrida puede
quedar a medias, o repetirse porque no quedó claro si la anterior pasó. Una migración
que falla con "la columna ya existe" obliga a editar el archivo para saltarse lo ya
hecho, y ese es justo el momento en que alguien se salta de más.

Toda migración nueva se escribe para poder correrse dos veces: `add column if not
exists`, `drop constraint if exists`, `create index if not exists`, `create or replace
function`, y `drop trigger if exists` antes de cada `create trigger`. Un `check` que
acompaña a una columna va en su propio `do $$ ... $$` guardado, porque `add column if
not exists` no lo agrega cuando la columna ya estaba y quedaría sin validación.

`supabase/esquema.test.ts` corre las últimas dos veces seguidas. Ya pasó dos veces que
una migración reventara a mitad de camino en producción.

### Escribir a la base espera

Movimientos, catálogo y maestros se persisten **con 700 ms de espera** desde el último
cambio, no en cada `setState`. Sin eso hay una escritura por tecla —una glosa de veinte
caracteres son veinte UPDATE— y, peor, se guardan los **estados intermedios**: un campo
`<input type="date">` a medio escribir vale `""`, la base rechaza el movimiento entero
con *invalid input syntax for type date* y el cartel de error aparece aunque el valor
final sea correcto. Al recargar todo se ve bien, porque lo que falló nunca llegó.

Lo mismo vale para cualquier campo de texto que se agregue a futuro.

Y por las dudas: un `<input type="date">` **nunca** debe escribir su vacío al estado.
Un movimiento sin fecha no existe — no está en ninguna cartola ni en ninguna proyección.

### Un campo controlado no se normaliza mientras se escribe

Lo que se guarda vuelve a la pantalla en el mismo render, así que **cualquier limpieza
aplicada en el `onChange` se le aplica al usuario a mitad de palabra**. Recortando con
`trim` en cada tecla, el espacio con que se separa el nombre del apellido desaparece
antes de poder escribir la letra siguiente y la barra espaciadora parece rota — pasó con
el titular de un cargo, y costó ver porque un espacio **en medio** sí entra: `trim` solo
toca las puntas.

La limpieza va en el `onBlur`, al salir del campo. Lo único que sí corresponde normalizar
al escribir es lo que tiene un significado distinto —el vacío de un titular es un cargo
vacante, y ahí `"" → null`—, porque eso no cambia lo que la persona está tecleando.

### Mientras carga no se muestra ningún número

Hasta que los movimientos llegan de la base, **todos los números de la pantalla están
mal**: el saldo de cada cuenta vale su saldo inicial, el comprometido y los vencidos
valen cero, y el gasto a la fecha del presupuesto vale cero. Son números **plausibles y
equivocados**, que es la peor clase — nadie sospecha de un saldo con la forma de un
saldo. La banda de "Cargando movimientos…" no alcanza: lo de abajo se lee como un dato.

Así que mientras `cargando` está en true se muestra el hueco y no el número
(`Hueco` y `TablaFantasma` en `components/ui/primitivas.tsx`). El rótulo sí se muestra,
para que la pantalla no cambie de forma al llegar el dato. Y una tabla vacía no dice "no
hay movimientos" mientras carga: sería afirmar lo contrario de lo que pasa, con el mismo
aspecto que el caso real.

Vale para cualquier cifra que se agregue: **si el número sale de los movimientos, mientras
cargan no se muestra.**

### Verificación obligatoria
**Compilar no basta.** El bundler valida sintaxis pero no detecta referencias a variables usadas
antes de su declaración ni identificadores inexistentes — un error real de este proyecto fue una
constante usada 55 líneas antes de declararse, que reventaba al cargar el módulo y compilaba sin quejas.

Antes de entregar cualquier cambio: renderizar de verdad, recorriendo todas las vistas y con los
paneles expandidos. En el prototipo eso se hizo con `react-dom/server` y un `window`/`document`
mínimo. En la app real, tests de render por ruta.

**Los tests de render van repartidos por vista** (`components/<vista>.test.tsx`, con el entorno
común en `components/pruebas/entorno.tsx`), y no es orden sino necesidad: juntos en un solo
archivo el proceso se quedaba sin heap y los últimos tests **nunca llegaban a correr, con la
suite igual reportándose en verde**. Si un archivo vuelve a crecer hasta ahí, se parte.

Ojo con eso al leer el resumen de vitest: `Tests 406 passed (408)` no es verde — dos no se
ejecutaron. El número entre paréntesis es el que importa.

---

## 9. Parámetros a verificar (no hardcodear)

- **Tasa de retención BHE.** Se usó 15,25% para 2026 según la escala de la Ley 21.133, que sube
  hasta 17% en 2028. **Verificar la vigente con el SII** — puede haber cambiado. Debe ser un
  parámetro con vigencia por año, no una constante.
- **IVA 19%** — estable, pero igual parametrizado.
- **Tipo de cambio.** Lo define el equipo a mano, año a año o cuando haga falta sacar los datos.
  No se consulta a ninguna fuente automática y **no se guarda por movimiento** (§4.5): las cuentas
  en dólares se llevan en dólares. El único uso es el control presupuestario, con TC fijo del año
  (§4.6), que vive en `parametros.tc_presupuesto` con vigencia.

---

## 10. Pendientes y preguntas abiertas

**Definidos, sin implementar**
- Cierre de período: bloquear meses ya reportados para que nadie "arregle" marzo en julio.
- Auditoría: quién cambió qué y cuándo. Nada se borra, se anula con contraasiento.
- Autoclasificación por diccionario de proveedores. Ya existe uno construido para la conciliación
  de la tarjeta corporativa; reutilizarlo.

### Pago de proveedores

Pedido por el equipo. Dos piezas:

1. **Mantenedor de proveedores** con RUT, banco y cuenta. El equipo ya tiene esos datos
   en un Excel, con los códigos de banco; se carga de ahí, no se escribe de nuevo.
2. **Exportar la nómina de pago** lista para subir al portal del banco. Sale de la
   proyección de egresos **en pesos**, tomando lo **vencido** y lo que **vence hoy**.

**Solo CLP.** Los pagos en dólares no tienen formato de carga y se hacen directo en el
portal, así que las columnas de moneda son constantes y no hay que resolver conversión
ni mezcla de monedas en el archivo.

**Una línea por documento**, no una por proveedor. No es solo preferencia: la glosa que
llega al banco se arma con número de documento + nombre, y agrupando tres facturas no
entra en los caracteres disponibles.

**La plantilla del portal** — 13 columnas, en este orden:

| # | Columna | Ejemplo | De dónde sale |
|---|---|---|---|
| A | `Cta_origen` | `73021634` | La cuenta que paga. **No la tenemos: `cuentas` no guarda el número.** |
| B | `moneda_origen` | `CLP` | `cuentas.moneda` |
| C | `Cta_destino` | `70684756` | Maestro de proveedores |
| D | `moneda_destino` | `CLP` | Maestro de proveedores |
| E | `Cod_banco` | `37` | Maestro de proveedores (código del banco, no el nombre) |
| F | `RUT benef.` | `766244890` | Maestro. **Sin puntos ni guion**, con el dígito verificador pegado |
| G | `nombre benef.` | `Smartbricks Technologies SPA` | Maestro |
| H | `MtoTotal` | `1264717` | `movimientos.monto`, en magnitud |
| I | `Glosa TEF` | `FA2446 Smartbricks Technologies SPA` | `documento` + nombre |
| J | `Correo` | `karina.urbina@smartbricks.cl` | Maestro |
| K | `Glosa correo` | idem I | |
| L | `Glosa Cartola Cliente` | idem I | Es la que se ve en NUESTRA cartola |
| M | `Glosa Cartola Beneficiario` | idem I | La que ve el proveedor |

**La glosa: 45 caracteres, y sin tildes.**

Las cuatro glosas (I, K, L, M) salen iguales, así que se generan de una sola función.
Al recortar se **acorta el nombre del proveedor, nunca el número de documento**: el
número es lo que permite identificar el pago después, el nombre ya está en la columna G.

Y hay que sacar las tildes. La glosa más larga que soporta la cartola llegó así:

```
FA174670 Empresa Social de Comercializacio?n
```

Esa `?` está justo donde iba la tilde de "Comercialización". El texto viene en Unicode
**descompuesto** (NFD): la `ó` son dos caracteres, la `o` y una tilde combinante suelta,
y el banco no sabe qué hacer con la segunda. Dos consecuencias:

- El beneficiario ve un signo de pregunta en su cartola.
- La tilde **ocupa un carácter del cupo**: `FA174670 Empresa Social de Comercialización`
  mide 43 compuesta y 44 descompuesta. Contar sin normalizar da largos distintos para
  el mismo texto.

Así que antes de medir y de escribir: normalizar y quitar los diacríticos. Queda en 43
y legible. `lib/catalogo-edicion.ts` ya hace exactamente eso en `slug()`.

**Qué entra a la nómina.** No se puede deducir del movimiento: la proyección de egresos
mezcla cosas que se transfieren con cosas que no (remuneraciones, que van por el
software de RR.HH.; impuestos que se pagan en el portal del organismo; el estado de
cuenta de la tarjeta; caja chica). Y no alcanza con mirar la contraparte: líneas como
"INGRESO MÍNIMO ASEGURADO" son una proyección que después se abre y se le cargan los
documentos de respaldo, y esos **sí** se transfieren.

La regla es el maestro: **entra lo que tiene proveedor con cuenta bancaria cargada**.
Eso deja la decisión donde hay un humano que la tomó una vez, en vez de adivinarla por
el nombre en cada corrida.

Ojo además con el signo: el registro de proyección tiene montos de los dos sentidos
—"ENZO ANZIANI" son 30 líneas de *B OTROS INGRESOS* ahí adentro—, así que hay que
filtrar por egreso.

**Lo que falta**

- El **Excel de proveedores** del equipo. La vista y el pegado ya están; falta el
  contenido.
- Cómo se **empareja un movimiento con su proveedor**. Hoy la contraparte es texto
  libre; lo más simple es calzar por nombre normalizado, y el maestro se carga con el
  nombre tal como aparece en los movimientos.
- Confirmar si el portal además rechaza tildes en la **columna G** (`nombre benef.`) o
  solo las mangle en la glosa. Por ahora se normaliza solo la glosa, que es donde hay
  evidencia.

### El registro CC Perú: un control que no entra a ninguna parte

En Quicken vive como cuenta porque no había otra forma, pero no es una cuenta: es un
registro de lo que se mueve con Adapsys Perú. Cada semestre se netea y el país que debe
le paga al otro — **ese pago sí sale del banco** y se registra normal en la cuenta dólar
de CLA ADAPTACIÓN.

La regla, tal como la dio el equipo: **no se incluye en ninguna parte**. Ni en el flujo
de caja, ni en el control presupuestario, ni en los saldos. Solo se mira para llevar la
cuenta.

Eso pide un tercer tipo de cuenta, distinto de los dos que había:

| tipo | Entra al flujo | Entra al presupuesto | Suma al saldo |
|---|---|---|---|
| `banco` | sí | sí | sí |
| `cxc` (cartera, proyecciones) | sí, como proyectado | sí | no |
| `control` | **no** | **no** | **no** |

La exclusión vive en **un solo lugar**: `ProveedorTesoreria` arma `movimientos` sin ellos,
y solo los deja pasar cuando el registro abierto es el suyo. No está repartida por las
vistas a propósito — el flujo, el presupuesto, el contador de vencidos y el de por
conciliar salen todos de esa lista, y una vista nueva queda bien por omisión. La prueba
está en `components/control.test.tsx`, porque es una regla que no se ve: un registro de
más en el flujo no se delata, el flujo igual suma.

Ojo al cargarlo: los movimientos que hoy están en `a1`/`a2` con la categoría "Cuenta
corriente Perú-Chile" **son correctos y se quedan donde están** — son pagos y cobros
reales del banco chileno. El registro nuevo es otra cosa y no hay que mezclarlos.

**El export vino en dos mitades, y cada una traía bien algo distinto.** El CSV salió con
los decimales ocultos: Quicken redondea cada fila para mostrarla pero totaliza los valores
reales, así que las 140 filas sumaban 4.638 contra los 4.642 de su propio pie. El PDF sí
trae los centavos, pero **recorta las columnas largas** con "…", así que ahí las glosas
están incompletas. Las dos fuentes calzan fila a fila por fecha, contraparte y monto
redondeado, y de cada una se tomó lo que traía bien. Total: **US$ 4.641,69 en 140
movimientos**, de enero 2022 a agosto 2025.

Leer el PDF tiene tres trampas, por si hay que repetirlo
(`scripts/leer-pdf-quicken.py`): la posición de cada celda es `CTM × Tm` compuestas —
Quicken usa las dos y mirando solo una, media tabla aterriza en el origen—; las fuentes
van en **MacRomanEncoding** y leerlas como latin-1 se come las tildes; y el `$` viene en
una fuente aparte de un solo glifo donde el byte `0x21` mapea a `U+0024`.

### La proyección se genera del presupuesto, no de reglas por proveedor

Decidido con el equipo. La tentación es modelar recurrencias por proveedor ("GTD, día 14,
mensual") y generar la serie del año. **No sirve como mecanismo principal:** un proveedor puede
cambiar, puede ser ocasional, o tener un único pago en el año. Modelar cada uno como regla
obliga a mantener reglas que no se sostienen.

El mecanismo es al revés: **la línea de presupuesto por categoría genera la proyección del
año**, distribuida en el tiempo. El proveedor es el dato de la contraparte, no la unidad de
proyección.

Consecuencias a resolver cuando se implemente:
- **Doble conteo.** Si la línea "Telefonía" está proyectada por presupuesto y además existe un
  movimiento proyectado de GTD para septiembre, el mes queda contado dos veces. La proyección
  generada tiene que ser el presupuesto **menos lo ya comprometido con movimientos concretos**,
  por categoría y por período.
- Un movimiento proyectado que viene del presupuesto y uno cargado a mano tienen que
  distinguirse, para no pisar lo que alguien escribió.
- Depende de la distribución mensual del presupuesto (el punto de más arriba): sin ella la
  proyección generada sale lineal y las líneas estacionales quedan mal repartidas.

### El costo de personas se lleva por cargo, y a mano

Decidido después de explorar las fuentes automáticas y descartarlas todas.

El presupuesto por cargo es el **bruto**: el líquido que se transfiere más las
imposiciones, sin el impuesto único, que se paga al SII en el F29 mezclado con el IVA y
queda fuera por decisión del equipo. Anual = bruto × 12.

Por qué no se saca del banco: salen **dos pagos** y solo uno se puede abrir por persona.
La transferencia de sueldos sí; el pago a PREVIRED es **un total para todos**, y de ahí
no se puede sacar cuánto le toca a cada cargo.

Por qué no se saca del libro de remuneraciones: se analizó uno real y **sirve** —trae
`CARGO` por persona y la aritmética cierra—, pero el export es propio del proveedor de
RR.HH. y el equipo prefirió no depender de él. Dos hallazgos de ese análisis que vale
conservar, porque cambian la cuenta:

- El bruto tiene **cuatro** pedazos, no dos: líquido (68%), previsionales del trabajador
  (17%), impuesto único (5%) y **anticipos y préstamos (11%)**. Esos últimos no van a
  PREVIRED — son plata ya adelantada o que se está recuperando.
- El libro trae **solo el lado del trabajador**. El aporte patronal —SIS, AFC empleador,
  mutual— va igual en el pago a PREVIRED y no aparece ahí, así que el pago siempre es
  mayor que la suma de los descuentos del libro.

Si algún día se retoma lo automático, el camino es el **Libro de Remuneraciones
Electrónico** de la Dirección del Trabajo: formato fijo, conceptos codificados y
obligatorio para todo proveedor, así que cambiar de app de RR.HH. no lo rompe.

**Falta** la carga mensual del bruto por cargo, que es lo que alimenta el reporte al
comité.

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

Al reemplazar el catálogo de categorías, los movimientos cuyas categorías desaparezcan quedan
huérfanos. No fallar en silencio: contarlos, marcarlos visiblemente y ofrecer una pantalla de
reclasificación. Esto va a pasar de verdad en la migración.

---

## 12. Archivo de referencia

`tesoreria.jsx` — prototipo funcional de una sola pieza, con el catálogo de entonces (dos niveles),
datos de ejemplo que reproducen movimientos reales del Quicken actual (incluidos los splits de GTD
y las boletas de honorarios con retención), y las seis vistas implementadas.

Sirve como especificación ejecutable: si hay duda sobre cómo debería comportarse algo, está ahí.
No sirve como base de código para producción — usa estado en memoria y `window.storage`, no
tiene backend, permisos ni validación.
