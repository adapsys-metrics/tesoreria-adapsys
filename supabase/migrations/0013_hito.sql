-- El número de hito que venía en la columna Action de Quicken.
--
-- Action significa dos cosas según el registro y por eso se perdió: en los espejos de
-- proyección trae la empresa (y de ahí la lee el importador), pero en PROYECTOS
-- APROBADOS y en los registros de banco trae un número —la cuota o hito del plan de
-- pagos pactado con el cliente—. El importador tomaba la empresa y descartaba el
-- resto, así que 1.507 movimientos perdieron el dato.
--
-- Dentro de un mismo proyecto los números forman secuencia (1, 2, 3…), así que es
-- CUÁL hito y no cuántos: "Escuela de Liderazgo" del Banco de Chile tiene cobros del
-- 1 al 11.

alter table movimientos add column hito smallint;

comment on column movimientos.hito is
  'Cuota o hito del plan de pagos pactado con el cliente, de la columna Action de '
  'Quicken. Nulo en casi todo: solo lo llevan los cobros de proyectos.';

-- Se consulta al abrir un proyecto, que son pocos movimientos sobre 10.530.
create index movimientos_hito_idx on movimientos (hito) where hito is not null;

-- La función que guarda un movimiento tiene que escribir la columna nueva, o el campo
-- se puede editar en la app y no persiste. Idéntica a la de 0012 salvo `hito`.
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

  insert into movimiento_lineas (movimiento_id, categoria_id, subcategoria_id, monto, glosa, orden)
  select
    v_id,
    linea->>'categoria_id',
    nullif(linea->>'subcategoria_id', ''),
    (linea->>'monto')::numeric,
    linea->>'glosa',
    (orden - 1)::int
  from jsonb_array_elements(coalesce(p->'lineas', '[]'::jsonb))
       with ordinality as t(linea, orden);

  return v_id;
end;
$$;
