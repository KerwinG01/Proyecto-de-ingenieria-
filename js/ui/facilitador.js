import { crearHogar, crearSolicitud } from "../modelo.js";
import { asignarSolicitud, rankearCandidatos, validarSolicitud } from "../motor.js";
import { transicionarEstado } from "../estados.js";
import { crearId, crearMensaje, fechaActualIso } from "./servicios.js";
import { escaparHtml, fechaLegible, fechaSabadoProximo, textoEstado, mostrarAviso } from "./comun.js";

const FRANJA_PILOTO = { dia: "sábado", inicio: "08:00", fin: "12:00" };

export function renderizarFacilitador(raiz, contexto) {
  let pestaña = "escaladas";

  function dibujar() {
    const estado = contexto.obtenerEstado();
    raiz.innerHTML = `
      <section class="vista-rol" aria-labelledby="titulo-facilitador">
        <header class="encabezado-vista">
          <p class="ceja">Coordinación local</p>
          <h1 id="titulo-facilitador">Facilitador</h1>
          <p>Registra hogares, crea solicitudes asistidas y gestiona casos escalados.</p>
        </header>
        <nav class="pestañas" aria-label="Opciones del facilitador">
          <button class="boton-pestaña ${pestaña === "escaladas" ? "activo" : ""}" type="button" data-pestaña="escaladas">Bandeja de escalados</button>
          <button class="boton-pestaña ${pestaña === "hogar" ? "activo" : ""}" type="button" data-pestaña="hogar">Registrar hogar</button>
          <button class="boton-pestaña ${pestaña === "asistida" ? "activo" : ""}" type="button" data-pestaña="asistida">Solicitud asistida</button>
        </nav>
        <p class="aviso" data-aviso role="status" aria-live="polite" hidden></p>
        <div id="contenido-facilitador"></div>
      </section>`;

    raiz.querySelectorAll("[data-pestaña]").forEach((boton) => {
      boton.addEventListener("click", () => { pestaña = boton.dataset.pestaña; dibujar(); });
    });
    if (pestaña === "hogar") dibujarFormularioHogar(estado);
    else if (pestaña === "asistida") dibujarFormularioSolicitud(estado);
    else dibujarEscaladas(estado);
  }

  function dibujarFormularioHogar(estado) {
    const contenido = raiz.querySelector("#contenido-facilitador");
    const camposDistancia = estado.recicladores.map((reciclador) => `
      <label for="distancia-${escaparHtml(reciclador.id)}">Distancia del hogar a ${escaparHtml(reciclador.nombre || reciclador.id)} (km, opcional)</label>
      <input id="distancia-${escaparHtml(reciclador.id)}" type="number" min="0" step="0.1" inputmode="decimal">`).join("");
    contenido.innerHTML = `
      <form class="tarjeta formulario" id="form-hogar">
        <h2>Datos del hogar</h2>
        <label for="alias-hogar">Alias del hogar</label>
        <input id="alias-hogar" name="alias" required maxlength="80">
        <label for="microzona-hogar">Microzona</label>
        <input id="microzona-hogar" name="microzona" required value="San Eduardo" maxlength="80">
        <label for="referencia-hogar">Referencia de entrega</label>
        <textarea id="referencia-hogar" name="referenciaEntrega" required rows="3" maxlength="240"></textarea>
        <fieldset><legend>Consentimiento para registrar los datos</legend>
          <label class="opcion-material"><input name="consentimiento" type="checkbox" required><span>El hogar acepta el uso de estos datos para coordinar la recolección.</span></label>
        </fieldset>
        <details class="distancias">
          <summary>Distancias para determinar microzonas adyacentes</summary>
          <p class="texto-ayuda">Ingresa la distancia conocida desde este hogar a cada reciclador. Se considerará adyacente hasta 2 km. No ingreses valores estimados.</p>
          ${camposDistancia || "<p>No hay recicladores registrados.</p>"}
        </details>
        <button class="boton primario" type="submit">Guardar hogar</button>
      </form>`;
    contenido.querySelector("#form-hogar").addEventListener("submit", (evento) => {
      evento.preventDefault();
      const form = evento.currentTarget;
      if (!form.reportValidity()) return;
      const nuevoHogar = crearHogar({
        id: crearId("H"),
        alias: form.elements.alias.value.trim(),
        microzona: form.elements.microzona.value.trim(),
        referenciaEntrega: form.elements.referenciaEntrega.value.trim(),
        consentimiento: form.elements.consentimiento.checked,
      });
      const distanciasNuevas = {};
      for (const reciclador of estado.recicladores) {
        const campo = contenido.querySelector(`#distancia-${CSS.escape(reciclador.id)}`);
        if (campo?.value === "") continue;
        const distancia = Number(campo.value);
        if (!Number.isFinite(distancia) || distancia < 0) {
          return mostrarAviso(raiz, `La distancia a ${reciclador.id} debe ser un número igual o mayor que cero.`, "error");
        }
        distanciasNuevas[`${nuevoHogar.id}|${reciclador.id}`] = distancia;
      }
      contexto.actualizarEstado((actual) => ({
        ...actual,
        hogares: [...actual.hogares, nuevoHogar],
        distanciasKm: { ...actual.distanciasKm, ...distanciasNuevas },
        mensajes: [...actual.mensajes, crearMensaje("Facilitador", `Se registró el hogar ${nuevoHogar.alias}.`)],
      }));
      dibujar();
      mostrarAviso(raiz, `Hogar ${nuevoHogar.alias} registrado.`, "exito");
    });
  }

  function dibujarFormularioSolicitud(estado) {
    const contenido = raiz.querySelector("#contenido-facilitador");
    const opcionesHogar = estado.hogares.map((hogar) =>
      `<option value="${escaparHtml(hogar.id)}">${escaparHtml(hogar.alias)} · ${escaparHtml(hogar.microzona)}</option>`
    ).join("");
    const materiales = estado.parametros.materialesAceptados.map((material) => `
      <label class="opcion-material"><input type="checkbox" name="material" value="${material}"><span>${material[0].toUpperCase()}${material.slice(1)}</span></label>`).join("");
    contenido.innerHTML = `
      <form class="tarjeta formulario" id="form-asistida">
        <h2>Crear solicitud con el hogar</h2>
        <label for="hogar-asistido">Hogar</label>
        <select id="hogar-asistido" name="hogarId" required>${opcionesHogar || "<option value=''>Registra un hogar primero</option>"}</select>
        <fieldset class="grupo-materiales"><legend>Materiales</legend>${materiales}</fieldset>
        <label for="bolsas-asistida">Cantidad de bolsas (1 a 4)</label>
        <input id="bolsas-asistida" name="bolsas" type="number" min="1" max="4" step="1" value="1" required>
        <label for="fecha-servicio-asistida">Fecha de recolección (sábado)</label>
        <input id="fecha-servicio-asistida" name="fechaServicio" type="date" value="${fechaSabadoProximo()}" min="${fechaSabadoProximo()}" required>
        <p class="texto-ayuda">Franja fija: 8:00 a. m. a 12:00 p. m. El cupo se calcula por fecha de servicio.</p>
        <button class="boton primario" type="submit" ${estado.hogares.length ? "" : "disabled"}>Registrar y asignar</button>
      </form>`;
    contenido.querySelector("#form-asistida").addEventListener("submit", (evento) => {
      evento.preventDefault();
      const form = evento.currentTarget;
      if (!form.reportValidity()) return;
      const materialesElegidos = [...form.querySelectorAll("input[name='material']:checked")].map((campo) => campo.value);
      if (!materialesElegidos.length) return mostrarAviso(raiz, "Selecciona al menos un material.", "error");
      crearSolicitudFacilitada({
        hogarId: form.elements.hogarId.value,
        materiales: materialesElegidos,
        bolsas: Number(form.elements.bolsas.value),
        fechaServicio: form.elements.fechaServicio.value,
      });
    });
  }

  function crearSolicitudFacilitada(datos) {
    const estado = contexto.obtenerEstado();
    const hogar = estado.hogares.find((item) => item.id === datos.hogarId);
    const solicitud = crearSolicitud({
      id: crearId("SOL"),
      hogarId: datos.hogarId,
      materiales: datos.materiales,
      bolsas: datos.bolsas,
      franja: { ...FRANJA_PILOTO },
      fechaServicio: datos.fechaServicio,
      estado: "REGISTRADA",
      registradaPor: "facilitador",
      recicladorId: null,
      intentos: [],
    });
    const validacion = validarSolicitud(solicitud, estado.parametros);
    if (!validacion.valida || !hogar) {
      return mostrarAviso(raiz, validacion.errores.map((error) => error.mensaje).join(" ") || "Hogar no encontrado.", "error");
    }
    const hora = fechaActualIso();
    const transicionValidada = transicionarEstado({ solicitud, estadoNuevo: "VALIDADA", responsable: "Facilitador", fecha: hora });
    const plan = asignarSolicitud({
      solicitud: transicionValidada.solicitudActualizada,
      hogar,
      recicladores: estado.recicladores,
      solicitudes: [...estado.solicitudes, transicionValidada.solicitudActualizada],
      parametros: estado.parametros,
      distanciasKm: estado.distanciasKm,
    });
    const transicionFinal = transicionarEstado({
      solicitud: transicionValidada.solicitudActualizada,
      estadoNuevo: plan.estado,
      responsable: "Motor de asignación",
      fecha: fechaActualIso(),
      recicladorId: plan.ok ? plan.candidato.id : null,
    });
    const solicitudFinal = { ...transicionFinal.solicitudActualizada, ...plan.solicitudActualizada, estado: plan.estado };
    const mensajes = [crearMensaje(hogar.alias, `La solicitud ${solicitud.id} quedó ${textoEstado(plan.estado)}.`)];
    if (plan.ok) mensajes.push(crearMensaje(plan.candidato.nombre || plan.candidato.id, `Nueva oferta para la solicitud ${solicitud.id}.`));
    else mensajes.push(crearMensaje("Facilitador", `La solicitud ${solicitud.id} requiere revisión.`));

    contexto.actualizarEstado((actual) => ({
      ...actual,
      solicitudes: [...actual.solicitudes, solicitudFinal],
      eventos: [...actual.eventos, transicionValidada.evento, transicionFinal.evento],
      mensajes: [...actual.mensajes, ...mensajes],
    }));
    pestaña = "escaladas";
    dibujar();
    mostrarAviso(raiz, `Solicitud asistida registrada: ${textoEstado(plan.estado)}.`, plan.ok ? "exito" : "info");
  }

  function dibujarEscaladas(estado) {
    const contenido = raiz.querySelector("#contenido-facilitador");
    const lista = estado.solicitudes.filter((item) => ["SIN_DISPONIBILIDAD", "REPROGRAMADA"].includes(item.estado));
    const tarjetas = lista.length ? lista.map((solicitud) => {
      const hogar = estado.hogares.find((item) => item.id === solicitud.hogarId);
      const ranking = solicitud.estado === "SIN_DISPONIBILIDAD" && hogar ? rankearCandidatos({
        solicitud,
        hogar,
        recicladores: estado.recicladores,
        solicitudes: estado.solicitudes,
        parametros: estado.parametros,
        distanciasKm: estado.distanciasKm,
      }).compatibles.filter(({ reciclador }) => !solicitud.intentos.some((intento) => intento.recicladorId === reciclador.id)) : [];
      const opciones = ranking.map(({ reciclador }) =>
        `<option value="${escaparHtml(reciclador.id)}">${escaparHtml(reciclador.nombre || reciclador.id)}</option>`
      ).join("");
      return `
        <article class="tarjeta solicitud">
          <h3>${escaparHtml(solicitud.id)}</h3>
          <p>Hogar: ${escaparHtml(hogar?.alias || solicitud.hogarId)} · ${escaparHtml(hogar?.microzona || "")}</p>
          <p>Materiales: ${escaparHtml(solicitud.materiales.join(", "))} · ${escaparHtml(solicitud.bolsas)} bolsa(s)</p>
          <p>Fecha de recolección: ${escaparHtml(solicitud.fechaServicio ? fechaLegible(`${solicitud.fechaServicio}T12:00:00`) : "Fecha no registrada")}</p>
          <p>Intentos: ${solicitud.intentos?.length || 0}</p>
          ${solicitud.intentos?.length ? `<details><summary>Ver motivos y resultados</summary><ul>${solicitud.intentos.map((intento) => `<li>${escaparHtml(intento.recicladorId)}: ${escaparHtml(intento.resultado)}${intento.motivo ? ` · ${escaparHtml(intento.motivo)}` : ""}</li>`).join("")}</ul></details>` : ""}
          ${solicitud.estado === "REPROGRAMADA" ? `
            <p>La solicitud está lista para volver a validación y asignación.</p>
            <button class="boton primario" type="button" data-reactivar="${escaparHtml(solicitud.id)}">Intentar asignación en esta fecha</button>` : `
            <div class="acciones">
              ${opciones ? `<label for="manual-${escaparHtml(solicitud.id)}">Asignación manual compatible</label><select id="manual-${escaparHtml(solicitud.id)}" data-reciclador>${opciones}</select><button class="boton primario" type="button" data-manual="${escaparHtml(solicitud.id)}">Asignar</button>` : `<p>No hay candidatos compatibles sin intento previo.</p>`}
            </div>
            <label for="fecha-reprogramar-${escaparHtml(solicitud.id)}">Nueva fecha de recolección (sábado)</label>
            <input id="fecha-reprogramar-${escaparHtml(solicitud.id)}" type="date" min="${fechaSabadoProximo()}" data-fecha-reprogramar>
            <button class="boton secundario" type="button" data-reprogramar="${escaparHtml(solicitud.id)}">Reprogramar</button>`}
        </article>`;
    }).join("") : `<div class="tarjeta"><p>No hay solicitudes escaladas pendientes.</p></div>`;

    contenido.innerHTML = `
      <section class="seccion-lista" aria-labelledby="escaladas-titulo">
        <div class="tarjeta"><h2 id="escaladas-titulo">Bandeja de escalados</h2><p>Asigna manualmente un candidato compatible que no haya rechazado ni vencido una oferta, o registra una reprogramación.</p></div>
        <div class="lista-tarjetas">${tarjetas}</div>
      </section>`;
    contenido.querySelectorAll("[data-manual]").forEach((boton) => boton.addEventListener("click", () => asignarManual(boton.dataset.manual)));
    contenido.querySelectorAll("[data-reprogramar]").forEach((boton) => boton.addEventListener("click", () => reprogramar(boton.dataset.reprogramar)));
    contenido.querySelectorAll("[data-reactivar]").forEach((boton) => boton.addEventListener("click", () => reactivarReprogramada(boton.dataset.reactivar)));
  }

  function asignarManual(id) {
    const estado = contexto.obtenerEstado();
    const solicitud = estado.solicitudes.find((item) => item.id === id);
    const selector = raiz.querySelector(`#manual-${CSS.escape(id)}`);
    const recicladorId = selector?.value;
    if (!solicitud || !recicladorId) return;
    if (solicitud.intentos.some((intento) => intento.recicladorId === recicladorId)) {
      return mostrarAviso(raiz, "No se puede reofrecer la solicitud a quien ya rechazó o dejó vencer un intento.", "error");
    }
    const hogar = estado.hogares.find((item) => item.id === solicitud.hogarId);
    const plan = asignarSolicitud({
      solicitud,
      hogar,
      recicladores: estado.recicladores,
      solicitudes: estado.solicitudes,
      parametros: estado.parametros,
      distanciasKm: estado.distanciasKm,
    });
    if (!plan.ok || !plan.candidatos.some((candidato) => candidato.reciclador.id === recicladorId)) {
      return mostrarAviso(raiz, "Ese reciclador ya no está disponible o no cumple las condiciones de compatibilidad.", "error");
    }
    const transicion = transicionarEstado({
      solicitud,
      estadoNuevo: "ASIGNADA",
      responsable: "Facilitador · asignación manual",
      fecha: fechaActualIso(),
      recicladorId,
    });
    if (!transicion.ok) return mostrarAviso(raiz, transicion.mensaje, "error");
    const actualizada = { ...transicion.solicitudActualizada, estado: "ASIGNADA", recicladorId };
    contexto.actualizarEstado((actual) => ({
      ...actual,
      solicitudes: actual.solicitudes.map((item) => item.id === id ? actualizada : item),
      eventos: [...actual.eventos, transicion.evento],
      mensajes: [...actual.mensajes, crearMensaje(estado.recicladores.find((item) => item.id === recicladorId)?.nombre || recicladorId, `Asignación manual para la solicitud ${id}.`)],
    }));
    dibujar();
    mostrarAviso(raiz, `La solicitud ${id} fue asignada manualmente.`, "exito");
  }

  function reprogramar(id) {
    const estado = contexto.obtenerEstado();
    const solicitud = estado.solicitudes.find((item) => item.id === id);
    const fechaNueva = raiz.querySelector(`#fecha-reprogramar-${CSS.escape(id)}`)?.value;
    if (!solicitud || !fechaNueva) return mostrarAviso(raiz, "Selecciona una nueva fecha.", "error");
    if (new Date(`${fechaNueva}T12:00:00`).getDay() !== 6) return mostrarAviso(raiz, "La fecha de recolección debe ser un sábado.", "error");
    const transicion = transicionarEstado({
      solicitud,
      estadoNuevo: "REPROGRAMADA",
      responsable: "Facilitador · reprogramación",
      fecha: fechaActualIso(),
    });
    if (!transicion.ok) return mostrarAviso(raiz, transicion.mensaje, "error");
    const actualizada = { ...transicion.solicitudActualizada, fechaServicio: fechaNueva, fechaReprogramada: fechaNueva };
    contexto.actualizarEstado((actual) => ({
      ...actual,
      solicitudes: actual.solicitudes.map((item) => item.id === id ? actualizada : item),
      eventos: [...actual.eventos, transicion.evento],
      mensajes: [...actual.mensajes, crearMensaje(solicitud.hogarId, `La solicitud ${id} fue reprogramada para ${fechaLegible(`${fechaNueva}T12:00:00`)}.`)],
    }));
    dibujar();
    mostrarAviso(raiz, "La reprogramación quedó registrada.", "exito");
  }

  function reactivarReprogramada(id) {
    const estado = contexto.obtenerEstado();
    const solicitud = estado.solicitudes.find((item) => item.id === id && item.estado === "REPROGRAMADA");
    if (!solicitud) return;
    const marca = fechaActualIso();
    const validacion = transicionarEstado({ solicitud, estadoNuevo: "VALIDADA", responsable: "Facilitador · reactivación", fecha: marca });
    if (!validacion.ok) return mostrarAviso(raiz, validacion.mensaje, "error");
    const solicitudValidada = { ...validacion.solicitudActualizada, ...solicitud, estado: "VALIDADA", fechaServicio: solicitud.fechaReprogramada || solicitud.fechaServicio };
    const hogar = estado.hogares.find((item) => item.id === solicitud.hogarId);
    const plan = asignarSolicitud({
      solicitud: solicitudValidada,
      hogar,
      recicladores: estado.recicladores,
      solicitudes: estado.solicitudes,
      parametros: estado.parametros,
      distanciasKm: estado.distanciasKm,
    });
    const final = transicionarEstado({
      solicitud: solicitudValidada,
      estadoNuevo: plan.estado,
      responsable: "Motor de asignación tras reprogramación",
      fecha: fechaActualIso(),
      recicladorId: plan.ok ? plan.candidato.id : null,
    });
    if (!final.ok) return mostrarAviso(raiz, final.mensaje, "error");
    const actualizada = { ...final.solicitudActualizada, ...plan.solicitudActualizada, fechaServicio: solicitudValidada.fechaServicio, estado: plan.estado };
    contexto.actualizarEstado((actual) => ({
      ...actual,
      solicitudes: actual.solicitudes.map((item) => item.id === id ? actualizada : item),
      eventos: [...actual.eventos, validacion.evento, final.evento],
      mensajes: [...actual.mensajes, crearMensaje(plan.ok ? plan.candidato.nombre || plan.candidato.id : "Facilitador", plan.ok ? `Nueva oferta para la solicitud reprogramada ${id}.` : `La solicitud ${id} sigue sin candidato y requiere gestión.`)],
    }));
    dibujar();
    mostrarAviso(raiz, plan.ok ? "La solicitud reprogramada volvió a asignación." : "No hay candidato; la solicitud regresó a la bandeja de escalados.", plan.ok ? "exito" : "info");
  }

  dibujar();
}
