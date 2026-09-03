"use client";

// Control presupuestario anual (§4.6). Réplica de la planilla que hoy se arma a
// mano, con la diferencia de que el "real" no se copia de un export: se calcula
// de los movimientos.
//
// Es consolidado para las cuatro empresas Adapsys y NO usa el filtro global de
// empresas — por eso lee `movimientos` y no `movimientosFiltrados`.

import { useEffect, useMemo, useState } from "react";
import { CATEGORIAS, IDS_ADAPSYS, RESPONSABLES, SUBCATEGORIAS } from "@/lib/catalogo";
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
  ejecutadoPorSubcategoria,
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

const NATURALEZA_DE = new Map(SUBCATEGORIAS.map((s) => [s.id, s.naturaleza]));
const esOperativa = (id: string) => NATURALEZA_DE.get(id) === "operativo";

export function Presupuesto() {
  const { movimientos, tc, editarLinea, editarMovimiento } = useTesoreria();
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
    () => ejecutadoPorSubcategoria(delPresupuesto, anio, mes, tc),
    [delPresupuesto, anio, mes, tc]
  );

  /** Las líneas que componen un monto de la columna "gasto a la fecha".
   *  Se filtra igual que ejecutadoPorSubcategoria —mismo rango, mismos estados—
   *  para que lo que se abre sume exactamente lo que se ve. */
  const lineasDe = (subs: Set<string>): LineaExpandida[] => {
    const desde = `${anio}-01-01`;
    const hasta = finDeMes(anio, mes);
    return expandir(delPresupuesto).filter(
      (f) =>
        f.estado !== "proyectado" &&
        f.fecha >= desde &&
        f.fecha <= hasta &&
        f.subcategoria_id !== null &&
        subs.has(f.subcategoria_id)
    );
  };

  const abrir = (titulo: string, subs: Set<string>) => {
    const items = lineasDe(subs);
    if (!items.length) return;
    setDetalle({ titulo, periodo: `Enero a ${NOMBRES_MES[mes - 1]} de ${anio}`, items });
  };

  const reclasificar = (fila: LineaExpandida, subcategoria_id: string) => {
    if (fila.indice_linea !== null) {
      editarLinea(fila.movimiento_id, fila.indice_linea, "subcategoria_id", subcategoria_id);
    } else {
      // Sin líneas: clasificarlo crea la primera.
      editarMovimiento(fila.movimiento_id, "lineas", [
        { subcategoria_id, monto: fila.monto, glosa: fila.glosa },
      ]);
    }
  };

  /** Una sección con sus categorías y el total. Solo aparecen las líneas con
   *  presupuesto o con gasto: el catálogo tiene 293 subcategorías y mostrarlas
   *  todas dejaría el control enterrado entre ceros. */
  const secciones = useMemo(
    () =>
      SECCIONES.map(({ naturaleza, titulo }) => {
        // Solo las categorías controladas (§4.6). Impuestos, bancos, inversiones,
        // préstamos y socios no son gasto que se decida presupuestar: salen de lo
        // que se factura, de lo que se mueve o de una decisión de los dueños.
        const categorias = CATEGORIAS.filter((c) => c.controlado).map((categoria) => {
          const filas = SUBCATEGORIAS.filter(
            (s) => s.categoria_id === categoria.id && s.naturaleza === naturaleza
          )
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
          return { categoria, filas, total: totalizar(filas) };
        }).filter((c) => c.filas.length > 0);

        return {
          naturaleza,
          titulo,
          categorias,
          total: totalizar(categorias.flatMap((c) => c.filas)),
        };
      }),
    [datos, ejecutado, mes]
  );

  const generarOperativo = () => {
    const distribucion = distribucionOperativa(delPresupuesto, anio, esOperativa, tc);
    for (const [sub, meses] of distribucion) guardar(sub, meses);
  };

  const totalGeneral = totalizar(secciones.flatMap((s) => s.categorias.flatMap((c) => c.filas)));

  /** Lo que queda fuera del control, con su gasto. Se muestra igual para que nadie
   *  olvide que existe: son millones que salen de la caja aunque no se presupuesten. */
  const fueraDeControl = useMemo(() => {
    const categorias = CATEGORIAS.filter((c) => !c.controlado)
      .map((categoria) => ({
        categoria,
        real: SUBCATEGORIAS.filter((s) => s.categoria_id === categoria.id).reduce(
          (t, s) => t + (ejecutado.get(s.id) ?? 0),
          0
        ),
      }))
      .filter((c) => c.real > 0);
    return { categorias, total: categorias.reduce((t, c) => t + c.real, 0) };
  }, [ejecutado]);

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
          title="Suma los movimientos operativos del año por subcategoría y los deja como presupuesto, repartidos por el mes de cada uno"
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
              <th className={tabla.th}>Categoría</th>
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
                        s.categorias.flatMap((c) => c.filas.map((f) => f.subcategoria_id))
                      )
                    )
                  )
                }
              />
            </tr>
          </tbody>
        </table>
      </div>

      {fueraDeControl.categorias.length > 0 && (
        <div className={css.fuera}>
          <Rotulo texto="Fuera del control presupuestario" />
          <p className={css.glosaFuera}>
            Impuestos, comisiones bancarias, inversiones, préstamos y movimientos con socios. No se
            presupuestan —salen de lo que se factura, de lo que se mueve o de una decisión de los
            dueños— pero igual salen de la caja.
          </p>
          <table className={css.tablaFuera}>
            <tbody>
              {fueraDeControl.categorias.map(({ categoria, real }) => (
                <tr key={categoria.id}>
                  <td className={tabla.td}>{categoria.nombre}</td>
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
    categorias: { categoria: { id: string; nombre: string }; filas: FilaPresupuesto[]; total: ReturnType<typeof totalizar> }[];
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

      {seccion.categorias.map(({ categoria, filas, total }) => (
        <FilasDeCategoria
          key={categoria.id}
          categoria={categoria}
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
              new Set(seccion.categorias.flatMap((c) => c.filas.map((f) => f.subcategoria_id)))
            )
          }
        />
      </tr>
    </>
  );
}

function FilasDeCategoria({
  categoria,
  filas,
  total,
  mes,
  meses,
  metadata,
  guardar,
  abrir,
}: {
  categoria: { id: string; nombre: string };
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
      <tr className={css.filaCategoria}>
        <td className={clases(tabla.td, css.nombreCategoria)} colSpan={2}>
          {categoria.nombre}
        </td>
        <Numeros
          total={total}
          abrir={() => abrir(categoria.nombre, new Set(filas.map((f) => f.subcategoria_id)))}
        />
      </tr>

      {filas.map((f) => (
        <Fila
          key={f.subcategoria_id}
          fila={f}
          mes={mes}
          mesesActuales={meses.get(f.subcategoria_id) ?? sinMeses()}
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
  const nombre = SUBCATEGORIAS.find((s) => s.id === fila.subcategoria_id)?.nombre ?? fila.subcategoria_id;

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
    guardar(fila.subcategoria_id, nuevo === 0 ? sinMeses() : reescalar(mesesActuales, nuevo));
  };

  const cambiarMeta = (campo: "responsable" | "nota", valor: string) => {
    const actual = metadata.get(fila.subcategoria_id) ?? LINEA_VACIA;
    guardar(fila.subcategoria_id, mesesActuales, { ...actual, [campo]: valor } as never);
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
          abrir={() => abrir(nombre, new Set([fila.subcategoria_id]))}
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
