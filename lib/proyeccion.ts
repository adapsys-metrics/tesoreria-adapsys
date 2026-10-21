// Escribir la proyección de un año.
//
// El presupuesto operativo del año que viene no se escribe: **sale de sumar los
// movimientos proyectados**. Y esos movimientos salen de líneas que alguien
// escribe —proveedor, categoría, monto, día y cada cuánto—, una por pago que se
// repite: Entel el 14 de cada mes, el aguinaldo en diciembre, el split de
// sueldos.
//
// Antes esto copiaba el año anterior y se elegía qué traer. La idea era buena
// para **saber qué se paga** y mala para **decidir qué se va a pagar**: el pasado
// viene con su desorden —un proveedor que aparece una vez con un monto enorme,
// una categoría que ya no se usa— y además la mitad de los montos cambian igual,
// porque los sueldos suben, el IMA se renegocia y el IVA sale de las ventas del
// mes. Quedó `resumirPorCategoria`, que arma ese resumen como **consulta** al
// lado del formulario, con un botón para traer una línea ya rellena.
//
// Vale la pena decir en qué se parece y en qué no a lo que CLAUDE.md §10
// descartó. Ahí se rechazó mantener **reglas por proveedor** que generaran el
// presupuesto del año entero y hubiera que cuidar vivas. Acá la línea no es una
// regla que persista: se expande una vez, en movimientos concretos y editables,
// y después se muere. Lo que queda en la base son los movimientos, no la regla.
//
// Lo que sí hereda de ese párrafo es la advertencia del doble conteo, y se
// resuelve por construcción: si el presupuesto sale de los proyectados en vez de
// convivir con ellos, no hay dos fuentes que sumar.

import { enCLP, expandir } from "@/lib/dominio";
import { clave } from "@/lib/catalogo-indices";
import type { DocTipo, Moneda, Movimiento } from "@/lib/tipos";

/** Lo que se va a crear. Sin `id`: los asigna la base.
 *
 *  Empresa y cuenta no son opcionales: en la base las dos columnas son `not null`
 *  (0001), así que una proyección sin cuenta no falla al armarla sino al
 *  insertarla, entera y recién ahí. Dejarlas obligatorias acá hace que el
 *  compilador lo pida antes. */
export type MovimientoProyectado = {
  fecha: string;
  empresa_id: string;
  cuenta_id: string;
  contraparte: string | null;
  glosa: string | null;
  monto: number;
  moneda: Moneda;
  tipo_cambio: number | null;
  doc_tipo: DocTipo | null;
  lineas: {
    categoria_id: string;
    subcategoria_id: string | null;
    doc_tipo: DocTipo | null;
    monto: number;
    glosa: string | null;
  }[];
};

/**
 * Lo que un proveedor aporta dentro de una categoría.
 *
 * El proveedor es el nivel en que esto se mira de verdad: "Telefonía e internet ·
 * 12 meses" no dice si son doce pagos a Entel o una mezcla de Entel y GTD, y sin
 * saberlo uno proyecta a ciegas.
 */
export type Rama = {
  categoria_id: string;
  /** Vacío cuando el movimiento no la tiene. */
  contraparte: string;
  /** Los meses del año destino en que aparece, ordenados. Su largo es "en cuántos
   *  meses": 12 es mensual, 4 trimestral, 1 una vez en el año. */
  meses: number[];
  movimientos: number;
  /** Suma en CLP, en magnitud. */
  total: number;
  /** Lo que pagó por mes en que apareció. Es el monto que uno pondría al escribir
   *  la línea, y por eso se divide por meses y no por movimientos: dos pagos en
   *  el mismo mes son un mes de gasto. */
  promedio: number;
  /** El día más repetido. Un arriendo cae siempre el 5 y una boleta el 14; ese
   *  dato está en la historia y no hay por qué volver a buscarlo. */
  dia: number;
};

/** Una categoría con sus proveedores. */
export type ResumenCategoria = {
  categoria_id: string;
  /** Cuántos movimientos se copiarían. */
  movimientos: number;
  /** En cuántos meses distintos aparece la categoría entera. */
  meses: number;
  /** Suma en CLP, en magnitud. */
  total: number;
  ramas: Rama[];
};

/** El valor que más se repite; con empate, el menor. Para el día de un pago eso
 *  es lo correcto: entre el 5 y el 14 con la misma frecuencia, el 5 llega antes y
 *  es el supuesto conservador para una proyección de caja. */
/** La identidad de una rama. Categoría y proveedor, porque el mismo proveedor
 *  puede aparecer en dos categorías y ser dos cosas distintas. */
const claveRama = (categoria_id: string, contraparte: string | null): string =>
  `${categoria_id}|${contraparte ?? ""}`;

