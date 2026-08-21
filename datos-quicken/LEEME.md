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
