// Reglas de negocio — CLAUDE.md §4. Todo acá es TS puro y testeable: cuando se
// cablee Supabase estas funciones no cambian, solo cambia de dónde vienen los datos.

import type { Cuenta, Linea, LineaExpandida, Moneda, Movimiento, Tasas } from "@/lib/tipos";
import { pct } from "@/lib/formato";

/** Tasas por defecto. La retención BHE es 15,25% para 2026 según la escala de la
 *  Ley 21.133 — CLAUDE.md §9 pide verificarla con el SII y tenerla como parámetro
 *  con vigencia por año, no como constante. Estas son solo el arranque. */
export const TASAS: Tasas = { iva: 0.19, bhe: 0.1525 };

/** Categorías de impuestos a las que llegan las líneas de IVA y retención (§4.4). */
export const SUB_IVA_COMPRAS = "iva-compras";
export const SUB_RETENCION_BHE = "retencion-bhe";

export type ResultadoDocumento = { monto: number; lineas: Linea[] };

/**
 * Boleta de honorarios: se ingresa el BRUTO y la retención se resta, dando el
 * líquido que efectivamente se transfiere (§4.3).
 *
 * Con bruto negativo (un egreso) la retención sale positiva, así que el líquido a
 * pagar es MENOR que el bruto. Ejemplo real: bruto −1.253.118 + retención +191.100
 * = −1.062.018 transferidos.
 */
export const conRetencion = (
  bruto: number,
  categoriaBruto: string,
  tasa: number = TASAS.bhe
): ResultadoDocumento => {
  const retencion = Math.round(-bruto * tasa);
  return {
    monto: bruto + retencion,
    lineas: [
      { categoria_id: categoriaBruto, subcategoria_id: null, monto: bruto, glosa: "Bruto" },
      { categoria_id: SUB_RETENCION_BHE, subcategoria_id: null, monto: retencion,
        glosa: `Retención ${pct(tasa)}`,
      },
    ],
  };
};

/**
 * Factura afecta: se ingresa el NETO y el IVA se suma, dando el total del documento
 * (§4.3). Ejemplo real (GTD): neto −306.745 + IVA −58.281 = −365.026 transferidos.
 *
 * Ojo: 306.745 × 19% = 58.281,55 pero la factura dice 58.281. El documento manda
 * sobre la fórmula, así que el monto de cada línea siempre debe quedar editable.
 */
export const conIva = (
  neto: number,
  categoriaNeto: string,
  tasa: number = TASAS.iva
): ResultadoDocumento => {
  const iva = Math.round(neto * tasa);
  return {
    monto: neto + iva,
    lineas: [
      { categoria_id: categoriaNeto, subcategoria_id: null, monto: neto, glosa: "Neto" },
      { categoria_id: SUB_IVA_COMPRAS, subcategoria_id: null, monto: iva, glosa: `IVA ${pct(tasa)}` },
    ],
  };
};

/**
 * Expande movimientos a una fila por línea — el equivalente de la vista
 * v_lineas_expandidas. Toda agregación por categoría debe partir de acá y nunca
 * del movimiento, o los splits se cuentan mal (§3).
 *
 * Un movimiento sin líneas produce una fila con categoria_id null: es el caso
 * "sin clasificar", que hay que poder listar para reasignar.
 */
export const expandir = (movimientos: Movimiento[]): LineaExpandida[] =>
  movimientos.flatMap((m): LineaExpandida[] => {
    const comun = {
      movimiento_id: m.id,
      fecha: m.fecha,
      empresa_id: m.empresa_id,
      cuenta_id: m.cuenta_id,
      estado: m.estado,
      moneda: m.moneda,
      tipo_cambio: m.tipo_cambio,
      contraparte: m.contraparte,
    };
    if (!m.lineas.length) {
      return [
        {
          ...comun,
          categoria_id: null,
          monto: m.monto,
          glosa: m.glosa,
          indice_linea: null,
        },
      ];
    }
    return m.lineas.map((l, i) => ({
      ...comun,
      categoria_id: l.categoria_id,
      monto: l.monto,
      glosa: l.glosa ?? m.glosa,
      indice_linea: i,
    }));
  });

/**
 * Convierte a CLP para el flujo de caja y los movimientos.
 *
 * Usa el tipo de cambio del propio movimiento — el del día en que ocurrió — y solo
 * cae al parámetro si el movimiento no trae uno (§4.5: nunca convertir
 * destructivamente, un movimiento en USD conserva su TC y no se recalcula cuando el
 * dólar cambia).
 *
 * El presupuesto NO usa esta función: usa un TC fijo del año a propósito, para que la
 * desviación por gasto no se mezcle con la desviación por dólar (§4.6).
 */
export const enCLP = (
  m: { moneda: string; monto: number; tipo_cambio: number | null },
  tcPorDefecto: number
): number => (m.moneda === "USD" ? m.monto * (m.tipo_cambio ?? tcPorDefecto) : m.monto);

/** Suma de las líneas de un split. */
export const sumaLineas = (m: Movimiento): number =>
  m.lineas.reduce((a, l) => a + l.monto, 0);

/**
 * Diferencia entre el monto del movimiento y la suma de sus líneas. Debe ser 0
 * (§3); la UI avisa el descuadre en vez de corregirlo sola, porque el documento
 * manda y a veces el redondeo legítimo no cuadra al peso.
 */
export const descuadre = (m: Movimiento): number =>
  m.lineas.length ? m.monto - sumaLineas(m) : 0;

/** Un movimiento afecta el saldo bancario solo desde que está pagado (§4.1). */
export const afectaSaldo = (m: Movimiento): boolean => m.estado !== "proyectado";

/**
 * Cuenta principal de una empresa: la marcada como tal, o cualquier cuenta bancaria
 * suya si ninguna lo está. Es el default al registrar un movimiento nuevo.
 */
export const cuentaPrincipalDe = (
  cuentas: Cuenta[],
  empresa_id: string
): Cuenta | null =>
  cuentas.find((c) => c.empresa_id === empresa_id && c.tipo === "banco" && c.principal) ??
  cuentas.find((c) => c.empresa_id === empresa_id && c.tipo === "banco") ??
  null;

/**
 * Cuenta bancaria de una empresa en una moneda. Cada empresa tiene a lo más una por
 * moneda, así que el par (empresa, moneda) identifica una cuenta — es exactamente lo
 * que la persona sabe cuando registra un pago: "esto lo paga CLA ADAPTACIÓN, en pesos".
 *
 * Devuelve null si la empresa no opera en esa moneda (CLA CONSULTORIA solo tiene pesos).
 */
export const cuentaBancariaDe = (
  cuentas: Cuenta[],
  empresa_id: string,
  moneda: Moneda
): Cuenta | null =>
  cuentas.find(
    (c) => c.empresa_id === empresa_id && c.tipo === "banco" && c.moneda === moneda
  ) ?? null;

/** Cuentas bancarias de una empresa, para poblar un selector. */
export const cuentasBancariasDe = (cuentas: Cuenta[], empresa_id: string): Cuenta[] =>
  cuentas.filter((c) => c.empresa_id === empresa_id && c.tipo === "banco");
