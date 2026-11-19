import { ProveedorTesoreria } from "@/components/estado/ProveedorTesoreria";
import { Encabezado } from "@/components/chrome/Encabezado";
import { Cuentas } from "@/components/chrome/Cuentas";
import { EstadoCarga } from "@/components/chrome/EstadoCarga";
import { crearClienteServidor } from "@/lib/supabase/server";
import { supabaseConfigurado } from "@/lib/supabase/estado";
import { SESION_COMPLETA, cargarSesion } from "@/lib/supabase/sesion";
import css from "@/components/chrome/chrome.module.css";

// El perfil se resuelve acá, en el servidor, y baja como prop: así el primer
// pintado ya sabe qué pestañas van y con qué permisos, sin un parpadeo en el
// que el menú muestra de más o de menos (lib/supabase/sesion.ts).
export default async function LayoutTesoreria({ children }: { children: React.ReactNode }) {
  const sesion = supabaseConfigurado
    ? ((await cargarSesion(await crearClienteServidor())) ?? SESION_COMPLETA)
    : SESION_COMPLETA;

  return (
    <ProveedorTesoreria sesion={sesion}>
      <Encabezado />
      <EstadoCarga />
      <div className={css.cuerpo}>
        <Cuentas />
        <main className={css.principal}>{children}</main>
      </div>
    </ProveedorTesoreria>
  );
}