function masRepetido(xs: number[]): number {
  const cuenta = new Map<number, number>();
  for (const x of xs) cuenta.set(x, (cuenta.get(x) ?? 0) + 1);
  let mejor = xs[0] ?? 1;
  for (const [x, n] of cuenta) {
    const actual = cuenta.get(mejor) ?? 0;
    if (n > actual || (n === actual && x < mejor)) mejor = x;
  }
  return mejor;
}

/**
 * Qué aportaría cada categoría, abierta por proveedor.
 *
 * Se cuenta por **movimiento** y no por línea: un split de sueldos con cuatro
 * cargos es un pago, no cuatro. Pero la categoría de un movimiento sale de sus
 * líneas, así que un split reparte el mismo movimiento entre varias — y cada una
 * lo cuenta, porque proyectarlo es traerlo entero.
 *
 * Los meses son los **del año destino**, no los de la ventana. Con un rango de
 * octubre a septiembre, "los primeros seis" tiene que querer decir enero a junio
 * del año que se está armando, no octubre a marzo.
 */
export function resumirPorCategoria(
  movimientos: Movimiento[],
  rango: { desde: string; hasta: string },
  seProyecta: (categoria_id: string, subcategoria_id: string | null) => boolean,
  tc: number
): ResumenCategoria[] {
  type Acumulado = { ids: Set<string>; meses: Set<number>; total: number; dias: number[] };
  const vacio = (): Acumulado => ({ ids: new Set(), meses: new Set(), total: 0, dias: [] });
  const porRama = new Map<string, Acumulado & { categoria_id: string; contraparte: string }>();

  for (const fila of expandir(movimientos)) {
    if (fila.fecha < rango.desde || fila.fecha > rango.hasta) continue;
    // El mismo filtro que `proyectar`, y tiene que serlo: si el resumen contara
    // movimientos que después no se copian, la vista previa estaría mintiendo.
    if (fila.estado === "proyectado") continue;
    if (!fila.categoria_id) continue;
    if (!seProyecta(fila.categoria_id, fila.subcategoria_id)) continue;

    const contraparte = fila.contraparte ?? "";
    const k = claveRama(fila.categoria_id, contraparte);
    const actual = porRama.get(k) ?? { ...vacio(), categoria_id: fila.categoria_id, contraparte };
    if (!actual.ids.has(fila.movimiento_id)) actual.dias.push(Number(fila.fecha.slice(8, 10)));
    actual.ids.add(fila.movimiento_id);
    actual.meses.add(Number(fila.fecha.slice(5, 7)));
    actual.total += enCLP(fila, tc);
    porRama.set(k, actual);
  }

  const porCategoria = new Map<string, Rama[]>();
  for (const r of porRama.values()) {
    const rama: Rama = {
      categoria_id: r.categoria_id,
      contraparte: r.contraparte,
      meses: [...r.meses].sort((a, b) => a - b),
      movimientos: r.ids.size,
      total: Math.abs(r.total),
      promedio: r.meses.size ? Math.round(Math.abs(r.total) / r.meses.size) : 0,
      dia: masRepetido(r.dias),
    };
    porCategoria.set(r.categoria_id, [...(porCategoria.get(r.categoria_id) ?? []), rama]);
  }

  return [...porCategoria.entries()]
    .map(([categoria_id, ramas]) => ({
      categoria_id,
      // El total y los meses de la categoría no son la suma de sus ramas cuando un
      // mismo mes lo tocan dos proveedores: por eso los meses se unen, no se suman.
      meses: new Set(ramas.flatMap((r) => r.meses)).size,
      movimientos: ramas.reduce((t, r) => t + r.movimientos, 0),
      total: ramas.reduce((t, r) => t + r.total, 0),
      ramas: ramas.sort((a, b) => b.total - a.total),
    }))
    .sort((a, b) => b.total - a.total);
}

// ── Escribir la proyección ──────────────────────────────────────────────────

/** Cada cuánto se repite un pago en el año. */
export type Cadencia = "mensual" | "bimestral" | "trimestral" | "cuatrimestral" | "semestral" | "anual";

/** Cada cuántos meses cae. */
export const PASO: Record<Cadencia, number> = {
  mensual: 1,
  bimestral: 2,
  trimestral: 3,
  cuatrimestral: 4,
  semestral: 6,
  anual: 12,
};

/** Una línea que alguien escribe: un pago que se repite. */
export type LineaRecurrente = {
  /** Local, para poder editarla y borrarla de la lista. No llega a la base. */
  id: string;
  contraparte: string;
  categoria_id: string;
  subcategoria_id: string | null;
  /** En magnitud. El signo lo pone la naturaleza de la categoría: un gasto sale
   *  negativo y un ingreso positivo, sin que nadie tenga que escribir el menos. */
  monto: number;
  dia: number;
  cada: Cadencia;
  /** Primer mes en que cae, 1 = enero. Un trimestral desde marzo cae en marzo,
   *  junio, septiembre y diciembre; desde enero, en enero, abril, julio y
   *  octubre. Sin esto, "trimestral" no dice cuál de las dos. */
  desde: number;
  empresa_id: string | null;
  cuenta_id: string | null;
  moneda: Moneda;
};

