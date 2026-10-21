"use client";

// Escribir la proyección del año que viene.
//
// Primero esto copiaba los movimientos del año anterior y se elegía qué traer. La
// idea era buena para **saber qué se paga** y mala para **decidir qué se va a
// pagar**: el pasado viene con su desorden —un proveedor que aparece una vez con
// un monto enorme, una categoría que ya no se usa— y además la mitad de los
// montos cambian igual, porque los sueldos suben, el IMA se renegocia y el IVA
// sale de las ventas del mes.
//
// Así que la proyección se escribe: proveedor, categoría, monto, día y cada
// cuánto. Y lo que se pagó el año pasado queda al lado, como consulta, con un
// botón para traer una línea ya rellena — para no tener que acordarse de los
// treinta y siete pagos, pero que cada número que quede sea uno elegido.

import { useMemo, useRef, useState } from "react";
import { useTesoreria } from "@/components/estado/ProveedorTesoreria";
import {
  PASO,
  lineaDesdeRama,
  mesesDeLinea,
  type Cadencia,
  type LineaRecurrente,
  type Rama,
  type ResumenCategoria,
} from "@/lib/proyeccion";
import { clp, mag } from "@/lib/formato";
import { MESES, MESES_CORTOS, mesLargo } from "@/lib/fechas";
import { SelectorCategoria } from "@/components/ui/SelectorCategoria";
import { BotonFantasma, clases } from "@/components/ui/primitivas";
import css from "./presupuesto.module.css";

const CADENCIAS = Object.keys(PASO) as Cadencia[];
const claveDeRama = (r: Rama) => `${r.categoria_id}|${r.contraparte}`;

