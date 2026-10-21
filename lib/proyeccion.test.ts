import { describe, expect, it } from "vitest";
import { clavesDe, mismaFechaEn, origenDe, proyectar, resumirPorCategoria } from "./proyeccion";
import type { Linea, Movimiento } from "./tipos";

const TC = 970;

const linea = (categoria_id: string, monto: number, subcategoria_id: string | null = null): Linea => ({
  categoria_id,
  subcategoria_id,
  doc_tipo: null,
  monto,
  glosa: null,
});

const mov = (p: Partial<Movimiento> & { lineas: Linea[] }): Movimiento => ({
  id: "1",
  fecha: "2026-03-14",
  empresa_id: "adap",
  cuenta_id: "a1",
  contraparte: "GTD",
  glosa: "FA3146848 Internet oficina",
  documento: "FA3146848",
  monto: p.lineas.reduce((t, l) => t + l.monto, 0),
  moneda: "CLP",
  tipo_cambio: null,
  estado: "conciliado",
  doc_tipo: "afecta",
  hito: null,
  origen: null,
  ...p,
});

const ANIO = { desde: "2026-01-01", hasta: "2026-12-31" };
const TODAS = (ms: Movimiento[]) =>
  new Set(ms.flatMap((m) => m.lineas.map((l) => l.categoria_id)));

describe("mismaFechaEn", () => {
  it("conserva el mes y el día: un pago del 14 sigue siendo del 14", () => {
    expect(mismaFechaEn("2026-03-14", 2027)).toBe("2027-03-14");
  });

  it("sirve para una ventana que cruza dos años", () => {
    // Noviembre sale de 2025 y marzo de 2026, y los dos van al año destino.
    expect(mismaFechaEn("2025-11-20", 2027)).toBe("2027-11-20");
    expect(mismaFechaEn("2026-03-10", 2027)).toBe("2027-03-10");
  });

  it("el 29 de febrero se corre al 28 cuando el destino no es bisiesto", () => {
    // Es la única fecha que no existe todos los años. Dejarla pasar generaría un
    // movimiento con fecha inválida y la base rechazaría la proyección entera.
    expect(mismaFechaEn("2024-02-29", 2027)).toBe("2027-02-28");
  });

  it("y se queda en 29 cuando sí lo es", () => {
    expect(mismaFechaEn("2024-02-29", 2028)).toBe("2028-02-29");
  });
});

describe("proyectar", () => {
  it("copia el movimiento al año destino", () => {
    const ms = [mov({ lineas: [linea("telefonia-e-internet", -306745)] })];
    const [p] = proyectar(ms, ANIO, 2027, TODAS(ms));
    expect(p!.fecha).toBe("2027-03-14");
    expect(p!.contraparte).toBe("GTD");
    expect(p!.monto).toBe(-306745);
  });

  it("trae el split entero aunque solo una línea esté elegida", () => {
    // Un pago de tarjeta con dieciséis líneas es UNA transferencia. Traer solo
    // las líneas elegidas daría un movimiento cuyo monto no es el que sale del
    // banco, y la base lo rechazaría por descuadre.
    const ms = [
      mov({
        lineas: [linea("telefonia-e-internet", -306745), linea("iva-compras", -58281)],
      }),
    ];
    const [p] = proyectar(ms, ANIO, 2027, new Set(["telefonia-e-internet"]));
    expect(p!.lineas).toHaveLength(2);
    expect(p!.monto).toBe(-365026);
  });

  it("no copia un movimiento cuyas categorías no se eligieron", () => {
    const ms = [mov({ lineas: [linea("gastos-de-representacion", -500000)] })];
    expect(proyectar(ms, ANIO, 2027, new Set(["telefonia-e-internet"]))).toEqual([]);
  });

  it("no re-proyecta lo que ya estaba proyectado", () => {
    // Sería arrastrar al año siguiente algo que todavía no ocurrió en éste.
    const ms = [
      mov({ estado: "proyectado", lineas: [linea("telefonia-e-internet", -306745)] }),
    ];
    expect(proyectar(ms, ANIO, 2027, TODAS(ms))).toEqual([]);
  });

  it("deja fuera lo que no cae en la ventana", () => {
    const ms = [
      mov({ id: "1", fecha: "2025-12-31", lineas: [linea("telefonia-e-internet", -100)] }),
      mov({ id: "2", fecha: "2026-01-02", lineas: [linea("telefonia-e-internet", -200)] }),
    ];
    const r = proyectar(ms, ANIO, 2027, TODAS(ms));
    expect(r).toHaveLength(1);
    expect(r[0]!.monto).toBe(-200);
  });

  it("el reajuste escala las líneas y el monto sale de sumarlas", () => {
    // Escalando el monto y las líneas por separado, el redondeo las separa y el
    // movimiento queda descuadrado. La base lo rechaza, y con razón.
    const ms = [
      mov({
        lineas: [linea("telefonia-e-internet", -306745), linea("iva-compras", -58281)],
      }),
    ];
    const [p] = proyectar(ms, ANIO, 2027, TODAS(ms), 1.05);
    expect(p!.lineas.map((l) => l.monto)).toEqual([-322082, -61195]);
    expect(p!.monto).toBe(p!.lineas.reduce((t, l) => t + l.monto, 0));
    expect(p!.monto).toBe(-383277);
  });

  it("conserva la cuenta: un proyectado del banco alimenta el registro de egresos", () => {
    const ms = [mov({ lineas: [linea("telefonia-e-internet", -100)] })];
    const [p] = proyectar(ms, ANIO, 2027, TODAS(ms));
    expect(p!.cuenta_id).toBe("a1");
    expect(p!.empresa_id).toBe("adap");
  });

  it("conserva el detalle de cada línea", () => {
    const ms = [
      mov({ lineas: [linea("sueldos", -1000, "especialista-de-finanzas")] }),
    ];
    const [p] = proyectar(ms, ANIO, 2027, TODAS(ms));
    expect(p!.lineas[0]!.subcategoria_id).toBe("especialista-de-finanzas");
  });

  it("un movimiento sin clasificar no se arrastra", () => {
    const ms = [mov({ lineas: [] })];
    expect(proyectar(ms, ANIO, 2027, new Set(["lo-que-sea"]))).toEqual([]);
  });
});

