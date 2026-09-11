// Empresas, cuentas y proveedores: los datos que se administran y casi nunca cambian.
//
// Hasta que hubo un mantenedor, empresas y cuentas vivían solo en lib/catalogo.ts. Las
// cuentas ahora llevan el número del banco (0014) y eso sí se edita, así que pasan por
// la base como el catálogo de categorías: si no, dos personas verían datos distintos y
// lo que quedara escrito dependería de quién recargó último.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { Cuenta, Empresa, Proveedor } from "@/lib/tipos";

export async function cargarMaestros(supabase: SupabaseClient<Database>): Promise<{
  empresas: Empresa[];
  cuentasBase: Cuenta[];
  proveedores: Proveedor[];
}> {
  const [emp, ctas, prov] = await Promise.all([
    supabase.from("empresas").select("id,nombre,corto,grupo").order("nombre"),
    supabase
      .from("cuentas")
      .select("id,empresa_id,nombre,moneda,tipo,saldo_inicial,principal,numero")
      .order("id"),
    supabase
      .from("proveedores")
      .select("id,nombre,rut,cod_banco,cuenta,correo,activo")
      .order("nombre"),
  ]);

  for (const r of [emp, ctas, prov]) {
    if (r.error) throw new Error(`No se pudieron cargar los maestros: ${r.error.message}`);
  }

  return {
    empresas: emp.data ?? [],
    // El saldo inicial llega como numeric y PostgREST lo entrega string: sin esto el
    // saldo de la cuenta se concatena en vez de sumarse.
    cuentasBase: (ctas.data ?? []).map((c) => ({ ...c, saldo_inicial: Number(c.saldo_inicial) })),
    proveedores: prov.data ?? [],
  };
}

export async function guardarEmpresa(
  supabase: SupabaseClient<Database>,
  e: Empresa
): Promise<void> {
  const { error } = await supabase.from("empresas").upsert(e);
  if (error) throw new Error(`No se pudo guardar "${e.nombre}": ${error.message}`);
}

export async function guardarCuenta(
  supabase: SupabaseClient<Database>,
  c: Cuenta
): Promise<void> {
  const { error } = await supabase.from("cuentas").upsert(c);
  if (error) throw new Error(`No se pudo guardar "${c.nombre}": ${error.message}`);
}

export async function guardarProveedor(
  supabase: SupabaseClient<Database>,
  p: Proveedor
): Promise<void> {
  const { error } = await supabase.from("proveedores").upsert(p);
  if (error) throw new Error(`No se pudo guardar "${p.nombre}": ${error.message}`);
}

/** Los proveedores sí se borran: no hay nada colgando de ellos todavía. Un proveedor
 *  que ya no se usa igual conviene desactivarlo en vez de borrarlo, para conservar sus
 *  datos bancarios por si vuelve. */
export async function borrarProveedor(
  supabase: SupabaseClient<Database>,
  id: string
): Promise<void> {
  const { error } = await supabase.from("proveedores").delete().eq("id", id);
  if (error) throw new Error(`No se pudo borrar el proveedor: ${error.message}`);
}
