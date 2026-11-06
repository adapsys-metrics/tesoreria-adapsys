"use client";

// Un campo para escribir plata.
//
// Existe porque `<input type="number">` controlado **no deja escribir un número
// negativo**. Al teclear el menos solo, el navegador considera el valor
// incompleto y `e.target.value` devuelve `""`; con `Number("") || 0` eso se
// guardaba como 0, el campo se volvía a dibujar con ese 0 y el menos
// desaparecía antes de poder escribir el primer dígito. Es el mismo error que
// §8 describe para el campo de fecha: escribir al estado un valor intermedio.
//
// La solución es la misma de siempre: mientras se escribe manda el texto, y al
// estado solo sube lo que ya es un número. Los estados intermedios —"", "-",
// "-5." — se muestran y no se guardan, así que el valor de antes sigue en pie
// hasta que haya uno nuevo de verdad.
//
// Separadores: se acepta la coma o el punto como decimal, que es lo que la gente
// escribe. Cuando vienen los dos —"90.075,23" pegado de una cartola— manda el
// **último**, que es el decimal, y el otro es de miles. Lo que no se adivina es
// un punto solo: "5.194" se lee como 5,194 y no como cinco mil ciento noventa y
// cuatro, porque es exactamente como el campo lo muestra al releerlo.

import { useState } from "react";

/** El número que representa un texto escrito a mano, o null si todavía no es uno.
 *
 *  null es "no guardes nada", no "guarda cero": es la diferencia entre un campo a
 *  medio escribir y un monto de cero. */
export function montoDeTexto(texto: string): number | null {
  const t = texto.trim();
  if (t === "") return null;

  const ultimoPunto = t.lastIndexOf(".");
  const ultimaComa = t.lastIndexOf(",");
  // Con los dos separadores, el que viene último es el decimal y el otro es de
  // miles: "90.075,23" son noventa mil, y "1,234.56" —pegado de algo en inglés—
  // también. Sin ese desempate, quitar el punto a ciegas convertiría 20.658,67
  // en 2.065.867.
  const limpio =
    ultimoPunto >= 0 && ultimaComa >= 0
      ? ultimoPunto < ultimaComa
        ? t.replace(/\./g, "").replace(",", ".")
        : t.replace(/,/g, "")
      : t.replace(",", ".");

  if (!/^-?\d*\.?\d*$/.test(limpio)) return null;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}

export function EntradaMonto({
  valor,
  onChange,
  etiqueta,
  className,
  style,
  placeholder,
}: {
  valor: number;
  onChange: (n: number) => void;
  etiqueta: string;
  className?: string;
  style?: React.CSSProperties;
  placeholder?: string;
}) {
  // Lo que se está escribiendo, cuando difiere de lo guardado. null es "mostrá el
  // valor de verdad": así el campo se actualiza solo cuando el monto cambia desde
  // afuera —el botón de IVA, cuadrar la diferencia, recargar— sin pisar lo que
  // alguien tiene a medio escribir.
  const [texto, setTexto] = useState<string | null>(null);

  return (
    <input
      // Texto y no number: con number el navegador se queda el valor incompleto y
      // nunca llega el menos. `inputMode` deja el teclado numérico en el teléfono.
      type="text"
      inputMode="decimal"
      value={texto ?? String(valor)}
      aria-label={etiqueta}
      placeholder={placeholder}
      onChange={(e) => {
        setTexto(e.target.value);
        const n = montoDeTexto(e.target.value);
        if (n !== null) onChange(n);
      }}
      // Al salir se suelta el texto y vuelve a mandar el número: si quedó algo que
      // no es un monto —"-" solo, o vacío— el campo muestra de nuevo lo guardado
      // en vez de dejar a la vista algo que no se guardó.
      onBlur={() => setTexto(null)}
      className={className}
      style={style}
    />
  );
}
