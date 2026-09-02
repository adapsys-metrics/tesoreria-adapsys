"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { crearClienteNavegador } from "@/lib/supabase/client";
import css from "./login.module.css";

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
    <main className={css.pantalla}>
      {/* Solo decoración: detrás del contenido y sin captura de puntero, para que
          nunca se interponga con el botón. */}
      <div className={css.decoracion} aria-hidden="true">
        <div className={css.puntos} />
        <div className={css.circuloRelleno} />
        <div className={css.circuloContorno} />
        <div className={css.circuloMagenta} />
      </div>

      <div className={css.contenido}>
        {/* `unoptimized` no es opcional: sin eso Next recomprime el GIF y se queda
            en el primer cuadro, que viene vacío porque el logo se va dibujando. */}
        <Image
          className={css.logo}
          src="/logo-adapsys-blanco.gif"
          alt="Adapsys"
          width={476}
          height={369}
          unoptimized
          priority
        />
        <Image
          className={css.logoQuieto}
          src="/logo-adapsys.png"
          alt=""
          width={1500}
          height={983}
          priority
        />

        <h1 className={css.titulo}>Tesorería</h1>

        <button onClick={iniciarSesion} disabled={!CONFIGURADO} className={css.boton}>
          Ingresar con Google
        </button>

        <p className={css.nota}>
          {CONFIGURADO
            ? `Solo cuentas @${process.env.NEXT_PUBLIC_DOMINIO_CORPORATIVO ?? "adapsysgroup.com"}`
            : "Preview sin Supabase conectado — el login todavía no funciona."}
        </p>

        {error && (
          <p role="alert" className={css.error}>
            No se pudo iniciar sesión: {error}
          </p>
        )}
      </div>
    </main>
  );
}
