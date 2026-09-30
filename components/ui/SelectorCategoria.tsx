"use client";

// Selector de categoría — 290 opciones (§5).
//
// Muestra el nombre como texto y recién al hacer click abre el buscador. No es un
// detalle de estilo: renderizar las 290 opciones en cada fila de una tabla de 200
// movimientos son ~58.000 nodos, y eso cuelga la vista (lo detectó el test de render
// de la lista completa).
//
// Era un `<select>` nativo, que solo salta a lo que empieza igual: escribir "internet"
// no encontraba "Telefonía e internet". Ahora se escribe y filtra, como en Quicken, y
// arriba quedan las últimas usadas — en un registro son casi siempre las mismas.

import { useEffect, useMemo, useRef, useState } from "react";
import { useTesoreria } from "@/components/estado/ProveedorTesoreria";
import { anotarReciente, buscarCategorias, recientes } from "@/lib/buscar-categoria";
import css from "./selector.module.css";
import { clases } from "./primitivas";

export function SelectorCategoria({
  valor,
  onChange,
  compacto,
}: {
  valor: string | null;
  onChange: (id: string) => void;
  compacto?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const { catalogo } = useTesoreria();
  const { existeCategoria, categoriaDe, grupoDe } = catalogo;

  // Una línea puede apuntar a una categoría que ya no existe: pasa al reemplazar el
  // catálogo en la migración. Se marca en vez de fallar en silencio (§11).
  const huerfana = valor !== null && !existeCategoria(valor);
  const clase = clases(
    css.selector,
    compacto && css.compacto,
    (huerfana || valor === null) && css.huerfana
  );

  if (!abierto) {
    const nombre =
      valor === null ? "⚠ sin clasificar" : huerfana ? `⚠ ${valor}` : categoriaDe(valor).nombre;
    return (
      <button
        type="button"
        aria-label="Categoría"
        title={`${nombre} — click para cambiar`}
        onClick={() => setAbierto(true)}
        className={clases(clase, css.comoTexto)}
      >
        {nombre}
      </button>
    );
  }

  return (
    <Buscador
      valor={valor}
      cerrar={() => setAbierto(false)}
      elegir={(id) => {
        anotarReciente(id);
        onChange(id);
        setAbierto(false);
      }}
      catalogo={catalogo}
      grupoDe={grupoDe}
    />
  );
}

function Buscador({
  valor,
  elegir,
  cerrar,
  catalogo,
  grupoDe,
}: {
  valor: string | null;
  elegir: (id: string) => void;
  cerrar: () => void;
  catalogo: ReturnType<typeof useTesoreria>["catalogo"];
  grupoDe: ReturnType<typeof useTesoreria>["catalogo"]["grupoDe"];
}) {
  const [texto, setTexto] = useState("");
  const [marcado, setMarcado] = useState(0);
  const caja = useRef<HTMLDivElement>(null);

  // Las últimas usadas solo mientras no se escribe: apenas hay texto, lo que importa
  // es lo que coincide.
  const ultimas = useMemo(() => {
    if (texto.trim()) return [];
    return recientes()
      .filter((id) => catalogo.existeCategoria(id) && id !== valor)
      .map((id) => ({ categoria: catalogo.categoriaDe(id), grupo: grupoDe(catalogo.categoriaDe(id).grupo_id) }));
  }, [texto, catalogo, grupoDe, valor]);

  const encontradas = useMemo(
    () => buscarCategorias(catalogo.categorias, grupoDe, texto),
    [catalogo, grupoDe, texto]
  );

  // Una sola lista para el teclado: las recientes van primero y después el resto, sin
  // repetirlas.
  const opciones = useMemo(() => {
    const yaEstan = new Set(ultimas.map((u) => u.categoria.id));
    return [...ultimas, ...encontradas.filter((e) => !yaEstan.has(e.categoria.id))];
  }, [ultimas, encontradas]);

  useEffect(() => setMarcado(0), [texto]);

  // Cerrar al hacer click fuera: sin esto quedan varios buscadores abiertos a la vez
  // en una tabla de muchas filas.
  useEffect(() => {
    const fuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) cerrar();
    };
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, [cerrar]);

  const mover = (paso: number) =>
    setMarcado((m) => Math.max(0, Math.min(opciones.length - 1, m + paso)));

  return (
    <div ref={caja} className={css.buscador}>
      <input
        // eslint-disable-next-line jsx-a11y/no-autofocus -- reemplaza al botón que se
        // acaba de accionar: el foco tiene que quedar donde estaba la mano.
        autoFocus
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Buscar categoría"
        aria-label="Categoría"
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            mover(1);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            mover(-1);
          } else if (e.key === "Enter") {
            e.preventDefault();
            const elegida = opciones[marcado];
            if (elegida) elegir(elegida.categoria.id);
          } else if (e.key === "Escape") {
            cerrar();
          }
        }}
        className={css.entradaBuscador}
      />

      <div className={css.resultados} role="listbox" aria-label="Categorías encontradas">
        {opciones.length === 0 && <div className={css.sinResultados}>Nada coincide</div>}

        {opciones.map((o, i) => {
          const esReciente = i < ultimas.length;
          return (
            <button
              key={o.categoria.id}
              type="button"
              role="option"
              aria-selected={i === marcado}
              // mousedown y no click: el click llega después del blur y para entonces
              // el buscador ya se cerró.
              onMouseDown={(e) => {
                e.preventDefault();
                elegir(o.categoria.id);
              }}
              onMouseEnter={() => setMarcado(i)}
              className={clases(css.opcion, i === marcado && css.opcionMarcada)}
            >
              {/* El grupo va arriba y en chico: dos categorías pueden llamarse igual
                  en grupos distintos, y sin él no hay cómo distinguirlas. */}
              <span className={css.grupoOpcion}>
                {esReciente ? "reciente · " : ""}
                {o.grupo.nombre}
              </span>
              <span className={css.nombreOpcion}>{o.categoria.nombre}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
