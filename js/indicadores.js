/**
 * Indicadores K2, K3, K6 y K7. Todos se derivan del historial de eventos;
 * las solicitudes, intentos y parámetros solo aportan datos de auditoría.
 */
import { evaluarCompatibilidad } from "./motor.js";
import { desviacionPoblacional, media, normalizarTexto, obtenerDistanciaKm } from "./utilidades.js";

const ESTADOS_ASIGNADOS = new Set(["ASIGNADA", "CONFIRMADA", "ATENDIDA", "FALLIDA"]);
const ESTADOS_LIBERACION = new Set(["SIN_DISPONIBILIDAD", "EN_ESPERA", "CANCELADA", "REPROGRAMADA"]);

function fechaMs(evento) {
  const valor = Date.parse(evento?.fecha);
  return Number.isFinite(valor) ? valor : null;
}

function ordenarEventos(eventos = []) {
  return eventos.map((evento, indice) => ({ evento, indice, marca: fechaMs(evento) }))
    .filter((item) => item.marca !== null)
    .sort((a, b) => a.marca - b.marca || a.indice - b.indice);
}

function indicesPorSolicitud(eventos) {
  const grupos = new Map();
  for (const { evento, marca } of ordenarEventos(eventos)) {
    if (!grupos.has(evento.solicitudId)) grupos.set(evento.solicitudId, []);
    grupos.get(evento.solicitudId).push({ ...evento, marca });
  }
  return grupos;
}

/** K2: promedio de horas entre VALIDADA y su siguiente CONFIRMADA. */
export function calcularK2(eventos = []) {
  const grupos = indicesPorSolicitud(eventos);
  const duracionesHoras = [];
  for (const historial of grupos.values()) {
    const validada = historial.find((evento) => evento.estadoNuevo === "VALIDADA");
    if (!validada) continue;
    const confirmada = historial.find((evento) => evento.estadoNuevo === "CONFIRMADA" && evento.marca >= validada.marca);
    if (confirmada) duracionesHoras.push((confirmada.marca - validada.marca) / 3_600_000);
  }
  return {
    nombre: "Tiempo promedio de confirmación",
    unidad: "horas",
    cantidad: duracionesHoras.length,
    valor: duracionesHoras.length ? duracionesHoras.reduce((suma, valor) => suma + valor, 0) / duracionesHoras.length : null,
    duracionesHoras,
  };
}

/**
 * K3: proporción de solicitudes únicas fallidas sobre confirmadas y canceladas sobre registradas.
 * Una solicitud cuenta como registrada si su historial parte de REGISTRADA
 * (evento hacia REGISTRADA o primera transición desde REGISTRADA).
 */
export function calcularK3(eventos = []) {
  const grupos = indicesPorSolicitud(eventos);
  let fallidas = 0;
  let confirmadas = 0;
  let canceladas = 0;
  let registradas = 0;
  for (const historial of grupos.values()) {
    const estados = new Set(historial.map((evento) => evento.estadoNuevo));
    if (estados.has("FALLIDA")) fallidas += 1;
    if (estados.has("CONFIRMADA")) confirmadas += 1;
    if (estados.has("CANCELADA")) canceladas += 1;
    if (estados.has("REGISTRADA") || historial.some((evento) => evento.estadoAnterior === "REGISTRADA")) registradas += 1;
  }
  return {
    fallidaSobreConfirmada: { numerador: fallidas, denominador: confirmadas, valor: confirmadas ? fallidas / confirmadas : null },
    canceladaSobreRegistrada: { numerador: canceladas, denominador: registradas, valor: registradas ? canceladas / registradas : null },
  };
}

