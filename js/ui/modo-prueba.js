/**
 * Modo de prueba (E7): ejecuta los experimentos, muestra tablas y gráficos y exporta CSV.
 * Se usa en el panel del administrador y en la página pública de validación.
 */
import {
  barrerProbabilidad,
  convertirACSV,
  medirCargaInicial,
  medirEscalabilidad,
  medirRendimiento,
  simularCascada,
} from "../experimentos.js";
import { calcularIndicadores, evaluarMetas } from "../indicadores.js";
import { activarInformacionEmergente, formatoNumero, graficoContrasteKpi, graficoDispersion } from "../graficos.js";
import { escaparHtml } from "./comun.js";

const resultados = { kpi: null, sim01: null, sim02: null, esc01: null, ren01: null, carga: null };
const NOMBRE_METODO = { indice: "Con índice de ocupación", filtrado: "Referencia (filtrado completo)" };

const num = (valor, decimales = 2) => formatoNumero(valor, decimales);
const pct = (valor, decimales = 1) => (valor === null || valor === undefined ? "—" : `${formatoNumero(valor * 100, decimales)} %`);
const fechaArchivo = () => {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;
};

function tabla(columnas, filas) {
  return `<div class="mp-tabla"><table>
    <thead><tr>${columnas.map((c) => `<th scope="col">${escaparHtml(c)}</th>`).join("")}</tr></thead>
    <tbody>${filas.map((f) => `<tr>${f.map((c) => `<td>${escaparHtml(c)}</td>`).join("")}</tr>`).join("")}</tbody>
  </table></div>`;
}

