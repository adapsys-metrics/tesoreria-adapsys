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

/** Clave de las líneas que no están clasificadas en ninguna categoría. */
export const SIN_CLASIFICAR = "__sin_clasificar";

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
  /**
   * La naturaleza que le corresponde a una línea.
   *
   * Es la de su subcategoría si la tiene y la sobrescribe, y si no la de su categoría.
   * Toda agregación por naturaleza —el flujo, el presupuesto, los reportes— tiene que
   * pasar por acá: mirar solo la categoría manda al lado equivocado todo lo que se
   * clasificó en una subcategoría de otro tipo.
   */
  naturalezaDe: (categoria_id: string | null, subcategoria_id?: string | null) => Naturaleza;
  /** ¿Alguna subcategoría difiere de su categoría? Es lo que se muestra como "mixta",
   *  y es derivado: nadie elige mixta, aparece cuando hay desacuerdo. */
  esMixta: (categoria_id: string) => boolean;
  /**
   * Dónde quedó clasificada una línea, como una sola clave.
   *
   * Es lo que agrupan el flujo y el presupuesto. Una línea sin subcategoría usa la
   * categoría; una con subcategoría usa el par. Sin esto, una categoría mixta no se
   * podría partir entre sus dos naturalezas: todo caería en la misma celda.
   */
  claveDe: (categoria_id: string | null, subcategoria_id?: string | null) => string;
  /** Las claves de una categoría que caen de un lado. Una categoría mixta devuelve
   *  unas en inversión y otras en operativo, y por eso aparece en las dos secciones. */
  clavesDe: (categoria_id: string, naturaleza: Naturaleza) => string[];
  /** Nunca falla: una empresa desconocida vuelve con su id de nombre, para que la fila
   *  se pueda leer igual y se note que falta. */
  empresaDe: (id: string) => Empresa;
};

export function crearIndices(
  grupos: Grupo[],
  categorias: Categoria[],
  subcategorias: Subcategoria[] = [],
  empresas: Empresa[] = EMPRESAS
): Indices {
  const porIdEmpresa = new Map(empresas.map((e) => [e.id, e]));
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
    naturalezaDe: (categoria_id, subcategoria_id) => {
      const sub = subcategoria_id ? porIdSub3.get(subcategoria_id) : undefined;
      if (sub?.naturaleza) return sub.naturaleza;
      // Sin subcategoría, o con una que hereda: manda la categoría. Una que no existe
      // cae en operativo, que es donde caen los gastos y no infla ni ingresos ni
      // inversión.
      return categoria_id ? (porIdSub.get(categoria_id)?.naturaleza ?? "operativo") : "operativo";
    },
    claveDe: (categoria_id, subcategoria_id) =>
      subcategoria_id ? `${categoria_id}>${subcategoria_id}` : (categoria_id ?? SIN_CLASIFICAR),
    clavesDe: (categoria_id, naturaleza) => {
      const propia = porIdSub.get(categoria_id)?.naturaleza;
      const claves: string[] = [];
      // La categoría en sí: es donde cae todo lo clasificado sin precisar subcategoría,
      // que en el histórico es casi todo.
      if (propia === naturaleza) claves.push(categoria_id);
      for (const s of porCategoria3.get(categoria_id) ?? []) {
        if ((s.naturaleza ?? propia) === naturaleza) claves.push(`${categoria_id}>${s.id}`);
      }
      return claves;
    },
    esMixta: (categoria_id) => {
      const propia = porIdSub.get(categoria_id)?.naturaleza;
      return (porCategoria3.get(categoria_id) ?? []).some(
        (s) => s.naturaleza !== null && s.naturaleza !== propia
      );
    },
    empresaDe: (id) =>
      porIdEmpresa.get(id) ?? { id, nombre: id, corto: id.toUpperCase(), grupo: "Adapsys" },
  };
}

/** El catálogo que viene en el bundle, para código fuera de React —datos de ejemplo,
 *  tests, generadores. Lo que se muestra en pantalla sale del proveedor, no de acá. */
export const INDICES_DEL_BUNDLE = crearIndices(GRUPOS, CATEGORIAS, SUBCATEGORIAS);

/** Para código fuera de React —datos de ejemplo, scripts—. Lo que se muestra en
 *  pantalla sale del proveedor, que es donde las ediciones se ven. */
export const empresaDe = INDICES_DEL_BUNDLE.empresaDe;
