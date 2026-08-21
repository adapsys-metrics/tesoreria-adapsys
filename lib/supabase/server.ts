import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database.types";

// Uso en Server Components, Route Handlers y Server Actions.
// En un Server Component puro `cookies().set` falla (no se puede escribir cookies
// fuera de una acción o route handler); el try/catch lo ignora porque el middleware
// (lib/supabase/middleware.ts) ya se encarga de refrescar la sesión en ese caso.
export async function crearClienteServidor() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component sin permiso de escritura — el middleware refresca la sesión.
          }
        },
      },
    }
  );
}
