// Piezas compartidas por los dos servicios: datos del cliente, vista previa, pago y entrega.
import { api, esc, opciones, GRADOS, MATERIAS, limpiarTel, waLink, pintarSprites } from "./sitio.js";
import { CONFIG } from "./config.js";
import { sparky } from "./arte.js";
import { sparkyVivo, escribirTexto } from "./ui.js";

export { api, esc, opciones, GRADOS, MATERIAS, limpiarTel, waLink, pintarSprites, CONFIG };

export async function cargarColegios(select, conOtro = true) {
  let lista = [];
  try { lista = (await api.get("/colegios")).colegios ?? []; } catch { lista = []; }
  const ops = lista.map((c) => ({ valor: c.id, texto: c.nombre }));
  if (conOtro) ops.push({ valor: "otro", texto: "Otro colegio" });
  opciones(select, ops, "Elige el colegio");
  return lista;
}

export function leerContacto(raiz) {
  const nombre = raiz.querySelector("[name=nombre]")?.value.trim() ?? "";
  const telefono = limpiarTel(raiz.querySelector("[name=telefono]")?.value);
  const correo = raiz.querySelector("[name=correo]")?.value.trim() ?? "";
  const errores = [];
  if (nombre.length < 2) errores.push("Escribe el nombre de quien pide la guía.");
  if (telefono.length < 10) errores.push("Escribe un WhatsApp de 10 dígitos.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) errores.push("Escribe un correo válido.");
  return { nombre, telefono, correo, errores };
}
export function guardarContacto(c) { try { localStorage.setItem("sparked_contacto", JSON.stringify(c)); } catch {} }
export function contactoGuardado() { try { return JSON.parse(localStorage.getItem("sparked_contacto") || "null"); } catch { return null; } }

// Vista previa dentro de la página (el reproductor en un marco) con el botón de pago debajo.
export function marcoVistaPrevia(destino, src, titulo) {
  // En teléfonos la vista previa se abre en pantalla completa (dentro de un marco quedaría diminuta);
  // el reproductor trae un botón para volver aquí y pagar.
  const angosto = window.matchMedia("(max-width: 699px)").matches;
  destino.innerHTML = `<div class="resultado-guia"><div class="em">📘</div><div><b style="font-size:18px">${esc(titulo)}</b><div class="ayuda">Vista previa gratis: portada, primera pista y un juego. Lo demás se abre al pagar.</div></div></div>
    ${angosto
      ? `<a class="boton" style="margin-top:12px" href="${esc(src)}">▶ Ver la vista previa</a><div class="ayuda">Se abre en pantalla completa (mejor con el teléfono en horizontal). Al final hay un botón para volver aquí.</div>`
      : `<div class="marco-demo" style="margin-top:12px"><iframe src="${esc(src)}" title="Vista previa de tu guía"></iframe></div><div class="ayuda" style="margin-top:6px"><a href="${esc(src)}">Ver en pantalla completa ↗</a></div>`}`;
}

// Pago: pide al servidor crear el cobro. Con Mercado Pago (o Stripe) lleva a su página de pago; sin cobro en línea
// (motor en blanco) muestra el modo manual.
export async function iniciarPago(destino, datos) {
  destino.innerHTML = `<div class="estado-carga"><div class="sk-anima">${sparky("escribiendo", 5)}</div><div>Preparando tu pago…</div></div>`;
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
      const aviso = destino.querySelector(".estado-carga > div:last-child"); if (aviso) aviso.textContent = "Abriendo Mercado Pago…";
      location.href = r.url; return r;
    }
    if (r.modo === "stripe" && r.url) { location.href = r.url; return r; }
    // Modo manual: la compra queda pendiente y Daniel la confirma desde el panel.
    destino.innerHTML = `<div class="panel-paso" style="box-shadow:none;padding:0"><h2>Tu guía está apartada 🎟️</h2>
      <p>${esc(r.mensaje ?? "El pago en línea se está configurando. Te contactamos por WhatsApp para completar tu compra y activar tu guía.")}</p>
      <div class="resultado-guia"><div class="em">🧾</div><div><b>Folio: ${esc(r.compra_id?.slice(0, 8).toUpperCase() ?? "")}</b><div class="ayuda">Guárdalo. En cuanto se confirme el pago, el link de tu guía aparece aquí y te la mandamos por correo y por WhatsApp.</div></div></div>
      ${r.whatsapp ? `<a class="boton" target="_blank" rel="noopener" href="${esc(r.whatsapp)}">💬 Confirmar por WhatsApp</a>` : ""}
      <div id="espera" class="ayuda">Esperando confirmación…</div></div>`;
    esperarPago(destino.querySelector("#espera"), r.compra_id);
    try { localStorage.setItem("sparked_compra", r.compra_id); } catch {}
    return r;
  } catch (e) {
    destino.innerHTML = `<p class="error">${esc(e.message)}</p>`;
    throw e;
  }
}

