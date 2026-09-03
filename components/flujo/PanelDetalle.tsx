"use client";

// Detalle de una celda del flujo: los movimientos que componen ese monto, con la
// subcategoría editable ahí mismo. Es lo que convierte el reporte en algo con lo que
// se trabaja en vez de sólo mirarlo (§6).

import { useEffect } from "react";
import { empresaDe } from "@/lib/catalogo-indices";
import { enCLP } from "@/lib/dominio";
import { clp } from "@/lib/formato";
import { fechaCorta } from "@/lib/fechas";
import type { LineaExpandida } from "@/lib/tipos";
import { Insignia, Pill } from "@/components/ui/primitivas";
import { SelectorSubcategoria } from "@/components/ui/SelectorSubcategoria";
import css from "./panel.module.css";

export type Detalle = {
  titulo: string;
  periodo: string;
  items: LineaExpandida[];
};

export function PanelDetalle({
  detalle,
  cerrar,
  tc,
  reclasificar,
}: {
  detalle: Detalle;
  cerrar: () => void;
  tc: number;
  /** Enruta al movimiento o a la línea del split según de dónde venga la fila. */
  reclasificar: (fila: LineaExpandida, subcategoria_id: string) => void;
}) {
  const total = detalle.items.reduce((s, m) => s + enCLP(m, tc), 0);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrar();
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [cerrar]);

  return (
    <div className={css.fondo} onClick={cerrar} role="presentation">
      <div
        className={css.panel}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Detalle de ${detalle.titulo}`}
      >
        <div className={css.cabeceraPanel}>
          <div className={css.tituloBloque}>
            <div className={css.periodo}>{detalle.periodo}</div>
            <div className={css.titulo}>{detalle.titulo}</div>
          </div>
          <div className={css.totalBloque}>
            <div className={css.periodo}>
              {detalle.items.length} {detalle.items.length === 1 ? "mov" : "movs"}
            </div>
            <div
              data-testid="total-detalle"
              className={css.total}
              style={{ color: total < 0 ? "var(--brick)" : "var(--teal)" }}
            >
              {clp(total)}
            </div>
          </div>
          <button type="button" onClick={cerrar} className={css.cerrar} aria-label="Cerrar">
            ×
          </button>
        </div>

        <div className={css.lista}>
          <table className={css.tablaDetalle}>
            <tbody>
              {detalle.items.map((m) => {
                const valor = enCLP(m, tc);
                return (
                  <tr key={`${m.movimiento_id}-${m.indice_linea ?? "u"}`} className="fila">
                    <td className={css.celdaFecha}>{fechaCorta(m.fecha)}</td>
                    <td className={css.celdaCuerpo}>
                      <div className={css.lineaTitulo}>
                        <span className={css.contraparte}>{m.contraparte}</span>
                        {/* Nombre completo y no la abreviatura: CONS y CLTG obligan a
                            recordar cuál es CLA CONSULTORES y cuál CLA CONSULTING, que
                            es justo el par que más se parece.
                            Sin empresa: una proyección que todavía no sabe por qué
                            sociedad se gestiona. Se marca en vez de dejarlo en blanco,
                            para que se note que falta asignarla. */}
                        <span className={css.empresa}>
                          {m.empresa_id ? empresaDe(m.empresa_id).nombre : "SIN EMPRESA"}
                        </span>
                        <Pill estado={m.estado} />
                      </div>
                      <div className={css.glosa}>{m.glosa}</div>
                      <div className={css.lineaControles}>
                        {m.indice_linea !== null && <Insignia>línea de split</Insignia>}
                        <SelectorSubcategoria
                          valor={m.subcategoria_id}
                          onChange={(id) => reclasificar(m, id)}
                        />
                      </div>
                    </td>
                    <td
                      className={css.celdaMonto}
                      style={{ color: valor < 0 ? "var(--brick)" : "var(--teal)" }}
                    >
                      {m.moneda === "USD" && (
                        <div className={css.montoUsd}>
                          US${clp(m.monto)} @{m.tipo_cambio ?? tc}
                        </div>
                      )}
                      {clp(valor)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className={css.pie}>
          Si algo está mal clasificado, cámbialo en el selector y el flujo se recalcula.
          Los movimientos con split aparecen como líneas separadas. Esc para salir.
        </div>
      </div>
    </div>
  );
}
