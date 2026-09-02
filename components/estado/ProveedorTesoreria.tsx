"use client";

// Estado compartido de la app. Es el equivalente del componente raíz del prototipo,
// pero como context, para que sobreviva a la navegación entre rutas.
//
// Con Supabase conectado los movimientos vienen de la base y cada cambio se guarda
// ahí. Sin conectar —tests, o un preview sin variables de entorno— cae a los datos
// de ejemplo y a localStorage, para que la app se pueda mirar igual.
//
// Las preferencias de vista (empresas elegidas, cuenta abierta, TC) son locales en
// los dos casos: son de cada persona, no del negocio.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CUENTAS, IDS_ADAPSYS } from "@/lib/catalogo";
import { MOVIMIENTOS_EJEMPLO, TC_USD } from "@/lib/datos-ejemplo";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { cargarMovimientos, guardarMovimiento } from "@/lib/supabase/datos";
import { supabaseConfigurado } from "@/lib/supabase/estado";
import {
  SUB_IVA_COMPRAS,
  SUB_RETENCION_BHE,
  TASAS,
  cuentaPrincipalDe,
  enCLP,
} from "@/lib/dominio";
import { perteneceAlRegistro, saldoDeCuenta } from "@/lib/registros";
import { pct } from "@/lib/formato";
import type { Cuenta, Linea, Movimiento, Tasas } from "@/lib/tipos";

const CLAVE_STORAGE = "tesoreria:v5";

/** El saldo NO se guarda: se calcula como saldo inicial más los movimientos que ya
 *  ocurrieron. Antes vivía en el estado y lo actualizaba el mutador `pagar`, y eso
 *  se rompió en cuanto los movimientos llegaron de la base: el saldo quedaba en el
 *  de apertura de 2020 porque nadie lo recalculaba. Derivarlo hace imposible esa
 *  clase de desfase. */
export type CuentaConSaldo = Cuenta & { saldo: number };

type Estado = {
  movimientos: Movimiento[];
  empresasSeleccionadas: string[];
  /** Registro abierto en la barra lateral, o null para ver todo. Puede ser una
   *  cuenta ("cuenta:a1") o un registro de proyección ("proy:egresos-clp"). */
  registroSeleccionado: string | null;
  tc: number;
  tasas: Tasas;
};

