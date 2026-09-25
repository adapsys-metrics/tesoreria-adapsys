// El IVA sobre un pago que junta facturas de distinto tipo.
//
// Vida Cámara manda tres: dos afectas y una exenta, y se pagan en una transferencia.
// Cobrar IVA sobre las tres es plata que no existe, y el descuadre no lo delata porque
// la suma de líneas igual cuadra con el monto — solo que el monto quedó mal.

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { ProveedorTesoreria, useTesoreria } from "@/components/estado/ProveedorTesoreria";
import { Registro } from "@/components/movimientos/Registro";
import { SUB_IVA_COMPRAS } from "@/lib/dominio";
import type { DocTipo, Movimiento } from "@/lib/tipos";

vi.mock("next/navigation", () => ({ usePathname: () => "/movimientos" }));
afterEach(() => {
  cleanup();
  // Sin Supabase el proveedor guarda en localStorage, así que el movimiento de un test
  // sobrevive al siguiente y lo encuentra por contraparte.
  window.localStorage.clear();
});

/** Monta un movimiento a medida y deja aplicar el impuesto sobre él. */
function Banco({ doc_tipo, tipos }: { doc_tipo: DocTipo | null; tipos: (DocTipo | null)[] }) {
  const { movimientos, agregarMovimiento, aplicarImpuesto } = useTesoreria();
  const mio = movimientos.find((m) => m.contraparte === "Vida Cámara prueba");

  return (
    <div>
      <button
        type="button"
        onClick={() =>
          agregarMovimiento({
            fecha: "2026-09-25",
            empresa_id: "adap",
            cuenta_id: "a1",
            contraparte: "Vida Cámara prueba",
            glosa: null,
            documento: null,
            monto: -1_800_000,
            moneda: "CLP",
            tipo_cambio: null,
            estado: "proyectado",
            doc_tipo,
            hito: null,
            lineas: [
              { categoria_id: "seguros", subcategoria_id: null, doc_tipo: tipos[0]!, monto: -1_000_000, glosa: "FA1" },
              { categoria_id: "seguros", subcategoria_id: null, doc_tipo: tipos[1]!, monto: -500_000, glosa: "FA2" },
              { categoria_id: "seguros", subcategoria_id: null, doc_tipo: tipos[2]!, monto: -300_000, glosa: "FA3" },
            ],
          } as Omit<Movimiento, "id">)
        }
      >
        crear
      </button>
      <button type="button" onClick={() => mio && aplicarImpuesto(mio.id, "iva")}>
        iva
      </button>
      <span data-testid="iva">
        {mio?.lineas.find((l) => l.categoria_id === SUB_IVA_COMPRAS)?.monto ?? "sin iva"}
      </span>
      <span data-testid="total">{mio?.monto ?? ""}</span>
    </div>
  );
}

const correr = (doc_tipo: DocTipo | null, tipos: (DocTipo | null)[]) => {
  render(
    <ProveedorTesoreria registroInicial={null}>
      <Banco doc_tipo={doc_tipo} tipos={tipos} />
    </ProveedorTesoreria>
  );
  fireEvent.click(screen.getByText("crear"));
  fireEvent.click(screen.getByText("iva"));
  return {
    iva: Number(screen.getByTestId("iva").textContent),
    total: Number(screen.getByTestId("total").textContent),
  };
};

describe("IVA sobre un pago con facturas de distinto tipo", () => {
  it("calcula solo sobre las afectas", () => {
    // 1.000.000 + 500.000 afectas, 300.000 exenta → IVA sobre 1.500.000.
    const { iva, total } = correr(null, ["afecta", "afecta", "exento"]);
    expect(iva).toBe(-285_000);
    // Y el total es la suma real: las tres facturas más el IVA de dos.
    expect(total).toBe(-2_085_000);
  });

  it("sin nada marcado aplica a todas, como venía funcionando", () => {
    // Apretar el botón ya es decir "esto es afecto": no hace falta marcar nada en el
    // caso corriente, que es un documento de un solo tipo.
    const { iva } = correr(null, [null, null, null]);
    expect(iva).toBe(-342_000);
  });

  it("la línea manda sobre el movimiento", () => {
    // El movimiento dice afecta, pero una línea se marcó exenta.
    const { iva } = correr("afecta", [null, null, "exento"]);
    expect(iva).toBe(-285_000);
  });

  it("con el movimiento exento y una línea afecta, cobra solo esa", () => {
    const { iva } = correr("exento", ["afecta", null, null]);
    expect(iva).toBe(-190_000);
  });

  it("recalcular no acumula: reemplaza la línea de IVA", () => {
    render(
      <ProveedorTesoreria registroInicial={null}>
        <Banco doc_tipo={null} tipos={["afecta", "afecta", "exento"]} />
      </ProveedorTesoreria>
    );
    fireEvent.click(screen.getByText("crear"));
    fireEvent.click(screen.getByText("iva"));
    fireEvent.click(screen.getByText("iva"));
    expect(Number(screen.getByTestId("iva").textContent)).toBe(-285_000);
    expect(Number(screen.getByTestId("total").textContent)).toBe(-2_085_000);
  });
});

describe("La fila de un split", () => {
  // Se rompió al agregar el tipo por línea: la fila era un grid de cuatro columnas y
  // con seis controles el monto quedaba aplastado y el aspa caía a la línea de abajo.
  const abrir = () => {
    render(
      <ProveedorTesoreria registroInicial={null}>
        <Registro />
      </ProveedorTesoreria>
    );
    // Se abre el editor de cada movimiento hasta dar con uno que tenga split: los
    // datos de ejemplo tienen varios, pero cuál es el primero depende del orden.
    for (const boton of screen.getAllByTitle("Editar el movimiento")) {
      fireEvent.click(boton);
      if (screen.queryAllByLabelText("Monto de la línea").length > 1) return;
      fireEvent.click(boton);
    }
    throw new Error("ningún movimiento de ejemplo tiene split");
  };

  it("lleva todos sus controles, y el aspa entre ellos", () => {
    abrir();
    const montos = screen.getAllByLabelText("Monto de la línea");
    expect(montos.length).toBeGreaterThan(1);
    // Todos los controles de una línea cuelgan del mismo contenedor: si alguno se
    // fuera a otra fila, dejaría de ser hermano del monto.
    const fila = montos[0]!.parentElement!;
    expect(fila.querySelectorAll("input, select, button").length).toBeGreaterThanOrEqual(4);
    expect(within(fila as HTMLElement).getByTitle(/Eliminar línea|al menos una línea/)).toBeDefined();
  });

  it("el tipo por línea solo aparece en los splits", () => {
    abrir();
    expect(screen.getAllByLabelText("Tipo de documento de la línea").length).toBeGreaterThan(1);
  });
});
