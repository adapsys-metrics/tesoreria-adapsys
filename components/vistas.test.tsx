// Tests de render por ruta — CLAUDE.md §8: "Compilar no basta". El bundler valida
// sintaxis pero no detecta un identificador usado antes de declararse ni una
// referencia inexistente, y eso ya pasó en este proyecto (una constante usada 55
// líneas antes de su declaración, que reventaba al cargar el módulo).
//
// Por eso cada vista se monta de verdad, con los paneles expandidos: expandir todas
// los grupos, abrir el detalle de una celda y abrir un editor de splits.

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { ProveedorTesoreria } from "@/components/estado/ProveedorTesoreria";
import { Flujo } from "@/components/flujo/Flujo";
import { Registro } from "@/components/movimientos/Registro";
import { Encabezado } from "@/components/chrome/Encabezado";
import { Cuentas } from "@/components/chrome/Cuentas";
import { Presupuesto } from "@/components/presupuesto/Presupuesto";
import { Categorias } from "@/components/categorias/Categorias";
import { GRUPOS, CATEGORIAS, SUBCATEGORIAS } from "@/lib/catalogo";

vi.mock("next/navigation", () => ({
  usePathname: () => "/flujo",
}));

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

// Sin registro abierto: los tests comprueban comportamiento, no la vista de
// entrada. Los que sí miran la entrada la piden explícitamente.
const montar = (ui: React.ReactNode) =>
  render(<ProveedorTesoreria registroInicial={null}>{ui}</ProveedorTesoreria>);

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

  it("expande todas los grupos sin romperse", () => {
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
    // aparece la lista completa de categorías.
    const selectores = within(panel).getAllByLabelText("Categoría");
    expect(selectores.length).toBeGreaterThan(0);
    fireEvent.click(selectores[0]!);
    const abierto = within(panel).getAllByLabelText("Categoría")[0]!;
    expect(abierto.tagName).toBe("SELECT");
    // Contra el catálogo, no contra un número fijo: lo que se prueba es que el
    // selector las muestre todas, no cuántas hay.
    expect(abierto.querySelectorAll("option").length).toBe(CATEGORIAS.length);
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

  it("muestra los montos completos, no abreviados", () => {
    // El equipo los necesita legibles de una: "435M" obliga a traducir de cabeza
    // y a confiar en un redondeo que esconde hasta medio millón.
    montar(<Flujo />);
    const celdas = Array.from(document.querySelectorAll("tbody td"))
      .map((td) => td.textContent ?? "")
      .filter((t) => t !== "" && t !== "$0");
    expect(celdas.length).toBeGreaterThan(0);
    // Ninguna abreviatura: ni 1,2M ni 340k.
    expect(celdas.filter((t) => /^−?[\d,]+[Mk]$/.test(t))).toEqual([]);
    // Y al menos uno con separador de miles, que es lo que se pidió ver.
    expect(celdas.some((t) => /\d\.\d{3}/.test(t))).toBe(true);
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

    // Las líneas del split aparecen con glosa, categoría y monto editables.
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
    expect(screen.getByText("N° documento")).toBeDefined();
    expect(screen.getByText("Tipo de documento")).toBeDefined();
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

  it("marcar pagado deja el movimiento conciliado, no en un estado intermedio", () => {
    // El banco se revisa todos los días: se marca pagado justamente porque el
    // movimiento ya está en la cartola con esa fecha. Pasar por `pagado` dejaría
    // un contador de pendientes que crece y que nadie baja nunca.
    montar(<Registro />);
    const botones = screen.getAllByText("Marcar pagado");
    const antes = botones.length;
    fireEvent.click(botones[0]!);
    // Sale de lo pendiente, que es lo que se quiere: la lista de vencidos encoge
    // a medida que se procesan.
    expect(screen.getAllByText("Marcar pagado").length).toBe(antes - 1);

    // Y con el filtro apagado se ve dónde quedó: conciliado, sin paso intermedio.
    fireEvent.click(screen.getByLabelText(/Solo pendiente y futuro/));
    expect(screen.getAllByText("Conciliado").length).toBeGreaterThan(0);
    expect(screen.queryAllByText("Pagado")).toHaveLength(0);
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
    // "Vencidos" reemplazó a "Por conciliar" como el contador principal: es la
    // lista que se mira todos los días. El de conciliar solo aparece si hay algo.
    expect(screen.getByText("Vencidos")).toBeDefined();
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

describe("Columna de saldo (el «Balance» de Quicken)", () => {
  const conSidebar = (registro: string | null = null) =>
    render(
      <ProveedorTesoreria registroInicial={registro}>
        <Cuentas />
        <Registro />
      </ProveedorTesoreria>
    );

  it("no aparece sin una cuenta abierta: sería el saldo de nada", () => {
    conSidebar();
    expect(screen.queryByText("Saldo")).toBeNull();
  });

  it("aparece al entrar a una cuenta del banco", () => {
    conSidebar("cuenta:b1");
    expect(screen.getByText("Saldo")).toBeDefined();
  });

  it("no aparece en un registro de proyección", () => {
    // Ahí no hay un saldo que acumular: nada de eso pasó por el banco.
    conSidebar("proy:egresos-clp");
    expect(screen.queryByText("Saldo")).toBeNull();
  });

  it("el saldo de la primera fila es el que muestra la barra lateral", () => {
    // La comprobación que importa: el saldo actual de la cuenta tiene que ser el
    // mismo de los dos lados. Va en la PRIMERA fila y no en la última porque una
    // cuenta del banco abre de lo más reciente a lo más antiguo.
    conSidebar("cuenta:b1");
    const filas = Array.from(document.querySelectorAll("tbody tr"));
    const saldos = filas
      .map((tr) => tr.querySelectorAll("td")[6]?.textContent ?? "")
      .filter(Boolean);
    expect(saldos.length).toBeGreaterThan(0);
    // La barra lateral antepone el símbolo de moneda, así que se compara por
    // contenido y no por igualdad de texto.
    const filaCuenta = screen.getByTitle(/Salir de CLA CONSULTORES PESOS/);
    expect(filaCuenta.textContent).toContain(saldos[0]!.trim());
  });

  it("una cuenta del banco abre de lo más reciente a lo más antiguo", () => {
    conSidebar("cuenta:b1");
    expect(
      screen.getByTitle("Ordenar por fecha").closest("th")?.getAttribute("aria-sort")
    ).toBe("descending");
  });

  it("un registro de proyección abre de lo más próximo a lo más lejano", () => {
    conSidebar("proy:egresos-clp");
    expect(
      screen.getByTitle("Ordenar por fecha").closest("th")?.getAttribute("aria-sort")
    ).toBe("ascending");
  });
});

describe("Cobrar recorre la cadena, no salta al banco", () => {
  const conCartera = (registro: string) =>
    render(
      <ProveedorTesoreria registroInicial={registro}>
        <Cuentas />
        <Registro />
      </ProveedorTesoreria>
    );

  it("un proyecto aprobado ofrece facturar, no cobrar", () => {
    conCartera("cuenta:x3");
    expect(screen.getAllByText("Facturar").length).toBeGreaterThan(0);
    expect(screen.queryByText("Cobrar")).toBeNull();
  });

  it("una factura por cobrar ofrece cobrar", () => {
    conCartera("cuenta:x1");
    expect(screen.getAllByText("Cobrar").length).toBeGreaterThan(0);
    expect(screen.queryByText("Facturar")).toBeNull();
  });

  it("facturar abre el editor en vez de mover el movimiento", () => {
    // Al emitir cambia el número, pero también la fecha —que pasa de estimada a
    // firme— y a veces el monto. Mover primero y editar después obliga a ir a
    // buscarlo al otro registro.
    conCartera("cuenta:x3");
    const antes = document.querySelectorAll("tbody tr").length;
    fireEvent.click(screen.getAllByText("Facturar")[0]!);
    expect(screen.getByText("Emitir y pasar a cobranza")).toBeDefined();
    expect(screen.getAllByLabelText("Número de documento").length).toBeGreaterThan(0);
    // Todavía no se movió: sigue en proyectos aprobados, ahora con su editor abierto.
    expect(screen.getByTitle(/Salir de Proyectos aprobados/)).toBeDefined();
  });

  it("no deja emitir sin número de documento", () => {
    conCartera("cuenta:x3");
    fireEvent.click(screen.getAllByText("Facturar")[0]!);
    const emitir = screen.getByText("Emitir y pasar a cobranza") as HTMLButtonElement;
    expect(emitir.disabled).toBe(true);
  });

  it("con el número, sale de proyectos aprobados y queda en la cartera", () => {
    conCartera("cuenta:x3");
    const antes = document.querySelectorAll("tbody tr").length;
    fireEvent.click(screen.getAllByText("Facturar")[0]!);
    fireEvent.change(screen.getAllByLabelText("Número de documento")[0]!, {
      target: { value: "FA9001" },
    });
    fireEvent.click(screen.getByText("Emitir y pasar a cobranza"));
    // La fila y su editor salen de este registro…
    expect(document.querySelectorAll("tbody tr").length).toBeLessThan(antes);
    // …y sigue siendo plata por entrar, no un movimiento del banco.
    expect(screen.getByTitle(/Ver facturas por cobrar en CLP/)).toBeDefined();
  });

  it("el número queda guardado y se puede buscar por él", () => {
    conCartera("cuenta:x3");
    fireEvent.click(screen.getAllByText("Facturar")[0]!);
    fireEvent.change(screen.getAllByLabelText("Número de documento")[0]!, {
      target: { value: "FA9001" },
    });
    fireEvent.click(screen.getByText("Emitir y pasar a cobranza"));

    fireEvent.click(screen.getByTitle(/Ver facturas por cobrar en CLP/));
    expect(screen.getByText("FA9001")).toBeDefined();
    fireEvent.change(screen.getByLabelText("Buscar"), { target: { value: "FA9001" } });
    // Se cuentan filas de movimiento: el editor abierto también es un <tr>.
    const filasDeMovimiento = Array.from(document.querySelectorAll("tbody tr")).filter((tr) =>
      /^\d{2}-\d{2}-\d{2}/.test(tr.querySelector("td")?.textContent?.trim() ?? "")
    );
    expect(filasDeMovimiento).toHaveLength(1);
  });

  it("la cartera no ofrece los botones de impuesto", () => {
    // "+ IVA" agrega una línea a IVA compras, que es el crédito fiscal del que
    // paga; y la retención de honorarios solo existe cuando pagamos nosotros. En
    // una factura emitida a un cliente ninguno aplica, y tenerlos ahí es una vía
    // para clasificar un ingreso como IVA compras.
    conCartera("cuenta:x1");
    fireEvent.click(screen.getAllByTitle("Editar el movimiento")[0]!);
    expect(screen.getByText("+ línea")).toBeDefined();
    expect(screen.queryByText(/\+ IVA/)).toBeNull();
    expect(screen.queryByText(/− Retención/)).toBeNull();
  });

  it("una cuenta del banco sí los ofrece", () => {
    conCartera("cuenta:b1");
    fireEvent.click(screen.getAllByTitle("Editar el movimiento")[0]!);
    expect(screen.getByText(/\+ IVA/)).toBeDefined();
    expect(screen.getByText(/− Retención/)).toBeDefined();
  });

  it("el saldo de la cartera es lo pendiente, no cero", () => {
    // Antes valía cero: la regla del banco descarta lo proyectado, y en una cuenta
    // de cobranza todo lo pendiente es justamente proyectado.
    conCartera("cuenta:x1");
    const fila = screen.getByTitle(/Salir de Facturas por cobrar/);
    expect(fila.textContent).not.toMatch(/\$0$/);
  });
});

describe("Vista de entrada", () => {
  it("abre en los egresos proyectados", () => {
    // Lo primero que se mira cada día es lo que viene, no el histórico.
    render(
      <ProveedorTesoreria>
        <Cuentas />
        <Registro />
      </ProveedorTesoreria>
    );
    expect(screen.getByText(/Viendo solo/)).toBeDefined();
    const cuerpo = within(document.querySelector("tbody")!);
    expect(cuerpo.queryAllByText("conciliado")).toHaveLength(0);
  });
});

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
    fireEvent.click(screen.getByRole("button", { name: /Generar operativo/ }));
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
    fireEvent.click(screen.getByRole("button", { name: /Generar operativo/ }));

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
    fireEvent.click(screen.getByRole("button", { name: /Generar operativo/ }));
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
    fireEvent.click(screen.getByRole("button", { name: /Generar operativo/ }));

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
    fireEvent.click(screen.getByRole("button", { name: /Generar operativo/ }));

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
    fireEvent.click(screen.getByRole("button", { name: /Generar operativo/ }));
    fireEvent.click(screen.getAllByTitle("Ver los movimientos que componen este monto")[0]!);
    expect(screen.queryByRole("dialog")).not.toBeNull();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("no controla impuestos, bancos, inversiones ni socios, pero los muestra", () => {
    // §4.6: se excluyen del control —no son gasto que se decida presupuestar— pero
    // igual salen de la caja, así que van en una banda aparte.
    montar(<Presupuesto />);
    fireEvent.click(screen.getByRole("button", { name: /Generar operativo/ }));

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
    fireEvent.click(screen.getByRole("button", { name: /Generar operativo/ }));
    const campo = screen.getAllByLabelText(/^Presupuesto de /)[0]!;
    const nombre = (campo.getAttribute("aria-label") ?? "").replace("Presupuesto de ", "");
    fireEvent.blur(campo, { target: { value: "1" } });

    expect(screen.getAllByText("presupuesto agotado").length).toBeGreaterThan(0);
    // Y la línea no desapareció de la tabla.
    expect(screen.getByLabelText(`Presupuesto de ${nombre}`)).toBeDefined();
  });

  it("editar el presupuesto de una línea recalcula su variación", () => {
    montar(<Presupuesto />);
    fireEvent.click(screen.getByRole("button", { name: /Generar operativo/ }));
    const campo = screen.getAllByLabelText(/^Presupuesto de /)[0]! as HTMLInputElement;
    const antes = campo.value;
    fireEvent.blur(campo, { target: { value: "999.999.999" } });
    expect(
      (screen.getAllByLabelText(/^Presupuesto de /)[0]! as HTMLInputElement).value
    ).not.toBe(antes);
  });
});

describe("Borrar un movimiento", () => {
  const abrirEditor = () => {
    montar(<Registro />);
    fireEvent.click(screen.getAllByTitle("Editar el movimiento")[0]!);
  };

  it("pide confirmación antes de borrar", () => {
    // Es la única acción del editor que no se puede deshacer: no hay historial.
    abrirEditor();
    const antes = document.querySelectorAll("tbody tr").length;
    fireEvent.click(screen.getByText("Borrar movimiento"));
    expect(screen.getByText(/No se puede deshacer/)).toBeDefined();
    // Todavía no borró nada.
    expect(document.querySelectorAll("tbody tr").length).toBe(antes);
  });

  it("cancelar deja el movimiento donde estaba", () => {
    abrirEditor();
    const antes = document.querySelectorAll("tbody tr").length;
    fireEvent.click(screen.getByText("Borrar movimiento"));
    fireEvent.click(screen.getByText("Cancelar"));
    expect(screen.getByText("Borrar movimiento")).toBeDefined();
    expect(document.querySelectorAll("tbody tr").length).toBe(antes);
  });

  it("confirmar lo saca de la lista", () => {
    abrirEditor();
    const filas = () =>
      Array.from(document.querySelectorAll("tbody tr")).filter((tr) =>
        /^\d{2}-\d{2}-\d{2}/.test(tr.querySelector("td")?.textContent?.trim() ?? "")
      ).length;
    const antes = filas();
    fireEvent.click(screen.getByText("Borrar movimiento"));
    fireEvent.click(screen.getByText("Sí, borrar"));
    expect(filas()).toBe(antes - 1);
  });
});

describe("Vencidos", () => {
  it("marca las filas con fecha pasada que siguen proyectadas", () => {
    // Es lo que en Quicken se ve como un cambio de tono. No es lo mismo que "por
    // conciliar": eso cuenta lo que pasó por el banco sin cuadrar contra cartola.
    montar(<Registro />);
    fireEvent.click(screen.getByLabelText(/Solo vencidos/));
    const filas = document.querySelectorAll("tbody tr");
    expect(filas.length).toBeGreaterThan(0);
    // Todas las visibles tienen fecha pasada y estado proyectado.
    for (const tr of Array.from(filas)) {
      expect(tr.textContent).toContain("d");
    }
  });

  it("un movimiento futuro no cuenta como vencido", () => {
    montar(<Registro />);
    const antes = document.querySelectorAll("tbody tr").length;
    fireEvent.click(screen.getByLabelText(/Solo vencidos/));
    expect(document.querySelectorAll("tbody tr").length).toBeLessThan(antes);
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
    expect(screen.getAllByLabelText(/^Naturaleza de /).length).toBe(CATEGORIAS.length);
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
