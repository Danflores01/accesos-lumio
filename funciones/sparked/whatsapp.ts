// deno-lint-ignore-file no-explicit-any
// Módulo aparte: entrega de guías por WhatsApp (Green API) y comando "compartir".
// index.ts llama a rutasWhatsApp() en cada petición y a avisarPorWhatsApp() cuando una guía pagada queda 100 % lista.
//
// Es un sistema de ENTREGA, no un chatbot: el número de SparkEd no contesta nada, salvo el comando "compartir"
// (o "share"), y solo a chats individuales cuyo número coincide con una compra pagada (máximo 2 respuestas por chat
// cada 24 horas). Documentación: docs/WHATSAPP.md.
//
// Secretos (Supabase → Edge Functions → Secrets):
//   GREEN_API_ID_INSTANCE · GREEN_API_TOKEN_INSTANCE · GREEN_API_URL (opcional, la "apiUrl" de la instancia).
// El token del webhook no es un secreto aparte: es sha256(token de instancia + SUFIJO_WEBHOOK); /admin/whatsapp/configurar
// lo deja puesto en Green API (webhookUrlToken) y Green API lo manda como "Authorization: Bearer <token>".
//
// API de Green API usada (https://green-api.com/en/docs/api/):
//   POST {apiUrl}/waInstance{id}/sendMessage/{token}    { chatId, message, linkPreview } → { idMessage }
//   POST {apiUrl}/waInstance{id}/checkWhatsapp/{token}  { chatId } → { existsWhatsapp }
//   GET  {apiUrl}/waInstance{id}/getStateInstance/{token} → { stateInstance }
//   GET  {apiUrl}/waInstance{id}/getSettings/{token}     → { wid, webhookUrl, webhookUrlToken, ... }
//   POST {apiUrl}/waInstance{id}/setSettings/{token}     { webhookUrl, webhookUrlToken, incomingWebhook, ... } → { saveSettings }
// Avisos que llegan al webhook: incomingMessageReceived (textMessage, extendedTextMessage, quotedMessage),
// stateInstanceChanged, quotaExceeded y outgoingMessageStatus (noAccount y failed llegan siempre).
import type { CtxBase, CtxRutas, Entrega } from "./tipos.ts";


const PORTADA = "https://sparkeducation-mx.com";
const SUFIJO_WEBHOOK = ":sparked-whatsapp-webhook-v1";
const RESPUESTAS_POR_DIA = 2;       // respuestas al comando "compartir" por chat cada 24 horas
const DEMORA_ENVIO_MS = 15000;      // pausa entre mensajes de la cola de Green API (lo que recomienda su guía contra bloqueos)
const ESPERA_API_MS = 15000;        // tiempo máximo de cada llamada a Green API

// ---------- Llaves y llamadas a Green API ----------
const env = (k: string) => String((globalThis as any).Deno?.env?.get(k) ?? "").trim();
function llaves() {
  const id = env("GREEN_API_ID_INSTANCE").replace(/\D/g, "");
  const token = env("GREEN_API_TOKEN_INSTANCE");
  const url = (env("GREEN_API_URL") || "https://api.green-api.com").replace(/\/+$/, "");
  return { id, token, url };
}

// true cuando las llaves de Green API están puestas en los secretos de Supabase.
export function motorWhatsApp(): boolean {
  const k = llaves();
  return !!k.id && !!k.token;
}

