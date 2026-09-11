"use client";

// Empresas, cuentas y proveedores: los datos de referencia que se administran.
//
// Van juntos en una vista porque se tocan por el mismo motivo —armar la nómina de pago
// (§10)— y casi nunca: el número de cuenta cambia cuando el banco lo cambia, y un
// proveedor se carga una vez. Separarlos en dos pestañas llenaría la barra de opciones
// que nadie abre a diario.

import { useState } from "react";
import { useTesoreria } from "@/components/estado/ProveedorTesoreria";
import { Aviso, BotonFantasma, Cabecera, Rotulo, clases } from "@/components/ui/primitivas";
import { formatearRut, normalizarRut, rutValido } from "@/lib/rut";
import tabla from "@/components/ui/tabla.module.css";
import css from "./maestros.module.css";

/** Lo que la nómina necesita de un proveedor para poder pagarle. */
const COMPLETO = (p: { rut: string | null; cod_banco: string | null; cuenta: string | null }) =>
  Boolean(p.rut && p.cod_banco && p.cuenta);

export function Maestros() {
  const {
    empresas,
    cuentas,
    proveedores,
    editarEmpresa,
    editarCuenta,
    crearProveedor,
    editarProveedor,
    borrarProveedor,
  } = useTesoreria();

  const [nuevo, setNuevo] = useState("");
  const [porBorrar, setPorBorrar] = useState<string | null>(null);

  // Solo las de banco tienen número: las auxiliares son registros de Quicken —la
  // cartera por cobrar, las proyecciones— y no existen como cuenta en ningún banco.
  const deBanco = cuentas.filter((c) => c.tipo === "banco");

  const listos = proveedores.filter((p) => p.activo && COMPLETO(p)).length;
  const conRutMalo = proveedores.filter((p) => p.rut && !rutValido(p.rut));

  const agregar = () => {
    const nombre = nuevo.trim();
    if (!nombre) return;
    crearProveedor(nombre);
    setNuevo("");
  };

  return (
    <>
      <Cabecera
        titulo="Maestros"
        bajada="Los datos que la nómina de pago necesita y que no salen de un movimiento: el número de la cuenta que paga, y el RUT, banco y cuenta de cada proveedor. A la nómina entra lo que tenga proveedor con cuenta cargada acá."
      />

      {conRutMalo.length > 0 && (
        <Aviso tono="brick">
          {conRutMalo.length === 1
            ? `El RUT de ${conRutMalo[0]!.nombre} no es válido.`
            : `Hay ${conRutMalo.length} RUT que no son válidos.`}{" "}
          El portal rechaza la nómina completa, no la línea mala, así que conviene
          corregirlo antes de exportar.
        </Aviso>
      )}

      <section className={css.panel}>
        <div className={css.barra}>
          <Rotulo texto={`${empresas.length} empresas · ${deBanco.length} cuentas de banco`} />
        </div>
        <div className={tabla.envoltorio}>
          <table className={tabla.tabla}>
            <thead>
              <tr>
                <th className={tabla.th}>Empresa</th>
                <th className={tabla.th}>Corto</th>
                <th className={tabla.th}>Cuenta</th>
                <th className={tabla.th}>Moneda</th>
                <th className={tabla.th}>N° de cuenta</th>
              </tr>
            </thead>
            <tbody>
              {empresas.map((e) => {
                const suyas = deBanco.filter((c) => c.empresa_id === e.id);
                return suyas.map((c, i) => (
                  <tr key={c.id} className="fila">
                    <td className={tabla.td}>
                      {i === 0 ? (
                        <input
                          value={e.nombre}
                          onChange={(ev) => editarEmpresa(e.id, "nombre", ev.target.value)}
                          aria-label={`Nombre de ${e.nombre}`}
                          className={clases(css.campo, css.campoFuerte)}
                        />
                      ) : null}
                    </td>
                    <td className={tabla.td}>
                      {i === 0 ? (
                        <input
                          value={e.corto}
                          onChange={(ev) => editarEmpresa(e.id, "corto", ev.target.value)}
                          aria-label={`Abreviatura de ${e.nombre}`}
                          className={clases(css.campo, css.campoCorto)}
                        />
                      ) : null}
                    </td>
                    <td className={tabla.td}>{c.nombre}</td>
                    <td className={tabla.td}>{c.moneda}</td>
                    <td className={tabla.td}>
                      <input
                        value={c.numero ?? ""}
                        onChange={(ev) =>
                          editarCuenta(c.id, "numero", ev.target.value.trim() || null)
                        }
                        placeholder={c.moneda === "CLP" ? "para la nómina" : "no se usa"}
                        aria-label={`Número de ${c.nombre}`}
                        className={clases(css.campo, css.campoNumero)}
                      />
                    </td>
                  </tr>
                ));
              })}
            </tbody>
          </table>
        </div>
        <p className={css.nota}>
          El número solo hace falta en las cuentas en pesos: la nómina se genera únicamente
          para pagos en CLP, los en dólares se cargan directo en el portal.
        </p>
      </section>

      <section className={css.panel}>
        <div className={css.barra}>
          <Rotulo
            texto={`${proveedores.length} proveedores · ${listos} listos para pagar`}
          />
          <input
            value={nuevo}
            onChange={(e) => setNuevo(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && agregar()}
            placeholder="Nombre del proveedor"
            aria-label="Nombre del proveedor nuevo"
            className={css.buscador}
          />
          <BotonFantasma onClick={agregar}>+ proveedor</BotonFantasma>
        </div>

        {proveedores.length === 0 ? (
          <p className={css.nota}>
            Todavía no hay ninguno. El nombre tiene que coincidir con el que aparece en los
            movimientos, que es por donde se emparejan al armar la nómina.
          </p>
        ) : (
          <div className={tabla.envoltorio}>
            <table className={tabla.tabla} style={{ minWidth: 860 }}>
              <thead>
                <tr>
                  <th className={tabla.th}>Proveedor</th>
                  <th className={tabla.th}>RUT</th>
                  <th className={tabla.th}>Banco</th>
                  <th className={tabla.th}>Cuenta</th>
                  <th className={tabla.th}>Correo</th>
                  <th className={tabla.th}>Estado</th>
                  <th className={tabla.th} />
                </tr>
              </thead>
              <tbody>
                {proveedores.map((p) => {
                  const rutMalo = Boolean(p.rut) && !rutValido(p.rut!);
                  return (
                    <tr
                      key={p.id}
                      className={clases("fila", !p.activo && css.filaInactiva)}
                    >
                      <td className={tabla.td}>
                        <input
                          value={p.nombre}
                          onChange={(e) => editarProveedor(p.id, "nombre", e.target.value)}
                          aria-label={`Nombre de ${p.nombre}`}
                          className={clases(css.campo, css.campoFuerte)}
                        />
                      </td>
                      <td className={tabla.td}>
                        <input
                          value={p.rut ? formatearRut(p.rut) : ""}
                          onChange={(e) =>
                            editarProveedor(p.id, "rut", normalizarRut(e.target.value) || null)
                          }
                          placeholder="76.624.489-0"
                          aria-label={`RUT de ${p.nombre}`}
                          title={
                            rutMalo
                              ? "El dígito verificador no calza. El portal rechaza la nómina entera."
                              : "Se guarda sin puntos ni guion, que es como lo pide el portal"
                          }
                          className={clases(css.campo, css.campoRut, rutMalo && css.campoMalo)}
                        />
                      </td>
                      <td className={tabla.td}>
                        <input
                          value={p.cod_banco ?? ""}
                          onChange={(e) =>
                            editarProveedor(p.id, "cod_banco", e.target.value.trim() || null)
                          }
                          placeholder="37"
                          aria-label={`Código de banco de ${p.nombre}`}
                          title="El código del portal, no el nombre del banco"
                          className={clases(css.campo, css.campoCorto)}
                        />
                      </td>
                      <td className={tabla.td}>
                        <input
                          value={p.cuenta ?? ""}
                          onChange={(e) =>
                            editarProveedor(p.id, "cuenta", e.target.value.trim() || null)
                          }
                          placeholder="70684756"
                          aria-label={`Cuenta de ${p.nombre}`}
                          className={clases(css.campo, css.campoNumero)}
                        />
                      </td>
                      <td className={tabla.td}>
                        <input
                          value={p.correo ?? ""}
                          onChange={(e) =>
                            editarProveedor(p.id, "correo", e.target.value.trim() || null)
                          }
                          placeholder="para el aviso de pago"
                          aria-label={`Correo de ${p.nombre}`}
                          className={css.campo}
                        />
                      </td>
                      <td className={tabla.td}>
                        <button
                          type="button"
                          onClick={() => editarProveedor(p.id, "activo", !p.activo)}
                          title={
                            p.activo
                              ? "Entra a la nómina si tiene RUT, banco y cuenta"
                              : "No entra a la nómina, pero conserva sus datos por si vuelve"
                          }
                          className={clases(
                            css.insignia,
                            !p.activo && css.insigniaFuera,
                            p.activo && !COMPLETO(p) && css.insigniaFalta
                          )}
                        >
                          {!p.activo ? "inactivo" : COMPLETO(p) ? "listo" : "faltan datos"}
                        </button>
                      </td>
                      <td className={tabla.td}>
                        {porBorrar === p.id ? (
                          <span className={css.confirmacion}>
                            <button
                              type="button"
                              onClick={() => {
                                borrarProveedor(p.id);
                                setPorBorrar(null);
                              }}
                              aria-label={`Confirmar borrar ${p.nombre}`}
                              className={css.confirmarBorrar}
                            >
                              borrar
                            </button>
                            <button
                              type="button"
                              onClick={() => setPorBorrar(null)}
                              className={css.cancelar}
                            >
                              cancelar
                            </button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setPorBorrar(p.id)}
                            aria-label={`Borrar ${p.nombre}`}
                            className={css.borrar}
                          >
                            ×
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
