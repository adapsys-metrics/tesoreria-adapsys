// Cuándo y cómo se escribe a la base.
//
// El síntoma era un cartel rojo —"invalid input syntax for type date"— al marcar algo
// pagado justo después de tocarle la fecha, que desaparecía al recargar. Dos causas:
// se guardaba en cada tecla, y una fecha a medio escribir vale "".

import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { montar, prepararEntorno } from "@/components/pruebas/entorno";
import { Registro } from "@/components/movimientos/Registro";

prepararEntorno();

const abrirEditor = () => {
  montar(<Registro />);
  fireEvent.click(screen.getAllByTitle("Editar el movimiento")[0]!);
  return screen.getByLabelText("Fecha") as HTMLInputElement;
};

describe("La fecha de un movimiento", () => {
  it("no se puede dejar vacía", () => {
    // Un movimiento sin fecha no existe: no está en ninguna cartola ni en ninguna
    // proyección. Y la base lo rechaza entero, no solo ese campo.
    const campo = abrirEditor();
    const antes = campo.value;
    expect(antes).not.toBe("");

    fireEvent.change(campo, { target: { value: "" } });
    expect(campo.value).toBe(antes);
  });

  it("un cambio válido sí entra", () => {
    const campo = abrirEditor();
    fireEvent.change(campo, { target: { value: "2026-11-20" } });
    expect(campo.value).toBe("2026-11-20");
  });

  it("escribir de a poco no deja el movimiento sin fecha", () => {
    // Es lo que pasa al tipear: el navegador reporta "" en los estados intermedios.
    const campo = abrirEditor();
    fireEvent.change(campo, { target: { value: "" } });
    fireEvent.change(campo, { target: { value: "" } });
    fireEvent.change(campo, { target: { value: "2026-12-01" } });
    expect(campo.value).toBe("2026-12-01");
  });
});

describe("Escribir en el alta", () => {
  it("tampoco acepta fecha vacía", () => {
    montar(<Registro />);
    fireEvent.click(screen.getByText("+ Nuevo"));
    const campo = screen.getByLabelText("Fecha") as HTMLInputElement;
    const antes = campo.value;
    fireEvent.change(campo, { target: { value: "" } });
    expect(campo.value).toBe(antes);
  });
});
