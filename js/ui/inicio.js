/** Presentación inicial del prototipo y orientación para cada rol simulado. */
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
        <button class="boton primario" type="button" data-ir-rol="reciclador">Ver vista del reciclador</button>
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
        <p class="texto-ayuda">Los datos se conservan en el almacenamiento local de este navegador.</p>
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
}
