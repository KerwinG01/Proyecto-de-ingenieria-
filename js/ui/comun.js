/** Funciones de presentación compartidas por las vistas. */

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
  const fecha = new Date();
  fecha.setHours(0, 0, 0, 0);
  fecha.setDate(fecha.getDate() + ((6 - fecha.getDay() + 7) % 7));
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

export function mostrarAviso(contenedor, texto, tipo = "info") {
  const aviso = contenedor.querySelector("[data-aviso]");
  if (!aviso) return;
  aviso.textContent = texto;
  aviso.className = `aviso aviso--${tipo}`;
  aviso.hidden = texto === "";
}
