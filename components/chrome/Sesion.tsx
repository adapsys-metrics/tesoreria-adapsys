"use client";

// Con qué cuenta estás dentro, y cómo salir.
//
// Existe porque su ausencia hizo perder una tarde: probando el control de acceso
// desde el navegador de siempre, Google reusaba la sesión ya iniciada y entraba
// con la cuenta propia sin mostrar el selector. Parecía que "cualquier cuenta"
// pasaba el filtro. Sin ver el correo en pantalla no hay forma de desmentirlo.
//
// En una herramienta compartida por tres personas, además, saber quién está
// firmado antes de tocar un saldo no es un adorno.
//
// Se muestra el **nombre** y no el correo, que es lo que uno reconoce de un
// vistazo. Pero el correo es el dato que resuelve la duda del párrafo de arriba,
// así que no se pierde: va en el title, y pasa al frente cuando el nombre no se
// puede resolver — que es justo el caso en que uno está averiguando con qué
// cuenta entró.
//
// El nombre sale de `usuarios_autorizados`, que es la misma lista que da el
// acceso y la controla el equipo desde el panel. No del perfil de Google, que
// dice lo que cada quien tenga puesto ahí.

import { useEffect, useState } from "react";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { supabaseConfigurado } from "@/lib/supabase/estado";
import css from "./chrome.module.css";

export function Sesion() {
  const [correo, setCorreo] = useState<string | null>(null);
  const [nombre, setNombre] = useState<string | null>(null);

  useEffect(() => {
    if (!supabaseConfigurado) return;
    let vigente = true;
    const supabase = crearClienteNavegador();

    (async () => {
      const { data } = await supabase.auth.getUser();
      const email = data.user?.email ?? null;
      if (!vigente || !email) return;
      setCorreo(email);

      // La política "propia_fila" deja leer el propio registro y nada más, así
      // que esto devuelve una fila o ninguna. Si no hay, se muestra el correo:
      // no tener fila es exactamente el caso que conviene ver.
      const { data: fila } = await supabase
        .from("usuarios_autorizados")
        .select("nombre")
        .eq("email", email)
        .maybeSingle();
      if (vigente) setNombre(fila?.nombre ?? null);
    })().catch(() => {
      // Sin sesión no hay nada que mostrar; del acceso se encarga el middleware.
    });

    return () => {
      vigente = false;
    };
  }, []);

  if (!correo) return null;

  const salir = async () => {
    await crearClienteNavegador().auth.signOut();
    // Recarga completa y no router.push: hay que soltar el estado en memoria, que
    // tiene los movimientos de quien estaba firmado.
    window.location.href = "/login";
  };

  return (
    <div className={css.sesion}>
      <span className={css.quien} title={nombre ? `${nombre} · ${correo}` : correo}>
        {nombre ?? correo}
      </span>
      <button type="button" onClick={salir} className={css.salir}>
        Salir
      </button>
    </div>
  );
}
