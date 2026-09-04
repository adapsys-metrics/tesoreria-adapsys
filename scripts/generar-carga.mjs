// Convierte los 15 exports de Quicken en dos CSV con la forma exacta de las
// tablas, más el SQL que los pasa a movimientos y movimiento_lineas.
//
// Sale en CSV y no en INSERTs porque 15.000 filas no entran pegadas en el editor
// SQL de Supabase. El camino es: Table Editor → Import data from CSV para los dos
// archivos, y después un SQL corto que los promueve.
//
//   node --experimental-strip-types scripts/generar-carga.mjs

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { agruparMovimientos, leerArchivo } from "../lib/quicken.ts";
import { GRUPOS, CUENTAS, CATEGORIAS } from "../lib/catalogo.ts";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const ENTRADA = join(RAIZ, "datos-quicken");
const SALIDA = join(RAIZ, "datos-quicken", "carga");

// ── De qué cuenta y en qué estado entra cada archivo ────────────────────────
//
// El estado sale del registro, no de la fecha. Son dos vistas distintas del
// mismo negocio (§4.1): los registros de banco reflejan la cartola —todo lo que
// está ahí ya pasó por el banco— y los espejos son compromisos futuros. Los
// datos lo confirman: ni una fila con fecha futura en los nueve de banco.
const REGISTROS = {
  "a1.csv": { cuenta: "a1", estado: "conciliado" },
  "a2.csv": { cuenta: "a2", estado: "conciliado" },
  "b1.csv": { cuenta: "b1", estado: "conciliado" },
  "b2.csv": { cuenta: "b2", estado: "conciliado" },
  "c1.csv": { cuenta: "c1", estado: "conciliado" },
  "c2.csv": { cuenta: "c2", estado: "conciliado" },
  "d1.csv": { cuenta: "d1", estado: "conciliado" },
  "e1.csv": { cuenta: "e1", estado: "conciliado" },
  "e2.csv": { cuenta: "e2", estado: "conciliado" },
  "x1.csv": { cuenta: "x1", estado: "proyectado" },
  "x2.csv": { cuenta: "x2", estado: "proyectado" },
  "proyectos-aprobados-clp.csv": { cuenta: "x3", estado: "proyectado" },
  "proyectos-aprobados-usd.csv": { cuenta: "x4", estado: "proyectado" },
  // Los espejos no son una cuenta: mezclan las cinco empresas. La cuenta sale de
  // la empresa del movimiento, que cada empresa tiene una sola por moneda.
  "proy-egresos-clp.csv": { porEmpresa: "CLP", estado: "proyectado" },
  "proy-egresos-usd.csv": { porEmpresa: "USD", estado: "proyectado" },
};

const cuentaDe = (id) => CUENTAS.find((c) => c.id === id);
const cuentaPorEmpresa = (empresa, moneda) =>
  CUENTAS.find((c) => c.empresa_id === empresa && c.moneda === moneda && c.tipo === "banco");

// ── Resolución de categoría ──────────────────────────────────────────────
//
// El tercer nivel de Quicken ya está aplanado en el catálogo: la categoría es
// el último segmento y la grupo el primero. Se compara normalizado porque la
// misma categoría aparece con y sin tilde según la época del movimiento.
const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();
const PORCLAVE = new Map(
  CATEGORIAS.map((s) => {
    const cat = GRUPOS.find((c) => c.id === s.grupo_id);
    return [norm(`${cat?.nombre ?? "?"}:${s.nombre}`), s.id];
  })
);

function categoriaDe(grupo) {
  const c = grupo.trim();
  // "Uncategorized" y "Transfer" son marcadores de Quicken, no clasificación.
  if (!c || !c.includes(":") || /^(Uncategorized|Transfer)$/i.test(c)) return null;
  const p = c.split(":");
  return PORCLAVE.get(norm(`${p[0]}:${p[p.length - 1]}`)) ?? null;
}

// Los saltos de línea dentro de un memo (existen: una NC de Mastercard, una
// factura de LinkedIn) se aplanan. El importador de CSV de Supabase los soporta
// entre comillas, pero un salto invisible dentro de una glosa no aporta nada y
// sí puede romper la carga en silencio.
const limpiar = (s) => (s ?? "").replace(/[\r\n\t]+/g, " ").trim();

const csv = (filas) =>
  filas
    .map((f) => f.map((v) => (v === null || v === undefined ? "" : `"${String(v).replace(/"/g, '""')}"`)).join(","))
    .join("\n") + "\n";

// ── Recorrido ───────────────────────────────────────────────────────────────

