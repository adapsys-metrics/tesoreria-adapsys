"use client";

// Confirmar que un movimiento cambia de cuenta.
//
// Cambiar la empresa en una cuenta del banco no es editar un campo: mueve el
// movimiento de una cuenta a otra y por lo tanto **cambia el saldo de las dos**. Antes
// pasaba de inmediato al tocar el desplegable, y un movimiento ya conciliado podía
// irse a otra sociedad sin que nadie lo pidiera.

import { clp } from "@/lib/formato";
import { fechaCorta } from "@/lib/fechas";
import type { Cuenta, Movimiento } from "@/lib/tipos";
import css from "./movimientos.module.css";

export function ConfirmarMovida({
  movimiento: m,
  origen,
  destino,
  nombreEmpresa,
  confirmar,
  cancelar,
}: {
  movimiento: Movimiento;
  origen: Cuenta | null;
  destino: Cuenta;
  nombreEmpresa: (id: string) => string;
  confirmar: () => void;
  cancelar: () => void;
}) {
  return (
    <div
      className={css.velo}
      role="dialog"
      aria-label="Confirmar cambio de cuenta"
      onClick={cancelar}
    >
      <div className={css.cuadro} onClick={(e) => e.stopPropagation()}>
        <h2 className={css.tituloCuadro}>¿Mover el movimiento de cuenta?</h2>

        {/* Qué movimiento es, para no depender de que la fila siga a la vista. */}
        <p className={css.queSeMueve}>
          {fechaCorta(m.fecha)} · {m.contraparte ?? "sin proveedor"} ·{" "}
          <strong>{clp(m.monto)}</strong>
        </p>

        <p className={css.deA}>
          <span>{origen ? `${nombreEmpresa(origen.empresa_id)} · ${origen.moneda}` : "sin cuenta"}</span>
          <span className={css.flechaMovida}>→</span>
          <span className={css.destinoMovida}>
            {nombreEmpresa(destino.empresa_id)} · {destino.moneda}
          </span>
        </p>

        <p className={css.consecuencia}>
          Cambia el saldo de las dos cuentas
          {m.estado === "conciliado" && ", y este movimiento ya está conciliado"}.
          {destino.moneda !== m.moneda &&
            ` La moneda pasa de ${m.moneda} a ${destino.moneda}.`}
        </p>

        <div className={css.accionesCuadro}>
          <button type="button" onClick={cancelar} className={css.botonAmpliar}>
            Cancelar
          </button>
          <button type="button" onClick={confirmar} className={css.guardar}>
            Sí, mover
          </button>
        </div>
      </div>
    </div>
  );
}
