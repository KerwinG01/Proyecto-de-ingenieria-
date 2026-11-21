import { crearHogar } from "../modelo.js";
import { normalizarTexto } from "../utilidades.js";
import { crearId } from "./servicios.js";
import { escaparHtml } from "./comun.js";

const CLAVE_USUARIOS_DEMO = "ciudadVerde.usuariosDemo.v1";
const CLAVE_SESION_DEMO = "ciudadVerde.sesionDemo.v1";
const OTRA_MICROZONA = "__otra";

function leerListaUsuarios() {
  try {
    const valor = localStorage.getItem(CLAVE_USUARIOS_DEMO);
    const usuarios = valor ? JSON.parse(valor) : [];
    return Array.isArray(usuarios) ? usuarios : [];
  } catch {
    return [];
  }
}

function guardarListaUsuarios(usuarios) {
  try {
    localStorage.setItem(CLAVE_USUARIOS_DEMO, JSON.stringify(usuarios));
    return true;
  } catch {
    return false;
  }
}

function leerEmailActivo() {
  try { return localStorage.getItem(CLAVE_SESION_DEMO) || ""; }
  catch { return ""; }
}

function guardarEmailActivo(email) {
  try {
    localStorage.setItem(CLAVE_SESION_DEMO, email);
    return true;
  } catch {
    return false;
  }
}

/** Usuario con sesión demo activa, o null. */
export function obtenerUsuarioActivo() {
  const email = leerEmailActivo();
  return email ? leerListaUsuarios().find((usuario) => usuario.email === email) || null : null;
}

/**
 * Hogar vinculado a la sesión activa de un ciudadano.
 * Devuelve { usuario, hogar } o { usuario, hogar: null } si el hogar ya no existe en los datos.
 */
export function obtenerHogarDeSesion(estado) {
  const usuario = obtenerUsuarioActivo();
  if (!usuario || usuario.rol !== "ciudadano") return null;
  const hogar = estado.hogares.find((item) => item.id === usuario.hogarId) || null;
  return { usuario, hogar };
}

/** Elimina las cuentas demo y la sesión activa de este navegador. */
export function borrarCuentasDemo() {
  try {
    localStorage.removeItem(CLAVE_USUARIOS_DEMO);
    localStorage.removeItem(CLAVE_SESION_DEMO);
  } catch { /* La demostración continúa aunque no haya almacenamiento. */ }
}

/** Microzonas conocidas: las que atienden los recicladores y las de hogares ya registrados. */
function microzonasConocidas(estado) {
  const vistas = new Map();
  for (const nombre of [...estado.recicladores.map((r) => r.microzona), ...estado.hogares.map((h) => h.microzona)]) {
    const clave = normalizarTexto(nombre);
    if (clave && !vistas.has(clave)) vistas.set(clave, nombre);
  }
  return [...vistas.values()];
}

function tieneCobertura(estado, microzona) {
  const clave = normalizarTexto(microzona);
  return estado.recicladores.some((r) => r.activo !== false && normalizarTexto(r.microzona) === clave);
}

