// Índices para buscar en el catálogo en O(1). En el prototipo esto era un context
// de React, pero el catálogo es estático: mientras la vista de Categorías no permita
// editarlo, un módulo con Maps es más simple y más rápido.
//
// Cuando la vista de Categorías entre en alcance, esto pasa a ser estado.

import { CATEGORIAS, EMPRESAS, SUBCATEGORIAS } from "@/lib/catalogo";
import type { Categoria, Empresa, Naturaleza, Subcategoria } from "@/lib/tipos";

const POR_ID_SUB = new Map(SUBCATEGORIAS.map((s) => [s.id, s]));
const POR_ID_CAT = new Map(CATEGORIAS.map((c) => [c.id, c]));
const POR_ID_EMPRESA = new Map(EMPRESAS.map((e) => [e.id, e]));

/** Categoría sintética para las líneas cuya subcategoría ya no existe: la migración
 *  desde Quicken va a dejar huérfanos y no deben fallar en silencio (§11). */
export const CATEGORIA_SIN_CLASIFICAR: Categoria = {
  id: "__sin_clasificar",
  nombre: "Sin clasificar",
  orden: 999,
  controlado: false,
};

export const subcategoriaDe = (id: string | null): Subcategoria => {
  if (id) {
    const s = POR_ID_SUB.get(id);
    if (s) return s;
  }
  return {
    id: id ?? "__sin_clasificar",
    categoria_id: CATEGORIA_SIN_CLASIFICAR.id,
    nombre: id ? `${id} (no existe en el catálogo)` : "Sin clasificar",
    naturaleza: "operativo",
    activa: false,
  };
};

export const categoriaDe = (id: string): Categoria =>
  POR_ID_CAT.get(id) ?? CATEGORIA_SIN_CLASIFICAR;

export const empresaDe = (id: string): Empresa =>
  POR_ID_EMPRESA.get(id) ?? { id, nombre: id, corto: id.toUpperCase(), grupo: "Adapsys" };

/** ¿La subcategoría existe en el catálogo? Una línea que apunte a una que no existe
 *  hay que mostrarla marcada, para poder reasignarla. */
export const existeSubcategoria = (id: string | null): boolean =>
  id !== null && POR_ID_SUB.has(id);

/** Subcategorías de una categoría, opcionalmente filtradas por naturaleza. */
export const subcategoriasDe = (categoria_id: string, naturaleza?: Naturaleza) =>
  SUBCATEGORIAS.filter(
    (s) => s.categoria_id === categoria_id && (!naturaleza || s.naturaleza === naturaleza)
  );

/** Categorías que tienen al menos una subcategoría de esa naturaleza. Una categoría
 *  mixta aparece en más de una naturaleza, cada vez con solo sus líneas (§4.2). */
export const categoriasDe = (naturaleza: Naturaleza): Categoria[] =>
  CATEGORIAS.filter((c) =>
    SUBCATEGORIAS.some((s) => s.categoria_id === c.id && s.naturaleza === naturaleza)
  );
