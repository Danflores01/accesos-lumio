// Función "sparked": la API de la fase 2 (biblioteca de guías, guías personalizadas, pago, acceso al
// reproductor y panel SparkEd). Vive junto a "ir" y "admin" sin tocarlas: los links de Lumio siguen igual.
//
// Rutas públicas (sin llave):
//   GET  /colegios · POST /buscar · POST /solicitud · GET /vista-previa/:guia_id
//   POST /borrador · GET /borrador/:clave · POST /borrador/:clave/generar
//   POST /pago/crear (acepta un código de descuento) · GET /pago/estado/:compra_id · POST /pago/reintentar/:compra_id
//   POST /pago/mercadopago (avisos de Mercado Pago) · POST /pago/webhook (Stripe)
//   POST /acceso/:token · GET /acceso/:token/estado · POST /progreso/:token · POST /reporte · GET /datos-curiosos
// Rutas internas: POST /trabajo/:id/paso (solo la propia función, cabecera x-interno)
// Rutas de administración (cabecera x-admin-key, la misma llave del panel de accesos): /admin/...
//
// Motores: la IA (ANTHROPIC_API_KEY), el cobro con Mercado Pago (MP_ACCESS_TOKEN + MP_WEBHOOK_SECRET; tarjeta, OXXO
// y SPEI), Stripe (STRIPE_SECRET_KEY, dormido: solo se usa si no hay Mercado Pago) y el correo (RESEND_API_KEY) se
// encienden solos cuando Daniel pone cada secreto en Supabase. Sin cobro en línea, el pago es manual desde el panel.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { ejecutarPaso, recortarVistaPrevia, aplanar, medirPlan, verificarCartucho, type Trabajo } from "./pipeline.ts";
import type { CtxBase, CtxRutas } from "./tipos.ts";
import { rutasExtras } from "./extras.ts";
import { rutasWhatsApp, avisarPorWhatsApp, motorWhatsApp } from "./whatsapp.ts";
import { imagenEntrega, imagenCompartir } from "./imagen-wa.ts";
import { matrizQr } from "./qr.ts";

const VERSION = "2026-11-09.7";
const SUPABASE_URL = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/$/, "");
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const SELF = `${SUPABASE_URL}/functions/v1/sparked`;
const BUCKET = "materiales";
const PAGINAS_MAX = 25; // 13 pasos de lectura de 2 páginas cada uno (cada paso, una llamada de menos de ~110 s)
const DIAS_ACCESO = 7;
const APARATOS = 2;

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type, x-admin-key, x-interno",
  "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const error = (mensaje: string, status = 400) => json({ error: mensaje }, status);

