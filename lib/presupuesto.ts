// Control presupuestario anual (§4.6).
//
// Réplica de la planilla que hoy se arma a mano, con una diferencia: el "real" no
// se copia de un export, se calcula de los movimientos. Es todo el punto — que el
// presupuesto vs. real exista en vez de armarse.
//
// ── Por qué el presupuesto se guarda repartido en doce y no como un total ──
//
// Las dos secciones de la planilla real NO se prorratean igual, y los números lo
// demuestran. A julio (7/12 del año):
//
//   Desarrollo organizacional   500.000 × 7/12 = 291.667   y muestra 291.667  ✓
//   Gastos administración   194.025.719 × 7/12 = 113.181.669  pero muestra 122.056.670  ✗
//
// La inversión sí es un monto anual dividido en doce. Lo operativo no: sale de
// movimientos con fecha, así que su "presupuesto a la fecha" es lo planificado
// HASTA esa fecha. Los sueldos de diciembre no pesan en marzo, y los retiros de
// socios de marzo no se reparten en doce.
//
// Guardar los doce meses en vez de un total resuelve las dos de la misma forma, y
// de paso cierra el pendiente de CLAUDE.md §10 sobre la distribución mensual: la
// inversión se reparte pareja, lo operativo por las fechas de sus proyecciones, y
// cualquiera de los doce se puede corregir a mano.

import { expandir } from "@/lib/dominio";
import type { LineaPresupuesto, Movimiento, Naturaleza } from "@/lib/tipos";

/** Los doce meses del año, índice 0 = enero. */
export type Meses = number[];

export type FilaPresupuesto = LineaPresupuesto & {
  subcategoria_id: string;
  meses: Meses;
  /** Suma de los doce. Es lo comprometido para el año. */
  anual: number;
  /** Suma de enero al mes elegido. */
  ytd: number;
  /** Lo efectivamente ocurrido hasta el último día de ese mes. */
  real: number;
  /** real − ytd. Positivo en un gasto significa que se gastó de más. */
  variacion: number;
  /** Proporción del presupuesto anual ya ejecutada. null si no hay presupuesto:
   *  gastar sobre cero no es 0% ni infinito, es una línea sin presupuestar. */
  avance: number | null;
};

export const MESES_DEL_ANIO = 12;

const vacios = (): Meses => Array<number>(MESES_DEL_ANIO).fill(0);

/** Último día del mes, como texto ISO. Se arma con aritmética de strings y no con
 *  `Date` porque son fechas de calendario (§ lib/fechas). */
