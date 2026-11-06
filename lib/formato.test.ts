import { describe, expect, it } from "vitest";
import { clp, clpK, conMoneda, mag, montoEn, pct, usd } from "./formato";

describe("clp", () => {
  it("punto de miles y menos tipográfico", () => {
    // El menos es U+2212 y no el guión: en monoespaciada el guión queda corto y
    // alto, y en una columna de cifras se lee como un signo distinto.
    expect(clp(1253118)).toBe("1.253.118");
    expect(clp(-306745)).toBe("−306.745");
  });

  it("redondea: en pesos no hay centavos que mostrar", () => {
    expect(clp(1500.4)).toBe("1.500");
    expect(clp(1500.5)).toBe("1.501");
  });
});

describe("usd", () => {
  it("siempre con los dos decimales", () => {
    // Siempre, y no "los que tenga": 4.746 y 4.746,01 en la misma columna no
    // caen alineados y dejan de poder compararse de un vistazo (§8).
    expect(usd(4746)).toBe("4.746,00");
    expect(usd(4746.01)).toBe("4.746,01");
    expect(usd(0)).toBe("0,00");
  });

  it("conserva los centavos en vez de redondearlos", () => {
    // Es el punto de todo esto: la cartola en dólares los trae y el saldo se
    // cuadra contra ella. Redondeando queda una diferencia inexplicable.
    expect(usd(90073.71)).toBe("90.073,71");
    expect(usd(-85327.45)).toBe("−85.327,45");
  });

  it("la suma de float no se cuela en la pantalla", () => {
    // Sumar muchos x,01 da 4746.009999999998. Con dos decimales fijos eso vuelve
    // a leerse como lo que es.
    expect(usd(4746.009999999998)).toBe("4.746,01");
  });
});

describe("montoEn y conMoneda", () => {
  it("el dólar lleva centavos y el peso no", () => {
    expect(montoEn(4746.01, "USD")).toBe("4.746,01");
    expect(montoEn(4746.01, "CLP")).toBe("4.746");
  });

  it("el símbolo va pegado al número", () => {
    expect(conMoneda(4746.01, "USD")).toBe("US$4.746,01");
    expect(conMoneda(-306745, "CLP")).toBe("$−306.745");
  });
});

describe("mag", () => {
  it("sin signo: así se muestran los montos del presupuesto (§4.6)", () => {
    expect(mag(-1253118)).toBe("1.253.118");
    expect(mag(1253118)).toBe("1.253.118");
  });
});

describe("clpK", () => {
  it("abrevia para las celdas angostas", () => {
    expect(clpK(1200000)).toBe("1,2M");
    expect(clpK(340000)).toBe("340k");
    expect(clpK(-1200000)).toBe("−1,2M");
  });

  it("el cero es una raya: un 0 se lee como un dato", () => {
    expect(clpK(0)).toBe("—");
  });
});

describe("pct", () => {
  it("sin ceros de más", () => {
    expect(pct(0.19)).toBe("19%");
    expect(pct(0.1525)).toBe("15,25%");
  });
});
