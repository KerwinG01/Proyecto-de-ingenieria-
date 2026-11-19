/**
 * Generador pseudoaleatorio mulberry32.
 * La misma semilla produce la misma secuencia, útil para repetir simulaciones.
 * Devuelve números decimales en el intervalo [0, 1).
 */
export function crearMulberry32(semilla) {
  let estado = Number(semilla) >>> 0;

  return function siguienteAleatorio() {
    estado = (estado + 0x6D2B79F5) >>> 0;
    let valor = estado;
    valor = Math.imul(valor ^ (valor >>> 15), valor | 1);
    valor ^= valor + Math.imul(valor ^ (valor >>> 7), valor | 61);
    return ((valor ^ (valor >>> 14)) >>> 0) / 4294967296;
  };
}
