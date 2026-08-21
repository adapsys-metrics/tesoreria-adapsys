// Informe previo a la importación: lee los 15 exports y verifica que la suma de
// lo que vamos a cargar calce con los totales que imprime Quicken al pie.
//
// Es la validación que pide CLAUDE.md §11 ("validar que los saldos calzan antes
// de dar el sistema por bueno"), hecha ANTES de tocar la base y no después.
//
// Requiere Node 22:  node --experimental-strip-types scripts/validar-quicken.mjs

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { leerArchivo, agruparMovimientos } from "../lib/quicken.ts";
import { CATEGORIAS, SUBCATEGORIAS } from "../lib/catalogo.ts";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(RAIZ, "datos-quicken");

const clp = (n) =>
  new Intl.NumberFormat("es-CL", { maximumFractionDigits: 2 }).format(n);

// El catálogo se compara normalizado: Quicken escribe la misma subcategoría con
// y sin tilde según la época.
const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();
const catalogo = new Set(
  SUBCATEGORIAS.map((s) => {
    const cat = CATEGORIAS.find((c) => c.id === s.categoria_id);
    return norm(`${cat?.nombre ?? "?"}:${s.nombre}`);
  })
);

// Registros de banco: la empresa la pone la cuenta, así que da lo mismo lo que
// traiga Action. En los espejos de proyección no hay cuenta dueña y la empresa
// es dato — ahí sí importa que falte.
const CUENTA_DE = {
  "a1.csv": "a1", "a2.csv": "a2", "b1.csv": "b1", "b2.csv": "b2",
  "c1.csv": "c1", "c2.csv": "c2", "d1.csv": "d1", "e1.csv": "e1", "e2.csv": "e2",
  "x1.csv": "x1", "x2.csv": "x2",
};

const huerfanas = new Map();
let totMov = 0;
let totLin = 0;
const problemas = [];

for (const nombre of readdirSync(DIR).filter((f) => f.endsWith(".csv")).sort()) {
  const archivo = leerArchivo(readFileSync(join(DIR, nombre), "utf8"));
  const movs = agruparMovimientos(archivo.filas);

  totMov += movs.length;
  totLin += archivo.filas.length;

  // Un export con búsqueda activa está incompleto aunque diga "All Dates".
  if (/Search/i.test(archivo.filtro)) {
    problemas.push(`${nombre}: export filtrado — ${archivo.filtro}`);
  }

  const suma = archivo.filas.reduce((s, f) => s + f.monto, 0);
  const neto = archivo.totales?.neto ?? null;
  // Tolerancia de 1 por redondeo: los montos vienen con 2 decimales (§4.3).
  const calza = neto !== null && Math.abs(suma - neto) < 1;
  if (neto === null) problemas.push(`${nombre}: sin totales al pie, no se puede validar`);
  else if (!calza) problemas.push(`${nombre}: suma ${clp(suma)} ≠ pie ${clp(neto)}`);

  for (const f of archivo.filas) {
    const c = f.categoria.trim();
    if (!c) continue;
    const partes = c.split(":");
    // El tercer nivel de Quicken ya está aplanado en el catálogo: la
    // subcategoría es el último segmento, la categoría el primero.
    const clave = norm(`${partes[0]}:${partes[partes.length - 1]}`);
    if (!catalogo.has(clave)) huerfanas.set(c, (huerfanas.get(c) ?? 0) + 1);
  }

  const sinEmpresa = CUENTA_DE[nombre]
    ? 0
    : movs.filter((m) => m.empresa === null).length;
  if (sinEmpresa) {
    problemas.push(`${nombre}: ${sinEmpresa} movimiento(s) sin empresa y sin cuenta que la determine`);
  }
  console.log(
    `${nombre.padEnd(28)} ${String(movs.length).padStart(5)} mov  ` +
      `${String(archivo.filas.length).padStart(5)} líneas  ` +
      `${calza ? "saldo OK      " : "SALDO NO CALZA"}  ` +
      `${clp(neto ?? suma).padStart(18)}` +
      (sinEmpresa ? `  · ${sinEmpresa} sin empresa` : "")
  );
}

console.log(`\n${totMov} movimientos, ${totLin} líneas en total.`);

console.log(`\n━━━ Subcategorías fuera del catálogo: ${huerfanas.size}`);
for (const [c, n] of [...huerfanas].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(4)}×  ${c}`);
}

if (problemas.length) {
  console.log(`\n━━━ PROBLEMAS (${problemas.length})`);
  for (const p of problemas) console.log(`  ${p}`);
  process.exit(1);
}
console.log("\nTodos los archivos calzan con sus totales.");
