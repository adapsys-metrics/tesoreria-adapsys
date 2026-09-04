// Lectura de los exports de Quicken (CLAUDE.md §11).
//
// Dos cosas de este formato obligan a escribirlo con cuidado, y las dos se
// descubrieron mirando los 15 archivos reales:
//
// 1. Las cabeceras NO son iguales entre registros. `c2` intercambia Payee y
//    Check #, `e1`/`e2` no traen Action, los espejos de proyección no traen
//    Balance, y los de cobranza agregan Tags. Un parser posicional cargaría el
//    proveedor en el campo de la empresa sin fallar. Por eso todo se lee por
//    nombre de columna.
//
// 2. Hay comillas con comas y saltos de línea adentro (memos de tarjeta,
//    facturas de LinkedIn), así que partir por "\n" y por "," no sirve.

/** Una fila del CSV, ya mapeada por nombre de columna. */
export type FilaQuicken = {
  esSplit: boolean;
  fecha: string; // ISO, YYYY-MM-DD
  tags: string;
  action: string;
  documento: string;
  contraparte: string;
  memo: string;
  grupo: string;
  monto: number;
  saldo: number | null;
};

export type ArchivoQuicken = {
  titulo: string;
  /** El "Filter Criteria" del encabezado. Si trae una búsqueda activa el export
   *  está incompleto: es exactamente lo que pasó con la primera versión de a1. */
  filtro: string;
  columnas: string[];
  filas: FilaQuicken[];
  /** Totales que Quicken imprime al pie. Son la referencia contra la cual se
   *  valida la importación (§11: "validar que los saldos calzan"). */
  totales: { entradas: number; salidas: number; neto: number } | null;
};

/** Un movimiento reconstruido: cabecera + sus líneas de split (§4.3). */
export type MovimientoQuicken = {
  fecha: string;
  contraparte: string;
  documento: string;
  /** Empresa según Tags → Action. null cuando ninguna la nombra: en los
   *  registros de banco la pone la cuenta, y en proyección existe una sola
   *  fila "bolsa" que todavía no tiene empresa asignada. */
  empresa: string | null;
  monto: number;
  lineas: { grupo: string; monto: number; glosa: string }[];
};

/** CSV completo: comillas, comillas escapadas y saltos de línea dentro del campo. */
export function parsearCSV(texto: string): string[][] {
  const filas: string[][] = [];
  let campo = "";
  let fila: string[] = [];
  let enComillas = false;

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (enComillas) {
      if (c === '"') {
        if (texto[i + 1] === '"') {
          campo += '"';
          i++;
        } else enComillas = false;
      } else campo += c;
    } else if (c === '"') enComillas = true;
    else if (c === ",") {
      fila.push(campo);
      campo = "";
    } else if (c === "\n") {
      fila.push(campo);
      filas.push(fila);
      fila = [];
      campo = "";
    } else if (c !== "\r") campo += c;
  }
  if (campo !== "" || fila.length) {
    fila.push(campo);
    filas.push(fila);
  }
  return filas;
}

/** "-306.745,00" → -306745. Formato es-CL: punto de miles, coma decimal. */
export function parsearMonto(texto: string): number {
  const limpio = texto.trim().replace(/\./g, "").replace(",", ".");
  if (limpio === "" || limpio === "-") return 0;
  const n = Number(limpio);
  if (Number.isNaN(n)) throw new Error(`monto ilegible: ${JSON.stringify(texto)}`);
  return n;
}

/** "14-08-2026" → "2026-08-14". Aritmética sobre strings, sin Date: `new Date`
 *  interpretaría la fecha en la zona del servidor y en Vercel (UTC) correría un
 *  día los movimientos de la mañana. */
