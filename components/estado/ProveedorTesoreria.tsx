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
import { CATEGORIAS, CUENTAS, IDS_ADAPSYS, SUBCATEGORIAS } from "@/lib/catalogo";
import { crearIndices, type Indices } from "@/lib/catalogo-indices";
import { idLibre, parsearCatalogo } from "@/lib/catalogo-edicion";
import { MOVIMIENTOS_EJEMPLO, TC_USD } from "@/lib/datos-ejemplo";
import { crearClienteNavegador } from "@/lib/supabase/client";
import {
  borrarMovimiento as borrarEnBase,
  cargarMovimientos,
  esNuevo,
  guardarMovimiento,
} from "@/lib/supabase/datos";
import {
  borrarCategoria as borrarCategoriaEnBase,
  borrarSubcategoria as borrarSubcategoriaEnBase,
  cargarCatalogo,
  guardarCategoria,
  guardarSubcategoria,
} from "@/lib/supabase/catalogo";
import { supabaseConfigurado } from "@/lib/supabase/estado";
import {
  SUB_IVA_COMPRAS,
  SUB_RETENCION_BHE,
  TASAS,
  cuentaPrincipalDe,
  enCLP,
} from "@/lib/dominio";
import { perteneceAlRegistro, saldoDeCuenta } from "@/lib/registros";
import { pasoDe } from "@/lib/cobranza";
import { pct } from "@/lib/formato";
import type {
  Categoria,
  Cuenta,
  Linea,
  Movimiento,
  Naturaleza,
  Subcategoria,
  Tasas,
} from "@/lib/tipos";

const CLAVE_STORAGE = "tesoreria:v5";

/** El saldo NO se guarda: se calcula como saldo inicial más los movimientos que ya
 *  ocurrieron. Antes vivía en el estado y lo actualizaba el mutador `pagar`, y eso
 *  se rompió en cuanto los movimientos llegaron de la base: el saldo quedaba en el
 *  de apertura de 2020 porque nadie lo recalculaba. Derivarlo hace imposible esa
 *  clase de desfase. */
export type CuentaConSaldo = Cuenta & { saldo: number };

