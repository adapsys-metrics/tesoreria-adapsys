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

/**
 * Lo que un proveedor aporta dentro de una categoría.
 *
 * El proveedor es el nivel en que esto se mira de verdad: "Telefonía e internet ·
 * 12 meses" no dice si son doce pagos a Entel o una mezcla de Entel y GTD, y sin
 * saberlo uno proyecta a ciegas.
 */
export type Rama = {
  categoria_id: string;
  /** Vacío cuando el movimiento no la tiene. */
  contraparte: string;
  /** Los meses del año destino en que aparece, ordenados. Su largo es "en cuántos
   *  meses": 12 es mensual, 4 trimestral, 1 una vez en el año. */
  meses: number[];
  movimientos: number;
  /** Suma en CLP, en magnitud. */
  total: number;
};

/** Una categoría con sus proveedores. */
export type ResumenCategoria = {
  categoria_id: string;
  /** Cuántos movimientos se copiarían. */
  movimientos: number;
  /** En cuántos meses distintos aparece la categoría entera. */
  meses: number;
  /** Suma en CLP, en magnitud. */
  total: number;
  ramas: Rama[];
};

/** La identidad de una rama. Categoría y proveedor, porque el mismo proveedor
 *  puede aparecer en dos categorías y ser dos cosas distintas. */
export const claveRama = (categoria_id: string, contraparte: string | null): string =>
  `${categoria_id}|${contraparte ?? ""}`;

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
 * Qué aportaría cada categoría, abierta por proveedor.
 *
 * Se cuenta por **movimiento** y no por línea: un split de sueldos con cuatro
 * cargos es un pago, no cuatro. Pero la categoría de un movimiento sale de sus
 * líneas, así que un split reparte el mismo movimiento entre varias — y cada una
 * lo cuenta, porque proyectarlo es traerlo entero.
 *
 * Los meses son los **del año destino**, no los de la ventana. Con un rango de
 * octubre a septiembre, "los primeros seis" tiene que querer decir enero a junio
 * del año que se está armando, no octubre a marzo.
 */
export function resumirPorCategoria(
  movimientos: Movimiento[],
  rango: { desde: string; hasta: string },
  seProyecta: (categoria_id: string, subcategoria_id: string | null) => boolean,
  tc: number
): ResumenCategoria[] {
  type Acumulado = { ids: Set<string>; meses: Set<number>; total: number };
  const vacio = (): Acumulado => ({ ids: new Set(), meses: new Set(), total: 0 });
  const porRama = new Map<string, Acumulado & { categoria_id: string; contraparte: string }>();

  for (const fila of expandir(movimientos)) {
    if (fila.fecha < rango.desde || fila.fecha > rango.hasta) continue;
    // El mismo filtro que `proyectar`, y tiene que serlo: si el resumen contara
    // movimientos que después no se copian, la vista previa estaría mintiendo.
    if (fila.estado === "proyectado") continue;
    if (!fila.categoria_id) continue;
    if (!seProyecta(fila.categoria_id, fila.subcategoria_id)) continue;

    const contraparte = fila.contraparte ?? "";
    const k = claveRama(fila.categoria_id, contraparte);
    const actual = porRama.get(k) ?? { ...vacio(), categoria_id: fila.categoria_id, contraparte };
    actual.ids.add(fila.movimiento_id);
    actual.meses.add(Number(fila.fecha.slice(5, 7)));
    actual.total += enCLP(fila, tc);
    porRama.set(k, actual);
  }

  const porCategoria = new Map<string, Rama[]>();
  for (const r of porRama.values()) {
    const rama: Rama = {
      categoria_id: r.categoria_id,
      contraparte: r.contraparte,
      meses: [...r.meses].sort((a, b) => a - b),
      movimientos: r.ids.size,
      total: Math.abs(r.total),
    };
    porCategoria.set(r.categoria_id, [...(porCategoria.get(r.categoria_id) ?? []), rama]);
  }

  return [...porCategoria.entries()]
    .map(([categoria_id, ramas]) => ({
      categoria_id,
      // El total y los meses de la categoría no son la suma de sus ramas cuando un
      // mismo mes lo tocan dos proveedores: por eso los meses se unen, no se suman.
      meses: new Set(ramas.flatMap((r) => r.meses)).size,
      movimientos: ramas.reduce((t, r) => t + r.movimientos, 0),
      total: ramas.reduce((t, r) => t + r.total, 0),
      ramas: ramas.sort((a, b) => b.total - a.total),
    }))
    .sort((a, b) => b.total - a.total);
}

