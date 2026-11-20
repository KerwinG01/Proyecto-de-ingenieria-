/**
 * Gráficos SVG accesibles para el modo de prueba: dispersión (lineal o logarítmica)
 * y contraste de KPI frente a su meta. Cada gráfico incluye leyenda (dos o más series),
 * etiquetas selectivas, información al pasar el puntero o enfocar con teclado y una
 * tabla de datos equivalente.
 */

export const COLORES_SERIE = Object.freeze(["#2a78d6", "#eb6834", "#1baf7a"]);
const TINTA = { primaria: "#0b0b0b", secundaria: "#52514e", tenue: "#898781", rejilla: "#e1e0d9", eje: "#c3c2b7", superficie: "#fcfcfb" };
const ESTADO = { cumple: "#0ca30c", noCumple: "#d03b3b" };

function escapar(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

let contadorIds = 0;
const nuevoId = (prefijo) => `${prefijo}-${++contadorIds}`;

/** Número con coma decimal y separador de miles, como se lee en Colombia. */
export function formatoNumero(valor, decimales = 2) {
  if (valor === null || valor === undefined || !Number.isFinite(Number(valor))) return "—";
  return Number(valor).toLocaleString("es-CO", { minimumFractionDigits: 0, maximumFractionDigits: decimales });
}

function ticksLineales(min, max, cantidad = 5) {
  if (min === max) return [min];
  const paso0 = (max - min) / cantidad;
  const potencia = 10 ** Math.floor(Math.log10(paso0));
  const factor = paso0 / potencia;
  const paso = (factor >= 5 ? 10 : factor >= 2 ? 5 : factor >= 1 ? 2 : 1) * potencia;
  const ticks = [];
  for (let t = Math.ceil(min / paso) * paso; t <= max + paso * 1e-9; t += paso) ticks.push(Number(t.toPrecision(12)));
  return ticks;
}

function ticksLog(min, max) {
  const ticks = [];
  for (let e = Math.floor(Math.log10(min)); e <= Math.ceil(Math.log10(max)); e += 1) {
    for (const m of [1, 2, 5]) {
      const t = m * 10 ** e;
      if (t >= min * 0.999 && t <= max * 1.001) ticks.push(t);
    }
  }
  return ticks;
}

function crearEscala({ escala = "lineal", min, max }, desde, hasta) {
  if (escala === "log") {
    const a = Math.log10(min);
    const b = Math.log10(max);
    return (v) => desde + ((Math.log10(v) - a) / (b - a)) * (hasta - desde);
  }
  return (v) => desde + ((v - min) / (max - min || 1)) * (hasta - desde);
}

function dominio(eje, valores) {
  const finitos = valores.filter((v) => Number.isFinite(v) && (eje.escala !== "log" || v > 0));
  let min = eje.min ?? Math.min(...finitos);
  let max = eje.max ?? Math.max(...finitos);
  if (eje.escala === "log") {
    const escalones = (v) => [1, 2, 5, 10].map((f) => f * 10 ** Math.floor(Math.log10(v)));
    min = eje.min ?? Math.max(...escalones(min).filter((t) => t <= min * 1.0001));
    max = eje.max ?? Math.min(...escalones(max).filter((t) => t >= max * 0.9999));
  } else {
    if (eje.min === undefined && min > 0 && min / (max || 1) < 0.35) min = 0;
    if (min === max) { min -= 1; max += 1; }
    const ticks = ticksLineales(min, max);
    if (eje.min === undefined) min = Math.min(min, ticks[0]);
    if (eje.max === undefined) max = Math.max(max, ticks[ticks.length - 1]);
  }
  return { ...eje, min, max };
}

/**
 * Gráfico de dispersión. series: [{ nombre, puntos: [{ x, y, yMin?, yMax?, etiqueta? }], linea? }].
 * referencia: { tipo: "identidad", etiqueta } dibuja y = x como guía.
 */
export function graficoDispersion({ titulo, descripcion = "", ejeX, ejeY, series, referencia = null, columnasTabla = null, ancho = 680, alto = 380 }) {
  const id = nuevoId("graf");
  const m = { arriba: 20, derecha: 132, abajo: 56, izquierda: 72 };
  const todosX = series.flatMap((s) => s.puntos.map((p) => p.x));
  const todosY = series.flatMap((s) => s.puntos.flatMap((p) => [p.y, p.yMin, p.yMax])).filter((v) => v !== undefined && v !== null);
  const identidad = referencia?.tipo === "identidad";
  const dx = dominio(ejeX, identidad ? [...todosX, ...todosY] : todosX);
  const dy = identidad ? { ...dominio(ejeY, [...todosX, ...todosY]), min: dx.min, max: dx.max } : dominio(ejeY, todosY);
  const sx = crearEscala(dx, m.izquierda, ancho - m.derecha);
  const sy = crearEscala(dy, alto - m.abajo, m.arriba);
  const ticksX = ejeX.ticks || (dx.escala === "log" ? ticksLog(dx.min, dx.max) : ticksLineales(dx.min, dx.max));
  const ticksY = ejeY.ticks || (dy.escala === "log" ? ticksLog(dy.min, dy.max) : ticksLineales(dy.min, dy.max));
  const fx = ejeX.formato || ((v) => formatoNumero(v));
  const fy = ejeY.formato || ((v) => formatoNumero(v));

  const rejilla = ticksY.map((t) => `
    <line x1="${m.izquierda}" x2="${ancho - m.derecha}" y1="${sy(t)}" y2="${sy(t)}" stroke="${TINTA.rejilla}" stroke-width="1"/>
    <text x="${m.izquierda - 8}" y="${sy(t)}" dy="0.32em" text-anchor="end" class="graf-tick">${escapar(fy(t))}</text>`).join("");
  const ticksEjeX = ticksX.map((t) => `
    <line x1="${sx(t)}" x2="${sx(t)}" y1="${alto - m.abajo}" y2="${alto - m.abajo + 4}" stroke="${TINTA.eje}"/>
    <text x="${sx(t)}" y="${alto - m.abajo + 18}" text-anchor="middle" class="graf-tick">${escapar(fx(t))}</text>`).join("");

  let guia = "";
  if (referencia?.tipo === "identidad") {
    const a = Math.max(dx.min, dy.min);
    const b = Math.min(dx.max, dy.max);
    const t = a + (b - a) * 0.2;
    guia = `<line x1="${sx(a)}" y1="${sy(a)}" x2="${sx(b)}" y2="${sy(b)}" stroke="${TINTA.tenue}" stroke-width="1"/>
      <text x="${sx(t) + 10}" y="${sy(t) + 16}" class="graf-tick">${escapar(referencia.etiqueta || "y = x")}</text>`;
  }

  const marcas = series.map((serie, i) => {
    const color = serie.color || COLORES_SERIE[i % COLORES_SERIE.length];
    const puntos = serie.puntos.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
    const trazo = serie.linea && puntos.length > 1
      ? `<polyline points="${puntos.map((p) => `${sx(p.x)},${sy(p.y)}`).join(" ")}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`
      : "";
    const barras = puntos.filter((p) => Number.isFinite(p.yMin) && Number.isFinite(p.yMax)).map((p) => `
      <line x1="${sx(p.x)}" x2="${sx(p.x)}" y1="${sy(p.yMin)}" y2="${sy(p.yMax)}" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
      <line x1="${sx(p.x) - 5}" x2="${sx(p.x) + 5}" y1="${sy(p.yMin)}" y2="${sy(p.yMin)}" stroke="${color}" stroke-width="2"/>
      <line x1="${sx(p.x) - 5}" x2="${sx(p.x) + 5}" y1="${sy(p.yMax)}" y2="${sy(p.yMax)}" stroke="${color}" stroke-width="2"/>`).join("");
    const puntosSvg = puntos.map((p) => {
      const tip = `${serie.nombre}|${p.etiqueta || `${ejeX.titulo}: ${fx(p.x)} · ${ejeY.titulo}: ${fy(p.y)}`}`;
      return `<g class="graf-punto" tabindex="0" role="img" aria-label="${escapar(tip.replace("|", ": "))}" data-tip="${escapar(tip)}" data-color="${color}">
        <circle cx="${sx(p.x)}" cy="${sy(p.y)}" r="12" fill="transparent"/>
        <circle cx="${sx(p.x)}" cy="${sy(p.y)}" r="5" fill="${color}" stroke="${TINTA.superficie}" stroke-width="2"/>
      </g>`;
    }).join("");
    const ultimo = puntos[puntos.length - 1];
    const etiquetaFinal = ultimo && serie.etiquetaFinal
      ? `<text x="${sx(ultimo.x) + 10}" y="${sy(ultimo.y)}" dy="0.32em" class="graf-etiqueta">${escapar(serie.etiquetaFinal)}</text>`
      : "";
    return trazo + barras + puntosSvg + etiquetaFinal;
  }).join("");

  const leyenda = series.length >= 2 ? `<ul class="graf-leyenda">${series.map((serie, i) => `
    <li><svg width="22" height="10" aria-hidden="true"><line x1="1" x2="21" y1="5" y2="5" stroke="${serie.color || COLORES_SERIE[i]}" stroke-width="2"/><circle cx="11" cy="5" r="4" fill="${serie.color || COLORES_SERIE[i]}"/></svg>${escapar(serie.nombre)}</li>`).join("")}</ul>` : "";

  const columnas = columnasTabla || ["Serie", ejeX.titulo, ejeY.titulo];
  const filas = series.flatMap((serie) => serie.puntos.map((p) => (p.fila || [serie.nombre, fx(p.x), fy(p.y)])));
  const tabla = `<details class="graf-tabla"><summary>Ver tabla de datos</summary>
    <div class="tabla-desplazable"><table><thead><tr>${columnas.map((c) => `<th scope="col">${escapar(c)}</th>`).join("")}</tr></thead>
    <tbody>${filas.map((f) => `<tr>${f.map((c) => `<td>${escapar(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div></details>`;

  return `
    <figure class="grafico" aria-labelledby="${id}-titulo">
      <figcaption id="${id}-titulo" class="graf-titulo">${escapar(titulo)}</figcaption>
      ${descripcion ? `<p class="graf-descripcion">${escapar(descripcion)}</p>` : ""}
      ${leyenda}
      <div class="graf-lienzo">
        <svg viewBox="0 0 ${ancho} ${alto}" role="group" aria-label="${escapar(titulo)}">
          <rect x="0" y="0" width="${ancho}" height="${alto}" fill="${TINTA.superficie}"/>
          ${rejilla}
          <line x1="${m.izquierda}" x2="${ancho - m.derecha}" y1="${alto - m.abajo}" y2="${alto - m.abajo}" stroke="${TINTA.eje}"/>
          ${ticksEjeX}
          <text x="${(m.izquierda + ancho - m.derecha) / 2}" y="${alto - 10}" text-anchor="middle" class="graf-eje">${escapar(ejeX.titulo)}${dx.escala === "log" ? " (escala logarítmica)" : ""}</text>
          <text transform="translate(16 ${(m.arriba + alto - m.abajo) / 2}) rotate(-90)" text-anchor="middle" class="graf-eje">${escapar(ejeY.titulo)}${dy.escala === "log" ? " (escala log.)" : ""}</text>
          ${guia}
          ${marcas}
        </svg>
      </div>
      ${tabla}
    </figure>`;
}

/**
 * Contraste de KPI: una fila por indicador con barra del valor medido, marca de la meta
 * y estado con ícono y texto. filas: salida de evaluarMetas().
 */
export function graficoContrasteKpi({ titulo, descripcion = "", filas }) {
  const id = nuevoId("kpi");
  const ancho = 680;
  const altoFila = 48;
  const m = { arriba: 8, izquierda: 250, derecha: 150 };
  const alto = m.arriba * 2 + filas.length * altoFila;
  const largo = ancho - m.izquierda - m.derecha;
  const texto = (fila, v) => (v === null || v === undefined ? "Sin datos"
    : fila.unidad === "%" ? `${formatoNumero(v * 100, 1)} %`
      : fila.unidad === "h" ? `${formatoNumero(v, 2)} h`
        : formatoNumero(v, 2));

  const filasSvg = filas.map((fila, i) => {
    const y = m.arriba + i * altoFila;
    const centro = y + altoFila / 2;
    const tope = Math.max(fila.valor ?? 0, fila.meta, fila.meta === 0 ? 1 : 0) * 1.25 || 1;
    const escala = (v) => m.izquierda + (Math.max(0, v) / tope) * largo;
    const xMeta = escala(fila.meta);
    const estado = fila.cumple === null ? { icono: "–", texto: "Sin datos", color: TINTA.tenue }
      : fila.cumple ? { icono: "✓", texto: "Cumple", color: ESTADO.cumple } : { icono: "✕", texto: "No cumple", color: ESTADO.noCumple };
    const ancho0 = fila.valor === null || fila.valor === undefined ? 0 : Math.max(escala(fila.valor) - m.izquierda, fila.valor > 0 ? 4 : 0);
    const barra = ancho0 > 0
      ? `<path d="M${m.izquierda},${centro - 10} h${Math.max(ancho0 - 4, 0)} a4,4 0 0 1 4,4 v12 a4,4 0 0 1 -4,4 h-${Math.max(ancho0 - 4, 0)} z" fill="${COLORES_SERIE[0]}"/>`
      : "";
    const tip = `${fila.id} · ${fila.nombre}|Valor: ${texto(fila, fila.valor)} · Meta: ${fila.metaTexto} · ${estado.texto} (${fila.base})`;
    return `
      <g class="graf-punto" tabindex="0" role="img" aria-label="${escapar(tip.replace("|", ": "))}" data-tip="${escapar(tip)}" data-color="${COLORES_SERIE[0]}">
        <rect x="0" y="${y}" width="${ancho}" height="${altoFila}" fill="transparent"/>
        <text x="8" y="${centro - 7}" class="graf-etiqueta-fuerte">${escapar(`${fila.id} · ${fila.nombre}`)}</text>
        <text x="8" y="${centro + 11}" class="graf-tick">Meta ${escapar(fila.metaTexto)}</text>
        <line x1="${m.izquierda}" x2="${m.izquierda + largo}" y1="${centro}" y2="${centro}" stroke="${TINTA.rejilla}" stroke-width="1"/>
        ${barra}
        <line x1="${xMeta}" x2="${xMeta}" y1="${centro - 16}" y2="${centro + 16}" stroke="${TINTA.primaria}" stroke-width="2"/>
        <text x="${Math.max(escala(fila.valor ?? 0), xMeta) + 8}" y="${centro}" dy="0.32em" class="graf-etiqueta">${escapar(texto(fila, fila.valor))}</text>
        <circle cx="${ancho - m.derecha + 34}" cy="${centro}" r="9" fill="${estado.color}"/>
        <text x="${ancho - m.derecha + 34}" y="${centro}" dy="0.35em" text-anchor="middle" class="graf-icono">${estado.icono}</text>
        <text x="${ancho - m.derecha + 50}" y="${centro}" dy="0.32em" class="graf-etiqueta-fuerte">${estado.texto}</text>
      </g>`;
  }).join("");

  const tabla = `<details class="graf-tabla"><summary>Ver tabla de datos</summary>
    <div class="tabla-desplazable"><table><thead><tr><th scope="col">KPI</th><th scope="col">Indicador</th><th scope="col">Valor medido</th><th scope="col">Meta</th><th scope="col">Resultado</th><th scope="col">Base</th></tr></thead>
    <tbody>${filas.map((f) => `<tr><td>${escapar(f.id)}</td><td>${escapar(f.nombre)}</td><td>${escapar(texto(f, f.valor))}</td><td>${escapar(f.metaTexto)}</td><td>${f.cumple === null ? "Sin datos" : f.cumple ? "Cumple" : "No cumple"}</td><td>${escapar(f.base)}</td></tr>`).join("")}</tbody></table></div></details>`;

  return `
    <figure class="grafico" aria-labelledby="${id}-titulo">
      <figcaption id="${id}-titulo" class="graf-titulo">${escapar(titulo)}</figcaption>
      ${descripcion ? `<p class="graf-descripcion">${escapar(descripcion)}</p>` : ""}
      <p class="graf-descripcion">Barra: valor medido. Línea vertical negra: meta. Cada fila usa su propia escala.</p>
      <div class="graf-lienzo">
        <svg viewBox="0 0 ${ancho} ${alto}" role="group" aria-label="${escapar(titulo)}">
          <rect x="0" y="0" width="${ancho}" height="${alto}" fill="${TINTA.superficie}"/>
          ${filasSvg}
        </svg>
      </div>
      ${tabla}
    </figure>`;
}

/** Activa la información emergente (puntero y teclado) en los gráficos de un contenedor. */
export function activarInformacionEmergente(contenedor) {
  if (!contenedor || contenedor.dataset.tooltipActivo) return;
  contenedor.dataset.tooltipActivo = "1";
  const caja = document.createElement("div");
  caja.className = "graf-tooltip";
  caja.hidden = true;
  caja.setAttribute("role", "status");
  document.body.append(caja);

  const mostrar = (marca, x, y) => {
    const [titulo, valor] = (marca.dataset.tip || "").split("|");
    caja.replaceChildren();
    const fuerte = document.createElement("strong");
    fuerte.textContent = valor || titulo;
    const clave = document.createElement("span");
    clave.className = "graf-tooltip-serie";
    const linea = document.createElement("i");
    linea.style.background = marca.dataset.color || COLORES_SERIE[0];
    clave.append(linea, document.createTextNode(valor ? titulo : ""));
    caja.append(fuerte, clave);
    caja.hidden = false;
    const margen = 14;
    const ancho = caja.offsetWidth;
    caja.style.left = `${Math.min(x + margen, window.scrollX + document.documentElement.clientWidth - ancho - 8)}px`;
    caja.style.top = `${y + margen}px`;
  };
  const ocultar = () => { caja.hidden = true; };
  contenedor.addEventListener("pointermove", (evento) => {
    const marca = evento.target.closest?.(".graf-punto");
    if (marca) mostrar(marca, evento.pageX, evento.pageY);
    else ocultar();
  });
  contenedor.addEventListener("pointerleave", ocultar);
  contenedor.addEventListener("focusin", (evento) => {
    const marca = evento.target.closest?.(".graf-punto");
    if (!marca) return;
    const caja0 = marca.getBoundingClientRect();
    mostrar(marca, caja0.left + window.scrollX + caja0.width / 2, caja0.top + window.scrollY);
  });
  contenedor.addEventListener("focusout", ocultar);
}
