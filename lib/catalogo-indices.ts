// Índices para buscar en el catálogo en O(1).
//
// El catálogo dejó de ser una constante del bundle cuando la vista de Grupos
// entró en alcance: ahora se edita, viene de la base y cambia mientras la app está
// abierta. Por eso esto es una fábrica y no un módulo con Maps al vuelo — el
// proveedor la llama de nuevo cuando el catálogo cambia y las vistas se enteran.
//
// `EMPRESAS` sí sigue siendo constante: las cinco sociedades no se administran
// desde la app.

import { GRUPOS, EMPRESAS, CATEGORIAS, SUBCATEGORIAS } from "@/lib/catalogo";
import type { Grupo, Empresa, Naturaleza, Categoria, Subcategoria } from "@/lib/tipos";

/** Grupo sintética para las líneas cuya categoría ya no existe: la migración
 *  desde Quicken va a dejar huérfanos y no deben fallar en silencio (§11). */
export const GRUPO_SIN_CLASIFICAR: Grupo = {
  id: "__sin_clasificar",
  nombre: "Sin clasificar",
  orden: 999,
  controlado: false,
};

export type Indices = {
  grupos: Grupo[];
  categorias: Categoria[];
  subcategorias: Subcategoria[];
  /** Nunca falla: una categoría que no existe vuelve marcada, para poder verla
   *  y reasignarla en vez de perder la línea. */
  categoriaDe: (id: string | null) => Categoria;
  grupoDe: (id: string) => Grupo;
  existeCategoria: (id: string | null) => boolean;
  /** Categorías de un grupo, opcionalmente filtradas por naturaleza. */
  categoriasDe: (grupo_id: string, naturaleza?: Naturaleza) => Categoria[];
  /** Grupos con al menos una categoría de esa naturaleza. Un grupo mixto aparece en
   *  más de una, cada vez con solo sus líneas (§4.2). */
  gruposDe: (naturaleza: Naturaleza) => Grupo[];
  /** Subcategorías de una categoría. Vacío es lo normal: hoy solo 3 de las 290
   *  tienen, y el nivel es opcional a propósito. */
  subcategoriasDe: (categoria_id: string) => Subcategoria[];
  /** Nombre de una subcategoría, o null si no se pasó ninguna o ya no existe. */
  nombreSubcategoria: (id: string | null) => string | null;
};

export function crearIndices(
  grupos: Grupo[],
  categorias: Categoria[],
  subcategorias: Subcategoria[] = []
): Indices {
  const porIdSub = new Map(categorias.map((s) => [s.id, s]));
  const porIdCat = new Map(grupos.map((c) => [c.id, c]));

  const porGrupo = new Map<string, Categoria[]>();
  for (const s of categorias) {
    const lista = porGrupo.get(s.grupo_id);
    if (lista) lista.push(s);
    else porGrupo.set(s.grupo_id, [s]);
  }

  const porCategoria3 = new Map<string, Subcategoria[]>();
  for (const s of subcategorias) {
    const lista = porCategoria3.get(s.categoria_id);
    if (lista) lista.push(s);
    else porCategoria3.set(s.categoria_id, [s]);
  }
  const porIdSub3 = new Map(subcategorias.map((s) => [s.id, s]));

  return {
    grupos,
    categorias,
    subcategorias,
    categoriaDe: (id) => {
      if (id) {
        const s = porIdSub.get(id);
        if (s) return s;
      }
      return {
        id: id ?? "__sin_clasificar",
        grupo_id: GRUPO_SIN_CLASIFICAR.id,
        nombre: id ? `${id} (no existe en el catálogo)` : "Sin clasificar",
        naturaleza: "operativo",
        activa: false,
      };
    },
    grupoDe: (id) => porIdCat.get(id) ?? GRUPO_SIN_CLASIFICAR,
    existeCategoria: (id) => id !== null && porIdSub.has(id),
    categoriasDe: (grupo_id, naturaleza) => {
      const lista = porGrupo.get(grupo_id) ?? [];
      return naturaleza ? lista.filter((s) => s.naturaleza === naturaleza) : lista;
    },
    gruposDe: (naturaleza) =>
      grupos.filter((c) =>
        (porGrupo.get(c.id) ?? []).some((s) => s.naturaleza === naturaleza)
      ),
    subcategoriasDe: (categoria_id) => porCategoria3.get(categoria_id) ?? [],
    nombreSubcategoria: (id) => (id ? (porIdSub3.get(id)?.nombre ?? null) : null),
  };
}

/** El catálogo que viene en el bundle, para código fuera de React —datos de ejemplo,
 *  tests, generadores. Lo que se muestra en pantalla sale del proveedor, no de acá. */
export const INDICES_DEL_BUNDLE = crearIndices(GRUPOS, CATEGORIAS, SUBCATEGORIAS);

const POR_ID_EMPRESA = new Map(EMPRESAS.map((e) => [e.id, e]));

export const empresaDe = (id: string): Empresa =>
  POR_ID_EMPRESA.get(id) ?? { id, nombre: id, corto: id.toUpperCase(), grupo: "Adapsys" };
