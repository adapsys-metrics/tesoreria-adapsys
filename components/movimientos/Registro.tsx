"use client";

// Movimientos — registro único de todas las empresas (§6). Empresa y categoría
// editables inline, editor de splits desplegable, y separador visual donde la lista
// pasa del pasado al futuro.

import { Fragment, useEffect, useMemo, useState } from "react";
import { empresaDe } from "@/lib/catalogo-indices";
import { useTesoreria } from "@/components/estado/ProveedorTesoreria";
import { descuadre, enCLP } from "@/lib/dominio";
import { claveDeCuenta, esRegistroDeBanco } from "@/lib/registros";
import { saldosCorrientes } from "@/lib/saldos";
import { diasDeAtraso, estaVencido } from "@/lib/vencidos";
import { pasoDe } from "@/lib/cobranza";
import {
  alternarOrden,
  ordenDeEntrada,
  ordenarMovimientos,
  type ColumnaOrden,
} from "@/lib/orden";
import { clp } from "@/lib/formato";
import { HOY, fechaCorta } from "@/lib/fechas";
import { Cabecera, Nota, Pill, Vacio, clases } from "@/components/ui/primitivas";
import { SelectorCategoria } from "@/components/ui/SelectorCategoria";
import { EditorMovimiento } from "./EditorMovimiento";
import { FormaNuevo } from "./FormaNuevo";
import css from "./movimientos.module.css";
import tabla from "@/components/ui/tabla.module.css";

// `orden: null` = columna no ordenable. La última columna son los botones de
// acción y no tiene encabezado.
type Columna = { titulo: string; orden: ColumnaOrden | null; num?: boolean };

const columnas = (conSaldo: boolean): Columna[] => [
  { titulo: "Fecha", orden: "fecha" },
  { titulo: "Empresa", orden: "cuenta" },
  { titulo: "Proveedor / Cliente", orden: "contraparte" },
  { titulo: "Glosa", orden: "glosa" },
  { titulo: "Categoría", orden: "categoria" },
  { titulo: "Monto", orden: "monto", num: true },
  // El saldo no se ordena: es el saldo DESPUÉS de ese movimiento, un dato del
  // punto en el tiempo. Ordenarlo por su valor no significaría nada.
  ...(conSaldo ? [{ titulo: "Saldo", orden: null, num: true } as Columna] : []),
  { titulo: "Estado", orden: null },
  { titulo: "", orden: null },
];

