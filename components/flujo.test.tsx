// Tests de render (§8): cada vista se monta de verdad, con los paneles
// expandidos. Compilar no basta — el bundler no detecta un identificador
// usado antes de declararse, y eso ya reventó en este proyecto.

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { montar, montarEn, prepararEntorno } from "@/components/pruebas/entorno";
import { ProveedorTesoreria } from "@/components/estado/ProveedorTesoreria";
import { Flujo } from "@/components/flujo/Flujo";
import { CATEGORIAS } from "@/lib/catalogo";

prepararEntorno();

describe("Flujo de caja", () => {
  it("monta y muestra la tabla con sus secciones", () => {
    montar(<Flujo />);
    expect(screen.getByRole("heading", { name: "Flujo de caja" })).toBeDefined();
    // Las tres naturalezas del catálogo (§4.2).
    expect(screen.getByText("Ingresos")).toBeDefined();
    expect(screen.getByText("Gastos Operativos")).toBeDefined();
    expect(screen.getByText("Flujo neto del período")).toBeDefined();
    expect(screen.getByText("Flujo acumulado")).toBeDefined();
  });

  it("expande todas los grupos sin romperse", () => {
    montar(<Flujo />);
    const antes = document.querySelectorAll("tbody tr").length;
    fireEvent.click(screen.getByText("Expandir todo"));
    const despues = document.querySelectorAll("tbody tr").length;
    expect(despues).toBeGreaterThan(antes);
    // El botón cambia de sentido y vuelve a colapsar.
    fireEvent.click(screen.getByText("Colapsar todo"));
    expect(document.querySelectorAll("tbody tr").length).toBe(antes);
  });

  it("abre el detalle de un monto y lista los movimientos que lo componen", () => {
    montar(<Flujo />);
    const clicables = screen.getAllByTitle("Ver el detalle de este monto");
    expect(clicables.length).toBeGreaterThan(0);
    fireEvent.click(clicables[0]!);

    const panel = screen.getByRole("dialog");
    expect(panel).toBeDefined();
    // El panel permite reclasificar ahí mismo: el control existe y al accionarlo
    // aparece el buscador con resultados.
    const selectores = within(panel).getAllByLabelText("Categoría");
    expect(selectores.length).toBeGreaterThan(0);
    fireEvent.click(selectores[0]!);
    const abierto = within(panel).getAllByLabelText("Categoría")[0]! as HTMLInputElement;
    expect(abierto.tagName).toBe("INPUT");
    expect(within(panel).getAllByRole("option").length).toBeGreaterThan(0);
  });

  it("cierra el detalle con Escape", () => {
    montar(<Flujo />);
    fireEvent.click(screen.getAllByTitle("Ver el detalle de este monto")[0]!);
    expect(screen.queryByRole("dialog")).not.toBeNull();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("cambia de granularidad semanal a mensual", () => {
    montar(<Flujo />);
    fireEvent.click(screen.getByText("Mensual"));
    // Los encabezados pasan a ser meses.
    expect(screen.getByText("sep")).toBeDefined();
  });

  it("aplica los presets de rango", () => {
    montar(<Flujo />);
    for (const preset of ["Año en curso", "Año completo", "Mes actual", "Últimos 12 meses"]) {
      fireEvent.click(screen.getByText(preset));
      expect(screen.getByRole("heading", { name: "Flujo de caja" })).toBeDefined();
    }
  });

  it("muestra los montos completos, no abreviados", () => {
    // El equipo los necesita legibles de una: "435M" obliga a traducir de cabeza
    // y a confiar en un redondeo que esconde hasta medio millón.
    montar(<Flujo />);
    const celdas = Array.from(document.querySelectorAll("tbody td"))
      .map((td) => td.textContent ?? "")
      .filter((t) => t !== "" && t !== "$0");
    expect(celdas.length).toBeGreaterThan(0);
    // Ninguna abreviatura: ni 1,2M ni 340k.
    expect(celdas.filter((t) => /^−?[\d,]+[Mk]$/.test(t))).toEqual([]);
    // Y al menos uno con separador de miles, que es lo que se pidió ver.
    expect(celdas.some((t) => /\d\.\d{3}/.test(t))).toBe(true);
  });

  it("avisa que los movimientos en dólares quedan fuera del flujo (§4.5)", () => {
    montar(<Flujo />);
    fireEvent.click(screen.getByText("Año completo"));
    expect(screen.getByText("Fuera del flujo")).toBeDefined();
  });
});