async function api(metodo: string, cuerpo?: Record<string, unknown>): Promise<any> {
  const k = llaves();
  const r = await fetch(`${k.url}/waInstance${k.id}/${metodo}/${k.token}`, {
    method: cuerpo ? "POST" : "GET",
    headers: cuerpo ? { "content-type": "application/json" } : {},
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    signal: AbortSignal.timeout(ESPERA_API_MS),
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`Green API ${metodo}: HTTP ${r.status} ${txt.replace(/\s+/g, " ").slice(0, 160)}`);
  try { return JSON.parse(txt); } catch { return {}; }
}

async function sha256hex(s: string): Promise<string> {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
export async function tokenWebhook(): Promise<string> {
  return await sha256hex(llaves().token + SUFIJO_WEBHOOK);
}
function urlWebhook(): string {
  return `${env("SUPABASE_URL").replace(/\/+$/, "")}/functions/v1/sparked/whatsapp/webhook`;
}

// ---------- Teléfonos, chats e idioma ----------
// Teléfono de una compra → dígitos en formato internacional ("52" + 10 dígitos para México). Las compras viejas traen
// 10 dígitos sin lada (México); también se aceptan "52 1 …" y "52 …" sin "+". Devuelve "" si no sirve.
export function telefonoInternacional(t: unknown): string {
  const s = String(t ?? "").trim();
  let d = s.replace(/\D/g, "");
  if (!d) return "";
  if (!s.startsWith("+") && d.length === 10) d = "52" + d;
  if (d.startsWith("521") && d.length === 13) d = "52" + d.slice(3);
  return d.length >= 8 && d.length <= 15 ? d : "";
}

// Formas de chat a probar, en orden. En WhatsApp muchos celulares de México viven como "521" + 10 dígitos; la guía de
// Green API (FAQ «features of sending and receiving messages from different countries») acepta "52…@c.us" y "521…@c.us".
export function chatsPosibles(intl: string): string[] {
  if (intl.startsWith("52") && intl.length === 12) return [intl, "521" + intl.slice(2)];
  return intl ? [intl] : [];
}

// Idioma por lada: países de habla hispana → español; +1 → inglés, salvo Puerto Rico (787, 939) y República Dominicana
// (809, 829, 849); cualquier otra lada → inglés.
const LADAS_ES = ["502", "503", "504", "505", "506", "507", "591", "593", "595", "598", "240", "34", "51", "52", "53", "54", "56", "57", "58"];
const AREAS_1_ES = ["787", "939", "809", "829", "849"];
export function idiomaDe(intl: string): "es" | "en" {
  if (!intl) return "es";
  if (intl.startsWith("1")) return AREAS_1_ES.includes(intl.slice(1, 4)) ? "es" : "en";
  return LADAS_ES.some((l) => intl.startsWith(l)) ? "es" : "en";
}

const ultimos = (d: string) => d.slice(-Math.min(10, d.length));
const esChatIndividual = (chat: string) => /^\d{6,20}@(c\.us|lid)$/.test(chat);

// ---------- Mensajes ----------
const primerNombre = (n: unknown) => String(n ?? "").trim().split(/\s+/)[0]?.replace(/[*_~`]/g, "") ?? "";

export function mensajeEntrega(idioma: "es" | "en", nombre: unknown, titulo: string, link: string): string {
  const n = primerNombre(nombre);
  const t = String(titulo ?? "").replace(/[*_~`]/g, "").trim() || (idioma === "es" ? "Tu guía" : "Your guide");
  if (idioma === "en") {
    return [
      n ? `Hi, ${n}:` : "Hi:",
      `Your SparkEd interactive study guide is ready: *${t}*`,
      link,
      "You have 7 days of unlimited access to your guide, on 2 devices. Each link is for one family only.",
      'Want to recommend me to your friends and classmates? Reply with the word "share" and I\'ll send you a link you can forward.',
    ].join("\n\n");
  }
  return [
    n ? `Hola, ${n}:` : "Hola:",
    `Tu guía interactiva de SparkEd ya está lista: *${t}*`,
    link,
    "Tienes 7 días de acceso ilimitado a tu guía, en 2 dispositivos. Cada link es de una sola familia.",
    '¿Me quieres recomendar con tus amigos y compañeros? Escribe la palabra "compartir" y te mando un link que puedes reenviar.',
  ].join("\n\n");
}

// Pensado para reenviarse tal cual: no habla de la conversación ni da las gracias.
export function mensajeCompartir(idioma: "es" | "en"): string {
  if (idioma === "en") {
    return [
      "*SparkEd*: interactive study guides made from your notes.",
      "1. You take photos of your notes.\n2. Sparky turns them into a guide.\n3. You play and study.",
      `Learn more here: ${PORTADA}`,
    ].join("\n\n");
  }
  return [
    "*SparkEd*: guías de estudio interactivas hechas con tus apuntes.",
    "1. Tomas fotos de tus apuntes.\n2. Sparky las convierte en una guía.\n3. Juegas y estudias.",
    `Conócelo aquí: ${PORTADA}`,
  ].join("\n\n");
}

const MENSAJE_PRUEBA = "Mensaje de prueba de SparkEd: el WhatsApp de entregas está conectado.";

// ---------- Comando "compartir" ----------
export function normalizar(s: string): string {
  return String(s ?? "").toLowerCase().normalize("NFD").replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, " ").trim();
}
export function distancia(a: string, b: string): number {
  const f = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = f[0]; f[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const arriba = f[j];
      f[j] = Math.min(f[j] + 1, f[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = arriba;
    }
  }
  return f[b.length];
}
// Es comando solo si el mensaje entero queda en 1 o 2 palabras y una está a distancia ≤ 2 de "compartir" (≤ 1 de "share").
export function esComandoCompartir(texto: string): boolean {
  const p = normalizar(texto).split(" ").filter(Boolean);
  if (p.length < 1 || p.length > 2) return false;
  return p.some((w) => (w.length >= 6 && distancia(w, "compartir") <= 2) || (w.length >= 4 && distancia(w, "share") <= 1));
}

// ---------- Bitácora, avisos a Daniel y estado de la compra ----------
const recorte = (s: unknown, n = 300) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const escHtml = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]!));

