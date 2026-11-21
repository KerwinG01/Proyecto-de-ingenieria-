/** Presentación inicial del prototipo y orientación para cada rol simulado. */
import { mostrarAviso } from "./comun.js";
import { crearDatosIniciales } from "./servicios.js";
import { descartarKpiCalculados } from "./modo-prueba.js";
import { borrarCuentasDemo } from "./autenticacion.js";

export function renderizarInicio(raiz, contexto) {
  const estado = contexto.obtenerEstado();
  const totalSolicitudes = estado.solicitudes.length;
  const totalRecicladores = estado.recicladores.filter((reciclador) => reciclador.activo).length;

  raiz.innerHTML = `
    <section class="vista-rol vista-inicio" aria-labelledby="titulo-inicio">
      <header class="portada-inicio">
        <p class="ceja">Microzona piloto</p>
        <h1 id="titulo-inicio">Ciudad <span>Verde</span></h1>
        <p class="bajada-inicio">Conectamos hogares y recicladores de oficio para coordinar la recolección de materiales reciclables de forma organizada.</p>
        <p>La recolección piloto se programa para los sábados, entre las 8:00 a. m. y las 12:00 p. m.</p>
        <p class="etiqueta-demo">Demostración interactiva del prototipo</p>
        <div class="acciones">
          <button class="boton primario" type="button" data-ir-rol="ciudadano">Iniciar demostración</button>
          <a class="boton secundario" href="./test/tests.html" target="_blank" rel="noopener">Ver validación y pruebas</a>
        </div>
      </header>

      <section aria-labelledby="como-funciona">
        <h2 id="como-funciona">¿Cómo funciona el prototipo?</h2>
        <div class="rejilla-inicio">
          <article class="tarjeta paso-inicio"><span class="numero-paso">1</span><h3>Registra una solicitud</h3><p>El ciudadano selecciona materiales y bolsas; también se puede registrar una solicitud asistida desde Facilitador.</p></article>
          <article class="tarjeta paso-inicio"><span class="numero-paso">2</span><h3>Busca compatibilidad</h3><p>El motor revisa microzona y distancia, materiales, franja horaria, cupo y volumen disponible.</p></article>
          <article class="tarjeta paso-inicio"><span class="numero-paso">3</span><h3>Confirma en cascada</h3><p>La oferta se presenta al reciclador con mejor puntaje. Si no acepta, continúa con el siguiente candidato.</p></article>
          <article class="tarjeta paso-inicio"><span class="numero-paso">4</span><h3>Consulta resultados</h3><p>Los roles permiten consultar estados, registrar resultados y revisar indicadores del piloto.</p></article>
        </div>
      </section>

      <section class="tarjeta resumen-inicio" aria-labelledby="resumen-piloto">
        <h2 id="resumen-piloto">Estado de esta demostración</h2>
        <p><strong>Solicitudes guardadas:</strong> ${totalSolicitudes}</p>
        <p><strong>Recicladores activos:</strong> ${totalRecicladores}</p>
        <p class="texto-ayuda">Los datos se conservan en el almacenamiento local de este navegador. Para empezar de cero, borra los datos de prueba: se eliminan las solicitudes, los hogares registrados y las cuentas demo, y se conservan solo el hogar de demostración y los recicladores R1–R4.</p>
        <p class="aviso" data-aviso role="status" aria-live="polite" hidden></p>
        <div class="acciones">
          <button class="boton peligro" type="button" data-borrar-datos>Borrar datos de prueba</button>
        </div>
      </section>

      <section aria-labelledby="elige-vista">
        <h2 id="elige-vista">Explora las vistas</h2>
        <div class="rejilla-inicio tarjetas-roles">
          <article class="tarjeta"><h3>Ciudadano</h3><p>Crear, consultar y cancelar solicitudes.</p><button class="boton secundario" type="button" data-ir-rol="ciudadano">Abrir Ciudadano</button></article>
          <article class="tarjeta"><h3>Reciclador</h3><p>Responder ofertas y registrar la recolección.</p><button class="boton secundario" type="button" data-ir-rol="reciclador">Abrir Reciclador</button></article>
          <article class="tarjeta"><h3>Facilitador</h3><p>Registrar hogares y gestionar solicitudes escaladas.</p><button class="boton secundario" type="button" data-ir-rol="facilitador">Abrir Facilitador</button></article>
          <article class="tarjeta"><h3>Administrador</h3><p>Editar parámetros y consultar los indicadores del sistema.</p><button class="boton secundario" type="button" data-ir-rol="administrador">Abrir Administrador</button></article>
        </div>
      </section>
    </section>`;

  raiz.querySelector("[data-borrar-datos]").addEventListener("click", () => {
    if (!window.confirm("¿Borrar las solicitudes, eventos, mensajes, hogares registrados y cuentas demo de este navegador y volver a los datos base?")) return;
    descartarKpiCalculados();
    borrarCuentasDemo();
    contexto.actualizarEstado(() => crearDatosIniciales());
    mostrarAviso(raiz, "Datos de prueba borrados. La demostración volvió a los datos base.", "exito");
  });
}
