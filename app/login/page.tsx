"use client";

import { crearClienteNavegador } from "@/lib/supabase/client";

const CONFIGURADO = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function Login() {
  const iniciarSesion = async () => {
    if (!CONFIGURADO) return;
    const supabase = crearClienteNavegador();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          hd: process.env.NEXT_PUBLIC_DOMINIO_CORPORATIVO ?? "adapsysgroup.com",
        },
      },
    });
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        fontFamily: "var(--font-sans)",
      }}
    >
      <h1 style={{ fontFamily: "var(--font-mono)", fontSize: 14, letterSpacing: ".04em", textTransform: "uppercase" }}>
        Tesorería Adapsys
      </h1>
      <button
        onClick={iniciarSesion}
        disabled={!CONFIGURADO}
        style={{
          padding: "10px 18px",
          border: "1px solid var(--rule)",
          borderRadius: 4,
          background: "var(--surface)",
          fontFamily: "var(--font-sans)",
          fontSize: 13,
          cursor: CONFIGURADO ? "pointer" : "not-allowed",
          opacity: CONFIGURADO ? 1 : 0.5,
        }}
      >
        Ingresar con Google
      </button>
      <p style={{ color: "var(--muted)", fontSize: 12 }}>
        {CONFIGURADO
          ? `Solo cuentas @${process.env.NEXT_PUBLIC_DOMINIO_CORPORATIVO ?? "adapsysgroup.com"}`
          : "Preview sin Supabase conectado — el login todavía no funciona."}
      </p>
    </main>
  );
}
