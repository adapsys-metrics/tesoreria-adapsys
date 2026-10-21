-- Una categoría suelta puede quedar fuera del control presupuestario.
--
-- Hasta acá la exclusión era por grupo (`grupos.controlado`, 0011) y eso alcanzaba
-- para lo grueso: impuestos, bancos, inversiones, préstamos y socios no son gasto
-- que se decida presupuestar. Pero dentro de un grupo controlado hay líneas que
-- tampoco lo son, y no había forma de sacarlas sin sacar el grupo entero.
--
-- La regla queda en dos niveles y se compone: una línea entra al control si **su
-- grupo entra y ella no está excluida**. El default es true, así que nada cambia
-- hasta que alguien desmarque algo.
--
-- Ojo con la consecuencia, que es la razón de que esto exista en vez de borrar la
-- línea: lo excluido **sigue saliendo de la caja**. Tiene que seguir viéndose en
-- la banda de "fuera del control presupuestario" (§4.6) o esa plata desaparece del
-- informe sin que nadie lo note.
--
-- Se puede correr más de una vez (§8).

alter table categorias add column if not exists controlada boolean not null default true;

comment on column categorias.controlada is
  'Entra al control presupuestario. Se compone con grupos.controlado: una línea '
  'entra si su grupo entra Y ella no está excluida. Lo excluido se sigue mostrando '
  'en la banda aparte, porque igual sale de la caja.';
