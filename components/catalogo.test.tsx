// Tests de render (§8): cada vista se monta de verdad, con los paneles
// expandidos. Compilar no basta — el bundler no detecta un identificador
// usado antes de declararse, y eso ya reventó en este proyecto.

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { montar, montarEn, prepararEntorno } from "@/components/pruebas/entorno";
import { ProveedorTesoreria } from "@/components/estado/ProveedorTesoreria";
import { Categorias } from "@/components/categorias/Categorias";
import { Flujo } from "@/components/flujo/Flujo";
import { Registro } from "@/components/movimientos/Registro";
import { Presupuesto } from "@/components/presupuesto/Presupuesto";
import { GRUPOS, CATEGORIAS, SUBCATEGORIAS } from "@/lib/catalogo";

prepararEntorno();

describe("Catálogo", () => {
  it("monta y lista el catálogo completo", () => {
    montar(<Categorias />);
    expect(screen.getByRole("heading", { name: "Catálogo" })).toBeDefined();
    expect(
      screen.getByText(`${GRUPOS.length} grupos · ${CATEGORIAS.length} categorías · ${SUBCATEGORIAS.length} subcategorías`)
    ).toBeDefined();
  });

  it("expande todas los grupos sin romperse", () => {
    // El caso que revienta: 293 categorías con sus selectores, todas a la vez.
    montar(<Categorias />);
    fireEvent.click(screen.getByRole("button", { name: /^Expandir todo$/ }));
    // Las subcategorías también eligen naturaleza desde 0015: una categoría puede
    // tener unas de inversión y otras operativas.
    expect(screen.getAllByLabelText(/^Naturaleza de /).length).toBe(
      CATEGORIAS.length + SUBCATEGORIAS.length
    );
    fireEvent.click(screen.getByRole("button", { name: /^Colapsar todo$/ }));
    expect(screen.queryAllByLabelText(/^Naturaleza de /).length).toBe(0);
  });

  it("buscar deja ver las coincidencias sin tener que expandir", () => {
    montar(<Categorias />);
    fireEvent.change(screen.getByLabelText("Buscar en el catálogo"), {
      target: { value: "arriendo oficina" },
    });
    expect(screen.getByLabelText("Nombre de Arriendo oficina")).toBeDefined();
    expect(screen.queryByLabelText("Nombre de Sueldos")).toBeNull();
  });

  it("renombrar una categoría se ve en el flujo de caja", () => {
    // La prueba de que el catálogo dejó de ser una constante del bundle: si las
    // vistas siguieran leyendo de lib/catalogo.ts, el nombre viejo se quedaría ahí.
    render(
      <ProveedorTesoreria registroInicial={null}>
        <Categorias />
        <Flujo />
      </ProveedorTesoreria>
    );
    fireEvent.change(screen.getByLabelText("Buscar en el catálogo"), {
      target: { value: "Arriendo oficina" },
    });
    fireEvent.change(screen.getByLabelText("Nombre de Arriendo oficina"), {
      target: { value: "Arriendo casa matriz" },
    });
    // Los dos montados a la vez tienen "Expandir todo"; el del flujo es el segundo.
    fireEvent.click(screen.getAllByText("Expandir todo")[1]!);
    expect(screen.getAllByText("Arriendo casa matriz").length).toBeGreaterThan(0);
  });

  it("un grupo con dos naturalezas se marca mixto (§4.2)", () => {
    montar(<Categorias />);
    expect(screen.getAllByText("mixta").length).toBeGreaterThan(0);
  });

  it("marcar todas las categorías de un grupo confirma y dice cuántas toca", () => {
    // Sin confirmación, un clic en A INGRESOS CLIENTES reescribe 193 categorías y no
    // hay deshacer. El texto tiene que decir el número: es lo que frena el error.
    montar(<Categorias />);
    fireEvent.change(
      screen.getByLabelText("Marcar todas las categorías de A INGRESOS CLIENTES con una naturaleza"),
      { target: { value: "inversion" } }
    );
    const confirmar = screen.getByRole("button", { name: /marcar \d+ como inversión/ });
    expect(confirmar).toBeDefined();

    // Cancelar no cambia nada.
    fireEvent.click(screen.getByRole("button", { name: "cancelar" }));
    fireEvent.change(screen.getByLabelText("Buscar en el catálogo"), { target: { value: "AASA" } });
    expect((screen.getByLabelText("Naturaleza de AASA") as HTMLSelectElement).value).toBe("ingreso");
  });

  it("sacar un grupo del control lo mueve fuera del presupuesto", () => {
    render(
      <ProveedorTesoreria registroInicial={null}>
        <Categorias />
        <Presupuesto />
      </ProveedorTesoreria>
    );
    const antes = screen.getAllByRole("button", { name: "fuera" }).length;
    fireEvent.click(screen.getAllByRole("button", { name: "en control" })[0]!);
    expect(screen.getAllByRole("button", { name: "fuera" }).length).toBe(antes + 1);
  });

  it("no deja borrar una categoría con movimientos, y explica qué hacer", () => {
    // Borrarla dejaría huérfanas sus líneas (§3). El aviso tiene que nombrar la
    // salida —desactivarla— o el usuario queda trabado sin saber por qué.
    montar(<Categorias />);
    fireEvent.change(screen.getByLabelText("Buscar en el catálogo"), {
      target: { value: "Arriendo oficina" },
    });
    fireEvent.click(screen.getByLabelText("Borrar Arriendo oficina"));
    expect(screen.getByText(/Márcala inactiva/)).toBeDefined();
    expect(screen.getByLabelText("Nombre de Arriendo oficina")).toBeDefined();
  });

  it("borrar una categoría sin uso pide confirmación en la propia fila", () => {
    montar(<Categorias />);
    fireEvent.click(screen.getAllByRole("button", { name: "+ categoría" })[0]!);
    const nueva = screen.getByLabelText(/^Nombre de la categoría nueva en /);
    fireEvent.change(nueva, { target: { value: "Fletes" } });
    fireEvent.keyDown(nueva, { key: "Enter" });
    fireEvent.change(screen.getByLabelText("Buscar en el catálogo"), {
      target: { value: "Fletes" },
    });

    fireEvent.click(screen.getByLabelText("Borrar Fletes"));
    // Cancelar no borra nada.
    fireEvent.click(screen.getByRole("button", { name: "cancelar" }));
    expect(screen.getByLabelText("Nombre de Fletes")).toBeDefined();

    fireEvent.click(screen.getByLabelText("Borrar Fletes"));
    fireEvent.click(screen.getByLabelText("Confirmar borrar Fletes"));
    expect(screen.queryByLabelText("Nombre de Fletes")).toBeNull();
  });

  it("desactivar una categoría la saca de los selectores, sin tocar lo clasificado", () => {
    render(
      <ProveedorTesoreria registroInicial={null}>
        <Categorias />
        <Registro />
      </ProveedorTesoreria>
    );
    fireEvent.change(screen.getByLabelText("Buscar en el catálogo"), {
      target: { value: "Arriendo oficina" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: "activa" })[0]!);
    expect(screen.getAllByRole("button", { name: "inactiva" }).length).toBeGreaterThan(0);

    // El movimiento que la usaba sigue mostrándola: desactivar no reclasifica.
    fireEvent.click(screen.getAllByLabelText("Categoría")[0]!);
    expect(screen.getByRole("combobox", { name: "Categoría" })).toBeDefined();
  });

  it("crear un grupo lo deja usable de inmediato", () => {
    // Nace con una categoría propia: se clasifica por categoría (§3), así que
    // un grupo vacío no serviría para nada.
    montar(<Categorias />);
    fireEvent.click(screen.getByRole("button", { name: /^\+ grupo$/ }));
    fireEvent.change(screen.getByLabelText("Nombre de el grupo nuevo"), {
      target: { value: "Gastos de mudanza" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Crear" }));

    fireEvent.change(screen.getByLabelText("Buscar en el catálogo"), {
      target: { value: "mudanza" },
    });
    // El grupo y su categoría inicial, ambos con el mismo nombre.
    expect(screen.getAllByLabelText("Nombre de Gastos de mudanza").length).toBe(2);
  });

  it("Escape cancela la creación sin dejar nada a medias", () => {
    montar(<Categorias />);
    fireEvent.click(screen.getByRole("button", { name: /^\+ grupo$/ }));
    const campo = screen.getByLabelText("Nombre de el grupo nuevo");
    fireEvent.change(campo, { target: { value: "Se me ocurrió otra cosa" } });
    fireEvent.keyDown(campo, { key: "Escape" });
    expect(screen.queryByLabelText("Nombre de el grupo nuevo")).toBeNull();
    expect(
      screen.getByText(`${GRUPOS.length} grupos · ${CATEGORIAS.length} categorías · ${SUBCATEGORIAS.length} subcategorías`)
    ).toBeDefined();
  });

  it("agregar una categoría la deja bajo su grupo", () => {
    montar(<Categorias />);
    fireEvent.click(screen.getAllByRole("button", { name: "+ categoría" })[0]!);
    const campo = screen.getByLabelText(/^Nombre de la categoría nueva en /);
    fireEvent.change(campo, { target: { value: "Cliente nuevo SpA" } });
    fireEvent.keyDown(campo, { key: "Enter" });
    expect(
      screen.getByText(`${GRUPOS.length} grupos · ${CATEGORIAS.length + 1} categorías · ${SUBCATEGORIAS.length} subcategorías`)
    ).toBeDefined();
    expect(screen.getByLabelText("Nombre de Cliente nuevo SpA")).toBeDefined();
  });


});

describe("El tercer nivel", () => {
  // Quicken tenía tres niveles y el importador aplastó las tres ramas que lo usaban:
  // dejó "Offsite internacional" como categoría hermana del grupo, cuando cuelga de
  // "Jornadas y eventos organización". El modelo tiene que sostenerlo bien porque van
  // a aparecer más.

  it("las subcategorías cuelgan de su categoría, no del grupo", () => {
    montar(<Categorias />);
    fireEvent.change(screen.getByLabelText("Buscar en el catálogo"), {
      target: { value: "Offsite" },
    });
    // Buscar por el nombre de la subcategoría llega hasta ella, aunque viva un nivel
    // más abajo de lo que se busca.
    expect(screen.getByLabelText("Nombre de Offsite internacional")).toBeDefined();
    expect(screen.getByLabelText("Nombre de Jornadas y eventos organizacion")).toBeDefined();
  });

  it("no aparece como categoría en el flujo de caja", () => {
    // Es lo que estaba mal: salía como línea propia al lado de su madre.
    montar(<Flujo />);
    fireEvent.click(screen.getByText("Expandir todo"));
    expect(screen.queryByText("Offsite internacional")).toBeNull();
  });

  it("se puede crear una subcategoría nueva en cualquier categoría", () => {
    montar(<Categorias />);
    fireEvent.change(screen.getByLabelText("Buscar en el catálogo"), {
      target: { value: "Arriendo oficina" },
    });
    fireEvent.click(screen.getByLabelText("Agregar subcategoría en Arriendo oficina"));
    const campo = screen.getByLabelText("Nombre de la subcategoría nueva en Arriendo oficina");
    fireEvent.change(campo, { target: { value: "Estacionamientos" } });
    fireEvent.keyDown(campo, { key: "Enter" });

    expect(
      screen.getByText(
        `${GRUPOS.length} grupos · ${CATEGORIAS.length} categorías · ${SUBCATEGORIAS.length + 1} subcategorías`
      )
    ).toBeDefined();
  });

  it("borrar una subcategoría no se lleva el gasto, solo el detalle", () => {
    // A diferencia de una categoría, esta sí se puede borrar aunque esté en uso: la
    // línea conserva categoría, monto y glosa.
    montar(<Categorias />);
    fireEvent.change(screen.getByLabelText("Buscar en el catálogo"), {
      target: { value: "Manejador base de datos" },
    });
    fireEvent.click(screen.getByLabelText("Borrar Manejador base de datos"));
    fireEvent.click(screen.getByLabelText("Confirmar borrar Manejador base de datos"));

    expect(screen.queryByLabelText("Nombre de Manejador base de datos")).toBeNull();

    // La categoría madre sigue en pie, con su hermana intacta.
    fireEvent.change(screen.getByLabelText("Buscar en el catálogo"), {
      target: { value: "Analítica avanzada" },
    });
    expect(
      screen.getByLabelText("Nombre de Sistemas Analítica avanzada, IA y Relac.")
    ).toBeDefined();
    expect(screen.getByLabelText("Nombre de Automatización y metrics")).toBeDefined();
  });

  it("el uso abre los movimientos que hay dentro", () => {
    // Es el link azul de la columna USES de Quicken: lo que se necesita mirar justo
    // antes de desactivar algo, para saber si estorba.
    montar(<Categorias />);
    fireEvent.change(screen.getByLabelText("Buscar en el catálogo"), {
      target: { value: "Arriendo oficina" },
    });
    fireEvent.click(screen.getByTitle("Ver los movimientos clasificados acá"));
    const panel = screen.getByRole("dialog");
    expect(within(panel).getAllByLabelText("Categoría").length).toBeGreaterThan(0);
  });

  it("ocultar inactivas las saca de la vista sin desclasificar nada", () => {
    // El "Show All Categories" de Quicken. Con 290 categorías las desactivadas
    // estorban salvo cuando se está limpiando el catálogo.
    montar(<Categorias />);
    fireEvent.change(screen.getByLabelText("Buscar en el catálogo"), {
      target: { value: "Arriendo oficina" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: "activa" })[0]!);
    expect(screen.getByLabelText("Nombre de Arriendo oficina")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Ocultar inactivas" }));
    expect(screen.queryByLabelText("Nombre de Arriendo oficina")).toBeNull();

    // Sigue existiendo: volver a mostrarlas la trae de vuelta, inactiva.
    fireEvent.click(screen.getByRole("button", { name: "Ocultar inactivas" }));
    expect(screen.getAllByRole("button", { name: "inactiva" }).length).toBeGreaterThan(0);
  });



  it("el selector de detalle solo aparece donde hay subcategorías", () => {
    montar(<Registro />);
    // Sin abrir ninguna línea de una categoría con tercer nivel, no hay selector de
    // detalle en ninguna parte: es opcional y no debe ocupar lugar donde no aplica.
    expect(screen.queryByRole("combobox", { name: "Subcategoría" })).toBeNull();
  });
});

describe("Una categoría puede ser mixta", () => {
  // El control presupuestario real tiene subcategorías donde unas son de inversión y
  // otras operativas dentro de la misma categoría. Es la misma regla que ya rige un
  // nivel más arriba (§4.2), ahora un escalón abajo.

  const abrirEn = (busqueda: string) => {
    montar(<Categorias />);
    fireEvent.change(screen.getByLabelText("Buscar en el catálogo"), {
      target: { value: busqueda },
    });
  };

  // El grupo también se marca mixto, así que hay que apuntar a la insignia de la
  // categoría por su título y no por el texto.
  const MIXTA_CATEGORIA = "Tiene subcategorías de más de un tipo. No se elige: aparece sola.";
  const CAT = "Sistemas Analítica avanzada, IA y Relac.";
  // La única del ejemplo con movimientos: sin movimiento no hay fila en el flujo.
  const SUB = "Automatización y metrics";

  it("la subcategoría hereda mientras no se elija otra cosa", () => {
    abrirEn("Automatización");
    const sub = screen.getByLabelText(`Naturaleza de ${SUB}`) as HTMLSelectElement;
    const cat = screen.getByLabelText(`Naturaleza de ${CAT}`) as HTMLSelectElement;
    expect(sub.value).toBe(cat.value);
    expect(sub.title).toMatch(/Hereda/);
  });

  it("marcar una subcategoría de otro tipo deja la categoría mixta", () => {
    // "Mixta" no se elige: aparece sola cuando hay desacuerdo.
    abrirEn("Automatización");
    expect(screen.queryByTitle(MIXTA_CATEGORIA)).toBeNull();
    fireEvent.change(screen.getByLabelText(`Naturaleza de ${SUB}`), {
      target: { value: "inversion" },
    });
    expect(screen.getByTitle(MIXTA_CATEGORIA)).toBeDefined();
    expect(
      (screen.getByLabelText(`Naturaleza de ${SUB}`) as HTMLSelectElement).title
    ).toMatch(/Fijada aparte/);
  });

  it("elegir el tipo en la categoría arrastra a todas hacia abajo", () => {
    abrirEn("Analítica");
    fireEvent.change(screen.getByLabelText(`Naturaleza de ${SUB}`), {
      target: { value: "inversion" },
    });
    expect(screen.getByTitle(MIXTA_CATEGORIA)).toBeDefined();

    fireEvent.change(screen.getByLabelText(`Naturaleza de ${CAT}`), {
      target: { value: "inversion" },
    });
    // Ya no hay desacuerdo: todas quedaron en inversión.
    expect(screen.queryByTitle(MIXTA_CATEGORIA)).toBeNull();
    expect((screen.getByLabelText(`Naturaleza de ${SUB}`) as HTMLSelectElement).value).toBe(
      "inversion"
    );
  });

  it("volver a elegir en la subcategoría el tipo de su categoría la devuelve a heredar", () => {
    // Guardar el valor repetido dejaría de seguir a la madre sin que nadie lo pidiera.
    abrirEn("Automatización");
    const cat = (screen.getByLabelText(`Naturaleza de ${CAT}`) as HTMLSelectElement).value;
    fireEvent.change(screen.getByLabelText(`Naturaleza de ${SUB}`), {
      target: { value: "inversion" },
    });
    fireEvent.change(screen.getByLabelText(`Naturaleza de ${SUB}`), { target: { value: cat } });
    expect(screen.queryByTitle(MIXTA_CATEGORIA)).toBeNull();
    expect(
      (screen.getByLabelText(`Naturaleza de ${SUB}`) as HTMLSelectElement).title
    ).toMatch(/Hereda/);
  });

});