// ---------- Utilidades ----------
const ALFABETO = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function nuevoToken(n = 14): string { const b = crypto.getRandomValues(new Uint8Array(n)); let s = ""; for (const x of b) s += ALFABETO[x % ALFABETO.length]; return s; }
async function sha256hex(s: string): Promise<string> { const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)); return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join(""); }
const esUuid = (u: unknown): u is string => typeof u === "string" && /^[0-9a-f-]{36}$/i.test(u);
const esToken = (t: unknown): t is string => typeof t === "string" && /^[A-Za-z0-9]{8,64}$/.test(t);
const esSecreto = (s: unknown): s is string => typeof s === "string" && /^[A-Za-z0-9]{16,64}$/.test(s);
const esClave = (c: unknown): c is string => typeof c === "string" && /^[A-Za-z0-9]{16,40}$/.test(c);
const esCorreo = (c: unknown): c is string => typeof c === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c) && c.length <= 120;
// Teléfono en formato internacional: "+" + lada + número ("+52" + 10 dígitos para México). Lo de antes (10 dígitos, o
// 52/521 + 10) se normaliza a +52. Devuelve "" si no es válido (de 8 a 15 dígitos en total).
function limpiarTel(t: unknown): string {
  const s = String(t ?? "").trim(); const d = s.replace(/\D/g, "");
  if (s.startsWith("+") && !d.startsWith("52")) return d.length >= 8 && d.length <= 15 ? "+" + d : "";
  let n = d; if (s.startsWith("+") || n.length === 12 || n.length === 13) { if (n.startsWith("52")) n = n.slice(2); if (n.length === 11 && n.startsWith("1")) n = n.slice(1); }
  return n.length === 10 ? "+52" + n : "";
}
// Para la fase 1 (accesos a clases) el teléfono de México se guarda como antes: 10 dígitos sin lada.
function telLocal(t: unknown): string | null { const s = String(t ?? "").trim(); return !s ? null : s.startsWith("+52") ? s.slice(3) : s; }
const texto = (v: unknown, max = 120) => String(v ?? "").replace(/[\x00-\x1f\x7f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const ipDe = (req: Request) => (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || (req.headers.get("cf-connecting-ip") ?? "") || null;
const ahora = () => new Date().toISOString();
const enDias = (d: number) => new Date(Date.now() + d * 86400 * 1000).toISOString();
async function leerJson(req: Request): Promise<Record<string, any>> { try { return (await req.json()) ?? {}; } catch { return {}; } }
// Idioma forzado de la guía (solo pruebas y guías del administrador): "es", "en" o "fr"; cualquier otro valor se ignora.
const idiomaValido = (x: unknown): string | null => { const v = String(x ?? "").trim().toLowerCase(); return ["es", "en", "fr"].includes(v) ? v : null; };
function enSegundoPlano(p: Promise<unknown>) {
  const ER = (globalThis as any).EdgeRuntime;
  const seguro = p.catch((e) => console.error("segundo plano:", (e as Error).message));
  if (ER?.waitUntil) ER.waitUntil(seguro);
}

// ---------- Configuración (tabla config, llaves sparked_*) ----------
const CONFIG_DEF: Record<string, string> = {
  sparked_sitio: "https://sparkeducation-mx.com/sparked/",
  sparked_precio: "100",
  sparked_tope_diario: "80",       // compras por día en todo el sitio
  sparked_tope_familia: "6",       // compras por día por teléfono o correo
  sparked_tipo_cambio: "18.5",     // pesos por dólar para la ficha de costos
  sparked_whatsapp: "",            // WhatsApp de SparkEd (10 dígitos) para confirmar pagos manuales
  sparked_correo_aviso: "",        // correo de Daniel para avisos de ventas
  sparked_correo_remitente: "SparkEd <onboarding@resend.dev>",
  sparked_correo_respuestas: "",   // buzón real al que llegan las respuestas de las familias (reply-to); vacío = sin reply-to
  // Mensajes de WhatsApp que se mandan solos (whatsapp.ts). Vacío = el texto original. Se editan en Ajustes → WhatsApp.
  sparked_wa_entrega_es: "", sparked_wa_entrega_en: "", sparked_wa_compartir_es: "", sparked_wa_compartir_en: "",
  sparked_wa_imagenes: "si", // "no" = los mensajes de WhatsApp salen solo con texto (sin la imagen de Sparky)
  // Ya no se usa (9 nov 2026): la familia recibe su link solo cuando la guía está completa y verificada.
  sparked_jugar_durante_generacion: "no",
  // Modelo (haiku | sonnet | opus) y esfuerzo (low | medium | high) de cada paso de la IA. El defecto es el de siempre.
  sparked_modelo_extraer: "haiku", sparked_esfuerzo_extraer: "medium",
  sparked_modelo_plan: "haiku", sparked_esfuerzo_plan: "low",
  sparked_modelo_escribir: "haiku", sparked_esfuerzo_escribir: "low",
  sparked_modelo_reparar: "haiku", sparked_esfuerzo_reparar: "low",
  sparked_modelo_verificar: "haiku", sparked_esfuerzo_verificar: "medium",
};
let configCache: { en: number; valores: Record<string, string> } | null = null;
async function config(): Promise<Record<string, string>> {
  if (configCache && Date.now() - configCache.en < 60_000) return configCache.valores;
  const { data } = await supabase.from("config").select("clave, valor").like("clave", "sparked_%");
  const valores = { ...CONFIG_DEF };
  for (const r of data ?? []) if (r.valor !== null && r.valor !== undefined && String(r.valor) !== "") valores[r.clave] = String(r.valor);
  configCache = { en: Date.now(), valores };
  return valores;
}
const sitio = async () => (await config()).sparked_sitio.replace(/\/?$/, "/");
const linkDe = (base: string, token: string) => `${base}guia.html#${token}`;

// ---------- Llave de administrador (la misma del panel de accesos) ----------
const CLAVES_CONFIG = ["admin_key_sha256", "recovery_key_sha256"];
let hashes: string[] | null = null;
async function cargarHashes(): Promise<string[]> { const { data } = await supabase.from("config").select("valor").in("clave", CLAVES_CONFIG); return (data ?? []).map((r) => r.valor); }
async function autorizado(req: Request): Promise<boolean> {
  const clave = req.headers.get("x-admin-key") ?? ""; if (!clave) return false;
  const h = await sha256hex(clave);
  if (!hashes) hashes = await cargarHashes();
  if (hashes.includes(h)) return true;
  hashes = await cargarHashes();
  return hashes.includes(h);
}
let internoCache = "";
async function claveInterna(): Promise<string> { if (!internoCache) internoCache = await sha256hex(SERVICE_KEY + ":sparked-interno"); return internoCache; }

// ---------- Trabajos: un paso por ejecución, la función se llama a sí misma para el siguiente ----------
function disparar(trabajoId: string, retrasoMs = 0) {
  enSegundoPlano((async () => {
    if (retrasoMs) await new Promise((r) => setTimeout(r, retrasoMs));
    const r = await fetch(`${SELF}/trabajo/${trabajoId}/paso`, { method: "POST", headers: { "content-type": "application/json", "x-interno": await claveInterna() }, body: "{}" });
    if (!r.ok) console.warn("No se pudo disparar el paso", trabajoId, r.status);
  })());
}
async function cargarTrabajo(id: string): Promise<(Trabajo & { actualizado_en: string; error: string | null }) | null> {
  const { data } = await supabase.from("trabajos").select("*").eq("id", id).maybeSingle();
  return (data as any) ?? null;
}
async function fuenteDe(t: Trabajo) {
  const { data: b } = await supabase.from("borradores").select("archivos, grado, materia, colegio_texto").eq("id", t.borrador_id).maybeSingle();
  if (!b) throw new Error("El borrador de este trabajo ya no existe");
  // Modelo y esfuerzo por paso: los de la tabla config y, encima, los del trabajo (pruebas).
  const cfg = await config();
  const opciones: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(cfg)) if (/^sparked_(modelo|esfuerzo)_/.test(k)) opciones[k.slice(8)] = v;
  Object.assign(opciones, (t.datos as any)?.opciones ?? {});
  return { archivos: (b.archivos ?? []) as { ruta: string; nombre: string }[], grado: b.grado ?? "", materia: b.materia ?? "", colegio: b.colegio_texto ?? "", idioma_alumno: "es", opciones };
}
const ERRORES_DEFINITIVOS = /no parecen material|No se pudo leer ninguna foto|Falta configurar|ya no existe|no_es_material/i;

async function correrPaso(id: string) {
  const t = await cargarTrabajo(id);
  if (!t || t.estado === "listo" || t.estado === "error") return;
  // Si otra ejecución lo está corriendo (menos de 140 s), no se duplica.
  if (t.estado === "corriendo" && Date.now() - new Date(t.actualizado_en).getTime() < 140_000) return;
  await supabase.from("trabajos").update({ estado: "corriendo", actualizado_en: ahora() }).eq("id", id);
  t.estado = "corriendo";
  try {
    const fuente = await fuenteDe(t);
    const sig = await ejecutarPaso(supabase as any, t, fuente);
    if (sig === null) await alFinalizar(t);
    // Cada paso que sale bien vuelve a tener sus 3 intentos (antes se acumulaban en todo el trabajo).
    else { await supabase.from("trabajos").update({ estado: "pendiente", intentos: 0, actualizado_en: ahora() }).eq("id", id); disparar(id); }
  } catch (e) {
    const msg = (e as Error).message ?? String(e);
    console.error("Paso falló", id, t.paso, msg);
    const intentos = Number(t.intentos ?? 0) + 1;
    const definitivo = intentos >= 3 || ERRORES_DEFINITIVOS.test(msg);
    await supabase.from("trabajos").update({ estado: definitivo ? "error" : "pendiente", error: msg.slice(0, 500), intentos, actualizado_en: ahora() }).eq("id", id);
    if (definitivo) {
      // Guía ya pagada (trabajo "resto"): a la familia no se le pide nada; Daniel recibe el aviso para reintentar.
      const amable = t.alcance === "resto" ? MSG_REVISANDO : /no parecen material/i.test(msg) ? "Las fotos no parecen material de estudio. Sube apuntes, páginas del libro o temarios." : /No se pudo leer ninguna foto/i.test(msg) ? msg : /Falta configurar/i.test(msg) ? "El generador todavía no está encendido. Avísanos por WhatsApp y lo activamos." : "No pudimos terminar tu guía. Intenta de nuevo con fotos más claras.";
      if (t.borrador_id) await supabase.from("borradores").update({ estado: "fallido" }).eq("id", t.borrador_id).neq("estado", "pagado");
      await supabase.from("trabajos").update({ progreso: { pct: 0, mensaje: amable, paso: t.paso } }).eq("id", id);
      if (t.alcance === "resto") await avisarRestoFallido(id);
    } else disparar(id, 6000);
  }
}

// Reanuda un trabajo que se quedó a medias (la ejecución anterior se cortó). Lo llaman las consultas de estado.
async function reanudarSiAtorado(t: { id: string; estado: string; actualizado_en: string; intentos: number } | null) {
  if (!t || !["pendiente", "corriendo"].includes(t.estado)) return;
  const quieto = Date.now() - new Date(t.actualizado_en).getTime();
  if (quieto < 150_000) return;
  if (Number(t.intentos ?? 0) >= 6) {
    // Paso atómico: si varias consultas llegan juntas, solo una lo marca (y solo una vez se avisa a Daniel).
    const { data: marcado } = await supabase.from("trabajos").update({ estado: "error", error: "Se interrumpió demasiadas veces", actualizado_en: ahora() }).eq("id", t.id).in("estado", ["pendiente", "corriendo"]).select("alcance");
    if (marcado?.[0]?.alcance === "resto") { await supabase.from("trabajos").update({ progreso: { pct: 0, mensaje: MSG_REVISANDO } }).eq("id", t.id); await avisarRestoFallido(t.id); }
    return;
  }
  await supabase.from("trabajos").update({ estado: "pendiente", intentos: Number(t.intentos ?? 0) + 1, actualizado_en: ahora() }).eq("id", t.id);
  disparar(t.id);
}

// Al terminar la cadena: guarda el cartucho (vista previa o completo) en la guía.
async function alFinalizar(t: Trabajo) {
  const D = t.datos as any;
  const cartucho = D.cartucho;
  if (!cartucho?.plan) throw new Error("El trabajo terminó sin cartucho");
  cartucho.completo = t.alcance !== "vista_previa";
  const cfg = await config();
  const costoMxn = Number(t.costo_usd ?? 0) * (Number(cfg.sparked_tipo_cambio) || 18.5);
  const plan = cartucho.plan;
  const { data: borrador } = await supabase.from("borradores").select("*").eq("id", t.borrador_id).maybeSingle();
  const base = {
    titulo: ((D.prueba?.etiqueta ? `[Prueba ${D.prueba.etiqueta}] ` : "") + (texto(plan.identidad?.titulo, 120) || `${borrador?.materia ?? "Guía"} · ${borrador?.grado ?? ""}`.trim())).slice(0, 120),
    idioma: plan.idioma_guia ?? "es", perfil_edad: plan.perfil_edad ?? null, paleta: plan.identidad?.paleta ?? null,
    cartucho, vista_previa: recortarVistaPrevia(cartucho),
  };
  if (t.alcance === "vista_previa") {
    const { data: g, error: e } = await supabase.from("guias").insert({
      ...base, estado: "borrador", origen: "personalizada", colegio_id: borrador?.colegio_id ?? null, grado: borrador?.grado ?? null, materia: borrador?.materia ?? null,
      borrador_id: t.borrador_id, costo_mxn: costoMxn.toFixed(2),
      reporte: { etapa: "vista_previa", costo_usd: Number(t.costo_usd ?? 0), tokens: { entrada: t.tokens_entrada, salida: t.tokens_salida }, bloques_plan: plan.bloques_plan?.length ?? 0, paginas_no_leidas: D.no_leidas ?? [], metricas: D.metricas ?? [] },
    }).select("id").single();
    if (e) throw e;
    await supabase.from("borradores").update({ estado: "vista_previa", guia_id: g.id }).eq("id", t.borrador_id);
    await supabase.from("trabajos").update({ guia_id: g.id }).eq("id", t.id);
    return;
  }
  const guiaId = t.guia_id ?? borrador?.guia_id;
  if (!guiaId) throw new Error("No hay guía a la que pegar el cartucho");
  // Verificación final (sin IA) antes de entregar: si no pasa, la guía se guarda como NO completa (nadie recibe el link),
  // el trabajo queda en error y se avisa a Daniel y a la familia ("estamos revisando tu guía").
  const problemas = verificarCartucho(cartucho);
  if (problemas.length) { cartucho.completo = false; base.vista_previa = recortarVistaPrevia(cartucho); }
  const { data: g } = await supabase.from("guias").select("origen, reporte, costo_mxn, estado").eq("id", guiaId).maybeSingle();
  const costoPrevio = Number(g?.reporte?.costo_usd ?? 0);
  const cambios: Record<string, unknown> = {
    ...base, costo_mxn: (Number(g?.costo_mxn ?? 0) + costoMxn).toFixed(2),
    reporte: { etapa: "completa", costo_usd: costoPrevio + Number(t.costo_usd ?? 0), tokens: { entrada: t.tokens_entrada, salida: t.tokens_salida }, verificacion: D.verificacion ?? [], huecos: D.huecos ?? [], fotos: D.fotos ?? [], tipo_material: D.tipo_material ?? [], imagenes: Object.keys(D.imagenes ?? {}).length, terminado_en: ahora(), metricas: D.metricas ?? [] },
  };
  if (g?.origen === "personalizada" && !problemas.length) cambios.estado = "publicada";
  if (problemas.length) (cambios.reporte as any).verificacion_final = problemas;
  const { error: e2 } = await supabase.from("guias").update(cambios).eq("id", guiaId);
  if (e2) throw e2;
  if (problemas.length) {
    const msg = ("Verificación final: " + problemas.join(" · ")).slice(0, 500);
    console.error("La guía no pasó la verificación final:", guiaId, msg);
    await supabase.from("trabajos").update({ estado: "error", error: msg, progreso: { pct: 0, mensaje: MSG_REVISANDO, paso: t.paso }, actualizado_en: ahora() }).eq("id", t.id);
    if (t.alcance === "resto") await avisarRestoFallido(t.id);
    else await avisarRevisionDeGuia(guiaId, msg);
    return;
  }
  if (borrador) await supabase.from("borradores").update({ estado: borrador.estado === "pagado" ? "listo" : borrador.estado === "generando" ? "listo" : borrador.estado }).eq("id", borrador.id);
  // La guía quedó completa y verificada: cada compra pagada que la esperaba recibe ahora su entrega (link, correo y
  // WhatsApp, una sola vez). Si algo de la entrega falla, el trabajo no se marca como fallido: /pago/estado la reintenta.
  try { await entregarPendientes(guiaId); } catch (e) { console.error("No se pudo entregar la guía completa:", (e as Error).message); }
}

// ---------- Archivos en el bucket privado ----------
async function urlsDeSubida(rutas: { ruta: string; nombre: string }[]) {
  const subidas: { nombre: string; url: string }[] = [];
  for (const a of rutas) {
    const { data, error: e } = await supabase.storage.from(BUCKET).createSignedUploadUrl(a.ruta, { upsert: true } as any);
    if (e || !data) throw new Error("No se pudo preparar la subida: " + (e?.message ?? ""));
    subidas.push({ nombre: a.nombre, url: data.signedUrl });
  }
  return subidas;
}
async function archivosSubidos(carpeta: string): Promise<Set<string>> {
  const { data } = await supabase.storage.from(BUCKET).list(carpeta, { limit: 100 });
  return new Set((data ?? []).map((f) => `${carpeta}/${f.name}`));
}
async function borrarCarpeta(carpeta: string) {
  const { data } = await supabase.storage.from(BUCKET).list(carpeta, { limit: 100 });
  const rutas = (data ?? []).map((f) => `${carpeta}/${f.name}`);
  if (rutas.length) await supabase.storage.from(BUCKET).remove(rutas);
}
function validarPaginas(paginas: unknown): { nombre: string; tipo: string; tamano: number }[] | string {
  if (!Array.isArray(paginas) || !paginas.length) return "Sube al menos una página.";
  if (paginas.length > PAGINAS_MAX) return `Puedes subir hasta ${PAGINAS_MAX} páginas por guía. Elige las más importantes para tu examen.`;
  const out = [];
  for (const p of paginas) {
    const tamano = Number((p as any)?.tamano ?? 0);
    if (tamano > 8 * 1024 * 1024) return "Cada página debe pesar menos de 8 MB.";
    out.push({ nombre: texto((p as any)?.nombre, 80) || `pagina-${out.length + 1}.jpg`, tipo: "image/jpeg", tamano });
  }
  return out;
}

// ---------- Limpieza (sin pg_cron: se corre de vez en cuando con las peticiones y desde el panel) ----------
async function limpieza(): Promise<{ borradores: number; guias: number }> {
  let nb = 0, ng = 0;
  const { data: viejos } = await supabase.from("borradores").select("id, guia_id, estado, archivos").lt("expira_en", ahora()).not("estado", "in", "(pagado,listo)").limit(20);
  for (const b of viejos ?? []) {
    await borrarCarpeta(`borradores/${b.id}`);
    if (b.guia_id) {
      const { count } = await supabase.from("compras").select("id", { count: "exact", head: true }).eq("guia_id", b.guia_id).eq("estado", "pagada");
      if (!count) await supabase.from("guias").delete().eq("id", b.guia_id);
    }
    await supabase.from("borradores").delete().eq("id", b.id);
    nb++;
  }
  // Guías personalizadas vencidas: se borra el contenido, queda la ficha en compras.
  const { data: vencidas } = await supabase.from("guias").select("id, borrador_id").lt("borrar_en", ahora()).not("cartucho", "is", null).limit(20);
  for (const g of vencidas ?? []) {
    await supabase.from("guias").update({ cartucho: null, vista_previa: null, estado: "archivada", archivada_en: ahora() }).eq("id", g.id);
    if (g.borrador_id) { await borrarCarpeta(`borradores/${g.borrador_id}`); await supabase.from("borradores").delete().eq("id", g.borrador_id); }
    ng++;
  }
  return { borradores: nb, guias: ng };
}

// ---------- Pago y entrega ----------
async function crearSesionStripe(compra: any, titulo: string, precio: number): Promise<{ id: string; url: string }> {
  const key = Deno.env.get("STRIPE_SECRET_KEY")!;
  const base = await sitio();
  const p = new URLSearchParams({
    mode: "payment", "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "mxn", "line_items[0][price_data][unit_amount]": String(Math.round(precio * 100)),
    "line_items[0][price_data][product_data][name]": `Guía interactiva SparkEd: ${titulo}`.slice(0, 120),
    success_url: `${base}listo.html?compra=${compra.id}`, cancel_url: `${base}index.html?cancelado=1`,
    "metadata[compra_id]": compra.id, "payment_intent_data[metadata][compra_id]": compra.id, customer_email: compra.correo,
  });
  const r = await fetch("https://api.stripe.com/v1/checkout/sessions", { method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/x-www-form-urlencoded" }, body: p });
  const d = await r.json();
  if (!r.ok) throw new Error("Stripe: " + (d.error?.message ?? r.status));
  return { id: d.id, url: d.url };
}
async function firmaStripeValida(cuerpo: string, cabecera: string | null, secreto: string): Promise<boolean> {
  if (!cabecera) return false;
  const partes = Object.fromEntries(cabecera.split(",").map((x) => x.split("=") as [string, string]));
  const t = partes.t; const firmas = cabecera.split(",").filter((x) => x.startsWith("v1=")).map((x) => x.slice(3));
  if (!t || !firmas.length || Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(secreto), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const f = [...new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(`${t}.${cuerpo}`)))].map((x) => x.toString(16).padStart(2, "0")).join("");
  return firmas.includes(f);
}

// ---------- Mercado Pago (Checkout Pro, México): tarjeta, OXXO y SPEI ----------
// Se enciende solo cuando existe el secreto MP_ACCESS_TOKEN; si no existe, todo sigue como antes (Stripe o manual).
// Los avisos de pago llegan a POST /pago/mercadopago y se validan con MP_WEBHOOK_SECRET. Aun con la firma válida, el
// estado del pago siempre se le pregunta a la API de Mercado Pago con nuestra llave: nunca se cree lo que diga el aviso.
const MP_API = "https://api.mercadopago.com";
const MP_DIAS_EFECTIVO = 3; // días para pagar en OXXO o por SPEI (Mercado Pago recomienda al menos 3)
const mpToken = () => Deno.env.get("MP_ACCESS_TOKEN") ?? "";
const mpPrueba = () => mpToken().startsWith("TEST-");
// Fecha en hora del centro de México (UTC-6, sin horario de verano desde 2022), con el formato que pide Mercado Pago.
const fechaMx = (ms: number) => new Date(ms - 6 * 3600 * 1000).toISOString().replace("Z", "-06:00");

async function mp(ruta: string, op: { method?: string; body?: unknown } = {}): Promise<{ ok: boolean; status: number; datos: any }> {
  const r = await fetch(`${MP_API}${ruta}`, { method: op.method ?? "GET", headers: { authorization: `Bearer ${mpToken()}`, "content-type": "application/json" }, body: op.body === undefined ? undefined : JSON.stringify(op.body), signal: AbortSignal.timeout(15_000) });
  return { ok: r.ok, status: r.status, datos: await r.json().catch(() => ({})) };
}

// Crea el link de pago (preferencia) de una compra. Al pagar con tarjeta regresa solo a listo.html; si queda pendiente
// (OXXO o SPEI) o falla, regresa a listo.html con ?pago=pendiente o ?pago=fallido.
async function crearPreferenciaMP(compra: any, titulo: string, precio: number): Promise<{ id: string; url: string }> {
  const base = await sitio();
  const volver = (estado = "") => `${base}listo.html?compra=${compra.id}${estado ? `&pago=${estado}` : ""}`;
  const cuerpo: Record<string, any> = {
    items: [{ id: String(compra.guia_id ?? compra.id), title: `Guía SparkEd: ${titulo}`.slice(0, 120), description: `${DIAS_ACCESO} días de acceso ilimitado a tu guía, en ${APARATOS} dispositivos`, category_id: "learnings", quantity: 1, currency_id: "MXN", unit_price: precio }],
    external_reference: compra.id,
    back_urls: { success: volver(), pending: volver("pendiente"), failure: volver("fallido") },
    auto_return: "approved",
    notification_url: `${SELF}/pago/mercadopago`,
    statement_descriptor: "SPARKED",
    date_of_expiration: fechaMx(Date.now() + MP_DIAS_EFECTIVO * 86400 * 1000),
    // Solo tarjeta, OXXO y SPEI: fuera pagos en cajero, PayCash y crédito de Mercado Pago (el saldo de una cuenta
    // de Mercado Pago no se puede quitar). Sin meses: una sola exhibición.
    payment_methods: { excluded_payment_types: [{ id: "atm" }, { id: "digital_currency" }], excluded_payment_methods: [{ id: "paycash" }], installments: 1 },
  };
  // Con llaves de prueba no se manda el correo real: Mercado Pago no deja mezclar cuentas de prueba con cuentas reales.
  if (!mpPrueba() && esCorreo(compra.correo)) cuerpo.payer = { email: compra.correo };
  let r = await mp("/checkout/preferences", { method: "POST", body: cuerpo });
  if (r.status === 400) {
    // Si Mercado Pago no acepta el filtro de métodos o la categoría, se intenta sin ellos: mejor cobrar que fallar.
    console.warn("Mercado Pago rechazó la preferencia; se reintenta sin filtros:", JSON.stringify(r.datos).slice(0, 300));
    delete cuerpo.payment_methods; delete cuerpo.items[0].category_id;
    r = await mp("/checkout/preferences", { method: "POST", body: cuerpo });
  }
  const url = (mpPrueba() && r.datos?.sandbox_init_point) || r.datos?.init_point;
  if (!r.ok || !r.datos?.id || !url) throw new Error("Mercado Pago: " + (r.datos?.message ?? r.status));
  return { id: String(r.datos.id), url };
}

// Firma de los avisos (documentación de Mercado Pago, "Validar origen de la notificación"): la cabecera x-signature trae
// "ts=<ts>,v1=<firma>" y la firma es el HMAC-SHA256 en hexadecimal, con la clave secreta del webhook, del manifiesto
// "id:<data.id de la URL>;request-id:<cabecera x-request-id>;ts:<ts>;". Si falta data.id o x-request-id, esa parte se
// quita del manifiesto; un data.id con letras va en minúsculas.
async function firmaMPValida(secreto: string, xSignature: string | null, xRequestId: string | null, dataId: string | null): Promise<boolean> {
  if (!secreto || !xSignature) return false;
  let ts = "", v1 = "";
  for (const parte of xSignature.split(",")) {
    const i = parte.indexOf("="); if (i < 0) continue;
    const k = parte.slice(0, i).trim(), v = parte.slice(i + 1).trim();
    if (k === "ts") ts = v; else if (k === "v1") v1 = v.toLowerCase();
  }
  if (!/^\d+$/.test(ts) || !/^[0-9a-f]{64}$/.test(v1)) return false;
  const manifiesto = (dataId ? `id:${dataId.toLowerCase()};` : "") + (xRequestId ? `request-id:${xRequestId};` : "") + `ts:${ts};`;
  const llave = await crypto.subtle.importKey("raw", new TextEncoder().encode(secreto), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const firma = [...new Uint8Array(await crypto.subtle.sign("HMAC", llave, new TextEncoder().encode(manifiesto)))].map((x) => x.toString(16).padStart(2, "0")).join("");
  let dif = 0; for (let i = 0; i < 64; i++) dif |= firma.charCodeAt(i) ^ v1.charCodeAt(i);
  return dif === 0;
}

// Cómo se pagó, en palabras del sitio: tarjeta, oxxo, spei, mercadopago (saldo de la cuenta) u otro.
function metodoMP(p: any): string {
  const tipo = String(p?.payment_type_id ?? ""), metodo = String(p?.payment_method_id ?? "");
  if (["credit_card", "debit_card", "prepaid_card"].includes(tipo)) return "tarjeta";
  if (metodo === "oxxo") return "oxxo";
  if (tipo === "bank_transfer" || metodo === "clabe" || metodo === "spei") return "spei";
  if (tipo === "account_money") return "mercadopago";
  if (tipo === "ticket") return "efectivo";
  return metodo || tipo || "otro";
}
const MP_VIVOS = ["pending", "in_process", "authorized"]; // pagos que todavía pueden aprobarse

// Aplica un pago de Mercado Pago a su compra (external_reference = id de la compra). Idempotente: si la compra ya
// está pagada no hace nada, y si llegan dos avisos al mismo tiempo solo uno "gana" la compra y entrega el link.
async function procesarPagoMP(p: any): Promise<string> {
  const compraId = String(p?.external_reference ?? "");
  if (!esUuid(compraId) || !p?.id) return "sin_compra";
  const { data: compra } = await supabase.from("compras").select("id, estado, monto_mxn, mp_pago_id, mp_estado").eq("id", compraId).maybeSingle();
  if (!compra) return "sin_compra";
  const estadoMP = String(p.status ?? "");
  const datos: Record<string, unknown> = {
    mp_pago_id: String(p.id), mp_estado: estadoMP, metodo_pago: metodoMP(p),
    mp_ficha_url: p.transaction_details?.external_resource_url ?? p.point_of_interaction?.transaction_data?.ticket_url ?? null,
    mp_vence_en: p.date_of_expiration ?? null, mp_actualizado_en: ahora(),
  };
  if (compra.estado === "pagada") {
    // Ya pagada: no se vuelve a entregar. Solo se anota si ese mismo pago cambió (por ejemplo, un reembolso).
    if (String(compra.mp_pago_id ?? "") === String(p.id) && compra.mp_estado !== estadoMP) await supabase.from("compras").update({ mp_estado: estadoMP, mp_actualizado_en: ahora() }).eq("id", compraId);
    return "ya_pagada";
  }
  if (estadoMP === "approved") {
    if (String(p.currency_id ?? "MXN").toUpperCase() !== "MXN" || Number(p.transaction_amount ?? 0) + 0.01 < Number(compra.monto_mxn ?? 0)) {
      console.error("Pago de Mercado Pago con monto o moneda distintos; queda para revisión en el panel", compraId, p.id, p.transaction_amount, p.currency_id);
      await supabase.from("compras").update({ ...datos, mp_estado: "revisar_monto" }).eq("id", compraId).neq("estado", "pagada");
      return "revisar_monto";
    }
    // Paso atómico: solo la ejecución que cambia la compra de pendiente a pagada entrega el link (una sola vez).
    const { data: ganada, error: e } = await supabase.from("compras").update({ ...datos, estado: "pagada", pagada_en: ahora(), monto_mxn: Number(p.transaction_amount) }).eq("id", compraId).in("estado", ["pendiente", "fallida"]).select("id");
    if (e) throw e;
    if (!ganada?.length) return "ya_pagada";
    await confirmarPago(compraId); // la compra ya está pagada: crea el acceso de 7 días y manda el correo
    return "pagada";
  }
  // Pendiente (OXXO, SPEI o tarjeta en revisión), rechazado, cancelado o vencido: la compra sigue pendiente y se anota
  // el método para que el sitio muestre la instrucción adecuada. Un intento rechazado no tapa una ficha que sigue viva.
  if (compra.mp_pago_id && String(compra.mp_pago_id) !== String(p.id) && MP_VIVOS.includes(String(compra.mp_estado)) && !MP_VIVOS.includes(estadoMP)) return "se_conserva_" + compra.mp_estado;
  await supabase.from("compras").update(datos).eq("id", compraId).neq("estado", "pagada");
  return estadoMP || "sin_estado";
}

// Pregunta directo a Mercado Pago por los pagos de una compra (por si el aviso tarda o no llega) y aplica el más
// importante: aprobado, luego pendiente, luego el más reciente. pagoId = el que Mercado Pago puso al regresar al sitio.
async function revisarCompraMP(compraId: string, pagoId?: string | null): Promise<string | null> {
  const pagos: any[] = [];
  if (pagoId && /^\d{1,20}$/.test(pagoId)) {
    const r = await mp(`/v1/payments/${pagoId}`);
    if (r.ok && String(r.datos?.external_reference ?? "") === compraId) {
      if (r.datos.status === "approved") return await procesarPagoMP(r.datos);
      pagos.push(r.datos);
    }
  }
  const r = await mp(`/v1/payments/search?external_reference=${encodeURIComponent(compraId)}&sort=date_created&criteria=desc&limit=20`);
  if (!r.ok && !pagos.length) throw new Error(`Mercado Pago respondió ${r.status} al buscar los pagos`);
  for (const x of (r.ok ? r.datos?.results ?? [] : []) as any[]) if (!pagos.some((y) => String(y.id) === String(x.id))) pagos.push(x);
  if (!pagos.length) return null;
  return await procesarPagoMP(pagos.find((x) => x.status === "approved") ?? pagos.find((x) => MP_VIVOS.includes(x.status)) ?? pagos[0]);
}
// Guía personalizada: su vista previa (borrador) se guarda mientras corre el plazo para pagar en OXXO o por SPEI;
// sin esto se borraría a las 24 horas y un pago en OXXO del día siguiente ya no tendría guía que entregar.
async function guardarBorradorMientrasPaga(borradorId: string | null | undefined) {
  if (!borradorId) return;
  const hasta = new Date(Date.now() + (MP_DIAS_EFECTIVO + 1) * 86400 * 1000).toISOString();
  await supabase.from("borradores").update({ expira_en: hasta }).eq("id", borradorId).lt("expira_en", hasta).not("estado", "in", "(pagado,listo)");
}
// Freno para no preguntarle a Mercado Pago en cada consulta de estado: una vez cada 20 s por compra.
const revisadasMP = new Map<string, number>();
function tocaRevisarMP(compraId: string): boolean {
  const antes = revisadasMP.get(compraId) ?? 0;
  if (Date.now() - antes < 20_000) return false;
  if (revisadasMP.size > 500) revisadasMP.clear();
  revisadasMP.set(compraId, Date.now());
  return true;
}

// Aviso de Mercado Pago (Webhooks, tema "Pagos"): POST /pago/mercadopago?data.id=<pago>&type=payment.
async function avisoMercadoPago(req: Request, url: URL): Promise<Response> {
  const cuerpo = await leerJson(req);
  const idUrl = url.searchParams.get("data.id");
  // Formato viejo (IPN, ?topic=…&id=…): Mercado Pago no permite validar su firma. Se contesta 200 sin hacer nada;
  // el mismo pago llega también como aviso Webhook firmado.
  if (!idUrl && url.searchParams.get("topic")) return json({ ok: true, ignorado: "ipn" });
  const xSignature = req.headers.get("x-signature");
  if (!xSignature || !/ts=/.test(xSignature) || !/v1=/.test(xSignature)) return error("Firma no válida", 401);
  const secreto = Deno.env.get("MP_WEBHOOK_SECRET") ?? "";
  if (!secreto) return error("El motor de pagos aún no está configurado", 503); // Mercado Pago reintenta más tarde
  if (!(await firmaMPValida(secreto, xSignature, req.headers.get("x-request-id"), idUrl))) return error("Firma no válida", 401);
  const tipo = String(url.searchParams.get("type") ?? cuerpo?.type ?? "");
  const pagoId = String(idUrl ?? cuerpo?.data?.id ?? "");
  if (tipo !== "payment" || !/^\d{1,20}$/.test(pagoId)) return json({ ok: true, ignorado: tipo || "sin_tipo" });
  if (!mpToken()) return error("El motor de pagos aún no está configurado", 503);
  const r = await mp(`/v1/payments/${pagoId}`);
  if (r.status === 404) return json({ ok: true, ignorado: "pago_inexistente" }); // p. ej. la prueba "Simular" del panel
  if (!r.ok) return error(`Mercado Pago respondió ${r.status}`, 502); // Mercado Pago vuelve a mandar el aviso
  return json({ ok: true, resultado: await procesarPagoMP(r.datos) });
}

// ---------- Códigos de descuento (Daniel los crea en el panel: para sus pruebas y para regalar accesos) ----------
// Tipo "gratis": la guía sale sin costo y se entrega al instante. Tipo "porcentaje": se cobra el precio con descuento.
// El código se compara sin distinguir mayúsculas y sin espacios. Si no sirve (no existe, apagado, vencido o sin usos),
// la familia solo ve un mensaje neutro. Cada intento queda anotado y, con 5 intentos fallidos en una hora (mismo
// teléfono, correo o IP), los siguientes se rechazan aunque el código sea bueno.
const CODIGO_NO_VALIDO = "Ese código no es válido";
const CODIGO_INTENTOS_MAX = 5;
const MSG_REVISANDO = "Estamos revisando tu guía; te avisamos por correo en cuanto esté lista.";
type Codigo = { id: string; codigo: string; tipo: string; valor: number; usos_max: number | null; usos: number; activo: boolean; expira_en: string | null };
type Quien = { telefono: string; correo: string; ip: string | null };
const normalizarCodigo = (v: unknown) => String(v ?? "").normalize("NFC").replace(/\s+/g, "").toUpperCase().slice(0, 60);
const formatoCodigo = (c: string) => /^[A-Z0-9Ñ][A-Z0-9Ñ_-]{2,39}$/.test(c);
const redondear = (n: number) => Math.round(n * 100) / 100;
const comillas = (s: string) => `"${String(s).replace(/["\\]/g, "")}"`; // valor seguro dentro de un filtro .or()
function motivoCodigo(c: Codigo | null): string | null {
  if (!c) return "no_existe";
  if (!c.activo) return "apagado";
  if (c.expira_en && new Date(c.expira_en).getTime() <= Date.now()) return "vencido";
  if (c.usos_max !== null && c.usos_max !== undefined && Number(c.usos) >= Number(c.usos_max)) return "agotado";
  return null;
}
function precioConCodigo(precio: number, c: Codigo): number {
  if (c.tipo === "gratis" || Number(c.valor) >= 100) return 0;
  return Math.max(0, redondear(precio * (1 - Number(c.valor) / 100)));
}
async function anotarIntento(fila: Record<string, unknown>) {
  const { error: e } = await supabase.from("codigo_intentos").insert(fila);
  if (e) console.warn("No se pudo anotar el intento de código:", e.message);
}
// null = la familia no escribió código; { error } = no sirve (mensaje neutro); { codigo } = sirve.
async function revisarCodigo(valor: unknown, quien: Quien): Promise<null | { error: string } | { codigo: Codigo }> {
  const escrito = normalizarCodigo(valor);
  if (!escrito) return null;
  const fila = { codigo: escrito.slice(0, 40), telefono: quien.telefono || null, correo: quien.correo || null, ip: quien.ip };
  const filtro = [`telefono.eq.${comillas(quien.telefono)}`, `correo.eq.${comillas(quien.correo)}`, quien.ip ? `ip.eq.${comillas(quien.ip)}` : ""].filter(Boolean).join(",");
  const { count } = await supabase.from("codigo_intentos").select("id", { count: "exact", head: true }).gte("creado_en", new Date(Date.now() - 3600 * 1000).toISOString()).not("resultado", "in", "(ok,bloqueado)").or(filtro);
  if ((count ?? 0) >= CODIGO_INTENTOS_MAX) { await anotarIntento({ ...fila, resultado: "bloqueado" }); return { error: CODIGO_NO_VALIDO }; }
  const { data } = formatoCodigo(escrito) ? await supabase.from("codigos").select("id, codigo, tipo, valor, usos_max, usos, activo, expira_en").eq("codigo", escrito).maybeSingle() : { data: null };
  const motivo = motivoCodigo(data as Codigo | null);
  if (motivo) { await anotarIntento({ ...fila, codigo_id: (data as any)?.id ?? null, resultado: motivo }); return { error: CODIGO_NO_VALIDO }; }
  return { codigo: data as Codigo };
}
// Suma un uso (o lo devuelve con delta -1). Sin forzar, solo lo suma si el código sigue sirviendo (paso atómico en SQL:
// dos familias no pueden gastar al mismo tiempo el último uso).
async function usarCodigo(codigo: string, forzar = false, delta = 1): Promise<boolean> {
  const { data, error: e } = await supabase.rpc("sparked_usar_codigo", { p_codigo: codigo, p_forzar: forzar, p_delta: delta });
  if (e) throw e;
  return Array.isArray(data) && data.length > 0;
}
// Código de descuento en porcentaje: su uso se cuenta cuando la compra queda pagada (una sola vez por compra).
async function contarUsoCodigo(compraId: string) {
  const { data: marcada } = await supabase.from("compras").update({ codigo_usado_en: ahora() }).eq("id", compraId).not("codigo", "is", null).is("codigo_usado_en", null).select("codigo");
  if (marcada?.[0]?.codigo) await usarCodigo(marcada[0].codigo, true);
}
// Código gratis: la compra queda pagada con el código y la guía se entrega en ese momento (acceso de 7 días, correo
// y link, igual que una compra pagada).
async function entregarConCodigo(compra: any, cod: Codigo, quien: Quien, precio: number): Promise<Response> {
  const fila = { codigo: cod.codigo, codigo_id: cod.id, telefono: quien.telefono, correo: quien.correo, ip: quien.ip };
  if (!(await usarCodigo(cod.codigo))) { await anotarIntento({ ...fila, resultado: "agotado" }); return json({ error: CODIGO_NO_VALIDO, campo: "codigo" }, 400); }
  const { data: ganada, error: e } = await supabase.from("compras").update({ estado: "pagada", pagada_en: ahora(), monto_mxn: 0, metodo_pago: "codigo", codigo: cod.codigo, descuento_mxn: precio, codigo_usado_en: ahora() }).eq("id", compra.id).eq("estado", "pendiente").select("id");
  if (e || !ganada?.length) {
    await usarCodigo(cod.codigo, true, -1); // el uso se devuelve: esta compra no se pagó con el código
    if (e) throw e;
    return error("Esta compra ya no está activa. Vuelve a pedir tu guía desde la página principal.");
  }
  await anotarIntento({ ...fila, resultado: "ok", compra_id: compra.id });
  // Si la entrega se interrumpe aquí, GET /pago/estado la termina (la compra ya quedó pagada con el código).
  try { await confirmarPago(compra.id); } catch (e2) { console.error("Entrega con código interrumpida; la termina /pago/estado:", (e2 as Error).message); }
  return json({ modo: "codigo", compra_id: compra.id, url: `${await sitio()}listo.html?compra=${compra.id}` });
}

// Avance de una guía pagada que todavía no está completa (trabajo "resto"). revision = el trabajo falló, terminó sin
// pegar la guía o no existe: ya no se dice "generando" para siempre. desde = cuándo se entregó el link (para no
// confundir con los segundos en que el trabajo apenas se está creando).
async function avanceDeGuia(guiaId: string, desde = 0): Promise<{ revision: boolean; avance: any }> {
  const { data: t } = await supabase.from("trabajos").select("id, estado, progreso, actualizado_en, intentos").eq("guia_id", guiaId).in("alcance", ["resto", "completa"]).order("creado_en", { ascending: false }).limit(1).maybeSingle();
  const viejo = (iso: unknown) => Date.now() - new Date(String(iso ?? 0)).getTime() > 60_000;
  if (!t) return viejo(desde ? new Date(desde).toISOString() : 0) ? { revision: true, avance: { pct: 0, mensaje: MSG_REVISANDO } } : { revision: false, avance: null };
  if (t.estado === "error" || (t.estado === "listo" && viejo(t.actualizado_en))) return { revision: true, avance: { pct: 0, mensaje: MSG_REVISANDO } };
  await reanudarSiAtorado(t as any);
  return { revision: false, avance: t.progreso ?? null };
}

async function confirmarPago(compraId: string, extra: { stripe_session_id?: string; monto?: number; manual?: boolean } = {}) {
  const { data: compra } = await supabase.from("compras").select("*").eq("id", compraId).maybeSingle();
  if (!compra) throw new Error("Esa compra no existe");
  if (compra.estado !== "pagada") {
    const cambios: Record<string, unknown> = { estado: "pagada", pagada_en: ahora() };
    if (extra.stripe_session_id) cambios.stripe_session_id = extra.stripe_session_id;
    if (extra.monto) cambios.monto_mxn = extra.monto;
    const { error: e } = await supabase.from("compras").update(cambios).eq("id", compraId);
    if (e) throw e;
    Object.assign(compra, cambios);
  }
  const entrega = await entregar(compra);
  return { compra, ...entrega };
}

// Al confirmarse el pago: crea (una sola vez) la clase y el acceso de 7 días y 2 dispositivos para esa compra y lanza la
// generación de lo que falta. El link NO se muestra ni se manda hasta que la guía está 100 % completa y verificada:
// eso lo hace entregarGuiaLista() (aquí mismo si la guía ya estaba completa; si no, al terminar la generación).
// lista = la compra ya recibió su entrega; recien = la entrega salió en esta llamada.
async function entregar(compra: any): Promise<{ token: string; expira_en: string; link: string; lista: boolean; recien: boolean }> {
  const base = await sitio();
  await contarUsoCodigo(compra.id); // código de descuento en porcentaje: su uso se cuenta al quedar pagada (una vez)
  if (compra.acceso_id) {
    const { data: a } = await supabase.from("accesos").select("token, expira_en").eq("id", compra.acceso_id).maybeSingle();
    if (a) {
      const { data: g } = await supabase.from("guias").select("origen, borrador_id, completo:cartucho->completo").eq("id", compra.guia_id).maybeSingle();
      // Si la primera entrega se cortó antes de lanzar el resto de la guía, se lanza ahora (lanzarResto no lo duplica).
      if (g && g.completo !== true && g.origen === "personalizada" && g.borrador_id) await lanzarResto(compra.guia_id, g.borrador_id).catch((e) => console.error("No se pudo lanzar el resto de la guía:", (e as Error).message));
      const r = g?.completo === true ? await entregarGuiaLista(compra.id) : { entregada: false, recien: false };
      const a2 = r.recien ? (await supabase.from("accesos").select("token, expira_en").eq("id", compra.acceso_id).maybeSingle()).data ?? a : a;
      return { token: a2.token, expira_en: a2.expira_en, link: linkDe(base, a2.token), lista: r.entregada, recien: r.recien };
    }
  }
  const { data: guia } = await supabase.from("guias").select("id, titulo, clase_id, origen, colegio_id, grado, materia, borrador_id, estado, completo:cartucho->completo").eq("id", compra.guia_id).maybeSingle();
  if (!guia) throw new Error("La guía de esta compra ya no existe");
  let claseId = guia.clase_id as string | null;
  if (!claseId) {
    const { data: c, error: e } = await supabase.from("clases").insert({
      nombre: `SparkEd · ${guia.titulo ?? "Guía"}`.slice(0, 90), url_destino: `${base}guia.html`, tipo: "guia", activa: true, libre: false,
      max_dispositivos: APARATOS, vigencia_horas: DIAS_ACCESO * 24, minutos_tras_apertura: DIAS_ACCESO * 24 * 60, max_usos: 1000000,
      colegio_id: guia.colegio_id, grado: guia.grado, materia: guia.materia,
    }).select("id").single();
    if (e) throw e;
    claseId = c.id;
    await supabase.from("guias").update({ clase_id: claseId }).eq("id", guia.id);
  }
  const expira = enDias(DIAS_ACCESO);
  const { data: acceso, error: ea } = await supabase.from("accesos").insert({
    token: nuevoToken(), clase_id: claseId, alumno: texto(compra.nombre, 60) || "Familia", telefono: telLocal(compra.telefono),
    nota: `SparkEd · folio ${String(compra.id).slice(0, 8).toUpperCase()}`, expira_en: expira, minutos_tras_apertura: DIAS_ACCESO * 24 * 60, max_usos: 1000000, enviado_en: ahora(),
  }).select("id, token").single();
  if (ea) throw ea;
  await supabase.from("compras").update({ acceso_id: acceso.id }).eq("id", compra.id);
  if (guia.origen === "personalizada") {
    const cambios: Record<string, unknown> = { borrar_en: enDias(DIAS_ACCESO + 1) };
    if (guia.completo === true) cambios.estado = "publicada";
    await supabase.from("guias").update(cambios).eq("id", guia.id);
    if (guia.borrador_id) {
      await supabase.from("borradores").update({ estado: "pagado", pagado_en: ahora(), nombre: compra.nombre, telefono: compra.telefono, correo: compra.correo, expira_en: enDias(DIAS_ACCESO + 1) }).eq("id", guia.borrador_id);
      if (guia.completo !== true) {
        // Si no se puede lanzar, la familia ve "Estamos revisando tu guía" (y recibe ese correo) y Daniel recibe el aviso.
        try { await lanzarResto(guia.id, guia.borrador_id); }
        catch (e) {
          console.error("No se pudo lanzar el resto de la guía:", (e as Error).message);
          enSegundoPlano(avisarDaniel(`⚠️ SparkEd: una guía pagada no se pudo continuar (${guia.titulo ?? "guía"})`, `<p>La guía <b>${escHtml(guia.titulo)}</b> ya está pagada (folio ${escHtml(folioDe(compra.id))}), pero no se pudo lanzar la generación de los bloques que faltan: ${escHtml((e as Error).message)}</p><p>Revísala en el panel: Biblioteca → Personalizadas.</p>`));
          enSegundoPlano(avisarRevision(compra.id));
        }
      }
    }
  }
  // Aviso a Daniel de la venta (o del acceso con código), una vez, al confirmarse el pago.
  enSegundoPlano(avisarVenta(compra, guia.titulo ?? compra.titulo ?? "Tu guía"));
  compra.acceso_id = acceso.id;
  const r = guia.completo === true ? await entregarGuiaLista(compra.id) : { entregada: false, recien: false };
  const a2 = r.recien ? (await supabase.from("accesos").select("token, expira_en").eq("id", acceso.id).maybeSingle()).data : null;
  return { token: acceso.token, expira_en: a2?.expira_en ?? expira, link: linkDe(base, acceso.token), lista: r.entregada, recien: r.recien };
}

// Entrega de una compra pagada cuando su guía está 100 % completa y pasa la verificación final: marca entregada_en (una
// sola vez, paso atómico), los 7 días empiezan a contar desde este momento (si el link no se ha abierto) y salen, cada
// uno por su lado, el correo de entrega y el WhatsApp. Si la verificación final no pasa, no se entrega: se avisa.
async function entregarGuiaLista(compraId: string): Promise<{ entregada: boolean; recien: boolean; problemas?: string[] }> {
  const { data: c } = await supabase.from("compras").select("*").eq("id", compraId).maybeSingle();
  if (!c || c.estado !== "pagada" || !c.acceso_id) return { entregada: false, recien: false };
  if (c.entregada_en) return { entregada: true, recien: false };
  const { data: g } = await supabase.from("guias").select("id, titulo, origen, borrador_id, cartucho").eq("id", c.guia_id).maybeSingle();
  if (!g || (g.cartucho as any)?.completo !== true) return { entregada: false, recien: false };
  const problemas = verificarCartucho(g.cartucho);
  if (problemas.length) {
    await avisarRevision(c.id, `La guía <b>${escHtml(g.titulo)}</b> está marcada como completa, pero no pasó la verificación final: ${escHtml(problemas.join(" · "))}. Corrígela (por ejemplo, subiendo el cartucho arreglado en el panel) y se entrega sola.`);
    return { entregada: false, recien: false, problemas };
  }
  const momento = ahora();
  const { data: ganada } = await supabase.from("compras").update({ entregada_en: momento, correo_lista_en: momento }).eq("id", c.id).is("entregada_en", null).select("id");
  if (!ganada?.length) return { entregada: true, recien: false }; // otra ejecución ya la entregó
  // Los 7 días cuentan desde la entrega (si el link todavía no se ha abierto).
  await supabase.from("accesos").update({ expira_en: enDias(DIAS_ACCESO) }).eq("id", c.acceso_id).is("primer_uso_en", null);
  if (g.origen === "personalizada") {
    await supabase.from("guias").update({ borrar_en: enDias(DIAS_ACCESO + 1) }).eq("id", g.id);
    if (g.borrador_id) await supabase.from("borradores").update({ expira_en: enDias(DIAS_ACCESO + 1) }).eq("id", g.borrador_id);
  }
  const { data: a } = await supabase.from("accesos").select("token, expira_en").eq("id", c.acceso_id).maybeSingle();
  if (!a) return { entregada: true, recien: true };
  const titulo = g.titulo ?? c.titulo ?? "Tu guía";
  const link = linkDe(await sitio(), a.token);
  // Correo y WhatsApp son independientes: que falle uno no impide el otro.
  const [correo, whatsapp] = await Promise.allSettled([
    enviarCorreo(c, titulo, link, a.expira_en),
    avisarPorWhatsApp(ctxBase(), c, { titulo, link, expira_en: a.expira_en }),
  ]);
  console.log("Guía entregada", c.id, "correo:", correo.status === "fulfilled" ? "ok" : String((correo as PromiseRejectedResult).reason), "whatsapp:", whatsapp.status === "fulfilled" ? JSON.stringify(whatsapp.value) : String((whatsapp as PromiseRejectedResult).reason));
  return { entregada: true, recien: true };
}

// Todas las compras pagadas de una guía que esperaban su entrega (al terminar la generación o al subir un cartucho).
async function entregarPendientes(guiaId: string) {
  const { data: compras } = await supabase.from("compras").select("id").eq("guia_id", guiaId).eq("estado", "pagada").not("acceso_id", "is", null).is("entregada_en", null);
  for (const c of compras ?? []) {
    try { await entregarGuiaLista(c.id); } catch (e) { console.error("No se pudo entregar la compra", c.id, (e as Error).message); }
  }
}

// Después del pago de una guía personalizada: se generan los bloques que faltan a partir de la vista previa.
async function lanzarResto(guiaId: string, borradorId: string) {
  const { data: existente } = await supabase.from("trabajos").select("id, estado").eq("guia_id", guiaId).eq("alcance", "resto").limit(1).maybeSingle();
  if (existente) return;
  const { data: vp } = await supabase.from("trabajos").select("*").eq("borrador_id", borradorId).eq("alcance", "vista_previa").eq("estado", "listo").order("creado_en", { ascending: false }).limit(1).maybeSingle();
  if (!vp) throw new Error("No existe la vista previa para continuar la guía");
  const datos = { ...(vp.datos as any) }; delete datos.cartucho;
  const nBloques = datos.plan?.bloques?.length ?? 1;
  const paso = nBloques > 1 ? "generar:1" : "revisar";
  const { data: t, error: e } = await supabase.from("trabajos").insert({ tipo: "generar", borrador_id: borradorId, guia_id: guiaId, alcance: "resto", paso, estado: "pendiente", datos, progreso: { pct: 42, mensaje: nBloques > 1 ? `Escribiendo el bloque 2 de ${nBloques} ✍️` : "Revisando que todo esté perfecto ✅", paso } }).select("id").single();
  if (e) throw e;
  disparar(t.id);
}

const escHtml = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
const folioDe = (id: unknown) => String(id ?? "").slice(0, 8).toUpperCase();
// Versión en texto plano de un correo HTML sencillo (Gmail y otros clasifican mejor los correos que traen las dos versiones).
const SALTO = String.fromCharCode(10);
function htmlATexto(h: string): string {
  const t = h
    .replace(/<br[^>]*>/gi, SALTO)
    .replace(/<[/](p|div|li|h[1-6]|ul|ol)>/gi, SALTO)
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  return t.split(SALTO).map((l) => l.trim()).join(SALTO).replace(new RegExp(SALTO + "{3,}", "g"), SALTO + SALTO).trim();
}
// Manda un correo por Resend con las dos versiones (HTML y texto) y, si Daniel puso un buzón de respuestas en Ajustes, con
// reply-to: así las respuestas de las familias llegan a una persona y el correo se parece menos a una notificación automática.
async function mandarCorreo(para: string, asunto: string, html: string, texto?: string) {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key || !esCorreo(para)) return;
  const cfg = await config();
  const cuerpo: Record<string, unknown> = { from: cfg.sparked_correo_remitente, to: [para], subject: asunto, html, text: texto ?? htmlATexto(html) };
  if (esCorreo(cfg.sparked_correo_respuestas)) cuerpo.reply_to = cfg.sparked_correo_respuestas;
  const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, body: JSON.stringify(cuerpo) });
  if (!r.ok) console.warn("Resend", r.status, (await r.text()).slice(0, 200));
}
// Aviso a Daniel (correo de Ajustes → "Correo donde quieres recibir aviso de cada venta"), si lo puso.
async function avisarDaniel(asunto: string, html: string) {
  const cfg = await config();
  if (esCorreo(cfg.sparked_correo_aviso)) await mandarCorreo(cfg.sparked_correo_aviso, asunto, html);
}

// Correo de entrega a la familia: sale una sola vez por compra, cuando la guía está 100 % completa y verificada (o cuando
// Daniel lo reenvía desde el panel). Es el único correo del caso normal.
async function enviarCorreo(compra: any, titulo: string, link: string, expira: string) {
  if (!Deno.env.get("RESEND_API_KEY") || !esCorreo(compra.correo)) return;
  const esc = escHtml;
  const fecha = new Date(expira).toLocaleString("es-MX", { dateStyle: "long", timeStyle: "short", timeZone: "America/Mexico_City" });
  const conCodigo = compra.metodo_pago === "codigo";
  // El correo se escribe como lo escribiría una persona (saludo con nombre, párrafos cortos, el link como texto y sin
  // banners ni botones grandes): así Gmail lo deja en la bandeja principal y no en "Notificaciones" o "Promociones".
  const nombre = String(compra.nombre ?? "").trim().split(/[ ]+/)[0] || "Hola";
  const saludo = nombre === "Hola" ? "Hola:" : `Hola, ${esc(nombre)}:`;
  const primera = `${conCodigo ? "Tu código se aplicó" : "Tu pago se confirmó"} y tu guía <b>${esc(titulo)}</b> ya está lista. Ábrela con este link:`;
  const nota = "";
  const pago = conCodigo ? `Acceso con código${compra.codigo ? " " + esc(compra.codigo) : ""}` : `$${esc(compra.monto_mxn)} MXN, IVA incluido`;
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:#1b1b1f;max-width:560px;margin:auto">
    <p>${saludo}</p>
    <p>${primera}</p>
    <p><a href="${esc(link)}" style="color:#1d4ed8">${esc(link)}</a></p>${nota}
    <p>Cómo funciona tu acceso: vale <b>${DIAS_ACCESO} días de acceso ilimitado a tu guía</b>, hasta el ${esc(fecha)}, y acepta <b>${APARATOS} dispositivos</b>, por ejemplo tu celular y el iPad del alumno. El tercer dispositivo ve el aviso "Acceso en uso en otros dispositivos". Cada link es de una sola familia: no lo compartas en otros chats.</p>
    <p>Si tienes cualquier duda, responde a este correo y te ayudo.</p>
    <p>Daniel, de SparkEd<br><span style="color:#777;font-size:13px">sparkeducation-mx.com · Folio ${esc(folioDe(compra.id))} · ${pago}</span></p>
  </div>`;
  const asunto = `${nombre === "Hola" ? "Tu" : nombre + ", tu"} guía de SparkEd ya está lista: ${titulo}`;
  await mandarCorreo(compra.correo, asunto, html);
}

// Aviso a Daniel al confirmarse el pago: una venta, o un acceso con código gratis (que no es venta).
async function avisarVenta(compra: any, titulo: string) {
  const esc = escHtml;
  const conCodigo = compra.metodo_pago === "codigo";
  const quien = `<p>${esc(compra.nombre)} · ${esc(compra.telefono)} · ${esc(compra.correo)}</p>`;
  if (conCodigo) await avisarDaniel(`Guía con código SparkEd: ${titulo}`, `<p>Acceso con el código <b>${esc(compra.codigo ?? "")}</b> (sin costo; no cuenta como venta): <b>${esc(titulo)}</b></p>${quien}<p>Folio ${esc(folioDe(compra.id))}</p>`);
  else await avisarDaniel(`Venta SparkEd: ${titulo}`, `<p>Compra pagada: <b>${esc(titulo)}</b></p>${quien}<p>Folio ${esc(folioDe(compra.id))} · $${esc(compra.monto_mxn)} MXN${compra.codigo ? ` (con el código ${esc(compra.codigo)})` : ""}</p>`);
}

// La guía de una compra pagada no se pudo terminar (falla definitiva o verificación final): la familia recibe UN correo,
// una sola vez por compra, que dice que su pago llegó y que su guía está en revisión. Si se pasa avisoDaniel, Daniel
// recibe también un aviso (una vez por compra). Cuando la guía queda lista, sale la entrega normal.
async function avisarRevision(compraId: string, avisoDaniel?: string) {
  const { data: ganada } = await supabase.from("compras").update({ aviso_revision_en: ahora() }).eq("id", compraId).eq("estado", "pagada").is("aviso_revision_en", null).is("entregada_en", null).select("*");
  const c = ganada?.[0];
  if (!c) return;
  const esc = escHtml;
  const titulo = c.titulo ?? "Tu guía";
  if (avisoDaniel) await avisarDaniel(`⚠️ SparkEd: una guía pagada no se entregó (${titulo})`, `<p>${avisoDaniel}</p><p>${esc(c.nombre)} · ${esc(c.telefono)} · ${esc(c.correo)} · folio ${esc(folioDe(c.id))}</p><p>La familia ve: "${MSG_REVISANDO}"</p>`);
  if (!Deno.env.get("RESEND_API_KEY") || !esCorreo(c.correo)) return;
  const nombre = String(c.nombre ?? "").trim().split(/[ ]+/)[0] || "Hola";
  const saludo = nombre === "Hola" ? "Hola:" : `Hola, ${esc(nombre)}:`;
  const conCodigo = c.metodo_pago === "codigo";
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:#1b1b1f;max-width:560px;margin:auto">
    <p>${saludo}</p>
    <p>${conCodigo ? "Tu código se aplicó" : "Recibimos tu pago"} (folio ${esc(folioDe(c.id))}). Estamos revisando tu guía <b>${esc(titulo)}</b> para que llegue completa y sin errores.</p>
    <p>Te la mandamos a este correo en cuanto esté lista. No necesitas hacer nada más.</p>
    <p>Si tienes cualquier duda, responde a este correo y te ayudo.</p>
    <p>Daniel, de SparkEd<br><span style="color:#777;font-size:13px">sparkeducation-mx.com · Folio ${esc(folioDe(c.id))}</span></p>
  </div>`;
  await mandarCorreo(c.correo, `${nombre === "Hola" ? "Tu" : nombre + ", tu"} guía de SparkEd está en revisión: ${titulo}`, html);
}
// Todas las compras pagadas de una guía que no se pudo terminar y que no son de un trabajo "resto" (por ejemplo, una
// regeneración desde el panel): aviso a Daniel y correo de revisión a cada familia que espera.
async function avisarRevisionDeGuia(guiaId: string, motivo: string) {
  const { data: compras } = await supabase.from("compras").select("id").eq("guia_id", guiaId).eq("estado", "pagada").is("entregada_en", null);
  for (const c of compras ?? []) await avisarRevision(c.id, escHtml(motivo));
}

// El trabajo "resto" de una guía pagada falló después de sus reintentos: la familia ve "Estamos revisando tu guía"
// (ya no "generando" para siempre), el panel lo muestra en el Resumen y Daniel recibe un correo. Un aviso por falla.
async function avisarRestoFallido(trabajoId: string) {
  const { data: marcado } = await supabase.from("trabajos").update({ aviso_error_en: ahora() }).eq("id", trabajoId).eq("alcance", "resto").is("aviso_error_en", null).select("id, guia_id, paso, error");
  const t = marcado?.[0];
  if (!t?.guia_id) return;
  const [{ data: g }, { data: comp }] = await Promise.all([
    supabase.from("guias").select("titulo").eq("id", t.guia_id).maybeSingle(),
    supabase.from("compras").select("id, nombre, telefono, correo").eq("guia_id", t.guia_id).eq("estado", "pagada"),
  ]);
  console.error("Guía pagada sin terminar (trabajo resto con error):", t.guia_id, t.error);
  const familias = (comp ?? []).map((c) => `${escHtml(c.nombre)} · ${escHtml(c.telefono)} · ${escHtml(c.correo)} · folio ${escHtml(folioDe(c.id))}`).join("<br>") || "Sin compra pagada.";
  await avisarDaniel(`⚠️ SparkEd: una guía pagada no se terminó (${g?.titulo ?? "guía"})`,
    `<p>La guía <b>${escHtml(g?.titulo ?? "")}</b> ya está pagada, pero la IA no pudo terminar los bloques que faltan o la guía no pasó la verificación final (paso ${escHtml(t.paso)}).</p><p style="color:#555">${escHtml(t.error ?? "")}</p><p>${familias}</p><p>La familia ve: "${MSG_REVISANDO}" y recibió un correo de que su guía está en revisión.</p><p>Para arreglarlo: en el panel, Biblioteca → Personalizadas → abre la guía → ↻ Reintentar. Al terminar, a la familia le llega sola su guía completa (correo y WhatsApp).</p>`);
  // A cada familia que espera: un correo (una vez por compra) de que su pago llegó y su guía está en revisión.
  for (const c of comp ?? []) { try { await avisarRevision(c.id); } catch (e) { console.error("No se pudo mandar el aviso de revisión:", (e as Error).message); } }
}

// Vista previa de una guía (si no está guardada, se recorta del cartucho).
async function vistaPreviaDe(g: { vista_previa: any; cartucho: any }) { return g.cartucho ? recortarVistaPrevia(g.cartucho) : g.vista_previa ?? null; }

// Normaliza un cartucho subido a mano (actividades agrupadas → lista con tipo).
function normalizarCartucho(c: any) {
  if (!c || typeof c !== "object" || !Array.isArray(c.bloques) || !c.bloques.length) throw new Error("El cartucho debe traer plan y bloques");
  c.plan = c.plan ?? {}; c.plan.identidad = c.plan.identidad ?? {};
  c.bloques = c.bloques.map((b: any, i: number) => ({ ...b, id: b.id ?? `b${i + 1}`, pistas: b.pistas ?? [], actividades: aplanar(b.actividades), mini_examen: aplanar(b.mini_examen) }));
  c.completo = true;
  return c;
}

// ---------- Servidor ----------
// ---------- Módulos aparte: comentarios y costos (extras.ts) y WhatsApp (whatsapp.ts) ----------
// Cada módulo recibe este contexto (tipos.ts) y decide si la ruta es suya; si no, devuelve null.
// Imagen de cada mensaje de WhatsApp: la entrega lleva el QR del link de esa guía; «compartir» es una imagen fija.
const imagenWhatsApp = async (tipo: "entrega" | "compartir", idioma: "es" | "en", link?: string): Promise<Uint8Array | null> =>
  tipo === "entrega" ? (link ? await imagenEntrega(await sitio(), idioma, link, matrizQr) : null) : await imagenCompartir(await sitio(), idioma);
const ctxBase = (): CtxBase => ({ supabase, config, sitio, ahora, mandarCorreo, avisarDaniel, enSegundoPlano, imagenWhatsApp });
async function rutasAparte(req: Request, m: string, ruta: string[]): Promise<Response | null> {
  const c: CtxRutas = { ...ctxBase(), req, m, ruta, json, error, leerJson, esAdmin: () => autorizado(req), ip: ipDe(req) };
  return (await rutasExtras(c)) ?? (await rutasWhatsApp(c));
}
// avisarPorWhatsApp(ctxBase(), compra, { titulo, link, expira_en }) se llama en entregarGuiaLista(), junto con el correo.

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  const url = new URL(req.url);
  const partes = url.pathname.split("/").filter(Boolean);
  const ruta = partes.slice(partes.lastIndexOf("sparked") + 1).map((x) => decodeURIComponent(x));
  const [r0, r1, r2] = ruta;
  const m = req.method;

  try {
    if (!r0) return json({ ok: true, servicio: "SparkEd", version: VERSION });

    // ---------- Interno: un paso de un trabajo ----------
    if (r0 === "trabajo" && esUuid(r1) && r2 === "paso" && m === "POST") {
      if ((req.headers.get("x-interno") ?? "") !== await claveInterna()) return error("No autorizado", 401);
      enSegundoPlano(correrPaso(r1));
      return json({ ok: true, aceptado: true }, 202);
    }

    // ---------- Módulos aparte (extras.ts, whatsapp.ts) ----------
    const aparte = await rutasAparte(req, m, ruta);
    if (aparte) return aparte;

    // ---------- Público ----------
    if (r0 === "colegios" && m === "GET") {
      const { data } = await supabase.from("colegios").select("id, nombre").eq("activo", true).order("orden").order("nombre");
      return json({ colegios: data ?? [] });
    }

    if (r0 === "buscar" && m === "POST") {
      const b = await leerJson(req);
      const grado = texto(b.grado, 60), materia = texto(b.materia, 60);
      if (!grado || !materia) return error("Elige grado y materia.");
      const colegioId = esUuid(b.colegio_id) ? b.colegio_id : null;
      const { data } = await supabase.from("guias").select("id, titulo, materia, grado, examen, fecha_examen, colegio_id, publicada_en").eq("estado", "publicada").eq("origen", "biblioteca").ilike("grado", grado).ilike("materia", materia).order("publicada_en", { ascending: false });
      const guias = (data ?? []).filter((g) => (colegioId && g.colegio_id === colegioId) || g.colegio_id === null).sort((a, b2) => Number(b2.colegio_id === colegioId) - Number(a.colegio_id === colegioId));
      if (Math.random() < 0.1) enSegundoPlano(limpieza());
      return json({ guias: guias.map(({ colegio_id: _c, ...g }) => g) });
    }

    if (r0 === "solicitud" && m === "POST") {
      const b = await leerJson(req);
      const fila = { colegio_id: esUuid(b.colegio_id) ? b.colegio_id : null, colegio_texto: texto(b.colegio_texto, 80) || null, grado: texto(b.grado, 60) || null, materia: texto(b.materia, 60) || null, nombre: texto(b.nombre, 80) || null, telefono: limpiarTel(b.telefono) || null, correo: esCorreo(b.correo) ? b.correo.trim().toLowerCase() : null };
      if (!fila.grado || !fila.materia) return error("Faltan el grado y la materia.");
      if (!fila.telefono && !fila.correo) return error("Deja un WhatsApp o un correo para avisarte.");
      const { data: previa } = await supabase.from("solicitudes").select("id").eq("grado", fila.grado).eq("materia", fila.materia).or(`telefono.eq.${fila.telefono ?? "x"},correo.eq.${fila.correo ?? "x"}`).gte("creada_en", new Date(Date.now() - 7 * 86400 * 1000).toISOString()).limit(1);
      if (!previa?.length) { const { error: e } = await supabase.from("solicitudes").insert(fila); if (e) throw e; }
      return json({ ok: true });
    }

    if (r0 === "vista-previa" && esUuid(r1) && m === "GET") {
      const { data: g } = await supabase.from("guias").select("id, titulo, materia, grado, examen, fecha_examen, vista_previa, cartucho, colegios(nombre)").eq("id", r1).eq("estado", "publicada").eq("origen", "biblioteca").maybeSingle();
      if (!g) return error("Esa guía no está disponible", 404);
      const vp = await vistaPreviaDe(g);
      if (!vp) return error("Esa guía no tiene vista previa", 404);
      return json({ vista_previa: vp, guia: { id: g.id, titulo: g.titulo, materia: g.materia, grado: g.grado, examen: g.examen, fecha_examen: g.fecha_examen, colegio: (g as any).colegios?.nombre ?? null } });
    }

    if (r0 === "borrador" && !r1 && m === "POST") {
      const b = await leerJson(req);
      const paginas = validarPaginas(b.paginas);
      if (typeof paginas === "string") return error(paginas);
      const grado = texto(b.grado, 60), materia = texto(b.materia, 60);
      if (!grado || !materia) return error("Elige grado y materia.");
      const cfg = await config();
      const { count } = await supabase.from("borradores").select("id", { count: "exact", head: true }).gte("creado_en", new Date(Date.now() - 86400 * 1000).toISOString());
      if ((count ?? 0) >= Number(cfg.sparked_tope_diario) * 3) return error("Hoy ya se alcanzó el límite de guías. Intenta mañana.", 429);
      const id = crypto.randomUUID(); const clave = nuevoToken(24);
      const archivos = paginas.map((p, k) => ({ ruta: `borradores/${id}/${k + 1}.jpg`, nombre: p.nombre, tipo: p.tipo, tamano: p.tamano }));
      const { error: e } = await supabase.from("borradores").insert({ id, clave, servicio: 2, colegio_id: esUuid(b.colegio_id) ? b.colegio_id : null, colegio_texto: texto(b.colegio_texto, 80) || null, grado, materia, paginas: paginas.length, archivos, estado: "subiendo" });
      if (e) throw e;
      if (Math.random() < 0.2) enSegundoPlano(limpieza());
      return json({ clave, subidas: await urlsDeSubida(archivos) }, 201);
    }

    if (r0 === "borrador" && esClave(r1) && r2 === "generar" && m === "POST") {
      const { data: b } = await supabase.from("borradores").select("*").eq("clave", r1).maybeSingle();
      if (!b) return error("Ese borrador no existe o ya venció", 404);
      if (b.trabajo_id && b.estado !== "subiendo") return json({ ok: true, estado: b.estado });
      const subidos = await archivosSubidos(`borradores/${b.id}`);
      const archivos = (b.archivos as any[]).filter((a) => subidos.has(a.ruta));
      if (!archivos.length) return error("No llegaron las páginas. Intenta subirlas de nuevo.");
      // Campo opcional "idioma" (es | en | fr): fuerza el idioma de la guía. Solo se acepta con la clave de administrador.
      const cuerpo = await leerJson(req);
      const idioma = idiomaValido(cuerpo.idioma);
      if (cuerpo.idioma !== undefined && !(idioma && await autorizado(req))) return error("El campo idioma solo lo puede usar el administrador", 403);
      const datosT = idioma ? { opciones: { idioma_guia: idioma } } : {};
      const { data: t, error: e } = await supabase.from("trabajos").insert({ tipo: "generar", borrador_id: b.id, alcance: "vista_previa", paso: "inicio", estado: "pendiente", datos: datosT, progreso: { pct: 1, mensaje: "Preparando tus páginas 📖", paso: "inicio" } }).select("id").single();
      if (e) throw e;
      await supabase.from("borradores").update({ estado: "generando", trabajo_id: t.id, archivos, paginas: archivos.length }).eq("id", b.id);
      disparar(t.id);
      return json({ ok: true, estado: "generando", trabajo_id: t.id }, 202);
    }

    if (r0 === "borrador" && esClave(r1) && !r2 && m === "GET") {
      const { data: b } = await supabase.from("borradores").select("id, estado, trabajo_id, guia_id, expira_en, grado, materia, pagado_en").eq("clave", r1).maybeSingle();
      if (!b) return error("Ese borrador no existe o ya venció", 404);
      if (new Date(b.expira_en).getTime() < Date.now() && !["pagado", "listo"].includes(b.estado)) return json({ estado: "expirado" });
      let progreso: any = null, err: string | null = null;
      if (b.trabajo_id) {
        const t = await cargarTrabajo(b.trabajo_id);
        if (t) { progreso = t.progreso; if (t.estado === "error") { err = (t.progreso as any)?.mensaje ?? null; if (b.estado === "generando") { await supabase.from("borradores").update({ estado: "fallido" }).eq("id", b.id); b.estado = "fallido"; } } await reanudarSiAtorado(t); }
      }
      let vista_previa: any = null, titulo: string | null = null;
      if (b.guia_id && ["vista_previa", "pagado", "listo"].includes(b.estado)) {
        const { data: g } = await supabase.from("guias").select("titulo, vista_previa, cartucho").eq("id", b.guia_id).maybeSingle();
        if (g) { titulo = g.titulo; vista_previa = await vistaPreviaDe(g); }
      }
      return json({ estado: b.estado, progreso, error: err, titulo, vista_previa, grado: b.grado, materia: b.materia, expira_en: b.expira_en });
    }

    // ---------- Pago ----------
    if (r0 === "pago" && r1 === "crear" && m === "POST") {
      const b = await leerJson(req);
      const nombre = texto(b.nombre, 80), telefono = limpiarTel(b.telefono), correo = esCorreo(b.correo) ? String(b.correo).trim().toLowerCase() : "";
      if (nombre.length < 2) return error("Escribe el nombre de quien pide la guía.");
      if (!telefono) return error("Escribe un teléfono válido (en México, 10 dígitos).");
      if (!correo) return error("Escribe un correo válido.");
      const cfg = await config();
      const precio = Number(cfg.sparked_precio) || 85;
      let guia: any = null, borrador: any = null;
      if (esClave(b.clave)) {
        const { data: bo } = await supabase.from("borradores").select("*").eq("clave", b.clave).maybeSingle();
        if (!bo || !bo.guia_id) return error("Tu guía todavía no tiene vista previa. Espera a que termine.");
        borrador = bo;
        const { data: g } = await supabase.from("guias").select("id, titulo, grado, materia, colegio_id, origen").eq("id", bo.guia_id).maybeSingle();
        guia = g;
      } else if (esUuid(b.guia_id)) {
        const { data: g } = await supabase.from("guias").select("id, titulo, grado, materia, colegio_id, origen, colegios(nombre)").eq("id", b.guia_id).eq("estado", "publicada").eq("origen", "biblioteca").maybeSingle();
        guia = g;
      }
      if (!guia) return error("Esa guía no está disponible", 404);
      // Topes contra abusos: por familia y por día.
      const hace24 = new Date(Date.now() - 86400 * 1000).toISOString();
      const { count: porFamilia } = await supabase.from("compras").select("id", { count: "exact", head: true }).or(`telefono.eq.${telefono},correo.eq.${correo}`).gte("creada_en", hace24).neq("estado", "fallida");
      if ((porFamilia ?? 0) >= Number(cfg.sparked_tope_familia)) return error(`Por seguridad, solo se pueden pedir ${cfg.sparked_tope_familia} guías al día por familia.`, 429);
      const { count: porDia } = await supabase.from("compras").select("id", { count: "exact", head: true }).gte("creada_en", hace24).neq("estado", "fallida");
      if ((porDia ?? 0) >= Number(cfg.sparked_tope_diario)) return error("Hoy ya se alcanzó el límite de guías. Intenta mañana.", 429);
      // Código de descuento (opcional): se revisa antes de apartar la compra. Si no sirve, mensaje neutro.
      const quien: Quien = { telefono, correo, ip: ipDe(req) };
      const revision = await revisarCodigo(b.codigo, quien);
      if (revision && "error" in revision) return json({ error: revision.error, campo: "codigo" }, 400);
      const cod = revision?.codigo ?? null;
      const precioFinal = cod ? precioConCodigo(precio, cod) : precio;
      const conCodigo = { codigo: cod?.codigo ?? null, descuento_mxn: cod ? redondear(precio - precioFinal) : null };
      // Si ya hay una compra pendiente de esta misma guía y familia (últimas 2 h), se reutiliza.
      const { data: pendiente } = await supabase.from("compras").select("*").eq("guia_id", guia.id).eq("telefono", telefono).eq("estado", "pendiente").gte("creada_en", new Date(Date.now() - 2 * 3600 * 1000).toISOString()).order("creada_en", { ascending: false }).limit(1).maybeSingle();
      let compra = pendiente;
      if (!compra) {
        const { data: c, error: e } = await supabase.from("compras").insert({ guia_id: guia.id, borrador_id: borrador?.id ?? null, monto_mxn: precioFinal, ...conCodigo, estado: "pendiente", nombre, telefono, correo, colegio_texto: borrador?.colegio_texto ?? (guia as any).colegios?.nombre ?? null, grado: guia.grado, materia: guia.materia, titulo: guia.titulo }).select("*").single();
        if (e) throw e; compra = c;
      } else if (Number(compra.monto_mxn) !== precioFinal || (compra.codigo ?? null) !== conCodigo.codigo) {
        // Una compra apartada lleva el precio de hoy y el código que se escribió esta vez (o ninguno).
        await supabase.from("compras").update({ monto_mxn: precioFinal, ...conCodigo }).eq("id", compra.id);
        Object.assign(compra, { monto_mxn: precioFinal, ...conCodigo });
      }
      if (borrador) await supabase.from("borradores").update({ nombre, telefono, correo }).eq("id", borrador.id);
      // Código gratis: no hay nada que cobrar; la guía se entrega en este momento.
      if (cod && precioFinal <= 0) return await entregarConCodigo(compra, cod, quien, precio);
      if (cod) await anotarIntento({ codigo: cod.codigo, codigo_id: cod.id, telefono, correo, ip: quien.ip, resultado: "ok", compra_id: compra.id });
      let mpFallo = false;
      if (mpToken()) {
        // Cobro con Mercado Pago (tarjeta, OXXO y SPEI). Manda sobre Stripe, que queda dormido.
        try {
          const pref = await crearPreferenciaMP(compra, guia.titulo ?? "Guía", precioFinal);
          await supabase.from("compras").update({ mp_preferencia_id: pref.id, mp_actualizado_en: ahora() }).eq("id", compra.id);
          await guardarBorradorMientrasPaga(borrador?.id);
          return json({ modo: "mercadopago", url: pref.url, compra_id: compra.id });
        } catch (e) {
          // Si Mercado Pago no responde, la venta no se pierde: la compra queda apartada en modo manual.
          console.error("Mercado Pago no respondió; la compra queda en modo manual:", (e as Error).message);
          mpFallo = true;
        }
      } else if (Deno.env.get("STRIPE_SECRET_KEY")) {
        const s = await crearSesionStripe(compra, guia.titulo ?? "Guía", precioFinal);
        await supabase.from("compras").update({ stripe_session_id: s.id }).eq("id", compra.id);
        return json({ modo: "stripe", url: s.url, compra_id: compra.id });
      }
      // Motor en blanco (o Mercado Pago sin responder): la compra queda apartada y se confirma a mano desde el panel.
      const folio = String(compra.id).slice(0, 8).toUpperCase();
      const wa = cfg.sparked_whatsapp.replace(/\D/g, "");
      const whatsapp = wa.length >= 10 ? `https://wa.me/${wa.length === 10 ? "52" + wa : wa}?text=${encodeURIComponent(`Hola, quiero confirmar mi compra de la guía "${guia.titulo ?? ""}" (folio ${folio}). Soy ${nombre}.`)}` : null;
      const mensaje = mpFallo
        ? `En este momento el pago en línea no respondió. Tu guía quedó apartada: ${whatsapp ? "escríbenos por WhatsApp para completar tu compra" : "te contactamos para completar tu compra"}. En cuanto se confirme el pago, tu link aparece aquí y te llega al correo ${correo}.`
        : `Tu guía quedó apartada. El pago en línea se está configurando: en cuanto lo confirmemos ${whatsapp ? "por WhatsApp" : "contigo"}, tu link aparece aquí y te llega al correo ${correo}.`;
      return json({ modo: "manual", compra_id: compra.id, folio, precio: precioFinal, mensaje, whatsapp });
    }

    if (r0 === "pago" && r1 === "estado" && esUuid(r2) && m === "GET") {
      const columnas = "id, estado, titulo, correo, telefono, acceso_id, guia_id, pagada_en, entregada_en, monto_mxn, mp_preferencia_id, mp_estado, metodo_pago, mp_ficha_url, mp_vence_en";
      let { data: c } = await supabase.from("compras").select(columnas).eq("id", r2).maybeSingle();
      if (!c) return error("Esa compra no existe", 404);
      // Mercado Pago: si su aviso todavía no llega, se le pregunta directo (máximo una vez cada 20 s por compra).
      if (c.estado !== "pagada" && c.mp_preferencia_id && mpToken() && tocaRevisarMP(c.id)) {
        try { if (await revisarCompraMP(c.id, url.searchParams.get("pago"))) c = (await supabase.from("compras").select(columnas).eq("id", r2).maybeSingle()).data ?? c; }
        catch (e) { console.warn("No se pudo revisar el pago en Mercado Pago:", (e as Error).message); }
      }
      const out: Record<string, unknown> = { estado: c.estado, titulo: c.titulo, correo: c.correo, telefono: c.telefono, pagada_en: c.pagada_en, folio: String(c.id).slice(0, 8).toUpperCase() };
      // Para que el sitio muestre la instrucción adecuada (OXXO, SPEI o tarjeta en revisión).
      if (c.mp_preferencia_id || c.metodo_pago) Object.assign(out, { metodo: c.metodo_pago, pago_mp: c.mp_estado, ficha_url: c.mp_ficha_url, vence_en: c.mp_vence_en });
      if (c.estado === "pagada") {
        let acceso = c.acceso_id ? (await supabase.from("accesos").select("token, expira_en").eq("id", c.acceso_id).maybeSingle()).data : null;
        // Si el link no existe (la entrega se interrumpió), se crea aquí. Se esperan 30 s desde el pago para no
        // duplicarlo mientras la entrega original (aviso de pago o panel) sigue en curso.
        let entregada = !!c.entregada_en, problemas = false;
        if (!acceso && Date.now() - new Date(c.pagada_en ?? 0).getTime() > 30_000) { const e = await entregar(c); acceso = { token: e.token, expira_en: e.expira_en }; entregada = e.lista; }
        if (acceso && !entregada) {
          // La guía ya quedó completa pero la entrega no ha salido (por ejemplo, se interrumpió): se hace aquí.
          const { data: g } = await supabase.from("guias").select("completo:cartucho->completo").eq("id", c.guia_id).maybeSingle();
          if (g?.completo === true) { const r = await entregarGuiaLista(c.id); entregada = r.entregada; problemas = !!r.problemas?.length; }
        }
        out.guia_lista = entregada;
        if (acceso && entregada) {
          // Solo con la guía 100 % completa y verificada: el link (la fecha de fin puede haber cambiado al entregar).
          const a = (await supabase.from("accesos").select("token, expira_en").eq("id", c.acceso_id ?? "").maybeSingle()).data ?? acceso;
          out.link = linkDe(await sitio(), a.token); out.token = a.token; out.expira_en = a.expira_en;
        } else if (c.acceso_id || acceso) {
          // Todavía no: avance y tiempo estimado; si la generación falló, "revisando" (Daniel ya recibió el aviso).
          const av = await avanceDeGuia(c.guia_id, new Date(c.pagada_en ?? 0).getTime());
          const pct = Math.max(0, Math.min(100, Number(av.avance?.pct ?? 42) || 42));
          out.progreso = av.avance; out.revision = av.revision || problemas;
          out.estimado_seg = out.revision ? null : Math.max(20, Math.round(((100 - pct) / 58) * 240));
        }
      }
      return json(out);
    }

    // Otro intento con Mercado Pago para una compra que sigue pendiente (por ejemplo, después de una tarjeta rechazada).
    if (r0 === "pago" && r1 === "reintentar" && esUuid(r2) && m === "POST") {
      if (!mpToken()) return error("El pago en línea no está disponible en este momento. Escríbenos por WhatsApp para completar tu compra.", 503);
      const { data: c } = await supabase.from("compras").select("*").eq("id", r2).maybeSingle();
      if (!c) return error("Esa compra no existe", 404);
      if (c.estado === "pagada") return json({ modo: "pagada", compra_id: c.id });
      if (c.estado !== "pendiente" || !c.guia_id) return error("Esta compra ya no está activa. Vuelve a pedir tu guía desde la página principal.");
      // Con código de descuento se conserva el precio ya descontado; sin código, el precio de hoy.
      const precio = c.codigo ? Number(c.monto_mxn) : Number((await config()).sparked_precio) || 100;
      if (Number(c.monto_mxn) !== precio) { await supabase.from("compras").update({ monto_mxn: precio }).eq("id", c.id); c.monto_mxn = precio; }
      const pref = await crearPreferenciaMP(c, c.titulo ?? "Guía", precio);
      await supabase.from("compras").update({ mp_preferencia_id: pref.id, mp_actualizado_en: ahora() }).eq("id", c.id);
      await guardarBorradorMientrasPaga(c.borrador_id);
      return json({ modo: "mercadopago", url: pref.url, compra_id: c.id });
    }

    if (r0 === "pago" && r1 === "mercadopago" && m === "POST") return await avisoMercadoPago(req, url);

    if (r0 === "pago" && r1 === "webhook" && m === "POST") {
      const secreto = Deno.env.get("STRIPE_WEBHOOK_SECRET");
      if (!secreto) return error("El motor de pagos aún no está configurado", 503);
      const cuerpo = await req.text();
      if (!(await firmaStripeValida(cuerpo, req.headers.get("stripe-signature"), secreto))) return error("Firma no válida", 400);
      const ev = JSON.parse(cuerpo);
      if (["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(ev.type)) {
        const s = ev.data?.object ?? {};
        const compraId = s.metadata?.compra_id;
        if (esUuid(compraId) && (s.payment_status === "paid" || ev.type === "checkout.session.async_payment_succeeded")) await confirmarPago(compraId, { stripe_session_id: s.id, monto: s.amount_total ? s.amount_total / 100 : undefined });
      }
      return json({ received: true });
    }

    // ---------- Acceso al reproductor ----------
    // El reproductor pregunta (sin gastar el acceso) si la guía que se está terminando ya quedó completa.
    if (r0 === "acceso" && esToken(r1) && r2 === "estado" && m === "GET") {
      const { data: a } = await supabase.from("accesos").select("clase_id, creado_en").eq("token", r1).maybeSingle();
      const { data: g } = a ? await supabase.from("guias").select("id, completo:cartucho->completo").eq("clase_id", a.clase_id).maybeSingle() : { data: null };
      if (!a || !g) return json({ estado: "inexistente" }, 404);
      if (g.completo === true) return json({ completo: true });
      return json({ completo: false, ...(await avanceDeGuia(g.id, new Date(a.creado_en).getTime())) });
    }

    if (r0 === "acceso" && esToken(r1) && m === "POST") {
      const b = await leerJson(req);
      const { data: a } = await supabase.from("accesos").select("id, clase_id, alumno, expira_en, creado_en").eq("token", r1).maybeSingle();
      if (!a) return json({ estado: "inexistente" }, 404);
      const { data: cl } = await supabase.from("clases").select("id, tipo").eq("id", a.clase_id).maybeSingle();
      if (!cl || cl.tipo !== "guia") return json({ estado: "inexistente" }, 404);
      const { data: g } = await supabase.from("guias").select("id, titulo, estado, completo:cartucho->completo").eq("clase_id", cl.id).maybeSingle();
      if (!g) return json({ estado: "inexistente" }, 404);
      // Red de seguridad: el link solo se entrega con la guía completa, pero si alguien lo abre antes de tiempo ve el
      // avance, o "revisando" si el trabajo falló. (El ajuste sparked_jugar_durante_generacion ya no se usa.)
      const enEspera = (p: { revision: boolean; avance: any }) => p.revision ? json({ estado: "revisando", titulo: g.titulo, avance: p.avance }) : json({ estado: "generando", progreso: p.avance, titulo: g.titulo }, 202);
      if (g.completo !== true) return enEspera(await avanceDeGuia(g.id, new Date(a.creado_en).getTime()));
      const dispositivo = esSecreto(b.dispositivo) ? b.dispositivo : nuevoToken(32);
      const { data: res, error: e } = await supabase.rpc("consumir_acceso", { p_token: r1, p_ip: ipDe(req), p_ua: (req.headers.get("user-agent") ?? "").slice(0, 300), p_dispositivo: dispositivo });
      if (e) throw e;
      const r = (res?.[0] ?? { estado: "inexistente" }) as { estado: string };
      if (r.estado !== "ok") return json({ estado: r.estado, dispositivo: null }, 403);
      const [{ data: full }, { data: prog }] = await Promise.all([
        supabase.from("guias").select("cartucho").eq("id", g.id).maybeSingle(),
        supabase.from("progreso").select("datos").eq("acceso_id", a.id).eq("dispositivo_sha256", await sha256hex(dispositivo)).maybeSingle(),
      ]);
      return json({ estado: "ok", cartucho: full?.cartucho, guia_id: g.id, dispositivo, progreso: prog?.datos ?? null, expira_en: a.expira_en, alumno: a.alumno && !/^#\d+$/.test(a.alumno) ? a.alumno : null });
    }

    if (r0 === "progreso" && esToken(r1) && m === "POST") {
      const b = await leerJson(req);
      if (!esSecreto(b.dispositivo) || typeof b.datos !== "object" || JSON.stringify(b.datos ?? {}).length > 40_000) return error("Datos no válidos");
      const { data: a } = await supabase.from("accesos").select("id").eq("token", r1).maybeSingle();
      if (!a) return error("No existe", 404);
      const hash = await sha256hex(b.dispositivo);
      const { data: d } = await supabase.from("acceso_dispositivos").select("acceso_id").eq("acceso_id", a.id).eq("dispositivo_sha256", hash).maybeSingle();
      if (!d) return error("Aparato no registrado", 403);
      const { error: e } = await supabase.from("progreso").upsert({ acceso_id: a.id, dispositivo_sha256: hash, datos: b.datos, actualizado_en: ahora() });
      if (e) throw e;
      return json({ ok: true });
    }

    if (r0 === "reporte" && m === "POST") {
      const b = await leerJson(req);
      const comentario = texto(b.comentario, 500);
      if (!comentario) return error("Escribe qué estaba mal.");
      let accesoId: string | null = null;
      if (esToken(b.token)) { const { data: a } = await supabase.from("accesos").select("id").eq("token", b.token).maybeSingle(); accesoId = a?.id ?? null; }
      const { error: e } = await supabase.from("reportes").insert({ acceso_id: accesoId, guia_id: esUuid(b.guia_id) ? b.guia_id : null, slide: Number.isFinite(Number(b.slide)) ? Number(b.slide) : null, comentario });
      if (e) throw e;
      return json({ ok: true });
    }

    if (r0 === "datos-curiosos" && m === "GET") {
      const { data } = await supabase.from("datos_curiosos").select("texto, nivel, categoria, emoji, fuente").eq("estado", "publicado").limit(200);
      return json({ datos: data ?? [] });
    }

    // ---------- Administración ----------
    if (r0 === "admin") {
      if (!(await autorizado(req))) return error("Clave de administrador incorrecta", 401);
      const rec = r1, id = r2, accion = ruta[3];
      const base = await sitio();

      if (rec === "ping") {
        const cfg = await config();
        return json({ ok: true, version: VERSION, sitio: base, motores: { ia: !!Deno.env.get("ANTHROPIC_API_KEY"), whatsapp: motorWhatsApp(), mercadopago: !!Deno.env.get("MP_ACCESS_TOKEN"), mercadopago_webhook: !!Deno.env.get("MP_WEBHOOK_SECRET"), mercadopago_prueba: mpPrueba(), stripe: !!Deno.env.get("STRIPE_SECRET_KEY"), webhook: !!Deno.env.get("STRIPE_WEBHOOK_SECRET"), correo: !!Deno.env.get("RESEND_API_KEY"), helicone: !!Deno.env.get("HELICONE_API_KEY") }, config: cfg });
      }
      if (rec === "config" && m === "POST") {
        const b = await leerJson(req);
        const filas = Object.keys(CONFIG_DEF).filter((k) => typeof b[k] === "string").map((k) => ({ clave: k, valor: String(b[k]).trim() }));
        if (!filas.length) return error("Nada que guardar");
        const { error: e } = await supabase.from("config").upsert(filas); if (e) throw e;
        configCache = null;
        return json({ ok: true, config: await config() });
      }
      if (rec === "resumen" && m === "GET") {
        const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
        const mes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString();
        const [guias, compras, solicitudes, reportes, trabajos, borradores, fallidos] = await Promise.all([
          supabase.from("guias").select("estado, origen"),
          supabase.from("compras").select("estado, monto_mxn, pagada_en, creada_en, metodo_pago").gte("creada_en", new Date(Date.now() - 45 * 86400 * 1000).toISOString()),
          supabase.from("solicitudes").select("id", { count: "exact", head: true }).eq("estado", "sin_guia"),
          supabase.from("reportes").select("id", { count: "exact", head: true }).eq("estado", "nuevo"),
          supabase.from("trabajos").select("estado, costo_usd, creado_en").gte("creado_en", mes),
          supabase.from("borradores").select("id", { count: "exact", head: true }).in("estado", ["generando", "vista_previa"]),
          supabase.from("trabajos").select("id, guia_id, paso, error, actualizado_en").eq("alcance", "resto").eq("estado", "error").order("actualizado_en", { ascending: false }).limit(20),
        ]);
        const cuenta = (arr: any[], f: (x: any) => boolean) => arr.filter(f).length;
        const suma = (arr: any[], f: (x: any) => boolean) => arr.filter(f).reduce((n, x) => n + Number(x.monto_mxn ?? 0), 0);
        const C = compras.data ?? [], T = trabajos.data ?? [], G = guias.data ?? [];
        // Las guías con código gratis no son ventas ni ingresos: se cuentan aparte.
        const venta = (c: any) => c.estado === "pagada" && c.metodo_pago !== "codigo";
        const gratis = (c: any) => c.estado === "pagada" && c.metodo_pago === "codigo";
        const hoyIso = hoy.toISOString();
        // Guías pagadas cuyo trabajo "resto" falló y siguen sin terminar (aviso en el Resumen del panel).
        const F = fallidos.data ?? [];
        const { data: gF } = F.length ? await supabase.from("guias").select("id, titulo, completo:cartucho->completo").in("id", F.map((t) => t.guia_id).filter(Boolean)) : { data: [] as any[] };
        const entregasConError = F.map((t) => ({ t, g: (gF ?? []).find((x: any) => x.id === t.guia_id) })).filter(({ g }) => g && g.completo !== true).map(({ t, g }) => ({ trabajo_id: t.id, guia_id: t.guia_id, titulo: g.titulo, paso: t.paso, error: t.error, desde: t.actualizado_en }));
        return json({
          guias: { publicadas: cuenta(G, (g) => g.estado === "publicada" && g.origen === "biblioteca"), borradores: cuenta(G, (g) => g.estado === "borrador" && g.origen === "biblioteca"), personalizadas: cuenta(G, (g) => g.origen === "personalizada" && g.estado !== "archivada"), archivadas: cuenta(G, (g) => g.estado === "archivada") },
          compras: { pendientes: cuenta(C, (c) => c.estado === "pendiente"), pagadas_hoy: cuenta(C, (c) => venta(c) && c.pagada_en >= hoyIso), ingresos_hoy: suma(C, (c) => venta(c) && c.pagada_en >= hoyIso), pagadas_mes: cuenta(C, (c) => venta(c) && c.pagada_en >= mes), ingresos_mes: suma(C, (c) => venta(c) && c.pagada_en >= mes), con_codigo_hoy: cuenta(C, (c) => gratis(c) && c.pagada_en >= hoyIso), con_codigo_mes: cuenta(C, (c) => gratis(c) && c.pagada_en >= mes) },
          entregas_con_error: entregasConError,
          solicitudes_sin_guia: solicitudes.count ?? 0, reportes_nuevos: reportes.count ?? 0, borradores_activos: borradores.count ?? 0,
          ia: { trabajos_mes: T.length, corriendo: cuenta(T, (t) => ["pendiente", "corriendo"].includes(t.estado)), errores: cuenta(T, (t) => t.estado === "error"), costo_usd_mes: T.reduce((n, t) => n + Number(t.costo_usd ?? 0), 0) },
        });
      }

      if (rec === "colegios") {
        if (m === "GET") { const { data } = await supabase.from("colegios").select("*").order("orden").order("nombre"); return json(data ?? []); }
        if (m === "POST") { const nombre = texto((await leerJson(req)).nombre, 80); if (!nombre) return error("Falta el nombre"); const { data, error: e } = await supabase.from("colegios").insert({ nombre }).select().single(); if (e) throw e; return json(data, 201); }
        if (m === "PATCH" && esUuid(id)) { const b = await leerJson(req); const cambios: Record<string, unknown> = {}; if (typeof b.nombre === "string" && texto(b.nombre, 80)) cambios.nombre = texto(b.nombre, 80); if (typeof b.activo === "boolean") cambios.activo = b.activo; if (Number.isFinite(Number(b.orden))) cambios.orden = Number(b.orden); const { data, error: e } = await supabase.from("colegios").update(cambios).eq("id", id).select().single(); if (e) throw e; return json(data); }
      }

      if (rec === "guias" && !id && m === "GET") {
        const estado = url.searchParams.get("estado");
        let q = supabase.from("guias").select("id, estado, origen, titulo, colegio_id, grado, materia, examen, fecha_examen, version, creada_en, publicada_en, archivada_en, borrar_en, costo_mxn, borrador_id, clase_id, idioma, paleta, completo:cartucho->completo, colegios(nombre)").order("creada_en", { ascending: false }).limit(300);
        if (estado) q = q.eq("estado", estado);
        const { data, error: e } = await q; if (e) throw e;
        const ids = (data ?? []).map((g) => g.id);
        const { data: comp } = ids.length ? await supabase.from("compras").select("guia_id, estado, metodo_pago").in("guia_id", ids) : { data: [] };
        const { data: trab } = ids.length ? await supabase.from("trabajos").select("id, guia_id, borrador_id, estado, progreso, alcance, costo_usd, actualizado_en").order("creado_en", { ascending: false }).limit(400) : { data: [] };
        return json((data ?? []).map((g) => {
          const t = (trab ?? []).find((x) => x.guia_id === g.id || (g.borrador_id && x.borrador_id === g.borrador_id));
          return { ...g, colegio: (g as any).colegios?.nombre ?? null, colegios: undefined, compras_pagadas: (comp ?? []).filter((c) => c.guia_id === g.id && c.estado === "pagada" && c.metodo_pago !== "codigo").length, compras_codigo: (comp ?? []).filter((c) => c.guia_id === g.id && c.estado === "pagada" && c.metodo_pago === "codigo").length, compras_pendientes: (comp ?? []).filter((c) => c.guia_id === g.id && c.estado === "pendiente").length, trabajo: t ? { id: t.id, estado: t.estado, progreso: t.progreso, alcance: t.alcance, actualizado_en: t.actualizado_en } : null };
        }));
      }
      if (rec === "guias" && !id && m === "POST") {
        const b = await leerJson(req);
        const titulo = texto(b.titulo, 120), grado = texto(b.grado, 60), materia = texto(b.materia, 60);
        if (!grado || !materia) return error("Faltan grado y materia");
        const paginas = b.paginas ? validarPaginas(b.paginas) : [];
        if (typeof paginas === "string") return error(paginas);
        const colegioId = esUuid(b.colegio_id) ? b.colegio_id : null;
        const bid = crypto.randomUUID(); const clave = nuevoToken(24);
        const archivos = paginas.map((p, k) => ({ ruta: `biblioteca/${bid}/${k + 1}.jpg`, nombre: p.nombre, tipo: p.tipo, tamano: p.tamano }));
        let colegioTexto: string | null = null;
        if (colegioId) { const { data: c } = await supabase.from("colegios").select("nombre").eq("id", colegioId).maybeSingle(); colegioTexto = c?.nombre ?? null; }
        const { error: eb } = await supabase.from("borradores").insert({ id: bid, clave, servicio: 1, colegio_id: colegioId, colegio_texto: colegioTexto, grado, materia, paginas: archivos.length, archivos, estado: "subiendo", expira_en: enDias(365) });
        if (eb) throw eb;
        const { data: g, error: eg } = await supabase.from("guias").insert({ estado: "borrador", origen: "biblioteca", titulo: titulo || `${materia} · ${grado}`, colegio_id: colegioId, grado, materia, examen: texto(b.examen, 80) || null, fecha_examen: b.fecha_examen || null, borrador_id: bid }).select("id").single();
        if (eg) throw eg;
        await supabase.from("borradores").update({ guia_id: g.id }).eq("id", bid);
        return json({ guia_id: g.id, clave, subidas: archivos.length ? await urlsDeSubida(archivos) : [] }, 201);
      }
      if (rec === "guias" && esUuid(id) && !accion && m === "GET") {
        const { data: g, error: e } = await supabase.from("guias").select("*, colegios(nombre)").eq("id", id).maybeSingle(); if (e) throw e;
        if (!g) return error("No existe", 404);
        const { data: t } = await supabase.from("trabajos").select("id, estado, paso, alcance, progreso, error, intentos, costo_usd, tokens_entrada, tokens_salida, creado_en, actualizado_en").or(`guia_id.eq.${id}${g.borrador_id ? `,borrador_id.eq.${g.borrador_id}` : ""}`).order("creado_en", { ascending: false }).limit(5);
        const { data: comp } = await supabase.from("compras").select("id, estado, nombre, telefono, correo, pagada_en, creada_en, monto_mxn, metodo_pago, codigo").eq("guia_id", id).order("creada_en", { ascending: false });
        const { data: bo } = g.borrador_id ? await supabase.from("borradores").select("id, clave, estado, paginas, archivos, colegio_texto").eq("id", g.borrador_id).maybeSingle() : { data: null };
        const { cartucho, ...resto } = g as any;
        return json({ ...resto, colegio: (g as any).colegios?.nombre ?? null, colegios: undefined, completo: cartucho?.completo === true, bloques: cartucho?.bloques?.length ?? 0, actividades: (cartucho?.bloques ?? []).reduce((n: number, b: any) => n + (b.actividades?.length ?? 0) + (b.mini_examen?.length ?? 0), 0), trabajos: t ?? [], compras: comp ?? [], borrador: bo });
      }
      if (rec === "guias" && esUuid(id) && accion === "cartucho" && m === "GET") {
        const { data: g } = await supabase.from("guias").select("cartucho").eq("id", id).maybeSingle();
        if (!g?.cartucho) return error("Esa guía no tiene cartucho", 404);
        return json({ cartucho: g.cartucho });
      }
      if (rec === "guias" && esUuid(id) && accion === "cartucho" && m === "POST") {
        const b = await leerJson(req);
        let c: any; try { c = normalizarCartucho(typeof b.cartucho === "string" ? JSON.parse(b.cartucho) : b.cartucho); } catch (e2) { return error("Cartucho no válido: " + (e2 as Error).message); }
        const { data: g } = await supabase.from("guias").select("titulo").eq("id", id).maybeSingle();
        if (!g) return error("No existe", 404);
        const cambios: Record<string, unknown> = { cartucho: c, vista_previa: recortarVistaPrevia(c), idioma: c.plan.idioma_guia ?? "es", perfil_edad: c.plan.perfil_edad ?? null, paleta: c.plan.identidad?.paleta ?? null, version: 1 };
        if (!g.titulo && c.plan.identidad?.titulo) cambios.titulo = texto(c.plan.identidad.titulo, 120);
        const { error: e } = await supabase.from("guias").update(cambios).eq("id", id); if (e) throw e;
        // Si había compras pagadas esperando esta guía, se entregan ahora (si pasa la verificación final).
        await entregarPendientes(id);
        return json({ ok: true, bloques: c.bloques.length, problemas: verificarCartucho(c) });
      }
      if (rec === "guias" && esUuid(id) && (accion === "generar" || accion === "regenerar") && m === "POST") {
        const { data: g } = await supabase.from("guias").select("id, borrador_id, estado").eq("id", id).maybeSingle();
        if (!g?.borrador_id) return error("Esta guía no tiene materiales subidos", 400);
        const { data: bo } = await supabase.from("borradores").select("*").eq("id", g.borrador_id).maybeSingle();
        if (!bo) return error("No existe el material", 404);
        const subidos = await archivosSubidos(`biblioteca/${bo.id}`);
        const archivos = (bo.archivos as any[]).filter((a) => subidos.has(a.ruta));
        if (!archivos.length) return error("No hay páginas subidas todavía");
        const { data: enCurso } = await supabase.from("trabajos").select("id").eq("guia_id", id).in("estado", ["pendiente", "corriendo"]).limit(1);
        if (enCurso?.length) return error("Ya hay una generación en curso para esta guía");
        const idiomaG = idiomaValido((await leerJson(req)).idioma);
        const { data: t, error: e } = await supabase.from("trabajos").insert({ tipo: "generar", borrador_id: bo.id, guia_id: id, alcance: "completa", paso: "inicio", estado: "pendiente", datos: idiomaG ? { opciones: { idioma_guia: idiomaG } } : {}, progreso: { pct: 1, mensaje: "Preparando las páginas 📖", paso: "inicio" } }).select("id").single();
        if (e) throw e;
        await supabase.from("borradores").update({ estado: "generando", trabajo_id: t.id, archivos, paginas: archivos.length }).eq("id", bo.id);
        disparar(t.id);
        return json({ ok: true, trabajo_id: t.id }, 202);
      }
      if (rec === "guias" && esUuid(id) && accion === "materiales" && m === "POST") {
        // Agregar o reemplazar páginas de una guía de biblioteca: devuelve URLs de subida.
        const b = await leerJson(req);
        const paginas = validarPaginas(b.paginas); if (typeof paginas === "string") return error(paginas);
        const { data: g } = await supabase.from("guias").select("borrador_id").eq("id", id).maybeSingle();
        if (!g?.borrador_id) return error("No existe", 404);
        await borrarCarpeta(`biblioteca/${g.borrador_id}`);
        const archivos = paginas.map((p, k) => ({ ruta: `biblioteca/${g.borrador_id}/${k + 1}.jpg`, nombre: p.nombre, tipo: p.tipo, tamano: p.tamano }));
        await supabase.from("borradores").update({ archivos, paginas: archivos.length, estado: "subiendo" }).eq("id", g.borrador_id);
        return json({ subidas: await urlsDeSubida(archivos) });
      }
      if (rec === "guias" && esUuid(id) && !accion && m === "PATCH") {
        const b = await leerJson(req); const cambios: Record<string, unknown> = {};
        if (typeof b.titulo === "string") cambios.titulo = texto(b.titulo, 120);
        if (typeof b.examen === "string") cambios.examen = texto(b.examen, 80) || null;
        if ("fecha_examen" in b) cambios.fecha_examen = b.fecha_examen || null;
        if (typeof b.grado === "string" && texto(b.grado, 60)) cambios.grado = texto(b.grado, 60);
        if (typeof b.materia === "string" && texto(b.materia, 60)) cambios.materia = texto(b.materia, 60);
        if ("colegio_id" in b) cambios.colegio_id = esUuid(b.colegio_id) ? b.colegio_id : null;
        if (!Object.keys(cambios).length) return error("Nada que cambiar");
        const { data, error: e } = await supabase.from("guias").update(cambios).eq("id", id).select("id, titulo, examen, fecha_examen, grado, materia, colegio_id").single(); if (e) throw e;
        return json(data);
      }
      if (rec === "guias" && esUuid(id) && accion === "publicar" && m === "POST") {
        const { data: g } = await supabase.from("guias").select("id, colegio_id, grado, materia, completo:cartucho->completo").eq("id", id).maybeSingle();
        if (!g) return error("No existe", 404);
        if (g.completo !== true) return error("La guía todavía no tiene su cartucho completo");
        const { error: e } = await supabase.from("guias").update({ estado: "publicada", publicada_en: ahora(), archivada_en: null }).eq("id", id); if (e) throw e;
        // Quién la pidió sin que existiera: se marcan para avisarles.
        let q = supabase.from("solicitudes").select("id, nombre, telefono, correo, colegio_texto").eq("estado", "sin_guia").ilike("grado", g.grado ?? "").ilike("materia", g.materia ?? "");
        if (g.colegio_id) q = q.or(`colegio_id.eq.${g.colegio_id},colegio_id.is.null`);
        const { data: sol } = await q;
        if (sol?.length) await supabase.from("solicitudes").update({ estado: "convertida", guia_id: id }).in("id", sol.map((s) => s.id));
        return json({ ok: true, avisar: sol ?? [] });
      }
      if (rec === "guias" && esUuid(id) && accion === "archivar" && m === "POST") {
        const { error: e } = await supabase.from("guias").update({ estado: "archivada", archivada_en: ahora() }).eq("id", id); if (e) throw e;
        return json({ ok: true });
      }
      if (rec === "guias" && esUuid(id) && !accion && m === "DELETE") {
        const { count } = await supabase.from("compras").select("id", { count: "exact", head: true }).eq("guia_id", id).eq("estado", "pagada");
        if (count) return error("Esta guía tiene compras pagadas: archívala en vez de borrarla");
        const { data: g } = await supabase.from("guias").select("borrador_id, origen").eq("id", id).maybeSingle();
        if (g?.borrador_id) { await borrarCarpeta(`${g.origen === "biblioteca" ? "biblioteca" : "borradores"}/${g.borrador_id}`); await supabase.from("borradores").delete().eq("id", g.borrador_id); }
        const { error: e } = await supabase.from("guias").delete().eq("id", id); if (e) throw e;
        return json({ ok: true });
      }

      if (rec === "solicitudes" && m === "GET") {
        const { data, error: e } = await supabase.from("solicitudes").select("*, colegios(nombre)").order("creada_en", { ascending: false }).limit(300); if (e) throw e;
        return json((data ?? []).map((s) => ({ ...s, colegio: (s as any).colegios?.nombre ?? s.colegio_texto ?? null, colegios: undefined })));
      }
      if (rec === "solicitudes" && esUuid(id) && m === "PATCH") {
        const b = await leerJson(req); const estado = ["sin_guia", "avisada", "convertida"].includes(b.estado) ? b.estado : null;
        if (!estado) return error("Estado no válido");
        const { error: e } = await supabase.from("solicitudes").update({ estado }).eq("id", id); if (e) throw e;
        return json({ ok: true });
      }

      if (rec === "compras" && !id && m === "GET") {
        const estado = url.searchParams.get("estado");
        let q = supabase.from("compras").select("*").order("creada_en", { ascending: false }).limit(300);
        if (estado) q = q.eq("estado", estado);
        const { data, error: e } = await q; if (e) throw e;
        const ids = (data ?? []).map((c) => c.acceso_id).filter(Boolean);
        const { data: acc } = ids.length ? await supabase.from("accesos_vista").select("id, token, estado, expira_en, usos, dispositivos, max_dispositivos, primer_uso_en, ultimo_uso_en").in("id", ids) : { data: [] };
        const gids = [...new Set((data ?? []).map((c) => c.guia_id).filter(Boolean))];
        const { data: gs } = gids.length ? await supabase.from("guias").select("id, completo:cartucho->completo").in("id", gids) : { data: [] as any[] };
        const completas = new Set((gs ?? []).filter((g: any) => g.completo === true).map((g: any) => g.id));
        // guia_lista = la guía está 100 % completa; entregada_en = cuándo se le mandó a la familia (link, correo y WhatsApp).
        return json((data ?? []).map((c) => { const a = (acc ?? []).find((x) => x.id === c.acceso_id); return { ...c, folio: String(c.id).slice(0, 8).toUpperCase(), guia_lista: completas.has(c.guia_id), entregada_en: c.entregada_en ?? null, link: a ? linkDe(base, a.token) : null, acceso: a ? { estado: a.estado, expira_en: a.expira_en, usos: a.usos, dispositivos: a.dispositivos ?? 0, max_dispositivos: a.max_dispositivos ?? null, primer_uso_en: a.primer_uso_en ?? null, ultimo_uso_en: a.ultimo_uso_en ?? null } : null }; }));
      }
      if (rec === "compras" && esUuid(id) && accion === "pagar" && m === "POST") {
        const r = await confirmarPago(id, { manual: true });
        return json({ ok: true, compra: r.compra, link: r.link, token: r.token, expira_en: r.expira_en, lista: r.lista });
      }
      if (rec === "compras" && esUuid(id) && accion === "revisar" && m === "POST") {
        // Botón del panel: pregunta a Mercado Pago por los pagos de esta compra y aplica lo que encuentre.
        if (!mpToken()) return error("Mercado Pago no está encendido (falta MP_ACCESS_TOKEN)");
        const resultado = await revisarCompraMP(id);
        const { data: c } = await supabase.from("compras").select("*").eq("id", id).maybeSingle();
        return json({ ok: true, resultado: resultado ?? "sin_pagos", compra: c });
      }
      if (rec === "compras" && esUuid(id) && accion === "cancelar" && m === "POST") {
        const { error: e } = await supabase.from("compras").update({ estado: "fallida" }).eq("id", id).eq("estado", "pendiente"); if (e) throw e;
        return json({ ok: true });
      }
      if (rec === "compras" && esUuid(id) && accion === "reenviar" && m === "POST") {
        const { data: c } = await supabase.from("compras").select("*").eq("id", id).maybeSingle();
        if (!c || c.estado !== "pagada") return error("La compra no está pagada");
        const e = await entregar(c);
        if (!e.lista) return error("La guía todavía no está completa y verificada. Se entrega sola (correo y WhatsApp) en cuanto lo esté.", 409);
        if (!e.recien) await enviarCorreo(c, c.titulo ?? "Tu guía", e.link, e.expira_en);
        return json({ ok: true, link: e.link });
      }

      // ---------- Códigos de descuento ----------
      if (rec === "codigos" && !id && m === "GET") {
        const [{ data: cods, error: e }, { data: ints }] = await Promise.all([
          supabase.from("codigos").select("*").order("creado_en", { ascending: false }).limit(300),
          supabase.from("codigo_intentos").select("id, codigo, resultado, telefono, correo, ip, compra_id, creado_en").order("creado_en", { ascending: false }).limit(60),
        ]);
        if (e) throw e;
        return json({ codigos: cods ?? [], intentos: ints ?? [] });
      }
      if (rec === "codigos" && !id && m === "POST") {
        const b = await leerJson(req);
        const codigo = normalizarCodigo(b.codigo);
        if (!formatoCodigo(codigo)) return error("El código debe tener de 3 a 40 letras o números, sin espacios (puede llevar guion).");
        const tipo = b.tipo === "porcentaje" ? "porcentaje" : "gratis";
        const valor = tipo === "gratis" ? 100 : Number(b.valor);
        if (!(valor >= 1 && valor <= 100)) return error("El descuento debe ser de 1 a 100 %.");
        const usosMax = b.usos_max === null || b.usos_max === undefined || String(b.usos_max).trim() === "" ? null : Math.floor(Number(b.usos_max));
        if (usosMax !== null && !(usosMax >= 1)) return error("El límite de usos debe ser 1 o más (vacío = sin límite).");
        let expira: string | null = null;
        if (b.expira_en) {
          // Una fecha sola (del calendario del panel) caduca al terminar ese día, hora del centro de México.
          const d = /^\d{4}-\d{2}-\d{2}$/.test(String(b.expira_en)) ? new Date(`${b.expira_en}T23:59:59-06:00`) : new Date(String(b.expira_en));
          if (isNaN(d.getTime())) return error("La fecha de caducidad no es válida.");
          expira = d.toISOString();
        }
        const { data, error: e } = await supabase.from("codigos").insert({ codigo, tipo, valor, usos_max: usosMax, expira_en: expira, nota: texto(b.nota, 200) || null }).select().single();
        if (e) return /duplicate|unique/i.test(e.message) ? error("Ese código ya existe. Escribe otro.", 409) : error(e.message);
        return json(data, 201);
      }
      if (rec === "codigos" && esUuid(id) && m === "PATCH") {
        const b = await leerJson(req); const cambios: Record<string, unknown> = {};
        if (typeof b.activo === "boolean") cambios.activo = b.activo;
        if (typeof b.nota === "string") cambios.nota = texto(b.nota, 200) || null;
        if (!Object.keys(cambios).length) return error("Nada que cambiar");
        const { data, error: e } = await supabase.from("codigos").update(cambios).eq("id", id).select().single(); if (e) throw e;
        return json(data);
      }

      if (rec === "reportes" && m === "GET") {
        const { data, error: e } = await supabase.from("reportes").select("*, guias(titulo)").order("creado_en", { ascending: false }).limit(200); if (e) throw e;
        return json((data ?? []).map((r) => ({ ...r, guia_titulo: (r as any).guias?.titulo ?? null, guias: undefined })));
      }
      if (rec === "reportes" && esUuid(id) && m === "PATCH") {
        const { error: e } = await supabase.from("reportes").update({ estado: "revisado" }).eq("id", id); if (e) throw e;
        return json({ ok: true });
      }

      if (rec === "trabajos" && esUuid(id) && !accion && m === "GET") {
        const t = await cargarTrabajo(id); if (!t) return error("No existe", 404);
        const { datos, ...resto } = t as any;
        return json({ ...resto, datos_resumen: { inventario: Object.fromEntries(Object.entries(datos?.inventario ?? {}).map(([k, v]) => [k, (v as any[]).length])), bloques: (datos?.bloques ?? []).filter(Boolean).length, plan: datos?.plan ? { titulo: datos.plan.identidad?.titulo, bloques: datos.plan.bloques?.length, presupuesto: datos.plan.presupuesto_slides, camino: datos.plan.camino } : null, huecos: datos?.huecos ?? [], verificacion: datos?.verificacion ?? [] } });
      }
      if (rec === "trabajos" && esUuid(id) && accion === "reintentar" && m === "POST") {
        const t = await cargarTrabajo(id); if (!t) return error("No existe", 404);
        await supabase.from("trabajos").update({ estado: "pendiente", intentos: 0, error: null, aviso_error_en: null, actualizado_en: ahora() }).eq("id", id);
        if (t.borrador_id) await supabase.from("borradores").update({ estado: "generando" }).eq("id", t.borrador_id).eq("estado", "fallido");
        disparar(id);
        return json({ ok: true });
      }

      // Pruebas de modelos (solo administrador): medir un plan y generar guías completas con otro modelo por paso, a
      // partir de un trabajo ya leído (no se vuelven a pagar las fotos).
      if (rec === "pruebas" && (id === "plan" || id === "generar") && m === "POST") {
        const b = await leerJson(req);
        const t0 = esUuid(b.trabajo_origen) ? await cargarTrabajo(b.trabajo_origen) : null;
        const D0 = (t0?.datos ?? {}) as any;
        if (!t0 || !D0.inventario) return error("Ese trabajo no tiene inventario");
        if (id === "plan") return json(await medirPlan(D0, await fuenteDe(t0), texto(b.modelo, 10), texto(b.esfuerzo, 10)));
        const { data: bo } = await supabase.from("borradores").select("*").eq("id", t0.borrador_id).maybeSingle();
        if (!bo) return error("No existe el borrador de ese trabajo", 404);
        const etiqueta = texto(b.etiqueta, 40) || "prueba";
        const opciones: Record<string, unknown> = Object.fromEntries(Object.entries(b.opciones ?? {}).filter(([k, v]) => /^(modelo|esfuerzo)_(extraer|plan|escribir|reparar|verificar)$/.test(k) && typeof v === "string").map(([k, v]) => [k, texto(v, 10)]));
        const idiomaP = idiomaValido(b.opciones?.idioma_guia ?? b.idioma);
        if (idiomaP) opciones.idioma_guia = idiomaP;
        const bid = crypto.randomUUID(); const clave = nuevoToken(24);
        const { error: eb } = await supabase.from("borradores").insert({ id: bid, clave, servicio: 2, colegio_id: bo.colegio_id, colegio_texto: bo.colegio_texto, grado: bo.grado, materia: bo.materia, paginas: bo.paginas, archivos: bo.archivos, estado: "generando", expira_en: enDias(7) });
        if (eb) throw eb;
        const { data: g, error: eg } = await supabase.from("guias").insert({ estado: "borrador", origen: "personalizada", titulo: `Prueba ${etiqueta}`, colegio_id: bo.colegio_id, grado: bo.grado, materia: bo.materia, examen: `Prueba de modelos ${etiqueta}`, borrador_id: bid }).select("id").single();
        if (eg) throw eg;
        const datos = { inventario: D0.inventario, fotos: D0.fotos, citas: D0.citas, tipo_material: D0.tipo_material, opciones, prueba: { etiqueta, origen: t0.id } };
        const { data: nt, error: et } = await supabase.from("trabajos").insert({ tipo: "generar", borrador_id: bid, guia_id: g.id, alcance: "completa", paso: "planear", estado: "pendiente", datos, progreso: { pct: 32, mensaje: "Planeando tu guía 🧭", paso: "planear" } }).select("id").single();
        if (et) throw et;
        await supabase.from("borradores").update({ trabajo_id: nt.id, guia_id: g.id }).eq("id", bid);
        disparar(nt.id);
        return json({ ok: true, clave, guia_id: g.id, trabajo_id: nt.id, link: `${base}crear.html?clave=${clave}` }, 202);
      }

      if (rec === "limpiar" && m === "POST") return json(await limpieza());
      if (rec === "datos-curiosos" && m === "POST") {
        const b = await leerJson(req);
        const filas = (Array.isArray(b.datos) ? b.datos : []).map((d: any) => ({ texto: texto(d.texto, 300), nivel: texto(d.nivel, 20) || "primaria", categoria: texto(d.categoria, 40) || "general", emoji: texto(d.emoji, 8) || null, fuente: texto(d.fuente, 120) || null })).filter((d: any) => d.texto);
        if (!filas.length) return error("Sin datos");
        const { error: e } = await supabase.from("datos_curiosos").insert(filas); if (e) throw e;
        return json({ ok: true, insertados: filas.length });
      }
      return error("Ruta de administración no reconocida", 404);
    }

    return error("Ruta no reconocida", 404);
  } catch (e) {
    console.error(e);
    return error((e as Error).message ?? "Error interno", 500);
  }
});
