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

  it("cuenta cuántos están listos para pagar", () => {
    montar();
    expect(screen.getByText(/0 proveedores · 0 listos para pagar/)).toBeDefined();
    crear("Uno");
    expect(screen.getByText(/1 proveedores · 0 listos para pagar/)).toBeDefined();
  });
});
