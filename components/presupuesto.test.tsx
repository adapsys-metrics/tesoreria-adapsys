// Tests de render (§8): cada vista se monta de verdad, con los paneles
// expandidos. Compilar no basta — el bundler no detecta un identificador
// usado antes de declararse, y eso ya reventó en este proyecto.

import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { montar, prepararEntorno } from "@/components/pruebas/entorno";
import { ProveedorTesoreria } from "@/components/estado/ProveedorTesoreria";
import { Presupuesto } from "@/components/presupuesto/Presupuesto";
import { Categorias } from "@/components/categorias/Categorias";
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


describe("El cuadro de generar", () => {
  it("el botón dice a qué año escribe", () => {
    // Parado en 2026 y queriendo armar 2027, un botón sin año no delata el error:
    // se aprieta, se aplica, y recién después se ve dónde quedó.
    montar(<Presupuesto />);
    expect(screen.getByRole("button", { name: /Generar operativo 2026/ })).toBeDefined();
    fireEvent.change(screen.getByLabelText("Año"), { target: { value: "2027" } });
    expect(screen.getByRole("button", { name: /Generar operativo 2027/ })).toBeDefined();
  });

  it("la ventana se pide por mes, no por día", () => {
    // Un rango del 7 al 7 partiría dos meses al medio y generaría un presupuesto
    // mensual a la mitad: un número creíble y mal. Con el selector de mes no se
    // puede escribir.
    montar(<Presupuesto />);
    const desde = screen.getByLabelText("Desde qué mes se toma la base");
    expect(desde.getAttribute("type")).toBe("month");
    expect(screen.getByLabelText("Hasta qué mes se toma la base").getAttribute("type")).toBe(
      "month"
    );
  });

  it("al cambiar de año la ventana se acomoda sola", () => {
    // 2027 todavía no empezó: su base son los doce meses ya cerrados.
    montar(<Presupuesto />);
    const desde = () =>
      (screen.getByLabelText("Desde qué mes se toma la base") as HTMLInputElement).value;
    expect(desde()).toBe("2026-01");
    fireEvent.change(screen.getByLabelText("Año"), { target: { value: "2027" } });
    expect(desde()).toBe("2025-08");
  });
});


describe("Lo que no se presupuesta", () => {
  // "7 INVERSIONES" está fuera del control a propósito: los depósitos a plazo no
  // son un gasto que se decida presupuestar, dependen de si hay caja. Pero sus
  // categorías son operativas, y generar miraba solo la naturaleza: escribía un
  // presupuesto para ellas en filas que la tabla nunca mostraba.

  it("generar no presupuesta lo que el control excluye", () => {
    montar(<Presupuesto />);
    fireEvent.click(screen.getByRole("button", { name: /Generar operativo/ }));
    const cuadro = within(screen.getByRole("dialog", { name: "Qué va a quedar escrito" }));
    expect(cuadro.queryByText(/Depositos a plazo/)).toBeNull();
    expect(cuadro.queryByText(/Fondos mutuos/)).toBeNull();
  });

  it("pero su gasto se sigue viendo: igual sale de la caja", () => {
    montar(<Presupuesto />);
    generar();
    expect(screen.getByText("Fuera del control presupuestario")).toBeDefined();
  });

  it("una categoría suelta se puede sacar del control desde el maestro", () => {
    // La exclusión por grupo saca lo grueso; dentro de un grupo controlado hay
    // líneas que tampoco se presupuestan y antes no había forma de sacarlas.
    montar(<Categorias />);
    fireEvent.change(screen.getByLabelText("Buscar en el catálogo"), {
      target: { value: "Arriendo oficina" },
    });
    const marca = screen.getByTitle("Entra al control presupuestario");
    fireEvent.click(marca);
    expect(screen.getByTitle(/Fuera del control presupuestario/)).toBeDefined();
  });
});


