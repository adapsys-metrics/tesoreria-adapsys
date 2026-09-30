// Con qué estado nace un movimiento que se registra.
//
// Nacía siempre `proyectado`, así que una comisión del banco que ya llegó había que
// anotarla como futura para marcarla pagada enseguida: declarar futuro algo que ya
// pasó, para corregirlo en el paso siguiente.

import { describe, expect, it } from "vitest";
import { estadoInicialDe } from "@/lib/dominio";

const HOY = "2026-09-30";
const banco = { tipo: "banco" };
const cartera = { tipo: "cxc" };

describe("estadoInicialDe", () => {
  it("lo del banco con fecha de hoy ya ocurrió", () => {
    // Es el caso que molestaba: una comisión que aparece en la cartola.
    expect(estadoInicialDe(banco, HOY, HOY)).toBe("conciliado");
  });

  it("lo del banco con fecha pasada también", () => {
    expect(estadoInicialDe(banco, "2026-09-01", HOY)).toBe("conciliado");
  });

  it("va directo a conciliado, sin pasar por pagado", () => {
    // El equipo no usa el estado intermedio (§4.1): se registra porque ya está en la
    // cartola, así que la verificación ocurrió al escribirlo.
    expect(estadoInicialDe(banco, HOY, HOY)).not.toBe("pagado");
  });

  it("lo del banco con fecha futura es un compromiso", () => {
    expect(estadoInicialDe(banco, "2026-10-15", HOY)).toBe("proyectado");
  });

  it("la cartera siempre nace proyectada, aunque la fecha sea pasada", () => {
    // La factura existe desde que se emitió, pero la plata no llegó. Darla por
    // conciliada inflaría el saldo con algo que nadie cobró.
    expect(estadoInicialDe(cartera, "2026-09-01", HOY)).toBe("proyectado");
    expect(estadoInicialDe(cartera, HOY, HOY)).toBe("proyectado");
  });

  it("sin cuenta es proyectado: no hay cartola contra la cual haber ocurrido", () => {
    expect(estadoInicialDe(null, HOY, HOY)).toBe("proyectado");
  });
});
