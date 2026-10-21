"use client";

// Control presupuestario anual (§4.6). Réplica de la planilla que hoy se arma a
// mano, con la diferencia de que el "real" no se copia de un export: se calcula
// de los movimientos.
//
// Es consolidado para las cuatro empresas Adapsys y NO usa el filtro global de
// empresas — por eso lee `movimientos` y no `movimientosFiltrados`.

import { Fragment, useEffect, useMemo, useState } from "react";
import { IDS_ADAPSYS, RESPONSABLES } from "@/lib/catalogo";
import { useTesoreria } from "@/components/estado/ProveedorTesoreria";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { supabaseConfigurado } from "@/lib/supabase/estado";
import {
  aprobarPresupuesto,
  cargarPresupuesto,
  guardarLineaPresupuesto,
  type PresupuestoDelAnio,
} from "@/lib/supabase/presupuesto";
import { Bitacora, CuadroAjuste, type EnAjuste } from "./Ajustes";
import { VistaPrevia, compararConLoQueHay, type Previo } from "./VistaPrevia";
import { ProyectarAnio } from "./ProyectarAnio";
import {
  expandirLineas,
  origenDe,
  resumirPorCategoria,
  type LineaRecurrente,
  type ResumenCategoria,
} from "@/lib/proyeccion";
import { generarProyeccion } from "@/lib/supabase/proyeccion";
import {
  MESES_DEL_ANIO,
  SECCIONES,
  anualDe,
  distribucionOperativa,
  mesesRepetidos,
  ventanaPara,
  ejecutadoPorClave,
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
import { HOY, MESES, fechaCorta } from "@/lib/fechas";
import { expandir } from "@/lib/dominio";
import { clave, partesDeClave } from "@/lib/catalogo-indices";
import { PanelDetalle, type Detalle } from "@/components/flujo/PanelDetalle";
import type { LineaExpandida } from "@/lib/tipos";
import { clp, mag, pct } from "@/lib/formato";
import { Cabecera, Rotulo, TablaFantasma, clases } from "@/components/ui/primitivas";
import tabla from "@/components/ui/tabla.module.css";
import css from "./presupuesto.module.css";

const LINEA_VACIA = { monto: 0, monto_anterior: 0, responsable: "", nota: "" };

/**
 * Lo que una fila necesita saber del estado del año.
 *
 * Va en un objeto y no en cuatro props sueltas porque atraviesa dos niveles
 * —sección y grupo— que no lo usan: solo lo pasan.
 */
/** Una categoría con las filas que le corresponden en esta sección: la suya —lo
 *  clasificado sin precisar subcategoría— y las de sus subcategorías. */
type CategoriaConFilas = {
  categoria: { id: string; nombre: string };
  filas: FilaPresupuesto[];
  conHijas: boolean;
};

type Control = {
  /** Con el año aprobado, editar el anual deja de ser escribir un número. */
  aprobado: boolean;
  /** Cuánto se movió la línea respecto de lo aprobado. 0 si no se tocó. */
  ajusteDe: (clave: string) => number;
  pedirAjuste: (clave: string, nombre: string, meses: Meses, propuesto: number) => void;
  verCambios: (clave: string, nombre: string) => void;
};
const sinMeses = (): Meses => Array<number>(MESES_DEL_ANIO).fill(0);


export function Presupuesto() {
  const {
    movimientos,
    tc,
    editarLinea,
    editarMovimiento,
    catalogo,
    // El gasto a la fecha sale de los movimientos: mientras cargan, toda la
    // columna vale cero y la tabla diría que no se gastó nada en el año.
    cargando: cargandoMovimientos,
    reiniciar,
  } = useTesoreria();
  /**
   * Qué líneas presupuesta la generación.
   *
   * Operativas **y dentro del control**. Lo segundo faltaba, y escribía en la base
   * un presupuesto para los depósitos a plazo, los fondos mutuos y todo `7
   * INVERSIONES`: categorías operativas de un grupo que está fuera del control a
   * propósito. No se veía porque la tabla solo muestra los grupos controlados, así
   * que eran filas invisibles en `presupuesto_meses`.
   *
   * Por clave y no por categoría: una subcategoría puede sobrescribir la
   * naturaleza de su madre (§4.2), y mirando solo la categoría sus líneas de
   * inversión irían a la sección equivocada.
   */
  const sePresupuesta = (categoria_id: string, subcategoria_id: string | null) =>
    catalogo.naturalezaDe(categoria_id, subcategoria_id) === "operativo" &&
    catalogo.entraAlControl(categoria_id);
  const [detalle, setDetalle] = useState<Detalle | null>(null);

  const [anio, setAnio] = useState(() => Number(HOY.slice(0, 4)));
  const [mes, setMes] = useState(() => Number(HOY.slice(5, 7)));
  const [datos, setDatos] = useState<PresupuestoDelAnio>({
    meses: new Map(),
    inicial: new Map(),
    metadata: new Map(),
    aprobado: null,
    cambios: [],
  });
  /** Las categorías que se podrían proyectar al año, antes de proyectarlas. */
  const [proyectando, setProyectando] = useState<ResumenCategoria[] | null>(null);

  /** Lo que la generación escribiría, antes de escribirlo. */
  const [previo, setPrevio] = useState<{ filas: Previo[]; generado: Map<string, Meses> } | null>(
    null
  );

  /** De dónde sale la base al generar, y cuánto se reajusta. */
  const [ventana, setVentana] = useState(() => ventanaPara(Number(HOY.slice(0, 4)), HOY));
  const [reajuste, setReajuste] = useState(0);

  /** La línea que se está ajustando, y la bitácora que se está mirando. */
  const [ajustando, setAjustando] = useState<EnAjuste | null>(null);
  const [bitacora, setBitacora] = useState<{ titulo: string; de: string | null } | null>(null);
  const [cargando, setCargando] = useState(supabaseConfigurado);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setVentana(ventanaPara(anio, HOY)), [anio]);

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

  /** Vuelve a leer el año. Se usa después de aprobar y después de un ajuste: las
   *  dos cosas las escribe la base y no se pueden deducir desde acá. */
  const recargar = () => {
    if (!supabaseConfigurado) return;
    cargarPresupuesto(crearClienteNavegador(), anio)
      .then(setDatos)
      .catch((e: Error) => setError(e.message));
  };

  /** Guarda una línea y la refleja en pantalla. El estado se actualiza primero:
   *  si falla, la banda de error avisa que lo que se ve no es lo que hay. */
  /** `k` es la clave de reporte: `categoria` o `categoria>subcategoria`. Se parte
   *  recién acá, porque la base guarda las dos columnas por separado. */
  const guardar = (
    k: string,
    meses: Meses,
    linea = datos.metadata.get(k) ?? LINEA_VACIA,
    motivo?: string
  ) => {
    setDatos((p) => ({
      ...p,
      meses: new Map(p.meses).set(k, meses),
      metadata: new Map(p.metadata).set(k, linea),
    }));
    if (!supabaseConfigurado) return;
    const { categoria_id, subcategoria_id } = partesDeClave(k);
    guardarLineaPresupuesto(
      crearClienteNavegador(),
      anio,
      categoria_id,
      subcategoria_id,
      linea,
      meses,
      motivo
    )
      // Al ajustar, la bitácora la escribe la base: hay que releerla para que el
      // panel muestre lo que acaba de pasar.
      .then(() => motivo && recargar())
      .catch((e: Error) => setError(e.message));
  };

  const aprobar = () => {
    if (!supabaseConfigurado) return;
    aprobarPresupuesto(crearClienteNavegador(), anio)
      .then(recargar)
      .catch((e: Error) => setError(e.message));
  };

  /** Cuánto se movió una línea respecto de lo aprobado. 0 si no se tocó. */
  const ajusteDe = (k: string): number => {
    if (!datos.aprobado) return 0;
    const base = datos.inicial.get(k);
    if (!base) return 0;
    return anualDe(datos.meses.get(k) ?? sinMeses()) - anualDe(base);
  };

  const control: Control = {
    aprobado: datos.aprobado !== null,
    ajusteDe,
    pedirAjuste: (k, nombre, meses, propuesto) =>
      setAjustando({ clave: k, nombre, meses, propuesto }),
    verCambios: (k, nombre) => setBitacora({ titulo: `Ajustes de ${nombre}`, de: k }),
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
    () => ejecutadoPorClave(delPresupuesto, anio, mes, tc),
    [delPresupuesto, anio, mes, tc]
  );

  /** Las líneas que componen un monto de la columna "gasto a la fecha".
   *  Se filtra igual que ejecutadoPorClave —mismo rango, mismos estados, misma
   *  clave— para que lo que se abre sume exactamente lo que se ve. */
  const lineasDe = (claves: Set<string>): LineaExpandida[] => {
    const desde = `${anio}-01-01`;
    const hasta = finDeMes(anio, mes);
    return expandir(delPresupuesto).filter(
      (f) =>
        f.estado !== "proyectado" &&
        f.fecha >= desde &&
        f.fecha <= hasta &&
        f.categoria_id !== null &&
        claves.has(clave(f.categoria_id, f.subcategoria_id))
    );
  };

  const abrir = (titulo: string, subs: Set<string>) => {
    const items = lineasDe(subs);
    if (!items.length) return;
    setDetalle({ titulo, periodo: `Enero a ${MESES[mes - 1]} de ${anio}`, items });
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
        { categoria_id, subcategoria_id: null, doc_tipo: null, monto: fila.monto, glosa: fila.glosa },
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
          // Se recorren TODAS las categorías del grupo, no solo las de esta
          // naturaleza: una categoría operativa puede tener una subcategoría de
          // inversión, y esa fila va en la sección de inversión (§4.2). De eso
          // se encarga `clavesDe`, que devuelve solo las que caen de este lado.
          const categorias = catalogo
            .categoriasDe(grupo.id)
            // Una categoría excluida a mano sale del control aunque su grupo esté
            // dentro. Su gasto no se pierde: baja a la banda de fuera de control.
            .filter((s) => s.controlada)
            .map((s) => {
              const hijas = catalogo.subcategoriasDe(s.id);
              const filas = catalogo
                .clavesDe(s.id, naturaleza)
                .map((k) => {
                  // La clave es `cat` o `cat>sub`; la parte de la derecha es la
                  // subcategoría, y su ausencia es la línea de la categoría en sí.
                  const sub = k.includes(">") ? k.slice(k.indexOf(">") + 1) : null;
                  return filaDe(
                    s.id,
                    sub,
                    datos.metadata.get(k) ?? LINEA_VACIA,
                    datos.meses.get(k) ?? sinMeses(),
                    ejecutado.get(k) ?? 0,
                    mes
                  );
                })
                // Las líneas sin presupuesto ni gasto no se muestran: el catálogo
                // tiene 293 categorías y el control quedaría enterrado en ceros.
                .filter((f) => f.anual > 0 || f.real > 0);
              return { categoria: s, filas, conHijas: hijas.length > 0 };
            })
            .filter((c) => c.filas.length > 0);

          const filas = categorias.flatMap((c) => c.filas);
          return { grupo, categorias, filas, total: totalizar(filas) };
        }).filter((c) => c.categorias.length > 0);

        return {
          naturaleza,
          titulo,
          grupos,
          total: totalizar(grupos.flatMap((c) => c.filas)),
        };
      }),
    [datos, ejecutado, mes, catalogo]
  );

  /**
   * Proyectar el año: crear los movimientos, no el presupuesto.
   *
   * Es el primer paso de los dos. Las líneas se escriben —proveedor, categoría,
   * monto, día y cada cuánto— y de ahí salen los movimientos proyectados del año.
   * El presupuesto operativo sale después, de sumarlos: así el flujo de caja y el
   * control presupuestario dicen lo mismo por construcción, en vez de ser dos
   * cosas que pueden no coincidir.
   *
   * Lo que se pagó en la ventana viaja igual, como consulta al lado. No para
   * copiarlo entero: sirve para no olvidarse de un pago, pero el monto que queda
   * escrito es uno elegido — los sueldos suben, el IMA se renegocia y el IVA sale
   * de las ventas del mes, así que copiar el año pasado estaría mal en la mitad
   * de las líneas.
   */
  const abrirProyeccion = () =>
    setProyectando(resumirPorCategoria(delPresupuesto, ventana, sePresupuesta, tc));

  /** El signo de una línea sale de la naturaleza de su categoría (§4.6): un gasto
   *  negativo, un ingreso positivo. Nadie escribe el menos. */
  const esIngreso = (categoria_id: string, subcategoria_id: string | null) =>
    catalogo.naturalezaDe(categoria_id, subcategoria_id) === "ingreso";

  const aplicarProyeccion = (lineas: LineaRecurrente[]) => {
    const nuevos = expandirLineas(lineas, anio, esIngreso);
    setProyectando(null);
    if (!supabaseConfigurado) return;
    generarProyeccion(crearClienteNavegador(), anio, nuevos)
      // Hay que releer: los movimientos los escribió la base y el presupuesto se
      // genera de ellos. Sin recargar, el paso siguiente sumaría lo de antes.
      .then(() => reiniciar())
      .catch((e: Error) => setError(e.message));
  };

  const generarOperativo = () => {
    const generado = distribucionOperativa(
      delPresupuesto,
      ventana,
      sePresupuesta,
      tc,
      1 + reajuste / 100
    );
    // No se escribe todavía: generar reemplaza el presupuesto de cada línea con
    // movimientos en la ventana, y sobre 290 categorías eso es mucho para
    // deshacer a mano si la ventana quedó mal elegida.
    setPrevio({
      generado,
      filas: compararConLoQueHay(generado, datos.meses, (k) => {
        const { categoria_id, subcategoria_id } = partesDeClave(k);
        const cat = catalogo.categoriaDe(categoria_id).nombre;
        const sub = catalogo.nombreSubcategoria(subcategoria_id);
        return sub ? `${cat} · ${sub}` : cat;
      }),
    });
  };

  const totalGeneral = totalizar(secciones.flatMap((s) => s.grupos.flatMap((c) => c.filas)));

  /** Lo que queda fuera del control, con su gasto. Se muestra igual para que nadie
   *  olvide que existe: son millones que salen de la caja aunque no se presupuesten. */
  const fueraDeControl = useMemo(() => {
    // El gasto de una categoría es el suyo más el de sus subcategorías: desde que
    // el ejecutado va por clave (§3.1), mirar solo `categoria_id` deja fuera lo
    // que se clasificó con más detalle.
    const gastoDe = (categoria_id: string) =>
      (ejecutado.get(categoria_id) ?? 0) +
      catalogo
        .subcategoriasDe(categoria_id)
        .reduce((t, h) => t + (ejecutado.get(clave(categoria_id, h.id)) ?? 0), 0);

    const grupos = catalogo.grupos
      .map((grupo) => {
        // Lo que no entra al control: el grupo entero, o las categorías excluidas
        // a mano dentro de un grupo que sí entra. Si no aparecieran acá, esa plata
        // desaparecería del informe sin que nadie lo note.
        const fuera = catalogo
          .categoriasDe(grupo.id)
          .filter((s) => !grupo.controlado || !s.controlada);
        return {
          grupo,
          // Con el grupo entero fuera, su nombre alcanza. Si solo se excluyeron
          // algunas de sus categorías, hay que decir cuáles.
          detalle: grupo.controlado ? fuera.map((s) => s.nombre) : [],
          real: fuera.reduce((t, s) => t + gastoDe(s.id), 0),
        };
      })
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
            {MESES.map((nombre, i) => (
              <option key={nombre} value={i + 1}>
                {nombre}
              </option>
            ))}
          </select>
        </label>

        <div className={css.generador}>
          <button
            type="button"
            onClick={abrirProyeccion}
            title={`Escribí los pagos que se repiten y quedan creados como proyectados de ${anio}. El presupuesto sale después, de sumarlos.`}
            className={css.botonGenerar}
          >
            Proyectar {anio}
          </button>

          <button
            type="button"
            onClick={generarOperativo}
            disabled={datos.aprobado !== null}
            title={
              datos.aprobado
                ? "El presupuesto del año ya está aprobado: cambiarlo en bloque pisaría la línea base. Se ajusta línea por línea, con su motivo."
                : "Suma los movimientos operativos de la ventana por categoría y los deja como presupuesto, repartidos por el mes en que ocurrió cada uno"
            }
            className={css.botonGenerar}
          >
            {/* Con el año: es a dónde se escribe, y es lo que uno quiere tener
                claro antes de apretar. Parado en 2026 y queriendo armar 2027, el
                botón sin año no delata el error. */}
            Generar operativo {anio}
          </button>

          {/* Meses y no fechas: la ventana son meses completos por definición, y un
              día suelto —del 7 al 7— partiría dos meses al medio y generaría un
              presupuesto mensual a la mitad. Saldría un número creíble y mal. Con
              el selector de mes eso no se puede escribir. */}
          <label className={css.control}>
            <span className={css.etiqueta}>Desde</span>
            <input
              type="month"
              value={ventana.desde.slice(0, 7)}
              onChange={(e) =>
                e.target.value &&
                setVentana((v) => ({ ...v, desde: `${e.target.value}-01` }))
              }
              aria-label="Desde qué mes se toma la base"
              className={css.entradaMes}
            />
          </label>

          <label className={css.control}>
            <span className={css.etiqueta}>Hasta</span>
            <input
              type="month"
              value={ventana.hasta.slice(0, 7)}
              onChange={(e) => {
                if (!e.target.value) return;
                const [a, m] = e.target.value.split("-").map(Number);
                setVentana((v) => ({ ...v, hasta: finDeMes(a!, m!) }));
              }}
              aria-label="Hasta qué mes se toma la base"
              className={css.entradaMes}
            />
          </label>

          {/* El reajuste es del presupuesto operativo, no de la proyección: ahí los
              montos se escriben a mano y subirlos un 5% a todos no tendría sentido. */}
          <label className={css.control} title="Se aplica al generar el presupuesto operativo desde los movimientos. La proyección se escribe con sus montos.">
            <span className={css.etiqueta}>Reajuste</span>
            <span className={css.campoConSufijo}>
              <input
                type="number"
                value={reajuste}
                onChange={(e) => setReajuste(Number(e.target.value) || 0)}
                aria-label="Reajuste en porcentaje"
                className={css.entradaReajuste}
              />
              <span className={css.sufijo}>%</span>
            </span>
          </label>
        </div>

        <span className={css.empujeBarra} />

        {/* Aprobar es un acto explícito y no "la primera vez que alguien edita":
            mientras el año se arma, editar es construir. Desde acá en adelante
            editar es ajustar, y cada ajuste tiene que decir por qué. */}
        {datos.aprobado ? (
          <button
            type="button"
            onClick={() =>
              setBitacora({ titulo: `Ajustes del presupuesto ${anio}`, de: null })
            }
            title={`Aprobado el ${fechaCorta(datos.aprobado.slice(0, 10))}. Acá está todo lo que se ajustó desde entonces.`}
            className={css.botonAjustes}
          >
            Ajustes del año
            {datos.cambios.length > 0 && ` · ${datos.cambios.length}`}
          </button>
        ) : (
          <button
            type="button"
            onClick={aprobar}
            disabled={datos.meses.size === 0}
            title="Congela estos doce meses como el presupuesto aprobado. Desde acá, cada cambio queda anotado con su motivo."
            className={css.botonAprobar}
          >
            Aprobar el presupuesto {anio}
          </button>
        )}
      </div>

      {mesesRepetidos(ventana) > 0 && (
        <div className={css.bandaAviso} role="status">
          La ventana cubre más de doce meses, así que{" "}
          <strong>{mesesRepetidos(ventana)}</strong>{" "}
          {mesesRepetidos(ventana) === 1 ? "mes se contaría" : "meses se contarían"} dos
          veces y el anual saldría inflado. Cada movimiento cae en su mes del calendario,
          sin importar de qué año venga.
        </div>
      )}

      {error && (
        <div className={css.bandaError} role="alert">
          <strong>Algo falló con el presupuesto.</strong> {error}
        </div>
      )}
      {cargando && <div className={css.bandaCarga}>Cargando presupuesto…</div>}

      {cargandoMovimientos && <TablaFantasma filas={12} columnas={5} />}

      <div className={tabla.envoltorio} hidden={cargandoMovimientos}>
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
                control={control}
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
            Impuestos, comisiones bancarias, inversiones, préstamos y movimientos con socios,
            más las categorías sueltas que se excluyeron a mano. No se presupuestan —salen de lo
            que se factura, de lo que se mueve o de una decisión de los dueños— pero igual salen
            de la caja.
          </p>
          <table className={css.tablaFuera}>
            <tbody>
              {fueraDeControl.grupos.map(({ grupo, detalle, real }) => (
                <tr key={grupo.id}>
                  <td className={tabla.td}>
                    {grupo.nombre}
                    {/* El grupo entra al control y solo se excluyeron algunas de
                        sus categorías: sin nombrarlas, la fila diría que el grupo
                        está fuera, que no es cierto. */}
                    {detalle.length > 0 && (
                      <span className={css.detalleFuera}> · {detalle.join(", ")}</span>
                    )}
                  </td>
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

      {proyectando && (
        <ProyectarAnio
          resumen={proyectando}
          anio={anio}
          ventana={ventana}
          nombreDe={(id) => catalogo.categoriaDe(id).nombre}
          cuantosMovimientos={(lineas) => expandirLineas(lineas, anio, esIngreso).length}
          totalDe={(lineas) =>
            expandirLineas(lineas, anio, esIngreso).reduce((t, m) => t + m.monto, 0)
          }
          yaGenerados={movimientos.filter((m) => m.origen === origenDe(anio)).length}
          cancelar={() => setProyectando(null)}
          confirmar={aplicarProyeccion}
        />
      )}

      {previo && (
        <VistaPrevia
          previo={previo.filas}
          ventana={ventana}
          reajuste={reajuste}
          // Las que tienen presupuesto y la generación no toca: sin decirlo,
          // alguien podría creer que generar las borra.
          cuantasQuedanIgual={
            [...datos.meses.entries()].filter(
              ([k, m]) => anualDe(m) > 0 && !previo.generado.has(k)
            ).length
          }
          cancelar={() => setPrevio(null)}
          aplicar={() => {
            for (const [k, meses] of previo.generado) guardar(k, meses);
            setPrevio(null);
          }}
        />
      )}

      {ajustando && (
        <CuadroAjuste
          linea={ajustando}
          // Desde el mes en curso: lo anterior ya se midió contra el plan que
          // tenía, y reescribirlo cambiaría el % utilizado de meses cerrados.
          desde={Number(HOY.slice(5, 7))}
          cancelar={() => setAjustando(null)}
          confirmar={(meses, motivo) => {
            guardar(ajustando.clave, meses, undefined, motivo);
            setAjustando(null);
          }}
        />
      )}

      {bitacora && (
        <Bitacora
          titulo={bitacora.titulo}
          cambios={
            bitacora.de
              ? datos.cambios.filter(
                  (c) => clave(c.categoria_id, c.subcategoria_id) === bitacora.de
                )
              : datos.cambios
          }
          nombreDe={(k) => {
            const { categoria_id, subcategoria_id } = partesDeClave(k);
            const cat = catalogo.categoriaDe(categoria_id).nombre;
            const sub = catalogo.nombreSubcategoria(subcategoria_id);
            return sub ? `${cat} · ${sub}` : cat;
          }}
          cerrar={() => setBitacora(null)}
        />
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

      {!cargando && !cargandoMovimientos && totalGeneral.anual === 0 && (
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
  control,
}: {
  seccion: {
    titulo: string;
    grupos: {
      grupo: { id: string; nombre: string };
      categorias: CategoriaConFilas[];
      filas: FilaPresupuesto[];
      total: ReturnType<typeof totalizar>;
    }[];
    total: ReturnType<typeof totalizar>;
  };
  mes: number;
  meses: Map<string, Meses>;
  metadata: Map<string, { monto: number; monto_anterior: number; responsable: string; nota: string }>;
  guardar: (sub: string, meses: Meses, linea?: FilaPresupuesto | typeof LINEA_VACIA) => void;
  abrir: (titulo: string, subs: Set<string>) => void;
  control: Control;
}) {
  return (
    <>
      <tr className={tabla.filaSeccion}>
        <td className={tabla.td} colSpan={7}>
          <Rotulo texto={seccion.titulo} />
        </td>
      </tr>

      {seccion.grupos.map(({ grupo, categorias, filas, total }) => (
        <FilasDeGrupo
          key={grupo.id}
          grupo={grupo}
          categorias={categorias}
          filas={filas}
          total={total}
          mes={mes}
          meses={meses}
          metadata={metadata}
          guardar={guardar}
          abrir={abrir}
          control={control}
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
  categorias,
  filas,
  total,
  mes,
  meses,
  metadata,
  guardar,
  abrir,
  control,
}: {
  grupo: { id: string; nombre: string };
  categorias: CategoriaConFilas[];
  filas: FilaPresupuesto[];
  total: ReturnType<typeof totalizar>;
  mes: number;
  meses: Map<string, Meses>;
  metadata: Map<string, { monto: number; monto_anterior: number; responsable: string; nota: string }>;
  guardar: (sub: string, meses: Meses, linea?: never) => void;
  abrir: (titulo: string, subs: Set<string>) => void;
  control: Control;
}) {
  return (
    <>
      <tr className={css.filaGrupo}>
        <td className={clases(tabla.td, css.nombreGrupo)} colSpan={2}>
          {grupo.nombre}
        </td>
        <Numeros
          total={total}
          abrir={() => abrir(grupo.nombre, new Set(filas.map((f) => f.clave)))}
        />
      </tr>

      {categorias.map(({ categoria, filas: suyas, conHijas }) => {
        // Una categoría sin subcategorías es una fila y nada más: así se vio
        // siempre y no hay nada que agrupar. Con subcategorías, el total de la
        // categoría es la suma de sus hijas y deja de ser editable: el número se
        // escribe abajo, donde se decide.
        const enArbol = conHijas && (suyas.length > 1 || suyas[0]?.subcategoria_id !== null);
        if (!enArbol) {
          const f = suyas[0];
          if (!f) return null;
          return (
            <Fila
              key={f.clave}
              fila={f}
              mes={mes}
              mesesActuales={meses.get(f.clave) ?? sinMeses()}
              guardar={guardar}
              metadata={metadata}
              abrir={abrir}
              control={control}
            />
          );
        }

        const total = totalizar(suyas);
        return (
          <Fragment key={categoria.id}>
            <tr className={css.filaCategoria}>
              <td className={clases(tabla.td, css.nombreCategoria)} colSpan={2}>
                {categoria.nombre}
              </td>
              <Numeros
                total={total}
                abrir={() => abrir(categoria.nombre, new Set(suyas.map((f) => f.clave)))}
              />
            </tr>
            {suyas.map((f) => (
              <Fila
                key={f.clave}
                fila={f}
                mes={mes}
                mesesActuales={meses.get(f.clave) ?? sinMeses()}
                guardar={guardar}
                metadata={metadata}
                abrir={abrir}
                control={control}
                anidada
              />
            ))}
          </Fragment>
        );
      })}
    </>
  );
}

function Fila({
  fila,
  mesesActuales,
  guardar,
  metadata,
  abrir,
  control,
  anidada,
}: {
  fila: FilaPresupuesto;
  mes: number;
  mesesActuales: Meses;
  guardar: (sub: string, meses: Meses, linea?: never) => void;
  metadata: Map<string, { monto: number; monto_anterior: number; responsable: string; nota: string }>;
  abrir: (titulo: string, subs: Set<string>) => void;
  control: Control;
  /** Cuelga de una categoría que ya se nombró arriba. */
  anidada?: boolean;
}) {
  const { catalogo } = useTesoreria();
  // Para devolver el campo a su valor cuando el cuadro de ajuste se cancela: el
  // input es no controlado y si no, queda mostrando un número que no se guardó.
  const [reset, setReset] = useState(0);

  // Anidada, la fila es una subcategoría o la categoría en sí. Esta última no
  // tiene nombre propio: es "lo que se clasificó acá sin precisar más", el
  // "(Other)" de Quicken, y llamarla igual que la madre confundiría las dos.
  const nombre = anidada
    ? (catalogo.nombreSubcategoria(fila.subcategoria_id) ?? "Sin subcategoría")
    : catalogo.categoriaDe(fila.categoria_id).nombre;
  const sinPrecisar = anidada && fila.subcategoria_id === null;

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

    // Con el año aprobado, escribir el anual ya no es escribir un número: es un
    // ajuste, que mueve solo lo que queda del año y tiene que decir por qué. El
    // número escrito viaja al cuadro, así que el gesto no se pierde.
    if (control.aprobado) {
      control.pedirAjuste(fila.clave, nombre, mesesActuales, nuevo);
      setReset((n) => n + 1);
      return;
    }

    // Reescalar y no repartir parejo: si la línea tiene forma —un aguinaldo en
    // diciembre— subirle el total no debe aplanarla.
    guardar(fila.clave, nuevo === 0 ? sinMeses() : reescalar(mesesActuales, nuevo));
  };

  const ajuste = control.ajusteDe(fila.clave);

  const cambiarMeta = (campo: "responsable" | "nota", valor: string) => {
    const actual = metadata.get(fila.clave) ?? LINEA_VACIA;
    guardar(fila.clave, mesesActuales, { ...actual, [campo]: valor } as never);
  };

  return (
    <tr className="fila">
      <td
        className={clases(tabla.td, css.nombreSub, anidada && css.nombreAnidado)}
        title={
          sinPrecisar
            ? "Lo clasificado en la categoría sin elegir subcategoría. Si acá hay gasto sin presupuesto, es que alguien no precisó."
            : undefined
        }
      >
        <span className={clases(sinPrecisar && css.sinPrecisar)}>{nombre}</span>
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
          key={`${fila.anual}-${reset}`}
          defaultValue={fila.anual ? mag(fila.anual) : ""}
          aria-label={`Presupuesto de ${nombre}`}
          onBlur={(e) => cambiarAnual(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          placeholder="0"
          className={css.entradaMonto}
        />
        {/* Dónde se está ajustando el año, línea por línea. Abre la bitácora de
            ésta: el número solo dice cuánto, y lo que hace falta saber es por qué. */}
        {ajuste !== 0 && (
          <button
            type="button"
            onClick={() => control.verCambios(fila.clave, nombre)}
            title={`Ajustada ${clp(ajuste)} respecto del presupuesto aprobado. Ver por qué.`}
            className={css.marcaAjuste}
          >
            {ajuste > 0 ? "+" : ""}
            {clp(ajuste)}
          </button>
        )}
      </td>

      <td className={clases(tabla.td, tabla.tdNum)}>{mag(fila.ytd)}</td>
      <td className={clases(tabla.td, tabla.tdNum)}>
        <Gasto
          valor={fila.real}
          abrir={() => abrir(nombre, new Set([fila.clave]))}
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
