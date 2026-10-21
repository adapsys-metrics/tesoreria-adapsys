// Proyectar un año copiando los movimientos de otro.
//
// El presupuesto operativo del año que viene no se escribe: **sale de sumar los
// movimientos proyectados**. Y esos movimientos se generan copiando los del año
// anterior — el pago de Entel de cada mes, el de GTD, el split de sueldos— al
// mismo mes y día del año destino.
//
// Es distinto de lo que CLAUDE.md §10 descartó. Ahí se rechazó modelar
// **reglas** por proveedor ("GTD, día 14, mensual") y mantenerlas: un proveedor
// cambia, es ocasional, o tiene un pago único. Acá no hay reglas — hay una copia
// de la historia real, que después se edita movimiento por movimiento.
//
// Lo que sí hereda de ese párrafo es la advertencia del doble conteo, y se
// resuelve por construcción: si el presupuesto sale de los proyectados en vez de
// convivir con ellos, no hay dos fuentes que sumar.

import { enCLP, expandir } from "@/lib/dominio";
import { clave } from "@/lib/catalogo-indices";
import type { DocTipo, Moneda, Movimiento } from "@/lib/tipos";

/** Lo que se va a crear. Sin `id`: los asigna la base. */
export type MovimientoProyectado = {
  fecha: string;
  empresa_id: string | null;
  cuenta_id: string | null;
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

/** Lo que una categoría aportaría, para poder elegir antes de generar. */
export type ResumenCategoria = {
  categoria_id: string;
  /** Cuántos movimientos se copiarían. */
  movimientos: number;
  /** En cuántos meses distintos aparece. 12 es mensual; 1, una vez en el año. Es
   *  el dato que distingue un gasto recurrente de uno ocasional sin adivinar. */
  meses: number;
  /** Suma en CLP, en magnitud. */
  total: number;
};

/**
 * La misma fecha, un año destino.
 *
 * Mes y día se conservan: un pago del 14 sigue siendo del 14. El 29 de febrero se
 * corre al 28 cuando el destino no es bisiesto — es la única fecha que no existe
 * todos los años, y dejarla pasar generaría un movimiento con fecha inválida que
 * la base rechaza entera.
 */
export function mismaFechaEn(fecha: string, anio: number): string {
  const mes = fecha.slice(5, 7);
  const dia = fecha.slice(8, 10);
  if (mes === "02" && dia === "29") {
    const bisiesto = (anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0;
    return `${anio}-02-${bisiesto ? "29" : "28"}`;
  }
  return `${anio}-${mes}-${dia}`;
}

/**
 * Qué aportaría cada categoría, para elegir cuáles proyectar.
 *
 * Se cuenta por **movimiento** y no por línea: un split de sueldos con cuatro
 * cargos es un pago, no cuatro. Pero la categoría de un movimiento sale de sus
 * líneas, así que un split reparte el mismo movimiento entre varias — y entonces
 * cada una lo cuenta, porque proyectarlo es traerlo entero.
 */
export function resumirPorCategoria(
  movimientos: Movimiento[],
  rango: { desde: string; hasta: string },
  seProyecta: (categoria_id: string, subcategoria_id: string | null) => boolean,
  tc: number
): ResumenCategoria[] {
  const porCategoria = new Map<string, { ids: Set<string>; meses: Set<string>; total: number }>();

  for (const fila of expandir(movimientos)) {
    if (fila.fecha < rango.desde || fila.fecha > rango.hasta) continue;
    // El mismo filtro que `proyectar`, y tiene que serlo: si el resumen contara
    // movimientos que después no se copian, la vista previa estaría mintiendo.
    if (fila.estado === "proyectado") continue;
    if (!fila.categoria_id) continue;
    if (!seProyecta(fila.categoria_id, fila.subcategoria_id)) continue;

    const actual = porCategoria.get(fila.categoria_id) ?? {
      ids: new Set<string>(),
      meses: new Set<string>(),
      total: 0,
    };
    actual.ids.add(fila.movimiento_id);
    actual.meses.add(fila.fecha.slice(0, 7));
    actual.total += enCLP(fila, tc);
    porCategoria.set(fila.categoria_id, actual);
  }

  return [...porCategoria.entries()]
    .map(([categoria_id, x]) => ({
      categoria_id,
      movimientos: x.ids.size,
      meses: x.meses.size,
      total: Math.abs(x.total),
    }))
    .sort((a, b) => b.total - a.total);
}

/**
 * Los movimientos del año destino.
 *
 * Un movimiento entra entero si **alguna de sus líneas** cae en una categoría
 * elegida. Entero y no recortado: un pago de tarjeta con dieciséis líneas es una
 * transferencia, y traer solo las líneas elegidas daría un movimiento cuyo monto
 * no es el que va a salir del banco.
 *
 * El reajuste se aplica **línea por línea y el monto se recalcula sumándolas**.
 * Al revés —escalar el monto y las líneas por separado— el redondeo las separa y
 * la base rechaza el movimiento por descuadre (§3).
 */
export function proyectar(
  movimientos: Movimiento[],
  rango: { desde: string; hasta: string },
  anioDestino: number,
  /** Categorías elegidas en la vista previa. */
  elegidas: Set<string>,
  reajuste = 1
): MovimientoProyectado[] {
  const salida: MovimientoProyectado[] = [];

  for (const m of movimientos) {
    if (m.fecha < rango.desde || m.fecha > rango.hasta) continue;
    // Lo ya proyectado no se re-proyecta: sería arrastrar al año siguiente algo
    // que todavía no ocurrió en éste.
    if (m.estado === "proyectado") continue;

    // Sin líneas no hay categoría que elegir, así que no se proyecta: un
    // movimiento sin clasificar no se arrastra al año siguiente.
    if (!m.lineas.some((l) => elegidas.has(l.categoria_id))) continue;

    const lineas = m.lineas.map((l) => ({
      categoria_id: l.categoria_id,
      subcategoria_id: l.subcategoria_id,
      doc_tipo: l.doc_tipo,
      monto: Math.round(l.monto * reajuste),
      glosa: l.glosa,
    }));

    salida.push({
      fecha: mismaFechaEn(m.fecha, anioDestino),
      empresa_id: m.empresa_id,
      // La cuenta se conserva: un proyectado en una cuenta del banco es lo que
      // alimenta el registro de egresos proyectados, y no afecta el saldo.
      cuenta_id: m.cuenta_id,
      contraparte: m.contraparte,
      glosa: m.glosa,
      // De las líneas y no escalando el monto original: así la suma cuadra exacto
      // y la base no lo rechaza.
      monto: lineas.reduce((t, l) => t + l.monto, 0),
      moneda: m.moneda,
      tipo_cambio: m.tipo_cambio,
      doc_tipo: m.doc_tipo,
      lineas,
    });
  }

  return salida;
}

/** Marca de lo generado, para poder rehacerlo sin pisar lo escrito a mano. */
export const origenDe = (anio: number): string => `proyeccion-${anio}`;

/** Claves de reporte que aporta un conjunto de movimientos proyectados. Sirve
 *  para decir, antes de aplicar, a cuántas líneas del presupuesto van a llegar. */
export const clavesDe = (ms: MovimientoProyectado[]): Set<string> =>
  new Set(ms.flatMap((m) => m.lineas.map((l) => clave(l.categoria_id, l.subcategoria_id))));
