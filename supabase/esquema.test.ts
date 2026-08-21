// Corre las migraciones y el seed contra un Postgres de verdad (pglite, el mismo
// motor compilado a WASM) y verifica que las reglas del modelo se cumplan en la base
// y no solo en la UI, como pide CLAUDE.md §3.
//
// Vale doble en este proyecto: nadie del equipo tiene Postgres instalado, así que sin
// esto la única forma de saber si una migración corre sería aplicarla en Supabase y
// ver qué explota.

import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const AQUI = dirname(fileURLToPath(import.meta.url));
const leer = (ruta: string) => readFileSync(join(AQUI, ruta), "utf8");

let db: PGlite;

/** Ejecuta en una transacción y devuelve el error si lo hubo.
 *  Es importante commitear: la validación de que las líneas cuadran es una
 *  constraint trigger DIFERIDA, así que recién se evalúa al cerrar la transacción.
 *  Probarla con rollback la saltearía y daría un falso verde. */
async function intentar(sql: string): Promise<string | null> {
  try {
    await db.exec("begin");
    await db.exec(sql);
    await db.exec("commit");
    return null;
  } catch (e) {
    await db.exec("rollback").catch(() => {});
    return (e as Error).message;
  }
}

beforeAll(async () => {
  db = new PGlite();
  // Supabase trae el esquema `auth`; acá se emula lo mínimo que las migraciones
  // referencian (auth.users para las FK, auth.jwt/uid para las políticas de RLS).
  await db.exec(`
    create schema if not exists auth;
    create table auth.users (id uuid primary key default gen_random_uuid(), email text);
    create or replace function auth.jwt() returns jsonb as $$
      select coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb;
    $$ language sql stable;
    create or replace function auth.uid() returns uuid as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$ language sql stable;
  `);
  await db.exec(leer("migrations/0001_esquema.sql"));
  await db.exec(leer("migrations/0002_rls.sql"));
  await db.exec(leer("seed.sql"));
}, 60_000);

const contar = async (tabla: string): Promise<number> => {
  const r = await db.query<{ n: number }>(`select count(*)::int as n from ${tabla}`);
  return r.rows[0]!.n;
};

describe("migraciones y seed", () => {
  it("carga el catálogo real completo (§5)", async () => {
    expect(await contar("empresas")).toBe(5);
    expect(await contar("cuentas")).toBe(11);
    expect(await contar("categorias")).toBe(16);
    expect(await contar("subcategorias")).toBe(284);
    expect(await contar("parametros")).toBe(3);
  });

  it("deja las tres vistas consultables", async () => {
    for (const v of [
      "v_lineas_expandidas",
      "v_movimientos_sin_clasificar",
      "v_lineas_categoria_inactiva",
    ]) {
      await expect(db.query(`select * from ${v} limit 1`)).resolves.toBeDefined();
    }
  });
});

describe("la moneda es la de la cuenta (§4.5)", () => {
  it("acepta un movimiento en pesos desde la cuenta en pesos", async () => {
    expect(
      await intentar(
        `insert into movimientos (fecha, empresa_id, cuenta_id, monto, moneda)
         values ('2026-08-20', 'adap', 'a1', -1000, 'CLP')`
      )
    ).toBeNull();
  });

  it("rechaza un movimiento en dólares desde la cuenta en pesos", async () => {
    // El estado que motivó la foreign key compuesta: no existe en la realidad.
    expect(
      await intentar(
        `insert into movimientos (fecha, empresa_id, cuenta_id, monto, moneda, tipo_cambio)
         values ('2026-08-20', 'adap', 'a1', -100, 'USD', 970)`
      )
    ).toMatch(/movimientos_cuenta_moneda_fk/);
  });

  it("rechaza un movimiento en dólares sin tipo de cambio", async () => {
    expect(
      await intentar(
        `insert into movimientos (fecha, empresa_id, cuenta_id, monto, moneda)
         values ('2026-08-20', 'adap', 'a2', -100, 'USD')`
      )
    ).toMatch(/moneda_usd_requiere_tc/);
  });

  it("rechaza una cuenta que no existe", async () => {
    expect(
      await intentar(
        `insert into movimientos (fecha, empresa_id, cuenta_id, monto, moneda)
         values ('2026-08-20', 'adap', 'no-existe', -1000, 'CLP')`
      )
    ).toMatch(/foreign key/);
  });
});

