// Datos de ejemplo portados de tesoreria.jsx. Reproducen movimientos reales del
// Quicken actual, incluidos los splits de GTD y las boletas de honorarios con
// retención, para que las vistas se puedan evaluar con cifras de verdad.
//
// TEMPORAL: desaparece cuando se cablee Supabase. La capa de dominio (lib/dominio.ts)
// no depende de este archivo.
//
// Es 100% determinista: la "aleatoriedad" es un hash de la semilla, así que el mismo
// código produce siempre los mismos montos y los tests no parpadean.

import { CUENTAS } from "@/lib/catalogo";
import { conIva, conRetencion, cuentaBancariaDe } from "@/lib/dominio";
import { ANIO, MESES_CORTOS, fecha } from "@/lib/fechas";
import type { Linea, Movimiento } from "@/lib/tipos";

/** TC de referencia para los movimientos en dólares de ejemplo. */
export const TC_USD = 970;

/** Alias cortos → id real de categoría. Solo para escribir estos datos sin
 *  repetir slugs largos; no es parte del modelo. */
const ALIAS: Record<string, string> = {
  sueldos: "sueldos",
  honor: "horas",
  sistop: "arriendo-oficina",
  comis: "comisiones-bancarias",
  contab: "asesoria-contable",
  tarjeta: "tarjeta-de-credito",
  licencias: "sistemas-operaciones-y-finanzas",
  analitica: "sistemas-analitica-avanzada-ia-y-r",
  cdir: "costos-directos-consultoria",
  viajes: "gastos-de-representacion",
  mkt: "marketing-digital",
  iva: "iva-mensual",
  finiq: "finiquitos",
  retiros: "retiros-socios",
  capacit: "capacitacion-del-personal",
  estudios: "estudios-publicos",
  eventos: "eventos-propios",
  plataforma: "gastos-sistemas-digitales",
  alianzas: "alianzas-estudios-y-relacionamient",
  otring: "otros-ingresos",
  desorg1: "direccion-ejecutiva",
  recluta: "servicios-externos-rr-hh",
  infra: "equipos-computacionales",
  // Los "clientes" son categorías bajo A INGRESOS CLIENTES (§5).
  cobranza: "bhp-billiton",
  cobranza2: "consalud",
  cobranza3: "codelco",
};

const sub = (id: string): string => ALIAS[id] ?? id;

/** Hash determinista en [0,1) a partir de una semilla entera. */
const hash = (semilla: number): number => {
  const x = Math.sin(semilla) * 10000;
  return x - Math.floor(x);
};

type Plantilla = {
  sub: string;
  empresa: string;
  dia: number;
  base: number;
  v: number;
  contraparte: string;
  glosa: string;
  /** Solo estos meses; si falta, los 12. */
  meses?: number[];
};

/** Movimientos que caen todos los meses en fechas fijas (sueldos el 25, IVA el 30,
 *  honorarios el 20). CLAUDE.md §10 los tiene pendientes como reglas de
 *  recurrencia; acá solo siembran el histórico. */
