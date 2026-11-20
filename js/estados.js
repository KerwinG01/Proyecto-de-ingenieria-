/**
 * Máquina de estados de las solicitudes de Ciudad Verde.
 * Las transiciones se limitan a las declaradas para B6.
 * Este módulo no modifica objetos recibidos ni accede al DOM o al reloj.
 */

const TRANSICIONES_PERMITIDAS = Object.freeze({
  REGISTRADA: Object.freeze(["VALIDADA"]),
  VALIDADA: Object.freeze(["ASIGNADA", "EN_ESPERA", "SIN_DISPONIBILIDAD", "CANCELADA"]),
  ASIGNADA: Object.freeze(["CONFIRMADA", "ASIGNADA", "SIN_DISPONIBILIDAD", "CANCELADA"]),
  SIN_DISPONIBILIDAD: Object.freeze(["ASIGNADA", "REPROGRAMADA"]),
  EN_ESPERA: Object.freeze(["REPROGRAMADA"]),
  CONFIRMADA: Object.freeze(["ATENDIDA", "FALLIDA", "CANCELADA", "REPROGRAMADA"]),
});

const ESTADOS_CONOCIDOS = new Set([
  "REGISTRADA",
  "VALIDADA",
  "ASIGNADA",
  "EN_ESPERA",
  "SIN_DISPONIBILIDAD",
  "CONFIRMADA",
  "ATENDIDA",
  "FALLIDA",
  "CANCELADA",
  "REPROGRAMADA",
]);

/** Devuelve una copia de la tabla para que la interfaz pueda mostrarla. */
export function obtenerTransicionesPermitidas() {
  return Object.fromEntries(
    Object.entries(TRANSICIONES_PERMITIDAS).map(([estado, siguientes]) => [estado, [...siguientes]])
  );
}

/** Indica si una transición está declarada en la máquina B6. */
export function esTransicionPermitida(estadoAnterior, estadoNuevo) {
  return TRANSICIONES_PERMITIDAS[estadoAnterior]?.includes(estadoNuevo) ?? false;
}

/**
 * Cambia el estado de una solicitud de forma inmutable y genera el evento.
 * La fecha debe ser proporcionada por la capa que invoca esta función.
 */
export function transicionarEstado({ solicitud, estadoNuevo, responsable, fecha, recicladorId = null }) {
  if (!solicitud || typeof solicitud !== "object") {
    return {
      ok: false,
      codigo: "SOLICITUD_INVALIDA",
      mensaje: "Se requiere una solicitud válida para cambiar su estado.",
    };
  }

  if (!solicitud.id) {
    return {
      ok: false,
      codigo: "ID_REQUERIDO",
      mensaje: "La solicitud debe tener un identificador.",
    };
  }

  if (!ESTADOS_CONOCIDOS.has(solicitud.estado)) {
    return {
      ok: false,
      codigo: "ESTADO_ACTUAL_DESCONOCIDO",
      mensaje: `El estado actual «${solicitud.estado ?? ""}» no pertenece a la máquina de estados.`,
    };
  }

  if (!ESTADOS_CONOCIDOS.has(estadoNuevo)) {
    return {
      ok: false,
      codigo: "ESTADO_NUEVO_DESCONOCIDO",
      mensaje: `El estado solicitado «${estadoNuevo ?? ""}» no pertenece a la máquina de estados.`,
    };
  }

  if (!esTransicionPermitida(solicitud.estado, estadoNuevo)) {
    return {
      ok: false,
      codigo: "TRANSICION_NO_PERMITIDA",
      mensaje: `No se permite pasar de ${solicitud.estado} a ${estadoNuevo}.`,
      estadoAnterior: solicitud.estado,
      estadoNuevo,
    };
  }

  if (typeof responsable !== "string" || responsable.trim() === "") {
    return {
      ok: false,
      codigo: "RESPONSABLE_REQUERIDO",
      mensaje: "Indica quién es responsable del cambio de estado.",
    };
  }

  if (typeof fecha !== "string" || fecha.trim() === "" || Number.isNaN(Date.parse(fecha))) {
    return {
      ok: false,
      codigo: "FECHA_INVALIDA",
      mensaje: "Indica una fecha y hora válida para registrar el evento.",
    };
  }

  const evento = {
    solicitudId: solicitud.id,
    estadoAnterior: solicitud.estado,
    estadoNuevo,
    responsable: responsable.trim(),
    fecha,
    ...(estadoNuevo === "ASIGNADA" ? { recicladorId: recicladorId || solicitud.recicladorId || null } : {}),
  };

  return {
    ok: true,
    codigo: "TRANSICION_REGISTRADA",
    solicitudActualizada: { ...solicitud, estado: estadoNuevo },
    evento,
  };
}

export { ESTADOS_CONOCIDOS, TRANSICIONES_PERMITIDAS };