describe("resumirPorCategoria", () => {
  const todas = () => true;

  it("cuenta movimientos y no líneas", () => {
    // Un split de sueldos con cuatro cargos es un pago, no cuatro.
    const ms = [
      mov({
        lineas: [
          linea("sueldos", -400, "cargo-a"),
          linea("sueldos", -300, "cargo-b"),
          linea("sueldos", -300, "cargo-c"),
        ],
      }),
    ];
    const r = resumirPorCategoria(ms, ANIO, todas, TC);
    expect(r).toHaveLength(1);
    expect(r[0]!.movimientos).toBe(1);
    expect(r[0]!.total).toBe(1000);
  });

  it("dice en cuántos meses aparece, que es lo que distingue lo mensual", () => {
    // 12 es mensual, 1 es una vez en el año. Es el dato que permite elegir sin
    // que la app adivine con un umbral.
    const ms = [1, 2, 3].map((n) =>
      mov({ id: String(n), fecha: `2026-0${n}-10`, lineas: [linea("arriendo-oficina", -100)] })
    );
    expect(resumirPorCategoria(ms, ANIO, todas, TC)[0]!.meses).toBe(3);
  });

  it("dos movimientos del mismo mes cuentan un mes", () => {
    const ms = [
      mov({ id: "1", fecha: "2026-03-02", lineas: [linea("arriendo-oficina", -100)] }),
      mov({ id: "2", fecha: "2026-03-20", lineas: [linea("arriendo-oficina", -100)] }),
    ];
    const r = resumirPorCategoria(ms, ANIO, todas, TC)[0]!;
    expect(r.movimientos).toBe(2);
    expect(r.meses).toBe(1);
  });

  it("deja fuera lo proyectado, igual que `proyectar`", () => {
    // Si el resumen contara movimientos que después no se copian, la vista previa
    // estaría mintiendo sobre lo que va a pasar.
    const ms = [
      mov({ id: "1", lineas: [linea("arriendo-oficina", -100)] }),
      mov({ id: "2", estado: "proyectado", lineas: [linea("arriendo-oficina", -900)] }),
    ];
    const r = resumirPorCategoria(ms, ANIO, todas, TC)[0]!;
    expect(r.movimientos).toBe(1);
    expect(r.total).toBe(100);
  });

  it("convierte los dólares, igual que el presupuesto", () => {
    const ms = [mov({ moneda: "USD", lineas: [linea("sistemas-operaciones-y-finanzas", -100)] })];
    expect(resumirPorCategoria(ms, ANIO, todas, TC)[0]!.total).toBe(97_000);
  });

  it("viene ordenado por lo que más pesa", () => {
    const ms = [
      mov({ id: "1", lineas: [linea("chica", -100)] }),
      mov({ id: "2", lineas: [linea("grande", -900)] }),
    ];
    expect(resumirPorCategoria(ms, ANIO, todas, TC).map((x) => x.categoria_id)).toEqual([
      "grande",
      "chica",
    ]);
  });
});

describe("origenDe y clavesDe", () => {
  it("el origen nombra el año, para poder rehacer solo lo suyo", () => {
    expect(origenDe(2027)).toBe("proyeccion-2027");
  });

  it("las claves salen de las líneas, con su subcategoría cuando la hay", () => {
    const ms = [mov({ lineas: [linea("sueldos", -100, "cargo-a"), linea("iva-compras", -19)] })];
    const p = proyectar(ms, ANIO, 2027, TODAS(ms));
    expect([...clavesDe(p)].sort()).toEqual(["iva-compras", "sueldos>cargo-a"]);
  });
});
