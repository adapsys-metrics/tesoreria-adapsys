"use client";

// Ajustar el presupuesto una vez aprobado el año, y poder reconstruir qué pasó.
//
// Mientras el año se está armando, editar el anual es construir: se reparte sobre
// los doce meses y no hay nada que anotar. Desde que el año se aprueba cambia el
// significado de la misma acción —ahora es un ajuste— y cambian tres cosas:
//
//   - Los meses que ya pasaron no se tocan. Son el plan contra el que se midió el
//     gasto de esos meses; reescribirlos haría que el % utilizado de marzo cambie
//     en octubre. Lo que se mueve es el cupo de aquí en adelante (`ajustarDesde`).
//   - Hay que decir por qué. La base lo exige, y no por formalismo: una bitácora
//     de números sin motivo en diciembre no le dice nada a nadie.
//   - Queda anotado mes por mes, para poder mirar después dónde se ajustó el año.

import { useState } from "react";
import { ajustarDesde, anualDe, type Meses } from "@/lib/presupuesto";
import type { CambioPresupuesto } from "@/lib/supabase/presupuesto";
import { clp, mag } from "@/lib/formato";
import { clave } from "@/lib/catalogo-indices";
import { MESES_CORTOS, fechaCorta } from "@/lib/fechas";
import { BotonFantasma, clases } from "@/components/ui/primitivas";
import css from "./presupuesto.module.css";

/** Qué línea se está ajustando. Se identifica por su clave de reporte —categoría
 *  o par categoría-subcategoría—, que es como está indexado todo el presupuesto. */
export type EnAjuste = {
  clave: string;
  nombre: string;
  meses: Meses;
  /** El anual que ya se escribió en la fila. El cuadro abre con ese número para
   *  que el gesto no se pierda: se escribe, se ve cómo queda repartido y solo
   *  falta decir por qué. */
  propuesto: number;
};

/**
 * El cuadro de ajuste: anual nuevo, cómo queda repartido y por qué.
 *
 * El reparto se muestra antes de confirmar y no después. Bajar el anual en octubre
 * puede dejar los meses que quedan en cero, y eso no se adivina del número que uno
 * escribe: es la diferencia entre "recorté un poco" y "no queda presupuesto para
 * el resto del año".
 */
