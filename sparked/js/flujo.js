// Piezas compartidas del sitio: datos del cliente, vista previa, pago y entrega.
// Todos los textos salen del diccionario de idioma.js (español o inglés, según lo que elija el visitante).
import { api, esc, opciones, GRADOS, MATERIAS, limpiarTel, waLink, pintarSprites } from "./sitio.js";
import { CONFIG } from "./config.js";
import { sparky } from "./arte.js";
import { sparkyVivo, escribirTexto } from "./ui.js";
import { t, th, marca, poner, idioma, alCambiarIdioma, textoServidor, nombreGrado, nombreMateria, fecha } from "./idioma.js";

export { api, esc, opciones, GRADOS, MATERIAS, limpiarTel, waLink, pintarSprites, CONFIG };
export { t, th, marca, poner, idioma, alCambiarIdioma, textoServidor, nombreGrado, nombreMateria, fecha };

// Mensaje de un error para la familia: el del servidor en español; en inglés, su traducción (o uno general).
export const mensajeError = (err) => (err?.datos?.campo === "codigo" && idioma() === "en" ? t("codigo.error") : textoServidor(err?.message || t("error.servidor")));

export async function cargarColegios(select, conOtro = true) {
  let lista = [];
  try { lista = (await api.get("/colegios")).colegios ?? []; } catch { lista = []; }
  const ops = lista.map((c) => ({ valor: c.id, texto: c.nombre }));
  if (conOtro) ops.push({ valor: "otro", texto: "Otro colegio" });
  opciones(select, ops, "Elige el colegio");
  return lista;
}

// Ladas (códigos de país) que ofrece el formulario de la compra; México va primero y es la de siempre. El teléfono se
// guarda en formato internacional ("+52" + 10 dígitos) para que, cuando exista el envío por WhatsApp, llegue a cualquier país.
export const LADAS = [["52", "México"], ["1", "Estados Unidos, Canadá y Caribe"], ["34", "España"], ["57", "Colombia"], ["54", "Argentina"], ["51", "Perú"], ["56", "Chile"], ["593", "Ecuador"], ["502", "Guatemala"], ["503", "El Salvador"], ["504", "Honduras"], ["505", "Nicaragua"], ["506", "Costa Rica"], ["507", "Panamá"], ["591", "Bolivia"], ["595", "Paraguay"], ["598", "Uruguay"], ["58", "Venezuela"]];
// Los errores son claves del diccionario (se traducen al mostrarse).
export function leerContacto(raiz) {
  const nombre = raiz.querySelector("[name=nombre]")?.value.trim() ?? "";
  const lada = String(raiz.querySelector("[name=lada]")?.value || "52").replace(/\D/g, "");
  let numero = limpiarTel(raiz.querySelector("[name=telefono]")?.value);
  // Si escriben la lada también en el número, se quita una sola vez.
  if (lada === "52") { if (numero.length === 12 && numero.startsWith("52")) numero = numero.slice(2); if (numero.length === 13 && numero.startsWith("521")) numero = numero.slice(3); }
  else if (numero.length > 7 && numero.startsWith(lada) && numero.length - lada.length >= 7) numero = numero.slice(lada.length);
  const correo = raiz.querySelector("[name=correo]")?.value.trim() ?? "";
  const errores = [];
  if (nombre.length < 2) errores.push("contacto.err_nombre");
  // México: 10 dígitos exactos; otros países: de 7 dígitos en adelante, sin pasar de 15 con todo y lada.
  if (lada === "52" ? numero.length !== 10 : numero.length < 7 || (lada + numero).length > 15) errores.push("contacto.err_tel");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) errores.push("contacto.err_correo");
  return { nombre, lada, numero, telefono: `+${lada}${numero}`, correo, errores };
}
export function guardarContacto(c) { try { localStorage.setItem("sparked_contacto", JSON.stringify(c)); } catch {} }
export function contactoGuardado() { try { return JSON.parse(localStorage.getItem("sparked_contacto") || "null"); } catch { return null; } }