/** K6: audita las ofertas ASIGNADA registradas en los eventos. */
export function calcularK6({ eventos = [], solicitudes = [], hogares = [], recicladores = [], parametros = {}, distanciasKm = {} } = {}) {
  const porSolicitud = new Map(solicitudes.map((solicitud) => [solicitud.id, solicitud]));
  const porHogar = new Map(hogares.map((hogar) => [hogar.id, hogar]));
  const porReciclador = new Map(recicladores.map((reciclador) => [reciclador.id, reciclador]));
  const ordenados = ordenarEventos(eventos);
  const solicitudesVigentes = new Map();
  let totalAsignaciones = 0;
  let incompatibles = 0;
  let duplicadas = 0;
  let sinTrazabilidad = 0;
  const detalles = [];

  for (const { evento, marca } of ordenados) {
    const solicitudBase = porSolicitud.get(evento.solicitudId);
    if (evento.estadoNuevo === "ASIGNADA") {
      totalAsignaciones += 1;
      const asignacionesDeSolicitud = ordenados.filter((item) => item.evento.solicitudId === evento.solicitudId && item.evento.estadoNuevo === "ASIGNADA");
      const recicladorId = evento.recicladorId || (asignacionesDeSolicitud.length === 1 ? solicitudBase?.recicladorId : null) || null;
      const reciclador = porReciclador.get(recicladorId);
      const hogar = porHogar.get(solicitudBase?.hogarId);
      let incompatible = false;
      if (!recicladorId || !reciclador || !solicitudBase || !hogar) {
        sinTrazabilidad += 1;
      } else {
        const ocupadas = [...solicitudesVigentes.entries()]
          .filter(([, asignacion]) => ESTADOS_ASIGNADOS.has(asignacion.estado))
          .filter(([, asignacion]) => !(asignacion.solicitud?.intentos || []).some((intento) =>
            intento.recicladorId === asignacion.recicladorId &&
            ["rechazado", "vencido"].includes(intento.resultado) &&
            Number.isFinite(Date.parse(intento.fecha)) && Date.parse(intento.fecha) <= marca
          ))
          .map(([id, asignacion]) => ({ ...asignacion.solicitud, id, estado: asignacion.estado, recicladorId: asignacion.recicladorId }));
        const distanciaKm = obtenerDistanciaKm({ solicitud: solicitudBase, hogar, reciclador, distanciasKm });
        const evaluacion = evaluarCompatibilidad({
          solicitud: solicitudBase,
          hogar,
          reciclador,
          solicitudes: ocupadas,
          parametros,
          distanciaKm,
        });
        incompatible = !evaluacion.compatible;
        if (incompatible) incompatibles += 1;
        detalles.push({ solicitudId: evento.solicitudId, recicladorId, fecha: evento.fecha, compatible: evaluacion.compatible, condiciones: evaluacion.condiciones, motivos: evaluacion.motivos });
      }

      const anterior = solicitudesVigentes.get(evento.solicitudId);
      if (anterior && ESTADOS_ASIGNADOS.has(anterior.estado)) {
        const intentoCerrado = (solicitudBase?.intentos || []).some((intento) =>
          intento.recicladorId === anterior.recicladorId &&
          ["rechazado", "vencido"].includes(intento.resultado) &&
          Number.isFinite(Date.parse(intento.fecha)) && Date.parse(intento.fecha) <= marca
        );
        if (!intentoCerrado) duplicadas += 1;
      }
      solicitudesVigentes.set(evento.solicitudId, { estado: "ASIGNADA", recicladorId, solicitud: solicitudBase });
      if (!detalles.some((detalle) => detalle.solicitudId === evento.solicitudId && detalle.fecha === evento.fecha)) {
        detalles.push({ solicitudId: evento.solicitudId, recicladorId, fecha: evento.fecha, compatible: null, condiciones: null, motivos: [], sinTrazabilidad: true });
      }
      continue;
    }

    const actual = solicitudesVigentes.get(evento.solicitudId);
    if (actual || evento.estadoNuevo === "CONFIRMADA" || ESTADOS_LIBERACION.has(evento.estadoNuevo) || evento.estadoNuevo === "ATENDIDA" || evento.estadoNuevo === "FALLIDA") {
      const recicladorId = actual?.recicladorId || evento.recicladorId || solicitudBase?.recicladorId || null;
      solicitudesVigentes.set(evento.solicitudId, {
        estado: evento.estadoNuevo,
        recicladorId: ESTADOS_LIBERACION.has(evento.estadoNuevo) ? null : recicladorId,
        solicitud: solicitudBase,
      });
    }
  }

  return { totalAsignaciones, incompatibles, duplicadas, sinTrazabilidad, detalles };
}