type Estado = {
  movimientos: Movimiento[];
  categorias: Categoria[];
  subcategorias: Subcategoria[];
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
  /** Facturar un proyecto aprobado, o cobrar una factura. Ver lib/cobranza.ts.
   *  Al facturar se pasa el número del documento, que es cuando existe. */
  avanzarCobranza: (id: string, documento?: string) => void;
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
  /** Borra un movimiento registrado por error. Las líneas se van con él. */
  borrarMovimiento: (id: string) => void;
  reiniciar: () => void;

  // ── Catálogo ──────────────────────────────────────────────────────────────
  /** Índices sobre el catálogo vigente. Las vistas leen de acá y no de la constante
   *  del bundle, para que una edición se refleje sin recargar. */
  catalogo: Indices;
  /** Cuántas líneas de movimiento apuntan a cada subcategoría. Es lo que decide si
   *  una se puede borrar o solo desactivar (§3). */
  usoDeSubcategoria: Map<string, number>;
  renombrarCategoria: (id: string, nombre: string) => void;
  renombrarSubcategoria: (id: string, nombre: string) => void;
  cambiarNaturaleza: (id: string, naturaleza: Naturaleza) => void;
  /** Aplica una naturaleza a todas las subcategorías de una categoría, de una vez. */
  cambiarNaturalezaDeCategoria: (categoria_id: string, naturaleza: Naturaleza) => void;
  /** Dentro o fuera del control presupuestario (§4.6). */
  alternarControlado: (categoria_id: string) => void;
  /** Una subcategoría inactiva no se ofrece al clasificar, pero no rompe lo ya
   *  clasificado con ella. Es el reemplazo de borrar cuando está en uso. */
  alternarActiva: (id: string) => void;
  crearCategoria: (nombre: string) => void;
  crearSubcategoria: (categoria_id: string, nombre: string) => void;
  borrarSubcategoria: (id: string) => void;
  borrarCategoria: (id: string) => void;
  /** Agrega lo que traiga el listado pegado. Devuelve cuánto entró. */
  importarCatalogo: (texto: string) => { categorias: number; subcategorias: number };
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
  // El catálogo sí arranca con el del bundle aunque haya base: es la estructura, no
  // las cifras. Mostrarlo mientras carga deja los selectores usables desde el primer
  // instante y, si la base tuviera otro, lo pisa al llegar.
  categorias: CATEGORIAS,
  subcategorias: SUBCATEGORIAS,
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
    const supabase = crearClienteNavegador();
    Promise.all([cargarMovimientos(supabase), cargarCatalogo(supabase)])
      .then(([movimientos, catalogo]) => {
        if (!vigente) return;
        setEstado((prev) => ({ ...prev, movimientos, ...catalogo }));
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

  // Mismo mecanismo para el catálogo: se compara contra lo último guardado y se
  // manda solo lo que cambió. Un rename dispara una escritura, no 293.
  const catalogoGuardado = useRef<{
    categorias: Map<string, Categoria>;
    subcategorias: Map<string, Subcategoria>;
  } | null>(null);

  const persistirCatalogo = useCallback(
    (previo: {
      categorias: Map<string, Categoria>;
      subcategorias: Map<string, Subcategoria>;
    }) => {
      const supabase = crearClienteNavegador();
      const fallo = (e: Error) => setErrorGuardado(e.message);

      for (const c of estado.categorias) {
        if (previo.categorias.get(c.id) !== c) guardarCategoria(supabase, c).catch(fallo);
      }
      for (const s of estado.subcategorias) {
        if (previo.subcategorias.get(s.id) !== s) guardarSubcategoria(supabase, s).catch(fallo);
      }

      // Los borrados van al final: una subcategoría se borra antes que su categoría,
      // o la foreign key rechaza la segunda.
      const vivas = new Set(estado.subcategorias.map((s) => s.id));
      const catsVivas = new Set(estado.categorias.map((c) => c.id));
      const borradas = [...previo.subcategorias.keys()].filter((id) => !vivas.has(id));
      const catsBorradas = [...previo.categorias.keys()].filter((id) => !catsVivas.has(id));

      Promise.all(borradas.map((id) => borrarSubcategoriaEnBase(supabase, id)))
        .then(() => Promise.all(catsBorradas.map((id) => borrarCategoriaEnBase(supabase, id))))
        .catch(fallo);
    },
    [estado.categorias, estado.subcategorias]
  );

  useEffect(() => {
    if (!supabaseConfigurado || cargando) return;

    const foto = () => ({
      categorias: new Map(estado.categorias.map((c) => [c.id, c])),
      subcategorias: new Map(estado.subcategorias.map((s) => [s.id, s])),
    });

    // Primera pasada después de cargar: es la línea base, no hay nada que guardar.
    if (catalogoGuardado.current === null) {
      catalogoGuardado.current = foto();
      return;
    }

    // Los nombres se editan tecleando, y sin esperar iría una escritura por tecla:
    // "Arriendo oficina" serían 17 UPDATE. Mientras se escribe el temporizador se
    // reinicia y la línea base se queda en lo último guardado, así que al final sale
    // una sola escritura con el nombre completo.
    const temporizador = setTimeout(() => {
      const previo = catalogoGuardado.current;
      if (previo === null) return;
      catalogoGuardado.current = foto();
      persistirCatalogo(previo);
    }, 700);
    return () => clearTimeout(temporizador);
  }, [estado.categorias, estado.subcategorias, cargando, persistirCatalogo]);


  const mapCat = useCallback(
    (id: string, fn: (c: Categoria) => Categoria) =>
      setEstado((p) => ({
        ...p,
        categorias: p.categorias.map((c) => (c.id === id ? fn(c) : c)),
      })),
    []
  );

  const mapSub = useCallback(
    (id: string, fn: (s: Subcategoria) => Subcategoria) =>
      setEstado((p) => ({
        ...p,
        subcategorias: p.subcategorias.map((s) => (s.id === id ? fn(s) : s)),
      })),
    []
  );

  const mapMov = useCallback(
    (id: string, fn: (m: Movimiento) => Movimiento) =>
      setEstado((p) => ({
        ...p,
        movimientos: p.movimientos.map((m) => (m.id === id ? fn(m) : m)),
      })),
    []
  );

  const { movimientos, empresasSeleccionadas, registroSeleccionado, tc, tasas } = estado;

  // Cuántas líneas apuntan a cada subcategoría: decide si una se puede borrar o
  // solo desactivar. Se cuenta sobre TODOS los movimientos, no los filtrados por el
  // selector de empresas: borrar algo que "no tiene uso" porque hay un filtro puesto
  // dejaría huérfanas las líneas de las otras sociedades.
  const usoDeSubcategoria = useMemo(() => {
    const uso = new Map<string, number>();
    for (const m of estado.movimientos) {
      for (const l of m.lineas) {
        uso.set(l.subcategoria_id, (uso.get(l.subcategoria_id) ?? 0) + 1);
      }
    }
    return uso;
  }, [estado.movimientos]);

  /** Todos los ids en uso, para no generar uno repetido. Categorías y subcategorías
   *  comparten espacio de nombres porque el slug sale del nombre y "Impuestos" puede
   *  ser las dos cosas. */
  const idsDelCatalogo = (e: Estado) =>
    new Set([...e.categorias.map((c) => c.id), ...e.subcategorias.map((s) => s.id)]);

  // Los índices se rehacen solo cuando el catálogo cambia: recorrer 293 subcategorías
  // en cada render de una tabla de 10.530 filas se nota.
  const catalogo = useMemo(
    () => crearIndices(estado.categorias, estado.subcategorias),
    [estado.categorias, estado.subcategorias]
  );

  /**
   * Marcar pagado deja el movimiento en `conciliado`, no en `pagado`.
   *
   * El estado intermedio existe para cuadrar contra la cartola una vez al mes,
   * y acá el banco se revisa todos los días: se marca pagado justamente porque el
   * movimiento ya está en la cartola con esa fecha. La verificación ya ocurrió al
   * registrar, así que pasar por `pagado` solo dejaría un contador de pendientes
   * que crece y que nadie va a bajar nunca.
   *
   * El estado sigue existiendo en la base y en el modelo. Si algún día se cuadra
   * contra un extracto en vez de al día, vuelve a tener sentido sin migración.
   */
  const pagar = useCallback((id: string) => {
    // Solo cambia el estado. El saldo de la cuenta se recalcula solo, porque se
    // deriva de los movimientos: antes acá se sumaba a mano y era la única forma
    // de que el saldo mostrado y los movimientos dijeran cosas distintas.
    setEstado((p) => ({
      ...p,
      movimientos: p.movimientos.map((x) =>
        x.id === id && x.estado === "proyectado" ? { ...x, estado: "conciliado" } : x
      ),
    }));
  }, []);

  /**
   * Avanza un ingreso por la cadena de cobranza (§ lib/cobranza.ts).
   *
   * Facturar lo mueve a la cartera de cobranza y lo deja proyectado: sigue siendo
   * plata por entrar. Cobrar lo mueve a la cuenta del banco y lo pasa a `pagado`,
   * porque entró de verdad pero todavía no se cuadró contra la cartola.
   *
   * Es un solo mutador porque cuenta y estado tienen que cambiar juntos: en dos
   * pasos existiría un instante en que la factura ya está en el banco pero sigue
   * marcada como proyección, y el saldo diría algo falso.
   */
  const avanzarCobranza = useCallback((id: string, documento?: string) => {
    setEstado((p) => {
      const m = p.movimientos.find((x) => x.id === id);
      if (!m) return p;
      const cuentas = CUENTAS.map((c) => ({ ...c, saldo: 0 }));
      const paso = pasoDe(m, cuentas);
      if (paso.accion !== "facturar" && paso.accion !== "cobrar") return p;

      const cobrado = paso.accion === "cobrar";
      return {
        ...p,
        movimientos: p.movimientos.map((x) =>
          x.id === id
            ? {
                ...x,
                cuenta_id: paso.destino.id,
                // El número llega al facturar: es el momento en que el documento
                // existe. Si no se escribió, se conserva el que hubiera.
                documento: documento?.trim() ? documento.trim() : x.documento,
                // Al entrar al banco el movimiento adopta la empresa de la cuenta:
                // la cuenta manda sobre la empresa, no al revés.
                empresa_id: cobrado ? paso.destino.empresa_id : x.empresa_id,
                // Directo a conciliado por lo mismo que `pagar`: se marca cobrado
                // cuando el abono ya está en la cartola.
                estado: cobrado ? ("conciliado" as const) : x.estado,
              }
            : x
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

  /**
   * Borra un movimiento registrado por error.
   *
   * El borrado va primero al estado y después a la base, como el resto de las
   * ediciones: si falla, la banda de error avisa que lo que se ve en pantalla no
   * es lo que hay guardado. Un movimiento que sigue en la base tras un borrado
   * fallido reaparece al recargar, que es la corrección más honesta.
   */
  const borrarMovimiento = useCallback((id: string) => {
    setEstado((p) => ({ ...p, movimientos: p.movimientos.filter((m) => m.id !== id) }));
    if (!supabaseConfigurado) return;
    // Un movimiento con id provisorio todavía no llegó a la base: no hay qué borrar.
    if (esNuevo(id)) return;
    borrarEnBase(crearClienteNavegador(), id).catch((e: Error) => setErrorGuardado(e.message));
  }, []);

  const reiniciar = useCallback(() => {
    // Con Supabase conectado "reiniciar" no puede significar volver a los datos de
    // ejemplo: los datos son de la base y no hay nada local que descartar. Recarga,
    // que es lo que la gente espera del botón cuando algo se ve raro.
    if (supabaseConfigurado) {
      setCargando(true);
      setErrorCarga(null);
      const supabase = crearClienteNavegador();
      Promise.all([cargarMovimientos(supabase), cargarCatalogo(supabase)])
        .then(([movimientos, catalogo]) => {
          guardados.current = null;
          catalogoGuardado.current = null;
          setEstado((p) => ({ ...p, movimientos, ...catalogo }));
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
    avanzarCobranza,
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
    borrarMovimiento,
    reiniciar,

    catalogo,
    usoDeSubcategoria,
    renombrarCategoria: (id, nombre) =>
      mapCat(id, (c) => ({ ...c, nombre })),
    renombrarSubcategoria: (id, nombre) => mapSub(id, (x) => ({ ...x, nombre })),
    cambiarNaturaleza: (id, naturaleza) => mapSub(id, (x) => ({ ...x, naturaleza })),
    cambiarNaturalezaDeCategoria: (categoria_id, naturaleza) =>
      setEstado((p) => ({
        ...p,
        subcategorias: p.subcategorias.map((x) =>
          x.categoria_id === categoria_id ? { ...x, naturaleza } : x
        ),
      })),
    alternarControlado: (id) => mapCat(id, (c) => ({ ...c, controlado: !c.controlado })),
    alternarActiva: (id) => mapSub(id, (x) => ({ ...x, activa: !x.activa })),
    crearCategoria: (nombre) =>
      setEstado((p) => {
        const id = idLibre(nombre, idsDelCatalogo(p));
        return {
          ...p,
          categorias: [
            ...p.categorias,
            { id, nombre, orden: p.categorias.length + 1, controlado: true },
          ],
          // Sin subcategoría la categoría no sirve para clasificar (§3), así que
          // nace con una que se puede renombrar en el acto.
          subcategorias: [
            ...p.subcategorias,
            {
              id: idLibre(nombre, new Set([...idsDelCatalogo(p), id])),
              categoria_id: id,
              nombre,
              naturaleza: "operativo",
              activa: true,
            },
          ],
        };
      }),
    crearSubcategoria: (categoria_id, nombre) =>
      setEstado((p) => ({
        ...p,
        subcategorias: [
          ...p.subcategorias,
          {
            id: idLibre(nombre, idsDelCatalogo(p)),
            categoria_id,
            nombre,
            // Hereda la naturaleza de sus hermanas: lo más probable es que sea la
            // misma, y si la categoría es mixta se corrige en el selector de al lado.
            naturaleza:
              p.subcategorias.find((x) => x.categoria_id === categoria_id)?.naturaleza ??
              "operativo",
            activa: true,
          },
        ],
      })),
    borrarSubcategoria: (id) =>
      setEstado((p) => ({ ...p, subcategorias: p.subcategorias.filter((x) => x.id !== id) })),
    borrarCategoria: (id) =>
      setEstado((p) => ({
        ...p,
        categorias: p.categorias.filter((c) => c.id !== id),
        subcategorias: p.subcategorias.filter((x) => x.categoria_id !== id),
      })),
    importarCatalogo: (texto) => {
      const nuevo = parsearCatalogo(texto, idsDelCatalogo(estado));
      // Una categoría que ya existe con ese nombre recibe las subcategorías nuevas
      // en vez de duplicarse: pegar el listado dos veces no debe crear "Administración"
      // y "Administración-2".
      const porNombre = new Map(estado.categorias.map((c) => [c.nombre, c.id]));
      const traduccion = new Map<string, string>();
      const categorias = nuevo.categorias.filter((c) => {
        const ya = porNombre.get(c.nombre);
        if (ya) {
          traduccion.set(c.id, ya);
          return false;
        }
        return true;
      });
      const yaHay = new Set(
        estado.subcategorias.map((x) => `${x.categoria_id}\u0000${x.nombre}`)
      );
      const subcategorias = nuevo.subcategorias
        .map((x) => ({ ...x, categoria_id: traduccion.get(x.categoria_id) ?? x.categoria_id }))
        .filter((x) => !yaHay.has(`${x.categoria_id}\u0000${x.nombre}`));

      setEstado((p) => ({
        ...p,
        categorias: [
          ...p.categorias,
          ...categorias.map((c, i) => ({ ...c, orden: p.categorias.length + i + 1 })),
        ],
        subcategorias: [...p.subcategorias, ...subcategorias],
      }));
      return { categorias: categorias.length, subcategorias: subcategorias.length };
    },
  };

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}
