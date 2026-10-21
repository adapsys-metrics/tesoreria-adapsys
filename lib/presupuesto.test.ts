import { describe, expect, it } from "vitest";
import {
  ajustarDesde,
  anualDe,
  mesesRepetidos,
  ultimosDoceMeses,
  ventanaPara,
  reescalar,
  distribucionOperativa,
  distribuirLineal,
  ejecutadoPorClave,
  entraAlPresupuesto,
  filaDe,
  finDeMes,
  presupuestoAgotado,
  sobreRitmo,
  totalizar,
  ytdDe,
} from "./presupuesto";
import type { Meses } from "./presupuesto";
import type { LineaPresupuesto, Movimiento } from "./tipos";

const mov = (p: Partial<Movimiento>): Movimiento => ({
  id: "1",
  fecha: "2026-02-15",
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
  hito: null,
  lineas: [],
  ...p,
});

/** Un movimiento de una línea, que es el caso corriente. */
const gasto = (id: string, fecha: string, sub: string, monto: number, extra: Partial<Movimiento> = {}) =>
  mov({ id, fecha, monto, lineas: [{ categoria_id: sub, subcategoria_id: null, doc_tipo: null, monto, glosa: null }], ...extra });

// El TC no cambia nada mientras todo esté en pesos; se nombra para que se lea
// por qué el parámetro está ahí.
const TC = 970;

const LINEA: LineaPresupuesto = { monto: 0, monto_anterior: 0, responsable: "", nota: "" };

describe("finDeMes", () => {
  it("da el último día de cada mes", () => {
    expect(finDeMes(2026, 1)).toBe("2026-01-31");
    expect(finDeMes(2026, 4)).toBe("2026-04-30");
    expect(finDeMes(2026, 7)).toBe("2026-07-31");
    expect(finDeMes(2026, 12)).toBe("2026-12-31");
  });

  it("cuenta bien los febreros", () => {
    expect(finDeMes(2026, 2)).toBe("2026-02-28");
    expect(finDeMes(2028, 2)).toBe("2028-02-29");
    expect(finDeMes(2100, 2)).toBe("2100-02-28"); // divisible por 100, no bisiesto
    expect(finDeMes(2000, 2)).toBe("2000-02-29"); // divisible por 400, sí
  });
});

describe("distribuirLineal", () => {
  it("reparte el año en doce partes exactas", () => {
    const meses = distribuirLineal(500_000);
    expect(meses).toHaveLength(12);
    expect(anualDe(meses)).toBe(500_000);
  });

  it("reparte el resto de a un peso, no todo en diciembre", () => {
    // 500.000 / 12 = 41.666,67. Ocho meses llevan 41.667 y cuatro 41.666, así que
    // ningún mes se desvía más de un peso y la suma sigue siendo exacta.
    const meses = distribuirLineal(500_000);
    expect(Math.max(...meses) - Math.min(...meses)).toBe(1);
    expect(anualDe(meses)).toBe(500_000);
  });

  it("toma el monto en magnitud, venga con signo o sin él", () => {
    expect(anualDe(distribuirLineal(-1_000_000))).toBe(1_000_000);
  });
});

describe("entraAlPresupuesto", () => {
  const ADAPSYS = ["adap", "cons", "clting", "ctria"];

  it("deja fuera a las sociedades relacionadas", () => {
    // SANTA MARÍA comparte el sistema pero no el presupuesto (§4.6): sus gastos
    // inflarían el ejecutado de líneas que las cuatro no gastaron.
    expect(entraAlPresupuesto({ empresa_id: "sm" }, ADAPSYS)).toBe(false);
  });

  it("incluye a las cuatro del grupo", () => {
    for (const e of ADAPSYS) expect(entraAlPresupuesto({ empresa_id: e }, ADAPSYS)).toBe(true);
  });

  it("incluye lo que todavía no tiene empresa", () => {
    // Las proyecciones que no saben por qué sociedad se gestionan pertenecen al
    // consolidado justamente por eso.
    expect(entraAlPresupuesto({ empresa_id: null }, ADAPSYS)).toBe(true);
  });
});

