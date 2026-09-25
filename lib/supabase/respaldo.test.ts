// El respaldo tiene que llevar TODO. Un respaldo al que le falta una tabla es peor que
// no tenerlo: se descubre el día que hay que restaurar.

import { describe, expect, it, vi } from "vitest";
import { armarRespaldo, filasDe, nombreDeArchivo, type Respaldo } from "@/lib/supabase/respaldo";

// Con las líneas anidadas, que es como PostgREST devuelve un movimiento: sin eso el
// lector de movimientos se cae al expandirlas.
const fila = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: String(i), movimiento_lineas: [] }));

/**
 * Un cliente de mentira. Cada consulta es encadenable y además esperable, que es como
 * se comporta la de supabase-js: `.select().order().range()` y `await` en cualquier
 * punto tienen que funcionar los dos.
 */
const clienteFalso = (pedidas: string[], error: { message: string } | null = null) =>
  ({
    from: (tabla: string) => {
      pedidas.push(tabla);
      const resultado = { data: error ? null : fila(1), error };
      const q: Record<string, unknown> = {};
      for (const m of ["select", "order", "eq", "range"]) q[m] = () => q;
      q.then = (ok: (r: typeof resultado) => unknown, mal?: (e: unknown) => unknown) =>
        Promise.resolve(resultado).then(ok, mal);
      return q;
    },
  }) as never;

describe("armarRespaldo", () => {
  it("pide todas las tablas del negocio", async () => {
    const pedidas: string[] = [];
    await armarRespaldo(clienteFalso(pedidas));
    // Si mañana se agrega una tabla y no entra acá, el respaldo queda incompleto en
    // silencio. Esta lista es la que hay que actualizar a propósito.
    for (const t of [
      "movimientos",
      "grupos",
      "categorias",
      "subcategorias",
      "empresas",
      "cuentas",
      "proveedores",
      "presupuesto",
      "presupuesto_meses",
      "parametros",
    ]) {
      expect(pedidas).toContain(t);
    }
  });

  it("lleva la versión del formato y cuándo se generó", async () => {
    const r = await armarRespaldo(clienteFalso([]));
    expect(r.version).toBe(1);
    expect(r.generado).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("falla fuerte si una tabla no responde", async () => {
    // Callar el error dejaría un archivo a medias que parece completo, y eso se
    // descubre el día que hay que restaurar.
    await expect(armarRespaldo(clienteFalso([], { message: "sin permisos" }))).rejects.toThrow(
      /sin permisos/
    );
  });
});

describe("nombreDeArchivo", () => {
  it("lleva la fecha, porque se van a acumular varios", () => {
    expect(nombreDeArchivo("2026-09-25T14:03:00.000Z")).toBe("tesoreria-respaldo-2026-09-25.json");
  });
});

describe("filasDe", () => {
  it("cuenta todo lo que lleva el archivo", () => {
    const r = {
      version: 1,
      generado: "",
      movimientos: fila(10),
      grupos: fila(16),
      categorias: fila(290),
      subcategorias: fila(3),
      empresas: fila(5),
      cuentas: fila(13),
      proveedores: fila(2),
      presupuesto: fila(4),
      presupuesto_meses: fila(48),
      parametros: fila(3),
    } as Respaldo;
    expect(filasDe(r)).toBe(10 + 16 + 290 + 3 + 5 + 13 + 2 + 4 + 48 + 3);
  });
});
