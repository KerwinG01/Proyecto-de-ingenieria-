import { renderizarCiudadano } from "./ciudadano.js";
import { renderizarReciclador } from "./reciclador.js";
import { renderizarFacilitador } from "./facilitador.js";
import { renderizarAdministrador } from "./administrador.js";
import { renderizarAutenticacion } from "./autenticacion.js";
import { guardarEstado, leerEstado } from "./servicios.js";
import { escaparHtml, fechaLegible } from "./comun.js";

const elementoVista = document.querySelector("#vista");
const selectorRol = document.querySelector("#selector-rol");
const avisoAplicacion = document.querySelector("#aviso-aplicacion");
const bandejaMensajes = document.querySelector("#mensajes-simulados");
const estadoInicial = leerEstado();
let estado = estadoInicial.estado;
let panelCuenta = null;
let rolActivo = selectorRol.value;

const vistas = {
  ciudadano: renderizarCiudadano,
  reciclador: renderizarReciclador,
  facilitador: renderizarFacilitador,
  administrador: renderizarAdministrador,
};

function anunciar(texto, tipo = "info") {
  avisoAplicacion.textContent = texto;
  avisoAplicacion.className = `aviso aviso--${tipo}`;
  avisoAplicacion.hidden = texto === "";
}

function dibujarBandeja() {
  const mensajes = [...estado.mensajes].reverse();
  bandejaMensajes.innerHTML = mensajes.length
    ? mensajes.slice(0, 30).map((mensaje) => `
      <li class="mensaje-simulado">
        <strong>${escaparHtml(mensaje.destinatario)}</strong>
        <span>${escaparHtml(mensaje.texto)}</span>
        <time>${escaparHtml(fechaLegible(mensaje.fecha))}</time>
      </li>`).join("")
    : "<li class='mensaje-simulado'><span>No hay mensajes simulados todavía.</span></li>";
}

function dibujarVista() {
  if (panelCuenta) {
    renderizarAutenticacion(elementoVista, {
      seleccionarPanel: (panel) => { selectorRol.value = `cuenta-${panel}`; },
      cerrar: () => {
        panelCuenta = null;
        selectorRol.value = rolActivo;
        dibujarVista();
      },
    }, panelCuenta);
    return;
  }

  const renderizar = vistas[selectorRol.value] || renderizarCiudadano;
  const contexto = {
    obtenerEstado: () => estado,
    actualizarEstado: (actualizador) => {
      const siguiente = actualizador(estado);
      estado = siguiente;
      const resultado = guardarEstado(estado);
      if (!resultado.ok) anunciar(resultado.mensaje, "error");
      else anunciar("Cambios guardados en este navegador.", "exito");
      dibujarBandeja();
      dibujarVista();
    },
  };
  renderizar(elementoVista, contexto);
}

selectorRol.addEventListener("change", () => {
  if (selectorRol.value.startsWith("cuenta-")) {
    panelCuenta = selectorRol.value.replace("cuenta-", "");
    anunciar(`Vista demo: ${panelCuenta === "registro" ? "crear usuario" : panelCuenta === "login" ? "iniciar sesión" : "perfil"}.`, "info");
    dibujarVista();
    return;
  }
  rolActivo = selectorRol.value;
  panelCuenta = null;
  anunciar("Rol simulado cambiado. No se requiere autenticación.", "info");
  dibujarVista();
});

dibujarBandeja();
dibujarVista();
if (estadoInicial.aviso) anunciar(estadoInicial.aviso, "info");
