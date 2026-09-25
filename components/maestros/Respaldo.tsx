"use client";

// Descargar todo, a mano.
//
// Vive en Maestros porque es lo mismo que el resto de la vista: algo que se hace de
// vez en cuando y no en el trabajo diario. Está acá y no escondido porque el respaldo
// que nadie encuentra no existe.

import { useState } from "react";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { supabaseConfigurado } from "@/lib/supabase/estado";
import { armarRespaldo, filasDe, nombreDeArchivo } from "@/lib/supabase/respaldo";
import { Aviso, BotonFantasma, Rotulo } from "@/components/ui/primitivas";
import css from "./maestros.module.css";

export function Respaldo() {
  const [estado, setEstado] = useState<"quieto" | "armando">("quieto");
  const [resultado, setResultado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const descargar = async () => {
    setEstado("armando");
    setError(null);
    setResultado(null);
    try {
      const respaldo = await armarRespaldo(crearClienteNavegador());
      const nombre = nombreDeArchivo(respaldo.generado);

      // Blob y no un data: URL — son varios MB y una URL de ese largo no la aguantan
      // todos los navegadores.
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(respaldo, null, 2)], { type: "application/json" })
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = nombre;
      a.click();
      URL.revokeObjectURL(url);

      setResultado(
        `${nombre} — ${filasDe(respaldo).toLocaleString("es-CL")} filas, con ${respaldo.movimientos.length.toLocaleString("es-CL")} movimientos y sus líneas.`
      );
    } catch (e) {
      // Decir que falló importa más acá que en otras partes: alguien que cree que tiene
      // respaldo y no lo tiene está peor que quien sabe que no lo tiene.
      setError(e instanceof Error ? e.message : "No se pudo armar el respaldo.");
    } finally {
      setEstado("quieto");
    }
  };

  return (
    <section className={css.panel}>
      <div className={css.barra}>
        <Rotulo texto="Respaldo" />
        <span className={css.empuje} />
        <BotonFantasma onClick={supabaseConfigurado ? descargar : undefined}>
          {estado === "armando" ? "Armando…" : "Descargar todo"}
        </BotonFantasma>
      </div>

      <p className={css.nota}>
        Baja un archivo con todo lo que hay en la base —movimientos con sus líneas,
        catálogo, empresas, cuentas, proveedores y presupuesto— a tu computador.
        {supabaseConfigurado
          ? " No reemplaza al respaldo automático de Supabase, que depende del plan contratado: sirve para el caso que de verdad pasa, que es borrar algo sin querer y no tener cómo volver atrás."
          : " Necesita conexión a la base: en este entorno no hay ninguna."}
      </p>

      {resultado && <Aviso tono="teal">{resultado}</Aviso>}
      {error && <Aviso tono="brick">{error}</Aviso>}
    </section>
  );
}
