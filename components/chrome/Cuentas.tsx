"use client";

// Barra lateral. Además de mostrar saldos, navega: al abrir un registro las vistas
// pasan a mostrar solo sus movimientos.
//
// Tres bloques, y la separación es el punto: arriba las cuentas del banco, que
// muestran únicamente lo que ya pasó por la cartola, después las proyecciones, y
// al final los registros de control, que no son plata nuestra en ninguna parte.
// En Quicken son registros distintos y así se trabajan. Que en la base sean el
// mismo movimiento cambiando de estado (§4.1) es un detalle del modelo, no algo
// que deba verse en pantalla: quien concilia necesita la cuenta tal cual llega del
// banco, sin compromisos futuros encima.
//
// **Está escrita para caber entera.** Con cuatro empresas y seis registros de
// proyección la versión anterior pasaba de 45 líneas y había que desplazarla para
// llegar a los vencidos, que es justamente lo que se mira todos los días. Tres
// cosas la estiraban y ninguna decía nada nuevo:
//
//   - La moneda iba dos veces, en la etiqueta y en el signo del monto, y
//     "Egresos proyectados · CLP" no cabe en 244px: envolvía a dos líneas. Ahora
//     el nombre va corto y la moneda es una marca de tres letras.
//   - Tres glosas explicativas de dos y tres líneas, que se leen una vez en la
//     vida. Pasaron al title del rótulo de su sección.
//   - El total de la empresa y su cuenta en pesos **son el mismo número**: el
//     total es la suma de las cuentas CLP y hay una sola por empresa. Se fusionan
//     en una fila, que abre la cuenta. Si alguna empresa llegara a tener dos
//     cuentas en pesos, vuelven a separarse solas — ahí el total sí dice algo que
//     ninguna fila dice, y entonces no es un botón.
//
// **La barra no filtra por empresa.** El nombre abría la cuenta o cambiaba el
// filtro global según dónde cayera el clic, y el filtro es global: apaga las otras
// tres empresas en todas las vistas y deja el selector de arriba diciendo "1
// EMPRESAS", sin nombrar cuál. Se activaba sin querer y no se veía cómo volver.
// Filtrar es del selector de arriba, que para eso está; acá una fila abre un
// registro y nada más, como en Quicken.

import type { ReactNode } from "react";
import { useTesoreria } from "@/components/estado/ProveedorTesoreria";
import { clases } from "@/components/ui/primitivas";
import type { CuentaConSaldo } from "@/components/estado/ProveedorTesoreria";
import { REGISTROS_PROYECCION, claveDeCuenta, totalDeRegistro } from "@/lib/registros";
import { clp, clpK } from "@/lib/formato";
import { HOY } from "@/lib/fechas";
import { contarVencidos, totalVencido } from "@/lib/vencidos";
import css from "./chrome.module.css";

/** Los dólares no entran al flujo (§4.5) y se dice una sola vez, abajo. Repetirlo
 *  en cada fila costaba una línea por cuenta: la etiqueta no cabía en el ancho. */
const NOTA_USD = "Los saldos en dólares quedan fuera del flujo: se muestran en su moneda, sin convertir.";

const AYUDA_PROYECCIONES =
  "Compromisos y cobranzas que todavía no pasan por el banco. No suman al saldo.";

const AYUDA_CONTROL =
  "No entran al flujo, al presupuesto ni a ningún saldo. El neteo semestral sí llega al banco y está anotado en la cuenta dólar.";

/** Encabezado de sección. Propio y no el `Rotulo` común porque acá el rótulo va en
 *  teal —es lo que estructura la barra ahora que no hay glosas— y el resto de la
 *  app lo quiere gris. */
function Seccion({
  texto,
  ayuda,
  derecha,
}: {
  texto: string;
  ayuda?: string;
  derecha?: ReactNode;
}) {
  return (
    <div className={css.seccion}>
      <span className={css.rotuloSeccion}>{texto}</span>
      {ayuda && (
        <span className={css.ayuda} title={ayuda} aria-label={ayuda}>
          ⓘ
        </span>
      )}
      <span className={css.empuje} />
      {derecha}
    </div>
  );
}

/**
 * Una fila de registro: nombre, marca de moneda y monto.
 *
 * Va fuera del componente a propósito. Declarada adentro, React la trata como un
 * tipo nuevo en cada render y desmonta y vuelve a montar todas las filas: se
 * pierde el foco y el :hover parpadea al cambiar cualquier cosa del estado.
 */
function Fila({
  izquierda,
  marca,
  monto,
  moneda,
  titulo,
  activa,
  tenue,
  sangria,
  onClick,
}: {
  izquierda: string;
  /** "CLP"/"USD" cuando conviven las dos del mismo registro. En las cuentas del
   *  banco no hace falta: el signo del monto ya las distingue. */
  marca?: string;
  monto: number;
  moneda: "CLP" | "USD";
  titulo: string;
  activa: boolean;
  tenue?: boolean;
  sangria?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activa}
      title={titulo}
      className={clases(
        css.fila,
        tenue && css.filaTenue,
        sangria && css.filaSangria,
        activa && css.filaActiva
      )}
    >
      <span className={css.filaNombre}>{izquierda}</span>
      {marca && <span className={css.marcaMoneda}>{marca}</span>}
      <Monto monto={monto} moneda={moneda} activa={activa} />
    </button>
  );
}