const movimientos = [];
const lineas = [];
const resumen = [];
let sinClasificar = 0;
let mixtosDegradados = 0;
let ref = 0;

for (const [archivo, reg] of Object.entries(REGISTROS)) {
  const datos = leerArchivo(readFileSync(join(ENTRADA, archivo), "utf8"));
  if (/Search/i.test(datos.filtro)) {
    throw new Error(`${archivo} se exportó con una búsqueda activa: está incompleto`);
  }

  const moneda = reg.porEmpresa ?? cuentaDe(reg.cuenta).moneda;
  let n = 0;
  let suma = 0;

  for (const m of agruparMovimientos(datos.filas)) {
    // La fila de apertura ya vive en cuentas.saldo_inicial: importarla además
    // contaría el saldo dos veces.
    if (/opening balance/i.test(m.contraparte) || /opening balance/i.test(m.lineas[0]?.glosa ?? "")) {
      continue;
    }

    const empresa = m.empresa ?? (reg.cuenta ? cuentaDe(reg.cuenta).empresa_id : null);
    const cuenta = reg.cuenta ?? (empresa ? cuentaPorEmpresa(empresa, moneda)?.id ?? null : null);

    ref++;
    const clave = `q${ref}`;
    n++;
    suma += m.monto;

    movimientos.push([
      clave,
      m.fecha,
      empresa,
      cuenta,
      limpiar(m.contraparte),
      // La glosa es el memo; el número va en su propia columna desde la
      // migración 0008. Antes se mezclaban y no se podía buscar por número.
      limpiar(m.lineas[0]?.glosa ?? ""),
      limpiar(m.documento),
      m.monto,
      moneda,
      reg.estado,
      archivo,
    ]);

    const resueltas = m.lineas.map((l) => ({ ...l, sub: categoriaDe(l.grupo) }));
    const conSub = resueltas.filter((l) => l.sub);

    if (conSub.length === 0) {
      // Sin ninguna línea clasificable: el movimiento entra sin líneas y aparece
      // en v_movimientos_sin_clasificar para reasignarlo desde la app (§11).
      sinClasificar++;
      continue;
    }
    if (conSub.length < resueltas.length) {
      // Split donde unas líneas tienen grupo y otras no. No se pueden cargar
      // solo las clasificadas: la suma no cuadraría con el monto y la constraint
      // lo rechazaría, con razón. Entra entero sin líneas, para reclasificar.
      mixtosDegradados++;
      sinClasificar++;
      continue;
    }
    resueltas.forEach((l, i) => {
      lineas.push([clave, l.sub, l.monto, limpiar(l.glosa), i]);
    });
  }

  resumen.push({ archivo, n, suma, pie: datos.totales?.neto ?? null });
}

mkdirSync(SALIDA, { recursive: true });
writeFileSync(
  join(SALIDA, "carga_movimientos.csv"),
  csv([["ref", "fecha", "empresa_id", "cuenta_id", "contraparte", "glosa", "documento", "monto", "moneda", "estado", "origen"], ...movimientos])
);
writeFileSync(
  join(SALIDA, "carga_lineas.csv"),
  csv([["mov_ref", "categoria_id", "monto", "glosa", "orden"], ...lineas])
);

// ── Informe ─────────────────────────────────────────────────────────────────

const clp = (n) => new Intl.NumberFormat("es-CL", { maximumFractionDigits: 2 }).format(n);
let problemas = 0;

for (const r of resumen) {
  // La suma acá excluye la fila de apertura, que se fue a saldo_inicial: por eso
  // se compara contra el pie menos el saldo inicial de esa cuenta.
  const cta = REGISTROS[r.archivo].cuenta;
  const apertura = cta ? cuentaDe(cta).saldo_inicial : 0;
  const esperado = r.pie === null ? null : r.pie - apertura;
  const calza = esperado !== null && Math.abs(r.suma - esperado) < 1;
  if (!calza) problemas++;
  console.log(
    `${r.archivo.padEnd(28)} ${String(r.n).padStart(5)} mov  ` +
      `${calza ? "calza  " : "NO CALZA"} ${clp(r.suma).padStart(18)}` +
      (apertura ? `  (+ apertura ${clp(apertura)})` : "")
  );
}

console.log(`\n${movimientos.length} movimientos, ${lineas.length} líneas.`);
console.log(`${sinClasificar} movimientos entran sin líneas para reclasificar,`);
console.log(`  de los cuales ${mixtosDegradados} son splits con clasificación parcial.`);
console.log(`\nEscritos en datos-quicken/carga/`);
if (problemas) {
  console.log(`\n${problemas} archivo(s) NO CALZAN — revisar antes de cargar.`);
  process.exit(1);
}
