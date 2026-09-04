"use client";

// Selección múltiple con suma de lo seleccionado.
//
// El caso que la pide: un cliente paga cinco facturas en una sola transferencia y hay
// que confirmar que las cinco suman lo que llegó al banco. Sin esto se saca la
// calculadora, que es donde se cuelan los errores.
//
// La suma NO convierte monedas. El caso de uso es cuadrar contra una transferencia
// concreta, y una transferencia ocurre en una moneda: convertir daría un número que
// no aparece en ninguna cartola. Si la selección mezcla, se muestran los dos totales
// por separado y queda a la vista que son cosas distintas (§4.5).

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { clp } from "@/lib/formato";
import css from "./seleccion.module.css";
import { clases } from "./primitivas";

export type Seleccionable = { monto: number; moneda: string };

export type Seleccion = {
  /** ¿Está seleccionada esta fila? */
  tiene: (id: string) => boolean;
  /** Alterna una fila. Con shift alcanza el rango desde la última que se tocó: es lo
   *  que sirve cuando las facturas de un mismo pago van seguidas. */
  alternar: (id: string, indice: number, conShift: boolean) => void;
  /** Selecciona todo lo visible, o limpia si ya estaba todo. */
  alternarTodo: () => void;
  limpiar: () => void;
  /** Extiende o achica con el teclado, al moverse de una fila a otra con shift.
   *  Crece al alejarse del ancla y se achica al volver hacia ella, que es como se
   *  comportan las listas en todas partes. */
  extender: (actual: number, nuevo: number) => void;
  cantidad: number;
  /** true solo si TODO lo visible está seleccionado. */
  todoSeleccionado: boolean;
  /** Identifica esta tabla, para que las flechas encuentren la casilla vecina y no
   *  la de otra tabla montada al mismo tiempo (el registro y el panel conviven). */
  grupo: string;
};

/**
 * `ids` tiene que venir en el mismo orden en que se ven las filas: el rango con shift
 * se calcula sobre ese orden, y con la tabla ordenada por monto "desde aquí hasta
 * allá" significa otra cosa que ordenada por fecha.
 */