// Vista previa dentro de la página (el reproductor en un marco) con el botón de pago debajo.
export function marcoVistaPrevia(destino, src, titulo) {
  // En teléfonos la vista previa se abre en pantalla completa (dentro de un marco quedaría diminuta);
  // el reproductor trae un botón para volver aquí y pagar.
  const angosto = window.matchMedia("(max-width: 699px)").matches;
  destino.innerHTML = `<div class="resultado-guia"><div class="em">📘</div><div><b style="font-size:18px">${titulo ? esc(titulo) : marca("tu_guia")}</b>${marca("vp.nota", null, "div", 'class="ayuda"')}</div></div>
    ${angosto
      ? `<div class="acciones" style="margin-top:12px"><a class="boton" href="${esc(src)}" data-i18n="vp.ver">${th("vp.ver")}</a>${marca("vp.ver_nota", null, "div", 'class="ayuda"')}</div>`
      : `<div class="marco-demo" style="margin-top:12px"><iframe src="${esc(src)}" title="${esc(t("vp.marco"))}" data-i18n-attr="title:vp.marco"></iframe></div><div class="ayuda" style="margin-top:6px"><a href="${esc(src)}" data-i18n="vp.pantalla">${th("vp.pantalla")}</a></div>`}`;
}

// Pago: pide al servidor crear el cobro. Con Mercado Pago (o Stripe) lleva a su página de pago; sin cobro en línea
// (motor en blanco) muestra el modo manual.
export async function iniciarPago(destino, datos) {
  destino.innerHTML = `<div class="estado-carga"><div class="sk-anima">${sparky("escribiendo", 5)}</div>${marca("pago.preparando", null, "div")}</div>`;
  try {
    const r = await api.post("/pago/crear", datos);
    if (r.modo === "codigo") {
      // Código gratis: la guía ya quedó entregada; listo.html muestra el avance y el link.
      try { localStorage.setItem("sparked_compra", r.compra_id); } catch {}
      location.href = r.url || `listo.html?compra=${encodeURIComponent(r.compra_id)}`; return r;
    }
    if (r.modo === "mercadopago" && r.url) {
      // Se guarda la compra por si al regresar de Mercado Pago la dirección no la trae.
      try { localStorage.setItem("sparked_compra", r.compra_id); } catch {}
      poner(destino.querySelector(".estado-carga > div:last-child"), "pago.abriendo");
      location.href = r.url; return r;
    }
    if (r.modo === "stripe" && r.url) { location.href = r.url; return r; }
    // Modo manual: la compra queda pendiente y Daniel la confirma desde el panel.
    // El mensaje del servidor viene en español; en inglés se usa el texto del diccionario.
    const folio = r.compra_id?.slice(0, 8).toUpperCase() ?? "";
    destino.innerHTML = `<div class="panel-paso" style="box-shadow:none;padding:0">${marca("pago.apartada", null, "h2")}
      ${r.mensaje && idioma() === "es" ? `<p>${esc(r.mensaje)}</p>` : marca("pago.manual", null, "p")}
      <div class="resultado-guia"><div class="em">🧾</div><div>${marca("pago.folio", { folio }, "b")}${marca("pago.guardalo", null, "div", 'class="ayuda"')}</div></div>
      ${r.whatsapp ? `<div class="acciones"><a class="boton" target="_blank" rel="noopener" href="${esc(r.whatsapp)}" data-i18n="pago.confirmar_wa">${th("pago.confirmar_wa")}</a></div>` : ""}
      ${marca("pago.esperando", null, "div", 'id="espera" class="ayuda"')}</div>`;
    esperarPago(destino.querySelector("#espera"), r.compra_id);
    try { localStorage.setItem("sparked_compra", r.compra_id); } catch {}
    return r;
  } catch (e) {
    destino.innerHTML = `<p class="error">${esc(mensajeError(e))}</p>`;
    throw e;
  }
}

// Campo opcional del código de descuento (Daniel crea los códigos en el panel) y su lectura sin espacios.
export const campoCodigo = (estilo = "grid-column:1/-1") => `<div class="campo" style="${estilo}">${marca("codigo.etiqueta", null, "label")}<input name="codigo" maxlength="40" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="${esc(t("codigo.ph"))}" data-i18n-attr="placeholder:codigo.ph" style="text-transform:uppercase"></div>`;
export const leerCodigo = (raiz) => (raiz?.querySelector("[name=codigo]")?.value ?? "").replace(/\s+/g, "").toUpperCase();

