"use client";

// Movimientos — registro único de todas las empresas (§6). Empresa y subcategoría
// editables inline, editor de splits desplegable, y separador visual donde la lista
// pasa del pasado al futuro.

import { Fragment, useMemo, useState } from "react";
import { EMPRESAS } from "@/lib/catalogo";
import { useTesoreria } from "@/components/estado/ProveedorTesoreria";
import { descuadre, enCLP } from "@/lib/dominio";
import { clp } from "@/lib/formato";
import { HOY, fechaCorta } from "@/lib/fechas";
import { Cabecera, Nota, Pill, Vacio, clases } from "@/components/ui/primitivas";
import { SelectorSubcategoria } from "@/components/ui/SelectorSubcategoria";
import { EditorSplits } from "./EditorSplits";
import { FormaNuevo } from "./FormaNuevo";
import css from "./movimientos.module.css";
import tabla from "@/components/ui/tabla.module.css";

const COLUMNAS = [
  "Fecha",
  "Empresa",
  "Proveedor / Cliente",
  "Glosa",
  "Subcategoría",
  "Monto",
  "Estado",
];

export function Registro() {
  const {
    movimientosFiltrados,
    tc,
    tasas,
    setTasas,
    editarMovimiento,
    editarLinea,
    agregarLinea,
    pagar,
  } = useTesoreria();

  const [busqueda, setBusqueda] = useState("");
  const [soloPendiente, setSoloPendiente] = useState(true);
  const [nuevo, setNuevo] = useState(false);
  const [abiertos, setAbiertos] = useState<string[]>([]);

  const lista = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return movimientosFiltrados
      .filter((m) => {
        // El prototipo filtraba solo por fecha ("desde hoy"), y eso escondía las
        // facturas con fecha pasada que siguen impagas — justo las que hay que
        // accionar. Acá el filtro oculta el histórico ya cerrado, no lo pendiente.
        if (soloPendiente && m.fecha < HOY && m.estado === "conciliado") return false;
        if (!q) return true;
        return (
          (m.contraparte ?? "").toLowerCase().includes(q) ||
          (m.glosa ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id.localeCompare(b.id));
  }, [movimientosFiltrados, busqueda, soloPendiente]);

  const alternar = (id: string) =>
    setAbiertos(abiertos.includes(id) ? abiertos.filter((x) => x !== id) : [...abiertos, id]);

  return (
    <>
      <Cabecera
        titulo="Movimientos"
        bajada="Registro único de todas las empresas. La empresa y la subcategoría se editan en la misma fila; los splits se abren para ver y ajustar sus líneas."
      />

      <div className={css.barra}>
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por proveedor o glosa…"
          aria-label="Buscar"
          className={css.busqueda}
        />

        <label className={css.filtroFuturo} title="Oculta el histórico ya conciliado, pero deja lo que sigue pendiente aunque tenga fecha pasada">
          <input
            type="checkbox"
            checked={soloPendiente}
            onChange={(e) => setSoloPendiente(e.target.checked)}
          />
          Solo pendiente y futuro
        </label>

        <label className={css.tasa}>
          IVA
          <input
            type="number"
            step="0.01"
            value={tasas.iva * 100}
            aria-label="Tasa de IVA"
            onChange={(e) =>
              setTasas({ ...tasas, iva: (Number(e.target.value) || 0) / 100 })
            }
            className={css.tasaInput}
          />
          %
        </label>

        <label className={css.tasa}>
          BHE
          <input
            type="number"
            step="0.01"
            value={tasas.bhe * 100}
            aria-label="Tasa de retención de honorarios"
            onChange={(e) =>
              setTasas({ ...tasas, bhe: (Number(e.target.value) || 0) / 100 })
            }
            className={css.tasaInput}
          />
          %
        </label>

        <button
          type="button"
          onClick={() => setNuevo(!nuevo)}
          className={clases(css.botonNuevo, nuevo && css.botonNuevoActivo)}
        >
          {nuevo ? "Cancelar" : "+ Nuevo"}
        </button>
      </div>

      {nuevo && <FormaNuevo cerrar={() => setNuevo(false)} />}

      {lista.length === 0 ? (
        <Vacio>
          No hay movimientos que coincidan.
          {soloPendiente && " Prueba desactivando «Solo pendiente y futuro»."}
        </Vacio>
      ) : (
        <div className={tabla.envoltorio}>
          <table className={tabla.tabla} style={{ minWidth: 940 }}>
            <thead>
              <tr>
                {COLUMNAS.map((h, i) => (
                  <th key={h} className={clases(tabla.th, i === 5 && tabla.thNum)}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lista.map((m, i) => {
                const anterior = lista[i - 1];
                const cruzaHoy = anterior !== undefined && anterior.fecha < HOY && m.fecha >= HOY;
                const abierto = abiertos.includes(m.id);
                const dif = descuadre(m);
                const esSplit = m.lineas.length > 1;
                const valor = enCLP(m, tc);

                return (
                  <Fragment key={m.id}>
                    {cruzaHoy && (
                      <tr className={css.separadorFuturo}>
                        <td colSpan={COLUMNAS.length}>
                          <div className={css.lineaFuturo}>
                            <span className={css.etiquetaFuturo}>FUTURO</span>
                          </div>
                        </td>
                      </tr>
                    )}

                    <tr className="fila">
                      <td className={clases(tabla.td, css.fecha)}>{fechaCorta(m.fecha)}</td>

                      <td className={tabla.td}>
                        <select
                          value={m.empresa_id}
                          aria-label="Empresa"
                          onChange={(e) => editarMovimiento(m.id, "empresa_id", e.target.value)}
                          className={css.selectEmpresa}
                        >
                          {EMPRESAS.map((e) => (
                            <option key={e.id} value={e.id}>
                              {e.corto}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className={clases(tabla.td, css.contraparte)}>{m.contraparte}</td>
                      <td className={clases(tabla.td, css.glosa)} title={m.glosa ?? ""}>
                        {m.glosa}
                      </td>

                      <td className={tabla.td}>
                        {esSplit ? (
                          <button
                            type="button"
                            onClick={() => alternar(m.id)}
                            aria-expanded={abierto}
                            className={css.botonSplit}
                          >
                            {abierto ? "▾" : "▸"} Split · {m.lineas.length} líneas
                            {dif !== 0 && <span className={css.alerta}>⚠</span>}
                          </button>
                        ) : (
                          <>
                            <SelectorSubcategoria
                              valor={m.lineas[0]?.subcategoria_id ?? null}
                              onChange={(id) =>
                                m.lineas.length
                                  ? editarLinea(m.id, 0, "subcategoria_id", id)
                                  : editarMovimiento(m.id, "lineas", [
                                      { subcategoria_id: id, monto: m.monto, glosa: null },
                                    ])
                              }
                            />
                            <button
                              type="button"
                              title="Abrir como split para repartir en varias líneas"
                              onClick={() => {
                                if (!abierto) alternar(m.id);
                                agregarLinea(m.id);
                              }}
                              className={css.botonAmpliar}
                            >
                              ⊞
                            </button>
                          </>
                        )}
                      </td>

                      <td
                        className={clases(tabla.td, css.monto)}
                        style={{ color: valor < 0 ? "var(--brick)" : "var(--teal)" }}
                      >
                        {m.moneda === "USD" && (
                          <div className={css.montoUsd}>
                            US${clp(m.monto)} @{m.tipo_cambio ?? tc}
                          </div>
                        )}
                        {clp(valor)}
                      </td>

                      <td className={tabla.td}>
                        {m.estado === "proyectado" ? (
                          <button
                            type="button"
                            onClick={() => pagar(m.id)}
                            title="Sacarlo de proyectado: pasa a afectar el saldo de la cuenta"
                            className={css.botonAmpliar}
                          >
                            Marcar pagado
                          </button>
                        ) : (
                          <Pill estado={m.estado} />
                        )}
                      </td>
                    </tr>

                    {abierto && <EditorSplits movimiento={m} />}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Nota>
        Los impuestos van en su propia línea del split y viajan a{" "}
        <strong>4 IMPUESTOS</strong>, sumando o restando en el flujo hasta dar el monto
        exacto que salió del banco. Los helpers calculan, pero el monto de cada línea
        queda editable: si la factura dice otra cosa, <strong>manda la factura</strong>.
        Un movimiento pasa de <em>proyectado</em> a <em>pagado</em> cuando sale del banco,
        y ahí recién afecta el saldo.
      </Nota>
    </>
  );
}
