"use client";

import Image from "next/image";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTesoreria } from "@/components/estado/ProveedorTesoreria";
import { Cifra, clases } from "@/components/ui/primitivas";
import { clp } from "@/lib/formato";
import { SelectorEmpresas } from "./SelectorEmpresas";
import { Sesion } from "./Sesion";
import css from "./chrome.module.css";

// Las vistas sin ruta todavía se muestran deshabilitadas en vez de omitirse, para
// que se vea qué falta y no parezca que el sistema son solo las que están.
//
// Conciliación no está y no va a estar: el banco se revisa todos los días y un
// movimiento se marca pagado justamente porque ya está en la cartola, así que el
// estado `pagado` no se usa y esa lista sería siempre vacía (§4.1). Lo que sí se
// mira a diario son los vencidos, y eso vive en el flujo y en la barra lateral.
const VISTAS = [
  { href: "/flujo", texto: "Flujo de caja" },
  { href: "/movimientos", texto: "Movimientos" },
  { href: "/presupuesto", texto: "Presupuesto anual" },
  { href: null, texto: "Reportes" },
  { href: "/categorias", texto: "Categorías" },
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
          {/* El logotipo real reemplaza al texto. Se declara a su tamaño nativo
              (1500×983) y el CSS lo baja a la altura del encabezado: así el
              navegador reserva el espacio antes de cargarlo y la fila no salta. */}
          <Image
            className={css.logotipo}
            src="/logo-adapsys.png"
            alt="Adapsys"
            width={1500}
            height={983}
            priority
          />
          <span className={css.marcaTexto}>Tesorería</span>
        </div>

        <SelectorEmpresas />

        <Sesion />

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

        {/* El nombre importa: con Supabase conectado esto recarga desde la base,
            no descarta nada. Decía RESET / "volver a los datos de ejemplo", que es
            lo que hacía antes de que hubiera base — un botón que dice que va a
            borrar y en realidad refresca es peor que no tenerlo. */}
        <button
          type="button"
          onClick={reiniciar}
          title="Traer los datos frescos de la base, por si alguien más cambió algo"
          className={css.reset}
        >
          RECARGAR
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
