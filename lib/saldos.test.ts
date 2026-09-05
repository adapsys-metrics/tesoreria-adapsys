import { describe, expect, it } from "vitest";
import { saldosCorrientes } from "./saldos";
import type { Cuenta, Movimiento } from "./tipos";

const A1: Cuenta = {
  id: "a1",
  empresa_id: "adap",
  nombre: "CLA ADAPTACIÓN PESOS",
  moneda: "CLP",
  tipo: "banco",
  saldo_inicial: 74220512,
  principal: true,
};

const mov = (p: Partial<Movimiento> & { id: string }): Movimiento => ({
  fecha: "2026-08-14",
  empresa_id: "adap",
  cuenta_id: "a1",
  contraparte: null,
  glosa: null,
  documento: null,
  monto: 0,
  moneda: "CLP",
  tipo_cambio: null,
  estado: "conciliado",
  doc_tipo: null,
  hito: null,
  lineas: [],
  ...p,
});

describe("saldosCorrientes", () => {
  it("acumula desde el saldo inicial en orden cronológico", () => {
    const saldos = saldosCorrientes(A1, [
      mov({ id: "2", fecha: "2026-02-01", monto: -220512 }),
      mov({ id: "1", fecha: "2026-01-01", monto: 1000000 }),
    ]);
    expect(saldos.get("1")).toBe(75220512);
    expect(saldos.get("2")).toBe(75000000);
  });

  it("acumula por fecha y no por el orden en que llegan", () => {
    // La tabla puede estar ordenada por monto o por proveedor; el saldo se acumula
    // en el tiempo igual.
    const desordenados = [
      mov({ id: "c", fecha: "2026-03-01", monto: -1000 }),
      mov({ id: "a", fecha: "2026-01-01", monto: -1000 }),
      mov({ id: "b", fecha: "2026-02-01", monto: -1000 }),
    ];
    const saldos = saldosCorrientes(A1, desordenados);
    expect(saldos.get("a")).toBe(74219512);
    expect(saldos.get("b")).toBe(74218512);
    expect(saldos.get("c")).toBe(74217512);
  });

  it("ignora los movimientos de otras cuentas", () => {
    const saldos = saldosCorrientes(A1, [
      mov({ id: "propio", monto: -1000 }),
      mov({ id: "ajeno", cuenta_id: "b1", monto: -99999999 }),
    ]);
    expect(saldos.get("propio")).toBe(74219512);
    expect(saldos.has("ajeno")).toBe(false);
  });

  it("no mueve el saldo con los proyectados, pero les asigna el vigente", () => {
    // Sin entrada en el mapa la columna quedaría en blanco a media lista, como si
    // faltara el dato. Lo que dice es "hasta acá el saldo sigue siendo este".
    const saldos = saldosCorrientes(A1, [
      mov({ id: "pagado", fecha: "2026-01-01", monto: -220512 }),
      mov({ id: "futuro", fecha: "2026-09-01", monto: -50000000, estado: "proyectado" }),
      mov({ id: "despues", fecha: "2026-10-01", monto: -1000000, estado: "pagado" }),
    ]);
    expect(saldos.get("pagado")).toBe(74000000);
    expect(saldos.get("futuro")).toBe(74000000);
    expect(saldos.get("despues")).toBe(73000000);
  });

  it("el último saldo es el saldo actual de la cuenta", () => {
    // Es la comprobación que importa: recorrer el registro tiene que terminar en el
    // mismo número que muestra la barra lateral y que dice el banco.
    const movs = [
      mov({ id: "1", fecha: "2026-01-05", monto: 3000000 }),
      mov({ id: "2", fecha: "2026-04-11", monto: -1880543 }),
      mov({ id: "3", fecha: "2026-08-14", monto: -365026, estado: "pagado" }),
    ];
    const saldos = saldosCorrientes(A1, movs);
    const total = movs.reduce((s, m) => s + m.monto, A1.saldo_inicial);
    expect(saldos.get("3")).toBe(total);
  });

  it("devuelve el mapa vacío si la cuenta no tiene movimientos", () => {
    expect(saldosCorrientes(A1, []).size).toBe(0);
  });
});
