"use client";

// Banda de estado de la carga desde Supabase.
//
// Existe porque los dos casos malos se ven igual que el caso bueno: una app que
// todavía está cargando y una app que falló al cargar muestran las mismas tablas
// vacías y los mismos saldos en cero que una empresa sin movimientos. En una
// herramienta de tesorería eso es peor que un error a la vista.

import { useTesoreria } from "@/components/estado/ProveedorTesoreria";
import css from "./chrome.module.css";

export function EstadoCarga() {
  const { cargando, errorCarga, errorGuardado, movimientos } = useTesoreria();

  // Va primero: un cambio que no se guardó es más urgente que cualquier otra cosa,
  // porque en pantalla se ve aplicado y se pierde al recargar.
  if (errorGuardado) {
    return (
      <div className={css.bandaError} role="alert">
        <strong>Un cambio no se pudo guardar.</strong> {errorGuardado}
        <br />
        Lo que ves en pantalla no está en la base. Recarga la página para ver el estado real.
      </div>
    );
  }

  if (errorCarga) {
    return (
      <div className={css.bandaError} role="alert">
        <strong>No se pudieron cargar los movimientos.</strong> {errorCarga}
        <br />
        Los saldos y totales que se ven abajo están incompletos: no los uses para decidir nada.
      </div>
    );
  }

  if (cargando) {
    return <div className={css.bandaCarga}>Cargando movimientos…</div>;
  }

  if (movimientos.length === 0) {
    return (
      <div className={css.bandaCarga}>
        No hay movimientos cargados en la base.
      </div>
    );
  }

  return null;
}
