/**
 * Parámetros predeterminados, validación y persistencia local.
 * La validación y normalización son funciones puras; solo leer/guardar usa storage.
 */

export const CLAVE_PARAMETROS = "ciudadVerde.parametros.v1";

export const PARAMETROS_POR_DEFECTO = Object.freeze({
  Ta: 2,
  k: 3,
  pesos: Object.freeze({ P: 0.40, H: 0.30, E: 0.20, R: 0.10 }),
  volumenBolsa: 0.073,
  Qv: 1.5,
  Vmax: 2,
  materialesAceptados: Object.freeze(["papel", "plástico", "vidrio", "metal"]),
  bolsasMin: 1,
  bolsasMax: 4,
  p: 0.70,
  distanciaAdyacenciaKm: 2,
});

function normalizarTexto(valor) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("es");
}

/** Devuelve una copia nueva de la configuración base. */
export function crearParametrosPredeterminados() {
  return {
    ...PARAMETROS_POR_DEFECTO,
    pesos: { ...PARAMETROS_POR_DEFECTO.pesos },
    materialesAceptados: [...PARAMETROS_POR_DEFECTO.materialesAceptados],
  };
}

/** Completa propiedades omitidas con los valores base y copia objetos anidados. */
export function normalizarParametros(parametros = {}) {
  const entrada = parametros && typeof parametros === "object" ? parametros : {};
  const pesosEntrada = entrada.pesos;
  const materialesEntrada = entrada.materialesAceptados;
  return {
    ...crearParametrosPredeterminados(),
    ...entrada,
    pesos: pesosEntrada === undefined
      ? { ...PARAMETROS_POR_DEFECTO.pesos }
      : pesosEntrada && typeof pesosEntrada === "object" && !Array.isArray(pesosEntrada)
        ? { ...PARAMETROS_POR_DEFECTO.pesos, ...pesosEntrada }
        : pesosEntrada,
    materialesAceptados: materialesEntrada === undefined
      ? [...PARAMETROS_POR_DEFECTO.materialesAceptados]
      : Array.isArray(materialesEntrada) ? [...materialesEntrada] : materialesEntrada,
  };
}

/** Valida parámetros y entrega errores por campo, sin guardar ni modificar datos. */
export function validarParametros(parametros) {
  if (!parametros || typeof parametros !== "object" || Array.isArray(parametros)) {
    return {
      valida: false,
      errores: [{ campo: "parametros", codigo: "OBJETO_INVALIDO", mensaje: "Los parámetros deben recibirse como un objeto." }],
      parametros: crearParametrosPredeterminados(),
    };
  }
  const config = normalizarParametros(parametros);
  const errores = [];
  const error = (campo, codigo, mensaje) => errores.push({ campo, codigo, mensaje });

  if (!Number.isFinite(config.Ta) || config.Ta <= 0) {
    error("Ta", "VALOR_INVALIDO", "Ta debe ser un número de horas mayor que cero.");
  }
  if (!Number.isInteger(config.k) || config.k < 1) {
    error("k", "VALOR_INVALIDO", "k debe ser un entero mayor o igual a 1.");
  }

  const pesosConFormaValida = config.pesos && typeof config.pesos === "object" && !Array.isArray(config.pesos);
  if (!pesosConFormaValida) {
    error("pesos", "OBJETO_INVALIDO", "Los pesos P, H, E y R deben enviarse como un objeto.");
  } else {
    for (const componente of ["P", "H", "E", "R"]) {
      const peso = config.pesos[componente];
      if (!Number.isFinite(peso) || peso < 0 || peso > 1) {
        error(`pesos.${componente}`, "PESO_INVALIDO", "Cada peso debe estar entre 0 y 1.");
      }
    }
  }
  const sumaPesos = ["P", "H", "E", "R"].reduce((suma, componente) => suma + Number(config.pesos?.[componente]), 0);
  if (pesosConFormaValida && ["P", "H", "E", "R"].every((componente) => Number.isFinite(config.pesos[componente])) &&
      Math.abs(sumaPesos - 1) > 1e-9) {
    error("pesos", "SUMA_PESOS_INVALIDA", "La suma de los pesos P, H, E y R debe ser 1.");
  }

  for (const campo of ["volumenBolsa", "Qv", "Vmax"]) {
    if (!Number.isFinite(config[campo]) || config[campo] <= 0) {
      error(campo, "VALOR_INVALIDO", `${campo} debe ser un número mayor que cero.`);
    }
  }

  if (!Number.isInteger(config.bolsasMin) || config.bolsasMin < 1) {
    error("bolsasMin", "VALOR_INVALIDO", "El mínimo de bolsas debe ser un entero de al menos 1.");
  }
  if (!Number.isInteger(config.bolsasMax) || config.bolsasMax < config.bolsasMin) {
    error("bolsasMax", "VALOR_INVALIDO", "El máximo de bolsas debe ser un entero igual o mayor que el mínimo.");
  }

  if (!Number.isFinite(config.p) || config.p < 0 || config.p > 1) {
    error("p", "VALOR_INVALIDO", "La probabilidad p debe estar entre 0 y 1.");
  }
  if (!Number.isFinite(config.distanciaAdyacenciaKm) || config.distanciaAdyacenciaKm < 0) {
    error("distanciaAdyacenciaKm", "VALOR_INVALIDO", "La distancia de adyacencia debe ser un número igual o mayor que cero.");
  }

  if (!Array.isArray(config.materialesAceptados) || config.materialesAceptados.length === 0) {
    error("materialesAceptados", "LISTA_INVALIDA", "Debe existir al menos un material aceptado.");
  } else {
    if (config.materialesAceptados.some((material) => typeof material !== "string")) {
      error("materialesAceptados", "TIPO_INVALIDO", "Cada material debe ser texto.");
    }
    const materialesNormalizados = config.materialesAceptados.map(normalizarTexto);
    if (materialesNormalizados.some((material) => material === "")) {
      error("materialesAceptados", "MATERIAL_VACIO", "La lista no puede contener materiales vacíos.");
    }
    if (new Set(materialesNormalizados).size !== materialesNormalizados.length) {
      error("materialesAceptados", "MATERIAL_DUPLICADO", "La lista no puede repetir materiales.");
    }
  }

  return { valida: errores.length === 0, errores, parametros: config };
}

