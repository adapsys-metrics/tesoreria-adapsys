import { describe, expect, it } from "vitest";
import { idLibre, parsearCatalogo, slug } from "@/lib/catalogo-edicion";
import { CATEGORIAS } from "@/lib/catalogo";

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
    // Si la regla cambiara, una categoría creada desde la app tendría un id con
    // otra forma que el resto. Se comprueba contra el catálogo migrado de Quicken.
    const ejemplos = ["Arriendo oficina", "Telefonía e internet", "Retención BHE"];
    for (const nombre of ejemplos) {
      expect(CATEGORIAS.some((s) => s.id === slug(nombre))).toBe(true);
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
  it("lee grupos al margen con categorías indentadas", () => {
    const { grupos, categorias } = parsearCatalogo(
      ["Comercial y marketing", "  Alianzas", "  Marketing digital"].join("\n")
    );
    expect(grupos).toHaveLength(1);
    expect(categorias.map((s) => s.nombre)).toEqual(["Alianzas", "Marketing digital"]);
    expect(categorias[0]!.grupo_id).toBe(grupos[0]!.id);
  });

  it("lee la forma Grupo:Categoría", () => {
    const { grupos, categorias } = parsearCatalogo(
      "Gastos Administración:Arriendos\nGastos Administración:Aseo"
    );
    expect(grupos).toHaveLength(1);
    expect(categorias).toHaveLength(2);
  });

  it("una línea de sección cambia la naturaleza de ahí en adelante", () => {
    const { categorias } = parsearCatalogo(
      ["Gastos de Inversión", "Compra activos", "  Equipos", "Gastos Operativos", "Administración", "  Aseo"].join("\n")
    );
    expect(categorias.find((s) => s.nombre === "Equipos")!.naturaleza).toBe("inversion");
    expect(categorias.find((s) => s.nombre === "Aseo")!.naturaleza).toBe("operativo");
  });

  it("el sufijo manda sobre la sección, para los grupos mixtos (§4.2)", () => {
    const { categorias } = parsearCatalogo(
      ["Gastos Operativos", "Administración", "  Arriendo", "  Equipamiento (inversión)"].join("\n")
    );
    expect(categorias.find((s) => s.nombre === "Arriendo")!.naturaleza).toBe("operativo");
    expect(categorias.find((s) => s.nombre === "Equipamiento")!.naturaleza).toBe("inversion");
  });

  it("la sangría más profunda es el tercer nivel, no otra categoría", () => {
    // Leer la sangría como un sí/no aplastaba el tercer nivel contra el segundo: es
    // exactamente el error que traía la importación desde Quicken (§3.1).
    const { grupos, categorias, subcategorias } = parsearCatalogo(
      ["Gastos Administración", "  Jornadas y eventos", "    Offsite internacional", "  Aseo"].join("\n")
    );
    expect(grupos.map((g) => g.nombre)).toEqual(["Gastos Administración"]);
    expect(categorias.map((c) => c.nombre)).toEqual(["Jornadas y eventos", "Aseo"]);
    expect(subcategorias.map((s) => s.nombre)).toEqual(["Offsite internacional"]);
    expect(subcategorias[0]!.categoria_id).toBe(categorias[0]!.id);
  });

  it("lee la ruta completa con dos puntos", () => {
    const { grupos, categorias, subcategorias } = parsearCatalogo(
      "Gastos Administración:Jornadas y eventos:Offsite internacional"
    );
    expect(grupos).toHaveLength(1);
    expect(categorias.map((c) => c.nombre)).toEqual(["Jornadas y eventos"]);
    expect(subcategorias.map((s) => s.nombre)).toEqual(["Offsite internacional"]);
  });

  it("no se confunde si se mezclan tabuladores y espacios", () => {
    // Viene pegado de otro programa: la mezcla es la norma. Comparando caracteres
    // crudos, un tabulador quedaría por debajo de dos espacios.
    const { categorias, subcategorias } = parsearCatalogo(
      ["Administración", "\tJornadas", "\t  Offsite"].join("\n")
    );
    expect(categorias.map((c) => c.nombre)).toEqual(["Jornadas"]);
    expect(subcategorias.map((s) => s.nombre)).toEqual(["Offsite"]);
  });

  it("la subcategoría no lleva naturaleza propia: la hereda de su categoría", () => {
    const { categorias, subcategorias } = parsearCatalogo(
      ["Gastos de Inversión", "Compra activos", "  Equipos", "    Notebooks"].join("\n")
    );
    expect(categorias.find((c) => c.nombre === "Equipos")!.naturaleza).toBe("inversion");
    expect(subcategorias[0]!.nombre).toBe("Notebooks");
    expect(subcategorias[0]).not.toHaveProperty("naturaleza");
  });

  it("un grupo sin categorías recibe una con su nombre", () => {
    // Se clasifica por categoría (§3): un grupo vacío no se podría usar.
    const { categorias } = parsearCatalogo("Impuestos");
    expect(categorias).toHaveLength(1);
    expect(categorias[0]!.nombre).toBe("Impuestos");
  });

  it("ignora los totales del reporte del que se copió", () => {
    const { grupos } = parsearCatalogo("Administración\n  Aseo\nTotal egresos");
    expect(grupos.map((c) => c.nombre)).toEqual(["Administración"]);
  });

  it("no choca con los ids que ya existen", () => {
    const { categorias } = parsearCatalogo("Administración:Arriendo oficina", new Set(["arriendo-oficina"]));
    expect(categorias[0]!.id).toBe("arriendo-oficina-2");
  });

  it("no repite una categoría listada dos veces", () => {
    const { categorias } = parsearCatalogo("Admin:Aseo\nAdmin:Aseo");
    expect(categorias).toHaveLength(1);
  });

  it("acepta viñetas y líneas en blanco", () => {
    const { categorias } = parsearCatalogo("Admin\n\n  - Aseo\n  • Luz\n");
    expect(categorias.map((s) => s.nombre)).toEqual(["Aseo", "Luz"]);
  });
});
