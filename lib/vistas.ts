// Las pestañas de la app, en un solo lugar.
//
// Estaban escritas dentro del encabezado, que era su único lector. Ahora las
// leen tres: el menú, el panel de usuarios —que ofrece estas mismas casillas
// para armar un perfil— y el middleware, que corta la ruta de quien no la tiene.
// Repartida, la lista se desincroniza y el síntoma es feo: una pestaña que se
// puede marcar en el perfil y no existe, o una ruta que el menú esconde y la
// URL igual abre.
//
// Las vistas sin ruta se muestran deshabilitadas en vez de omitirse, para que se
// vea qué falta y no parezca que el sistema son solo las que están.
//
// Conciliación no está y no va a estar: el banco se revisa todos los días y un
// movimiento se marca pagado justamente porque ya está en la cartola, así que el
// estado `pagado` no se usa y esa lista sería siempre vacía (§4.1). Lo que sí se
// mira a diario son los vencidos, y eso vive en el flujo y en la barra lateral.

export type Vista = {
  /** Lo que se guarda en `usuarios_autorizados.vistas`. Estable: cambiarla
   *  dejaría sin esa pestaña a quien la tuviera marcada. */
  clave: string;
  href: string | null;
  texto: string;
  /** Para el panel de usuarios: por qué alguien querría o no esta pestaña. */
  nota: string;
};

export const VISTAS: Vista[] = [
  { clave: "flujo", href: "/flujo", texto: "Flujo de caja", nota: "El reporte que se revisa" },
  {
    clave: "movimientos",
    href: "/movimientos",
    texto: "Movimientos",
    nota: "El registro completo, con el detalle de cada split",
  },
  {
    clave: "presupuesto",
    href: "/presupuesto",
    texto: "Presupuesto anual",
    nota: "Presupuesto contra real, y la proyección del año",
  },
  { clave: "reportes", href: null, texto: "Reportes", nota: "Todavía no está construida" },
  {
    clave: "categorias",
    href: "/categorias",
    texto: "Categorías",
    nota: "Mantención del catálogo",
  },
  {
    clave: "maestros",
    href: "/maestros",
    texto: "Maestros",
    nota: "Empresas, proveedores, usuarios y la descarga de respaldo",
  },
];

/** La vista a la que pertenece una ruta, o null si no es de ninguna. */
export const vistaDeRuta = (ruta: string): Vista | null =>
  VISTAS.find((v) => v.href !== null && (ruta === v.href || ruta.startsWith(`${v.href}/`))) ?? null;

/**
 * Qué ve este perfil. `null` es **todas**, y es como quedan las filas que ya
 * existían: agregar la columna no le quitó una pestaña a nadie.
 *
 * Una clave guardada que no corresponde a ninguna vista simplemente no aparece.
 * No hay forma de que conceda de más, que es la razón de que la base no valide
 * los valores — la lista vive acá y no en una migración.
 */
export const vistasDe = (vistas: string[] | null): Vista[] =>
  vistas === null ? VISTAS : VISTAS.filter((v) => vistas.includes(v.clave));

/** Si la ruta no es de ninguna vista —la raíz, un 404— no hay nada que cortar. */
export const puedeVerRuta = (vistas: string[] | null, ruta: string): boolean => {
  const v = vistaDeRuta(ruta);
  return v === null || vistas === null || vistas.includes(v.clave);
};

/** La primera pestaña que este perfil puede abrir. A dónde mandarlo cuando pide
 *  una que no tiene, y lo que decide si tiene sentido dejarlo entrar. */
export const primeraVistaDe = (vistas: string[] | null): string | null =>
  vistasDe(vistas).find((v) => v.href !== null)?.href ?? null;