describe("el control presupuestario, de punta a punta", () => {
  // Lo que hace la vista: filtrar primero y calcular después. Se prueba junto
  // porque el error que importa es olvidar el filtro, no equivocarse en la suma.
  const ADAPSYS = ["adap", "cons", "clting", "ctria"];
  const ejecutadoDelGrupo = (ms: Movimiento[], mes: number) =>
    ejecutadoPorClave(
      ms.filter((m) => entraAlPresupuesto(m, ADAPSYS)),
      2026,
      mes
    , TC);

  it("no suma el gasto de una relacionada", () => {
    const e = ejecutadoDelGrupo(
      [
        gasto("1", "2026-02-10", "arriendo-oficina", -1_000_000),
        gasto("2", "2026-02-10", "arriendo-oficina", -9_000_000, { empresa_id: "sm" }),
      ],
      3
    );
    // Solo el millón de Adapsys: Santa María no comparte este presupuesto.
    expect(e.get("arriendo-oficina")).toBe(1_000_000);
  });

  it("tampoco la deja entrar a la distribución que genera el operativo", () => {
    const meses = distribucionOperativa(
      [gasto("1", "2026-05-10", "arriendo-oficina", -3_000_000, { empresa_id: "sm" })].filter((m) =>
        entraAlPresupuesto(m, ADAPSYS)
      ),
      { desde: "2026-01-01", hasta: "2026-12-31" },
      () => true
    , TC);
    expect(meses.get("arriendo-oficina")).toBeUndefined();
  });
});

describe("distribucionOperativa", () => {
  const esOperativa = (id: string) => id !== "equipos-computacionales";


  it("pone cada movimiento en el mes de su fecha", () => {
    // Es la diferencia con el prorrateo lineal: los retiros de socios de marzo
    // pesan en marzo, no un doceavo cada mes.
    const meses = distribucionOperativa(
      [
        gasto("1", "2026-03-20", "retiros-socios", -20_000_000),
        gasto("2", "2026-06-20", "retiros-socios", -20_000_000),
        gasto("3", "2026-08-20", "retiros-socios", -20_000_000),
      ],
      { desde: "2026-01-01", hasta: "2026-12-31" },
      esOperativa
    , TC).get("retiros-socios")!;

    expect(anualDe(meses)).toBe(60_000_000);
    expect(meses[2]).toBe(20_000_000); // marzo
    expect(meses[3]).toBe(0); // abril
    expect(ytdDe(meses, 3)).toBe(20_000_000);
    expect(ytdDe(meses, 7)).toBe(40_000_000);
  });

  it("suma lo proyectado a futuro y lo ya ocurrido del año", () => {
    // El presupuesto es lo planificado para el año completo. Contar solo lo que
    // ya pasó daría un número que encoge con cada mes que falta por delante: para
    // esos meses, lo planificado es el único dato que hay.
    const meses = distribucionOperativa(
      [
        gasto("1", "2026-01-25", "sueldos", -400, { estado: "conciliado" }),
        gasto("2", "2026-11-25", "sueldos", -600, { estado: "proyectado" }),
      ],
      { desde: "2026-01-01", hasta: "2026-12-31" },
      esOperativa
    , TC).get("sueldos")!;
    expect(anualDe(meses)).toBe(1000);
  });

  it("pero deja fuera lo proyectado que ya se pasó de fecha", () => {
    // Se planeó para una fecha que ya pasó y no ocurrió. Presupuestar el año que
    // viene sobre eso sería arrastrar lo que no se hizo.
    const meses = distribucionOperativa(
      [
        gasto("1", "2026-01-25", "sueldos", -400, { estado: "conciliado" }),
        gasto("2", "2026-02-25", "sueldos", -600, { estado: "proyectado" }),
      ],
      { desde: "2026-01-01", hasta: "2026-12-31" },
      esOperativa,
      TC,
      1,
      "2026-08-20"
    ).get("sueldos")!;
    expect(anualDe(meses)).toBe(400);
  });

  it("convierte los dólares igual que el ejecutado", () => {
    // Si el presupuesto se generara sin convertir y el gasto se midiera convertido,
    // toda línea pagada en dólares arrancaría el año con un sobregasto de 1.000 a 1.
    const d = distribucionOperativa(
      [gasto("1", "2026-02-01", "sistop", -100, { moneda: "USD" })],
      { desde: "2026-01-01", hasta: "2026-12-31" },
      () => true,
      970
    );
    expect(d.get("sistop")![1]).toBe(97_000);
  });

  it("deja fuera las categorías de inversión, que van a mano", () => {
    const d = distribucionOperativa(
      [gasto("1", "2026-02-01", "equipos-computacionales", -900)],
      { desde: "2026-01-01", hasta: "2026-12-31" },
      esOperativa
    , TC);
    expect(d.size).toBe(0);
  });

  it("reparte los splits entre sus categorías", () => {
    const d = distribucionOperativa(
      [
        mov({
          fecha: "2026-08-14",
          monto: -365026,
          lineas: [
            { categoria_id: "telefonia-e-internet", subcategoria_id: null, doc_tipo: null, monto: -306745, glosa: null },
            { categoria_id: "iva-compras", subcategoria_id: null, doc_tipo: null, monto: -58281, glosa: null },
          ],
        }),
      ],
      { desde: "2026-01-01", hasta: "2026-12-31" },
      esOperativa
    , TC);
    expect(d.get("telefonia-e-internet")![7]).toBe(306745); // agosto
    expect(d.get("iva-compras")![7]).toBe(58281);
  });

  it("deja fuera otros años", () => {
    const d = distribucionOperativa(
      [gasto("1", "2025-12-31", "sueldos", -100), gasto("2", "2026-01-01", "sueldos", -100)],
      { desde: "2026-01-01", hasta: "2026-12-31" },
      esOperativa
    , TC);
    expect(anualDe(d.get("sueldos")!)).toBe(100);
  });
});

