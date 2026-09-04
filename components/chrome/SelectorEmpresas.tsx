"use client";

import { useCallback, useState } from "react";
import { EMPRESAS, GRUPOS_EMPRESA, PRESETS_EMPRESA } from "@/lib/catalogo";
import { useTesoreria } from "@/components/estado/ProveedorTesoreria";
import { BotonMini, Check, clasePopover, clases } from "@/components/ui/primitivas";
import { useCierre } from "@/components/ui/useCierre";
import css from "./chrome.module.css";

export function SelectorEmpresas() {
  const { empresasSeleccionadas: sel, setEmpresasSeleccionadas: setSel } = useTesoreria();
  const [abierto, setAbierto] = useState(false);
  const cerrar = useCallback(() => setAbierto(false), []);
  const ref = useCierre<HTMLDivElement>(cerrar);

  const preset = PRESETS_EMPRESA.find(
    (p) => p.ids.length === sel.length && p.ids.every((i) => sel.includes(i))
  );

  const alternar = (id: string) =>
    setSel(sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]);

  return (
    <div ref={ref} className={css.selectorEnvoltorio}>
      <button
        type="button"
        onClick={() => setAbierto(!abierto)}
        aria-expanded={abierto}
        className={css.selectorBoton}
      >
        {(preset ? preset.nombre : `${sel.length} empresas`).toUpperCase()}
        <span className={css.selectorFlecha}>▾</span>
      </button>

      {abierto && (
        <div className={clases(clasePopover, css.selectorPopover)}>
          <div className={css.selectorPresets}>
            {PRESETS_EMPRESA.map((p) => (
              <BotonMini key={p.id} onClick={() => setSel(p.ids)}>
                {p.nombre}
              </BotonMini>
            ))}
          </div>
          {GRUPOS_EMPRESA.map((g) => (
            <div key={g.id}>
              <div className={css.selectorGrupo}>{g.nombre}</div>
              {EMPRESAS.filter((e) => e.grupo === g.id).map((e) => (
                <Check
                  key={e.id}
                  on={sel.includes(e.id)}
                  onClick={() => alternar(e.id)}
                >
                  {e.nombre}
                </Check>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
