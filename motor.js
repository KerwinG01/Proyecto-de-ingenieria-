/**
 * Lógica pura de validación, compatibilidad, puntuación y asignación.
 * No accede al DOM, a localStorage ni al reloj del sistema.
 */

const PARAMETROS_BASE = Object.freeze({
  Ta: 2,
  k: 3,
  pesos: Object.freeze({ P: 0.40, H: 0.30, E: 0.20, R: 0.10 }),
  volumenBolsa: 0.073,
  Qv: 1.5,
  Vmax: 2,
  materialesAceptados: Object.freeze(["papel", "plástico", "vidrio", "metal"]),
  bolsasMin: 1,
  bolsasMax: 4,
  distanciaAdyacenciaKm: 2,
});

const ESTADOS_QUE_OCUPAN_CUPO = new Set(["ASIGNADA", "CONFIRMADA", "ATENDIDA", "FALLIDA"]);
const RESULTADOS_INTENTO = new Set(["aceptado", "rechazado", "vencido"]);

function combinarParametros(parametros = {}) {
  return {
    ...PARAMETROS_BASE,
    ...parametros,
    pesos: { ...PARAMETROS_BASE.pesos, ...(parametros.pesos || {}) },
    materialesAceptados: parametros.materialesAceptados
      ? [...parametros.materialesAceptados]
      : [...PARAMETROS_BASE.materialesAceptados],
  };
}

function normalizar(valor) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("es");
}

function convertirAMinutos(hora) {
  if (typeof hora !== "string" || !/^\d{1,2}:\d{2}$/.test(hora)) return null;
  const [horas, minutos] = hora.split(":").map(Number);
  if (horas > 23 || minutos > 59) return null;
  return horas * 60 + minutos;
}

function compararIds(a, b) {
  const idA = String(a.id);
  const idB = String(b.id);
  if (idA < idB) return -1;
  if (idA > idB) return 1;
  return 0;
}

function obtenerDistanciaKm({ solicitud, hogar, reciclador, distanciasKm = {} }) {
  const claves = [
    `${hogar?.id}|${reciclador.id}`,
    `${solicitud.id}|${reciclador.id}`,
    `${hogar?.microzona}|${reciclador.microzona}`,
  ];
  for (const clave of claves) {
    const valor = distanciasKm[clave];
    if (valor !== null && valor !== undefined && valor !== "" && Number.isFinite(Number(valor))) {
      return Number(valor);
    }
  }
  return null;
}

function solicitudesQueOcupanCupo(solicitudes, recicladorId, solicitudActualId) {
  return solicitudes.filter((item) =>
    item.id !== solicitudActualId &&
    item.recicladorId === recicladorId &&
    ESTADOS_QUE_OCUPAN_CUPO.has(item.estado)
  );
}

/** Calcula el volumen solicitado según el volumen configurado por bolsa. */
export function calcularVolumenSolicitud(solicitud, parametros = {}) {
  const { volumenBolsa } = combinarParametros(parametros);
  return Number(solicitud?.bolsas) * volumenBolsa;
}

/** Devuelve todos los errores de formulario sin modificar la solicitud. */
export function validarSolicitud(solicitud, parametros = {}) {
  const config = combinarParametros(parametros);
  const errores = [];
  const agregarError = (campo, codigo, mensaje) => errores.push({ campo, codigo, mensaje });

  if (!solicitud?.id) agregarError("id", "REQUERIDO", "Falta el identificador de la solicitud.");
  if (!solicitud?.hogarId) agregarError("hogarId", "REQUERIDO", "Selecciona un hogar.");

  if (!Array.isArray(solicitud?.materiales) || solicitud.materiales.length === 0) {
    agregarError("materiales", "REQUERIDO", "Selecciona al menos un material.");
  } else {
    const aceptados = new Set(config.materialesAceptados.map(normalizar));
    const noAceptados = solicitud.materiales.filter((material) => !aceptados.has(normalizar(material)));
    if (noAceptados.length > 0) {
      agregarError("materiales", "MATERIAL_NO_ACEPTADO", `Materiales no aceptados: ${noAceptados.join(", ")}.`);
    }
  }

  if (!Number.isInteger(solicitud?.bolsas) ||
      solicitud.bolsas < config.bolsasMin || solicitud.bolsas > config.bolsasMax) {
    agregarError("bolsas", "CANTIDAD_INVALIDA", `Indica un número entero de ${config.bolsasMin} a ${config.bolsasMax} bolsas.`);
  }

  const franja = solicitud?.franja;
  const inicio = convertirAMinutos(franja?.inicio);
  const fin = convertirAMinutos(franja?.fin);
  if (!franja?.dia || inicio === null || fin === null || inicio >= fin) {
    agregarError("franja", "FRANJA_INVALIDA", "Indica un día y una franja válida, con inicio anterior al fin.");
  }

  return { valida: errores.length === 0, errores };
}

