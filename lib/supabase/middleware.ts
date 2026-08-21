import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfigurado } from "@/lib/supabase/estado";

const DOMINIO_CORPORATIVO = process.env.NEXT_PUBLIC_DOMINIO_CORPORATIVO ?? "adapsysgroup.com";
const RUTAS_PUBLICAS = ["/login", "/auth/callback", "/auth/no-autorizado"];

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

  if (user && !user.email?.endsWith(`@${DOMINIO_CORPORATIVO}`)) {
    await supabase.auth.signOut();
    const url = request.nextUrl.clone();
    url.pathname = "/auth/no-autorizado";
    return NextResponse.redirect(url);
  }

  return respuesta;
}
