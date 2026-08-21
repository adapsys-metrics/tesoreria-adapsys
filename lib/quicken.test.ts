// Los fixtures son inline a propósito: los CSV reales están fuera de git (traen
// el historial financiero de la empresa), así que un test que dependa de ellos
// pasaría acá y fallaría en cualquier otra máquina.

import { describe, expect, it } from "vitest";
import {
  agruparMovimientos,
  empresaDe,
  leerArchivo,
  parsearCSV,
  parsearFecha,
  parsearMonto,
} from "./quicken";

describe("parsearMonto", () => {
  it("lee el formato es-CL de las filas", () => {
    expect(parsearMonto("-306.745,00")).toBe(-306745);
    expect(parsearMonto("1.253.118,00")).toBe(1253118);
    expect(parsearMonto("-69,95")).toBe(-69.95);
    expect(parsearMonto("")).toBe(0);
  });

  it("no confunde el punto de miles con el decimal", () => {
    // -160,50 USD es ciento sesenta dólares, no dieciséis mil.
    expect(parsearMonto("-160,50")).toBe(-160.5);
  });
});

describe("parsearFecha", () => {
  it("convierte DD-MM-YYYY a ISO sin pasar por Date", () => {
    // Con `new Date` esto se interpretaría en la zona del servidor y en Vercel
    // (UTC) correría un día los movimientos.
    expect(parsearFecha("14-08-2026")).toBe("2026-08-14");
    expect(parsearFecha("01-01-2020")).toBe("2020-01-01");
  });

  it("devuelve null para el pie de totales", () => {
    expect(parsearFecha("Total Inflows: 14907019676.00")).toBeNull();
    expect(parsearFecha("")).toBeNull();
  });
});

describe("parsearCSV", () => {
  it("respeta comas y saltos de línea dentro de comillas", () => {
    // Casos reales: memos de Mastercard y facturas de LinkedIn con salto.
    const filas = parsearCSV('a,"con, coma","dos\nlíneas"\nb,c,d\n');
    expect(filas).toEqual([["a", "con, coma", "dos\nlíneas"], ["b", "c", "d"]]);
  });

  it("respeta comillas escapadas", () => {
    expect(parsearCSV('"dice ""hola""",x\n')).toEqual([['dice "hola"', "x"]]);
  });
});

describe("empresaDe", () => {
  it("acepta el nombre con y sin tilde", () => {
    // Los dos aparecen en el mismo archivo.
    expect(empresaDe("CLA ADAPTACIÓN")).toBe("adap");
    expect(empresaDe("CLA ADAPTACION")).toBe("adap");
    expect(empresaDe("SANTA MARÍA")).toBe("sm");
  });

  it("devuelve null para la basura que trae Action en los registros de banco", () => {
    expect(empresaDe("TEF")).toBeNull();
    expect(empresaDe("12")).toBeNull();
    expect(empresaDe("")).toBeNull();
  });
});

describe("leerArchivo", () => {
  // Este es el test que justifica todo el módulo. Las cabeceras NO son iguales
  // entre los 15 exports: c2 intercambia Payee y Check #. Un parser posicional
  // cargaría el proveedor en el campo del documento y no fallaría.
  it("lee por nombre de columna, no por posición", () => {
    const conAction = leerArchivo(
      `CLA ADAPTACIÓN PESOS,,\nFilter Criteria: All Dates | Any Type | Any Status\n` +
        `,Scheduled,Split,Date,Action,Check #,Payee,Memo/Notes,Category,Amount,Balance\n` +
        `,,,14-08-2026,CLA ADAPTACIÓN,FA3109609,GTD,Internet oficina,2 X:Y,"-306.745,00","156.478.642,00"\n`
    );
    const swap = leerArchivo(
      `CLA CONSULTING DOLAR,,\nFilter Criteria: All Dates | Any Type | Any Status\n` +
        `,Scheduled,Split,Date,Payee,Check #,Memo/Notes,Category,Amount,Balance\n` +
        `,,,14-08-2026,GTD,FA3109609,Internet oficina,2 X:Y,"-306.745,00","156.478.642,00"\n`
    );
    for (const a of [conAction, swap]) {
      expect(a.filas[0]!.contraparte).toBe("GTD");
      expect(a.filas[0]!.documento).toBe("FA3109609");
      expect(a.filas[0]!.monto).toBe(-306745);
    }
    expect(conAction.filas[0]!.action).toBe("CLA ADAPTACIÓN");
    expect(swap.filas[0]!.action).toBe(""); // c2 no trae la columna
  });

  it("lee el pie con su propio formato, distinto al de las filas", () => {
    // Las filas vienen es-CL y el pie con punto decimal: aplicarle el parser de
    // las filas multiplica por 100 y el saldo parece calzar por dos órdenes de
    // magnitud. Pasó de verdad al escribir esto.
    const a = leerArchivo(
      `X,,\nFilter Criteria: All Dates\n,Split,Date,Payee,Category,Amount\n` +
        `,,14-08-2026,GTD,2 X:Y,"-306.745,00"\n` +
        `,,,,Total Inflows:,14907019676.00\n` +
        `,,,,Total Outflows:,-14831679707.00\n` +
        `,,,,Net Total:,75339969.00\n`
    );
    expect(a.totales).toEqual({
      entradas: 14907019676,
      salidas: -14831679707,
      neto: 75339969,
    });
  });

  it("expone el filtro para detectar un export incompleto", () => {
    // Un export con búsqueda activa trae solo parte del registro aunque diga
    // "All Dates". Ya pasó una vez con a1.csv.
    const a = leerArchivo(
      `X,,\nFilter Criteria: All Dates | Any Type | Any Status | Search All Visible Columns for 'paula'\n` +
        `,Split,Date,Payee,Category,Amount\n,,14-08-2026,GTD,2 X:Y,"-1,00"\n`
    );
    expect(a.filtro).toMatch(/Search All Visible Columns/);
  });
});

