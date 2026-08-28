import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Recibe el redirect de Supabase/Google tras el login OAuth y canjea el código
// por sesión.
//
// El orden importa: la respuesta de redirección se construye ANTES de canjear el
// código, para que las cookies de sesión se escriban directamente sobre ella.
//
// Antes esto usaba el cliente de `next/headers` y devolvía un NextResponse nuevo
// al final. Las cookies quedaban en el almacén de headers y no siempre viajaban
// en esa respuesta: el middleware no veía sesión en el request siguiente y
// devolvía al login. El usuario apretaba "Ingresar con Google" de nuevo y ahí sí
// entraba, porque Google ya lo reconocía y el segundo canje alcanzaba a cuajar.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Directo a /flujo en vez de "/" para evitar un salto extra.
  const siguiente = searchParams.get("next") ?? "/flujo";

  const alLogin = (motivo: string) =>
    NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(motivo)}`);

  if (!code) {
    return alLogin("Google no devolvió un código de autorización.");
  }

  const respuesta = NextResponse.redirect(`${origin}${siguiente}`);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            respuesta.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    // El mensaje va a la pantalla de login: un fallo acá sin explicación es
    // indistinguible de no haber apretado el botón.
    return alLogin(error.message);
  }

  return respuesta;
}
