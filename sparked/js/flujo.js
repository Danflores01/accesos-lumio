// Piezas compartidas por los dos servicios: datos del cliente, vista previa, pago y entrega.
import { api, esc, opciones, GRADOS, MATERIAS, limpiarTel, waLink, pintarSprites } from "./sitio.js";
import { CONFIG } from "./config.js";
import { sparky } from "./arte.js";

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
  destino.innerHTML = `<div class="resultado-guia"><div class="em">📘</div><div><b style="font-size:18px">${esc(titulo)}</b><div class="ayuda">Vista previa gratis: portada, primera pista y un juego. Lo demás se abre al pagar.</div></div></div>
    <div class="marco-demo" style="margin-top:12px"><iframe src="${esc(src)}" title="Vista previa de tu guía"></iframe></div>`;
}

// Pago: pide al servidor crear el cobro. Con Stripe redirige; sin Stripe (motor en blanco) muestra el modo manual.
export async function iniciarPago(destino, datos) {
  destino.innerHTML = `<div class="estado-carga">${sparky("pensando", 5)}<div>Preparando tu pago…</div></div>`;
  try {
    const r = await api.post("/pago/crear", datos);
    if (r.modo === "stripe" && r.url) { location.href = r.url; return r; }
    // Modo manual: la compra queda pendiente y Daniel la confirma desde el panel.
    destino.innerHTML = `<div class="panel-paso" style="box-shadow:none;padding:0"><h2>Tu guía está apartada 🎟️</h2>
      <p>${esc(r.mensaje ?? "El pago en línea se está configurando. Te contactamos por WhatsApp para completar tu compra y activar tu guía.")}</p>
      <div class="resultado-guia"><div class="em">🧾</div><div><b>Folio: ${esc(r.compra_id?.slice(0, 8).toUpperCase() ?? "")}</b><div class="ayuda">Guárdalo. En cuanto se confirme el pago, tu link aparece aquí y te llega por correo.</div></div></div>
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

export function esperarPago(el, compraId, cada = 5000) {
  const tick = async () => {
    try {
      const d = await api.get(`/pago/estado/${encodeURIComponent(compraId)}`);
      if (d.estado === "pagada" && d.link) { location.href = `listo.html?compra=${encodeURIComponent(compraId)}`; return; }
    } catch {}
    setTimeout(tick, cada);
  };
  setTimeout(tick, cada);
}

// Pantalla "Buscando…" o "Generando…" con Sparky y un dato curioso cada 9 segundos.
export function pantallaEspera(destino, titulo) {
  destino.innerHTML = `<div class="estado-carga"><div class="flot">${sparky("pensando", 6)}</div><h2 id="esp-titulo">${esc(titulo)}</h2><div class="barra"><i id="esp-barra"></i></div><div id="esp-paso" class="ayuda"></div><div class="dato" id="esp-dato"></div></div>`;
  let datos = [], i = 0, timer = null;
  const pinta = () => { if (!datos.length) return; const d = datos[i++ % datos.length]; destino.querySelector("#esp-dato").innerHTML = `¿Sabías que…? ${esc(d.emoji ?? "")} ${esc(d.texto)} <small style="display:block;color:var(--gris)">${d.fuente ? "Fuente: " + esc(d.fuente) : ""}</small>`; };
  fetch("datos/curiosos.json").then((r) => r.json()).then((d) => { datos = d.sort(() => Math.random() - .5); pinta(); timer = setInterval(pinta, 9000); }).catch(() => {});
  return {
    actualizar(pct, paso) { const b = destino.querySelector("#esp-barra"); if (b) b.style.width = Math.max(2, Math.min(100, pct)) + "%"; const p = destino.querySelector("#esp-paso"); if (p && paso) p.textContent = paso; },
    detener() { clearInterval(timer); },
  };
}

// Mensaje de WhatsApp listo para reenviar al hijo.
export function mensajeWhatsApp(titulo, link) {
  return `Hola 👋 Aquí está tu guía interactiva de SparkEd: *${titulo}*\n\nÁbrela en tu iPad o computadora:\n${link}\n\nEs para nuestra familia: vale 7 días y hasta en 2 aparatos. ¡A estudiar jugando! 🚀`;
}
export const linkDeToken = (token) => `${CONFIG.sitio}guia.html#${token}`;
