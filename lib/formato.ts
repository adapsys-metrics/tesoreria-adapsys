// Formato de montos — CLAUDE.md §8: punto de miles, coma decimal (es-CL).
// Se instancia un solo formateador y se reusa: además de ser más rápido, fija el
// comportamiento y evita diferencias de formato entre el render del servidor y el
// del cliente (que se verían como un error de hidratación).

const ENTERO = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 });

/** Monto con signo. Usa el menos tipográfico (−, U+2212), no el guión. */
export const clp = (n: number): string =>
  (n < 0 ? "−" : "") + ENTERO.format(Math.round(Math.abs(n)));

/** Magnitud sin signo. Es como se muestran los montos en el presupuesto (§4.6). */
export const mag = (n: number): string => ENTERO.format(Math.round(Math.abs(n)));

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
