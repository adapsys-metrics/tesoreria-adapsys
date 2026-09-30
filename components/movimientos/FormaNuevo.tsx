"use client";

// Alta de movimiento. El tipo de documento decide si se agrega la línea de IVA o la
// de retención (§4.3), y el resumen muestra el líquido que va a salir del banco —
// que es el número que la persona está mirando en la factura o la boleta.

import { useState } from "react";
import { useTesoreria } from "@/components/estado/ProveedorTesoreria";
import { clases } from "@/components/ui/primitivas";
import type { EstadoMovimiento } from "@/lib/tipos";
import { cuentaPrincipalDe, estadoInicialDe, lineaDeImpuesto } from "@/lib/dominio";
import { clp, pct } from "@/lib/formato";
import { HOY } from "@/lib/fechas";
import type { DocTipo, Linea, Movimiento } from "@/lib/tipos";
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
  /** Las líneas del movimiento. Arranca con una: casi siempre es una sola, pero un
   *  pago que junta tres facturas se arma acá y no después (§4.3).
   *
   *  La categoría no viene elegida. Antes arrancaba en "sueldos", que no era una
   *  sugerencia sino un valor que se guardaba: quien no lo mirara clasificaba ahí. */
  const [filas, setFilas] = useState<{ categoria: string | null; glosa: string; monto: string }[]>(
    [{ categoria: null, glosa: "", monto: "" }]
  );
  const editarFila = (i: number, cambio: Partial<(typeof filas)[number]>) =>
    setFilas((f) => f.map((x, j) => (j === i ? { ...x, ...cambio } : x)));
  const [doc, setDoc] = useState<DocTipo>("exento");

  // Lo que se muestra es exactamente lo que se va a grabar: mismas líneas, mismo
  // helper de impuesto que usa el editor (§4.3).
  const lineasEscritas: Linea[] = filas
    .filter((f) => f.categoria !== null && Number(f.monto))
    .map((f) => ({
      categoria_id: f.categoria!,
      subcategoria_id: null,
      doc_tipo: null,
      monto: Number(f.monto),
      glosa: f.glosa.trim() || null,
    }));

  const resultado = (() => {
    if (!lineasEscritas.length) return { monto: 0, lineas: [] as Linea[] };
    if (doc === "exento") {
      return {
        monto: lineasEscritas.reduce((s, l) => s + l.monto, 0),
        lineas: lineasEscritas,
      };
    }
    const impuesto = lineaDeImpuesto(
      lineasEscritas,
      doc,
      doc === "afecta" ? "iva" : "bhe",
      doc === "afecta" ? tasas.iva : tasas.bhe
    );
    const lineas = [...lineasEscritas, impuesto];
    return { monto: lineas.reduce((s, l) => s + l.monto, 0), lineas };
  })();

  const cuenta = cuentas.find((c) => c.id === cuentaId) ?? cuentas[0]!;

  // Lo que se anota en el banco con fecha de hoy o anterior ya ocurrió. Se muestra y
  // se puede cambiar: decidirlo a escondidas sería cambiar una sorpresa por otra.
  const sugerido = estadoInicialDe(cuenta, fecha, HOY);
  const estado = forzado ?? sugerido;

  // Una fila con monto pero sin categoría no se puede guardar: se perdería, porque
  // solo entran las que tienen las dos cosas.
  const filaIncompleta = filas.some((f) => Number(f.monto) && f.categoria === null);
  const sinLineas = lineasEscritas.length === 0;

  const guardar = () => {
    if (sinLineas || filaIncompleta || !contraparte.trim()) return;
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
          disabled={sinLineas || filaIncompleta || !contraparte.trim()}
          title={
            !contraparte.trim()
              ? "Falta el proveedor o cliente"
              : filaIncompleta
                ? "Hay una línea con monto y sin categoría: no se guardaría"
                : sinLineas
                  ? "Falta al menos una línea con categoría y monto"
                  : "Guardar"
          }
          className={css.guardar}
        >
          Guardar
        </button>
      </div>

      {/* Las líneas. Arranca con una, que es el caso corriente, y se agregan las que
          hagan falta: un pago que junta tres facturas se arma acá y no después. */}
      <div className={css.lineasForma}>
        {filas.map((f, i) => (
          <div key={i} className={css.lineaForma}>
            <SelectorCategoria
              valor={f.categoria}
              onChange={(id) => editarFila(i, { categoria: id })}
              compacto
            />
            <input
              value={f.glosa}
              onChange={(e) => editarFila(i, { glosa: e.target.value })}
              placeholder={filas.length > 1 ? "glosa de la línea" : "detalle (opcional)"}
              aria-label={`Glosa de la línea ${i + 1}`}
              className={css.inputGlosa}
            />
            <input
              type="number"
              value={f.monto}
              onChange={(e) => editarFila(i, { monto: e.target.value })}
              placeholder="-306745"
              aria-label={`Monto de la línea ${i + 1}`}
              className={css.inputMonto}
              style={{ color: Number(f.monto) < 0 ? "var(--brick)" : "var(--teal)" }}
            />
            <button
              type="button"
              onClick={() => setFilas((x) => x.filter((_, j) => j !== i))}
              disabled={filas.length <= 1}
              title={
                filas.length <= 1
                  ? "Un movimiento tiene que tener al menos una línea"
                  : "Quitar línea"
              }
              className={css.quitar}
            >
              ×
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={() => setFilas((x) => [...x, { categoria: null, glosa: "", monto: "" }])}
          className={css.botonAmpliar}
        >
          + línea
        </button>
        {doc !== "exento" && (
          <span className={css.notaLineas}>
            La línea del impuesto se agrega sola al guardar, sobre lo que escribas acá.
          </span>
        )}
      </div>

      <div className={css.resumenForma}>
        <span>{pista}.</span>
        {filaIncompleta && (
          <span className={css.avisoForma}>
            Hay una línea con monto y sin categoría: no se guardaría.
          </span>
        )}
        {doc !== "exento" && !sinLineas && (
          <span>
            {doc === "afecta" ? `IVA ${pct(tasas.iva)}` : `Retención ${pct(tasas.bhe)}`}:{" "}
            {/* La del impuesto es la última: el helper la agrega al final. */}
            <strong>{clp(resultado.lineas.at(-1)?.monto ?? 0)}</strong>
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
