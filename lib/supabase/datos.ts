// Lectura de movimientos desde Supabase.
//
// Categorías y subcategorías se traen aparte, en lib/supabase/catalogo.ts, desde que
// la vista de Categorías las volvió editables.
//
// Empresas y cuentas siguen viviendo solo en lib/catalogo.ts: las cinco sociedades y
// sus cuentas bancarias no se administran desde la app.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { Linea, Movimiento } from "@/lib/tipos";

/** PostgREST corta en 1.000 filas por respuesta (el `max-rows` por defecto de
 *  Supabase). Con 10.530 movimientos, pedir "todo" sin paginar devuelve el 9,5%
 *  y no avisa: la respuesta es un 200 con menos datos. Por eso el bucle. */
const TAMANO_PAGINA = 1000;

const COLUMNAS =
  "id,fecha,empresa_id,cuenta_id,contraparte,glosa,documento,monto,moneda,tipo_cambio,estado,doc_tipo," +
  "movimiento_lineas(subcategoria_id,monto,glosa,orden)";

type FilaCruda = {
  id: number;
  fecha: string;
  empresa_id: string | null;
  cuenta_id: string | null;
  contraparte: string | null;
  glosa: string | null;
  documento: string | null;
  monto: number | string;
  moneda: Movimiento["moneda"];
  tipo_cambio: number | string | null;
  estado: Movimiento["estado"];
  doc_tipo: Movimiento["doc_tipo"];
  movimiento_lineas: {
    subcategoria_id: string;
    monto: number | string;
    glosa: string | null;
    orden: number;
  }[];
};

/** Postgres `numeric` puede llegar como string según la versión del cliente.
 *  Convertirlo a número acá y no en cada vista evita que un monto se concatene
 *  en vez de sumarse — un error que en una tabla de plata no se ve a simple vista. */
const aNumero = (v: number | string) => (typeof v === "number" ? v : Number(v));

function aMovimiento(fila: FilaCruda): Movimiento {
  const lineas: Linea[] = [...fila.movimiento_lineas]
    // El orden de las líneas es parte del dato: el IVA va después del neto, la
    // retención después del bruto. PostgREST no garantiza el orden de un embed.
    .sort((a, b) => a.orden - b.orden)
    .map((l) => ({
      subcategoria_id: l.subcategoria_id,
      monto: aNumero(l.monto),
      glosa: l.glosa,
    }));

  return {
    id: String(fila.id),
    fecha: fila.fecha,
    empresa_id: fila.empresa_id,
    cuenta_id: fila.cuenta_id,
    contraparte: fila.contraparte,
    glosa: fila.glosa,
    documento: fila.documento,
    monto: aNumero(fila.monto),
    moneda: fila.moneda,
    tipo_cambio: fila.tipo_cambio === null ? null : aNumero(fila.tipo_cambio),
    estado: fila.estado,
    doc_tipo: fila.doc_tipo,
    lineas,
  };
}

/** Los movimientos creados en la app llevan un id provisorio con prefijo `n`
 *  hasta que la base les asigna el suyo, que es numérico. */
export const esNuevo = (id: string) => id.startsWith("n");

/**
 * Guarda un movimiento con sus líneas y devuelve su id definitivo.
 *
 * Va por RPC y no por `.update()` + `.insert()` porque reemplazar las líneas de un
 * split tiene que ser atómico: la validación de que cuadran es una constraint
 * diferida, y entre dos llamadas de supabase-js —que son dos transacciones— el
 * movimiento quedaría descuadrado y la base lo rechazaría. Ver la migración 0007.
 */
export async function guardarMovimiento(
  supabase: SupabaseClient<Database>,
  m: Movimiento
): Promise<string> {
  const { data, error } = await supabase.rpc("fn_guardar_movimiento", {
    p: {
      // Sin id, la función inserta; con id, actualiza.
      ...(esNuevo(m.id) ? {} : { id: m.id }),
      fecha: m.fecha,
      empresa_id: m.empresa_id,
      cuenta_id: m.cuenta_id,
      contraparte: m.contraparte,
      glosa: m.glosa,
      documento: m.documento,
      monto: m.monto,
      moneda: m.moneda,
      tipo_cambio: m.tipo_cambio,
      estado: m.estado,
      doc_tipo: m.doc_tipo,
      lineas: m.lineas,
    },
  });

  if (error) throw new Error(`No se pudo guardar el movimiento: ${error.message}`);
  return String(data);
}

/**
 * Borra un movimiento. Sus líneas se van solas por el `on delete cascade`.
 *
 * Es un borrado de verdad y no una anulación con contraasiento. CLAUDE.md §10
 * apunta a lo segundo —"nada se borra, se anula"— y es lo correcto cuando haya
 * auditoría; hoy no la hay, así que un contraasiento sería dos filas que nadie
 * puede rastrear en vez de una que estorba.
 */
export async function borrarMovimiento(
  supabase: SupabaseClient<Database>,
  id: string
): Promise<void> {
  const { error } = await supabase.from("movimientos").delete().eq("id", Number(id));
  if (error) throw new Error(`No se pudo borrar el movimiento: ${error.message}`);
}

export async function cargarMovimientos(
  supabase: SupabaseClient<Database>
): Promise<Movimiento[]> {
  const movimientos: Movimiento[] = [];

  for (let pagina = 0; ; pagina++) {
    const desde = pagina * TAMANO_PAGINA;
    const { data, error } = await supabase
      .from("movimientos")
      .select(COLUMNAS)
      // Orden explícito y estable: sin él la paginación puede repetir o saltarse
      // filas, porque Postgres no promete un orden entre consultas distintas.
      .order("fecha", { ascending: true })
      .order("id", { ascending: true })
      .range(desde, desde + TAMANO_PAGINA - 1);

    if (error) throw new Error(`No se pudieron cargar los movimientos: ${error.message}`);

    const filas = (data ?? []) as unknown as FilaCruda[];
    movimientos.push(...filas.map(aMovimiento));

    if (filas.length < TAMANO_PAGINA) break;
  }

  return movimientos;
}
