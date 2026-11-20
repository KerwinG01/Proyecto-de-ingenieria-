/**
 * Experimentos del modo de prueba (E7). Cada experimento ejecuta el motor real
 * de Ciudad Verde y devuelve datos numéricos listos para tablas, gráficos y CSV.
 *
 * SIM-01  Cascada de confirmación frente a la ecuación 11: P(≤ i) = 1 − (1 − p)^i.
 * SIM-02  Barrido de la probabilidad de aceptación p con k fijo.
 * ESC-01  Escalabilidad del motor de asignación según el tamaño del lote.
 * REN-01  Tiempo de respuesta de la operación completa de registro.
 */
import { crearHogar, crearReciclador, crearSolicitud } from "./modelo.js";
import { asignarLote, asignarSolicitud, resolverCascada, validarSolicitud } from "./motor.js";
import { transicionarEstado } from "./estados.js";
import { PARAMETROS_POR_DEFECTO } from "./parametros.js";
import { crearMulberry32 } from "./prng.js";
import { FRANJA_PILOTO, ajustePotencia, media, mediana, normalizarTexto } from "./utilidades.js";

const FECHA_EXPERIMENTO = "2026-11-21";
const pausa = () => new Promise((resolver) => setTimeout(resolver, 0));
const relojPorDefecto = () => (globalThis.performance?.now ? globalThis.performance.now() : Date.now());

function recicladoresDePrueba(cantidad, prefijo = "R") {
  const digitos = String(cantidad).length;
  return Array.from({ length: cantidad }, (_, i) => crearReciclador({
    id: `${prefijo}${String(i + 1).padStart(digitos, "0")}`,
    nombre: `Reciclador ${i + 1}`,
    microzona: "San Eduardo",
    materiales: ["papel", "plástico", "vidrio", "metal"],
    franja: { ...FRANJA_PILOTO },
    cupo: 26,
  }));
}

function hogarDePrueba() {
  return crearHogar({ id: "H-EXP", microzona: "San Eduardo", alias: "Hogar experimento", referenciaEntrega: "—", consentimiento: true });
}

function solicitudDePrueba(id, bolsas = 1) {
  return crearSolicitud({
    id,
    hogarId: "H-EXP",
    materiales: ["papel"],
    bolsas,
    franja: { ...FRANJA_PILOTO },
    fechaServicio: FECHA_EXPERIMENTO,
    estado: "VALIDADA",
  });
}

/** Probabilidad teórica de confirmar en a lo sumo i intentos (ecuación 11). */
export function probabilidadTeorica(p, intentos) {
  return 1 - (1 - p) ** intentos;
}

/**
 * SIM-01. Simula N solicitudes independientes; cada reciclador ofertado acepta con
 * probabilidad p. Las ofertas, rechazos y el escalamiento los resuelve el motor.
 */
export function simularCascada({
  p = PARAMETROS_POR_DEFECTO.p,
  k = PARAMETROS_POR_DEFECTO.k,
  N = 1000,
  semilla = 20261121,
  recicladoresCompatibles = 3,
  parametros = PARAMETROS_POR_DEFECTO,
} = {}) {
  const azar = crearMulberry32(semilla);
  const config = { ...parametros, k };
  const recicladores = recicladoresDePrueba(recicladoresCompatibles);
  const hogar = hogarDePrueba();
  const intentosEfectivos = Math.min(k, recicladoresCompatibles);
  const registros = [];

  for (let n = 1; n <= N; n += 1) {
    const plan = asignarSolicitud({ solicitud: solicitudDePrueba(`SIM-${n}`), hogar, recicladores, solicitudes: [], parametros: config });
    let actual = plan.solicitudActualizada;
    let resultado = plan.ok ? null : { estado: "SIN_DISPONIBILIDAD", intentos: [] };
    while (!resultado) {
      const respuesta = azar() < p ? "aceptado" : "rechazado";
      const paso = resolverCascada({
        solicitud: actual,
        hogar,
        recicladores,
        solicitudes: [],
        parametros: config,
        recicladorOfertadoId: actual.recicladorId,
        respuestasPorReciclador: { [actual.recicladorId]: respuesta },
      });
      if (paso.estado === "ASIGNADA") actual = paso.solicitudActualizada;
      else resultado = paso;
    }
    registros.push({
      solicitud: `SIM-${n}`,
      resultado: resultado.estado,
      intentos: resultado.intentos.length,
      intentoConfirmacion: resultado.estado === "CONFIRMADA" ? resultado.intentos.length : null,
      recicladorFinal: resultado.estado === "CONFIRMADA" ? resultado.recicladorId : "",
    });
  }

  const filas = Array.from({ length: intentosEfectivos }, (_, indice) => {
    const intento = indice + 1;
    const confirmadas = registros.filter((r) => r.intentoConfirmacion !== null && r.intentoConfirmacion <= intento).length;
    const observada = confirmadas / N;
    const teorica = probabilidadTeorica(p, intento);
    const errorEstandar = Math.sqrt((teorica * (1 - teorica)) / N);
    const desvio = observada - teorica;
    return {
      intento,
      confirmadasAcumuladas: confirmadas,
      observada,
      teorica,
      errorEstandar,
      limiteInferior: Math.max(0, teorica - 2 * errorEstandar),
      limiteSuperior: Math.min(1, teorica + 2 * errorEstandar),
      desvioPuntos: desvio * 100,
      desvioRelativo: teorica ? (desvio / teorica) * 100 : null,
      dentroDeDosEE: Math.abs(desvio) <= 2 * errorEstandar + 1e-12,
    };
  });
  const escaladas = registros.filter((r) => r.resultado === "SIN_DISPONIBILIDAD").length;
  return {
    experimento: "SIM-01",
    parametros: { p, k, N, semilla, recicladoresCompatibles, intentosEfectivos },
    filas,
    escalamiento: { observado: escaladas / N, teorico: (1 - p) ** intentosEfectivos, casos: escaladas },
    registros,
  };
}

