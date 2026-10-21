import { describe, expect, it } from "vitest";
import {
  clavesDe,
  diaEnMes,
  expandirLinea,
  expandirLineas,
  lineaDesdeRama,
  mesesDeLinea,
  origenDe,
  resumirPorCategoria,
  type LineaRecurrente,
} from "./proyeccion";
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
    // Es lo que permite decir, antes de aplicar, a cuántas líneas del presupuesto
    // van a llegar los movimientos: la clave de reporte es la de §3.1.
    const l: LineaRecurrente = {
      id: "x", contraparte: "Pago sueldos", categoria_id: "sueldos",
      subcategoria_id: "cargo-a", monto: 100, dia: 30, cada: "anual", desde: 1,
      empresa_id: "adap", cuenta_id: "a1", moneda: "CLP",
    };
    const p = expandirLineas([l, { ...l, id: "y", categoria_id: "iva-compras", subcategoria_id: null }], 2027, () => false);
    expect([...clavesDe(p)].sort()).toEqual(["iva-compras", "sueldos>cargo-a"]);
  });
});


describe("abrir por proveedor", () => {
  // "Telefonía e internet · 12 meses" no dice si son doce pagos a Entel o una
  // mezcla de Entel y GTD. Sin abrirla, uno proyecta a ciegas.
  const dos = () => [
    ...[1, 2, 3].map((n) =>
      mov({
        id: `g${n}`,
        fecha: `2026-0${n}-14`,
        contraparte: "GTD",
        lineas: [linea("telefonia-e-internet", -300000)],
      })
    ),
    ...[1, 2].map((n) =>
      mov({
        id: `e${n}`,
        fecha: `2026-0${n}-20`,
        contraparte: "Entel",
        lineas: [linea("telefonia-e-internet", -60000)],
      })
    ),
  ];

  it("una categoría se abre en sus proveedores", () => {
    const [cat] = resumirPorCategoria(dos(), ANIO, () => true, TC);
    expect(cat!.ramas.map((r) => r.contraparte)).toEqual(["GTD", "Entel"]);
  });

  it("cada proveedor trae sus meses y su total", () => {
    const [cat] = resumirPorCategoria(dos(), ANIO, () => true, TC);
    const gtd = cat!.ramas.find((r) => r.contraparte === "GTD")!;
    expect(gtd.meses).toEqual([1, 2, 3]);
    expect(gtd.total).toBe(900000);
  });

  it("los meses de la categoría se unen, no se suman", () => {
    // GTD aparece en enero, febrero y marzo; Entel en enero y febrero. Son tres
    // meses, no cinco: sumando, una categoría con dos proveedores mensuales
    // diría 24 meses en un año.
    const [cat] = resumirPorCategoria(dos(), ANIO, () => true, TC);
    expect(cat!.meses).toBe(3);
    expect(cat!.movimientos).toBe(5);
  });

  it("los proveedores vienen ordenados por lo que más pesa", () => {
    const [cat] = resumirPorCategoria(dos(), ANIO, () => true, TC);
    expect(cat!.ramas[0]!.contraparte).toBe("GTD");
  });
});

describe("mesesDeLinea", () => {
  it("mensual cae los doce", () => {
    expect(mesesDeLinea("mensual", 1)).toHaveLength(12);
  });

  it("trimestral desde marzo cae en marzo, junio, septiembre y diciembre", () => {
    // "Trimestral" a secas no dice cuál de las cuatro series es. Por eso hay un
    // mes de partida.
    expect(mesesDeLinea("trimestral", 3)).toEqual([3, 6, 9, 12]);
  });

  it("y desde enero cae en otra serie", () => {
    expect(mesesDeLinea("trimestral", 1)).toEqual([1, 4, 7, 10]);
  });

  it("no da la vuelta al año", () => {
    // Una trimestral desde noviembre cae en noviembre y punto: el año que viene
    // es otro año y se proyecta aparte.
    expect(mesesDeLinea("trimestral", 11)).toEqual([11]);
  });

  it("anual cae una sola vez, en su mes", () => {
    expect(mesesDeLinea("anual", 7)).toEqual([7]);
  });
});

describe("diaEnMes", () => {
  it("respeta el día pedido", () => {
    expect(diaEnMes(2027, 3, 14)).toBe("2027-03-14");
  });

  it("recorta al último día cuando el mes no llega", () => {
    // "Día 31, mensual" es razonable y en febrero no existe. Generar una fecha
    // inválida se llevaría puesta la proyección entera.
    expect(diaEnMes(2027, 2, 31)).toBe("2027-02-28");
    expect(diaEnMes(2028, 2, 31)).toBe("2028-02-29");
    expect(diaEnMes(2027, 4, 31)).toBe("2027-04-30");
  });
});

