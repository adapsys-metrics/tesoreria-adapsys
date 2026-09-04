// La suma de lo seleccionado, en las dos tablas donde hay movimientos: el registro
// y el detalle de un monto.
//
// Va en su propio archivo y no en vistas.test.tsx porque estos tests seleccionan las
// 56 filas de la tabla completa, y sumados a los otros 90 del archivo agotaban la
// memoria del worker: pasaban solos y reventaban en conjunto.

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { ProveedorTesoreria } from "@/components/estado/ProveedorTesoreria";
import { Registro } from "@/components/movimientos/Registro";
import { Flujo } from "@/components/flujo/Flujo";

vi.mock("next/navigation", () => ({
  usePathname: () => "/movimientos",
}));

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

const montar = (ui: React.ReactNode) =>
  render(<ProveedorTesoreria registroInicial={null}>{ui}</ProveedorTesoreria>);

describe("Seleccionar y sumar", () => {
  // Cinco facturas pagadas en una sola transferencia: hay que confirmar que suman lo
  // que llegó al banco. Sin esto se saca la calculadora, que es donde se cuela el error.

  const casillas = () => screen.getAllByLabelText(/^Seleccionar (?!todo)/);

  it("no ocupa lugar mientras no haya nada seleccionado", () => {
    montar(<Registro />);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("suma lo seleccionado y dice cuántos son", () => {
    montar(<Registro />);
    fireEvent.click(casillas()[0]!);
    fireEvent.click(casillas()[1]!);
    const barra = screen.getByRole("status");
    expect(barra.textContent).toContain("2 seleccionados");

    // El total es exactamente la suma de los montos de esas dos filas.
    const filas = document.querySelectorAll('tr[data-fila="movimiento"]');
    const monto = (tr: Element) => {
      const celdas = tr.querySelectorAll("td");
      const texto = celdas[celdas.length - 3]?.textContent ?? "";
      return Number(texto.replace(/[^\d,-]/g, "").replace(/\./g, "").replace(",", "."));
    };
    const esperado = Math.abs(monto(filas[0]!) + monto(filas[1]!));
    const enBarra = Math.abs(
      Number(
        (barra.textContent?.match(/-?[\d.]+/g) ?? [])
          .map((x) => x.replace(/\./g, ""))
          .map(Number)
          .sort((a, b) => Math.abs(b) - Math.abs(a))[0]
      )
    );
    expect(enBarra).toBe(esperado);
  });

  it("shift alcanza el rango, que es como vienen las facturas de un mismo pago", () => {
    montar(<Registro />);
    fireEvent.click(casillas()[0]!);
    fireEvent.click(casillas()[4]!, { shiftKey: true });
    expect(screen.getByRole("status").textContent).toContain("5 seleccionados");
  });

  it("limpiar deja la barra fuera", () => {
    montar(<Registro />);
    fireEvent.click(casillas()[0]!);
    fireEvent.click(screen.getByText("limpiar"));
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("lo que deja de verse deja de contar", () => {
    // Si al filtrar quedaran marcadas filas invisibles, el total diría un número que
    // no corresponde a nada en pantalla — y es el número que se compara contra el banco.
    montar(<Registro />);
    fireEvent.click(screen.getByLabelText("Seleccionar todo lo que se ve"));
    const antes = Number(/(\d+) seleccionado/.exec(screen.getByRole("status").textContent ?? "")![1]);
    expect(antes).toBeGreaterThan(1);

    fireEvent.change(screen.getByLabelText("Buscar"), { target: { value: "GTD" } });
    const visibles = document.querySelectorAll('tr[data-fila="movimiento"]').length;
    const barra = screen.queryByRole("status");
    const despues = barra
      ? Number(/(\d+) seleccionado/.exec(barra.textContent ?? "")![1])
      : 0;
    expect(despues).toBe(visibles);
    expect(despues).toBeLessThan(antes);
  });

  it("con dos monedas muestra los dos totales, sin convertir", () => {
    montar(<Registro />);
    fireEvent.click(screen.getByLabelText("Seleccionar todo lo que se ve"));
    const barra = screen.getByRole("status");
    expect(barra.textContent).toContain("US$");
    expect(barra.textContent).toMatch(/Dos monedas/);
  });

  it("también se puede seleccionar dentro del detalle de un monto", () => {
    // Es donde más sirve: el detalle se abrió justamente para revisar qué compone
    // un monto, y ahí es donde aparece la pregunta de si estas suman lo que llegó.
    montar(<Flujo />);
    fireEvent.click(screen.getAllByTitle("Ver el detalle de este monto")[0]!);
    const panel = screen.getByRole("dialog");
    fireEvent.click(within(panel).getAllByLabelText(/^Seleccionar (?!todo)/)[0]!);
    expect(within(panel).getByRole("status").textContent).toContain("1 seleccionado");
  });
});
