import { calcularTasaConfiabilidad, resolverCascada } from "../motor.js";
import { transicionarEstado } from "../estados.js";
import { crearMensaje, fechaActualIso } from "./servicios.js";
import { escaparHtml, textoEstado, mostrarAviso } from "./comun.js";

export function renderizarReciclador(raiz, contexto) {
  let recicladorId = contexto.obtenerEstado().recicladores[0]?.id || "";

  function dibujar() {
    const estado = contexto.obtenerEstado();
    if (!estado.recicladores.some((item) => item.id === recicladorId)) recicladorId = estado.recicladores[0]?.id || "";
    const opciones = estado.recicladores.map((item) =>
      `<option value="${escaparHtml(item.id)}" ${item.id === recicladorId ? "selected" : ""}>${escaparHtml(item.nombre || item.id)} · ${escaparHtml(item.microzona)}</option>`
    ).join("");
    const solicitudes = estado.solicitudes.filter((item) =>
      item.recicladorId === recicladorId && ["ASIGNADA", "CONFIRMADA"].includes(item.estado)
    );
    const tarjetas = solicitudes.length ? solicitudes.map((item) => `
      <article class="tarjeta solicitud">
        <div class="fila-entre"><h3>${escaparHtml(item.id)}</h3><span class="etiqueta-estado">${escaparHtml(textoEstado(item.estado))}</span></div>
        <p>Hogar: ${escaparHtml(estado.hogares.find((hogar) => hogar.id === item.hogarId)?.alias || item.hogarId)}</p>
        <p>Materiales: ${escaparHtml(item.materiales.join(", "))}</p>
        <p>Bolsas solicitadas: ${escaparHtml(item.bolsas)} · Sábado, 8:00 a. m. a 12:00 p. m.</p>
        ${item.estado === "ASIGNADA" ? `
          <label for="motivo-${escaparHtml(item.id)}">Motivo, si rechazas la oferta</label>
          <textarea id="motivo-${escaparHtml(item.id)}" rows="2" data-motivo placeholder="Escribe por qué no puedes atenderla"></textarea>
          <div class="acciones">
            <button class="boton primario" type="button" data-respuesta="aceptado" data-solicitud="${escaparHtml(item.id)}">Aceptar</button>
            <button class="boton peligro" type="button" data-respuesta="rechazado" data-solicitud="${escaparHtml(item.id)}">Rechazar</button>
          </div>` : `
          <label for="bolsas-reales-${escaparHtml(item.id)}">Bolsas recogidas</label>
          <input id="bolsas-reales-${escaparHtml(item.id)}" type="number" min="1" step="1" value="${escaparHtml(item.bolsas)}" data-bolsas-reales>
          <label for="motivo-falla-${escaparHtml(item.id)}">Motivo, si la recolección falla</label>
          <textarea id="motivo-falla-${escaparHtml(item.id)}" rows="2" data-motivo-falla placeholder="Describe la novedad"></textarea>
          <div class="acciones">
            <button class="boton primario" type="button" data-cierre="ATENDIDA" data-solicitud="${escaparHtml(item.id)}">Marcar atendida</button>
            <button class="boton peligro" type="button" data-cierre="FALLIDA" data-solicitud="${escaparHtml(item.id)}">Marcar fallida</button>
          </div>`}
      </article>`).join("") : `<div class="tarjeta"><p>No hay ofertas o asignaciones activas para este reciclador.</p></div>`;

    raiz.innerHTML = `
      <section class="vista-rol" aria-labelledby="titulo-reciclador">
        <header class="encabezado-vista">
          <p class="ceja">Portal de recicladores</p>
          <h1 id="titulo-reciclador">Reciclador</h1>
          <p>Revisa tus ofertas, confirma disponibilidad y registra el resultado de la recolección.</p>
        </header>
        <p class="aviso" data-aviso role="status" aria-live="polite" hidden></p>
        <div class="tarjeta selector-rol">
          <label for="reciclador-activo">Vista simulada de</label>
          <select id="reciclador-activo">${opciones || "<option value=''>Sin recicladores registrados</option>"}</select>
        </div>
        <div class="lista-tarjetas">${tarjetas}</div>
      </section>`;

    raiz.querySelector("#reciclador-activo")?.addEventListener("change", (evento) => {
      recicladorId = evento.target.value;
      dibujar();
    });
    raiz.querySelectorAll("[data-respuesta]").forEach((boton) => {
      boton.addEventListener("click", () => responderOferta(boton.dataset.solicitud, boton.dataset.respuesta, boton));
    });
    raiz.querySelectorAll("[data-cierre]").forEach((boton) => {
      boton.addEventListener("click", () => cerrarAsignacion(boton.dataset.solicitud, boton.dataset.cierre, boton));
    });
  }

  function responderOferta(id, respuesta, boton) {
    const estado = contexto.obtenerEstado();
    const solicitud = estado.solicitudes.find((item) => item.id === id);
    const motivo = respuesta === "rechazado"
      ? raiz.querySelector(`#motivo-${CSS.escape(id)}`)?.value.trim() || ""
      : "";
    if (!solicitud || solicitud.estado !== "ASIGNADA" || solicitud.recicladorId !== recicladorId) return;
    if (respuesta === "rechazado" && !motivo) return mostrarAviso(raiz, "Escribe el motivo del rechazo para continuar.", "error");

    const marca = fechaActualIso();
    const resultado = resolverCascada({
      solicitud,
      hogar: estado.hogares.find((item) => item.id === solicitud.hogarId),
      recicladores: estado.recicladores,
      solicitudes: estado.solicitudes,
      parametros: estado.parametros,
      distanciasKm: estado.distanciasKm,
      recicladorOfertadoId: recicladorId,
      respuestasPorReciclador: { [recicladorId]: respuesta },
      motivosPorReciclador: { [recicladorId]: motivo },
      fecha: marca,
    });
    if (!resultado.solicitudActualizada) return mostrarAviso(raiz, resultado.mensaje || "No se pudo procesar la respuesta.", "error");

    const transicion = transicionarEstado({
      solicitud,
      estadoNuevo: resultado.estado,
      responsable: `Reciclador · ${recicladorId}`,
      fecha: marca,
      recicladorId: resultado.estado === "ASIGNADA" ? resultado.recicladorId : null,
    });
    if (!transicion.ok) return mostrarAviso(raiz, transicion.mensaje, "error");

    const actualizada = {
      ...transicion.solicitudActualizada,
      ...resultado.solicitudActualizada,
      estado: resultado.estado,
      intentos: resultado.intentos || resultado.solicitudActualizada.intentos || solicitud.intentos,
    };
    const mensajes = [];
    if (resultado.estado === "CONFIRMADA") {
      mensajes.push(crearMensaje(solicitud.hogarId, `El reciclador confirmó la solicitud ${id}.`));
    } else if (resultado.estado === "ASIGNADA") {
      const siguiente = estado.recicladores.find((item) => item.id === resultado.recicladorId);
      mensajes.push(crearMensaje(siguiente?.nombre || resultado.recicladorId, `Nueva oferta para la solicitud ${id}.`));
    } else {
      mensajes.push(crearMensaje("Facilitador", `La solicitud ${id} agotó los intentos y requiere gestión manual o reprogramación.`));
    }

    contexto.actualizarEstado((actual) => ({
      ...actual,
      solicitudes: actual.solicitudes.map((item) => item.id === id ? actualizada : item),
      eventos: [...actual.eventos, transicion.evento],
      mensajes: [...actual.mensajes, ...mensajes],
    }));
    dibujar();
    mostrarAviso(raiz, resultado.estado === "ASIGNADA"
      ? "Respuesta registrada. La oferta pasó al siguiente reciclador."
      : `Respuesta registrada. Estado: ${textoEstado(resultado.estado)}.`, resultado.estado === "SIN_DISPONIBILIDAD" ? "info" : "exito");
  }

  function cerrarAsignacion(id, estadoNuevo, boton) {
    const estado = contexto.obtenerEstado();
    const solicitud = estado.solicitudes.find((item) => item.id === id);
    if (!solicitud || solicitud.estado !== "CONFIRMADA" || solicitud.recicladorId !== recicladorId) return;
    let datosExtra = {};
    if (estadoNuevo === "ATENDIDA") {
      const bolsasReales = Number(raiz.querySelector(`#bolsas-reales-${CSS.escape(id)}`)?.value);
      if (!Number.isInteger(bolsasReales) || bolsasReales < 1) {
        return mostrarAviso(raiz, "Indica un número entero de bolsas recogidas, al menos 1.", "error");
      }
      datosExtra.bolsasReales = bolsasReales;
    } else {
      const motivo = raiz.querySelector(`#motivo-falla-${CSS.escape(id)}`)?.value.trim() || "";
      if (!motivo) return mostrarAviso(raiz, "Escribe el motivo de la recolección fallida.", "error");
      datosExtra.motivoFalla = motivo;
    }

    const transicion = transicionarEstado({
      solicitud,
      estadoNuevo,
      responsable: `Reciclador · ${recicladorId}`,
      fecha: fechaActualIso(),
      recicladorId,
    });
    if (!transicion.ok) return mostrarAviso(raiz, transicion.mensaje, "error");
    const actualizada = { ...transicion.solicitudActualizada, ...datosExtra };
    contexto.actualizarEstado((actual) => {
      const solicitudesActualizadas = actual.solicitudes.map((item) => item.id === id ? actualizada : item);
      const recicladoresActualizados = actual.recicladores.map((item) => item.id === recicladorId
        ? { ...item, tasaConfiabilidad: calcularTasaConfiabilidad(item, solicitudesActualizadas) }
        : item);
      return {
        ...actual,
        solicitudes: solicitudesActualizadas,
        recicladores: recicladoresActualizados,
        eventos: [...actual.eventos, transicion.evento],
        mensajes: [...actual.mensajes, crearMensaje(solicitud.hogarId, `La solicitud ${id} quedó ${textoEstado(estadoNuevo)}.`)],
      };
    });
    dibujar();
    mostrarAviso(raiz, `Resultado registrado: ${textoEstado(estadoNuevo)}.`, "exito");
  }

  dibujar();
}
