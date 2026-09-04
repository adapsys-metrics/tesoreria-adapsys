// Edición del catálogo: identificadores y el importador de listados pegados.
//
// Vive fuera de la vista porque el importador es lo único del mantenedor que tiene
// reglas de verdad, y esas reglas hay que poder probarlas sin montar React.

import type { Grupo, Naturaleza, Categoria, Subcategoria } from "@/lib/tipos";

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
 *  "arriendos-2". Sin esto, crear dos categorías con el mismo nombre en grupos
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
  grupos: Grupo[];
  categorias: Categoria[];
  subcategorias: Subcategoria[];
};

/** Ancho de la sangría de una línea. El tabulador cuenta como cuatro espacios: si se
 *  mezclan —y se mezclan, porque esto viene pegado de otro programa— comparar
 *  caracteres crudos pondría un tab por debajo de dos espacios. */
const sangriaDe = (linea: string): number => {
  let ancho = 0;
  for (const c of linea) {
    if (c === " ") ancho += 1;
    else if (c === "\t") ancho += 4;
    else break;
  }
  return ancho;
};

/**
 * Lee un listado pegado.
 *
 * Acepta las formas en que la gente tiene el catálogo a mano: `Grupo:Categoría` o
 * `Grupo:Categoría:Subcategoría` por línea, o grupos al margen con los niveles de
 * abajo indentados. Una línea sola que diga "Gastos de Inversión", "Gastos
 * Operativos" o "Ingresos" cambia la naturaleza de ahí en adelante, y un sufijo
 * `(inversión)` la fija para esa línea.
 *
 * La profundidad se decide por el ancho de la sangría, no por si la hay: leerla como
 * un sí/no aplastaba el tercer nivel contra el segundo, que es exactamente el error
 * que traía la importación desde Quicken (§3.1).
 *
 * Un grupo sin categorías recibe una con su mismo nombre: el modelo clasifica por
 * categoría (§3) y un grupo vacío no podría usarse para nada. Una categoría sin
 * subcategorías, en cambio, es lo normal y no recibe nada.
 */
export function parsearCatalogo(texto: string, existentes = new Set<string>()): CatalogoParseado {
  const grupos: Grupo[] = [];
  const categorias: Categoria[] = [];
  const subcategorias: Subcategoria[] = [];
  const tomados = new Set(existentes);
  let naturaleza: Naturaleza = "operativo";

  // Sangría de cada nivel abierto, para saber a qué altura cuelga la línea que viene.
  let sangriaGrupo: number | null = null;
  let sangriaCategoria: number | null = null;
  let ultimoGrupo: string | null = null;
  let ultimaCategoria: string | null = null;

  const agregarGrupo = (nombre: string): string => {
    const limpio = nombre.trim();
    const ya = grupos.find((g) => g.nombre === limpio);
    if (ya) return ya.id;
    const id = idLibre(limpio, tomados);
    tomados.add(id);
    grupos.push({ id, nombre: limpio, orden: grupos.length + 1, controlado: true });
    return id;
  };

  const agregarCategoria = (grupo_id: string, nombre: string, nat: Naturaleza | null): string => {
    const limpio = nombre.trim();
    const ya = categorias.find((c) => c.grupo_id === grupo_id && c.nombre === limpio);
    if (ya) return ya.id;
    const id = idLibre(limpio, tomados);
    tomados.add(id);
    categorias.push({
      id,
      grupo_id,
      nombre: limpio,
      naturaleza: nat ?? naturaleza,
      activa: true,
    });
    return id;
  };

  const agregarSubcategoria = (categoria_id: string, nombre: string) => {
    const limpio = nombre.trim();
    if (subcategorias.some((s) => s.categoria_id === categoria_id && s.nombre === limpio)) return;
    const id = idLibre(limpio, tomados);
    tomados.add(id);
    subcategorias.push({ id, categoria_id, nombre: limpio, activa: true });
  };

  for (const cruda of texto.split(/\r?\n/)) {
    if (!cruda.trim()) continue;
    const sangria = sangriaDe(cruda);
    const linea = cruda.trim().replace(/^[-•*#]\s*/, "");

    if (sangria === 0 && !linea.includes(":")) {
      // Los totales del reporte del que se copió no son grupos.
      if (/^total/i.test(linea)) continue;
      const seccion: Naturaleza | null = /^(gastos?\s+de\s+inversi|inversi[oó]n)/i.test(linea)
        ? "inversion"
        : /^gastos?\s+operativ/i.test(linea)
          ? "operativo"
          : /^(ingresos?|inflows?)$/i.test(linea)
            ? "ingreso"
            : /^(egresos?|outflows?)$/i.test(linea)
              ? "operativo"
              : null;
      if (seccion) {
        naturaleza = seccion;
        sangriaGrupo = null;
        sangriaCategoria = null;
        ultimoGrupo = null;
        ultimaCategoria = null;
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

    // Forma con dos puntos: trae la ruta completa y no depende de la sangría.
    if (limpio.includes(":")) {
      const partes = limpio.split(":").map((x) => x.trim()).filter(Boolean);
      const [nombreGrupo, nombreCategoria, ...resto] = partes;
      if (!nombreGrupo) continue;
      ultimoGrupo = agregarGrupo(nombreGrupo);
      sangriaGrupo = sangria;
      sangriaCategoria = null;
      ultimaCategoria = null;
      if (nombreCategoria) {
        ultimaCategoria = agregarCategoria(ultimoGrupo, nombreCategoria, natLinea);
        sangriaCategoria = sangria + 1;
        // Todo lo que venga después del segundo ":" es el tercer nivel.
        const nombreSub = resto.join(":").trim();
        if (nombreSub) agregarSubcategoria(ultimaCategoria, nombreSub);
      }
      continue;
    }

    // Forma indentada: la profundidad la da el ancho de la sangría.
    if (sangriaGrupo === null || sangria <= sangriaGrupo) {
      ultimoGrupo = agregarGrupo(limpio);
      sangriaGrupo = sangria;
      sangriaCategoria = null;
      ultimaCategoria = null;
      if (natLinea) naturaleza = natLinea;
    } else if (sangriaCategoria === null || sangria <= sangriaCategoria) {
      ultimaCategoria = agregarCategoria(ultimoGrupo!, limpio, natLinea);
      sangriaCategoria = sangria;
    } else if (ultimaCategoria) {
      // Más adentro que la categoría: es el detalle. No lleva naturaleza propia,
      // la hereda de su categoría (§3.1).
      agregarSubcategoria(ultimaCategoria, limpio);
    }
  }

  for (const g of grupos) {
    if (!categorias.some((c) => c.grupo_id === g.id)) agregarCategoria(g.id, g.nombre, null);
  }

  return { grupos, categorias, subcategorias };
}
