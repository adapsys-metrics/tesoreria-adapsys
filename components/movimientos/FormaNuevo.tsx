"use client";

// Alta de movimiento. El tipo de documento decide si se agrega la línea de IVA o la
// de retención (§4.3), y el resumen muestra el líquido que va a salir del banco —
// que es el número que la persona está mirando en la factura o la boleta.

import { useState } from "react";
import { useTesoreria } from "@/components/estado/ProveedorTesoreria";
import { clases } from "@/components/ui/primitivas";
import type { EstadoMovimiento } from "@/lib/tipos";
import { conIva, conRetencion, cuentaPrincipalDe, estadoInicialDe } from "@/lib/dominio";
import { clp, pct } from "@/lib/formato";
import { HOY } from "@/lib/fechas";
import type { DocTipo, Movimiento } from "@/lib/tipos";
import { SelectorCategoria } from "@/components/ui/SelectorCategoria";
import { SelectorCuenta } from "./SelectorCuenta";
import css from "./movimientos.module.css";

const DOCS: { id: DocTipo; nombre: string; pista: string }[] = [
  { id: "exento", nombre: "Exento", pista: "el monto es el final, sin línea de impuesto" },
  { id: "afecta", nombre: "Afecta", pista: "se ingresa el neto y se agrega el IVA" },
  { id: "honorario", nombre: "Honorario", pista: "se ingresa el bruto y se resta la retención" },
];

