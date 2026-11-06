import { describe, expect, it } from "vitest";
import { montoDeTexto } from "./EntradaMonto";

describe("montoDeTexto", () => {
  it("lee un número común", () => {
    expect(montoDeTexto("306745")).toBe(306745);
    expect(montoDeTexto("20658.67")).toBe(20658.67);
  });

  it("lee el negativo, que es el caso que estaba roto", () => {
    // Con `<input type="number">` el menos solo devolvía "" y se guardaba 0: el
    // campo se redibujaba y el signo desaparecía antes del primer dígito.
    expect(montoDeTexto("-306745")).toBe(-306745);
    expect(montoDeTexto("-5194.42")).toBe(-5194.42);
  });

  it("un texto a medio escribir no es un monto todavía", () => {
    // null y no 0: es la diferencia entre un campo en curso y un monto de cero.
    // Devolver 0 es lo que borraba lo anterior tecla por tecla.
    expect(montoDeTexto("")).toBeNull();
    expect(montoDeTexto("-")).toBeNull();
    expect(montoDeTexto("   ")).toBeNull();
  });

  it("pero un número a medio escribir sí: el punto final no estorba", () => {
    expect(montoDeTexto("-5194.")).toBe(-5194);
    expect(montoDeTexto(".5")).toBe(0.5);
  });

  it("la coma vale como decimal, que es como se escribe en Chile", () => {
    expect(montoDeTexto("20658,67")).toBe(20658.67);
    expect(montoDeTexto("-5194,42")).toBe(-5194.42);
  });

  it("con los dos separadores manda el último: ese es el decimal", () => {
    // "90.075,23" pegado de una cartola chilena y "1,234.56" de algo en inglés.
    // Sin el desempate, quitar el punto a ciegas haría de 20.658,67 → 2.065.867.
    expect(montoDeTexto("90.075,23")).toBe(90075.23);
    expect(montoDeTexto("1.253.118,00")).toBe(1253118);
    expect(montoDeTexto("1,234.56")).toBe(1234.56);
  });

  it("lo que no es un número no se guarda", () => {
    expect(montoDeTexto("abc")).toBeNull();
    expect(montoDeTexto("12 34")).toBeNull();
    expect(montoDeTexto("$306.745")).toBeNull();
  });
});