describe("reescalar", () => {
  it("conserva la forma mensual al cambiar el anual", () => {
    // Sueldos con aguinaldo en diciembre: subir el presupuesto no debe aplanar
    // diciembre contra el resto.
    const meses = [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 200];
    const nuevo = reescalar(meses, 2600); // el doble
    expect(anualDe(nuevo)).toBe(2600);
    expect(nuevo[11]).toBe(400);
    expect(nuevo[0]).toBe(200);
  });

  it("el total queda exacto aunque el redondeo de cada mes desvíe", () => {
    const meses = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
    expect(anualDe(reescalar(meses, 1000))).toBe(1000);
  });

  it("una línea sin forma se reparte pareja", () => {
    const nuevo = reescalar(Array(12).fill(0), 1_200_000);
    expect(anualDe(nuevo)).toBe(1_200_000);
    expect(Math.max(...nuevo) - Math.min(...nuevo)).toBe(0);
  });

  it("bajar a cero deja los doce meses en cero", () => {
    expect(anualDe(reescalar([10, 20, 30, 0, 0, 0, 0, 0, 0, 0, 0, 0], 0))).toBe(0);
  });
});

describe("ejecutadoPorClave", () => {
  it("suma en magnitud: el presupuesto se muestra sin signo (§4.6)", () => {
    const e = ejecutadoPorClave([gasto("1", "2026-01-05", "arriendo-oficina", -8_814_748)], 2026, 3, TC);
    expect(e.get("arriendo-oficina")).toBe(8_814_748);
  });

  it("reparte los splits entre sus categorías, no al movimiento entero", () => {
    const e = ejecutadoPorClave(
      [
        mov({
          monto: -365026,
          lineas: [
            { categoria_id: "telefonia-e-internet", subcategoria_id: null, doc_tipo: null, monto: -306745, glosa: null },
            { categoria_id: "iva-compras", subcategoria_id: null, doc_tipo: null, monto: -58281, glosa: null },
          ],
        }),
      ],
      2026,
      3
    , TC);
    expect(e.get("telefonia-e-internet")).toBe(306745);
    expect(e.get("iva-compras")).toBe(58281);
  });

  it("convierte los dólares al TC del año", () => {
    // Caso real: la tarjeta en dólares paga casi todas las suscripciones. Sin
    // convertir, un cargo de US$67,5 entraba al presupuesto como 68 pesos y el
    // gasto en sistemas digitales desaparecía de la vista.
    const e = ejecutadoPorClave(
      [gasto("1", "2026-01-16", "sistop", -67.5, { moneda: "USD" })],
      2026,
      3,
      970
    );
    expect(e.get("sistop")).toBe(65_475);
  });

  it("usa el TC del propio movimiento cuando la operación lo tuvo", () => {
    const e = ejecutadoPorClave(
      [gasto("1", "2026-01-16", "sistop", -100, { moneda: "USD", tipo_cambio: 900 })],
      2026,
      3,
      970
    );
    expect(e.get("sistop")).toBe(90_000);
  });

  it("una devolución baja el gasto de la línea, no lo sube", () => {
    // Tomando magnitud línea por línea, que un proveedor devuelva plata gastaba
    // más. La magnitud va al final, con las devoluciones ya descontadas.
    const e = ejecutadoPorClave(
      [
        gasto("1", "2026-02-10", "sistop", -1_000_000),
        gasto("2", "2026-02-20", "sistop", 300_000),
      ],
      2026,
      3,
      970
    );
    expect(e.get("sistop")).toBe(700_000);
  });

  it("no cuenta lo proyectado: el real es lo que ocurrió", () => {
    const e = ejecutadoPorClave(
      [gasto("1", "2026-02-01", "sueldos", -900, { estado: "proyectado" })],
      2026,
      3
    , TC);
    expect(e.get("sueldos")).toBeUndefined();
  });

  it("corta en el último día del mes elegido", () => {
    const movs = [gasto("1", "2026-03-31", "sueldos", -100), gasto("2", "2026-04-01", "sueldos", -100)];
    expect(ejecutadoPorClave(movs, 2026, 3, TC).get("sueldos")).toBe(100);
    expect(ejecutadoPorClave(movs, 2026, 4, TC).get("sueldos")).toBe(200);
  });

  it("ignora lo que no está clasificado", () => {
    expect(ejecutadoPorClave([mov({ monto: -5000 })], 2026, 12, TC).size).toBe(0);
  });
});

