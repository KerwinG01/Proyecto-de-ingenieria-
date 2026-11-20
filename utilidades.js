/**
 * Utilidades puras compartidas por el motor, los indicadores, los experimentos y las vistas.
 * No acceden al DOM ni a localStorage.
 */

/** Franja semanal fija del piloto en San Eduardo. */
export const FRANJA_PILOTO = Object.freeze({ dia: "sábado", inicio: "08:00", fin: "12:00" });

/** Texto sin tildes, sin espacios externos y en minúsculas, para comparar valores. */
export function normalizarTexto(valor) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLocaleLowerCase("es");
}

/** Convierte "HH:MM" en minutos desde la medianoche; devuelve null si el formato no es válido. */
export function convertirAMinutos(hora) {
  if (typeof hora !== "string" || !/^\d{1,2}:\d{2}$/.test(hora)) return null;
  const [horas, minutos] = hora.split(":").map(Number);
  if (horas > 23 || minutos > 59) return null;
  return horas * 60 + minutos;
}

/** Busca la distancia conocida hogar–reciclador, solicitud–reciclador o microzona–microzona. */
export function obtenerDistanciaKm({ solicitud, hogar, reciclador, distanciasKm = {} }) {
  const claves = [
    `${hogar?.id}|${reciclador?.id}`,
    `${solicitud?.id}|${reciclador?.id}`,
    `${hogar?.microzona}|${reciclador?.microzona}`,
  ];
  for (const clave of claves) {
    const valor = distanciasKm?.[clave];
    if (valor !== null && valor !== undefined && valor !== "" && Number.isFinite(Number(valor))) {
      return Number(valor);
    }
  }
  return null;
}

/** Fecha AAAA-MM-DD (hora local) del sábado igual o posterior a la fecha base. */
export function fechaSabadoDesde(base = new Date()) {
  const fecha = new Date(base);
  if (Number.isNaN(fecha.getTime())) return null;
  fecha.setHours(0, 0, 0, 0);
  fecha.setDate(fecha.getDate() + ((6 - fecha.getDay() + 7) % 7));
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

/** Media aritmética; null si no hay valores. */
export function media(valores = []) {
  return valores.length ? valores.reduce((suma, valor) => suma + valor, 0) / valores.length : null;
}

/** Mediana; null si no hay valores. */
export function mediana(valores = []) {
  if (!valores.length) return null;
  const ordenados = [...valores].sort((a, b) => a - b);
  const centro = Math.floor(ordenados.length / 2);
  return ordenados.length % 2 ? ordenados[centro] : (ordenados[centro - 1] + ordenados[centro]) / 2;
}

/** Desviación estándar poblacional; null si no hay valores. */
export function desviacionPoblacional(valores = []) {
  const promedio = media(valores);
  if (promedio === null) return null;
  return Math.sqrt(valores.reduce((suma, valor) => suma + (valor - promedio) ** 2, 0) / valores.length);
}

/**
 * Ajuste por mínimos cuadrados de y = a · x^b en escala log-log.
 * Devuelve el exponente b, el coeficiente a y el R² del ajuste.
 */
export function ajustePotencia(puntos = []) {
  const validos = puntos.filter(({ x, y }) => x > 0 && y > 0);
  if (validos.length < 2) return null;
  const lx = validos.map(({ x }) => Math.log(x));
  const ly = validos.map(({ y }) => Math.log(y));
  const mx = media(lx);
  const my = media(ly);
  const sxx = lx.reduce((suma, valor) => suma + (valor - mx) ** 2, 0);
  if (sxx === 0) return null;
  const sxy = lx.reduce((suma, valor, i) => suma + (valor - mx) * (ly[i] - my), 0);
  const b = sxy / sxx;
  const lnA = my - b * mx;
  const sst = ly.reduce((suma, valor) => suma + (valor - my) ** 2, 0);
  const sse = ly.reduce((suma, valor, i) => suma + (valor - (lnA + b * lx[i])) ** 2, 0);
  return { a: Math.exp(lnA), b, r2: sst === 0 ? 1 : 1 - sse / sst };
}
