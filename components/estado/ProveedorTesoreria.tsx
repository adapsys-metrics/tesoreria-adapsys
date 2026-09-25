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
import { EMPRESAS, GRUPOS, CUENTAS, IDS_ADAPSYS, CATEGORIAS, SUBCATEGORIAS } from "@/lib/catalogo";
import { crearIndices, type Indices } from "@/lib/catalogo-indices";
import { idLibre, parsearCatalogo } from "@/lib/catalogo-edicion";
import type { FilaPegada } from "@/lib/proveedores-pegado";
import { MOVIMIENTOS_EJEMPLO, TC_USD } from "@/lib/datos-ejemplo";
import { crearClienteNavegador } from "@/lib/supabase/client";
import {
  borrarMovimiento as borrarEnBase,
  cargarMovimientos,
  esNuevo,
  guardarMovimiento,
} from "@/lib/supabase/datos";
import {
  borrarGrupo as borrarGrupoEnBase,
  borrarCategoria as borrarCategoriaEnBase,
  borrarSubcategoriaTercerNivel,
  cargarCatalogo,
  guardarGrupo,
  guardarCategoria,
  guardarSubcategoria,
} from "@/lib/supabase/catalogo";
import {
  borrarProveedor as borrarProveedorEnBase,
  cargarMaestros,
  guardarCuenta,
  guardarEmpresa,
  guardarProveedor,
} from "@/lib/supabase/maestros";
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
  DocTipo,
  Empresa,
  Grupo,
  Proveedor,
  Subcategoria,
  Cuenta,
  Linea,
  Movimiento,
  Naturaleza,
  Categoria,
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
  grupos: Grupo[];
  categorias: Categoria[];
  subcategorias: Subcategoria[];
  empresas: Empresa[];
  /** Las cuentas como están en la base. El saldo se deriva aparte: guardarlo acá lo
   *  dejaría desactualizado en cuanto entrara un movimiento. */
  cuentasBase: Cuenta[];
  proveedores: Proveedor[];
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
  /** Cuántas líneas de movimiento apuntan a cada categoría. Es lo que decide si
   *  una se puede borrar o solo desactivar (§3). */
  usoDeCategoria: Map<string, number>;
  renombrarGrupo: (id: string, nombre: string) => void;
  renombrarCategoria: (id: string, nombre: string) => void;
  cambiarNaturaleza: (id: string, naturaleza: Naturaleza) => void;
  /** Aplica una naturaleza a todas las categorías de un grupo, de una vez. */
  cambiarNaturalezaDeGrupo: (grupo_id: string, naturaleza: Naturaleza) => void;
  /** Dentro o fuera del control presupuestario (§4.6). */
  alternarControlado: (grupo_id: string) => void;
  /** Una categoría inactiva no se ofrece al clasificar, pero no rompe lo ya
   *  clasificado con ella. Es el reemplazo de borrar cuando está en uso. */
  alternarActiva: (id: string) => void;
  crearGrupo: (nombre: string) => void;
  crearCategoria: (grupo_id: string, nombre: string) => void;
  borrarCategoria: (id: string) => void;
  borrarGrupo: (id: string) => void;
  /** Agrega lo que traiga el listado pegado. Devuelve cuánto entró. */
  importarCatalogo: (texto: string) => {
    grupos: number;
    categorias: number;
    subcategorias: number;
  };

  // ── Tercer nivel ──────────────────────────────────────────────────────────
  /** Cuántas líneas apuntan a cada subcategoría. Menos crítico que el de categoría:
   *  borrar una subcategoría en uso no deja huérfano nada, la línea conserva su
   *  categoría y solo pierde el detalle. Se muestra igual para poder decidir. */
  usoDeSubcategoria: Map<string, number>;
  crearSubcategoria: (categoria_id: string, nombre: string) => void;
  renombrarSubcategoria: (id: string, nombre: string) => void;
  alternarActivaSubcategoria: (id: string) => void;
  /** Fija la naturaleza de una subcategoría, o la devuelve a heredar cuando coincide
   *  con la de su categoría. Guardar null y no el valor repetido es lo que hace que
   *  cambiar la categoría siga arrastrando a las que no se tocaron. */
  cambiarNaturalezaSubcategoria: (id: string, naturaleza: Naturaleza) => void;
  borrarSubcategoria: (id: string) => void;

  // ── Maestros ──────────────────────────────────────────────────────────────
  /** Empresas y cuentas se editan porque la nómina de pago necesita el número de la
   *  cuenta que paga (§10), y eso cambia cuando el banco lo cambia. */
  empresas: Empresa[];
  proveedores: Proveedor[];
  editarEmpresa: <K extends keyof Empresa>(id: string, campo: K, valor: Empresa[K]) => void;
  editarCuenta: <K extends keyof Cuenta>(id: string, campo: K, valor: Cuenta[K]) => void;
  crearProveedor: (nombre: string) => void;
  editarProveedor: <K extends keyof Proveedor>(
    id: string,
    campo: K,
    valor: Proveedor[K]
  ) => void;
  borrarProveedor: (id: string) => void;
  /** Carga varios de golpe desde un listado pegado. Actualiza por nombre en vez de
   *  duplicar, para poder volver a pegar la planilla corregida. Devuelve cuántos
   *  entraron nuevos y cuántos se actualizaron. */
  cargarProveedores: (filas: FilaPegada[]) => { nuevos: number; actualizados: number };
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
  grupos: GRUPOS,
  categorias: CATEGORIAS,
  subcategorias: SUBCATEGORIAS,
  empresas: EMPRESAS,
  cuentasBase: CUENTAS,
  proveedores: [],
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
    Promise.all([
      cargarMovimientos(supabase),
      cargarCatalogo(supabase),
      cargarMaestros(supabase),
    ])
      .then(([movimientos, catalogo, maestros]) => {
        if (!vigente) return;
        setEstado((prev) => ({ ...prev, movimientos, ...catalogo, ...maestros }));
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
    grupos: Map<string, Grupo>;
    categorias: Map<string, Categoria>;
    subcategorias: Map<string, Subcategoria>;
  } | null>(null);

  const persistirCatalogo = useCallback(
    (previo: {
      grupos: Map<string, Grupo>;
      categorias: Map<string, Categoria>;
      subcategorias: Map<string, Subcategoria>;
    }) => {
      const supabase = crearClienteNavegador();
      const fallo = (e: Error) => setErrorGuardado(e.message);

      for (const c of estado.grupos) {
        if (previo.grupos.get(c.id) !== c) guardarGrupo(supabase, c).catch(fallo);
      }
      for (const s of estado.categorias) {
        if (previo.categorias.get(s.id) !== s) guardarCategoria(supabase, s).catch(fallo);
      }
      for (const s of estado.subcategorias) {
        if (previo.subcategorias.get(s.id) !== s) guardarSubcategoria(supabase, s).catch(fallo);
      }

      // Los borrados van de abajo hacia arriba: subcategoría, categoría, grupo. Al
      // revés la foreign key rechaza al padre que todavía tiene hijos.
      const subsVivas = new Set(estado.subcategorias.map((s) => s.id));
      const catsVivas = new Set(estado.categorias.map((s) => s.id));
      const gruposVivos = new Set(estado.grupos.map((c) => c.id));

      Promise.all(
        [...previo.subcategorias.keys()]
          .filter((id) => !subsVivas.has(id))
          .map((id) => borrarSubcategoriaTercerNivel(supabase, id))
      )
        .then(() =>
          Promise.all(
            [...previo.categorias.keys()]
              .filter((id) => !catsVivas.has(id))
              .map((id) => borrarCategoriaEnBase(supabase, id))
          )
        )
        .then(() =>
          Promise.all(
            [...previo.grupos.keys()]
              .filter((id) => !gruposVivos.has(id))
              .map((id) => borrarGrupoEnBase(supabase, id))
          )
        )
        .catch(fallo);
    },
    [estado.grupos, estado.categorias, estado.subcategorias]
  );

  useEffect(() => {
    if (!supabaseConfigurado || cargando) return;

    const foto = () => ({
      grupos: new Map(estado.grupos.map((c) => [c.id, c])),
      categorias: new Map(estado.categorias.map((s) => [s.id, s])),
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
  }, [estado.grupos, estado.categorias, estado.subcategorias, cargando, persistirCatalogo]);


  const mapCat = useCallback(
    (id: string, fn: (c: Grupo) => Grupo) =>
      setEstado((p) => ({
        ...p,
        grupos: p.grupos.map((c) => (c.id === id ? fn(c) : c)),
      })),
    []
  );

  const mapSub = useCallback(
    (id: string, fn: (s: Categoria) => Categoria) =>
      setEstado((p) => ({
        ...p,
        categorias: p.categorias.map((s) => (s.id === id ? fn(s) : s)),
      })),
    []
  );

  // Mismo mecanismo que el catálogo: se compara contra lo último guardado y se manda
  // solo lo que cambió, con espera para no escribir una vez por tecla.
  const maestrosGuardados = useRef<{
    empresas: Map<string, Empresa>;
    cuentas: Map<string, Cuenta>;
    proveedores: Map<string, Proveedor>;
  } | null>(null);

  const persistirMaestros = useCallback(
    (previo: {
      empresas: Map<string, Empresa>;
      cuentas: Map<string, Cuenta>;
      proveedores: Map<string, Proveedor>;
    }) => {
      const supabase = crearClienteNavegador();
      const fallo = (e: Error) => setErrorGuardado(e.message);

      for (const e of estado.empresas) {
        if (previo.empresas.get(e.id) !== e) guardarEmpresa(supabase, e).catch(fallo);
      }
      for (const c of estado.cuentasBase) {
        if (previo.cuentas.get(c.id) !== c) guardarCuenta(supabase, c).catch(fallo);
      }
      for (const x of estado.proveedores) {
        if (previo.proveedores.get(x.id) !== x) guardarProveedor(supabase, x).catch(fallo);
      }

      const vivos = new Set(estado.proveedores.map((x) => x.id));
      for (const id of previo.proveedores.keys()) {
        if (!vivos.has(id)) borrarProveedorEnBase(supabase, id).catch(fallo);
      }
    },
    [estado.empresas, estado.cuentasBase, estado.proveedores]
  );

  useEffect(() => {
    if (!supabaseConfigurado || cargando) return;

    const foto = () => ({
      empresas: new Map(estado.empresas.map((e) => [e.id, e])),
      cuentas: new Map(estado.cuentasBase.map((c) => [c.id, c])),
      proveedores: new Map(estado.proveedores.map((x) => [x.id, x])),
    });

    if (maestrosGuardados.current === null) {
      maestrosGuardados.current = foto();
      return;
    }

    const temporizador = setTimeout(() => {
      const previo = maestrosGuardados.current;
      if (previo === null) return;
      maestrosGuardados.current = foto();
      persistirMaestros(previo);
    }, 700);
    return () => clearTimeout(temporizador);
  }, [estado.empresas, estado.cuentasBase, estado.proveedores, cargando, persistirMaestros]);

  const mapSub3 = useCallback(
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

  const { movimientos, empresasSeleccionadas, registroSeleccionado, tc, tasas, cuentasBase } =
    estado;

  // Cuántas líneas apuntan a cada categoría: decide si una se puede borrar o
  // solo desactivar. Se cuenta sobre TODOS los movimientos, no los filtrados por el
  // selector de empresas: borrar algo que "no tiene uso" porque hay un filtro puesto
  // dejaría huérfanas las líneas de las otras sociedades.
  const usoDeCategoria = useMemo(() => {
    const uso = new Map<string, number>();
    for (const m of estado.movimientos) {
      for (const l of m.lineas) {
        uso.set(l.categoria_id, (uso.get(l.categoria_id) ?? 0) + 1);
      }
    }
    return uso;
  }, [estado.movimientos]);

  const usoDeSubcategoria = useMemo(() => {
    const uso = new Map<string, number>();
    for (const m of estado.movimientos) {
      for (const l of m.lineas) {
        if (l.subcategoria_id) uso.set(l.subcategoria_id, (uso.get(l.subcategoria_id) ?? 0) + 1);
      }
    }
    return uso;
  }, [estado.movimientos]);

  /** Todos los ids en uso, para no generar uno repetido. Grupos y categorías
   *  comparten espacio de nombres porque el slug sale del nombre y "Impuestos" puede
   *  ser las dos cosas. */
  const idsDelCatalogo = (e: Estado) =>
    new Set([
      ...e.grupos.map((c) => c.id),
      ...e.categorias.map((s) => s.id),
      ...e.subcategorias.map((s) => s.id),
    ]);

  // Los índices se rehacen solo cuando el catálogo cambia: recorrer 293 categorías
  // en cada render de una tabla de 10.530 filas se nota.
  const catalogo = useMemo(
    () => crearIndices(estado.grupos, estado.categorias, estado.subcategorias, estado.empresas),
    [estado.grupos, estado.categorias, estado.subcategorias, estado.empresas]
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
      const cuentas = p.cuentasBase.map((c) => ({ ...c, saldo: 0 }));
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
      const cuenta = p.cuentasBase.find((c) => c.id === cuenta_id);
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
            { categoria_id: m.lineas[0]?.categoria_id ?? "", subcategoria_id: null, doc_tipo: null, monto: Math.round(falta),
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
          { categoria_id: m.lineas[0]?.categoria_id ?? "", subcategoria_id: null, doc_tipo: null, monto: m.monto,
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
        const propio: DocTipo = tipo === "iva" ? "afecta" : "honorario";

        const base = m.lineas.filter((l) => l.categoria_id !== subImpuesto);
        // La base son las líneas de ese tipo. Un proveedor manda tres facturas, dos
        // afectas y una exenta, y se pagan juntas: cobrar IVA sobre las tres es plata
        // que no existe.
        //
        // Si ninguna lo dice —ni la línea ni el movimiento— son todas: apretar el
        // botón ya es decir "esto es afecto", y es como venía funcionando.
        const deSuTipo = base.filter((l) => (l.doc_tipo ?? m.doc_tipo) === propio);
        const gravadas = deSuTipo.length ? deSuTipo : base;
        const suma = gravadas.reduce((s, l) => s + l.monto, 0);
        const monto = Math.round(tipo === "iva" ? suma * tasa : -suma * tasa);
        const lineas: Linea[] = [
          ...base,
          {
            categoria_id: subImpuesto,
            subcategoria_id: null,
            doc_tipo: null,
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
            return { categoria_id: m.lineas[0]?.categoria_id ?? "", subcategoria_id: null, doc_tipo: null, monto: signo * Math.abs(n),
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
      Promise.all([
        cargarMovimientos(supabase),
        cargarCatalogo(supabase),
        cargarMaestros(supabase),
      ])
        .then(([movimientos, catalogo, maestros]) => {
          guardados.current = null;
          catalogoGuardado.current = null;
          maestrosGuardados.current = null;
          setEstado((p) => ({ ...p, movimientos, ...catalogo, ...maestros }));
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
    const cuentas: CuentaConSaldo[] = cuentasBase.map((c) => ({
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
  }, [movimientos, empresasSeleccionadas, registroSeleccionado, cuentasBase]);

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
    usoDeCategoria,
    renombrarGrupo: (id, nombre) =>
      mapCat(id, (c) => ({ ...c, nombre })),
    renombrarCategoria: (id, nombre) => mapSub(id, (x) => ({ ...x, nombre })),
    cambiarNaturaleza: (id, naturaleza) =>
      setEstado((p) => ({
        ...p,
        categorias: p.categorias.map((c) => (c.id === id ? { ...c, naturaleza } : c)),
        // "Si seleccionamos la categoría de un tipo, todas hacia abajo toman ese mismo
        // tipo": se limpian los override en vez de reescribirlos, que es lo mismo pero
        // deja a las hijas siguiendo a la madre de ahí en adelante.
        subcategorias: p.subcategorias.map((x) =>
          x.categoria_id === id ? { ...x, naturaleza: null } : x
        ),
      })),
    cambiarNaturalezaDeGrupo: (grupo_id, naturaleza) =>
      setEstado((p) => ({
        ...p,
        categorias: p.categorias.map((x) =>
          x.grupo_id === grupo_id ? { ...x, naturaleza } : x
        ),
      })),
    alternarControlado: (id) => mapCat(id, (c) => ({ ...c, controlado: !c.controlado })),
    alternarActiva: (id) => mapSub(id, (x) => ({ ...x, activa: !x.activa })),
    crearGrupo: (nombre) =>
      setEstado((p) => {
        const id = idLibre(nombre, idsDelCatalogo(p));
        return {
          ...p,
          grupos: [
            ...p.grupos,
            { id, nombre, orden: p.grupos.length + 1, controlado: true },
          ],
          // Sin categoría el grupo no sirve para clasificar (§3), así que
          // nace con una que se puede renombrar en el acto.
          categorias: [
            ...p.categorias,
            {
              id: idLibre(nombre, new Set([...idsDelCatalogo(p), id])),
              grupo_id: id,
              nombre,
              naturaleza: "operativo",
              activa: true,
            },
          ],
        };
      }),
    crearCategoria: (grupo_id, nombre) =>
      setEstado((p) => ({
        ...p,
        categorias: [
          ...p.categorias,
          {
            id: idLibre(nombre, idsDelCatalogo(p)),
            grupo_id,
            nombre,
            // Hereda la naturaleza de sus hermanas: lo más probable es que sea la
            // misma, y si el grupo es mixta se corrige en el selector de al lado.
            naturaleza:
              p.categorias.find((x) => x.grupo_id === grupo_id)?.naturaleza ??
              "operativo",
            activa: true,
          },
        ],
      })),
    borrarCategoria: (id) =>
      setEstado((p) => ({ ...p, categorias: p.categorias.filter((x) => x.id !== id) })),
    borrarGrupo: (id) =>
      setEstado((p) => ({
        ...p,
        grupos: p.grupos.filter((c) => c.id !== id),
        categorias: p.categorias.filter((x) => x.grupo_id !== id),
      })),
    usoDeSubcategoria,
    crearSubcategoria: (categoria_id, nombre) =>
      setEstado((p) => ({
        ...p,
        subcategorias: [
          ...p.subcategorias,
          {
            id: idLibre(nombre, idsDelCatalogo(p)),
            categoria_id,
            nombre,
            // Nace heredando la de su categoría: crear una subcategoría no debería
            // cambiar de qué lado cae la plata hasta que alguien lo decida.
            naturaleza: null,
            activa: true,
          },
        ],
      })),
    renombrarSubcategoria: (id, nombre) => mapSub3(id, (x) => ({ ...x, nombre })),
    cambiarNaturalezaSubcategoria: (id, naturaleza) =>
      setEstado((p) => {
        const sub = p.subcategorias.find((x) => x.id === id);
        if (!sub) return p;
        const dueña = p.categorias.find((c) => c.id === sub.categoria_id);
        return {
          ...p,
          subcategorias: p.subcategorias.map((x) =>
            x.id === id
              ? { ...x, naturaleza: naturaleza === dueña?.naturaleza ? null : naturaleza }
              : x
          ),
        };
      }),
    alternarActivaSubcategoria: (id) => mapSub3(id, (x) => ({ ...x, activa: !x.activa })),
    borrarSubcategoria: (id) =>
      setEstado((p) => ({
        ...p,
        subcategorias: p.subcategorias.filter((x) => x.id !== id),
        // Las líneas que la usaban conservan su categoría y su monto: se pierde el
        // detalle, no el gasto. La base hace lo mismo con `on delete set null`.
        movimientos: p.movimientos.map((m) =>
          m.lineas.some((l) => l.subcategoria_id === id)
            ? {
                ...m,
                lineas: m.lineas.map((l) =>
                  l.subcategoria_id === id ? { ...l, subcategoria_id: null } : l
                ),
              }
            : m
        ),
      })),
    editarEmpresa: (id, campo, valor) =>
      setEstado((p) => ({
        ...p,
        empresas: p.empresas.map((e) => (e.id === id ? { ...e, [campo]: valor } : e)),
      })),
    editarCuenta: (id, campo, valor) =>
      setEstado((p) => ({
        ...p,
        cuentasBase: p.cuentasBase.map((c) => (c.id === id ? { ...c, [campo]: valor } : c)),
      })),
    crearProveedor: (nombre) =>
      setEstado((p) => ({
        ...p,
        proveedores: [
          ...p.proveedores,
          {
            id: idLibre(nombre, new Set(p.proveedores.map((x) => x.id))),
            nombre,
            rut: null,
            cod_banco: null,
            cuenta: null,
            correo: null,
            activo: true,
          },
        ],
      })),
    editarProveedor: (id, campo, valor) =>
      setEstado((p) => ({
        ...p,
        proveedores: p.proveedores.map((x) => (x.id === id ? { ...x, [campo]: valor } : x)),
      })),
    borrarProveedor: (id) =>
      setEstado((p) => ({ ...p, proveedores: p.proveedores.filter((x) => x.id !== id) })),
    cargarProveedores: (filas) => {
      const utiles = filas.filter((f) => f.nombre && !f.problemas.length);
      const clave = (s: string) =>
        s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      let nuevos = 0;
      let actualizados = 0;

      setEstado((p) => {
        const porClave = new Map(p.proveedores.map((x) => [clave(x.nombre), x]));
        const tomados = new Set(p.proveedores.map((x) => x.id));
        const agregados: Proveedor[] = [];

        for (const f of utiles) {
          const ya = porClave.get(clave(f.nombre));
          if (ya) {
            // Solo pisa lo que la planilla trae: un campo vacío ahí no borra lo que
            // alguien ya había completado a mano en la app.
            porClave.set(clave(f.nombre), {
              ...ya,
              rut: f.rut ?? ya.rut,
              cod_banco: f.cod_banco ?? ya.cod_banco,
              cuenta: f.cuenta ?? ya.cuenta,
              correo: f.correo ?? ya.correo,
            });
          } else {
            const id = idLibre(f.nombre, tomados);
            tomados.add(id);
            agregados.push({
              id,
              nombre: f.nombre,
              rut: f.rut,
              cod_banco: f.cod_banco,
              cuenta: f.cuenta,
              correo: f.correo,
              activo: true,
            });
          }
        }

        nuevos = agregados.length;
        actualizados = utiles.length - agregados.length;
        return {
          ...p,
          proveedores: [
            ...p.proveedores.map((x) => porClave.get(clave(x.nombre)) ?? x),
            ...agregados,
          ],
        };
      });

      return { nuevos, actualizados };
    },
    importarCatalogo: (texto) => {
      const leido = parsearCatalogo(texto, idsDelCatalogo(estado));

      // Lo que ya existe con el mismo nombre se reutiliza en vez de duplicarse: pegar
      // el listado dos veces no debe crear "Administración" y "Administración-2". Se
      // resuelve nivel por nivel, de arriba hacia abajo, porque la identidad de un
      // hijo es (padre, nombre) y el padre puede haberse acabado de traducir.
      const traduccion = new Map<string, string>();

      const gruposPorNombre = new Map(estado.grupos.map((g) => [g.nombre, g.id]));
      const grupos = leido.grupos.filter((g) => {
        const ya = gruposPorNombre.get(g.nombre);
        if (ya) {
          traduccion.set(g.id, ya);
          return false;
        }
        return true;
      });

      const clave = (padre: string, nombre: string) => `${padre}\u0000${nombre}`;
      const catsPorClave = new Map(
        estado.categorias.map((c) => [clave(c.grupo_id, c.nombre), c.id])
      );
      const categorias = leido.categorias
        .map((c) => ({ ...c, grupo_id: traduccion.get(c.grupo_id) ?? c.grupo_id }))
        .filter((c) => {
          const ya = catsPorClave.get(clave(c.grupo_id, c.nombre));
          if (ya) {
            traduccion.set(c.id, ya);
            return false;
          }
          return true;
        });

      const subsPorClave = new Set(
        estado.subcategorias.map((x) => clave(x.categoria_id, x.nombre))
      );
      const subcategorias = leido.subcategorias
        .map((x) => ({ ...x, categoria_id: traduccion.get(x.categoria_id) ?? x.categoria_id }))
        .filter((x) => !subsPorClave.has(clave(x.categoria_id, x.nombre)));

      setEstado((p) => ({
        ...p,
        grupos: [...p.grupos, ...grupos.map((g, i) => ({ ...g, orden: p.grupos.length + i + 1 }))],
        categorias: [...p.categorias, ...categorias],
        subcategorias: [...p.subcategorias, ...subcategorias],
      }));
      return {
        grupos: grupos.length,
        categorias: categorias.length,
        subcategorias: subcategorias.length,
      };
    },
  };

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}
