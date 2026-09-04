"use client";

// Control presupuestario anual (§4.6). Réplica de la planilla que hoy se arma a
// mano, con la diferencia de que el "real" no se copia de un export: se calcula
// de los movimientos.
//
// Es consolidado para las cuatro empresas Adapsys y NO usa el filtro global de
// empresas — por eso lee `movimientos` y no `movimientosFiltrados`.

import { useEffect, useMemo, useState } from "react";
import { IDS_ADAPSYS, RESPONSABLES } from "@/lib/catalogo";
import { useTesoreria } from "@/components/estado/ProveedorTesoreria";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { supabaseConfigurado } from "@/lib/supabase/estado";
import {
  cargarPresupuesto,
  guardarLineaPresupuesto,
  type PresupuestoDelAnio,
} from "@/lib/supabase/presupuesto";
import {
  MESES_DEL_ANIO,
  SECCIONES,
  distribucionOperativa,
  distribuirLineal,
  ejecutadoPorCategoria,
  entraAlPresupuesto,
  filaDe,
  finDeMes,
  presupuestoAgotado,
  reescalar,
  sobreRitmo,
  totalizar,
  type FilaPresupuesto,
  type Meses,
} from "@/lib/presupuesto";
import { HOY } from "@/lib/fechas";
import { expandir } from "@/lib/dominio";
import { PanelDetalle, type Detalle } from "@/components/flujo/PanelDetalle";
import type { LineaExpandida } from "@/lib/tipos";
import { clp, mag, pct } from "@/lib/formato";
import { Cabecera, Rotulo, clases } from "@/components/ui/primitivas";
import tabla from "@/components/ui/tabla.module.css";
import css from "./presupuesto.module.css";

const NOMBRES_MES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const LINEA_VACIA = { monto: 0, monto_anterior: 0, responsable: "", nota: "" };
const sinMeses = (): Meses => Array<number>(MESES_DEL_ANIO).fill(0);


