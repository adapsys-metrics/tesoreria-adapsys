"use client";

// Mantenedor del catálogo (§6).
//
// El catálogo es lo que ordena todo lo demás: el flujo se agrupa por él, el
// presupuesto se estructura con él y los reportes lo usan de eje. Por eso esta vista
// es la única que puede dejar el sistema inconsistente, y casi todo su diseño va en
// evitarlo: no se borra lo que está en uso, se desactiva; y los huérfanos que deje
// la migración se muestran arriba en vez de quedar callados (§11).

import { useMemo, useState } from "react";
import { useTesoreria } from "@/components/estado/ProveedorTesoreria";
import { PanelDetalle, type Detalle } from "@/components/flujo/PanelDetalle";
import { expandir } from "@/lib/dominio";
import type { LineaExpandida } from "@/lib/tipos";
import { NATURALEZAS } from "@/lib/catalogo";
import { Aviso, BotonFantasma, Cabecera, Chip, Rotulo, clases } from "@/components/ui/primitivas";
import type { Naturaleza } from "@/lib/tipos";
import css from "./categorias.module.css";

const NOMBRE_NATURALEZA: Record<Naturaleza, string> = {
  ingreso: "ingreso",
  inversion: "inversión",
  operativo: "operativo",
};

export function Categorias() {
  const {
    catalogo,
    usoDeCategoria,
    movimientos,
    renombrarGrupo,
    renombrarCategoria,
    cambiarNaturaleza,
    cambiarNaturalezaDeGrupo,
    alternarControlado,
    alternarActiva,
    crearGrupo,
    crearCategoria,
    borrarCategoria,
    borrarGrupo,
    usoDeSubcategoria,
    crearSubcategoria,
    renombrarSubcategoria,
    alternarActivaSubcategoria,
    borrarSubcategoria,
    tc,
    editarLinea,
    editarMovimiento,
  } = useTesoreria();

  const [busqueda, setBusqueda] = useState("");
  const [abiertas, setAbiertas] = useState<string[]>([]);
  // Borrar pide confirmación en la misma fila en vez de abrir un diálogo del
  // navegador: el aspa se convierte en "borrar / cancelar" y se ve exactamente sobre
  // qué línea se está actuando, que es lo que un confirm() no muestra.
  const [porBorrar, setPorBorrar] = useState<string | null>(null);
  // Aplicar una naturaleza a todo un grupo toca hasta 193 categorías de una vez
  // (A INGRESOS CLIENTES) y no hay deshacer: se confirma diciendo cuántas.
  const [porAplicar, setPorAplicar] = useState<{ grupo: string; naturaleza: Naturaleza } | null>(
    null
  );
  // Qué se está creando: "__grupo" o el id de el grupo que recibe la sub.
  const [creando, setCreando] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  // Quicken muestra el uso como un link y se abre la lista. Es lo que se necesita
  // justo antes de desactivar algo: ver qué hay dentro para saber si estorba.
  const [detalle, setDetalle] = useState<Detalle | null>(null);
  // Con 290 categorías, las desactivadas estorban la lectura salvo cuando se está
  // limpiando el catálogo. Es el "Show All Categories" de Quicken.
  const [verInactivas, setVerInactivas] = useState(true);
  const buscando = busqueda.trim().length > 0;

  const coincide = (texto: string) =>
    texto.toLowerCase().includes(busqueda.trim().toLowerCase());

  const visiblesDe = (grupo_id: string) => {
    const subs = catalogo
      .categoriasDe(grupo_id)
      .filter((s) => verInactivas || s.activa);
    if (!buscando) return subs;
    // Si el nombre de el grupo coincide, se muestran todas sus categorías:
    // buscar "impuestos" tiene que traer el bloque entero, no cero resultados.
    if (coincide(catalogo.grupoDe(grupo_id).nombre)) return subs;
    // Una categoría también entra si la coincidencia está en una subcategoría suya:
    // buscar "Offsite" tiene que llevar hasta ella, y vive un nivel más abajo.
    return subs.filter(
      (s) => coincide(s.nombre) || catalogo.subcategoriasDe(s.id).some((h) => coincide(h.nombre))
    );
  };

  // Líneas que apuntan a una categoría que ya no está en el catálogo. Pasa al
  // reemplazar el catálogo en una migración, y no puede fallar en silencio (§11).
  const huerfanas = useMemo(() => {
    let n = 0;
    for (const m of movimientos) {
      for (const l of m.lineas) {
        if (!catalogo.existeCategoria(l.categoria_id)) n++;
      }
    }
    return n;
  }, [movimientos, catalogo]);

  /** Pedir borrar. Lo que está en uso no se borra: se explica por qué y cuál es la
   *  salida, porque un botón que no hace nada deja al usuario trabado sin saberlo. */
  const pedirBorrarSub = (id: string, nombre: string) => {
    const uso = usoDeCategoria.get(id) ?? 0;
    if (uso > 0) {
      setAviso(
        `"${nombre}" tiene ${uso} línea${uso === 1 ? "" : "s"} de movimiento clasificada${
          uso === 1 ? "" : "s"
        } con ella: borrarla las dejaría huérfanas. Márcala inactiva — deja de ofrecerse al clasificar y lo ya clasificado sigue en pie.`
      );
      return;
    }
    setAviso(null);
    setPorBorrar(id);
  };

  const pedirBorrarGrupo = (id: string, nombre: string) => {
    const enUso = catalogo
      .categoriasDe(id)
      .filter((s) => (usoDeCategoria.get(s.id) ?? 0) > 0);
    if (enUso.length) {
      setAviso(
        `"${nombre}" no se puede borrar: ${enUso.length} de sus categorías tienen movimientos clasificados. Desactiva las que ya no se usen.`
      );
      return;
    }
    setAviso(null);
    setPorBorrar(id);
  };

  /** Igual que en el flujo: si algo está mal clasificado se corrige donde se detecta
   *  el problema, sin ir a buscarlo a Movimientos. */
  const reclasificar = (fila: LineaExpandida, categoria_id: string) => {
    if (fila.indice_linea !== null) {
      editarLinea(fila.movimiento_id, fila.indice_linea, "categoria_id", categoria_id);
    } else {
      editarMovimiento(fila.movimiento_id, "lineas", [
        { categoria_id, subcategoria_id: null, monto: fila.monto, glosa: fila.glosa },
      ]);
    }
  };

  /** Fija el detalle de la línea. Solo se puede sobre una línea que ya existe: sin
   *  categoría no hay subcategoría de la cual colgar. */
  const detallar = (fila: LineaExpandida, subcategoria_id: string | null) => {
    if (fila.indice_linea === null) return;
    editarLinea(fila.movimiento_id, fila.indice_linea, "subcategoria_id", subcategoria_id);
  };

  const abrirUso = (titulo: string, cumple: (l: LineaExpandida) => boolean) => {
    const items = expandir(movimientos).filter(cumple);
    if (!items.length) return;
    setDetalle({ titulo, periodo: `${items.length} líneas, todo el histórico`, items });
  };

  const abrirCreacion = (donde: string) => {
    setCreando(donde);
    if (donde !== "__grupo") {
      setAbiertas((p) => (p.includes(donde) ? p : [...p, donde]));
    }
  };

  const gruposVisibles = catalogo.grupos.filter(
    (c) => !buscando || visiblesDe(c.id).length
  );

  return (
    <>
      <Cabecera
        titulo="Catálogo"
        bajada="Tres niveles: grupo → categoría → subcategoría. Se clasifica en la categoría, que es lo que agrupan el flujo, el presupuesto y los reportes; la subcategoría es opcional y precisa dentro de cuál. La naturaleza —ingreso, inversión u operativo— vive en la categoría, así que un grupo puede ser mixto y aparecer en dos secciones (§4.2)."
      />

      {aviso && <Aviso tono="amber">{aviso}</Aviso>}

      {huerfanas > 0 && (
        <Aviso tono="amber">
          Hay <strong>{huerfanas} líneas</strong> apuntando a categorías que ya no
          existen en el catálogo. Se ven marcadas en Movimientos y hay que reclasificarlas.
        </Aviso>
      )}

      <div className={css.unaColumna}>
        <section className={css.panel}>
          <div className={css.barra}>
            <Rotulo
              texto={`${catalogo.grupos.length} grupos · ${catalogo.categorias.length} categorías · ${catalogo.subcategorias.length} subcategorías`}
            />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar"
              aria-label="Buscar en el catálogo"
              className={css.buscador}
            />
            <Chip
              chico
              activo={!verInactivas}
              onClick={() => setVerInactivas((v) => !v)}
              titulo="Las inactivas siguen existiendo y siguen clasificando lo antiguo; esto solo las saca de la vista"
            >
              Ocultar inactivas
            </Chip>
            <BotonFantasma
              titulo="Abre o cierra todos los grupos para ver sus categorías"
              onClick={() =>
                setAbiertas(abiertas.length ? [] : catalogo.grupos.map((c) => c.id))
              }
            >
              {abiertas.length ? "Colapsar todo" : "Expandir todo"}
            </BotonFantasma>
            <BotonFantasma onClick={() => abrirCreacion("__grupo")}>
              + grupo
            </BotonFantasma>
          </div>

          <div className={css.arbol}>
            {creando === "__grupo" && (
              <CampoNuevo
                etiqueta="Nombre de el grupo nuevo"
                cerrar={() => setCreando(null)}
                crear={(nombre) => {
                  crearGrupo(nombre);
                  setBusqueda("");
                }}
              />
            )}

            {gruposVisibles.map((c) => {
              const subs = visiblesDe(c.id);
              const desplegada = buscando || abiertas.includes(c.id);
              const naturalezas = [...new Set(catalogo.categoriasDe(c.id).map((s) => s.naturaleza))];
              const mixta = naturalezas.length > 1;

              return (
                <div key={c.id} className={css.bloque}>
                  <div className={css.filaGrupo}>
                    <button
                      type="button"
                      onClick={() =>
                        setAbiertas(
                          desplegada
                            ? abiertas.filter((x) => x !== c.id)
                            : [...abiertas, c.id]
                        )
                      }
                      aria-label={`${desplegada ? "Colapsar" : "Expandir"} ${c.nombre}`}
                      className={css.chevron}
                    >
                      {desplegada ? "▾" : "▸"}
                    </button>

                    <input
                      value={c.nombre}
                      onChange={(e) => renombrarGrupo(c.id, e.target.value)}
                      aria-label={`Nombre de ${c.nombre}`}
                      className={clases(css.campo, css.campoGrupo)}
                    />

                    <span className={css.conteo}>{subs.length}</span>

                    <span
                      className={clases(css.insignia, mixta && css.insigniaMixta)}
                      title="Naturaleza de sus categorías"
                    >
                      {mixta ? "mixta" : NOMBRE_NATURALEZA[naturalezas[0] ?? "operativo"]}
                    </span>

                    {porAplicar?.grupo === c.id ? (
                      <span className={css.confirmacion}>
                        <button
                          type="button"
                          onClick={() => {
                            cambiarNaturalezaDeGrupo(c.id, porAplicar.naturaleza);
                            setPorAplicar(null);
                          }}
                          className={css.confirmarAplicar}
                        >
                          {`marcar ${subs.length} como ${NOMBRE_NATURALEZA[porAplicar.naturaleza]}`}
                        </button>
                        <button
                          type="button"
                          onClick={() => setPorAplicar(null)}
                          className={css.cancelar}
                        >
                          cancelar
                        </button>
                      </span>
                    ) : (
                      <select
                        value=""
                        onChange={(e) => {
                          if (e.target.value) {
                            setPorAplicar({ grupo: c.id, naturaleza: e.target.value as Naturaleza });
                          }
                        }}
                        aria-label={`Marcar todas las categorías de ${c.nombre} con una naturaleza`}
                        title="Marca de una vez todas las categorías de este grupo con la misma naturaleza. Sirve para un grupo que quedó mixto por error; los que son mixtos de verdad se corrigen uno a uno."
                        className={css.selectMini}
                      >
                        <option value="">marcar todas…</option>
                        {NATURALEZAS.map((n) => (
                          <option key={n.id} value={n.id}>
                            {NOMBRE_NATURALEZA[n.id]}
                          </option>
                        ))}
                      </select>
                    )}

                    <button
                      type="button"
                      onClick={() => alternarControlado(c.id)}
                      title={
                        c.controlado
                          ? "Entra al control presupuestario"
                          : "Queda fuera del control presupuestario, pero su gasto se muestra igual"
                      }
                      className={clases(css.insignia, css.toggle, !c.controlado && css.insigniaFuera)}
                    >
                      {c.controlado ? "en control" : "fuera"}
                    </button>

                    <BotonFantasma onClick={() => abrirCreacion(c.id)}>+ categoría</BotonFantasma>
                    {porBorrar === c.id ? (
                      <Confirmacion
                        que={c.nombre}
                        borrar={() => {
                          borrarGrupo(c.id);
                          setPorBorrar(null);
                        }}
                        cancelar={() => setPorBorrar(null)}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => pedirBorrarGrupo(c.id, c.nombre)}
                        aria-label={`Borrar ${c.nombre}`}
                        className={css.borrar}
                      >
                        ×
                      </button>
                    )}
                  </div>

                  {creando === c.id && (
                    <CampoNuevo
                      etiqueta={`Nombre de la categoría nueva en ${c.nombre}`}
                      anidado
                      cerrar={() => setCreando(null)}
                      crear={(nombre) => {
                        crearCategoria(c.id, nombre);
                        setBusqueda("");
                      }}
                    />
                  )}

                  {desplegada &&
                    subs.map((s) => {
                      const uso = usoDeCategoria.get(s.id) ?? 0;
                      const hijas = catalogo.subcategoriasDe(s.id);
                      return (
                        <div key={s.id}>
                        <div
                          className={clases(css.filaSub, !s.activa && css.filaInactiva)}
                        >
                          <input
                            value={s.nombre}
                            onChange={(e) => renombrarCategoria(s.id, e.target.value)}
                            aria-label={`Nombre de ${s.nombre}`}
                            className={css.campo}
                          />

                          <select
                            value={s.naturaleza}
                            onChange={(e) =>
                              cambiarNaturaleza(s.id, e.target.value as Naturaleza)
                            }
                            aria-label={`Naturaleza de ${s.nombre}`}
                            className={clases(css.selectMini, css[`nat_${s.naturaleza}`])}
                          >
                            {NATURALEZAS.map((n) => (
                              <option key={n.id} value={n.id}>
                                {NOMBRE_NATURALEZA[n.id]}
                              </option>
                            ))}
                          </select>

                          {uso ? (
                            <button
                              type="button"
                              onClick={() => abrirUso(s.nombre, (l) => l.categoria_id === s.id)}
                              title="Ver los movimientos clasificados acá"
                              className={clases(css.uso, css.usoClicable)}
                            >
                              {uso} movs
                            </button>
                          ) : (
                            <span className={css.uso}>—</span>
                          )}

                          <button
                            type="button"
                            onClick={() => alternarActiva(s.id)}
                            title={
                              s.activa
                                ? "Dejar de ofrecerla al clasificar, sin tocar lo ya clasificado"
                                : "Volver a ofrecerla al clasificar"
                            }
                            className={clases(css.insignia, css.toggle, !s.activa && css.insigniaFuera)}
                          >
                            {s.activa ? "activa" : "inactiva"}
                          </button>

                          {porBorrar === s.id ? (
                            <Confirmacion
                              que={s.nombre}
                              borrar={() => {
                                borrarCategoria(s.id);
                                setPorBorrar(null);
                              }}
                              cancelar={() => setPorBorrar(null)}
                            />
                          ) : (
                            <button
                              type="button"
                              onClick={() => pedirBorrarSub(s.id, s.nombre)}
                              aria-label={`Borrar ${s.nombre}`}
                              className={clases(css.borrar, uso > 0 && css.borrarBloqueado)}
                            >
                              ×
                            </button>
                          )}
                        </div>

                        {/* Tercer nivel. No se ofrece un "+ subcategoría" fijo en cada una de las
                            290 categorías: llenaría la fila de botones que casi nunca
                            se usan. Aparece al pasar por encima, y siempre si ya tiene. */}
                        {hijas.map((h) => (
                          <div
                            key={h.id}
                            className={clases(css.filaSubSub, !h.activa && css.filaInactiva)}
                          >
                            <input
                              value={h.nombre}
                              onChange={(e) => renombrarSubcategoria(h.id, e.target.value)}
                              aria-label={`Nombre de ${h.nombre}`}
                              className={css.campo}
                            />
                            {usoDeSubcategoria.get(h.id) ? (
                              <button
                                type="button"
                                onClick={() => abrirUso(h.nombre, (l) => l.subcategoria_id === h.id)}
                                title="Ver los movimientos con este detalle"
                                className={clases(css.uso, css.usoClicable)}
                              >
                                {usoDeSubcategoria.get(h.id)} movs
                              </button>
                            ) : (
                              <span className={css.uso}>—</span>
                            )}
                            <button
                              type="button"
                              onClick={() => alternarActivaSubcategoria(h.id)}
                              title={
                                h.activa
                                  ? "Dejar de ofrecerla al clasificar"
                                  : "Volver a ofrecerla al clasificar"
                              }
                              className={clases(css.insignia, css.toggle, !h.activa && css.insigniaFuera)}
                            >
                              {h.activa ? "activa" : "inactiva"}
                            </button>
                            {porBorrar === h.id ? (
                              <Confirmacion
                                que={h.nombre}
                                borrar={() => {
                                  borrarSubcategoria(h.id);
                                  setPorBorrar(null);
                                }}
                                cancelar={() => setPorBorrar(null)}
                              />
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setAviso(null);
                                  setPorBorrar(h.id);
                                }}
                                aria-label={`Borrar ${h.nombre}`}
                                className={css.borrar}
                              >
                                ×
                              </button>
                            )}
                          </div>
                        ))}

                        {creando === s.id ? (
                          <CampoNuevo
                            etiqueta={`Nombre de la subcategoría nueva en ${s.nombre}`}
                            doblementeAnidado
                            cerrar={() => setCreando(null)}
                            crear={(nombre) => {
                              crearSubcategoria(s.id, nombre);
                              setBusqueda("");
                            }}
                          />
                        ) : (
                          <div className={css.filaAgregarSub}>
                            <button
                              type="button"
                              onClick={() => setCreando(s.id)}
                              aria-label={`Agregar subcategoría en ${s.nombre}`}
                              className={css.agregarSub}
                            >
                              + subcategoría
                            </button>
                          </div>
                        )}
                        </div>
                      );
                    })}
                </div>
              );
            })}

            {!gruposVisibles.length && (
              <div className={css.vacio}>Nada coincide con “{busqueda}”.</div>
            )}
          </div>
        </section>

      </div>

      {detalle && (
        <PanelDetalle
          detalle={detalle}
          cerrar={() => setDetalle(null)}
          tc={tc}
          reclasificar={reclasificar}
          detallar={detallar}
        />
      )}
    </>
  );
}