async function anotar(c: CtxBase, fila: { direccion: string; tipo: string; chat?: string | null; compra_id?: string | null; estado?: string | null; id_mensaje?: string | null; detalle?: string | null }): Promise<{ duplicado: boolean }> {
  try {
    const { error } = await c.supabase.from("wa_mensajes").insert({ ...fila, detalle: fila.detalle ? recorte(fila.detalle) : null });
    if (error) {
      if (error.code === "23505") return { duplicado: true };
      console.warn("wa_mensajes:", error.message);
    }
  } catch (e) { console.warn("wa_mensajes:", (e as Error).message); }
  return { duplicado: false };
}

// Aviso por correo a Daniel, como mucho uno por motivo en la ventana indicada (en horas).
async function avisarUnaVez(c: CtxBase, motivo: string, horas: number, asunto: string, html: string): Promise<boolean> {
  try {
    const desde = new Date(Date.now() - horas * 3600_000).toISOString();
    const { count } = await c.supabase.from("wa_mensajes").select("id", { count: "exact", head: true })
      .eq("direccion", "interno").eq("tipo", "aviso").eq("detalle", motivo).gte("creado_en", desde);
    if (count) return false;
    await anotar(c, { direccion: "interno", tipo: "aviso", estado: "enviado", detalle: motivo });
    await c.avisarDaniel(asunto, html);
    return true;
  } catch (e) { console.warn("Aviso de WhatsApp a Daniel:", (e as Error).message); return false; }
}

const ESTADOS_MALOS: Record<string, string> = {
  notAuthorized: "el teléfono se desconectó (hay que volver a escanear el código QR)",
  blocked: "WhatsApp bloqueó el número",
  suspended: "WhatsApp puso restricciones temporales al número",
  yellowCard: "WhatsApp puso restricciones temporales al número",
  sleepMode: "el teléfono está apagado o sin internet",
};
async function avisarDesconexion(c: CtxBase, estado: string) {
  const que = ESTADOS_MALOS[estado] ?? `la instancia está en el estado "${estado}"`;
  await avisarUnaVez(c, `instancia:${estado}`, 24, "⚠️ SparkEd: el WhatsApp de entregas no está funcionando",
    `<p>Green API avisa que ${escHtml(que)}.</p><p>Mientras tanto, las guías siguen llegando por correo.</p><p>Qué hacer: entra a <a href="https://console.green-api.com">console.green-api.com</a>, abre la instancia y, si pide código QR, escanéalo con el teléfono de SparkEd (WhatsApp → Dispositivos vinculados → Vincular un dispositivo). Después, en el panel de SparkEd, pulsa «Enviar prueba». Los pasos están en docs/WHATSAPP.md.</p>`);
}

