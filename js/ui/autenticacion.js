import { crearId } from "./servicios.js";
import { escaparHtml } from "./comun.js";

const CLAVE_USUARIOS_DEMO = "ciudadVerde.usuariosDemo.v1";
const CLAVE_SESION_DEMO = "ciudadVerde.sesionDemo.v1";

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

export function renderizarAutenticacion(raiz, { cerrar, seleccionarPanel = () => {} }, panelInicial = "registro") {
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
    raiz.querySelector("[data-ir-login]")?.addEventListener("click", () => {
      panel = "login";
      seleccionarPanel(panel);
      dibujar();
    });
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
        <label for="registro-clave">Contraseña de demostración</label>
        <input id="registro-clave" name="clave" type="password" minlength="6" autocomplete="new-password" required>
        <label for="registro-clave-confirmar">Confirmar contraseña</label>
        <input id="registro-clave-confirmar" name="confirmarClave" type="password" minlength="6" autocomplete="new-password" required>
        <p class="texto-ayuda">La contraseña solo se compara en esta pantalla; no se almacena ni se transmite.</p>
        <button class="boton primario" type="submit">Crear cuenta demo</button>
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
        <button class="boton primario" type="submit">Entrar a mi perfil demo</button>
      </form>`;
  }

  function dibujarPerfil(perfil) {
    if (!perfil) {
      return `
        <section class="tarjeta">
          <h2>Perfil demo</h2>
          <p>No hay una sesión demo activa.</p>
          <button class="boton primario" type="button" data-ir-login>Ir a iniciar sesión</button>
        </section>`;
    }
    const roles = ["ciudadano", "reciclador", "facilitador"];
    return `
      <form id="form-perfil" class="tarjeta formulario">
        <h2>Mi perfil demo</h2>
        <p>Sesión local activa para visualización.</p>
        <label for="perfil-nombre">Nombre</label>
        <input id="perfil-nombre" name="nombre" value="${escaparHtml(perfil.nombre)}" maxlength="100" required>
        <label for="perfil-email">Correo electrónico</label>
        <input id="perfil-email" name="email" type="email" value="${escaparHtml(perfil.email)}" maxlength="150" required>
        <label for="perfil-rol">Perfil</label>
        <select id="perfil-rol" name="rol">${roles.map((rol) => `<option value="${rol}" ${perfil.rol === rol ? "selected" : ""}>${rol[0].toUpperCase()}${rol.slice(1)}</option>`).join("")}</select>
        <div class="acciones">
          <button class="boton primario" type="submit">Guardar perfil</button>
          <button class="boton secundario" type="button" data-cerrar-sesion>Cerrar sesión demo</button>
        </div>
      </form>`;
  }

  function registrar(evento) {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    if (!formulario.reportValidity()) return;
    const nombre = formulario.elements.nombre.value.trim();
    const email = formulario.elements.email.value.trim().toLowerCase();
    const clave = formulario.elements.clave.value;
    const confirmar = formulario.elements.confirmarClave.value;
    if (clave !== confirmar) return dibujar("Las contraseñas de demostración no coinciden.", "error");
    const usuarios = leerListaUsuarios();
    if (usuarios.some((usuario) => usuario.email === email)) return dibujar("Ese correo ya tiene un perfil demo. Puedes iniciar sesión.", "error");
    const usuario = { id: crearId("USR"), nombre, email, rol: formulario.elements.rol.value };
    if (!guardarListaUsuarios([...usuarios, usuario]) || !guardarEmailActivo(email)) {
      return dibujar("No se pudo guardar el perfil demo en este navegador.", "error");
    }
    panel = "perfil";
    seleccionarPanel(panel);
    dibujar("Cuenta demo creada. La contraseña no se guardó.", "exito");
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
    const usuarios = leerListaUsuarios();
    if (usuarios.some((usuario) => usuario.email === emailNuevo && usuario.email !== emailAnterior)) {
      return dibujar("Ese correo ya está asociado a otro perfil demo.", "error");
    }
    const actualizados = usuarios.map((usuario) => usuario.email === emailAnterior
      ? { ...usuario, nombre: formulario.elements.nombre.value.trim(), email: emailNuevo, rol: formulario.elements.rol.value }
      : usuario);
    if (!guardarListaUsuarios(actualizados) || !guardarEmailActivo(emailNuevo)) {
      return dibujar("No se pudieron guardar los cambios del perfil.", "error");
    }
    dibujar("Perfil demo actualizado.", "exito");
  }

  function cerrarSesion() {
    try { localStorage.removeItem(CLAVE_SESION_DEMO); } catch { /* La vista puede continuar sin persistencia. */ }
    panel = "login";
    dibujar("Sesión demo cerrada.", "info");
  }

  dibujar();
}
