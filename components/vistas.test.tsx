// Tests de render por ruta — CLAUDE.md §8: "Compilar no basta". El bundler valida
// sintaxis pero no detecta un identificador usado antes de declararse ni una
// referencia inexistente, y eso ya pasó en este proyecto (una constante usada 55
// líneas antes de su declaración, que reventaba al cargar el módulo).
//
// Por eso cada vista se monta de verdad, con los paneles expandidos: expandir todas
// las categorías, abrir el detalle de una celda y abrir un editor de splits.

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { ProveedorTesoreria } from "@/components/estado/ProveedorTesoreria";
import { Flujo } from "@/components/flujo/Flujo";
import { Registro } from "@/components/movimientos/Registro";
import { Encabezado } from "@/components/chrome/Encabezado";
import { Cuentas } from "@/components/chrome/Cuentas";
import { SUBCATEGORIAS } from "@/lib/catalogo";

vi.mock("next/navigation", () => ({
  usePathname: () => "/flujo",
}));

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

const montar = (ui: React.ReactNode) =>
  render(<ProveedorTesoreria>{ui}</ProveedorTesoreria>);

describe("Flujo de caja", () => {
  it("monta y muestra la tabla con sus secciones", () => {
    montar(<Flujo />);
    expect(screen.getByRole("heading", { name: "Flujo de caja" })).toBeDefined();
    // Las tres naturalezas del catálogo (§4.2).
    expect(screen.getByText("Ingresos")).toBeDefined();
    expect(screen.getByText("Gastos Operativos")).toBeDefined();
    expect(screen.getByText("Flujo neto del período")).toBeDefined();
    expect(screen.getByText("Flujo acumulado")).toBeDefined();
  });

  it("expande todas las categorías sin romperse", () => {
    montar(<Flujo />);
    const antes = document.querySelectorAll("tbody tr").length;
    fireEvent.click(screen.getByText("Expandir todo"));
    const despues = document.querySelectorAll("tbody tr").length;
    expect(despues).toBeGreaterThan(antes);
    // El botón cambia de sentido y vuelve a colapsar.
    fireEvent.click(screen.getByText("Colapsar todo"));
    expect(document.querySelectorAll("tbody tr").length).toBe(antes);
  });

  it("abre el detalle de un monto y lista los movimientos que lo componen", () => {
    montar(<Flujo />);
    const clicables = screen.getAllByTitle("Ver el detalle de este monto");
    expect(clicables.length).toBeGreaterThan(0);
    fireEvent.click(clicables[0]!);

    const panel = screen.getByRole("dialog");
    expect(panel).toBeDefined();
    // El panel permite reclasificar ahí mismo: el control existe y al accionarlo
    // aparece la lista completa de subcategorías.
    const selectores = within(panel).getAllByLabelText("Subcategoría");
    expect(selectores.length).toBeGreaterThan(0);
    fireEvent.click(selectores[0]!);
    const abierto = within(panel).getAllByLabelText("Subcategoría")[0]!;
    expect(abierto.tagName).toBe("SELECT");
    // Contra el catálogo, no contra un número fijo: lo que se prueba es que el
    // selector las muestre todas, no cuántas hay.
    expect(abierto.querySelectorAll("option").length).toBe(SUBCATEGORIAS.length);
  });

  it("cierra el detalle con Escape", () => {
    montar(<Flujo />);
    fireEvent.click(screen.getAllByTitle("Ver el detalle de este monto")[0]!);
    expect(screen.queryByRole("dialog")).not.toBeNull();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("cambia de granularidad semanal a mensual", () => {
    montar(<Flujo />);
    fireEvent.click(screen.getByText("Mensual"));
    // Los encabezados pasan a ser meses.
    expect(screen.getByText("sep")).toBeDefined();
  });

  it("aplica los presets de rango", () => {
    montar(<Flujo />);
    for (const preset of ["Año en curso", "Año completo", "Mes actual", "Últimos 12 meses"]) {
      fireEvent.click(screen.getByText(preset));
      expect(screen.getByRole("heading", { name: "Flujo de caja" })).toBeDefined();
    }
  });

  it("avisa que los movimientos en dólares quedan fuera del flujo (§4.5)", () => {
    montar(<Flujo />);
    fireEvent.click(screen.getByText("Año completo"));
    expect(screen.getByText("Fuera del flujo")).toBeDefined();
  });
});

describe("Movimientos", () => {
  it("monta y lista movimientos", () => {
    montar(<Registro />);
    expect(screen.getByRole("heading", { name: "Movimientos" })).toBeDefined();
    expect(document.querySelectorAll("tbody tr").length).toBeGreaterThan(0);
  });

  it("abre el editor de splits con sus líneas y los botones de impuesto", () => {
    montar(<Registro />);
    const botonSplit = screen.getAllByText(/Split · \d+ líneas/)[0]!;
    fireEvent.click(botonSplit);

    // Las líneas del split aparecen con glosa, subcategoría y monto editables.
    expect(screen.getAllByLabelText("Glosa de la línea").length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText("Monto de la línea").length).toBeGreaterThan(0);
    expect(screen.getByText(/\+ IVA/)).toBeDefined();
    expect(screen.getByText(/− Retención/)).toBeDefined();
    expect(screen.getByText("cuadrado")).toBeDefined();
  });

  it("la fila se expande al editor completo del movimiento", () => {
    montar(<Registro />);
    fireEvent.click(screen.getAllByTitle("Editar el movimiento")[0]!);

    // Los campos de cabecera del movimiento, no solo sus líneas.
    expect(screen.getByLabelText("Monto del movimiento")).toBeDefined();
    expect(screen.getByText("Documento")).toBeDefined();
    // "Proveedor / Cliente" aparece dos veces: como columna y como campo del editor.
    expect(screen.getAllByText("Proveedor / Cliente")).toHaveLength(2);
    // Y las líneas siguen estando dentro del mismo editor.
    expect(screen.getAllByLabelText("Monto de la línea").length).toBeGreaterThan(0);
  });

  it("no hay campo de moneda: la determina la cuenta", () => {
    montar(<Registro />);
    fireEvent.click(screen.getAllByTitle("Editar el movimiento")[0]!);
    // La moneda no se elige por movimiento — sale de la cuenta y no cambia nunca.
    expect(screen.queryByText("Moneda")).toBeNull();
    expect(screen.getAllByLabelText("Cuenta").length).toBeGreaterThan(0);
  });

  it("editar la glosa desde el editor se refleja en la fila", () => {
    montar(<Registro />);
    fireEvent.click(screen.getAllByTitle("Editar el movimiento")[0]!);
    const glosas = screen.getAllByText("Glosa");
    expect(glosas.length).toBeGreaterThan(0);

    const campo = screen
      .getAllByRole("textbox")
      .find((i) => (i as HTMLInputElement).value.startsWith("FA3109609"));
    expect(campo).toBeDefined();
    fireEvent.change(campo!, { target: { value: "Glosa corregida" } });
    expect(screen.getAllByDisplayValue("Glosa corregida").length).toBeGreaterThan(0);
  });

  it("mover el movimiento a una cuenta en dólares le pone el TC (§4.5)", () => {
    montar(<Registro />);
    fireEvent.click(screen.getAllByTitle("Editar el movimiento")[0]!);
    // Cambiar de cuenta cambia la moneda: es la misma decisión.
    fireEvent.change(screen.getAllByLabelText("Cuenta")[0]!, { target: { value: "a2" } });
    // El TC aparece y queda seteado: la base no acepta USD sin tipo de cambio.
    const tc = screen.getByLabelText("Tipo de cambio") as HTMLInputElement;
    expect(Number(tc.value)).toBeGreaterThan(0);
  });

  it("cambiar de cuenta arrastra empresa y moneda juntas", () => {
    montar(<Registro />);
    fireEvent.click(screen.getAllByTitle("Editar el movimiento")[0]!);
    // b2 es CLA CONSULTORES DÓLAR: cambia la empresa y la moneda de una vez, así no
    // queda un estado intermedio imposible.
    fireEvent.change(screen.getAllByLabelText("Cuenta")[0]!, { target: { value: "b2" } });
    expect(screen.getByLabelText("Tipo de cambio")).toBeDefined();
    // La fila ahora muestra la cuenta de CONSULTORES en dólares.
    expect((screen.getAllByLabelText("Cuenta")[0]! as HTMLSelectElement).value).toBe("b2");
  });

  it("editar el monto de una línea produce un descuadre visible (§3)", () => {
    montar(<Registro />);
    fireEvent.click(screen.getAllByText(/Split · \d+ líneas/)[0]!);
    const montos = screen.getAllByLabelText("Monto de la línea");
    fireEvent.change(montos[0]!, { target: { value: "1" } });
    // Ya no cuadra, y aparece el botón para empujar la diferencia.
    expect(screen.queryByText("cuadrado")).toBeNull();
    expect(screen.getByText(/^descuadre /)).toBeDefined();
    expect(screen.getByText("Cuadrar diferencia")).toBeDefined();
  });

  it("cuadrar la diferencia la vuelve a dejar en cero", () => {
    montar(<Registro />);
    fireEvent.click(screen.getAllByText(/Split · \d+ líneas/)[0]!);
    fireEvent.change(screen.getAllByLabelText("Monto de la línea")[0]!, {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByText("Cuadrar diferencia"));
    expect(screen.getByText("cuadrado")).toBeDefined();
  });

  it("el pegado masivo agrega líneas (§4.3)", () => {
    montar(<Registro />);
    fireEvent.click(screen.getAllByText(/Split · \d+ líneas/)[0]!);
    const antes = screen.getAllByLabelText("Monto de la línea").length;

    fireEvent.click(screen.getByText("Pegar detalle"));
    fireEvent.change(screen.getByLabelText("Detalle a pegar"), {
      target: { value: "Anthropic Claude   96.400\nUber corporativo   72.100" },
    });
    fireEvent.click(screen.getByText("Crear líneas"));

    expect(screen.getAllByLabelText("Monto de la línea").length).toBe(antes + 2);
  });

  it("marcar pagado saca el movimiento de proyectado (§4.1)", () => {
    montar(<Registro />);
    const botones = screen.getAllByText("Marcar pagado");
    const antes = botones.length;
    fireEvent.click(botones[0]!);
    expect(screen.getAllByText("Marcar pagado").length).toBe(antes - 1);
    expect(screen.getAllByText("Pagado").length).toBeGreaterThan(0);
  });

  it("la búsqueda filtra y el vacío se explica", () => {
    montar(<Registro />);
    fireEvent.change(screen.getByLabelText("Buscar"), { target: { value: "Sueldos" } });
    expect(document.querySelectorAll("tbody tr").length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText("Buscar"), { target: { value: "zzzz-no-existe" } });
    expect(screen.getByText(/No hay movimientos que coincidan/)).toBeDefined();
  });

  it("no esconde las facturas impagas con fecha pasada", () => {
    // GTD es del 14 de agosto y sigue proyectada al 20: filtrar solo por fecha la
    // habría escondido, y es justo la que hay que pagar.
    montar(<Registro />);
    expect(screen.getByText("GTD")).toBeDefined();
  });

  it("desactivar el filtro trae el histórico conciliado", () => {
    montar(<Registro />);
    const antes = document.querySelectorAll("tbody tr").length;
    fireEvent.click(screen.getByLabelText("Solo pendiente y futuro"));
    expect(document.querySelectorAll("tbody tr").length).toBeGreaterThan(antes);
  });

  it("el formulario de alta calcula el IVA antes de guardar", () => {
    montar(<Registro />);
    fireEvent.click(screen.getByText("+ Nuevo"));

    const docs = screen.getByLabelText("Documento") as HTMLSelectElement;
    fireEvent.change(docs, { target: { value: "afecta" } });
    fireEvent.change(screen.getByLabelText("Neto"), { target: { value: "-306745" } });

    // El resumen muestra el total del documento, que es lo que sale del banco.
    expect(screen.getByText("−365.027")).toBeDefined();
  });
});

describe("Chrome", () => {
  it("el encabezado muestra los KPI y la navegación", () => {
    montar(<Encabezado />);
    expect(screen.getByText("Efectivo CLP")).toBeDefined();
    expect(screen.getByText("Comprometido CLP")).toBeDefined();
    expect(screen.getByText("Posición proyectada CLP")).toBeDefined();
    expect(screen.getByText("Saldo USD")).toBeDefined();
  });

  it("el selector de empresas abre y filtra", () => {
    montar(<Encabezado />);
    fireEvent.click(screen.getByText("ADAPSYS"));
    expect(screen.getByText("Empresas relacionadas")).toBeDefined();
    // Los presets están disponibles.
    expect(screen.getByText("Todas")).toBeDefined();
  });

  it("el sidebar muestra los saldos y separa las cuentas en dólares", () => {
    montar(<Cuentas />);
    expect(screen.getByText("Cuentas del banco")).toBeDefined();
    expect(screen.getByText("Por conciliar")).toBeDefined();
    expect(screen.getAllByText(/fuera del flujo/).length).toBeGreaterThan(0);
  });

  it("las proyecciones van en su propio bloque, no mezcladas con el banco", () => {
    // Es la separación que pidió el equipo: en Quicken son registros distintos y
    // así se trabajan. Que en la base sean el mismo movimiento con otro estado es
    // del modelo, no de la pantalla.
    montar(<Cuentas />);
    expect(screen.getByText("Proyecciones")).toBeDefined();
    expect(screen.getByText("Egresos proyectados · CLP")).toBeDefined();
    expect(screen.getByText("Egresos proyectados · USD")).toBeDefined();
    expect(screen.getByText("Facturas por cobrar · CLP")).toBeDefined();
    expect(screen.getByText("Proyectos aprobados · CLP")).toBeDefined();
  });
});

describe("Ordenar la tabla de movimientos", () => {
  const fechas = () =>
    Array.from(document.querySelectorAll("tbody tr td:first-child")).map(
      (td) => td.textContent ?? ""
    );

  it("arranca por fecha ascendente y dos clicks vuelven al inicio", () => {
    montar(<Registro />);
    const inicial = fechas();
    expect(inicial.length).toBeGreaterThan(1);
    expect(
      screen.getByTitle("Ordenar por fecha").closest("th")?.getAttribute("aria-sort")
    ).toBe("ascending");

    fireEvent.click(screen.getByTitle("Ordenar por fecha"));
    expect(fechas()).not.toEqual(inicial);
    fireEvent.click(screen.getByTitle("Ordenar por fecha"));
    expect(fechas()).toEqual(inicial);
  });

  it("hacer click en la misma columna invierte el sentido", () => {
    montar(<Registro />);
    const antes = fechas();
    fireEvent.click(screen.getByTitle("Ordenar por fecha"));
    const despues = fechas();
    expect(despues[0]).toBe(antes[antes.length - 1]);
    expect(
      screen.getByTitle("Ordenar por fecha").closest("th")?.getAttribute("aria-sort")
    ).toBe("descending");
  });

  it("ordenar por otra columna la deja ascendente y suelta la anterior", () => {
    montar(<Registro />);
    fireEvent.click(screen.getByTitle("Ordenar por monto"));
    const th = (t: string) => screen.getByTitle(t).closest("th");
    expect(th("Ordenar por monto")?.getAttribute("aria-sort")).toBe("ascending");
    expect(th("Ordenar por fecha")?.getAttribute("aria-sort")).toBeNull();
  });

  it("ordena por monto de mayor egreso a mayor ingreso", () => {
    montar(<Registro />);
    fireEvent.click(screen.getByTitle("Ordenar por monto"));
    const montos = Array.from(
      document.querySelectorAll("tbody tr td:nth-child(6)")
    ).map((td) => Number((td.textContent ?? "").replace(/[^\d-]/g, "")));
    const soloNumeros = montos.filter((n) => !Number.isNaN(n));
    expect(soloNumeros[0]!).toBeLessThanOrEqual(soloNumeros[soloNumeros.length - 1]!);
  });

  it("la marca de FUTURO desaparece al ordenar por otra cosa", () => {
    // Ordenada por monto, esa marca caería en un lugar arbitrario y afirmaría algo
    // falso sobre lo que viene después.
    montar(<Registro />);
    expect(screen.queryByText("FUTURO")).not.toBeNull();
    fireEvent.click(screen.getByTitle("Ordenar por monto"));
    expect(screen.queryByText("FUTURO")).toBeNull();
  });
});

describe("Entrar a una cuenta desde el sidebar", () => {
  const conSidebar = () =>
    montar(
      <>
        <Cuentas />
        <Registro />
      </>
    );

  it("filtra los movimientos a esa cuenta y lo dice", () => {
    conSidebar();
    const antes = document.querySelectorAll("tbody tr").length;

    fireEvent.click(screen.getByTitle(/Ver los movimientos de CLA CONSULTORES PESOS/));

    expect(screen.getByText(/Viendo solo/)).toBeDefined();
    const despues = document.querySelectorAll("tbody tr").length;
    expect(despues).toBeGreaterThan(0);
    expect(despues).toBeLessThan(antes);
  });

  it("se vuelve a todo con «Ver todo»", () => {
    conSidebar();
    const antes = document.querySelectorAll("tbody tr").length;
    fireEvent.click(screen.getByTitle(/Ver los movimientos de CLA CONSULTORES PESOS/));
    fireEvent.click(screen.getByText("Ver todo"));
    expect(screen.queryByText(/Viendo solo/)).toBeNull();
    expect(document.querySelectorAll("tbody tr").length).toBe(antes);
  });

  it("volver a hacer click en la misma cuenta la deselecciona", () => {
    conSidebar();
    const boton = screen.getByTitle(/Ver los movimientos de CLA CONSULTORES PESOS/);
    fireEvent.click(boton);
    fireEvent.click(screen.getByTitle("Salir de CLA CONSULTORES PESOS"));
    expect(screen.queryByText(/Viendo solo/)).toBeNull();
  });

  it("la cuenta del banco muestra solo lo que pasó por el banco", () => {
    // Es lo que permite cuadrar contra la cartola: un compromiso futuro colado acá
    // haría que el saldo de la pantalla nunca coincidiera con el del banco.
    conSidebar();
    fireEvent.click(screen.getByTitle(/Ver los movimientos de CLA CONSULTORES PESOS/));
    expect(document.querySelectorAll("tbody tr").length).toBeGreaterThan(0);
    // Se mira dentro de la tabla: fuera de ella la palabra aparece en leyendas.
    const cuerpo = within(document.querySelector("tbody")!);
    expect(cuerpo.queryAllByText("proyectado")).toHaveLength(0);
  });

  it("abrir egresos proyectados muestra solo compromisos futuros", () => {
    conSidebar();
    fireEvent.click(screen.getByText("Egresos proyectados · CLP"));
    expect(screen.getByText(/Viendo solo/)).toBeDefined();
    const filas = document.querySelectorAll("tbody tr").length;
    expect(filas).toBeGreaterThan(0);
    const cuerpo = within(document.querySelector("tbody")!);
    expect(cuerpo.queryAllByText("conciliado")).toHaveLength(0);
  });

  it("hacer click en la empresa filtra a esa empresa", () => {
    conSidebar();
    fireEvent.click(screen.getByTitle("Ver solo CLA CONSULTORES"));
    // Queda una sola empresa en el sidebar.
    expect(screen.queryByText("CLA ADAPTACIÓN")).toBeNull();
    expect(screen.getByText("CLA CONSULTORES")).toBeDefined();
  });
});
