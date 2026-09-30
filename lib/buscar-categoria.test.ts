import { describe, expect, it, beforeEach } from "vitest";
import { anotarReciente, buscarCategorias, normalizar, recientes } from "@/lib/buscar-categoria";
import { CATEGORIAS, GRUPOS } from "@/lib/catalogo";
import { crearIndices } from "@/lib/catalogo-indices";

const { grupoDe } = crearIndices(GRUPOS, CATEGORIAS);
const buscar = (t: string) => buscarCategorias(CATEGORIAS, grupoDe, t);
const nombres = (t: string) => buscar(t).map((r) => r.categoria.nombre);

describe("normalizar", () => {
  it("saca tildes y mayúsculas: nadie las escribe al buscar", () => {
    expect(normalizar("Telefonía E Internet")).toBe("telefonia e internet");
  });
});

describe("buscarCategorias", () => {
  it("encuentra por una palabra del medio, no solo por el principio", () => {
    // Es lo que el <select> nativo no hacía: "internet" no encontraba nada porque la
    // opción empieza con "Telefonía".
    expect(nombres("internet")).toContain("Telefonía e internet");
  });

  it("encuentra sin tildes", () => {
    expect(nombres("telefonia")).toContain("Telefonía e internet");
  });

  it("busca también por el nombre del grupo", () => {
    // Muchas categorías se recuerdan por dónde viven, no por su nombre exacto.
    const r = buscar("impuestos");
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((x) => x.grupo.nombre.includes("IMPUESTOS"))).toBe(true);
  });

  it("acepta varias palabras en cualquier orden", () => {
    expect(nombres("oficina arriendo")).toContain("Arriendo oficina");
    expect(nombres("arriendo oficina")).toContain("Arriendo oficina");
  });

  it("sin texto devuelve el catálogo, hasta el límite", () => {
    expect(buscar("").length).toBe(40);
  });

  it("no ofrece las inactivas: desactivar sirve justamente para eso", () => {
    const apagada = { ...CATEGORIAS[0]!, activa: false };
    const r = buscarCategorias([apagada], grupoDe, "");
    expect(r).toEqual([]);
  });

  it("no inventa resultados", () => {
    expect(buscar("zzzzz")).toEqual([]);
  });

  it("conserva el orden del catálogo y no lo reordena por relevancia", () => {
    // Un orden que cambia con cada tecla hace fallar el clic.
    const r = buscar("a");
    const posiciones = r.map((x) => CATEGORIAS.findIndex((c) => c.id === x.categoria.id));
    expect([...posiciones]).toEqual([...posiciones].sort((a, b) => a - b));
  });
});

describe("recientes", () => {
  beforeEach(() => window.localStorage.clear());

  it("la última usada queda primera", () => {
    anotarReciente("a");
    anotarReciente("b");
    expect(recientes()[0]).toBe("b");
  });

  it("no se repite al volver a usarla", () => {
    anotarReciente("a");
    anotarReciente("b");
    anotarReciente("a");
    expect(recientes()).toEqual(["a", "b"]);
  });

  it("guarda unas pocas: son un atajo, no un historial", () => {
    for (const id of ["a", "b", "c", "d", "e", "f", "g", "h"]) anotarReciente(id);
    expect(recientes()).toHaveLength(6);
  });

  it("sin nada guardado no se cae", () => {
    expect(recientes()).toEqual([]);
  });

  it("tolera basura en el storage", () => {
    window.localStorage.setItem("tesoreria:categorias-recientes", "{no es json");
    expect(recientes()).toEqual([]);
  });
});
