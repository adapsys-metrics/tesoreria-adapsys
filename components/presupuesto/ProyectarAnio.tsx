"use client";

// Elegir qué se proyecta al año siguiente.
//
// Copiar los ~1.200 movimientos operativos de un año traería todo lo ocasional, y
// lo ocasional del año pasado se volvería compromiso del que viene hasta que
// alguien lo saque de a uno. La elección va por **categoría**, que es como se
// piensa el gasto —"los pagos de Entel", "los sueldos"— y son del orden de 90
// líneas en vez de 1.200.
//
// La columna que decide es **en cuántos meses aparece**: 12 es mensual, 4 es
// trimestral, 1 es una vez en la vida. Eso lo resuelve quien conoce el gasto, sin
// que la app adivine con un umbral.

import { useState } from "react";
import type { ResumenCategoria } from "@/lib/proyeccion";
import { mag } from "@/lib/formato";
import { BotonFantasma, clases } from "@/components/ui/primitivas";
import css from "./presupuesto.module.css";

export function ProyectarAnio({
  resumen,
  anio,
  ventana,
  reajuste,
  nombreDe,
  cuantosMovimientos,
  confirmar,
  cancelar,
}: {
  resumen: ResumenCategoria[];
  anio: number;
  ventana: { desde: string; hasta: string };
  reajuste: number;
  nombreDe: (categoria_id: string) => string;
  /** Cuántos movimientos saldrían de las categorías elegidas. */
  cuantosMovimientos: (elegidas: Set<string>) => number;
  confirmar: (elegidas: Set<string>) => void;
  cancelar: () => void;
}) {
  // Arranca todo marcado: es más rápido desmarcar lo ocasional que marcar lo
  // mensual, porque lo mensual es casi todo.
  const [elegidas, setElegidas] = useState<Set<string>>(
    () => new Set(resumen.map((r) => r.categoria_id))
  );

  const alternar = (id: string) =>
    setElegidas((p) => {
      const siguiente = new Set(p);
      if (siguiente.has(id)) siguiente.delete(id);
      else siguiente.add(id);
      return siguiente;
    });

  const todas = () => setElegidas(new Set(resumen.map((r) => r.categoria_id)));
  const ninguna = () => setElegidas(new Set());

  const cuantos = cuantosMovimientos(elegidas);
  const total = resumen
    .filter((r) => elegidas.has(r.categoria_id))
    .reduce((t, r) => t + r.total, 0);

  return (
    <div
      className={css.velo}
      role="dialog"
      aria-label={`Proyectar ${anio}`}
      onClick={cancelar}
    >
      <div
        className={clases(css.cuadro, css.cuadroAlto, css.cuadroAncho)}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className={css.tituloCuadro}>Proyectar {anio}</h2>

        <p className={css.notaCuadro}>
          Copia los movimientos de {ventana.desde} a {ventana.hasta} al mismo mes y día
          de {anio}, como proyectados
          {reajuste !== 0 && `, con ${reajuste > 0 ? "+" : ""}${reajuste}% de reajuste`}.
          El presupuesto operativo sale después de sumarlos.
        </p>

        <p className={css.notaCuadro}>
          <strong>Meses</strong> dice en cuántos aparece cada una: 12 es mensual, 4
          trimestral, 1 una vez en el año.
        </p>

        <div className={css.barraElegir}>
          <BotonFantasma onClick={todas}>Marcar todas</BotonFantasma>
          <BotonFantasma onClick={ninguna}>Ninguna</BotonFantasma>
          <span className={css.empuje} />
          <span className={css.cuentaElegidas}>
            {elegidas.size} de {resumen.length} · {cuantos}{" "}
            {cuantos === 1 ? "movimiento" : "movimientos"} · {mag(total)}
          </span>
        </div>

        <div className={css.listaPrevia}>
          <table className={css.tablaPrevia}>
            <thead>
              <tr>
                <th />
                <th>Categoría</th>
                <th className={css.numPrevia}>Meses</th>
                <th className={css.numPrevia}>Movs</th>
                <th className={css.numPrevia}>Total</th>
              </tr>
            </thead>
            <tbody>
              {resumen.map((r) => {
                const marcada = elegidas.has(r.categoria_id);
                return (
                  <tr
                    key={r.categoria_id}
                    className={!marcada ? css.filaDesmarcada : undefined}
                  >
                    <td>
                      <input
                        type="checkbox"
                        checked={marcada}
                        onChange={() => alternar(r.categoria_id)}
                        aria-label={`Proyectar ${nombreDe(r.categoria_id)}`}
                      />
                    </td>
                    <td>{nombreDe(r.categoria_id)}</td>
                    {/* Lo que aparece pocos meses es lo que conviene mirar dos
                        veces: casi siempre es ocasional. */}
                    <td
                      className={clases(css.numPrevia, r.meses <= 2 && css.mesesPocos)}
                    >
                      {r.meses}
                    </td>
                    <td className={css.numPrevia}>{r.movimientos}</td>
                    <td className={css.numPrevia}>{mag(r.total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className={css.accionesCuadro}>
          <BotonFantasma onClick={cancelar}>Cancelar</BotonFantasma>
          <button
            type="button"
            disabled={elegidas.size === 0}
            onClick={() => confirmar(elegidas)}
            className={css.botonAjustar}
          >
            Crear {cuantos} {cuantos === 1 ? "movimiento" : "movimientos"}
          </button>
        </div>
      </div>
    </div>
  );
}
