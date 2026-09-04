// Edición del catálogo: identificadores y el importador de listados pegados.
//
// Vive fuera de la vista porque el importador es lo único del mantenedor que tiene
// reglas de verdad, y esas reglas hay que poder probarlas sin montar React.

import type { Categoria, Naturaleza, Subcategoria } from "@/lib/tipos";

/**
 * Identificador estable a partir de un nombre.
 *
 * El tope de 44 caracteres viene del prototipo, que es de donde salieron los 293 ids
 * del catálogo actual —el más largo mide 36, así que nunca llegó a recortar—. Se
 * mantiene para que un nombre largo no genere una clave impronunciable, y no para
 * reproducir nada: los ids ya escritos vienen del archivo, no de recalcularlos.
 */
export const slug = (s: string): string =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 44) || "x";

/** Un id que no choque con los que ya existen: si "arriendos" está tomado, prueba
 *  "arriendos-2". Sin esto, crear dos subcategorías con el mismo nombre en categorías
 *  distintas pisaría la primera. */
export const idLibre = (base: string, tomados: Set<string>): string => {
  const raiz = slug(base);
  if (!tomados.has(raiz)) return raiz;
  for (let n = 2; ; n++) {
    const intento = `${raiz.slice(0, 44 - String(n).length - 1)}-${n}`;
    if (!tomados.has(intento)) return intento;
  }
};

export type CatalogoParseado = {
  categorias: Categoria[];
  subcategorias: Subcategoria[];
};

/**
 * Lee un listado pegado.
 *
 * Acepta las formas en que la gente tiene el catálogo a mano: `Categoría:Subcategoría`
 * por línea, o categorías al margen con las subcategorías indentadas. Una línea sola
 * que diga "Gastos de Inversión", "Gastos Operativos" o "Ingresos" cambia la
 * naturaleza de ahí en adelante, y un sufijo `(inversión)` la fija para esa línea.
 *
 * Una categoría sin subcategorías recibe una con su mismo nombre: el modelo clasifica
 * por subcategoría (§3) y una categoría vacía no podría usarse para nada.
 */
export function parsearCatalogo(texto: string, existentes = new Set<string>()): CatalogoParseado {
  const categorias: Categoria[] = [];
  const subcategorias: Subcategoria[] = [];
  const tomados = new Set(existentes);
  let naturaleza: Naturaleza = "operativo";
  let ultima: string | null = null;

  const agregarCategoria = (nombre: string): string => {
    const limpio = nombre.trim();
    const ya = categorias.find((c) => c.nombre === limpio);
    if (ya) return ya.id;
    const id = idLibre(limpio, tomados);
    tomados.add(id);
    categorias.push({ id, nombre: limpio, orden: categorias.length + 1, controlado: true });
    return id;
  };

  const agregarSub = (categoria_id: string, nombre: string, nat: Naturaleza | null) => {
    const limpio = nombre.trim();
    if (subcategorias.some((s) => s.categoria_id === categoria_id && s.nombre === limpio)) return;
    const id = idLibre(limpio, tomados);
    tomados.add(id);
    subcategorias.push({
      id,
      categoria_id,
      nombre: limpio,
      naturaleza: nat ?? naturaleza,
      activa: true,
    });
  };

  for (const cruda of texto.split(/\r?\n/)) {
    if (!cruda.trim()) continue;
    const indentado = /^[\t ]+\S/.test(cruda);
    const linea = cruda.trim().replace(/^[-•*#]\s*/, "");

    if (!indentado && !linea.includes(":")) {
      // Los totales del reporte del que se copió no son categorías.
      if (/^total/i.test(linea)) continue;
      if (/^(gastos?\s+de\s+inversi|inversi[oó]n)/i.test(linea)) {
        naturaleza = "inversion";
        ultima = null;
        continue;
      }
      if (/^gastos?\s+operativ/i.test(linea)) {
        naturaleza = "operativo";
        ultima = null;
        continue;
      }
      if (/^(ingresos?|inflows?)$/i.test(linea)) {
        naturaleza = "ingreso";
        ultima = null;
        continue;
      }
      if (/^(egresos?|outflows?)$/i.test(linea)) {
        naturaleza = "operativo";
        ultima = null;
        continue;
      }
    }

    const marca = /\(\s*(inversi[oó]n|operativ[oa]s?|ingresos?)\s*\)/i.exec(linea);
    const natLinea: Naturaleza | null = marca
      ? /^inversi/i.test(marca[1]!)
        ? "inversion"
        : /^ingreso/i.test(marca[1]!)
          ? "ingreso"
          : "operativo"
      : null;
    const limpio = linea
      .replace(/\(\s*(inversi[oó]n|operativ[oa]s?|ingresos?|egresos?)\s*\)/gi, "")
      .trim();
    if (!limpio) continue;

    if (limpio.includes(":")) {
      const [padre, ...resto] = limpio.split(":");
      const id = agregarCategoria(padre!);
      const hijo = resto.join(":").trim();
      if (hijo) agregarSub(id, hijo, natLinea);
      ultima = id;
    } else if (indentado && ultima) {
      agregarSub(ultima, limpio, natLinea);
    } else {
      ultima = agregarCategoria(limpio);
      if (natLinea) naturaleza = natLinea;
    }
  }

  for (const c of categorias) {
    if (!subcategorias.some((s) => s.categoria_id === c.id)) agregarSub(c.id, c.nombre, null);
  }

  return { categorias, subcategorias };
}
