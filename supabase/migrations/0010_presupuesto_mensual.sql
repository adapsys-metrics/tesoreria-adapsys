-- El presupuesto se guarda repartido en doce meses, no como un total anual.
--
-- Sale de revisar los números de la planilla real. A julio, que es 7/12 del año:
--
--   Desarrollo organizacional  500.000 × 7/12 = 291.667  y muestra 291.667   ✓
--   Gastos administración  194.025.719 × 7/12 = 113.181.669  muestra 122.056.670  ✗
--
-- Las dos secciones no se prorratean igual. La inversión sí es un monto anual
-- dividido en doce. Lo operativo no: sale de movimientos con fecha, así que su
-- presupuesto a la fecha es lo planificado HASTA esa fecha. Los sueldos de
-- diciembre no pesan en marzo, y los retiros de socios de marzo no se reparten.
--
-- Guardar los doce meses resuelve las dos de la misma forma y cierra el pendiente
-- de CLAUDE.md §10 sobre la distribución mensual.

create table presupuesto_meses (
  anio            integer not null,
  subcategoria_id text not null references subcategorias (id),
  mes             smallint not null check (mes between 1 and 12),
  monto           numeric not null default 0,
  primary key (anio, subcategoria_id, mes)
);

comment on table presupuesto_meses is
  'Presupuesto repartido por mes. El anual es la suma de los doce; el acumulado a '
  'una fecha, la suma de enero a ese mes.';

create index presupuesto_meses_anio_idx on presupuesto_meses (anio);

-- El anual deja de vivir en `presupuesto.monto`: si estuviera en los dos lados,
-- corregir un mes dejaría el total desactualizado y no habría forma de saber cuál
-- de los dos manda. La tabla queda con lo que NO es un monto por mes.
alter table presupuesto drop column monto;

comment on column presupuesto.monto_anterior is
  'Presupuesto del año anterior, para la comparación de la vista de construcción. '
  'Se escribe a mano: el año anterior puede no estar cargado en el sistema.';

alter table presupuesto_meses enable row level security;

create policy "autorizados_todo" on presupuesto_meses
  for all using (fn_es_usuario_autorizado()) with check (fn_es_usuario_autorizado());

-- ── Guardar una línea del presupuesto ───────────────────────────────────────
--
-- Una línea son dos cosas en dos tablas: los doce montos y la metadata
-- (responsable, nota, presupuesto del año anterior). Guardarlas por separado deja
-- la puerta a que una entre y la otra no, y quedaría una línea con montos nuevos
-- y el responsable viejo sin que nadie se entere. Adentro de la función es una
-- sola transacción.
create or replace function fn_guardar_presupuesto(p jsonb) returns void
language plpgsql
security invoker
as $$
declare
  v_anio integer := (p->>'anio')::integer;
  v_sub  text    := p->>'subcategoria_id';
begin
  insert into presupuesto (anio, subcategoria_id, monto_anterior, responsable, nota)
  values (
    v_anio,
    v_sub,
    coalesce((p->>'monto_anterior')::numeric, 0),
    p->>'responsable',
    p->>'nota'
  )
  on conflict (anio, subcategoria_id) do update set
    monto_anterior = excluded.monto_anterior,
    responsable    = excluded.responsable,
    nota           = excluded.nota;

  -- Reemplazo completo de los doce, igual que las líneas de un split: más simple
  -- y más seguro que calcular diferencias, y deja el mes en cero si se borró.
  delete from presupuesto_meses where anio = v_anio and subcategoria_id = v_sub;

  insert into presupuesto_meses (anio, subcategoria_id, mes, monto)
  -- `with ordinality` numera desde 1, que es justo enero: no hay que correr nada.
  select v_anio, v_sub, mes::int, monto::numeric
  from jsonb_array_elements_text(coalesce(p->'meses', '[]'::jsonb))
       with ordinality as t(monto, mes)
  where mes between 1 and 12;
end;
$$;

comment on function fn_guardar_presupuesto is
  'Guarda los doce meses de una línea del presupuesto junto con su metadata, en '
  'una sola transacción.';
