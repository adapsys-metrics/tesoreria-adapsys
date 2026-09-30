// Cambiar la empresa de un movimiento.
//
// Son dos cosas distintas según dónde viva (§2):
//
// - En una cuenta del banco, la cuenta manda: cambiar de empresa mueve la plata de una
//   cuenta a otra y cambia el saldo de las dos. Eso se confirma.
// - En una auxiliar —facturas por cobrar, proyecciones—, la empresa es un dato del
//   movimiento: esas cuentas son de las cuatro a la vez y el movimiento se queda ahí.

import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { montarEn, prepararEntorno } from "@/components/pruebas/entorno";
import { ProveedorTesoreria } from "@/components/estado/ProveedorTesoreria";
import { Registro } from "@/components/movimientos/Registro";
import { Cuentas } from "@/components/chrome/Cuentas";

prepararEntorno();

const filas = () => document.querySelectorAll('tr[data-fila="movimiento"]');

describe("En la cartera por cobrar", () => {
  const enCartera = () => {
    montarEn("cuenta:x1", <Registro />);
    expect(filas().length).toBeGreaterThan(0);
  };

  it("se elige la empresa, no la cuenta", () => {
    // Listar solo cuentas del banco hacía que el <select> no encontrara su valor y
    // mostrara la primera opción: parecía que todo era de CLA ADAPTACIÓN.
    enCartera();
    expect(screen.getAllByLabelText("Empresa").length).toBeGreaterThan(0);
    expect(screen.queryAllByLabelText("Cuenta")).toHaveLength(0);
  });

  it("muestra la empresa que el movimiento tiene de verdad", () => {
    enCartera();
    const select = screen.getAllByLabelText("Empresa")[0]! as HTMLSelectElement;
    expect(select.value).not.toBe("");
  });

  it("cambiarla no se lleva el movimiento fuera de la cartera", () => {
    // Era el error: al cambiar la empresa el movimiento desaparecía de la vista.
    enCartera();
    const antes = filas().length;
    fireEvent.change(screen.getAllByLabelText("Empresa")[0]!, { target: { value: "cons" } });
    expect(filas().length).toBe(antes);
    expect((screen.getAllByLabelText("Empresa")[0]! as HTMLSelectElement).value).toBe("cons");
  });

  it("no pide confirmación: no se mueve nada", () => {
    enCartera();
    fireEvent.change(screen.getAllByLabelText("Empresa")[0]!, { target: { value: "cons" } });
    expect(screen.queryByRole("dialog", { name: "Confirmar cambio de cuenta" })).toBeNull();
  });
});

describe("En una cuenta del banco", () => {
  const enBanco = () => {
    render(
      <ProveedorTesoreria registroInicial="cuenta:a1">
        <Registro />
        <Cuentas />
      </ProveedorTesoreria>
    );
    expect(filas().length).toBeGreaterThan(0);
  };

  it("cambiar la empresa pide confirmar antes de mover", () => {
    enBanco();
    fireEvent.change(screen.getAllByLabelText("Cuenta")[0]!, { target: { value: "b1" } });
    const cuadro = screen.getByRole("dialog", { name: "Confirmar cambio de cuenta" });
    expect(within(cuadro).getByText(/¿Mover el movimiento de cuenta\?/)).toBeDefined();
    // Dice de dónde a dónde y qué consecuencia tiene.
    expect(cuadro.textContent).toMatch(/CLA CONSULTORES/);
    expect(cuadro.textContent).toMatch(/saldo de las dos cuentas/);
  });

  it("cancelar deja el movimiento donde estaba", () => {
    enBanco();
    const antes = filas().length;
    fireEvent.change(screen.getAllByLabelText("Cuenta")[0]!, { target: { value: "b1" } });
    fireEvent.click(screen.getByText("Cancelar"));
    expect(screen.queryByRole("dialog", { name: "Confirmar cambio de cuenta" })).toBeNull();
    expect(filas().length).toBe(antes);
  });

  it("confirmar sí lo mueve, y sale de la cuenta abierta", () => {
    enBanco();
    const antes = filas().length;
    fireEvent.change(screen.getAllByLabelText("Cuenta")[0]!, { target: { value: "b1" } });
    fireEvent.click(screen.getByText("Sí, mover"));
    expect(filas().length).toBe(antes - 1);
  });

  it("avisa cuando el movimiento ya estaba conciliado", () => {
    // Es el caso que preocupaba: mover algo ya cuadrado contra la cartola.
    enBanco();
    fireEvent.change(screen.getAllByLabelText("Cuenta")[0]!, { target: { value: "b1" } });
    const cuadro = screen.getByRole("dialog", { name: "Confirmar cambio de cuenta" });
    expect(cuadro.textContent).toMatch(/ya está conciliado/);
  });
});
