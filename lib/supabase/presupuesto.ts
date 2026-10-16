// Lectura y escritura del presupuesto.
//
// Son dos tablas —los doce meses por un lado, la metadata por otro— y se cargan
// juntas porque en pantalla son una sola fila.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { LineaPresupuesto } from "@/lib/tipos";
import { MESES_DEL_ANIO, type Meses } from "@/lib/presupuesto";
import { clave } from "@/lib/catalogo-indices";

/** Un mes que cambió después de aprobado el año (§4.6). */
export type CambioPresupuesto = {
  categoria_id: string;
  subcategoria_id: string | null;
  mes: number;
  antes: number;
  despues: number;
  motivo: string;
  cuando: string;
};

/**
 * Todo va indexado por **clave de reporte** —`categoria` o `categoria>subcategoria`—
 * y no por categoría a secas. Antes se agrupaba por `categoria_id` y las líneas de
 * subcategoría se plegaban dentro de su categoría **en silencio**: el presupuesto
 * de las hijas se sumaba al de la madre y no fallaba nada, solo daba otro número.
 */
export type PresupuestoDelAnio = {
  /** Los doce meses vigentes de cada línea presupuestada. */
  meses: Map<string, Meses>;
  /** Los doce meses tal como se aprobaron. Vacío mientras el año no esté
   *  aprobado: ahí no hay "inicial" todavía, se está construyendo. */
  inicial: Map<string, Meses>;
  /** Responsable, nota y presupuesto del año anterior. */
  metadata: Map<string, LineaPresupuesto>;
  /** Cuándo se aprobó el año, o null si sigue en construcción. */
  aprobado: string | null;
  /** La bitácora completa del año, de lo más reciente a lo más antiguo. */
  cambios: CambioPresupuesto[];
};

const vacios = (): Meses => Array<number>(MESES_DEL_ANIO).fill(0);
const aNumero = (v: number | string) => (typeof v === "number" ? v : Number(v));

export async function cargarPresupuesto(
  supabase: SupabaseClient<Database>,
  anio: number
): Promise<PresupuestoDelAnio> {
  const [porMes, meta, base, bitacora, aprobacion] = await Promise.all([
    supabase
      .from("presupuesto_meses")
      .select("categoria_id,subcategoria_id,mes,monto")
      .eq("anio", anio),
    supabase
      .from("presupuesto")
      .select("categoria_id,subcategoria_id,monto_anterior,responsable,nota")
      .eq("anio", anio),
    supabase
      .from("presupuesto_inicial")
      .select("categoria_id,subcategoria_id,mes,monto")
      .eq("anio", anio),
    supabase
      .from("presupuesto_cambios")
      .select("categoria_id,subcategoria_id,mes,antes,despues,motivo,cuando")
      .eq("anio", anio)
      .order("cuando", { ascending: false }),
    supabase.from("presupuesto_anios").select("aprobado_en").eq("anio", anio).maybeSingle(),
  ]);

  for (const r of [porMes, meta, base, bitacora, aprobacion]) {
    if (r.error) throw new Error(`No se pudo cargar el presupuesto: ${r.error.message}`);
  }

  /** Los doce meses por clave de reporte. */
  const porClave = (
    filas: {
      categoria_id: string;
      subcategoria_id: string | null;
      mes: number;
      monto: number;
    }[]
  ) => {
    const mapa = new Map<string, Meses>();
    for (const fila of filas) {
      const k = clave(fila.categoria_id, fila.subcategoria_id);
      const actuales = mapa.get(k) ?? vacios();
      // La base garantiza que el mes está entre 1 y 12; el índice es mes − 1.
      actuales[fila.mes - 1] = aNumero(fila.monto);
      mapa.set(k, actuales);
    }
    return mapa;
  };

  const meses = porClave(porMes.data ?? []);
  const inicial = porClave(base.data ?? []);

  const metadata = new Map<string, LineaPresupuesto>();
  for (const fila of meta.data ?? []) {
    metadata.set(clave(fila.categoria_id, fila.subcategoria_id), {
      monto: 0, // el anual sale de los meses, no se guarda aparte
      monto_anterior: aNumero(fila.monto_anterior),
      responsable: fila.responsable ?? "",
      nota: fila.nota ?? "",
    });
  }

  const cambios: CambioPresupuesto[] = (bitacora.data ?? []).map((c) => ({
    categoria_id: c.categoria_id,
    subcategoria_id: c.subcategoria_id,
    mes: c.mes,
    antes: aNumero(c.antes),
    despues: aNumero(c.despues),
    motivo: c.motivo,
    cuando: c.cuando,
  }));

  return {
    meses,
    inicial,
    metadata,
    aprobado: aprobacion.data?.aprobado_en ?? null,
    cambios,
  };
}

/**
 * Congela el presupuesto del año y lo marca aprobado.
 *
 * Es un acto explícito y no "la primera vez que alguien edita": mientras el año
 * se está armando, editar es construir. Desde acá en adelante editar es ajustar,
 * y cada ajuste tiene que decir por qué.
 */
export async function aprobarPresupuesto(
  supabase: SupabaseClient<Database>,
  anio: number,
  nota?: string
): Promise<void> {
  const { error } = await supabase.rpc("fn_aprobar_presupuesto", {
    p_anio: anio,
    p_nota: nota ?? null,
  });
  if (error) throw new Error(`No se pudo aprobar el presupuesto: ${error.message}`);
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
  categoria_id: string,
  /** Null es la línea de la categoría en sí, el "(Other)" de Quicken (§3). */
  subcategoria_id: string | null,
  linea: LineaPresupuesto,
  meses: Meses,
  /** Por qué se ajusta. Con el año aprobado la base lo exige: sin motivo, la
   *  bitácora es una lista de números que en diciembre no le dice nada a nadie. */
  motivo?: string
): Promise<void> {
  const { error } = await supabase.rpc("fn_guardar_presupuesto", {
    p: {
      anio,
      categoria_id,
      subcategoria_id: subcategoria_id ?? "",
      monto_anterior: linea.monto_anterior,
      responsable: linea.responsable,
      nota: linea.nota,
      meses,
      motivo: motivo ?? "",
    },
  });
  if (error) throw new Error(`No se pudo guardar el presupuesto: ${error.message}`);
}