/** Campos del hogar para el registro de un ciudadano y para su perfil. */
function camposHogar(prefijo, estado, hogar = null, bloquearMicrozona = false) {
  const conocidas = microzonasConocidas(estado);
  const actual = hogar?.microzona || conocidas[0] || "";
  const esOtra = hogar && !conocidas.some((zona) => normalizarTexto(zona) === normalizarTexto(actual));
  return `
    <fieldset class="grupo-hogar" data-campos-hogar>
      <legend>Datos del hogar</legend>
      <p class="texto-ayuda">Tu cuenta queda vinculada a este hogar: tus solicitudes se registran a su nombre sin tener que elegirlo. Solo se guarda la microzona y una referencia de entrega, nunca la dirección exacta.</p>
      <label for="${prefijo}-hogar-alias">Nombre del hogar</label>
      <input id="${prefijo}-hogar-alias" name="hogarAlias" maxlength="80" required placeholder="Ej.: Casa de la familia Pérez" value="${escaparHtml(hogar?.alias || "")}">
      <label for="${prefijo}-hogar-microzona">Microzona</label>
      <select id="${prefijo}-hogar-microzona" name="hogarMicrozona" ${bloquearMicrozona ? "disabled" : ""}>
        ${conocidas.map((zona) => `<option value="${escaparHtml(zona)}" ${!esOtra && normalizarTexto(zona) === normalizarTexto(actual) ? "selected" : ""}>${escaparHtml(zona)}${tieneCobertura(estado, zona) ? "" : " (sin recicladores)"}</option>`).join("")}
        <option value="${OTRA_MICROZONA}" ${esOtra ? "selected" : ""}>Otra microzona</option>
      </select>
      <div data-otra-microzona ${esOtra ? "" : "hidden"}>
        <label for="${prefijo}-hogar-otra">Nombre de la microzona</label>
        <input id="${prefijo}-hogar-otra" name="hogarOtraMicrozona" maxlength="80" value="${esOtra ? escaparHtml(actual) : ""}" ${esOtra ? "required" : ""}>
      </div>
      ${bloquearMicrozona ? `<p class="texto-ayuda">La microzona no se puede cambiar porque el hogar ya tiene solicitudes registradas.</p>` : ""}
      <p class="texto-ayuda" data-aviso-cobertura hidden></p>
      <label for="${prefijo}-hogar-referencia">Referencia de entrega</label>
      <textarea id="${prefijo}-hogar-referencia" name="hogarReferencia" rows="2" maxlength="240" required placeholder="Ej.: casa esquinera de portón verde, frente al parque">${escaparHtml(hogar?.referenciaEntrega || "")}</textarea>
      <label class="opcion-material">
        <input type="checkbox" name="hogarConsentimiento" ${hogar?.consentimiento ? "checked" : ""} required>
        <span>Autorizo el uso de estos datos solo para coordinar la recolección (Ley 1581 de 2012).</span>
      </label>
    </fieldset>`;
}

function leerCamposHogar(formulario) {
  const elementos = formulario.elements;
  const seleccion = elementos.hogarMicrozona.value;
  return {
    alias: elementos.hogarAlias.value.trim(),
    microzona: seleccion === OTRA_MICROZONA ? elementos.hogarOtraMicrozona.value.trim() : seleccion,
    referenciaEntrega: elementos.hogarReferencia.value.trim(),
    consentimiento: elementos.hogarConsentimiento.checked,
  };
}

