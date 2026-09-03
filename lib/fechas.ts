// Fechas de calendario como strings YYYY-MM-DD.
//
// El prototipo usaba objetos Date construidos en hora local y los serializaba con
// toISOString() (que es UTC): en zonas con offset positivo eso corre la fecha un día
// para atrás. Vercel corre en UTC y el navegador del usuario en la zona que sea, así
// que acá toda la aritmética es sobre strings, con Date solo en UTC internamente.
// Resultado: mismo output en servidor y cliente, en cualquier zona.

import { supabaseConfigurado } from "@/lib/supabase/estado";

export const ANIO = 2026;

export const MESES_CORTOS = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

/**
 * Hoy, en la zona horaria de Chile.
 *
 * La zona se fija a propósito en vez de usar la del sistema. Vercel corre en UTC y
 * el navegador en la zona de quien mire: entre las 21:00 y la medianoche en Chile
 * ya es el día siguiente en UTC, así que servidor y cliente responderían distinto
 * y React marcaría el desajuste al hidratar. Además el negocio es chileno: el día
 * que importa es el de acá.
 *
 * Sin Supabase configurado —los tests, o un preview sin variables— queda fija en
 * la fecha alrededor de la cual se construyeron los datos de ejemplo, para que los
 * tests sean deterministas.
 */
const HOY_DE_EJEMPLO = "2026-08-20";

const hoyEnChile = (): string =>
  // "en-CA" da YYYY-MM-DD, que es el formato con el que se compara en toda la app.
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

export const HOY = supabaseConfigurado ? hoyEnChile() : HOY_DE_EJEMPLO;

const pad = (n: number) => String(n).padStart(2, "0");

/** Parsea YYYY-MM-DD a un Date en UTC, sin corrimiento de zona. */
const aFecha = (s: string): Date => new Date(`${s}T00:00:00Z`);

/** Serializa un Date (interpretado en UTC) a YYYY-MM-DD. */
const aIso = (d: Date): string => d.toISOString().slice(0, 10);

export const anioDe = (s: string): number => Number(s.slice(0, 4));
/** Mes 1-12. */
export const mesDe = (s: string): number => Number(s.slice(5, 7));
export const diaDe = (s: string): number => Number(s.slice(8, 10));

export const fecha = (anio: number, mes: number, dia: number): string =>
  `${anio}-${pad(mes)}-${pad(dia)}`;

export const sumarDias = (s: string, n: number): string => {
  const d = aFecha(s);
  d.setUTCDate(d.getUTCDate() + n);
  return aIso(d);
};

/** Lunes de la semana ISO que contiene a la fecha. */
export const lunesDe = (s: string): string => {
  const d = aFecha(s);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return aIso(d);
};

export const inicioDeMes = (anio: number, mes: number): string => fecha(anio, mes, 1);

/** Último día del mes (mes 1-12). Día 0 del mes siguiente. */
export const finDeMes = (anio: number, mes: number): string =>
  aIso(new Date(Date.UTC(anio, mes, 0)));

/** Etiqueta corta de un día: "20 ago". */
export const etiquetaDia = (s: string): string =>
  `${diaDe(s)} ${MESES_CORTOS[mesDe(s) - 1]}`;

/** Etiqueta de un mes: "ago 26". */
export const etiquetaMes = (s: string): string =>
  `${MESES_CORTOS[mesDe(s) - 1]} ${String(anioDe(s)).slice(2)}`;

/** Fecha para mostrar en pantalla: DD-MM-YY (CLAUDE.md §8). */
export const fechaCorta = (s: string): string =>
  `${pad(diaDe(s))}-${pad(mesDe(s))}-${String(anioDe(s)).slice(2)}`;

/** Fracción del año transcurrida a HOY. Es la referencia de "avance del año" con la
 *  que el presupuesto compara el % utilizado (§4.6), no el mes en curso. */
export const PCT_ANIO = (() => {
  const ini = Date.UTC(ANIO, 0, 1);
  const fin = Date.UTC(ANIO + 1, 0, 1);
  return (aFecha(HOY).getTime() - ini) / (fin - ini);
})();

export type Rango = { id: string; nombre: string; calc: () => [string, string] };

/** Presets de rango, compartidos por Flujo y Reportes. El horizonte pasa del año
 *  calendario a propósito: hay movimientos proyectados a enero 2027 (§4.7). */
export const RANGOS: Rango[] = [
  { id: "ytd", nombre: "Año en curso", calc: () => [`${ANIO}-01-01`, HOY] },
  { id: "anio", nombre: "Año completo", calc: () => [`${ANIO}-01-01`, `${ANIO}-12-31`] },
  {
    id: "mes",
    nombre: "Mes actual",
    calc: () => [inicioDeMes(ANIO, mesDe(HOY)), finDeMes(ANIO, mesDe(HOY))],
  },
  {
    id: "trim",
    nombre: "Trimestre actual",
    calc: () => {
      const t = Math.floor((mesDe(HOY) - 1) / 3);
      return [inicioDeMes(ANIO, t * 3 + 1), finDeMes(ANIO, t * 3 + 3)];
    },
  },
  {
    id: "u12",
    nombre: "Últimos 12 meses",
    calc: () => [fecha(ANIO - 1, mesDe(HOY), diaDe(HOY)), HOY],
  },
  { id: "fut", nombre: "De hoy en adelante", calc: () => [HOY, `${ANIO}-12-31`] },
  {
    id: "p12",
    nombre: "Próximos 12 meses",
    calc: () => [HOY, fecha(ANIO + 1, mesDe(HOY), diaDe(HOY))],
  },
];
