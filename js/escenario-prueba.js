/**
 * Escenario de prueba para la vista demo de Ciudad Verde.
 * Construye solicitudes en cada estado usando el motor, la máquina de estados
 * y las mismas reglas que las vistas; luego lo guarda donde lo lee index.html.
 * Así, lo que se prueba en tests.html puede verificarse en las pantallas.
 */
import { crearEstadoInicial, crearHogar, crearSolicitud } from "./modelo.js";
import { asignarSolicitud, calcularTasaConfiabilidad, resolverCascada } from "./motor.js";
import { transicionarEstado } from "./estados.js";
import { leerParametros } from "./parametros.js";
import { crearRecicladoresPiloto } from "./datos-piloto.js";
import { FRANJA_PILOTO, fechaSabadoDesde } from "./utilidades.js";
import { guardarEstado } from "./ui/servicios.js";

function crearBase(parametros) {
  const estado = crearEstadoInicial(parametros);
  estado.distanciasKm = {};
  estado.hogares = [
    ...Array.from({ length: 9 }, (_, i) => crearHogar({
      id: `H-00${i + 1}`,
      microzona: "San Eduardo",
      alias: `Hogar ${i + 1} (San Eduardo)`,
      referenciaEntrega: "Referencia de prueba",
      consentimiento: true,
    })),
    crearHogar({ id: "H-CJ", microzona: "Ciudad Jardín", alias: "Hogar Ciudad Jardín", referenciaEntrega: "Referencia de prueba", consentimiento: true }),
    crearHogar({ id: "H-MC", microzona: "Microzona C", alias: "Hogar Microzona C (sin cobertura)", referenciaEntrega: "Referencia de prueba", consentimiento: true }),
  ];
  estado.recicladores = crearRecicladoresPiloto();
  return estado;
}

/** Reloj simulado: cada paso avanza 3 minutos para que K2 tenga duraciones reales. */
function crearReloj(inicio = Date.now()) {
  let marca = inicio;
  return () => {
    marca += 3 * 60 * 1000;
    return new Date(marca).toISOString();
  };
}

/** Detiene el escenario si una transición no está permitida por la máquina de estados. */
function exigir(resultado, contexto) {
  if (!resultado?.ok) throw new Error(`${contexto}: ${resultado?.mensaje || resultado?.codigo || "transición rechazada"}`);
  return resultado;
}

/**
 * Crea el estado completo del escenario. Función pura salvo por la fecha base.
 * Devuelve { estado, casos } para mostrar qué verificar en cada vista.
 */
