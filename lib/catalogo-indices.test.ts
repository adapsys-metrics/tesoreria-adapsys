// La naturaleza puede vivir en la subcategoría (§4.2). Lo que se prueba acá es la
// regla que decide de qué lado cae cada peso, que es de donde cuelgan el flujo, el
// presupuesto y los reportes.

import { describe, expect, it } from "vitest";
import { crearIndices } from "@/lib/catalogo-indices";
import type { Categoria, Grupo, Subcategoria } from "@/lib/tipos";

const GRUPO: Grupo = { id: "g", nombre: "GASTOS", orden: 1, controlado: true };
const CAT: Categoria = {
  id: "equipamiento",
  grupo_id: "g",
  nombre: "Equipamiento oficina",
  naturaleza: "operativo",
  activa: true,
};
const sub = (id: string, naturaleza: Subcategoria["naturaleza"]): Subcategoria => ({
  id,
  categoria_id: "equipamiento",
  nombre: id,
  naturaleza,
  activa: true,
});

const indices = (...subs: Subcategoria[]) => crearIndices([GRUPO], [CAT], subs);

describe("naturalezaDe", () => {
  it("una línea sin subcategoría toma la de su categoría", () => {
    // Es el caso del 99,9% del histórico: 15.649 líneas de dos niveles contra 21 de
    // tres. Si esto no estuviera definido, marcar una categoría como mixta dejaría sin
    // clasificar seis años de datos.
    expect(indices().naturalezaDe("equipamiento")).toBe("operativo");
    expect(indices().naturalezaDe("equipamiento", null)).toBe("operativo");
  });

  it("una subcategoría que hereda no cambia nada", () => {
    expect(indices(sub("sillas", null)).naturalezaDe("equipamiento", "sillas")).toBe("operativo");
  });

  it("una subcategoría fijada manda sobre su categoría", () => {
    const i = indices(sub("notebooks", "inversion"));
    expect(i.naturalezaDe("equipamiento", "notebooks")).toBe("inversion");
    // Y la categoría sigue siendo operativa para lo demás.
    expect(i.naturalezaDe("equipamiento")).toBe("operativo");
  });

  it("no se cae con una categoría que ya no existe", () => {
    // Pasa al reclasificar el catálogo (§11). Cae en operativo, que es donde caen los
    // gastos: no infla ni los ingresos ni la inversión.
    expect(indices().naturalezaDe("ya-no-existe")).toBe("operativo");
    expect(indices().naturalezaDe(null)).toBe("operativo");
  });
});

describe("esMixta", () => {
  it("sin subcategorías nunca es mixta", () => {
    expect(indices().esMixta("equipamiento")).toBe(false);
  });

  it("con todas heredando tampoco", () => {
    expect(indices(sub("sillas", null), sub("mesas", null)).esMixta("equipamiento")).toBe(false);
  });

  it("es mixta cuando alguna difiere", () => {
    expect(indices(sub("sillas", null), sub("notebooks", "inversion")).esMixta("equipamiento")).toBe(
      true
    );
  });

  it("no es mixta si todas se fijaron en la misma que su categoría", () => {
    // Fijar el mismo valor no es un desacuerdo: mixta significa que hay dos tipos.
    expect(indices(sub("sillas", "operativo")).esMixta("equipamiento")).toBe(false);
  });
});

describe("clavesDe", () => {
  it("una categoría simple aporta una sola clave, la suya", () => {
    expect(indices().clavesDe("equipamiento", "operativo")).toEqual(["equipamiento"]);
    expect(indices().clavesDe("equipamiento", "inversion")).toEqual([]);
  });

  it("una categoría mixta se parte entre las dos secciones", () => {
    // Es la consecuencia que importa: la misma categoría aparece en Inversión y en
    // Operativos, cada vez sumando solo lo suyo.
    const i = indices(sub("sillas", null), sub("notebooks", "inversion"));
    expect(i.clavesDe("equipamiento", "operativo")).toEqual([
      "equipamiento",
      "equipamiento>sillas",
    ]);
    expect(i.clavesDe("equipamiento", "inversion")).toEqual(["equipamiento>notebooks"]);
  });

  it("lo clasificado sin subcategoría se queda del lado de la categoría", () => {
    const i = indices(sub("notebooks", "inversion"));
    expect(i.clavesDe("equipamiento", "operativo")).toContain("equipamiento");
  });
});

describe("claveDe", () => {
  it("usa la categoría cuando no hay subcategoría", () => {
    expect(indices().claveDe("equipamiento")).toBe("equipamiento");
    expect(indices().claveDe("equipamiento", null)).toBe("equipamiento");
  });

  it("usa el par cuando la hay, para poder separarlas al agregar", () => {
    expect(indices().claveDe("equipamiento", "notebooks")).toBe("equipamiento>notebooks");
  });

  it("lo que no tiene categoría cae en una clave propia y no se pierde", () => {
    expect(indices().claveDe(null)).toBe("__sin_clasificar");
  });
});
