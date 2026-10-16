-- El presupuesto se ajusta durante el año, y queda registro de cómo cambió.
--
-- Hasta acá el presupuesto era un número que se escribía y se editaba: corregir
-- una línea en julio borraba lo que decía en diciembre del año anterior, y no
-- quedaba forma de saber qué se había aprobado ni dónde se estuvo ajustando.
--
-- Tres piezas:
--
--   presupuesto_anios     marca que un año está aprobado. Antes de eso se está
--                         armando y editar es construir, no ajustar.
--   presupuesto_inicial   copia congelada de los doce meses al aprobar. Es el
--                         respaldo: nadie la escribe después.
--   presupuesto_cambios   una fila por mes que cambió, con el antes, el después
--                         y el motivo. Es la respuesta a "dónde se está ajustando".
--
-- Por qué una copia y no reconstruir el inicial reproduciendo la bitácora al
-- revés: la bitácora puede tener huecos —una carga directa por SQL, una fila
-- borrada— y el inicial es justamente lo que no puede depender de eso. Son 300
-- categorías por 12 meses: 3.600 filas al año, nada.
--
-- Se puede correr más de una vez (§8).

-- ── 1. El año aprobado ──────────────────────────────────────────────────────

create table if not exists presupuesto_anios (
  anio         integer primary key,
  aprobado_en  timestamptz not null default now(),
  aprobado_por uuid references auth.users (id),
  nota         text
);

comment on table presupuesto_anios is
  'Un año con fila acá está aprobado: su presupuesto quedó congelado en '
  'presupuesto_inicial y de ahí en adelante todo cambio exige motivo y queda '
  'anotado en presupuesto_cambios. Sin fila, el año se está construyendo.';

-- ── 2. La línea base ────────────────────────────────────────────────────────

create table if not exists presupuesto_inicial (
  anio            integer not null,
  categoria_id    text not null references categorias (id),
  subcategoria_id text references subcategorias (id) on delete set null,
  mes             smallint not null check (mes between 1 and 12),
  monto           numeric not null default 0
);

-- Misma forma que presupuesto_meses, incluido el coalesce: una columna nullable
-- no puede ir en una primary key, y dos líneas de la misma categoría sin
-- subcategoría serían "distintas" y se duplicarían (§0015).
create unique index if not exists presupuesto_inicial_linea_idx
  on presupuesto_inicial (anio, categoria_id, coalesce(subcategoria_id, ''), mes);

comment on table presupuesto_inicial is
  'El presupuesto tal como se aprobó, congelado. No se edita: es el respaldo '
  'contra el cual se mide cuánto se ajustó el año.';

-- ── 3. La bitácora ──────────────────────────────────────────────────────────

create table if not exists presupuesto_cambios (
  id              bigint generated always as identity primary key,
  anio            integer not null,
  categoria_id    text not null references categorias (id),
  subcategoria_id text references subcategorias (id) on delete set null,
  mes             smallint not null check (mes between 1 and 12),
  antes           numeric not null,
  despues         numeric not null,
  motivo          text not null,
  usuario_id      uuid references auth.users (id),
  cuando          timestamptz not null default now()
);

create index if not exists presupuesto_cambios_linea_idx
  on presupuesto_cambios (anio, categoria_id, coalesce(subcategoria_id, ''));

comment on table presupuesto_cambios is
  'Una fila por mes que cambió después de aprobado el año. El motivo es '
  'obligatorio: sin él la bitácora es una lista de números que en diciembre no '
  'le dice nada a nadie.';

-- ── RLS ─────────────────────────────────────────────────────────────────────

alter table presupuesto_anios   enable row level security;
alter table presupuesto_inicial enable row level security;
alter table presupuesto_cambios enable row level security;

drop policy if exists "autorizados_todo" on presupuesto_anios;
create policy "autorizados_todo" on presupuesto_anios
  for all using (fn_es_usuario_autorizado()) with check (fn_es_usuario_autorizado());