async function marcarCompra(c: CtxBase, id: string, cambios: Record<string, unknown>) {
  try { await c.supabase.from("compras").update(cambios).eq("id", id); } catch (e) { console.warn("compras wa:", (e as Error).message); }
}

// ---------- Envío ----------
// Busca la forma del número que existe en WhatsApp. null = ninguna existe. Si checkWhatsapp falla (red, límite del plan),
// se usa la primera forma: WhatsApp redirige los números de México con o sin el "1".
export async function resolverChat(intl: string): Promise<{ chat: string | null; nota?: string }> {
  const formas = chatsPosibles(intl);
  if (!formas.length) return { chat: null, nota: "teléfono no válido" };
  try {
    for (const f of formas) {
      const r = await api("checkWhatsapp", { chatId: f });
      if (r?.existsWhatsapp === true) return { chat: `${f}@c.us` };
    }
    return { chat: null, nota: "el número no tiene WhatsApp" };
  } catch (e) {
    return { chat: `${formas[0]}@c.us`, nota: `sin comprobar: ${(e as Error).message}` };
  }
}

async function estadoInstancia(): Promise<string> {
  try { return String((await api("getStateInstance"))?.stateInstance ?? "desconocido"); } catch { return "sin_respuesta"; }
}

// Manda un texto. Devuelve el idMessage, o lanza error.
async function enviarTexto(chat: string, texto: string): Promise<string> {
  const r = await api("sendMessage", { chatId: chat, message: texto, linkPreview: true });
  if (!r?.idMessage) throw new Error("Green API sendMessage no devolvió idMessage");
  return String(r.idMessage);
}

type Resultado = { ok: boolean; estado: string };

