// Cuántas veces se escribe a la base al editar.
//
// Sin espera había una escritura por tecla: una glosa de veinte caracteres eran veinte
// UPDATE, y los estados intermedios —una fecha a medio tipear, que vale ""— llegaban a
// la base y la hacían fallar aunque el valor final fuera correcto.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({ usePathname: () => "/movimientos" }));
// Con Supabase "conectado" el proveedor persiste; sin esto el efecto ni corre.
vi.mock("@/lib/supabase/estado", () => ({ supabaseConfigurado: true }));
vi.mock("@/lib/supabase/client", () => ({ crearClienteNavegador: () => ({}) }));

const guardado = vi.fn(async (_c: unknown, m: { id: string }) => m.id);
vi.mock("@/lib/supabase/datos", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  guardarMovimiento: (c: unknown, m: { id: string }) => guardado(c, m),
  cargarMovimientos: async () => (await import("@/lib/datos-ejemplo")).MOVIMIENTOS_EJEMPLO,
}));
vi.mock("@/lib/supabase/catalogo", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  cargarCatalogo: async () => {
    const c = await import("@/lib/catalogo");
    return { grupos: c.GRUPOS, categorias: c.CATEGORIAS, subcategorias: c.SUBCATEGORIAS };
  },
}));
vi.mock("@/lib/supabase/maestros", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  cargarMaestros: async () => {
    const c = await import("@/lib/catalogo");
    return { empresas: c.EMPRESAS, cuentasBase: c.CUENTAS, proveedores: [] };
  },
}));

const { ProveedorTesoreria } = await import("@/components/estado/ProveedorTesoreria");
const { Registro } = await import("@/components/movimientos/Registro");

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  guardado.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

const abrir = async () => {
  render(
    <ProveedorTesoreria registroInicial={null}>
      <Registro />
    </ProveedorTesoreria>
  );
  // Deja que termine la carga inicial y se asiente la línea base.
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1500);
  });
  guardado.mockClear();
  fireEvent.click(screen.getAllByTitle("Editar el movimiento")[0]!);
};

const esperar = async () => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1500);
  });
};

describe("Escrituras a la base al editar", () => {
  it("escribir una glosa no manda una por tecla", async () => {
    await abrir();
    const glosa = screen.getByLabelText("Glosa");
    for (const t of ["G", "GT", "GTD", "GTD ", "GTD s", "GTD se", "GTD sep"]) {
      fireEvent.change(glosa, { target: { value: t } });
    }
    await esperar();
    expect(guardado).toHaveBeenCalledTimes(1);
  });

  it("y lo que se guarda es el valor final", async () => {
    await abrir();
    const glosa = screen.getByLabelText("Glosa");
    fireEvent.change(glosa, { target: { value: "parcial" } });
    fireEvent.change(glosa, { target: { value: "completo" } });
    await esperar();
    expect(guardado.mock.calls.at(-1)![1]).toMatchObject({ glosa: "completo" });
  });

  it("nunca manda un movimiento sin fecha", async () => {
    // Es lo que rompía: la base rechaza el movimiento entero con "invalid input
    // syntax for type date", y el cartel aparecía aunque el valor final fuera bueno.
    await abrir();
    const fecha = screen.getByLabelText("Fecha");
    fireEvent.change(fecha, { target: { value: "" } });
    fireEvent.change(fecha, { target: { value: "2026-12-01" } });
    await esperar();
    for (const [, m] of guardado.mock.calls) {
      expect((m as unknown as { fecha: string }).fecha).not.toBe("");
    }
  });
});