describe("agruparMovimientos", () => {
  const fila = (p: Partial<Parameters<typeof agruparMovimientos>[0][number]>) => ({
    esSplit: false, fecha: "2026-08-14", tags: "", action: "", documento: "",
    contraparte: "", memo: "", categoria: "", monto: 0, saldo: null, ...p,
  });

  it("arma el split de la factura GTD (§4.3)", () => {
    // neto -306.745 + IVA -58.281 = -365.026 transferidos.
    const [m] = agruparMovimientos([
      fila({ esSplit: true, contraparte: "GTD", documento: "FA3109609", saldo: 156478642,
             categoria: "2 GASTOS ADMINISTRACIÓN:Telefonía e internet", monto: -306745 }),
      fila({ esSplit: true, contraparte: "GTD", documento: "FA3109609", saldo: 156478642,
             categoria: "4 IMPUESTOS:IVA compras", monto: -58281 }),
    ]);
    expect(m!.monto).toBe(-365026);
    expect(m!.lineas).toHaveLength(2);
  });

  it("arma la boleta de honorarios con retención (§4.3)", () => {
    // bruto -1.253.118 + retención +191.100 = -1.062.018 líquidos.
    const [m] = agruparMovimientos([
      fila({ esSplit: true, contraparte: "Magdalena Toral", documento: "B405", saldo: 500,
             categoria: "3 RECURSOS HUMANOS:Sueldos", monto: -1253118 }),
      fila({ esSplit: true, contraparte: "Magdalena Toral", documento: "B405", saldo: 500,
             categoria: "4 IMPUESTOS:Retención BHE", monto: 191100 }),
    ]);
    expect(m!.monto).toBe(-1062018);
  });

  it("separa dos cargos idénticos del mismo día", () => {
    // Existen de verdad (§4.7). Lo que los distingue es que el saldo avanza.
    const movs = agruparMovimientos([
      fila({ esSplit: true, contraparte: "ENTEL", documento: "FA1", saldo: 1000, monto: -12597 }),
      fila({ esSplit: true, contraparte: "ENTEL", documento: "FA1", saldo: 987, monto: -12597 }),
    ]);
    expect(movs).toHaveLength(2);
  });

  it("trata una fila sin marca de split como movimiento de una línea (§3)", () => {
    const movs = agruparMovimientos([
      fila({ contraparte: "A", monto: -100 }),
      fila({ contraparte: "B", monto: -200 }),
    ]);
    expect(movs.map((m) => m.monto)).toEqual([-100, -200]);
    expect(movs.every((m) => m.lineas.length === 1)).toBe(true);
  });

  it("no arrastra una fila suelta al split anterior", () => {
    const movs = agruparMovimientos([
      fila({ esSplit: true, contraparte: "GTD", saldo: 10, monto: -300 }),
      fila({ esSplit: true, contraparte: "GTD", saldo: 10, monto: -57 }),
      fila({ contraparte: "OTRO", monto: -999 }),
    ]);
    expect(movs).toHaveLength(2);
    expect(movs[0]!.monto).toBe(-357);
    expect(movs[1]!.monto).toBe(-999);
  });

  it("toma la empresa de Tags antes que de Action", () => {
    // Cobranzas y proyectos aprobados la traen en Tags; proy-egresos en Action.
    const [conTags] = agruparMovimientos([fila({ tags: "CLA CONSULTORES", action: "1" })]);
    const [conAction] = agruparMovimientos([fila({ action: "CLA ADAPTACIÓN" })]);
    const [sinNada] = agruparMovimientos([fila({ action: "TEF" })]);
    expect(conTags!.empresa).toBe("cons");
    expect(conAction!.empresa).toBe("adap");
    expect(sinNada!.empresa).toBeNull(); // la bolsa, y los registros de banco
  });
});