export function finDeMes(anio: number, mes: number): string {
  const dias = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const bisiesto = (anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0;
  const ultimo = mes === 2 && bisiesto ? 29 : dias[mes - 1]!;
  return `${anio}-${String(mes).padStart(2, "0")}-${String(ultimo).padStart(2, "0")}`;
}

/**
 * ¿Este movimiento entra al control presupuestario?
 *
 * El presupuesto es uno solo para las cuatro empresas del grupo Adapsys (§4.6).
 * SANTA MARÍA es una sociedad relacionada: comparte el sistema pero no el
 * presupuesto, así que sus gastos no pueden sumar acá — inflarían el ejecutado de
 * líneas que las cuatro no gastaron.
 *
 * Lo que no tiene empresa sí entra: son las proyecciones que todavía no saben por
 * qué sociedad se gestionan, y pertenecen al consolidado justamente por eso.
 */
export const entraAlPresupuesto = (
  m: { empresa_id: string | null },
  empresas: readonly string[]
): boolean => m.empresa_id === null || empresas.includes(m.empresa_id);

/** Mes de una fecha ISO, 1 a 12. */
const mesDe = (fecha: string) => Number(fecha.slice(5, 7));

/**
 * Reparte un monto anual en doce partes que suman exactamente el anual.
 *
 * En pesos enteros, y el resto de la división se reparte de a un peso entre los
 * primeros meses en vez de acumularse en diciembre. Dividir y ya daría
 * 41.666,666… doce veces, cuya suma es 500.000,00000000006: el anual dejaría de
 * ser el número que se escribió.
 *
 * Contra la planilla puede haber hasta doce pesos de diferencia en el acumulado,
 * porque ahí el YTD se calcula como anual × mes / 12 sin pasar por los meses.
 */
export function distribuirLineal(anual: number): Meses {
  const total = Math.round(Math.abs(anual));
  const base = Math.floor(total / MESES_DEL_ANIO);
  const resto = total - base * MESES_DEL_ANIO;
  return Array.from({ length: MESES_DEL_ANIO }, (_, i) => base + (i < resto ? 1 : 0));
}

/** Suma de enero al mes indicado. */
export const ytdDe = (meses: Meses, mes: number): number =>
  meses.slice(0, mes).reduce((s, m) => s + m, 0);

export const anualDe = (meses: Meses): number => meses.reduce((s, m) => s + m, 0);

/**
 * Ejecutado por subcategoría hasta el final del mes indicado.
 *
 * Se cuenta sobre las LÍNEAS y no sobre los movimientos (§3): un split reparte su
 * monto entre varias subcategorías, y sumar por movimiento le adjudicaría el total
 * a una sola. Los proyectados no entran: el real es lo que ocurrió.
 *
 * En magnitud, sin signo, como se muestran los montos del presupuesto (§4.6).
 */
export function ejecutadoPorSubcategoria(
  movimientos: Movimiento[],
  anio: number,
  mes: number
): Map<string, number> {
  const desde = `${anio}-01-01`;
  const hasta = finDeMes(anio, mes);
  const total = new Map<string, number>();

  for (const fila of expandir(movimientos)) {
    if (fila.estado === "proyectado") continue;
    if (fila.fecha < desde || fila.fecha > hasta) continue;
    if (!fila.subcategoria_id) continue;
    total.set(
      fila.subcategoria_id,
      (total.get(fila.subcategoria_id) ?? 0) + Math.abs(fila.monto)
    );
  }
  return total;
}

/**
 * Presupuesto operativo a partir de los movimientos del año, repartido por el mes
 * de cada uno.
 *
 * Suma lo proyectado Y lo ya ocurrido, porque el presupuesto es lo planificado
 * para el año completo y a mitad de año parte ya pasó. Sumar solo lo proyectado
 * daría un presupuesto que encoge con cada pago.
 *
 * Es una foto: se genera al armar el año y después se edita a mano. Si se
 * recalculara en vivo, reprogramar un pago a diciembre bajaría el presupuesto de
 * marzo y nunca se vería un sobregasto.
 */
export function distribucionOperativa(
  movimientos: Movimiento[],
  anio: number,
  esOperativa: (subcategoria_id: string) => boolean
): Map<string, Meses> {
  const desde = `${anio}-01-01`;
  const hasta = `${anio}-12-31`;
  const porSub = new Map<string, Meses>();

  for (const fila of expandir(movimientos)) {
    if (fila.fecha < desde || fila.fecha > hasta) continue;
    if (!fila.subcategoria_id || !esOperativa(fila.subcategoria_id)) continue;
    const meses = porSub.get(fila.subcategoria_id) ?? vacios();
    const i = mesDe(fila.fecha) - 1;
    meses[i] = (meses[i] ?? 0) + Math.abs(fila.monto);
    porSub.set(fila.subcategoria_id, meses);
  }
  return porSub;
}

/**
 * Cambia el anual de una línea conservando su forma mensual.
 *
 * Importa en lo operativo: si "Sueldos" tiene un aguinaldo en diciembre, subirle
 * el presupuesto un 5% no debe aplanar diciembre contra el resto. Cuando la línea
 * no tiene forma —todos los meses en cero— se reparte pareja, que es lo único
 * razonable sin más información.
 */
export function reescalar(meses: Meses, nuevoAnual: number): Meses {
  const actual = anualDe(meses);
  if (actual === 0) return distribuirLineal(nuevoAnual);

  const factor = Math.abs(nuevoAnual) / actual;
  const escalados = meses.map((m) => Math.round(m * factor));
  // El redondeo de cada mes desvía el total; la diferencia se corrige en el mes
  // que más pesa, que es donde menos se nota.
  const desvio = Math.round(Math.abs(nuevoAnual)) - anualDe(escalados);
  if (desvio !== 0) {
    const mayor = escalados.indexOf(Math.max(...escalados));
    escalados[mayor] = (escalados[mayor] ?? 0) + desvio;
  }
  return escalados;
}

/** Arma la fila de una subcategoría con sus columnas calculadas. */
export function filaDe(
  subcategoria_id: string,
  linea: LineaPresupuesto,
  meses: Meses,
  ejecutado: number,
  mes: number
): FilaPresupuesto {
  const anual = anualDe(meses);
  const ytd = ytdDe(meses, mes);
  return {
    ...linea,
    subcategoria_id,
    meses,
    anual,
    ytd,
    real: ejecutado,
    variacion: ejecutado - ytd,
    avance: anual === 0 ? null : ejecutado / anual,
  };
}

/**
 * ¿Va sobre ritmo?
 *
 * Se compara contra lo presupuestado a la fecha y no contra el avance del
 * calendario: con distribución mensual, "el 67% del año" ya no dice nada — una
 * línea que se paga entera en marzo debe estar al 100% en marzo.
 */
export const sobreRitmo = (fila: FilaPresupuesto): boolean =>
  fila.ytd > 0 && fila.real > fila.ytd;

/**
 * ¿Ya se gastó todo lo del año?
 *
 * Es distinto de ir sobre ritmo y por eso se marca aparte. Sobre ritmo dice "vas
 * más rápido de lo previsto para esta altura", que puede corregirse solo. Agotado
 * dice "no queda presupuesto para lo que resta del año", y a partir de ahí
 * cualquier gasto nuevo es sobregasto — que es justo lo que hay que ver venir.
 */
export const presupuestoAgotado = (fila: FilaPresupuesto): boolean =>
  fila.avance !== null && fila.avance >= 1;

/** Suma de un conjunto de filas, para los subtotales por categoría y sección. */
export function totalizar(filas: FilaPresupuesto[]): {
  anual: number;
  ytd: number;
  real: number;
  variacion: number;
  avance: number | null;
} {
  const anual = filas.reduce((s, f) => s + f.anual, 0);
  const ytd = filas.reduce((s, f) => s + f.ytd, 0);
  const real = filas.reduce((s, f) => s + f.real, 0);
  return {
    anual,
    ytd,
    real,
    variacion: real - ytd,
    avance: anual === 0 ? null : real / anual,
  };
}

/** Naturalezas que van al presupuesto, en el orden en que se muestran. Los
 *  ingresos quedan fuera: la venta se controla en neto y los movimientos guardan
 *  lo que entró al banco, con IVA en las facturas afectas. Mostrar una venta que
 *  no calza con la del comité sería peor que no mostrar ninguna. */
export const SECCIONES: { naturaleza: Naturaleza; titulo: string }[] = [
  { naturaleza: "inversion", titulo: "Gastos de Inversión" },
  { naturaleza: "operativo", titulo: "Gastos Operativos" },
];
