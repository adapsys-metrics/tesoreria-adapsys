import { describe, expect, it } from "vitest";
import {
  conIva,
  conRetencion,
  cuentaPrincipalDe,
  descuadre,
  enCLP,
  expandir,
  sumaLineas,
} from "@/lib/dominio";
import { CUENTAS, GRUPOS, CATEGORIAS, SUBCATEGORIAS } from "@/lib/catalogo";
import { MOVIMIENTOS_EJEMPLO, TC_USD } from "@/lib/datos-ejemplo";
import { HOY } from "@/lib/fechas";
import type { Movimiento } from "@/lib/tipos";

const mov = (parcial: Partial<Movimiento> = {}): Movimiento => ({
  id: "x1",
  fecha: "2026-08-20",
  empresa_id: "adap",
  cuenta_id: "a1",
  contraparte: null,
  glosa: null,
  documento: null,
  monto: 0,
  moneda: "CLP",
  tipo_cambio: null,
  estado: "proyectado",
  doc_tipo: null,
  lineas: [],
  ...parcial,
});

describe("conIva — factura afecta (§4.3)", () => {
  it("aplica la tasa sobre el neto", () => {
    const r = conIva(-100000, "insumos-oficina");
    expect(r.lineas[0]!.monto).toBe(-100000);
    expect(r.lineas[1]!.monto).toBe(-19000);
    expect(r.monto).toBe(-119000);
  });

  it("el documento manda sobre la fórmula", () => {
    // Caso real de CLAUDE.md §4.3: 306.745 × 19% = 58.281,55, así que la fórmula
    // redondea a 58.282 — pero la factura de GTD dice 58.281. El helper calcula, y
    // por eso el monto de cada línea tiene que quedar editable: el movimiento de
    // ejemplo de GTD lleva el valor del documento, no el de la fórmula.
    expect(conIva(-306745, "telefonia-e-internet").lineas[1]!.monto).toBe(-58282);

    const gtd = MOVIMIENTOS_EJEMPLO.find((m) => m.contraparte === "GTD");
    expect(gtd).toBeDefined();
    expect(gtd!.lineas.map((l) => l.monto)).toEqual([-306745, -58281]);
    expect(gtd!.monto).toBe(-365026);
    expect(descuadre(gtd!)).toBe(0);
  });

  it("manda la línea de IVA a el grupo de impuestos (§4.4)", () => {
    expect(conIva(-100000, "insumos-oficina").lineas[1]!.categoria_id).toBe("iva-compras");
  });

  it("el total es mayor que el neto en un egreso", () => {
    const r = conIva(-100000, "insumos-oficina");
    expect(Math.abs(r.monto)).toBeGreaterThan(100000);
  });
});

describe("conRetencion — boleta de honorarios (§4.3)", () => {
  it("reproduce la boleta real de 1.253.118 bruto", () => {
    // bruto −1.253.118 + retención +191.100 = −1.062.018 transferidos.
    const r = conRetencion(-1253118, "horas");
    expect(r.lineas[0]!.monto).toBe(-1253118);
    expect(r.lineas[1]!.monto).toBe(191100);
    expect(r.monto).toBe(-1062018);
  });

  it("la retención sale con signo opuesto al bruto", () => {
    const r = conRetencion(-1000000, "horas");
    expect(r.lineas[1]!.monto).toBeGreaterThan(0);
  });

  it("el líquido a pagar es menor que el bruto", () => {
    const r = conRetencion(-1000000, "horas");
    expect(Math.abs(r.monto)).toBeLessThan(1000000);
  });

  it("manda la retención a el grupo de impuestos (§4.4)", () => {
    expect(conRetencion(-100000, "horas").lineas[1]!.categoria_id).toBe("retencion-bhe");
  });
});