export function esperarPago(el, compraId, cada = 5000) {
  const tick = async () => {
    try {
      const d = await api.get(`/pago/estado/${encodeURIComponent(compraId)}`);
      if (d.estado === "pagada" && d.link) { location.href = `listo.html?compra=${encodeURIComponent(compraId)}`; return; }
      // Mercado Pago: si el pago quedó pendiente (OXXO, SPEI o tarjeta en revisión), se explica qué sigue.
      if (el && PAGO_VIVO.includes(d.pago_mp)) { const tx = textoPagoPendiente(d); el.innerHTML = `${tx.tituloHtml}${tx.html}`; }
    } catch {}
    setTimeout(tick, cada);
  };
  setTimeout(tick, cada);
}

// Estados de Mercado Pago en los que el pago todavía puede confirmarse.
export const PAGO_VIVO = ["pending", "in_process", "authorized"];

// Mercado Pago: qué se le dice a la familia mientras su pago no se confirma (OXXO, SPEI o tarjeta en revisión).
// d = respuesta de GET /pago/estado; pista = el tipo de pago que Mercado Pago pone en la dirección al regresar al sitio
// ("ticket" = OXXO, "bank_transfer" = SPEI), por si su aviso todavía no llega al servidor.
// Regresa HTML con marcas data-i18n: si el visitante cambia de idioma, se traduce solo.
export function textoPagoPendiente(d, pista = "") {
  const metodo = d?.metodo || { ticket: "oxxo", bank_transfer: "spei", credit_card: "tarjeta", debit_card: "tarjeta", prepaid_card: "tarjeta" }[pista] || "";
  const conCorreo = (clave) => `<p data-i18n-correo="${esc(d?.correo || "")}" data-clave="${clave}">${conCorreoHtml(clave, d?.correo)}</p>`;
  const vence = d?.vence_en || "";
  const ficha = (clave) => (d?.ficha_url ? `<p class="acciones"><a class="boton linea" target="_blank" rel="noopener" href="${esc(d.ficha_url)}" data-i18n="${clave}">${th(clave)}</a></p>` : "");
  const venceHtml = (clave) => (vence ? marca(clave, { fecha: vence }, "p", 'class="ayuda"') : "");
  if (metodo === "oxxo") return { tituloHtml: marca("pend.oxxo_t", null, "b"), tituloClave: "pend.oxxo_t", html: `${conCorreo("pend.oxxo")}${venceHtml("pend.oxxo_vence")}${ficha("pend.oxxo_ficha")}` };
  if (metodo === "spei") return { tituloHtml: marca("pend.spei_t", null, "b"), tituloClave: "pend.spei_t", html: `${conCorreo("pend.spei")}${venceHtml("pend.spei_vence")}${ficha("pend.spei_ficha")}` };
  if (metodo === "tarjeta") return { tituloHtml: marca("pend.tarjeta_t", null, "b"), tituloClave: "pend.tarjeta_t", html: conCorreo("pend.tarjeta") };
  return { tituloHtml: marca("pago.esperando", null, "b"), tituloClave: "pago.esperando", html: conCorreo("pend.otro") };
}
// Párrafo con el correo en negritas: {correo} se rellena con el correo escapado (o «tu correo»).
function conCorreoHtml(clave, correo) {
  const marcaCorreo = "\u0001";
  return th(clave, { correo: marcaCorreo }).replace(marcaCorreo, `<b>${correo ? esc(correo) : th("tu_correo")}</b>`);
}
// Al cambiar de idioma se rehacen los párrafos con correo (no caben en un data-i18n simple porque llevan <b>).
alCambiarIdioma(() => document.querySelectorAll("[data-i18n-correo]").forEach((p) => { p.innerHTML = conCorreoHtml(p.dataset.clave, p.dataset.i18nCorreo); }));

