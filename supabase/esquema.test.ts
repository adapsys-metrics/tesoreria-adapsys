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
  await db.exec(leer("migrations/0007_guardar_movimiento.sql"));
  await db.exec(leer("migrations/0008_numero_de_documento.sql"));
  await db.exec(leer("migrations/0009_usuarios_autorizados.sql"));
  await db.exec(leer("migrations/0010_presupuesto_mensual.sql"));
  await db.exec(leer("migrations/0011_categorias_fuera_del_control.sql"));
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
      insert into carga_movimientos (ref, fecha, empresa_id, cuenta_id, contraparte, glosa, documento, monto, moneda, estado, origen) values
        ('q1', '2026-08-14', 'adap', 'a1', 'GTD', 'Internet oficina', 'FA3109609', -365026, 'CLP', 'conciliado', 'a1.csv'),
        ('q2', '2026-08-13', 'adap', 'a1', 'Sin clasificar', '', '', -5000, 'CLP', 'conciliado', 'a1.csv'),
        ('q3', '2026-12-29', '', '', 'GAP IMA 2026', 'GAP IMA 2026', '', -100000000, 'CLP', 'proyectado', 'proy-egresos-clp.csv');
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

  it("promueve igual si el staging quedó con todas las columnas en text", async () => {
    // Es lo que arma el importador de CSV del Table Editor cuando crea la tabla
    // él mismo: todo text. Sin los casts explícitos el insert falla con "column
    // monto is of type numeric but expression is of type text".
    await db.exec(`
      create table carga_movimientos (
        ref text, fecha text, empresa_id text, cuenta_id text, contraparte text,
        glosa text, documento text, monto text, moneda text, estado text, origen text);
      create table carga_lineas (
        mov_ref text, subcategoria_id text, monto text, glosa text, orden text);
      insert into carga_movimientos values
        ('t1', '2026-08-14', 'adap', 'a1', 'GTD', 'Internet oficina', 'FA3109609', '-365026', 'CLP', 'conciliado', 'a1.csv');
      insert into carga_lineas values
        ('t1', 'telefonia-e-internet', '-306745', 'Internet oficina', '0'),
        ('t1', 'iva-compras', '-58281', 'Internet oficina', '1');
    `);
    try {
      await db.exec(leer("carga/2_promover.sql"));
    } catch (e) {
      await db.exec("rollback").catch(() => {});
      throw e;
    }
    const r = await db.query<{ monto: string; lineas: number }>(
      `select m.monto::text as monto, count(ml.id)::int as lineas
       from movimientos m join movimiento_lineas ml on ml.movimiento_id = m.id
       where m.origen = 'a1.csv' group by m.monto`
    );
    expect(r.rows[0]).toEqual({ monto: "-365026", lineas: 2 });
    await db.exec(`delete from movimientos where origen is not null`);
  });

  it("se puede volver a crear el staging sobre restos de un intento previo", async () => {
    // Un intento fallido puede dejar una de las dos tablas y la otra no; ahí el
    // create fallaba con "ya existe" y había que ir a borrarla a mano.
    await db.exec(leer("carga/1_crear_staging.sql"));
    await db.exec(`drop table carga_movimientos`); // deja solo carga_lineas
    await expect(db.exec(leer("carga/1_crear_staging.sql"))).resolves.toBeDefined();
    await db.exec(`drop table carga_lineas; drop table carga_movimientos;`);
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

describe("fn_guardar_movimiento", () => {
  const guardar = (p: object) =>
    intentar(`select fn_guardar_movimiento('${JSON.stringify(p).replace(/'/g, "''")}'::jsonb)`);

  const gtd = {
    fecha: "2026-08-14",
    empresa_id: "adap",
    cuenta_id: "a1",
    contraparte: "GTD",
    monto: -365026,
    moneda: "CLP",
    estado: "conciliado",
    lineas: [
      { subcategoria_id: "telefonia-e-internet", monto: -306745, glosa: "Internet oficina" },
      { subcategoria_id: "iva-compras", monto: -58281, glosa: "Internet oficina" },
    ],
  };

  it("crea el movimiento con sus líneas en una transacción", async () => {
    expect(await guardar(gtd)).toBeNull();
    const r = await db.query<{ n: number; monto: string }>(
      `select count(ml.id)::int as n, m.monto::text as monto
       from movimientos m join movimiento_lineas ml on ml.movimiento_id = m.id
       where m.contraparte = 'GTD' group by m.monto`
    );
    expect(r.rows[0]).toEqual({ n: 2, monto: "-365026" });
  });

  it("reemplaza las líneas al reclasificar, sin pasar por un estado descuadrado", async () => {
    // Es la razón de existir de la función: con delete e insert por separado, la
    // primera llamada dejaría el movimiento con una sola línea y la constraint
    // lo rechazaría antes de que llegara la segunda.
    const id = (
      await db.query<{ id: string }>(
        `select id::text as id from movimientos where contraparte = 'GTD'`
      )
    ).rows[0]!.id;

    expect(
      await guardar({
        ...gtd,
        id,
        lineas: [
          { subcategoria_id: "gastos-sistemas-digitales", monto: -306745, glosa: "reclasificado" },
          { subcategoria_id: "iva-compras", monto: -58281, glosa: "reclasificado" },
        ],
      })
    ).toBeNull();

    const subs = await db.query<{ subcategoria_id: string }>(
      `select subcategoria_id from movimiento_lineas
       where movimiento_id = ${id} order by orden`
    );
    expect(subs.rows.map((s) => s.subcategoria_id)).toEqual([
      "gastos-sistemas-digitales",
      "iva-compras",
    ]);
  });

  it("respeta el orden de las líneas que llega en el jsonb", async () => {
    // El orden es dato: el IVA va después del neto, la retención después del bruto.
    const id = (
      await db.query<{ id: string }>(
        `select id::text as id from movimientos where contraparte = 'GTD'`
      )
    ).rows[0]!.id;
    const r = await db.query<{ orden: number }>(
      `select orden from movimiento_lineas where movimiento_id = ${id} order by orden`
    );
    expect(r.rows.map((x) => x.orden)).toEqual([0, 1]);
  });

  it("sigue rechazando un split que no cuadra", async () => {
    expect(
      await guardar({
        ...gtd,
        contraparte: "GTD descuadrado",
        lineas: [{ subcategoria_id: "telefonia-e-internet", monto: -1, glosa: null }],
      })
    ).toMatch(/suman .* pero el movimiento es/);
  });

  it("deja el movimiento sin líneas cuando no se le pasa ninguna", async () => {
    // Así se representa "sin clasificar" (§3): no hay línea sin subcategoría.
    expect(
      await guardar({ ...gtd, contraparte: "Sin clasificar", lineas: [] })
    ).toBeNull();
    const r = await db.query<{ n: number }>(
      `select count(*)::int as n from v_movimientos_sin_clasificar
       where contraparte = 'Sin clasificar'`
    );
    expect(r.rows[0]!.n).toBe(1);
  });

  it("falla si el movimiento a actualizar no existe", async () => {
    expect(await guardar({ ...gtd, id: 999999 })).toMatch(/No existe el movimiento/);
  });

  it("guarda el número del documento y deja buscar por él", async () => {
    expect(await guardar({ ...gtd, contraparte: "GTD con documento", documento: "FA3109609" }))
      .toBeNull();
    const r = await db.query<{ documento: string }>(
      `select documento from movimientos where contraparte = 'GTD con documento'`
    );
    expect(r.rows[0]).toEqual({ documento: "FA3109609" });
    await db.exec(`delete from movimientos where contraparte = 'GTD con documento'`);
  });

  it("acepta una proyección sin empresa ni cuenta", async () => {
    expect(
      await guardar({
        fecha: "2026-12-29",
        empresa_id: null,
        cuenta_id: null,
        contraparte: "GAP IMA 2026",
        monto: -100000000,
        moneda: "CLP",
        estado: "proyectado",
        lineas: [{ subcategoria_id: "ingreso-minimo-asegurado", monto: -100000000, glosa: null }],
      })
    ).toBeNull();
    await db.exec(`delete from movimientos where contraparte in
      ('GTD', 'Sin clasificar', 'GAP IMA 2026', 'GTD descuadrado')`);
  });
});

describe("quién puede entrar", () => {
  /** Corre una consulta haciéndose pasar por un correo, como hace PostgREST. */
  const como = async (email: string | null): Promise<boolean> => {
    const claims = email ? JSON.stringify({ email }) : "{}";
    const r = await db.query<{ ok: boolean }>(
      `select fn_es_usuario_autorizado() as ok
       from (select set_config('request.jwt.claims', '${claims}', true)) _`
    );
    return r.rows[0]!.ok;
  };

  it("deja entrar a las tres personas de administración", async () => {
    for (const email of [
      "matias.espinoza@adapsysgroup.com",
      "litsy.verasay@adapsysgroup.com",
      "patricia.alarcon@adapsysgroup.com",
    ]) {
      expect(await como(email)).toBe(true);
    }
  });

  it("no le basta con tener correo corporativo", async () => {
    // Este es el agujero que cierra la migración: antes entraba cualquiera de la
    // empresa y veía los saldos de las cinco sociedades y los sueldos por persona.
    expect(await como("otra.persona@adapsysgroup.com")).toBe(false);
  });

  it("no deja entrar a un correo de fuera aunque esté en la lista", async () => {
    // Dos filtros independientes: una fila mal agregada no alcanza.
    await db.exec(
      `insert into usuarios_autorizados (email, nombre) values ('alguien@gmail.com', 'Alguien')`
    );
    expect(await como("alguien@gmail.com")).toBe(false);
    await db.exec(`delete from usuarios_autorizados where email = 'alguien@gmail.com'`);
  });

  it("desactivar a alguien le quita el acceso sin borrar el registro", async () => {
    await db.exec(
      `update usuarios_autorizados set activo = false where email = 'litsy.verasay@adapsysgroup.com'`
    );
    expect(await como("litsy.verasay@adapsysgroup.com")).toBe(false);
    // El registro sigue: es lo que se pregunta después de un incidente.
    expect(await contar("usuarios_autorizados")).toBe(3);
    await db.exec(
      `update usuarios_autorizados set activo = true where email = 'litsy.verasay@adapsysgroup.com'`
    );
    expect(await como("litsy.verasay@adapsysgroup.com")).toBe(true);
  });

  it("sin sesión no entra nadie", async () => {
    expect(await como(null)).toBe(false);
  });
});

describe("qué entra al control presupuestario (§4.6)", () => {
  it("deja fuera lo que no es gasto que se decida presupuestar", async () => {
    const r = await db.query<{ id: string }>(
      `select id from categorias where not controlado order by id`
    );
    expect(r.rows.map((c) => c.id)).toEqual([
      "4-impuestos",
      "5-bancos",
      "6-prestamos-bancarios",
      "7-inversiones",
      "8-relacionados-y-socios",
    ]);
  });

  it("el resto sí se controla", async () => {
    const r = await db.query<{ n: number }>(
      `select count(*)::int as n from categorias where controlado`
    );
    expect(r.rows[0]!.n).toBe(11);
  });
});

describe("presupuesto mensual", () => {
  const meses = (anio: number, sub: string, montos: number[]) =>
    `insert into presupuesto_meses (anio, subcategoria_id, mes, monto) values ` +
    montos.map((m, i) => `(${anio}, '${sub}', ${i + 1}, ${m})`).join(",");

  it("guarda un monto por mes y el anual es su suma", async () => {
    expect(await intentar(meses(2026, "arriendo-oficina", Array(12).fill(8_991_000)))).toBeNull();
    const r = await db.query<{ anual: string; ytd: string }>(
      `select sum(monto)::text as anual,
              sum(monto) filter (where mes <= 3)::text as ytd
       from presupuesto_meses where anio = 2026 and subcategoria_id = 'arriendo-oficina'`
    );
    expect(r.rows[0]).toEqual({ anual: "107892000", ytd: "26973000" });
  });

  it("no deja repetir el mismo mes de la misma línea", async () => {
    // La clave primaria es (año, subcategoría, mes): sin ella una carga repetida
    // duplicaría el presupuesto sin que nada avisara.
    expect(await intentar(meses(2026, "arriendo-oficina", [1]))).toMatch(/duplicate key/);
  });

  it("rechaza un mes fuera de rango", async () => {
    expect(
      await intentar(
        `insert into presupuesto_meses (anio, subcategoria_id, mes, monto)
         values (2026, 'sueldos', 13, 1)`
      )
    ).toMatch(/presupuesto_meses_mes_check/);
  });

  it("rechaza una subcategoría que no existe", async () => {
    expect(
      await intentar(
        `insert into presupuesto_meses (anio, subcategoria_id, mes, monto)
         values (2026, 'no-existe', 1, 1)`
      )
    ).toMatch(/foreign key/);
  });

  it("fn_guardar_presupuesto graba los doce meses en el mes que corresponde", async () => {
    // El primer elemento del arreglo es enero. Una versión de esta función corría
    // el índice y enero se perdía en silencio: el anual quedaba bien salvo por un
    // mes, y el acumulado a enero daba cero.
    const p = {
      anio: 2027,
      subcategoria_id: "sueldos",
      responsable: "Finanzas",
      nota: "",
      monto_anterior: 0,
      meses: [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200],
    };
    expect(
      await intentar(`select fn_guardar_presupuesto('${JSON.stringify(p)}'::jsonb)`)
    ).toBeNull();

    const r = await db.query<{ mes: number; monto: string }>(
      `select mes, monto::text from presupuesto_meses
       where anio = 2027 and subcategoria_id = 'sueldos' order by mes`
    );
    expect(r.rows).toHaveLength(12);
    expect(r.rows[0]).toEqual({ mes: 1, monto: "100" });
    expect(r.rows[11]).toEqual({ mes: 12, monto: "1200" });

    const meta = await db.query<{ responsable: string }>(
      `select responsable from presupuesto where anio = 2027 and subcategoria_id = 'sueldos'`
    );
    expect(meta.rows[0]).toEqual({ responsable: "Finanzas" });
  });

  it("guardar dos veces reemplaza, no acumula", async () => {
    const p = { anio: 2027, subcategoria_id: "sueldos", meses: [7] };
    expect(
      await intentar(`select fn_guardar_presupuesto('${JSON.stringify(p)}'::jsonb)`)
    ).toBeNull();
    const r = await db.query<{ n: number; total: string }>(
      `select count(*)::int as n, sum(monto)::text as total from presupuesto_meses
       where anio = 2027 and subcategoria_id = 'sueldos'`
    );
    expect(r.rows[0]).toEqual({ n: 1, total: "7" });
    await db.exec(`delete from presupuesto_meses where anio = 2027;
                   delete from presupuesto where anio = 2027;`);
  });

  it("el mismo año de otra línea convive sin chocar", async () => {
    expect(await intentar(meses(2026, "sueldos", Array(12).fill(1000)))).toBeNull();
    expect(await contar("presupuesto_meses")).toBe(24);
    await db.exec(`delete from presupuesto_meses`);
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
