import { NextResponse } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/server";

// Recibe el redirect de Supabase/Google tras el login OAuth y canjea el código por sesión.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const siguiente = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await crearClienteServidor();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${siguiente}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=no_se_pudo_iniciar_sesion`);
}
