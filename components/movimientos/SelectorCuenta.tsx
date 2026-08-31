"use client";

// Selector de cuenta, agrupado por empresa.
//
// Es un solo control en vez de "empresa + moneda" porque la cuenta es la elección
// atómica: de ella salen la empresa Y la moneda, que no cambian nunca una vez
// abierta la cuenta. El nombre ya dice las dos cosas ("CLA ADAPTACIÓN PESOS"), así
// que no hace falta un campo aparte para la moneda — y así es imposible registrar
// un pago en dólares desde la cuenta en pesos.

import { EMPRESAS } from "@/lib/catalogo";
import { useTesoreria } from "@/components/estado/ProveedorTesoreria";
import css from "./movimientos.module.css";

export function SelectorCuenta({
  valor,
  onChange,
  etiqueta = "Cuenta",
}: {
  /** null cuando la proyección todavía no sabe de qué cuenta va a salir. */
  valor: string | null;
  onChange: (cuenta_id: string) => void;
  etiqueta?: string;
}) {
  const { cuentas } = useTesoreria();

  const porEmpresa = EMPRESAS.map((e) => ({
    empresa: e,
    cuentas: cuentas.filter((c) => c.empresa_id === e.id && c.tipo === "banco"),
  })).filter((g) => g.cuentas.length);

  return (
    <select
      value={valor ?? ""}
      aria-label={etiqueta}
      onChange={(e) => onChange(e.target.value)}
      className={css.entrada}
    >
      {/* Solo aparece mientras no hay cuenta: una vez elegida no se puede volver
          a "sin cuenta", porque el movimiento ya nombró de dónde sale la plata. */}
      {valor === null && <option value="">— sin cuenta asignada —</option>}
      {porEmpresa.map(({ empresa, cuentas: cs }) => (
        <optgroup key={empresa.id} label={empresa.nombre}>
          {cs.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
