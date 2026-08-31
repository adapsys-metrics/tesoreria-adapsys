// Tests de la capa que habla con Supabase, con un cliente falso.
//
// El caso que más importa es la paginación. PostgREST corta en 1.000 filas y
// responde 200: si el bucle estuviera mal, la app cargaría 1.000 de 10.530
// movimientos, mostraría saldos incompletos y no fallaría en ningún lado. Es el
// error más caro posible en una herramienta de tesorería y el más difícil de ver.

import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { cargarMovimientos, esNuevo, guardarMovimiento } from "./datos";
import type { Movimiento } from "@/lib/tipos";

type Fila = Record<string, unknown>;

/** Cliente mínimo que imita la cadena .from().select().order().order().range() */
function clienteFalso(paginas: Fila[][], error?: string) {
  const rangos: [number, number][] = [];
  let llamada = 0;
  const cliente = {
    from: () => ({
      select: () => ({
        order: () => ({
          order: () => ({
            range: (desde: number, hasta: number) => {
              rangos.push([desde, hasta]);
              const data = paginas[llamada++] ?? [];
              return Promise.resolve(error ? { data: null, error: { message: error } } : { data, error: null });
            },
          }),
        }),
      }),
    }),
  } as unknown as SupabaseClient<Database>;
  return { cliente, rangos };
}

const filaCruda = (id: number, extra: Fila = {}): Fila => ({
  id,
  fecha: "2026-08-14",
  empresa_id: "adap",
  cuenta_id: "a1",
  contraparte: "GTD",
  glosa: null,
  monto: -365026,
  moneda: "CLP",
  tipo_cambio: null,
  estado: "conciliado",
  doc_tipo: null,
  movimiento_lineas: [],
  ...extra,
});

describe("cargarMovimientos", () => {
  it("sigue pidiendo páginas hasta que una viene incompleta", async () => {
    const llenas = Array.from({ length: 1000 }, (_, i) => filaCruda(i + 1));
    const ultima = Array.from({ length: 530 }, (_, i) => filaCruda(2001 + i));
    const { cliente, rangos } = clienteFalso([llenas, llenas, ultima]);

    const movs = await cargarMovimientos(cliente);

    expect(movs).toHaveLength(2530);
    expect(rangos).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });

  it("para cuando la primera página ya viene incompleta", async () => {
    const { cliente, rangos } = clienteFalso([[filaCruda(1)]]);
    expect(await cargarMovimientos(cliente)).toHaveLength(1);
    expect(rangos).toHaveLength(1);
  });

  it("no confunde una tabla vacía con un error", async () => {
    const { cliente } = clienteFalso([[]]);
    expect(await cargarMovimientos(cliente)).toEqual([]);
  });

  it("lanza con el mensaje de la base si la consulta falla", async () => {
    const { cliente } = clienteFalso([[]], "permission denied for table movimientos");
    await expect(cargarMovimientos(cliente)).rejects.toThrow(/permission denied/);
  });

  it("convierte a número los numeric que llegan como string", async () => {
    // Postgres `numeric` puede llegar como string. Si no se convierte, los montos
    // se concatenan en vez de sumarse y el total sale absurdo sin ningún error.
    const { cliente } = clienteFalso([
      [
        filaCruda(1, {
          monto: "-365026.00",
          tipo_cambio: "970.5",
          movimiento_lineas: [
            { subcategoria_id: "iva-compras", monto: "-58281.00", glosa: null, orden: 1 },
          ],
        }),
      ],
    ]);
    const [m] = await cargarMovimientos(cliente);
    expect(m!.monto).toBe(-365026);
    expect(m!.tipo_cambio).toBe(970.5);
    expect(m!.lineas[0]!.monto).toBe(-58281);
  });

  it("ordena las líneas por `orden` y no por como vengan", async () => {
    // El orden es dato: el IVA va después del neto. PostgREST no promete ningún
    // orden en un embed.
    const { cliente } = clienteFalso([
      [
        filaCruda(1, {
          movimiento_lineas: [
            { subcategoria_id: "iva-compras", monto: -58281, glosa: null, orden: 1 },
            { subcategoria_id: "telefonia-e-internet", monto: -306745, glosa: null, orden: 0 },
          ],
        }),
      ],
    ]);
    const [m] = await cargarMovimientos(cliente);
    expect(m!.lineas.map((l) => l.subcategoria_id)).toEqual([
      "telefonia-e-internet",
      "iva-compras",
    ]);
  });

  it("deja el id como string y la empresa/cuenta en null cuando faltan", async () => {
    const { cliente } = clienteFalso([[filaCruda(42, { empresa_id: null, cuenta_id: null })]]);
    const [m] = await cargarMovimientos(cliente);
    expect(m!.id).toBe("42");
    expect(m!.empresa_id).toBeNull();
    expect(m!.cuenta_id).toBeNull();
  });
});

describe("guardarMovimiento", () => {
  const base: Movimiento = {
    id: "42",
    fecha: "2026-08-14",
    empresa_id: "adap",
    cuenta_id: "a1",
    contraparte: "GTD",
    glosa: null,
    monto: -365026,
    moneda: "CLP",
    tipo_cambio: null,
    estado: "conciliado",
    doc_tipo: null,
    lineas: [{ subcategoria_id: "telefonia-e-internet", monto: -365026, glosa: null }],
  };

  const conRpc = (respuesta: { data?: unknown; error?: { message: string } }) => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null, ...respuesta });
    return { cliente: { rpc } as unknown as SupabaseClient<Database>, rpc };
  };

  it("manda el id cuando el movimiento ya existe, para que actualice", async () => {
    const { cliente, rpc } = conRpc({ data: 42 });
    expect(await guardarMovimiento(cliente, base)).toBe("42");
    expect(rpc.mock.calls[0]![1].p).toMatchObject({ id: "42", monto: -365026 });
  });

  it("omite el id cuando el movimiento es nuevo, para que inserte", async () => {
    // Los movimientos creados en la app llevan un id provisorio `n1`, `n2`…
    // Mandarlo haría que la función intentara actualizar una fila inexistente.
    const { cliente, rpc } = conRpc({ data: 7 });
    expect(await guardarMovimiento(cliente, { ...base, id: "n1" })).toBe("7");
    expect(rpc.mock.calls[0]![1].p).not.toHaveProperty("id");
  });

  it("lanza con el mensaje de la base si el guardado falla", async () => {
    const { cliente } = conRpc({ error: { message: "las líneas suman -1 pero el movimiento es -365026" } });
    await expect(guardarMovimiento(cliente, base)).rejects.toThrow(/las líneas suman/);
  });
});

describe("esNuevo", () => {
  it("distingue el id provisorio del que asigna la base", () => {
    expect(esNuevo("n1")).toBe(true);
    expect(esNuevo("42")).toBe(false);
  });
});
