// El importador no se muestra en la vista (ver la cabecera de Importador.tsx), pero
// se sigue probando: sin esto se rompe en silencio y nadie se entera hasta el día que
// haga falta devolverlo, que es el peor momento para descubrirlo.

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Importador } from "@/components/categorias/Importador";

afterEach(cleanup);

const montar = (importar = vi.fn(() => ({ grupos: 1, categorias: 2, subcategorias: 1 }))) => {
  render(<Importador importar={importar} />);
  return importar;
};

const pegar = (texto: string) => {
  fireEvent.change(screen.getByLabelText("Listado a importar"), { target: { value: texto } });
  fireEvent.click(screen.getByRole("button", { name: "Previsualizar" }));
};

describe("Importador del catálogo", () => {
  it("previsualiza sin tocar nada", () => {
    const importar = montar();
    pegar("Logística\n  Fletes\n    Courier internacional");
    expect(screen.getByText(/subcategorías detectadas/)).toBeDefined();
    expect(importar).not.toHaveBeenCalled();
  });

  it("muestra los tres niveles anidados en la previsualización", () => {
    montar();
    pegar("Logística\n  Fletes\n    Courier internacional");
    expect(screen.getByText("Logística")).toBeDefined();
    expect(screen.getByText("Fletes")).toBeDefined();
    expect(screen.getByText("Courier internacional")).toBeDefined();
  });

  it("recién al aceptar entrega lo leído, y dice qué entró", () => {
    const importar = montar();
    pegar("Logística\n  Fletes\n    Courier internacional");
    fireEvent.click(screen.getByRole("button", { name: "AGREGAR AL CATÁLOGO" }));
    expect(importar).toHaveBeenCalledOnce();
    expect(screen.getByText("Entraron 1 grupos, 2 categorías, 1 subcategorías.")).toBeDefined();
  });

  it("cuando no entró nada lo dice, en vez de quedarse mudo", () => {
    montar(vi.fn(() => ({ grupos: 0, categorias: 0, subcategorias: 0 })));
    pegar("Logística:Fletes");
    fireEvent.click(screen.getByRole("button", { name: "AGREGAR AL CATÁLOGO" }));
    expect(screen.getByText(/no se agregó nada/)).toBeDefined();
  });

  it("editar el texto descarta la previsualización vieja", () => {
    // Si no, se vería el resumen de un listado y se aplicaría otro.
    montar();
    pegar("Logística:Fletes");
    fireEvent.change(screen.getByLabelText("Listado a importar"), {
      target: { value: "Otra cosa" },
    });
    expect(screen.queryByRole("button", { name: "AGREGAR AL CATÁLOGO" })).toBeNull();
  });
});