// Manda la guía lista por WhatsApp. Nunca lanza errores: devuelve qué pasó y deja el estado en la compra
// (compras.wa_estado: enviado · en_cola · sin_whatsapp · sin_telefono · sin_motor · fallido).
// Idempotente: solo manda si la compra no tiene wa_estado todavía; { forzar: true } (reenvío desde el panel) manda otra vez.
export async function avisarPorWhatsApp(c: CtxBase, compra: any, entrega: Entrega, opciones: { forzar?: boolean } = {}): Promise<Resultado> {
  try {
    if (!compra?.id) return { ok: false, estado: "sin_compra" };
    const marcarSiVacio = async (estado: string, detalle: string) => {
      try { await c.supabase.from("compras").update({ wa_estado: estado, wa_detalle: detalle }).eq("id", compra.id).is("wa_estado", null); } catch { /* sin efecto */ }
    };
    if (!motorWhatsApp()) { if (!opciones.forzar) await marcarSiVacio("sin_motor", "WhatsApp no estaba conectado"); return { ok: false, estado: "sin_motor" }; }
    const intl = telefonoInternacional(compra.telefono);
    if (!intl) { if (!opciones.forzar) await marcarSiVacio("sin_telefono", "La compra no trae un teléfono válido"); return { ok: false, estado: "sin_telefono" }; }

    // Reclama la compra (una sola ejecución gana): así nunca salen dos entregas automáticas.
    let q = c.supabase.from("compras").update({ wa_estado: "enviando", wa_detalle: null }).eq("id", compra.id);
    if (!opciones.forzar) q = q.is("wa_estado", null);
    const { data: ganada } = await q.select("id");
    if (!ganada?.length) return { ok: false, estado: "ya_enviado" };

    const estado = await estadoInstancia();
    if (estado === "blocked" || estado === "suspended" || estado === "yellowCard") {
      await marcarCompra(c, compra.id, { wa_estado: "fallido", wa_detalle: `Instancia: ${estado}` });
      await anotar(c, { direccion: "salida", tipo: "entrega", compra_id: compra.id, estado: "fallido", detalle: `instancia ${estado}` });
      await avisarDesconexion(c, estado);
      return { ok: false, estado: "fallido" };
    }

    const { chat, nota } = await resolverChat(intl);
    if (!chat) {
      await marcarCompra(c, compra.id, { wa_estado: "sin_whatsapp", wa_detalle: nota ?? "" });
      await anotar(c, { direccion: "salida", tipo: "entrega", compra_id: compra.id, chat: `${intl}`, estado: "sin_whatsapp", detalle: nota });
      return { ok: false, estado: "sin_whatsapp" };
    }

    const texto = mensajeEntrega(idiomaDe(intl), compra.nombre, entrega.titulo || compra.titulo, entrega.link);
    try {
      const id = await enviarTexto(chat, texto);
      // Si el teléfono está desconectado, Green API guarda el mensaje en cola 24 horas y lo manda al reconectarse.
      const final = estado === "authorized" ? "enviado" : "en_cola";
      await marcarCompra(c, compra.id, { wa_estado: final, wa_enviado_en: c.ahora(), wa_detalle: final === "en_cola" ? `En cola: la instancia estaba en "${estado}"` : (nota ?? null) });
      await anotar(c, { direccion: "salida", tipo: "entrega", compra_id: compra.id, chat, estado: final, id_mensaje: id, detalle: nota ?? (final === "en_cola" ? `instancia ${estado}` : null) });
      if (final === "en_cola") await avisarDesconexion(c, estado);
      return { ok: true, estado: final };
    } catch (e) {
      const msg = (e as Error).message;
      await marcarCompra(c, compra.id, { wa_estado: "fallido", wa_detalle: recorte(msg) });
      await anotar(c, { direccion: "salida", tipo: "entrega", compra_id: compra.id, chat, estado: "fallido", detalle: msg });
      await avisarUnaVez(c, "envio_fallido", 1, "⚠️ SparkEd: no se pudo mandar una guía por WhatsApp",
        `<p>No se pudo mandar por WhatsApp la guía <b>${escHtml(entrega.titulo || compra.titulo)}</b> (${escHtml(compra.nombre)} · ${escHtml(compra.telefono)}). La familia sí la recibe por correo.</p><p style="color:#555">${escHtml(recorte(msg))}</p><p>Cuando WhatsApp funcione, puedes reenviarla desde el panel.</p>`);
      return { ok: false, estado: "fallido" };
    }
  } catch (e) {
    console.error("avisarPorWhatsApp:", (e as Error).message);
    return { ok: false, estado: "error" };
  }
}

// ---------- Webhook de Green API ----------
function textoDe(md: any): string | null {
  if (!md) return null;
  if (md.typeMessage === "textMessage") return String(md.textMessageData?.textMessage ?? "");
  if (md.typeMessage === "extendedTextMessage" || md.typeMessage === "quotedMessage") return String(md.extendedTextMessageData?.text ?? "");
  return null;
}

// Compra pagada que corresponde a un chat: por los últimos 10 dígitos del número o, si el chat es un @lid, por una entrega
// anterior a ese mismo chat.
async function compraDelChat(c: CtxBase, chat: string): Promise<any | null> {
  const d = chat.split("@")[0].replace(/\D/g, "");
  if (chat.endsWith("@c.us") && d.length >= 8) {
    const { data } = await c.supabase.from("compras").select("id, telefono, nombre").eq("estado", "pagada").like("telefono", `%${ultimos(d)}`).order("pagada_en", { ascending: false }).limit(1);
    if (data?.[0]) return data[0];
  }
  const { data: m } = await c.supabase.from("wa_mensajes").select("compra_id").eq("direccion", "salida").eq("tipo", "entrega").eq("chat", chat).not("compra_id", "is", null).order("creado_en", { ascending: false }).limit(1);
  if (!m?.[0]?.compra_id) return null;
  const { data: cp } = await c.supabase.from("compras").select("id, telefono, nombre").eq("id", m[0].compra_id).eq("estado", "pagada").maybeSingle();
  return cp ?? null;
}

