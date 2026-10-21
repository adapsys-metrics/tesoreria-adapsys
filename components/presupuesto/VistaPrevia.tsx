"use client";

// Qué va a quedar escrito, antes de escribirlo.
//
// Generar reemplaza el presupuesto de cada línea que tenga movimientos en la
// ventana, y hasta acá lo hacía sin preguntar: había que apretar para saber qué
// salía, y lo que salía ya había pisado lo anterior. Sobre 290 categorías eso es
// mucho para deshacer a mano.
//
// La lista va ordenada por lo que más pesa, que es donde se nota si la ventana
// quedó mal elegida: si el primer renglón no es el que uno espera, hay algo que
// revisar antes de aplicar.

import { anualDe, type Meses } from "@/lib/presupuesto";
import { clp, mag } from "@/lib/formato";
import { mesLargo } from "@/lib/fechas";
import { BotonFantasma, clases } from "@/components/ui/primitivas";
import css from "./presupuesto.module.css";

/** Una línea que la generación tocaría. */
export type Previo = {
  clave: string;
  nombre: string;
  /** Lo que la línea dice hoy. 0 si no estaba presupuestada. */
  actual: number;
  /** Lo que diría al aplicar. */
  nuevo: number;
};

/** Arma la lista a partir de lo generado y de lo que hay. */
export function compararConLoQueHay(
  generado: Map<string, Meses>,
  actuales: Map<string, Meses>,
  nombreDe: (clave: string) => string
): Previo[] {
  return [...generado.entries()]
    .map(([clave, meses]) => ({
      clave,
      nombre: nombreDe(clave),
      actual: anualDe(actuales.get(clave) ?? []),
      nuevo: anualDe(meses),
    }))
    .sort((a, b) => b.nuevo - a.nuevo);
}

export function VistaPrevia({
  previo,
  ventana,
  reajuste,
  cuantasQuedanIgual,
  aplicar,
  cancelar,
}: {
  previo: Previo[];
  ventana: { desde: string; hasta: string };
  reajuste: number;
  /** Líneas con presupuesto hoy que la generación no toca, por no tener
   *  movimientos en la ventana. Se cuentan para que nadie crea que se borran. */
  cuantasQuedanIgual: number;
  aplicar: () => void;
  cancelar: () => void;
}) {
  const total = previo.reduce((t, p) => t + p.nuevo, 0);
  const pisadas = previo.filter((p) => p.actual > 0);

  return (
    <div
      className={css.velo}
      role="dialog"
      aria-label="Qué va a quedar escrito"
      onClick={cancelar}
    >
      <div
        className={clases(css.cuadro, css.cuadroAlto, css.cuadroAncho)}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className={css.tituloCuadro}>
          {previo.length} {previo.length === 1 ? "línea" : "líneas"} · {mag(total)} al año
        </h2>

        <p className={css.notaCuadro}>
          De los movimientos entre {mesLargo(ventana.desde)} y {mesLargo(ventana.hasta)}
          {reajuste !== 0 && `, con ${reajuste > 0 ? "+" : ""}${reajuste}% de reajuste`}.
          Cada uno cae en su mes, así que lo trimestral y lo anual quedan en el mes en
          que ocurrieron.
        </p>

        {pisadas.length > 0 && (
          <p className={css.avisoCuadro}>
            <strong>{pisadas.length}</strong>{" "}
            {pisadas.length === 1 ? "línea ya tenía" : "líneas ya tenían"} presupuesto y{" "}
            {pisadas.length === 1 ? "se reemplaza" : "se reemplazan"}. Van marcadas abajo.
          </p>
        )}

        {cuantasQuedanIgual > 0 && (
          <p className={css.notaCuadro}>
            Otras <strong>{cuantasQuedanIgual}</strong> líneas tienen presupuesto y no se
            tocan: no hubo movimientos suyos en la ventana. Generar no borra nada que no
            reemplace.
          </p>
        )}

        <div className={css.listaPrevia}>
          <table className={css.tablaPrevia}>
            <thead>
              <tr>
                <th>Línea</th>
                <th className={css.numPrevia}>Hoy</th>
                <th className={css.numPrevia}>Quedaría</th>
                <th className={css.numPrevia}>Δ</th>
              </tr>
            </thead>
            <tbody>
              {previo.map((p) => {
                const delta = p.nuevo - p.actual;
                return (
                  <tr key={p.clave} className={p.actual > 0 ? css.filaPisada : undefined}>
                    <td>{p.nombre}</td>
                    <td className={css.numPrevia}>{p.actual ? mag(p.actual) : "—"}</td>
                    <td className={clases(css.numPrevia, css.nuevoPrevia)}>
                      {mag(p.nuevo)}
                    </td>
                    <td
                      className={css.numPrevia}
                      style={{ color: delta < 0 ? "var(--brick)" : undefined }}
                    >
                      {p.actual ? `${delta > 0 ? "+" : ""}${clp(delta)}` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className={css.accionesCuadro}>
          <BotonFantasma onClick={cancelar}>Cancelar</BotonFantasma>
          <button type="button" onClick={aplicar} className={css.botonAjustar}>
            Aplicar a {previo.length} {previo.length === 1 ? "línea" : "líneas"}
          </button>
        </div>
      </div>
    </div>
  );
}
