"use client";

// Confirmar que un movimiento se borra.
//
// El editor ya pregunta en dos pasos, pero ahí uno llegó abriendo el detalle y
// bajando hasta el final: el movimiento está entero a la vista. Desde el menú
// de botón derecho no — se apretó sobre una fila, y puede ser la de al lado de
// la que uno miraba. Así que el cuadro **dice cuál es**: fecha, proveedor y
// monto, que es lo que permite reconocerlo.
//
// No hay deshacer todavía (§10), así que esto es lo único que separa un clic de
// perder un movimiento.

import { conMoneda } from "@/lib/formato";
import { fechaCorta } from "@/lib/fechas";
import type { Movimiento } from "@/lib/tipos";
import css from "./movimientos.module.css";

export function ConfirmarBorrado({
  movimiento: m,
  confirmar,
  cancelar,
}: {
  movimiento: Movimiento;
  confirmar: () => void;
  cancelar: () => void;
}) {
  return (
    <div className={css.velo} role="dialog" aria-label="Confirmar borrado" onClick={cancelar}>
      <div className={css.cuadro} onClick={(e) => e.stopPropagation()}>
        <h2 className={css.tituloCuadro}>¿Borrar el movimiento?</h2>

        <p className={css.queSeMueve}>
          {fechaCorta(m.fecha)} · {m.contraparte ?? "sin proveedor"} ·{" "}
          <strong>{conMoneda(m.monto, m.moneda)}</strong>
        </p>
        {m.glosa && <p className={css.consecuencia}>{m.glosa}</p>}

        <p className={css.consecuencia}>
          Se borra el movimiento y sus {m.lineas.length === 1 ? "línea" : `${m.lineas.length} líneas`}.
          No se puede deshacer.
          {m.estado !== "proyectado" && " Y cambia el saldo de la cuenta."}
        </p>

        <div className={css.accionesCuadro}>
          <button type="button" onClick={cancelar} className={css.botonAmpliar}>
            Cancelar
          </button>
          <button type="button" onClick={confirmar} className={css.botonBorrarFirme}>
            Sí, borrar
          </button>
        </div>
      </div>
    </div>
  );
}