export function parsearFecha(texto: string): string | null {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(texto.trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

const NORMALIZAR = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();

/** Los nombres de empresa vienen escritos de varias formas — con tilde y sin
 *  tilde en el mismo archivo — así que se comparan normalizados. */
const EMPRESAS: Record<string, string> = {
  "CLA ADAPTACION": "adap",
  "CLA CONSULTORES": "cons",
  "CLA CONSULTING": "clting",
  "CLA CONSULTORIA": "ctria",
  "SANTA MARIA": "sm",
};

export function empresaDe(texto: string): string | null {
  return EMPRESAS[NORMALIZAR(texto)] ?? null;
}

export function leerArchivo(texto: string): ArchivoQuicken {
  const filas = parsearCSV(texto.replace(/^﻿/, ""));

  const iCab = filas.findIndex((f) => f.includes("Date") && f.includes("Amount"));
  if (iCab < 0) throw new Error("no se encontró la cabecera (falta Date o Amount)");
  const columnas = filas[iCab]!;

  const encabezado = filas.slice(0, iCab).map((f) => f.join(" ")).join(" ");
  const filtro = /Filter Criteria:\s*(.*?)\s*$/.exec(encabezado)?.[1] ?? "";

  const idx = (nombre: string) => columnas.indexOf(nombre);
  const iFecha = idx("Date");
  const campo = (f: string[], nombre: string) => {
    const j = idx(nombre);
    return j < 0 ? "" : (f[j] ?? "").trim();
  };

  const cuerpo = filas.slice(iCab + 1);
  const parseadas: FilaQuicken[] = [];
  for (const f of cuerpo) {
    const fecha = parsearFecha(f[iFecha] ?? "");
    if (!fecha) continue; // pie de totales y filas en blanco
    const saldoTxt = campo(f, "Balance");
    parseadas.push({
      esSplit: campo(f, "Split") === "S",
      fecha,
      tags: campo(f, "Tags"),
      action: campo(f, "Action"),
      documento: campo(f, "Check #"),
      contraparte: campo(f, "Payee"),
      memo: campo(f, "Memo/Notes"),
      grupo: campo(f, "Category"),
      monto: parsearMonto(campo(f, "Amount")),
      saldo: saldoTxt === "" ? null : parsearMonto(saldoTxt),
    });
  }

  const texto1 = cuerpo.map((f) => f.join(" ")).join("\n");
  // Ojo: el pie NO usa el mismo formato que las filas. Las filas vienen en es-CL
  // ("-306.745,00") y el pie con punto decimal y sin separador de miles
  // ("75339969.00"). Pasarle parsearMonto al pie multiplica por 100.
  const buscar = (etiqueta: string) => {
    const m = new RegExp(`${etiqueta}:\\s*(-?\\d+(?:\\.\\d+)?)`).exec(texto1);
    return m ? Number(m[1]) : null;
  };
  const entradas = buscar("Total Inflows");
  const salidas = buscar("Total Outflows");
  const neto = buscar("Net Total");
  const totales =
    entradas !== null && salidas !== null && neto !== null
      ? { entradas, salidas, neto }
      : null;

  return { titulo: encabezado.trim(), filtro, columnas, filas: parseadas, totales };
}

/** Agrupa las filas en movimientos.
 *
 *  Un split son filas consecutivas marcadas "S" que comparten fecha, contraparte
 *  y documento. En los registros de banco el saldo se repite en todas las líneas
 *  del grupo y cambia entre movimientos, así que también sirve de separador — es
 *  lo que distingue dos cargos idénticos del mismo día, que existen de verdad
 *  (§4.7, deduplicación).
 *
 *  Una fila sin marca de split es un movimiento de una línea (§3). */
export function agruparMovimientos(filas: FilaQuicken[]): MovimientoQuicken[] {
  const movimientos: MovimientoQuicken[] = [];
  let grupo: FilaQuicken[] = [];

  const mismaLlave = (a: FilaQuicken, b: FilaQuicken) =>
    a.fecha === b.fecha &&
    a.contraparte === b.contraparte &&
    a.documento === b.documento &&
    a.saldo === b.saldo;

  const cerrar = () => {
    if (!grupo.length) return;
    const primera = grupo[0]!;
    movimientos.push({
      fecha: primera.fecha,
      contraparte: primera.contraparte,
      documento: primera.documento,
      empresa: empresaDe(primera.tags) ?? empresaDe(primera.action),
      monto: grupo.reduce((s, f) => s + f.monto, 0),
      lineas: grupo.map((f) => ({ grupo: f.grupo, monto: f.monto, glosa: f.memo })),
    });
    grupo = [];
  };

  for (const fila of filas) {
    if (!fila.esSplit) {
      cerrar();
      grupo = [fila];
      cerrar();
      continue;
    }
    if (grupo.length && !mismaLlave(grupo[0]!, fila)) cerrar();
    grupo.push(fila);
  }
  cerrar();

  return movimientos;
}