/** Evalúa Z, M, H y K por separado e informa cada motivo de incompatibilidad. */
export function evaluarCompatibilidad({
  solicitud,
  hogar,
  reciclador,
  solicitudes = [],
  parametros = {},
  distanciaKm = null,
}) {
  const config = combinarParametros(parametros);
  const mismaMicrozona = normalizar(hogar?.microzona) === normalizar(reciclador?.microzona);
  const distanciaValida = Number.isFinite(Number(distanciaKm)) && distanciaKm !== null && distanciaKm !== "";
  const distancia = distanciaValida ? Number(distanciaKm) : null;
  const esAdyacente = !mismaMicrozona && distancia !== null && distancia >= 0 &&
    distancia <= config.distanciaAdyacenciaKm;
  const Z = mismaMicrozona || esAdyacente;

  const materialesReciclador = new Set((reciclador?.materiales || []).map(normalizar));
  const M = Array.isArray(solicitud?.materiales) && solicitud.materiales.length > 0 &&
    solicitud.materiales.every((material) => materialesReciclador.has(normalizar(material)));

  const diaSolicitud = normalizar(solicitud?.franja?.dia);
  const diaReciclador = normalizar(reciclador?.franja?.dia);
  const inicioSolicitud = convertirAMinutos(solicitud?.franja?.inicio);
  const finSolicitud = convertirAMinutos(solicitud?.franja?.fin);
  const inicioReciclador = convertirAMinutos(reciclador?.franja?.inicio);
  const finReciclador = convertirAMinutos(reciclador?.franja?.fin);
  const H = diaSolicitud !== "" && diaSolicitud === diaReciclador &&
    inicioSolicitud !== null && finSolicitud !== null &&
    inicioReciclador !== null && finReciclador !== null &&
    Math.max(inicioSolicitud, inicioReciclador) < Math.min(finSolicitud, finReciclador);

  const asignaciones = solicitudesQueOcupanCupo(solicitudes, reciclador?.id, solicitud?.id);
  const cantidadAsignada = asignaciones.length;
  const volumenAsignado = asignaciones.reduce((total, item) => total + calcularVolumenSolicitud(item, config), 0);
  const volumenSolicitud = calcularVolumenSolicitud(solicitud, config);
  const cupoValido = Number.isFinite(Number(reciclador?.cupo)) && Number(reciclador.cupo) > 0;
  const K = cupoValido && cantidadAsignada < Number(reciclador.cupo) &&
    volumenAsignado + volumenSolicitud <= config.Qv * config.Vmax + Number.EPSILON;
  const activo = reciclador?.activo === true;

  const condiciones = { Z, M, H, K, activo };
  const motivos = [];
  if (!Z) motivos.push("Fuera de la microzona y del radio de adyacencia permitido.");
  if (!M) motivos.push("El reciclador no recibe todos los materiales solicitados.");
  if (!H) motivos.push("La franja no se cruza con la disponibilidad del reciclador.");
  if (!K) motivos.push("El cupo o la capacidad de volumen están agotados.");
  if (!activo) motivos.push("El reciclador está inactivo.");

  return {
    compatible: Object.values(condiciones).every(Boolean),
    condiciones,
    motivos,
    distanciaKm: distancia,
    mismaMicrozona,
    esAdyacente,
    cantidadAsignada,
    volumenAsignado,
    volumenSolicitud,
  };
}

/** P = 1 en la misma microzona, 0,5 hasta 2 km y 0 fuera del radio. */
export function calcularPuntaje({
  hogar,
  reciclador,
  cantidadAsignada = 0,
  asignacionesHistoricasMaximas = 0,
  distanciaKm = null,
  parametros = {},
}) {
  const config = combinarParametros(parametros);
  const mismaMicrozona = normalizar(hogar?.microzona) === normalizar(reciclador?.microzona);
  const distanciaValida = Number.isFinite(Number(distanciaKm)) && distanciaKm !== null && distanciaKm !== "";
  const distancia = distanciaValida ? Number(distanciaKm) : null;
  const P = mismaMicrozona ? 1 :
    distancia !== null && distancia >= 0 && distancia <= config.distanciaAdyacenciaKm ? 0.5 : 0;
  const cupo = Number(reciclador?.cupo);
  const H = cupo > 0 ? 1 - cantidadAsignada / cupo : 0;
  const maximoHistorico = Number(asignacionesHistoricasMaximas) || 0;
  const historicas = Number(reciclador?.asignacionesHistoricas) || 0;
  const E = maximoHistorico === 0 ? 1 : 1 - historicas / maximoHistorico;
  const R = Number(reciclador?.tasaConfiabilidad) || 0;
  const S = config.pesos.P * P + config.pesos.H * H + config.pesos.E * E + config.pesos.R * R;
  return { P, H, E, R, S };
}

