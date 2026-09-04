-- El catálogo tiene tres niveles, no dos.
--
-- Lo que se llamaba `categorias` son los GRUPOS ("2 GASTOS ADMINISTRACIÓN") y lo que
-- se llamaba `subcategorias` son las CATEGORÍAS ("Jornadas y eventos organización").
-- El tercer nivel —la subcategoría, "Offsite internacional"— existía en Quicken pero
-- el importador lo aplastó: dejó Offsite como hermana de Jornadas colgando del grupo,
-- cuando cuelga de ella.
--
-- En los seis años de datos hay 15.649 clasificaciones de dos niveles y 6 de tres, en
-- una sola rama. Y las dos conviven: "Jornadas y eventos organización" tiene 342
-- movimientos propios además de los 6 de su subcategoría. Por eso la línea de
-- movimiento sigue apuntando SIEMPRE a una categoría, y la subcategoría es un dato
-- opcional al lado: agregarle subcategorías a una categoría no invalida nada de lo ya
-- clasificado, y las agregaciones del flujo y del presupuesto no cambian.

-- ─────────────────────────  RENOMBRE  ─────────────────────────
-- Postgres arrastra el renombre a índices, constraints y vistas dependientes. Las
-- vistas hay que recrearlas igual: conservan el nombre de columna con el que se
-- definieron, así que seguirían exponiendo `subcategoria_id` sobre la columna nueva.

drop view if exists v_lineas_categoria_inactiva;
drop view if exists v_lineas_expandidas;

alter table categorias rename to grupos;
alter table subcategorias rename to categorias;
alter table categorias rename column categoria_id to grupo_id;

alter table movimiento_lineas rename column subcategoria_id to categoria_id;
alter table presupuesto rename column subcategoria_id to categoria_id;
alter table presupuesto_meses rename column subcategoria_id to categoria_id;

-- ─────────────────────────  TERCER NIVEL  ─────────────────────────

create table subcategorias (
  id text primary key,
  categoria_id text not null references categorias(id) on delete cascade,
  nombre text not null,
  activa boolean not null default true
);

create index subcategorias_categoria_idx on subcategorias (categoria_id);

-- Nullable a propósito: la enorme mayoría de las líneas se clasifica a nivel de
-- categoría y ahí se queda. `on delete set null` y no `cascade` porque borrar una
-- subcategoría no puede llevarse el movimiento: pierde el detalle, no el gasto.
alter table movimiento_lineas
  add column subcategoria_id text references subcategorias(id) on delete set null;

create index movimiento_lineas_subcategoria_idx on movimiento_lineas (subcategoria_id)
  where subcategoria_id is not null;

-- La subcategoría tiene que colgar de la categoría en la que está clasificada la
-- línea, o el detalle diría una cosa y el reporte otra.
create or replace function fn_subcategoria_calza()
returns trigger language plpgsql as $$
begin
  if new.subcategoria_id is not null
     and not exists (
       select 1 from subcategorias s
       where s.id = new.subcategoria_id and s.categoria_id = new.categoria_id
     )
  then
    raise exception 'La subcategoría % no pertenece a la categoría %',
      new.subcategoria_id, new.categoria_id;
  end if;
  return new;
end;
$$;

create trigger movimiento_lineas_subcategoria_calza
  before insert or update on movimiento_lineas
  for each row execute function fn_subcategoria_calza();

alter table subcategorias enable row level security;

create policy "autorizados_todo" on subcategorias
  for all using (fn_es_usuario_autorizado()) with check (fn_es_usuario_autorizado());

-- ─────────────────────────  LO QUE SE APLASTÓ  ─────────────────────────
-- Tres ramas de Quicken traían tercer nivel y el importador las dejó como categorías
-- hermanas colgando del grupo. Vuelven a colgar de su categoría y sus líneas se
-- reapuntan. Son 21 movimientos en total, sobre troncos que tienen 342 y 202.

create temporary table aplastadas (sub text, cat text, nombre text) on commit drop;
insert into aplastadas values
  ('offsite-internacional',    'jornadas-y-eventos-organizacion',   'Offsite internacional'),
  ('automatizacion-y-metrics', 'sistemas-analitica-avanzada-ia-y-r', 'Automatización y metrics'),
  ('manejador-base-de-datos',  'sistemas-analitica-avanzada-ia-y-r', 'Manejador base de datos');

