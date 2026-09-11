import { describe, expect, it } from "vitest";
import { digitoVerificador, formatearRut, normalizarRut, rutValido } from "@/lib/rut";

describe("normalizarRut", () => {
  it("deja el formato que pide el portal", () => {
    expect(normalizarRut("76.624.489-0")).toBe("766244890");
    expect(normalizarRut("76624489-0")).toBe("766244890");
    expect(normalizarRut(" 76.624.489 - 0 ")).toBe("766244890");
  });

  it("sube la K, que el portal espera en mayúscula", () => {
    expect(normalizarRut("12.345.670-k")).toBe("12345670K");
  });
});

describe("digitoVerificador", () => {
  it("calcula el dígito", () => {
    // El del ejemplo real de la nómina: Smartbricks Technologies SPA.
    expect(digitoVerificador("76624489")).toBe("0");
  });

  it("devuelve K cuando el resto da 10, y 0 cuando da 11", () => {
    // Los dos casos especiales del módulo 11. Sin ellos el validador rechaza RUT
    // buenos, que es peor que aceptar uno malo: bloquea un pago que sí corresponde.
    expect(digitoVerificador("12345670")).toBe("K");
    expect(digitoVerificador("12345675")).toBe("0");
    expect(digitoVerificador("12345678")).toBe("5");
  });
});

describe("rutValido", () => {
  it("acepta el del archivo tipo", () => {
    expect(rutValido("766244890")).toBe(true);
    expect(rutValido("76.624.489-0")).toBe(true);
  });

  it("rechaza un dígito cambiado, que es el error que de verdad ocurre", () => {
    // El portal rechaza la nómina entera, no la línea mala: hay que atraparlo acá.
    expect(rutValido("766244891")).toBe(false);
    expect(rutValido("76.624.488-0")).toBe(false);
  });

  it("rechaza vacío: un proveedor sin RUT no se puede pagar", () => {
    expect(rutValido("")).toBe(false);
    expect(rutValido("   ")).toBe(false);
  });

  it("rechaza largos imposibles", () => {
    expect(rutValido("1230")).toBe(false);
    expect(rutValido("1234567890123")).toBe(false);
  });

  it("acepta la K como verificador", () => {
    expect(rutValido("12345670K")).toBe(true);
    expect(rutValido("12.345.670-K")).toBe(true);
  });

  it("rechaza la K en el cuerpo, que solo vale como verificador", () => {
    expect(rutValido("7662448K0")).toBe(false);
  });
});

describe("formatearRut", () => {
  it("lo muestra legible, para poder compararlo contra una factura", () => {
    expect(formatearRut("766244890")).toBe("76.624.489-0");
    expect(formatearRut("12345670K")).toBe("12.345.670-K");
  });

  it("no se cae con basura a medio escribir", () => {
    expect(formatearRut("")).toBe("");
    expect(formatearRut("7")).toBe("7");
  });
});
