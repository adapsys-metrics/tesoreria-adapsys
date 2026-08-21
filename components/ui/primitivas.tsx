// Primitivas de UI portadas de tesoreria.jsx. Van todas juntas porque son piezas
// chicas y muy relacionadas; los componentes con lógica propia viven en su archivo.

import type { ReactNode } from "react";
import type { EstadoMovimiento } from "@/lib/tipos";
import { clp } from "@/lib/formato";
import css from "./primitivas.module.css";

const clases = (...xs: (string | false | undefined)[]) => xs.filter(Boolean).join(" ");

export function Chip({
  activo,
  onClick,
  children,
  chico,
  titulo,
}: {
  activo?: boolean;
  onClick?: () => void;
  children: ReactNode;
  chico?: boolean;
  titulo?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={titulo}
      aria-pressed={activo}
      className={clases(css.chip, chico && css.chipChico, activo && css.chipActivo)}
    >
      {children}
    </button>
  );
}

const PILL: Record<EstadoMovimiento, { texto: string; clase: string }> = {
  conciliado: { texto: "Conciliado", clase: css.pillConciliado! },
  pagado: { texto: "Pagado", clase: css.pillPagado! },
  proyectado: { texto: "Proyectado", clase: css.pillProyectado! },
};

export function Pill({ estado }: { estado: EstadoMovimiento }) {
  const p = PILL[estado];
  return <span className={clases(css.pill, p.clase)}>{p.texto}</span>;
}

export function Cabecera({ titulo, bajada }: { titulo: string; bajada: ReactNode }) {
  return (
    <div className={css.cabecera}>
      <h1>{titulo}</h1>
      <p>{bajada}</p>
    </div>
  );
}

export function Aviso({
  children,
  tono = "neutro",
}: {
  children: ReactNode;
  tono?: "neutro" | "teal" | "brick" | "amber";
}) {
  const porTono = {
    neutro: undefined,
    teal: css.avisoTeal,
    brick: css.avisoBrick,
    amber: css.avisoAmber,
  }[tono];
  return <div className={clases(css.aviso, porTono)}>{children}</div>;
}

export function Nota({ children }: { children: ReactNode }) {
  return <p className={css.nota}>{children}</p>;
}

export function Vacio({ children }: { children: ReactNode }) {
  return <div className={css.vacio}>{children}</div>;
}

export function Rotulo({ texto, pad }: { texto: string; pad?: boolean }) {
  return <div className={clases(css.rotulo, pad && css.rotuloPad)}>{texto}</div>;
}

export function Cifra({
  rotulo,
  valor,
  tono,
  fuerte,
  texto,
}: {
  rotulo: string;
  valor?: number;
  tono?: string;
  fuerte?: boolean;
  texto?: string;
}) {
  return (
    <div>
      <div className={css.cifraRotulo}>{rotulo}</div>
      <div
        className={clases(css.cifraValor, fuerte && css.cifraFuerte)}
        style={tono ? { color: tono } : undefined}
      >
        {texto ?? "$" + clp(valor ?? 0)}
      </div>
    </div>
  );
}

export function Check({
  on,
  onClick,
  children,
  sangria,
}: {
  on: boolean;
  onClick: () => void;
  children: ReactNode;
  sangria?: boolean;
}) {
  return (
    <label className={clases(css.check, sangria && css.checkSangria)}>
      <input type="checkbox" checked={on} onChange={onClick} />
      {children}
    </label>
  );
}

export function BotonFantasma({
  onClick,
  children,
  titulo,
}: {
  onClick?: () => void;
  children: ReactNode;
  titulo?: string;
}) {
  return (
    <button type="button" onClick={onClick} title={titulo} className={css.botonFantasma}>
      {children}
    </button>
  );
}

export function BotonMini({
  onClick,
  children,
}: {
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} className={css.botonMini}>
      {children}
    </button>
  );
}

export function Insignia({ children }: { children: ReactNode }) {
  return <span className={css.insignia}>{children}</span>;
}

export const clasePopover = css.popover!;
export { clases };
