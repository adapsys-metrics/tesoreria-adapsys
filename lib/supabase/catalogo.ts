// Lectura y escritura del catálogo de grupos y categorías.
//
// Hasta que la vista de Grupos existió, el catálogo vivía solo en el bundle
// (lib/catalogo.ts) y eso alcanzaba: ~300 filas que cambian dos veces al año. Desde
// que se edita en la app tiene que venir de la base, o dos personas verían catálogos
// distintos y el que quedara escrito dependería de quién recargó último.
//
// El bundle sigue existiendo y sigue siendo de donde sale el seed: es el catálogo de
// arranque y el que se muestra mientras la base responde.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { Grupo, Categoria, Subcategoria } from "@/lib/tipos";

/** Igual que en movimientos: PostgREST corta en 1.000 filas y devuelve 200. Son 293
 *  categorías hoy, pero 193 de ellas son clientes y esa lista solo crece. */
const TAMANO_PAGINA = 1000;

export async function cargarCatalogo(supabase: SupabaseClient<Database>): Promise<{
  grupos: Grupo[];
  categorias: Categoria[];
  subcategorias: Subcategoria[];
}> {
  const [gru, cats, subs] = await Promise.all([
    supabase.from("grupos").select("id,nombre,orden,controlado").order("orden"),
    (async () => {
      const todas: Categoria[] = [];
      for (let pagina = 0; ; pagina++) {
        const desde = pagina * TAMANO_PAGINA;
        const { data, error } = await supabase
          .from("categorias")
          .select("id,grupo_id,nombre,naturaleza,activa")
          .order("grupo_id")
          .order("nombre")
          .range(desde, desde + TAMANO_PAGINA - 1);
        if (error) throw new Error(error.message);
        const filas = data ?? [];
        todas.push(...filas);
        if (filas.length < TAMANO_PAGINA) break;
      }
      return todas;
    })(),
    supabase.from("subcategorias").select("id,categoria_id,nombre,activa").order("nombre"),
  ]);

  if (gru.error) throw new Error(`No se pudo cargar el catálogo: ${gru.error.message}`);
  if (subs.error) throw new Error(`No se pudo cargar el catálogo: ${subs.error.message}`);

  return { grupos: gru.data ?? [], categorias: cats, subcategorias: subs.data ?? [] };
}

export async function guardarGrupo(
  supabase: SupabaseClient<Database>,
  c: Grupo
): Promise<void> {
  const { error } = await supabase.from("grupos").upsert(c);
  if (error) throw new Error(`No se pudo guardar la grupo "${c.nombre}": ${error.message}`);
}

export async function guardarCategoria(
  supabase: SupabaseClient<Database>,
  s: Categoria
): Promise<void> {
  const { error } = await supabase.from("categorias").upsert(s);
  if (error) {
    throw new Error(`No se pudo guardar la categoría "${s.nombre}": ${error.message}`);
  }
}

/**
 * Borra una categoría. La base la rechaza si tiene líneas apuntándole —hay una
 * foreign key— y eso está bien: perder la clasificación de un movimiento por borrar
 * una línea del catálogo es justo lo que §3 manda evitar. El camino para una que ya
 * no se usa es marcarla inactiva.
 */
export async function borrarCategoria(
  supabase: SupabaseClient<Database>,
  id: string
): Promise<void> {
  const { error } = await supabase.from("categorias").delete().eq("id", id);
  if (error) throw new Error(`No se pudo borrar: ${error.message}`);
}

export async function borrarGrupo(
  supabase: SupabaseClient<Database>,
  id: string
): Promise<void> {
  const { error } = await supabase.from("grupos").delete().eq("id", id);
  if (error) throw new Error(`No se pudo borrar la grupo: ${error.message}`);
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

/** Borra una subcategoría. A diferencia de una categoría, esta sí se puede borrar
 *  aunque tenga líneas: la referencia queda en null y la línea conserva su categoría,
 *  su monto y su glosa. Se pierde el detalle, no el gasto. */
export async function borrarSubcategoriaTercerNivel(
  supabase: SupabaseClient<Database>,
  id: string
): Promise<void> {
  const { error } = await supabase.from("subcategorias").delete().eq("id", id);
  if (error) throw new Error(`No se pudo borrar la subcategoría: ${error.message}`);
}