insert into subcategorias (id, categoria_id, nombre, activa)
select a.sub, a.cat, a.nombre, true
from aplastadas a
where exists (select 1 from categorias c where c.id = a.cat)
on conflict (id) do nothing;

-- Las dos columnas se escriben juntas: el trigger valida la subcategoría contra la
-- categoría nueva, así que en dos updates separados el primero fallaría.
update movimiento_lineas ml
set categoria_id = a.cat, subcategoria_id = a.sub
from aplastadas a
where ml.categoria_id = a.sub
  and exists (select 1 from subcategorias s where s.id = a.sub);

-- El presupuesto que alguien alcanzara a cargar contra la línea aplastada se pierde
-- a propósito en vez de sumarse al tronco: mezclarlo daría un presupuesto que nadie
-- escribió. Son líneas que hoy no tienen presupuesto cargado.
delete from presupuesto_meses where categoria_id in (select sub from aplastadas);
delete from presupuesto where categoria_id in (select sub from aplastadas);

delete from categorias c
where c.id in (select sub from aplastadas)
  and not exists (select 1 from movimiento_lineas ml where ml.categoria_id = c.id);

-- ─────────────────────────  VISTAS  ─────────────────────────

create view v_lineas_expandidas with (security_invoker = true) as
  select
    m.id as movimiento_id,
    m.fecha,
    m.empresa_id,
    m.cuenta_id,
    m.estado,
    m.moneda,
    m.tipo_cambio,
    ml.categoria_id,
    ml.subcategoria_id,
    coalesce(ml.monto, m.monto) as monto,
    coalesce(ml.glosa, m.glosa) as glosa
  from movimientos m
  left join movimiento_lineas ml on ml.movimiento_id = m.id;

create view v_lineas_categoria_inactiva with (security_invoker = true) as
  select ml.*
  from movimiento_lineas ml
  join categorias c on c.id = ml.categoria_id
  where c.activa = false;

-- ─────────────────────────  FUNCIONES  ─────────────────────────
-- Las dos escriben columnas que cambiaron de nombre, así que se redefinen enteras.

-- Idéntica a la de 0008 salvo el insert de líneas: cambia el nombre de la columna y
-- entra la subcategoría. Se copia entera porque `create or replace` reemplaza el
-- cuerpo completo, no lo parchea.
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

  insert into movimiento_lineas (movimiento_id, categoria_id, subcategoria_id, monto, glosa, orden)
  select
    v_id,
    linea->>'categoria_id',
    -- Cadena vacía y ausente significan lo mismo acá: sin subcategoría.
    nullif(linea->>'subcategoria_id', ''),
    (linea->>'monto')::numeric,
    linea->>'glosa',
    (orden - 1)::int
  from jsonb_array_elements(coalesce(p->'lineas', '[]'::jsonb))
       with ordinality as t(linea, orden);

  return v_id;
end;
$$;

create or replace function fn_guardar_presupuesto(p jsonb) returns void
language plpgsql
security invoker
as $$
declare
  v_anio integer := (p->>'anio')::integer;
  v_cat  text    := p->>'categoria_id';
begin
  insert into presupuesto (anio, categoria_id, monto_anterior, responsable, nota)
  values (
    v_anio,
    v_cat,
    coalesce((p->>'monto_anterior')::numeric, 0),
    p->>'responsable',
    p->>'nota'
  )
  on conflict (anio, categoria_id) do update set
    monto_anterior = excluded.monto_anterior,
    responsable    = excluded.responsable,
    nota           = excluded.nota;

  delete from presupuesto_meses where anio = v_anio and categoria_id = v_cat;

  insert into presupuesto_meses (anio, categoria_id, mes, monto)
  -- `with ordinality` numera desde 1, que es justo enero: no hay que correr nada.
  select v_anio, v_cat, mes::int, monto::numeric
  from jsonb_array_elements_text(coalesce(p->'meses', '[]'::jsonb))
       with ordinality as t(monto, mes)
  where mes between 1 and 12;
end;
$$;

comment on table grupos is
  'Nivel 1 del catálogo: "2 GASTOS ADMINISTRACIÓN". Lleva el controlado/fuera del presupuesto (§4.6).';
comment on table categorias is
  'Nivel 2: "Jornadas y eventos organización". Es donde vive la naturaleza (§4.2) y a donde apunta toda línea de movimiento.';
comment on table subcategorias is
  'Nivel 3, opcional: "Offsite internacional". Detalle de la línea, no nivel de reporte.';
