import {
  actualizarCupoReciclador,
  crearParametrosPredeterminados,
  guardarParametros,
  restablecerParametros,
  validarCupoReciclador,
  validarParametros,
} from "../parametros.js";
import { escaparHtml, mostrarAviso } from "./comun.js";
import { calcularIndicadores, evaluarMetas } from "../indicadores.js";
import { calcularTasaConfiabilidad } from "../motor.js";
import { crearEscenarioPrueba } from "../escenario-prueba.js";
import { crearDatosIniciales } from "./servicios.js";
import { descartarKpiCalculados, renderizarModoPrueba } from "./modo-prueba.js";
import { borrarCuentasDemo } from "./autenticacion.js";

export function renderizarAdministrador(raiz, contexto) {
  dibujar();

  function dibujar() {
    const estado = contexto.obtenerEstado();
    const parametros = estado.parametros || crearParametrosPredeterminados();
    const indicadores = calcularIndicadores(estado);
    const recicladores = estado.recicladores.map((reciclador) => {
      const finalizadas = estado.solicitudes.filter((solicitud) =>
        solicitud.recicladorId === reciclador.id && ["ATENDIDA", "FALLIDA"].includes(solicitud.estado)
      ).length;
      return `
      <div class="campo-cupo">
        <label for="cupo-${escaparHtml(reciclador.id)}">Cupo de ${escaparHtml(reciclador.nombre || reciclador.id)}</label>
        <input id="cupo-${escaparHtml(reciclador.id)}" name="cupo-${escaparHtml(reciclador.id)}" type="number" min="1" step="1" value="${escaparHtml(reciclador.cupo)}" required>
        <p><strong>Confiabilidad:</strong> ${(calcularTasaConfiabilidad(reciclador, estado.solicitudes) * 100).toFixed(1)} %</p>
        <p class="texto-ayuda">Resultados cerrados usados: ${finalizadas} (atendidas + fallidas).</p>
      </div>`;
    }).join("");

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
            <p class="texto-ayuda">La confiabilidad se calcula automáticamente como atendidas / (atendidas + fallidas). Si aún no hay resultados cerrados, se conserva el valor inicial de 0,70.</p>
            <div class="rejilla-campos">${recicladores || "<p>No hay recicladores registrados.</p>"}</div>
          </fieldset>
          <div class="acciones">
            <button class="boton primario" type="submit">Guardar parámetros</button>
            <button class="boton secundario" type="button" id="restaurar-parametros">Restablecer parámetros base</button>
          </div>
        </form>
        ${dibujarDatosDemo(estado)}
        <section class="seccion-indicadores" aria-labelledby="indicadores-titulo">
          <header class="encabezado-vista">
            <p class="ceja">Seguimiento del piloto</p>
            <h2 id="indicadores-titulo">Indicadores del sistema</h2>
            <p>Se recalculan desde el historial de eventos guardado en este navegador.</p>
          </header>
          ${dibujarIndicadores(indicadores)}
          <div id="contenedor-modo-prueba"></div>
        </section>
      </section>`;

    raiz.querySelector("#form-parametros").addEventListener("submit", guardar);
    raiz.querySelector("#restaurar-parametros").addEventListener("click", restaurar);
    raiz.querySelector("[data-cargar-escenario]").addEventListener("click", cargarEscenario);
    raiz.querySelector("[data-restablecer-demo]").addEventListener("click", restablecerDemo);
    renderizarModoPrueba(raiz.querySelector("#contenedor-modo-prueba"), { obtenerEstado: contexto.obtenerEstado });
  }

  function porcentaje(valor) {
    return valor === null ? "No calculable: sin casos" : `${(valor * 100).toFixed(1)} %`;
  }

  function lineaMeta(fila) {
    const estado = fila.cumple === null ? "Sin datos suficientes" : fila.cumple ? "✓ Cumple" : "✕ No cumple";
    return `<p class="meta-indicador"><strong>Meta ${escaparHtml(fila.metaTexto)}:</strong> ${estado}</p>`;
  }

  function dibujarIndicadores(datos) {
    const k2 = datos.K2;
    const k3 = datos.K3;
    const k6 = datos.K6;
    const k7 = datos.K7;
    const metas = Object.fromEntries(evaluarMetas(datos).map((fila) => [fila.id, fila]));
    const grupos = k7.porMicrozona.map((grupo) => `
      <li><strong>${escaparHtml(grupo.microzona)}</strong>: ${Object.entries(grupo.conteos).map(([id, cantidad]) => `${escaparHtml(id)} = ${cantidad}`).join(" · ")}
        ${grupo.comparable ? `· CV ${porcentaje(grupo.coeficienteVariacion)}` : "· un solo reciclador, sin comparación"}</li>`).join("") || "<li>No hay recicladores registrados.</li>";
    const auditoria = k6.detalles.length ? k6.detalles.map((detalle) => `
      <li>
        Solicitud <strong>${escaparHtml(detalle.solicitudId)}</strong> · reciclador <strong>${escaparHtml(detalle.recicladorId || "sin identificar")}</strong> · ${escaparHtml(detalle.fecha)}:
        ${detalle.sinTrazabilidad ? "sin trazabilidad suficiente para recalcular compatibilidad" : detalle.compatible ? "compatible" : `incompatible: ${escaparHtml(detalle.motivos.join(" "))}`}
      </li>`).join("") : "<li>No hay eventos de asignación para auditar.</li>";

    return `
      <div class="rejilla-indicadores">
        <article class="tarjeta indicador">
          <h3>K2 · Tiempo hasta la confirmación</h3>
          <p class="valor-indicador">${k2.valor === null ? "Sin datos" : `${k2.valor.toFixed(2)} h`}</p>
          <p>Promedio de VALIDADA a CONFIRMADA. Casos incluidos: ${k2.cantidad}.</p>
          ${lineaMeta(metas.K2)}
        </article>
        <article class="tarjeta indicador">
          <h3>K3 · Resultados de solicitudes</h3>
          <p><strong>Fallidas / confirmadas:</strong> ${porcentaje(k3.fallidaSobreConfirmada.valor)} (${k3.fallidaSobreConfirmada.numerador}/${k3.fallidaSobreConfirmada.denominador})</p>
          ${lineaMeta(metas.K3a)}
          <p><strong>Canceladas / registradas:</strong> ${porcentaje(k3.canceladaSobreRegistrada.valor)} (${k3.canceladaSobreRegistrada.numerador}/${k3.canceladaSobreRegistrada.denominador})</p>
          ${lineaMeta(metas.K3b)}
        </article>
        <article class="tarjeta indicador">
          <h3>K6 · Auditoría de asignaciones</h3>
          <p><strong>Asignaciones revisadas:</strong> ${k6.totalAsignaciones}</p>
          <p><strong>Incompatibles:</strong> ${k6.incompatibles} · <strong>Duplicadas:</strong> ${k6.duplicadas} · <strong>Sin trazabilidad:</strong> ${k6.sinTrazabilidad}</p>
          ${lineaMeta(metas.K6)}
          <details><summary>Ver revisión por solicitud</summary><ul class="lista-auditoria">${auditoria}</ul></details>
        </article>
        <article class="tarjeta indicador">
          <h3>K7 · Equilibrio de asignaciones</h3>
          <p><strong>CV de la microzona menos equitativa:</strong> ${porcentaje(k7.coeficienteVariacion)}${k7.microzonaCritica ? ` (${escaparHtml(k7.microzonaCritica)})` : ""}</p>
          <p class="texto-ayuda">Se compara solo entre recicladores de la misma microzona, porque compiten por la misma demanda.</p>
          <ul>${grupos}</ul>
          ${lineaMeta(metas.K7)}
        </article>
      </div>`;
  }

  function dibujarDatosDemo(estado) {
    return `
      <section class="tarjeta" aria-labelledby="datos-demo-titulo">
        <h2 id="datos-demo-titulo">Datos de demostración</h2>
        <p>Este navegador guarda ${estado.solicitudes.length} solicitudes y ${estado.eventos.length} eventos.</p>
        <p class="texto-ayuda">El escenario de prueba crea una solicitud por caso (CP-01 a CP-04, CAS-01, CAS-02a, CAS-02b) más solicitudes confirmadas, atendidas, fallidas y canceladas, usando el mismo motor. Ambas acciones reemplazan los datos guardados en este navegador.</p>
        <div class="acciones">
          <button class="boton primario" type="button" data-cargar-escenario>Cargar escenario de prueba</button>
          <button class="boton peligro" type="button" data-restablecer-demo>Restablecer datos base</button>
        </div>
      </section>`;
  }

  function cargarEscenario() {
    const actual = contexto.obtenerEstado();
    if (!window.confirm("¿Reemplazar los datos guardados en este navegador por el escenario de prueba?")) return;
    const { estado } = crearEscenarioPrueba({ parametros: actual.parametros });
    descartarKpiCalculados();
    contexto.actualizarEstado(() => ({ ...estado, parametros: actual.parametros }));
    mostrarAviso(raiz, `Escenario de prueba cargado: ${estado.solicitudes.length} solicitudes. Revísalo en las vistas de Reciclador y Facilitador.`, "exito");
  }

  function restablecerDemo() {
    if (!window.confirm("¿Borrar las solicitudes, eventos, mensajes, hogares registrados y cuentas demo de este navegador y volver a los datos base?")) return;
    descartarKpiCalculados();
    borrarCuentasDemo();
    contexto.actualizarEstado(() => crearDatosIniciales());
    mostrarAviso(raiz, "Se restablecieron los datos base de la demostración.", "exito");
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
