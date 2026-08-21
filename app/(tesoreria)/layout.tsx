import { ProveedorTesoreria } from "@/components/estado/ProveedorTesoreria";
import { Encabezado } from "@/components/chrome/Encabezado";
import { Cuentas } from "@/components/chrome/Cuentas";
import css from "@/components/chrome/chrome.module.css";

export default function LayoutTesoreria({ children }: { children: React.ReactNode }) {
  return (
    <ProveedorTesoreria>
      <Encabezado />
      <div className={css.cuerpo}>
        <Cuentas />
        <main className={css.principal}>{children}</main>
      </div>
    </ProveedorTesoreria>
  );
}
