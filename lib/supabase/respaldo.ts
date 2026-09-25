// Respaldo completo, descargado a mano.
//
// Los datos viven en Supabase y el respaldo automático depende del plan contratado: en
// el gratuito no hay ninguno. Esto no reemplaza al del proveedor —no sirve para
// restaurar un servidor caído a las 3 de la mañana—, pero cubre lo que de verdad pasa
// en una operación de tres personas: alguien borra algo sin querer y no hay deshacer
// (§10), o hay que llevarse los datos a otra parte.
//
// Se baja desde el navegador con la sesión de quien lo pide, así que pasa por RLS y no
// hace falta ninguna llave de servicio — la de service_role se sacó de Vercel a
// propósito, porque se salta RLS.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { cargarMovimientos } from "@/lib/supabase/datos";
import { cargarCatalogo } from "@/lib/supabase/catalogo";
import { cargarMaestros } from "@/lib/supabase/maestros";

/** Lo que lleva el archivo. `version` es del formato, para poder leerlo dentro de un
 *  año sabiendo qué esperar. */
export type Respaldo = {
  version: 1;
  generado: string;
  movimientos: unknown[];
  grupos: unknown[];
  categorias: unknown[];
  subcategorias: unknown[];
  empresas: unknown[];
  cuentas: unknown[];
  proveedores: unknown[];
  presupuesto: unknown[];
  presupuesto_meses: unknown[];
  parametros: unknown[];
};

export async function armarRespaldo(supabase: SupabaseClient<Database>): Promise<Respaldo> {
  const [movimientos, catalogo, maestros, presupuesto, meses, parametros] = await Promise.all([
    cargarMovimientos(supabase),
    cargarCatalogo(supabase),
    cargarMaestros(supabase),
    supabase.from("presupuesto").select("*"),
    supabase.from("presupuesto_meses").select("*"),
    supabase.from("parametros").select("*"),
  ]);

  for (const r of [presupuesto, meses, parametros]) {
    if (r.error) throw new Error(`No se pudo armar el respaldo: ${r.error.message}`);
  }

  return {
    version: 1,
    generado: new Date().toISOString(),
    // Los movimientos van con sus líneas anidadas, que es como se guardan y como
    // habría que volver a escribirlos.
    movimientos,
    grupos: catalogo.grupos,
    categorias: catalogo.categorias,
    subcategorias: catalogo.subcategorias,
    empresas: maestros.empresas,
    cuentas: maestros.cuentasBase,
    proveedores: maestros.proveedores,
    presupuesto: presupuesto.data ?? [],
    presupuesto_meses: meses.data ?? [],
    parametros: parametros.data ?? [],
  };
}

/** Nombre con fecha: se van a acumular varios en la carpeta de descargas y el útil es
 *  el último, no el que quedó con el nombre más corto. */
export const nombreDeArchivo = (generado: string): string =>
  `tesoreria-respaldo-${generado.slice(0, 10)}.json`;

/** Cuántas filas lleva, para poder decirlo sin abrir el archivo. */
export const filasDe = (r: Respaldo): number =>
  r.movimientos.length +
  r.grupos.length +
  r.categorias.length +
  r.subcategorias.length +
  r.empresas.length +
  r.cuentas.length +
  r.proveedores.length +
  r.presupuesto.length +
  r.presupuesto_meses.length +
  r.parametros.length;
