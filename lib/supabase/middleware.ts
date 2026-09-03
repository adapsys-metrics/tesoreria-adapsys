import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfigurado } from "@/lib/supabase/estado";

const DOMINIO_CORPORATIVO = process.env.NEXT_PUBLIC_DOMINIO_CORPORATIVO ?? "adapsysgroup.com";
const RUTAS_PUBLICAS = ["/login", "/auth/callback", "/auth/no-autorizado"];

/** Cierra la sesión y manda a la pantalla de no autorizado. Se cierra a propósito:
 *  dejarla abierta haría que cada navegación volviera a rebotar sin explicación. */
async function rechazar(
  supabase: ReturnType<typeof createServerClient>,
  request: NextRequest
) {
  await supabase.auth.signOut();
  const url = request.nextUrl.clone();
  url.pathname = "/auth/no-autorizado";
  return NextResponse.redirect(url);
}

export async function actualizarSesion(request: NextRequest) {
  // Sin proyecto Supabase todavía (p. ej. un preview de Vercel para revisar
  // visualización) no hay sesión que resolver — dejar pasar sin redirigir.
  if (!supabaseConfigurado) {
    return NextResponse.next({ request });
  }

  let respuesta = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          respuesta = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            respuesta.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const esRutaPublica = RUTAS_PUBLICAS.some((ruta) => request.nextUrl.pathname.startsWith(ruta));

  if (!user && !esRutaPublica) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && !esRutaPublica) {
    // Dos filtros independientes. El dominio se comprueba acá porque es barato y
    // corta antes de ir a la base.
    if (!user.email?.endsWith(`@${DOMINIO_CORPORATIVO}`)) {
      return await rechazar(supabase, request);
    }

    // Y la lista de personas, que es la que manda. La política "propia_fila" de
    // usuarios_autorizados deja que cada quien lea su propio registro y nada más,
    // así que esta consulta devuelve una fila o ninguna.
    //
    // Sin esta comprobación, alguien de la empresa que no esté en la lista entraría
    // a una app que carga vacía —RLS no le devolvería nada— y parecería rota en vez
    // de negada.
    const { data: autorizado } = await supabase
      .from("usuarios_autorizados")
      .select("email")
      .eq("email", user.email)
      .eq("activo", true)
      .maybeSingle();

    if (!autorizado) {
      return await rechazar(supabase, request);
    }
  }

  return respuesta;
}
