// Tipos del dominio. Los nombres de campo son los mismos que las columnas de
// supabase/migrations/0001_esquema.sql a propósito: cuando se cablee Supabase las
// filas entran directo, sin capa de traducción.

export type Moneda = "CLP" | "USD";
export type TipoCuenta = "banco" | "cxc";
export type Naturaleza = "ingreso" | "inversion" | "operativo";
export type EstadoMovimiento = "proyectado" | "pagado" | "conciliado";
export type DocTipo = "exento" | "afecta" | "honorario";
export type GrupoEmpresa = "Adapsys" | "Relacionadas";

export type Empresa = {
  id: string;
  nombre: string;
  corto: string;
  grupo: GrupoEmpresa;
};

/** La moneda es propiedad de la cuenta y no cambia nunca. Cada empresa tiene a lo
 *  más una cuenta bancaria por moneda, así que elegir la cuenta determina la moneda
 *  del movimiento — no se eligen por separado. */
export type Cuenta = {
  id: string;
  empresa_id: string;
  nombre: string;
  moneda: Moneda;
  tipo: TipoCuenta;
  saldo_inicial: number;
  principal: boolean;
};

/** Nivel 1: "2 GASTOS ADMINISTRACIÓN". Es donde se decide si entra o no al control
 *  presupuestario (§4.6). No confundir con GrupoEmpresa, que agrupa sociedades. */
export type Grupo = {
  id: string;
  nombre: string;
  orden: number;
  controlado: boolean;
};

/** Nivel 2: "Jornadas y eventos organización". Es el nivel al que se clasifica y
 *  el que agrupan el flujo, el presupuesto y los reportes. La naturaleza vive acá
 *  y no en el grupo, por eso un grupo puede ser mixto (§4.2). */
export type Categoria = {
  id: string;
  grupo_id: string;
  nombre: string;
  naturaleza: Naturaleza;
  activa: boolean;
};

/** Nivel 3, opcional: "Offsite internacional".
 *
 *  Es detalle de la línea, no nivel de reporte. Una línea siempre se clasifica en
 *  una categoría; la subcategoría precisa dentro de cuál, cuando hace falta. Por eso
 *  no lleva naturaleza —la hereda— y agregarle subcategorías a una categoría no
 *  invalida nada de lo ya clasificado en ella. */
export type Subcategoria = {
  id: string;
  categoria_id: string;
  nombre: string;
  activa: boolean;
};

/** Una línea del split. Siempre tiene categoría: "sin clasificar" se representa con
 *  un movimiento sin líneas (§3), no con una línea sin categoría. La subcategoría es
 *  opcional y tiene que pertenecer a la categoría de la misma línea. */
export type Linea = {
  categoria_id: string;
  subcategoria_id: string | null;
  monto: number;
  glosa: string | null;
};

export type Movimiento = {
  id: string;
  fecha: string; // YYYY-MM-DD
  /** null mientras no se sepa. Pasa en proyecciones: la provisión "GAP IMA" no
   *  tiene sociedad asignada, y lo que se genere desde el presupuesto tampoco va
   *  a tenerla, porque el presupuesto es consolidado (§4.6). */
  empresa_id: string | null;
  /** Normalmente la cuenta determina la moneda. null solo en proyecciones que
   *  todavía no saben de dónde va a salir la plata; un movimiento pagado siempre
   *  salió de alguna cuenta. */
  cuenta_id: string | null;
  contraparte: string | null;
  glosa: string | null;
  /** Número del documento que respalda el movimiento: FA273, B405. Distinto de
   *  `doc_tipo`, que es si es exento, afecta u honorario. En ventas el número es
   *  la identidad de la factura, así que va aparte y no dentro de la glosa. */
  documento: string | null;
  /** Líquido que entra o sale del banco. Puede diferir de la suma de líneas:
   *  el descuadre se avisa en la UI, no se corrige en silencio. */
  monto: number;
  /** Siempre igual a la moneda de `cuenta_id`; la base lo garantiza con una foreign
   *  key compuesta. No es un campo que se elija: se deriva de la cuenta. */
  moneda: Moneda;
  /** TC del día de la operación. Se conserva, no se recalcula (§4.5). */
  tipo_cambio: number | null;
  estado: EstadoMovimiento;
  doc_tipo: DocTipo | null;
  /** Vacío = sin clasificar. Una línea = simple. Dos o más = split. */
  lineas: Linea[];
};

/** Fila resultante de expandir un movimiento a sus líneas. Equivale a la vista
 *  v_lineas_expandidas: toda agregación por categoría parte de acá (§3). */
export type LineaExpandida = {
  movimiento_id: string;
  fecha: string;
  empresa_id: string | null;
  cuenta_id: string | null;
  estado: EstadoMovimiento;
  moneda: Moneda;
  tipo_cambio: number | null;
  /** null cuando el movimiento no tiene líneas: sin clasificar. */
  categoria_id: string | null;
  /** El detalle de la línea, cuando lo tiene. Casi siempre null (§3.1). */
  subcategoria_id: string | null;
  monto: number;
  glosa: string | null;
  contraparte: string | null;
  /** Índice de la línea dentro del movimiento; null si es implícita.
   *  Es la ruta de vuelta para editar la línea desde una vista agregada. */
  indice_linea: number | null;
};

export type Tasas = {
  iva: number;
  bhe: number;
};

export type LineaPresupuesto = {
  monto: number;
  monto_anterior: number;
  responsable: string;
  nota: string;
};
