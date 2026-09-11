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
import { parsearProveedores, type FilaPegada } from "@/lib/proveedores-pegado";
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
    cargarProveedores,
  } = useTesoreria();

  const [nuevo, setNuevo] = useState("");
  const [pegando, setPegando] = useState(false);
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
          <BotonFantasma onClick={() => setPegando((v) => !v)}>
            {pegando ? "Cerrar" : "Pegar desde Excel"}
          </BotonFantasma>
        </div>

        {pegando && <Pegado cargar={cargarProveedores} existentes={proveedores} />}

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


/** Carga por pegado. Acá sí se muestra, al revés que en el catálogo: los datos ya
 *  existen en una planilla y son ~20 filas de cinco columnas. Escribirlas a mano es
 *  donde se cuela un dígito cambiado en un RUT, que bota la nómina entera. */
function Pegado({
  cargar,
  existentes,
}: {
  cargar: (filas: FilaPegada[]) => { nuevos: number; actualizados: number };
  existentes: { nombre: string }[];
}) {
  const [texto, setTexto] = useState("");
  const [resultado, setResultado] = useState<string | null>(null);

  const filas = texto.trim()
    ? parsearProveedores(texto, existentes as Parameters<typeof parsearProveedores>[1])
    : [];
  const buenas = filas.filter((f) => f.nombre && !f.problemas.length);
  const malas = filas.filter((f) => f.problemas.length);

  const aplicar = () => {
    const { nuevos, actualizados } = cargar(filas);
    const partes = [
      nuevos ? `${nuevos} nuevos` : null,
      actualizados ? `${actualizados} actualizados` : null,
    ].filter(Boolean);
    setResultado(partes.length ? `Entraron ${partes.join(" y ")}.` : "No entró ninguno.");
    setTexto("");
  };

  return (
    <div className={css.pegado}>
      <p className={css.nota}>
        Copia las filas desde el Excel y pégalas acá. Si la primera trae los títulos, las
        columnas se reconocen por el nombre; si no, se leen en orden:{" "}
        <strong>nombre, RUT, código de banco, cuenta, correo</strong>. Los puntos y
        guiones se limpian solos.
      </p>
      <textarea
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          setResultado(null);
        }}
        rows={6}
        aria-label="Listado de proveedores"
        placeholder={"Smartbricks Technologies SPA\t76.624.489-0\t37\t70684756\tkarina.urbina@smartbricks.cl"}
        className={css.textarea}
      />

      {resultado && <Aviso tono="teal">{resultado}</Aviso>}

      {filas.length > 0 && (
        <>
          <div className={css.resumenPegado}>
            <strong>{buenas.length}</strong> se pueden cargar
            {malas.length > 0 && (
              <>
                {" · "}
                <span className={css.conProblema}>{malas.length} con problemas</span>
              </>
            )}
          </div>

          {/* Las filas con problema se listan con el motivo en vez de descartarse en
              silencio: casi siempre es un dígito y se corrige en la planilla. */}
          {malas.length > 0 && (
            <ul className={css.problemas}>
              {malas.map((f, i) => (
                <li key={i}>
                  <span className={css.nombreProblema}>{f.nombre || "(sin nombre)"}</span>{" "}
                  {f.problemas.join(", ")}
                </li>
              ))}
            </ul>
          )}

          <button
            type="button"
            onClick={aplicar}
            disabled={!buenas.length}
            className={css.botonAplicar}
          >
            CARGAR {buenas.length}
          </button>
        </>
      )}
    </div>
  );
}