/**
 * K7: equidad de la carga. Cuenta las solicitudes con asignación vigente por reciclador y calcula
 * el CV poblacional dentro de cada microzona con dos o más recicladores, porque solo ellos compiten
 * por la misma demanda. El valor reportado es el CV más alto (la microzona menos equitativa).
 */
export function calcularK7({ eventos = [], recicladores = [], solicitudes = [] } = {}) {
  const ultimoEstado = new Map();
  const ordenados = ordenarEventos(eventos);
  const solicitudesPorId = new Map(solicitudes.map((solicitud) => [solicitud.id, solicitud]));
  for (const { evento } of ordenados) {
    const previo = ultimoEstado.get(evento.solicitudId);
    if (ESTADOS_LIBERACION.has(evento.estadoNuevo)) {
      ultimoEstado.set(evento.solicitudId, { estado: evento.estadoNuevo, recicladorId: null });
    } else if (evento.estadoNuevo === "ASIGNADA") {
      const ofertas = ordenados.filter((item) => item.evento.solicitudId === evento.solicitudId && item.evento.estadoNuevo === "ASIGNADA");
      const asignacionAntiguaUnica = ofertas.length === 1 ? solicitudesPorId.get(evento.solicitudId)?.recicladorId : null;
      ultimoEstado.set(evento.solicitudId, { estado: "ASIGNADA", recicladorId: evento.recicladorId || previo?.recicladorId || asignacionAntiguaUnica || null });
    } else {
      ultimoEstado.set(evento.solicitudId, { estado: evento.estadoNuevo, recicladorId: evento.recicladorId || previo?.recicladorId || null });
    }
  }
  const conteos = Object.fromEntries(recicladores.map((reciclador) => [reciclador.id, 0]));
  for (const asignacion of ultimoEstado.values()) {
    if (ESTADOS_ASIGNADOS.has(asignacion.estado) && asignacion.recicladorId && Object.hasOwn(conteos, asignacion.recicladorId)) {
      conteos[asignacion.recicladorId] += 1;
    }
  }

  const cv = (valores) => {
    const promedio = media(valores);
    return promedio ? desviacionPoblacional(valores) / promedio : null;
  };
  const grupos = new Map();
  for (const reciclador of recicladores) {
    const clave = normalizarTexto(reciclador.microzona);
    if (!grupos.has(clave)) grupos.set(clave, { microzona: reciclador.microzona, recicladores: [] });
    grupos.get(clave).recicladores.push(reciclador.id);
  }
  const porMicrozona = [...grupos.values()].map(({ microzona, recicladores: ids }) => {
    const valores = ids.map((id) => conteos[id]);
    return {
      microzona,
      recicladores: ids,
      conteos: Object.fromEntries(ids.map((id) => [id, conteos[id]])),
      media: media(valores),
      desviacion: desviacionPoblacional(valores),
      coeficienteVariacion: ids.length >= 2 ? cv(valores) : null,
      comparable: ids.length >= 2,
    };
  });
  const comparables = porMicrozona.filter((grupo) => grupo.coeficienteVariacion !== null);
  const peor = comparables.reduce((maximo, grupo) => (!maximo || grupo.coeficienteVariacion > maximo.coeficienteVariacion ? grupo : maximo), null);

  const valores = Object.values(conteos);
  return {
    conteos,
    media: media(valores) ?? 0,
    desviacion: desviacionPoblacional(valores) ?? 0,
    coeficienteVariacionGlobal: valores.length ? cv(valores) : null,
    porMicrozona,
    microzonaCritica: peor?.microzona ?? null,
    coeficienteVariacion: peor ? peor.coeficienteVariacion : null,
  };
}

