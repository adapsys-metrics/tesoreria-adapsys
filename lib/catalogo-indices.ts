// Índices para buscar en el catálogo en O(1).
//
// El catálogo dejó de ser una constante del bundle cuando la vista de Categorías
// entró en alcance: ahora se edita, viene de la base y cambia mientras la app está
// abierta. Por eso esto es una fábrica y no un módulo con Maps al vuelo — el
// proveedor la llama de nuevo cuando el catálogo cambia y las vistas se enteran.
//
// `EMPRESAS` sí sigue siendo constante: las cinco sociedades no se administran
// desde la app.

import { CATEGORIAS, EMPRESAS, SUBCATEGORIAS } from "@/lib/catalogo";
import type { Categoria, Empresa, Naturaleza, Subcategoria } from "@/lib/tipos";

/** Categoría sintética para las líneas cuya subcategoría ya no existe: la migración
 *  desde Quicken va a dejar huérfanos y no deben fallar en silencio (§11). */
export const CATEGORIA_SIN_CLASIFICAR: Categoria = {
  id: "__sin_clasificar",
  nombre: "Sin clasificar",
  orden: 999,
  controlado: false,
};

export type Indices = {
  categorias: Categoria[];
  subcategorias: Subcategoria[];
  /** Nunca falla: una subcategoría que no existe vuelve marcada, para poder verla
   *  y reasignarla en vez de perder la línea. */
  subcategoriaDe: (id: string | null) => Subcategoria;
  categoriaDe: (id: string) => Categoria;
  existeSubcategoria: (id: string | null) => boolean;
  /** Subcategorías de una categoría, opcionalmente filtradas por naturaleza. */
  subcategoriasDe: (categoria_id: string, naturaleza?: Naturaleza) => Subcategoria[];
  /** Categorías con al menos una subcategoría de esa naturaleza. Una categoría
   *  mixta aparece en más de una, cada vez con solo sus líneas (§4.2). */
  categoriasDe: (naturaleza: Naturaleza) => Categoria[];
};

export function crearIndices(
  categorias: Categoria[],
  subcategorias: Subcategoria[]
): Indices {
  const porIdSub = new Map(subcategorias.map((s) => [s.id, s]));
  const porIdCat = new Map(categorias.map((c) => [c.id, c]));

  const porCategoria = new Map<string, Subcategoria[]>();
  for (const s of subcategorias) {
    const lista = porCategoria.get(s.categoria_id);
    if (lista) lista.push(s);
    else porCategoria.set(s.categoria_id, [s]);
  }

  return {
    categorias,
    subcategorias,
    subcategoriaDe: (id) => {
      if (id) {
        const s = porIdSub.get(id);
        if (s) return s;
      }
      return {
        id: id ?? "__sin_clasificar",
        categoria_id: CATEGORIA_SIN_CLASIFICAR.id,
        nombre: id ? `${id} (no existe en el catálogo)` : "Sin clasificar",
        naturaleza: "operativo",
        activa: false,
      };
    },
    categoriaDe: (id) => porIdCat.get(id) ?? CATEGORIA_SIN_CLASIFICAR,
    existeSubcategoria: (id) => id !== null && porIdSub.has(id),
    subcategoriasDe: (categoria_id, naturaleza) => {
      const lista = porCategoria.get(categoria_id) ?? [];
      return naturaleza ? lista.filter((s) => s.naturaleza === naturaleza) : lista;
    },
    categoriasDe: (naturaleza) =>
      categorias.filter((c) =>
        (porCategoria.get(c.id) ?? []).some((s) => s.naturaleza === naturaleza)
      ),
  };
}

/** El catálogo que viene en el bundle, para código fuera de React —datos de ejemplo,
 *  tests, generadores. Lo que se muestra en pantalla sale del proveedor, no de acá. */
export const INDICES_DEL_BUNDLE = crearIndices(CATEGORIAS, SUBCATEGORIAS);

const POR_ID_EMPRESA = new Map(EMPRESAS.map((e) => [e.id, e]));

export const empresaDe = (id: string): Empresa =>
  POR_ID_EMPRESA.get(id) ?? { id, nombre: id, corto: id.toUpperCase(), grupo: "Adapsys" };
