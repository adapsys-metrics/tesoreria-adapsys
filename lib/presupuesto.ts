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

import { enCLP, expandir } from "@/lib/dominio";
import { clave } from "@/lib/catalogo-indices";
import type { LineaPresupuesto, Movimiento, Naturaleza } from "@/lib/tipos";

/** Los doce meses del año, índice 0 = enero. */
export type Meses = number[];

export type FilaPresupuesto = LineaPresupuesto & {
  categoria_id: string;
  /** Null cuando la fila es la categoría en sí: lo que se clasifica en ella sin
   *  precisar subcategoría, el "(Other)" de Quicken (§3). */
  subcategoria_id: string | null;
  /** `categoria` o `categoria>subcategoria`. Es por lo que se busca el ejecutado. */
  clave: string;
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
 * Ejecutado por clave de reporte hasta el final del mes indicado.
 *
 * Se cuenta sobre las LÍNEAS y no sobre los movimientos (§3): un split reparte su
 * monto entre varias categorías, y sumar por movimiento le adjudicaría el total
 * a una sola. Los proyectados no entran: el real es lo que ocurrió.
 *
 * Los movimientos en dólares se convierten con el TC del año (§4.6). Sin convertir,
 * un cargo de US$68 entraría al presupuesto como 68 pesos: el gasto en suscripciones
 * —que se pagan casi todas con la tarjeta en dólares— desaparecía.
 *
 * Se suma con signo y la magnitud se toma al final (§4.6): una nota de crédito debe
 * bajar el gasto de la línea, no subirlo. Tomando magnitud línea por línea, devolver
 * plata gastaba más.
 */
export function ejecutadoPorClave(
  movimientos: Movimiento[],
  anio: number,
  mes: number,
  tc: number
): Map<string, number> {
  const desde = `${anio}-01-01`;
  const hasta = finDeMes(anio, mes);
  const total = new Map<string, number>();

  for (const fila of expandir(movimientos)) {
    if (fila.estado === "proyectado") continue;
    if (fila.fecha < desde || fila.fecha > hasta) continue;
    if (!fila.categoria_id) continue;
    // Por clave de reporte y no por categoría (§4.2): si la línea precisa
    // subcategoría, su gasto tiene que ir contra el presupuesto de esa
    // subcategoría y no contra el de la categoría, o la categoría aparecería
    // gastando lo de sus hijas además de lo propio.
    const k = clave(fila.categoria_id, fila.subcategoria_id);
    total.set(k, (total.get(k) ?? 0) + enCLP(fila, tc));
  }
  for (const [k, monto] of total) total.set(k, Math.abs(monto));
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
 *
 * Convierte los dólares igual que el ejecutado: si el presupuesto se generara sin
 * convertir y el gasto se midiera convertido, toda línea pagada en dólares
 * arrancaría el año con un sobregasto de mil por uno.
 */
export function distribucionOperativa(
  movimientos: Movimiento[],
  anio: number,
  esOperativa: (categoria_id: string, subcategoria_id: string | null) => boolean,
  tc: number
): Map<string, Meses> {
  const desde = `${anio}-01-01`;
  const hasta = `${anio}-12-31`;
  const porSub = new Map<string, Meses>();

  for (const fila of expandir(movimientos)) {
    if (fila.fecha < desde || fila.fecha > hasta) continue;
    if (!fila.categoria_id || !esOperativa(fila.categoria_id, fila.subcategoria_id)) continue;
    // Por clave y no por categoría, para que lo que se genera caiga en las mismas
    // líneas contra las que después se compara.
    const k = clave(fila.categoria_id, fila.subcategoria_id);
    const meses = porSub.get(k) ?? vacios();
    const i = mesDe(fila.fecha) - 1;
    meses[i] = (meses[i] ?? 0) + enCLP(fila, tc);
    porSub.set(k, meses);
  }
  // La magnitud se toma por mes, ya con las devoluciones descontadas.
  for (const [sub, meses] of porSub) porSub.set(sub, meses.map(Math.abs));
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

/**
 * Reparte un total entre un tramo de meses, conservando su forma.
 *
 * Es la misma cuenta que hace `reescalar` sobre los doce, y vive aparte porque un
 * ajuste de mitad de año toca solo la cola. No están unificadas todavía a
 * propósito: `reescalar` está probada y en uso, y tocarla sin poder correr los
 * tests sería cambiar algo que funciona a ciegas.
 */
function repartirTramo(tramo: number[], total: number): number[] {
  if (tramo.length === 0) return [];

  const actual = tramo.reduce((s, m) => s + m, 0);
  if (actual === 0) {
    // Sin forma previa no hay nada que conservar: parejo es lo único razonable.
    const base = Math.floor(total / tramo.length);
    const resto = total - base * tramo.length;
    return tramo.map((_, i) => base + (i < resto ? 1 : 0));
  }

  const factor = total / actual;
  const escalados = tramo.map((m) => Math.round(m * factor));
  // El redondeo de cada mes desvía el total; la diferencia se corrige en el mes
  // que más pesa, que es donde menos se nota.
  const desvio = total - escalados.reduce((s, m) => s + m, 0);
  if (desvio !== 0) {
    const mayor = escalados.indexOf(Math.max(...escalados));
    escalados[mayor] = (escalados[mayor] ?? 0) + desvio;
  }
  return escalados;
}

/** El resultado de intentar ajustar: o los doce meses nuevos, o por qué no se puede. */
export type Ajuste =
  | { ok: true; meses: Meses; repartido: number; desde: number }
  | { ok: false; minimo: number; desde: number };

/**
 * Ajusta el anual de una línea moviendo solo los meses que quedan.
 *
 * **Ajustar lo que queda del año no es cambiar el número anual.** Los meses que ya
 * pasaron se quedan como estaban: son el plan contra el que se midió el gasto de
 * esos meses, y reescribirlos haría que el % utilizado de marzo cambie en octubre.
 * Lo que se mueve es el cupo de `desde` en adelante.
 *
 * La forma del tramo se conserva, igual que en `reescalar` y por lo mismo: si
 * "Sueldos" tiene un aguinaldo en diciembre, bajar el anual no debe aplanarlo
 * contra noviembre.
 *
 * **Puede no haber nada que repartir, y eso no es un error a tapar.** Si el nuevo
 * anual queda por debajo de lo ya presupuestado hasta `desde`, no hay reparto
 * posible sin reescribir el pasado o poner meses en negativo, que no significa
 * nada. Se devuelve el mínimo alcanzable para poder decirlo, y quien de verdad
 * quiera bajar más tiene que editar los meses a mano y dejarlo dicho en el motivo.
 *
 * @param desde Primer mes que puede moverse, 1 = enero.
 */
export function ajustarDesde(meses: Meses, nuevoAnual: number, desde: number): Ajuste {
  const corte = Math.min(Math.max(desde, 1), MESES_DEL_ANIO);
  const congelado = ytdDe(meses, corte - 1);
  const objetivo = Math.round(Math.abs(nuevoAnual));
  const disponible = objetivo - congelado;

  if (disponible < 0) return { ok: false, minimo: congelado, desde: corte };

  const cola = repartirTramo(meses.slice(corte - 1), disponible);
  const nuevos = [...meses.slice(0, corte - 1), ...cola] as Meses;
  return { ok: true, meses: nuevos, repartido: disponible, desde: corte };
}

/** Arma la fila de una categoría con sus columnas calculadas. */
export function filaDe(
  categoria_id: string,
  subcategoria_id: string | null,
  linea: LineaPresupuesto,
  meses: Meses,
  ejecutado: number,
  mes: number
): FilaPresupuesto {
  const anual = anualDe(meses);
  const ytd = ytdDe(meses, mes);
  return {
    ...linea,
    categoria_id,
    subcategoria_id,
    clave: clave(categoria_id, subcategoria_id),
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

/** Suma de un conjunto de filas, para los subtotales por grupo y sección. */
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
