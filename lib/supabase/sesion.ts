import type { SupabaseClient } from "@supabase/supabase-js";

// Quién entró y qué puede hacer.
//
// Se resuelve en el **servidor**, en el layout, y baja como prop. Hacerlo en el
// cliente significa un render con la respuesta todavía en vuelo, y en ese render
// hay que decidir qué mostrar: con el menú completo, un revisor ve por un
// instante pestañas que no son suyas; con el menú vacío, los tres editores ven
// parpadear la app en cada carga. Resuelto antes del primer pintado no hay nada
// que elegir.
//
// Y de paso ahorra una consulta: `Sesion` —el nombre de arriba a la derecha—
// pedía esta misma fila por su cuenta.

export type Rol = "editor" | "revisor";

export type DatosSesion = {
  email: string;
  /** De `usuarios_autorizados`, no del perfil de Google (§1). Null si no hay
   *  fila, que es justo el caso que conviene ver. */
  nombre: string | null;
  rol: Rol;
  /** Claves de `lib/vistas.ts`. null = todas. */
  vistas: string[] | null;
};

/** El perfil por defecto: puede todo. Es lo que corre sin Supabase configurado
 *  —los tests y los previews— donde no hay a quién preguntarle. */
export const SESION_COMPLETA: DatosSesion = {
  email: "",
  nombre: null,
  rol: "editor",
  vistas: null,
};

export async function cargarSesion(
  supabase: SupabaseClient<never>
): Promise<DatosSesion | null> {
  const { data } = await supabase.auth.getUser();
  const email = data.user?.email ?? null;
  if (!email) return null;

  // La política "propia_fila" (0009) deja leer el propio registro, así que esto
  // devuelve una fila o ninguna.
  const { data: fila } = await supabase
    .from("usuarios_autorizados")
    .select("nombre, rol, vistas")
    .eq("email", email)
    .maybeSingle();

  const f = fila as { nombre: string | null; rol: string | null; vistas: string[] | null } | null;

  return {
    email,
    nombre: f?.nombre ?? null,
    // Sin fila no se asume editor. No debería ocurrir —el middleware no deja
    // pasar a quien no está en la lista— pero si ocurre, lo caro es el falso
    // permiso, no el falso bloqueo.
    rol: f?.rol === "editor" ? "editor" : "revisor",
    vistas: f?.vistas ?? null,
  };
}
