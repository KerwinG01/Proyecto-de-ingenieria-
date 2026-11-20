import { crearSolicitud } from "../modelo.js";
import { asignarSolicitud, validarSolicitud } from "../motor.js";
import { transicionarEstado } from "../estados.js";
import { crearId, crearMensaje, fechaActualIso } from "./servicios.js";
import { escaparHtml, fechaLegible, textoEstado, mostrarAviso } from "./comun.js";

const FRANJA_PILOTO = { dia: "sábado", inicio: "08:00", fin: "12:00" };

export function renderizarCiudadano(raiz, contexto) {
  let pestaña = "nueva";
  let paso = 1;
  const formulario = { hogarId: "", materiales: [], bolsas: 1 };
  const hoy = () => fechaActualIso();

  function dibujar() {
    const estado = contexto.obtenerEstado();
    const hogares = estado.hogares;
    if (!formulario.hogarId && hogares.length) formulario.hogarId = hogares[0].id;
    raiz.innerHTML = `
      <section class="vista-rol" aria-labelledby="titulo-ciudadano">
        <header class="encabezado-vista">
          <p class="ceja">Portal comunitario</p>
          <h1 id="titulo-ciudadano">Ciudadano</h1>
          <p>Solicita la recolección y consulta su seguimiento.</p>
        </header>
        <nav class="pestañas" aria-label="Opciones del ciudadano">
          <button type="button" class="boton-pestaña ${pestaña === "nueva" ? "activo" : ""}" data-pestaña="nueva">Nueva solicitud</button>
          <button type="button" class="boton-pestaña ${pestaña === "mis" ? "activo" : ""}" data-pestaña="mis">Mis solicitudes</button>
        </nav>
        <p class="aviso" data-aviso role="status" aria-live="polite" hidden></p>
        <div id="contenido-ciudadano"></div>
      </section>`;

    raiz.querySelectorAll("[data-pestaña]").forEach((boton) => {
      boton.addEventListener("click", () => {
        pestaña = boton.dataset.pestaña;
        paso = 1;
        dibujar();
      });
    });

    if (pestaña === "nueva") dibujarFormulario(estado);
    else dibujarSolicitudes(estado);
  }

  function dibujarFormulario(estado) {
    const contenido = raiz.querySelector("#contenido-ciudadano");
    const opcionesHogar = estado.hogares.map((hogar) =>
      `<option value="${escaparHtml(hogar.id)}" ${hogar.id === formulario.hogarId ? "selected" : ""}>${escaparHtml(hogar.alias)} · ${escaparHtml(hogar.microzona)}</option>`
    ).join("");
    let cuerpo = "";

    if (paso === 1) {
      cuerpo = `
        <section class="tarjeta paso" aria-labelledby="paso-titulo">
          <p class="ceja">Paso 1 de 3</p>
          <h2 id="paso-titulo">Elige el hogar</h2>
          ${opcionesHogar ? `
            <label for="hogar-ciudadano">Hogar asociado</label>
            <select id="hogar-ciudadano" name="hogarId">${opcionesHogar}</select>
            <p class="texto-ayuda">El acceso es simulado; selecciona el hogar que usarás para esta demostración.</p>
            <button class="boton primario" type="button" data-siguiente>Continuar</button>` :
            `<p>No hay hogares registrados. Solicita al facilitador que registre uno primero.</p>`}
        </section>`;
    } else if (paso === 2) {
      const casillas = estado.parametros.materialesAceptados.map((material) => `
        <label class="opcion-material">
          <input type="checkbox" name="material" value="${material}" ${formulario.materiales.includes(material) ? "checked" : ""}>
          <span>${material[0].toUpperCase()}${material.slice(1)}</span>
        </label>`).join("");
      cuerpo = `
        <section class="tarjeta paso" aria-labelledby="paso-titulo">
          <p class="ceja">Paso 2 de 3</p>
          <h2 id="paso-titulo">Materiales y cantidad</h2>
          <fieldset class="grupo-materiales"><legend>Selecciona uno o más materiales</legend>${casillas}</fieldset>
          <label for="cantidad-bolsas">Cantidad de bolsas (1 a 4)</label>
          <input id="cantidad-bolsas" name="bolsas" type="number" min="1" max="4" step="1" value="${formulario.bolsas}" required>
          <div class="acciones">
            <button class="boton secundario" type="button" data-anterior>Volver</button>
            <button class="boton primario" type="button" data-siguiente>Continuar</button>
          </div>
        </section>`;
    } else {
      const hogar = estado.hogares.find((item) => item.id === formulario.hogarId);
      cuerpo = `
        <section class="tarjeta paso" aria-labelledby="paso-titulo">
          <p class="ceja">Paso 3 de 3</p>
          <h2 id="paso-titulo">Revisa y envía</h2>
          <dl class="resumen-datos">
            <dt>Hogar</dt><dd>${escaparHtml(hogar?.alias)} · ${escaparHtml(hogar?.microzona)}</dd>
            <dt>Materiales</dt><dd>${escaparHtml(formulario.materiales.join(", "))}</dd>
            <dt>Bolsas</dt><dd>${escaparHtml(formulario.bolsas)}</dd>
            <dt>Franja</dt><dd>Sábado, 8:00 a. m. a 12:00 p. m.</dd>
          </dl>
          <p class="texto-ayuda">El sistema enviará una oferta al reciclador compatible mejor puntuado.</p>
          <div class="acciones">
            <button class="boton secundario" type="button" data-anterior>Volver</button>
            <button class="boton primario" type="button" data-enviar>Enviar solicitud</button>
          </div>
        </section>`;
    }

    contenido.innerHTML = cuerpo;
    const selectorHogar = contenido.querySelector("#hogar-ciudadano");
    selectorHogar?.addEventListener("change", () => { formulario.hogarId = selectorHogar.value; });
    contenido.querySelector("[data-siguiente]")?.addEventListener("click", () => {
      if (paso === 1) {
        const seleccionado = contenido.querySelector("#hogar-ciudadano")?.value;
        const hogar = estado.hogares.find((item) => item.id === seleccionado);
        if (!hogar?.consentimiento) return mostrarAviso(raiz, "El hogar debe contar con consentimiento registrado.", "error");
        formulario.hogarId = seleccionado;
      }
      if (paso === 2) {
        formulario.materiales = [...contenido.querySelectorAll("input[name='material']:checked")].map((campo) => campo.value);
        formulario.bolsas = Number(contenido.querySelector("#cantidad-bolsas")?.value);
        if (!formulario.materiales.length) return mostrarAviso(raiz, "Selecciona al menos un material.", "error");
        if (!Number.isInteger(formulario.bolsas) || formulario.bolsas < 1 || formulario.bolsas > 4) {
          return mostrarAviso(raiz, "Indica un número entero de 1 a 4 bolsas.", "error");
        }
      }
      paso += 1;
      dibujar();
    });
    contenido.querySelector("[data-anterior]")?.addEventListener("click", () => { paso -= 1; dibujar(); });
    contenido.querySelector("[data-enviar]")?.addEventListener("click", enviarSolicitud);
  }

  function enviarSolicitud() {
    const estado = contexto.obtenerEstado();
    const hogar = estado.hogares.find((item) => item.id === formulario.hogarId);
    const nueva = crearSolicitud({
      id: crearId("SOL"),
      hogarId: formulario.hogarId,
      materiales: formulario.materiales,
      bolsas: Number(formulario.bolsas),
      franja: { ...FRANJA_PILOTO },
      estado: "REGISTRADA",
      registradaPor: "ciudadano",
      recicladorId: null,
      intentos: [],
    });
    const validacion = validarSolicitud(nueva, estado.parametros);
    if (!validacion.valida || !hogar) {
      const mensaje = validacion.errores?.map((error) => error.mensaje).join(" ") || "No se encontró el hogar.";
      return mostrarAviso(raiz, mensaje, "error");
    }

    const marca = hoy();
    const validada = transicionarEstado({ solicitud: nueva, estadoNuevo: "VALIDADA", responsable: "Sistema", fecha: marca });
    const datosParaMotor = [...estado.solicitudes, validada.solicitudActualizada];
    const plan = asignarSolicitud({
      solicitud: validada.solicitudActualizada,
      hogar,
      recicladores: estado.recicladores,
      solicitudes: datosParaMotor,
      parametros: estado.parametros,
      distanciasKm: estado.distanciasKm,
    });
    const cierre = transicionarEstado({
      solicitud: validada.solicitudActualizada,
      estadoNuevo: plan.estado,
      responsable: "Motor de asignación",
      fecha: hoy(),
      recicladorId: plan.ok ? plan.candidato.id : null,
    });
    if (!cierre.ok) return mostrarAviso(raiz, cierre.mensaje, "error");

    const solicitudFinal = { ...cierre.solicitudActualizada, ...plan.solicitudActualizada, estado: cierre.estado || plan.estado };
    solicitudFinal.estado = plan.estado;
    const mensajes = [crearMensaje(hogar.alias, `La solicitud ${nueva.id} quedó ${textoEstado(plan.estado)}.`)];
    if (plan.ok) {
      mensajes.push(crearMensaje(plan.candidato.nombre || plan.candidato.id, `Nueva oferta para la solicitud ${nueva.id}.`));
    } else {
      mensajes.push(crearMensaje("Facilitador", `La solicitud ${nueva.id} requiere gestión: ${plan.evaluaciones?.map((item) => `${item.recicladorId}: ${item.motivos.join(" ")}`).join(" | ") || "sin candidato compatible"}.`));
    }

    contexto.actualizarEstado((actual) => ({
      ...actual,
      solicitudes: [...actual.solicitudes, solicitudFinal],
      eventos: [...actual.eventos, validada.evento, cierre.evento],
      mensajes: [...actual.mensajes, ...mensajes],
    }));
    formulario.materiales = [];
    formulario.bolsas = 1;
    pestaña = "mis";
    paso = 1;
    dibujar();
    mostrarAviso(raiz, `Solicitud registrada. Estado: ${textoEstado(plan.estado)}.`, plan.ok ? "exito" : "info");
  }

  function dibujarSolicitudes(estado) {
    const contenido = raiz.querySelector("#contenido-ciudadano");
    const hogar = estado.hogares.find((item) => item.id === formulario.hogarId) || estado.hogares[0];
    if (hogar) formulario.hogarId = hogar.id;
    const opcionesHogar = estado.hogares.map((item) =>
      `<option value="${escaparHtml(item.id)}" ${item.id === hogar?.id ? "selected" : ""}>${escaparHtml(item.alias)} · ${escaparHtml(item.microzona)}</option>`
    ).join("");
    const lista = hogar ? estado.solicitudes.filter((item) => item.hogarId === hogar.id) : [];
    const tarjetas = lista.length ? lista.map((item) => `
      <article class="tarjeta solicitud">
        <div class="fila-entre"><h3>${escaparHtml(item.id)}</h3><span class="etiqueta-estado">${escaparHtml(textoEstado(item.estado))}</span></div>
        <p>${escaparHtml(item.materiales.join(", "))} · ${escaparHtml(item.bolsas)} bolsa(s)</p>
        <p>Franja: sábado, 8:00 a. m. a 12:00 p. m.</p>
        ${item.recicladorId ? `<p>Reciclador: ${escaparHtml(estado.recicladores.find((r) => r.id === item.recicladorId)?.nombre || item.recicladorId)}</p>` : ""}
        ${item.intentos?.length ? `<details><summary>Ver intentos (${item.intentos.length})</summary><ul>${item.intentos.map((intento) => `<li>${escaparHtml(intento.recicladorId)}: ${escaparHtml(intento.resultado)}${intento.motivo ? ` · Motivo: ${escaparHtml(intento.motivo)}` : ""}</li>`).join("")}</ul></details>` : ""}
        <p class="texto-ayuda">Actualizada: ${escaparHtml(fechaLegible(estado.eventos.filter((e) => e.solicitudId === item.id).at(-1)?.fecha))}</p>
        ${["REGISTRADA", "VALIDADA", "ASIGNADA", "CONFIRMADA"].includes(item.estado) ? `<button class="boton peligro" type="button" data-cancelar="${escaparHtml(item.id)}">Cancelar solicitud</button>` : ""}
      </article>`).join("") : `<div class="tarjeta"><p>Este hogar todavía no tiene solicitudes.</p></div>`;

    contenido.innerHTML = `
      <section class="seccion-lista" aria-labelledby="mis-titulo">
        <div class="tarjeta">
          <h2 id="mis-titulo">Mis solicitudes</h2>
          ${opcionesHogar ? `<label for="hogar-lista">Hogar</label><select id="hogar-lista">${opcionesHogar}</select>` : "<p>No hay hogares registrados.</p>"}
        </div>
        <div class="lista-tarjetas">${tarjetas}</div>
      </section>`;
    contenido.querySelector("#hogar-lista")?.addEventListener("change", (evento) => {
      formulario.hogarId = evento.target.value;
      dibujar();
    });
    contenido.querySelectorAll("[data-cancelar]").forEach((boton) => {
      boton.addEventListener("click", () => cancelarSolicitud(boton.dataset.cancelar));
    });
  }

  function cancelarSolicitud(id) {
    const estado = contexto.obtenerEstado();
    const solicitud = estado.solicitudes.find((item) => item.id === id);
    if (!solicitud) return;
    const resultado = transicionarEstado({
      solicitud,
      estadoNuevo: "CANCELADA",
      responsable: `Ciudadano · ${solicitud.hogarId}`,
      fecha: hoy(),
    });
    if (!resultado.ok) return mostrarAviso(raiz, resultado.mensaje, "error");
    contexto.actualizarEstado((actual) => ({
      ...actual,
      solicitudes: actual.solicitudes.map((item) => item.id === id ? resultado.solicitudActualizada : item),
      eventos: [...actual.eventos, resultado.evento],
      mensajes: [...actual.mensajes, crearMensaje("Facilitador", `La solicitud ${id} fue cancelada por el hogar.`)],
    }));
    dibujar();
    mostrarAviso(raiz, "La solicitud fue cancelada.", "exito");
  }

  dibujar();
}
