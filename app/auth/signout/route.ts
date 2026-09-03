import { NextResponse } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/server";

async function cerrar(request: Request) {
  const supabase = await crearClienteServidor();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login", request.url));
}

export async function POST(request: Request) {
  return cerrar(request);
}

// También por GET, para poder cerrar sesión escribiendo la dirección. Es lo que
// se necesita justo cuando algo anda raro y no se confía en los botones.
export async function GET(request: Request) {
  return cerrar(request);
}