// Procesa un aviso de Green API ya autenticado. Exportada para las pruebas.
export async function procesarAviso(c: CtxBase, b: any): Promise<string> {
  try {
    const tipo = String(b?.typeWebhook ?? "");
    if (tipo === "stateInstanceChanged") {
      const st = String(b.stateInstance ?? "");
      await anotar(c, { direccion: "interno", tipo: "estado", estado: st });
      if (ESTADOS_MALOS[st]) { await avisarDesconexion(c, st); return "aviso_estado"; }
      return "estado";
    }
    if (tipo === "quotaExceeded") {
      await anotar(c, { direccion: "interno", tipo: "limite", estado: "limite_plan" });
      await avisarUnaVez(c, "limite_plan", 24, "⚠️ SparkEd: el plan de Green API llegó a su límite",
        `<p>Green API avisa que la instancia llegó al límite de su plan (el plan gratis «Developer» solo permite 3 chats al mes). Las guías siguen llegando por correo.</p><p>Para quitar el límite: en <a href="https://console.green-api.com">console.green-api.com</a> cambia la instancia al plan «Business».</p>`);
      return "aviso_limite";
    }
    if (tipo === "outgoingMessageStatus") {
      const st = String(b.status ?? "");
      if (st !== "failed" && st !== "noAccount") return "estado_salida";
      const id = String(b.idMessage ?? "");
      if (!id) return "estado_salida";
      const { data } = await c.supabase.from("wa_mensajes").update({ estado: st === "noAccount" ? "sin_whatsapp" : "fallido", detalle: recorte(b.description ?? st) }).eq("direccion", "salida").eq("id_mensaje", id).select("compra_id, tipo");
      const fila = data?.[0];
      if (fila?.tipo === "entrega" && fila.compra_id) await marcarCompra(c, fila.compra_id, { wa_estado: st === "noAccount" ? "sin_whatsapp" : "fallido", wa_detalle: recorte(b.description ?? st) });
      return "estado_salida";
    }
    if (tipo !== "incomingMessageReceived") return "ignorado";

    const chat = String(b.senderData?.chatId ?? "");
    const idMsg = b.idMessage ? String(b.idMessage) : null;
    const texto = textoDe(b.messageData);
    const comando = esChatIndividual(chat) && texto !== null && esComandoCompartir(texto);
    // Grupos, estados, canales, audios, imágenes y todo lo que no sea el comando: se anota sin texto y no se responde.
    if (!comando) {
      const { duplicado } = await anotar(c, { direccion: "entrada", tipo: "ignorado", chat: esChatIndividual(chat) ? chat : null, id_mensaje: idMsg, estado: "ignorado", detalle: String(b.messageData?.typeMessage ?? "") });
      return duplicado ? "repetido" : "ignorado";
    }
    const compra = await compraDelChat(c, chat);
    const { duplicado } = await anotar(c, { direccion: "entrada", tipo: "compartir", chat, compra_id: compra?.id ?? null, id_mensaje: idMsg, estado: compra ? "recibido" : "sin_compra" });
    if (duplicado) return "repetido";
    if (!compra) return "sin_compra";

    const desde = new Date(Date.now() - 24 * 3600_000).toISOString();
    const { count } = await c.supabase.from("wa_mensajes").select("id", { count: "exact", head: true }).eq("direccion", "salida").eq("tipo", "compartir").eq("chat", chat).gte("creado_en", desde);
    if ((count ?? 0) >= RESPUESTAS_POR_DIA) return "limite";

    const idioma = idiomaDe(telefonoInternacional(compra.telefono) || chat.split("@")[0]);
    try {
      const id = await enviarTexto(chat, mensajeCompartir(idioma));
      await anotar(c, { direccion: "salida", tipo: "compartir", chat, compra_id: compra.id, estado: "enviado", id_mensaje: id });
      return "compartir";
    } catch (e) {
      await anotar(c, { direccion: "salida", tipo: "compartir", chat, compra_id: compra.id, estado: "fallido", detalle: (e as Error).message });
      return "fallido";
    }
  } catch (e) {
    console.error("Webhook de WhatsApp:", (e as Error).message);
    return "error";
  }
}

