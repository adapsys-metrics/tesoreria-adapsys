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
  // El seed va antes que 0003 porque 0003 inserta catálogo y necesita las
  // categorías. Sobre una base recién sembrada sus inserts no encuentran nada
  // que agregar, lo que de paso verifica que se puede correr dos veces.
  await db.exec(leer("seed.sql"));
  await db.exec(leer("migrations/0003_migracion_quicken.sql"));
  await db.exec(leer("migrations/0004_tc_no_va_en_el_movimiento.sql"));
  await db.exec(leer("migrations/0005_proyeccion_sin_cuenta.sql"));
  await db.exec(leer("migrations/0006_vista_sin_clasificar_con_origen.sql"));
}, 60_000);

const contar = async (tabla: string): Promise<number> => {
  const r = await db.query<{ n: number }>(`select count(*)::int as n from ${tabla}`);
  return r.rows[0]!.n;
};

describe("migraciones y seed", () => {
  it("carga el catálogo real completo (§5)", async () => {
    expect(await contar("empresas")).toBe(5);
    // 9 de banco + 4 auxiliares (facturas por cobrar y proyectos aprobados,
    // CLP y USD cada una).
    expect(await contar("cuentas")).toBe(13);
    expect(await contar("categorias")).toBe(16);
    // 284 del catálogo original + 9 que aparecieron en los movimientos reales.
    expect(await contar("subcategorias")).toBe(293);
    expect(await contar("parametros")).toBe(3);
  });

  it("deja registrar un movimiento sin empresa (la bolsa de proyección)", async () => {
    expect(
      await intentar(
        `insert into movimientos (fecha, cuenta_id, monto, moneda, origen)
         values ('2026-09-14', 'a1', -365000, 'CLP', 'prueba-bolsa')`
      )
    ).toBeNull();
    // Se limpia: los tests commitean de verdad, y el de la carga cuenta por
    // `origen is not null`.
    await db.exec(`delete from movimientos where origen = 'prueba-bolsa'`);
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

  it("acepta un movimiento en dólares sin tipo de cambio", async () => {
    // Las cuentas en dólares se llevan en dólares: reflejan la cartola, donde no
    // hay conversión. El TC es un parámetro del presupuesto (§4.6), no un dato
    // del movimiento — exigirlo obligaba a inventarlo para 390 movimientos
    // históricos que nunca lo tuvieron.
    expect(
      await intentar(
        `insert into movimientos (fecha, empresa_id, cuenta_id, monto, moneda)
         values ('2026-08-20', 'adap', 'a2', -100, 'USD')`
      )
    ).toBeNull();
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

describe("la carga del histórico de Quicken", () => {
  // Prueba el camino completo de carga/1_crear_staging.sql + carga/2_promover.sql
  // con los tres casos que tiene el archivo real: un split que cuadra, un
  // movimiento sin clasificar y la provisión sin empresa ni cuenta.
  it("promueve staging a movimientos y líneas en una sola transacción", async () => {
    await db.exec(leer("carga/1_crear_staging.sql"));
    await db.exec(`
      insert into carga_movimientos (ref, fecha, empresa_id, cuenta_id, contraparte, glosa, monto, moneda, estado, origen) values
        ('q1', '2026-08-14', 'adap', 'a1', 'GTD', 'FA3109609', -365026, 'CLP', 'conciliado', 'a1.csv'),
        ('q2', '2026-08-13', 'adap', 'a1', 'Sin clasificar', '', -5000, 'CLP', 'conciliado', 'a1.csv'),
        ('q3', '2026-12-29', '', '', 'GAP IMA 2026', 'GAP IMA 2026', -100000000, 'CLP', 'proyectado', 'proy-egresos-clp.csv');
      insert into carga_lineas (mov_ref, subcategoria_id, monto, glosa, orden) values
        ('q1', 'telefonia-e-internet', -306745, 'Internet oficina', 0),
        ('q1', 'iva-compras', -58281, 'Internet oficina', 1),
        ('q3', 'ingreso-minimo-asegurado', -100000000, 'GAP IMA 2026', 0);
    `);

    // El promover corre begin/commit adentro: es donde se evalúa la constraint
    // diferida que valida el split. Si fallara, la transacción queda abierta y
    // abortada, y todo lo que venga después falla con un error que no dice nada
    // ("current transaction is aborted") — por eso el rollback antes de relanzar.
    try {
      await db.exec(leer("carga/2_promover.sql"));
    } catch (e) {
      await db.exec("rollback").catch(() => {});
      throw e;
    }

    const cargados = await db.query<{ n: number }>(
      `select count(*)::int as n from movimientos where origen is not null`
    );
    expect(cargados.rows[0]!.n).toBe(3);

    const gtd = await db.query<{ lineas: number; monto: string }>(
      `select count(ml.id)::int as lineas, m.monto::text as monto
       from movimientos m join movimiento_lineas ml on ml.movimiento_id = m.id
       where m.contraparte = 'GTD' group by m.monto`
    );
    expect(gtd.rows[0]).toEqual({ lineas: 2, monto: "-365026" });

    // El sin clasificar entra sin líneas y queda visible para reasignarlo (§11).
    const pendientes = await db.query<{ contraparte: string }>(
      `select contraparte from v_movimientos_sin_clasificar where origen = 'a1.csv'`
    );
    expect(pendientes.rows).toEqual([{ contraparte: "Sin clasificar" }]);

    // La provisión entra con empresa y cuenta en null, sin inventarle ninguna.
    const bolsa = await db.query<{ empresa_id: null; cuenta_id: null }>(
      `select empresa_id, cuenta_id from movimientos where contraparte = 'GAP IMA 2026'`
    );
    expect(bolsa.rows[0]).toEqual({ empresa_id: null, cuenta_id: null });

    // Las tablas de paso se borran solas.
    const quedan = await db.query<{ n: number }>(
      `select count(*)::int as n from information_schema.tables
       where table_name in ('carga_movimientos', 'carga_lineas')`
    );
    expect(quedan.rows[0]!.n).toBe(0);

    await db.exec(`delete from movimientos where origen is not null`);
  });

  it("se niega a promover tablas de paso vacías", async () => {
    // Sin la guarda esto "funcionaba": cero filas insertadas, tablas de paso
    // borradas y ningún aviso. El siguiente intento fallaba con "la relación
    // carga_movimientos no existe", que no dice nada sobre la causa real.
    await db.exec(leer("carga/1_crear_staging.sql"));
    let error: string | null = null;
    try {
      await db.exec(leer("carga/2_promover.sql"));
    } catch (e) {
      await db.exec("rollback").catch(() => {});
      error = (e as Error).message;
    }
    expect(error).toMatch(/tablas de paso están vacías/);

    // Y no se llevó por delante las tablas de paso: siguen ahí para importar.
    const quedan = await db.query<{ n: number }>(
      `select count(*)::int as n from information_schema.tables
       where table_name in ('carga_movimientos', 'carga_lineas')`
    );
    expect(quedan.rows[0]!.n).toBe(2);
    await db.exec(`drop table carga_lineas; drop table carga_movimientos;`);
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