drop policy if exists "autorizados_todo" on presupuesto_inicial;
create policy "autorizados_todo" on presupuesto_inicial
  for all using (fn_es_usuario_autorizado()) with check (fn_es_usuario_autorizado());

-- La bitácora se lee y se escribe, pero no se corrige: un registro de cambios
-- que se puede editar no registra nada.
drop policy if exists "autorizados_todo" on presupuesto_cambios;
drop policy if exists "autorizados_leer" on presupuesto_cambios;
create policy "autorizados_leer" on presupuesto_cambios
  for select using (fn_es_usuario_autorizado());
drop policy if exists "autorizados_anotar" on presupuesto_cambios;
create policy "autorizados_anotar" on presupuesto_cambios
  for insert with check (fn_es_usuario_autorizado());

-- ── 4. Aprobar un año ───────────────────────────────────────────────────────

create or replace function fn_aprobar_presupuesto(p_anio integer, p_nota text default null)
returns void
language plpgsql
security invoker
as $$
begin
  if exists (select 1 from presupuesto_anios where anio = p_anio) then
    raise exception 'El presupuesto % ya está aprobado', p_anio;
  end if;

  if not exists (select 1 from presupuesto_meses where anio = p_anio) then
    raise exception 'El presupuesto % no tiene ninguna línea cargada', p_anio;
  end if;

  insert into presupuesto_inicial (anio, categoria_id, subcategoria_id, mes, monto)
  select anio, categoria_id, subcategoria_id, mes, monto
    from presupuesto_meses
   where anio = p_anio;

  insert into presupuesto_anios (anio, aprobado_por, nota)
  values (p_anio, auth.uid(), p_nota);
end;
$$;

-- ── 5. Guardar una línea, anotando lo que cambie ────────────────────────────
--
-- Misma firma que la de 0015 más un `motivo`, y una regla: con el año aprobado,
-- el motivo es obligatorio y cada mes que cambie deja su fila en la bitácora.
-- Mientras el año no esté aprobado no se pide nada — ahí se está construyendo.

create or replace function fn_guardar_presupuesto(p jsonb) returns void
language plpgsql
security invoker
as $$
declare
  v_anio     integer := (p->>'anio')::integer;
  v_cat      text    := p->>'categoria_id';
  v_sub      text    := nullif(p->>'subcategoria_id', '');
  v_motivo   text    := nullif(btrim(coalesce(p->>'motivo', '')), '');
  v_aprobado boolean := exists (select 1 from presupuesto_anios where anio = v_anio);
  v_antes    jsonb;
begin
  if v_aprobado and v_motivo is null then
    raise exception
      'El presupuesto % ya está aprobado: un ajuste necesita decir por qué', v_anio;
  end if;

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

  -- Foto de los doce meses antes de tocarlos. Se guarda como jsonb y no en una
  -- tabla temporal porque la función puede correr muchas veces por transacción,
  -- una por línea editada.
  select coalesce(jsonb_object_agg(mes::text, monto), '{}'::jsonb)
    into v_antes
    from presupuesto_meses
   where anio = v_anio
     and categoria_id = v_cat
     and coalesce(subcategoria_id, '') = coalesce(v_sub, '');

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

  if v_aprobado then
    insert into presupuesto_cambios
      (anio, categoria_id, subcategoria_id, mes, antes, despues, motivo, usuario_id)
    select
      v_anio, v_cat, v_sub, m.mes,
      coalesce((v_antes->>m.mes::text)::numeric, 0),
      m.monto,
      v_motivo,
      auth.uid()
    from presupuesto_meses m
    where m.anio = v_anio
      and m.categoria_id = v_cat
      and coalesce(m.subcategoria_id, '') = coalesce(v_sub, '')
      -- `is distinct from` y no `<>`: con un mes que antes no existía, `<>` contra
      -- null da null y la fila no se anotaría.
      and m.monto is distinct from coalesce((v_antes->>m.mes::text)::numeric, 0);
  end if;
end;
$$;