describe("filaDe", () => {
  it("reproduce una línea de inversión de la planilla real", () => {
    // Desarrollo organizacional: 500.000 al año, a julio.
    // La planilla dice 291.667: calcula anual × 7/12 sin pasar por los meses. Acá
    // la diferencia es de dos pesos por el reparto en enteros, y es irrelevante.
    const f = filaDe("x", null, { ...LINEA }, distribuirLineal(500_000), 0, 7);
    expect(f.anual).toBe(500_000);
    expect(f.ytd).toBeCloseTo(291_667, -1);
    expect(f.variacion).toBeCloseTo(-291_667, -1);
  });

  it("la variación positiva es haber gastado de más", () => {
    // "Desarrollo y mejoras sistemas": 1.500.000 al año, 476.965 a marzo.
    const f = filaDe("x", null, LINEA, distribuirLineal(1_500_000), 476_965, 3);
    expect(f.ytd).toBe(375_000);
    expect(f.variacion).toBe(101_965);
  });

  it("una línea sin presupuesto no tiene avance", () => {
    // Gastar sobre cero no es 0% ni infinito: es una línea sin presupuestar.
    expect(filaDe("x", null, LINEA, distribuirLineal(0), 50_000, 6).avance).toBeNull();
  });
});

describe("sobreRitmo", () => {
  it("compara contra lo presupuestado a la fecha, no contra el calendario", () => {
    // Una línea que se paga entera en marzo debe estar al 100% en marzo sin que
    // eso sea sobregasto. Con la regla vieja —avance mayor que mes/12— habría
    // saltado la alarma en todas las líneas estacionales.
    const enMarzo = [0, 0, 60_000_000, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    expect(sobreRitmo(filaDe("x", null, LINEA, enMarzo, 60_000_000, 3))).toBe(false);
    expect(sobreRitmo(filaDe("x", null, LINEA, enMarzo, 61_000_000, 3))).toBe(true);
  });

  it("una línea sin presupuesto a la fecha no dispara la alarma", () => {
    // Todavía no le tocaba gastar: la desviación se ve en la variación, no acá.
    expect(sobreRitmo(filaDe("x", null, LINEA, distribuirLineal(0), 999_999, 3))).toBe(false);
  });
});

describe("presupuestoAgotado", () => {
  const anual = distribuirLineal(1_200_000);

  it("marca la línea que ya usó todo lo del año", () => {
    // Aunque el acumulado a la fecha esté lejos: lo que importa es que no queda
    // nada para lo que resta y cualquier gasto nuevo ya es sobregasto.
    expect(presupuestoAgotado(filaDe("x", null, LINEA, anual, 1_200_000, 3))).toBe(true);
  });

  it("también cuando se pasó del anual", () => {
    expect(presupuestoAgotado(filaDe("x", null, LINEA, anual, 1_500_000, 3))).toBe(true);
  });

  it("no marca la que todavía tiene saldo", () => {
    expect(presupuestoAgotado(filaDe("x", null, LINEA, anual, 1_199_999, 12))).toBe(false);
  });

  it("una línea sin presupuesto no está agotada: nunca tuvo", () => {
    // Su desviación se ve en el gasto sin presupuestar, no acá.
    expect(presupuestoAgotado(filaDe("x", null, LINEA, distribuirLineal(0), 500_000, 3))).toBe(false);
  });

  it("es distinto de ir sobre ritmo", () => {
    // Gastó de más para marzo pero le queda presupuesto para el año.
    const apurada = filaDe("x", null, LINEA, anual, 400_000, 3);
    expect(sobreRitmo(apurada)).toBe(true);
    expect(presupuestoAgotado(apurada)).toBe(false);
  });
});

describe("totalizar", () => {
  it("reproduce los totales de la sección de inversión de la planilla", () => {
    const filas = [
      filaDe("a", null, LINEA, distribuirLineal(7_200_000), 0, 3),
      filaDe("b", null, LINEA, distribuirLineal(500_000), 0, 3),
      filaDe("c", null, LINEA, distribuirLineal(1_500_000), 0, 3),
      filaDe("d", null, LINEA, distribuirLineal(3_850_000), 497_568, 3),
    ];
    const t = totalizar(filas);
    // El anual sí es exacto: es lo que se comprometió y no puede bailar.
    expect(t.anual).toBe(13_050_000);
    expect(t.real).toBe(497_568);
    // El acumulado arrastra el reparto en enteros de cada línea — tres pesos sobre
    // 3,26 millones. La planilla llega a 3.262.500 calculando anual × 3/12.
    expect(t.ytd).toBeCloseTo(3_262_500, -1);
    expect(t.variacion).toBeCloseTo(-2_764_932, -1);
  });

  it("sin filas da ceros y avance nulo, no NaN", () => {
    expect(totalizar([])).toEqual({ anual: 0, ytd: 0, real: 0, variacion: 0, avance: null });
  });
});


describe("ajustarDesde", () => {
  // Doce meses de 400.000: 4,8M al año.
  const PAREJO = Array(12).fill(400_000) as Meses;

  it("no toca los meses que ya pasaron", () => {
    // Bajar el anual en octubre no puede cambiar lo que decía marzo: es el plan
    // contra el que se midió el gasto de marzo.
    const r = ajustarDesde(PAREJO, 4_200_000, 10);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.meses.slice(0, 9)).toEqual(Array(9).fill(400_000));
  });

  it("el anual queda exactamente en el número que se pidió", () => {
    const r = ajustarDesde(PAREJO, 4_200_000, 10);
    expect(r.ok && anualDe(r.meses)).toBe(4_200_000);
  });

  it("reparte entre los meses que quedan", () => {
    // 4,2M − 3,6M ya presupuestados a septiembre = 600.000 para tres meses.
    const r = ajustarDesde(PAREJO, 4_200_000, 10);
    expect(r.ok && r.meses.slice(9)).toEqual([200_000, 200_000, 200_000]);
  });

  it("puede dejar los meses que quedan en cero", () => {
    // Bajar a 3,6M en octubre consume todo el cupo restante. No es un error:
    // es exactamente lo que significa no tener más presupuesto en el año.
    const r = ajustarDesde(PAREJO, 3_600_000, 10);
    expect(r.ok && r.meses.slice(9)).toEqual([0, 0, 0]);
    expect(r.ok && anualDe(r.meses)).toBe(3_600_000);
  });

  it("avisa cuando el nuevo anual no alcanza, en vez de inventar meses negativos", () => {
    // A septiembre ya hay 3,6M presupuestados: pedir 3M es pedir que el pasado
    // valga menos, y eso solo se hace a mano y dejándolo dicho.
    const r = ajustarDesde(PAREJO, 3_000_000, 10);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.minimo).toBe(3_600_000);
  });

  it("conserva la forma del tramo: un aguinaldo en diciembre no se aplana", () => {
    // Sueldos: once meses iguales y diciembre al doble.
    const sueldos = [...Array(11).fill(1_000_000), 2_000_000] as Meses;
    const r = ajustarDesde(sueldos, 11_500_000, 11);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const [nov, dic] = [r.meses[10]!, r.meses[11]!];
    // Quedan 1,5M para noviembre y diciembre, repartidos 1:2 como estaban.
    expect(nov + dic).toBe(1_500_000);
    expect(dic).toBeGreaterThan(nov);
  });

  it("si el tramo venía en cero reparte parejo: no hay forma que conservar", () => {
    const sinCola = [...Array(9).fill(300_000), 0, 0, 0] as Meses;
    const r = ajustarDesde(sinCola, 3_000_000, 10);
    expect(r.ok && r.meses.slice(9)).toEqual([100_000, 100_000, 100_000]);
  });

  it("desde enero mueve el año entero", () => {
    const r = ajustarDesde(PAREJO, 2_400_000, 1);
    expect(r.ok && anualDe(r.meses)).toBe(2_400_000);
    expect(r.ok && r.meses.every((m) => m === 200_000)).toBe(true);
  });

  it("el redondeo no se pierde: la suma de los doce da el anual pedido", () => {
    // 1.000.001 entre tres meses no es divisible: el resto tiene que caer en
    // algún mes, no evaporarse.
    const r = ajustarDesde(PAREJO, 3_600_000 + 1_000_001, 10);
    expect(r.ok && anualDe(r.meses)).toBe(4_600_001);
  });

  it("toma el anual en magnitud: el presupuesto se escribe sin signo (§4.6)", () => {
    const r = ajustarDesde(PAREJO, -4_200_000, 10);
    expect(r.ok && anualDe(r.meses)).toBe(4_200_000);
  });
});


