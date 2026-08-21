"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTesoreria } from "@/components/estado/ProveedorTesoreria";
import { Cifra, clases } from "@/components/ui/primitivas";
import { clp } from "@/lib/formato";
import { SelectorEmpresas } from "./SelectorEmpresas";
import css from "./chrome.module.css";

// Las cuatro vistas sin ruta todavía se muestran deshabilitadas en vez de omitirse,
// para que se vea que el sistema son seis vistas y no dos.
const VISTAS = [
  { href: "/flujo", texto: "Flujo de caja" },
  { href: "/movimientos", texto: "Movimientos" },
  { href: null, texto: "Conciliación" },
  { href: null, texto: "Presupuesto anual" },
  { href: null, texto: "Reportes" },
  { href: null, texto: "Categorías" },
];

export function Encabezado() {
  const ruta = usePathname();
  const { efectivo, saldoUsd, porCobrar, porCobrarUsd, comprometido, reiniciar } =
    useTesoreria();

  const posicion = efectivo + comprometido;
  const porCobrarTexto =
    porCobrar || porCobrarUsd
      ? [porCobrar ? "$" + clp(porCobrar) : null, porCobrarUsd ? "US$" + clp(porCobrarUsd) : null]
          .filter(Boolean)
          .join("  ")
      : "—";

  return (
    <header className={css.header}>
      <div className={css.filaSuperior}>
        <div className={css.marca}>
          TESORERÍA<span>/</span>ADAPSYS
        </div>

        <SelectorEmpresas />

        <div className={css.cifras}>
          <Cifra rotulo="Efectivo CLP" valor={efectivo} tono="var(--teal)" />
          <Cifra rotulo="Comprometido CLP" valor={comprometido} tono="var(--brick)" />
          <Cifra
            rotulo="Posición proyectada CLP"
            valor={posicion}
            tono={posicion < 0 ? "var(--brick)" : "var(--ink)"}
            fuerte
          />
          <Cifra rotulo="Saldo USD" texto={"US$" + clp(saldoUsd)} tono="var(--muted)" />
          <Cifra rotulo="Por cobrar" texto={porCobrarTexto} tono="var(--muted)" />
        </div>

        <button
          type="button"
          onClick={reiniciar}
          title="Volver a los datos de ejemplo"
          className={css.reset}
        >
          RESET
        </button>
      </div>

      <nav className={css.nav}>
        {VISTAS.map((v) =>
          v.href ? (
            <Link
              key={v.texto}
              href={v.href}
              className={clases(css.tab, ruta === v.href && css.tabActivo)}
            >
              {v.texto}
            </Link>
          ) : (
            <span
              key={v.texto}
              className={clases(css.tab, css.tabPendiente)}
              title="Todavía no portada desde el prototipo"
            >
              {v.texto}
            </span>
          )
        )}
      </nav>
    </header>
  );
}
