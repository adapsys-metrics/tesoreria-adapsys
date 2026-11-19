import { describe, expect, it } from "vitest";
import { VISTAS, primeraVistaDe, puedeVerRuta, vistaDeRuta, vistasDe } from "./vistas";

describe("vistasDe", () => {
  it("null es TODAS, no ninguna", () => {
    // Es como quedaron las filas que ya existían cuando se agregó la columna:
    // leerlo como "ninguna" le habría quitado la app a las tres personas que la
    // usan, y el síntoma sería un menú vacío sin explicación.
    expect(vistasDe(null)).toHaveLength(VISTAS.length);
  });

  it("una lista deja solo esas, en el orden del menú", () => {
    // El orden sale de VISTAS y no de cómo se marcaron las casillas: si no, dos
    // perfiles con las mismas pestañas las verían en distinto orden.
    expect(vistasDe(["presupuesto", "flujo"]).map((v) => v.clave)).toEqual([
      "flujo",
      "presupuesto",
    ]);
  });

  it("una clave que no existe no abre nada", () => {
    // La base no valida los valores —la lista vive acá, no en una migración— así
    // que lo que la protege es que sobrar no concede.
    expect(vistasDe(["flujo", "contabilidad"]).map((v) => v.clave)).toEqual(["flujo"]);
  });

  it("sin ninguna marcada no hay pestañas", () => {
    expect(vistasDe([])).toEqual([]);
  });
});

describe("vistaDeRuta", () => {
  it("reconoce la ruta de una vista", () => {
    expect(vistaDeRuta("/flujo")?.clave).toBe("flujo");
  });

  it("y sus subrutas: /movimientos/algo sigue siendo Movimientos", () => {
    expect(vistaDeRuta("/movimientos/123")?.clave).toBe("movimientos");
  });

  it("una ruta que no es de ninguna vista no es de ninguna", () => {
    expect(vistaDeRuta("/")).toBeNull();
    expect(vistaDeRuta("/login")).toBeNull();
  });

  it("no confunde un prefijo con una ruta", () => {
    // "/flujoxyz" empieza igual que "/flujo" y no es esa vista.
    expect(vistaDeRuta("/flujoxyz")).toBeNull();
  });
});

describe("puedeVerRuta", () => {
  it("deja pasar lo que el perfil tiene", () => {
    expect(puedeVerRuta(["flujo"], "/flujo")).toBe(true);
  });

  it("y corta lo que no", () => {
    // Esto es lo que de verdad protege: esconder la pestaña del menú no sirve
    // de nada porque la URL se escribe a mano.
    expect(puedeVerRuta(["flujo"], "/movimientos")).toBe(false);
    expect(puedeVerRuta(["flujo"], "/maestros")).toBe(false);
  });

  it("con null pasa todo", () => {
    expect(puedeVerRuta(null, "/maestros")).toBe(true);
  });

  it("una ruta que no es de ninguna vista no se corta", () => {
    // El login y la pantalla de no autorizado no son pestañas: cortarlas dejaría
    // a alguien sin poder ni siquiera salir.
    expect(puedeVerRuta([], "/login")).toBe(true);
  });
});

describe("primeraVistaDe", () => {
  it("es a dónde mandar a quien pide una pestaña que no tiene", () => {
    expect(primeraVistaDe(["presupuesto", "flujo"])).toBe("/flujo");
  });

  it("salta las que todavía no tienen pantalla", () => {
    // Reportes está en la lista para que se vea que falta, pero no se puede
    // abrir: mandar ahí a alguien sería mandarlo a ninguna parte.
    expect(primeraVistaDe(["reportes"])).toBeNull();
  });

  it("sin ninguna no hay a dónde ir, y eso se nota arriba", () => {
    // El middleware lo rechaza en vez de dejarlo en una app sin pestañas, que
    // se vería como una app rota en vez de como un perfil mal armado.
    expect(primeraVistaDe([])).toBeNull();
  });
});
