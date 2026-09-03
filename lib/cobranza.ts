// Qué se puede hacer con un movimiento según dónde esté.
//
// La plata por entrar recorre tres registros antes de llegar al banco, y cada uno
// es un grado de certeza distinto:
//
//   Proyectos aprobados  →  Facturas por cobrar  →  Cuenta del banco
//   (estimación, la        (documento emitido,     (entró de verdad)
//    fecha se mueve)        número y fecha firme)
//
// Modelarlo como tres registros y no como un campo tiene una ventaja concreta: en
// cualquier momento se puede ver cuánto hay aprobado sin facturar y cuánto
// facturado sin cobrar, que son dos problemas distintos y de dos áreas distintas.

import { CADENA_COBRANZA } from "@/lib/catalogo";
import { cuentaBancariaDe } from "@/lib/dominio";
import type { Cuenta, Movimiento } from "@/lib/tipos";

export type Paso =
  /** Emitir la factura: pasa a la cartera de cobranza, sigue proyectado. */
  | { accion: "facturar"; destino: Cuenta; etiqueta: string; titulo: string }
  /** Entró la plata: pasa a la cuenta del banco y deja de ser una proyección. */
  | { accion: "cobrar"; destino: Cuenta; etiqueta: string; titulo: string }
  /** Un egreso proyectado que ya salió del banco. */
  | { accion: "pagar"; etiqueta: string; titulo: string }
  /** No hay acción, y el motivo se muestra: un botón que no se puede apretar sin
   *  explicación es peor que no tener botón. */
  | { accion: "ninguna"; motivo: string | null };

const SIN_ACCION: Paso = { accion: "ninguna", motivo: null };

export function pasoDe(m: Movimiento, cuentas: Cuenta[]): Paso {
  if (m.estado !== "proyectado") return SIN_ACCION;

  const enlace = CADENA_COBRANZA.find((c) => c.desde === m.cuenta_id);
  if (enlace) {
    const destino = cuentas.find((c) => c.id === enlace.hacia);
    if (!destino) {
      return { accion: "ninguna", motivo: `No existe la cuenta ${enlace.hacia}` };
    }
    return {
      accion: "facturar",
      destino,
      etiqueta: "Facturar",
      titulo: `Pasa a ${destino.nombre}. Sigue siendo plata por entrar, pero con documento emitido.`,
    };
  }

  const cuenta = cuentas.find((c) => c.id === m.cuenta_id);
  if (!cuenta) return SIN_ACCION;

  if (cuenta.tipo === "cxc") {
    // El destino sale de la empresa y la moneda del movimiento: cada empresa tiene
    // a lo más una cuenta por moneda, así que el par las identifica sin preguntar.
    if (!m.empresa_id) {
      return { accion: "ninguna", motivo: "Asigna la empresa antes de cobrar" };
    }
    const destino = cuentaBancariaDe(cuentas, m.empresa_id, m.moneda);
    if (!destino) {
      return {
        accion: "ninguna",
        motivo: `Esa empresa no tiene cuenta en ${m.moneda}`,
      };
    }
    return {
      accion: "cobrar",
      destino,
      etiqueta: "Cobrar",
      titulo: `Entró la plata: pasa a ${destino.nombre} y suma al saldo. Queda conciliado — se marca cuando ya está en la cartola.`,
    };
  }

  return {
    accion: "pagar",
    etiqueta: "Marcar pagado",
    titulo: "Ya está en la cartola con esta fecha: pasa a afectar el saldo de la cuenta.",
  };
}
