// El registro de control no entra a ninguna parte.
//
// La cuenta corriente Perú-Chile lleva lo que el otro país genera a cuenta nuestra.
// Cada semestre se netea y el que debe transfiere, y esa transferencia ya está
// anotada como movimiento de la cuenta dólar. Si el registro entrara al flujo o al
// presupuesto, cada peso quedaría contado dos veces.
//
// Es una regla que no se ve: nada en la pantalla delata que un registro está de más
// en el flujo, porque el flujo igual suma. Por eso se prueba.

import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import { montar, montarEn, prepararEntorno } from "@/components/pruebas/entorno";
import { Cuentas } from "@/components/chrome/Cuentas";
import { Registro } from "@/components/movimientos/Registro";
import { useTesoreria } from "@/components/estado/ProveedorTesoreria";
import { CUENTAS } from "@/lib/catalogo";
import { MOVIMIENTOS_EJEMPLO } from "@/lib/datos-ejemplo";
import {
  claveDeCuenta,
  esDeControl,
  esRegistroConSaldo,
  perteneceAlRegistro,
} from "@/lib/registros";
import { estadoInicialDe } from "@/lib/dominio";

const CONTROL = CUENTAS.find((c) => c.tipo === "control")!;
const DEL_CONTROL = MOVIMIENTOS_EJEMPLO.filter((m) => m.cuenta_id === CONTROL.id);

// `glosa` y `contraparte` son nulables en el modelo, pero no en estos ejemplos:
// se estrechan acá para poder buscarlos por texto sin repetir el chequeo.
const texto = (xs: (string | null)[]): string[] =>
  xs.filter((x): x is string => x !== null && x !== "");

const GLOSAS = texto(DEL_CONTROL.map((m) => m.glosa));

prepararEntorno();

/** Lee la lista del contexto tal como la ven las vistas. Mirar el punto de corte
 *  directamente y no a través de una pantalla: la regla es que estos movimientos
 *  no están en la lista, y una vista puede no mostrarlos por otro motivo. */
function Espia() {
  const { movimientos, movimientosFiltrados } = useTesoreria();
  return (
    <>
      <div data-prueba="del-negocio">{movimientos.map((m) => m.id).join(" ")}</div>
      <div data-prueba="del-registro">
        {movimientosFiltrados.map((m) => m.id).join(" ")}
      </div>
    </>
  );
}

const ids = (cual: string): string[] =>
  (document.querySelector(`[data-prueba="${cual}"]`)?.textContent ?? "")
    .split(" ")
    .filter(Boolean);

const ESPERADOS = MOVIMIENTOS_EJEMPLO.filter((m) => m.cuenta_id !== CONTROL.id).map(
  (m) => m.id
);

describe("La cuenta de control existe en el catálogo", () => {
  it("es de CLA ADAPTACIÓN, en dólares, y no tiene número de banco", () => {
    expect(CONTROL.id).toBe("p1");
    expect(CONTROL.empresa_id).toBe("adap");
    expect(CONTROL.moneda).toBe("USD");
    // No existe en ningún banco: no puede pagar una nómina (§10).
    expect(CONTROL.numero).toBeNull();
  });

  it("tiene movimientos de ejemplo, o la regla no se estaría probando", () => {
    expect(DEL_CONTROL.length).toBeGreaterThan(0);
    // Si quedaran sin glosa, los tests de abajo buscarían la lista vacía y
    // pasarían sin comprobar nada.
    expect(GLOSAS.length).toBe(DEL_CONTROL.length);
  });
});

describe("esDeControl", () => {
  it("reconoce los movimientos del registro", () => {
    for (const m of DEL_CONTROL) expect(esDeControl(m, CUENTAS)).toBe(true);
  });

  it("no toca los de las cuentas del banco ni los de cartera", () => {
    const otros = MOVIMIENTOS_EJEMPLO.filter((m) => m.cuenta_id !== CONTROL.id);
    for (const m of otros) expect(esDeControl(m, CUENTAS)).toBe(false);
  });

  it("un proyectado sin cuenta no es de control", () => {
    // Las provisiones que todavía no saben por dónde se pagan tienen cuenta nula
    // (§4.1): si `esDeControl` las marcara, desaparecerían de todas las vistas.
    const sinCuenta = { ...DEL_CONTROL[0]!, cuenta_id: null };
    expect(esDeControl(sinCuenta, CUENTAS)).toBe(false);
  });
});

describe("Sin registro abierto, el control no aparece", () => {
  it("no está en la lista de movimientos", () => {
    montar(<Registro />);
    for (const glosa of GLOSAS) expect(screen.queryByText(glosa)).toBeNull();
  });

  it("ni en la lista que alimenta al presupuesto y al contador de vencidos", () => {
    // Acá está la regla de verdad. No se prueba en cada vista porque en varias no
    // se vería: el flujo va en CLP y estos son dólares, así que un registro de
    // más no aparecería igual. Se prueba donde vive, que es la lista del contexto
    // de la que salen el presupuesto, los vencidos y los que vengan después.
    montar(<Espia />);
    expect(ids("del-negocio")).toEqual(ESPERADOS);
  });
});