export function CuadroAjuste({
  linea,
  desde,
  confirmar,
  cancelar,
}: {
  linea: EnAjuste;
  /** Primer mes que puede moverse: el mes en curso. */
  desde: number;
  confirmar: (meses: Meses, motivo: string) => void;
  cancelar: () => void;
}) {
  const vigente = anualDe(linea.meses);
  const [texto, setTexto] = useState(String(linea.propuesto));
  const [motivo, setMotivo] = useState("");

  const nuevo = Number(texto.replace(/\D/g, ""));
  const resultado = Number.isFinite(nuevo) ? ajustarDesde(linea.meses, nuevo, desde) : null;
  const puede = resultado?.ok === true && motivo.trim().length > 0 && nuevo !== vigente;

  return (
    <div
      className={css.velo}
      role="dialog"
      aria-label={`Ajustar ${linea.nombre}`}
      onClick={cancelar}
    >
      <div className={css.cuadro} onClick={(e) => e.stopPropagation()}>
        <h2 className={css.tituloCuadro}>Ajustar {linea.nombre}</h2>

        <div className={css.filaCuadro}>
          <span className={css.etiquetaCuadro}>Anual vigente</span>
          <span className={css.cifraCuadro}>{mag(vigente)}</span>
        </div>

        <div className={css.filaCuadro}>
          <label className={css.etiquetaCuadro} htmlFor="ajuste-anual">
            Anual nuevo
          </label>
          <input
            id="ajuste-anual"
            // eslint-disable-next-line jsx-a11y/no-autofocus -- es el único campo
            // que el cuadro existe para pedir.
            autoFocus
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            className={css.entradaCuadro}
          />
        </div>

        {resultado?.ok === false ? (
          <p className={css.avisoCuadro}>
            No se puede bajar a {mag(nuevo)}: hasta{" "}
            {MESES_CORTOS[resultado.desde - 2] ?? "el mes anterior"} ya hay{" "}
            <strong>{mag(resultado.minimo)}</strong> presupuestados, y esos meses no
            se reescriben. Para bajar más hay que editar los meses a mano.
          </p>
        ) : resultado?.ok ? (
          <div className={css.repartoCuadro}>
            <p className={css.notaCuadro}>
              Los meses hasta {MESES_CORTOS[desde - 2] ?? "antes"} quedan como están.
              Se reparten <strong>{mag(resultado.repartido)}</strong> entre{" "}
              {MESES_CORTOS[desde - 1]}–dic:
            </p>
            <div className={css.mesesCuadro}>
              {resultado.meses.slice(desde - 1).map((m, i) => (
                <span key={i} className={css.mesCuadro}>
                  <span className={css.nombreMesCuadro}>
                    {MESES_CORTOS[desde - 1 + i]}
                  </span>
                  {mag(m)}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <div className={css.filaCuadro}>
          <label className={css.etiquetaCuadro} htmlFor="ajuste-motivo">
            Motivo
          </label>
          <input
            id="ajuste-motivo"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="GTD renegociado, baja 100k por mes"
            className={css.entradaMotivo}
          />
        </div>

        <div className={css.accionesCuadro}>
          <BotonFantasma onClick={cancelar}>Cancelar</BotonFantasma>
          <button
            type="button"
            disabled={!puede}
            onClick={() => resultado?.ok && confirmar(resultado.meses, motivo.trim())}
            className={css.botonAjustar}
          >
            Ajustar
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * La bitácora: qué se ajustó, cuándo y por qué.
 *
 * Agrupa por motivo y momento y no por mes: un ajuste toca varios meses de una
 * vez y listarlos sueltos convierte un cambio en seis filas que dicen lo mismo.
 */
export function Bitacora({
  cambios,
  nombreDe,
  titulo,
  cerrar,
}: {
  cambios: CambioPresupuesto[];
  /** El nombre que corresponde a una clave: el de la subcategoría cuando la hay. */
  nombreDe: (clave: string) => string;
  titulo: string;
  cerrar: () => void;
}) {
  // Agrupado por momento y línea: un ajuste toca varios meses de una vez, y
  // listarlos sueltos convierte un cambio en seis filas que dicen lo mismo.
  const porAjuste = new Map<string, CambioPresupuesto[]>();
  for (const c of cambios) {
    const k = `${c.cuando}|${clave(c.categoria_id, c.subcategoria_id)}|${c.motivo}`;
    porAjuste.set(k, [...(porAjuste.get(k) ?? []), c]);
  }

  return (
    <div className={css.velo} role="dialog" aria-label={titulo} onClick={cerrar}>
      <div className={clases(css.cuadro, css.cuadroAlto)} onClick={(e) => e.stopPropagation()}>
        <h2 className={css.tituloCuadro}>{titulo}</h2>

        {porAjuste.size === 0 ? (
          <p className={css.notaCuadro}>
            Todavía no se ajustó nada: el presupuesto está como se aprobó.
          </p>
        ) : (
          <ul className={css.listaCambios}>
            {[...porAjuste.values()].map((grupo) => {
              const primero = grupo[0]!;
              const delta = grupo.reduce((t, c) => t + (c.despues - c.antes), 0);
              const meses = grupo.map((c) => MESES_CORTOS[c.mes - 1]).join(", ");
              return (
                <li
                  key={`${primero.cuando}-${clave(primero.categoria_id, primero.subcategoria_id)}`}
                  className={css.cambio}
                >
                  <div className={css.cabezaCambio}>
                    <span className={css.lineaCambio}>
                      {nombreDe(clave(primero.categoria_id, primero.subcategoria_id))}
                    </span>
                    <span
                      className={css.deltaCambio}
                      style={{ color: delta < 0 ? "var(--brick)" : "var(--teal)" }}
                    >
                      {delta > 0 ? "+" : ""}
                      {clp(delta)}
                    </span>
                  </div>
                  <div className={css.cuandoCambio}>
                    {fechaCorta(primero.cuando.slice(0, 10))} · {meses}
                  </div>
                  <div className={css.motivoCambio}>{primero.motivo}</div>
                </li>
              );
            })}
          </ul>
        )}

        <div className={css.accionesCuadro}>
          <BotonFantasma onClick={cerrar}>Cerrar</BotonFantasma>
        </div>
      </div>
    </div>
  );
}
