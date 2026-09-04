// Lectura y escritura del catálogo de categorías y subcategorías.
//
// Hasta que la vista de Categorías existió, el catálogo vivía solo en el bundle
// (lib/catalogo.ts) y eso alcanzaba: ~300 filas que cambian dos veces al año. Desde
// que se edita en la app tiene que venir de la base, o dos personas verían catálogos
// distintos y el que quedara escrito dependería de quién recargó último.
//
// El bundle sigue existiendo y sigue siendo de donde sale el seed: es el catálogo de
// arranque y el que se muestra mientras la base responde.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { Categoria, Subcategoria } from "@/lib/tipos";

/** Igual que en movimientos: PostgREST corta en 1.000 filas y devuelve 200. Son 293
 *  subcategorías hoy, pero 193 de ellas son clientes y esa lista solo crece. */
const TAMANO_PAGINA = 1000;

export async function cargarCatalogo(supabase: SupabaseClient<Database>): Promise<{
  categorias: Categoria[];
  subcategorias: Subcategoria[];
}> {
  const [cats, subs] = await Promise.all([
    supabase.from("categorias").select("id,nombre,orden,controlado").order("orden"),
    (async () => {
      const todas: Subcategoria[] = [];
      for (let pagina = 0; ; pagina++) {
        const desde = pagina * TAMANO_PAGINA;
        const { data, error } = await supabase
          .from("subcategorias")
          .select("id,categoria_id,nombre,naturaleza,activa")
          .order("categoria_id")
          .order("nombre")
          .range(desde, desde + TAMANO_PAGINA - 1);
        if (error) throw new Error(error.message);
        const filas = data ?? [];
        todas.push(...filas);
        if (filas.length < TAMANO_PAGINA) break;
      }
      return todas;
    })(),
  ]);

  if (cats.error) throw new Error(`No se pudo cargar el catálogo: ${cats.error.message}`);

  return { categorias: cats.data ?? [], subcategorias: subs };
}

export async function guardarCategoria(
  supabase: SupabaseClient<Database>,
  c: Categoria
): Promise<void> {
  const { error } = await supabase.from("categorias").upsert(c);
  if (error) throw new Error(`No se pudo guardar la categoría "${c.nombre}": ${error.message}`);
}

export async function guardarSubcategoria(
  supabase: SupabaseClient<Database>,
  s: Subcategoria
): Promise<void> {
  const { error } = await supabase.from("subcategorias").upsert(s);
  if (error) {
    throw new Error(`No se pudo guardar la subcategoría "${s.nombre}": ${error.message}`);
  }
}

/**
 * Borra una subcategoría. La base la rechaza si tiene líneas apuntándole —hay una
 * foreign key— y eso está bien: perder la clasificación de un movimiento por borrar
 * una línea del catálogo es justo lo que §3 manda evitar. El camino para una que ya
 * no se usa es marcarla inactiva.
 */
export async function borrarSubcategoria(
  supabase: SupabaseClient<Database>,
  id: string
): Promise<void> {
  const { error } = await supabase.from("subcategorias").delete().eq("id", id);
  if (error) throw new Error(`No se pudo borrar: ${error.message}`);
}

export async function borrarCategoria(
  supabase: SupabaseClient<Database>,
  id: string
): Promise<void> {
  const { error } = await supabase.from("categorias").delete().eq("id", id);
  if (error) throw new Error(`No se pudo borrar la categoría: ${error.message}`);
}