/** Metas de la Tabla 16 de la Etapa 3 para los indicadores medibles en el prototipo. */
export const METAS_KPI = Object.freeze({
  K2: { meta: 2, texto: "≤ 2 h" },
  K3a: { meta: 0.10, texto: "≤ 10 %" },
  K3b: { meta: 0.10, texto: "≤ 10 %" },
  K6: { meta: 0, texto: "= 0" },
  K7: { meta: 0.30, texto: "≤ 0,30" },
});

/** Compara cada indicador con su meta y devuelve filas listas para tablas, gráficos y CSV. */
export function evaluarMetas(indicadores) {
  const cumpleMaximo = (valor, meta) => (valor === null || valor === undefined ? null : valor <= meta + 1e-12);
  const { K2, K3, K6, K7 } = indicadores;
  const k6Valor = K6.incompatibles + K6.duplicadas;
  return [
    { id: "K2", nombre: "Tiempo hasta la confirmación", unidad: "h", valor: K2.valor, meta: METAS_KPI.K2.meta, metaTexto: METAS_KPI.K2.texto, cumple: cumpleMaximo(K2.valor, METAS_KPI.K2.meta), base: `${K2.cantidad} solicitudes confirmadas` },
    { id: "K3a", nombre: "Fallidas / confirmadas", unidad: "%", valor: K3.fallidaSobreConfirmada.valor, meta: METAS_KPI.K3a.meta, metaTexto: METAS_KPI.K3a.texto, cumple: cumpleMaximo(K3.fallidaSobreConfirmada.valor, METAS_KPI.K3a.meta), base: `${K3.fallidaSobreConfirmada.numerador}/${K3.fallidaSobreConfirmada.denominador}` },
    { id: "K3b", nombre: "Canceladas / registradas", unidad: "%", valor: K3.canceladaSobreRegistrada.valor, meta: METAS_KPI.K3b.meta, metaTexto: METAS_KPI.K3b.texto, cumple: cumpleMaximo(K3.canceladaSobreRegistrada.valor, METAS_KPI.K3b.meta), base: `${K3.canceladaSobreRegistrada.numerador}/${K3.canceladaSobreRegistrada.denominador}` },
    { id: "K6", nombre: "Incompatibles o duplicadas", unidad: "casos", valor: k6Valor, meta: METAS_KPI.K6.meta, metaTexto: METAS_KPI.K6.texto, cumple: K6.totalAsignaciones ? k6Valor === 0 : null, base: `${K6.totalAsignaciones} asignaciones auditadas` },
    { id: "K7", nombre: "Equidad de la carga (CV)", unidad: "CV", valor: K7.coeficienteVariacion, meta: METAS_KPI.K7.meta, metaTexto: METAS_KPI.K7.texto, cumple: cumpleMaximo(K7.coeficienteVariacion, METAS_KPI.K7.meta), base: K7.microzonaCritica ? `microzona ${K7.microzonaCritica}` : "sin microzonas comparables" },
  ];
}

/** Calcula el paquete de indicadores mostrado por el panel administrativo. */
export function calcularIndicadores(estado = {}) {
  const datos = {
    eventos: estado.eventos || [],
    solicitudes: estado.solicitudes || [],
    hogares: estado.hogares || [],
    recicladores: estado.recicladores || [],
    parametros: estado.parametros || {},
    distanciasKm: estado.distanciasKm || {},
  };
  return { K2: calcularK2(datos.eventos), K3: calcularK3(datos.eventos), K6: calcularK6(datos), K7: calcularK7(datos) };
}
