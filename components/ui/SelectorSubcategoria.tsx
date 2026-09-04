"use client";

// Selector del tercer nivel — el detalle dentro de una categoría (§5).
//
// Solo aparece cuando la categoría de la línea tiene subcategorías, que hoy son 3 de
// 290. Mostrarlo siempre, vacío, pondría un control muerto en cada línea de una tabla
// de 10.530 movimientos y haría parecer obligatorio un nivel que es opcional.

import { useTesoreria } from "@/components/estado/ProveedorTesoreria";
import css from "./selector.module.css";
import { clases } from "./primitivas";

export function SelectorSubcategoria({
  categoria_id,
  valor,
  onChange,
  compacto,
}: {
  /** La categoría de la línea: de ella cuelgan las opciones. */
  categoria_id: string | null;
  valor: string | null;
  onChange: (id: string | null) => void;
  compacto?: boolean;
}) {
  const { catalogo } = useTesoreria();
  const opciones = categoria_id ? catalogo.subcategoriasDe(categoria_id) : [];

  // La que ya está puesta se ofrece aunque esté inactiva: si no, cambiar cualquier
  // otra cosa de la línea la borraría sin que nadie lo pidiera.
  const visibles = opciones.filter((s) => s.activa || s.id === valor);
  if (!visibles.length) return null;

  return (
    <select
      value={valor ?? ""}
      aria-label="Subcategoría"
      title="Detalle dentro de la categoría — opcional"
      onChange={(e) => onChange(e.target.value || null)}
      className={clases(css.selector, compacto && css.compacto, !valor && css.sinDetalle)}
    >
      <option value="">— sin detalle —</option>
      {visibles.map((s) => (
        <option key={s.id} value={s.id}>
          {s.nombre}
        </option>
      ))}
    </select>
  );
}
