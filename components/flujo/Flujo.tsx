"use client";

// Flujo de caja — réplica mejorada del reporte de Quicken (§6).
// Solo aparecen las líneas con movimiento en el rango; cada monto es clicable y abre
// el detalle, donde se puede reclasificar sin salir de la vista.

import { Fragment, useMemo, useState } from "react";
import { NATURALEZAS } from "@/lib/catalogo";
import { useTesoreria } from "@/components/estado/ProveedorTesoreria";
import { enCLP, expandir } from "@/lib/dominio";
import { clp } from "@/lib/formato";
import {
  ANIO,
  HOY,
  MESES_CORTOS,
  RANGOS,
  anioDe,
  finDeMes,
  inicioDeMes,
  lunesDe,
  mesDe,
  sumarDias,
} from "@/lib/fechas";
import type { EstadoMovimiento, LineaExpandida } from "@/lib/tipos";
import { Aviso, BotonFantasma, Cabecera, Chip, Nota, clases } from "@/components/ui/primitivas";
import { PanelDetalle, type Detalle } from "./PanelDetalle";
import tabla from "@/components/ui/tabla.module.css";
import css from "./flujo.module.css";

const ESTADOS: EstadoMovimiento[] = ["conciliado", "pagado", "proyectado"];
const SIN_CLASIFICAR = "__sin_clasificar";
/** Tope de columnas: más que esto no se lee y el render se vuelve caro. */
const MAX_PERIODOS = 40;

type Periodo = { desde: string; hasta: string; etiqueta: string; anio: number };

