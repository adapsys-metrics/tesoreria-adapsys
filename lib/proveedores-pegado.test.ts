import { describe, expect, it } from "vitest";
import { parsearProveedores } from "@/lib/proveedores-pegado";
import type { Proveedor } from "@/lib/tipos";

const tab = (...filas: string[][]) => filas.map((f) => f.join("\t")).join("\n");

const SMARTBRICKS = [
  "Smartbricks Technologies SPA",
  "76.624.489-0",
  "37",
  "70684756",
  "karina.urbina@smartbricks.cl",
];

describe("parsearProveedores", () => {
  it("lee lo que se copia de Excel, que viene con tabulaciones", () => {
    const [f] = parsearProveedores(tab(SMARTBRICKS));
    expect(f).toMatchObject({
      nombre: "Smartbricks Technologies SPA",
      rut: "766244890",
      cod_banco: "37",
      cuenta: "70684756",
      correo: "karina.urbina@smartbricks.cl",
      problemas: [],
    });
  });

  it("reconoce las columnas por el encabezado, en cualquier orden", () => {
    const filas = parsearProveedores(
      tab(
        ["RUT", "Nombre proveedor", "Correo", "N° cuenta", "Código banco"],
        ["76.624.489-0", "Smartbricks", "k@smartbricks.cl", "70684756", "37"]
      )
    );
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({
      nombre: "Smartbricks",
      rut: "766244890",
      cuenta: "70684756",
      cod_banco: "37",
    });
  });

  it("no confunde 'cuenta banco' con la columna del banco", () => {
    // Las dos palabras aparecen en el mismo encabezado; gana la más específica.
    const [f] = parsearProveedores(
      tab(["Nombre", "Cuenta banco", "Banco"], ["Dimerc", "70684756", "37"])
    );
    expect(f).toMatchObject({ cuenta: "70684756", cod_banco: "37" });
  });

  it("sin encabezado usa el orden nombre, rut, banco, cuenta, correo", () => {
    const [f] = parsearProveedores(tab(SMARTBRICKS));
    expect(f!.cod_banco).toBe("37");
    expect(f!.cuenta).toBe("70684756");
  });

  it("acepta punto y coma, que es lo que da un CSV exportado en Chile", () => {
    const [f] = parsearProveedores("Dimerc;96.670.840-9;12;1234567;pagos@dimerc.cl");
    expect(f).toMatchObject({ nombre: "Dimerc", rut: "966708409", cuenta: "1234567" });
  });

  it("limpia puntos y guiones de la cuenta y del código", () => {
    // Se copian con formato según de dónde vengan, y el portal los quiere limpios.
    const [f] = parsearProveedores(tab(["Dimerc", "96.670.840-9", "0-12", "7.068.475-6"]));
    expect(f).toMatchObject({ cod_banco: "012", cuenta: "70684756" });
  });

  it("marca el RUT inválido en vez de cargarlo", () => {
    const [f] = parsearProveedores(tab(["Dimerc", "76.624.489-1", "37", "70684756"]));
    expect(f!.problemas).toContain("RUT inválido");
  });

  it("marca el correo inválido", () => {
    const [f] = parsearProveedores(tab([...SMARTBRICKS.slice(0, 4), "karina.urbina"]));
    expect(f!.problemas).toContain("correo inválido");
  });

  it("marca la fila sin nombre, que no se puede cargar", () => {
    const [f] = parsearProveedores(tab(["", "76.624.489-0", "37", "70684756"]));
    expect(f!.problemas).toContain("sin nombre");
  });

  it("marca el repetido dentro de la misma pegada", () => {
    const filas = parsearProveedores(tab(SMARTBRICKS, SMARTBRICKS));
    expect(filas[0]!.problemas).toEqual([]);
    expect(filas[1]!.problemas).toContain("repetido en el listado");
  });

  it("avisa cuando el proveedor ya existe: actualiza, no duplica", () => {
    const existente: Proveedor = {
      id: "smartbricks",
      nombre: "SMARTBRICKS TECHNOLOGIES SPA",
      rut: null,
      cod_banco: null,
      cuenta: null,
      correo: null,
      activo: true,
    };
    const [f] = parsearProveedores(tab(SMARTBRICKS), [existente]);
    // Compara sin acentos ni mayúsculas: el Excel y la app rara vez coinciden exacto.
    expect(f!.actualiza).toBe(true);
  });

  it("ignora las líneas en blanco de la planilla", () => {
    expect(parsearProveedores(`${tab(SMARTBRICKS)}\n\n\n`)).toHaveLength(1);
  });

  it("no se cae con una pegada vacía", () => {
    expect(parsearProveedores("")).toEqual([]);
    expect(parsearProveedores("   \n  ")).toEqual([]);
  });
});
