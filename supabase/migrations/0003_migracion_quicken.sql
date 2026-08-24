-- Ajustes que pide la migración desde Quicken. Todo lo que agrega catálogo va
-- también en lib/catalogo.ts, que es la fuente de verdad: esta migración existe
-- para las bases donde el seed ya corrió.

-- ── 1. La empresa puede no saberse todavía ──────────────────────────────────
--
-- En los espejos de proyección hay una fila "bolsa": un egreso comprometido que
-- aún no tiene sociedad asignada porque depende de por dónde se gestione.
--
-- No es un caso de borde que valga la pena forzar. El presupuesto es consolidado
-- y no tiene dimensión de empresa (§4.6), así que cuando la proyección se genere
-- desde el presupuesto — el mecanismo decidido en §10 — toda proyección generada
-- va a nacer sin empresa. La bolsa es el primer caso de lo que será lo normal.
alter table movimientos alter column empresa_id drop not null;

comment on column movimientos.empresa_id is
  'Sociedad a la que corresponde el movimiento. Null mientras no se sepa: '
  'proyecciones que vienen del presupuesto consolidado, que no tiene empresa.';

-- ── 2. De qué registro de Quicken salió cada movimiento ─────────────────────
--
-- Sin esto no hay forma de reimportar un registro corregido sin duplicar todo:
-- se borra lo que vino de ese archivo y se vuelve a insertar. Ya pasó una vez
-- (a1.csv llegó con una búsqueda activa y salió incompleto).
alter table movimientos add column origen text;

comment on column movimientos.origen is
  'Archivo del export de Quicken del que se importó, o null si se creó en la app. '
  'Permite reimportar un registro completo sin duplicar: borrar por origen e insertar.';

create index movimientos_origen_idx on movimientos (origen) where origen is not null;

-- ── 3. Los proyectos aprobados son una cartera aparte ───────────────────────
--
-- Facturas por cobrar y proyectos aprobados no son lo mismo aunque los dos sean
-- plata por entrar: la factura es un documento emitido con número, el proyecto
-- aprobado es una estimación cuya fecha se mueve semana a semana según avanza.
-- Juntarlos haría que la proyección de ingresos trate como igual de firme algo
-- que no lo es.
insert into cuentas (id, empresa_id, nombre, moneda, tipo, saldo_inicial, principal) values
  ('x3', 'adap', 'Proyectos aprobados CLP', 'CLP', 'cxc', 0, false),
  ('x4', 'adap', 'Proyectos aprobados USD', 'USD', 'cxc', 0, false)
on conflict (id) do nothing;

-- ── 4. Saldos iniciales reales ──────────────────────────────────────────────
--
-- Los que estaban venían del prototipo y eran saldos de hoy. El saldo inicial es
-- la fila "Opening Balance" del registro; el saldo corriente sale de sumarle los
-- movimientos. Las cuentas que no aparecen acá parten de cero porque su registro
-- empieza directamente con el primer movimiento.
update cuentas set saldo_inicial = 74220512 where id = 'a1';
update cuentas set saldo_inicial =   507.66 where id = 'a2';
update cuentas set saldo_inicial = 53058579 where id = 'b1';
update cuentas set saldo_inicial =    72000 where id = 'b2';
update cuentas set saldo_inicial = 0 where id in ('c1', 'c2', 'd1', 'e1', 'e2', 'x1', 'x2');

-- ── 5. Subcategorías que existen en los movimientos y no en el catálogo ─────
--
-- Siete clientes nuevos, presentes en proyectos aprobados y facturas por cobrar
-- (negocio vigente, por eso activas), y dos que en Quicken son tercer nivel bajo
-- "Sistemas Analítica avanzada". El tercer nivel se aplana como subcategoría
-- propia, igual que ya estaba hecho con "Offsite internacional".
insert into subcategorias (id, categoria_id, nombre, naturaleza, activa) values
  ('adghe',      'a-ingresos-clientes', 'ADGHE',      'ingreso', true),
  ('ama-time',   'a-ingresos-clientes', 'AMA TIME',   'ingreso', true),
  ('asch',       'a-ingresos-clientes', 'ASCH',       'ingreso', true),
  ('ausenco',    'a-ingresos-clientes', 'AUSENCO',    'ingreso', true),
  ('consorcio',  'a-ingresos-clientes', 'CONSORCIO',  'ingreso', true),
  ('deloitte',   'a-ingresos-clientes', 'DELOITTE',   'ingreso', true),
  ('papa-johns', 'a-ingresos-clientes', 'PAPA JOHNS', 'ingreso', true),
  ('automatizacion-y-metrics', '2-3-gastos-sistemas-digita', 'Automatización y metrics', 'operativo', true),
  ('manejador-base-de-datos',  '2-3-gastos-sistemas-digita', 'Manejador base de datos',  'operativo', true)
on conflict (id) do nothing;
