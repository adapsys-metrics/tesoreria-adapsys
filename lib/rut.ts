// RUT chileno: normalización y dígito verificador.
//
// Se valida porque el portal rechaza la nómina completa, no la línea mala: un dígito
// mal tipeado en un proveedor bota la carga de los veinte y hay que descubrir cuál fue.
// El dígito verificador atrapa justamente el error de tipeo, que es el que ocurre.

/** Como lo pide el portal: sin puntos ni guion, con el dígito pegado. `766244890`. */
export const normalizarRut = (rut: string): string =>
  rut.replace(/[^0-9kK]/g, "").toUpperCase();

/**
 * Dígito verificador por módulo 11.
 *
 * Los factores van 2,3,4,5,6,7 y vuelven a 2, recorriendo el número de derecha a
 * izquierda.
 */
export const digitoVerificador = (cuerpo: string): string => {
  let suma = 0;
  let factor = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const resto = 11 - (suma % 11);
  if (resto === 11) return "0";
  if (resto === 10) return "K";
  return String(resto);
};

/** ¿El RUT es válido? Vacío no lo es: un proveedor sin RUT no se puede pagar. */
export const rutValido = (rut: string): boolean => {
  const limpio = normalizarRut(rut);
  // Menos de 7 dígitos más el verificador no es un RUT de empresa ni de persona adulta.
  if (limpio.length < 8 || limpio.length > 9) return false;
  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);
  if (!/^\d+$/.test(cuerpo)) return false;
  return digitoVerificador(cuerpo) === dv;
};

/** Con puntos y guion, para mostrarlo. El archivo va sin formato; esto es para leerlo
 *  en pantalla, donde `766244890` es difícil de comparar contra una factura. */
export const formatearRut = (rut: string): string => {
  const limpio = normalizarRut(rut);
  if (limpio.length < 2) return limpio;
  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);
  return `${cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}-${dv}`;
};