type Contexto = Estado & {
  cargando: boolean;
  /** Mensaje si la carga desde Supabase falló. Una app vacía por un error de red
   *  se ve igual que una app sin movimientos: hay que decir cuál de las dos es. */
  errorCarga: string | null;
  /** Mensaje si un cambio no se pudo guardar. Sin esto, la edición se ve aplicada
   *  en pantalla y desaparece al recargar. */
  errorGuardado: string | null;
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
  /** Todas las cuentas con su saldo calculado. */
  cuentas: CuentaConSaldo[];
  /** Abre un registro de la barra lateral, o vuelve a todo con null. */
  seleccionarRegistro: (clave: string | null) => void;
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

/** Registro con el que abre la app. Los egresos proyectados: lo primero que se
 *  mira cada día es lo que viene, ordenado de lo más próximo a lo más lejano.
 *  El histórico ya conciliado está a un clic, en la cuenta del banco que toque. */
export const REGISTRO_DE_ENTRADA = "proy:egresos-clp";

const estadoInicial = (registro: string | null): Estado => ({
  // Con Supabase conectado arranca vacío y espera a la base. Mostrar los datos de
  // ejemplo mientras carga sería peor que mostrar nada: son cifras plausibles y
  // reales de otra época, imposibles de distinguir de las de verdad a simple vista.
  movimientos: supabaseConfigurado ? [] : MOVIMIENTOS_EJEMPLO,
  empresasSeleccionadas: IDS_ADAPSYS,
  registroSeleccionado: registro,
  tc: TC_USD,
  tasas: TASAS,
});

export function ProveedorTesoreria({
  children,
  registroInicial = REGISTRO_DE_ENTRADA,
}: {
  children: ReactNode;
  /** Con qué registro abre. Existe para que los tests no dependan de cuál sea la
   *  vista de entrada del producto: un test que comprueba que la tabla lista
   *  movimientos no debería romperse porque cambiamos por dónde se entra. */
  registroInicial?: string | null;
}) {
  const [estado, setEstado] = useState<Estado>(() => estadoInicial(registroInicial));
  // Arranca en true para no escribir los seeds encima de lo que haya guardado antes
  // de leerlo. Además el primer render del cliente coincide con el del servidor.
  const [cargando, setCargando] = useState(true);

  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  useEffect(() => {
    // Con Supabase conectado los movimientos vienen de la base y localStorage no
    // participa: dos fuentes para el mismo dato terminan divergiendo, y la que
    // gana sería la copia vieja del navegador. Las preferencias de vista (empresas
    // elegidas, cuenta abierta) sí siguen siendo locales — son de cada persona.
    if (!supabaseConfigurado) {
      try {
        const crudo = window.localStorage.getItem(CLAVE_STORAGE);
        if (crudo) setEstado((prev) => ({ ...prev, ...JSON.parse(crudo) }));
      } catch {
        // Primera carga, storage deshabilitado o JSON corrupto: se sigue con los seeds.
      }
      setCargando(false);
      return;
    }

    let vigente = true;
    cargarMovimientos(crearClienteNavegador())
      .then((movimientos) => {
        if (!vigente) return;
        setEstado((prev) => ({ ...prev, movimientos }));
      })
      .catch((e: Error) => {
        if (!vigente) return;
        // Sin datos es mejor decirlo que mostrar una app vacía que parece correcta.
        setErrorCarga(e.message);
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });
    return () => {
      vigente = false;
    };
  }, []);

  useEffect(() => {
    if (cargando || supabaseConfigurado) return;
    try {
      window.localStorage.setItem(CLAVE_STORAGE, JSON.stringify(estado));
    } catch {
      // Sin storage disponible la app sigue funcionando, solo no recuerda.
    }
  }, [estado, cargando]);

  // ── Persistencia hacia Supabase ──────────────────────────────────────────
  //
  // En vez de que cada mutador guarde lo suyo, se detecta qué cambió comparando
  // contra la última versión guardada. Los mutadores actualizan de forma inmutable,
  // así que un movimiento modificado es un objeto nuevo y basta comparar
  // referencias — exacto y sin listas de "acordarse de guardar acá también", que
  // es donde se cuelan los mutadores que se olvidan de persistir.
  const guardados = useRef<Map<string, Movimiento> | null>(null);
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null);

  useEffect(() => {
    if (!supabaseConfigurado || cargando) return;

    const previos = guardados.current;
    guardados.current = new Map(estado.movimientos.map((m) => [m.id, m]));

    // Primera pasada después de cargar: es la línea base, no hay nada que guardar.
    if (previos === null) return;

    const cambiados = estado.movimientos.filter((m) => previos.get(m.id) !== m);
    if (!cambiados.length) return;

    const supabase = crearClienteNavegador();
    for (const m of cambiados) {
      guardarMovimiento(supabase, m)
        .then((idReal) => {
          // Un movimiento recién creado nace con id provisorio; la base le asigna
          // el suyo y hay que adoptarlo, o el próximo cambio intentaría insertarlo
          // de nuevo en vez de actualizarlo.
          if (idReal === m.id) return;
          setEstado((p) => ({
            ...p,
            movimientos: p.movimientos.map((x) => (x.id === m.id ? { ...x, id: idReal } : x)),
          }));
        })
        .catch((e: Error) => setErrorGuardado(e.message));
    }
  }, [estado.movimientos, cargando]);

  const mapMov = useCallback(
    (id: string, fn: (m: Movimiento) => Movimiento) =>
      setEstado((p) => ({
        ...p,
        movimientos: p.movimientos.map((m) => (m.id === id ? fn(m) : m)),
      })),
    []
  );

  const { movimientos, empresasSeleccionadas, registroSeleccionado, tc, tasas } = estado;

  const pagar = useCallback((id: string) => {
    // Solo cambia el estado. El saldo de la cuenta se recalcula solo, porque se
    // deriva de los movimientos: antes acá se sumaba a mano y era la única forma
    // de que el saldo mostrado y los movimientos dijeran cosas distintas.
    setEstado((p) => ({
      ...p,
      movimientos: p.movimientos.map((x) =>
        x.id === id && x.estado === "proyectado" ? { ...x, estado: "pagado" } : x
      ),
    }));
  }, []);

  /**
   * Mueve un movimiento a otra cuenta. Es un solo mutador porque cuenta, empresa y
   * moneda tienen que cambiar juntos: la cuenta es la elección atómica y de ella
   * salen las otras dos. Hacerlo en tres pasos dejaría estados intermedios
   * imposibles (moneda USD apuntando todavía a la cuenta en pesos).
   */
  const cambiarCuenta = useCallback((id: string, cuenta_id: string) => {
    setEstado((p) => {
      const cuenta = CUENTAS.find((c) => c.id === cuenta_id);
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
    // Con Supabase conectado "reiniciar" no puede significar volver a los datos de
    // ejemplo: los datos son de la base y no hay nada local que descartar. Recarga,
    // que es lo que la gente espera del botón cuando algo se ve raro.
    if (supabaseConfigurado) {
      setCargando(true);
      setErrorCarga(null);
      cargarMovimientos(crearClienteNavegador())
        .then((movimientos) => {
          guardados.current = null;
          setEstado((p) => ({ ...p, movimientos }));
        })
        .catch((e: Error) => setErrorCarga(e.message))
        .finally(() => setCargando(false));
      return;
    }
    try {
      window.localStorage.removeItem(CLAVE_STORAGE);
    } catch {
      // Sin storage no hay nada que borrar.
    }
    setEstado(estadoInicial(registroInicial));
  }, []);

  const derivados = useMemo(() => {
    // El saldo de cada cuenta sale de los movimientos, no de un contador que
    // alguien tiene que acordarse de actualizar.
    const cuentas: CuentaConSaldo[] = CUENTAS.map((c) => ({
      ...c,
      saldo: saldoDeCuenta(c, movimientos),
    }));

    // Lo que no tiene empresa pasa siempre el filtro: no pertenece a una sociedad,
    // pertenece al consolidado. Son las proyecciones que todavía no saben por dónde
    // se van a gestionar — filtrarlas por empresa las haría desaparecer de todas
    // las vistas, y una de ellas es un compromiso de 100 millones.
    const enSeleccion = <T extends { empresa_id: string | null }>(xs: T[]) =>
      xs.filter((x) => x.empresa_id === null || empresasSeleccionadas.includes(x.empresa_id));

    // El registro abierto se aplica sobre los movimientos, no sobre las cuentas: la
    // barra lateral tiene que seguir mostrándolas todas para poder cambiarse.
    const movimientosFiltrados = enSeleccion(movimientos).filter(
      (m) => !registroSeleccionado || perteneceAlRegistro(m, registroSeleccionado, cuentas)
    );
    const cuentasFiltradas = enSeleccion(cuentas);
    const bancos = cuentasFiltradas.filter((c) => c.tipo === "banco");
    const cxc = cuentasFiltradas.filter((c) => c.tipo === "cxc");
    const suma = (xs: CuentaConSaldo[]) => xs.reduce((s, c) => s + c.saldo, 0);
    return {
      cuentas,
      movimientosFiltrados,
      cuentasFiltradas,
      efectivo: suma(bancos.filter((c) => c.moneda === "CLP")),
      // Los saldos en dólares se muestran en su moneda, sin convertir (§4.5).
      saldoUsd: suma(bancos.filter((c) => c.moneda === "USD")),
      porCobrar: suma(cxc.filter((c) => c.moneda === "CLP")),
      porCobrarUsd: suma(cxc.filter((c) => c.moneda === "USD")),
      comprometido: movimientosFiltrados
        .filter((m) => m.estado === "proyectado" && m.moneda === "CLP")
        .reduce((t, m) => t + m.monto, 0),
      porConciliar: movimientosFiltrados.filter((m) => m.estado === "pagado").length,
    };
  }, [movimientos, empresasSeleccionadas, registroSeleccionado]);

  const valor: Contexto = {
    ...estado,
    ...derivados,
    cargando,
    errorCarga,
    errorGuardado,
    setEmpresasSeleccionadas: (ids) =>
      // Se limpia la cuenta: si su empresa deja de estar seleccionada, quedaría un
      // filtro invisible mostrando cero movimientos sin explicar por qué.
      setEstado((p) => ({ ...p, empresasSeleccionadas: ids, registroSeleccionado: null })),
    seleccionarRegistro: (clave) =>
      setEstado((p) => ({ ...p, registroSeleccionado: clave })),
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