describe("Abriendo su registro, sí", () => {
  it("muestra sus movimientos", () => {
    montarEn(claveDeCuenta(CONTROL.id), <Registro />);
    for (const glosa of GLOSAS) {
      expect(screen.getAllByText(glosa).length).toBeGreaterThan(0);
    }
  });

  it("y solo los suyos", () => {
    montarEn(claveDeCuenta(CONTROL.id), <Registro />);
    const ajenas = texto(
      MOVIMIENTOS_EJEMPLO.filter((m) => m.cuenta_id !== CONTROL.id).map((m) => m.glosa)
    ).filter((g) => !GLOSAS.includes(g));
    expect(ajenas.length).toBeGreaterThan(0);
    expect(screen.queryByText(ajenas[0]!)).toBeNull();
  });

  it("sus movimientos sí llegan a la lista del registro", () => {
    montarEn(claveDeCuenta(CONTROL.id), <Espia />);
    expect(ids("del-registro")).toEqual(DEL_CONTROL.map((m) => m.id));
  });

  it("muestra todo lo suyo, proyectado incluido: no hay cartola que cuadrar", () => {
    const proyectado = { ...DEL_CONTROL[0]!, estado: "proyectado" as const };
    expect(perteneceAlRegistro(proyectado, claveDeCuenta(CONTROL.id), CUENTAS)).toBe(true);
  });
});

describe("El registro lleva su saldo corriente", () => {
  it("muestra la columna Saldo, que es para lo que existe el registro", () => {
    // Sale de `movimientosFiltrados` y no de `movimientos`: esa lista deja fuera
    // los registros de control, y con ella el saldo daría cero por más
    // movimientos que tuviera.
    montarEn(claveDeCuenta(CONTROL.id), <Registro />);
    expect(screen.getByText("Saldo")).toBeDefined();
  });

  it("no arranca con 'solo pendiente', que dejaría la tabla vacía", () => {
    // Todo lo del registro ya ocurrió, así que el filtro de pendientes no deja
    // nada y parecería que la cuenta no tiene movimientos.
    montarEn(claveDeCuenta(CONTROL.id), <Registro />);
    expect(screen.getAllByText(GLOSAS[0]!).length).toBeGreaterThan(0);
  });

  it("la cartera en cambio no lleva saldo: ahí nada ha pasado todavía", () => {
    expect(esRegistroConSaldo(claveDeCuenta("x1"), CUENTAS)).toBe(false);
    expect(esRegistroConSaldo(claveDeCuenta(CONTROL.id), CUENTAS)).toBe(true);
    expect(esRegistroConSaldo(claveDeCuenta("a1"), CUENTAS)).toBe(true);
  });
});

describe("La barra lateral lo separa de todo lo demás", () => {
  it("tiene su propio bloque y dice que no entra a nada", () => {
    montar(<Cuentas />);
    const rotulo = screen.getByText("Registros de control");
    expect(rotulo).toBeDefined();
    // La explicación pasó al title del rótulo: en la barra ocupaba tres líneas y
    // se lee una vez en la vida. Sigue estando, y accesible por su etiqueta.
    expect(
      screen.getByLabelText(/No entran al flujo, al presupuesto ni a ningún saldo/)
    ).toBeDefined();
  });

  it("no lo cuenta como cuenta del banco ni como proyección", () => {
    montar(<Cuentas />);
    // El nombre completo va en el title del botón; en pantalla se abrevia.
    const boton = screen.getByTitle(new RegExp(`Ver ${CONTROL.nombre}`));
    const bloque = boton.closest("div")!;
    expect(within(bloque).queryByText("Cuentas del banco")).toBeNull();
    expect(within(bloque).queryByText("Proyecciones")).toBeNull();
  });
});

describe("Un movimiento nuevo en el registro ya ocurrió", () => {
  const HOY = "2026-10-02";

  it("con fecha pasada nace conciliado, como en el banco", () => {
    // Es lo que lo hace sumar al saldo del registro. Si naciera proyectado, el
    // saldo quedaría en cero por más movimientos que tuviera.
    expect(estadoInicialDe(CONTROL, "2026-09-01", HOY)).toBe("conciliado");
    expect(estadoInicialDe(CONTROL, HOY, HOY)).toBe("conciliado");
  });

  it("con fecha futura sigue siendo un compromiso", () => {
    expect(estadoInicialDe(CONTROL, "2026-11-15", HOY)).toBe("proyectado");
  });
});
