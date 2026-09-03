-- Qué categorías entran al control presupuestario (§4.6).
--
-- Impuestos y bancos salían marcadas como controladas y no corresponde: no son
-- gasto que se decida presupuestar. El IVA y la retención salen de lo que se
-- factura, y las comisiones bancarias de lo que se mueve — presupuestarlas sería
-- presupuestar una consecuencia.
--
-- Se suman a las que ya estaban fuera: préstamos bancarios, inversiones y
-- relacionados y socios, que son movimientos de tesorería o decisiones de los
-- dueños, no gasto operativo.
--
-- Fuera del control no significa fuera de la vista: siguen apareciendo en una
-- banda aparte con su gasto, para que nadie olvide que existen.
update categorias set controlado = false where id in ('4-impuestos', '5-bancos');

comment on column categorias.controlado is
  'Si entra al control presupuestario. Las que no, se muestran aparte con su '
  'gasto pero sin presupuesto contra el cual compararlo.';