describe("el presupuesto distingue la subcategoría", () => {
  // Antes todo se agrupaba por categoría y las líneas de subcategoría se plegaban
  // dentro de su madre en silencio: no fallaba nada, solo daba otro número.
  const conSub = (sub: string | null, monto: number): Movimiento =>
    mov({
      estado: "conciliado",
      fecha: "2026-02-10",
      monto,
      lineas: [
        { categoria_id: "jornadas-y-eventos-organizacion", subcategoria_id: sub, doc_tipo: null, monto, glosa: null },
      ],
    });

  it("el gasto de una subcategoría no se suma al de su categoría", () => {
    const e = ejecutadoPorClave(
      [conSub(null, -100), conSub("offsite-internacional", -40)],
      2026,
      12,
      TC
    );
    expect(e.get("jornadas-y-eventos-organizacion")).toBe(100);
    expect(e.get("jornadas-y-eventos-organizacion>offsite-internacional")).toBe(40);
  });

  it("la fila lleva su clave, que es por donde se busca el ejecutado", () => {
    const propia = filaDe("cat", null, LINEA, distribuirLineal(0), 0, 3);
    const hija = filaDe("cat", "sub", LINEA, distribuirLineal(0), 0, 3);
    expect(propia.clave).toBe("cat");
    expect(hija.clave).toBe("cat>sub");
    expect(hija.subcategoria_id).toBe("sub");
  });
});


