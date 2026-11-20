/** Persistencia y datos de demostración compartidos por las vistas. */
import { crearEstadoInicial } from "../modelo.js";
import { leerParametros } from "../parametros.js";
import { crearEstadoPiloto } from "../datos-piloto.js";
import { fechaSabadoDesde } from "../utilidades.js";

export const CLAVE_ESTADO = "ciudadVerde.estado.v1";

function sabadoDeRegistro(solicitudId, eventos) {
  const evento = eventos.find((item) => item.solicitudId === solicitudId && ["REGISTRADA", "VALIDADA"].includes(item.estadoNuevo));
  return evento ? fechaSabadoDesde(evento.fecha) : null;
}

/** Estado base de la demostración, con los parámetros guardados en este navegador. */
export function crearDatosIniciales() {
  return crearEstadoPiloto(leerParametros().parametros);
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
