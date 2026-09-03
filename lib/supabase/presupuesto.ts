// Lectura y escritura del presupuesto.
//
// Son dos tablas —los doce meses por un lado, la metadata por otro— y se cargan
// juntas porque en pantalla son una sola fila.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { LineaPresupuesto } from "@/lib/tipos";
import { MESES_DEL_ANIO, type Meses } from "@/lib/presupuesto";

export type PresupuestoDelAnio = {
  /** Los doce meses de cada subcategoría presupuestada. */
  meses: Map<string, Meses>;
  /** Responsable, nota y presupuesto del año anterior. */
  metadata: Map<string, LineaPresupuesto>;
};

const vacios = (): Meses => Array<number>(MESES_DEL_ANIO).fill(0);
const aNumero = (v: number | string) => (typeof v === "number" ? v : Number(v));

export async function cargarPresupuesto(
  supabase: SupabaseClient<Database>,
  anio: number
): Promise<PresupuestoDelAnio> {
  const [porMes, meta] = await Promise.all([
    supabase.from("presupuesto_meses").select("subcategoria_id,mes,monto").eq("anio", anio),
    supabase
      .from("presupuesto")
      .select("subcategoria_id,monto_anterior,responsable,nota")
      .eq("anio", anio),
  ]);

  if (porMes.error) {
    throw new Error(`No se pudo cargar el presupuesto: ${porMes.error.message}`);
  }
  if (meta.error) {
    throw new Error(`No se pudo cargar el presupuesto: ${meta.error.message}`);
  }

  const meses = new Map<string, Meses>();
  for (const fila of porMes.data ?? []) {
    const actuales = meses.get(fila.subcategoria_id) ?? vacios();
    // La base garantiza que el mes está entre 1 y 12; el índice es mes − 1.
    actuales[fila.mes - 1] = aNumero(fila.monto);
    meses.set(fila.subcategoria_id, actuales);
  }

  const metadata = new Map<string, LineaPresupuesto>();
  for (const fila of meta.data ?? []) {
    metadata.set(fila.subcategoria_id, {
      monto: 0, // el anual sale de los meses, no se guarda aparte
      monto_anterior: aNumero(fila.monto_anterior),
      responsable: fila.responsable ?? "",
      nota: fila.nota ?? "",
    });
  }

  return { meses, metadata };
}

/**
 * Guarda una línea completa: los doce meses y su metadata.
 *
 * Va por RPC para que las dos tablas se escriban juntas. Con dos llamadas podría
 * entrar una y fallar la otra, y quedaría una línea con montos nuevos y el
 * responsable viejo sin que nadie se entere.
 */
export async function guardarLineaPresupuesto(
  supabase: SupabaseClient<Database>,
  anio: number,
  subcategoria_id: string,
  linea: LineaPresupuesto,
  meses: Meses
): Promise<void> {
  const { error } = await supabase.rpc("fn_guardar_presupuesto", {
    p: {
      anio,
      subcategoria_id,
      monto_anterior: linea.monto_anterior,
      responsable: linea.responsable,
      nota: linea.nota,
      meses,
    },
  });
  if (error) throw new Error(`No se pudo guardar el presupuesto: ${error.message}`);
}
