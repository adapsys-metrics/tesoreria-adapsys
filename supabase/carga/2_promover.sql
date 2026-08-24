-- Paso 3 de 3 de la carga del histórico de Quicken (el paso 2 es importar los
-- dos CSV desde el Table Editor).
--
-- Pasa las tablas de staging a movimientos y movimiento_lineas, y las borra.
--
-- Va todo en una transacción por una razón concreta: la validación de que las
-- líneas del split cuadran con el monto es una constraint trigger DIFERIDA, que
-- se evalúa recién en el COMMIT. Si esto se corriera por partes, la primera
-- línea de cada split quedaría sola y la validación la rechazaría con razón.
-- Corriéndolo entero, las 15.475 líneas están puestas cuando se evalúa.
--
-- Y por eso mismo: o entra todo o no entra nada. No deja la base a medias.

begin;

-- Columna puente para saber qué línea va con qué movimiento. El id de
-- movimientos es `generated always as identity`, así que no se puede traer del
-- CSV: hay que insertar primero y recuperar el id que asignó la base.
alter table movimientos add column carga_ref text;

insert into movimientos
  (fecha, empresa_id, cuenta_id, contraparte, glosa, monto, moneda, estado, origen, carga_ref)
select
  fecha,
  nullif(empresa_id, ''),   -- la provisión GAP IMA no tiene empresa ni cuenta
  nullif(cuenta_id, ''),
  nullif(contraparte, ''),
  nullif(glosa, ''),
  monto,
  moneda,
  estado,
  origen,
  ref
from carga_movimientos;

insert into movimiento_lineas (movimiento_id, subcategoria_id, monto, glosa, orden)
select m.id, l.subcategoria_id, l.monto, nullif(l.glosa, ''), l.orden
from carga_lineas l
join movimientos m on m.carga_ref = l.mov_ref;

alter table movimientos drop column carga_ref;

drop table carga_lineas;
drop table carga_movimientos;

commit;

-- Verificación. Los saldos calculados tienen que dar los mismos números que
-- imprime Quicken al pie de cada registro (§11). Si alguno no calza, la
-- importación está mal y hay que deshacerla con:
--
--   delete from movimientos where origen is not null;
--
-- (las líneas se van solas por el on delete cascade)
select
  c.id,
  c.nombre,
  c.saldo_inicial + coalesce(sum(m.monto) filter (where m.estado <> 'proyectado'), 0) as saldo,
  count(m.id) filter (where m.estado = 'proyectado') as proyectados
from cuentas c
left join movimientos m on m.cuenta_id = c.id
group by c.id, c.nombre, c.saldo_inicial
order by c.id;
