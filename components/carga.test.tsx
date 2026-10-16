// Mientras carga no se muestra ningún número.
//
// Es la regla entera, y no es cosmética: hasta que los movimientos llegan, el
// saldo de una cuenta vale su saldo inicial, el comprometido vale cero y el gasto
// a la fecha vale cero. Son números **plausibles y equivocados**, que es la peor
// clase — nadie sospecha de un saldo con la forma de un saldo. Un cartel arriba
// no alcanza cuando lo de abajo se lee como un dato.

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Cifra, Hueco, SaldoCabecera, TablaFantasma } from "@/components/ui/primitivas";

describe("Cifra mientras carga", () => {
  it("no muestra el número", () => {
    // 74.220.512 es el saldo inicial de CLA ADAPTACIÓN PESOS: exactamente el
    // número que se veía y que no era el saldo.
    render(<Cifra rotulo="Efectivo CLP" valor={74220512} cargando />);
    expect(screen.queryByText(/74\.220\.512/)).toBeNull();
    expect(screen.queryByText("$0")).toBeNull();
  });

  it("el rótulo sí se muestra: la pantalla no cambia de forma al llegar el dato", () => {
    render(<Cifra rotulo="Efectivo CLP" valor={74220512} cargando />);
    expect(screen.getByText("Efectivo CLP")).toBeDefined();
  });

  it("y con el dato cargado lo muestra igual que siempre", () => {
    render(<Cifra rotulo="Efectivo CLP" valor={74220512} />);
    expect(screen.getByText(/74\.220\.512/)).toBeDefined();
  });

  it("tampoco muestra un texto ya armado, como el saldo en dólares", () => {
    render(<Cifra rotulo="Saldo USD" texto="US$72.508" cargando />);
    expect(screen.queryByText("US$72.508")).toBeNull();
  });
});

describe("SaldoCabecera mientras carga", () => {
  it("no muestra el saldo del registro abierto", () => {
    render(<SaldoCabecera rotulo="Saldo de hoy" texto="$119.808.740" cargando />);
    expect(screen.getByText("Saldo de hoy")).toBeDefined();
    expect(screen.queryByText("$119.808.740")).toBeNull();
  });
});

describe("Los huecos no se leen en voz alta", () => {
  it("el hueco queda fuera del árbol de accesibilidad", () => {
    // No tiene nada que decir: es la ausencia de un dato, no un dato vacío.
    const { container } = render(<Hueco />);
    expect(container.firstElementChild?.getAttribute("aria-hidden")).toBe("true");
  });

  it("la tabla fantasma sí avisa que está ocupada", () => {
    render(<TablaFantasma filas={3} columnas={4} />);
    const fantasma = screen.getByLabelText("Cargando movimientos");
    expect(fantasma.getAttribute("aria-busy")).toBe("true");
    expect(fantasma.children).toHaveLength(3);
  });
});
