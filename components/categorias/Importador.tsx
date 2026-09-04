"use client";

// Carga masiva del catálogo por pegado.
//
// HOY NO SE MUESTRA. El equipo crea las categorías caso a caso —un cliente nuevo,
// un gasto nuevo— y un panel que ocupa media pantalla para algo que no se usa
// estorba la lectura del árbol, que es lo que sí se mira. Se conserva entero, con
// sus tests, porque la lógica de parseo es la parte cara y sigue siendo la
// especificación de qué formatos se aceptan.
//
// Para devolverlo: importarlo en Categorias.tsx, renderizar
// <Importador importar={importarCatalogo} /> y volver css.unaColumna a css.columnas.

import { useState } from "react";
import { parsearCatalogo } from "@/lib/catalogo-edicion";
import { NATURALEZAS } from "@/lib/catalogo";
import { Aviso, BotonFantasma, Rotulo, clases } from "@/components/ui/primitivas";
import css from "./categorias.module.css";

/** Carga por pegado. El catálogo real llegó de Quicken con 293 líneas; nadie las
 *  escribe de a una, y el formato en que están a mano varía. */
export function Importador({
  importar,
}: {
  importar: (texto: string) => { grupos: number; categorias: number; subcategorias: number };
}) {
  const [texto, setTexto] = useState("");
  const [previo, setPrevio] = useState<ReturnType<typeof parsearCatalogo> | null>(null);
  const [resultado, setResultado] = useState<string | null>(null);

  const aplicar = () => {
    const { grupos, categorias, subcategorias } = importar(texto);
    const partes = [
      grupos ? `${grupos} grupos` : null,
      categorias ? `${categorias} categorías` : null,
      subcategorias ? `${subcategorias} subcategorías` : null,
    ].filter(Boolean);
    setResultado(
      partes.length
        ? `Entraron ${partes.join(", ")}.`
        : "Ya estaba todo en el catálogo: no se agregó nada."
    );
    setTexto("");
    setPrevio(null);
  };

  return (
    <section className={clases(css.panel, css.panelImportador)}>
      <Rotulo texto="Cargar listado" />
      <p className={css.ayuda}>
        Pega el listado. Acepta <code className={css.code}>Grupo:Categoría</code>,{" "}
        <code className={css.code}>Grupo:Categoría:Subcategoría</code>, o grupos al margen
        con lo de abajo indentado — la profundidad de la sangría decide el nivel. Una línea sola que diga{" "}
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
          "Gastos de Inversión\nComercial y marketing\n  Alianzas\n  Estudios públicos\n\nGastos Operativos\nGastos Administración\n  Jornadas y eventos\n    Offsite internacional\nGastos Administración:Aseo"
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
            <strong>{previo.grupos.length}</strong> grupos,{" "}
            <strong>{previo.categorias.length}</strong> categorías y{" "}
            <strong>{previo.subcategorias.length}</strong> subcategorías detectadas.
          </div>
          <div className={css.previoLista}>
            {NATURALEZAS.map(
              (n) =>
                previo.categorias.some((s) => s.naturaleza === n.id) && (
                  <div key={n.id}>
                    <div className={css.previoSeccion}>{n.nombre.toUpperCase()}</div>
                    {previo.grupos
                      .filter((c) =>
                        previo.categorias.some(
                          (s) => s.grupo_id === c.id && s.naturaleza === n.id
                        )
                      )
                      .map((c) => (
                        <div key={c.id}>
                          <span className={css.previoGrupo}>{c.nombre}</span>
                          {previo.categorias
                            .filter((s) => s.grupo_id === c.id && s.naturaleza === n.id)
                            .flatMap((s) => [
                              <div key={s.id} className={css.previoSub}>
                                {s.nombre}
                              </div>,
                              ...previo.subcategorias
                                .filter((h) => h.categoria_id === s.id)
                                .map((h) => (
                                  <div key={h.id} className={css.previoSubSub}>
                                    {h.nombre}
                                  </div>
                                )),
                            ])}
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
        cuyas categorías no estén en el listado nuevo, y son más de 15.000 líneas.
        Para sacar algo de circulación, márcalo inactivo.
      </p>
    </section>
  );
}
