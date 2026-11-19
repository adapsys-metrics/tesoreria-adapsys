"use client";

// Quién entra, con qué permisos y a qué pestañas.
//
// Esto se administraba desde el panel de Supabase, lo cual está bien para tres
// personas que pueden todo y deja de estarlo apenas hay perfiles: armar uno
// significa saber qué claves de vista existen, escribirlas a mano en un campo
// `text[]` y acertar. Acá son casillas, y salen de la misma lista que pinta el
// menú (`lib/vistas.ts`), así que no hay forma de marcar algo que no existe.
//
// Dos cosas que conviene tener presentes al mirar esta pantalla:
//
// - **Esconder una pestaña no esconde su dato.** Quien tenga solo Flujo de caja
//   igual ve los movimientos ahí adentro, porque el flujo se abre al detalle. Lo
//   que impide escribir es el rol, y lo hace cumplir la base (0022), no esta
//   pantalla.
// - **Nadie se queda sin salida.** Un perfil sin ninguna vista marcada no entra:
//   el middleware lo rechaza en vez de dejarlo en una app sin pestañas, que se
//   vería como una app rota. Por eso se avisa acá.

import { useState } from "react";
import { useTesoreria } from "@/components/estado/ProveedorTesoreria";
import { VISTAS } from "@/lib/vistas";
import { fechaCorta } from "@/lib/fechas";
import { Aviso, Rotulo, clases } from "@/components/ui/primitivas";
import tabla from "@/components/ui/tabla.module.css";
import css from "./maestros.module.css";

const DOMINIO = "@adapsysgroup.com";