describe("ultimosDoceMeses", () => {
  it("termina en el último mes cerrado, no en el que corre", () => {
    // El mes en curso está a medias: incluirlo haría que la base dependa del día
    // en que uno aprieta el botón.
    expect(ultimosDoceMeses("2026-10-21")).toEqual({
      desde: "2025-10-01",
      hasta: "2026-09-30",
    });
  });

  it("en enero la ventana es el año anterior completo", () => {
    expect(ultimosDoceMeses("2027-01-15")).toEqual({
      desde: "2026-01-01",
      hasta: "2026-12-31",
    });
  });

  it("siempre cubre doce meses y ni uno más", () => {
    for (const hoy of ["2026-01-05", "2026-08-20", "2026-10-21", "2026-12-31"]) {
      expect(mesesRepetidos(ultimosDoceMeses(hoy))).toBe(0);
    }
  });
});

describe("ventanaPara", () => {
  it("un año que todavía no empezó se arma con los doce meses cerrados", () => {
    // Tomar su propio año no daría nada: no hay movimientos en 2027 todavía.
    expect(ventanaPara(2027, "2026-10-21")).toEqual(ultimosDoceMeses("2026-10-21"));
  });

  it("el año en curso se arma con su propio año", () => {
    expect(ventanaPara(2026, "2026-10-21")).toEqual({
      desde: "2026-01-01",
      hasta: "2026-12-31",
    });
  });
});