/**
 * Los meses en que cae una línea, dentro del año.
 *
 * Arranca en `desde` y avanza de a `PASO`, hasta diciembre. No da la vuelta: una
 * línea trimestral desde noviembre cae en noviembre y punto — el año que viene es
 * otro año y se proyecta aparte.
 */
export function mesesDeLinea(cada: Cadencia, desde: number): number[] {
  const paso = PASO[cada];
  const meses: number[] = [];
  for (let m = Math.min(Math.max(desde, 1), 12); m <= 12; m += paso) meses.push(m);
  return meses;
}

/**
 * El día que corresponde en un mes, sin salirse de él.
 *
 * "Día 31, mensual" es una instrucción razonable que en febrero no existe. Se
 * recorta al último día del mes en vez de generar una fecha inválida, que la base
 * rechazaría y se llevaría puesta la proyección entera.
 */
export function diaEnMes(anio: number, mes: number, dia: number): string {
  const ultimo = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const d = Math.min(Math.max(dia, 1), ultimo);
  return `${anio}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * Los movimientos de una línea escrita.
 *
 * El signo sale de la naturaleza de la categoría y no de lo que se escriba: en
 * una pantalla donde se cargan treinta líneas, un menos olvidado convierte un
 * gasto en ingreso y el flujo del año queda al revés sin que nada falle.
 */
export function expandirLinea(
  l: LineaRecurrente,
  anio: number,
  esIngreso: (categoria_id: string, subcategoria_id: string | null) => boolean
): MovimientoProyectado[] {
  const signo = esIngreso(l.categoria_id, l.subcategoria_id) ? 1 : -1;
  const monto = signo * Math.abs(Math.round(l.monto));
  if (monto === 0) return [];

  // En variables y no leídas de `l` adentro del map: así el estrechamiento del
  // chequeo sobrevive al cierre y la línea sin cuenta no llega a la base.
  const { empresa_id, cuenta_id } = l;
  if (!empresa_id || !cuenta_id) return [];

  return mesesDeLinea(l.cada, l.desde).map((mes) => ({
    fecha: diaEnMes(anio, mes, l.dia),
    empresa_id,
    cuenta_id,
    contraparte: l.contraparte.trim() || null,
    glosa: l.contraparte.trim() || null,
    monto,
    moneda: l.moneda,
    tipo_cambio: null,
    doc_tipo: null,
    lineas: [
      {
        categoria_id: l.categoria_id,
        subcategoria_id: l.subcategoria_id,
        doc_tipo: null,
        monto,
        glosa: null,
      },
    ],
  }));
}

/** Todas las líneas escritas, en un solo conjunto. */
export const expandirLineas = (
  lineas: LineaRecurrente[],
  anio: number,
  esIngreso: (categoria_id: string, subcategoria_id: string | null) => boolean
): MovimientoProyectado[] => lineas.flatMap((l) => expandirLinea(l, anio, esIngreso));

/**
 * Una línea escrita a partir de lo que la historia dice de un proveedor.
 *
 * La cadencia sale de en cuántos meses apareció: doce es mensual, cuatro
 * trimestral, uno anual. Es una propuesta para no volver a buscar el dato, no una
 * conclusión — queda editable, que es el punto de escribirlas.
 */
export function lineaDesdeRama(r: Rama, id: string, moneda: Moneda = "CLP"): LineaRecurrente {
  const n = r.meses.length;
  const cada: Cadencia =
    n >= 11 ? "mensual"
    : n >= 5 ? "bimestral"
    : n === 4 ? "trimestral"
    : n === 3 ? "cuatrimestral"
    : n === 2 ? "semestral"
    : "anual";
  return {
    id,
    contraparte: r.contraparte,
    categoria_id: r.categoria_id,
    subcategoria_id: null,
    monto: r.promedio,
    dia: r.dia,
    cada,
    desde: r.meses[0] ?? 1,
    empresa_id: null,
    cuenta_id: null,
    moneda,
  };
}

/** Marca de lo generado, para poder rehacerlo sin pisar lo escrito a mano. */
export const origenDe = (anio: number): string => `proyeccion-${anio}`;

/** Claves de reporte que aporta un conjunto de movimientos proyectados. Sirve
 *  para decir, antes de aplicar, a cuántas líneas del presupuesto van a llegar. */
export const clavesDe = (ms: MovimientoProyectado[]): Set<string> =>
  new Set(ms.flatMap((m) => m.lineas.map((l) => clave(l.categoria_id, l.subcategoria_id))));