export function ProyectarAnio({
  resumen,
  anio,
  ventana,
  nombreDe,
  cuantosMovimientos,
  totalDe,
  yaGenerados,
  confirmar,
  cancelar,
}: {
  resumen: ResumenCategoria[];
  anio: number;
  ventana: { desde: string; hasta: string };
  nombreDe: (categoria_id: string) => string;
  /** Cuántos movimientos saldrían de estas líneas. */
  cuantosMovimientos: (lineas: LineaRecurrente[]) => number;
  /** Cuánto suman, con el signo ya resuelto por la naturaleza. */
  totalDe: (lineas: LineaRecurrente[]) => number;
  /** Cuántos ya se generaron antes para este año. Proyectar los reemplaza. */
  yaGenerados: number;
  confirmar: (lineas: LineaRecurrente[]) => void;
  cancelar: () => void;
}) {
  // Las cuentas del contexto van sin filtrar por empresa a propósito: el
  // presupuesto es consolidado y el filtro global no aplica (§4.6).
  const { cuentas, empresas } = useTesoreria();
  const deBanco = useMemo(
    () => cuentas.filter((c) => c.tipo === "banco" && c.moneda === "CLP"),
    [cuentas]
  );
  const nombreEmpresa = (id: string) => empresas.find((e) => e.id === id)?.corto ?? id;

  const [vista, setVista] = useState<"escribir" | "historia">("escribir");
  const [cuentaId, setCuentaId] = useState("");
  const [lineas, setLineas] = useState<LineaRecurrente[]>([]);
  const [abiertas, setAbiertas] = useState<Set<string>>(new Set());
  const siguiente = useRef(0);

  const nuevaId = () => `l${++siguiente.current}`;

  const agregar = (l?: LineaRecurrente) =>
    setLineas((p) => [
      ...p,
      l ?? {
        id: nuevaId(),
        contraparte: "",
        categoria_id: "",
        subcategoria_id: null,
        monto: 0,
        dia: 1,
        cada: "mensual",
        desde: 1,
        empresa_id: null,
        cuenta_id: null,
        moneda: "CLP",
      },
    ]);

  const editar = <K extends keyof LineaRecurrente>(
    id: string,
    campo: K,
    valor: LineaRecurrente[K]
  ) => setLineas((p) => p.map((l) => (l.id === id ? { ...l, [campo]: valor } : l)));

  const quitar = (id: string) => setLineas((p) => p.filter((l) => l.id !== id));

  const traer = (r: Rama) => {
    agregar(lineaDesdeRama(r, nuevaId()));
    setVista("escribir");
  };

  const alternarAbierta = (id: string) =>
    setAbiertas((p) => {
      const s = new Set(p);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });

  // La cuenta manda: ella determina empresa y moneda (§2). Un movimiento sin
  // cuenta la base lo rechaza —`empresa_id` y `cuenta_id` son not null—, así que
  // sin elegirla no hay nada que crear.
  const cuenta = deBanco.find((c) => c.id === cuentaId) ?? null;

  // Solo las completas generan algo: sin categoría el movimiento no llegaría al
  // presupuesto, y sin monto no hay nada que proyectar.
  const listas = cuenta
    ? lineas
        .filter((l) => l.categoria_id && l.monto !== 0)
        .map((l) => ({
          ...l,
          empresa_id: cuenta.empresa_id,
          cuenta_id: cuenta.id,
          moneda: cuenta.moneda,
        }))
    : [];
  const cuantos = cuantosMovimientos(listas);
  const total = totalDe(listas);
  const incompletas = lineas.filter((l) => !l.categoria_id || l.monto === 0).length;

  return (
    <div className={css.velo} role="dialog" aria-label={`Proyectar ${anio}`} onClick={cancelar}>
      <div
        className={clases(css.cuadro, css.cuadroAlto, css.cuadroAncho)}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className={css.tituloCuadro}>Proyectar {anio}</h2>

        <div className={css.pestanas}>
          <button
            type="button"
            onClick={() => setVista("escribir")}
            aria-pressed={vista === "escribir"}
            className={clases(css.pestana, vista === "escribir" && css.pestanaActiva)}
          >
            Escribir las líneas
          </button>
          <button
            type="button"
            onClick={() => setVista("historia")}
            aria-pressed={vista === "historia"}
            className={clases(css.pestana, vista === "historia" && css.pestanaActiva)}
          >
            Lo que pagué el año pasado
          </button>
        </div>

        {yaGenerados > 0 && (
          <p className={css.avisoCuadro}>
            Ya hay <strong>{yaGenerados}</strong>{" "}
            {yaGenerados === 1 ? "movimiento generado" : "movimientos generados"} para {anio} y{" "}
            {yaGenerados === 1 ? "se reemplaza" : "se reemplazan"}. Si les ajustaste montos a
            mano, esos ajustes se pierden. Lo que cargaste vos desde cero no se toca.
          </p>
        )}

        {vista === "escribir" ? (
          <>
            <p className={css.notaCuadro}>
              Cada línea es un pago que se repite. El signo lo pone la categoría: un gasto sale
              negativo sin que haya que escribir el menos. Todo en pesos — un pago en dólares
              se carga después como movimiento.
            </p>

            {/* La cuenta va una sola vez y no por línea: casi todo se paga desde la
                misma, y cada movimiento queda editable después. Sin preseleccionar,
                porque elegirla mueve plata de empresa (§2). */}
            <label className={css.campoCuadro}>
              Paga desde
              <select
                value={cuentaId}
                onChange={(e) => setCuentaId(e.target.value)}
                className={css.selectLinea}
              >
                <option value="">— elegí la cuenta —</option>
                {deBanco.map((c) => (
                  <option key={c.id} value={c.id}>
                    {nombreEmpresa(c.empresa_id)} · {c.nombre}
                  </option>
                ))}
              </select>
            </label>

            <div className={css.listaPrevia}>
              <table className={css.tablaPrevia}>
                <thead>
                  <tr>
                    <th>Proveedor</th>
                    <th>Categoría</th>
                    <th className={css.numPrevia}>Monto</th>
                    <th className={css.numPrevia}>Día</th>
                    <th>Cada</th>
                    <th>Desde</th>
                    <th className={css.numPrevia}>Movs</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {lineas.map((l, i) => (
                    <tr key={l.id}>
                      <td>
                        <input
                          value={l.contraparte}
                          onChange={(e) => editar(l.id, "contraparte", e.target.value)}
                          placeholder="Entel"
                          aria-label={`Proveedor de la línea ${i + 1}`}
                          className={css.entradaLinea}
                        />
                      </td>
                      <td className={css.celdaCategoria}>
                        <SelectorCategoria
                          valor={l.categoria_id || null}
                          onChange={(id) => editar(l.id, "categoria_id", id)}
                          compacto
                        />
                      </td>
                      <td className={css.numPrevia}>
                        <input
                          type="number"
                          value={l.monto || ""}
                          onChange={(e) => editar(l.id, "monto", Number(e.target.value) || 0)}
                          placeholder="0"
                          aria-label={`Monto de la línea ${i + 1}`}
                          className={clases(css.entradaLinea, css.entradaMontoLinea)}
                        />
                      </td>
                      <td className={css.numPrevia}>
                        <input
                          type="number"
                          min={1}
                          max={31}
                          value={l.dia}
                          onChange={(e) => editar(l.id, "dia", Number(e.target.value) || 1)}
                          aria-label={`Día de la línea ${i + 1}`}
                          className={css.entradaMeses}
                        />
                      </td>
                      <td>
                        <select
                          value={l.cada}
                          onChange={(e) => editar(l.id, "cada", e.target.value as Cadencia)}
                          aria-label={`Cada cuánto cae la línea ${i + 1}`}
                          className={css.selectLinea}
                        >
                          {CADENCIAS.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select
                          value={l.desde}
                          onChange={(e) => editar(l.id, "desde", Number(e.target.value))}
                          aria-label={`Desde qué mes cae la línea ${i + 1}`}
                          className={css.selectLinea}
                        >
                          {MESES.map((m, j) => (
                            <option key={m} value={j + 1}>
                              {MESES_CORTOS[j]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className={css.numPrevia}>
                        {l.categoria_id && l.monto ? mesesDeLinea(l.cada, l.desde).length : "—"}
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() => quitar(l.id)}
                          aria-label={`Quitar la línea ${i + 1}`}
                          className={css.borrarLinea}
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {lineas.length === 0 && (
                <p className={css.vacioLineas}>
                  Todavía no hay líneas. Escribí una, o traelas desde lo que pagaste el año
                  pasado.
                </p>
              )}
            </div>

            <div className={css.barraElegir}>
              <BotonFantasma onClick={() => agregar()}>+ línea</BotonFantasma>
              <span className={css.empuje} />
              <span className={css.cuentaElegidas}>
                {!cuenta && lineas.length > 0 && (
                  <span className={css.mesesPocos}>falta la cuenta · </span>
                )}
                {incompletas > 0 && (
                  <span className={css.mesesPocos}>{incompletas} sin completar · </span>
                )}
                {listas.length} {listas.length === 1 ? "línea" : "líneas"} · {cuantos}{" "}
                {cuantos === 1 ? "movimiento" : "movimientos"} · {clp(total)}
              </span>
            </div>
          </>
        ) : (
          <>
            <p className={css.notaCuadro}>
              De {mesLargo(ventana.desde)} a {mesLargo(ventana.hasta)}, por proveedor.{" "}
              <strong>Traer</strong> escribe la línea con el monto por mes y el día que más se
              repitió, y queda editable.
            </p>

            <div className={css.listaPrevia}>
              {resumen.map((c) => {
                const abierta = abiertas.has(c.categoria_id);
                return (
                  <div key={c.categoria_id} className={css.grupoHistoria}>
                    <button
                      type="button"
                      onClick={() => alternarAbierta(c.categoria_id)}
                      aria-expanded={abierta}
                      className={css.abrirRama}
                    >
                      <span className={clases(css.flechaRama, abierta && css.flechaAbierta)}>
                        ▸
                      </span>
                      {nombreDe(c.categoria_id)}
                      <span className={css.cuantosProveedores}>
                        {c.ramas.length} {c.ramas.length === 1 ? "proveedor" : "proveedores"} ·{" "}
                        {mag(c.total)}
                      </span>
                    </button>

                    {abierta && (
                      <table className={css.tablaPrevia}>
                        <tbody>
                          {c.ramas.map((r) => (
                            <tr key={claveDeRama(r)}>
                              <td className={css.nombreRama}>
                                {r.contraparte || "sin proveedor"}
                              </td>
                              <td
                                className={clases(
                                  css.numPrevia,
                                  r.meses.length <= 2 && css.mesesPocos
                                )}
                              >
                                {r.meses.length} {r.meses.length === 1 ? "mes" : "meses"}
                              </td>
                              <td className={css.numPrevia}>{mag(r.promedio)} / mes</td>
                              <td className={css.numPrevia}>{mag(r.total)}</td>
                              <td className={css.numPrevia}>
                                <button
                                  type="button"
                                  onClick={() => traer(r)}
                                  aria-label={`Traer ${r.contraparte || "sin proveedor"} de ${nombreDe(c.categoria_id)}`}
                                  className={css.botonTraer}
                                >
                                  traer
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div className={css.accionesCuadro}>
          <BotonFantasma onClick={cancelar}>Cancelar</BotonFantasma>
          <button
            type="button"
            disabled={cuantos === 0}
            onClick={() => confirmar(listas)}
            className={css.botonAjustar}
          >
            Crear {cuantos} {cuantos === 1 ? "movimiento" : "movimientos"}
          </button>
        </div>
      </div>
    </div>
  );
}
