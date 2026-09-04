"use client";

// Alta de movimiento. El tipo de documento decide si se agrega la línea de IVA o la
// de retención (§4.3), y el resumen muestra el líquido que va a salir del banco —
// que es el número que la persona está mirando en la factura o la boleta.

import { useState } from "react";
import { EMPRESAS } from "@/lib/catalogo";
import { useTesoreria } from "@/components/estado/ProveedorTesoreria";
import { conIva, conRetencion, cuentaPrincipalDe } from "@/lib/dominio";
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

export function FormaNuevo({ cerrar }: { cerrar: () => void }) {
  const { empresasSeleccionadas, cuentas, tc, tasas, agregarMovimiento } = useTesoreria();
  const empresaInicial = empresasSeleccionadas[0] ?? EMPRESAS[0]!.id;
  const [cuentaId, setCuentaId] = useState(
    () => cuentaPrincipalDe(cuentas, empresaInicial)?.id ?? cuentas[0]!.id
  );
  const [fecha, setFecha] = useState(HOY);
  const [contraparte, setContraparte] = useState("");
  const [glosa, setGlosa] = useState("");
  const [numeroDoc, setNumeroDoc] = useState("");
  const [categoria, setCategoria] = useState("sueldos");
  const [base, setBase] = useState("");
  const [doc, setDoc] = useState<DocTipo>("exento");

  const montoBase = Number(base) || 0;

  // Previsualización con los mismos helpers que usa el guardado: lo que se muestra
  // es exactamente lo que se va a grabar.
  const resultado =
    doc === "afecta"
      ? conIva(montoBase, categoria, tasas.iva)
      : doc === "honorario"
        ? conRetencion(montoBase, categoria, tasas.bhe)
        : {
            monto: montoBase,
            lineas: [{ categoria_id: categoria, subcategoria_id: null, monto: montoBase, glosa: null }],
          };

  const cuenta = cuentas.find((c) => c.id === cuentaId) ?? cuentas[0]!;

  const guardar = () => {
    if (!montoBase || !contraparte.trim()) return;
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
      estado: "proyectado",
      doc_tipo: doc,
      lineas: resultado.lineas,
    };
    agregarMovimiento(nuevo);
    cerrar();
  };

  const pista = DOCS.find((d) => d.id === doc)!.pista;

  return (
    <div className={css.forma}>
      <label className={css.campo}>
        <span className={css.etiquetaCampo}>Fecha</span>
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
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
        <span className={css.etiquetaCampo}>&nbsp;</span>
        <button type="button" onClick={guardar} className={css.guardar}>
          Guardar
        </button>
      </div>

      <div className={css.resumenForma}>
        <span>{pista}.</span>
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
        <button type="button" onClick={cerrar} className={css.botonAmpliar}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
