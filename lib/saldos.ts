// Saldo corriente por movimiento — el "Balance" de Quicken.
//
// Es el saldo de la cuenta DESPUÉS de cada movimiento, y sirve para lo mismo que
// servía allá: recorrer el registro contra la cartola y encontrar dónde se separan.
//
// Tres condiciones para que el número signifique algo, y las tres importan:
//
// 1. Una sola cuenta. Un saldo corriente sobre movimientos de varias cuentas no es
//    el saldo de nada.
// 2. Orden cronológico. El saldo se acumula en el tiempo, no en el orden en que la
//    tabla esté mostrada.
// 3. TODOS los movimientos de la cuenta, no solo los visibles. Calcularlo sobre las
//    filas filtradas daría un saldo que cambia según lo que se haya escrito en el
//    buscador — parecería correcto y estaría mal.

import type { Cuenta, Movimiento } from "@/lib/tipos";

/**
 * Saldo de la cuenta después de cada uno de sus movimientos.
 *
 * Los proyectados no suman: no han ocurrido. Aparecen en el mapa igual, con el
 * saldo que había hasta ese punto, para que la columna no quede en blanco en medio
 * de la lista — lo que se muestra es "el saldo sigue siendo este".
 */
export function saldosCorrientes(
  cuenta: Cuenta,
  movimientos: Movimiento[]
): Map<string, number> {
  const propios = movimientos
    .filter((m) => m.cuenta_id === cuenta.id)
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id.localeCompare(b.id));

  const saldos = new Map<string, number>();
  let saldo = cuenta.saldo_inicial;
  for (const m of propios) {
    if (m.estado !== "proyectado") saldo += m.monto;
    saldos.set(m.id, saldo);
  }
  return saldos;
}