export function renderizarAutenticacion(raiz, { cerrar, seleccionarPanel = () => {}, obtenerEstado, guardarCambios }, panelInicial = "registro") {
  let panel = panelInicial;

  function dibujar(mensaje = "", tipo = "info") {
    const usuarios = leerListaUsuarios();
    const emailActivo = leerEmailActivo();
    const perfil = usuarios.find((usuario) => usuario.email === emailActivo);
    const contenido = panel === "registro" ? dibujarRegistro() :
      panel === "login" ? dibujarInicioSesion() : dibujarPerfil(perfil);

    raiz.innerHTML = `
      <section class="vista-rol vista-cuenta" aria-labelledby="titulo-cuenta">
        <header class="encabezado-vista">
          <p class="ceja">Demostración de cuenta</p>
          <h1 id="titulo-cuenta">Cuenta Ciudad Verde</h1>
          <p>Registro, inicio de sesión y perfil simulados para visualizar el flujo.</p>
        </header>
        <div class="aviso aviso--info nota-demo"><strong>Modo demostración:</strong> no hay servidor ni autenticación real. La contraseña solo se revisa en el formulario y no se guarda; para iniciar sesión basta con un correo registrado y una contraseña de prueba.</div>
        <div class="acciones">
          <button class="boton secundario" type="button" data-cerrar>Volver a la vista de rol</button>
        </div>
        <p class="aviso aviso--${escaparHtml(tipo)}" data-aviso role="status" aria-live="polite" ${mensaje ? "" : "hidden"}>${escaparHtml(mensaje)}</p>
        <div id="contenido-cuenta">${contenido}</div>
      </section>`;

    raiz.querySelector("[data-cerrar]").addEventListener("click", cerrar);
    raiz.querySelector("#form-registro")?.addEventListener("submit", registrar);
    raiz.querySelector("#form-login")?.addEventListener("submit", iniciarSesion);
    raiz.querySelector("#form-perfil")?.addEventListener("submit", guardarPerfil);
    raiz.querySelector("[data-cerrar-sesion]")?.addEventListener("click", cerrarSesion);
    raiz.querySelector("[data-ir-login]")?.addEventListener("click", () => irA("login"));
    raiz.querySelector("[data-ir-registro]")?.addEventListener("click", () => irA("registro"));
    const formulario = raiz.querySelector("#form-registro, #form-perfil");
    if (formulario) conectarCamposHogar(formulario);
  }

  function irA(destino) {
    panel = destino;
    seleccionarPanel(panel);
    dibujar();
  }

  /** Muestra los datos del hogar solo para el perfil Ciudadano y gestiona la opción «Otra microzona». */
  function conectarCamposHogar(formulario) {
    const grupo = formulario.querySelector("[data-campos-hogar]");
    const rol = formulario.elements.rol;
    if (!grupo || !rol) return;
    const estado = obtenerEstado();
    const aplicarRol = () => {
      const esCiudadano = rol.value === "ciudadano";
      grupo.hidden = !esCiudadano;
      grupo.disabled = !esCiudadano;
      const microzona = formulario.elements.hogarMicrozona;
      if (esCiudadano && microzona.dataset.bloqueada === "true") microzona.disabled = true;
    };
    const microzona = formulario.elements.hogarMicrozona;
    if (microzona.disabled) microzona.dataset.bloqueada = "true";
    const otra = grupo.querySelector("[data-otra-microzona]");
    const avisoCobertura = grupo.querySelector("[data-aviso-cobertura]");
    const aplicarMicrozona = () => {
      const esOtra = microzona.value === OTRA_MICROZONA;
      otra.hidden = !esOtra;
      formulario.elements.hogarOtraMicrozona.required = esOtra;
      const nombre = esOtra ? formulario.elements.hogarOtraMicrozona.value.trim() : microzona.value;
      const sinCobertura = nombre && !tieneCobertura(estado, nombre);
      avisoCobertura.hidden = !sinCobertura;
      avisoCobertura.textContent = sinCobertura
        ? "Esta microzona todavía no tiene recicladores: tus solicitudes quedarán «sin disponibilidad» y las gestionará el facilitador."
        : "";
    };
    rol.addEventListener("change", aplicarRol);
    microzona.addEventListener("change", aplicarMicrozona);
    formulario.elements.hogarOtraMicrozona.addEventListener("input", aplicarMicrozona);
    aplicarRol();
    aplicarMicrozona();
  }

  function dibujarRegistro() {
    return `
      <form id="form-registro" class="tarjeta formulario">
        <h2>Crear cuenta demo</h2>
        <label for="registro-nombre">Nombre</label>
        <input id="registro-nombre" name="nombre" autocomplete="name" maxlength="100" required>
        <label for="registro-email">Correo electrónico</label>
        <input id="registro-email" name="email" type="email" autocomplete="email" maxlength="150" required>
        <label for="registro-rol">Perfil de usuario</label>
        <select id="registro-rol" name="rol"><option value="ciudadano">Ciudadano</option><option value="reciclador">Reciclador</option><option value="facilitador">Facilitador</option></select>
        ${camposHogar("registro", obtenerEstado())}
        <label for="registro-clave">Contraseña de demostración</label>
        <input id="registro-clave" name="clave" type="password" minlength="6" autocomplete="new-password" required>
        <label for="registro-clave-confirmar">Confirmar contraseña</label>
        <input id="registro-clave-confirmar" name="confirmarClave" type="password" minlength="6" autocomplete="new-password" required>
        <p class="texto-ayuda">La contraseña solo se compara en esta pantalla; no se almacena ni se transmite.</p>
        <div class="acciones">
          <button class="boton primario" type="submit">Crear cuenta demo</button>
          <button class="boton secundario" type="button" data-ir-login>Ya tengo cuenta</button>
        </div>
      </form>`;
  }

  function dibujarInicioSesion() {
    return `
      <form id="form-login" class="tarjeta formulario">
        <h2>Iniciar sesión demo</h2>
        <label for="login-email">Correo electrónico</label>
        <input id="login-email" name="email" type="email" autocomplete="email" maxlength="150" required>
        <label for="login-clave">Contraseña de demostración</label>
        <input id="login-clave" name="clave" type="password" autocomplete="current-password" required>
        <p class="texto-ayuda">El prototipo comprueba que el correo esté registrado. No verifica ni guarda la contraseña.</p>
        <div class="acciones">
          <button class="boton primario" type="submit">Entrar a mi perfil demo</button>
          <button class="boton secundario" type="button" data-ir-registro>Crear una cuenta</button>
        </div>
      </form>`;
  }

  function dibujarPerfil(perfil) {
    if (!perfil) {
      return `
        <section class="tarjeta">
          <h2>Perfil demo</h2>
          <p>No hay una sesión demo activa.</p>
          <div class="acciones">
            <button class="boton primario" type="button" data-ir-login>Ir a iniciar sesión</button>
            <button class="boton secundario" type="button" data-ir-registro>Crear una cuenta</button>
          </div>
        </section>`;
    }
    const estado = obtenerEstado();
    const hogar = estado.hogares.find((item) => item.id === perfil.hogarId) || null;
    const conSolicitudes = Boolean(hogar && estado.solicitudes.some((item) => item.hogarId === hogar.id));
    const roles = ["ciudadano", "reciclador", "facilitador"];
    const resumenHogar = perfil.rol !== "ciudadano" ? "" : hogar ? `
      <section class="tarjeta hogar-vinculado" aria-labelledby="hogar-vinculado-titulo">
        <h2 id="hogar-vinculado-titulo">Hogar vinculado</h2>
        <dl class="resumen-datos">
          <dt>Hogar</dt><dd>${escaparHtml(hogar.alias)}</dd>
          <dt>Microzona</dt><dd>${escaparHtml(hogar.microzona)}${tieneCobertura(estado, hogar.microzona) ? "" : " · sin recicladores asignados"}</dd>
          <dt>Referencia</dt><dd>${escaparHtml(hogar.referenciaEntrega)}</dd>
          <dt>Consentimiento</dt><dd>${hogar.consentimiento ? "Registrado" : "Pendiente"}</dd>
        </dl>
        <div class="acciones">
          <button class="boton primario" type="button" data-ir-rol="ciudadano">Solicitar una recolección</button>
        </div>
      </section>` : `
      <div class="aviso aviso--error">Tu cuenta de ciudadano no tiene un hogar vinculado (puede que se hayan borrado los datos de prueba). Completa los datos del hogar y guarda el perfil para vincularlo.</div>`;
    return `
      ${resumenHogar}
      <form id="form-perfil" class="tarjeta formulario">
        <h2>Mi perfil demo</h2>
        <p>Sesión local activa para visualización.</p>
        <label for="perfil-nombre">Nombre</label>
        <input id="perfil-nombre" name="nombre" value="${escaparHtml(perfil.nombre)}" maxlength="100" required>
        <label for="perfil-email">Correo electrónico</label>
        <input id="perfil-email" name="email" type="email" value="${escaparHtml(perfil.email)}" maxlength="150" required>
        <label for="perfil-rol">Perfil</label>
        <select id="perfil-rol" name="rol">${roles.map((rol) => `<option value="${rol}" ${perfil.rol === rol ? "selected" : ""}>${rol[0].toUpperCase()}${rol.slice(1)}</option>`).join("")}</select>
        ${camposHogar("perfil", estado, hogar, conSolicitudes)}
        <div class="acciones">
          <button class="boton primario" type="submit">Guardar perfil</button>
          <button class="boton secundario" type="button" data-cerrar-sesion>Cerrar sesión demo</button>
        </div>
      </form>`;
  }

  /** Crea o actualiza el hogar del ciudadano en los datos de la demo; devuelve su id o un error. */
  function guardarHogar(datos, hogarIdActual = null) {
    if (!datos.alias || !datos.microzona || !datos.referenciaEntrega) return { error: "Completa el nombre, la microzona y la referencia del hogar." };
    if (!datos.consentimiento) return { error: "Para vincular el hogar se necesita el consentimiento de uso de datos." };
    const estado = obtenerEstado();
    const existente = hogarIdActual ? estado.hogares.find((item) => item.id === hogarIdActual) : null;
    const hogar = existente
      ? { ...existente, alias: datos.alias, microzona: datos.microzona || existente.microzona, referenciaEntrega: datos.referenciaEntrega, consentimiento: true }
      : crearHogar({ id: crearId("H"), ...datos, consentimiento: true });
    const resultado = guardarCambios((actual) => ({
      ...actual,
      hogares: existente
        ? actual.hogares.map((item) => (item.id === hogar.id ? hogar : item))
        : [...actual.hogares, hogar],
    }));
    if (!resultado.ok) return { error: resultado.mensaje || "No se pudo guardar el hogar en este navegador." };
    return { hogar };
  }

  function registrar(evento) {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    if (!formulario.reportValidity()) return;
    const nombre = formulario.elements.nombre.value.trim();
    const email = formulario.elements.email.value.trim().toLowerCase();
    const rol = formulario.elements.rol.value;
    const clave = formulario.elements.clave.value;
    const confirmar = formulario.elements.confirmarClave.value;
    if (clave !== confirmar) return dibujar("Las contraseñas de demostración no coinciden.", "error");
    const usuarios = leerListaUsuarios();
    if (usuarios.some((usuario) => usuario.email === email)) return dibujar("Ese correo ya tiene un perfil demo. Puedes iniciar sesión.", "error");
    const usuario = { id: crearId("USR"), nombre, email, rol, hogarId: null };
    if (rol === "ciudadano") {
      const { hogar, error } = guardarHogar(leerCamposHogar(formulario));
      if (error) return dibujar(error, "error");
      usuario.hogarId = hogar.id;
    }
    if (!guardarListaUsuarios([...usuarios, usuario]) || !guardarEmailActivo(email)) {
      return dibujar("No se pudo guardar el perfil demo en este navegador.", "error");
    }
    panel = "perfil";
    seleccionarPanel(panel);
    dibujar(rol === "ciudadano"
      ? "Cuenta demo creada y vinculada a tu hogar. Ya puedes solicitar recolecciones sin elegir el hogar."
      : "Cuenta demo creada. La contraseña no se guardó.", "exito");
  }

  function iniciarSesion(evento) {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    if (!formulario.reportValidity()) return;
    const email = formulario.elements.email.value.trim().toLowerCase();
    const usuario = leerListaUsuarios().find((item) => item.email === email);
    if (!usuario) return dibujar("No se encontró ese correo. Crea primero un perfil demo.", "error");
    if (!guardarEmailActivo(email)) return dibujar("No se pudo iniciar la sesión demo en este navegador.", "error");
    panel = "perfil";
    seleccionarPanel(panel);
    dibujar("Sesión demo iniciada. La contraseña no fue verificada ni almacenada.", "exito");
  }

  function guardarPerfil(evento) {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    if (!formulario.reportValidity()) return;
    const emailAnterior = leerEmailActivo();
    const emailNuevo = formulario.elements.email.value.trim().toLowerCase();
    const rol = formulario.elements.rol.value;
    const usuarios = leerListaUsuarios();
    if (usuarios.some((usuario) => usuario.email === emailNuevo && usuario.email !== emailAnterior)) {
      return dibujar("Ese correo ya está asociado a otro perfil demo.", "error");
    }
    const actual = usuarios.find((usuario) => usuario.email === emailAnterior);
    let hogarId = actual?.hogarId ?? null;
    if (rol === "ciudadano") {
      const hogarVigente = obtenerEstado().hogares.some((item) => item.id === hogarId) ? hogarId : null;
      const { hogar, error } = guardarHogar(leerCamposHogar(formulario), hogarVigente);
      if (error) return dibujar(error, "error");
      hogarId = hogar.id;
    }
    const actualizados = usuarios.map((usuario) => usuario.email === emailAnterior
      ? { ...usuario, nombre: formulario.elements.nombre.value.trim(), email: emailNuevo, rol, hogarId }
      : usuario);
    if (!guardarListaUsuarios(actualizados) || !guardarEmailActivo(emailNuevo)) {
      return dibujar("No se pudieron guardar los cambios del perfil.", "error");
    }
    dibujar("Perfil demo actualizado.", "exito");
  }

  function cerrarSesion() {
    try { localStorage.removeItem(CLAVE_SESION_DEMO); } catch { /* La vista puede continuar sin persistencia. */ }
    panel = "login";
    seleccionarPanel(panel);
    dibujar("Sesión demo cerrada.", "info");
  }

  dibujar();
}