/** Devuelve candidatos compatibles ordenados por puntaje y después por ID. */
export function rankearCandidatos({
  solicitud,
  hogar,
  recicladores,
  solicitudes = [],
  parametros = {},
  distanciasKm = {},
}) {
  const config = combinarParametros(parametros);
  const maxHistorico = Math.max(0, ...recicladores.map((item) => Number(item.asignacionesHistoricas) || 0));
  const evaluados = recicladores.map((reciclador) => {
    const distanciaKm = obtenerDistanciaKm({ solicitud, hogar, reciclador, distanciasKm });
    const compatibilidad = evaluarCompatibilidad({ solicitud, hogar, reciclador, solicitudes, parametros: config, distanciaKm });
    const puntaje = calcularPuntaje({
      hogar,
      reciclador,
      cantidadAsignada: compatibilidad.cantidadAsignada,
      asignacionesHistoricasMaximas: maxHistorico,
      distanciaKm,
      parametros: config,
    });
    return { reciclador, compatibilidad, puntaje, distanciaKm };
  });

  const compatibles = evaluados
    .filter((item) => item.compatibilidad.compatible)
    .sort((a, b) => b.puntaje.S - a.puntaje.S || compararIds(a.reciclador, b.reciclador));
  return { compatibles, evaluados };
}

function solicitudYaAsignada(solicitud, solicitudes) {
  return (solicitud.recicladorId !== null && solicitud.recicladorId !== undefined) ||
    ESTADOS_QUE_OCUPAN_CUPO.has(solicitud.estado) ||
    solicitudes.some((item) => item.id === solicitud.id &&
      item.recicladorId !== null && item.recicladorId !== undefined &&
      ESTADOS_QUE_OCUPAN_CUPO.has(item.estado));
}

/** Planifica una primera oferta sin mutar datos ni registrar eventos. */
export function asignarSolicitud({
  solicitud,
  hogar,
  recicladores,
  solicitudes = [],
  parametros = {},
  distanciasKm = {},
}) {
  const validacion = validarSolicitud(solicitud, parametros);
  if (!validacion.valida) {
    return {
      ok: false,
      codigo: "SOLICITUD_INVALIDA",
      estado: solicitud?.estado || "REGISTRADA",
      errores: validacion.errores,
      solicitudActualizada: solicitud ? { ...solicitud } : null,
    };
  }
  if (solicitudYaAsignada(solicitud, solicitudes)) {
    return {
      ok: false,
      codigo: "DUPLICADA",
      estado: solicitud.estado,
      alerta: "La solicitud ya tiene una asignación; no se puede asignar de nuevo.",
      solicitudActualizada: { ...solicitud },
    };
  }

  const { compatibles, evaluados } = rankearCandidatos({ solicitud, hogar, recicladores, solicitudes, parametros, distanciasKm });
  if (compatibles.length === 0) {
    const coincideSinCapacidad = evaluados.some(({ compatibilidad }) =>
      compatibilidad.condiciones.Z && compatibilidad.condiciones.M &&
      compatibilidad.condiciones.H && compatibilidad.condiciones.activo
    );
    return {
      ok: false,
      codigo: coincideSinCapacidad ? "CAPACIDAD_AGOTADA" : "SIN_CANDIDATOS",
      estado: "SIN_DISPONIBILIDAD",
      escalado: true,
      solicitudActualizada: { ...solicitud, estado: "SIN_DISPONIBILIDAD", recicladorId: null },
      evaluaciones: evaluados.map((item) => ({
        recicladorId: item.reciclador.id,
        condiciones: item.compatibilidad.condiciones,
        motivos: item.compatibilidad.motivos,
      })),
    };
  }

  const candidato = compatibles[0];
  return {
    ok: true,
    codigo: "OFERTA_PLANIFICADA",
    estado: "ASIGNADA",
    candidato: candidato.reciclador,
    puntaje: candidato.puntaje,
    candidatos: compatibles,
    solicitudActualizada: {
      ...solicitud,
      estado: "ASIGNADA",
      recicladorId: candidato.reciclador.id,
      intentos: (solicitud.intentos || []).map((intento) => ({ ...intento })),
    },
  };
}