export function Registro() {
  const {
    movimientosFiltrados,
    cuentas,
    tc,
    tasas,
    setTasas,
    editarMovimiento,
    editarLinea,
    agregarLinea,
    cambiarCuenta,
    pagar,
    avanzarCobranza,
    registroSeleccionado,
    movimientos,
    catalogo,
  } = useTesoreria();

  const cuentasBanco = useMemo(() => cuentas.filter((c) => c.tipo === "banco"), [cuentas]);
  const [busqueda, setBusqueda] = useState("");
  const [soloPendiente, setSoloPendiente] = useState(true);

  // Abrir una cuenta del banco apaga "solo pendiente". Esa vista es la cartola —
  // exactamente lo ya conciliado— así que los dos filtros juntos se anulan y la
  // tabla queda vacía, que es lo peor que puede hacer: parece que la cuenta no
  // tiene movimientos.
  const enBanco = esRegistroDeBanco(registroSeleccionado, cuentas);

  // El saldo corriente solo aparece con una cuenta bancaria abierta: es el saldo
  // DE esa cuenta. Sobre movimientos de varias cuentas no sería el saldo de nada.
  const cuentaAbierta = enBanco
    ? cuentas.find((c) => claveDeCuenta(c.id) === registroSeleccionado)
    : undefined;

  // Se calcula sobre TODOS los movimientos, no sobre los que se ven: hacerlo con
  // la lista filtrada daría un saldo que cambia según lo escrito en el buscador,
  // y se vería igual de correcto.
  const saldos = useMemo(
    () => (cuentaAbierta ? saldosCorrientes(cuentaAbierta, movimientos) : null),
    [cuentaAbierta, movimientos]
  );

  const COLUMNAS = useMemo(() => columnas(saldos !== null), [saldos]);

  // Sobre los movimientos del registro abierto, no sobre los que se ven: el
  // contador tiene que decir cuántos hay, no cuántos quedaron tras el buscador.
  const vencidos = useMemo(
    () => movimientosFiltrados.filter((m) => estaVencido(m, HOY)).length,
    [movimientosFiltrados]
  );
  useEffect(() => {
    setSoloPendiente(!enBanco);
    setOrden(ordenDeEntrada(enBanco));
  }, [enBanco, registroSeleccionado]);

  const [soloVencidos, setSoloVencidos] = useState(false);
  const [nuevo, setNuevo] = useState(false);
  const [abiertos, setAbiertos] = useState<string[]>([]);
  const [orden, setOrden] = useState(() => ordenDeEntrada(false));


  const lista = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const filtrados = movimientosFiltrados
      .filter((m) => {
        // El prototipo filtraba solo por fecha ("desde hoy"), y eso escondía las
        // facturas con fecha pasada que siguen impagas — justo las que hay que
        // accionar. Acá el filtro oculta el histórico ya cerrado, no lo pendiente.
        if (soloVencidos && !estaVencido(m, HOY)) return false;
        if (soloPendiente && m.fecha < HOY && m.estado === "conciliado") return false;
        if (!q) return true;
        // También por número de documento: "¿la 273 ya la pagaron?" es la
        // pregunta más frecuente de cobranza.
        return (
          (m.contraparte ?? "").toLowerCase().includes(q) ||
          (m.glosa ?? "").toLowerCase().includes(q) ||
          (m.documento ?? "").toLowerCase().includes(q)
        );
      })
      .slice();
    return ordenarMovimientos(filtrados, orden, tc, {
      // Las etiquetas son las mismas que se muestran en la fila: ordenar por algo
      // distinto de lo que se ve es la forma más rápida de que nadie confíe en el
      // orden.
      cuenta: (m) => {
        const c = cuentasBanco.find((x) => x.id === m.cuenta_id);
        return c ? `${empresaDe(c.empresa_id).nombre} ${c.moneda}` : "";
      },
      // Vacío para los sin clasificar, no "Sin clasificar": así caen al final de
      // la columna en los dos sentidos, agrupados y fáciles de encontrar, en vez
      // de quedar sueltos entre la S y la T del catálogo.
      categoria: (m) => {
        if (m.lineas.length > 1) return `Split · ${m.lineas.length} líneas`;
        const linea = m.lineas[0];
        return linea ? catalogo.categoriaDe(linea.categoria_id).nombre : "";
      },
    });
  }, [movimientosFiltrados, busqueda, soloPendiente, soloVencidos, orden, tc, cuentasBanco, catalogo]);

  const alternar = (id: string) =>
    setAbiertos(abiertos.includes(id) ? abiertos.filter((x) => x !== id) : [...abiertos, id]);

  return (
    <>
      <Cabecera
        titulo="Movimientos"
        bajada="Registro único de todas las empresas. La empresa y la categoría se editan en la misma fila; los splits se abren para ver y ajustar sus líneas."
      />

      <div className={css.barra}>
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por proveedor, glosa o N° de documento…"
          aria-label="Buscar"
          className={css.busqueda}
        />

        <label
          className={clases(css.filtroFuturo, vencidos > 0 && css.filtroVencidos)}
          title="Compromisos y cobranzas con fecha pasada que todavía no ocurren"
        >
          <input
            type="checkbox"
            checked={soloVencidos}
            onChange={(e) => setSoloVencidos(e.target.checked)}
          />
          Solo vencidos
          {vencidos > 0 && <span className={css.conteoVencidos}>{vencidos}</span>}
        </label>

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
                {COLUMNAS.map((col) => (
                  <th
                    key={col.titulo || "acciones"}
                    className={clases(tabla.th, col.num && tabla.thNum)}
                    aria-sort={
                      col.orden && orden.columna === col.orden
                        ? orden.sentido === "asc"
                          ? "ascending"
                          : "descending"
                        : undefined
                    }
                  >
                    {col.orden ? (
                      <button
                        type="button"
                        onClick={() => setOrden(alternarOrden(orden, col.orden!))}
                        title={`Ordenar por ${col.titulo.toLowerCase()}`}
                        className={clases(
                          css.encabezadoOrden,
                          orden.columna === col.orden && css.encabezadoOrdenActivo
                        )}
                      >
                        {col.titulo}
                        <span className={css.flechaOrden}>
                          {orden.columna === col.orden
                            ? orden.sentido === "asc"
                              ? "▲"
                              : "▼"
                            : "↕"}
                        </span>
                      </button>
                    ) : (
                      col.titulo
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lista.map((m, i) => {
                const anterior = lista[i - 1];
                // La marca de FUTURO solo dice algo si la lista va por fecha hacia
                // adelante. Ordenada por monto o por proveedor caería en un lugar
                // arbitrario y afirmaría algo falso sobre lo que viene después.
                const cruzaHoy =
                  orden.columna === "fecha" &&
                  orden.sentido === "asc" &&
                  anterior !== undefined &&
                  anterior.fecha < HOY &&
                  m.fecha >= HOY;
                const abierto = abiertos.includes(m.id);
                const dif = descuadre(m);
                const paso = pasoDe(m, cuentas);
                const vencido = estaVencido(m, HOY);
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

                    <tr className={clases("fila", vencido && css.filaVencida)}>
                      <td className={clases(tabla.td, css.fecha)}>
                        {fechaCorta(m.fecha)}
                        {/* Los días de atraso van al lado de la fecha y no en una
                            columna aparte: lo que importa no es el dato sino que
                            la fila entera se lea distinta al recorrerla. */}
                        {vencido && (
                          <span
                            className={css.atraso}
                            title={`Comprometido hace ${diasDeAtraso(m.fecha, HOY)} días y todavía sin ocurrir`}
                          >
                            +{diasDeAtraso(m.fecha, HOY)}d
                          </span>
                        )}
                      </td>

                      {/* Se elige la cuenta, no la empresa: la cuenta determina
                          empresa y moneda a la vez. Se muestra el nombre corto de la
                          empresa más la moneda, que es lo que distingue las cuentas. */}
                      <td className={tabla.td}>
                        <select
                          value={m.cuenta_id ?? ""}
                          aria-label="Cuenta"
                          onChange={(e) => cambiarCuenta(m.id, e.target.value)}
                          className={css.selectEmpresa}
                        >
                          {m.cuenta_id === null && <option value="">— sin cuenta —</option>}
                          {cuentasBanco.map((c) => (
                            <option key={c.id} value={c.id}>
                              {empresaDe(c.empresa_id).nombre} · {c.moneda}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className={clases(tabla.td, css.contraparte)}>{m.contraparte}</td>
                      <td className={clases(tabla.td, css.glosa)} title={m.glosa ?? ""}>
                        {m.documento && <span className={css.documento}>{m.documento}</span>}
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
                            <SelectorCategoria
                              valor={m.lineas[0]?.categoria_id ?? null}
                              onChange={(id) =>
                                m.lineas.length
                                  ? editarLinea(m.id, 0, "categoria_id", id)
                                  : editarMovimiento(m.id, "lineas", [
                                      { categoria_id: id, subcategoria_id: null, monto: m.monto, glosa: null },
                                    ])
                              }
                            />
                            <button
                              type="button"
                              title="Repartir en varias líneas"
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

                      {saldos && (
                        <td className={clases(tabla.td, css.monto, css.saldo)}>
                          {/* Un proyectado no mueve el saldo: se muestra el vigente
                              hasta ese punto, atenuado, para que se lea como "acá
                              todavía no pasa nada" y no como un saldo nuevo. */}
                          <span className={m.estado === "proyectado" ? css.saldoQuieto : undefined}>
                            {clp(saldos.get(m.id) ?? 0)}
                          </span>
                        </td>
                      )}

                      <td className={tabla.td}>
                        {/* La acción depende de dónde esté el movimiento: un
                            proyecto aprobado se factura, una factura se cobra y un
                            egreso proyectado se marca pagado. Ver lib/cobranza.ts. */}
                        {paso.accion === "ninguna" ? (
                          paso.motivo ? (
                            <span className={css.sinAccion} title={paso.motivo}>
                              {paso.motivo}
                            </span>
                          ) : (
                            <Pill estado={m.estado} />
                          )
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              if (paso.accion === "pagar") return pagar(m.id);
                              // Facturar abre el editor: hay que revisar número,
                              // fecha y monto antes de emitir. Se confirma ahí.
                              if (paso.accion === "facturar") {
                                if (!abierto) alternar(m.id);
                                return;
                              }
                              avanzarCobranza(m.id);
                            }}
                            title={
                              paso.accion === "facturar"
                                ? "Abre el movimiento para completar el número, la fecha y el monto"
                                : paso.titulo
                            }
                            className={css.botonPagar}
                          >
                            {paso.etiqueta}
                          </button>
                        )}
                      </td>

                      <td className={tabla.td}>
                        <button
                          type="button"
                          onClick={() => alternar(m.id)}
                          aria-expanded={abierto}
                          title={abierto ? "Cerrar el editor" : "Editar el movimiento"}
                          className={css.botonEditar}
                        >
                          {abierto ? "▾" : "▸"}
                        </button>
                      </td>
                    </tr>

                    {abierto && (
                      <tr className={css.filaEditor}>
                        <td colSpan={COLUMNAS.length}>
                          <EditorMovimiento movimiento={m} />
                        </td>
                      </tr>
                    )}
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
