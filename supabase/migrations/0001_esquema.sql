-- Esquema base de Tesorería Adapsys — ver CLAUDE.md §3.
-- Los catálogos (empresas, cuentas, categorías, subcategorías) usan ids de texto
-- (slugs) porque son de referencia, cambian poco y los ids legibles ayudan a
-- depurar. Las tablas transaccionales usan bigint identity: no tienen clave natural.

-- ─────────────────────────  EMPRESAS Y CUENTAS  ─────────────────────────

create table empresas (
  id     text primary key,
  nombre text not null,
  corto  text not null,
  grupo  text not null check (grupo in ('Adapsys', 'Relacionadas'))
);

create table cuentas (
  id            text primary key,
  empresa_id    text not null references empresas (id),
  nombre        text not null,
  moneda        text not null check (moneda in ('CLP', 'USD')),
  tipo          text not null check (tipo in ('banco', 'cxc')),
  saldo_inicial numeric not null default 0,
  principal     boolean not null default false
);

create index cuentas_empresa_id_idx on cuentas (empresa_id);

-- ─────────────────────────  CATÁLOGO  ─────────────────────────
-- La naturaleza vive en la subcategoría, no en la categoría (§4.2): una misma
-- categoría puede mezclar líneas de inversión y operativas.

create table categorias (
  id         text primary key,
  nombre     text not null,
  orden      integer not null,
  controlado boolean not null default true
);

create table subcategorias (
  id            text primary key,
  categoria_id  text not null references categorias (id),
  nombre        text not null,
  naturaleza    text not null check (naturaleza in ('ingreso', 'inversion', 'operativo')),
  activa        boolean not null default true
);

create index subcategorias_categoria_id_idx on subcategorias (categoria_id);

-- ─────────────────────────  MOVIMIENTOS  ─────────────────────────
-- estado: proyectado (compromiso, no afecta saldo) → pagado (afecta saldo, sin
-- conciliar) → conciliado (cuadrado contra cartola). Ver §4.1.
-- monto = líquido que entra o sale del banco; el detalle de impuestos y
-- retenciones vive en movimiento_lineas (§4.3).

create table movimientos (
  id             bigint generated always as identity primary key,
  fecha          date not null,
  empresa_id     text not null references empresas (id),
  cuenta_id      text not null references cuentas (id),
  contraparte    text,
  glosa          text,
  monto          numeric not null,
  moneda         text not null check (moneda in ('CLP', 'USD')),
  tipo_cambio    numeric,
  estado         text not null default 'proyectado' check (estado in ('proyectado', 'pagado', 'conciliado')),
  doc_tipo       text check (doc_tipo in ('exento', 'afecta', 'honorario')),
  creado_por     uuid references auth.users (id),
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint moneda_usd_requiere_tc check (moneda <> 'USD' or tipo_cambio is not null)
);

create index movimientos_fecha_idx on movimientos (fecha);
create index movimientos_empresa_id_idx on movimientos (empresa_id);
create index movimientos_cuenta_id_idx on movimientos (cuenta_id);
create index movimientos_estado_idx on movimientos (estado);

create function fn_tocar_actualizado_en() returns trigger as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$ language plpgsql;

create trigger movimientos_actualizado_en
  before update on movimientos
  for each row execute function fn_tocar_actualizado_en();

-- Splits (§4.3): la suma de líneas debe cuadrar con movimientos.monto.
-- Un movimiento sin líneas se trata como una línea única implícita —
-- ver la vista v_lineas_expandidas más abajo.

create table movimiento_lineas (
  id              bigint generated always as identity primary key,
  movimiento_id   bigint not null references movimientos (id) on delete cascade,
  subcategoria_id text not null references subcategorias (id),
  monto           numeric not null,
  glosa           text,
  orden           integer not null default 0
);

create index movimiento_lineas_movimiento_id_idx on movimiento_lineas (movimiento_id);
create index movimiento_lineas_subcategoria_id_idx on movimiento_lineas (subcategoria_id);

-- Constraint trigger diferida: valida al final de la transacción (no línea a
-- línea), para permitir insertar varias líneas de un split en el mismo commit.
-- Importante para quien use esto desde supabase-js: las líneas de un mismo
-- split deben viajar en un solo .insert([...]) (statement con múltiples VALUES,
-- una sola transacción implícita) — no en llamadas .insert() separadas, porque
-- cada llamada suelta es su propia transacción y la primera línea sola no cuadra.
-- Tolerancia de 1 por redondeo — el documento manda sobre la fórmula (§4.3).
create function fn_validar_lineas_cuadran() returns trigger as $$
declare
  v_movimiento_id bigint := coalesce(new.movimiento_id, old.movimiento_id);
  v_monto_movimiento numeric;
  v_suma_lineas numeric;