describe("expandirLinea", () => {
  const gasto = (p: Partial<LineaRecurrente> = {}): LineaRecurrente => ({
    id: "l1",
    contraparte: "Entel",
    categoria_id: "telefonia-e-internet",
    subcategoria_id: null,
    monto: 58541,
    dia: 14,
    cada: "mensual",
    desde: 1,
    empresa_id: "adap",
    cuenta_id: "a1",
    moneda: "CLP",
    ...p,
  });
  const esGasto = () => false;
  const esIngreso = () => true;

  it("crea un movimiento por mes", () => {
    const r = expandirLinea(gasto(), 2027, esGasto);
    expect(r).toHaveLength(12);
    expect(r[0]!.fecha).toBe("2027-01-14");
    expect(r[11]!.fecha).toBe("2027-12-14");
  });

  it("el signo sale de la naturaleza, no de lo que se escriba", () => {
    // En una pantalla donde se cargan treinta líneas, un menos olvidado convierte
    // un gasto en ingreso y el flujo del año queda al revés sin que nada falle.
    expect(expandirLinea(gasto({ monto: 58541 }), 2027, esGasto)[0]!.monto).toBe(-58541);
    expect(expandirLinea(gasto({ monto: -58541 }), 2027, esGasto)[0]!.monto).toBe(-58541);
    expect(expandirLinea(gasto(), 2027, esIngreso)[0]!.monto).toBe(58541);
  });

  it("la línea del movimiento lleva el mismo monto que el movimiento", () => {
    // O la base lo rechaza por descuadre.
    const [m] = expandirLinea(gasto(), 2027, esGasto);
    expect(m!.lineas[0]!.monto).toBe(m!.monto);
    expect(m!.lineas[0]!.categoria_id).toBe("telefonia-e-internet");
  });

  it("un monto en cero no crea nada", () => {
    expect(expandirLinea(gasto({ monto: 0 }), 2027, esGasto)).toEqual([]);
  });

  it("sin cuenta tampoco: la base la exige y rechazaría la proyección entera", () => {
    // `empresa_id` y `cuenta_id` son not null (0001). Una línea sin cuenta no
    // falla al armarla: falla al insertar, y se lleva puesta toda la corrida.
    expect(expandirLinea(gasto({ cuenta_id: null }), 2027, esGasto)).toEqual([]);
    expect(expandirLinea(gasto({ empresa_id: null }), 2027, esGasto)).toEqual([]);
  });

  it("un anual crea uno solo", () => {
    const r = expandirLinea(gasto({ cada: "anual", desde: 3, dia: 20 }), 2027, esGasto);
    expect(r).toHaveLength(1);
    expect(r[0]!.fecha).toBe("2027-03-20");
  });

  it("varias líneas se suman sin pisarse", () => {
    const r = expandirLineas(
      [gasto(), gasto({ id: "l2", contraparte: "GTD", cada: "anual", desde: 6 })],
      2027,
      esGasto
    );
    expect(r).toHaveLength(13);
    expect(new Set(r.map((m) => m.contraparte))).toEqual(new Set(["Entel", "GTD"]));
  });
});

describe("lineaDesdeRama", () => {
  const rama = (meses: number[], promedio = 100, dia = 14) => ({
    categoria_id: "telefonia-e-internet",
    contraparte: "GTD",
    meses,
    movimientos: meses.length,
    total: promedio * meses.length,
    promedio,
    dia,
  });

  it("doce meses se proponen como mensual, desde el primero", () => {
    const l = lineaDesdeRama(rama([1,2,3,4,5,6,7,8,9,10,11,12]), "x");
    expect(l.cada).toBe("mensual");
    expect(l.desde).toBe(1);
  });

  it("cuatro meses, trimestral desde el primero en que apareció", () => {
    const l = lineaDesdeRama(rama([3, 6, 9, 12]), "x");
    expect(l.cada).toBe("trimestral");
    expect(l.desde).toBe(3);
  });

  it("uno solo, anual", () => {
    expect(lineaDesdeRama(rama([7]), "x").cada).toBe("anual");
  });

  it("trae el monto por mes y el día más repetido", () => {
    // Para no volver a buscar en la historia lo que la historia ya sabe.
    const l = lineaDesdeRama(rama([1, 2], 306745, 5), "x");
    expect(l.monto).toBe(306745);
    expect(l.dia).toBe(5);
  });

  it("once meses igual es mensual: un mes sin pago no cambia que lo sea", () => {
    const l = lineaDesdeRama(rama([1,2,3,4,5,6,7,8,9,10,11]), "x");
    expect(l.cada).toBe("mensual");
  });
});