export function crearEscenarioPrueba({ fechaBase = new Date(), parametros = leerParametros().parametros } = {}) {
  const estado = crearBase(parametros);
  const ahora = crearReloj(fechaBase.getTime());
  const fechaServicio = fechaSabadoDesde(fechaBase);
  const casos = [];

  const hogarDe = (id) => estado.hogares.find((h) => h.id === id);
  const reemplazar = (solicitud) => {
    estado.solicitudes = estado.solicitudes.map((s) => (s.id === solicitud.id ? solicitud : s));
  };
  const mensaje = (destinatario, texto) => estado.mensajes.push({ destinatario, texto, fecha: ahora() });

  /** Igual que la vista ciudadano: REGISTRADA → VALIDADA → plan del motor. */
  function registrar(id, hogarId, { materiales = ["papel"], bolsas = 1, franja = FRANJA_PILOTO } = {}) {
    const hogar = hogarDe(hogarId);
    const nueva = crearSolicitud({
      id, hogarId, materiales, bolsas, franja: { ...franja }, fechaServicio,
      estado: "REGISTRADA", registradaPor: "ciudadano", recicladorId: null, intentos: [],
    });
    const validada = exigir(transicionarEstado({ solicitud: nueva, estadoNuevo: "VALIDADA", responsable: "Sistema", fecha: ahora() }), id);
    const plan = asignarSolicitud({
      solicitud: validada.solicitudActualizada,
      hogar,
      recicladores: estado.recicladores,
      solicitudes: [...estado.solicitudes, validada.solicitudActualizada],
      parametros: estado.parametros,
      distanciasKm: estado.distanciasKm,
    });
    if (plan.codigo === "SOLICITUD_INVALIDA") throw new Error(`${id}: ${plan.errores.map((e) => e.mensaje).join(" ")}`);
    const cierre = exigir(transicionarEstado({
      solicitud: validada.solicitudActualizada,
      estadoNuevo: plan.estado,
      responsable: "Motor de asignación",
      fecha: ahora(),
      recicladorId: plan.ok ? plan.candidato.id : null,
    }), id);
    const final = { ...cierre.solicitudActualizada, ...plan.solicitudActualizada, estado: plan.estado };
    estado.solicitudes.push(final);
    estado.eventos.push(validada.evento, cierre.evento);
    mensaje(hogar.alias, `La solicitud ${id} quedó en estado ${plan.estado}.`);
    if (plan.ok) mensaje(plan.candidato.nombre, `Nueva oferta para la solicitud ${id}.`);
    else mensaje("Facilitador", `La solicitud ${id} requiere gestión: ${plan.evaluaciones?.map((e) => `${e.recicladorId}: ${e.motivos.join(" ")}`).join(" | ") || "sin candidato"}.`);
    return final;
  }

  /** Igual que la vista reciclador: responde la oferta pendiente con la cascada. */
  function responder(id, respuesta, motivo = "") {
    const solicitud = estado.solicitudes.find((s) => s.id === id);
    const recicladorId = solicitud.recicladorId;
    const resultado = resolverCascada({
      solicitud,
      hogar: hogarDe(solicitud.hogarId),
      recicladores: estado.recicladores,
      solicitudes: estado.solicitudes,
      parametros: estado.parametros,
      distanciasKm: estado.distanciasKm,
      recicladorOfertadoId: recicladorId,
      respuestasPorReciclador: { [recicladorId]: respuesta },
      motivosPorReciclador: { [recicladorId]: motivo },
      fecha: ahora(),
    });
    if (!resultado.solicitudActualizada) throw new Error(`${id}: ${resultado.mensaje || resultado.codigo}`);
    const transicion = exigir(transicionarEstado({
      solicitud,
      estadoNuevo: resultado.estado,
      responsable: `Reciclador · ${recicladorId}`,
      fecha: ahora(),
      recicladorId: resultado.estado === "ASIGNADA" ? resultado.recicladorId : null,
    }), id);
    const actualizada = {
      ...transicion.solicitudActualizada,
      ...resultado.solicitudActualizada,
      estado: resultado.estado,
      intentos: resultado.intentos || resultado.solicitudActualizada.intentos || solicitud.intentos,
    };
    reemplazar(actualizada);
    estado.eventos.push(transicion.evento);
    if (resultado.estado === "CONFIRMADA") mensaje(hogarDe(solicitud.hogarId).alias, `El reciclador confirmó la solicitud ${id}.`);
    if (resultado.estado === "ASIGNADA") mensaje(`Reciclador ${resultado.recicladorId}`, `Nueva oferta para la solicitud ${id} (intento ${actualizada.intentos.length + 1}).`);
    if (resultado.estado === "SIN_DISPONIBILIDAD") mensaje("Facilitador", `La solicitud ${id} agotó la cascada y requiere gestión.`);
    return actualizada;
  }

  /** Cambio de estado directo (atendida, fallida o cancelada), como en las vistas. */
  function cerrar(id, estadoNuevo, responsable, extra = {}) {
    const solicitud = estado.solicitudes.find((s) => s.id === id);
    const transicion = exigir(transicionarEstado({ solicitud, estadoNuevo, responsable, fecha: ahora(), recicladorId: solicitud.recicladorId }), id);
    const actualizada = { ...transicion.solicitudActualizada, ...extra };
    reemplazar(actualizada);
    estado.eventos.push(transicion.evento);
    if (["ATENDIDA", "FALLIDA"].includes(estadoNuevo)) {
      estado.recicladores = estado.recicladores.map((r) => r.id === solicitud.recicladorId
        ? { ...r, tasaConfiabilidad: calcularTasaConfiabilidad(r, estado.solicitudes) }
        : r);
    }
    mensaje(hogarDe(solicitud.hogarId).alias, `La solicitud ${id} quedó en estado ${estadoNuevo}.`);
    return actualizada;
  }

  const anotar = (caso, id, esperado, vista) => {
    const real = estado.solicitudes.find((s) => s.id === id);
    casos.push({
      caso, solicitudId: id, esperado, vista,
      obtenido: real ? `${real.estado}${real.recicladorId ? ` · ${real.recicladorId}` : ""}` : "—",
    });
  };

  // CP-01: compatible en San Eduardo → oferta pendiente (R1, R2 o R3; nunca R4).
  registrar("SOL-CP01", "H-001");
  anotar("CP-01", "SOL-CP01", "ASIGNADA a R1, R2 o R3", "Reciclador (aceptar / rechazar)");

  // CP-02: microzona sin recicladores → sin disponibilidad.
  registrar("SOL-CP02", "H-MC");
  anotar("CP-02 (falla Z)", "SOL-CP02", "SIN_DISPONIBILIDAD", "Facilitador → bandeja de escalados");

  // CP-02b: Ciudad Jardín → R4.
  registrar("SOL-CP02B", "H-CJ");
  anotar("CP-02b", "SOL-CP02B", "ASIGNADA a R4", "Reciclador R4");

  // CP-03b: vidrio → R1 o R3, nunca R2.
  registrar("SOL-CP03B", "H-002", { materiales: ["vidrio"] });
  anotar("CP-03b", "SOL-CP03B", "ASIGNADA a R1 o R3", "Reciclador R1 o R3");

  // CP-04: franja de domingo → falla H.
  registrar("SOL-CP04", "H-003", { franja: { dia: "domingo", inicio: "08:00", fin: "12:00" } });
  anotar("CP-04 (falla H)", "SOL-CP04", "SIN_DISPONIBILIDAD", "Facilitador → bandeja de escalados");

  // Confirmada, atendida y fallida: alimentan K2, K3 y la confiabilidad R.
  registrar("SOL-CONF", "H-004", { bolsas: 2 });
  responder("SOL-CONF", "aceptado");
  anotar("Confirmación", "SOL-CONF", "CONFIRMADA", "Reciclador (marcar atendida / fallida)");

  registrar("SOL-ATE", "H-005", { bolsas: 2 });
  responder("SOL-ATE", "aceptado");
  cerrar("SOL-ATE", "ATENDIDA", "Reciclador", { bolsasReales: 2 });
  anotar("Cierre atendida", "SOL-ATE", "ATENDIDA", "Ciudadano (mis solicitudes) · Administrador (indicadores)");

  registrar("SOL-FAL", "H-006");
  responder("SOL-FAL", "aceptado");
  cerrar("SOL-FAL", "FALLIDA", "Reciclador", { motivoFalla: "Nadie atendió en la dirección" });
  anotar("Cierre fallida", "SOL-FAL", "FALLIDA", "Administrador (K3)");

  // Cancelación por el hogar.
  registrar("SOL-CAN", "H-007");
  cerrar("SOL-CAN", "CANCELADA", "Ciudadano");
  anotar("Cancelación", "SOL-CAN", "CANCELADA", "Ciudadano (mis solicitudes) · Administrador (K3)");

  // CAS-01: el primero rechaza → oferta al siguiente de San Eduardo.
  registrar("SOL-CAS01", "H-008");
  responder("SOL-CAS01", "rechazado", "Vehículo lleno");
  anotar("CAS-01", "SOL-CAS01", "ASIGNADA al 2.º candidato (1 intento registrado)", "Reciclador del 2.º candidato");

  // CAS-02b: el plazo vence → oferta al siguiente.
  registrar("SOL-VENC", "H-009");
  responder("SOL-VENC", "vencido");
  anotar("CAS-02b", "SOL-VENC", "ASIGNADA al 2.º candidato (1 intento vencido)", "Reciclador del 2.º candidato");

  // CAS-02a: tres rechazos con k = 3 → sin disponibilidad y escalado.
  registrar("SOL-CAS02", "H-001", { materiales: ["plástico"] });
  responder("SOL-CAS02", "rechazado", "Sin tiempo en la franja");
  responder("SOL-CAS02", "rechazado", "Sin tiempo en la franja");
  responder("SOL-CAS02", "rechazado", "Sin tiempo en la franja");
  anotar("CAS-02a", "SOL-CAS02", "SIN_DISPONIBILIDAD (3 intentos)", "Facilitador → bandeja de escalados");

  return { estado, casos };
}

/** Crea el escenario y lo guarda en el almacenamiento que usa index.html. */
export function cargarEscenarioPrueba(opciones = {}, almacen = null) {
  const { estado, casos } = crearEscenarioPrueba(opciones);
  const guardado = guardarEstado(estado, almacen);
  return { ...guardado, casos, totalSolicitudes: estado.solicitudes.length };
}
