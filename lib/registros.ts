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

/**
 * ¿Este movimiento vive en un registro de control?
 *
 * Los registros de control no entran a ninguna vista: ni al flujo, ni al
 * presupuesto, ni a los saldos, ni al contador de vencidos. Es la cuenta corriente
 * Perú-Chile, que lleva lo que el otro país genera a cuenta nuestra. Cada semestre
 * se netea y el país que debe transfiere, y **esa** transferencia sí es un
 * movimiento del banco que ya está anotado en la cuenta dólar. Si el registro
 * entrara al flujo, cada peso estaría contado dos veces.
 *
 * Solo se ven abriendo su propio registro en la barra lateral.
 */
export const esDeControl = (m: Movimiento, cuentas: Cuenta[]): boolean =>
  cuentas.find((c) => c.id === m.cuenta_id)?.tipo === "control";

/**
 * ¿La clave abre un registro de una sola cuenta donde lo anotado ya ocurrió?
 *
 * Son el banco y los de control, y cambia tres cosas: tiene sentido mostrar el
 * saldo corriente —es el saldo DE esa cuenta—, el orden natural es del más
 * reciente al más antiguo, y "solo pendiente" tiene que arrancar apagado. Ese
 * último punto no es cosmético: en un registro donde todo ya ocurrió, el filtro
 * de pendientes deja la tabla vacía y parece que la cuenta no tiene movimientos.
 *
 * La cartera no entra: ahí todo está por entrar por definición, así que un saldo
 * acumulado de lo que no ha pasado no sería el saldo de nada.
 */
export function esRegistroConSaldo(clave: string | null, cuentas: Cuenta[]): boolean {
  if (!clave?.startsWith("cuenta:")) return false;
  const tipo = cuentas.find((c) => c.id === clave.slice("cuenta:".length))?.tipo;
  return tipo === "banco" || tipo === "control";
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
    // Solo el banco esconde los proyectados. La cobranza y los registros de
    // control muestran todo lo suyo: no hay cartola contra la cual cuadrarlos.
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
 * Lo que va arriba del registro abierto: su nombre, qué muestra y el número que lo
 * resume.
 *
 * Es lo que hace Quicken y por lo que se pidió: con el nombre de la cuenta y su
 * saldo en el encabezado se sabe dónde se está parado sin tener que mirar la barra
 * lateral. Acá hay un matiz que Quicken no tiene, porque sus registros son todos
 * cuentas: **no todos tienen saldo**. La cartera y las proyecciones no son plata
 * que esté en ninguna parte, así que su número es un total, no un saldo, y el
 * rótulo tiene que decirlo o el encabezado estaría mintiendo.
 */
export type CabeceraRegistro = {
  nombre: string;
  bajada: string;
  rotulo: string;
  monto: number;
  moneda: Moneda;
};

export function cabeceraDeRegistro(
  clave: string,
  cuentas: (Cuenta & { saldo: number })[],
  /** Los movimientos que ya están filtrados a este registro: es lo que se ve en
   *  pantalla, y el total del encabezado tiene que ser el de esa lista. */
  delRegistro: Movimiento[]
): CabeceraRegistro | null {
  const suma = () => delRegistro.reduce((t, m) => t + m.monto, 0);

  const proy = REGISTROS_PROYECCION.find((r) => r.clave === clave);
  if (proy) {
    return {
      nombre: `${proy.nombre} ${proy.moneda}`,
      bajada:
        "Compromisos futuros, de todas las empresas. Dejan de aparecer acá cuando se marcan pagados.",
      rotulo: "Total comprometido",
      monto: suma(),
      moneda: proy.moneda,
    };
  }

  if (!clave.startsWith("cuenta:")) return null;
  const cuenta = cuentas.find((c) => c.id === clave.slice("cuenta:".length));
  if (!cuenta) return null;

  if (cuenta.tipo === "cxc") {
    return {
      nombre: cuenta.nombre,
      bajada:
        "Plata por entrar: todavía no pasó por el banco, así que no suma a ningún saldo.",
      rotulo: "Total por cobrar",
      monto: suma(),
      moneda: cuenta.moneda,
    };
  }

  return {
    nombre: cuenta.nombre,
    bajada:
      cuenta.tipo === "control"
        ? "Registro de control: no entra al flujo, al presupuesto ni a ningún saldo. Solo lleva la cuenta."
        : "Solo lo que ya pasó por el banco, que es lo que permite cuadrar contra la cartola.",
    // El de control no se cuadra contra ninguna cartola, así que no es un saldo
    // "de hoy" en el sentido del banco: es cuánto va acumulado en el registro.
    rotulo: cuenta.tipo === "control" ? "Saldo del registro" : "Saldo de hoy",
    // El saldo viene ya calculado, el mismo que muestra la barra lateral. Sacarlo
    // de `delRegistro` daría otro número en cuanto haya un filtro puesto, y dos
    // saldos distintos para la misma cuenta es peor que no mostrar ninguno.
    monto: cuenta.saldo,
    moneda: cuenta.moneda,
  };
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
