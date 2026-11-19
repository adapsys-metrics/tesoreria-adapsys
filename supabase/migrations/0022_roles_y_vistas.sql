-- Perfiles: quién puede escribir y qué pestañas ve.
--
-- Hasta acá el acceso era una sola pregunta —estás en la lista o no estás— y las
-- tres personas de administración podían todo. Eso sigue siendo correcto para
-- ellas. Lo que apareció es otro caso: el gerente general, que **sí mira los
-- movimientos** pero no tiene por qué entrar a Categorías ni a Movimientos, y
-- que no debería poder escribir nada.
--
-- Son dos ejes distintos y se guardan por separado, porque se combinan:
--
--   rol     editor | revisor      → si puede escribir
--   vistas  text[]                → qué pestañas ve; null es "todas"
--
-- `vistas` es null en todas las filas que ya existen, así que nadie pierde nada
-- al correr esto, y `rol` entra con default 'editor' por la misma razón.
--
-- **No lleva check de valores.** La lista de vistas vive en `lib/vistas.ts`, que
-- es de donde salen las casillas del panel, y duplicarla acá obligaría a tocar
-- una migración cada vez que se agrega una pantalla. Un valor que no corresponde
-- a ninguna vista no abre nada: no hay forma de que conceda de más.
--
-- Se puede correr más de una vez (§8).

alter table usuarios_autorizados add column if not exists rol text not null default 'editor';
alter table usuarios_autorizados add column if not exists vistas text[];

-- En su propio do$$ guardado: `add column if not exists` no agrega el check
-- cuando la columna ya estaba, y quedaría sin validación (§8).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'usuarios_autorizados_rol_check'
  ) then
    alter table usuarios_autorizados
      add constraint usuarios_autorizados_rol_check check (rol in ('editor', 'revisor'));
  end if;
end $$;

comment on column usuarios_autorizados.rol is
  'editor escribe; revisor solo lee. Lo hace cumplir la RLS, no la pantalla.';
comment on column usuarios_autorizados.vistas is
  'Claves de las pestañas que ve, de lib/vistas.ts. null = todas. Esconder una '
  'pestaña no esconde su dato: para eso está el rol y, si hiciera falta de '
  'verdad, habría que filtrar filas, que es otra conversación.';

-- ── Quién escribe ──────────────────────────────────────────────────────────
--
-- Mismo molde que fn_es_usuario_autorizado (0009), y por la misma razón es
-- SECURITY DEFINER: la usan las políticas de tablas cuya lectura pasa por
-- usuarios_autorizados, que también tiene RLS. Sin DEFINER, recursión.
create or replace function fn_es_editor() returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from usuarios_autorizados u
    where u.activo
      and u.email = auth.jwt() ->> 'email'
      and u.email like '%@adapsysgroup.com'
      and u.rol = 'editor'
  );
$$;

comment on function fn_es_editor is
  'true si quien llama está autorizado Y su rol es editor. Las políticas de '
  'escritura cuelgan de esta; las de lectura siguen colgando de '
  'fn_es_usuario_autorizado.';

-- ── Partir "todo" en leer y escribir ───────────────────────────────────────
--
-- En bucle y no una por una: son doce tablas por cuatro políticas, y escritas a
-- mano la próxima tabla se agrega a once de las doce listas. Lo que importa es
-- que la regla sea una sola.
do $$
declare
  t text;
  tablas text[] := array[
    'empresas', 'cuentas', 'categorias', 'subcategorias',
    'movimientos', 'movimiento_lineas',
    'presupuesto', 'presupuesto_meses', 'presupuesto_anios', 'presupuesto_inicial',
    'parametros', 'proveedores'
  ];
begin
  foreach t in array tablas loop
    execute format('drop policy if exists %I on %I', 'autorizados_todo', t);
    execute format('drop policy if exists %I on %I', 'autorizados_leen', t);
    execute format('drop policy if exists %I on %I', 'editores_insertan', t);
    execute format('drop policy if exists %I on %I', 'editores_modifican', t);
    execute format('drop policy if exists %I on %I', 'editores_borran', t);

    execute format(
      'create policy %I on %I for select using (fn_es_usuario_autorizado())',
      'autorizados_leen', t);
    execute format(
      'create policy %I on %I for insert with check (fn_es_editor())',
      'editores_insertan', t);
    execute format(
      'create policy %I on %I for update using (fn_es_editor()) with check (fn_es_editor())',
      'editores_modifican', t);
    execute format(
      'create policy %I on %I for delete using (fn_es_editor())',
      'editores_borran', t);
  end loop;
end $$;

-- La bitácora del presupuesto se lee igual y se anota solo escribiendo (§4.6).
drop policy if exists "autorizados_anotar" on presupuesto_cambios;
create policy "autorizados_anotar" on presupuesto_cambios
  for insert with check (fn_es_editor());

-- ── La lista de personas ───────────────────────────────────────────────────
--
-- Leerla la puede leer cualquiera que esté dentro: el panel de usuarios muestra
-- quién tiene acceso, y eso en un equipo de tres es información compartida, no
-- un secreto. Administrarla es de editores — un revisor que pudiera darse a sí
-- mismo el rol de editor no sería un revisor.
--
-- "propia_fila" (0009) se queda: es la que usa el middleware para decidir si
-- deja pasar, y tiene que funcionar antes de saber si estás autorizado.
drop policy if exists "autorizados_administran" on usuarios_autorizados;
drop policy if exists "autorizados_ven_la_lista" on usuarios_autorizados;
drop policy if exists "editores_administran" on usuarios_autorizados;
drop policy if exists "editores_cambian" on usuarios_autorizados;
drop policy if exists "editores_quitan" on usuarios_autorizados;

create policy "autorizados_ven_la_lista" on usuarios_autorizados
  for select using (fn_es_usuario_autorizado());
create policy "editores_administran" on usuarios_autorizados
  for insert with check (fn_es_editor());
create policy "editores_cambian" on usuarios_autorizados
  for update using (fn_es_editor()) with check (fn_es_editor());
create policy "editores_quitan" on usuarios_autorizados
  for delete using (fn_es_editor());
