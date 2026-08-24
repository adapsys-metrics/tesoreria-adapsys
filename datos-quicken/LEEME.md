# Exports de Quicken

Acá van los CSV exportados desde Quicken para la migración. **Esta carpeta está en
`.gitignore`**: son los movimientos reales de la empresa y no pueden quedar en el
historial de git, que es público para cualquiera que clone el repo.

## Por qué el nombre del archivo importa

El CSV **no dice de qué cuenta salió**. Sus columnas son:

```
Scheduled, Split, Date, Action, Check #, Payee, Memo/Notes, Category, Amount, Balance
```

`Action` trae la empresa (`CLA ADAPTACIÓN`, `SANTA MARÍA`…), pero nada identifica el
registro de origen. Un movimiento de la cuenta en pesos y uno de la cuenta en dólares
de la misma empresa son indistinguibles por su contenido.

Así que el nombre del archivo es el único dato que dice a qué cuenta pertenece, y el
importador lo lee de ahí. Guardar cada export como:

```
<id-de-cuenta>.csv
```

usando el `id` de la tabla `cuentas` (`supabase/seed.sql`).

## Registros a exportar

Cuentas de banco:

| Archivo | Registro en Quicken |
|---|---|
| `a1.csv` | CLA ADAPTACIÓN PESOS |
| `a2.csv` | CLA ADAPTACIÓN DÓLAR |
| `b1.csv` | CLA CONSULTORES PESOS |
| `b2.csv` | CLA CONSULTORES DÓLAR |
| `c1.csv` | CLA CONSULTING PESOS |
| `c2.csv` | CLA CONSULTING DÓLAR |
| `d1.csv` | CLA CONSULTORIA PESOS |
| `e1.csv` | SANTA MARÍA PESOS |
| `e2.csv` | SANTA MARÍA DÓLAR |
| `x1.csv` | FACTURAS POR COBRAR (CLP) |
| `x2.csv` | FACTURAS POR COBRAR (USD) |

Cuentas espejo de proyección (CLAUDE.md §4.1). No son cuentas en este sistema: sus
filas entran como movimientos en estado `proyectado`, por eso el nombre distinto:

| Archivo | Registro en Quicken |
|---|---|
| `proy-egresos-clp.csv` | PROY. EGRESOS (CLP) |
| `proy-egresos-usd.csv` | PROY. EGRESOS (USD) |
| `proyectos-aprobados-clp.csv` | PROYECTOS APROBADOS (CLP) |
| `proyectos-aprobados-usd.csv` | PROYECTOS APROBADOS (USD) |

## Cómo exportar

En Quicken, con el registro abierto: **File → Export → Register to CSV**, rango
**All Dates**. Es el mismo procedimiento con el que se generó el export de
CLA ADAPTACIÓN PESOS.

**La caja de búsqueda tiene que estar vacía.** Si queda texto ahí, Quicken exporta
solo lo que la búsqueda muestra y el archivo sale incompleto aunque el encabezado
siga diciendo "All Dates". El validador lo detecta y se niega a seguir, pero es
más fácil no hacerlo: se ve en el encabezado del CSV como
`Search All Visible Columns for '...'`.

Las columnas dependen de cuáles estén visibles en cada registro, así que los 15
archivos no traen el mismo set. No importa: todo se lee por nombre de columna.

## Cómo cargar a Supabase

1. **Generar los CSV de carga** (esto lo corre quien tenga Node 22):

   ```
   node --experimental-strip-types scripts/generar-carga.mjs
   ```

   Valida que cada archivo calce con los totales que Quicken imprime al pie y
   escribe `carga/carga_movimientos.csv` y `carga/carga_lineas.csv`. Si algo no
   calza, para y no escribe nada.

2. **Crear las tablas de paso**: pegar `supabase/carga/1_crear_staging.sql` en el
   SQL Editor y correr.

3. **Importar los dos CSV**: Table Editor → tabla `carga_movimientos` →
   *Import data from CSV*. Lo mismo con `carga_lineas`.

4. **Promover**: pegar `supabase/carga/2_promover.sql` y correr. Pasa todo a
   `movimientos` y `movimiento_lineas` en una sola transacción y borra las tablas
   de paso. Al final imprime los saldos calculados por cuenta.

5. **Verificar**: esos saldos tienen que dar los mismos números que Quicken.

Si algo salió mal, se deshace entero con:

```sql
delete from movimientos where origen is not null;
```

Las líneas se van solas por el `on delete cascade`. La columna `origen` guarda de
qué archivo vino cada movimiento, así que también se puede rehacer un solo
registro sin tocar el resto.
