// Lectura de un listado de proveedores pegado desde Excel.
//
// Es el caso que el importador del catálogo no tenía y este sí: los datos ya existen en
// una planilla y son ~20 filas con cinco columnas cada una. Escribirlas a mano es
// tedioso y, peor, es donde se cuela un dígito cambiado en un RUT o en una cuenta.

import { normalizarRut, rutValido } from "@/lib/rut";
import type { Proveedor } from "@/lib/tipos";

/** Lo que se leyó de una fila, más lo que anduvo mal en ella. */
export type FilaPegada = {
  nombre: string;
  rut: string | null;
  cod_banco: string | null;
  cuenta: string | null;
  correo: string | null;
  /** Motivos por los que esta fila no se puede usar tal cual. Vacío es que está bien. */
  problemas: string[];
  /** Ya existe un proveedor con ese nombre: se actualiza en vez de duplicarse. */
  actualiza: boolean;
};

/**
 * Separador de la pegada.
 *
 * Copiar de Excel da tabulaciones; exportar a CSV en Chile suele dar punto y coma,
 * porque la coma es el decimal. Se elige el que parta las filas en la misma cantidad de
 * campos: es más confiable que preguntar, y que asumir uno.
 */
const separadorDe = (lineas: string[]): string => {
  const candidatos = ["\t", ";", ","];
  let mejor = "\t";
  let mejorPuntaje = -1;
  for (const sep of candidatos) {
    const anchos = lineas.map((l) => l.split(sep).length);
    const max = Math.max(...anchos);
    if (max < 2) continue;
    // Premia que todas las filas tengan el mismo ancho, y que ese ancho sea mayor.
    const parejas = anchos.filter((n) => n === max).length / anchos.length;
    const puntaje = parejas * 10 + max;
    if (puntaje > mejorPuntaje) {
      mejorPuntaje = puntaje;
      mejor = sep;
    }
  }
  return mejor;
};

const sinAcentos = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

/** Qué columna es cada una, por el encabezado. Devuelve null si la fila no parece un
 *  encabezado, y entonces se usa el orden posicional. */
const mapearEncabezado = (campos: string[]): Record<string, number> | null => {
  const mapa: Record<string, number> = {};
  campos.forEach((campo, i) => {
    const c = sinAcentos(campo);
    if (!c) return;
    if (/(nombre|proveedor|beneficiario|razon social)/.test(c)) mapa.nombre ??= i;
    else if (/rut/.test(c)) mapa.rut ??= i;
    // "cod_banco", "codigo banco", "banco". Se pregunta por cuenta primero porque
    // "cuenta banco" contiene las dos palabras.
    else if (/cuenta|^cta/.test(c)) mapa.cuenta ??= i;
    else if (/banco|codigo/.test(c)) mapa.cod_banco ??= i;
    else if (/(correo|mail)/.test(c)) mapa.correo ??= i;
  });
  // Con el nombre y una más ya se puede confiar en que era un encabezado.
  return mapa.nombre !== undefined && Object.keys(mapa).length >= 2 ? mapa : null;
};

const POSICIONAL: Record<string, number> = {
  nombre: 0,
  rut: 1,
  cod_banco: 2,
  cuenta: 3,
  correo: 4,
};

/** Deja solo dígitos: las cuentas y los códigos vienen con puntos, guiones o espacios
 *  según de dónde se copien, y el portal los quiere limpios. */
const soloDigitos = (s: string) => s.replace(/\D/g, "");

export function parsearProveedores(
  texto: string,
  existentes: Proveedor[] = []
): FilaPegada[] {
  const lineas = texto.split(/\r?\n/).filter((l) => l.trim());
  if (!lineas.length) return [];

  const sep = separadorDe(lineas);
  const filas = lineas.map((l) => l.split(sep).map((c) => c.trim().replace(/^"|"$/g, "")));

  const mapa = mapearEncabezado(filas[0]!);
  const cuerpo = mapa ? filas.slice(1) : filas;
  const col = mapa ?? POSICIONAL;
  const campo = (f: string[], nombre: string): string =>
    col[nombre] === undefined ? "" : (f[col[nombre]!] ?? "").trim();

  const porNombre = new Map(existentes.map((p) => [sinAcentos(p.nombre), p]));
  const vistos = new Set<string>();

  return cuerpo.map((f): FilaPegada => {
    const nombre = campo(f, "nombre");
    const rutCrudo = campo(f, "rut");
    const rut = rutCrudo ? normalizarRut(rutCrudo) : null;
    const cuenta = soloDigitos(campo(f, "cuenta")) || null;
    const cod_banco = soloDigitos(campo(f, "cod_banco")) || null;
    const correo = campo(f, "correo") || null;

    const problemas: string[] = [];
    if (!nombre) problemas.push("sin nombre");
    if (rut && !rutValido(rut)) problemas.push("RUT inválido");
    if (correo && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) problemas.push("correo inválido");

    const clave = sinAcentos(nombre);
    if (nombre && vistos.has(clave)) problemas.push("repetido en el listado");
    if (nombre) vistos.add(clave);

    return {
      nombre,
      rut,
      cod_banco,
      cuenta,
      correo,
      problemas,
      actualiza: Boolean(nombre) && porNombre.has(clave),
    };
  });
}
