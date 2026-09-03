"use client";

// Barra lateral. Además de mostrar saldos, navega: al abrir un registro las vistas
// pasan a mostrar solo sus movimientos.
//
// Dos bloques, y la separación es el punto: arriba las cuentas del banco, que
// muestran únicamente lo que ya pasó por la cartola, y abajo las proyecciones.
// En Quicken son registros distintos y así se trabajan. Que en la base sean el
// mismo movimiento cambiando de estado (§4.1) es un detalle del modelo, no algo
// que deba verse en pantalla: quien concilia necesita la cuenta tal cual llega del
// banco, sin compromisos futuros encima.

import { EMPRESAS } from "@/lib/catalogo";
import { useTesoreria } from "@/components/estado/ProveedorTesoreria";
import { Rotulo, clases } from "@/components/ui/primitivas";
import { REGISTROS_PROYECCION, claveDeCuenta, totalDeRegistro } from "@/lib/registros";
import { clp, clpK } from "@/lib/formato";
import { HOY } from "@/lib/fechas";
import { contarVencidos, totalVencido } from "@/lib/vencidos";
import css from "./chrome.module.css";

export function Cuentas() {
  const {
    movimientos,
    cuentas,
    cuentasFiltradas,
    registroSeleccionado,
    seleccionarRegistro,
    setEmpresasSeleccionadas,
    porConciliar,
  } = useTesoreria();

  const porEmpresa = EMPRESAS.map((e) => ({
    empresa: e,
    cuentas: cuentasFiltradas.filter((c) => c.empresa_id === e.id && c.tipo === "banco"),
  })).filter((x) => x.cuentas.length);

  // Las cuentas de cobranza salen sin filtrar por empresa: la cartera es de las
  // cuatro sociedades aunque el registro cuelgue de una. Filtrarla por el selector
  // de empresas la haría desaparecer cuando alguien mira una sola.
  const cobranzas = cuentas.filter((c) => c.tipo === "cxc");

  // Sobre todos los movimientos, no sobre el registro abierto: el contador de la
  // barra lateral tiene que decir cuántos hay en total, o entrar a una cuenta lo
  // haría bajar y parecería que se resolvieron.
  const vencidos = contarVencidos(movimientos, HOY);
  const montoVencido = totalVencido(movimientos, HOY);

  const registros = [
    ...REGISTROS_PROYECCION.map((r) => ({
      clave: r.clave,
      nombre: r.nombre,
      moneda: r.moneda,
      total: totalDeRegistro(r.clave, movimientos, cuentas),
    })),
    ...cobranzas.map((c) => ({
      clave: claveDeCuenta(c.id),
      // El nombre ya trae la moneda al final ("Facturas por cobrar CLP"): se saca
      // para no repetirla, porque la moneda va en su propia columna.
      nombre: c.nombre.replace(/ (CLP|USD)$/, ""),
      moneda: c.moneda,
      total: totalDeRegistro(claveDeCuenta(c.id), movimientos, cuentas),
    })),
  ];

  const nombreDelRegistro = (clave: string) =>
    registros.find((r) => r.clave === clave)?.nombre ??
    cuentas.find((c) => claveDeCuenta(c.id) === clave)?.nombre ??
    null;

  const abierto = registroSeleccionado ? nombreDelRegistro(registroSeleccionado) : null;

  const Fila = ({
    clave,
    izquierda,
    monto,
    moneda,
    titulo,
    tenue,
  }: {
    clave: string;
    izquierda: string;
    monto: number;
    moneda: "CLP" | "USD";
    titulo: string;
    tenue?: boolean;
  }) => {
    const activa = clave === registroSeleccionado;
    return (
      <button
        type="button"
        onClick={() => seleccionarRegistro(activa ? null : clave)}
        aria-pressed={activa}
        title={titulo}
        className={clases(
          css.cuentaFila,
          tenue && css.cuentaUsd,
          activa && css.cuentaActiva
        )}
      >
        <span>{izquierda}</span>
        <span style={{ color: monto < 0 && !activa ? "var(--brick)" : undefined }}>
          {moneda === "USD" ? "US$" : "$"}
          {clp(monto)}
        </span>
      </button>
    );
  };

  return (
    <aside className={css.sidebar}>
      <div className={css.encabezadoSidebar}>
        <Rotulo texto="Cuentas del banco" />
        {abierto && (
          <button
            type="button"
            onClick={() => seleccionarRegistro(null)}
            className={css.verTodo}
          >
            Ver todo
          </button>
        )}
      </div>

      {abierto && (
        <div className={css.avisoCuenta}>
          Viendo solo <strong>{abierto}</strong>. Las vistas muestran únicamente sus
          movimientos.
        </div>
      )}

      {porEmpresa.map(({ empresa, cuentas: cs }) => {
        // El total por empresa es solo CLP: mezclar monedas en un total no dice nada.
        const total = cs.filter((c) => c.moneda === "CLP").reduce((s, c) => s + c.saldo, 0);
        return (
          <div key={empresa.id} className={css.empresa}>
            <button
              type="button"
              onClick={() => setEmpresasSeleccionadas([empresa.id])}
              title={`Ver solo ${empresa.nombre}`}
              className={css.empresaFila}
            >
              <span className={css.empresaNombre}>{empresa.nombre}</span>
              <span
                className={css.empresaTotal}
                style={{ color: total < 0 ? "var(--brick)" : "var(--ink)" }}
              >
                {clpK(total)}
              </span>
            </button>

            {cs.map((c) => (
              <Fila
                key={c.id}
                clave={claveDeCuenta(c.id)}
                izquierda={c.moneda === "USD" ? "USD · fuera del flujo" : "CLP"}
                monto={c.saldo}
                moneda={c.moneda}
                tenue={c.moneda === "USD"}
                titulo={
                  claveDeCuenta(c.id) === registroSeleccionado
                    ? `Salir de ${c.nombre}`
                    : `Ver los movimientos de ${c.nombre} — solo lo que pasó por el banco`
                }
              />
            ))}
          </div>
        );
      })}

      <div className={css.bloqueProyecciones}>
        <div className={css.encabezadoSidebar}>
          <Rotulo texto="Proyecciones" />
        </div>
        <div className={css.glosaProyecciones}>
          Compromisos y cobranzas que todavía no pasan por el banco. No suman al saldo.
        </div>
        {registros.map((r) => (
          <Fila
            key={r.clave}
            clave={r.clave}
            izquierda={`${r.nombre} · ${r.moneda}`}
            monto={r.total}
            moneda={r.moneda}
            titulo={
              r.clave === registroSeleccionado
                ? `Salir de ${r.nombre}`
                : `Ver ${r.nombre.toLowerCase()} en ${r.moneda}`
            }
          />
        ))}
      </div>

      {/* Vencidos primero: es la lista que se mira todos los días. "Por conciliar"
          cuenta otra cosa —lo que pasó por el banco y nadie cuadró contra la
          cartola— y hoy está en cero porque el histórico importado entró
          directamente como conciliado. */}
      <div className={css.bloqueConciliar}>
        <Rotulo texto="Vencidos" />
        <div
          className={css.conteoConciliar}
          style={{ color: vencidos ? "var(--brick)" : "var(--muted)" }}
        >
          {vencidos}
        </div>
        <div className={css.glosaConciliar}>
          {vencidos
            ? `con fecha pasada y sin ocurrir · ${clp(montoVencido)}`
            : "nada con fecha pasada pendiente"}
        </div>
      </div>

      {porConciliar > 0 && (
        <div className={css.bloqueConciliar}>
          <Rotulo texto="Por conciliar" />
          <div className={css.conteoConciliar} style={{ color: "var(--amber)" }}>
            {porConciliar}
          </div>
          <div className={css.glosaConciliar}>
            pagados sin cuadrar contra la cartola
          </div>
        </div>
      )}

      <div className={css.pieSidebar}>
        <div>
          El flujo de caja se lleva sólo en CLP. Las cuentas en dólares se muestran en su
          moneda y quedan fuera del flujo, salvo que actives la conversión.
        </div>
      </div>
    </aside>
  );
}
