// Tipos del dominio. Los nombres de campo son los mismos que las columnas de
// supabase/migrations/0001_esquema.sql a propósito: cuando se cablee Supabase las
// filas entran directo, sin capa de traducción.

export type Moneda = "CLP" | "USD";
export type TipoCuenta = "banco" | "cxc";
export type Naturaleza = "ingreso" | "inversion" | "operativo";
export type EstadoMovimiento = "proyectado" | "pagado" | "conciliado";
export type DocTipo = "exento" | "afecta" | "honorario";
export type Grupo = "Adapsys" | "Relacionadas";

export type Empresa = {
  id: string;
  nombre: string;
  corto: string;
  grupo: Grupo;
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

export type Categoria = {
  id: string;
  nombre: string;
  orden: number;
  controlado: boolean;
};

export type Subcategoria = {
  id: string;
  categoria_id: string;
  nombre: string;
  naturaleza: Naturaleza;
  activa: boolean;
};

/** Una línea del split. Siempre tiene subcategoría: "sin clasificar" se
 *  representa con un movimiento sin líneas (§3), no con una línea sin sub. */
export type Linea = {
  subcategoria_id: string;
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
 *  v_lineas_expandidas: toda agregación por subcategoría parte de acá (§3). */
export type LineaExpandida = {
  movimiento_id: string;
  fecha: string;
  empresa_id: string | null;
  cuenta_id: string | null;
  estado: EstadoMovimiento;
  moneda: Moneda;
  tipo_cambio: number | null;
  /** null cuando el movimiento no tiene líneas: sin clasificar. */
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
