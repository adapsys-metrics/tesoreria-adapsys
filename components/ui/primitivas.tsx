// Primitivas de UI portadas de tesoreria.jsx. Van todas juntas porque son piezas
// chicas y muy relacionadas; los componentes con lógica propia viven en su archivo.

import type { ReactNode } from "react";
import type { EstadoMovimiento } from "@/lib/tipos";
import { clp } from "@/lib/formato";
import css from "./primitivas.module.css";

const clases = (...xs: (string | false | undefined)[]) => xs.filter(Boolean).join(" ");

/**
 * Un hueco con la forma de lo que todavía no llegó.
 *
 * No es decoración. Mientras los movimientos cargan, **todos los números de la
 * pantalla están mal**: los saldos valen su saldo inicial, los contadores valen
 * cero y el gasto a la fecha vale cero. Son números plausibles y equivocados, que
 * es la peor clase: un cartel arriba no alcanza cuando lo de abajo se lee como un
 * dato. Así que mientras carga no se muestra ningún número, se muestra su hueco.
 */
export function Hueco({ ancho = 70 }: { ancho?: number }) {
  return <span className={css.hueco} style={{ width: ancho }} aria-hidden="true" />;
}

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

export function Cabecera({
  titulo,
  bajada,
  derecha,
}: {
  titulo: string;
  bajada: ReactNode;
  /** El número que resume lo que se está mirando, a la derecha del título. Lo usa
   *  el registro abierto, como en Quicken. */
  derecha?: ReactNode;
}) {
  return (
    <div className={css.cabecera}>
      <div className={css.cabeceraTexto}>
        <h1>{titulo}</h1>
        <p>{bajada}</p>
      </div>
      {derecha && <div className={css.cabeceraDerecha}>{derecha}</div>}
    </div>
  );
}

/** El número que resume el registro abierto. Va en la cabecera, a la derecha. */
export function SaldoCabecera({
  rotulo,
  texto,
  negativo,
  cargando,
}: {
  rotulo: string;
  texto: string;
  negativo?: boolean;
  cargando?: boolean;
}) {
  return (
    <>
      <span className={css.cabeceraRotulo}>{rotulo}</span>
      <div
        className={clases(css.cabeceraMonto, negativo && !cargando && css.cabeceraMontoNegativo)}
      >
        {cargando ? <Hueco ancho={140} /> : texto}
      </div>
    </>
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

/**
 * El lugar de una tabla que todavía no llegó.
 *
 * Va en vez del "no hay nada": durante la carga, una tabla vacía con su mensaje
 * dice que la empresa no tiene movimientos, que es exactamente lo contrario de
 * lo que pasa.
 */
export function TablaFantasma({ filas = 8, columnas = 5 }: { filas?: number; columnas?: number }) {
  return (
    <div className={css.fantasma} aria-busy="true" aria-label="Cargando movimientos">
      {Array.from({ length: filas }, (_, f) => (
        <div key={f} className={css.filaFantasma}>
          {Array.from({ length: columnas }, (_, c) => (
            // Anchos desparejos y estables: una grilla perfecta se lee como una
            // tabla de verdad con los datos en blanco.
            <Hueco key={c} ancho={[120, 86, 150, 70, 64][c % 5]} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function Cifra({
  rotulo,
  valor,
  tono,
  fuerte,
  texto,
  cargando,
}: {
  rotulo: string;
  valor?: number;
  tono?: string;
  fuerte?: boolean;
  texto?: string;
  cargando?: boolean;
}) {
  return (
    <div>
      <div className={css.cifraRotulo}>{rotulo}</div>
      <div
        className={clases(css.cifraValor, fuerte && css.cifraFuerte)}
        style={tono && !cargando ? { color: tono } : undefined}
      >
        {cargando ? <Hueco ancho={fuerte ? 130 : 100} /> : (texto ?? "$" + clp(valor ?? 0))}
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
