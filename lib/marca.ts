// Cómo se llama la app.
//
// En un solo lugar porque aparece en la barra superior, en el login y en el título
// de cada pestaña: repartido, el día que cambie quedaría a medias en alguna de las
// tres y nadie lo notaría hasta verlo en una captura.
//
// El repositorio, la carpeta y las tablas siguen diciendo `tesoreria`. Eso es a
// propósito: el nombre de pantalla cambia porque lo decide el negocio, y renombrar
// el proyecto y la base para seguirlo costaría migraciones y links rotos sin que
// nadie vea una diferencia.

/** El nombre de la app, tal como se escribe. */
export const NOMBRE_APP = "ADARA Finance";

/** Para el título de una pestaña: "Movimientos · ADARA Finance". */
export const titulo = (vista?: string): string =>
  vista ? `${vista} · ${NOMBRE_APP}` : NOMBRE_APP;
