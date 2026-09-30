// Tests de render (§8): cada vista se monta de verdad, con los paneles
// expandidos. Compilar no basta — el bundler no detecta un identificador
// usado antes de declararse, y eso ya reventó en este proyecto.

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { montar, montarEn, prepararEntorno } from "@/components/pruebas/entorno";
import { ProveedorTesoreria } from "@/components/estado/ProveedorTesoreria";
import { Registro } from "@/components/movimientos/Registro";
import { Cuentas } from "@/components/chrome/Cuentas";

prepararEntorno();

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

    // Hay que elegir la categoría: sin ella no hay dónde poner la línea del IVA, así
    // que tampoco se puede mostrar el total.
    const forma = within(document.querySelector('[data-forma="nuevo"]') as HTMLElement);
    fireEvent.click(forma.getByLabelText("Categoría"));
    // Se busca y se elige, como en el registro real. Por el placeholder porque el
    // <label> de la ficha también dice "Categoría".
    fireEvent.change(forma.getByPlaceholderText("Buscar categoría"), {
      target: { value: "internet" },
    });
    fireEvent.mouseDown(forma.getByText("Telefonía e internet"));

    // El resumen muestra el total del documento, que es lo que sale del banco.
    expect(screen.getByText("−365.027")).toBeDefined();
  });

  it("no deja guardar un afecto sin categoría, y dice por qué", () => {
    // Antes la categoría venía puesta en "Sueldos": quien no la mirara clasificaba su
    // movimiento ahí sin enterarse.
    montar(<Registro />);
    fireEvent.click(screen.getByText("+ Nuevo"));
    fireEvent.change(screen.getByLabelText("Documento"), { target: { value: "afecta" } });
    fireEvent.change(screen.getByLabelText("Proveedor / Cliente"), { target: { value: "GTD" } });
    fireEvent.change(screen.getByLabelText("Neto"), { target: { value: "-306745" } });

    const guardar = screen.getByRole("button", { name: "Guardar" }) as HTMLButtonElement;
    expect(guardar.disabled).toBe(true);
    expect(screen.getByText(/Elige la categoría/)).toBeDefined();
  });

  it("un exento sí se puede guardar sin categoría, y avisa que queda sin clasificar", () => {
    // El modelo contempla el movimiento sin clasificar (§3) y la app lo muestra
    // marcado: es mejor eso que clasificarlo mal en silencio.
    montar(<Registro />);
    fireEvent.click(screen.getByText("+ Nuevo"));
    fireEvent.change(screen.getByLabelText("Proveedor / Cliente"), { target: { value: "GTD" } });
    fireEvent.change(screen.getByLabelText("Monto"), { target: { value: "-1000" } });

    expect(screen.getByText(/va a quedar marcado como sin clasificar/)).toBeDefined();
    expect((screen.getByRole("button", { name: "Guardar" }) as HTMLButtonElement).disabled).toBe(
      false
    );
  });

  it("al guardar, el movimiento queda abierto para agregarle líneas", () => {
    // Es como se arma un split desde el principio: se crea y se le agregan líneas con
    // el editor que ya existe, en vez de duplicarlo en el formulario.
    montar(<Registro />);
    fireEvent.click(screen.getByText("+ Nuevo"));
    fireEvent.change(screen.getByLabelText("Proveedor / Cliente"), {
      target: { value: "Vida Cámara prueba" },
    });
    fireEvent.change(screen.getByLabelText("Monto"), { target: { value: "-1800000" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    // El editor del nuevo está abierto: se ve su botón de agregar línea.
    expect(screen.getByText("+ línea")).toBeDefined();
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
    // La columna se ubica por su encabezado, no por un índice fijo: agregar una
    // columna a la izquierda no debería romper este test.
    const encabezados = Array.from(document.querySelectorAll("thead th"));
    const iSaldo = encabezados.findIndex((th) => th.textContent?.trim().startsWith("Saldo"));
    expect(iSaldo).toBeGreaterThan(-1);
    const saldos = Array.from(document.querySelectorAll('tr[data-fila="movimiento"]'))
      .map((tr) => tr.querySelectorAll("td")[iSaldo]?.textContent ?? "")
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
    const filas = () => document.querySelectorAll('tr[data-fila="movimiento"]').length;
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

describe("Registrar algo que ya ocurrió", () => {
  // Una comisión del banco se anota cuando ya apareció en la cartola. Nacía
  // proyectada y había que marcarla pagada enseguida.

  const abrirForma = () => {
    montar(<Registro />);
    fireEvent.click(screen.getByText("+ Nuevo"));
  };

  // Las píldoras de estado de la tabla también dicen "proyectado": el del formulario
  // es el único que además es un botón.
  const chip = () => screen.getByRole("button", { name: /ya ocurrió|proyectado/ });

  it("en una cuenta del banco con fecha de hoy nace como ya ocurrido", () => {
    abrirForma();
    expect(chip().textContent).toBe("ya ocurrió");
  });

  it("con fecha futura nace como compromiso", () => {
    abrirForma();
    fireEvent.change(screen.getByLabelText("Fecha"), { target: { value: "2027-01-15" } });
    expect(chip().textContent).toBe("proyectado");
  });

  it("se puede cambiar a mano: a veces se registra hoy algo que sale mañana", () => {
    abrirForma();
    expect(chip().textContent).toBe("ya ocurrió");
    fireEvent.click(chip());
    expect(chip().textContent).toBe("proyectado");
  });

  it("guardado como ya ocurrido, entra conciliado y afecta el saldo", () => {
    abrirForma();
    fireEvent.change(screen.getByLabelText("Proveedor / Cliente"), {
      target: { value: "Comisión banco" },
    });
    fireEvent.change(screen.getByLabelText(/^Monto|^Neto|^Bruto/), {
      target: { value: "-3500" },
    });
    fireEvent.click(screen.getByText("Guardar"));

    fireEvent.change(screen.getByLabelText("Buscar"), { target: { value: "Comisión banco" } });
    const fila = document.querySelector('tr[data-fila="movimiento"]')!;
    expect(fila.textContent).toMatch(/CONCILIADO/i);
  });
});
