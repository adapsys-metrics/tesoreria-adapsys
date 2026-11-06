// Formato de montos — CLAUDE.md §8: punto de miles, coma decimal (es-CL).
// Se instancia un solo formateador y se reusa: además de ser más rápido, fija el
// comportamiento y evita diferencias de formato entre el render del servidor y el
// del cliente (que se verían como un error de hidratación).

import type { Moneda } from "@/lib/tipos";

const ENTERO = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 });

// El dólar lleva centavos y el peso no. No es preferencia de formato: la cartola
// en dólares los trae —el saldo de CLA CONSULTORES DÓLAR es 4.746,01, no 4.746—
// y es contra esa cartola que se cuadra. Redondeando a entero queda una
// diferencia de hasta un dólar por movimiento que no se puede explicar, y el
// saldo de la columna deja de ser la suma de lo que está arriba. En pesos no hay
// centavos que mostrar.
const DOLAR = new Intl.NumberFormat("es-CL", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Monto con signo. Usa el menos tipográfico (−, U+2212), no el guión. */
export const clp = (n: number): string =>
  (n < 0 ? "−" : "") + ENTERO.format(Math.round(Math.abs(n)));

/** Magnitud sin signo. Es como se muestran los montos en el presupuesto (§4.6). */
export const mag = (n: number): string => ENTERO.format(Math.round(Math.abs(n)));

/** Monto en dólares, siempre con los dos decimales. Los dos y no "los que
 *  tenga": en una columna de cifras, 4.746 y 4.746,01 no caen alineados y dejan
 *  de poder compararse de un vistazo (§8). */
export const usd = (n: number): string => (n < 0 ? "−" : "") + DOLAR.format(Math.abs(n));

/** El número solo, en la forma de su moneda. Para las columnas que ponen el
 *  símbolo aparte. */
export const montoEn = (n: number, moneda: Moneda): string =>
  moneda === "USD" ? usd(n) : clp(n);

/** El monto como se escribe en su moneda, con símbolo. */
export const conMoneda = (n: number, moneda: Moneda): string =>
  (moneda === "USD" ? "US$" : "$") + montoEn(n, moneda);

/** Abreviado para encabezados y celdas angostas: 1,2M / 340k / — */
export const clpK = (n: number): string => {
  const a = Math.abs(n);
  const s = n < 0 ? "−" : "";
  if (a >= 1e6) return s + (a / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(".", ",") + "M";
  if (a >= 1e3) return s + Math.round(a / 1e3) + "k";
  return a === 0 ? "—" : s + Math.round(a);
};

/** Tasa como porcentaje legible: 0.19 → "19%", 0.1525 → "15,25%" */
export const pct = (t: number): string =>
  (t * 100).toFixed(2).replace(/[.,]?0+$/, "").replace(".", ",") + "%";
