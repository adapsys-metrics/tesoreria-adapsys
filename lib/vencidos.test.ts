import { describe, expect, it } from "vitest";
import { contarVencidos, diasDeAtraso, estaVencido, totalVencido } from "./vencidos";
import type { Movimiento } from "./tipos";

const HOY = "2026-09-03";

const mov = (p: Partial<Movimiento>): Movimiento => ({
  id: "1",
  fecha: "2026-08-14",
  empresa_id: "adap",
  cuenta_id: "a1",
  contraparte: null,
  glosa: null,
  documento: null,
  monto: -365026,
  moneda: "CLP",
  tipo_cambio: null,
  estado: "proyectado",
  doc_tipo: null,
  hito: null,
  lineas: [],
  ...p,
});

describe("estaVencido", () => {
  it("lo es si la fecha pasó y sigue proyectado", () => {
    expect(estaVencido(mov({ fecha: "2026-08-14" }), HOY)).toBe(true);
  });

  it("no lo es si todavía no llega la fecha", () => {
    expect(estaVencido(mov({ fecha: "2026-09-20" }), HOY)).toBe(false);
  });

  it("lo de hoy no está vencido", () => {
    // Un compromiso de hoy todavía puede cumplirse hoy.
    expect(estaVencido(mov({ fecha: HOY }), HOY)).toBe(false);
  });

  it("no lo es si ya ocurrió, por vieja que sea la fecha", () => {
    // Acá está la diferencia con "por conciliar": un pagado de 2020 no está
    // vencido, está pendiente de cuadrar contra la cartola. Son dos listas.
    expect(estaVencido(mov({ fecha: "2020-01-01", estado: "pagado" }), HOY)).toBe(false);
    expect(estaVencido(mov({ fecha: "2020-01-01", estado: "conciliado" }), HOY)).toBe(false);
  });
});

describe("diasDeAtraso", () => {
  it("cuenta los días corridos", () => {
    expect(diasDeAtraso("2026-08-14", HOY)).toBe(20);
    expect(diasDeAtraso("2026-09-02", HOY)).toBe(1);
    expect(diasDeAtraso(HOY, HOY)).toBe(0);
  });

  it("cruza meses y años sin desviarse", () => {
    expect(diasDeAtraso("2025-12-31", "2026-01-01")).toBe(1);
    expect(diasDeAtraso("2026-02-28", "2026-03-01")).toBe(1);
  });

  it("no se corre un día por la zona horaria", () => {
    // Con `new Date("2026-09-01")` y la zona de Chile, el día 1 a medianoche UTC
    // es el 31 de agosto local: el atraso salía uno de más.
    expect(diasDeAtraso("2026-09-01", "2026-09-03")).toBe(2);
  });
});

describe("contarVencidos y totalVencido", () => {
  const movs = [
    mov({ id: "1", fecha: "2026-08-01", monto: -100000 }),
    mov({ id: "2", fecha: "2026-08-20", monto: -50000 }),
    mov({ id: "3", fecha: "2026-12-01", monto: -900000 }),
    mov({ id: "4", fecha: "2026-01-01", monto: -700000, estado: "conciliado" }),
    mov({ id: "5", fecha: "2026-08-05", monto: -80, moneda: "USD", cuenta_id: "a2" }),
  ];

  it("cuenta solo los vencidos, en cualquier moneda", () => {
    expect(contarVencidos(movs, HOY)).toBe(3);
  });

  it("suma solo los de pesos: los dólares no se convierten (§4.5)", () => {
    expect(totalVencido(movs, HOY)).toBe(-150000);
  });

  it("sin vencidos da cero y no null", () => {
    expect(contarVencidos([], HOY)).toBe(0);
    expect(totalVencido([], HOY)).toBe(0);
  });
});
