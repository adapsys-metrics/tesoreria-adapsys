// Tests de render (§8): cada vista se monta de verdad, con los paneles
// expandidos. Compilar no basta — el bundler no detecta un identificador
// usado antes de declararse, y eso ya reventó en este proyecto.

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { montar, montarEn, prepararEntorno } from "@/components/pruebas/entorno";
import { ProveedorTesoreria } from "@/components/estado/ProveedorTesoreria";
import { Registro } from "@/components/movimientos/Registro";
import { Cuentas } from "@/components/chrome/Cuentas";

prepararEntorno();

describe("Cobrar recorre la cadena, no salta al banco", () => {
  const conCartera = (registro: string) =>
    render(
      <ProveedorTesoreria registroInicial={registro}>
        <Cuentas />
        <Registro />
      </ProveedorTesoreria>
    );

  it("un proyecto aprobado ofrece facturar, no cobrar", () => {
    conCartera("cuenta:x3");
    expect(screen.getAllByText("Facturar").length).toBeGreaterThan(0);
    expect(screen.queryByText("Cobrar")).toBeNull();
  });

  it("una factura por cobrar ofrece cobrar", () => {
    conCartera("cuenta:x1");
    expect(screen.getAllByText("Cobrar").length).toBeGreaterThan(0);
    expect(screen.queryByText("Facturar")).toBeNull();
  });

  it("facturar abre el editor en vez de mover el movimiento", () => {
    // Al emitir cambia el número, pero también la fecha —que pasa de estimada a
    // firme— y a veces el monto. Mover primero y editar después obliga a ir a
    // buscarlo al otro registro.
    conCartera("cuenta:x3");
    const antes = document.querySelectorAll("tbody tr").length;
    fireEvent.click(screen.getAllByText("Facturar")[0]!);
    expect(screen.getByText("Emitir y pasar a cobranza")).toBeDefined();
    expect(screen.getAllByLabelText("Número de documento").length).toBeGreaterThan(0);
    // Todavía no se movió: sigue en proyectos aprobados, ahora con su editor abierto.
    expect(screen.getByTitle(/Salir de Proyectos aprobados/)).toBeDefined();
  });

  it("no deja emitir sin número de documento", () => {
    conCartera("cuenta:x3");
    fireEvent.click(screen.getAllByText("Facturar")[0]!);
    const emitir = screen.getByText("Emitir y pasar a cobranza") as HTMLButtonElement;
    expect(emitir.disabled).toBe(true);
  });

  it("con el número, sale de proyectos aprobados y queda en la cartera", () => {
    conCartera("cuenta:x3");
    const antes = document.querySelectorAll("tbody tr").length;
    fireEvent.click(screen.getAllByText("Facturar")[0]!);
    fireEvent.change(screen.getAllByLabelText("Número de documento")[0]!, {
      target: { value: "FA9001" },
    });
    fireEvent.click(screen.getByText("Emitir y pasar a cobranza"));
    // La fila y su editor salen de este registro…
    expect(document.querySelectorAll("tbody tr").length).toBeLessThan(antes);
    // …y sigue siendo plata por entrar, no un movimiento del banco.
    expect(screen.getByTitle(/Ver facturas por cobrar en CLP/)).toBeDefined();
  });

  it("el número queda guardado y se puede buscar por él", () => {
    conCartera("cuenta:x3");
    fireEvent.click(screen.getAllByText("Facturar")[0]!);
    fireEvent.change(screen.getAllByLabelText("Número de documento")[0]!, {
      target: { value: "FA9001" },
    });
    fireEvent.click(screen.getByText("Emitir y pasar a cobranza"));

    fireEvent.click(screen.getByTitle(/Ver facturas por cobrar en CLP/));
    expect(screen.getByText("FA9001")).toBeDefined();
    fireEvent.change(screen.getByLabelText("Buscar"), { target: { value: "FA9001" } });
    // Se cuentan filas de movimiento: el editor abierto también es un <tr>.
    expect(document.querySelectorAll('tr[data-fila="movimiento"]')).toHaveLength(1);
  });

  it("el hito se ve en la fila y se puede editar", () => {
    // Venía en la columna Action de Quicken y se había perdido en la importación:
    // esa columna trae la empresa en unos registros y el número de hito en otros.
    conCartera("cuenta:x3");
    fireEvent.click(screen.getAllByTitle("Editar el movimiento")[0]!);
    const campo = screen.getAllByLabelText("Número de hito")[0]!;
    fireEvent.change(campo, { target: { value: "3" } });
    expect(screen.getAllByText("hito 3").length).toBeGreaterThan(0);

    // Vaciarlo lo quita: cero no es un hito.
    fireEvent.change(campo, { target: { value: "" } });
    expect(screen.queryByText("hito 3")).toBeNull();
  });

  it("la cartera no ofrece los botones de impuesto", () => {
    // "+ IVA" agrega una línea a IVA compras, que es el crédito fiscal del que
    // paga; y la retención de honorarios solo existe cuando pagamos nosotros. En
    // una factura emitida a un cliente ninguno aplica, y tenerlos ahí es una vía
    // para clasificar un ingreso como IVA compras.
    conCartera("cuenta:x1");
    fireEvent.click(screen.getAllByTitle("Editar el movimiento")[0]!);
    expect(screen.getByText("+ línea")).toBeDefined();
    expect(screen.queryByText(/\+ IVA/)).toBeNull();
    expect(screen.queryByText(/− Retención/)).toBeNull();
  });

  it("una cuenta del banco sí los ofrece", () => {
    conCartera("cuenta:b1");
    fireEvent.click(screen.getAllByTitle("Editar el movimiento")[0]!);
    expect(screen.getByText(/\+ IVA/)).toBeDefined();
    expect(screen.getByText(/− Retención/)).toBeDefined();
  });

  it("el saldo de la cartera es lo pendiente, no cero", () => {
    // Antes valía cero: la regla del banco descarta lo proyectado, y en una cuenta
    // de cobranza todo lo pendiente es justamente proyectado.
    conCartera("cuenta:x1");
    const fila = screen.getByTitle(/Salir de Facturas por cobrar/);
    expect(fila.textContent).not.toMatch(/\$0$/);
  });
});