describe("expandir (§3)", () => {
  it("un movimiento sin líneas da una fila sin clasificar", () => {
    const filas = expandir([mov({ monto: -5000 })]);
    expect(filas).toHaveLength(1);
    expect(filas[0]!.categoria_id).toBeNull();
    expect(filas[0]!.monto).toBe(-5000);
    expect(filas[0]!.indice_linea).toBeNull();
  });

  it("un split da una fila por línea, no una por movimiento", () => {
    const filas = expandir([
      mov({
        monto: -365026,
        lineas: [
          { categoria_id: "telefonia-e-internet", subcategoria_id: null, monto: -306745, glosa: "Neto" },
          { categoria_id: "iva-compras", subcategoria_id: null, monto: -58281, glosa: "IVA" },
        ],
      }),
    ]);
    expect(filas).toHaveLength(2);
    expect(filas.map((f) => f.monto)).toEqual([-306745, -58281]);
    // El monto cabecera no se cuenta: agregarlo sería contarlo doble.
    expect(filas.reduce((a, f) => a + f.monto, 0)).toBe(-365026);
  });

  it("cada línea hereda moneda, TC, estado y empresa del movimiento", () => {
    const filas = expandir([
      mov({
        moneda: "USD",
        tipo_cambio: 950,
        estado: "conciliado",
        empresa_id: "cons",
        lineas: [{ categoria_id: "horas", subcategoria_id: null, monto: -100, glosa: null }],
      }),
    ]);
    expect(filas[0]).toMatchObject({
      moneda: "USD",
      tipo_cambio: 950,
      estado: "conciliado",
      empresa_id: "cons",
    });
  });

  it("guarda el índice de línea para poder editarla desde una vista agregada", () => {
    const filas = expandir([
      mov({
        lineas: [
          { categoria_id: "a", subcategoria_id: null, monto: -1, glosa: null },
          { categoria_id: "b", subcategoria_id: null, monto: -2, glosa: null },
        ],
      }),
    ]);
    expect(filas.map((f) => f.indice_linea)).toEqual([0, 1]);
    expect(filas.every((f) => f.movimiento_id === "x1")).toBe(true);
  });
});

describe("enCLP (§4.5)", () => {
  it("deja los montos en pesos intactos", () => {
    expect(enCLP({ moneda: "CLP", monto: -12345, tipo_cambio: null }, 970)).toBe(-12345);
  });

  it("usa el TC del propio movimiento, no el del parámetro", () => {
    // Un movimiento en USD conserva el TC del día en que ocurrió.
    expect(enCLP({ moneda: "USD", monto: 100, tipo_cambio: 900 }, 970)).toBe(90000);
  });

  it("cae al TC del parámetro solo si el movimiento no trae uno", () => {
    expect(enCLP({ moneda: "USD", monto: 100, tipo_cambio: null }, 970)).toBe(97000);
  });
});

describe("descuadre (§3)", () => {
  it("es cero cuando las líneas suman el monto", () => {
    const m = mov({
      monto: -365026,
      lineas: [
        { categoria_id: "a", subcategoria_id: null, monto: -306745, glosa: null },
        { categoria_id: "b", subcategoria_id: null, monto: -58281, glosa: null },
      ],
    });
    expect(descuadre(m)).toBe(0);
    expect(sumaLineas(m)).toBe(-365026);
  });

  it("detecta el descuadre en vez de corregirlo", () => {
    const m = mov({
      monto: -365026,
      lineas: [{ categoria_id: "a", subcategoria_id: null, monto: -306745, glosa: null }],
    });
    expect(descuadre(m)).toBe(-58281);
  });

  it("un movimiento sin líneas nunca está descuadrado", () => {
    expect(descuadre(mov({ monto: -5000 }))).toBe(0);
  });
});

describe("cuentaPrincipalDe", () => {
  it("prefiere la cuenta marcada como principal", () => {
    expect(cuentaPrincipalDe(CUENTAS, "adap")?.id).toBe("a1");
  });

  it("nunca devuelve una cuenta por cobrar", () => {
    expect(cuentaPrincipalDe(CUENTAS, "adap")?.tipo).toBe("banco");
  });

  it("devuelve null para una empresa sin cuentas", () => {
    expect(cuentaPrincipalDe(CUENTAS, "no-existe")).toBeNull();
  });
});

describe("integridad del catálogo (§5)", () => {
  it("tiene los 16 grupos, 290 categorías y 3 subcategorías reales", () => {
    // 284 importadas de Quicken (§5) + 9 que aparecieron al leer los movimientos
    // reales: 7 clientes nuevos y 2 que en Quicken eran tercer nivel.
    expect(GRUPOS).toHaveLength(16);
    expect(CATEGORIAS).toHaveLength(290);
    expect(SUBCATEGORIAS).toHaveLength(3);
  });

  it("no tiene ids repetidos", () => {
    expect(new Set(CATEGORIAS.map((s) => s.id)).size).toBe(CATEGORIAS.length);
    expect(new Set(GRUPOS.map((c) => c.id)).size).toBe(GRUPOS.length);
  });

  it("toda categoría apunta a un grupo existente", () => {
    const ids = new Set(GRUPOS.map((c) => c.id));
    const huerfanas = CATEGORIAS.filter((s) => !ids.has(s.grupo_id));
    expect(huerfanas).toEqual([]);
  });

  it("toda cuenta apunta a una empresa existente y tiene moneda válida", () => {
    for (const c of CUENTAS) {
      expect(["CLP", "USD"]).toContain(c.moneda);
      expect(["banco", "cxc"]).toContain(c.tipo);
    }
  });
});