export function Presupuesto() {
  const { movimientos, tc, editarLinea, editarMovimiento, catalogo } = useTesoreria();
  const esOperativa = (id: string) => catalogo.categoriaDe(id).naturaleza === "operativo";
  const [detalle, setDetalle] = useState<Detalle | null>(null);

  const [anio, setAnio] = useState(() => Number(HOY.slice(0, 4)));
  const [mes, setMes] = useState(() => Number(HOY.slice(5, 7)));
  const [datos, setDatos] = useState<PresupuestoDelAnio>({
    meses: new Map(),
    metadata: new Map(),
  });
  const [cargando, setCargando] = useState(supabaseConfigurado);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabaseConfigurado) return;
    let vigente = true;
    setCargando(true);
    cargarPresupuesto(crearClienteNavegador(), anio)
      .then((d) => vigente && setDatos(d))
      .catch((e: Error) => vigente && setError(e.message))
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
  }, [anio]);

  /** Guarda una línea y la refleja en pantalla. El estado se actualiza primero:
   *  si falla, la banda de error avisa que lo que se ve no es lo que hay. */
  const guardar = (sub: string, meses: Meses, linea = datos.metadata.get(sub) ?? LINEA_VACIA) => {
    setDatos((p) => ({
      meses: new Map(p.meses).set(sub, meses),
      metadata: new Map(p.metadata).set(sub, linea),
    }));
    if (!supabaseConfigurado) return;
    guardarLineaPresupuesto(crearClienteNavegador(), anio, sub, linea, meses).catch(
      (e: Error) => setError(e.message)
    );
  };

  // Solo las cuatro del grupo Adapsys (§4.6). SANTA MARÍA comparte el sistema pero
  // no el presupuesto, y sumar sus gastos inflaría líneas que las cuatro no
  // gastaron. Se filtra una vez acá y todo lo que sigue —ejecutado, distribución y
  // el detalle que se abre al hacer clic— parte de la misma base.
  const delPresupuesto = useMemo(
    () => movimientos.filter((m) => entraAlPresupuesto(m, IDS_ADAPSYS)),
    [movimientos]
  );

  const ejecutado = useMemo(
    () => ejecutadoPorCategoria(delPresupuesto, anio, mes, tc),
    [delPresupuesto, anio, mes, tc]
  );

  /** Las líneas que componen un monto de la columna "gasto a la fecha".
   *  Se filtra igual que ejecutadoPorCategoria —mismo rango, mismos estados—
   *  para que lo que se abre sume exactamente lo que se ve. */
  const lineasDe = (subs: Set<string>): LineaExpandida[] => {
    const desde = `${anio}-01-01`;
    const hasta = finDeMes(anio, mes);
    return expandir(delPresupuesto).filter(
      (f) =>
        f.estado !== "proyectado" &&
        f.fecha >= desde &&
        f.fecha <= hasta &&
        f.categoria_id !== null &&
        subs.has(f.categoria_id)
    );
  };

  const abrir = (titulo: string, subs: Set<string>) => {
    const items = lineasDe(subs);
    if (!items.length) return;
    setDetalle({ titulo, periodo: `Enero a ${NOMBRES_MES[mes - 1]} de ${anio}`, items });
  };

  /** Fija el detalle de la línea. Solo se puede sobre una línea que ya existe: sin
   *  categoría no hay subcategoría de la cual colgar. */
  const detallar = (fila: LineaExpandida, subcategoria_id: string | null) => {
    if (fila.indice_linea === null) return;
    editarLinea(fila.movimiento_id, fila.indice_linea, "subcategoria_id", subcategoria_id);
  };

  const reclasificar = (fila: LineaExpandida, categoria_id: string) => {
    if (fila.indice_linea !== null) {
      editarLinea(fila.movimiento_id, fila.indice_linea, "categoria_id", categoria_id);
    } else {
      // Sin líneas: clasificarlo crea la primera.
      editarMovimiento(fila.movimiento_id, "lineas", [
        { categoria_id, subcategoria_id: null, monto: fila.monto, glosa: fila.glosa },
      ]);
    }
  };

  /** Una sección con sus grupos y el total. Solo aparecen las líneas con
   *  presupuesto o con gasto: el catálogo tiene 293 categorías y mostrarlas
   *  todas dejaría el control enterrado entre ceros. */
  const secciones = useMemo(
    () =>
      SECCIONES.map(({ naturaleza, titulo }) => {
        // Solo los grupos controlados (§4.6). Impuestos, bancos, inversiones,
        // préstamos y socios no son gasto que se decida presupuestar: salen de lo
        // que se factura, de lo que se mueve o de una decisión de los dueños.
        const grupos = catalogo.grupos.filter((c) => c.controlado).map((grupo) => {
          const filas = catalogo
            .categoriasDe(grupo.id, naturaleza)
            .map((s) =>
              filaDe(
                s.id,
                datos.metadata.get(s.id) ?? LINEA_VACIA,
                datos.meses.get(s.id) ?? sinMeses(),
                ejecutado.get(s.id) ?? 0,
                mes
              )
            )
            .filter((f) => f.anual > 0 || f.real > 0);
          return { grupo, filas, total: totalizar(filas) };
        }).filter((c) => c.filas.length > 0);

        return {
          naturaleza,
          titulo,
          grupos,
          total: totalizar(grupos.flatMap((c) => c.filas)),
        };
      }),
    [datos, ejecutado, mes, catalogo]
  );

  const generarOperativo = () => {
    const distribucion = distribucionOperativa(delPresupuesto, anio, esOperativa, tc);
    for (const [sub, meses] of distribucion) guardar(sub, meses);
  };

  const totalGeneral = totalizar(secciones.flatMap((s) => s.grupos.flatMap((c) => c.filas)));

  /** Lo que queda fuera del control, con su gasto. Se muestra igual para que nadie
   *  olvide que existe: son millones que salen de la caja aunque no se presupuesten. */
  const fueraDeControl = useMemo(() => {
    const grupos = catalogo.grupos
      .filter((c) => !c.controlado)
      .map((grupo) => ({
        grupo,
        real: catalogo
          .categoriasDe(grupo.id)
          .reduce((t, s) => t + (ejecutado.get(s.id) ?? 0), 0),
      }))
      .filter((c) => c.real > 0);
    return { grupos, total: grupos.reduce((t, c) => t + c.real, 0) };
  }, [ejecutado, catalogo]);

  return (
    <div>
      <Cabecera
        titulo="Presupuesto anual"
        bajada="Consolidado de las cuatro empresas Adapsys — SANTA MARÍA queda fuera por ser relacionada, y el filtro de empresas no aplica acá (§4.6). El gasto a la fecha se calcula de los movimientos; el presupuesto se escribe en esta pantalla."
      />

      <div className={css.barra}>
        <label className={css.control}>
          <span className={css.etiqueta}>Año</span>
          <input
            type="number"
            value={anio}
            onChange={(e) => setAnio(Number(e.target.value))}
            className={css.entradaAnio}
          />
        </label>

        <label className={css.control}>
          <span className={css.etiqueta}>Cierre a</span>
          <select
            value={mes}
            onChange={(e) => setMes(Number(e.target.value))}
            className={css.selectMes}
          >
            {NOMBRES_MES.map((nombre, i) => (
              <option key={nombre} value={i + 1}>
                {nombre}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={generarOperativo}
          title="Suma los movimientos operativos del año por categoría y los deja como presupuesto, repartidos por el mes de cada uno"
          className={css.botonGenerar}
        >
          Generar operativo desde los movimientos
        </button>
      </div>

      {error && (
        <div className={css.bandaError} role="alert">
          <strong>Algo falló con el presupuesto.</strong> {error}
        </div>
      )}
      {cargando && <div className={css.bandaCarga}>Cargando presupuesto…</div>}

      <div className={tabla.envoltorio}>
        <table className={tabla.tabla}>
          <thead>
            <tr>
              <th className={tabla.th}>Grupo</th>
              <th className={tabla.th}>Responsable</th>
              <th className={clases(tabla.th, tabla.thNum)}>Presupuesto {anio}</th>
              <th className={clases(tabla.th, tabla.thNum)}>Presupuesto a la fecha</th>
              <th className={clases(tabla.th, tabla.thNum)}>Gasto a la fecha</th>
              <th className={clases(tabla.th, tabla.thNum)}>Variación nominal</th>
              <th className={clases(tabla.th, tabla.thNum)}>% del año</th>
            </tr>
          </thead>
          <tbody>
            {secciones.map((seccion) => (
              <SeccionFilas
                key={seccion.naturaleza}
                seccion={seccion}
                mes={mes}
                meses={datos.meses}
                metadata={datos.metadata}
                guardar={guardar}
                abrir={abrir}
              />
            ))}

            <tr className={css.filaTotalGeneral}>
              <td className={tabla.td} colSpan={2}>
                Total gastos
              </td>
              <Numeros
                total={totalGeneral}
                abrir={() =>
                  abrir(
                    "Total gastos",
                    new Set(
                      secciones.flatMap((s) =>
                        s.grupos.flatMap((c) => c.filas.map((f) => f.categoria_id))
                      )
                    )
                  )
                }
              />
            </tr>
          </tbody>
        </table>
      </div>

      {fueraDeControl.grupos.length > 0 && (
        <div className={css.fuera}>
          <Rotulo texto="Fuera del control presupuestario" />
          <p className={css.glosaFuera}>
            Impuestos, comisiones bancarias, inversiones, préstamos y movimientos con socios. No se
            presupuestan —salen de lo que se factura, de lo que se mueve o de una decisión de los
            dueños— pero igual salen de la caja.
          </p>
          <table className={css.tablaFuera}>
            <tbody>
              {fueraDeControl.grupos.map(({ grupo, real }) => (
                <tr key={grupo.id}>
                  <td className={tabla.td}>{grupo.nombre}</td>
                  <td className={clases(tabla.td, tabla.tdNum)}>{mag(real)}</td>
                </tr>
              ))}
              <tr className={css.filaTotalSeccion}>
                <td className={tabla.td}>Total fuera del control</td>
                <td className={clases(tabla.td, tabla.tdNum)}>{mag(fueraDeControl.total)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {detalle && (
        <PanelDetalle
          detalle={detalle}
          cerrar={() => setDetalle(null)}
          tc={tc}
          reclasificar={reclasificar}
          detallar={detallar}
        />
      )}

      {!cargando && totalGeneral.anual === 0 && (
        <div className={css.vacio}>
          Todavía no hay presupuesto para {anio}. Con <strong>Generar operativo</strong> se arma la
          parte operativa desde los movimientos que ya cargaste; las líneas de inversión se
          escriben a mano en la columna de presupuesto.
        </div>
      )}
    </div>
  );
}

/** Monto de gasto que abre el detalle. Sin gasto no hay nada que abrir, así que
 *  se muestra plano: un botón que no hace nada es peor que un número. */
function Gasto({ valor, abrir }: { valor: number; abrir?: () => void }) {
  if (!valor || !abrir) return <>{mag(valor)}</>;
  return (
    <button
      type="button"
      onClick={abrir}
      title="Ver los movimientos que componen este monto"
      className={css.montoClicable}
    >
      {mag(valor)}
    </button>
  );
}

/** Las cuatro columnas de números de un total. */
function Numeros({
  total,
  abrir,
}: {
  total: ReturnType<typeof totalizar>;
  abrir?: () => void;
}) {
  return (
    <>
      <td className={clases(tabla.td, tabla.tdNum)}>{mag(total.anual)}</td>
      <td className={clases(tabla.td, tabla.tdNum)}>{mag(total.ytd)}</td>
      <td className={clases(tabla.td, tabla.tdNum)}>
        <Gasto valor={total.real} abrir={abrir} />
      </td>
      <td
        className={clases(tabla.td, tabla.tdNum)}
        style={{ color: total.variacion > 0 ? "var(--brick)" : undefined }}
      >
        {clp(total.variacion)}
      </td>
      <td className={clases(tabla.td, tabla.tdNum)}>
        {total.avance === null ? "—" : pct(total.avance)}
      </td>
    </>
  );
}

function SeccionFilas({
  seccion,
  mes,
  meses,
  metadata,
  guardar,
  abrir,
}: {
  seccion: {
    titulo: string;
    grupos: { grupo: { id: string; nombre: string }; filas: FilaPresupuesto[]; total: ReturnType<typeof totalizar> }[];
    total: ReturnType<typeof totalizar>;
  };
  mes: number;
  meses: Map<string, Meses>;
  metadata: Map<string, { monto: number; monto_anterior: number; responsable: string; nota: string }>;
  guardar: (sub: string, meses: Meses, linea?: FilaPresupuesto | typeof LINEA_VACIA) => void;
  abrir: (titulo: string, subs: Set<string>) => void;
}) {
  return (
    <>
      <tr className={tabla.filaSeccion}>
        <td className={tabla.td} colSpan={7}>
          <Rotulo texto={seccion.titulo} />
        </td>
      </tr>

      {seccion.grupos.map(({ grupo, filas, total }) => (
        <FilasDeGrupo
          key={grupo.id}
          grupo={grupo}
          filas={filas}
          total={total}
          mes={mes}
          meses={meses}
          metadata={metadata}
          guardar={guardar}
          abrir={abrir}
        />
      ))}

      <tr className={css.filaTotalSeccion}>
        <td className={tabla.td} colSpan={2}>
          Total {seccion.titulo.toLowerCase()}
        </td>
        <Numeros
          total={seccion.total}
          abrir={() =>
            abrir(
              seccion.titulo,
              new Set(seccion.grupos.flatMap((c) => c.filas.map((f) => f.categoria_id)))
            )
          }
        />
      </tr>
    </>
  );
}

function FilasDeGrupo({
  grupo,
  filas,
  total,
  mes,
  meses,
  metadata,
  guardar,
  abrir,
}: {
  grupo: { id: string; nombre: string };
  filas: FilaPresupuesto[];
  total: ReturnType<typeof totalizar>;
  mes: number;
  meses: Map<string, Meses>;
  metadata: Map<string, { monto: number; monto_anterior: number; responsable: string; nota: string }>;
  guardar: (sub: string, meses: Meses, linea?: never) => void;
  abrir: (titulo: string, subs: Set<string>) => void;
}) {
  return (
    <>
      <tr className={css.filaGrupo}>
        <td className={clases(tabla.td, css.nombreGrupo)} colSpan={2}>
          {grupo.nombre}
        </td>
        <Numeros
          total={total}
          abrir={() => abrir(grupo.nombre, new Set(filas.map((f) => f.categoria_id)))}
        />
      </tr>

      {filas.map((f) => (
        <Fila
          key={f.categoria_id}
          fila={f}
          mes={mes}
          mesesActuales={meses.get(f.categoria_id) ?? sinMeses()}
          guardar={guardar}
          metadata={metadata}
          abrir={abrir}
        />
      ))}
    </>
  );
}

function Fila({
  fila,
  mesesActuales,
  guardar,
  metadata,
  abrir,
}: {
  fila: FilaPresupuesto;
  mes: number;
  mesesActuales: Meses;
  guardar: (sub: string, meses: Meses, linea?: never) => void;
  metadata: Map<string, { monto: number; monto_anterior: number; responsable: string; nota: string }>;
  abrir: (titulo: string, subs: Set<string>) => void;
}) {
  const { catalogo } = useTesoreria();
  const nombre = catalogo.categoriaDe(fila.categoria_id).nombre;

  // Dos avisos distintos, y la diferencia importa. "Sobre presupuesto" dice que va
  // más rápido de lo previsto para esta altura del año, y puede corregirse solo.
  // "Agotado" dice que no queda nada para lo que resta: de ahí en adelante todo
  // gasto nuevo es sobregasto, y eso es lo que hay que ver venir.
  const agotado = presupuestoAgotado(fila);
  const alerta = agotado || sobreRitmo(fila);
  const aviso = agotado
    ? { texto: "presupuesto agotado", titulo: `Ya se usó el 100% del presupuesto del año` }
    : sobreRitmo(fila)
      ? { texto: "sobre presupuesto", titulo: "Gastado más de lo presupuestado a esta fecha" }
      : null;

  const cambiarAnual = (texto: string) => {
    const nuevo = Number(texto.replace(/\D/g, ""));
    if (Number.isNaN(nuevo) || nuevo === fila.anual) return;
    // Reescalar y no repartir parejo: si la línea tiene forma —un aguinaldo en
    // diciembre— subirle el total no debe aplanarla.
    guardar(fila.categoria_id, nuevo === 0 ? sinMeses() : reescalar(mesesActuales, nuevo));
  };

  const cambiarMeta = (campo: "responsable" | "nota", valor: string) => {
    const actual = metadata.get(fila.categoria_id) ?? LINEA_VACIA;
    guardar(fila.categoria_id, mesesActuales, { ...actual, [campo]: valor } as never);
  };

  return (
    <tr className="fila">
      <td className={clases(tabla.td, css.nombreSub)}>
        {nombre}
        {aviso && (
          <span
            className={clases(css.alerta, agotado && css.alertaAgotado)}
            title={aviso.titulo}
          >
            {aviso.texto}
          </span>
        )}
      </td>

      <td className={tabla.td}>
        <select
          value={fila.responsable ?? ""}
          aria-label={`Responsable de ${nombre}`}
          onChange={(e) => cambiarMeta("responsable", e.target.value)}
          className={css.selectResponsable}
        >
          {RESPONSABLES.map((r) => (
            <option key={r || "sin"} value={r}>
              {r || "—"}
            </option>
          ))}
        </select>
      </td>

      <td className={clases(tabla.td, tabla.tdNum)}>
        <input
          key={fila.anual}
          defaultValue={fila.anual ? mag(fila.anual) : ""}
          aria-label={`Presupuesto de ${nombre}`}
          onBlur={(e) => cambiarAnual(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          placeholder="0"
          className={css.entradaMonto}
        />
      </td>

      <td className={clases(tabla.td, tabla.tdNum)}>{mag(fila.ytd)}</td>
      <td className={clases(tabla.td, tabla.tdNum)}>
        <Gasto
          valor={fila.real}
          abrir={() => abrir(nombre, new Set([fila.categoria_id]))}
        />
      </td>
      <td
        className={clases(tabla.td, tabla.tdNum)}
        style={{ color: fila.variacion > 0 ? "var(--brick)" : undefined }}
      >
        {clp(fila.variacion)}
      </td>
      <td className={clases(tabla.td, tabla.tdNum, alerta && css.avanceAlerta)}>
        {fila.avance === null ? "—" : pct(fila.avance)}
      </td>
    </tr>
  );
}
