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
// acceso y la controla el equipo desde Maestros. No del perfil de Google, que
// dice lo que cada quien tenga puesto ahí.
//
// Ya no lo consulta: el layout resuelve el perfil en el servidor y baja por el
// contexto, así que acá no queda un segundo viaje a la base para la misma fila.

import { crearClienteNavegador } from "@/lib/supabase/client";
import { useTesoreria } from "@/components/estado/ProveedorTesoreria";
import css from "./chrome.module.css";

export function Sesion() {
  const { sesion } = useTesoreria();
  const { email, nombre, rol } = sesion;

  if (!email) return null;

  const salir = async () => {
    await crearClienteNavegador().auth.signOut();
    // Recarga completa y no router.push: hay que soltar el estado en memoria, que
    // tiene los movimientos de quien estaba firmado.
    window.location.href = "/login";
  };

  return (
    <div className={css.sesion}>
      <span className={css.quien} title={nombre ? `${nombre} · ${email}` : email}>
        {nombre ?? email}
      </span>
      {/* Solo cuando no se puede escribir. Para los tres editores, que son el
          caso normal, una insignia que dice "editor" en cada pantalla no agrega
          nada; para quien entra a mirar, saber que no va a poder guardar explica
          de antemano por qué los botones no están. */}
      {rol === "revisor" && (
        <span className={css.rol} title="Este perfil ve pero no edita">
          solo lectura
        </span>
      )}
      <button type="button" onClick={salir} className={css.salir}>
        Salir
      </button>
    </div>
  );
}