/**
 * Los movimientos del año destino.
 *
 * La elección es **por rama y en meses**: de cada par categoría-proveedor se
 * proyectan sus primeros N meses. Doce es repetirlo todo el año; uno deja el pago
 * anual una sola vez; seis corta el contrato que termina a mitad de año. Cero, o
 * una rama ausente del mapa, no se proyecta.
 *
 * "Los primeros" se cuenta sobre los **meses del año destino**, no sobre el orden
 * de la ventana: con un rango de octubre a septiembre, los primeros seis tienen
 * que ser enero a junio del año que se arma.
 *
 * Un movimiento entra **entero** si alguna de sus ramas lo alcanza. Entero y no
 * recortado: un pago de tarjeta con dieciséis líneas es una transferencia, y
 * traer solo las líneas elegidas daría un movimiento cuyo monto no es el que va a
 * salir del banco.
 *
 * El reajuste se aplica **línea por línea y el monto se recalcula sumándolas**.
 * Al revés —escalar el monto y las líneas por separado— el redondeo las separa y
 * la base rechaza el movimiento por descuadre (§3).
 */
export function proyectar(
  movimientos: Movimiento[],
  rango: { desde: string; hasta: string },
  anioDestino: number,
  /** Por rama (`claveRama`), cuántos de sus meses proyectar. */
  eleccion: Map<string, number>,
  reajuste = 1
): MovimientoProyectado[] {
  // Los meses que cada rama deja pasar: sus primeros N, en orden del año destino.
  const permitidos = new Map<string, Set<number>>();
  const mesesDe = new Map<string, Set<number>>();

  const enRango = movimientos.filter(
    (m) => m.fecha >= rango.desde && m.fecha <= rango.hasta && m.estado !== "proyectado"
  );

  for (const m of enRango) {
    const mes = Number(mismaFechaEn(m.fecha, anioDestino).slice(5, 7));
    for (const cat of new Set(m.lineas.map((l) => l.categoria_id))) {
      const k = claveRama(cat, m.contraparte);
      mesesDe.set(k, (mesesDe.get(k) ?? new Set()).add(mes));
    }
  }

  for (const [k, meses] of mesesDe) {
    const cuantos = eleccion.get(k) ?? 0;
    permitidos.set(k, new Set([...meses].sort((a, b) => a - b).slice(0, cuantos)));
  }

  const salida: MovimientoProyectado[] = [];
  for (const m of enRango) {
    const fecha = mismaFechaEn(m.fecha, anioDestino);
    const mes = Number(fecha.slice(5, 7));
    const alcanzado = [...new Set(m.lineas.map((l) => l.categoria_id))].some((cat) =>
      permitidos.get(claveRama(cat, m.contraparte))?.has(mes)
    );
    // Sin líneas no hay rama que lo alcance: un movimiento sin clasificar no se
    // arrastra al año siguiente.
    if (!alcanzado) continue;

    const lineas = m.lineas.map((l) => ({
      categoria_id: l.categoria_id,
      subcategoria_id: l.subcategoria_id,
      doc_tipo: l.doc_tipo,
      monto: Math.round(l.monto * reajuste),
      glosa: l.glosa,
    }));

    salida.push({
      fecha,
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

/** La elección por defecto: cada rama proyecta todos los meses en que apareció. */
export const eleccionCompleta = (resumen: ResumenCategoria[]): Map<string, number> =>
  new Map(
    resumen.flatMap((c) =>
      c.ramas.map((r) => [claveRama(r.categoria_id, r.contraparte), r.meses.length] as const)
    )
  );

/** Marca de lo generado, para poder rehacerlo sin pisar lo escrito a mano. */
export const origenDe = (anio: number): string => `proyeccion-${anio}`;

/** Claves de reporte que aporta un conjunto de movimientos proyectados. Sirve
 *  para decir, antes de aplicar, a cuántas líneas del presupuesto van a llegar. */
export const clavesDe = (ms: MovimientoProyectado[]): Set<string> =>
  new Set(ms.flatMap((m) => m.lineas.map((l) => clave(l.categoria_id, l.subcategoria_id))));
