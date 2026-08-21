"use client";

// Editor de splits. Los splits son la norma, no la excepción (§4.3): casi todos los
// movimientos tienen varias líneas, y los impuestos van en su propia línea con su
// propio signo hasta dar el monto exacto que salió del banco.

import { useRef, useState } from "react";
import { useTesoreria } from "@/components/estado/ProveedorTesoreria";
import { descuadre } from "@/lib/dominio";
import { clp, pct } from "@/lib/formato";
import type { Movimiento } from "@/lib/tipos";
import { SelectorSubcategoria } from "@/components/ui/SelectorSubcategoria";
import { clases } from "@/components/ui/primitivas";
import css from "./movimientos.module.css";
import tabla from "@/components/ui/tabla.module.css";

const EJEMPLO_PEGADO =
  "Pega el detalle de la cartola o del estado de cuenta:\nAnthropic Claude   96.400\nUber corporativo   72.100";

export function EditorSplits({ movimiento }: { movimiento: Movimiento }) {
  const {
    tasas,
    editarLinea,
    agregarLinea,
    quitarLinea,
    quitarSplit,
    cuadrar,
    aplicarImpuesto,
    pegarLineas,
  } = useTesoreria();

  const [pegando, setPegando] = useState(false);
  const texto = useRef("");

  const dif = descuadre(movimiento);
  const m = movimiento;

  return (
    <>
      {m.lineas.map((l, i) => (
        <tr key={`${m.id}-l${i}`} className={css.filaLinea}>
          <td colSpan={3} />
          <td className={clases(tabla.td, tabla.sangria)}>
            <input
              value={l.glosa ?? ""}
              placeholder="glosa de la línea"
              aria-label="Glosa de la línea"
              onChange={(e) => editarLinea(m.id, i, "glosa", e.target.value)}
              className={css.inputGlosa}
            />
          </td>
          <td className={tabla.td}>
            <SelectorSubcategoria
              valor={l.subcategoria_id}
              onChange={(id) => editarLinea(m.id, i, "subcategoria_id", id)}
              compacto
            />
          </td>
          <td className={tabla.td}>
            <input
              type="number"
              value={l.monto}
              aria-label="Monto de la línea"
              onChange={(e) => editarLinea(m.id, i, "monto", Number(e.target.value) || 0)}
              className={css.inputMonto}
              style={{ color: l.monto < 0 ? "var(--brick)" : "var(--teal)" }}
            />
          </td>
          <td className={tabla.td}>
            <button
              type="button"
              onClick={() => quitarLinea(m.id, i)}
              disabled={m.lineas.length <= 1}
              title={
                m.lineas.length <= 1
                  ? "Un movimiento tiene que quedar con al menos una línea"
                  : "Eliminar línea"
              }
              className={css.quitar}
            >
              ×
            </button>
          </td>
        </tr>
      ))}

      <tr className={css.filaAcciones}>
        <td colSpan={3} />
        <td colSpan={2} className={clases(tabla.td, tabla.sangria)}>
          <div className={css.acciones}>
            <button type="button" onClick={() => agregarLinea(m.id)} className={css.botonAmpliar}>
              + línea
            </button>
            <button
              type="button"
              onClick={() => aplicarImpuesto(m.id, "iva")}
              title="Suma IVA sobre el neto y recalcula el total a pagar"
              className={clases(css.botonAmpliar, css.botonImpuesto)}
            >
              + IVA {pct(tasas.iva)}
            </button>
            <button
              type="button"
              onClick={() => aplicarImpuesto(m.id, "bhe")}
              title="Resta la retención del bruto y recalcula el líquido a pagar"
              className={clases(css.botonAmpliar, css.botonImpuesto)}
            >
              − Retención {pct(tasas.bhe)}
            </button>
            <button
              type="button"
              onClick={() => setPegando(!pegando)}
              className={css.botonAmpliar}
            >
              Pegar detalle
            </button>
            {dif !== 0 && (
              <button
                type="button"
                onClick={() => cuadrar(m.id)}
                className={clases(css.botonAmpliar, css.botonCuadrar)}
              >
                Cuadrar diferencia
              </button>
            )}
            {m.lineas.length > 1 && (
              <button type="button" onClick={() => quitarSplit(m.id)} className={css.botonAmpliar}>
                Quitar split
              </button>
            )}
          </div>

          {pegando && (
            <div className={css.bloquePegado}>
              <textarea
                rows={4}
                placeholder={EJEMPLO_PEGADO}
                aria-label="Detalle a pegar"
                onChange={(e) => (texto.current = e.target.value)}
                className={css.textarea}
              />
              <button
                type="button"
                onClick={() => {
                  pegarLineas(m.id, texto.current);
                  setPegando(false);
                  texto.current = "";
                }}
                className={css.botonAmpliar}
              >
                Crear líneas
              </button>
              <span className={css.pistaPegado}>
                Toma el último número de cada fila como monto y el resto como glosa.
              </span>
            </div>
          )}
        </td>
        <td className={clases(css.estadoCuadre, dif === 0 ? css.cuadrado : css.descuadrado)}>
          {dif === 0 ? "cuadrado" : `dif ${clp(dif)}`}
        </td>
        <td />
      </tr>
    </>
  );
}