export function useSeleccion(ids: string[]): Seleccion {
  const [elegidos, setElegidos] = useState<ReadonlySet<string>>(new Set());
  const ancla = useRef<number | null>(null);
  const grupo = useId();

  // Lo que deja de verse deja de contar. Si al filtrar quedaran seleccionadas filas
  // invisibles, el total diría un número que no se corresponde con nada en pantalla,
  // y es justo el número que alguien va a comparar contra una transferencia.
  const clave = ids.join(" ");
  useEffect(() => {
    setElegidos((prev) => {
      if (!prev.size) return prev;
      const visibles = new Set(ids);
      const podado = new Set([...prev].filter((id) => visibles.has(id)));
      return podado.size === prev.size ? prev : podado;
    });
    // Depende del contenido de `ids`, no de su identidad: el array se rearma en cada
    // render y compararlo por referencia dispararía el efecto siempre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);

  const alternar = useCallback(
    (id: string, indice: number, conShift: boolean) => {
      // El ancla se lee ANTES de moverla y fuera del updater. React no ejecuta el
      // updater en el momento del click sino durante el re-render, así que leerla
      // adentro devolvía el índice recién escrito y el rango salía vacío: shift se
      // comportaba como un click suelto. Pasó desapercibido en un caso de prueba
      // chico, donde el valor viejo y el nuevo coincidían.
      const desde = ancla.current;
      ancla.current = indice;

      setElegidos((prev) => {
        const siguiente = new Set(prev);
        if (conShift && desde !== null && desde !== indice) {
          const [a, b] = desde < indice ? [desde, indice] : [indice, desde];
          // El rango se agrega, no se invierte: extender una selección es lo que se
          // espera de shift, y alternar cada fila del medio la rompería.
          for (let i = a; i <= b; i++) {
            const x = ids[i];
            if (x) siguiente.add(x);
          }
        } else if (siguiente.has(id)) {
          siguiente.delete(id);
        } else {
          siguiente.add(id);
        }
        return siguiente;
      });
    },
    [ids]
  );

  const extender = useCallback(
    (actual: number, nuevo: number) => {
      const desde = ancla.current ?? actual;
      setElegidos((prev) => {
        const siguiente = new Set(prev);
        const anclado = ids[desde];
        if (anclado) siguiente.add(anclado);
        if (Math.abs(nuevo - desde) > Math.abs(actual - desde)) {
          const entra = ids[nuevo];
          if (entra) siguiente.add(entra);
        } else {
          // Volviendo hacia el ancla: la fila que se deja atrás sale de la selección.
          const sale = ids[actual];
          if (sale && actual !== desde) siguiente.delete(sale);
        }
        return siguiente;
      });
      ancla.current = desde;
    },
    [ids]
  );

  const limpiar = useCallback(() => {
    setElegidos(new Set());
    ancla.current = null;
  }, []);

  const todoSeleccionado = ids.length > 0 && elegidos.size === ids.length;

  return {
    tiene: (id) => elegidos.has(id),
    alternar,
    alternarTodo: () => {
      setElegidos(todoSeleccionado ? new Set() : new Set(ids));
      ancla.current = null;
    },
    extender,
    limpiar,
    cantidad: elegidos.size,
    todoSeleccionado,
    grupo,
  };
}

/** Totales por moneda de lo seleccionado. Sin convertir: ver la nota de arriba. */
export const totalesPorMoneda = (items: Seleccionable[]): Map<string, number> => {
  const totales = new Map<string, number>();
  for (const m of items) totales.set(m.moneda, (totales.get(m.moneda) ?? 0) + m.monto);
  return totales;
};

const SIMBOLO: Record<string, string> = { CLP: "$", USD: "US$" };

/** La barra que aparece cuando hay algo seleccionado. Solo entonces: el resto del
 *  tiempo sería una franja vacía ocupando alto en una herramienta densa. */
export function BarraSeleccion({
  items,
  seleccion,
  compacta,
}: {
  items: Seleccionable[];
  seleccion: Seleccion;
  compacta?: boolean;
}) {
  if (!seleccion.cantidad) return null;
  const totales = [...totalesPorMoneda(items)];

  return (
    <div className={clases(css.barra, compacta && css.barraCompacta)} role="status">
      <span className={css.cuenta}>
        {seleccion.cantidad} seleccionado{seleccion.cantidad === 1 ? "" : "s"}
      </span>
      <span className={css.totales}>
        {totales.map(([moneda, total]) => (
          <span
            key={moneda}
            className={css.total}
            style={{ color: total < 0 ? "var(--brick)" : "var(--teal)" }}
          >
            {(SIMBOLO[moneda] ?? moneda) + clp(total)}
          </span>
        ))}
      </span>
      {totales.length > 1 && (
        <span className={css.aviso}>
          Dos monedas: van por separado porque una transferencia ocurre en una.
        </span>
      )}
      <span className={css.atajo}>shift + ↑↓ extiende</span>
      <button type="button" onClick={seleccion.limpiar} className={css.limpiar}>
        limpiar
      </button>
    </div>
  );
}

/** La casilla de una fila. */
export function CasillaFila({
  id,
  indice,
  seleccion,
  etiqueta,
}: {
  id: string;
  indice: number;
  seleccion: Seleccion;
  etiqueta: string;
}) {
  // Las flechas mueven el foco a la casilla vecina; con shift, además arrastran la
  // selección. Se busca por atributo en el DOM en vez de mantener un arreglo de refs:
  // la lista se reordena y se filtra todo el tiempo, y los refs quedarían viejos.
  const irA = (destino: number, conShift: boolean) => {
    const vecina = document.querySelector<HTMLInputElement>(
      `input[data-seleccion="${CSS.escape(seleccion.grupo)}"][data-indice="${destino}"]`
    );
    if (!vecina) return;
    if (conShift) seleccion.extender(indice, destino);
    vecina.focus();
  };

  return (
    <input
      type="checkbox"
      checked={seleccion.tiene(id)}
      aria-label={etiqueta}
      data-seleccion={seleccion.grupo}
      data-indice={indice}
      // onChange no trae el shift; el click sí, y es el que arma el rango. La barra
      // espaciadora dispara un click nativo, así que marca sin código extra.
      onChange={() => {}}
      onClick={(e) => seleccion.alternar(id, indice, e.shiftKey)}
      onKeyDown={(e) => {
        if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
        // Sin esto la página hace scroll y el foco se pierde de vista.
        e.preventDefault();
        irA(indice + (e.key === "ArrowDown" ? 1 : -1), e.shiftKey);
      }}
      className={css.casilla}
    />
  );
}
