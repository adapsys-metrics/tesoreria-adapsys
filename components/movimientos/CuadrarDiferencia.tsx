"use client";

// Qué hacer cuando las líneas no suman el monto del movimiento.
//
// Antes el botón resolvía solo, y siempre igual: le cargaba la diferencia a la
// última línea. Para el caso en que el monto es el bueno —salió de la cartola y
// las líneas quedaron cortas— eso está bien. Para el otro caso, que es tan
// común como ese, está mal y además **se ve como un borrado**: a una factura de
// un cliente se le agrega la línea de comisiones bancarias, la última línea es
// justo esa, y cargarle la diferencia la deja en cero. Parece que el botón borró
// lo recién escrito.
//
// Los dos casos se distinguen por una sola cosa, y no hay forma de adivinarla:
// **cuál de los dos números es el cierto**. Si manda el monto, la diferencia va a
// una línea; si mandan las líneas —porque se le descontó algo al pago— el que
// tiene que cambiar es el monto del movimiento. Así que se pregunta, con los dos
// números a la vista.

import { conMoneda } from "@/lib/formato";
import { fechaCorta } from "@/lib/fechas";
import type { Movimiento } from "@/lib/tipos";
import css from "./movimientos.module.css";

export function CuadrarDiferencia({
  movimiento: m,
  /** La suma de las líneas: lo que el movimiento pasaría a valer. */
  suma,
  diferencia,
  ajustarMovimiento,
  cargarAUltimaLinea,
  cancelar,
}: {
  movimiento: Movimiento;
  suma: number;
  diferencia: number;
  ajustarMovimiento: () => void;
  cargarAUltimaLinea: () => void;
  cancelar: () => void;
}) {
  const ultima = m.lineas[m.lineas.length - 1];

  return (
    <div className={css.velo} role="dialog" aria-label="Cuadrar la diferencia" onClick={cancelar}>
      <div className={css.cuadro} onClick={(e) => e.stopPropagation()}>
        <h2 className={css.tituloCuadro}>Las líneas no suman el monto</h2>

        <p className={css.queSeMueve}>
          {fechaCorta(m.fecha)} · {m.contraparte ?? "sin proveedor"} ·{" "}
          <strong>{conMoneda(m.monto, m.moneda)}</strong>
        </p>

        <p className={css.deA}>
          <span>{conMoneda(m.monto, m.moneda)}</span>
          <span className={css.flechaMovida}>→</span>
          <span className={css.destinoMovida}>{conMoneda(suma, m.moneda)}</span>
        </p>

        <p className={css.consecuencia}>
          Las {m.lineas.length} líneas suman <strong>{conMoneda(suma, m.moneda)}</strong> y el
          movimiento dice {conMoneda(m.monto, m.moneda)}: faltan{" "}
          {conMoneda(diferencia, m.moneda)}.
        </p>

        <div className={css.opcionesCuadre}>
          <button type="button" onClick={ajustarMovimiento} className={css.guardar}>
            Ajustar el movimiento a {conMoneda(suma, m.moneda)}
          </button>
          <p className={css.pieOpcion}>
            El monto pasa a ser la suma de las líneas. Es lo que corresponde cuando al pago le
            descontaron algo —comisiones, retenciones— y lo que entró al banco es menos que la
            factura.
          </p>

          <button type="button" onClick={cargarAUltimaLinea} className={css.botonAmpliar}>
            Cargar {conMoneda(diferencia, m.moneda)} a la última línea
            {ultima?.glosa ? ` (${ultima.glosa})` : ""}
          </button>
          <p className={css.pieOpcion}>
            El monto no se toca. Es lo que corresponde cuando el monto salió de la cartola y lo
            que falta es una línea sin escribir.
          </p>
        </div>

        <div className={css.accionesCuadro}>
          <button type="button" onClick={cancelar} className={css.botonAmpliar}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
