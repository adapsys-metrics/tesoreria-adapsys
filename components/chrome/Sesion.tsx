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

import { useEffect, useState } from "react";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { supabaseConfigurado } from "@/lib/supabase/estado";
import css from "./chrome.module.css";

export function Sesion() {
  const [correo, setCorreo] = useState<string | null>(null);

  useEffect(() => {
    if (!supabaseConfigurado) return;
    let vigente = true;
    crearClienteNavegador()
      .auth.getUser()
      .then(({ data }) => {
        if (vigente) setCorreo(data.user?.email ?? null);
      })
      .catch(() => {
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
      <span className={css.correo} title={correo}>
        {correo}
      </span>
      <button type="button" onClick={salir} className={css.salir}>
        Salir
      </button>
    </div>
  );
}
