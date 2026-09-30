// Entorno común de los tests de render (§8).
//
// Vive aparte porque los tests están repartidos en varios archivos, y eso no es
// organización sino necesidad: cuando estaban todos juntos, el proceso se quedaba sin
// memoria y los últimos dos nunca llegaban a correr — con la suite igual reportándose
// en verde, que es la peor forma de fallar.

import { cleanup, render } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { ProveedorTesoreria } from "@/components/estado/ProveedorTesoreria";
import type { ReactNode } from "react";

/** Cada archivo lo llama una vez, arriba del todo. */
export const prepararEntorno = () => {
  vi.mock("next/navigation", () => ({ usePathname: () => "/flujo" }));

  afterEach(() => {
    cleanup();
    // Sin Supabase el proveedor guarda en localStorage: lo que cree un test
    // sobreviviría al siguiente y lo encontraría por nombre.
    window.localStorage.clear();
  });
};

/** Sin registro abierto: los tests comprueban comportamiento, no la vista de entrada.
 *  Los que sí miran la entrada la piden explícitamente. */
export const montar = (ui: ReactNode) =>
  render(<ProveedorTesoreria registroInicial={null}>{ui}</ProveedorTesoreria>);

/** Con un registro abierto en la barra lateral. */
export const montarEn = (registro: string, ui: ReactNode) =>
  render(<ProveedorTesoreria registroInicial={registro}>{ui}</ProveedorTesoreria>);
