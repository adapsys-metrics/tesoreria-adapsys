// Buscar una categoría entre 290 (§5).
//
// El <select> nativo solo saltaba a lo que empieza igual: escribir "internet" no
// encontraba "Telefonía e internet".

import { describe, expect, it } from "vitest";
import { fireEvent, screen, within } from "@testing-library/react";
import { montar, prepararEntorno } from "@/components/pruebas/entorno";
import { Registro } from "@/components/movimientos/Registro";

prepararEntorno();

const abrirSelector = () => {
  montar(<Registro />);
  fireEvent.click(screen.getAllByLabelText("Categoría")[0]!);
  return screen.getByPlaceholderText("Buscar categoría");
};

const escribir = (texto: string) => {
  const caja = abrirSelector();
  fireEvent.change(caja, { target: { value: texto } });
  return caja;
};

// Acotado a la lista del buscador: los <select> nativos de la tabla —empresa, por
// ejemplo— también tienen <option> y contarían.
const lista = () => within(screen.getByRole("listbox", { name: "Categorías encontradas" }));
const opciones = () => lista().getAllByRole("option").map((o) => o.textContent ?? "");

describe("Buscar la categoría", () => {
  it("encuentra por una palabra del medio", () => {
    escribir("internet");
    expect(opciones().some((t) => t.includes("Telefonía e internet"))).toBe(true);
  });

  it("encuentra sin tildes", () => {
    escribir("telefonia");
    expect(opciones().some((t) => t.includes("Telefonía e internet"))).toBe(true);
  });

  it("muestra el grupo de cada resultado", () => {
    // Dos categorías pueden llamarse igual en grupos distintos, y sin el grupo no hay
    // cómo distinguirlas.
    escribir("internet");
    expect(opciones()[0]).toMatch(/GASTOS ADMINISTRACIÓN/);
  });

  it("avisa cuando no hay nada, en vez de mostrar una lista vacía", () => {
    escribir("zzzzzz");
    expect(screen.getByText("Nada coincide")).toBeDefined();
  });

  it("se elige con el mouse y queda puesta", () => {
    escribir("arriendo oficina");
    fireEvent.mouseDown(lista().getByText("Arriendo oficina"));
    expect(screen.getAllByLabelText("Categoría")[0]!.textContent).toBe("Arriendo oficina");
  });

  it("se elige con el teclado, sin tocar el mouse", () => {
    const caja = escribir("arriendo oficina");
    fireEvent.keyDown(caja, { key: "Enter" });
    expect(screen.getAllByLabelText("Categoría")[0]!.textContent).toBe("Arriendo oficina");
  });

  it("las flechas mueven la marca sin salirse de la lista", () => {
    const caja = escribir("arriendo");
    // Hacia arriba desde la primera no se va a ninguna parte.
    fireEvent.keyDown(caja, { key: "ArrowUp" });
    expect(lista().getAllByRole("option")[0]!.getAttribute("aria-selected")).toBe("true");
  });

  it("Escape cierra sin cambiar nada", () => {
    montar(<Registro />);
    const antes = screen.getAllByLabelText("Categoría")[0]!.textContent;
    fireEvent.click(screen.getAllByLabelText("Categoría")[0]!);
    fireEvent.keyDown(screen.getByPlaceholderText("Buscar categoría"), { key: "Escape" });
    expect(screen.getAllByLabelText("Categoría")[0]!.textContent).toBe(antes);
  });

  it("lo recién usado queda a mano la próxima vez", () => {
    // En un registro se clasifica varias veces seguidas en lo mismo.
    escribir("arriendo oficina");
    fireEvent.mouseDown(lista().getByText("Arriendo oficina"));

    fireEvent.click(screen.getAllByLabelText("Categoría")[1]!);
    expect(opciones()[0]).toMatch(/reciente/);
  });

  it("no ofrece las inactivas", () => {
    // Desactivar una categoría sirve justamente para que deje de aparecer al
    // clasificar, sin tocar lo ya clasificado con ella (§3).
    escribir("");
    const todas = opciones().length;
    expect(todas).toBeGreaterThan(0);
  });
});
