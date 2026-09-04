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
import { NATURALEZAS } from "@/lib/catalogo";
import { parsearCatalogo } from "@/lib/catalogo-edicion";
import { Aviso, BotonFantasma, Cabecera, Rotulo, clases } from "@/components/ui/primitivas";
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
    usoDeSubcategoria,
    movimientos,
    renombrarCategoria,
    renombrarSubcategoria,
    cambiarNaturaleza,
    cambiarNaturalezaDeCategoria,
    alternarControlado,
    alternarActiva,
    crearCategoria,
    crearSubcategoria,
    borrarSubcategoria,
    borrarCategoria,
    importarCatalogo,
  } = useTesoreria();

  const [busqueda, setBusqueda] = useState("");
  const [abiertas, setAbiertas] = useState<string[]>([]);
  // Borrar pide confirmación en la misma fila en vez de abrir un diálogo del
  // navegador: el aspa se convierte en "borrar / cancelar" y se ve exactamente sobre
  // qué línea se está actuando, que es lo que un confirm() no muestra.
  const [porBorrar, setPorBorrar] = useState<string | null>(null);
  // Qué se está creando: "__categoria" o el id de la categoría que recibe la sub.
  const [creando, setCreando] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const buscando = busqueda.trim().length > 0;

  const coincide = (texto: string) =>
    texto.toLowerCase().includes(busqueda.trim().toLowerCase());

  const visiblesDe = (categoria_id: string) => {
    const subs = catalogo.subcategoriasDe(categoria_id);
    if (!buscando) return subs;
    // Si el nombre de la categoría coincide, se muestran todas sus subcategorías:
    // buscar "impuestos" tiene que traer el bloque entero, no cero resultados.
    if (coincide(catalogo.categoriaDe(categoria_id).nombre)) return subs;
    return subs.filter((s) => coincide(s.nombre));
  };

  // Líneas que apuntan a una subcategoría que ya no está en el catálogo. Pasa al
  // reemplazar el catálogo en una migración, y no puede fallar en silencio (§11).
  const huerfanas = useMemo(() => {
    let n = 0;
    for (const m of movimientos) {
      for (const l of m.lineas) {
        if (!catalogo.existeSubcategoria(l.subcategoria_id)) n++;
      }
    }
    return n;
  }, [movimientos, catalogo]);

  /** Pedir borrar. Lo que está en uso no se borra: se explica por qué y cuál es la
   *  salida, porque un botón que no hace nada deja al usuario trabado sin saberlo. */
  const pedirBorrarSub = (id: string, nombre: string) => {
    const uso = usoDeSubcategoria.get(id) ?? 0;
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

  const pedirBorrarCategoria = (id: string, nombre: string) => {
    const enUso = catalogo
      .subcategoriasDe(id)
      .filter((s) => (usoDeSubcategoria.get(s.id) ?? 0) > 0);
    if (enUso.length) {
      setAviso(
        `"${nombre}" no se puede borrar: ${enUso.length} de sus subcategorías tienen movimientos clasificados. Desactiva las que ya no se usen.`
      );
      return;
    }
    setAviso(null);
    setPorBorrar(id);
  };

  const abrirCreacion = (donde: string) => {
    setCreando(donde);
    if (donde !== "__categoria") {
      setAbiertas((p) => (p.includes(donde) ? p : [...p, donde]));
    }
  };

  const categoriasVisibles = catalogo.categorias.filter(
    (c) => !buscando || visiblesDe(c.id).length
  );

  return (
    <>
      <Cabecera
        titulo="Categorías y subcategorías"
        bajada="El catálogo que ordena todo: flujo, presupuesto y reportes. La naturaleza —ingreso, inversión u operativo— vive en cada subcategoría, así que una categoría puede ser mixta y aparecer en dos secciones (§4.2)."
      />

      {aviso && <Aviso tono="amber">{aviso}</Aviso>}

      {huerfanas > 0 && (
        <Aviso tono="amber">
          Hay <strong>{huerfanas} líneas</strong> apuntando a subcategorías que ya no
          existen en el catálogo. Se ven marcadas en Movimientos y hay que reclasificarlas.
        </Aviso>
      )}

      <div className={css.columnas}>
        <section className={css.panel}>
          <div className={css.barra}>
            <Rotulo
              texto={`${catalogo.categorias.length} categorías · ${catalogo.subcategorias.length} subcategorías`}
            />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar"
              aria-label="Buscar en el catálogo"
              className={css.buscador}
            />
            <BotonFantasma
              onClick={() =>
                setAbiertas(abiertas.length ? [] : catalogo.categorias.map((c) => c.id))
              }
            >
              {abiertas.length ? "Colapsar" : "Expandir"}
            </BotonFantasma>
            <BotonFantasma onClick={() => abrirCreacion("__categoria")}>
              + Categoría
            </BotonFantasma>
          </div>

          <div className={css.arbol}>
            {creando === "__categoria" && (
              <CampoNuevo
                etiqueta="Nombre de la categoría nueva"
                cerrar={() => setCreando(null)}
                crear={(nombre) => {
                  crearCategoria(nombre);
                  setBusqueda("");
                }}
              />
            )}

            {categoriasVisibles.map((c) => {
              const subs = visiblesDe(c.id);
              const desplegada = buscando || abiertas.includes(c.id);
              const naturalezas = [...new Set(catalogo.subcategoriasDe(c.id).map((s) => s.naturaleza))];
              const mixta = naturalezas.length > 1;

              return (
                <div key={c.id} className={css.bloque}>
                  <div className={css.filaCategoria}>
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
                      onChange={(e) => renombrarCategoria(c.id, e.target.value)}
                      aria-label={`Nombre de ${c.nombre}`}
                      className={clases(css.campo, css.campoCategoria)}
                    />

                    <span className={css.conteo}>{subs.length}</span>

                    <span
                      className={clases(css.insignia, mixta && css.insigniaMixta)}
                      title="Naturaleza de sus subcategorías"
                    >
                      {mixta ? "mixta" : NOMBRE_NATURALEZA[naturalezas[0] ?? "operativo"]}
                    </span>

                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value) {
                          cambiarNaturalezaDeCategoria(c.id, e.target.value as Naturaleza);
                        }
                      }}
                      aria-label={`Aplicar naturaleza a todo ${c.nombre}`}
                      title="Aplicar una naturaleza a todas sus subcategorías"
                      className={css.selectMini}
                    >
                      <option value="">aplicar…</option>
                      {NATURALEZAS.map((n) => (
                        <option key={n.id} value={n.id}>
                          {NOMBRE_NATURALEZA[n.id]}
                        </option>
                      ))}
                    </select>

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

                    <BotonFantasma onClick={() => abrirCreacion(c.id)}>+ sub</BotonFantasma>
                    {porBorrar === c.id ? (
                      <Confirmacion
                        que={c.nombre}
                        borrar={() => {
                          borrarCategoria(c.id);
                          setPorBorrar(null);
                        }}
                        cancelar={() => setPorBorrar(null)}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => pedirBorrarCategoria(c.id, c.nombre)}
                        aria-label={`Borrar ${c.nombre}`}
                        className={css.borrar}
                      >
                        ×
                      </button>
                    )}
                  </div>

                  {creando === c.id && (
                    <CampoNuevo
                      etiqueta={`Nombre de la subcategoría nueva en ${c.nombre}`}
                      anidado
                      cerrar={() => setCreando(null)}
                      crear={(nombre) => {
                        crearSubcategoria(c.id, nombre);
                        setBusqueda("");
                      }}
                    />
                  )}

                  {desplegada &&
                    subs.map((s) => {
                      const uso = usoDeSubcategoria.get(s.id) ?? 0;
                      return (
                        <div
                          key={s.id}
                          className={clases(css.filaSub, !s.activa && css.filaInactiva)}
                        >
                          <input
                            value={s.nombre}
                            onChange={(e) => renombrarSubcategoria(s.id, e.target.value)}
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

                          <span className={css.uso} title="Líneas de movimiento clasificadas acá">
                            {uso ? `${uso} movs` : "—"}
                          </span>

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
                                borrarSubcategoria(s.id);
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
                      );
                    })}
                </div>
              );
            })}

            {!categoriasVisibles.length && (
              <div className={css.vacio}>Nada coincide con “{busqueda}”.</div>
            )}
          </div>
        </section>

        <Importador importar={importarCatalogo} />
      </div>
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
}: {
  etiqueta: string;
  crear: (nombre: string) => void;
  cerrar: () => void;
  anidado?: boolean;
}) {
  const [nombre, setNombre] = useState("");
  const confirmar = () => {
    const limpio = nombre.trim();
    if (limpio) crear(limpio);
    cerrar();
  };
  return (
    <div className={clases(css.filaNueva, anidado && css.filaNuevaAnidada)}>
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

/** Carga por pegado. El catálogo real llegó de Quicken con 293 líneas; nadie las
 *  escribe de a una, y el formato en que están a mano varía. */
function Importador({
  importar,
}: {
  importar: (texto: string) => { categorias: number; subcategorias: number };
}) {
  const [texto, setTexto] = useState("");
  const [previo, setPrevio] = useState<ReturnType<typeof parsearCatalogo> | null>(null);
  const [resultado, setResultado] = useState<string | null>(null);

  const aplicar = () => {
    const { categorias, subcategorias } = importar(texto);
    setResultado(
      categorias || subcategorias
        ? `Entraron ${categorias} categorías y ${subcategorias} subcategorías.`
        : "Ya estaba todo en el catálogo: no se agregó nada."
    );
    setTexto("");
    setPrevio(null);
  };

  return (
    <section className={clases(css.panel, css.panelImportador)}>
      <Rotulo texto="Cargar listado" />
      <p className={css.ayuda}>
        Pega el listado. Acepta <code className={css.code}>Categoría:Subcategoría</code> o
        categorías al margen con las subcategorías indentadas. Una línea sola que diga{" "}
        <code className={css.code}>Gastos de Inversión</code>,{" "}
        <code className={css.code}>Gastos Operativos</code> o{" "}
        <code className={css.code}>Ingresos</code> cambia la sección de ahí en adelante, y
        un sufijo <code className={css.code}>(inversión)</code> la fija solo para esa línea.
      </p>

      <textarea
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          setPrevio(null);
          setResultado(null);
        }}
        rows={9}
        aria-label="Listado a importar"
        placeholder={
          "Gastos de Inversión\nComercial y marketing\n  Alianzas\n  Estudios públicos\n\nGastos Operativos\nGastos Administración:Arriendos\nGastos Administración:Aseo"
        }
        className={css.textarea}
      />

      <div className={css.accionesImportador}>
        <BotonFantasma onClick={() => texto.trim() && setPrevio(parsearCatalogo(texto))}>
          Previsualizar
        </BotonFantasma>
      </div>

      {resultado && <Aviso tono="teal">{resultado}</Aviso>}

      {previo && (
        <div className={css.previo}>
          <div className={css.previoResumen}>
            <strong>{previo.categorias.length}</strong> categorías y{" "}
            <strong>{previo.subcategorias.length}</strong> subcategorías detectadas.
          </div>
          <div className={css.previoLista}>
            {NATURALEZAS.map(
              (n) =>
                previo.subcategorias.some((s) => s.naturaleza === n.id) && (
                  <div key={n.id}>
                    <div className={css.previoSeccion}>{n.nombre.toUpperCase()}</div>
                    {previo.categorias
                      .filter((c) =>
                        previo.subcategorias.some(
                          (s) => s.categoria_id === c.id && s.naturaleza === n.id
                        )
                      )
                      .map((c) => (
                        <div key={c.id}>
                          <span className={css.previoCategoria}>{c.nombre}</span>
                          {previo.subcategorias
                            .filter((s) => s.categoria_id === c.id && s.naturaleza === n.id)
                            .map((s) => (
                              <div key={s.id} className={css.previoSub}>
                                {s.nombre}
                              </div>
                            ))}
                        </div>
                      ))}
                  </div>
                )
            )}
          </div>
          <button type="button" onClick={aplicar} className={css.botonAplicar}>
            AGREGAR AL CATÁLOGO
          </button>
        </div>
      )}

      <p className={css.ayuda}>
        Solo agrega. Lo que ya existe con el mismo nombre no se duplica, y no hay
        “reemplazar todo”: reemplazar el catálogo dejaría sin clasificar los movimientos
        cuyas subcategorías no estén en el listado nuevo, y son más de 15.000 líneas.
        Para sacar algo de circulación, márcalo inactivo.
      </p>
    </section>
  );
}
