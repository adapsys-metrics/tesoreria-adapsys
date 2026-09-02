"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { crearClienteNavegador } from "@/lib/supabase/client";

const CONFIGURADO = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function Login() {
  // El callback manda acá con ?error=... cuando el canje falla. Sin mostrarlo,
  // un login fallido se ve idéntico a no haber apretado el botón.
  // Se lee de window y no con useSearchParams para no obligar a envolver la
  // página en un Suspense solo por esto.
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const motivo = new URLSearchParams(window.location.search).get("error");
    if (motivo) setError(motivo);
  }, []);

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
      {/* Se muestra a su tamaño real (174×120) y no ampliado: el GIF trae 8 colores
          y transparencia de 1 bit, así que al agrandarlo los bordes se ven dentados.
          `unoptimized` es obligatorio — sin eso Next lo recomprime y se queda en el
          primer cuadro, que en este archivo viene casi en blanco. */}
      <Image
        src="/logo-adapsys.gif"
        alt="Adapsys"
        width={174}
        height={120}
        unoptimized
        priority
      />
      <h1
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: 13,
          fontWeight: 500,
          letterSpacing: ".08em",
          textTransform: "uppercase",
          color: "var(--teal)",
          margin: 0,
        }}
      >
        Tesorería
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
      {error && (
        <p
          role="alert"
          style={{
            color: "var(--brick)",
            fontSize: 12,
            maxWidth: 380,
            textAlign: "center",
            lineHeight: 1.5,
          }}
        >
          No se pudo iniciar sesión: {error}
        </p>
      )}
    </main>
  );
}