function descargar(nombre, texto) {
  const blob = new Blob([`﻿${texto}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const marcaTiempo = () => new Date().toLocaleString("es-CO", { dateStyle: "short", timeStyle: "medium" });

/* ---------- CSV por experimento ---------- */

const csv = {
  kpi: (r) => convertirACSV(
    [{ clave: "id", titulo: "KPI" }, { clave: "nombre", titulo: "Indicador" }, { clave: "valor", titulo: "Valor medido" }, { clave: "meta", titulo: "Meta" }, { clave: "metaTexto", titulo: "Meta (texto)" }, { clave: "cumple", titulo: "Cumple" }, { clave: "base", titulo: "Base" }, { clave: "origen", titulo: "Origen de los datos" }],
    r.filas.map((f) => ({ ...f, origen: r.origen })),
  ),
  sim01: (r) => convertirACSV(
    [{ clave: "intento", titulo: "Intentos (i)" }, { clave: "confirmadasAcumuladas", titulo: "Confirmadas acumuladas" }, { clave: "observada", titulo: "P observada" }, { clave: "teorica", titulo: "P modelo (ec. 11)" }, { clave: "errorEstandar", titulo: "Error estándar" }, { clave: "limiteInferior", titulo: "Límite inferior (−2 EE)" }, { clave: "limiteSuperior", titulo: "Límite superior (+2 EE)" }, { clave: "desvioPuntos", titulo: "Desvío (puntos porcentuales)" }, { clave: "desvioRelativo", titulo: "Desvío relativo (%)" }, { clave: "dentroDeDosEE", titulo: "Dentro de ±2 EE" }, { clave: "p", titulo: "p" }, { clave: "k", titulo: "k" }, { clave: "N", titulo: "N" }, { clave: "semilla", titulo: "Semilla" }],
    r.filas.map((f) => ({ ...f, ...r.parametros })),
  ),
  sim01Registros: (r) => convertirACSV(
    [{ clave: "solicitud", titulo: "Solicitud" }, { clave: "resultado", titulo: "Resultado" }, { clave: "intentos", titulo: "Intentos usados" }, { clave: "intentoConfirmacion", titulo: "Intento de confirmación" }, { clave: "recicladorFinal", titulo: "Reciclador" }],
    r.registros,
  ),
  sim02: (r) => convertirACSV(
    [{ clave: "p", titulo: "p" }, { clave: "intentos", titulo: "k" }, { clave: "teorica", titulo: "P(≤ k) modelo" }, { clave: "observada", titulo: "P(≤ k) observada" }, { clave: "errorEstandar", titulo: "Error estándar" }, { clave: "desvioPuntos", titulo: "Desvío (puntos porcentuales)" }, { clave: "dentroDeDosEE", titulo: "Dentro de ±2 EE" }, { clave: "semilla", titulo: "Semilla" }],
    r.filas,
  ),
  esc01: (r) => convertirACSV(
    [{ clave: "n", titulo: "Solicitudes (n)" }, { clave: "recicladores", titulo: "Recicladores (R)" }, { clave: "metodoTexto", titulo: "Método" }, { clave: "repeticiones", titulo: "Repeticiones" }, { clave: "medianaMs", titulo: "Mediana (ms)" }, { clave: "mediaMs", titulo: "Media (ms)" }, { clave: "minimoMs", titulo: "Mínimo (ms)" }, { clave: "maximoMs", titulo: "Máximo (ms)" }, { clave: "microsegundosPorSolicitud", titulo: "µs por solicitud" }, { clave: "asignadas", titulo: "Asignadas" }, { clave: "enEspera", titulo: "En espera" }, { clave: "duplicadas", titulo: "Duplicadas" }, { clave: "incompatibles", titulo: "Incompatibles" }, { clave: "excesos", titulo: "Excesos de cupo/volumen" }, { clave: "tiempos", titulo: "Tiempos individuales (ms)" }],
    r.filas.map((f) => ({ ...f, metodoTexto: NOMBRE_METODO[f.metodo], tiempos: f.tiemposMs.map((t) => t.toFixed(3).replace(".", ",")).join(" | ") })),
  ),
  ren01: (r) => convertirACSV(
    [{ clave: "operacion", titulo: "Operación" }, { clave: "ms", titulo: "Tiempo (ms)" }, { clave: "cumple", titulo: "≤ 3 s" }, { clave: "estadoFinal", titulo: "Estado final" }, { clave: "bytesGuardados", titulo: "Bytes serializados" }],
    r.filas,
  ),
};

/** Matriz completa en formato largo: una fila por medición, con valor del modelo y desvío. */
function matrizCompleta() {
  const filas = [];
  const agregar = (fila) => filas.push({ fecha: fila.fecha, ...fila });
  if (resultados.kpi) {
    for (const f of resultados.kpi.filas) {
      agregar({ fecha: resultados.kpi.fecha, experimento: "KPI", variable: `${f.id} ${f.nombre}`, condicion: resultados.kpi.origen, modelo: f.meta, medido: f.valor, desvio: f.valor === null ? null : f.valor - f.meta, unidad: f.unidad === "%" ? "proporción" : f.unidad, cumple: f.cumple });
    }
  }
  if (resultados.sim01) {
    const { parametros: p } = resultados.sim01;
    for (const f of resultados.sim01.filas) {
      agregar({ fecha: resultados.sim01.fecha, experimento: "SIM-01", variable: `P(confirmación ≤ ${f.intento})`, condicion: `p=${p.p}; k=${p.k}; N=${p.N}; semilla=${p.semilla}`, modelo: f.teorica, medido: f.observada, desvio: f.observada - f.teorica, unidad: "proporción", cumple: f.dentroDeDosEE });
    }
  }
  if (resultados.sim02) {
    for (const f of resultados.sim02.filas) {
      agregar({ fecha: resultados.sim02.fecha, experimento: "SIM-02", variable: `P(confirmación ≤ ${f.intentos})`, condicion: `p=${f.p}; semilla=${f.semilla}`, modelo: f.teorica, medido: f.observada, desvio: f.observada - f.teorica, unidad: "proporción", cumple: f.dentroDeDosEE });
    }
  }
  if (resultados.esc01) {
    for (const f of resultados.esc01.filas) {
      agregar({ fecha: resultados.esc01.fecha, experimento: "ESC-01", variable: "Tiempo mediano de asignarLote", condicion: `n=${f.n}; R=${f.recicladores}; ${NOMBRE_METODO[f.metodo]}`, modelo: null, medido: f.medianaMs, desvio: null, unidad: "ms", cumple: f.integridad === 0 });
    }
  }
  if (resultados.ren01) {
    for (const f of resultados.ren01.filas) {
      agregar({ fecha: resultados.ren01.fecha, experimento: "REN-01", variable: `Operación ${f.operacion}`, condicion: "registro completo de solicitud", modelo: 3000, medido: f.ms, desvio: f.ms - 3000, unidad: "ms", cumple: f.cumple });
    }
  }
  if (resultados.carga) {
    agregar({ fecha: resultados.carga.fecha, experimento: "REN-01", variable: "Carga inicial", condicion: `${resultados.carga.archivos.length} archivos`, modelo: resultados.carga.limiteKB, medido: resultados.carga.kilobytes, desvio: resultados.carga.kilobytes - resultados.carga.limiteKB, unidad: "KB", cumple: resultados.carga.cumple });
  }
  return convertirACSV(
    [{ clave: "fecha", titulo: "Fecha de ejecución" }, { clave: "experimento", titulo: "Experimento" }, { clave: "variable", titulo: "Variable" }, { clave: "condicion", titulo: "Condición" }, { clave: "modelo", titulo: "Valor modelo / meta" }, { clave: "medido", titulo: "Valor medido" }, { clave: "desvio", titulo: "Desvío (medido − modelo)" }, { clave: "unidad", titulo: "Unidad" }, { clave: "cumple", titulo: "Cumple" }],
    filas,
  );
}

/* ---------- Resultados ---------- */

function htmlKpi(r) {
  return `
    <p class="mp-nota">Datos: ${escaparHtml(r.origen)} · actualizado ${escaparHtml(r.fecha)}</p>
    ${graficoContrasteKpi({ titulo: "KPI medidos frente a sus metas (Tabla 16, Etapa 3)", filas: r.filas })}
    <button class="mp-boton mp-secundario" type="button" data-csv="kpi">Descargar CSV de KPI</button>`;
}

function htmlSim01(r) {
  const { parametros: p } = r;
  const puntosModelo = r.filas.map((f) => ({ x: f.intento, y: f.teorica * 100, yMin: f.limiteInferior * 100, yMax: f.limiteSuperior * 100, etiqueta: `Intento ${f.intento}: ${pct(f.teorica)} (banda ±2 EE ${pct(f.limiteInferior)}–${pct(f.limiteSuperior)})` }));
  const puntosSim = r.filas.map((f) => ({ x: f.intento, y: f.observada * 100, etiqueta: `Intento ${f.intento}: ${pct(f.observada)} · desvío ${num(f.desvioPuntos, 2)} pp` }));
  return `
    <p class="mp-nota">p = ${num(p.p)} · k = ${p.k} · N = ${p.N} · semilla ${p.semilla} · ${p.recicladoresCompatibles} recicladores compatibles · ${escaparHtml(r.fecha)}</p>
    ${tabla(["Intentos (i)", "Confirmadas", "Observada", "Modelo ec. 11", "Banda ±2 EE", "Desvío (pp)", "Desvío relativo", "¿Dentro de ±2 EE?"],
      r.filas.map((f) => [f.intento, f.confirmadasAcumuladas, pct(f.observada), pct(f.teorica), `${pct(f.limiteInferior)} – ${pct(f.limiteSuperior)}`, num(f.desvioPuntos, 2), `${num(f.desvioRelativo, 2)} %`, f.dentroDeDosEE ? "Sí" : "No"]))}
    <p class="mp-nota">Escaladas al facilitador: ${pct(r.escalamiento.observado)} observado frente a ${pct(r.escalamiento.teorico)} del modelo ((1 − p)^k).</p>
    ${graficoDispersion({
      titulo: "SIM-01 · Confirmación acumulada por número de intentos",
      descripcion: "Puntos del modelo con su banda de aceptación (±2 errores estándar) y resultado de la simulación con el motor.",
      ejeX: { titulo: "Intentos de asignación (i)", min: 0.5, max: p.intentosEfectivos + 0.5, ticks: r.filas.map((f) => f.intento), formato: (v) => String(v) },
      ejeY: { titulo: "Solicitudes confirmadas (%)", formato: (v) => `${formatoNumero(v, 0)} %` },
      series: [
        { nombre: "Modelo (ec. 11) ± 2 EE", puntos: puntosModelo, linea: true },
        { nombre: "Simulación con el motor", puntos: puntosSim },
      ],
    })}
    <div class="mp-acciones">
      <button class="mp-boton mp-secundario" type="button" data-csv="sim01">Descargar CSV resumen</button>
      <button class="mp-boton mp-secundario" type="button" data-csv="sim01Registros">Descargar CSV por solicitud</button>
    </div>`;
}

function htmlSim02(r) {
  return `
    <p class="mp-nota">k = ${r.parametros.k} · N = ${r.parametros.N} por valor de p · ${escaparHtml(r.fecha)}</p>
    ${tabla(["p", "Modelo P(≤ k)", "Observada", "Desvío (pp)", "¿Dentro de ±2 EE?"],
      r.filas.map((f) => [num(f.p), pct(f.teorica), pct(f.observada), num(f.desvioPuntos, 2), f.dentroDeDosEE ? "Sí" : "No"]))}
    ${graficoDispersion({
      titulo: "SIM-02 · Confirmación observada frente a la del modelo",
      descripcion: "Cada punto es una simulación con distinto p. Si el motor se comporta como el modelo, los puntos caen sobre la diagonal.",
      ejeX: { titulo: "P(confirmación ≤ k) del modelo (%)", formato: (v) => `${formatoNumero(v, 0)} %` },
      ejeY: { titulo: "P(confirmación ≤ k) observada (%)", formato: (v) => `${formatoNumero(v, 0)} %` },
      referencia: { tipo: "identidad", etiqueta: "Modelo = observado" },
      series: [{ nombre: "Simulación", puntos: r.filas.map((f) => ({ x: f.teorica * 100, y: f.observada * 100, etiqueta: `p = ${num(f.p)}: modelo ${pct(f.teorica)} · observado ${pct(f.observada)}` })) }],
    })}
    <button class="mp-boton mp-secundario" type="button" data-csv="sim02">Descargar CSV</button>`;
}

function htmlEsc01(r) {
  const metodos = r.parametros.metodos;
  const textoAjuste = (m) => (r.ajustes[m] ? `tiempo ≈ ${num(r.ajustes[m].a, 5)} · n^${num(r.ajustes[m].b, 2)} (R² = ${num(r.ajustes[m].r2, 3)})` : "sin ajuste");
  const integridadTotal = r.filas.reduce((s, f) => s + f.integridad, 0);
  return `
    <p class="mp-nota">${r.parametros.repeticiones} repeticiones por tamaño (se reporta la mediana) · R = ⌈n / ${r.parametros.solicitudesPorReciclador}⌉ · ${escaparHtml(r.fecha)}</p>
    ${tabla(["n", "R", "Método", "Mediana (ms)", "µs por solicitud", "Asignadas", "En espera", "Integridad (K6)"],
      r.filas.map((f) => [f.n, f.recicladores, NOMBRE_METODO[f.metodo], num(f.medianaMs, 2), num(f.microsegundosPorSolicitud, 1), f.asignadas, f.enEspera, f.integridad === 0 ? "0 errores" : `${f.integridad} errores`]))}
    <ul class="mp-lista">${metodos.map((m) => `<li><strong>${escaparHtml(NOMBRE_METODO[m])}:</strong> ${escaparHtml(textoAjuste(m))}</li>`).join("")}
      <li><strong>Auditoría de integridad:</strong> ${integridadTotal === 0 ? "0 duplicadas, 0 incompatibles y 0 excesos de cupo o volumen en todos los tamaños." : `${integridadTotal} problemas detectados; revisa la tabla.`}</li></ul>
    ${graficoDispersion({
      titulo: "ESC-01 · Tiempo de asignación según el tamaño del lote",
      descripcion: "Escala logarítmica en ambos ejes: una recta indica crecimiento potencial y su pendiente es el exponente b.",
      ejeX: { titulo: "Solicitudes en el lote (n)", escala: "log" },
      ejeY: { titulo: "Tiempo mediano (ms)", escala: "log" },
      series: metodos.map((m) => ({
        nombre: NOMBRE_METODO[m],
        etiquetaFinal: r.ajustes[m] ? `b = ${num(r.ajustes[m].b, 2)}` : "",
        linea: true,
        puntos: r.filas.filter((f) => f.metodo === m).map((f) => ({ x: f.n, y: Math.max(f.medianaMs, 0.001), etiqueta: `n = ${f.n}, R = ${f.recicladores}: ${num(f.medianaMs, 2)} ms` })),
      })),
    })}
    <button class="mp-boton mp-secundario" type="button" data-csv="esc01">Descargar CSV</button>`;
}

function htmlRen01(r, carga) {
  const { resumen } = r;
  return `
    <p class="mp-nota">${r.parametros.operaciones} operaciones sobre ${r.parametros.solicitudesEnEstado} solicitudes guardadas · ${escaparHtml(r.fecha)}</p>
    ${tabla(["Mínimo", "Mediana", "Máximo", "Operaciones ≤ 3 s", "Criterio RNF-03"],
      [[`${num(resumen.minimoMs, 3)} ms`, `${num(resumen.medianaMs, 3)} ms`, `${num(resumen.maximoMs, 3)} ms`, `${resumen.cumplen} de ${r.filas.length}`, resumen.cumplen >= Math.ceil(r.filas.length * 0.95) ? "Cumple (≥ 19 de 20)" : "No cumple"]])}
    ${carga ? `<p class="mp-nota"><strong>Carga inicial de esta página:</strong> ${num(carga.kilobytes, 1)} KB en ${carga.archivos.length} archivos (meta ≤ ${carga.limiteKB} KB): ${carga.cumple ? "cumple" : "no cumple"}.</p>` : ""}
    ${graficoDispersion({
      titulo: "REN-01 · Tiempo de cada operación de registro",
      descripcion: "Tiempo de procesamiento en el navegador; el criterio es de 3.000 ms por operación.",
      ejeX: { titulo: "Operación", formato: (v) => formatoNumero(v, 0) },
      ejeY: { titulo: "Tiempo (ms)", min: 0 },
      series: [{ nombre: "Operaciones", puntos: r.filas.map((f) => ({ x: f.operacion, y: f.ms, etiqueta: `Operación ${f.operacion}: ${num(f.ms, 3)} ms` })) }],
    })}
    <button class="mp-boton mp-secundario" type="button" data-csv="ren01">Descargar CSV</button>`;
}

/** Descarta los KPI calculados cuando cambian los datos guardados (escenario o restablecimiento). */
export function descartarKpiCalculados() {
  resultados.kpi = null;
}

/* ---------- Vista ---------- */

export function renderizarModoPrueba(contenedor, { obtenerEstado, origen = "Datos guardados en este navegador", medirCarga = true } = {}) {
  contenedor.innerHTML = `
    <section class="mp" aria-labelledby="mp-titulo">
      <header class="mp-encabezado">
        <h2 id="mp-titulo">Modo de prueba · validación experimental</h2>
        <p>Cada experimento ejecuta el motor real de Ciudad Verde y genera los datos numéricos de la validación. Los resultados de esta sesión se pueden descargar en CSV.</p>
        <div class="mp-acciones">
          <button class="mp-boton" type="button" data-ejecutar-todo>Ejecutar todos los experimentos</button>
          <button class="mp-boton mp-secundario" type="button" data-matriz>Descargar matriz completa (CSV)</button>
        </div>
        <p class="mp-estado" data-estado role="status" aria-live="polite"></p>
      </header>

      <article class="mp-bloque" aria-labelledby="mp-kpi">
        <h3 id="mp-kpi">KPI frente a metas</h3>
        <p>Calcula K2, K3, K6 y K7 con el historial de eventos guardado. Si se cargó el escenario de prueba, los tiempos provienen de un reloj simulado (pasos de 3 minutos).</p>
        <button class="mp-boton" type="button" data-ejecutar="kpi">Calcular KPI</button>
        <div data-resultado="kpi"></div>
      </article>

      <article class="mp-bloque" aria-labelledby="mp-sim01">
        <h3 id="mp-sim01">SIM-01 · Cascada de confirmación frente a la ecuación 11</h3>
        <form class="mp-formulario" data-form="sim01">
          <label>p (aceptación)<input name="p" type="number" min="0" max="1" step="0.01" value="0.70" required></label>
          <label>k (intentos)<input name="k" type="number" min="1" max="10" step="1" value="3" required></label>
          <label>N (solicitudes)<input name="N" type="number" min="10" max="20000" step="10" value="1000" required></label>
          <label>Semilla<input name="semilla" type="number" step="1" value="20261121" required></label>
          <label>Recicladores compatibles<input name="m" type="number" min="1" max="10" step="1" value="3" required></label>
          <button class="mp-boton" type="submit">Ejecutar SIM-01</button>
        </form>
        <div data-resultado="sim01"></div>
      </article>

      <article class="mp-bloque" aria-labelledby="mp-sim02">
        <h3 id="mp-sim02">SIM-02 · Barrido de la probabilidad de aceptación</h3>
        <form class="mp-formulario" data-form="sim02">
          <label>Valores de p (separados por coma)<input name="valores" value="0.5, 0.6, 0.7, 0.8, 0.9" required></label>
          <label>k (intentos)<input name="k" type="number" min="1" max="10" step="1" value="3" required></label>
          <label>N por valor<input name="N" type="number" min="10" max="20000" step="10" value="1000" required></label>
          <label>Semilla inicial<input name="semilla" type="number" step="1" value="20261121" required></label>
          <button class="mp-boton" type="submit">Ejecutar SIM-02</button>
        </form>
        <div data-resultado="sim02"></div>
      </article>

      <article class="mp-bloque" aria-labelledby="mp-esc01">
        <h3 id="mp-esc01">ESC-01 · Escalabilidad del motor de asignación</h3>
        <form class="mp-formulario" data-form="esc01">
          <label>Tamaños de lote (n)<input name="tamanos" value="50, 100, 200, 400, 800, 1600" required></label>
          <label>Repeticiones<input name="repeticiones" type="number" min="1" max="10" step="1" value="3" required></label>
          <label>Solicitudes por reciclador<input name="porReciclador" type="number" min="1" max="100" step="1" value="25" required></label>
          <fieldset><legend>Métodos</legend>
            <label class="mp-opcion"><input type="checkbox" name="indice" checked> Con índice</label>
            <label class="mp-opcion"><input type="checkbox" name="filtrado" checked> Referencia</label>
          </fieldset>
          <button class="mp-boton" type="submit">Ejecutar ESC-01</button>
        </form>
        <progress data-progreso="esc01" max="1" value="0" hidden></progress>
        <div data-resultado="esc01"></div>
      </article>

      <article class="mp-bloque" aria-labelledby="mp-ren01">
        <h3 id="mp-ren01">REN-01 · Rendimiento de la operación de registro</h3>
        <form class="mp-formulario" data-form="ren01">
          <label>Operaciones<input name="operaciones" type="number" min="1" max="200" step="1" value="20" required></label>
          <button class="mp-boton" type="submit">Ejecutar REN-01</button>
        </form>
        <div data-resultado="ren01"></div>
      </article>
    </section>`;

  const estadoTexto = contenedor.querySelector("[data-estado]");
  const avisar = (texto) => { estadoTexto.textContent = texto; };
  const pintar = (clave) => {
    const destino = contenedor.querySelector(`[data-resultado="${clave}"]`);
    const r = resultados[clave];
    if (!destino || !r) return;
    destino.innerHTML = clave === "kpi" ? htmlKpi(r)
      : clave === "sim01" ? htmlSim01(r)
        : clave === "sim02" ? htmlSim02(r)
          : clave === "esc01" ? htmlEsc01(r)
            : htmlRen01(r, resultados.carga);
  };
  const leer = (clave) => contenedor.querySelector(`[data-form="${clave}"]`);
  const lista = (texto) => texto.split(",").map((v) => Number(v.trim())).filter((v) => Number.isFinite(v));

  const ejecutores = {
    kpi: async () => {
      const estado = obtenerEstado();
      resultados.kpi = { fecha: marcaTiempo(), origen, filas: evaluarMetas(calcularIndicadores(estado)) };
    },
    sim01: async () => {
      const f = leer("sim01").elements;
      const estado = obtenerEstado();
      resultados.sim01 = { fecha: marcaTiempo(), ...simularCascada({ p: Number(f.p.value), k: Number(f.k.value), N: Number(f.N.value), semilla: Number(f.semilla.value), recicladoresCompatibles: Number(f.m.value), parametros: estado.parametros }) };
    },
    sim02: async () => {
      const f = leer("sim02").elements;
      const estado = obtenerEstado();
      const valoresP = lista(f.valores.value).filter((p) => p >= 0 && p <= 1);
      if (!valoresP.length) throw new Error("Indica al menos un valor de p entre 0 y 1.");
      resultados.sim02 = { fecha: marcaTiempo(), ...barrerProbabilidad({ valoresP, k: Number(f.k.value), N: Number(f.N.value), semilla: Number(f.semilla.value), parametros: estado.parametros }) };
    },
    esc01: async () => {
      const f = leer("esc01").elements;
      const tamanos = lista(f.tamanos.value).filter((n) => Number.isInteger(n) && n > 0 && n <= 5000).sort((a, b) => a - b);
      const metodos = ["indice", "filtrado"].filter((m) => f[m].checked);
      if (!tamanos.length || !metodos.length) throw new Error("Indica tamaños entre 1 y 5.000 y al menos un método.");
      const barra = contenedor.querySelector('[data-progreso="esc01"]');
      barra.hidden = false;
      const estado = obtenerEstado();
      const r = await medirEscalabilidad({
        tamanos,
        repeticiones: Number(f.repeticiones.value),
        solicitudesPorReciclador: Number(f.porReciclador.value),
        metodos,
        parametros: estado.parametros,
        alProgresar: ({ hechas, total, n, metodo }) => {
          barra.value = hechas / total;
          avisar(`ESC-01: ${hechas} de ${total} corridas (n = ${n}, ${NOMBRE_METODO[metodo].toLowerCase()}).`);
        },
      });
      barra.hidden = true;
      resultados.esc01 = { fecha: marcaTiempo(), ...r };
    },
    ren01: async () => {
      const f = leer("ren01").elements;
      resultados.ren01 = { fecha: marcaTiempo(), ...(await medirRendimiento({ estado: obtenerEstado(), operaciones: Number(f.operaciones.value) })) };
      if (medirCarga) {
        const carga = medirCargaInicial();
        resultados.carga = carga ? { fecha: marcaTiempo(), ...carga } : null;
      }
    },
  };

  const NOMBRES = { kpi: "KPI", sim01: "SIM-01", sim02: "SIM-02", esc01: "ESC-01", ren01: "REN-01" };
  let ocupado = false;
  async function ejecutar(claves) {
    if (ocupado) return;
    ocupado = true;
    contenedor.querySelectorAll("button, input").forEach((el) => { el.disabled = true; });
    try {
      for (const clave of claves) {
        avisar(`Ejecutando ${NOMBRES[clave]}…`);
        await new Promise((r) => setTimeout(r, 30));
        await ejecutores[clave]();
        pintar(clave);
      }
      avisar(`Listo: ${claves.map((c) => NOMBRES[c]).join(", ")} (${marcaTiempo()}).`);
    } catch (error) {
      avisar(`Error: ${error.message}`);
      console.error(error);
    } finally {
      ocupado = false;
      contenedor.querySelectorAll("button, input").forEach((el) => { el.disabled = false; });
    }
  }

  contenedor.querySelectorAll("[data-form]").forEach((form) => {
    form.addEventListener("submit", (evento) => {
      evento.preventDefault();
      if (form.reportValidity()) ejecutar([form.dataset.form]);
    });
  });
  contenedor.querySelector('[data-ejecutar="kpi"]').addEventListener("click", () => ejecutar(["kpi"]));
  contenedor.querySelector("[data-ejecutar-todo]").addEventListener("click", () => ejecutar(["kpi", "sim01", "sim02", "esc01", "ren01"]));
  contenedor.querySelector("[data-matriz]").addEventListener("click", () => {
    if (!Object.values(resultados).some(Boolean)) return avisar("Ejecuta al menos un experimento antes de descargar la matriz.");
    descargar(`ciudad-verde_matriz-validacion_${fechaArchivo()}.csv`, matrizCompleta());
  });
  contenedor.addEventListener("click", (evento) => {
    const boton = evento.target.closest("[data-csv]");
    if (!boton) return;
    const clave = boton.dataset.csv;
    const fuente = clave === "sim01Registros" ? resultados.sim01 : resultados[clave];
    if (fuente) descargar(`ciudad-verde_${clave}_${fechaArchivo()}.csv`, csv[clave](fuente));
  });

  activarInformacionEmergente(contenedor);
  Object.keys(NOMBRES).forEach(pintar);
}
