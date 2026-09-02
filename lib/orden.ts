// Ordenamiento de la tabla de movimientos.
//
// Vive aparte del componente porque tiene tres decisiones que no son obvias y
// conviene poder probarlas: cómo se ordena el estado, qué pasa con los campos
// vacíos, y con qué se desempata.

import { enCLP } from "@/lib/dominio";
import type { EstadoMovimiento, Movimiento } from "@/lib/tipos";

export type ColumnaOrden =
  | "fecha"
  | "cuenta"
  | "contraparte"
  | "glosa"
  | "subcategoria"
  | "monto"
  | "estado";

export type Orden = { columna: ColumnaOrden; sentido: "asc" | "desc" };

/** Fecha ascendente: el orden natural de un registro de tesorería, y el que hace
 *  que la marca de "FUTURO" signifique algo. */
export const ORDEN_INICIAL: Orden = { columna: "fecha", sentido: "asc" };

/** El estado se ordena por el ciclo de vida, no por alfabeto (§4.1). Alfabético
 *  daría conciliado → pagado → proyectado, que es el camino al revés. */
const PESO_ESTADO: Record<EstadoMovimiento, number> = {
  proyectado: 0,
  pagado: 1,
  conciliado: 2,
};

export type EtiquetasOrden = {
  /** Texto que muestra la columna de cuenta/empresa. */
  cuenta: (m: Movimiento) => string;
  /** Texto que muestra la columna de subcategoría. */
  subcategoria: (m: Movimiento) => string;
};

/** Siguiente estado del encabezado al hacer clic: la misma columna alterna el
 *  sentido, una columna distinta empieza ascendente. */
export function alternarOrden(actual: Orden, columna: ColumnaOrden): Orden {
  if (actual.columna !== columna) return { columna, sentido: "asc" };
  return { columna, sentido: actual.sentido === "asc" ? "desc" : "asc" };
}

export function ordenarMovimientos(
  movimientos: Movimiento[],
  orden: Orden,
  tc: number,
  etiquetas: EtiquetasOrden
): Movimiento[] {
  const factor = orden.sentido === "asc" ? 1 : -1;

  // Comparar textos con localeCompare y sensibilidad de acentos: en un catálogo
  // con "ADAPSYS PERÚ" y "PAPELERA" el orden de un `<` crudo depende del código
  // del carácter y deja las tildes fuera de lugar.
  const texto = (a: string, b: string) => {
    // Lo vacío siempre al final, en los dos sentidos: son filas sin el dato que
    // se está mirando y arriba solo estorban. Sin `factor` a propósito — con él,
    // invertir el orden los subiría al tope, que es justo lo que se quiere evitar.
    if (!a && !b) return 0;
    if (!a) return 1;
    if (!b) return -1;
    return a.localeCompare(b, "es") * factor;
  };

  const numero = (a: number, b: number) => (a - b) * factor;

  const comparar = (a: Movimiento, b: Movimiento): number => {
    switch (orden.columna) {
      case "fecha":
        return texto(a.fecha, b.fecha);
      case "cuenta":
        return texto(etiquetas.cuenta(a), etiquetas.cuenta(b));
      case "contraparte":
        return texto(a.contraparte ?? "", b.contraparte ?? "");
      case "glosa":
        return texto(a.glosa ?? "", b.glosa ?? "");
      case "subcategoria":
        return texto(etiquetas.subcategoria(a), etiquetas.subcategoria(b));
      case "monto":
        // En CLP para que pesos y dólares sean comparables. Con signo: el egreso
        // más grande arriba en ascendente, el ingreso más grande en descendente.
        return numero(enCLP(a, tc), enCLP(b, tc));
      case "estado":
        return numero(PESO_ESTADO[a.estado], PESO_ESTADO[b.estado]);
    }
  };

  // El desempate no depende del sentido: sin él, dos filas iguales en la columna
  // elegida quedan en el orden que traía el arreglo y la tabla "salta" entre
  // renders sin que nadie haya tocado nada.
  return [...movimientos].sort(
    (a, b) => comparar(a, b) || a.fecha.localeCompare(b.fecha) || a.id.localeCompare(b.id)
  );
}