const RECURRENTES: Plantilla[] = [
  { sub: "sueldos", empresa: "adap", dia: 25, base: -10428100, v: 0.03, contraparte: "Sueldos", glosa: "Sueldos CLA Adaptación" },
  { sub: "sueldos", empresa: "clting", dia: 25, base: -400000, v: 0.02, contraparte: "Sueldos", glosa: "Sueldos CLA Consulting" },
  { sub: "honor", empresa: "adap", dia: 20, base: -1815955, v: 0.22, contraparte: "Honorarios equipo", glosa: "Boletas honorarios" },
  { sub: "honor", empresa: "cons", dia: 27, base: -2966250, v: 0.14, contraparte: "Carolina Yachan", glosa: "Servicio directora ejecutiva" },
  { sub: "sistop", empresa: "adap", dia: 20, base: -3408866, v: 0.11, contraparte: "Arriendo y sistemas", glosa: "Oficina, servicios" },
  { sub: "comis", empresa: "adap", dia: 26, base: -50000, v: 0.3, contraparte: "Banco Santander", glosa: "Comisiones" },
  { sub: "contab", empresa: "cons", dia: 27, base: -1200000, v: 0, contraparte: "Luis Palomino", glosa: "Servicio contabilidad" },
  { sub: "tarjeta", empresa: "adap", dia: 20, base: -411367, v: 0.38, contraparte: "Mastercard Pesos 7184", glosa: "Estado de cuenta" },
  { sub: "licencias", empresa: "adap", dia: 20, base: -680000, v: 0.15, contraparte: "Buk, Entel, otros", glosa: "Licencias y suscripciones" },
  { sub: "analitica", empresa: "adap", dia: 18, base: -820000, v: 0.3, contraparte: "Anthropic / Cloud", glosa: "Analítica avanzada e IA" },
  { sub: "cdir", empresa: "cons", dia: 15, base: -4200000, v: 0.33, contraparte: "Proveedores consultoría", glosa: "Costos directos proyectos" },
  { sub: "viajes", empresa: "cons", dia: 12, base: -380000, v: 0.5, contraparte: "Traslados y hotelería", glosa: "Viajes terreno" },
  { sub: "mkt", empresa: "cons", dia: 25, base: -424830, v: 0.4, contraparte: "Marketing Digital", glosa: "Convenio comunicaciones" },
  { sub: "iva", empresa: "adap", dia: 30, base: -6800000, v: 0.2, contraparte: "Tesorería General", glosa: "IVA y PPM" },
  { sub: "cobranza", empresa: "adap", dia: 5, base: 38000000, v: 0.18, contraparte: "BHP Chile", glosa: "Programa ALT" },
  { sub: "cobranza2", empresa: "cons", dia: 15, base: 14000000, v: 0.28, contraparte: "Consalud", glosa: "Adopción IA" },
  { sub: "cobranza3", empresa: "clting", dia: 10, base: 3200000, v: 0.4, contraparte: "Clientes varios", glosa: "Facturación" },
  { sub: "cdir", empresa: "ctria", dia: 18, base: -640000, v: 0.45, contraparte: "Proveedores", glosa: "Costos consultoría" },
  { sub: "cobranza", empresa: "ctria", dia: 20, base: 1800000, v: 0.35, contraparte: "Clientes varios", glosa: "Facturación" },
  { sub: "retiros", empresa: "adap", dia: 20, base: -20000000, v: 0, meses: [3, 6, 8], contraparte: "Socios", glosa: "Retiros socios" },
  { sub: "capacit", empresa: "adap", dia: 14, base: -650000, v: 0.6, meses: [3, 5, 7], contraparte: "Capacitaciones", glosa: "Formación equipo" },
  { sub: "estudios", empresa: "cons", dia: 22, base: -1400000, v: 0.3, meses: [4, 7], contraparte: "Estudio público", glosa: "Estudio de mercado" },
];

let secuencia = 0;

type Extra = Partial<Omit<Movimiento, "id">>;

const crear = (
  fechaMov: string,
  empresa_id: string,
  contraparte: string,
  glosa: string,
  categoria: string,
  monto: number,
  extra: Extra = {}
): Movimiento => {
  // La moneda se decide primero porque de ella sale la cuenta, no al revés.
  const moneda = extra.moneda ?? "CLP";
  const cuenta = cuentaBancariaDe(CUENTAS, empresa_id, moneda);
  if (!cuenta) {
    // Falla al cargar el módulo, no en runtime: si alguien agrega un movimiento en
    // una moneda en la que la empresa no opera, se entera acá y no con un flujo mal
    // sumado. La base lo rechazaría igual por la foreign key compuesta.
    throw new Error(
      `Datos de ejemplo inconsistentes: ${empresa_id} no tiene cuenta bancaria en ${moneda} (${contraparte} · ${glosa})`
    );
  }
  const base: Movimiento = {
    id: "m" + ++secuencia,
    fecha: fechaMov,
    empresa_id,
    cuenta_id: cuenta.id,
    contraparte,
    glosa,
    documento: null,
    monto,
    moneda,
    tipo_cambio: null,
    estado: extra.estado ?? "proyectado",
    doc_tipo: null,
    hito: null,
    lineas: [{ categoria_id: sub(categoria), subcategoria_id: null, monto, glosa: null }],
  };
  return { ...base, ...extra };
};

/** Un movimiento repartido en varias categorías. */
const split = (...pares: [string, number, string][]): { lineas: Linea[] } => ({
  lineas: pares.map(([s, monto, glosa]) => ({
    categoria_id: sub(s),
    subcategoria_id: null,
    monto,
    glosa,
  })),
});

