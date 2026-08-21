"use client";

import { useEffect, useRef } from "react";

/**
 * Cierra un popover al hacer click afuera o al apretar Escape.
 * El prototipo solo cubría el click; Escape es lo que uno espera de un popover.
 *
 * El prefijo `use` es obligatorio aunque el resto del proyecto vaya en español: es
 * cómo React y su linter reconocen un hook, no una convención de estilo.
 */
export function useCierre<T extends HTMLElement>(cerrar: () => void) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const click = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) cerrar();
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrar();
    };
    document.addEventListener("mousedown", click);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", click);
      document.removeEventListener("keydown", tecla);
    };
  }, [cerrar]);

  return ref;
}
