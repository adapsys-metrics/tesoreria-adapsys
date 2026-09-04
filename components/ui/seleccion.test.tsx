// La suma de lo seleccionado. Lo que se prueba acá es la regla que la hace confiable:
// el número tiene que corresponder exactamente a las filas marcadas que se ven, porque
// se va a comparar contra una transferencia real.

import { describe, expect, it } from "vitest";
import { totalesPorMoneda } from "@/components/ui/seleccion";

describe("totalesPorMoneda", () => {
  it("suma lo de una misma moneda", () => {
    expect(
      totalesPorMoneda([
        { monto: -5_950_000, moneda: "CLP" },
        { monto: -4_237_500, moneda: "CLP" },
        { monto: -4_237_500, moneda: "CLP" },
        { monto: -5_085_000, moneda: "CLP" },
      ]).get("CLP")
    ).toBe(-19_510_000);
  });

  it("no mezcla monedas ni convierte", () => {
    // Convertir daría un número que no aparece en ninguna cartola: una transferencia
    // ocurre en una moneda, y es contra eso que se está cuadrando (§4.5).
    const t = totalesPorMoneda([
      { monto: -1_000_000, moneda: "CLP" },
      { monto: -2_500, moneda: "USD" },
    ]);
    expect(t.get("CLP")).toBe(-1_000_000);
    expect(t.get("USD")).toBe(-2_500);
    expect(t.size).toBe(2);
  });

  it("sin nada seleccionado no inventa un cero", () => {
    expect(totalesPorMoneda([]).size).toBe(0);
  });
});
