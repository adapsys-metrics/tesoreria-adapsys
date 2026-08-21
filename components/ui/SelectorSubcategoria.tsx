"use client";

// Selector de subcategoría — 284 opciones (§5).
//
// Muestra el nombre como texto y recién al hacer click monta el <select> de verdad.
// No es un detalle de estilo: renderizar las 284 <option> en cada fila de una tabla
// de 200 movimientos son ~56.000 nodos, y eso cuelga la vista (lo detectó el test de
// render de la lista completa). Con una sola lista abierta a la vez, el select
// nativo alcanza y además se puede buscar escribiendo.

import { useState } from "react";
import { CATEGORIAS, SUBCATEGORIAS } from "@/lib/catalogo";
import { existeSubcategoria, subcategoriaDe } from "@/lib/catalogo-indices";
import css from "./selector.module.css";
import { clases } from "./primitivas";

const POR_CATEGORIA = CATEGORIAS.map((c) => ({
  categoria: c,
  subs: SUBCATEGORIAS.filter((s) => s.categoria_id === c.id),
})).filter((g) => g.subs.length);

export function SelectorSubcategoria({
  valor,
  onChange,
  compacto,
}: {
  valor: string | null;
  onChange: (id: string) => void;
  compacto?: boolean;
}) {
  const [editando, setEditando] = useState(false);

  // Una línea puede apuntar a una subcategoría que ya no existe: pasa al reemplazar
  // el catálogo en la migración. Se marca en vez de fallar en silencio (§11).
  const huerfana = valor !== null && !existeSubcategoria(valor);
  const clase = clases(
    css.selector,
    compacto && css.compacto,
    (huerfana || valor === null) && css.huerfana
  );

  if (!editando) {
    const nombre =
      valor === null ? "⚠ sin clasificar" : huerfana ? `⚠ ${valor}` : subcategoriaDe(valor).nombre;
    return (
      <button
        type="button"
        aria-label="Subcategoría"
        title={`${nombre} — click para cambiar`}
        onClick={() => setEditando(true)}
        className={clases(clase, css.comoTexto)}
      >
        {nombre}
      </button>
    );
  }

  return (
    <select
      // eslint-disable-next-line jsx-a11y/no-autofocus -- reemplaza al botón que se
      // acaba de accionar: el foco tiene que quedar donde estaba la mano.
      autoFocus
      value={valor ?? "__sin_clasificar"}
      aria-label="Subcategoría"
      onChange={(e) => {
        onChange(e.target.value);
        setEditando(false);
      }}
      onBlur={() => setEditando(false)}
      className={clase}
    >
      {valor === null && <option value="__sin_clasificar">⚠ sin clasificar</option>}
      {huerfana && <option value={valor}>⚠ {valor} (no existe)</option>}
      {POR_CATEGORIA.map(({ categoria, subs }) => (
        <optgroup key={categoria.id} label={categoria.nombre}>
          {subs.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nombre}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
