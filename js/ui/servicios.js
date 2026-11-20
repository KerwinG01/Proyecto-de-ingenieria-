/** Persistencia y datos de demostración compartidos por las vistas. */
import { crearEstadoInicial, crearHogar, crearReciclador } from "../modelo.js";
import { leerParametros } from "../parametros.js";

export const CLAVE_ESTADO = "ciudadVerde.estado.v1";

function sabadoDeRegistro(solicitudId, eventos) {
  const evento = eventos.find((item) => item.solicitudId === solicitudId && ["REGISTRADA", "VALIDADA"].includes(item.estadoNuevo));
  const marca = evento ? new Date(evento.fecha) : null;
  if (!marca || Number.isNaN(marca.getTime())) return null;
  marca.setHours(0, 0, 0, 0);
  marca.setDate(marca.getDate() + ((6 - marca.getDay() + 7) % 7));
  const anio = marca.getFullYear();
  const mes = String(marca.getMonth() + 1).padStart(2, "0");
  const dia = String(marca.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

function crearDatosIniciales() {
  const configuracion = leerParametros().parametros;
  const estado = crearEstadoInicial(configuracion);
  estado.hogares = [
    crearHogar({
      id: "H-001",
      microzona: "San Eduardo",
      alias: "Hogar de demostración",
      referenciaEntrega: "Referencia por confirmar",
      consentimiento: true,
    }),
  ];
  estado.recicladores = [
    crearReciclador({
      id: "R1", nombre: "Reciclador R1", microzona: "San Eduardo",
      materiales: ["papel", "plástico", "vidrio", "metal"],
      franja: { dia: "sábado", inicio: "08:00", fin: "12:00" }, cupo: 26,
    }),
    crearReciclador({
      id: "R2", nombre: "Reciclador R2", microzona: "San Eduardo",
      materiales: ["papel", "plástico", "metal"],
      franja: { dia: "sábado", inicio: "08:00", fin: "12:00" }, cupo: 26,
    }),
    crearReciclador({
      id: "R3", nombre: "Reciclador R3", microzona: "San Eduardo",
      materiales: ["papel", "plástico", "vidrio", "metal"],
      franja: { dia: "sábado", inicio: "08:00", fin: "12:00" }, cupo: 26,
    }),
    crearReciclador({
      id: "R4", nombre: "Reciclador R4", microzona: "Ciudad Jardín",
      materiales: ["papel", "plástico", "vidrio", "metal"],
      franja: { dia: "sábado", inicio: "08:00", fin: "12:00" }, cupo: 26,
    }),
  ];
  estado.distanciasKm = {};
  return estado;
}

/** Carga estado persistido o crea una base de demostración para el piloto. */
export function leerEstado(almacen = null) {
  let destino = almacen;
  if (!destino) {
    try {
      destino = globalThis.localStorage;
    } catch {
      destino = null;
    }
  }

  if (!destino) return { estado: crearDatosIniciales(), aviso: "El navegador no ofrece almacenamiento local." };
  try {
    const contenido = destino.getItem(CLAVE_ESTADO);
    if (contenido === null) return { estado: crearDatosIniciales(), aviso: null };
    const guardado = JSON.parse(contenido);
    const base = crearEstadoInicial(leerParametros().parametros);
    const eventos = Array.isArray(guardado.eventos) ? guardado.eventos : [];
    const estado = {
      ...base,
      ...guardado,
      hogares: Array.isArray(guardado.hogares) ? guardado.hogares : [],
      recicladores: Array.isArray(guardado.recicladores) ? guardado.recicladores.map((reciclador) => ({
        ...reciclador,
        ...(reciclador.id === "R4" ? { nombre: "Reciclador R4" } : {}),
      })) : [],
      solicitudes: Array.isArray(guardado.solicitudes) ? guardado.solicitudes.map((solicitud) => ({
        ...solicitud,
        fechaServicio: solicitud.fechaServicio || sabadoDeRegistro(solicitud.id, eventos),
      })) : [],
      eventos,
      mensajes: Array.isArray(guardado.mensajes) ? guardado.mensajes : [],
      distanciasKm: guardado.distanciasKm && typeof guardado.distanciasKm === "object" ? guardado.distanciasKm : {},
      parametros: leerParametros().parametros,
    };
    return { estado, aviso: null };
  } catch {
    return { estado: crearDatosIniciales(), aviso: "No se pudo leer el estado guardado; se cargó la base de demostración." };
  }
}

export function guardarEstado(estado, almacen = null) {
  let destino = almacen;
  if (!destino) {
    try {
      destino = globalThis.localStorage;
    } catch {
      destino = null;
    }
  }
  if (!destino) return { ok: false, mensaje: "El almacenamiento local no está disponible." };
  try {
    destino.setItem(CLAVE_ESTADO, JSON.stringify(estado));
    return { ok: true };
  } catch {
    return { ok: false, mensaje: "No se pudo guardar el estado en este navegador." };
  }
}

export function crearId(prefijo) {
  if (globalThis.crypto?.randomUUID) return `${prefijo}-${globalThis.crypto.randomUUID()}`;
  return `${prefijo}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function fechaActualIso() {
  return new Date().toISOString();
}

export function crearMensaje(destinatario, texto) {
  return { destinatario, texto, fecha: fechaActualIso() };
}
