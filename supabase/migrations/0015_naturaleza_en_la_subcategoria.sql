-- La naturaleza puede vivir en la subcategoría, y el presupuesto llega hasta ahí.
--
-- El control presupuestario real tiene subcategorías que Quicken no traía, y dentro de
-- una misma categoría unas son de inversión y otras operativas. Hasta ahora la
-- naturaleza vivía solo en la categoría (§4.2) y eso no lo permite.
--
-- Es la misma regla que ya rige un nivel más arriba: un grupo es "mixto" cuando sus
-- categorías no coinciden. Ahora una categoría es mixta cuando alguna subcategoría
-- difiere de ella.

-- Nullable a propósito: null significa "la que tenga su categoría". Un valor guardado
-- sería un override, y esa distinción es la que hace que cambiar la naturaleza de la
-- categoría arrastre a las que la heredan sin pisar a las que alguien fijó aparte.
--
-- Y sobre todo: la categoría conserva su naturaleza. Una línea de movimiento puede
-- tener categoría y no tener subcategoría —15.649 de 15.670 en el histórico— y sin eso
-- quedaría sin saber si es inversión u operativo.
alter table subcategorias add column naturaleza text
  check (naturaleza in ('ingreso', 'inversion', 'operativo'));

comment on column subcategorias.naturaleza is
  'null = hereda la de su categoría. Un valor la sobrescribe, y entonces la categoría '
  'se muestra como mixta.';

-- ── El presupuesto llega a la subcategoría ──────────────────────────────────
--
-- Una línea de presupuesto pasa a ser "dónde se clasifica la plata": una categoría, o
-- una subcategoría suya. Es la misma forma que ya tiene movimiento_lineas, y por la
-- misma razón — así lo presupuestado y lo ejecutado se comparan clave contra clave.
--
-- subcategoria_id nulo es la línea de la categoría en sí: lo que se gasta en ella sin
-- precisar subcategoría. Quicken lo muestra como "(Other)" y sigue necesitando su
-- propio presupuesto.

alter table presupuesto add column subcategoria_id text references subcategorias (id);
alter table presupuesto_meses add column subcategoria_id text references subcategorias (id);

-- Las claves tienen que incluir la subcategoría, pero una columna nullable no puede ir
-- en una primary key ni en un unique que trate los nulos como distintos: dos líneas de
-- la misma categoría sin subcategoría serían "diferentes" y se duplicarían. Por eso el
-- índice va sobre coalesce.
alter table presupuesto drop constraint presupuesto_anio_subcategoria_id_key;
create unique index presupuesto_linea_idx
  on presupuesto (anio, categoria_id, coalesce(subcategoria_id, ''));

alter table presupuesto_meses drop constraint presupuesto_meses_pkey;
create unique index presupuesto_meses_linea_idx
  on presupuesto_meses (anio, categoria_id, coalesce(subcategoria_id, ''), mes);
alter table presupuesto_meses alter column mes set not null;

-- La subcategoría tiene que colgar de la categoría de la misma línea, igual que en
-- movimiento_lineas: si no, el presupuesto diría una cosa y el reporte otra.
create or replace function fn_presupuesto_calza()
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

create trigger presupuesto_calza
  before insert or update on presupuesto
  for each row execute function fn_presupuesto_calza();

create trigger presupuesto_meses_calza
  before insert or update on presupuesto_meses
  for each row execute function fn_presupuesto_calza();

-- ── Guardar una línea ───────────────────────────────────────────────────────
-- Idéntica a la de 0012 salvo que la línea ahora se identifica por el par
-- (categoría, subcategoría).

create or replace function fn_guardar_presupuesto(p jsonb) returns void
language plpgsql
security invoker
as $$
declare
  v_anio integer := (p->>'anio')::integer;
  v_cat  text    := p->>'categoria_id';
  v_sub  text    := nullif(p->>'subcategoria_id', '');
begin
  insert into presupuesto (anio, categoria_id, subcategoria_id, monto_anterior, responsable, nota)
  values (
    v_anio,
    v_cat,
    v_sub,
    coalesce((p->>'monto_anterior')::numeric, 0),
    p->>'responsable',
    p->>'nota'
  )
  on conflict (anio, categoria_id, coalesce(subcategoria_id, '')) do update set
    monto_anterior = excluded.monto_anterior,
    responsable    = excluded.responsable,
    nota           = excluded.nota;

  delete from presupuesto_meses
  where anio = v_anio
    and categoria_id = v_cat
    and coalesce(subcategoria_id, '') = coalesce(v_sub, '');

  insert into presupuesto_meses (anio, categoria_id, subcategoria_id, mes, monto)
  -- `with ordinality` numera desde 1, que es justo enero: no hay que correr nada.
  select v_anio, v_cat, v_sub, mes::int, monto::numeric
  from jsonb_array_elements_text(coalesce(p->'meses', '[]'::jsonb))
       with ordinality as t(monto, mes)
  where mes between 1 and 12;
end;
$$;
