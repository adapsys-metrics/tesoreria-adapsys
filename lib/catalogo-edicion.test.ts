import { describe, expect, it } from "vitest";
import { idLibre, parsearCatalogo, slug } from "@/lib/catalogo-edicion";
import { SUBCATEGORIAS } from "@/lib/catalogo";

describe("slug", () => {
  it("saca acentos y espacios", () => {
    expect(slug("Gastos Administración")).toBe("gastos-administracion");
    expect(slug("2.3 GASTOS SISTEMAS DIGITALES")).toBe("2-3-gastos-sistemas-digitales");
  });

  it("nunca devuelve vacío", () => {
    // Un nombre de puros símbolos no puede dejar la fila sin clave primaria.
    expect(slug("¿?")).toBe("x");
    expect(slug("")).toBe("x");
  });

  it("reproduce los ids del catálogo real", () => {
    // Si la regla cambiara, una subcategoría creada desde la app tendría un id con
    // otra forma que el resto. Se comprueba contra el catálogo migrado de Quicken.
    const ejemplos = ["Arriendo oficina", "Telefonía e internet", "Retención BHE"];
    for (const nombre of ejemplos) {
      expect(SUBCATEGORIAS.some((s) => s.id === slug(nombre))).toBe(true);
    }
  });
});

describe("idLibre", () => {
  it("no pisa un id existente", () => {
    expect(idLibre("Arriendos", new Set(["arriendos"]))).toBe("arriendos-2");
    expect(idLibre("Arriendos", new Set(["arriendos", "arriendos-2"]))).toBe("arriendos-3");
  });
});

describe("parsearCatalogo", () => {
  it("lee categorías al margen con subcategorías indentadas", () => {
    const { categorias, subcategorias } = parsearCatalogo(
      ["Comercial y marketing", "  Alianzas", "  Marketing digital"].join("\n")
    );
    expect(categorias).toHaveLength(1);
    expect(subcategorias.map((s) => s.nombre)).toEqual(["Alianzas", "Marketing digital"]);
    expect(subcategorias[0]!.categoria_id).toBe(categorias[0]!.id);
  });

  it("lee la forma Categoría:Subcategoría", () => {
    const { categorias, subcategorias } = parsearCatalogo(
      "Gastos Administración:Arriendos\nGastos Administración:Aseo"
    );
    expect(categorias).toHaveLength(1);
    expect(subcategorias).toHaveLength(2);
  });

  it("una línea de sección cambia la naturaleza de ahí en adelante", () => {
    const { subcategorias } = parsearCatalogo(
      ["Gastos de Inversión", "Compra activos", "  Equipos", "Gastos Operativos", "Administración", "  Aseo"].join("\n")
    );
    expect(subcategorias.find((s) => s.nombre === "Equipos")!.naturaleza).toBe("inversion");
    expect(subcategorias.find((s) => s.nombre === "Aseo")!.naturaleza).toBe("operativo");
  });

  it("el sufijo manda sobre la sección, para las categorías mixtas (§4.2)", () => {
    const { subcategorias } = parsearCatalogo(
      ["Gastos Operativos", "Administración", "  Arriendo", "  Equipamiento (inversión)"].join("\n")
    );
    expect(subcategorias.find((s) => s.nombre === "Arriendo")!.naturaleza).toBe("operativo");
    expect(subcategorias.find((s) => s.nombre === "Equipamiento")!.naturaleza).toBe("inversion");
  });

  it("una categoría sin subcategorías recibe una con su nombre", () => {
    // Se clasifica por subcategoría (§3): una categoría vacía no se podría usar.
    const { subcategorias } = parsearCatalogo("Impuestos");
    expect(subcategorias).toHaveLength(1);
    expect(subcategorias[0]!.nombre).toBe("Impuestos");
  });

  it("ignora los totales del reporte del que se copió", () => {
    const { categorias } = parsearCatalogo("Administración\n  Aseo\nTotal egresos");
    expect(categorias.map((c) => c.nombre)).toEqual(["Administración"]);
  });

  it("no choca con los ids que ya existen", () => {
    const { subcategorias } = parsearCatalogo("Administración:Arriendo oficina", new Set(["arriendo-oficina"]));
    expect(subcategorias[0]!.id).toBe("arriendo-oficina-2");
  });

  it("no repite una subcategoría listada dos veces", () => {
    const { subcategorias } = parsearCatalogo("Admin:Aseo\nAdmin:Aseo");
    expect(subcategorias).toHaveLength(1);
  });

  it("acepta viñetas y líneas en blanco", () => {
    const { subcategorias } = parsearCatalogo("Admin\n\n  - Aseo\n  • Luz\n");
    expect(subcategorias.map((s) => s.nombre)).toEqual(["Aseo", "Luz"]);
  });
});