// Pantalla "Buscando…" o "Generando…" con Sparky y un dato curioso cada 9 segundos.
// Sparky trabaja con casco de obra, martillo y bloques mientras tanto (Daniel, 7 nov 2026); si lo tocan, festeja y
// vuelve a martillar. Cada dato curioso se escribe letra por letra (en inglés usa su texto_en).
// titulo = clave del diccionario (por ejemplo "espera.generando").
// opciones.paginas (cuántas páginas se leen) sirve para estimar el tiempo; opciones.estimado son segundos totales si ya se conocen.
// opciones.inicio (milisegundos) = cuándo empezó el trabajo si fue antes de abrir la página, y opciones.base = el
// porcentaje con el que empezó (el resto de una guía pagada arranca en 42 %): así el tiempo estimado no vuelve a empezar.
// actualizar(pct, paso): paso puede ser un texto del servidor (se traduce con textoServidor) o una función que
// regresa el texto ya traducido (se vuelve a llamar al cambiar de idioma).
export function pantallaEspera(destino, titulo, opciones = {}) {
  destino.innerHTML = `<div class="estado-carga"><div class="esp-sparky"></div>${marca(titulo, null, "h2", 'id="esp-titulo"')}<div class="barra"><i id="esp-barra"></i></div><div id="esp-paso" class="ayuda"></div><div id="esp-tiempo" class="ayuda"></div><div class="dato" id="esp-dato"></div></div>`;
  const obrero = sparkyVivo(destino.querySelector(".esp-sparky"), { escala: 7, reposo: "construyendo", accesorios: "+casco+taller", acciones: [] });
  let datos = [], i = 0, timer = null, ultimo = null, paso = null;
  const pintaDato = (d) => {
    const caja = destino.querySelector("#esp-dato"); if (!d || !caja) return;
    const en = idioma() === "en";
    const fuente = en ? d.fuente_en || d.fuente : d.fuente;
    caja.innerHTML = `${th("espera.sabias")} ${esc(d.emoji ?? "")} <span class="esp-texto"></span><small style="display:block;color:var(--gris)">${fuente ? th("espera.fuente", { fuente }) : ""}</small>`;
    escribirTexto(caja.querySelector(".esp-texto"), en ? d.texto_en || d.texto : d.texto, 26);
  };
  const pinta = () => { if (!datos.length) return; ultimo = datos[i++ % datos.length]; pintaDato(ultimo); };
  fetch("datos/curiosos.json").then((r) => r.json()).then((d) => { datos = d.sort(() => Math.random() - .5); pinta(); timer = setInterval(pinta, 9000); }).catch(() => {});
  // Tiempo estimado: arranca con un cálculo por páginas (lectura + plan + primer bloque, medido en pruebas reales)
  // y se va corrigiendo con el avance real de la barra.
  const inicio = Math.min(Date.now(), Number(opciones.inicio) || Date.now());
  const base = Number(opciones.base) || 0;
  const previsto = opciones.estimado ?? (opciones.paginas ? 100 + 9 * Number(opciones.paginas) : null);
  let pct = base;
  const frase = (s) => s < 20 ? t("espera.casi") : s < 50 ? t("espera.menos_minuto") : s < 100 ? t("espera.un_minuto") : t("espera.minutos", { n: Math.round(s / 60) });
  const pintaTiempo = () => {
    const el = destino.querySelector("#esp-tiempo"); if (!el) return;
    const pasado = (Date.now() - inicio) / 1000;
    const porAvance = pct >= base + 10 && pasado >= 15 ? pasado * (100 - pct) / (pct - base) : null;
    let restante = null;
    if (previsto !== null && porAvance !== null) restante = Math.max(previsto - pasado, 0) * .5 + porAvance * .5;
    else if (previsto !== null) restante = Math.max(previsto - pasado, 0);
    else if (porAvance !== null) restante = porAvance;
    if (restante === null) { el.textContent = ""; return; }
    el.textContent = pasado < 5 && previsto !== null ? t("espera.estimado", { n: Math.max(2, Math.round(previsto / 60)) }) : "⏱️ " + frase(restante);
  };
  const pintaPaso = () => { const el = destino.querySelector("#esp-paso"); if (el && paso) el.textContent = typeof paso === "function" ? paso() : textoServidor(paso); };
  pintaTiempo();
  const reloj = setInterval(pintaTiempo, 1000);
  const quitarOyente = alCambiarIdioma(() => { pintaPaso(); pintaTiempo(); pintaDato(ultimo); });
  return {
    actualizar(p, nuevoPaso) { pct = Number(p) || pct; const b = destino.querySelector("#esp-barra"); if (b) b.style.width = Math.max(2, Math.min(100, pct)) + "%"; if (nuevoPaso) { paso = nuevoPaso; pintaPaso(); } pintaTiempo(); },
    detener() { clearInterval(timer); clearInterval(reloj); quitarOyente(); obrero.detener(); const el = destino.querySelector("#esp-tiempo"); if (el) el.textContent = ""; },
  };
}

// Mensaje de WhatsApp listo para reenviar al hijo (en el idioma del sitio).
export function mensajeWhatsApp(titulo, link) {
  return t("wa.mensaje", { titulo, link });
}
export const linkDeToken = (token) => `${CONFIG.sitio}guia.html#${token}`;
