// Tests de render de los mantenedores (§8), y de las dos reglas que hacen que la
// nómina no reviente en el portal: el RUT válido y qué cuenta como "listo para pagar".

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ProveedorTesoreria } from "@/components/estado/ProveedorTesoreria";
import { Maestros } from "@/components/maestros/Maestros";
import { Cuentas } from "@/components/chrome/Cuentas";

vi.mock("next/navigation", () => ({ usePathname: () => "/maestros" }));

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

const montar = (ui: React.ReactNode = <Maestros />) =>
  render(<ProveedorTesoreria registroInicial={null}>{ui}</ProveedorTesoreria>);

const crear = (nombre: string) => {
  fireEvent.change(screen.getByLabelText("Nombre del proveedor nuevo"), {
    target: { value: nombre },
  });
  fireEvent.click(screen.getByRole("button", { name: "+ proveedor" }));
};

describe("Maestros", () => {
  it("monta y lista las cuentas de banco con su número", () => {
    montar();
    expect(screen.getByRole("heading", { name: "Maestros" })).toBeDefined();
    expect(screen.getByLabelText("Número de CLA ADAPTACIÓN PESOS")).toBeDefined();
  });

  it("no pide número a las cuentas auxiliares, que no existen en ningún banco", () => {
    // Facturas por cobrar y las proyecciones son registros de Quicken, no cuentas.
    montar();
    expect(screen.queryByLabelText(/Número de FACTURAS POR COBRAR/)).toBeNull();
    expect(screen.queryByLabelText(/Número de PROY/)).toBeNull();
  });

  it("el número de cuenta se guarda y se ve donde corresponde", () => {
    montar();
    const campo = screen.getByLabelText("Número de CLA ADAPTACIÓN PESOS");
    fireEvent.change(campo, { target: { value: "73021634" } });
    expect((campo as HTMLInputElement).value).toBe("73021634");
  });

  it("renombrar una empresa se ve en la barra lateral", () => {
    // La prueba de que empresas salió del bundle: si las vistas siguieran leyendo la
    // constante, el nombre viejo se quedaría ahí.
    render(
      <ProveedorTesoreria registroInicial={null}>
        <Maestros />
        <Cuentas />
      </ProveedorTesoreria>
    );
    fireEvent.change(screen.getByLabelText("Nombre de CLA ADAPTACIÓN"), {
      target: { value: "CLA ADAPTACIÓN SpA" },
    });
    expect(screen.getAllByText("CLA ADAPTACIÓN SpA").length).toBeGreaterThan(0);
  });

  it("un proveedor nuevo nace incompleto y lo dice", () => {
    montar();
    crear("Smartbricks Technologies SPA");
    expect(screen.getByLabelText("Nombre de Smartbricks Technologies SPA")).toBeDefined();
    expect(screen.getByText("faltan datos")).toBeDefined();
  });

  it("pasa a listo recién con RUT, banco y cuenta", () => {
    // Es la regla que decide qué entra a la nómina: sin los tres no se puede transferir.
    montar();
    crear("Smartbricks Technologies SPA");
    const n = "Smartbricks Technologies SPA";
    fireEvent.change(screen.getByLabelText(`RUT de ${n}`), { target: { value: "76.624.489-0" } });
    expect(screen.getByText("faltan datos")).toBeDefined();
    fireEvent.change(screen.getByLabelText(`Código de banco de ${n}`), { target: { value: "37" } });
    expect(screen.getByText("faltan datos")).toBeDefined();
    fireEvent.change(screen.getByLabelText(`Cuenta de ${n}`), { target: { value: "70684756" } });
    expect(screen.getByText("listo")).toBeDefined();
  });

  it("el RUT se muestra con formato pero se guarda como lo pide el portal", () => {
    montar();
    crear("Smartbricks Technologies SPA");
    const campo = screen.getByLabelText("RUT de Smartbricks Technologies SPA");
    fireEvent.change(campo, { target: { value: "766244890" } });
    // En pantalla con puntos, para poder compararlo contra una factura.
    expect((campo as HTMLInputElement).value).toBe("76.624.489-0");
  });

  it("avisa del RUT inválido, porque el portal rechaza la nómina entera", () => {
    montar();
    crear("Proveedor con dedo malo");
    fireEvent.change(screen.getByLabelText("RUT de Proveedor con dedo malo"), {
      target: { value: "76.624.489-1" },
    });
    expect(screen.getByText(/no es válido/)).toBeDefined();
    expect(screen.getByText(/rechaza la nómina completa/)).toBeDefined();
  });

  it("desactivar lo saca de la nómina sin perder sus datos bancarios", () => {
    montar();
    crear("Smartbricks Technologies SPA");
    const n = "Smartbricks Technologies SPA";
    fireEvent.change(screen.getByLabelText(`RUT de ${n}`), { target: { value: "766244890" } });
    fireEvent.change(screen.getByLabelText(`Código de banco de ${n}`), { target: { value: "37" } });
    fireEvent.change(screen.getByLabelText(`Cuenta de ${n}`), { target: { value: "70684756" } });

    fireEvent.click(screen.getByRole("button", { name: "listo" }));
    expect(screen.getByText("inactivo")).toBeDefined();
    // La cuenta sigue ahí: si vuelve, no hay que buscarla de nuevo.
    expect((screen.getByLabelText(`Cuenta de ${n}`) as HTMLInputElement).value).toBe("70684756");
  });

  it("borrar pide confirmación en la propia fila", () => {
    montar();
    crear("Se creó por error");
    fireEvent.click(screen.getByLabelText("Borrar Se creó por error"));
    fireEvent.click(screen.getByRole("button", { name: "cancelar" }));
    expect(screen.getByLabelText("Nombre de Se creó por error")).toBeDefined();

    fireEvent.click(screen.getByLabelText("Borrar Se creó por error"));
    fireEvent.click(screen.getByLabelText("Confirmar borrar Se creó por error"));
    expect(screen.queryByLabelText("Nombre de Se creó por error")).toBeNull();
  });

  it("pegar desde Excel carga varios de una vez", () => {
    // Es el caso real: los datos ya están en una planilla y son ~20 filas.
    montar();
    fireEvent.click(screen.getByRole("button", { name: "Pegar desde Excel" }));
    fireEvent.change(screen.getByLabelText("Listado de proveedores"), {
      target: {
        value: [
          "Smartbricks Technologies SPA\t76.624.489-0\t37\t70684756\tk@smartbricks.cl",
          "Dimerc\t96.670.840-9\t12\t1234567\tpagos@dimerc.cl",
        ].join("\n"),
      },
    });
    expect(screen.getByText("2")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "CARGAR 2" }));

    expect(screen.getByText("Entraron 2 nuevos.")).toBeDefined();
    expect(screen.getByText(/2 proveedores · 2 listos para pagar/)).toBeDefined();
    // El RUT quedó guardado como lo pide el portal y se muestra con formato.
    expect(
      (screen.getByLabelText("RUT de Smartbricks Technologies SPA") as HTMLInputElement).value
    ).toBe("76.624.489-0");
  });

  it("no carga las filas con problemas, y dice cuál es el problema", () => {
    // Descartarlas en silencio dejaría al usuario creyendo que cargó 20 cuando cargó 19.
    montar();
    fireEvent.click(screen.getByRole("button", { name: "Pegar desde Excel" }));
    fireEvent.change(screen.getByLabelText("Listado de proveedores"), {
      target: {
        value: [
          "Smartbricks\t76.624.489-0\t37\t70684756",
          "Con dedo malo\t76.624.489-1\t37\t70684756",
        ].join("\n"),
      },
    });
    expect(screen.getByText("1 con problemas")).toBeDefined();
    expect(screen.getByText(/RUT inválido/)).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "CARGAR 1" }));
    expect(screen.getByLabelText("Nombre de Smartbricks")).toBeDefined();
    expect(screen.queryByLabelText("Nombre de Con dedo malo")).toBeNull();
  });

  it("volver a pegar actualiza y no duplica", () => {
    montar();
    crear("Dimerc");
    fireEvent.click(screen.getByRole("button", { name: "Pegar desde Excel" }));
    fireEvent.change(screen.getByLabelText("Listado de proveedores"), {
      target: { value: "DIMERC\t96.670.840-9\t12\t1234567" },
    });
    fireEvent.click(screen.getByRole("button", { name: "CARGAR 1" }));

    expect(screen.getByText("Entraron 1 actualizados.")).toBeDefined();
    // Uno solo, y con los datos que trajo la planilla.
    expect(screen.getByText(/1 proveedores · 1 listos para pagar/)).toBeDefined();
    expect((screen.getByLabelText("Cuenta de Dimerc") as HTMLInputElement).value).toBe("1234567");
  });

  it("ofrece bajar el respaldo, y dice que no reemplaza al del proveedor", () => {
    // Un respaldo que nadie encuentra no existe, y uno que alguien cree que tiene y no
    // tiene es peor: el texto tiene que decir qué cubre y qué no.
    montar();
    expect(screen.getByRole("button", { name: /Descargar todo/ })).toBeDefined();
    expect(screen.getByText(/movimientos con sus líneas/)).toBeDefined();
  });

  it("cuenta cuántos están listos para pagar", () => {
    montar();
    expect(screen.getByText(/0 proveedores · 0 listos para pagar/)).toBeDefined();
    crear("Uno");
    expect(screen.getByText(/1 proveedores · 0 listos para pagar/)).toBeDefined();
  });
});