/** Valida el cupo individual de un reciclador (entero positivo). */
export function validarCupoReciclador(cupo) {
  const valor = Number(cupo);
  const errores = Number.isInteger(valor) && valor > 0
    ? []
    : [{ campo: "cupo", codigo: "CUPO_INVALIDO", mensaje: "El cupo debe ser un entero mayor que cero." }];
  return { valido: errores.length === 0, errores, cupo: valor };
}

/** Devuelve una copia de la lista con el cupo de un reciclador actualizado. */
export function actualizarCupoReciclador(recicladores, recicladorId, nuevoCupo) {
  const validacion = validarCupoReciclador(nuevoCupo);
  if (!validacion.valido) return { ok: false, codigo: "CUPO_INVALIDO", errores: validacion.errores };
  if (!Array.isArray(recicladores)) {
    return { ok: false, codigo: "LISTA_INVALIDA", mensaje: "Se esperaba una lista de recicladores." };
  }

  const existe = recicladores.some((reciclador) => reciclador.id === recicladorId);
  if (!existe) {
    return { ok: false, codigo: "RECICLADOR_NO_ENCONTRADO", mensaje: "No existe un reciclador con ese identificador." };
  }

  return {
    ok: true,
    recicladores: recicladores.map((reciclador) => reciclador.id === recicladorId
      ? { ...reciclador, cupo: validacion.cupo }
      : { ...reciclador }),
  };
}

function obtenerAlmacen(almacen) {
  if (almacen) return almacen;
  try {
    if (typeof globalThis !== "undefined" && globalThis.localStorage) return globalThis.localStorage;
  } catch {
    return null;
  }
  return null;
}

/** Lee parámetros; ante JSON inválido o datos no válidos usa los valores base. */
export function leerParametros(almacen = null) {
  const destino = obtenerAlmacen(almacen);
  if (!destino) {
    return {
      parametros: crearParametrosPredeterminados(),
      origen: "predeterminados",
      aviso: "El almacenamiento local no está disponible en este navegador.",
    };
  }

  try {
    const guardados = destino.getItem(CLAVE_PARAMETROS);
    if (guardados === null) {
      return { parametros: crearParametrosPredeterminados(), origen: "predeterminados", aviso: null };
    }
    const parseados = JSON.parse(guardados);
    const validacion = validarParametros(parseados);
    if (!validacion.valida) {
      return {
        parametros: crearParametrosPredeterminados(),
        origen: "predeterminados",
        aviso: "Los parámetros guardados no son válidos; se cargó la configuración base.",
      };
    }
    return { parametros: validacion.parametros, origen: "localStorage", aviso: null };
  } catch {
    return {
      parametros: crearParametrosPredeterminados(),
      origen: "predeterminados",
      aviso: "No se pudieron leer los parámetros guardados; se cargó la configuración base.",
    };
  }
}

/** Valida y guarda parámetros; permite inyectar un storage para facilitar pruebas. */
export function guardarParametros(parametros, almacen = null) {
  const validacion = validarParametros(parametros);
  if (!validacion.valida) {
    return { ok: false, codigo: "PARAMETROS_INVALIDOS", errores: validacion.errores };
  }

  const destino = obtenerAlmacen(almacen);
  if (!destino) {
    return { ok: false, codigo: "ALMACEN_NO_DISPONIBLE", mensaje: "El almacenamiento local no está disponible." };
  }

  try {
    destino.setItem(CLAVE_PARAMETROS, JSON.stringify(validacion.parametros));
    return { ok: true, parametros: validacion.parametros };
  } catch {
    return { ok: false, codigo: "ERROR_AL_GUARDAR", mensaje: "No se pudieron guardar los parámetros." };
  }
}

/** Restablece y guarda los parámetros predeterminados. */
export function restablecerParametros(almacen = null) {
  return guardarParametros(crearParametrosPredeterminados(), almacen);
}
