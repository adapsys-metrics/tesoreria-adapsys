# Libro de remuneraciones

Acá va el export mensual de remuneraciones, para poder abrir el costo de personas
por cargo en el control presupuestario (§4.6).

**Nada de esta carpeta entra al repo**, salvo este archivo. Trae el sueldo de cada
persona con nombre y RUT: son datos personales de gente identificable, no cifras
agregadas de la empresa. Vale lo mismo que `datos-quicken/` y un poco más.

## Qué hace falta y por qué

El presupuesto se lleva **por cargo** —"Especialista de Finanzas" es una
subcategoría de `Sueldos`— y el monto presupuestado es el bruto: el líquido que se
transfiere más las imposiciones. Pero del banco salen dos pagos y solo uno se
puede abrir por persona:

| Pago | ¿Se abre por cargo? |
|---|---|
| Transferencia de sueldos | sí — es el líquido de cada uno |
| PREVIRED | **no** — es un total para todos |

Sin el desglose por persona de las imposiciones, el ejecutado por cargo queda con
la mitad medida y la otra mitad sin forma de obtenerla. El libro de remuneraciones
la tiene.

Ojo: el **impuesto único** se paga al SII en el F29, mezclado con el IVA, y queda
fuera de este control por decisión del equipo. Así que el bruto que se presupuesta
es líquido + imposiciones, que es exactamente lo que sale del banco por ese cargo.

## El formato importa

Conviene exportar el **Libro de Remuneraciones Electrónico (LRE)** de la Dirección
del Trabajo y no un informe propio del proveedor. El LRE tiene columnas fijas y
conceptos codificados, y cualquier proveedor está obligado a emitirlo igual: si
algún día se cambia Buk por otro, el archivo sigue sirviendo.

Si lo que hay es un export propio, también se puede, pero el parser se construye
mapeando **por nombre de columna y no por posición** —como `lib/proveedores-pegado.ts`—
para que un cambio de formato sea ajustar un mapeo y no reescribirlo.

## Cómo pasarlo

Dejar el archivo acá con un nombre que diga el mes, por ejemplo
`LRE 2026-09.csv`. Si se prefiere, se pueden cambiar los nombres de las personas
antes: para construir el parser hace falta la **estructura y los montos**, no quién
es quién. El cargo sí hace falta, porque es la unidad de control.
