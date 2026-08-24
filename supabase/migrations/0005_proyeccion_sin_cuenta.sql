-- Una proyección puede no saber todavía de qué cuenta va a salir.
--
-- Mismo caso que empresa_id en 0003 y la misma razón: la provisión "GAP IMA 2026"
-- es un compromiso de fin de año que no tiene sociedad ni cuenta asignada porque
-- depende de por dónde se gestione. Y cuando la proyección se genere desde el
-- presupuesto (§10), que es consolidado y no tiene ni empresa ni cuenta, va a ser
-- el caso normal y no la excepción.
--
-- La alternativa era asignarle una cuenta cualquiera, que es inventar un dato:
-- diría que CLA ADAPTACIÓN paga esos 100 millones cuando nadie lo ha decidido.
alter table movimientos alter column cuenta_id drop not null;

comment on column movimientos.cuenta_id is
  'Cuenta por la que se mueve la plata. Null mientras no se sepa, solo posible '
  'en proyecciones: un movimiento pagado siempre salió de alguna cuenta.';

-- La foreign key compuesta (cuenta_id, moneda) → cuentas (id, moneda) sigue
-- vigente. Con MATCH SIMPLE, que es el default, no se evalúa cuando cuenta_id es
-- null, así que la proyección sin cuenta pasa; y en cuanto se le asigna una, la
-- moneda vuelve a quedar amarrada. La moneda nunca queda libre: tiene su propio
-- check contra ('CLP','USD').
