-- RLS — CLAUDE.md §1: 3 personas de administración/finanzas, todas con permiso
-- de escritura. No hay roles complejos al día uno: el único filtro es
-- "¿la cuenta autenticada es del dominio corporativo?".
--
-- Si el equipo crece o alguien necesita solo lectura, este es el lugar para
-- introducir una tabla de roles — no antes de que haga falta.

create function fn_es_usuario_autorizado() returns boolean as $$
  select coalesce((auth.jwt() ->> 'email') like '%@adapsysgroup.com', false);
$$ language sql stable;

comment on function fn_es_usuario_autorizado is
  'true si el usuario autenticado pertenece al dominio corporativo. '
  'Si el dominio cambia, editar esta función en una migración nueva.';

alter table empresas enable row level security;
alter table cuentas enable row level security;
alter table categorias enable row level security;
alter table subcategorias enable row level security;
alter table movimientos enable row level security;
alter table movimiento_lineas enable row level security;
alter table presupuesto enable row level security;
alter table parametros enable row level security;
alter table reportes_guardados enable row level security;
alter table auditoria enable row level security;

-- Catálogos y operación: lectura y escritura completas para cualquier cuenta
-- corporativa autenticada.
create policy "autorizados_todo" on empresas
  for all using (fn_es_usuario_autorizado()) with check (fn_es_usuario_autorizado());
create policy "autorizados_todo" on cuentas
  for all using (fn_es_usuario_autorizado()) with check (fn_es_usuario_autorizado());
create policy "autorizados_todo" on categorias
  for all using (fn_es_usuario_autorizado()) with check (fn_es_usuario_autorizado());
create policy "autorizados_todo" on subcategorias
  for all using (fn_es_usuario_autorizado()) with check (fn_es_usuario_autorizado());
create policy "autorizados_todo" on movimientos
  for all using (fn_es_usuario_autorizado()) with check (fn_es_usuario_autorizado());
create policy "autorizados_todo" on movimiento_lineas
  for all using (fn_es_usuario_autorizado()) with check (fn_es_usuario_autorizado());
create policy "autorizados_todo" on presupuesto
  for all using (fn_es_usuario_autorizado()) with check (fn_es_usuario_autorizado());
create policy "autorizados_todo" on parametros
  for all using (fn_es_usuario_autorizado()) with check (fn_es_usuario_autorizado());

-- Reportes guardados: cualquiera del equipo puede ver las configuraciones de
-- los demás (son 3 personas revisando lo mismo), pero cada quien solo edita
-- o borra las suyas.
create policy "autorizados_leen" on reportes_guardados
  for select using (fn_es_usuario_autorizado());
create policy "dueno_escribe" on reportes_guardados
  for insert with check (fn_es_usuario_autorizado() and usuario_id = auth.uid());
create policy "dueno_modifica" on reportes_guardados
  for update using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
create policy "dueno_borra" on reportes_guardados
  for delete using (usuario_id = auth.uid());

-- Auditoría: log de solo lectura + inserción. "Nada se borra" (§10) — no hay
-- política de update ni delete, así que RLS las bloquea por defecto.
create policy "autorizados_leen" on auditoria
  for select using (fn_es_usuario_autorizado());
create policy "autorizados_insertan" on auditoria
  for insert with check (fn_es_usuario_autorizado());