/** Procesa la cascada con respuestas explícitas por reciclador. */
export function resolverCascada({
  solicitud,
  hogar,
  recicladores,
  solicitudes = [],
  parametros = {},
  distanciasKm = {},
  respuestasPorReciclador = {},
  fecha = null,
}) {
  const config = combinarParametros(parametros);
  const ranking = rankearCandidatos({ solicitud, hogar, recicladores, solicitudes, parametros: config, distanciasKm });
  const intentos = (solicitud.intentos || []).map((intento) => ({ ...intento }));
  const yaIntentados = new Set(intentos.map((intento) => intento.recicladorId));
  const candidatos = ranking.compatibles.filter(({ reciclador }) => !yaIntentados.has(reciclador.id));
  const intentosDisponibles = Math.max(0, Number(config.k) - intentos.length);
  const limite = Math.min(candidatos.length, intentosDisponibles);

  for (let indice = 0; indice < limite; indice += 1) {
    const reciclador = candidatos[indice].reciclador;
    const respuesta = respuestasPorReciclador[reciclador.id];
    const solicitudOfertada = {
      ...solicitud,
      estado: "ASIGNADA",
      recicladorId: reciclador.id,
      intentos: intentos.map((intento) => ({ ...intento })),
    };

    if (respuesta === undefined || respuesta === null) {
      return {
        ok: true,
        codigo: "OFERTA_PENDIENTE",
        estado: "ASIGNADA",
        pendiente: true,
        escalado: false,
        recicladorId: reciclador.id,
        intentos,
        solicitudActualizada: solicitudOfertada,
      };
    }
    if (!RESULTADOS_INTENTO.has(respuesta)) {
      return {
        ok: false,
        codigo: "RESPUESTA_INVALIDA",
        mensaje: "La respuesta debe ser aceptado, rechazado o vencido.",
        solicitudActualizada: { ...solicitud },
      };
    }

    intentos.push({
      solicitudId: solicitud.id,
      recicladorId: reciclador.id,
      numero: intentos.length + 1,
      resultado: respuesta,
      fecha,
    });

    if (respuesta === "aceptado") {
      return {
        ok: true,
        codigo: "CONFIRMADA",
        estado: "CONFIRMADA",
        pendiente: false,
        escalado: false,
        recicladorId: reciclador.id,
        intentos,
        solicitudActualizada: { ...solicitud, estado: "CONFIRMADA", recicladorId: reciclador.id, intentos },
      };
    }
  }

  const agotada = intentos.length >= Number(config.k) || candidatos.length === 0 || limite === candidatos.length;
  if (agotada) {
    return {
      ok: false,
      codigo: "SIN_DISPONIBILIDAD",
      estado: "SIN_DISPONIBILIDAD",
      pendiente: false,
      escalado: true,
      intentos,
      solicitudActualizada: { ...solicitud, estado: "SIN_DISPONIBILIDAD", recicladorId: null, intentos },
    };
  }

  const siguiente = candidatos[limite].reciclador;
  return {
    ok: true,
    codigo: "OFERTA_PENDIENTE",
    estado: "ASIGNADA",
    pendiente: true,
    escalado: false,
    recicladorId: siguiente.id,
    intentos,
    solicitudActualizada: { ...solicitud, estado: "ASIGNADA", recicladorId: siguiente.id, intentos },
  };
}

/** Asigna solicitudes por orden y deja EN_ESPERA el excedente por capacidad. */
export function asignarLote({
  solicitudes: lote,
  hogares,
  recicladores,
  solicitudesExistentes = [],
  parametros = {},
  distanciasKm = {},
}) {
  const asignadas = [];
  const enEspera = [];
  const sinDisponibilidad = [];
  const invalidas = [];
  const base = [...solicitudesExistentes];
  const hogaresPorId = new Map(hogares.map((hogar) => [hogar.id, hogar]));

  for (const solicitud of lote) {
    const hogar = hogaresPorId.get(solicitud.hogarId);
    const resultado = asignarSolicitud({ solicitud, hogar, recicladores, solicitudes: base, parametros, distanciasKm });

    if (resultado.codigo === "SOLICITUD_INVALIDA" || resultado.codigo === "DUPLICADA") {
      invalidas.push({ solicitud: resultado.solicitudActualizada, resultado });
      continue;
    }
    if (resultado.ok) {
      asignadas.push(resultado.solicitudActualizada);
      base.push(resultado.solicitudActualizada);
      continue;
    }
    if (resultado.codigo === "CAPACIDAD_AGOTADA") {
      const solicitudEnEspera = { ...solicitud, estado: "EN_ESPERA", recicladorId: null };
      enEspera.push(solicitudEnEspera);
      base.push(solicitudEnEspera);
    } else {
      sinDisponibilidad.push(resultado.solicitudActualizada);
      base.push(resultado.solicitudActualizada);
    }
  }

  return { asignadas, enEspera, sinDisponibilidad, invalidas, solicitudesFinales: base };
}

export { PARAMETROS_BASE };
