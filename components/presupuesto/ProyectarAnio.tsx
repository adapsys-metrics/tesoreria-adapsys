"use client";

// Elegir qué se proyecta al año siguiente, y por cuántos meses.
//
// Copiar los ~1.200 movimientos operativos de un año traería todo lo ocasional, y
// lo ocasional del año pasado se volvería compromiso del que viene hasta que
// alguien lo saque de a uno.
//
// Se elige en dos niveles, que son los dos en que se piensa el gasto:
//
//   categoría   "Telefonía e internet"
//     proveedor   GTD · 12 meses · proyectar 12
//     proveedor   Entel · 12 meses · proyectar 12
//
// El proveedor hace falta: "Telefonía e internet · 12 meses" no dice si son doce
// pagos a Entel o una mezcla, y sin saberlo uno proyecta a ciegas. Y los meses
// hacen falta porque un contrato que termina en junio no son doce pagos, y un
// seguro anual no son doce: es uno.

import { Fragment, useState } from "react";
import { claveRama, type Rama, type ResumenCategoria } from "@/lib/proyeccion";
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
  yaGenerados,
  confirmar,
  cancelar,
}: {
  resumen: ResumenCategoria[];
  anio: number;
  ventana: { desde: string; hasta: string };
  reajuste: number;
  nombreDe: (categoria_id: string) => string;
  /** Cuántos movimientos saldrían de esta elección. */
  cuantosMovimientos: (eleccion: Map<string, number>) => number;
  /** Cuántos ya se generaron antes para este año. Proyectar los reemplaza, y los
   *  ajustes que alguien les haya hecho encima se pierden: hay que decirlo. */
  yaGenerados: number;
  confirmar: (eleccion: Map<string, number>) => void;
  cancelar: () => void;
}) {
  // Arranca con todo completo: es más rápido recortar lo ocasional que marcar lo
  // mensual, porque lo mensual es casi todo.
  const [eleccion, setEleccion] = useState<Map<string, number>>(
    () =>
      new Map(
        resumen.flatMap((c) =>
          c.ramas.map((r) => [claveRama(r.categoria_id, r.contraparte), r.meses.length] as const)
        )
      )
  );
  const [abiertas, setAbiertas] = useState<Set<string>>(new Set());

  const fijar = (k: string, n: number) =>
    setEleccion((p) => new Map(p).set(k, Math.max(0, n)));

  const fijarCategoria = (c: ResumenCategoria, lleno: boolean) =>
    setEleccion((p) => {
      const siguiente = new Map(p);
      for (const r of c.ramas) {
        siguiente.set(claveRama(r.categoria_id, r.contraparte), lleno ? r.meses.length : 0);
      }
      return siguiente;
    });

  const mesesDe = (r: Rama) => eleccion.get(claveRama(r.categoria_id, r.contraparte)) ?? 0;
  const activa = (c: ResumenCategoria) => c.ramas.some((r) => mesesDe(r) > 0);

  const todo = (lleno: boolean) =>
    setEleccion(
      new Map(
        resumen.flatMap((c) =>
          c.ramas.map(
            (r) =>
              [claveRama(r.categoria_id, r.contraparte), lleno ? r.meses.length : 0] as const
          )
        )
      )
    );

  const alternarAbierta = (id: string) =>
    setAbiertas((p) => {
      const s = new Set(p);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });

  const cuantos = cuantosMovimientos(eleccion);
  const cuantasActivas = resumen.filter(activa).length;

  /** Lo que aporta una rama con los meses elegidos. Proporcional a lo observado:
   *  cortar a la mitad los meses deja la mitad del monto. */
  const totalDe = (r: Rama) =>
    r.meses.length === 0 ? 0 : Math.round((r.total * mesesDe(r)) / r.meses.length);

  const totalElegido = resumen.reduce(
    (t, c) => t + c.ramas.reduce((s, r) => s + totalDe(r), 0),
    0
  );

  return (
    <div className={css.velo} role="dialog" aria-label={`Proyectar ${anio}`} onClick={cancelar}>
      <div
        className={clases(css.cuadro, css.cuadroAlto, css.cuadroAncho)}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className={css.tituloCuadro}>Proyectar {anio}</h2>

        <p className={css.notaCuadro}>
          Copia los movimientos de {ventana.desde} a {ventana.hasta} al mismo mes y día de{" "}
          {anio}, como proyectados
          {reajuste !== 0 && `, con ${reajuste > 0 ? "+" : ""}${reajuste}% de reajuste`}. El
          presupuesto operativo sale después de sumarlos.
        </p>

        <p className={css.notaCuadro}>
          <strong>Meses</strong> es en cuántos apareció. <strong>Proyectar</strong> es cuántas
          veces se repite en {anio}: 12 todo el año, 6 un contrato que termina a mitad, 1 un
          pago anual, 0 no se proyecta. Se toman los primeros meses del año.
        </p>

        {yaGenerados > 0 && (
          <p className={css.avisoCuadro}>
            Ya hay <strong>{yaGenerados}</strong>{" "}
            {yaGenerados === 1 ? "movimiento generado" : "movimientos generados"} para {anio} y{" "}
            {yaGenerados === 1 ? "se reemplaza" : "se reemplazan"}. Si les ajustaste montos a
            mano, esos ajustes se pierden. Lo que cargaste vos desde cero no se toca.
          </p>
        )}

        <div className={css.barraElegir}>
          <BotonFantasma onClick={() => todo(true)}>Marcar todas</BotonFantasma>
          <BotonFantasma onClick={() => todo(false)}>Ninguna</BotonFantasma>
          <span className={css.empuje} />
          <span className={css.cuentaElegidas}>
            {cuantasActivas} de {resumen.length} · {cuantos}{" "}
            {cuantos === 1 ? "movimiento" : "movimientos"} · {mag(totalElegido)}
          </span>
        </div>

        <div className={css.listaPrevia}>
          <table className={css.tablaPrevia}>
            <thead>
              <tr>
                <th />
                <th>Categoría y proveedor</th>
                <th className={css.numPrevia}>Meses</th>
                <th className={css.numPrevia}>Proyectar</th>
                <th className={css.numPrevia}>Total</th>
              </tr>
            </thead>
            <tbody>
              {resumen.map((c) => {
                const nombre = nombreDe(c.categoria_id);
                const abierta = abiertas.has(c.categoria_id);
                const marcada = activa(c);
                const total = c.ramas.reduce((t, r) => t + totalDe(r), 0);

                return (
                  <Fragment key={c.categoria_id}>
                    <tr className={!marcada ? css.filaDesmarcada : undefined}>
                      <td>
                        <input
                          type="checkbox"
                          checked={marcada}
                          onChange={() => fijarCategoria(c, !marcada)}
                          aria-label={`Proyectar ${nombre}`}
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() => alternarAbierta(c.categoria_id)}
                          aria-expanded={abierta}
                          className={css.abrirRama}
                        >
                          <span className={clases(css.flechaRama, abierta && css.flechaAbierta)}>
                            ▸
                          </span>
                          {nombre}
                          <span className={css.cuantosProveedores}>
                            {c.ramas.length}{" "}
                            {c.ramas.length === 1 ? "proveedor" : "proveedores"}
                          </span>
                        </button>
                      </td>
                      {/* Lo que aparece en uno o dos meses casi siempre es
                          ocasional: es lo que conviene mirar dos veces antes de
                          volverlo compromiso del año que viene. */}
                      <td className={clases(css.numPrevia, c.meses <= 2 && css.mesesPocos)}>
                        {c.meses}
                      </td>
                      <td className={css.numPrevia} />
                      <td className={css.numPrevia}>{mag(total)}</td>
                    </tr>

                    {abierta &&
                      c.ramas.map((r) => {
                        const k = claveRama(r.categoria_id, r.contraparte);
                        const n = mesesDe(r);
                        const quien = r.contraparte || "sin proveedor";
                        return (
                          <tr key={k} className={clases(css.filaRama, n === 0 && css.filaDesmarcada)}>
                            <td />
                            <td className={css.nombreRama}>{quien}</td>
                            <td className={clases(css.numPrevia, r.meses.length <= 2 && css.mesesPocos)}>
                              {r.meses.length}
                            </td>
                            <td className={css.numPrevia}>
                              <input
                                type="number"
                                min={0}
                                max={r.meses.length}
                                value={n}
                                onChange={(e) => fijar(k, Number(e.target.value) || 0)}
                                aria-label={`Meses a proyectar de ${quien} en ${nombre}`}
                                className={css.entradaMeses}
                              />
                            </td>
                            <td className={css.numPrevia}>{mag(totalDe(r))}</td>
                          </tr>
                        );
                      })}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className={css.accionesCuadro}>
          <BotonFantasma onClick={cancelar}>Cancelar</BotonFantasma>
          <button
            type="button"
            disabled={cuantos === 0}
            onClick={() => confirmar(eleccion)}
            className={css.botonAjustar}
          >
            Crear {cuantos} {cuantos === 1 ? "movimiento" : "movimientos"}
          </button>
        </div>
      </div>
    </div>
  );
}