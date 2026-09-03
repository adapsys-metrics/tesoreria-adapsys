"use client";

// Editor completo de un movimiento, desplegado debajo de su fila.
//
// Las transiciones de estado no son un campo del formulario sino botones: pasar de
// proyectado a pagado mueve el saldo de la cuenta (§4.1), y eso no puede ocurrir
// como efecto colateral de cambiar un <select>.

import { useTesoreria } from "@/components/estado/ProveedorTesoreria";
import { enCLP } from "@/lib/dominio";
import { clp } from "@/lib/formato";
import type { DocTipo, Movimiento } from "@/lib/tipos";
import { Pill, clases } from "@/components/ui/primitivas";
import { pasoDe } from "@/lib/cobranza";
import { EditorSplits } from "./EditorSplits";
import { SelectorCuenta } from "./SelectorCuenta";
import css from "./movimientos.module.css";

const DOCS: { id: DocTipo; nombre: string }[] = [
  { id: "exento", nombre: "Exento" },
  { id: "afecta", nombre: "Afecta" },
  { id: "honorario", nombre: "Honorario" },
];

export function EditorMovimiento({ movimiento: m }: { movimiento: Movimiento }) {
  const { tc, cuentas, editarMovimiento, cambiarCuenta, pagar, conciliar, avanzarCobranza } =
    useTesoreria();

  const paso = pasoDe(m, cuentas);

  return (
    <div className={css.editor}>
      {/* Facturar se confirma acá y no en la fila: al emitir cambia el número,
          pero también la fecha —que pasa de estimada a firme— y a veces el monto.
          Un campo suelto en la fila obligaba a abrir el editor igual y a escribir
          el número dos veces. */}
      {paso.accion === "facturar" && (
        <div className={css.franjaFacturar}>
          <div>
            <strong>Emitir factura.</strong> Revisa el número, la fecha y el monto
            definitivos; al confirmar pasa a {paso.destino.nombre} y sigue siendo plata
            por entrar.
          </div>
          <button
            type="button"
            onClick={() => avanzarCobranza(m.id)}
            disabled={!m.documento?.trim()}
            title={
              m.documento?.trim()
                ? `Pasa a ${paso.destino.nombre}`
                : "Falta el número de documento"
            }
            className={css.botonEmitir}
          >
            Emitir y pasar a cobranza
          </button>
        </div>
      )}
      <div className={css.camposEditor}>
        <label className={css.campo}>
          <span className={css.etiquetaCampo}>Fecha</span>
          <input
            type="date"
            value={m.fecha}
            onChange={(e) => editarMovimiento(m.id, "fecha", e.target.value)}
            className={css.entrada}
          />
        </label>

        <label className={clases(css.campo, css.campoAncho)}>
          <span className={css.etiquetaCampo}>Cuenta</span>
          <SelectorCuenta valor={m.cuenta_id} onChange={(id) => cambiarCuenta(m.id, id)} />
        </label>

        <label className={css.campo}>
          <span className={css.etiquetaCampo}>Proveedor / Cliente</span>
          <input
            value={m.contraparte ?? ""}
            onChange={(e) => editarMovimiento(m.id, "contraparte", e.target.value)}
            className={css.entrada}
          />
        </label>

        <label className={clases(css.campo, css.campoAncho)}>
          <span className={css.etiquetaCampo}>Glosa</span>
          <input
            value={m.glosa ?? ""}
            onChange={(e) => editarMovimiento(m.id, "glosa", e.target.value)}
            className={css.entrada}
          />
        </label>

        <label className={css.campo}>
          <span className={css.etiquetaCampo}>
            Monto {m.moneda === "USD" ? "(US$)" : "(CLP)"}
          </span>
          <input
            type="number"
            value={m.monto}
            aria-label="Monto del movimiento"
            onChange={(e) => editarMovimiento(m.id, "monto", Number(e.target.value) || 0)}
            className={css.entrada}
          />
        </label>

        {/* La moneda no es un campo: sale de la cuenta y no cambia nunca. */}
        {m.moneda === "USD" && (
          <label className={css.campo}>
            <span className={css.etiquetaCampo}>TC del día</span>
            <input
              type="number"
              value={m.tipo_cambio ?? tc}
              aria-label="Tipo de cambio"
              onChange={(e) =>
                editarMovimiento(m.id, "tipo_cambio", Number(e.target.value) || null)
              }
              className={css.entrada}
            />
          </label>
        )}

        <label className={css.campo}>
          <span className={css.etiquetaCampo}>N° documento</span>
          <input
            value={m.documento ?? ""}
            onChange={(e) => editarMovimiento(m.id, "documento", e.target.value || null)}
            placeholder="FA3109609"
            aria-label="Número de documento"
            className={css.entrada}
          />
        </label>

        <label className={css.campo}>
          <span className={css.etiquetaCampo}>Tipo de documento</span>
          <select
            value={m.doc_tipo ?? ""}
            onChange={(e) =>
              editarMovimiento(m.id, "doc_tipo", (e.target.value || null) as DocTipo | null)
            }
            className={css.entrada}
          >
            <option value="">—</option>
            {DOCS.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nombre}
              </option>
            ))}
          </select>
        </label>

        <div className={css.campo}>
          <span className={css.etiquetaCampo}>Estado</span>
          <div className={css.acciones}>
            <Pill estado={m.estado} />
            {m.estado === "proyectado" && (
              <button
                type="button"
                onClick={() => pagar(m.id)}
                title="Salió del banco: pasa a afectar el saldo de la cuenta"
                className={css.botonAmpliar}
              >
                Marcar pagado
              </button>
            )}
            {m.estado === "pagado" && (
              <button
                type="button"
                onClick={() => conciliar(m.id)}
                title="Cuadrado contra la cartola"
                className={css.botonAmpliar}
              >
                Conciliar
              </button>
            )}
          </div>
        </div>
      </div>

      {m.moneda === "USD" && (
        <div className={css.equivalencia}>
          Equivale a {clp(enCLP(m, tc))} CLP al TC de este movimiento. El flujo se lleva sólo en
          pesos, así que en el reporte aparece convertido con este tipo de cambio, no con el del
          día en que se mire.
        </div>
      )}

      <EditorSplits movimiento={m} />
    </div>
  );
}
