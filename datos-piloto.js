/**
 * Datos base del piloto: recicladores R1–R4 y estado inicial de la demostración.
 * R1–R3 atienden San Eduardo (R2 no recibe vidrio); R4 atiende otra microzona.
 */
import { crearEstadoInicial, crearHogar, crearReciclador } from "./modelo.js";
import { FRANJA_PILOTO } from "./utilidades.js";

export const MATERIALES_PILOTO = Object.freeze(["papel", "plástico", "vidrio", "metal"]);
export const CUPO_PILOTO = 26;

/** Crea los cuatro recicladores de la configuración de prueba. */
export function crearRecicladoresPiloto() {
  const reciclador = (id, microzona, materiales) => crearReciclador({
    id,
    nombre: `Reciclador ${id}`,
    microzona,
    materiales,
    franja: { ...FRANJA_PILOTO },
    cupo: CUPO_PILOTO,
  });
  return [
    reciclador("R1", "San Eduardo", MATERIALES_PILOTO),
    reciclador("R2", "San Eduardo", ["papel", "plástico", "metal"]),
    reciclador("R3", "San Eduardo", MATERIALES_PILOTO),
    reciclador("R4", "Ciudad Jardín", MATERIALES_PILOTO),
  ];
}

/** Estado inicial de la demostración: un hogar en San Eduardo y los recicladores R1–R4. */
export function crearEstadoPiloto(parametros = {}) {
  const estado = crearEstadoInicial(parametros);
  estado.hogares = [
    crearHogar({
      id: "H-001",
      microzona: "San Eduardo",
      alias: "Hogar de demostración",
      referenciaEntrega: "Referencia por confirmar",
      consentimiento: true,
    }),
  ];
  estado.recicladores = crearRecicladoresPiloto();
  estado.distanciasKm = {};
  return estado;
}