export function Flujo() {
  const {
    movimientosFiltrados,
    efectivo,
    tc,
    editarMovimiento,
    editarLinea,
    catalogo,
  } = useTesoreria();

  const [granularidad, setGranularidad] = useState<"semana" | "mes">("semana");
  const [rango, setRango] = useState("fut");
  const [desde, setDesde] = useState(lunesDe(HOY));
  const [hasta, setHasta] = useState(`${ANIO}-12-31`);
  const [estados, setEstados] = useState<EstadoMovimiento[]>(ESTADOS);
  const [soloCLP, setSoloCLP] = useState(true);
  const [abiertas, setAbiertas] = useState<string[]>([]);
  const [detalle, setDetalle] = useState<Detalle | null>(null);

  const aplicarRango = (id: string) => {
    const r = RANGOS.find((x) => x.id === id);
    if (!r) return;
    const [a, b] = r.calc();
    setRango(id);
    // "De hoy en adelante" arranca en el lunes, para no cortar la primera semana.
    setDesde(id === "fut" ? lunesDe(HOY) : a);
    setHasta(b);
  };

  const periodos = useMemo<Periodo[]>(() => {
    const out: Periodo[] = [];
    if (granularidad === "mes") {
      let anio = anioDe(desde);
      let mes = mesDe(desde);
      while (inicioDeMes(anio, mes) <= hasta && out.length < MAX_PERIODOS) {
        const ini = inicioDeMes(anio, mes);
        const fin = finDeMes(anio, mes);
        out.push({
          desde: ini < desde ? desde : ini,
          hasta: fin > hasta ? hasta : fin,
          etiqueta: MESES_CORTOS[mes - 1]!,
          anio,
        });
        mes += 1;
        if (mes > 12) {
          mes = 1;
          anio += 1;
        }
      }
    } else {
      let lunes = lunesDe(desde);
      while (lunes <= hasta && out.length < MAX_PERIODOS) {
        const domingo = sumarDias(lunes, 6);
        const ini = lunes < desde ? desde : lunes;
        const fin = domingo > hasta ? hasta : domingo;
        const dm = (f: string) => `${f.slice(8)}-${f.slice(5, 7)}`;
        out.push({ desde: ini, hasta: fin, etiqueta: `${dm(ini)}–${dm(fin)}`, anio: anioDe(lunes) });
        lunes = sumarDias(lunes, 7);
      }
    }
    return out;
  }, [desde, hasta, granularidad]);

  const enRango = useMemo(
    () =>
      expandir(
        movimientosFiltrados.filter(
          (m) => m.fecha >= desde && m.fecha <= hasta && estados.includes(m.estado)
        )
      ),
    [movimientosFiltrados, desde, hasta, estados]
  );

  // El flujo se lleva sólo en CLP (§4.5): lo que no es peso se aparta y se avisa.
  const datos = useMemo(
    () => (soloCLP ? enRango.filter((m) => m.moneda === "CLP") : enRango),
    [enRango, soloCLP]
  );
  const fueraDelFlujo = useMemo(() => enRango.filter((m) => m.moneda !== "CLP"), [enRango]);

  /**
   * Índice subcategoría → monto por período. El prototipo recorría todos los
   * movimientos por cada celda (40 columnas × cientos de filas); acá se recorre una
   * sola vez y cada celda es una lectura. Mismo resultado, mucho menos trabajo.
   */
  const indice = useMemo(() => {
    const m = new Map<string, number[]>();
    for (const fila of datos) {
      const i = periodos.findIndex((p) => fila.fecha >= p.desde && fila.fecha <= p.hasta);
      if (i < 0) continue;
      const clave = fila.subcategoria_id ?? SIN_CLASIFICAR;
      let acumulado = m.get(clave);
      if (!acumulado) {
        acumulado = new Array<number>(periodos.length).fill(0);
        m.set(clave, acumulado);
      }
      acumulado[i] = (acumulado[i] ?? 0) + enCLP(fila, tc);
    }
    return m;
  }, [datos, periodos, tc]);

  const sumaPeriodo = (ids: string[], i: number) =>
    ids.reduce((s, id) => s + (indice.get(id)?.[i] ?? 0), 0);
  const sumaTotal = (ids: string[]) =>
    ids.reduce((s, id) => s + (indice.get(id)?.reduce((a, b) => a + b, 0) ?? 0), 0);
  const porPeriodo = (ids: string[]) => periodos.map((_, i) => sumaPeriodo(ids, i));

  const abrir = (titulo: string, ids: string[], i: number | null) => {
    const p = i === null ? null : periodos[i]!;
    setDetalle({
      titulo,
      periodo: p ? `${p.etiqueta} ${p.anio}` : `${desde} a ${hasta}`,
      items: datos
        .filter(
          (m) =>
            ids.includes(m.subcategoria_id ?? SIN_CLASIFICAR) &&
            (!p || (m.fecha >= p.desde && m.fecha <= p.hasta))
        )
        .sort((a, b) => a.fecha.localeCompare(b.fecha) || enCLP(a, tc) - enCLP(b, tc)),
    });
  };

  const conMovimiento = useMemo(() => new Set(indice.keys()), [indice]);

  // Naturaleza → categoría → subcategorías, descartando todo lo que no tiene
  // movimiento. Una categoría mixta aparece en dos naturalezas, cada vez con solo
  // las líneas que le corresponden (§4.2).
  const secciones = NATURALEZAS.map((n) => ({
    naturaleza: n,
    grupos: catalogo.categorias
      .map((c) => ({
        categoria: c,
        subs: catalogo.subcategoriasDe(c.id, n.id).filter((s) => conMovimiento.has(s.id)),
      }))
      .filter((g) => g.subs.length),
  })).filter((x) => x.grupos.length);

  const idsPorNaturaleza = (nat: string) =>
    catalogo.subcategorias.filter((s) => s.naturaleza === nat).map((s) => s.id);

  const ingresos = porPeriodo(idsPorNaturaleza("ingreso"));
  const egresos = periodos.map(
    (_, i) =>
      sumaPeriodo(idsPorNaturaleza("inversion"), i) +
      sumaPeriodo(idsPorNaturaleza("operativo"), i)
  );
  // Los egresos ya vienen negativos, así que el neto es una suma.
  const neto = periodos.map((_, i) => ingresos[i]! + egresos[i]!);
  let corrido = 0;
  const acumulado = neto.map((v) => (corrido += v));
  const esProyeccion = desde >= HOY;

  const sinClasificar = indice.get(SIN_CLASIFICAR);

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

  const celda = (
    valor: number,
    clave: string | number,
    o: { fuerte?: boolean; color?: string; abrir?: () => void; borde?: boolean } = {}
  ) => (
    <td
      key={clave}
      className={clases(css.celda, o.borde && css.celdaBorde)}
      // Más ancho que antes porque el monto va completo: "−269.000.000" no cabe
      // en el ancho que alcanzaba para "−269M".
      style={{ minWidth: granularidad === "mes" ? 124 : 132 }}
    >
      {valor === 0 || !o.abrir ? (
        <span
          className={clases(css.valor, valor === 0 && tabla.cero, o.fuerte && css.fuerte)}
          style={o.color ? { color: o.color } : valor < 0 ? { color: "var(--brick)" } : undefined}
        >
          {valor === 0 ? "$0" : clp(valor)}
        </span>
      ) : (
        <button
          type="button"
          onClick={o.abrir}
          title="Ver el detalle de este monto"
          className={clases(css.valor, css.botonValor, o.fuerte && css.fuerte)}
          style={o.color ? { color: o.color } : valor < 0 ? { color: "var(--brick)" } : undefined}
        >
          {clp(valor)}
        </button>
      )}
    </td>
  );

  const filaTotal = (
    etiqueta: string,
    valores: number[],
    o: { color?: string; clase?: string; abrir?: (i: number | null) => void } = {}
  ) => (
    <tr key={etiqueta} className={o.clase}>
      <td className={clases(tabla.tdFijo, css.etiquetaTotal)} style={o.color ? { color: o.color } : undefined}>
        {etiqueta}
      </td>
      {valores.map((v, i) =>
        celda(v, i, { fuerte: true, color: o.color, abrir: o.abrir && (() => o.abrir!(i)) })
      )}
      {celda(valores.reduce((a, b) => a + b, 0), "t", {
        fuerte: true,
        color: o.color,
        borde: true,
        abrir: o.abrir && (() => o.abrir!(null)),
      })}
    </tr>
  );

  const minimoAcumulado = acumulado.length ? Math.min(...acumulado) : 0;

  return (
    <>
      <Cabecera
        titulo="Flujo de caja"
        bajada="Sólo aparecen las categorías y subcategorías con movimiento en el rango elegido. Despliega una categoría para ver su detalle."
      />

      <div className={css.filtros}>
        {RANGOS.map((r) => (
          <Chip key={r.id} chico activo={rango === r.id} onClick={() => aplicarRango(r.id)}>
            {r.nombre}
          </Chip>
        ))}
        <input
          type="date"
          value={desde}
          aria-label="Desde"
          onChange={(e) => {
            setDesde(e.target.value);
            setRango("libre");
          }}
          className={css.fecha}
        />
        <span className={css.separadorTexto}>a</span>
        <input
          type="date"
          value={hasta}
          aria-label="Hasta"
          onChange={(e) => {
            setHasta(e.target.value);
            setRango("libre");
          }}
          className={css.fecha}
        />
        <span className={css.separador} />
        <Chip chico activo={granularidad === "semana"} onClick={() => setGranularidad("semana")}>
          Semanal
        </Chip>
        <Chip chico activo={granularidad === "mes"} onClick={() => setGranularidad("mes")}>
          Mensual
        </Chip>
        <span className={css.separador} />
        {ESTADOS.map((e) => (
          <Chip
            key={e}
            chico
            activo={estados.includes(e)}
            titulo={e}
            onClick={() =>
              setEstados(
                estados.includes(e) ? estados.filter((x) => x !== e) : [...estados, e]
              )
            }
          >
            {e.slice(0, 4)}
          </Chip>
        ))}
        <span className={css.separador} />
        <Chip chico activo={soloCLP} onClick={() => setSoloCLP(!soloCLP)}>
          {soloCLP ? "Sólo CLP" : `CLP + USD @${tc}`}
        </Chip>
        <span className={css.empuje} />
        <BotonFantasma
          onClick={() => setAbiertas(abiertas.length ? [] : catalogo.categorias.map((c) => c.id))}
        >
          {abiertas.length ? "Colapsar todo" : "Expandir todo"}
        </BotonFantasma>
      </div>

      {soloCLP && fueraDelFlujo.length > 0 && (
        <Aviso>
          <strong className={css.rotuloAviso}>Fuera del flujo</strong>{" "}
          {fueraDelFlujo.length} movimiento{fueraDelFlujo.length > 1 ? "s" : ""} en dólares por
          US${clp(fueraDelFlujo.reduce((s, m) => s + m.monto, 0))}. El saldo de las cuentas en
          USD tampoco entra.
        </Aviso>
      )}

      {sinClasificar && (
        <Aviso tono="amber">
          <strong className={css.rotuloAviso}>Sin clasificar</strong> Hay movimientos sin
          subcategoría por{" "}
          {clp(sinClasificar.reduce((a, b) => a + b, 0))}. No entran en ninguna categoría del
          reporte: hay que asignarlos.
        </Aviso>
      )}

      {esProyeccion && acumulado.length > 0 && efectivo + minimoAcumulado < 0 && (
        <Aviso tono="brick">
          Con este flujo el saldo estimado cae a {clp(efectivo + minimoAcumulado)} dentro del
          período.
        </Aviso>
      )}

      <div className={tabla.envoltorio}>
        <table className={clases(tabla.tabla, tabla.tablaAncha)}>
          <thead>
            <tr>
              <th className={tabla.thFijo}>Categoría</th>
              {periodos.map((p, i) => (
                <th
                  key={i}
                  className={clases(tabla.th, tabla.thNum)}
                  // Más ancho que antes porque el monto va completo: "−269.000.000" no cabe
      // en el ancho que alcanzaba para "−269M".
      style={{ minWidth: granularidad === "mes" ? 124 : 132 }}
                >
                  <div className={css.anio}>{p.anio}</div>
                  {p.etiqueta}
                </th>
              ))}
              <th className={clases(tabla.th, tabla.thNum, css.celdaBorde)} style={{ minWidth: 110 }}>
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {secciones.map(({ naturaleza, grupos }) => {
              const idsSeccion = grupos.flatMap((g) => g.subs.map((s) => s.id));
              const esIngreso = naturaleza.id === "ingreso";
              return (
                <Fragment key={`sec-${naturaleza.id}`}>
                  <tr className={tabla.filaSeccion}>
                    <td colSpan={periodos.length + 2}>{naturaleza.nombre}</td>
                  </tr>

                  {grupos.map(({ categoria, subs }) => {
                    const ids = subs.map((s) => s.id);
                    const valores = porPeriodo(ids);
                    const desplegada = abiertas.includes(categoria.id);
                    return (
                      <Fragment key={`${naturaleza.id}-${categoria.id}`}>
                        <tr className={clases("fila", tabla.filaCategoria)}>
                          <td className={tabla.tdFijo}>
                            <button
                              type="button"
                              className={tabla.botonColapso}
                              aria-expanded={desplegada}
                              onClick={() =>
                                setAbiertas(
                                  desplegada
                                    ? abiertas.filter((x) => x !== categoria.id)
                                    : [...abiertas, categoria.id]
                                )
                              }
                            >
                              <span className={css.flecha}>{desplegada ? "▾" : "▸"}</span>
                              {categoria.nombre}
                              <span className={tabla.conteo}>{subs.length}</span>
                            </button>
                          </td>
                          {valores.map((v, i) =>
                            celda(v, i, {
                              fuerte: true,
                              abrir: () => abrir(categoria.nombre, ids, i),
                            })
                          )}
                          {celda(sumaTotal(ids), "t", {
                            fuerte: true,
                            borde: true,
                            abrir: () => abrir(categoria.nombre, ids, null),
                          })}
                        </tr>

                        {desplegada &&
                          subs.map((s) => {
                            const valoresSub = porPeriodo([s.id]);
                            return (
                              <tr
                                key={`${naturaleza.id}-${s.id}`}
                                className={clases("fila", tabla.filaSubcategoria)}
                              >
                                <td className={clases(tabla.tdFijo, tabla.sangria, css.nombreSub)}>
                                  {s.nombre}
                                </td>
                                {valoresSub.map((v, i) =>
                                  celda(v, i, { abrir: () => abrir(s.nombre, [s.id], i) })
                                )}
                                {celda(sumaTotal([s.id]), "t", {
                                  borde: true,
                                  abrir: () => abrir(s.nombre, [s.id], null),
                                })}
                              </tr>
                            );
                          })}
                      </Fragment>
                    );
                  })}

                  {filaTotal(`Total ${naturaleza.nombre}`, porPeriodo(idsSeccion), {
                    color: esIngreso ? "var(--teal)" : "var(--brick)",
                    abrir: (i) => abrir(`Total ${naturaleza.nombre}`, idsSeccion, i),
                  })}
                </Fragment>
              );
            })}

            {filaTotal("Flujo neto del período", neto, { clase: css.filaNeto })}
            {filaTotal("Flujo acumulado", acumulado, { color: "var(--muted)" })}
            {esProyeccion &&
              filaTotal(
                "Saldo estimado",
                acumulado.map((v) => efectivo + v),
                { clase: tabla.filaTotal }
              )}
          </tbody>
        </table>
      </div>

      {detalle && (
        <PanelDetalle
          detalle={detalle}
          cerrar={() => setDetalle(null)}
          tc={tc}
          reclasificar={reclasificar}
        />
      )}

      <Nota>
        Haz clic en cualquier monto para ver los movimientos que lo componen y
        reclasificarlos ahí mismo. El flujo se lleva <strong>sólo en CLP</strong>: los
        movimientos y saldos en dólares quedan fuera. Si en algún momento necesitas verlo
        todo junto, el botón <em>CLP + USD</em> los suma convertidos, dejando registrado el
        tipo de cambio usado. Con <strong>proy</strong> activo la tabla mezcla real y
        proyección, igual que el reporte que revisan hoy.
      </Nota>
    </>
  );
}
