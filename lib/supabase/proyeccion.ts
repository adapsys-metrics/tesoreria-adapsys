// Escribir la proyección de un año.
//
// Va por RPC y no por inserciones sueltas porque son cientos de movimientos con
// sus líneas, y porque la validación de que las líneas cuadran con el monto es
// una constraint diferida: se evalúa al cerrar la transacción (§3). En una sola
// transacción, o entra toda la proyección o no entra nada — nunca media.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { MovimientoProyectado } from "@/lib/proyeccion";

/**
 * Reemplaza los movimientos generados para ese año.
 *
 * Reemplaza **solo los suyos**: el borrado va por `origen`, y lo que alguien
 * cargó a mano tiene origen nulo. Rehacer la proyección no puede borrar trabajo
 * ajeno, que es lo que haría que nadie se atreviera a rehacerla.
 */
export async function generarProyeccion(
  supabase: SupabaseClient<Database>,
  anio: number,
  movimientos: MovimientoProyectado[]
): Promise<number> {
  const { data, error } = await supabase.rpc("fn_generar_proyeccion", {
    p: { anio, movimientos },
  });
  if (error) throw new Error(`No se pudo generar la proyección: ${error.message}`);
  return data ?? 0;
}