/** SIM-02. Repite SIM-01 para varios p y compara P(≤ k) observada con la teórica. */
export function barrerProbabilidad({ valoresP = [0.5, 0.6, 0.7, 0.8, 0.9], k = 3, N = 1000, semilla = 20261121, recicladoresCompatibles = 3, parametros } = {}) {
  const filas = valoresP.map((p, indice) => {
    const corrida = simularCascada({ p, k, N, semilla: semilla + indice, recicladoresCompatibles, parametros });
    const final = corrida.filas[corrida.filas.length - 1];
    return { p, semilla: semilla + indice, intentos: final.intento, teorica: final.teorica, observada: final.observada, errorEstandar: final.errorEstandar, desvioPuntos: final.desvioPuntos, dentroDeDosEE: final.dentroDeDosEE };
  });
  return { experimento: "SIM-02", parametros: { valoresP, k, N, semilla, recicladoresCompatibles }, filas };
}

/** Revisa que un lote asignado respete cupo, volumen, microzona, materiales y unicidad (K6). */
export function auditarLote(resultado, recicladores, parametros = PARAMETROS_POR_DEFECTO) {
  const porId = new Map(recicladores.map((r) => [r.id, r]));
  const vistos = new Set();
  const carga = new Map();
  let duplicadas = 0;
  let incompatibles = 0;
  for (const s of resultado.asignadas) {
    if (vistos.has(s.id)) duplicadas += 1;
    vistos.add(s.id);
    const r = porId.get(s.recicladorId);
    const clave = `${s.recicladorId}|${s.fechaServicio}`;
    const actual = carga.get(clave) || { cantidad: 0, volumen: 0 };
    actual.cantidad += 1;
    actual.volumen += s.bolsas * parametros.volumenBolsa;
    carga.set(clave, actual);
    const materiales = new Set((r?.materiales || []).map(normalizarTexto));
    if (!r || !s.materiales.every((m) => materiales.has(normalizarTexto(m)))) incompatibles += 1;
  }
  let excesos = 0;
  for (const [clave, { cantidad, volumen }] of carga) {
    const r = porId.get(clave.split("|")[0]);
    if (!r || cantidad > r.cupo || volumen > parametros.Qv * parametros.Vmax + 1e-9) excesos += 1;
  }
  return { duplicadas, incompatibles, excesos, integridad: duplicadas + incompatibles + excesos };
}

/**
 * ESC-01. Mide el tiempo de asignarLote() para lotes crecientes, con R = ⌈n / solicitudesPorReciclador⌉.
 * Compara el método con índice de ocupación y el método de referencia (filtrado completo).
 */
export async function medirEscalabilidad({
  tamanos = [50, 100, 200, 400, 800, 1600],
  repeticiones = 3,
  solicitudesPorReciclador = 25,
  metodos = ["indice", "filtrado"],
  parametros = PARAMETROS_POR_DEFECTO,
  reloj = relojPorDefecto,
  alProgresar = () => {},
} = {}) {
  const hogares = [hogarDePrueba()];
  const filas = [];
  const total = tamanos.length * metodos.length * repeticiones;
  let hechas = 0;
  for (const n of tamanos) {
    const R = Math.ceil(n / solicitudesPorReciclador);
    const recicladores = recicladoresDePrueba(R);
    const lote = Array.from({ length: n }, (_, i) => solicitudDePrueba(`ESC-${n}-${i + 1}`));
    for (const metodo of metodos) {
      const tiempos = [];
      let ultimo = null;
      for (let rep = 0; rep < repeticiones; rep += 1) {
        await pausa();
        const inicio = reloj();
        ultimo = asignarLote({ solicitudes: lote, hogares, recicladores, parametros, usarIndice: metodo === "indice" });
        tiempos.push(reloj() - inicio);
        hechas += 1;
        alProgresar({ hechas, total, n, metodo });
      }
      const auditoria = auditarLote(ultimo, recicladores, parametros);
      const tiempoMediano = mediana(tiempos);
      filas.push({
        n,
        recicladores: R,
        metodo,
        repeticiones,
        tiemposMs: tiempos,
        medianaMs: tiempoMediano,
        mediaMs: media(tiempos),
        minimoMs: Math.min(...tiempos),
        maximoMs: Math.max(...tiempos),
        microsegundosPorSolicitud: (tiempoMediano * 1000) / n,
        asignadas: ultimo.asignadas.length,
        enEspera: ultimo.enEspera.length,
        sinDisponibilidad: ultimo.sinDisponibilidad.length,
        ...auditoria,
      });
    }
  }
  const ajustes = Object.fromEntries(metodos.map((metodo) => [
    metodo,
    ajustePotencia(filas.filter((f) => f.metodo === metodo).map((f) => ({ x: f.n, y: f.medianaMs }))),
  ]));
  return { experimento: "ESC-01", parametros: { tamanos, repeticiones, solicitudesPorReciclador, metodos }, filas, ajustes };
}