describe("mesesRepetidos", () => {
  it("un rango de doce meses no repite ninguno", () => {
    expect(mesesRepetidos({ desde: "2025-10-01", hasta: "2026-09-30" })).toBe(0);
  });

  it("uno de catorce repite dos, y el anual saldría inflado", () => {
    // Cada movimiento cae en su mes del calendario sin importar el año, así que
    // un rango largo suma el mismo mes dos veces sin que nada falle.
    expect(mesesRepetidos({ desde: "2025-08-01", hasta: "2026-09-30" })).toBe(2);
  });
});

describe("distribucionOperativa", () => {
  const operativa = () => true;

  it("cada movimiento cae en su mes del calendario, venga del año que venga", () => {
    // Es lo que permite armar 2027 antes de que 2026 termine: noviembre sale de
    // 2025 y marzo de 2026, y los dos aterrizan en su mes.
    const d = distribucionOperativa(
      [
        mov({ id: "1", estado: "conciliado", fecha: "2025-11-20", monto: -500 }),
        mov({ id: "2", estado: "conciliado", fecha: "2026-03-10", monto: -300 }),
      ],
      { desde: "2025-10-01", hasta: "2026-09-30" },
      operativa,
      TC
    );
    const meses = d.get("sueldos") ?? [];
    expect(meses[10]).toBe(500);
    expect(meses[2]).toBe(300);
  });

  it("el reajuste sube cada mes sin aplanar la forma", () => {
    const d = distribucionOperativa(
      [
        mov({ id: "1", estado: "conciliado", fecha: "2026-01-10", monto: -1000 }),
        mov({ id: "2", estado: "conciliado", fecha: "2026-02-10", monto: -3000 }),
      ],
      { desde: "2026-01-01", hasta: "2026-12-31" },
      operativa,
      TC,
      1.05
    );
    const meses = d.get("sueldos") ?? [];
    expect(meses[0]).toBe(1050);
    expect(meses[1]).toBe(3150);
    // Febrero sigue pesando el triple que enero.
    expect(meses[1]! / meses[0]!).toBeCloseTo(3);
  });
});