describe("las líneas del split tienen que cuadrar (§3)", () => {
  const conLineas = (id: number, lineas: string) =>
    `insert into movimientos (id, fecha, empresa_id, cuenta_id, monto, moneda)
       overriding system value values (${id}, '2026-08-14', 'adap', 'a1', -365026, 'CLP');
     insert into movimiento_lineas (movimiento_id, subcategoria_id, monto) values ${lineas}`;

  it("acepta el split de GTD, que cuadra", async () => {
    expect(
      await intentar(
        conLineas(9001, `(9001, 'telefonia-e-internet', -306745), (9001, 'iva-compras', -58281)`)
      )
    ).toBeNull();
  });

  it("rechaza un split que no cuadra", async () => {
    expect(
      await intentar(conLineas(9002, `(9002, 'telefonia-e-internet', -306745)`))
    ).toMatch(/suman .* pero el movimiento es/);
  });

  it("rechaza que se descuadre al editar una línea", async () => {
    expect(
      await intentar(
        conLineas(9003, `(9003, 'telefonia-e-internet', -306745), (9003, 'iva-compras', -58281)`) +
          `; update movimiento_lineas set monto = -1
             where movimiento_id = 9003 and subcategoria_id = 'iva-compras'`
      )
    ).toMatch(/suman .* pero el movimiento es/);
  });

  it("rechaza que se descuadre al borrar una línea", async () => {
    expect(
      await intentar(
        conLineas(9004, `(9004, 'telefonia-e-internet', -306745), (9004, 'iva-compras', -58281)`) +
          `; delete from movimiento_lineas
             where movimiento_id = 9004 and subcategoria_id = 'iva-compras'`
      )
    ).toMatch(/suman .* pero el movimiento es/);
  });

  it("deja borrar el movimiento entero sin trabarse con sus líneas", async () => {
    expect(
      await intentar(
        conLineas(9005, `(9005, 'telefonia-e-internet', -306745), (9005, 'iva-compras', -58281)`) +
          `; delete from movimientos where id = 9005`
      )
    ).toBeNull();
  });

  it("tolera un peso de diferencia por redondeo", async () => {
    // 306.745 × 19% = 58.281,55: la fórmula y el documento pueden diferir en 1 (§4.3).
    expect(
      await intentar(
        conLineas(9006, `(9006, 'telefonia-e-internet', -306745), (9006, 'iva-compras', -58282)`)
      )
    ).toBeNull();
  });
});

describe("dominios cerrados", () => {
  it("rechaza un estado que no existe", async () => {
    expect(
      await intentar(
        `insert into movimientos (fecha, empresa_id, cuenta_id, monto, moneda, estado)
         values ('2026-08-20', 'adap', 'a1', -1000, 'CLP', 'inventado')`
      )
    ).toMatch(/estado_check/);
  });

  it("rechaza un grupo de empresa que no existe", async () => {
    // El seed decía 'Empresas relacionadas' y el check solo acepta 'Relacionadas':
    // este test existe porque ese desajuste ya rompió una vez.
    expect(
      await intentar(
        `insert into empresas (id, nombre, corto, grupo) values ('x', 'X', 'X', 'Empresas relacionadas')`
      )
    ).toMatch(/grupo_check/);
  });

  it("rechaza una naturaleza que no existe", async () => {
    expect(
      await intentar(
        `insert into subcategorias (id, categoria_id, nombre, naturaleza)
         values ('z', '4-impuestos', 'Z', 'inventada')`
      )
    ).toMatch(/naturaleza_check/);
  });
});