/** Enero a agosto, ya conciliado. */
/** Marca un movimiento como denominado en dólares. El monto va posicional, para que
 *  la línea implícita quede con el mismo valor y no se genere un descuadre.
 *  En el prototipo estos venían con tc: 0, que caía al TC del estado; acá el TC queda
 *  explícito porque el esquema lo exige para todo movimiento en USD. */
const usd = (): Extra => ({ moneda: "USD", tipo_cambio: TC_USD });

const HISTORICO: Movimiento[] = (() => {
  const out: Movimiento[] = [];
  RECURRENTES.forEach((r, ri) => {
    for (let m = 1; m <= 8; m++) {
      if (r.meses && !r.meses.includes(m)) continue;
      // Corte contra HOY (20 de agosto): lo del 20 en adelante todavía no pasó.
      if (m === 8 && r.dia >= 20) continue;
      const monto =
        Math.round((r.base * (1 + (hash(ri * 31 + m * 7) - 0.5) * 2 * r.v)) / 1000) * 1000;
      out.push(
        crear(
          fecha(ANIO, m, Math.min(r.dia, 28)),
          r.empresa,
          r.contraparte,
          `${r.glosa} ${String(m).padStart(2, "0")}-${ANIO}`,
          r.sub,
          monto,
          { estado: "conciliado" }
        )
      );
    }
  });

  // El estado de cuenta de la tarjeta en dólares, con el que se pagan casi todas
  // las suscripciones. Está acá porque es el caso que rompe cualquier suma que
  // ignore la moneda: sin convertir, estos US$233 entran como 233 pesos.
  for (let m = 1; m <= 7; m++) {
    out.push(
      crear(
        fecha(ANIO, m, 16),
        "adap",
        "Mastercard dólar 7184",
        `TARJETA ESTADO CUENTA DOLAR ${String(m).padStart(2, "0")}-${ANIO}`,
        "sistemas-analitica-avanzada-ia-y-r",
        -233,
        {
          estado: "conciliado",
          ...usd(),
          lineas: [
            { categoria_id: "sistemas-analitica-avanzada-ia-y-r", subcategoria_id: null, monto: -67.5, glosa: "Mailchimp" },
            { categoria_id: "sistemas-analitica-avanzada-ia-y-r", subcategoria_id: null, monto: -23.75, glosa: "Chat GPT" },
            { categoria_id: "sistemas-analitica-avanzada-ia-y-r", subcategoria_id: null, monto: -23.75, glosa: "Microsoft Power BI" },
            { categoria_id: "sistemas-analitica-avanzada-ia-y-r", subcategoria_id: null, monto: -12.5, glosa: "Trello" },
            { categoria_id: "sistemas-analitica-avanzada-ia-y-r", subcategoria_id: null, monto: -100, glosa: "Siteground" },
            { categoria_id: "sistemas-analitica-avanzada-ia-y-r", subcategoria_id: null, monto: -5.5, glosa: "Zapier" },
          ],
        }
      )
    );
  }
  return out;
})();

/** Agosto 2026 a enero 2027, proyectado. Incluye los casos difíciles: splits de
 *  tarjeta, facturas afectas, boletas con retención y movimientos en dólares. */
