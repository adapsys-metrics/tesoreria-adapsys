-- El tipo de documento puede vivir en la línea.
--
-- Un proveedor manda tres facturas y se pagan en una transferencia: dos afectas a IVA
-- y una exenta. Con `doc_tipo` solo en el movimiento, el IVA se calculaba sobre las
-- tres. Lo mismo pasa con el estado de cuenta de la tarjeta, donde conviven compras
-- afectas y suscripciones extranjeras que no llevan IVA (§4.3).
--
-- Misma forma que la naturaleza en la subcategoría (§4.2): null es "la del movimiento"
-- y un valor la sobrescribe. El movimiento conserva la suya, que es lo que usa el caso
-- corriente —un documento, un tipo— sin tener que marcar nada.
--
-- Se puede correr más de una vez (§8).

alter table movimiento_lineas add column if not exists doc_tipo text;

-- El check va aparte: `add column if not exists` no lo agrega si la columna ya estaba,
-- y quedaría sin validación sin que nadie lo note.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'movimiento_lineas'::regclass
      and conname = 'movimiento_lineas_doc_tipo_check'
  ) then
    alter table movimiento_lineas add constraint movimiento_lineas_doc_tipo_check
      check (doc_tipo in ('exento', 'afecta', 'honorario'));
  end if;
end $$;

comment on column movimiento_lineas.doc_tipo is
  'null = el del movimiento. Un valor lo sobrescribe, para el caso de varias facturas '
  'de distinto tipo pagadas juntas.';

-- ── Guardar un movimiento ───────────────────────────────────────────────────
-- Idéntica a la de 0012 salvo que la línea ahora lleva su doc_tipo.

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
      doc_tipo    = p->>'doc_tipo',
      hito        = nullif(p->>'hito', '')::smallint
    where id = v_id;

    if not found then
      raise exception 'No existe el movimiento %', v_id;
    end if;
  else
    insert into movimientos
      (fecha, empresa_id, cuenta_id, contraparte, glosa, documento, monto, moneda,
       tipo_cambio, estado, doc_tipo, hito)
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
      p->>'doc_tipo',
      nullif(p->>'hito', '')::smallint
    )
    returning id into v_id;
  end if;

  delete from movimiento_lineas where movimiento_id = v_id;

  insert into movimiento_lineas
    (movimiento_id, categoria_id, subcategoria_id, doc_tipo, monto, glosa, orden)
  select
    v_id,
    linea->>'categoria_id',
    -- Cadena vacía y ausente significan lo mismo acá: sin subcategoría, sin tipo.
    nullif(linea->>'subcategoria_id', ''),
    nullif(linea->>'doc_tipo', ''),
    (linea->>'monto')::numeric,
    linea->>'glosa',
    (orden - 1)::int
  from jsonb_array_elements(coalesce(p->'lineas', '[]'::jsonb))
       with ordinality as t(linea, orden);

  return v_id;
end;
$$;