/**
 * REN-01. Mide la operación completa de registro de una solicitud sobre una copia del estado:
 * creación, validación, transición a VALIDADA, asignación, transición final y serialización
 * para guardar. No modifica los datos guardados.
 */
export async function medirRendimiento({ estado, operaciones = 20, limiteMs = 3000, reloj = relojPorDefecto } = {}) {
  const base = estado && estado.hogares?.length ? estado : { hogares: [hogarDePrueba()], recicladores: recicladoresDePrueba(3), solicitudes: [], eventos: [], parametros: PARAMETROS_POR_DEFECTO, distanciasKm: {} };
  const hogar = base.hogares[0];
  const parametros = base.parametros || PARAMETROS_POR_DEFECTO;
  const filas = [];
  for (let i = 1; i <= operaciones; i += 1) {
    await pausa();
    const inicio = reloj();
    const nueva = crearSolicitud({ id: `REN-${i}`, hogarId: hogar.id, materiales: ["papel"], bolsas: 1, franja: { ...FRANJA_PILOTO }, fechaServicio: FECHA_EXPERIMENTO, estado: "REGISTRADA" });
    const validacion = validarSolicitud(nueva, parametros);
    const marca = new Date().toISOString();
    const validada = transicionarEstado({ solicitud: nueva, estadoNuevo: "VALIDADA", responsable: "Sistema", fecha: marca });
    const plan = asignarSolicitud({
      solicitud: validada.solicitudActualizada,
      hogar,
      recicladores: base.recicladores,
      solicitudes: [...base.solicitudes, validada.solicitudActualizada],
      parametros,
      distanciasKm: base.distanciasKm || {},
    });
    const cierre = transicionarEstado({ solicitud: validada.solicitudActualizada, estadoNuevo: plan.estado, responsable: "Motor de asignación", fecha: marca, recicladorId: plan.ok ? plan.candidato.id : null });
    const serializado = JSON.stringify({ ...base, solicitudes: [...base.solicitudes, plan.solicitudActualizada], eventos: [...(base.eventos || []), validada.evento, cierre.evento] });
    const duracion = reloj() - inicio;
    filas.push({ operacion: i, ms: duracion, cumple: duracion <= limiteMs, valida: validacion.valida, estadoFinal: plan.estado, bytesGuardados: serializado.length });
  }
  const tiempos = filas.map((f) => f.ms);
  return {
    experimento: "REN-01",
    parametros: { operaciones, limiteMs, solicitudesEnEstado: base.solicitudes.length },
    filas,
    resumen: { minimoMs: Math.min(...tiempos), medianaMs: mediana(tiempos), maximoMs: Math.max(...tiempos), cumplen: filas.filter((f) => f.cumple).length },
  };
}

/** Peso de los recursos descargados por la página actual (RNF-03: carga inicial ≤ 500 KB). */
export function medirCargaInicial(limiteKB = 500) {
  const rendimiento = globalThis.performance;
  if (!rendimiento?.getEntriesByType) return null;
  const entradas = [...rendimiento.getEntriesByType("navigation"), ...rendimiento.getEntriesByType("resource")];
  const archivos = entradas.map((e) => ({
    nombre: e.name.split("/").slice(-2).join("/"),
    tipo: e.initiatorType || "navigation",
    bytes: e.encodedBodySize || e.transferSize || 0,
  }));
  const bytes = archivos.reduce((suma, a) => suma + a.bytes, 0);
  return { archivos, bytes, kilobytes: bytes / 1024, limiteKB, cumple: bytes / 1024 <= limiteKB };
}

/** Convierte filas en CSV con separador «;» y coma decimal, compatible con Excel en español. */
export function convertirACSV(columnas, filas) {
  const celda = (valor) => {
    if (valor === null || valor === undefined) return "";
    const texto = typeof valor === "number" ? String(Number(valor.toPrecision(10))).replace(".", ",") : typeof valor === "boolean" ? (valor ? "sí" : "no") : String(valor);
    return /[;"\n\r]/.test(texto) ? `"${texto.replaceAll('"', '""')}"` : texto;
  };
  return [columnas.map(({ titulo }) => celda(titulo)).join(";"), ...filas.map((fila) => columnas.map(({ clave }) => celda(fila[clave])).join(";"))].join("\r\n");
}
