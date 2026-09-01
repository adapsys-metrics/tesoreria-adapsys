// Los "registros" de la barra lateral.
//
// En Quicken cada cuenta es un registro que se abre por separado, y las
// proyecciones viven en registros propios —PROY. EGRESOS CLP y USD— aparte de los
// bancarios. En este sistema el movimiento es uno solo y cambia de estado (§4.1),
// pero esa unificación es del modelo de datos, no de la pantalla: quien concilia
// necesita ver la cuenta del banco tal cual llega la cartola, sin compromisos
// futuros encima.
//
// Así que acá se reconstruye esa separación como una forma de mirar. Los registros
// de proyección no son cuentas ni tablas: son un filtro con nombre.

import type { Cuenta, Moneda, Movimiento } from "@/lib/tipos";

export type Registro = {
  /** Clave con prefijo para que no se confundan los espacios de nombres:
   *  "cuenta:a1" es la cuenta a1, "proy:egresos-clp" es un filtro. */
  clave: string;
  nombre: string;
  moneda: Moneda;
};

/** Egresos proyectados: lo que en Quicken son las cuentas espejo. */
export const REGISTROS_PROYECCION: Registro[] = [
  { clave: "proy:egresos-clp", nombre: "Egresos proyectados", moneda: "CLP" },
  { clave: "proy:egresos-usd", nombre: "Egresos proyectados", moneda: "USD" },
];

export const claveDeCuenta = (cuenta_id: string) => `cuenta:${cuenta_id}`;

/** ¿La clave abre una cuenta bancaria? Es distinto de una cuenta de cobranza o de
 *  un registro de proyección, y cambia qué filtros tienen sentido encima. */
export function esRegistroDeBanco(clave: string | null, cuentas: Cuenta[]): boolean {
  if (!clave?.startsWith("cuenta:")) return false;
  const id = clave.slice("cuenta:".length);
  return cuentas.find((c) => c.id === id)?.tipo === "banco";
}

/**
 * ¿Este movimiento pertenece al registro?
 *
 * Dos reglas que no son obvias:
 *
 * - Una cuenta **bancaria** muestra solo lo que ya pasó por el banco. Es lo que
 *   permite cuadrar contra la cartola: si se colaran los proyectados, el saldo de
 *   la pantalla nunca coincidiría con el del banco y la conciliación sería inútil.
 *
 * - Una cuenta de **cobranza** (facturas por cobrar, proyectos aprobados) muestra
 *   todo lo suyo: por definición es plata que todavía no entra, así que separarla
 *   por estado no distingue nada.
 */
export function perteneceAlRegistro(
  m: Movimiento,
  clave: string,
  cuentas: Cuenta[]
): boolean {
  if (clave.startsWith("cuenta:")) {
    const id = clave.slice("cuenta:".length);
    if (m.cuenta_id !== id) return false;
    const cuenta = cuentas.find((c) => c.id === id);
    return cuenta?.tipo === "banco" ? m.estado !== "proyectado" : true;
  }

  if (clave.startsWith("proy:egresos-")) {
    if (m.estado !== "proyectado") return false;
    const moneda = clave.endsWith("-usd") ? "USD" : "CLP";
    if (m.moneda !== moneda) return false;
    // Un proyectado sin cuenta entra igual: es la provisión que todavía no sabe
    // por dónde se va a pagar, y dejarla fuera la haría invisible en todas las
    // vistas. Las cuentas de cobranza tienen su propio registro.
    if (m.cuenta_id === null) return true;
    return cuentas.find((c) => c.id === m.cuenta_id)?.tipo === "banco";
  }

  return false;
}

/**
 * Saldo de una cuenta bancaria: el inicial más lo que efectivamente se movió.
 *
 * Los proyectados no suman — no han ocurrido. Es exactamente la diferencia entre
 * "efectivo" y "posición proyectada" del encabezado, y la razón por la que este
 * número tiene que coincidir con el del banco.
 */
export function saldoDeCuenta(cuenta: Cuenta, movimientos: Movimiento[]): number {
  return movimientos.reduce(
    (saldo, m) =>
      m.cuenta_id === cuenta.id && m.estado !== "proyectado" ? saldo + m.monto : saldo,
    cuenta.saldo_inicial
  );
}

/** Total comprometido de un registro de proyección. */
export function totalDeRegistro(
  clave: string,
  movimientos: Movimiento[],
  cuentas: Cuenta[]
): number {
  return movimientos.reduce(
    (t, m) => (perteneceAlRegistro(m, clave, cuentas) ? t + m.monto : t),
    0
  );
}
