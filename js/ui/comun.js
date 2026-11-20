/** Funciones de presentación compartidas por las vistas. */
import { fechaSabadoDesde } from "../utilidades.js";

export function escaparHtml(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function textoEstado(estado) {
  const etiquetas = {
    REGISTRADA: "Registrada",
    VALIDADA: "Validada",
    ASIGNADA: "Oferta enviada",
    CONFIRMADA: "Confirmada",
    EN_ESPERA: "En espera",
    SIN_DISPONIBILIDAD: "Sin disponibilidad · escalada",
    ATENDIDA: "Atendida",
    FALLIDA: "Fallida",
    CANCELADA: "Cancelada",
    REPROGRAMADA: "Reprogramada",
  };
  return etiquetas[estado] || estado || "Sin estado";
}

export function fechaLegible(fecha) {
  if (!fecha) return "Fecha pendiente";
  const valor = new Date(fecha);
  if (Number.isNaN(valor.getTime())) return String(fecha);
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(valor);
}

/** Devuelve la fecha local del sábado más próximo, incluido hoy si ya es sábado. */
export function fechaSabadoProximo() {
  return fechaSabadoDesde(new Date());
}

export function mostrarAviso(contenedor, texto, tipo = "info") {
  const aviso = contenedor.querySelector("[data-aviso]");
  if (!aviso) return;
  aviso.textContent = texto;
  aviso.className = `aviso aviso--${tipo}`;
  aviso.hidden = texto === "";
}