describe("Proyectar el año", () => {
  // El presupuesto operativo de 2027 no se escribe: sale de sumar los movimientos
  // proyectados de 2027, y esos se escriben acá, línea por línea.
  //
  // Antes esto copiaba el año anterior y se elegía qué traer. Servía para saber qué
  // se paga y no para decidir qué se va a pagar: el pasado viene con su desorden y
  // la mitad de los montos cambia igual. La historia quedó al lado, como consulta.

  /** La cuenta que paga: sin ella la base rechaza el movimiento (§2). */
  const elegirCuenta = (cuadro: ReturnType<typeof within>) => {
    const select = cuadro.getByLabelText("Paga desde") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: select.options[1]!.value } });
  };

  const abrir = (conCuenta = true) => {
    montar(<Presupuesto />);
    fireEvent.change(screen.getByLabelText("Año"), { target: { value: "2027" } });
    fireEvent.click(screen.getByRole("button", { name: /Proyectar 2027/ }));
    const cuadro = within(screen.getByRole("dialog", { name: "Proyectar 2027" }));
    if (conCuenta) elegirCuenta(cuadro);
    return cuadro;
  };

  /** Una línea completa: proveedor, categoría y monto. Sin los tres no genera nada. */
  const escribirLinea = (
    cuadro: ReturnType<typeof within>,
    proveedor: string,
    busqueda: string,
    monto: number
  ) => {
    fireEvent.click(cuadro.getByText("+ línea"));
    const n = cuadro.getAllByLabelText(/^Proveedor de la línea /).length;
    fireEvent.change(cuadro.getByLabelText(`Proveedor de la línea ${n}`), {
      target: { value: proveedor },
    });
    fireEvent.click(cuadro.getAllByRole("button", { name: "Categoría" })[n - 1]!);
    fireEvent.change(cuadro.getByPlaceholderText("Buscar categoría"), {
      target: { value: busqueda },
    });
    fireEvent.mouseDown(cuadro.getAllByRole("option")[0]!);
    fireEvent.change(cuadro.getByLabelText(`Monto de la línea ${n}`), {
      target: { value: String(monto) },
    });
  };

  const crear = (cuadro: ReturnType<typeof within>) =>
    cuadro.getByRole("button", { name: /^Crear \d+ movimiento/ }) as HTMLButtonElement;

  it("arranca vacío: nada proyectado es nada escrito", () => {
    // El cuadro no propone líneas. Una propuesta que nadie mira se guarda igual, y
    // acá lo que se guarda son movimientos de 2027 (§6, ningún default guardable).
    const cuadro = abrir();
    expect(cuadro.getByText(/Todavía no hay líneas/)).toBeDefined();
    expect(crear(cuadro).disabled).toBe(true);
  });

  it("sin elegir la cuenta no hay nada que crear", () => {
    // `empresa_id` y `cuenta_id` son not null en la base: una proyección sin
    // cuenta no falla al armarla, falla al insertarla —entera, y recién ahí.
    const cuadro = abrir(false);
    escribirLinea(cuadro, "Entel", "telefonia", 90000);
    expect(crear(cuadro).disabled).toBe(true);
    expect(cuadro.getByText(/falta la cuenta/)).toBeDefined();
  });

  it("la cuenta elegida pone la empresa: en una cuenta del banco manda ella", () => {
    // §2: en una cuenta del banco la cuenta determina empresa y moneda. Acá eso
    // se nota en que con la cuenta puesta ya se puede crear.
    const cuadro = abrir();
    escribirLinea(cuadro, "Entel", "telefonia", 90000);
    expect(crear(cuadro).disabled).toBe(false);
  });

  it("una línea mensual son doce movimientos", () => {
    const cuadro = abrir();
    escribirLinea(cuadro, "Entel", "telefonia", 90000);
    expect(crear(cuadro).textContent).toMatch(/Crear 12 movimientos/);
  });

  it("trimestral son cuatro, y anual uno", () => {
    // Es la parte que a mano cuesta: lo trimestral aterriza solo en marzo, junio,
    // septiembre y diciembre sin que haya que escribir cuatro líneas.
    const cuadro = abrir();
    escribirLinea(cuadro, "Entel", "telefonia", 90000);
    fireEvent.change(cuadro.getByLabelText("Cada cuánto cae la línea 1"), {
      target: { value: "trimestral" },
    });
    expect(crear(cuadro).textContent).toMatch(/Crear 4 movimientos/);
    fireEvent.change(cuadro.getByLabelText("Cada cuánto cae la línea 1"), {
      target: { value: "anual" },
    });
    expect(crear(cuadro).textContent).toMatch(/Crear 1 movimiento/);
  });

  it("desde corta el arranque: lo que empieza en octubre son tres meses", () => {
    // Un contrato que parte a mitad de año no son doce pagos, y un aguinaldo cae
    // una vez. Sin esto habría que borrar los meses de más después de crearlos.
    const cuadro = abrir();
    escribirLinea(cuadro, "Entel", "telefonia", 90000);
    fireEvent.change(cuadro.getByLabelText("Desde qué mes cae la línea 1"), {
      target: { value: "10" },
    });
    expect(crear(cuadro).textContent).toMatch(/Crear 3 movimientos/);
  });

  it("sin categoría la línea no genera nada, y se dice", () => {
    // Un movimiento sin clasificar no llega al presupuesto: sumaría cero donde
    // tendría que sumar. Deshabilitar sin explicar dejaría buscando el botón.
    const cuadro = abrir();
    fireEvent.click(cuadro.getByText("+ línea"));
    fireEvent.change(cuadro.getByLabelText("Monto de la línea 1"), {
      target: { value: "90000" },
    });
    expect(crear(cuadro).disabled).toBe(true);
    expect(cuadro.getByText(/1 sin completar/)).toBeDefined();
  });

  it("el signo lo pone la categoría: nadie escribe el menos", () => {
    // El monto se escribe en magnitud, como en la planilla (§8). Si el signo
    // quedara en manos de quien escribe, un gasto en positivo infla la caja.
    const cuadro = abrir();
    escribirLinea(cuadro, "Entel", "telefonia", 90000);
    expect(cuadro.getByText(/−1\.080\.000/)).toBeDefined();
  });

  it("quitar una línea la saca de la cuenta", () => {
    const cuadro = abrir();
    escribirLinea(cuadro, "Entel", "telefonia", 90000);
    fireEvent.click(cuadro.getByLabelText("Quitar la línea 1"));
    expect(crear(cuadro).disabled).toBe(true);
  });

  it("lo que se pagó el año pasado queda al lado, como consulta", () => {
    // No para copiarlo entero: para no olvidarse de un pago. Es la pestaña, no el
    // mecanismo — el monto que queda escrito es uno elegido.
    const cuadro = abrir();
    fireEvent.click(cuadro.getByText("Lo que pagué el año pasado"));
    expect(cuadro.getAllByRole("button", { expanded: false }).length).toBeGreaterThan(0);
  });

  it("la consulta nombra la ventana en meses y no en fechas ISO", () => {
    // La ventana son meses completos: "2025-10-01" hace pensar que el día importa,
    // y además el ISO es el formato de la base y no el de pantalla (§8).
    const cuadro = abrir();
    fireEvent.click(cuadro.getByText("Lo que pagué el año pasado"));
    expect(cuadro.getByText(/octubre 2025/)).toBeDefined();
    expect(cuadro.queryByText(/2025-10-01/)).toBeNull();
  });

  it("una categoría de la consulta se abre y muestra sus proveedores", () => {
    // "Telefonía e internet · 12 meses" no dice si son doce pagos a Entel o una
    // mezcla. Sin abrirla, traer una línea sería traer a ciegas.
    const cuadro = abrir();
    fireEvent.click(cuadro.getByText("Lo que pagué el año pasado"));
    const antes = cuadro.queryAllByRole("row").length;
    fireEvent.click(cuadro.getAllByRole("button", { expanded: false })[0]!);
    expect(cuadro.getAllByRole("row").length).toBeGreaterThan(antes);
  });

  it("traer escribe la línea y vuelve al formulario", () => {
    // Traer no crea nada: deja la línea escrita y editable, que es el punto —
    // el monto del año pasado es un punto de partida, no la decisión.
    const cuadro = abrir();
    fireEvent.click(cuadro.getByText("Lo que pagué el año pasado"));
    fireEvent.click(cuadro.getAllByRole("button", { expanded: false })[0]!);
    fireEvent.click(cuadro.getAllByRole("button", { name: /^Traer / })[0]!);
    expect(cuadro.getAllByLabelText(/^Proveedor de la línea /).length).toBe(1);
    expect(crear(cuadro).disabled).toBe(false);
  });

  it("cancelar no crea nada", () => {
    const cuadro = abrir();
    escribirLinea(cuadro, "Entel", "telefonia", 90000);
    fireEvent.click(cuadro.getByText("Cancelar"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("el botón nombra el año destino", () => {
    // Proyectar escribe movimientos en un año: es lo que hay que tener claro
    // antes de apretar, igual que al generar el presupuesto.
    montar(<Presupuesto />);
    expect(screen.getByRole("button", { name: /Proyectar 2026/ })).toBeDefined();
    fireEvent.change(screen.getByLabelText("Año"), { target: { value: "2027" } });
    expect(screen.getByRole("button", { name: /Proyectar 2027/ })).toBeDefined();
  });
});