export function Usuarios() {
  const { usuarios, crearUsuario, editarUsuario, sesion, puedeEditar } = useTesoreria();
  const [correo, setCorreo] = useState("");
  const [nombre, setNombre] = useState("");

  const limpio = correo.trim().toLowerCase();
  const yaEstá = usuarios.some((u) => u.email === limpio);
  const sirve = limpio.endsWith(DOMINIO) && nombre.trim() !== "" && !yaEstá;

  const agregar = () => {
    if (!sirve) return;
    crearUsuario(limpio, nombre);
    setCorreo("");
    setNombre("");
  };

  const activos = usuarios.filter((u) => u.activo);
  const sinVistas = activos.filter((u) => u.vistas !== null && u.vistas.length === 0);

  return (
    <section className={css.panel}>
      <div className={css.barra}>
        <Rotulo
          texto={`${activos.length} con acceso · ${activos.filter((u) => u.rol === "editor").length} editan`}
        />
      </div>

      {sinVistas.length > 0 && (
        <Aviso tono="brick">
          {sinVistas.length === 1
            ? `${sinVistas[0]!.nombre || sinVistas[0]!.email} no tiene ninguna pestaña marcada, así que no puede entrar.`
            : `${sinVistas.length} personas no tienen ninguna pestaña marcada, así que no pueden entrar.`}{" "}
          Marcales al menos una, o desactivá el acceso si ya no corresponde.
        </Aviso>
      )}

      <div className={tabla.envoltorio}>
        <table className={tabla.tabla}>
          <thead>
            <tr>
              <th className={tabla.th}>Nombre</th>
              <th className={tabla.th}>Correo</th>
              <th className={tabla.th}>Rol</th>
              <th className={tabla.th}>Pestañas que ve</th>
              <th className={tabla.th}>Acceso</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => {
              const todas = u.vistas === null;
              const esYo = u.email === sesion.email;
              return (
                <tr key={u.email} className={clases("fila", !u.activo && css.filaInactiva)}>
                  <td className={tabla.td}>
                    <input
                      value={u.nombre}
                      onChange={(e) => editarUsuario(u.email, "nombre", e.target.value)}
                      // Al salir del campo y no en cada tecla: recortando mientras
                      // se escribe, la barra espaciadora parece rota (§8).
                      onBlur={(e) => editarUsuario(u.email, "nombre", e.target.value.trim())}
                      aria-label={`Nombre de ${u.email}`}
                      disabled={!puedeEditar}
                      className={clases(css.campo, css.campoFuerte)}
                    />
                  </td>

                  {/* El correo no se edita: es la llave de la fila y lo que compara
                      la RLS contra el token de Google. Cambiarlo sería dar de baja
                      a alguien y de alta a otro en un solo campo, sin que se note. */}
                  <td className={clases(tabla.td, css.textoTenue)}>{u.email}</td>

                  <td className={tabla.td}>
                    <select
                      value={u.rol}
                      onChange={(e) =>
                        editarUsuario(u.email, "rol", e.target.value as "editor" | "revisor")
                      }
                      // Quitarse a uno mismo el rol de editor deja la lista sin
                      // quien la administre si uno es el último. Lo hace otro.
                      disabled={!puedeEditar || esYo}
                      title={esYo ? "Tu propio rol lo cambia otro editor" : undefined}
                      aria-label={`Rol de ${u.nombre || u.email}`}
                      className={css.campo}
                    >
                      <option value="editor">editor</option>
                      <option value="revisor">revisor</option>
                    </select>
                  </td>

                  <td className={tabla.td}>
                    <div className={css.vistas}>
                      {VISTAS.map((v) => (
                        <label key={v.clave} className={css.vista} title={v.nota}>
                          <input
                            type="checkbox"
                            checked={todas || u.vistas!.includes(v.clave)}
                            onChange={(e) => {
                              // `null` significa todas, y es como quedaron las
                              // filas de antes de que existiera la columna. Al
                              // destildar la primera hay que escribir la lista
                              // entera menos esa: si no, se guardaría "ninguna".
                              const base = u.vistas ?? VISTAS.map((x) => x.clave);
                              editarUsuario(
                                u.email,
                                "vistas",
                                e.target.checked
                                  ? [...base, v.clave]
                                  : base.filter((c) => c !== v.clave)
                              );
                            }}
                            disabled={!puedeEditar}
                          />
                          {v.texto}
                        </label>
                      ))}
                    </div>
                  </td>

                  <td className={tabla.td}>
                    <button
                      type="button"
                      onClick={() => editarUsuario(u.email, "activo", !u.activo)}
                      // Desactivarse a uno mismo cierra la puerta por dentro.
                      disabled={!puedeEditar || esYo}
                      title={
                        esYo
                          ? "Tu propio acceso lo quita otro editor"
                          : u.activo
                            ? "Deja de poder entrar. La fila se conserva."
                            : "Vuelve a poder entrar"
                      }
                      className={clases(css.botonChico, u.activo && css.botonActivo)}
                    >
                      {u.activo ? "activo" : "sin acceso"}
                    </button>
                  </td>
                </tr>
              );
            })}

            {usuarios.length === 0 && (
              <tr>
                <td className={clases(tabla.td, css.textoTenue)} colSpan={5}>
                  Sin lista cargada. Con la base conectada acá aparece quién tiene acceso.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {puedeEditar && (
        <div className={css.alta}>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre y apellido"
            aria-label="Nombre de la persona nueva"
            className={css.campo}
          />
          <input
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            placeholder={`persona${DOMINIO}`}
            aria-label="Correo de la persona nueva"
            className={css.campo}
          />
          <button type="button" onClick={agregar} disabled={!sirve} className={css.botonChico}>
            Dar acceso
          </button>
          {/* El dominio se exige igual en la base: son dos filtros, no uno (§1).
              Decirlo acá evita agregar una fila que nunca va a poder entrar. */}
          <span className={css.textoTenue}>
            {yaEstá
              ? "Ese correo ya está en la lista."
              : limpio && !limpio.endsWith(DOMINIO)
                ? `Tiene que ser una cuenta ${DOMINIO}.`
                : "Entra como revisor y sin pestañas: elegí las suyas en la fila."}
          </span>
        </div>
      )}

      <p className={css.pieSeccion}>
        Esconder una pestaña no esconde su dato: quien tenga Flujo de caja ve los
        movimientos al abrir el detalle de un monto. Lo que impide escribir es el rol, y lo
        hace cumplir la base — no esta pantalla. Las filas no se borran: se quita el
        acceso, y queda el registro de quién lo tuvo.
        {!puedeEditar && " Tu perfil es de solo lectura, así que acá solo podés mirar."}
      </p>
    </section>
  );
}
