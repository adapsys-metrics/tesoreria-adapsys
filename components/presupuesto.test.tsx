// Tests de render (§8): cada vista se monta de verdad, con los paneles
// expandidos. Compilar no basta — el bundler no detecta un identificador
// usado antes de declararse, y eso ya reventó en este proyecto.

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { montar, montarEn, prepararEntorno } from "@/components/pruebas/entorno";
import { ProveedorTesoreria } from "@/components/estado/ProveedorTesoreria";
import { Presupuesto } from "@/components/presupuesto/Presupuesto";
import { Flujo } from "@/components/flujo/Flujo";
import { GRUPOS, CATEGORIAS } from "@/lib/catalogo";

prepararEntorno();

/** Generar ya no escribe: abre la vista previa y hay que aplicarla. Los tests que
 *  solo necesitan "el presupuesto cargado" pasan por los dos pasos de una vez. */
const generar = () => {
  fireEvent.click(screen.getByRole("button", { name: /Generar operativo/ }));
  fireEvent.click(screen.getByRole("button", { name: /^Aplicar a/ }));
};

describe("Presupuesto anual", () => {
  it("abre vacío y dice cómo empezar", () => {
    // Sin presupuesto cargado la tabla no tiene filas: sin explicación parecería
    // rota en vez de recién empezada.
    montar(<Presupuesto />);
    expect(screen.getByText("Presupuesto anual")).toBeDefined();
    expect(screen.getByText(/Todavía no hay presupuesto/)).toBeDefined();
  });

  it("generar arma la parte operativa desde los movimientos", () => {
    montar(<Presupuesto />);
    generar();
    expect(screen.queryByText(/Todavía no hay presupuesto/)).toBeNull();
    expect(screen.getByText("Gastos Operativos")).toBeDefined();
    // Aparecen líneas reales del catálogo, no un total suelto.
    expect(screen.getAllByLabelText(/^Presupuesto de /).length).toBeGreaterThan(0);
  });

  it("no presupuesta las líneas de inversión: esas se escriben a mano", () => {
    // La sección de inversión igual aparece, porque hay gasto real en líneas sin
    // presupuestar — y verlo es justamente el punto. Lo que no debe pasar es que
    // generar les invente un presupuesto.
    montar(<Presupuesto />);
    generar();

    const naturalezaDe = new Map(CATEGORIAS.map((s) => [s.nombre, s.naturaleza]));
    const conPresupuesto = screen
      .getAllByLabelText(/^Presupuesto de /)
      .filter((i) => (i as HTMLInputElement).value !== "")
      .map((i) => (i.getAttribute("aria-label") ?? "").replace("Presupuesto de ", ""));

    expect(conPresupuesto.length).toBeGreaterThan(0);
    expect(conPresupuesto.filter((n) => naturalezaDe.get(n) !== "operativo")).toEqual([]);
  });

  it("cambiar el mes de cierre mueve el presupuesto a la fecha", () => {
    montar(<Presupuesto />);
    generar();
    const totalDe = () =>
      Array.from(document.querySelectorAll("tbody tr")).at(-1)?.textContent ?? "";
    const enero = (() => {
      fireEvent.change(screen.getByLabelText("Cierre a"), { target: { value: "1" } });
      return totalDe();
    })();
    fireEvent.change(screen.getByLabelText("Cierre a"), { target: { value: "12" } });
    expect(totalDe()).not.toBe(enero);
  });

  it("el gasto a la fecha abre los movimientos que lo componen", () => {
    // Sin esto no hay forma de contrastar el número contra la realidad: se ve un
    // total y hay que salir a buscar a mano de dónde salió.
    montar(<Presupuesto />);
    generar();

    const montos = screen.getAllByTitle("Ver los movimientos que componen este monto");
    expect(montos.length).toBeGreaterThan(0);
    fireEvent.click(montos[0]!);

    const panel = screen.getByRole("dialog");
    expect(panel).toBeDefined();
    // Trae movimientos de verdad y se pueden reclasificar sin salir de la vista.
    expect(within(panel).getAllByLabelText("Categoría").length).toBeGreaterThan(0);
    expect(panel.textContent).toMatch(/Enero a/);
  });

  it("el detalle suma exactamente lo que dice la celda", () => {
    // La celda y el panel se calculaban distinto: la celda sumaba montos en crudo
    // y el panel convertía los dólares, así que una línea pagada con la tarjeta en
    // dólares mostraba 919.372 en la tabla y 7.009.612 al abrirla.
    montar(<Presupuesto />);
    generar();

    const cifra = (t: string) => Math.abs(Number(t.replace(/[^\d,-]/g, "").replace(",", ".")));

    for (const celda of screen.getAllByTitle("Ver los movimientos que componen este monto")) {
      const enLaTabla = cifra(celda.textContent ?? "");
      fireEvent.click(celda);
      const panel = screen.getByRole("dialog");
      const enElPanel = cifra(within(panel).getByTestId("total-detalle").textContent ?? "");
      expect(enElPanel).toBe(enLaTabla);
      fireEvent.keyDown(document, { key: "Escape" });
    }
  });

  it("el detalle se cierra con Escape", () => {
    montar(<Presupuesto />);
    generar();
    fireEvent.click(screen.getAllByTitle("Ver los movimientos que componen este monto")[0]!);
    expect(screen.queryByRole("dialog")).not.toBeNull();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("no controla impuestos, bancos, inversiones ni socios, pero los muestra", () => {
    // §4.6: se excluyen del control —no son gasto que se decida presupuestar— pero
    // igual salen de la caja, así que van en una banda aparte.
    montar(<Presupuesto />);
    generar();

    expect(screen.getByText("Fuera del control presupuestario")).toBeDefined();

    const sinControl = new Set(
      GRUPOS.filter((c) => !c.controlado).map((c) => c.nombre)
    );
    const nombreDe = new Map(CATEGORIAS.map((s) => [s.nombre, s.grupo_id]));
    const grupoDe = new Map(GRUPOS.map((c) => [c.id, c.nombre]));

    // Ninguna línea presupuestada pertenece a un grupo fuera de control.
    const presupuestadas = screen
      .getAllByLabelText(/^Presupuesto de /)
      .map((i) => (i.getAttribute("aria-label") ?? "").replace("Presupuesto de ", ""));
    const infiltradas = presupuestadas.filter((n) =>
      sinControl.has(grupoDe.get(nombreDe.get(n) ?? "") ?? "")
    );
    expect(infiltradas).toEqual([]);
  });

  it("una línea que gastó todo su presupuesto sigue a la vista y se marca", () => {
    // Es lo que hay que ver venir: a partir de ahí cualquier gasto nuevo ya es
    // sobregasto. Bajarle el presupuesto a 1 fuerza el caso sobre datos reales.
    montar(<Presupuesto />);
    generar();
    const campo = screen.getAllByLabelText(/^Presupuesto de /)[0]!;
    const nombre = (campo.getAttribute("aria-label") ?? "").replace("Presupuesto de ", "");
    fireEvent.blur(campo, { target: { value: "1" } });

    expect(screen.getAllByText("presupuesto agotado").length).toBeGreaterThan(0);
    // Y la línea no desapareció de la tabla.
    expect(screen.getByLabelText(`Presupuesto de ${nombre}`)).toBeDefined();
  });

  it("editar el presupuesto de una línea recalcula su variación", () => {
    montar(<Presupuesto />);
    generar();
    const campo = screen.getAllByLabelText(/^Presupuesto de /)[0]! as HTMLInputElement;
    const antes = campo.value;
    fireEvent.blur(campo, { target: { value: "999.999.999" } });
    expect(
      (screen.getAllByLabelText(/^Presupuesto de /)[0]! as HTMLInputElement).value
    ).not.toBe(antes);
  });
});


describe("Las subcategorías en el presupuesto", () => {
  // "Sistemas Analítica avanzada, IA y R" es la única categoría del ejemplo con
  // tercer nivel: el estado de cuenta de la tarjeta trae Zapier clasificado en
  // "Automatización y metrics" y el resto en la categoría a secas. Es además la
  // línea donde apareció el descuadre que dio origen a todo esto.
  const CATEGORIA = "Sistemas Analítica avanzada, IA y R";
  const SUB = "Automatización y metrics";

  const conPresupuesto = () => {
    montar(<Presupuesto />);
    generar();
  };

  it("la categoría con subcategorías abre en árbol", () => {
    conPresupuesto();
    expect(screen.getByText(CATEGORIA)).toBeDefined();
    expect(screen.getByText(SUB)).toBeDefined();
  });

  it("la subcategoría se presupuesta sola; la categoría ya no", () => {
    // Son las subcategorías las que forman el total de la categoría, así que el
    // número se escribe abajo. Arriba es una suma, y una suma no se edita.
    conPresupuesto();
    expect(screen.getByLabelText(`Presupuesto de ${SUB}`)).toBeDefined();
    expect(screen.queryByLabelText(`Presupuesto de ${CATEGORIA}`)).toBeNull();
  });

  it("lo clasificado sin precisar subcategoría tiene su propia fila", () => {
    // En el histórico existe y es casi todo: una categoría puede tener gasto
    // propio además del de sus hijas. Si no se mostrara, ese gasto quedaría
    // dentro de un total sin línea contra la cual compararlo.
    conPresupuesto();
    expect(screen.getByText("Sin subcategoría")).toBeDefined();
  });

  it("una categoría sin subcategorías sigue siendo una sola fila", () => {
    // La forma de siempre no cambia para las 290 que no tienen tercer nivel.
    conPresupuesto();
    expect(screen.getByLabelText("Presupuesto de Arriendo oficina")).toBeDefined();
  });

  it("el gasto de la subcategoría no se cuenta también en su categoría", () => {
    // Es el bug que esto destapa: agrupando por categoría, el gasto de la hija se
    // sumaba al de la madre y la madre aparecía gastando de más.
    conPresupuesto();
    const fila = (texto: string) =>
      screen.getByText(texto).closest("tr")!.querySelectorAll("td");
    const num = (celda: Element | undefined) =>
      Number((celda?.textContent ?? "0").replace(/\./g, "").replace(/[^\d-]/g, "")) || 0;

    // La columna del gasto a la fecha es la quinta: grupo, responsable,
    // presupuesto, a la fecha, gasto.
    const celdasMadre = fila(CATEGORIA);
    const celdasHija = fila(SUB);
    const celdasPropias = fila("Sin subcategoría");

    const madre = num(celdasMadre[celdasMadre.length - 3]);
    const hija = num(celdasHija[celdasHija.length - 3]);
    const propias = num(celdasPropias[celdasPropias.length - 3]);

    // La madre es exactamente la suma de sus filas, ni más ni menos.
    expect(madre).toBe(hija + propias);
    expect(hija).toBeGreaterThan(0);
  });
});


describe("La vista previa de la generación", () => {
  // Generar reemplaza el presupuesto de cada línea con movimientos en la ventana.
  // Sobre 290 categorías eso es mucho para deshacer a mano si la ventana quedó
  // mal elegida, así que primero se muestra y después se escribe.

  const abrirPrevia = () => {
    montar(<Presupuesto />);
    fireEvent.click(screen.getByRole("button", { name: /Generar operativo/ }));
  };

  it("generar no escribe nada todavía", () => {
    abrirPrevia();
    expect(screen.getByRole("dialog", { name: "Qué va a quedar escrito" })).toBeDefined();
    // Detrás del cuadro, la tabla sigue vacía.
    expect(screen.getByText(/Todavía no hay presupuesto/)).toBeDefined();
  });

  it("muestra qué líneas y cuánto suman", () => {
    abrirPrevia();
    const cuadro = within(screen.getByRole("dialog", { name: "Qué va a quedar escrito" }));
    expect(cuadro.getByText(/líneas? · .* al año/)).toBeDefined();
    expect(cuadro.getAllByRole("row").length).toBeGreaterThan(1);
  });

  it("cancelar deja todo como estaba", () => {
    abrirPrevia();
    fireEvent.click(screen.getByText("Cancelar"));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText(/Todavía no hay presupuesto/)).toBeDefined();
  });

  it("aplicar sí escribe", () => {
    abrirPrevia();
    fireEvent.click(screen.getByRole("button", { name: /^Aplicar a/ }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByText(/Todavía no hay presupuesto/)).toBeNull();
    expect(screen.getAllByLabelText(/^Presupuesto de /).length).toBeGreaterThan(0);
  });

  it("al generar sobre un presupuesto ya cargado avisa cuántas líneas reemplaza", () => {
    // Es lo que daba miedo: apretar y descubrir después que pisó lo que había.
    montar(<Presupuesto />);
    generar();
    fireEvent.click(screen.getByRole("button", { name: /Generar operativo/ }));
    const cuadro = within(screen.getByRole("dialog", { name: "Qué va a quedar escrito" }));
    expect(cuadro.getByText(/ya tenían presupuesto|ya tenía presupuesto/)).toBeDefined();
  });
});
