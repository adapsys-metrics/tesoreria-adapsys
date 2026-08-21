"use client";

import { EMPRESAS } from "@/lib/catalogo";
import { useTesoreria } from "@/components/estado/ProveedorTesoreria";
import { Rotulo, clases } from "@/components/ui/primitivas";
import { clp, clpK } from "@/lib/formato";
import css from "./chrome.module.css";

export function Cuentas() {
  const { cuentasFiltradas, porConciliar } = useTesoreria();

  const porEmpresa = EMPRESAS.map((e) => ({
    empresa: e,
    cuentas: cuentasFiltradas.filter((c) => c.empresa_id === e.id && c.tipo === "banco"),
  })).filter((x) => x.cuentas.length);

  return (
    <aside className={css.sidebar}>
      <Rotulo texto="Saldos por empresa" pad />

      {porEmpresa.map(({ empresa, cuentas }) => {
        // El total por empresa es solo CLP: mezclar monedas en un total no dice nada.
        const total = cuentas
          .filter((c) => c.moneda === "CLP")
          .reduce((s, c) => s + c.saldo, 0);
        return (
          <div key={empresa.id} className={css.empresa}>
            <div className={css.empresaFila}>
              <span className={css.empresaNombre}>{empresa.nombre}</span>
              <span
                className={css.empresaTotal}
                style={{ color: total < 0 ? "var(--brick)" : "var(--ink)" }}
              >
                {clpK(total)}
              </span>
            </div>
            {cuentas.map((c) => (
              <div
                key={c.id}
                className={clases(css.cuentaFila, c.moneda === "USD" && css.cuentaUsd)}
              >
                <span>
                  {c.moneda}
                  {c.moneda === "USD" && " · fuera del flujo"}
                </span>
                <span>
                  {c.moneda === "USD" ? "US$" : "$"}
                  {clp(c.saldo)}
                </span>
              </div>
            ))}
          </div>
        );
      })}

      <div className={css.bloqueConciliar}>
        <Rotulo texto="Por conciliar" />
        <div
          className={css.conteoConciliar}
          style={{ color: porConciliar ? "var(--amber)" : "var(--muted)" }}
        >
          {porConciliar}
        </div>
        <div className={css.glosaConciliar}>
          {porConciliar
            ? "movimientos pagados sin cuadrar contra cartola"
            : "todo cuadrado contra cartola"}
        </div>
      </div>

      <div className={css.pieSidebar}>
        <div>
          El flujo de caja se lleva sólo en CLP. Las cuentas en dólares se muestran en
          su moneda y quedan fuera del flujo, salvo que actives la conversión.
        </div>
      </div>
    </aside>
  );
}
