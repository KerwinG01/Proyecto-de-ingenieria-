import {
  actualizarCupoReciclador,
  crearParametrosPredeterminados,
  guardarParametros,
  restablecerParametros,
  validarCupoReciclador,
  validarParametros,
} from "../parametros.js";
import { escaparHtml, mostrarAviso } from "./comun.js";

export function renderizarAdministrador(raiz, contexto) {
  dibujar();

  function dibujar() {
    const estado = contexto.obtenerEstado();
    const parametros = estado.parametros || crearParametrosPredeterminados();
    const recicladores = estado.recicladores.map((reciclador) => `
      <div class="campo-cupo">
        <label for="cupo-${escaparHtml(reciclador.id)}">Cupo de ${escaparHtml(reciclador.nombre || reciclador.id)}</label>
        <input id="cupo-${escaparHtml(reciclador.id)}" name="cupo-${escaparHtml(reciclador.id)}" type="number" min="1" step="1" value="${escaparHtml(reciclador.cupo)}" required>
      </div>`).join("");

    raiz.innerHTML = `
      <section class="vista-rol" aria-labelledby="titulo-administrador">
        <header class="encabezado-vista">
          <p class="ceja">Configuración y control</p>
          <h1 id="titulo-administrador">Administrador</h1>
          <p>Edita los parámetros del prototipo. Los cambios se guardan en este navegador.</p>
        </header>
        <p class="aviso" data-aviso role="status" aria-live="polite" hidden></p>
        <form id="form-parametros" class="tarjeta formulario">
          <fieldset>
            <legend>Asignación y simulación</legend>
            <div class="rejilla-campos">
              <div><label for="param-Ta">Tiempo de espera Ta (horas)</label><input id="param-Ta" name="Ta" type="number" min="0.1" step="0.1" value="${escaparHtml(parametros.Ta)}" required></div>
              <div><label for="param-k">Máximo de intentos k</label><input id="param-k" name="k" type="number" min="1" step="1" value="${escaparHtml(parametros.k)}" required></div>
              <div><label for="param-p">Probabilidad p (simulación)</label><input id="param-p" name="p" type="number" min="0" max="1" step="0.01" value="${escaparHtml(parametros.p)}" required></div>
              <div><label for="param-distancia">Radio adyacente (km)</label><input id="param-distancia" name="distanciaAdyacenciaKm" type="number" min="0" step="0.1" value="${escaparHtml(parametros.distanciaAdyacenciaKm)}" required></div>
            </div>
          </fieldset>
          <fieldset>
            <legend>Volumen y cantidad</legend>
            <div class="rejilla-campos">
              <div><label for="param-volumen">Volumen por bolsa (m³)</label><input id="param-volumen" name="volumenBolsa" type="number" min="0.001" step="0.001" value="${escaparHtml(parametros.volumenBolsa)}" required></div>
              <div><label for="param-qv">Qv (m³)</label><input id="param-qv" name="Qv" type="number" min="0.01" step="0.01" value="${escaparHtml(parametros.Qv)}" required></div>
              <div><label for="param-vmax">Vmax (viajes)</label><input id="param-vmax" name="Vmax" type="number" min="0.1" step="0.1" value="${escaparHtml(parametros.Vmax)}" required></div>
              <div><label for="param-bolsas-min">Mínimo de bolsas</label><input id="param-bolsas-min" name="bolsasMin" type="number" min="1" step="1" value="${escaparHtml(parametros.bolsasMin)}" required></div>
              <div><label for="param-bolsas-max">Máximo de bolsas</label><input id="param-bolsas-max" name="bolsasMax" type="number" min="1" step="1" value="${escaparHtml(parametros.bolsasMax)}" required></div>
            </div>
          </fieldset>
          <fieldset>
            <legend>Pesos del puntaje (la suma debe ser 1)</legend>
            <div class="rejilla-campos">
              <div><label for="peso-P">P · proximidad</label><input id="peso-P" name="pesoP" type="number" min="0" max="1" step="0.01" value="${escaparHtml(parametros.pesos.P)}" required></div>
              <div><label for="peso-H">H · cupo disponible</label><input id="peso-H" name="pesoH" type="number" min="0" max="1" step="0.01" value="${escaparHtml(parametros.pesos.H)}" required></div>
              <div><label for="peso-E">E · experiencia</label><input id="peso-E" name="pesoE" type="number" min="0" max="1" step="0.01" value="${escaparHtml(parametros.pesos.E)}" required></div>
              <div><label for="peso-R">R · confiabilidad</label><input id="peso-R" name="pesoR" type="number" min="0" max="1" step="0.01" value="${escaparHtml(parametros.pesos.R)}" required></div>
            </div>
          </fieldset>
          <fieldset>
            <legend>Materiales y cupos</legend>
            <label for="param-materiales">Materiales aceptados, separados por coma</label>
            <input id="param-materiales" name="materialesAceptados" value="${escaparHtml(parametros.materialesAceptados.join(", "))}" required>
            <div class="rejilla-campos">${recicladores || "<p>No hay recicladores registrados.</p>"}</div>
          </fieldset>
          <div class="acciones">
            <button class="boton primario" type="submit">Guardar parámetros</button>
            <button class="boton secundario" type="button" id="restaurar-parametros">Restablecer parámetros base</button>
          </div>
        </form>
        <section class="tarjeta bloque-proximamente" aria-labelledby="indicadores-titulo">
          <h2 id="indicadores-titulo">Indicadores y modo de prueba</h2>
          <p>El panel de indicadores corresponde a E6 y las simulaciones al modo de prueba de E7.</p>
        </section>
      </section>`;

    raiz.querySelector("#form-parametros").addEventListener("submit", guardar);
    raiz.querySelector("#restaurar-parametros").addEventListener("click", restaurar);
  }

  function leerFormulario(formulario) {
    const valor = (nombre) => Number(formulario.elements[nombre].value);
    return {
      Ta: valor("Ta"),
      k: valor("k"),
      p: valor("p"),
      distanciaAdyacenciaKm: valor("distanciaAdyacenciaKm"),
      volumenBolsa: valor("volumenBolsa"),
      Qv: valor("Qv"),
      Vmax: valor("Vmax"),
      bolsasMin: valor("bolsasMin"),
      bolsasMax: valor("bolsasMax"),
      pesos: { P: valor("pesoP"), H: valor("pesoH"), E: valor("pesoE"), R: valor("pesoR") },
      materialesAceptados: formulario.elements.materialesAceptados.value.split(",").map((material) => material.trim()).filter(Boolean),
    };
  }

  function guardar(evento) {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    if (!formulario.reportValidity()) return;
    const estado = contexto.obtenerEstado();
    const nuevosParametros = leerFormulario(formulario);
    const validacion = validarParametros(nuevosParametros);
    if (!validacion.valida) {
      return mostrarAviso(raiz, validacion.errores.map((error) => error.mensaje).join(" "), "error");
    }

    let nuevosRecicladores = estado.recicladores;
    for (const reciclador of estado.recicladores) {
      const campo = formulario.elements[`cupo-${reciclador.id}`];
      const validacionCupo = validarCupoReciclador(campo?.value);
      if (!validacionCupo.valido) {
        return mostrarAviso(raiz, `El cupo de ${reciclador.nombre || reciclador.id} debe ser un entero mayor que cero.`, "error");
      }
      const cambio = actualizarCupoReciclador(nuevosRecicladores, reciclador.id, validacionCupo.cupo);
      if (!cambio.ok) return mostrarAviso(raiz, cambio.mensaje || "No se pudo actualizar un cupo.", "error");
      nuevosRecicladores = cambio.recicladores;
    }

    const guardado = guardarParametros(validacion.parametros);
    if (!guardado.ok) return mostrarAviso(raiz, guardado.mensaje || "Revisa los parámetros indicados.", "error");
    contexto.actualizarEstado((actual) => ({ ...actual, parametros: guardado.parametros, recicladores: nuevosRecicladores }));
    dibujar();
    mostrarAviso(raiz, "Los parámetros y cupos quedaron guardados.", "exito");
  }

  function restaurar() {
    const guardado = restablecerParametros();
    if (!guardado.ok) return mostrarAviso(raiz, guardado.mensaje || "No se pudieron restablecer los parámetros.", "error");
    contexto.actualizarEstado((actual) => ({ ...actual, parametros: guardado.parametros }));
    dibujar();
    mostrarAviso(raiz, "Se restauraron los parámetros globales base. Los cupos individuales se conservaron.", "exito");
  }
}
