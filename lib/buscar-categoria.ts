// Buscar una categoría entre 290.
//
// Es lo que CLAUDE.md §5 pide desde el principio: una lista plana de 290 ítems es
// inusable, y el `<select>` nativo solo salta a lo que empieza igual — escribir "gtd"
// no encuentra "Telefonía e internet" aunque sea la de GTD, y escribir "internet" no
// encuentra nada porque la opción empieza con "Telefonía".

import type { Categoria, Grupo } from "@/lib/tipos";

/** Sin acentos ni mayúsculas: nadie escribe "Telefonía" con tilde al buscar. */
export const normalizar = (s: string): string =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();

export type Resultado = {
  categoria: Categoria;
  grupo: Grupo;
};

/**
 * Filtra por nombre de categoría **o de grupo**, y por todas las palabras escritas en
 * cualquier orden: "admin arriendo" encuentra "Arriendo oficina" dentro de "2 GASTOS
 * ADMINISTRACIÓN". Buscar por grupo importa porque muchas categorías se recuerdan por
 * dónde viven, no por su nombre exacto.
 *
 * El orden es el del catálogo, no por relevancia: quien busca "arriendo" quiere verlas
 * todas y elegir, y un orden que cambia con cada tecla hace fallar el clic.
 */
export function buscarCategorias(
  categorias: Categoria[],
  grupoDe: (id: string) => Grupo,
  texto: string,
  limite = 40
): Resultado[] {
  const palabras = normalizar(texto).split(/\s+/).filter(Boolean);
  const salida: Resultado[] = [];

  for (const categoria of categorias) {
    if (!categoria.activa) continue;
    const grupo = grupoDe(categoria.grupo_id);
    if (palabras.length) {
      const donde = normalizar(`${grupo.nombre} ${categoria.nombre}`);
      if (!palabras.every((p) => donde.includes(p))) continue;
    }
    salida.push({ categoria, grupo });
    if (salida.length >= limite) break;
  }
  return salida;
}

/** Las últimas usadas, que en un registro son casi siempre las mismas. Se guardan por
 *  persona en el navegador: son una comodidad, no un dato del negocio. */
const CLAVE = "tesoreria:categorias-recientes";
const CUANTAS = 6;

export const recientes = (): string[] => {
  try {
    const crudo = window.localStorage.getItem(CLAVE);
    const ids = crudo ? (JSON.parse(crudo) as unknown) : [];
    return Array.isArray(ids) ? ids.filter((x): x is string => typeof x === "string") : [];
  } catch {
    // Storage deshabilitado o JSON corrupto: se sigue sin recientes.
    return [];
  }
};

export const anotarReciente = (id: string): void => {
  try {
    const ya = recientes().filter((x) => x !== id);
    window.localStorage.setItem(CLAVE, JSON.stringify([id, ...ya].slice(0, CUANTAS)));
  } catch {
    // Sin storage la app funciona igual, solo no recuerda.
  }
};
