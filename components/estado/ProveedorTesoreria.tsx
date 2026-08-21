"use client";

// Estado compartido de la app. Es el equivalente del componente raíz del prototipo,
// pero como context, para que sobreviva a la navegación entre rutas.
//
// TEMPORAL: hoy el estado arranca de los datos de ejemplo y persiste en
// localStorage. Cuando entre Supabase, este archivo es el punto donde los datos
// pasan a venir del servidor y los mutadores a escribir en la base.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { CUENTAS, IDS_ADAPSYS } from "@/lib/catalogo";
import { MOVIMIENTOS_EJEMPLO, TC_USD } from "@/lib/datos-ejemplo";
import {
  SUB_IVA_COMPRAS,
  SUB_RETENCION_BHE,
  TASAS,
  cuentaPrincipalDe,
  enCLP,
} from "@/lib/dominio";
import { pct } from "@/lib/formato";
import type { Cuenta, Linea, Movimiento, Tasas } from "@/lib/tipos";

const CLAVE_STORAGE = "tesoreria:v5";

/** El saldo corriente se lleva aparte del saldo inicial. En el sistema real el saldo
 *  se deriva de los movimientos; acá se mantiene en memoria para que los datos de
 *  ejemplo cuadren con los saldos reales de las cuentas. */
export type CuentaConSaldo = Cuenta & { saldo: number };

type Estado = {
  movimientos: Movimiento[];
  cuentas: CuentaConSaldo[];
  empresasSeleccionadas: string[];
  /** Cuenta concreta a la que se está mirando, o null para todas las de las
   *  empresas seleccionadas. Es el "entrar a la cuenta" del sidebar. */
  cuentaSeleccionada: string | null;
  tc: number;
  tasas: Tasas;
};

type Contexto = Estado & {
  cargando: boolean;
  /** Movimientos y cuentas ya filtrados por el selector global de empresas.
   *  El presupuesto NO usa estos: es consolidado y se salta el filtro (§4.6). */
  movimientosFiltrados: Movimiento[];
  cuentasFiltradas: CuentaConSaldo[];
  efectivo: number;
  saldoUsd: number;
  porCobrar: number;
  porCobrarUsd: number;
  comprometido: number;
  porConciliar: number;
  setEmpresasSeleccionadas: (ids: string[]) => void;
  /** Entra a una cuenta concreta, o vuelve a todas con null. */
  seleccionarCuenta: (cuenta_id: string | null) => void;
  setTc: (v: number) => void;
  setTasas: (t: Tasas) => void;
  pagar: (id: string) => void;
  conciliar: (id: string) => void;
  /** Cambia cuenta, empresa y moneda juntas: la cuenta determina las otras dos. */
  cambiarCuenta: (id: string, cuenta_id: string) => void;
  editarMovimiento: <K extends keyof Movimiento>(id: string, campo: K, valor: Movimiento[K]) => void;
  editarLinea: <K extends keyof Linea>(id: string, indice: number, campo: K, valor: Linea[K]) => void;
  agregarLinea: (id: string) => void;
  quitarLinea: (id: string, indice: number) => void;
  quitarSplit: (id: string) => void;
  cuadrar: (id: string) => void;
  aplicarImpuesto: (id: string, tipo: "iva" | "bhe") => void;
  pegarLineas: (id: string, texto: string) => void;
  agregarMovimiento: (m: Omit<Movimiento, "id">) => void;
  reiniciar: () => void;
};

const Ctx = createContext<Contexto | null>(null);

export const useTesoreria = (): Contexto => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTesoreria fuera de <ProveedorTesoreria>");
  return ctx;
};

const estadoInicial = (): Estado => ({
  movimientos: MOVIMIENTOS_EJEMPLO,
  cuentas: CUENTAS.map((c) => ({ ...c, saldo: c.saldo_inicial })),
  empresasSeleccionadas: IDS_ADAPSYS,
  cuentaSeleccionada: null,
  tc: TC_USD,
  tasas: TASAS,
});

