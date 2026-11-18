"use client";

// Menú de botón derecho.
//
// En una tabla de 10.530 filas los controles de la fila quedan lejos: el que
// abre el detalle está al final, a dos pantallas del nombre del proveedor que
// uno estaba mirando. El clic derecho trae las acciones al cursor, como en
// Quicken.
//
// Dos cosas que no se ven y hacen falta:
//
// 1. **Se acomoda para no salirse.** Abierto sobre las últimas filas, un menú
//    puesto tal cual en el punto del cursor queda mitad fuera de la ventana y
//    hay que desplazar para llegar a la última opción. Se mide y se corre.
// 2. **Se cierra con todo lo que indica que uno se fue**: clic afuera, Escape,
//    desplazar la tabla, cambiar el tamaño de la ventana. Un menú que queda
//    flotando sobre una fila que ya no está debajo apunta a otro movimiento.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { clases } from "./primitivas";
import css from "./menu.module.css";

export type OpcionMenu = {
  etiqueta: string;
  onClick: () => void;
  /** Para lo que no se puede deshacer: va aparte y en magenta. */
  peligrosa?: boolean;
  titulo?: string;
};

/** Dónde se abrió. Null es "cerrado", y es lo que guarda quien lo usa. */
export type Punto = { x: number; y: number };

const MARGEN = 6;

export function MenuContextual({
  punto,
  opciones,
  etiqueta,
  cerrar,
}: {
  punto: Punto;
  opciones: OpcionMenu[];
  /** Qué es lo que el menú tiene en la mira, para quien lo lee en voz alta. */
  etiqueta: string;
  cerrar: () => void;
}) {
  const caja = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(punto);
  const [marcada, setMarcada] = useState(0);

  // Antes de pintar, no después: corregir la posición en un efecto normal deja
  // un cuadro en el lugar equivocado por un fotograma, y se ve el salto.
  useLayoutEffect(() => {
    const el = caja.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    setPos({
      x: Math.max(MARGEN, Math.min(punto.x, window.innerWidth - width - MARGEN)),
      y: Math.max(MARGEN, Math.min(punto.y, window.innerHeight - height - MARGEN)),
    });
    // A mano y no con `autoFocus`: React solo lo aplica a los controles de
    // formulario, y sin foco acá las flechas y Escape no llegan a ninguna parte.
    el.focus();
  }, [punto]);

  useEffect(() => {
    const fuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) cerrar();
    };
    // `true` para capturar: la tabla desplaza en un contenedor propio, y un
    // listener en window sin capturar no se entera.
    document.addEventListener("mousedown", fuera);
    window.addEventListener("scroll", cerrar, true);
    window.addEventListener("resize", cerrar);
    return () => {
      document.removeEventListener("mousedown", fuera);
      window.removeEventListener("scroll", cerrar, true);
      window.removeEventListener("resize", cerrar);
    };
  }, [cerrar]);

  const mover = (paso: number) =>
    setMarcada((m) => Math.max(0, Math.min(opciones.length - 1, m + paso)));

  return (
    <div
      ref={caja}
      role="menu"
      aria-label={etiqueta}
      style={{ left: pos.x, top: pos.y }}
      className={css.menu}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          cerrar();
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          mover(1);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          mover(-1);
        } else if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          opciones[marcada]?.onClick();
        } else if (e.key === "Tab") {
          cerrar();
        }
      }}
      // El menú se queda el foco mientras está abierto, para que Escape y las
      // flechas lleguen. Al cerrarse vuelve solo a donde estaba.
      tabIndex={-1}
    >
      {opciones.map((o, i) => (
        <button
          key={o.etiqueta}
          type="button"
          role="menuitem"
          title={o.titulo}
          onClick={o.onClick}
          onMouseEnter={() => setMarcada(i)}
          className={clases(
            css.opcion,
            o.peligrosa && css.peligrosa,
            i === marcada && css.marcada
          )}
        >
          {o.etiqueta}
        </button>
      ))}
    </div>
  );
}
