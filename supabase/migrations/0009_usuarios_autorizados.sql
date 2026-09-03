-- Acceso por lista de personas, no por dominio.
--
-- Hasta ahora entraba cualquier correo @adapsysgroup.com. CLAUDE.md §1 dice "3
-- personas de administración y finanzas", y "el dominio" es otra cosa muy
-- distinta: consultores, operaciones, cualquiera de la empresa veía los saldos de
-- las cinco sociedades, los sueldos por persona y los retiros de socios.
--
-- La lista vive en una tabla y no en el código para que dar de baja a alguien sea
-- borrar una fila desde el panel, un viernes, sin depender de un despliegue.

create table usuarios_autorizados (
  email     text primary key,
  nombre    text not null,
  -- Se desactiva en vez de borrar: queda el registro de quién tuvo acceso, que es
  -- lo que se pregunta después de un incidente. Volver a activarlo es un clic.
  activo    boolean not null default true,
  creado_en timestamptz not null default now()
);

comment on table usuarios_autorizados is
  'Quién puede entrar. Administrar desde el Table Editor: agregar una fila da '
  'acceso, poner activo=false lo quita. El correo tiene que ser del dominio '
  'corporativo igual — son dos filtros, no uno.';

insert into usuarios_autorizados (email, nombre) values
  ('matias.espinoza@adapsysgroup.com',  'Matías Espinoza'),
  ('litsy.verasay@adapsysgroup.com',    'Litsy Verasay'),
  ('patricia.alarcon@adapsysgroup.com', 'Patricia Alarcón');

-- ── La función de autorización ─────────────────────────────────────────────
--
-- SECURITY DEFINER es necesario acá y no es un descuido: las políticas de las
-- demás tablas llaman a esta función, y esta función lee usuarios_autorizados,
-- que a su vez tiene RLS. Sin DEFINER la política de esa tabla llamaría otra vez
-- a la función y Postgres cortaría por recursión infinita.
--
-- Es seguro porque la función no recibe parámetros ni devuelve datos: solo dice
-- sí o no sobre quien está llamando. El `set search_path` es obligatorio en una
-- función DEFINER — sin él, alguien podría anteponer un esquema propio y hacer
-- que `usuarios_autorizados` apunte a una tabla suya.
create or replace function fn_es_usuario_autorizado() returns boolean
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
      -- El dominio se sigue exigiendo aunque el correo esté en la lista. Dos
      -- filtros independientes: una fila mal agregada no alcanza para entrar.
      and u.email like '%@adapsysgroup.com'
  );
$$;

comment on function fn_es_usuario_autorizado is
  'true si quien llama está en usuarios_autorizados, activo, y con correo del '
  'dominio corporativo. La usan todas las políticas de RLS.';

-- ── RLS de la propia tabla ─────────────────────────────────────────────────

alter table usuarios_autorizados enable row level security;

-- Cada quien puede leer su propia fila. Es lo que consulta el middleware para
-- decidir si deja pasar, y no puede depender de fn_es_usuario_autorizado porque
-- sería el mismo círculo que resuelve el SECURITY DEFINER.
create policy "propia_fila" on usuarios_autorizados
  for select using (email = auth.jwt() ->> 'email');

-- Y quien ya está autorizado ve y administra la lista completa. Son tres personas
-- de administración: no hace falta un rol aparte para gestionar accesos, y sí
-- hace falta que puedan darse de baja entre ellas sin llamar a nadie.
create policy "autorizados_administran" on usuarios_autorizados
  for all using (fn_es_usuario_autorizado()) with check (fn_es_usuario_autorizado());
