// Perfiles: quién escribe y qué pestañas ve.
//
// El caso que lo trajo es el gerente general: mira el flujo de caja, no tiene
// por qué entrar a Categorías ni a Movimientos, y no debería poder escribir
// nada. No es ver menos datos —el flujo se abre al detalle y ahí están los
// movimientos— sino ver menos pantallas y no poder tocar.
//
// Lo que estos tests NO comprueban es lo único que de verdad protege: la RLS
// (migración 0022). Esconder un botón es cortesía con quien no va a poder
// guardar; lo que impide escribir vive en la base y se prueba en
// supabase/esquema.test.ts.

import { describe, expect, it } from "vitest";
import { fireEvent, screen, within } from "@testing-library/react";
import { montar, montarComo, prepararEntorno, revisor } from "@/components/pruebas/entorno";
import { Encabezado } from "@/components/chrome/Encabezado";
import { Registro } from "@/components/movimientos/Registro";
import { Maestros } from "@/components/maestros/Maestros";

prepararEntorno();

describe("El menú muestra las pestañas del perfil", () => {
  it("el perfil completo las ve todas", () => {
    montar(<Encabezado />);
    expect(screen.getByText("Movimientos")).toBeDefined();
    expect(screen.getByText("Categorías")).toBeDefined();
  });

  it("un revisor con solo Flujo ve solo Flujo", () => {
    montarComo(revisor(["flujo"]), <Encabezado />);
    expect(screen.getByText("Flujo de caja")).toBeDefined();
    expect(screen.queryByText("Movimientos")).toBeNull();
    expect(screen.queryByText("Categorías")).toBeNull();
    expect(screen.queryByText("Maestros")).toBeNull();
  });

  it("y con dos, ve las dos", () => {
    montarComo(revisor(["flujo", "presupuesto"]), <Encabezado />);
    expect(screen.getByText("Flujo de caja")).toBeDefined();
    expect(screen.getByText("Presupuesto anual")).toBeDefined();
    expect(screen.queryByText("Movimientos")).toBeNull();
  });

  it("vistas en null es todas, no ninguna", () => {
    // Es como quedaron las filas anteriores a la columna: leerlo al revés le
    // habría dejado el menú vacío a las tres personas que usan la app.
    montarComo(revisor(null), <Encabezado />);
    expect(screen.getByText("Movimientos")).toBeDefined();
  });

  it("dice que es de solo lectura", () => {
    // Explica de antemano por qué faltan los botones, en vez de dejar que se
    // descubra apretando uno que termina en el cartel de error.
    montarComo(revisor(["flujo"]), <Encabezado />);
    expect(screen.getByText("solo lectura")).toBeDefined();
  });

  it("y no lo dice cuando no lo es", () => {
    // Una insignia que dice "editor" en cada pantalla no agrega nada para las
    // tres personas que son el caso normal.
    montar(<Encabezado />);
    expect(screen.queryByText("solo lectura")).toBeNull();
  });
});

describe("Un revisor no escribe", () => {
  it("no se le ofrece registrar un movimiento", () => {
    montarComo(revisor(null), <Registro />);
    expect(screen.queryByText("+ Nuevo")).toBeNull();
  });

  it("al editor sí", () => {
    montar(<Registro />);
    expect(screen.getByText("+ Nuevo")).toBeDefined();
  });

  it("el menú de botón derecho le deja abrir el detalle y nada más", () => {
    // Duplicar y borrar escriben: la base los rechazaría y el único resultado
    // sería el cartel de "no se pudo guardar".
    montarComo(revisor(null), <Registro />);
    fireEvent.contextMenu(document.querySelector('tr[data-fila="movimiento"]')!);
    const menu = within(screen.getByRole("menu"));
    expect(menu.getByText("Abrir el detalle")).toBeDefined();
    expect(menu.queryByText("Duplicar movimiento")).toBeNull();
    expect(menu.queryByText("Borrar movimiento")).toBeNull();
  });
});

describe("Panel de usuarios", () => {
  it("un editor puede dar acceso", () => {
    montar(<Maestros />);
    expect(screen.getByLabelText("Correo de la persona nueva")).toBeDefined();
  });

  it("exige el dominio corporativo antes de agregar", () => {
    // Son dos filtros, no uno (§1): una fila con un correo de otro dominio
    // nunca va a poder entrar, así que no se deja crear.
    montar(<Maestros />);
    fireEvent.change(screen.getByLabelText("Nombre de la persona nueva"), {
      target: { value: "Alguien" },
    });
    fireEvent.change(screen.getByLabelText("Correo de la persona nueva"), {
      target: { value: "alguien@gmail.com" },
    });
    expect((screen.getByText("Dar acceso") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/Tiene que ser una cuenta/)).toBeDefined();

    fireEvent.change(screen.getByLabelText("Correo de la persona nueva"), {
      target: { value: "alguien@adapsysgroup.com" },
    });
    expect((screen.getByText("Dar acceso") as HTMLButtonElement).disabled).toBe(false);
  });

  it("quien entra lo hace como revisor y sin pestañas", () => {
    // Un alta que ya puede escribir todo es el mismo problema que un campo con
    // valor por defecto (§4.3): queda elegido sin que nadie lo haya elegido.
    montar(<Maestros />);
    fireEvent.change(screen.getByLabelText("Nombre de la persona nueva"), {
      target: { value: "Gerente General" },
    });
    fireEvent.change(screen.getByLabelText("Correo de la persona nueva"), {
      target: { value: "gerente@adapsysgroup.com" },
    });
    fireEvent.click(screen.getByText("Dar acceso"));

    const rol = screen.getByLabelText("Rol de Gerente General") as HTMLSelectElement;
    expect(rol.value).toBe("revisor");
    // Y queda avisado, porque sin pestañas no puede entrar.
    expect(screen.getByText(/no tiene ninguna pestaña marcada/)).toBeDefined();
  });

  it("un revisor ve la lista pero no la toca", () => {
    // Que vea quién tiene acceso está bien en un equipo de tres. Que pueda
    // darse a sí mismo el rol de editor, no.
    montarComo(revisor(null), <Maestros />);
    expect(screen.queryByLabelText("Correo de la persona nueva")).toBeNull();
    expect(screen.getByText(/Tu perfil es de solo lectura/)).toBeDefined();
  });
});