/** Alta en línea. Reemplaza al prompt() del navegador: se ve dónde va a quedar lo
 *  que se está creando, y Escape cancela sin dejar nada a medias. */
function CampoNuevo({
  etiqueta,
  crear,
  cerrar,
  anidado,
  doblementeAnidado,
}: {
  etiqueta: string;
  crear: (nombre: string) => void;
  cerrar: () => void;
  anidado?: boolean;
  doblementeAnidado?: boolean;
}) {
  const [nombre, setNombre] = useState("");
  const confirmar = () => {
    const limpio = nombre.trim();
    if (limpio) crear(limpio);
    cerrar();
  };
  return (
    <div
      className={clases(
        css.filaNueva,
        anidado && css.filaNuevaAnidada,
        doblementeAnidado && css.filaNuevaAnidadaDoble
      )}
    >
      <input
        // eslint-disable-next-line jsx-a11y/no-autofocus -- la fila aparece por una
        // acción del usuario y lo único que se puede hacer en ella es escribir.
        autoFocus
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") confirmar();
          if (e.key === "Escape") cerrar();
        }}
        aria-label={etiqueta}
        placeholder={etiqueta}
        className={clases(css.campo, css.campoNuevo)}
      />
      <BotonFantasma onClick={confirmar}>Crear</BotonFantasma>
      <BotonFantasma onClick={cerrar}>Cancelar</BotonFantasma>
    </div>
  );
}

/** Confirmación en la propia fila. Un confirm() del navegador no muestra sobre qué
 *  línea se está actuando, que es justo lo que hay que ver antes de borrar. */
function Confirmacion({
  que,
  borrar,
  cancelar,
}: {
  que: string;
  borrar: () => void;
  cancelar: () => void;
}) {
  return (
    <span className={css.confirmacion}>
      <button type="button" onClick={borrar} aria-label={`Confirmar borrar ${que}`} className={css.confirmarBorrar}>
        borrar
      </button>
      <button type="button" onClick={cancelar} className={css.cancelar}>
        cancelar
      </button>
    </span>
  );
}
