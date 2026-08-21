import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { supabaseConfigurado } from "@/lib/supabase/estado";

export default async function Home() {
  if (!supabaseConfigurado) {
    return (
      <main style={{ padding: 32, fontFamily: "var(--font-sans)" }}>
        <h1 style={{ fontFamily: "var(--font-mono)", fontSize: 14, letterSpacing: ".04em", textTransform: "uppercase" }}>
          Tesorería Adapsys
        </h1>
        <p style={{ color: "var(--brick)", fontSize: 13, marginTop: 12 }}>
          Preview sin Supabase conectado — cargar NEXT_PUBLIC_SUPABASE_URL y
          NEXT_PUBLIC_SUPABASE_ANON_KEY en Vercel para habilitar login y datos reales.
        </p>
      </main>
    );
  }

  const supabase = await crearClienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: empresas, error } = await supabase
    .from("empresas")
    .select("id, nombre, grupo")
    .order("id");

  return (
    <main style={{ padding: 32, fontFamily: "var(--font-sans)" }}>
      <h1 style={{ fontFamily: "var(--font-mono)", fontSize: 14, letterSpacing: ".04em", textTransform: "uppercase" }}>
        Tesorería Adapsys
      </h1>
      <p style={{ color: "var(--muted)", fontSize: 13 }}>
        Sesión: {user.email}
      </p>

      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 13, color: "var(--muted)", fontWeight: 500 }}>Empresas (desde Supabase)</h2>
        {error ? (
          <p style={{ color: "var(--brick)" }}>Error leyendo empresas: {error.message}</p>
        ) : (
          <ul>
            {empresas?.map((e) => (
              <li key={e.id} style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>
                {e.nombre} — {e.grupo}
              </li>
            ))}
          </ul>
        )}
      </section>

      <form action="/auth/signout" method="post" style={{ marginTop: 24 }}>
        <button type="submit">Cerrar sesión</button>
      </form>
    </main>
  );
}