const PROYECTADO: Movimiento[] = [
  crear(fecha(ANIO, 8, 20), "adap", "Buk", "FA334125 Plataforma personas 2,6UF más IVA", "licencias", 0, {
    ...conIva(-109244, sub("licencias")),
    doc_tipo: "afecta",
  }),
  // El caso real de CLAUDE.md §4.3: el IVA de la factura dice 58.281, no 58.281,55.
  crear(fecha(ANIO, 8, 14), "adap", "GTD", "FA3109609 Internet oficina", "telefonia-e-internet", -365026, {
    doc_tipo: "afecta",
    lineas: [
      { categoria_id: "telefonia-e-internet", subcategoria_id: null, monto: -306745, glosa: "Neto" },
      { categoria_id: "iva-compras", subcategoria_id: null, monto: -58281, glosa: "IVA 19%" },
    ],
  }),
  crear(fecha(ANIO, 8, 14), "adap", "Empresa Social de Ca...", "FA174272 Agua Purificada oficina", "gastos-comunes", 0, {
    ...conIva(-40921, sub("gastos-comunes")),
    doc_tipo: "afecta",
  }),
  crear(fecha(ANIO, 8, 20), "adap", "ENTEL", "FA54068286 Plan celulares", "licencias", -78866),
  crear(fecha(ANIO, 8, 20), "adap", "Mastercard Pesos 7184", "TARJETA ESTADO CUENTA PESOS", "tarjeta", -411367,
    split(
      ["gastos-sistemas-digitales", -96400, "Anthropic Claude"],
      ["gastos-sistemas-digitales", -49900, "Google Workspace"],
      ["insumos-oficina", -60000, "Librería Nacional"],
      ["gastos-de-representacion", -132967, "Almuerzos cliente"],
      ["caja-chica", -72100, "Uber corporativo"]
    )),
  crear(fecha(ANIO, 8, 20), "adap", "Juan Carlos Eichholz", "Retiros socios", "retiros", -20000000),
  crear(fecha(ANIO, 8, 20), "adap", "Juan Ignacio Court", "B113 Honorarios 07-2026", "honor", 0, {
    ...conRetencion(-418251, sub("honor")),
    doc_tipo: "honorario",
  }),
  // El otro caso real de §4.3: bruto −1.253.118 + retención +191.100 = −1.062.018.
  crear(fecha(ANIO, 8, 20), "adap", "Magdalena Toral", "B405 Honorarios 07-2026", "honor", 0, {
    ...conRetencion(-1253118, sub("honor")),
    doc_tipo: "honorario",
  }),
  crear(fecha(ANIO, 8, 20), "adap", "Oscar Clark", "B10 Honorarios 07-2026", "honor", 0, {
    ...conRetencion(-471350, sub("honor")),
    doc_tipo: "honorario",
  }),
  crear(fecha(ANIO, 8, 20), "cons", "Valle Alto SpA", "FA109 Utilidades IA Consalud — Adopción etapa I", "cdir", -5276448),
  crear(fecha(ANIO, 8, 20), "cons", "Alexandra Montenegro", "B1060679 Traslados BHP Jornada ALT", "viajes", -74645),
  crear(fecha(ANIO, 8, 20), "adap", "Hotel Antofagasta SpA", "FA90602 Hotel BHP — Taller ALT Escondida", "viajes", -202300),
  crear(fecha(ANIO, 8, 20), "cons", "Caja Mágica", "FAXX Lápices Adapsys", "mkt", -424830),
  crear(fecha(ANIO, 8, 25), "adap", "Sueldos", "Sueldos CLA Adaptación", "sueldos", -10428100),
  crear(fecha(ANIO, 8, 25), "cons", "Comunicación y Marketing Digital", "SALDO 50% FA3419 Convenio 2025-2026 Web", "mkt", -148750),
  crear(fecha(ANIO, 8, 25), "adap", "Andrés Gebauer", "Indemnización demanda", "finiq", -30000000),
  crear(fecha(ANIO, 8, 26), "adap", "Banco Santander", "Comisión transferencia de fondos", "comis", -50000),
  crear(fecha(ANIO, 8, 27), "cons", "Luis Palomino", "BXX Servicio contabilidad", "contab", -1200000),
  crear(fecha(ANIO, 8, 27), "cons", "Carolina Yachan", "Servicio directora ejecutiva Adapsys", "honor", 0, {
    ...conRetencion(-3500000, sub("desorg1")),
    doc_tipo: "honorario",
  }),
  crear(fecha(ANIO, 8, 28), "clting", "Sueldos", "Sueldos CLA Consulting", "sueldos", -400000),
  crear(fecha(ANIO, 8, 31), "adap", "Tesorería General", "IVA agosto 2026", "iva", -8400000),
  crear(fecha(ANIO, 9, 3), "adap", "BHP Chile", "FA1204 Programa ALT — cuota 3", "cobranza", 42500000),
  crear(fecha(ANIO, 9, 5), "cons", "Consalud", "FA109 Adopción IA etapa I", "cobranza2", 18900000),
  crear(fecha(ANIO, 9, 10), "adap", "Arriendo oficina", "Canon septiembre", "sistop", -3200000),
  crear(fecha(ANIO, 9, 12), "adap", "Desarrollo plataforma", "Sprint 3 portal clientes", "plataforma", -2400000),
  crear(fecha(ANIO, 9, 15), "cons", "Codelco", "FA1188 Diagnóstico cultural", "cobranza3", 12784, usd()),
  crear(fecha(ANIO, 9, 25), "adap", "Sueldos", "Sueldos CLA Adaptación", "sueldos", -10428100),
  crear(fecha(ANIO, 9, 25), "clting", "Sueldos", "Sueldos CLA Consulting", "sueldos", -400000),
  crear(fecha(ANIO, 9, 30), "adap", "Tesorería General", "IVA septiembre 2026", "iva", -6100000),
  crear(fecha(ANIO, 10, 8), "adap", "BHP Chile", "FA1210 Programa ALT — cuota 4", "cobranza", 42500000),
  crear(fecha(ANIO, 10, 15), "adap", "Evento anual", "Encuentro clientes 2026", "eventos", -1000000),
  crear(fecha(ANIO, 10, 20), "sm", "Contribuciones", "Contribuciones Santa María Q4", "sistop", -1850000),
  crear(fecha(ANIO, 10, 25), "adap", "Sueldos", "Sueldos CLA Adaptación", "sueldos", -10428100),
  crear(fecha(ANIO, 10, 25), "clting", "Sueldos", "Sueldos CLA Consulting", "sueldos", -400000),
  crear(fecha(ANIO, 10, 30), "adap", "Tesorería General", "IVA octubre 2026", "iva", -7200000),
  crear(fecha(ANIO, 11, 15), "cons", "Consalud", "FA112 Adopción IA etapa II", "cobranza2", 16400000),
  crear(fecha(ANIO, 11, 25), "adap", "Sueldos", "Sueldos CLA Adaptación", "sueldos", -10428100),
  crear(fecha(ANIO, 12, 20), "adap", "Socios", "Retiros socios diciembre", "retiros", -20000000),
  crear(fecha(ANIO, 12, 25), "adap", "Sueldos", "Sueldos + aguinaldo", "sueldos", -14600000),
  ...[8, 9, 10, 11, 12].map((m) =>
    crear(
      fecha(ANIO, m, 18), "adap", "Mastercard dólar 7184",
      `TARJETA ESTADO CUENTA DOLAR ${String(m).padStart(2, "0")}-${ANIO}`,
      "tarjeta", m === 8 ? -1112.85 : -829.94, usd()
    )
  ),
  ...[8, 9, 10, 11, 12].map((m) =>
    crear(
      fecha(ANIO, m, 26), "cons", "Irina Cayo",
      `BXX Sueldo ${MESES_CORTOS[m - 1]} ${ANIO}`,
      "sueldos", -200, usd()
    )
  ),
  // El horizonte pasa del año calendario a propósito (§4.7).
  crear(fecha(ANIO + 1, 1, 18), "adap", "Mastercard dólar 7184", "TARJETA ESTADO CUENTA DOLAR 01-2027", "tarjeta", -829.94, usd()),
  crear(fecha(ANIO + 1, 1, 26), "cons", "Irina Cayo", "BXX Sueldo enero 2027", "sueldos", -200, usd()),

  // ── Cartera: plata por entrar que todavía no pasó por el banco ──
  //
  // Los proyectos aprobados son estimaciones con fecha que se mueve; las facturas
  // por cobrar ya tienen documento emitido. Van en registros distintos porque son
  // grados de certeza distintos, y se avanzan de uno al otro (lib/cobranza.ts).
  crear(fecha(ANIO, 9, 19), "adap", "BANCO ITAÚ", "FA? Coaching Adriano Fernández", "cobranza", 4568898, { cuenta_id: "x3" }),
  crear(fecha(ANIO, 9, 25), "clting", "GOLD FIELDS", "FA? Offsite Salares Norte", "cobranza2", 13949721, { cuenta_id: "x3" }),
  crear(fecha(ANIO, 10, 21), "cons", "DUOC UC", "FA? Movilizando la transformación", "cobranza", 71599605, { cuenta_id: "x3" }),
  crear(fecha(ANIO, 8, 22), "cons", "CONSALUD", "FA273 Propuesta Adopción de IA — Etapa II", "cobranza2", 71449791, { cuenta_id: "x1" }),
  crear(fecha(ANIO, 9, 6), "clting", "BHP", "FA204 Jornada Regional Technology Program", "cobranza", 5003679, { cuenta_id: "x1" }),
  crear(fecha(ANIO, 9, 3), "cons", "STATKRAFT", "FA274 Actividades julio 2026", "cobranza2", 11876, { cuenta_id: "x2", ...usd() }),
];

export const MOVIMIENTOS_EJEMPLO: Movimiento[] = [...HISTORICO, ...PROYECTADO];
