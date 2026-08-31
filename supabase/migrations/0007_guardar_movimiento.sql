-- Guardar un movimiento junto con sus líneas, en una sola transacción.
--
-- Tiene que ser una función de la base y no varias llamadas desde el cliente por
-- la constraint diferida que valida que las líneas cuadren con el monto (§3).
-- Editar un split desde la app es siempre "reemplazar el juego de líneas": si eso
-- se hiciera con un delete y un insert por separado, cada llamada de supabase-js
-- es su propia transacción y la primera dejaría el movimiento descuadrado. La base
-- lo rechazaría, con razón, y la app no tendría forma de guardar un split.
--
-- Adentro de la función todo ocurre en la misma transacción, así que la validación
-- se evalúa una vez, al final, con las líneas ya puestas.
--
-- SECURITY INVOKER (el default, explícito acá porque importa): la función corre con
-- los permisos de quien llama, así que las políticas de RLS de 0002 siguen
-- aplicando. Una función SECURITY DEFINER se las saltaría y convertiría este
-- endpoint en una puerta trasera a toda la tabla.

create function fn_guardar_movimiento(p jsonb) returns bigint
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
      (fecha, empresa_id, cuenta_id, contraparte, glosa, monto, moneda, tipo_cambio, estado, doc_tipo)
    values (
      (p->>'fecha')::date,
      p->>'empresa_id',
      p->>'cuenta_id',
      p->>'contraparte',
      p->>'glosa',
      (p->>'monto')::numeric,
      p->>'moneda',
      (p->>'tipo_cambio')::numeric,
      coalesce(p->>'estado', 'proyectado'),
      p->>'doc_tipo'
    )
    returning id into v_id;
  end if;

  -- Reemplazo completo del juego de líneas. Es más simple y más seguro que
  -- calcular diferencias: un movimiento sin líneas queda sin líneas, que es
  -- justamente cómo se representa "sin clasificar" (§3).
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

comment on function fn_guardar_movimiento is
  'Guarda un movimiento y reemplaza sus líneas en una sola transacción, para que '
  'la constraint diferida que valida el split se evalúe con las líneas completas.';
