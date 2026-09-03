// Movimientos vencidos: fecha pasada y todavía proyectados.
//
// Es la lista que se mira todos los días, y no hay que confundirla con "por
// conciliar", que cuenta otra cosa:
//
//   vencido       fecha pasada y sigue proyectado. O ya ocurrió y falta
//                 registrarlo, o hay que mover la fecha. Requiere una decisión.
//   por conciliar estado `pagado`: pasó por el banco pero nadie lo cuadró contra
//                 la cartola. Requiere verificar, no decidir.
//
// En Quicken esto se ve como un cambio de tono en las filas del registro de
// proyecciones, y es de ahí que sale la necesidad.

import type { Movimiento } from "@/lib/tipos";

/** Un compromiso o una cobranza que se pasó de fecha sin ocurrir. */
export const estaVencido = (m: Movimiento, hoy: string): boolean =>
  m.estado === "proyectado" && m.fecha < hoy;

/** Días de atraso. Se cuenta sobre las fechas como texto ISO y no con `Date`
 *  porque son fechas de calendario: pasar por Date las interpreta en la zona del
 *  servidor y en Vercel, que corre en UTC, corre un día los del principio del mes. */
export function diasDeAtraso(fecha: string, hoy: string): number {
  const aDias = (iso: string) => {
    const [a, m, d] = iso.split("-").map(Number);
    return Math.floor(Date.UTC(a!, m! - 1, d!) / 86_400_000);
  };
  return aDias(hoy) - aDias(fecha);
}

export const contarVencidos = (movimientos: Movimiento[], hoy: string): number =>
  movimientos.reduce((n, m) => (estaVencido(m, hoy) ? n + 1 : n), 0);

/** Total comprometido que ya debería haber ocurrido. En CLP; los de otras monedas
 *  no se convierten (§4.5), así que se suman aparte donde haga falta. */
export const totalVencido = (movimientos: Movimiento[], hoy: string): number =>
  movimientos.reduce(
    (t, m) => (estaVencido(m, hoy) && m.moneda === "CLP" ? t + m.monto : t),
    0
  );
