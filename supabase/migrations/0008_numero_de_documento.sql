-- Número del documento: FA273, B405, la boleta o la factura que respalda el
-- movimiento.
--
-- Hasta ahora vivía dentro de la glosa, que es donde lo dejó la importación de
-- Quicken ("FA273 Propuesta Adopción de IA"). Eso alcanza para leerlo pero no para
-- trabajarlo: no se puede buscar por número, ni ordenar por él, ni verificar que
-- una factura emitida no se duplicó. En ventas el número ES la identidad del
-- documento, así que va en su propia columna.
--
-- Ojo con el nombre: `doc_tipo` ya existe y es otra cosa —exento, afecta,
-- honorario—, que determina si lleva IVA o retención (§4.3).
alter table movimientos add column documento text;

comment on column movimientos.documento is
  'Número del documento que respalda el movimiento: FA273, B405. '
  'Distinto de doc_tipo, que es si es exento, afecta u honorario.';

-- Buscar por número de factura tiene que ser inmediato: es la pregunta más
-- frecuente de cobranza ("¿la 273 ya la pagaron?").
create index movimientos_documento_idx on movimientos (documento)
  where documento is not null;

-- La vista lista columnas una por una desde 0006, así que hay que agregarla acá
-- también: una vista no incorpora sola las columnas nuevas de su tabla.
drop view v_movimientos_sin_clasificar;

create view v_movimientos_sin_clasificar with (security_invoker = true) as
  select
    m.id,
    m.fecha,
    m.empresa_id,
    m.cuenta_id,
    m.contraparte,
    m.glosa,
    m.documento,
    m.monto,
    m.moneda,
    m.tipo_cambio,
    m.estado,
    m.doc_tipo,
    m.origen,
    m.creado_por,
    m.creado_en,
    m.actualizado_en
  from movimientos m
  where not exists (
    select 1 from movimiento_lineas ml where ml.movimiento_id = m.id
  );

-- Y la función de guardado, que enumera los campos explícitamente.
create or replace function fn_guardar_movimiento(p jsonb) returns bigint
language plpgsql
security invoker
as $$
declare
  v_id bigint;
begin
  if p ? 'id' and p->>'id' is not null then
    v_id := (p->>'id')::bigint;
    update movimientos set
      fecha       = (p->>'fecha')::date,
      empresa_id  = p->>'empresa_id',
      cuenta_id   = p->>'cuenta_id',
      contraparte = p->>'contraparte',
      glosa       = p->>'glosa',
      documento   = p->>'documento',
      monto       = (p->>'monto')::numeric,
      moneda      = p->>'moneda',
      tipo_cambio = (p->>'tipo_cambio')::numeric,
      estado      = p->>'estado',
      doc_tipo    = p->>'doc_tipo'
    where id = v_id;

    if not found then
      raise exception 'No existe el movimiento %', v_id;
    end if;
  else
    insert into movimientos
      (fecha, empresa_id, cuenta_id, contraparte, glosa, documento, monto, moneda,
       tipo_cambio, estado, doc_tipo)
    values (
      (p->>'fecha')::date,
      p->>'empresa_id',
      p->>'cuenta_id',
      p->>'contraparte',
      p->>'glosa',
      p->>'documento',
      (p->>'monto')::numeric,
      p->>'moneda',
      (p->>'tipo_cambio')::numeric,
      coalesce(p->>'estado', 'proyectado'),
      p->>'doc_tipo'
    )
    returning id into v_id;
  end if;

  delete from movimiento_lineas where movimiento_id = v_id;

  insert into movimiento_lineas (movimiento_id, subcategoria_id, monto, glosa, orden)
  select
    v_id,
    linea->>'subcategoria_id',
    (linea->>'monto')::numeric,
    linea->>'glosa',
    (orden - 1)::int
  from jsonb_array_elements(coalesce(p->'lineas', '[]'::jsonb))
       with ordinality as t(linea, orden);

  return v_id;
end;
$$;
