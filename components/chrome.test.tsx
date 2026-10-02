// Tests de render (§8): cada vista se monta de verdad, con los paneles
// expandidos. Compilar no basta — el bundler no detecta un identificador
// usado antes de declararse, y eso ya reventó en este proyecto.

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { montar, montarEn, prepararEntorno } from "@/components/pruebas/entorno";
import { ProveedorTesoreria } from "@/components/estado/ProveedorTesoreria";
import { Registro } from "@/components/movimientos/Registro";
import { Encabezado } from "@/components/chrome/Encabezado";
import { Cuentas } from "@/components/chrome/Cuentas";

prepararEntorno();

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
    // La regla de §4.5 se dice una vez, abajo: antes iba pegada a cada cuenta en
    // dólares y la etiqueta no cabía en el ancho, así que envolvía la fila.
    expect(screen.getAllByText(/fuera del flujo/).length).toBeGreaterThan(0);
  });

  it("cada cuenta del banco lleva su nombre entero", () => {
    // Antes la fila de pesos tomaba el nombre de la empresa y la de dólares decía
    // solo "USD", sangrada debajo: se leía como un encabezado de grupo con una
    // cuenta adentro, cuando son dos cuentas hermanas.
    montar(<Cuentas />);
    const lateral = within(document.querySelector("aside")!);
    expect(lateral.getByText("CLA ADAPTACIÓN PESOS")).toBeDefined();
    expect(lateral.getByText("CLA ADAPTACIÓN DÓLAR")).toBeDefined();
    // Y el nombre de la empresa a secas ya no aparece: no era ninguna cuenta.
    // ("USD" sí aparece, pero como marca de moneda de las proyecciones.)
    expect(lateral.queryByText("CLA ADAPTACIÓN")).toBeNull();
  });

  it("la barra lateral no filtra por empresa", () => {
    // Filtrar es global: apaga las otras empresas en todas las vistas y deja el
    // selector de arriba diciendo cuántas, no cuál. Se activaba sin querer al
    // apuntar al nombre, así que esa acción salió de la barra.
    montar(<Cuentas />);
    expect(screen.queryByTitle(/^Ver solo /)).toBeNull();
  });

  it("las proyecciones van en su propio bloque, no mezcladas con el banco", () => {
    // Es la separación que pidió el equipo: en Quicken son registros distintos y
    // así se trabajan. Que en la base sean el mismo movimiento con otro estado es
    // del modelo, no de la pantalla.
    montar(<Cuentas />);
    expect(screen.getByText("Proyecciones")).toBeDefined();
    // La moneda va como marca aparte y no pegada al nombre: "Egresos proyectados
    // · CLP" no cabía en el ancho y envolvía la fila a dos líneas.
    expect(screen.getByTitle("Ver egresos proyectados en CLP")).toBeDefined();
    expect(screen.getByTitle("Ver egresos proyectados en USD")).toBeDefined();
    expect(screen.getByTitle("Ver facturas por cobrar en CLP")).toBeDefined();
    expect(screen.getByTitle("Ver proyectos aprobados en CLP")).toBeDefined();
    // El nombre va entero y la moneda aparte, en su propia columna.
    expect(screen.getAllByText("Egresos proyectados")).toHaveLength(2);
    expect(screen.getAllByText("CLP").length).toBeGreaterThan(0);
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
    fireEvent.click(screen.getByTitle("Ver egresos proyectados en CLP"));
    expect(screen.getByText(/Viendo solo/)).toBeDefined();
    const filas = document.querySelectorAll("tbody tr").length;
    expect(filas).toBeGreaterThan(0);
    const cuerpo = within(document.querySelector("tbody")!);
    expect(cuerpo.queryAllByText("conciliado")).toHaveLength(0);
  });

  it("hacer click en la empresa abre su cuenta en pesos, sin tocar el filtro", () => {
    conSidebar();
    fireEvent.click(screen.getByTitle(/Ver los movimientos de CLA CONSULTORES PESOS/));

    // Se abrió el registro…
    expect(screen.getByText(/Viendo solo/)).toBeDefined();
    // …y las otras empresas siguen en la barra, que es lo que no pasaba cuando el
    // nombre cambiaba el filtro global.
    const lateral = within(document.querySelector("aside")!);
    expect(lateral.getByText("CLA ADAPTACIÓN PESOS")).toBeDefined();
    expect(lateral.getByText("CLA CONSULTORES PESOS")).toBeDefined();
  });

  it("el encabezado toma el nombre del registro abierto y su saldo", () => {
    // Pedido mirando Quicken: con el nombre de la cuenta arriba se sabe dónde se
    // está parado sin tener que leer la barra lateral.
    conSidebar();
    expect(screen.getByRole("heading", { name: "Movimientos" })).toBeDefined();

    fireEvent.click(screen.getByTitle(/Ver los movimientos de CLA CONSULTORES PESOS/));
    expect(
      screen.getByRole("heading", { name: "CLA CONSULTORES PESOS" })
    ).toBeDefined();
    expect(screen.getByText("Saldo de hoy")).toBeDefined();
  });

  it("y en la cartera el número es un total, no un saldo", () => {
    // La cartera no es plata que esté en ninguna parte: llamarle saldo sería
    // decir que hay algo en una cuenta.
    conSidebar();
    fireEvent.click(screen.getByTitle("Ver facturas por cobrar en CLP"));
    expect(screen.getByText("Total por cobrar")).toBeDefined();
    expect(screen.queryByText("Saldo de hoy")).toBeNull();
  });
});
