-- Paso 1 de 3 de la carga del histórico de Quicken.
--
-- Crea dos tablas de paso con la forma exacta de los CSV que genera
-- scripts/generar-carga.mjs. Son temporales en el sentido de que el paso 3 las
-- borra, pero tablas normales: el importador de CSV del Table Editor no puede
-- escribir en una tabla de sesión.
--
-- Todo entra como text menos los montos y la fecha. Se valida al promover, no
-- al importar: si el CSV trae una subcategoría que no existe, conviene que
-- reviente el paso 3 con un mensaje claro y no el importador del navegador.

-- Se limpia primero para que este archivo se pueda correr las veces que haga
-- falta. Un intento anterior puede dejar una de las dos tablas creada y la otra
-- no, y entonces el create falla con "ya existe" y hay que ir a borrarla a mano.
--
-- Es seguro: estas dos tablas solo existen durante la carga y el paso 3 las
-- borra al terminar. Si tienen datos, son de un intento que no llegó a
-- promoverse — nada que valga la pena conservar.
drop table if exists carga_lineas;
drop table if exists carga_movimientos;

create table carga_movimientos (
  ref         text primary key,
  fecha       date not null,
  empresa_id  text,
  cuenta_id   text,
  contraparte text,
  glosa       text,
  monto       numeric not null,
  moneda      text not null,
  estado      text not null,
  origen      text not null
);

create table carga_lineas (
  mov_ref         text not null,
  subcategoria_id text not null,
  monto           numeric not null,
  glosa           text,
  orden           integer not null
);

create index carga_lineas_mov_ref_idx on carga_lineas (mov_ref);
