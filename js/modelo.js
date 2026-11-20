/**
 * Estructuras de datos de Ciudad Verde.
 * Este módulo solo construye datos: no accede al DOM ni a localStorage.
 */

/** Crea un hogar con los campos definidos para el modelo B9. */
export function crearHogar({
  id,
  microzona,
  alias,
  referenciaEntrega,
  consentimiento = false,
}) {
  return { id, microzona, alias, referenciaEntrega, consentimiento };
}

/** Crea un reciclador y copia sus colecciones para evitar referencias compartidas. */
export function crearReciclador({
  id,
  nombre = "",
  microzona,
  materiales = [],
  franja = {},
  cupo,
  activo = true,
  asignacionesHistoricas = 0,
  tasaConfiabilidad = 0.70,
}) {
  return {
    id,
    nombre,
    microzona,
    materiales: [...materiales],
    franja: { ...franja },
    cupo,
    activo,
    asignacionesHistoricas,
    tasaConfiabilidad,
  };
}

/** Crea una solicitud con listas propias y sin intentos previos por defecto. */
export function crearSolicitud({
  id,
  hogarId,
  materiales = [],
  bolsas,
  franja = {},
  estado = "REGISTRADA",
  registradaPor = "ciudadano",
  recicladorId = null,
  intentos = [],
  bolsasReales = null,
  motivoFalla = "",
}) {
  return {
    id,
    hogarId,
    materiales: [...materiales],
    bolsas,
    franja: { ...franja },
    estado,
    registradaPor,
    recicladorId,
    intentos: intentos.map((intento) => ({ ...intento })),
    bolsasReales,
    motivoFalla,
  };
}

/** Crea un intento de oferta a un reciclador. */
export function crearIntento({
  solicitudId,
  recicladorId,
  numero,
  resultado = null,
  fecha = null,
  motivo = "",
}) {
  return { solicitudId, recicladorId, numero, resultado, fecha, motivo };
}

/** Crea un evento de auditoría de cambio de estado. */
export function crearEvento({
  solicitudId,
  estadoAnterior = null,
  estadoNuevo,
  responsable,
  fecha,
  recicladorId = null,
}) {
  return { solicitudId, estadoAnterior, estadoNuevo, responsable, fecha, ...(recicladorId ? { recicladorId } : {}) };
}

/** Crea un mensaje que se mostrará en la bandeja simulada. */
export function crearMensaje({ destinatario, texto, fecha }) {
  return { destinatario, texto, fecha };
}

/**
 * Crea el contenedor de datos persistible como JSON.
 * Los parámetros se reciben desde el módulo de configuración de la etapa E4.
 */
export function crearEstadoInicial(parametros = {}) {
  return {
    versionModelo: 1,
    hogares: [],
    recicladores: [],
    solicitudes: [],
    eventos: [],
    mensajes: [],
    parametros: { ...parametros },
  };
}