async function tokenValido(req: Request): Promise<boolean> {
  if (!motorWhatsApp()) return false;
  const h = (req.headers.get("authorization") ?? "").trim();
  const recibido = h.replace(/^Bearer\s+/i, "");
  const esperado = await tokenWebhook();
  if (recibido.length !== esperado.length) return false;
  let dif = 0;
  for (let i = 0; i < esperado.length; i++) dif |= recibido.charCodeAt(i) ^ esperado.charCodeAt(i);
  return dif === 0;
}

// ---------- Rutas ----------
export async function rutasWhatsApp(c: CtxRutas): Promise<Response | null> {
  const [r0, r1, r2] = c.ruta;
  const mia = r0 === "publico" || r0 === "whatsapp" || (r0 === "admin" && r1 === "whatsapp");
  if (!mia) return null;

  // Público: el sitio pregunta si WhatsApp está encendido.
  if (r0 === "publico" && !r1 && c.m === "GET") return c.json({ whatsapp: motorWhatsApp() });

  // Avisos de Green API: siempre 200 rápido; con token malo (o motor apagado) no se hace nada.
  if (r0 === "whatsapp" && r1 === "webhook" && !r2 && c.m === "POST") {
    if (!(await tokenValido(c.req))) return c.json({ ok: true });
    let b: any = null;
    try { b = await c.req.json(); } catch { return c.json({ ok: true }); }
    c.enSegundoPlano(procesarAviso(c, b));
    return c.json({ ok: true });
  }

  if (r0 !== "admin") return null;
  if (!(await c.esAdmin())) return c.error("No autorizado", 401);

  // Estado para el panel.
  if (!r2 && c.m === "GET") {
    const motor = motorWhatsApp();
    let estado_instancia: string | null = null, numero: string | null = null, webhook_configurado = false;
    if (motor) {
      estado_instancia = await estadoInstancia();
      try {
        const s = await api("getSettings");
        numero = String(s?.wid ?? "").split("@")[0] || null;
        if (numero) numero = "+" + numero;
        const tok = await tokenWebhook();
        webhook_configurado = s?.webhookUrl === urlWebhook() && String(s?.webhookUrlToken ?? "").replace(/^Bearer\s+/i, "") === tok && s?.incomingWebhook === "yes";
      } catch { /* se queda en null / false */ }
    }
    const desde = new Date(Date.now() - 7 * 86400_000).toISOString();
    const contar = async (tipo: string, estados: string[]) => {
      const { count } = await c.supabase.from("wa_mensajes").select("id", { count: "exact", head: true }).eq("direccion", "salida").eq("tipo", tipo).in("estado", estados).gte("creado_en", desde);
      return count ?? 0;
    };
    const [enviados_7d, fallidos_7d, compartir_7d] = await Promise.all([contar("entrega", ["enviado", "en_cola"]), contar("entrega", ["fallido", "sin_whatsapp"]), contar("compartir", ["enviado"])]);
    const { data: ue } = await c.supabase.from("wa_mensajes").select("creado_en, tipo, detalle").eq("direccion", "salida").eq("estado", "fallido").order("creado_en", { ascending: false }).limit(1);
    const ultimo_error = ue?.[0] ? { fecha: ue[0].creado_en, tipo: ue[0].tipo, detalle: ue[0].detalle } : null;
    return c.json({ motor, estado_instancia, numero, enviados_7d, fallidos_7d, compartir_7d, ultimo_error, webhook_configurado });
  }

  if (c.m !== "POST") return c.error("Ruta no encontrada", 404);
  if (!motorWhatsApp()) return c.error("WhatsApp no está conectado: faltan las llaves de Green API en los secretos de Supabase (GREEN_API_ID_INSTANCE y GREEN_API_TOKEN_INSTANCE).", 400);

  // Deja la instancia lista: webhook con su token, avisos entrantes y de estado encendidos, lo demás apagado.
  if (r2 === "configurar") {
    const ajustes = {
      webhookUrl: urlWebhook(),
      webhookUrlToken: await tokenWebhook(),
      incomingWebhook: "yes",
      stateWebhook: "yes",
      outgoingWebhook: "no",
      outgoingMessageWebhook: "no",
      outgoingAPIMessageWebhook: "no",
      incomingCallWebhook: "no",
      pollMessageWebhook: "no",
      editedMessageWebhook: "no",
      deletedMessageWebhook: "no",
      incomingMessageStatusWebhook: "no",
      markIncomingMessagesReaded: "no",
      markIncomingMessagesReadedOnReply: "no",
      keepOnlineStatus: "no",
      linkPreview: "yes",
      delaySendMessagesMilliseconds: DEMORA_ENVIO_MS,
    };
    try {
      const r = await api("setSettings", ajustes);
      const estado = await estadoInstancia();
      return c.json({ ok: r?.saveSettings === true, estado_instancia: estado, nota: "Green API reinicia la instancia y aplica los cambios en unos 5 minutos." });
    } catch (e) {
      return c.error(`Green API no aceptó la configuración: ${recorte((e as Error).message, 200)}`, 502);
    }
  }

  // Mensaje de prueba a un teléfono.
  if (r2 === "prueba") {
    const body = await c.leerJson(c.req);
    const raw = String(body.telefono ?? "").trim();
    const intl = telefonoInternacional(raw.startsWith("+") || raw.replace(/\D/g, "").length === 10 ? raw : "+" + raw);
    if (!intl) return c.error("Escribe un teléfono válido, con lada (por ejemplo +52 y 10 dígitos).");
    const { chat, nota } = await resolverChat(intl);
    if (!chat) return c.error(`No se pudo mandar: ${nota ?? "el número no tiene WhatsApp"}.`);
    try {
      const id = await enviarTexto(chat, MENSAJE_PRUEBA);
      await anotar(c, { direccion: "salida", tipo: "prueba", chat, estado: "enviado", id_mensaje: id, detalle: nota });
      return c.json({ ok: true, chat, id_mensaje: id, estado_instancia: await estadoInstancia(), nota: nota ?? null });
    } catch (e) {
      await anotar(c, { direccion: "salida", tipo: "prueba", chat, estado: "fallido", detalle: (e as Error).message });
      return c.error(`No se pudo mandar: ${recorte((e as Error).message, 200)}`, 502);
    }
  }

  // Reenvía la entrega de una compra pagada con guía lista.
  if (r2 === "reenviar") {
    const body = await c.leerJson(c.req);
    const id = String(body.compra_id ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(id)) return c.error("Falta el folio de la compra (compra_id).");
    const { data: compra } = await c.supabase.from("compras").select("*").eq("id", id).maybeSingle();
    if (!compra) return c.error("No existe esa compra.", 404);
    if (compra.estado !== "pagada") return c.error("La compra todavía no está pagada.");
    if (!compra.acceso_id || !compra.guia_id) return c.error("La compra todavía no tiene link de acceso.");
    const { data: g } = await c.supabase.from("guias").select("titulo, etapa:reporte->>etapa").eq("id", compra.guia_id).maybeSingle();
    if (g?.etapa !== "completa") return c.error("La guía todavía no está completa.");
    const { data: a } = await c.supabase.from("accesos").select("token, expira_en").eq("id", compra.acceso_id).maybeSingle();
    if (!a?.token) return c.error("No se encontró el acceso de la compra.", 404);
    const r = await avisarPorWhatsApp(c, compra, { titulo: g?.titulo ?? compra.titulo ?? "", link: `${await c.sitio()}guia.html#${a.token}`, expira_en: a.expira_en }, { forzar: true });
    return c.json(r);
  }

  return c.error("Ruta no encontrada", 404);
}
