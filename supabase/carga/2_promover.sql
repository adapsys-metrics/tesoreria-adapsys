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

-- Sin esto, correr este archivo antes de importar los CSV "funciona": inserta
-- cero filas, borra las tablas de paso y no dice nada. Quien lo corrió queda
-- convencido de que cargó, y el siguiente intento falla con "la relación
-- carga_movimientos no existe" sin ninguna pista de por qué. Pasó de verdad.
do $$
declare
  n_movimientos bigint;
  n_lineas bigint;
begin
  select count(*) into n_movimientos from carga_movimientos;
  select count(*) into n_lineas from carga_lineas;
  if n_movimientos = 0 or n_lineas = 0 then
    raise exception
      'Las tablas de paso están vacías (% movimientos, % líneas). Falta el paso 3: importar los dos CSV desde el Table Editor.',
      n_movimientos, n_lineas;
  end if;
  raise notice 'Promoviendo % movimientos y % líneas.', n_movimientos, n_lineas;
end $$;

-- Columna puente para saber qué línea va con qué movimiento. El id de
-- movimientos es `generated always as identity`, así que no se puede traer del
-- CSV: hay que insertar primero y recuperar el id que asignó la base.
alter table movimientos add column carga_ref text;

-- Los ::tipo son a propósito. El importador de CSV del Table Editor, cuando crea
-- la tabla él mismo, deja todas las columnas como text — y ahí un
-- `insert into ... select` falla con "column monto is of type numeric but
-- expression is of type text", porque Postgres no convierte text a numeric solo.
-- Con los casts explícitos esto anda igual con las tablas del paso 1 y con las
-- que arma el importador.
insert into movimientos
  (fecha, empresa_id, cuenta_id, contraparte, glosa, documento, monto, moneda, estado, origen, carga_ref)
select
  fecha::date,
  nullif(empresa_id::text, ''),   -- la provisión GAP IMA no tiene empresa ni cuenta
  nullif(cuenta_id::text, ''),
  nullif(contraparte::text, ''),
  nullif(glosa::text, ''),
  nullif(documento::text, ''),
  monto::numeric,
  moneda::text,
  estado::text,
  origen::text,
  ref::text
from carga_movimientos;

insert into movimiento_lineas (movimiento_id, categoria_id, monto, glosa, orden)
select m.id, l.categoria_id::text, l.monto::numeric, nullif(l.glosa::text, ''), l.orden::integer
from carga_lineas l
join movimientos m on m.carga_ref = l.mov_ref::text;

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