function Monto({
  monto,
  moneda,
  activa,
  fuerte,
}: {
  monto: number;
  moneda: "CLP" | "USD";
  activa?: boolean;
  fuerte?: boolean;
}) {
  return (
    <span
      className={clases(
        css.filaMonto,
        fuerte && css.montoFuerte,
        // El magenta queda para los negativos y los vencidos, así el color dice
        // algo. En una fila abierta no: ahí manda el teal del fondo.
        monto < 0 && !activa && css.montoNegativo
      )}
    >
      {moneda === "USD" ? "US$" : "$"}
      {clp(monto)}
    </span>
  );
}

export function Cuentas() {
  const {
    movimientos,
    cuentas,
    cuentasFiltradas,
    registroSeleccionado,
    seleccionarRegistro,
    porConciliar,
    empresas,
  } = useTesoreria();

  const porEmpresa = empresas
    .map((e) => ({
      empresa: e,
      cuentas: cuentasFiltradas.filter((c) => c.empresa_id === e.id && c.tipo === "banco"),
    }))
    .filter((x) => x.cuentas.length);

  // Las cuentas de cobranza salen sin filtrar por empresa: la cartera es de las
  // cuatro sociedades aunque el registro cuelgue de una. Filtrarla por el selector
  // de empresas la haría desaparecer cuando alguien mira una sola.
  const cobranzas = cuentas.filter((c) => c.tipo === "cxc");

  // Los registros de control sí siguen el filtro de empresas: a diferencia de la
  // cartera, que es de las cuatro sociedades, la cuenta corriente con Perú es de
  // CLA ADAPTACIÓN y de nadie más.
  const controles = cuentasFiltradas.filter((c) => c.tipo === "control");

  // Sobre todos los movimientos, no sobre el registro abierto: el contador de la
  // barra lateral tiene que decir cuántos hay en total, o entrar a una cuenta lo
  // haría bajar y parecería que se resolvieron. `movimientos` ya viene sin los
  // registros de control, que no tienen vencidos que mirar.
  const vencidos = contarVencidos(movimientos, HOY);
  const montoVencido = totalVencido(movimientos, HOY);

  // El nombre de cobranza ya trae la moneda al final ("Facturas por cobrar CLP"):
  // se saca para no repetirla, porque ahora va en su propia marca.
  const sinMoneda = (nombre: string) => nombre.replace(/ (CLP|USD)$/, "");

  const registros = [
    ...REGISTROS_PROYECCION.map((r) => ({
      clave: r.clave,
      nombre: r.nombre,
      moneda: r.moneda,
      total: totalDeRegistro(r.clave, movimientos, cuentas),
    })),
    ...cobranzas.map((c) => ({
      clave: claveDeCuenta(c.id),
      nombre: sinMoneda(c.nombre),
      moneda: c.moneda,
      total: totalDeRegistro(claveDeCuenta(c.id), movimientos, cuentas),
    })),
  ];

  // Con el nombre completo no entra la marca de moneda al lado. La primera palabra
  // alcanza —"Egresos", "Facturas", "Proyectos" bajo el rótulo PROYECCIONES no se
  // confunden con nada— y el nombre entero queda en el title.
  const corto = (nombre: string) => nombre.split(" ")[0] ?? nombre;

  const nombreDelRegistro = (clave: string) =>
    registros.find((r) => r.clave === clave)?.nombre ??
    cuentas.find((c) => claveDeCuenta(c.id) === clave)?.nombre ??
    null;

  const abierto = registroSeleccionado ? nombreDelRegistro(registroSeleccionado) : null;

  /** Abre el registro, o lo cierra si ya estaba abierto. */
  const alternar = (clave: string) =>
    seleccionarRegistro(clave === registroSeleccionado ? null : clave);

  const tituloDeCuenta = (c: CuentaConSaldo) =>
    claveDeCuenta(c.id) === registroSeleccionado
      ? `Salir de ${c.nombre}`
      : `Ver los movimientos de ${c.nombre} — solo lo que pasó por el banco`;

  return (
    <aside className={css.sidebar}>
      <Seccion
        texto="Cuentas del banco"
        derecha={
          abierto && (
            <button
              type="button"
              onClick={() => seleccionarRegistro(null)}
              className={css.verTodo}
            >
              Ver todo
            </button>
          )
        }
      />

      {abierto && (
        <div className={css.avisoCuenta}>
          Viendo solo <strong>{abierto}</strong>
        </div>
      )}

      <div className={clases(css.bloque, css.bloquePrimero)}>
        {porEmpresa.map(({ empresa, cuentas: cs }) => {
          const enPesos = cs.filter((c) => c.moneda === "CLP");
          const resto = cs.filter((c) => c.moneda !== "CLP");
          // El caso normal: una sola cuenta en pesos, y entonces el total de la
          // empresa es exactamente su saldo. Se fusionan.
          // El `?? null` no es ruido: con noUncheckedIndexedAccess el índice es
          // `CuentaConSaldo | undefined`, y sin él `unica !== null` no estrecha.
          const unica = enPesos.length === 1 ? enPesos[0] ?? null : null;
          const total = enPesos.reduce((s, c) => s + c.saldo, 0);
          const activa = unica !== null && claveDeCuenta(unica.id) === registroSeleccionado;

          return (
            <div key={empresa.id} className={css.empresa}>
              {unica ? (
                <button
                  type="button"
                  onClick={() => alternar(claveDeCuenta(unica.id))}
                  aria-pressed={activa}
                  title={tituloDeCuenta(unica)}
                  className={clases(css.filaEmpresa, activa && css.filaActiva)}
                >
                  <span className={css.nombreEmpresa}>{empresa.nombre}</span>
                  <Monto monto={unica.saldo} moneda="CLP" activa={activa} fuerte />
                </button>
              ) : (
                // Dos cuentas en pesos o ninguna: el total vuelve a decir algo que
                // ninguna fila dice, y no abre nada — las cuentas van abajo.
                <div className={css.filaEmpresa}>
                  <span className={css.nombreEmpresa}>{empresa.nombre}</span>
                  <span className={clases(css.filaMonto, css.montoFuerte)}>
                    {clpK(total)}
                  </span>
                </div>
              )}

              {(unica ? resto : cs).map((c) => (
                <Fila
                  key={c.id}
                  izquierda={unica ? c.moneda : `${c.moneda} · ${sinMoneda(c.nombre)}`}
                  monto={c.saldo}
                  moneda={c.moneda}
                  tenue={c.moneda === "USD"}
                  sangria
                  activa={claveDeCuenta(c.id) === registroSeleccionado}
                  titulo={tituloDeCuenta(c)}
                  onClick={() => alternar(claveDeCuenta(c.id))}
                />
              ))}
            </div>
          );
        })}
      </div>

      <div className={css.bloque}>
        <Seccion texto="Proyecciones" ayuda={AYUDA_PROYECCIONES} />
        {registros.map((r) => (
          <Fila
            key={r.clave}
            izquierda={corto(r.nombre)}
            marca={r.moneda}
            monto={r.total}
            moneda={r.moneda}
            tenue={r.moneda === "USD"}
            activa={r.clave === registroSeleccionado}
            titulo={
              r.clave === registroSeleccionado
                ? `Salir de ${r.nombre} en ${r.moneda}`
                : `Ver ${r.nombre.toLowerCase()} en ${r.moneda}`
            }
            onClick={() => alternar(r.clave)}
          />
        ))}
      </div>

      {controles.length > 0 && (
        <div className={css.bloque}>
          <Seccion texto="Registros de control" ayuda={AYUDA_CONTROL} />
          {controles.map((c) => (
            <Fila
              key={c.id}
              izquierda={c.nombre.replace(/^CLA ADAPTACIÓN /, "")}
              monto={c.saldo}
              moneda={c.moneda}
              tenue
              activa={claveDeCuenta(c.id) === registroSeleccionado}
              titulo={
                claveDeCuenta(c.id) === registroSeleccionado
                  ? `Salir de ${c.nombre}`
                  : `Ver ${c.nombre} — solo para llevar la cuenta, no entra a ninguna vista`
              }
              onClick={() => alternar(claveDeCuenta(c.id))}
            />
          ))}
        </div>
      )}

      {/* Vencidos primero: es la lista que se mira todos los días. "Por conciliar"
          cuenta otra cosa —lo que pasó por el banco y nadie cuadró contra la
          cartola— y hoy está en cero porque el histórico importado entró
          directamente como conciliado. */}
      <div className={css.bloque}>
        <div
          className={css.filaContador}
          title="Fecha pasada y todavía proyectado: o ya ocurrió y falta registrarlo, o hay que mover la fecha."
        >
          <span className={css.rotuloSeccion}>Vencidos</span>
          <span
            className={css.conteo}
            style={{ color: vencidos ? "var(--brick)" : "var(--tenue)" }}
          >
            {vencidos}
          </span>
          <span className={css.empuje} />
          {vencidos > 0 && <Monto monto={montoVencido} moneda="CLP" />}
        </div>

        {porConciliar > 0 && (
          <div className={css.filaContador} title="Pagados sin cuadrar contra la cartola.">
            <span className={css.rotuloSeccion}>Por conciliar</span>
            <span className={css.conteo} style={{ color: "var(--amber)" }}>
              {porConciliar}
            </span>
          </div>
        )}
      </div>

      <div className={css.pieSidebar}>{NOTA_USD}</div>
    </aside>
  );
}
