-- Un tercer tipo de cuenta: el registro de control.
--
-- La cuenta corriente Perú-Chile no es una cuenta: es un registro de lo que el otro
-- país va generando a cuenta nuestra y al revés. Cada semestre se netea y el país
-- que debe le transfiere al otro; **ese** movimiento sí sale del banco y ya está
-- anotado en la cuenta dólar de CLA ADAPTACIÓN. El registro en sí no es plata
-- nuestra en ninguna parte.
--
-- En Quicken se lleva como cuenta porque no había otra forma. Acá se distingue, y
-- la diferencia es qué hace cada tipo:
--
--   banco    entra al flujo, al presupuesto y al saldo
--   cxc      entra al flujo como proyectado y al presupuesto; no suma al saldo
--   control  no entra a nada. Existe solo al abrir su propio registro.
--
-- Ojo: los neteos que ya están cargados en la cuenta dólar con la categoría
-- 'Cuenta corriente Perú-Chile' son correctos y se quedan donde están. Son la
-- transferencia, no el registro; no hay que mezclarlos ni descontarlos.
--
-- Se puede correr más de una vez (§8).

-- El check de 0001 es anónimo, así que Postgres lo llamó `cuentas_tipo_check`.
alter table cuentas drop constraint if exists cuentas_tipo_check;
alter table cuentas add constraint cuentas_tipo_check
  check (tipo in ('banco', 'cxc', 'control'));

comment on column cuentas.tipo is
  'banco = cuenta real, entra al flujo y al saldo. cxc = cartera y proyecciones, '
  'entra al flujo como proyectado. control = registro que no entra a ninguna vista '
  'ni suma al saldo; solo se mira abriéndolo.';

insert into cuentas (id, empresa_id, nombre, moneda, tipo, saldo_inicial, principal, numero)
values ('p1', 'adap', 'CLA ADAPTACIÓN CC PERÚ', 'USD', 'control', 0, false, null)
on conflict (id) do update set
  empresa_id = excluded.empresa_id,
  nombre     = excluded.nombre,
  moneda     = excluded.moneda,
  tipo       = excluded.tipo;
