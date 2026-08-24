-- `select m.*` en una vista es una trampa: Postgres expande el asterisco al
-- crearla y congela esa lista. La columna `origen` que agregó 0003 no aparece en
-- v_movimientos_sin_clasificar, y no va a aparecer sola nunca — la vista sigue
-- devolviendo las columnas que existían en 0001, sin error ni aviso.
--
-- Se recrea con las columnas escritas una por una. Más largo, pero explícito:
-- si mañana alguien agrega otra columna a movimientos, tiene que decidir a
-- conciencia si va en la vista, en vez de que aparezca o no según cuándo se
-- ejecutó cada migración.
drop view v_movimientos_sin_clasificar;

create view v_movimientos_sin_clasificar with (security_invoker = true) as
  select
    m.id,
    m.fecha,
    m.empresa_id,
    m.cuenta_id,
    m.contraparte,
    m.glosa,
    m.monto,
    m.moneda,
    m.tipo_cambio,
    m.estado,
    m.doc_tipo,
    m.origen,
    m.creado_por,
    m.creado_en,
    m.actualizado_en
  from movimientos m
  where not exists (
    select 1 from movimiento_lineas ml where ml.movimiento_id = m.id
  );

comment on view v_movimientos_sin_clasificar is
  'Movimientos sin ninguna línea: los que quedaron sin clasificar al importar '
  'desde Quicken (§11) y los que se registren sin categoría. Se reasignan desde '
  'la app. Columnas explícitas a propósito: ver el comentario de la migración.';
