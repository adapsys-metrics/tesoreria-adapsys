-- El tipo de cambio no es un dato del movimiento.
--
-- 0001 exigía tipo_cambio en todo movimiento en dólares, leyendo §4.5 como que
-- cada movimiento conserva el TC del día. No es así como se trabaja: las cuentas
-- en dólares se llevan EN dólares porque reflejan la cartola del banco, igual que
-- las cuentas en pesos. En la cartola no hay conversión, hay dólares.
--
-- El TC hace falta en un solo lugar, el control presupuestario, y ahí es un
-- parámetro fijo del año (§4.6) — ya está en `parametros` como tc_presupuesto,
-- con vigencia. Se aplica al consultar, no al registrar.
--
-- Pedirlo en cada movimiento obligaba a inventar un número para 390 movimientos
-- históricos que nunca tuvieron uno.
alter table movimientos drop constraint moneda_usd_requiere_tc;

-- La columna se queda: hay movimientos que sí tienen un TC propio y real, como
-- un traspaso donde el banco aplicó una tasa concreta. Guardarlo cuando se sabe
-- sigue siendo correcto (§4.5, no convertir destructivamente). Lo que se elimina
-- es la obligación de tenerlo siempre.
comment on column movimientos.tipo_cambio is
  'TC propio del movimiento, cuando la operación tuvo uno concreto. '
  'Normalmente null: las cuentas en dólares se llevan en dólares. '
  'Para el control presupuestario se usa parametros.tc_presupuesto, no esto.';