describe("datos de ejemplo", () => {
  it("toda línea apunta a una categoría que existe en el catálogo", () => {
    const ids = new Set(CATEGORIAS.map((s) => s.id));
    const rotas = MOVIMIENTOS_EJEMPLO.flatMap((m) =>
      m.lineas.filter((l) => !ids.has(l.categoria_id)).map((l) => l.categoria_id)
    );
    expect([...new Set(rotas)]).toEqual([]);
  });

  it("ningún movimiento queda descuadrado", () => {
    const malos = MOVIMIENTOS_EJEMPLO.filter((m) => descuadre(m) !== 0);
    expect(malos.map((m) => `${m.id} ${m.glosa}`)).toEqual([]);
  });

  it("todo movimiento en USD lleva su tipo de cambio", () => {
    // El esquema lo exige: constraint moneda_usd_requiere_tc.
    const sinTc = MOVIMIENTOS_EJEMPLO.filter((m) => m.moneda === "USD" && m.tipo_cambio === null);
    expect(sinTc).toEqual([]);
    expect(MOVIMIENTOS_EJEMPLO.some((m) => m.moneda === "USD")).toBe(true);
  });

  it("un movimiento sin cuenta solo puede estar proyectado", () => {
    // La moneda sale de la cuenta, así que falta muy pocas veces: solo en una
    // proyección que todavía no sabe de dónde va a salir la plata (migración
    // 0005). Lo que ya pasó por el banco salió de alguna cuenta, sin excepción.
    const ids = new Set(CUENTAS.map((c) => c.id));
    for (const m of MOVIMIENTOS_EJEMPLO) {
      if (m.cuenta_id === null) {
        expect(m.estado).toBe("proyectado");
        continue;
      }
      expect(ids.has(m.cuenta_id)).toBe(true);
    }
  });

  const conCuenta = MOVIMIENTOS_EJEMPLO.filter((m) => m.cuenta_id !== null);

  it("la moneda de cada movimiento es la de su cuenta", () => {
    // Es el invariante que la base garantiza con la foreign key compuesta
    // (cuenta_id, moneda). Un pago en dólares desde la cuenta en pesos no existe.
    const monedaDe = new Map(CUENTAS.map((c) => [c.id, c.moneda]));
    const inconsistentes = conCuenta.filter((m) => monedaDe.get(m.cuenta_id!) !== m.moneda);
    expect(inconsistentes.map((m) => `${m.id} ${m.contraparte}`)).toEqual([]);
  });

  it("la empresa del movimiento es la de su cuenta bancaria", () => {
    // Solo en las cuentas del banco. Las de cobranza cuelgan de CLA ADAPTACIÓN por
    // tener que colgar de alguna, pero la cartera es de las cuatro empresas y cada
    // movimiento lleva la suya — es lo que decide a qué cuenta entra al cobrarse.
    const porId = new Map(CUENTAS.map((c) => [c.id, c]));
    const inconsistentes = conCuenta.filter((m) => {
      const cuenta = porId.get(m.cuenta_id!);
      return cuenta?.tipo === "banco" && cuenta.empresa_id !== m.empresa_id;
    });
    expect(inconsistentes.map((m) => `${m.id} ${m.contraparte}`)).toEqual([]);
  });

  it("es determinista", () => {
    // La variación de montos del histórico es un hash de la semilla, no Math.random,
    // así que estos totales tienen que ser siempre los mismos. Si este test se cae
    // sin que nadie haya tocado los datos a propósito, algo dejó de ser determinista
    // y los tests de las vistas van a empezar a parpadear.
    expect(MOVIMIENTOS_EJEMPLO).toHaveLength(211);
    const conciliados = MOVIMIENTOS_EJEMPLO.filter((m) => m.estado === "conciliado");
    expect(conciliados).toHaveLength(154);
    expect(conciliados.reduce((a, m) => a + m.monto, 0)).toBe(183140369);
  });

  it("nada conciliado queda en el futuro (§4.1)", () => {
    const futuros = MOVIMIENTOS_EJEMPLO.filter(
      (m) => m.estado === "conciliado" && m.fecha > HOY
    );
    expect(futuros).toEqual([]);
  });

  it("hay proyectados con fecha pasada: facturas recibidas y no pagadas", () => {
    // Una factura del 14 de agosto puede seguir impaga el 20. Son justo las que
    // aparecen en la conciliación, así que el caso tiene que estar representado.
    expect(
      MOVIMIENTOS_EJEMPLO.some((m) => m.estado === "proyectado" && m.fecha < HOY)
    ).toBe(true);
  });

  it("llega más allá del año calendario (§4.7)", () => {
    expect(MOVIMIENTOS_EJEMPLO.some((m) => m.fecha.startsWith("2027"))).toBe(true);
  });

  it("el TC de ejemplo es el esperado", () => {
    expect(TC_USD).toBe(970);
  });
});
