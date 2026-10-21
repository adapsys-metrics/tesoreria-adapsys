-- Una categoría puede llevarse por cargos.
--
-- "Sueldos" no se controla por lo que se le paga a cada persona sino por lo que
-- cuesta cada **cargo**: el cargo persiste aunque cambie quién lo ocupa, y es la
-- unidad en que se presupuesta y en que se presenta al comité. Así que los cargos
-- son subcategorías de `Sueldos`, y cada una lleva el nombre de quien lo ocupa.
--
-- El nombre de la persona es un dato aparte del nombre del cargo a propósito: si
-- fueran lo mismo, el día que alguien se va habría que renombrar la subcategoría y
-- todo el histórico presupuestario pasaría a llamarse por otra persona. El cargo es
-- lo que se compara contra el año pasado.
--
-- Va como marca en la categoría y no amarrado al id 'sueldos' porque es una forma
-- de llevar una categoría, no una excepción: el día que quieran controlar otra por
-- cargos —honorarios por rol, por ejemplo— es una casilla y no un cambio de código.
--
-- Se puede correr más de una vez (§8).

alter table categorias add column if not exists por_cargos boolean not null default false;

comment on column categorias.por_cargos is
  'Sus subcategorías son cargos y llevan el nombre de quien los ocupa. Cambia cómo '
  'se piden en el mantenedor, no cómo se agregan: un cargo es una subcategoría más.';

alter table subcategorias add column if not exists titular text;

comment on column subcategorias.titular is
  'Quién ocupa el cargo. Solo tiene sentido cuando su categoría va por_cargos. Se '
  'guarda aparte del nombre para que al cambiar la persona no cambie el nombre del '
  'cargo, que es lo que se compara entre años.';

-- La única que hoy se lleva así. El resto queda como estaba.
update categorias set por_cargos = true where id = 'sueldos';
