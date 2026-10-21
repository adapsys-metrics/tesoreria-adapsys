-- Generar los movimientos proyectados de un año de una vez.
--
-- El presupuesto operativo del año que viene sale de **sumar los movimientos
-- proyectados**, y esos se generan copiando los del año anterior: el pago de
-- Entel de cada mes, el de GTD, el split de sueldos.
--
-- Va por función y no por inserciones sueltas desde el navegador por tres
-- razones, y las tres importan:
--
--   1. Son cientos de movimientos. Uno por llamada serían cientos de viajes.
--   2. La validación de que las líneas cuadran con el monto es una constraint
--      diferida que se evalúa al cerrar la transacción (§3). En una sola
--      transacción, o entra todo o no entra nada — nunca media proyección.
--   3. Regenerar tiene que **reemplazar solo lo generado**. El borrado va por
--      `origen`, así que lo que alguien escribió a mano —que tiene origen nulo—
--      no se toca. Sin eso, rehacer la proyección borraría trabajo ajeno.
--
-- Se puede correr más de una vez (§8).

create or replace function fn_generar_proyeccion(p jsonb) returns integer
language plpgsql
security invoker
as $$
declare
  v_anio   integer := (p->>'anio')::integer;
  v_origen text    := 'proyeccion-' || v_anio;
  v_id     bigint;
  r        jsonb;
  v_n      integer := 0;
begin
  -- Solo lo que generó esta misma función para este año. Un movimiento cargado a
  -- mano tiene origen nulo y queda intacto; uno importado de Quicken tiene el
  -- nombre de su archivo y tampoco se toca.
  delete from movimiento_lineas
   where movimiento_id in (select id from movimientos where origen = v_origen);
  delete from movimientos where origen = v_origen;

  for r in select * from jsonb_array_elements(coalesce(p->'movimientos', '[]'::jsonb))
  loop
    insert into movimientos
      (fecha, empresa_id, cuenta_id, contraparte, glosa, monto, moneda,
       tipo_cambio, estado, doc_tipo, origen)
    values (
      (r->>'fecha')::date,
      nullif(r->>'empresa_id', ''),
      nullif(r->>'cuenta_id', ''),
      r->>'contraparte',
      r->>'glosa',
      (r->>'monto')::numeric,
      r->>'moneda',
      (r->>'tipo_cambio')::numeric,
      -- Siempre proyectado: es el año que viene. Que la función lo fije y no el
      -- payload evita que una llamada mal armada meta movimientos como ocurridos.
      'proyectado',
      nullif(r->>'doc_tipo', ''),
      v_origen
    )
    returning id into v_id;

    insert into movimiento_lineas
      (movimiento_id, categoria_id, subcategoria_id, doc_tipo, monto, glosa, orden)
    select
      v_id,
      linea->>'categoria_id',
      nullif(linea->>'subcategoria_id', ''),
      nullif(linea->>'doc_tipo', ''),
      (linea->>'monto')::numeric,
      linea->>'glosa',
      (orden - 1)::int
    from jsonb_array_elements(coalesce(r->'lineas', '[]'::jsonb))
         with ordinality as t(linea, orden);

    v_n := v_n + 1;
  end loop;

  return v_n;
end;
$$;

comment on function fn_generar_proyeccion is
  'Reemplaza los movimientos proyectados generados para un año. Borra por origen '
  '(proyeccion-<año>), así que no toca lo cargado a mano ni lo importado.';
