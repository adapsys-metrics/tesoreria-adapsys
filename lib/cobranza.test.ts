import { describe, expect, it } from "vitest";
import { pasoDe } from "./cobranza";
import { CUENTAS } from "./catalogo";
import type { Movimiento } from "./tipos";

const mov = (p: Partial<Movimiento>): Movimiento => ({
  id: "1",
  fecha: "2026-09-19",
  empresa_id: "adap",
  cuenta_id: "x3",
  contraparte: "BANCO ITAÚ",
  glosa: null,
  documento: null,
  monto: 4568898,
  moneda: "CLP",
  tipo_cambio: null,
  estado: "proyectado",
  doc_tipo: null,
  lineas: [],
  ...p,
});

describe("la cadena de cobranza", () => {
  it("un proyecto aprobado se factura y pasa a la cartera, sin cobrarse", () => {
    const paso = pasoDe(mov({ cuenta_id: "x3" }), CUENTAS);
    expect(paso.accion).toBe("facturar");
    if (paso.accion !== "facturar") return;
    expect(paso.destino.id).toBe("x1");
    expect(paso.destino.nombre).toBe("Facturas por cobrar CLP");
  });

  it("respeta la moneda al facturar", () => {
    const paso = pasoDe(mov({ cuenta_id: "x4", moneda: "USD" }), CUENTAS);
    expect(paso.accion === "facturar" && paso.destino.id).toBe("x2");
  });

  it("una factura se cobra a la cuenta de SU empresa, no a la dueña del registro", () => {
    // Las cuentas de cobranza cuelgan de CLA ADAPTACIÓN por tener que colgar de
    // alguna, pero la cartera es de las cuatro: el destino sale del movimiento.
    const paso = pasoDe(mov({ cuenta_id: "x1", empresa_id: "clting" }), CUENTAS);
    expect(paso.accion).toBe("cobrar");
    if (paso.accion !== "cobrar") return;
    expect(paso.destino.id).toBe("c1");
    expect(paso.destino.empresa_id).toBe("clting");
  });

  it("cobra a la cuenta en la moneda del movimiento", () => {
    const paso = pasoDe(mov({ cuenta_id: "x2", empresa_id: "cons", moneda: "USD" }), CUENTAS);
    expect(paso.accion === "cobrar" && paso.destino.id).toBe("b2");
  });

  it("no deja cobrar sin empresa, y dice por qué", () => {
    const paso = pasoDe(mov({ cuenta_id: "x1", empresa_id: null }), CUENTAS);
    expect(paso).toEqual({ accion: "ninguna", motivo: "Asigna la empresa antes de cobrar" });
  });

  it("no deja cobrar si la empresa no opera en esa moneda", () => {
    // CLA CONSULTORIA solo tiene cuenta en pesos.
    const paso = pasoDe(mov({ cuenta_id: "x2", empresa_id: "ctria", moneda: "USD" }), CUENTAS);
    expect(paso).toEqual({ accion: "ninguna", motivo: "Esa empresa no tiene cuenta en USD" });
  });
});

describe("los egresos siguen su propio camino", () => {
  it("un proyectado en una cuenta del banco se marca pagado", () => {
    const paso = pasoDe(mov({ cuenta_id: "a1", monto: -365026 }), CUENTAS);
    expect(paso.accion).toBe("pagar");
  });

  it("una proyección sin cuenta todavía no tiene acción", () => {
    // La provisión GAP IMA: no se sabe de dónde va a salir.
    expect(pasoDe(mov({ cuenta_id: null, empresa_id: null }), CUENTAS).accion).toBe("ninguna");
  });
});

describe("lo que ya ocurrió no se avanza", () => {
  it("un movimiento pagado o conciliado no ofrece acción", () => {
    for (const estado of ["pagado", "conciliado"] as const) {
      expect(pasoDe(mov({ cuenta_id: "x1", estado }), CUENTAS).accion).toBe("ninguna");
      expect(pasoDe(mov({ cuenta_id: "a1", estado }), CUENTAS).accion).toBe("ninguna");
    }
  });
});
