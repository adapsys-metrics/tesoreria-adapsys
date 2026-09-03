import { describe, expect, it } from "vitest";
import {
  claveDeCuenta,
  perteneceAlRegistro,
  saldoDeCuenta,
  totalDeRegistro,
} from "./registros";
import type { Cuenta, Movimiento } from "./tipos";

const CUENTAS: Cuenta[] = [
  { id: "a1", empresa_id: "adap", nombre: "CLA ADAPTACIÓN PESOS", moneda: "CLP", tipo: "banco", saldo_inicial: 74220512, principal: true },
  { id: "a2", empresa_id: "adap", nombre: "CLA ADAPTACIÓN DÓLAR", moneda: "USD", tipo: "banco", saldo_inicial: 507.66, principal: false },
  { id: "x1", empresa_id: "adap", nombre: "Facturas por cobrar CLP", moneda: "CLP", tipo: "cxc", saldo_inicial: 0, principal: false },
];

const mov = (p: Partial<Movimiento>): Movimiento => ({
  id: "1",
  fecha: "2026-08-14",
  empresa_id: "adap",
  cuenta_id: "a1",
  contraparte: null,
  glosa: null,
  documento: null,
  monto: -1000,
  moneda: "CLP",
  tipo_cambio: null,
  estado: "conciliado",
  doc_tipo: null,
  lineas: [],
  ...p,
});

describe("una cuenta bancaria muestra solo lo que pasó por el banco", () => {
  const clave = claveDeCuenta("a1");

  it("incluye conciliado y pagado", () => {
    expect(perteneceAlRegistro(mov({ estado: "conciliado" }), clave, CUENTAS)).toBe(true);
    expect(perteneceAlRegistro(mov({ estado: "pagado" }), clave, CUENTAS)).toBe(true);
  });

  it("deja fuera lo proyectado", () => {
    // Es lo que permite cuadrar contra la cartola. Si se colara un compromiso
    // futuro, el saldo de la pantalla nunca coincidiría con el del banco.
    expect(perteneceAlRegistro(mov({ estado: "proyectado" }), clave, CUENTAS)).toBe(false);
  });

  it("deja fuera lo de otras cuentas", () => {
    expect(perteneceAlRegistro(mov({ cuenta_id: "a2" }), clave, CUENTAS)).toBe(false);
  });
});

describe("una cuenta de cobranza muestra todo lo suyo", () => {
  it("no separa por estado, porque toda la cartera está por entrar", () => {
    const clave = claveDeCuenta("x1");
    const factura = mov({ cuenta_id: "x1", estado: "proyectado", monto: 71449791 });
    expect(perteneceAlRegistro(factura, clave, CUENTAS)).toBe(true);
  });
});

describe("los registros de egresos proyectados", () => {
  it("juntan los proyectados de todas las empresas en su moneda", () => {
    const clp = mov({ estado: "proyectado", cuenta_id: "a1", moneda: "CLP" });
    const usd = mov({ estado: "proyectado", cuenta_id: "a2", moneda: "USD" });
    expect(perteneceAlRegistro(clp, "proy:egresos-clp", CUENTAS)).toBe(true);
    expect(perteneceAlRegistro(usd, "proy:egresos-clp", CUENTAS)).toBe(false);
    expect(perteneceAlRegistro(usd, "proy:egresos-usd", CUENTAS)).toBe(true);
  });

  it("incluyen la provisión que todavía no tiene cuenta", () => {
    // La bolsa "GAP IMA": −100 millones sin sociedad ni cuenta asignada. Dejarla
    // fuera la haría invisible en todas las vistas.
    const bolsa = mov({
      estado: "proyectado",
      empresa_id: null,
      cuenta_id: null,
      monto: -100000000,
    });
    expect(perteneceAlRegistro(bolsa, "proy:egresos-clp", CUENTAS)).toBe(true);
  });

  it("no se llevan las cobranzas, que tienen su propio registro", () => {
    const factura = mov({ cuenta_id: "x1", estado: "proyectado", monto: 71449791 });
    expect(perteneceAlRegistro(factura, "proy:egresos-clp", CUENTAS)).toBe(false);
  });

  it("no se llevan los movimientos que ya ocurrieron", () => {
    expect(perteneceAlRegistro(mov({ estado: "pagado" }), "proy:egresos-clp", CUENTAS)).toBe(false);
  });
});

describe("saldoDeCuenta", () => {
  it("parte del saldo inicial y suma lo que efectivamente se movió", () => {
    // El caso real: CLA ADAPTACIÓN abre en 74.220.512 y hoy está en 75.339.969.
    const saldo = saldoDeCuenta(CUENTAS[0]!, [
      mov({ id: "1", monto: 2000000, estado: "conciliado" }),
      mov({ id: "2", monto: -880543, estado: "pagado" }),
    ]);
    expect(saldo).toBe(74220512 + 2000000 - 880543);
  });

  it("no cuenta lo proyectado: no ha ocurrido", () => {
    const saldo = saldoDeCuenta(CUENTAS[0]!, [
      mov({ monto: -100000000, estado: "proyectado" }),
    ]);
    expect(saldo).toBe(74220512);
  });

  it("ignora los movimientos de otras cuentas", () => {
    const saldo = saldoDeCuenta(CUENTAS[0]!, [mov({ cuenta_id: "a2", monto: -500 })]);
    expect(saldo).toBe(74220512);
  });
});

describe("totalDeRegistro", () => {
  it("suma solo lo que pertenece al registro", () => {
    const movs = [
      mov({ id: "1", estado: "proyectado", monto: -365000 }),
      mov({ id: "2", estado: "proyectado", monto: -90000 }),
      mov({ id: "3", estado: "conciliado", monto: -999999 }),
      mov({ id: "4", estado: "proyectado", cuenta_id: "x1", monto: 71449791 }),
    ];
    expect(totalDeRegistro("proy:egresos-clp", movs, CUENTAS)).toBe(-455000);
    expect(totalDeRegistro(claveDeCuenta("x1"), movs, CUENTAS)).toBe(71449791);
  });
});