export function FormaNuevo({ cerrar }: { cerrar: (idCreado?: string) => void }) {
  const { empresasSeleccionadas, cuentas, empresas, tc, tasas, agregarMovimiento } =
    useTesoreria();
  const empresaInicial = empresasSeleccionadas[0] ?? empresas[0]!.id;
  const [cuentaId, setCuentaId] = useState(
    () => cuentaPrincipalDe(cuentas, empresaInicial)?.id ?? cuentas[0]!.id
  );
  const [fecha, setFecha] = useState(HOY);
  /** null = el que corresponda por cuenta y fecha. Un valor es una decisión explícita
   *  de quien registra, y entonces deja de seguir a la fecha. */
  const [forzado, setForzado] = useState<EstadoMovimiento | null>(null);
  const [contraparte, setContraparte] = useState("");
  const [glosa, setGlosa] = useState("");
  const [numeroDoc, setNumeroDoc] = useState("");
  // Sin elegir. Antes arrancaba en "sueldos", que no era una sugerencia sino un valor
  // que se guardaba: quien no lo mirara clasificaba su movimiento ahí sin saberlo.
  const [categoria, setCategoria] = useState<string | null>(null);
  const [base, setBase] = useState("");
  const [doc, setDoc] = useState<DocTipo>("exento");

  const montoBase = Number(base) || 0;

  // Previsualización con los mismos helpers que usa el guardado: lo que se muestra
  // es exactamente lo que se va a grabar.
  const resultado =
    categoria === null
      ? { monto: montoBase, lineas: [] }
      : doc === "afecta"
        ? conIva(montoBase, categoria, tasas.iva)
        : doc === "honorario"
          ? conRetencion(montoBase, categoria, tasas.bhe)
          : {
              monto: montoBase,
              lineas: [
                {
                  categoria_id: categoria,
                  subcategoria_id: null,
                  doc_tipo: null,
                  monto: montoBase,
                  glosa: null,
                },
              ],
            };

  const cuenta = cuentas.find((c) => c.id === cuentaId) ?? cuentas[0]!;

  // Lo que se anota en el banco con fecha de hoy o anterior ya ocurrió. Se muestra y
  // se puede cambiar: decidirlo a escondidas sería cambiar una sorpresa por otra.
  const sugerido = estadoInicialDe(cuenta, fecha, HOY);
  const estado = forzado ?? sugerido;

  // Sin categoría no se puede armar la línea del impuesto —no habría dónde ponerla— y
  // el monto quedaría siendo el neto en vez del total. Con exento sí se puede guardar:
  // queda sin clasificar, que el modelo contempla (§3) y la app muestra marcado.
  const faltaCategoria = categoria === null && doc !== "exento";

  const guardar = () => {
    if (!montoBase || !contraparte.trim() || faltaCategoria) return;
    const nuevo: Omit<Movimiento, "id"> = {
      fecha,
      // Empresa y moneda salen de la cuenta: no se eligen aparte.
      empresa_id: cuenta.empresa_id,
      cuenta_id: cuenta.id,
      contraparte: contraparte.trim(),
      glosa: glosa.trim() || null,
      documento: numeroDoc.trim() || null,
      monto: resultado.monto,
      moneda: cuenta.moneda,
      tipo_cambio: cuenta.moneda === "USD" ? tc : null,
      estado,
      doc_tipo: doc,
      hito: null,
      lineas: resultado.lineas,
    };
    // Se devuelve el id para dejar el movimiento abierto: es donde se le agregan las
    // líneas si tiene más de una, con el editor de splits que ya existe.
    cerrar(agregarMovimiento(nuevo));
  };

  const pista = DOCS.find((d) => d.id === doc)!.pista;

  return (
    // Marca estable para los tests: los controles del formulario se llaman igual que
    // los de cada fila de la tabla —Categoría, Fecha— y sin esto hay que elegir por
    // posición, que se rompe al reordenar.
    <div data-forma="nuevo" className={css.forma}>
      <label className={css.campo}>
        <span className={css.etiquetaCampo}>Fecha</span>
        <input
          type="date"
          value={fecha}
          // Igual que en el editor: el vacío no se guarda. Sin fecha no hay movimiento.
          onChange={(e) => e.target.value && setFecha(e.target.value)}
          className={css.entrada}
        />
      </label>

      <label className={css.campo}>
        <span className={css.etiquetaCampo}>Cuenta</span>
        <SelectorCuenta valor={cuentaId} onChange={setCuentaId} />
      </label>

      <label className={css.campo}>
        <span className={css.etiquetaCampo}>Proveedor / Cliente</span>
        <input
          value={contraparte}
          onChange={(e) => setContraparte(e.target.value)}
          placeholder="GTD"
          className={css.entrada}
        />
      </label>

      <label className={css.campo}>
        <span className={css.etiquetaCampo}>Glosa</span>
        <input
          value={glosa}
          onChange={(e) => setGlosa(e.target.value)}
          placeholder="Internet oficina"
          className={css.entrada}
        />
      </label>

      <label className={css.campo}>
        <span className={css.etiquetaCampo}>N° documento</span>
        <input
          value={numeroDoc}
          onChange={(e) => setNumeroDoc(e.target.value)}
          placeholder="FA3109609"
          aria-label="Número de documento"
          className={css.entrada}
        />
      </label>

      <label className={css.campo}>
        <span className={css.etiquetaCampo}>Categoría</span>
        <SelectorCategoria valor={categoria} onChange={setCategoria} />
      </label>

      <label className={css.campo}>
        <span className={css.etiquetaCampo}>Documento</span>
        <select
          value={doc}
          onChange={(e) => setDoc(e.target.value as DocTipo)}
          className={css.entrada}
        >
          {DOCS.map((d) => (
            <option key={d.id} value={d.id}>
              {d.nombre}
            </option>
          ))}
        </select>
      </label>

      <label className={css.campo}>
        <span className={css.etiquetaCampo}>
          {doc === "afecta" ? "Neto" : doc === "honorario" ? "Bruto" : "Monto"}
          {cuenta.moneda === "USD" ? " (US$)" : ""}
        </span>
        <input
          type="number"
          value={base}
          onChange={(e) => setBase(e.target.value)}
          placeholder="-306745"
          className={css.entrada}
        />
      </label>

      <div className={css.campo}>
        <span className={css.etiquetaCampo}>Estado</span>
        <button
          type="button"
          onClick={() =>
            setForzado(estado === "conciliado" ? "proyectado" : "conciliado")
          }
          title={
            estado === "conciliado"
              ? "Ya ocurrió: está en la cartola con esta fecha. Click para registrarlo como compromiso futuro."
              : "Todavía no ocurre. Click para registrarlo como ya ocurrido."
          }
          className={clases(
            css.estadoNuevo,
            estado === "conciliado" ? css.estadoOcurrido : css.estadoFuturo
          )}
        >
          {estado === "conciliado" ? "ya ocurrió" : "proyectado"}
        </button>
      </div>

      <div className={css.campo}>
        <span className={css.etiquetaCampo}>&nbsp;</span>
        <button
          type="button"
          onClick={guardar}
          disabled={faltaCategoria || !montoBase || !contraparte.trim()}
          title={
            faltaCategoria
              ? "Elige la categoría: sin ella no hay dónde poner la línea del impuesto"
              : !contraparte.trim()
                ? "Falta el proveedor o cliente"
                : !montoBase
                  ? "Falta el monto"
                  : "Guardar y dejarlo abierto para agregarle líneas"
          }
          className={css.guardar}
        >
          Guardar
        </button>
      </div>

      <div className={css.resumenForma}>
        <span>{pista}.</span>
        {categoria === null && (
          <span className={css.avisoForma}>
            {faltaCategoria
              ? "Elige la categoría para poder calcular el impuesto."
              : "Sin categoría: va a quedar marcado como sin clasificar."}
          </span>
        )}
        {doc !== "exento" && montoBase !== 0 && (
          <span>
            {doc === "afecta" ? `IVA ${pct(tasas.iva)}` : `Retención ${pct(tasas.bhe)}`}:{" "}
            <strong>{clp(resultado.lineas[1]?.monto ?? 0)}</strong>
          </span>
        )}
        <span>
          {doc === "honorario" ? "Líquido a pagar" : "Total"}:{" "}
          <span className={css.resumenMonto}>{clp(resultado.monto)}</span>
        </span>
        <button type="button" onClick={() => cerrar()} className={css.botonAmpliar}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