begin
  select monto into v_monto_movimiento from movimientos where id = v_movimiento_id;

  -- El movimiento fue borrado en la misma transacción (cascade): nada que validar.
  if v_monto_movimiento is null then
    return null;
  end if;

  select coalesce(sum(monto), 0) into v_suma_lineas
  from movimiento_lineas
  where movimiento_id = v_movimiento_id;

  if abs(v_suma_lineas - v_monto_movimiento) > 1 then
    raise exception
      'Las líneas del movimiento % suman % pero el movimiento es %',
      v_movimiento_id, v_suma_lineas, v_monto_movimiento;
  end if;

  return null;
end;
$$ language plpgsql;

create constraint trigger movimiento_lineas_cuadran
  after insert or update or delete on movimiento_lineas
  deferrable initially deferred
  for each row execute function fn_validar_lineas_cuadran();

-- Agregación segura: expande a la línea real, o a una línea implícita
-- (subcategoria_id nulo = sin clasificar) cuando el movimiento no tiene líneas.
-- Toda agregación por subcategoría debe partir de esta vista, nunca de movimientos (§3).
--
-- security_invoker = true en las tres vistas: sin esto, Postgres evalúa RLS con
-- los permisos del dueño de la vista (no de quien consulta), y el filtro de
-- fn_es_usuario_autorizado() en las tablas base quedaría sin efecto.
create view v_lineas_expandidas with (security_invoker = true) as
  select
    m.id as movimiento_id,
    m.fecha,
    m.empresa_id,
    m.cuenta_id,
    m.estado,
    m.moneda,
    m.tipo_cambio,
    ml.subcategoria_id,
    coalesce(ml.monto, m.monto) as monto,
    coalesce(ml.glosa, m.glosa) as glosa
  from movimientos m
  left join movimiento_lineas ml on ml.movimiento_id = m.id;

-- Movimientos sin ninguna línea: candidatos a clasificar.
create view v_movimientos_sin_clasificar with (security_invoker = true) as
  select m.*
  from movimientos m
  where not exists (
    select 1 from movimiento_lineas ml where ml.movimiento_id = m.id
  );

-- Líneas que quedaron apuntando a una subcategoría desactivada: candidatas a reasignar (§3).
create view v_lineas_categoria_inactiva with (security_invoker = true) as
  select ml.*
  from movimiento_lineas ml
  join subcategorias s on s.id = ml.subcategoria_id
  where s.activa = false;

-- ─────────────────────────  PRESUPUESTO  ─────────────────────────
-- Uno solo, consolidado para las 4 empresas Adapsys — sin empresa_id (§4.6).

create table presupuesto (
  id             bigint generated always as identity primary key,
  anio           integer not null,
  subcategoria_id text not null references subcategorias (id),
  monto          numeric not null default 0,
  monto_anterior numeric not null default 0,
  responsable    text,
  nota           text,
  unique (anio, subcategoria_id)
);

create index presupuesto_anio_idx on presupuesto (anio);

-- ─────────────────────────  PARÁMETROS  ─────────────────────────
-- Tasas y TC con vigencia por fecha — nunca hardcodear (§9).

create table parametros (
  clave           text not null,
  valor           numeric not null,
  vigencia_desde  date not null,
  primary key (clave, vigencia_desde)
);

-- ─────────────────────────  REPORTES Y AUDITORÍA  ─────────────────────────

create table reportes_guardados (
  id         bigint generated always as identity primary key,
  usuario_id uuid not null references auth.users (id),
  nombre     text not null,
  config     jsonb not null default '{}'::jsonb,
  creado_en  timestamptz not null default now()
);

create table auditoria (
  id          bigint generated always as identity primary key,
  tabla       text not null,
  registro_id text not null,
  accion      text not null check (accion in ('crear', 'modificar', 'anular')),
  antes       jsonb,
  despues     jsonb,
  usuario_id  uuid references auth.users (id),
  cuando      timestamptz not null default now()
);

create index auditoria_tabla_registro_idx on auditoria (tabla, registro_id);
