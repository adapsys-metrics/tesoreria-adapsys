-- Maestro de proveedores y número de cuenta propio.
--
-- Los dos existen para la nómina de pago (§10): el archivo que se sube al portal pide
-- la cuenta de origen —que es nuestra y hoy no está en ninguna parte— y los datos
-- bancarios del beneficiario.
--
-- Además el maestro es el filtro de la nómina: entra a pagarse lo que tiene proveedor
-- con cuenta cargada. Por eso lleva `activo` y no se borra lo que ya se usó.

create table proveedores (
  id text primary key,
  nombre text not null,
  -- Sin puntos ni guion y con el dígito verificador pegado, que es como lo pide el
  -- portal: 766244890. Se guarda ya en ese formato para no tener que limpiarlo al
  -- exportar, que es donde un error se descubre tarde.
  rut text,
  -- Código de banco del portal, no el nombre. Va como texto porque hay códigos con
  -- cero a la izquierda y un numérico se los comería.
  cod_banco text,
  cuenta text,
  correo text,
  activo boolean not null default true
);

-- Se busca por nombre al emparejar con la contraparte del movimiento.
create index proveedores_nombre_idx on proveedores (lower(nombre));

alter table proveedores enable row level security;

create policy "autorizados_todo" on proveedores
  for all using (fn_es_usuario_autorizado()) with check (fn_es_usuario_autorizado());

comment on table proveedores is
  'Datos bancarios para la nómina de pago. Entra a la nómina lo que tiene proveedor '
  'con cuenta cargada acá: la decisión se toma una vez y no se adivina por el nombre.';

-- El número de la cuenta propia, para la columna Cta_origen del archivo. Texto por lo
-- mismo que arriba, y nullable porque las cuentas auxiliares —facturas por cobrar,
-- proyecciones— no son cuentas de banco y no tienen número.
alter table cuentas add column numero text;

comment on column cuentas.numero is
  'Número de la cuenta en el banco. Solo las de tipo banco lo tienen; las auxiliares '
  'son registros de Quicken, no cuentas reales.';