export function ProveedorTesoreria({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Estado>(estadoInicial);
  // Arranca en true para no escribir los seeds encima de lo que haya guardado antes
  // de leerlo. Además el primer render del cliente coincide con el del servidor.
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    try {
      const crudo = window.localStorage.getItem(CLAVE_STORAGE);
      if (crudo) setEstado((prev) => ({ ...prev, ...JSON.parse(crudo) }));
    } catch {
      // Primera carga, storage deshabilitado o JSON corrupto: se sigue con los seeds.
    }
    setCargando(false);
  }, []);

  useEffect(() => {
    if (cargando) return;
    try {
      window.localStorage.setItem(CLAVE_STORAGE, JSON.stringify(estado));
    } catch {
      // Sin storage disponible la app sigue funcionando, solo no recuerda.
    }
  }, [estado, cargando]);

  const mapMov = useCallback(
    (id: string, fn: (m: Movimiento) => Movimiento) =>
      setEstado((p) => ({
        ...p,
        movimientos: p.movimientos.map((m) => (m.id === id ? fn(m) : m)),
      })),
    []
  );

  const { movimientos, cuentas, empresasSeleccionadas, cuentaSeleccionada, tc, tasas } =
    estado;

  const pagar = useCallback((id: string) => {
    setEstado((p) => {
      const m = p.movimientos.find((x) => x.id === id);
      if (!m || m.estado !== "proyectado") return p;
      const cuenta = p.cuentas.find((c) => c.id === m.cuenta_id);
      if (!cuenta) return p;
      // El monto ya está en la moneda de la cuenta — la base lo garantiza con la
      // foreign key compuesta (cuenta_id, moneda). Antes acá había una conversión
      // según si las monedas coincidían: existía solo porque el modelo permitía que
      // no coincidieran, que es un estado que no ocurre en la realidad.
      return {
        ...p,
        cuentas: p.cuentas.map((c) =>
          c.id === cuenta.id ? { ...c, saldo: c.saldo + m.monto } : c
        ),
        movimientos: p.movimientos.map((x) =>
          x.id === id ? { ...x, estado: "pagado" } : x
        ),
      };
    });
  }, []);

  /**
   * Mueve un movimiento a otra cuenta. Es un solo mutador porque cuenta, empresa y
   * moneda tienen que cambiar juntos: la cuenta es la elección atómica y de ella
   * salen las otras dos. Hacerlo en tres pasos dejaría estados intermedios
   * imposibles (moneda USD apuntando todavía a la cuenta en pesos).
   */
  const cambiarCuenta = useCallback((id: string, cuenta_id: string) => {
    setEstado((p) => {
      const cuenta = p.cuentas.find((c) => c.id === cuenta_id);
      if (!cuenta) return p;
      return {
        ...p,
        movimientos: p.movimientos.map((m) =>
          m.id === id
            ? {
                ...m,
                cuenta_id: cuenta.id,
                empresa_id: cuenta.empresa_id,
                moneda: cuenta.moneda,
                // En dólares el TC es obligatorio; en pesos no corresponde.
                tipo_cambio: cuenta.moneda === "USD" ? (m.tipo_cambio ?? p.tc) : null,
              }
            : m
        ),
      };
    });
  }, []);

  const conciliar = useCallback(
    (id: string) => mapMov(id, (m) => ({ ...m, estado: "conciliado" })),
    [mapMov]
  );

  const editarMovimiento = useCallback(
    <K extends keyof Movimiento>(id: string, campo: K, valor: Movimiento[K]) =>
      mapMov(id, (m) => ({ ...m, [campo]: valor })),
    [mapMov]
  );

  const editarLinea = useCallback(
    <K extends keyof Linea>(id: string, indice: number, campo: K, valor: Linea[K]) =>
      mapMov(id, (m) => ({
        ...m,
        lineas: m.lineas.map((l, j) => (j === indice ? { ...l, [campo]: valor } : l)),
      })),
    [mapMov]
  );

  const agregarLinea = useCallback(
    (id: string) =>
      mapMov(id, (m) => {
        const falta = m.monto - m.lineas.reduce((s, l) => s + l.monto, 0);
        return {
          ...m,
          lineas: [
            ...m.lineas,
            {
              subcategoria_id: m.lineas[0]?.subcategoria_id ?? "",
              monto: Math.round(falta),
              glosa: null,
            },
          ],
        };
      }),
    [mapMov]
  );

  // No se permite quedar sin líneas: un movimiento sin líneas es "sin clasificar", y
  // llegar ahí borrando la última línea sería un accidente, no una intención.
  const quitarLinea = useCallback(
    (id: string, indice: number) =>
      mapMov(id, (m) =>
        m.lineas.length <= 1
          ? m
          : { ...m, lineas: m.lineas.filter((_, j) => j !== indice) }
      ),
    [mapMov]
  );

  /** Colapsa el split a una sola línea por el total del movimiento. */
  const quitarSplit = useCallback(
    (id: string) =>
      mapMov(id, (m) => ({
        ...m,
        lineas: [
          {
            subcategoria_id: m.lineas[0]?.subcategoria_id ?? "",
            monto: m.monto,
            glosa: null,
          },
        ],
      })),
    [mapMov]
  );

  /** Empuja el descuadre a la última línea. */
  const cuadrar = useCallback(
    (id: string) =>
      mapMov(id, (m) => {
        if (!m.lineas.length) return m;
        const dif = Math.round(m.monto - m.lineas.reduce((s, l) => s + l.monto, 0));
        const lineas = [...m.lineas];
        const ultima = lineas[lineas.length - 1]!;
        lineas[lineas.length - 1] = { ...ultima, monto: ultima.monto + dif };
        return { ...m, lineas };
      }),
    [mapMov]
  );

  /**
   * Agrega (o recalcula) la línea de impuesto y recompone el monto del movimiento
   * como la suma de sus líneas — el único caso donde el total se rederiva del
   * detalle, porque es el líquido que efectivamente sale del banco (§4.3).
   *
   * Excluye la línea de impuesto anterior antes de calcular, así que se puede
   * aplicar de nuevo sin acumular.
   */
  const aplicarImpuesto = useCallback(
    (id: string, tipo: "iva" | "bhe") =>
      mapMov(id, (m) => {
        const subImpuesto = tipo === "iva" ? SUB_IVA_COMPRAS : SUB_RETENCION_BHE;
        const tasa = tipo === "iva" ? tasas.iva : tasas.bhe;
        const base = m.lineas.filter((l) => l.subcategoria_id !== subImpuesto);
        const suma = base.reduce((s, l) => s + l.monto, 0);
        const monto = Math.round(tipo === "iva" ? suma * tasa : -suma * tasa);
        const lineas: Linea[] = [
          ...base,
          {
            subcategoria_id: subImpuesto,
            monto,
            glosa: `${tipo === "iva" ? "IVA" : "Retención"} ${pct(tasa)}`,
          },
        ];
        return { ...m, lineas, monto: lineas.reduce((s, l) => s + l.monto, 0) };
      }),
    [mapMov, tasas]
  );

  /**
   * Carga masiva por pegado: de cada fila toma el último número como monto y el
   * resto como glosa. Es como se concilia el estado de cuenta de la tarjeta (§4.3).
   * Los montos heredan el signo del movimiento, así que da igual si el estado de
   * cuenta viene con o sin signo.
   */
  const pegarLineas = useCallback(
    (id: string, texto: string) =>
      mapMov(id, (m) => {
        const signo = m.monto < 0 ? -1 : 1;
        const nuevas = (texto || "")
          .split(/\r?\n/)
          .map((cruda): Linea | null => {
            const t = cruda.trim();
            if (!t) return null;
            const numeros = t.match(/-?[\d.,]*\d/g);
            if (!numeros) return null;
            const ultimo = numeros[numeros.length - 1]!;
            // Formato es-CL: el punto es separador de miles y la coma decimal.
            const n = Number(ultimo.replace(/\./g, "").replace(",", "."));
            if (!isFinite(n) || n === 0) return null;
            const glosa = t
              .slice(0, t.lastIndexOf(ultimo))
              .replace(/[\t;|]+/g, " ")
              .trim();
            return {
              subcategoria_id: m.lineas[0]?.subcategoria_id ?? "",
              monto: signo * Math.abs(n),
              glosa: glosa || "—",
            };
          })
          .filter((l): l is Linea => l !== null);
        return nuevas.length ? { ...m, lineas: [...m.lineas, ...nuevas] } : m;
      }),
    [mapMov]
  );

  const agregarMovimiento = useCallback((nuevo: Omit<Movimiento, "id">) => {
    setEstado((p) => ({
      ...p,
      // Contador sobre el estado en vez de Date.now(): dos altas en el mismo
      // milisegundo colisionaban.
      movimientos: [...p.movimientos, { ...nuevo, id: `n${p.movimientos.length + 1}` }],
    }));
  }, []);

  const reiniciar = useCallback(() => {
    try {
      window.localStorage.removeItem(CLAVE_STORAGE);
    } catch {
      // Sin storage no hay nada que borrar.
    }
    setEstado(estadoInicial());
  }, []);

  const derivados = useMemo(() => {
    const enSeleccion = <T extends { empresa_id: string }>(xs: T[]) =>
      xs.filter((x) => empresasSeleccionadas.includes(x.empresa_id));
    // El filtro de cuenta se aplica sobre los movimientos, no sobre las cuentas: el
    // sidebar tiene que seguir mostrando todas para poder cambiarse a otra.
    const movimientosFiltrados = enSeleccion(movimientos).filter(
      (m) => !cuentaSeleccionada || m.cuenta_id === cuentaSeleccionada
    );
    const cuentasFiltradas = enSeleccion(cuentas);
    const bancos = cuentasFiltradas.filter((c) => c.tipo === "banco");
    const cxc = cuentasFiltradas.filter((c) => c.tipo === "cxc");
    const suma = (xs: CuentaConSaldo[]) => xs.reduce((s, c) => s + c.saldo, 0);
    return {
      movimientosFiltrados,
      cuentasFiltradas,
      efectivo: suma(bancos.filter((c) => c.moneda === "CLP")),
      // Los saldos en dólares se muestran en su moneda, sin convertir (§4.5).
      saldoUsd: suma(bancos.filter((c) => c.moneda === "USD")),
      porCobrar: suma(cxc.filter((c) => c.moneda === "CLP")),
      porCobrarUsd: suma(cxc.filter((c) => c.moneda === "USD")),
      comprometido: movimientosFiltrados
        .filter((m) => m.estado === "proyectado" && m.moneda === "CLP")
        .reduce((s, m) => s + m.monto, 0),
      porConciliar: movimientosFiltrados.filter((m) => m.estado === "pagado").length,
    };
  }, [movimientos, cuentas, empresasSeleccionadas, cuentaSeleccionada]);

  const valor: Contexto = {
    ...estado,
    ...derivados,
    cargando,
    setEmpresasSeleccionadas: (ids) =>
      // Se limpia la cuenta: si su empresa deja de estar seleccionada, quedaría un
      // filtro invisible mostrando cero movimientos sin explicar por qué.
      setEstado((p) => ({ ...p, empresasSeleccionadas: ids, cuentaSeleccionada: null })),
    seleccionarCuenta: (cuenta_id) =>
      setEstado((p) => ({ ...p, cuentaSeleccionada: cuenta_id })),
    setTc: (v) => setEstado((p) => ({ ...p, tc: v })),
    setTasas: (t) => setEstado((p) => ({ ...p, tasas: t })),
    pagar,
    conciliar,
    cambiarCuenta,
    editarMovimiento,
    editarLinea,
    agregarLinea,
    quitarLinea,
    quitarSplit,
    cuadrar,
    aplicarImpuesto,
    pegarLineas,
    agregarMovimiento,
    reiniciar,
  };

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}