// Campo opcional del código de descuento (Daniel crea los códigos en el panel) y su lectura sin espacios.
export const campoCodigo = (estilo = "grid-column:1/-1") => `<div class="campo" style="${estilo}"><label>¿Tienes un código? Escríbelo aquí</label><input name="codigo" maxlength="40" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="Opcional" style="text-transform:uppercase"></div>`;
export const leerCodigo = (raiz) => (raiz?.querySelector("[name=codigo]")?.value ?? "").replace(/\s+/g, "").toUpperCase();

export function esperarPago(el, compraId, cada = 5000) {
  const tick = async () => {
    try {
      const d = await api.get(`/pago/estado/${encodeURIComponent(compraId)}`);
      if (d.estado === "pagada" && d.link) { location.href = `listo.html?compra=${encodeURIComponent(compraId)}`; return; }
      // Mercado Pago: si el pago quedó pendiente (OXXO, SPEI o tarjeta en revisión), se explica qué sigue.
      if (el && PAGO_VIVO.includes(d.pago_mp)) { const t = textoPagoPendiente(d); el.innerHTML = `<b>${esc(t.titulo)}</b>${t.html}`; }
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
export function textoPagoPendiente(d, pista = "") {
  const metodo = d?.metodo || { ticket: "oxxo", bank_transfer: "spei", credit_card: "tarjeta", debit_card: "tarjeta", prepaid_card: "tarjeta" }[pista] || "";
  const correo = `<b>${esc(d?.correo || "tu correo")}</b>`;
  const vence = d?.vence_en ? new Date(d.vence_en).toLocaleString("es-MX", { dateStyle: "long", timeStyle: "short" }) : "";
  const ficha = (texto) => (d?.ficha_url ? `<p><a class="boton linea" target="_blank" rel="noopener" href="${esc(d.ficha_url)}">${texto}</a></p>` : "");
  if (metodo === "oxxo") return { titulo: "Tu pago en OXXO está en camino 🧾", html: `<p>Tu pago en OXXO puede tardar hasta 1 hora en reflejarse. En cuanto se confirme, tu guía se activa sola y te llega al correo ${correo}.</p>${vence ? `<p class="ayuda">Si todavía no pagas, tienes hasta el <b>${esc(vence)}</b> para llevar tu ficha a cualquier tienda OXXO.</p>` : ""}${ficha("🧾 Ver mi ficha de pago")}` };
  if (metodo === "spei") return { titulo: "Tu transferencia SPEI está en camino 🏦", html: `<p>Tu transferencia por SPEI puede tardar hasta 1 hora en reflejarse. En cuanto se confirme, tu guía se activa sola y te llega al correo ${correo}.</p>${vence ? `<p class="ayuda">Si todavía no transfieres, tienes hasta el <b>${esc(vence)}</b> para hacer la transferencia con los datos de tu ficha.</p>` : ""}${ficha("🏦 Ver los datos para transferir")}` };
  if (metodo === "tarjeta") return { titulo: "Mercado Pago está revisando tu pago 💳", html: `<p>La revisión de un pago con tarjeta puede tardar unos minutos. En cuanto se apruebe, tu guía se activa sola y te llega al correo ${correo}.</p>` };
  return { titulo: "Esperando la confirmación del pago…", html: `<p>En cuanto se confirme el pago, tu guía se activa sola y te llega al correo ${correo}.</p>` };
}

// Pantalla "Buscando…" o "Generando…" con Sparky y un dato curioso cada 9 segundos.
// Sparky trabaja con casco de obra, martillo y bloques mientras tanto (Daniel, 7 nov 2026); si lo tocan, festeja y
// vuelve a martillar. Cada dato curioso se escribe letra por letra.
// opciones.paginas (cuántas páginas se leen) sirve para estimar el tiempo; opciones.estimado son segundos totales si ya se conocen.
// opciones.inicio (milisegundos) = cuándo empezó el trabajo si fue antes de abrir la página, y opciones.base = el
// porcentaje con el que empezó (el resto de una guía pagada arranca en 42 %): así el tiempo estimado no vuelve a empezar.
export function pantallaEspera(destino, titulo, opciones = {}) {
  destino.innerHTML = `<div class="estado-carga"><div class="esp-sparky"></div><h2 id="esp-titulo">${esc(titulo)}</h2><div class="barra"><i id="esp-barra"></i></div><div id="esp-paso" class="ayuda"></div><div id="esp-tiempo" class="ayuda"></div><div class="dato" id="esp-dato"></div></div>`;
  const obrero = sparkyVivo(destino.querySelector(".esp-sparky"), { escala: 7, reposo: "construyendo", accesorios: "+casco+taller", acciones: [] });
  let datos = [], i = 0, timer = null;
  const pinta = () => {
    const caja = destino.querySelector("#esp-dato"); if (!datos.length || !caja) return;
    const d = datos[i++ % datos.length];
    caja.innerHTML = `¿Sabías que…? ${esc(d.emoji ?? "")} <span class="esp-texto"></span><small style="display:block;color:var(--gris)">${d.fuente ? "Fuente: " + esc(d.fuente) : ""}</small>`;
    escribirTexto(caja.querySelector(".esp-texto"), d.texto, 26);
  };
  fetch("datos/curiosos.json").then((r) => r.json()).then((d) => { datos = d.sort(() => Math.random() - .5); pinta(); timer = setInterval(pinta, 9000); }).catch(() => {});
  // Tiempo estimado: arranca con un cálculo por páginas (lectura + plan + primer bloque, medido en pruebas reales)
  // y se va corrigiendo con el avance real de la barra.
  const inicio = Math.min(Date.now(), Number(opciones.inicio) || Date.now());
  const base = Number(opciones.base) || 0;
  const previsto = opciones.estimado ?? (opciones.paginas ? 100 + 9 * Number(opciones.paginas) : null);
  let pct = base;
  const frase = (s) => s < 20 ? "Ya casi está…" : s < 50 ? "Falta menos de un minuto" : s < 100 ? "Falta alrededor de un minuto" : `Faltan unos ${Math.round(s / 60)} minutos`;
  const pintaTiempo = () => {
    const el = destino.querySelector("#esp-tiempo"); if (!el) return;
    const pasado = (Date.now() - inicio) / 1000;
    const porAvance = pct >= base + 10 && pasado >= 15 ? pasado * (100 - pct) / (pct - base) : null;
    let restante = null;
    if (previsto !== null && porAvance !== null) restante = Math.max(previsto - pasado, 0) * .5 + porAvance * .5;
    else if (previsto !== null) restante = Math.max(previsto - pasado, 0);
    else if (porAvance !== null) restante = porAvance;
    if (restante === null) { el.textContent = ""; return; }
    el.textContent = pasado < 5 && previsto !== null ? `⏱️ Tiempo estimado: unos ${Math.max(1, Math.round(previsto / 60))} minutos` : "⏱️ " + frase(restante);
  };
  pintaTiempo();
  const reloj = setInterval(pintaTiempo, 1000);
  return {
    actualizar(p, paso) { pct = Number(p) || pct; const b = destino.querySelector("#esp-barra"); if (b) b.style.width = Math.max(2, Math.min(100, pct)) + "%"; const el = destino.querySelector("#esp-paso"); if (el && paso) el.textContent = paso; pintaTiempo(); },
    detener() { clearInterval(timer); clearInterval(reloj); obrero.detener(); const el = destino.querySelector("#esp-tiempo"); if (el) el.textContent = ""; },
  };
}

// Mensaje de WhatsApp listo para reenviar al hijo.
export function mensajeWhatsApp(titulo, link) {
  return `Hola 👋 Aquí está tu guía interactiva de SparkEd: *${titulo}*\n\nÁbrela en tu iPad o computadora:\n${link}\n\nEs para nuestra familia: vale 7 días y hasta en 2 dispositivos. ¡A estudiar jugando! 🚀`;
}
export const linkDeToken = (token) => `${CONFIG.sitio}guia.html#${token}`;
