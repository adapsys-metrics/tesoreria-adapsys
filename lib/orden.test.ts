import { describe, expect, it } from "vitest";
import { ORDEN_INICIAL, alternarOrden, ordenarMovimientos, type Orden } from "./orden";
import type { Movimiento } from "./tipos";

const mov = (p: Partial<Movimiento> & { id: string }): Movimiento => ({
  fecha: "2026-08-14",
  empresa_id: "adap",
  cuenta_id: "a1",
  contraparte: null,
  glosa: null,
  documento: null,
  monto: -1000,
  moneda: "CLP",
  tipo_cambio: null,
  estado: "conciliado",
  doc_tipo: null,
  lineas: [],
  ...p,
});

const ETIQUETAS = {
  cuenta: (m: Movimiento) => m.cuenta_id ?? "",
  categoria: (m: Movimiento) => m.lineas[0]?.categoria_id ?? "",
};

const ordenar = (movs: Movimiento[], orden: Orden) =>
  ordenarMovimientos(movs, orden, 970, ETIQUETAS).map((m) => m.id);

describe("alternarOrden", () => {
  it("una columna nueva empieza ascendente", () => {
    expect(alternarOrden(ORDEN_INICIAL, "monto")).toEqual({ columna: "monto", sentido: "asc" });
  });

  it("la misma columna alterna el sentido", () => {
    const asc: Orden = { columna: "monto", sentido: "asc" };
    expect(alternarOrden(asc, "monto")).toEqual({ columna: "monto", sentido: "desc" });
    expect(alternarOrden(alternarOrden(asc, "monto"), "monto")).toEqual(asc);
  });
});

describe("por fecha", () => {
  const movs = [
    mov({ id: "3", fecha: "2026-09-01" }),
    mov({ id: "1", fecha: "2026-01-15" }),
    mov({ id: "2", fecha: "2026-05-20" }),
  ];

  it("ascendente es el orden por defecto", () => {
    expect(ordenar(movs, ORDEN_INICIAL)).toEqual(["1", "2", "3"]);
  });

  it("descendente invierte", () => {
    expect(ordenar(movs, { columna: "fecha", sentido: "desc" })).toEqual(["3", "2", "1"]);
  });
});

describe("por monto", () => {
  it("compara en pesos, para que USD y CLP sean comparables", () => {
    // US$100 a 970 son 97.000, más que los 50.000 en pesos. Comparar el número
    // crudo pondría los dólares abajo siempre.
    const movs = [
      mov({ id: "clp", monto: 50000 }),
      mov({ id: "usd", monto: 100, moneda: "USD", cuenta_id: "a2", tipo_cambio: 970 }),
    ];
    expect(ordenar(movs, { columna: "monto", sentido: "desc" })).toEqual(["usd", "clp"]);
  });

  it("respeta el signo: el egreso mayor primero en ascendente", () => {
    const movs = [
      mov({ id: "ingreso", monto: 5_000_000 }),
      mov({ id: "egreso", monto: -100_000_000 }),
      mov({ id: "chico", monto: -1000 }),
    ];
    expect(ordenar(movs, { columna: "monto", sentido: "asc" })).toEqual([
      "egreso",
      "chico",
      "ingreso",
    ]);
  });
});

describe("por estado", () => {
  it("sigue el ciclo de vida, no el alfabeto", () => {
    // Alfabético daría conciliado → pagado → proyectado, que es el camino al revés.
    const movs = [
      mov({ id: "c", estado: "conciliado" }),
      mov({ id: "p", estado: "proyectado" }),
      mov({ id: "g", estado: "pagado" }),
    ];
    expect(ordenar(movs, { columna: "estado", sentido: "asc" })).toEqual(["p", "g", "c"]);
  });
});

describe("textos", () => {
  it("ordena respetando tildes", () => {
    const movs = [
      mov({ id: "z", contraparte: "ZURICH" }),
      mov({ id: "p", contraparte: "ADAPSYS PERÚ" }),
      mov({ id: "a", contraparte: "AASA" }),
    ];
    expect(ordenar(movs, { columna: "contraparte", sentido: "asc" })).toEqual(["a", "p", "z"]);
  });

  it("manda lo vacío al final en los dos sentidos", () => {
    // Una fila sin glosa no aporta nada arriba: son las que menos dicen sobre la
    // columna que se está mirando.
    const movs = [
      mov({ id: "sin", glosa: null }),
      mov({ id: "b", glosa: "Bencina" }),
      mov({ id: "a", glosa: "Arriendo" }),
    ];
    expect(ordenar(movs, { columna: "glosa", sentido: "asc" })).toEqual(["a", "b", "sin"]);
    expect(ordenar(movs, { columna: "glosa", sentido: "desc" })).toEqual(["b", "a", "sin"]);
  });

  it("los movimientos sin clasificar quedan al final de su columna", () => {
    const movs = [
      mov({ id: "sin" }),
      mov({ id: "con", lineas: [{ categoria_id: "sueldos", subcategoria_id: null, monto: -1000, glosa: null }] }),
    ];
    expect(ordenar(movs, { columna: "categoria", sentido: "asc" })).toEqual(["con", "sin"]);
  });
});

describe("desempate", () => {
  it("es estable: dos filas iguales no cambian de lugar entre renders", () => {
    // Sin desempate explícito el resultado depende del orden de entrada y la tabla
    // "salta" sin que nadie haya tocado nada.
    const movs = [
      mov({ id: "b", fecha: "2026-03-02", estado: "pagado" }),
      mov({ id: "a", fecha: "2026-03-01", estado: "pagado" }),
      mov({ id: "c", fecha: "2026-03-01", estado: "pagado" }),
    ];
    const orden: Orden = { columna: "estado", sentido: "asc" };
    expect(ordenar(movs, orden)).toEqual(["a", "c", "b"]);
    expect(ordenar([...movs].reverse(), orden)).toEqual(["a", "c", "b"]);
  });

  it("invierte también los empates al ordenar descendente", () => {
    // Dos movimientos del mismo día: en descendente el último tiene que quedar
    // arriba. Con un desempate siempre ascendente quedaba abajo, y entonces la
    // primera fila mostraba un saldo corriente que no era el actual.
    const movs = [
      mov({ id: "1", fecha: "2026-08-15", monto: 12810000 }),
      mov({ id: "2", fecha: "2026-08-15", monto: -5311000 }),
      mov({ id: "3", fecha: "2026-08-12", monto: -318000 }),
    ];
    expect(ordenar(movs, { columna: "fecha", sentido: "desc" })).toEqual(["2", "1", "3"]);
    expect(ordenar(movs, { columna: "fecha", sentido: "asc" })).toEqual(["3", "1", "2"]);
  });

  it("no muta el arreglo que recibe", () => {
    const movs = [mov({ id: "2", fecha: "2026-09-01" }), mov({ id: "1", fecha: "2026-01-01" })];
    ordenar(movs, ORDEN_INICIAL);
    expect(movs.map((m) => m.id)).toEqual(["2", "1"]);
  });
});
