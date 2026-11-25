// deno-lint-ignore-file no-explicit-any
// Módulo aparte: suscripción mensual «Guías ilimitadas» de SparkEd (decisiones de Daniel del 23 al 25 nov 2026).
// Nace en MODO PRUEBA: apagada para el público; solo los números de la lista de probadores la ven y la pueden contratar.
//
// La idea, en simple:
//   · La suscripción cuelga de la misma CUENTA del paquete de guías (cuenta.ts): el número de WhatsApp, sin contraseñas.
//     Una cuenta puede tener saldo de paquete y suscripción; si tiene las dos cosas, se usa la suscripción.
//   · El cobro mensual lo hace Mercado Pago Suscripciones («preapproval» sin plan, solo tarjeta). La familia mete su
//     tarjeta en la página de Mercado Pago; aquí nunca se ve ni se guarda una tarjeta.
//   · NUNCA se cree lo que dice un aviso: al llegar uno se le pregunta a Mercado Pago (GET /preapproval, /authorized_payments
//     y /v1/payments) y solo esa respuesta cambia el estado. Cada cobro es idempotente (el id del pago es único en la base).
//   · 7 días gratis, una sola vez por WhatsApp y una por tarjeta (tabla pruebas_usadas). Sin topes de guías: solo se
//     registra el uso y el panel lo muestra; si una cuenta pasa de 15 guías durante la prueba, se le avisa a Daniel.
//   · Cobro fallido → «en gracia» (abre sus guías, no crea nuevas) → «vencida». Cancelar es un clic: conserva lo pagado
//     hasta el fin del periodo y ya no se cobra nada.
//   · Las guías hechas con la suscripción se generan completas, sin vista previa (el camino del saldo, en cuenta.ts), no
//     son ventas (la venta es cada cobro aprobado) y siguen abiertas mientras la suscripción esté pagada.
// Migración: sql/migraciones/20261125_sparked_suscripciones.sql. Prueba: herramientas/probar-suscripciones.ts.
//
// Quién atiende cada ruta:
//   · Las de la familia (GET /suscripcion/info, POST /suscripcion/crear, GET /suscripcion/estado, POST /suscripcion/cancelar)
//     las recibe cuenta.ts, que es quien conoce la sesión (cabecera x-cuenta), y llama a las funciones de aquí.
//   · Los avisos de Mercado Pago llegan a POST /pago/mercadopago (index.ts), que separa los temas de suscripción ANTES de
//     la lógica de las guías sueltas y llama a avisoSuscripcionMP() y pagoSiEsDeSuscripcion().
//   · Este módulo solo responde, con clave de administrador, en /admin/suscripciones…:
//       GET  /admin/suscripciones                  → modo, probadores (enmascarados), cifras y cada suscripción con su uso
//       POST /admin/suscripciones/diario { fecha? } → la tarea diaria (avisos de renovación, gracia → vencida…)
//       POST /admin/suscripciones/probadores { agregar? | quitar? } → la lista de números que pueden probarla
//       GET  /admin/suscripciones/:id               → una suscripción con sus cobros y sus guías
//       POST /admin/suscripciones/:id/cancelar · /revisar (pregunta a Mercado Pago) · /revisado (quita la bandera)
//       POST /admin/suscripciones/:id/prueba { accion… } → solo suscripciones de prueba: avisos y pagos simulados
//
// El ajuste sparked_suscripcion decide quién puede contratar: 'no' (nadie), 'probadores' (los de la lista) o 'si' (todos).
// Quien ya tiene una suscripción la conserva y puede cancelarla siempre, esté como esté el ajuste.
import type { CtxBase, CtxCuenta, CtxRutasCuenta } from "./tipos.ts";
import { mandarTextoA, telefonoInternacional, idiomaDe } from "./whatsapp.ts";
import { ventaCobrada, inicioDiaVentas } from "./extras.ts";

// ---------- Reglas (números que deciden cómo se comporta) ----------
export const PRECIO = 349;                 // pesos al mes, IVA incluido (el ajuste sparked_suscripcion_precio manda)
export const PRUEBA_DIAS = 7;              // días gratis, una sola vez por WhatsApp y por tarjeta
export const GRACIA_DIAS = 10;             // lo que Mercado Pago reintenta un cobro rechazado (4 reintentos en 10 días)
export const COLCHON_HORAS = 48;           // lo que se espera el cobro después del fin del periodo antes de pasar a gracia
export const AVISO_DIAS = 6;               // el aviso de renovación sale 6 días antes (la ley pide al menos 5 naturales)
export const PENDIENTE_DIAS = 3;           // una suscripción sin terminar de contratar se abandona a los 3 días
export const AVISO_GUIAS_PRUEBA = 15;      // más de estas guías durante la prueba: aviso a Daniel (no bloquea)
export const FALLAS_POR_DIA = 3;           // guías fallidas en 24 horas antes de pedir una pausa (cada intento gasta IA)
export const VIVAS = ["pendiente", "en_prueba", "activa", "en_gracia"];
const ANIOS_FIN = 5;                       // Mercado Pago solo respeta la fecha de inicio si también hay fecha de fin
const ACCESO_LARGO_MIN = 10 * 366 * 24 * 60; // «minutos tras abrir» de una guía de suscripción: manda su fecha de fin
const RAZON = "SparkEd · Guías ilimitadas";
const DIA = 86400_000, HORA = 3600_000;

const MSG_NO_DISPONIBLE = "La suscripción todavía no está disponible.";
const MSG_YA = "Tu cuenta ya tiene una suscripción.";
export const MSG_EN_GRACIA = "No pudimos cobrar tu suscripción, así que por ahora no puedes crear guías nuevas. Mercado Pago lo volverá a intentar en los próximos días.";
export const MSG_FALLO_GUIA_SUS = "No pudimos terminar tu guía. Tu suscripción sigue activa: inténtalo de nuevo.";

// ---------- Utilidades ----------
const env = (k: string) => String((globalThis as any).Deno?.env?.get(k) ?? "").trim();
const esUuid = (u: unknown): u is string => typeof u === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(u);
// «•» no vale: así se enseñan los correos a medias (a•••@correo.com) y uno de esos nunca debe usarse como correo de verdad.
const esCorreo = (x: unknown): x is string => typeof x === "string" && x.length <= 120 && /^[^@\s•]+@[^@\s•]+\.[^@\s•]+$/.test(x);
const correoLimpio = (v: unknown): string => { const x = String(v ?? "").trim().toLowerCase(); return esCorreo(x) ? x : ""; };
const texto = (v: unknown, max = 120) => String(v ?? "").replace(/[\x00-\x1f\x7f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const escHtml = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch] as string));
const folioDe = (id: unknown) => String(id ?? "").slice(0, 8).toUpperCase();
const primerNombre = (n: unknown) => String(n ?? "").trim().split(/\s+/)[0]?.replace(/[*_~`{}]/g, "") ?? "";
const enmascararTelefono = (t: unknown): string => { const d = String(t ?? "").replace(/\D/g, ""); return d.length >= 6 ? "••• ••• " + d.slice(-4) : "•••"; };
const enmascararCorreo = (c: unknown): string => { const [u, dom] = String(c ?? "").trim().split("@"); return u && dom ? `${u[0]}•••@${dom}` : ""; };
const sinCorreos = (s: unknown) => String(s ?? "").replace(/[^\s@<>"']+@[^\s@<>"']+/g, "(correo)");
const iso = (ms: number) => new Date(ms).toISOString();
// La hora de este módulo sale siempre de Date.now(): así la prueba (herramientas/probar-suscripciones.ts) puede adelantar el reloj.
const ya = () => iso(Date.now());
const ms = (x: unknown): number => { if (x === null || x === undefined || x === "") return NaN; const n = new Date(String(x)).getTime(); return Number.isFinite(n) ? n : NaN; };
const fechaValida = (x: unknown): string | null => { const n = ms(x); return Number.isFinite(n) ? iso(n) : null; };
const dinero = (n: unknown) => { const v = Number(n) || 0; return `$${Number.isInteger(v) ? v : v.toFixed(2)} MXN`; };
async function sha256hex(s: string): Promise<string> {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
const ALFABETO = "abcdefghijklmnopqrstuvwxyz0123456789";
function alAzar(n: number): string { const b = crypto.getRandomValues(new Uint8Array(n)); let s = ""; for (const x of b) s += ALFABETO[x % ALFABETO.length]; return s; }
const fechaLarga = (v: unknown, idioma: "es" | "en" = "es") => new Date(String(v)).toLocaleDateString(idioma === "en" ? "en-US" : "es-MX", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Mexico_City" });
const fechaHora = (v: unknown, idioma: "es" | "en" = "es") => new Date(String(v)).toLocaleString(idioma === "en" ? "en-US" : "es-MX", { dateStyle: "long", timeStyle: "short", timeZone: "America/Mexico_City" });
const idiomaDeTelefono = (t: unknown): "es" | "en" => idiomaDe(telefonoInternacional(t));
const enLotes = <T>(lista: T[], n = 80): T[][] => { const out: T[][] = []; for (let i = 0; i < lista.length; i += n) out.push(lista.slice(i, i + n)); return out; };

// ---------- Tipos ----------
export type Sus = {
  id: string; cuenta_id: string; estado: string; precio_mxn: number | string; correo_pago: string | null; con_prueba: boolean;
  primer_cobro_en: string | null; prueba_hasta: string | null; mp_preapproval_id: string | null; mp_estado: string | null;
  mp_init_point: string | null; mp_medio: string | null; mp_error: string | null; periodo_inicio: string | null; periodo_fin: string | null;
  proximo_cobro: string | null; aviso_renovacion_en: string | null; aviso_renovacion_para: string | null; gracia_desde: string | null;
  gracia_hasta: string | null; cancelada_en: string | null; cancelada_por: string | null; cancelada_mp_en: string | null; motivo_fin: string | null;
  vencida_en: string | null; revisar: boolean; revisar_motivo: string | null; aviso_uso_prueba_en: string | null; de_prueba: boolean;
  creada_en: string; actualizada_en: string;
};
type CuentaSus = { id: string; telefono: string; correo: string | null; nombre: string | null; de_prueba: boolean; prueba_gratis_usada_en?: string | null };
type RespMP = { ok: boolean; status: number; datos: any };

// ---------- Ajustes ----------
export type AjustesSus = { modo: "no" | "probadores" | "si"; precio: number; probadores: string[]; pruebaDias: number };
/** La lista de probadores: WhatsApp en formato internacional ("+52" y 10 dígitos), separados por comas o espacios. */
export const listaProbadores = (v: unknown): string[] => [...new Set(String(v ?? "").split(/[,;\s]+/).map((x) => x.trim()).filter((x) => /^\+\d{8,15}$/.test(x)))];
export function ajustesSuscripcion(cfg: Record<string, string> | null | undefined): AjustesSus {
  const m = String(cfg?.sparked_suscripcion ?? "").trim().toLowerCase();
  const precio = Number(String(cfg?.sparked_suscripcion_precio ?? "").replace(",", "."));
  return {
    modo: m === "si" ? "si" : m === "probadores" ? "probadores" : "no",
    precio: Number.isFinite(precio) && precio >= 1 && precio <= 100000 ? Math.round(precio * 100) / 100 : PRECIO,
    probadores: listaProbadores(cfg?.sparked_suscripcion_probadores),
    pruebaDias: PRUEBA_DIAS,
  };
}
/** ¿Ese WhatsApp puede contratar ahora? Público: todos. Solo probadores: los de la lista. Apagada: nadie. */
export const puedeSuscribirse = (aj: AjustesSus, telefono: unknown): boolean => aj.modo === "si" || (aj.modo === "probadores" && aj.probadores.includes(String(telefono ?? "")));
/** El texto que la familia acepta al marcar la casilla (queda guardado con la fecha). */
export function textoAceptado(precio: number, conPrueba: boolean, primerCobro: string | null): string {
  const p = dinero(precio).replace(" MXN", "");
  if (conPrueba && primerCobro) return `Acepto que al terminar mi prueba gratis de ${PRUEBA_DIAS} días (el ${fechaLarga(primerCobro)}) se me cobren ${p} cada mes de forma automática hasta que cancele. Me avisarán al menos 5 días antes de cada cobro.`;
  if (primerCobro) return `Acepto que a partir del ${fechaLarga(primerCobro)} se me cobren ${p} cada mes de forma automática hasta que cancele. Me avisarán al menos 5 días antes de cada cobro.`;
  return `Acepto que se me cobren ${p} cada mes de forma automática hasta que cancele. Me avisarán al menos 5 días antes de cada cobro.`;
}

// ---------- Derechos (cálculo puro; se prueba sin base de datos) ----------
/** ¿Puede crear guías con esta suscripción? En prueba o activa: sí, hasta 48 horas después del fin del periodo (mientras
 *  llega el cobro). Cancelada: sí, hasta el fin de lo pagado. En gracia, vencida, pendiente o abandonada: no. */
export function derechos(s: Partial<Sus> | null | undefined, ahora = Date.now()): { crear: boolean; hasta: string | null; motivo: string } {
  if (!s) return { crear: false, hasta: null, motivo: "sin_suscripcion" };
  const fin = ms(s.periodo_fin);
  if (s.estado === "en_prueba" || s.estado === "activa") {
    return Number.isFinite(fin) && ahora < fin + COLCHON_HORAS * HORA ? { crear: true, hasta: s.periodo_fin ?? null, motivo: s.estado } : { crear: false, hasta: s.periodo_fin ?? null, motivo: "esperando_cobro" };
  }
  if (s.estado === "cancelada") return Number.isFinite(fin) && ahora < fin ? { crear: true, hasta: s.periodo_fin ?? null, motivo: "cancelada_vigente" } : { crear: false, hasta: s.periodo_fin ?? null, motivo: "cancelada" };
  return { crear: false, hasta: null, motivo: String(s.estado ?? "") };
}
/** Hasta cuándo siguen abiertas las guías hechas con esta suscripción (en milisegundos), o null si ya no les da nada. */
export function finDeAcceso(s: Partial<Sus> | null | undefined): number | null {
  if (!s) return null;
  const fin = ms(s.periodo_fin), gracia = ms(s.gracia_hasta);
  if (s.estado === "en_prueba" || s.estado === "activa") return Number.isFinite(fin) ? fin + COLCHON_HORAS * HORA : null;
  if (s.estado === "en_gracia") return Number.isFinite(gracia) ? gracia : Number.isFinite(fin) ? fin + GRACIA_DIAS * DIA : null;
  if (s.estado === "cancelada") return Number.isFinite(fin) ? fin : null;
  return null;
}
/** La suscripción que se le enseña a la familia: la viva (salvo una que apenas se está contratando si hay otra pagada),
 *  luego la cancelada que sigue pagada, luego la última que terminó. Una abandonada no se enseña. */
export function elegirActual(lista: Sus[], ahora = Date.now()): Sus | null {
  const viva = lista.find((s) => VIVAS.includes(s.estado));
  const vigente = lista.find((s) => s.estado === "cancelada" && derechos(s, ahora).crear);
  if (viva && viva.estado !== "pendiente") return viva;
  return vigente ?? viva ?? lista.find((s) => s.estado === "cancelada" || s.estado === "vencida") ?? null;
}

// ---------- Lecturas ----------
const COLUMNAS_CUENTA = "id, telefono, correo, nombre, de_prueba, prueba_gratis_usada_en";
async function porId(c: CtxBase, id: string): Promise<Sus | null> { return ((await c.supabase.from("suscripciones").select("*").eq("id", id).maybeSingle()).data as Sus | null) ?? null; }
async function deCuenta(c: CtxBase, cuentaId: string): Promise<Sus[]> {
  const { data, error } = await c.supabase.from("suscripciones").select("*").eq("cuenta_id", cuentaId).order("creada_en", { ascending: false }).limit(40);
  if (error) throw error;
  return (data ?? []) as Sus[];
}
async function cuentaDe(c: CtxBase, cuentaId: string): Promise<CuentaSus | null> { return ((await c.supabase.from("cuentas").select(COLUMNAS_CUENTA).eq("id", cuentaId).maybeSingle()).data as CuentaSus | null) ?? null; }
async function cambiar(c: CtxBase, id: string, cambios: Record<string, unknown>) {
  const { error } = await c.supabase.from("suscripciones").update({ ...cambios, actualizada_en: ya() }).eq("id", id);
  if (error) throw error;
}
/** Deja la bandera «revisar» con su motivo (se suma a los que ya tenía). Nunca bloquea nada. */
async function marcarRevisar(c: CtxBase, sus: Sus, motivo: string) {
  const previo = String((await porId(c, sus.id))?.revisar_motivo ?? "");
  if (previo.includes(motivo)) return;
  await cambiar(c, sus.id, { revisar: true, revisar_motivo: [previo, motivo].filter(Boolean).join(" · ").slice(0, 600) });
}
/** La suscripción con la que esta cuenta puede crear una guía ahora, o null. La usa cuenta.ts antes de gastar saldo. */
export async function suscripcionParaCrear(c: CtxBase, cuentaId: string): Promise<Sus | null> {
  const lista = await deCuenta(c, cuentaId), ahora = Date.now();
  return lista.find((s) => (s.estado === "en_prueba" || s.estado === "activa") && derechos(s, ahora).crear) ?? lista.find((s) => derechos(s, ahora).crear) ?? null;
}
/** ¿La cuenta tiene una suscripción que no puede crear guías por un cobro pendiente? (para el mensaje de «sin saldo»). */
export async function suscripcionDetenida(c: CtxBase, cuentaId: string): Promise<boolean> {
  return (await deCuenta(c, cuentaId)).some((s) => s.estado === "en_gracia" || ((s.estado === "activa" || s.estado === "en_prueba") && !derechos(s).crear));
}

// ---------- Prueba gratis: una por WhatsApp y una por tarjeta ----------
let pimienta = "";
async function huella(prefijo: string, valor: string): Promise<string> {
  if (!pimienta) pimienta = await sha256hex(env("SUPABASE_SERVICE_ROLE_KEY") + ":sparked-suscripcion-pruebas");
  return prefijo + (await sha256hex(`sparked-prueba:${pimienta}:${prefijo}${valor}`)).slice(0, 40);
}
/** Huellas de un pago: la tarjeta (primeros 6 y últimos 4 dígitos y vencimiento; nunca se guardan los dígitos) y el pagador. */
export async function huellasDePago(p: any): Promise<string[]> {
  const out: string[] = [], t = p?.card ?? {};
  const seis = String(t.first_six_digits ?? "").replace(/\D/g, ""), cuatro = String(t.last_four_digits ?? "").replace(/\D/g, "");
  if (seis.length >= 6 && cuatro.length === 4) out.push(await huella("t:", `${seis.slice(0, 6)}-${cuatro}-${Number(t.expiration_month) || 0}-${Number(t.expiration_year) || 0}`));
  if (p?.payer?.id != null && String(p.payer.id)) out.push(await huella("p:", String(p.payer.id)));
  return out;
}
async function pruebaYaUsada(c: CtxBase, cuenta: CuentaSus): Promise<boolean> {
  if (cuenta.prueba_gratis_usada_en) return true;
  const { count } = await c.supabase.from("pruebas_usadas").select("id", { count: "exact", head: true }).eq("telefono", cuenta.telefono);
  return (count ?? 0) > 0;
}
/** ¿Alguna de estas huellas ya gastó una prueba gratis en OTRA suscripción? */
async function huellasRepetidas(c: CtxBase, huellas: string[], sus: Sus): Promise<boolean> {
  if (!huellas.length) return false;
  const { data } = await c.supabase.from("pruebas_usadas").select("huella_tarjeta, suscripcion_id").in("huella_tarjeta", huellas);
  return ((data ?? []) as any[]).some((x) => x.suscripcion_id !== sus.id);
}
async function anotarPrueba(c: CtxBase, sus: Sus, cuenta: CuentaSus | null, huellas: string[], conTelefono = true) {
  const filas: Record<string, unknown>[] = huellas.map((h) => ({ cuenta_id: sus.cuenta_id, huella_tarjeta: h, suscripcion_id: sus.id }));
  if (conTelefono && cuenta?.telefono) filas.unshift({ cuenta_id: sus.cuenta_id, telefono: cuenta.telefono, suscripcion_id: sus.id });
  for (const f of filas) { const { error } = await c.supabase.from("pruebas_usadas").insert(f); if (error && error.code !== "23505") console.warn("pruebas_usadas:", error.message); }
  if (conTelefono) await c.supabase.from("cuentas").update({ prueba_gratis_usada_en: ya() }).eq("id", sus.cuenta_id).is("prueba_gratis_usada_en", null);
}

// ---------- Mercado Pago ----------
const estadoPre = (x: unknown) => { const e = String(x ?? "").toLowerCase(); return /^cancel/.test(e) ? "cancelled" : e; };
function leerPreapproval(d: any) {
  const ar = d?.auto_recurring ?? {};
  return {
    id: String(d?.id ?? ""), estado: estadoPre(d?.status), proximo: fechaValida(d?.next_payment_date), inicio: fechaValida(ar.start_date),
    pagador: d?.payer_id != null ? String(d.payer_id) : "", medio: d?.payment_method_id != null ? texto(d.payment_method_id, 40) || null : null,
    referencia: String(d?.external_reference ?? ""),
  };
}
/** Estado de un pago de Mercado Pago, en palabras de la tabla de cobros. */
export function estadoDeCobro(p: any): "aprobado" | "pendiente" | "rechazado" | "reembolsado" {
  const e = String(p?.status ?? "").toLowerCase();
  if (e === "approved") return "aprobado";
  if (e === "refunded" || e === "charged_back") return "reembolsado";
  if (e === "rejected" || /^cancel/.test(e)) return "rechazado";
  return "pendiente";
}
const errorMP = (r: RespMP) => texto(sinCorreos(`${r.status} ${r.datos?.message ?? r.datos?.error ?? ""} ${Array.isArray(r.datos?.cause) ? r.datos.cause.map((x: any) => x?.description ?? x?.code ?? "").join("; ") : ""}`), 300);
const simulada = (s: Sus) => s.de_prueba === true;

/** Crea la suscripción en Mercado Pago (sin plan, pendiente: la familia mete su tarjeta en la página de Mercado Pago). */
async function crearEnMP(c: CtxCuenta, sus: Sus, op: { correo: string; precio: number; primerCobroMs: number | null }): Promise<{ id: string; url: string }> {
  const cuerpo: Record<string, any> = {
    reason: RAZON, external_reference: sus.id, payer_email: op.correo,
    auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount: op.precio, currency_id: "MXN" },
    back_url: `${await c.sitio()}cuenta.html?suscripcion=${sus.id}`, status: "pending",
  };
  if (op.primerCobroMs) { cuerpo.auto_recurring.start_date = iso(op.primerCobroMs); cuerpo.auto_recurring.end_date = iso(op.primerCobroMs + ANIOS_FIN * 365 * DIA); }
  const r = await c.mp("/preapproval", { method: "POST", body: cuerpo });
  const url = (c.mpPrueba() && r.datos?.sandbox_init_point) || r.datos?.init_point;
  if (!r.ok || !r.datos?.id || !url) throw new Error("Mercado Pago: " + errorMP(r));
  if (op.primerCobroMs) {
    // La prueba gratis (o el cobro diferido) depende de que Mercado Pago respete la fecha del primer cobro. Si no la
    // confirma, no se sigue: se cancela esa suscripción para que nadie reciba un cobro que no esperaba.
    const dicho = ms(r.datos?.auto_recurring?.start_date);
    if (!Number.isFinite(dicho) || Math.abs(dicho - op.primerCobroMs) > 36 * HORA) {
      await cancelarEnMP(c, String(r.datos.id)).catch(() => null);
      throw new Error(`Mercado Pago no confirmó la fecha del primer cobro (pedida ${iso(op.primerCobroMs)}, devuelta ${Number.isFinite(dicho) ? iso(dicho) : "ninguna"})`);
    }
  }
  return { id: String(r.datos.id), url };
}
/** Cancela la suscripción en Mercado Pago (deja de cobrar) y comprueba que quedó cancelada. La documentación escribe
 *  el estado de las dos formas («cancelled» y «canceled»): si rechaza una, se intenta la otra. */
async function cancelarEnMP(c: CtxCuenta, preapprovalId: string): Promise<{ ok: boolean; detalle: string }> {
  const ruta = `/preapproval/${encodeURIComponent(preapprovalId)}`;
  let ultimo = "";
  for (const estado of ["cancelled", "canceled"]) {
    const r = await c.mp(ruta, { method: "PUT", body: { status: estado } });
    if (r.ok && /^cancel/i.test(String(r.datos?.status ?? ""))) return { ok: true, detalle: "" };
    ultimo = errorMP(r);
    if (r.ok || (r.status !== 400 && r.status !== 422)) break;
  }
  const g = await c.mp(ruta);
  if (g.ok && /^cancel/i.test(String(g.datos?.status ?? ""))) return { ok: true, detalle: "" };
  return { ok: false, detalle: ultimo || errorMP(g) };
}

// ---------- Mensajes a la familia y avisos a Daniel ----------
const correoSimple = (parrafos: string[]) => `<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:#1b1b1f;max-width:560px;margin:auto">${parrafos.map((p) => `<p>${p}</p>`).join("")}<p>Daniel, de SparkEd<br><span style="color:#777;font-size:13px">sparkeducation-mx.com</span></p></div>`;
const aHtml = (p: string) => escHtml(p).replace(/\*([^*]+)\*/g, "<b>$1</b>").replace(/\n/g, "<br>").replace(/(https:\/\/[^\s<]+)/g, '<a href="$1" style="color:#1d4ed8">$1</a>');
type Mensaje = { es: string[]; en: string[]; asunto: [string, string] };
/** Manda un mensaje a la familia por WhatsApp y por correo. Las cuentas de prueba nunca reciben nada. */
async function avisarFamilia(c: CtxBase, cuenta: CuentaSus | null, armar: (x: { idioma: "es" | "en"; nombre: string; cuenta: string; cancelar: string }) => Mensaje) {
  if (!cuenta || cuenta.de_prueba === true) return;
  const idioma = idiomaDeTelefono(cuenta.telefono), sitio = await c.sitio();
  const m = armar({ idioma, nombre: primerNombre(cuenta.nombre), cuenta: `${sitio}cuenta.html`, cancelar: `${sitio}cuenta.html?cancelar=1` });
  const partes = idioma === "en" ? m.en : m.es;
  await Promise.allSettled([
    mandarTextoA(c, cuenta.telefono, partes.join("\n\n"), "suscripcion"),
    esCorreo(cuenta.correo) ? c.mandarCorreo(String(cuenta.correo), m.asunto[idioma === "en" ? 1 : 0], correoSimple(partes.map(aHtml))) : Promise.resolve(),
  ]);
}
const hola = (n: string, idioma: "es" | "en") => idioma === "en" ? (n ? `Hi, ${n}:` : "Hi:") : (n ? `Hola, ${n}:` : "Hola:");
const quien = (cuenta: CuentaSus | null) => `${escHtml(primerNombre(cuenta?.nombre) || "Sin nombre")} · ${escHtml(enmascararTelefono(cuenta?.telefono))}`;
async function avisarDaniel(c: CtxBase, sus: Sus, asunto: string, html: string) {
  if (simulada(sus)) return;
  try { await c.avisarDaniel(asunto, `${html}<p style="color:#777;font-size:13px">Suscripción folio ${escHtml(folioDe(sus.id))} · panel → Suscripciones</p>`); } catch (e) { console.warn("aviso a Daniel:", (e as Error).message); }
}
/** Un aviso que también queda en el panel, en Reportes (el correo solo sale si Daniel puso su correo de avisos). */
async function avisoEnPanel(c: CtxBase, sus: Sus, comentario: string, asunto: string) {
  if (simulada(sus)) return;
  try { const { error } = await c.supabase.from("reportes").insert({ comentario: texto(comentario, 500) }); if (error) console.warn("reportes:", error.message); } catch (e) { console.warn("reportes:", (e as Error).message); }
  await avisarDaniel(c, sus, asunto, `<p>${escHtml(comentario)}</p>`);
}

const mBienvenidaPrueba = (fin: string, precio: number) => (x: any): Mensaje => ({
  es: [hola(x.nombre, "es"), `¡Listo! Ya tienes *guías ilimitadas* de SparkEd. Tu prueba gratis termina el *${fechaLarga(fin)}*.`,
    `Aviso de cobro: ese día se cobrarán ${dinero(precio)} a tu tarjeta y después cada mes, de forma automática, hasta que canceles. Si no quieres seguir, cancela antes en un clic, sin costo:\n${x.cancelar}`,
    `Para crear tus guías, entra con tu número de WhatsApp aquí:\n${x.cuenta}`],
  en: [hola(x.nombre, "en"), `All set! You now have SparkEd *unlimited guides*. Your free trial ends on *${fechaLarga(fin, "en")}*.`,
    `Charge notice: on that day ${dinero(precio)} will be charged to your card, and then every month, automatically, until you cancel. If you don't want to continue, cancel before then in one click, at no cost:\n${x.cancelar}`,
    `To create your guides, sign in with your WhatsApp number here:\n${x.cuenta}`],
  asunto: [`${x.nombre ? x.nombre + ", ya" : "Ya"} tienes guías ilimitadas de SparkEd (prueba gratis)`, "Your SparkEd unlimited guides are active (free trial)"],
});
const mReactivada = (fin: string, precio: number) => (x: any): Mensaje => ({
  es: [hola(x.nombre, "es"), `¡Listo! Tu suscripción de *guías ilimitadas* de SparkEd quedó activa otra vez.`,
    `Tu próximo cobro será el *${fechaLarga(fin)}* por ${dinero(precio)}, y después cada mes hasta que canceles. Puedes cancelar cuando quieras, en un clic:\n${x.cancelar}`,
    `Para crear tus guías, entra con tu número de WhatsApp aquí:\n${x.cuenta}`],
  en: [hola(x.nombre, "en"), `All set! Your SparkEd *unlimited guides* subscription is active again.`,
    `Your next charge will be on *${fechaLarga(fin, "en")}* for ${dinero(precio)}, and then every month until you cancel. You can cancel any time, in one click:\n${x.cancelar}`,
    `To create your guides, sign in with your WhatsApp number here:\n${x.cuenta}`],
  asunto: ["Tu suscripción de SparkEd quedó activa otra vez", "Your SparkEd subscription is active again"],
});
const mCobro = (antes: string, fin: string, monto: number) => (x: any): Mensaje => {
  const f = fechaLarga(fin), fe = fechaLarga(fin, "en"), d = dinero(monto);
  const renueva = `Tu suscripción se renueva sola cada mes. Te avisaremos al menos 5 días antes de cada cobro y puedes cancelar cuando quieras, en un clic:\n${x.cancelar}`;
  const renews = `Your subscription renews automatically every month. We will let you know at least 5 days before each charge, and you can cancel any time, in one click:\n${x.cancelar}`;
  const crear = `Para crear tus guías, entra con tu número de WhatsApp aquí:\n${x.cuenta}`, create = `To create your guides, sign in with your WhatsApp number here:\n${x.cuenta}`;
  if (antes === "pendiente") return { es: [hola(x.nombre, "es"), `Tu pago de ${d} se confirmó y ya tienes *guías ilimitadas* de SparkEd hasta el *${f}*.`, renueva, crear], en: [hola(x.nombre, "en"), `Your payment of ${d} was confirmed and you now have SparkEd *unlimited guides* until *${fe}*.`, renews, create], asunto: [`${x.nombre ? x.nombre + ", ya" : "Ya"} tienes guías ilimitadas de SparkEd`, "Your SparkEd unlimited guides are active"] };
  if (antes === "en_prueba") return { es: [hola(x.nombre, "es"), `Tu prueba gratis terminó y cobramos ${d}. Tu suscripción de guías ilimitadas sigue activa hasta el *${f}*.`, renueva], en: [hola(x.nombre, "en"), `Your free trial ended and we charged ${d}. Your unlimited guides subscription is active until *${fe}*.`, renews], asunto: ["Cobro de tu suscripción de SparkEd", "Your SparkEd subscription charge"] };
  if (antes === "en_gracia") return { es: [hola(x.nombre, "es"), `Ya pudimos cobrar tu suscripción (${d}). Sigue activa hasta el *${f}* y ya puedes crear guías nuevas:\n${x.cuenta}`], en: [hola(x.nombre, "en"), `We were able to charge your subscription (${d}). It is active until *${fe}* and you can create new guides again:\n${x.cuenta}`], asunto: ["Tu suscripción de SparkEd sigue activa", "Your SparkEd subscription is active"] };
  return { es: [hola(x.nombre, "es"), `Cobramos ${d}. Tu suscripción de SparkEd sigue activa hasta el *${f}*.`, `Puedes cancelar cuando quieras, en un clic:\n${x.cancelar}`], en: [hola(x.nombre, "en"), `We charged ${d}. Your SparkEd subscription is active until *${fe}*.`, `You can cancel any time, in one click:\n${x.cancelar}`], asunto: ["Cobro de tu suscripción de SparkEd", "Your SparkEd subscription charge"] };
};
const mRenovacion = (cobro: string, precio: number) => (x: any): Mensaje => ({
  es: [hola(x.nombre, "es"), `Tu suscripción de SparkEd se renueva el *${fechaLarga(cobro)}* por ${dinero(precio)}.`, `Si no quieres seguir, cancela aquí en un clic:\n${x.cancelar}`],
  en: [hola(x.nombre, "en"), `Your SparkEd subscription renews on *${fechaLarga(cobro, "en")}* for ${dinero(precio)}.`, `If you don't want to continue, cancel here in one click:\n${x.cancelar}`],
  asunto: [`Tu suscripción de SparkEd se renueva el ${fechaLarga(cobro)}`, `Your SparkEd subscription renews on ${fechaLarga(cobro, "en")}`],
});
const mCobroFallido = (primero: boolean) => (x: any): Mensaje => primero ? ({
  es: [hola(x.nombre, "es"), `No pudimos hacer el primer cobro de tu suscripción de SparkEd, así que todavía no está activa.`, `Mercado Pago lo volverá a intentar en los próximos días. Si quieres pagar con otra tarjeta, cancela esta suscripción en tu cuenta y suscríbete de nuevo:\n${x.cuenta}`],
  en: [hola(x.nombre, "en"), `We couldn't make the first charge of your SparkEd subscription, so it is not active yet.`, `Mercado Pago will try again over the next few days. If you want to pay with another card, cancel this subscription in your account and subscribe again:\n${x.cuenta}`],
  asunto: ["No pudimos cobrar tu suscripción de SparkEd", "We couldn't charge your SparkEd subscription"],
}) : ({
  es: [hola(x.nombre, "es"), `No pudimos cobrar tu suscripción de SparkEd.`, `Mercado Pago lo volverá a intentar en los próximos días. Mientras tanto puedes abrir tus guías, pero no crear guías nuevas.`, `Si quieres pagar con otra tarjeta, cancela tu suscripción en tu cuenta y suscríbete de nuevo:\n${x.cuenta}`],
  en: [hola(x.nombre, "en"), `We couldn't charge your SparkEd subscription.`, `Mercado Pago will try again over the next few days. Meanwhile you can open your guides, but not create new ones.`, `If you want to pay with another card, cancel your subscription in your account and subscribe again:\n${x.cuenta}`],
  asunto: ["No pudimos cobrar tu suscripción de SparkEd", "We couldn't charge your SparkEd subscription"],
});
const mVencida = () => (x: any): Mensaje => ({
  es: [hola(x.nombre, "es"), `Tu suscripción de SparkEd terminó porque no se pudo cobrar. Ya no se te cobrará nada.`, `Puedes volver a suscribirte cuando quieras:\n${x.cuenta}`],
  en: [hola(x.nombre, "en"), `Your SparkEd subscription ended because the charge could not be made. You will not be charged anything else.`, `You can subscribe again any time:\n${x.cuenta}`],
  asunto: ["Tu suscripción de SparkEd terminó", "Your SparkEd subscription ended"],
});
/** El mensaje de cancelación que pidió Daniel (23 nov 2026), con la fecha hasta la que sigue activa. */
export const textoCancelacion = (hasta: string | null) => hasta
  ? `Lamentamos que te vayas. Esperamos que regreses pronto al salón de clases. Tu suscripción seguirá activa hasta el ${fechaLarga(hasta)}; después ya no se te cobrará nada.`
  : `Lamentamos que te vayas. Esperamos que regreses pronto al salón de clases. Tu suscripción quedó cancelada y ya no se te cobrará nada.`;
const mCancelada = (sus: Sus, hasta: string | null, cuando: string) => (x: any): Mensaje => ({
  es: [textoCancelacion(hasta), `Comprobante de cancelación: folio ${folioDe(sus.id)}, ${fechaHora(cuando)}.`],
  en: [hasta ? `We're sorry to see you go. We hope you come back to the classroom soon. Your subscription will remain active until ${fechaLarga(hasta, "en")}; after that you will not be charged anything else.` : `We're sorry to see you go. We hope you come back to the classroom soon. Your subscription was cancelled and you will not be charged anything else.`,
    `Cancellation receipt: number ${folioDe(sus.id)}, ${fechaHora(cuando, "en")}.`],
  asunto: ["Tu suscripción de SparkEd quedó cancelada", "Your SparkEd subscription was cancelled"],
});
const mCanceladaEnMP = (hasta: string | null) => (x: any): Mensaje => ({
  es: [hola(x.nombre, "es"), hasta ? `Tu suscripción de SparkEd se canceló en Mercado Pago. Seguirá activa hasta el ${fechaLarga(hasta)}; después ya no se te cobrará nada.` : `Tu suscripción de SparkEd se canceló en Mercado Pago. Ya no se te cobrará nada.`, `Si quieres volver, puedes suscribirte de nuevo aquí:\n${x.cuenta}`],
  en: [hola(x.nombre, "en"), hasta ? `Your SparkEd subscription was cancelled in Mercado Pago. It will remain active until ${fechaLarga(hasta, "en")}; after that you will not be charged anything else.` : `Your SparkEd subscription was cancelled in Mercado Pago. You will not be charged anything else.`, `If you want to come back, you can subscribe again here:\n${x.cuenta}`],
  asunto: ["Tu suscripción de SparkEd quedó cancelada", "Your SparkEd subscription was cancelled"],
});
const mPruebaNegada = () => (x: any): Mensaje => ({
  es: [hola(x.nombre, "es"), `No pudimos activar tu prueba gratis porque esta tarjeta o esta cuenta de Mercado Pago ya había usado una. No se te cobró nada y tu suscripción no quedó activa.`, `Si quieres, puedes suscribirte sin prueba gratis (se cobra desde el primer día) aquí:\n${x.cuenta}`],
  en: [hola(x.nombre, "en"), `We couldn't start your free trial because this card or this Mercado Pago account had already used one. You were not charged and your subscription is not active.`, `If you want, you can subscribe without a free trial (charged from day one) here:\n${x.cuenta}`],
  asunto: ["No pudimos activar tu prueba gratis de SparkEd", "We couldn't start your SparkEd free trial"],
});
const mNoActivada = () => (x: any): Mensaje => ({
  es: [hola(x.nombre, "es"), `No pudimos activar tu suscripción de SparkEd. La cancelamos para que no se te cobre nada.`, `Inténtalo de nuevo más tarde aquí:\n${x.cuenta}`],
  en: [hola(x.nombre, "en"), `We couldn't activate your SparkEd subscription. We cancelled it so that you are not charged anything.`, `Please try again later here:\n${x.cuenta}`],
  asunto: ["No pudimos activar tu suscripción de SparkEd", "We couldn't activate your SparkEd subscription"],
});

// ---------- Guías de la suscripción: siguen abiertas mientras esté pagada ----------
async function alargar(c: CtxBase, filas: { acceso_id: string | null; guia_id: string | null; borrador_id: string | null }[], hasta: number): Promise<number> {
  const hastaIso = iso(hasta), borrarIso = iso(hasta + DIA), ahora = ya();
  let n = 0;
  for (const lote of enLotes(filas, 50)) {
    const accesos = lote.map((x) => x.acceso_id).filter(Boolean), guias = lote.map((x) => x.guia_id).filter(Boolean), borradores = lote.map((x) => x.borrador_id).filter(Boolean);
    // Solo se alargan los accesos que siguen vivos (uno que ya venció no revive) y nunca se acorta ninguno.
    if (accesos.length) { const a = await c.supabase.from("accesos").update({ expira_en: hastaIso, minutos_tras_apertura: ACCESO_LARGO_MIN }).in("id", accesos).gt("expira_en", ahora).lt("expira_en", hastaIso).select("id"); n += a.data?.length ?? 0; }
    if (guias.length) await c.supabase.from("guias").update({ borrar_en: borrarIso }).in("id", guias).not("cartucho", "is", null).lt("borrar_en", borrarIso);
    if (borradores.length) await c.supabase.from("borradores").update({ expira_en: borrarIso }).in("id", borradores).lt("expira_en", borrarIso);
  }
  return n;
}
/** Alarga todas las guías de suscripción de la cuenta hasta donde llega lo pagado (o la gracia). */
async function alargarGuias(c: CtxBase, sus: Sus): Promise<number> {
  const hasta = finDeAcceso(sus);
  if (!hasta || hasta <= Date.now()) return 0;
  const { data } = await c.supabase.from("compras").select("acceso_id, guia_id, borrador_id").eq("cuenta_id", sus.cuenta_id).eq("metodo_pago", "suscripcion").eq("estado", "pagada").not("acceso_id", "is", null).order("creada_en", { ascending: false }).limit(300);
  return (data ?? []).length ? await alargar(c, data as any[], hasta) : 0;
}
/** Al entregar una guía hecha con la suscripción (index.ts, entregarGuiaLista): su acceso dura hasta donde llega lo
 *  pagado, con el mínimo de 7 días de cualquier guía. Nunca lanza: una falla aquí no detiene la entrega. */
export async function alargarGuiaDeSuscripcion(c: CtxBase, compra: any): Promise<void> {
  try {
    if (compra?.metodo_pago !== "suscripcion" || !compra.cuenta_id || !compra.acceso_id) return;
    const hasta = Math.max(0, ...(await deCuenta(c, compra.cuenta_id)).map((s) => finDeAcceso(s) ?? 0));
    if (hasta > Date.now()) await alargar(c, [{ acceso_id: compra.acceso_id, guia_id: compra.guia_id ?? null, borrador_id: compra.borrador_id ?? null }], hasta);
  } catch (e) { console.warn("alargar la guía de la suscripción:", (e as Error).message); }
}
/** Renglón que acompaña la entrega de una guía hecha con la suscripción. */
export async function notaDeSuscripcion(c: CtxBase, compra: any): Promise<string> {
  if (compra?.metodo_pago !== "suscripcion" || !compra.cuenta_id) return "";
  const cuenta = await cuentaDe(c, compra.cuenta_id), link = `${await c.sitio()}cuenta.html`;
  return idiomaDeTelefono(cuenta?.telefono) === "en"
    ? `This guide is part of your unlimited guides subscription: it stays open for as long as your subscription is active. Your account: ${link}`
    : `Esta guía es parte de tu suscripción de guías ilimitadas: seguirá abierta mientras tu suscripción esté activa. Tu cuenta: ${link}`;
}
/** Aviso a la familia cuando una guía de su suscripción no se pudo crear (cuenta.ts ya dejó la compra como fallida). */
export async function avisarGuiaFallida(c: CtxBase, cuentaId: string, motivo: string) {
  const cuenta = await cuentaDe(c, cuentaId);
  await avisarFamilia(c, cuenta, (x) => ({
    es: [motivo, `Tu suscripción sigue activa. Puedes intentarlo de nuevo aquí:\n${x.cuenta}`],
    en: ["We could not create your guide. Please try again with clearer photos.", `Your subscription is still active. You can try again here:\n${x.cuenta}`],
    asunto: ["No pudimos crear tu guía de SparkEd", "Your SparkEd guide could not be created"],
  }));
}
/** Aviso a Daniel si una cuenta pasa de 15 guías durante su prueba gratis. Solo avisa (una vez): no bloquea nada. */
export async function revisarUsoEnPrueba(c: CtxBase, sus: Sus, op: { guias?: number } = {}): Promise<boolean> {
  if (sus.estado !== "en_prueba" || sus.aviso_uso_prueba_en) return false;
  const n = op.guias ?? (await c.supabase.from("compras").select("id", { count: "exact", head: true }).eq("suscripcion_id", sus.id).eq("metodo_pago", "suscripcion").neq("estado", "fallida")).count ?? 0;
  if (n <= AVISO_GUIAS_PRUEBA) return false;
  const motivo = `Lleva ${n} guías durante su prueba gratis (más de ${AVISO_GUIAS_PRUEBA})`;
  const previo = String(sus.revisar_motivo ?? "");
  const { data: ganada } = await c.supabase.from("suscripciones").update({ aviso_uso_prueba_en: ya(), revisar: true, revisar_motivo: [previo, motivo].filter(Boolean).join(" · ").slice(0, 600), actualizada_en: ya() }).eq("id", sus.id).is("aviso_uso_prueba_en", null).select("id");
  if (!ganada?.length) return false;
  await avisoEnPanel(c, sus, `SUSCRIPCIÓN · Una cuenta lleva ${n} guías durante su prueba gratis (folio ${folioDe(sus.id)}). Es solo un aviso: no se bloqueó nada. Mírala en el panel, pestaña Suscripciones.`, "SparkEd: una cuenta en prueba gratis lleva más de 15 guías");
  return true;
}

// ---------- Cambios de estado ----------
/** Una suscripción que no se terminó de contratar: queda abandonada y se cancela en Mercado Pago para que su link ya no sirva. */
async function abandonar(c: CtxCuenta, sus: Sus, motivo: string, extra: Record<string, unknown> = {}): Promise<boolean> {
  const { data: ganada } = await c.supabase.from("suscripciones").update({ estado: "abandonada", motivo_fin: motivo, proximo_cobro: null, actualizada_en: ya(), ...extra }).eq("id", sus.id).eq("estado", "pendiente").select("id");
  if (!ganada?.length) return false;
  if (!simulada(sus) && sus.mp_preapproval_id && c.mpToken()) {
    const x = await cancelarEnMP(c, sus.mp_preapproval_id).catch((e) => ({ ok: false, detalle: (e as Error).message }));
    await cambiar(c, sus.id, x.ok ? { mp_estado: "cancelled", cancelada_mp_en: ya() } : { mp_error: sinCorreos(x.detalle).slice(0, 300) });
  }
  return true;
}
/** Se le niega la prueba gratis (la tarjeta o el pagador ya usaron una): se cancela en Mercado Pago ANTES de cualquier
 *  cobro y la familia puede contratar de nuevo, ya sin prueba. */
async function negarPrueba(c: CtxCuenta, sus: Sus, cuenta: CuentaSus | null): Promise<boolean> {
  const { data: ganada } = await c.supabase.from("suscripciones").update({ estado: "abandonada", motivo_fin: "prueba_ya_usada", proximo_cobro: null, cancelada_en: ya(), cancelada_por: "sistema", actualizada_en: ya() }).eq("id", sus.id).in("estado", ["pendiente", "en_prueba"]).select("id");
  if (!ganada?.length) return false;
  let enMP = simulada(sus);
  if (!simulada(sus) && sus.mp_preapproval_id) {
    const x = await cancelarEnMP(c, sus.mp_preapproval_id).catch((e) => ({ ok: false, detalle: (e as Error).message }));
    enMP = x.ok;
    if (!x.ok) await cambiar(c, sus.id, { mp_error: sinCorreos(x.detalle).slice(0, 300), revisar: true, revisar_motivo: "Se negó la prueba gratis y no se pudo cancelar en Mercado Pago: cancélala a mano en tu cuenta de Mercado Pago" });
  }
  if (enMP) await cambiar(c, sus.id, { mp_estado: "cancelled", cancelada_mp_en: ya() });
  // La próxima vez que contrate ya no lleva prueba gratis.
  await anotarPrueba(c, sus, cuenta, [], true);
  c.enSegundoPlano(avisarFamilia(c, cuenta, mPruebaNegada()));
  c.enSegundoPlano(avisarDaniel(c, sus, "SparkEd: se negó una prueba gratis repetida", `<p>Una familia intentó usar la prueba gratis con una tarjeta o una cuenta de Mercado Pago que ya había usado una. No se le cobró nada y su suscripción no quedó activa.</p><p>${quien(cuenta)}</p>`));
  return true;
}
/** La familia terminó en Mercado Pago (la suscripción quedó autorizada). Con prueba gratis o con cobro diferido se activa
 *  ya; sin prueba, se activa cuando Mercado Pago apruebe el primer cobro (minutos; a veces hasta una hora). */
async function activar(c: CtxCuenta, sus: Sus, pre: ReturnType<typeof leerPreapproval>, base: Record<string, unknown>, pagos: any[] | null): Promise<string> {
  if (!sus.primer_cobro_en) {
    await cambiar(c, sus.id, { ...base, proximo_cobro: pre.proximo });
    return "esperando_primer_cobro";
  }
  const cuenta = await cuentaDe(c, sus.cuenta_id);
  const pedido = ms(sus.primer_cobro_en), dicho = ms(pre.proximo ?? pre.inicio);
  if (Number.isFinite(dicho) && dicho < pedido - 36 * HORA) {
    // Mercado Pago piensa cobrar antes de lo prometido: se cancela para que no haya un cobro sorpresa.
    const { data: ganada } = await c.supabase.from("suscripciones").update({ ...base, estado: "abandonada", motivo_fin: "fecha_no_respetada", cancelada_en: ya(), cancelada_por: "sistema", proximo_cobro: null, revisar: true, revisar_motivo: `Mercado Pago iba a cobrar el ${fechaLarga(iso(dicho))} y se había prometido el ${fechaLarga(sus.primer_cobro_en)}: se canceló sin cobrar`, actualizada_en: ya() }).eq("id", sus.id).eq("estado", "pendiente").select("id");
    if (!ganada?.length) return "ya_atendida";
    const x = simulada(sus) || !sus.mp_preapproval_id ? { ok: true, detalle: "" } : await cancelarEnMP(c, sus.mp_preapproval_id).catch((e) => ({ ok: false, detalle: (e as Error).message }));
    await cambiar(c, sus.id, x.ok ? { mp_estado: "cancelled", cancelada_mp_en: ya() } : { mp_error: sinCorreos(x.detalle).slice(0, 300) });
    c.enSegundoPlano(avisarFamilia(c, cuenta, mNoActivada()));
    c.enSegundoPlano(avisoEnPanel(c, sus, `SUSCRIPCIÓN · Mercado Pago no respetó la fecha del primer cobro de una suscripción (folio ${folioDe(sus.id)}). Se canceló ${x.ok ? "sin cobrar" : "en el sistema, PERO NO SE PUDO CANCELAR EN MERCADO PAGO: cancélala a mano"}.`, "⚠️ SparkEd: Mercado Pago no respetó la fecha del primer cobro"));
    return "fecha_no_respetada";
  }
  // Una sola prueba gratis por tarjeta: se revisa con lo que Mercado Pago deja ver del pagador y de la tarjeta.
  let huellas: string[] = [];
  if (sus.con_prueba) {
    if (pre.pagador) huellas.push(await huella("p:", pre.pagador));
    let lista = pagos;
    if (!lista && !simulada(sus)) {
      try { const r = await c.mp(`/v1/payments/search?external_reference=${encodeURIComponent(sus.id)}&sort=date_created&criteria=desc&limit=10`); lista = r.ok ? (r.datos?.results ?? []) : []; } catch { lista = []; }
    }
    for (const p of lista ?? []) huellas.push(...(await huellasDePago(p)));
    huellas = [...new Set(huellas)];
    if (await huellasRepetidas(c, huellas, sus)) { await cambiar(c, sus.id, base); return (await negarPrueba(c, sus, cuenta)) ? "prueba_negada" : "ya_atendida"; }
  }
  const fin = iso(Number.isFinite(dicho) ? dicho : pedido), estado = sus.con_prueba ? "en_prueba" : "activa";
  const { data: ganada } = await c.supabase.from("suscripciones").update({ ...base, estado, periodo_inicio: ya(), periodo_fin: fin, prueba_hasta: sus.con_prueba ? fin : null, proximo_cobro: fin, aviso_renovacion_para: fin, aviso_renovacion_en: ya(), mp_error: null, actualizada_en: ya() }).eq("id", sus.id).eq("estado", "pendiente").select("*");
  if (!ganada?.length) return "ya_atendida";
  const nueva = ganada[0] as Sus;
  if (sus.con_prueba) await anotarPrueba(c, nueva, cuenta, huellas);
  if (!Number.isFinite(dicho)) await marcarRevisar(c, nueva, "Mercado Pago no dijo la fecha del primer cobro: confírmala en tu cuenta de Mercado Pago");
  await alargarGuias(c, nueva).catch(() => 0);
  const precio = Number(sus.precio_mxn);
  // El mensaje de bienvenida lleva el aviso del cobro (sale 7 días antes: la ley pide al menos 5).
  c.enSegundoPlano(avisarFamilia(c, cuenta, sus.con_prueba ? mBienvenidaPrueba(fin, precio) : mReactivada(fin, precio)));
  c.enSegundoPlano(avisarDaniel(c, nueva, sus.con_prueba ? "SparkEd: nueva suscripción en prueba gratis" : "SparkEd: una suscripción se reactivó", `<p>${sus.con_prueba ? "Una familia empezó su prueba gratis de la suscripción de guías ilimitadas" : "Una familia volvió a suscribirse antes de que terminara lo que ya había pagado"}. Su primer cobro (${escHtml(dinero(precio))}) será el ${escHtml(fechaLarga(fin))}. Todavía no es una venta.</p><p>${quien(cuenta)}</p>`));
  return estado;
}
/** Lo que dice Mercado Pago de la suscripción (GET /preapproval/:id) se vuelve su estado aquí. pagos: solo en pruebas. */
export async function aplicarPreapproval(c: CtxCuenta, sus0: Sus, datos: any, op: { pagos?: any[] } = {}): Promise<string> {
  const pre = leerPreapproval(datos);
  const sus = (await porId(c, sus0.id)) ?? sus0;
  const base: Record<string, unknown> = { mp_estado: pre.estado || sus.mp_estado, mp_medio: pre.medio ?? sus.mp_medio, mp_revisado_en: ya() };
  if (pre.id && !sus.mp_preapproval_id) base.mp_preapproval_id = pre.id;
  if (pre.estado === "cancelled") {
    if (sus.estado === "pendiente") { await cambiar(c, sus.id, base); await c.supabase.from("suscripciones").update({ estado: "abandonada", motivo_fin: "cancelada_en_mercadopago", cancelada_mp_en: ya(), proximo_cobro: null, actualizada_en: ya() }).eq("id", sus.id).eq("estado", "pendiente"); return "abandonada"; }
    if (["en_prueba", "activa", "en_gracia"].includes(sus.estado)) { await cambiar(c, sus.id, base); return await terminarPorMP(c, sus); }
    await cambiar(c, sus.id, { ...base, cancelada_mp_en: sus.cancelada_mp_en ?? ya(), mp_error: null });
    return "cancelada";
  }
  if (pre.estado === "authorized") {
    if (sus.estado === "pendiente") return await activar(c, sus, pre, base, op.pagos ?? null);
    if (!VIVAS.includes(sus.estado)) {
      // Aquí ya no debe cobrarse (cancelada, vencida o abandonada) y Mercado Pago la tiene activa: se le vuelve a pedir que la cancele.
      const x = simulada(sus) || !sus.mp_preapproval_id ? { ok: true, detalle: "" } : await cancelarEnMP(c, sus.mp_preapproval_id).catch((e) => ({ ok: false, detalle: (e as Error).message }));
      await cambiar(c, sus.id, x.ok ? { ...base, mp_estado: "cancelled", cancelada_mp_en: ya(), mp_error: null } : { ...base, mp_error: sinCorreos(x.detalle).slice(0, 300) });
      if (!x.ok) await marcarRevisar(c, sus, "No se pudo cancelar en Mercado Pago: cancélala a mano en tu cuenta de Mercado Pago para que no se cobre");
      return x.ok ? "cancelada_en_mercadopago" : "falta_cancelar_en_mercadopago";
    }
    // Viva: se anota la fecha del próximo cobro que dice Mercado Pago (mientras está en gracia, el periodo no se toca).
    if (pre.proximo && sus.estado === "activa" && ms(pre.proximo) > Date.now()) base.proximo_cobro = pre.proximo;
    await cambiar(c, sus.id, base);
    return "al_dia";
  }
  await cambiar(c, sus.id, base);
  if (pre.estado === "paused" && VIVAS.includes(sus.estado) && sus.estado !== "pendiente") await marcarRevisar(c, sus, "Mercado Pago tiene esta suscripción en pausa: revísala en tu cuenta de Mercado Pago");
  return pre.estado || "sin_estado";
}
/** Mercado Pago canceló la suscripción (la familia desde su cuenta de Mercado Pago, Daniel desde la suya, o Mercado Pago
 *  tras 3 cuotas rechazadas). Con periodo vigente queda «cancelada»; si ya no tenía nada pagado, «vencida». */
async function terminarPorMP(c: CtxCuenta, sus: Sus): Promise<string> {
  const vigente = Number.isFinite(ms(sus.periodo_fin)) && ms(sus.periodo_fin) > Date.now() && sus.estado !== "en_gracia";
  const cambios = vigente
    ? { estado: "cancelada", cancelada_en: ya(), cancelada_por: "mercadopago", cancelada_mp_en: ya(), proximo_cobro: null }
    : { estado: "vencida", vencida_en: ya(), motivo_fin: "cancelada_por_mercadopago", cancelada_mp_en: ya(), proximo_cobro: null };
  const { data: ganada } = await c.supabase.from("suscripciones").update({ ...cambios, actualizada_en: ya() }).eq("id", sus.id).in("estado", ["en_prueba", "activa", "en_gracia"]).select("*");
  if (!ganada?.length) return "ya_atendida";
  const cuenta = await cuentaDe(c, sus.cuenta_id);
  c.enSegundoPlano(avisarFamilia(c, cuenta, vigente ? mCanceladaEnMP(sus.periodo_fin) : mVencida()));
  c.enSegundoPlano(avisarDaniel(c, sus, "SparkEd: una suscripción se canceló en Mercado Pago", `<p>Mercado Pago reporta cancelada una suscripción (la canceló la familia desde su cuenta de Mercado Pago, tú desde la tuya, o Mercado Pago después de varios cobros rechazados). ${vigente ? `Sigue activa hasta el ${escHtml(fechaLarga(sus.periodo_fin))}.` : "Ya no tenía nada pagado: quedó vencida."}</p><p>${quien(cuenta)}</p>`));
  return vigente ? "cancelada" : "vencida";
}
/** Un cobro falló (o no llegó): la suscripción queda «en gracia». Abre sus guías; no crea nuevas. */
async function pasarAGracia(c: CtxCuenta, sus: Sus, op: { desdeMs?: number } = {}): Promise<boolean> {
  const desde = op.desdeMs ?? Date.now();
  const { data: ganada } = await c.supabase.from("suscripciones").update({ estado: "en_gracia", gracia_desde: iso(desde), gracia_hasta: iso(desde + GRACIA_DIAS * DIA), actualizada_en: ya() }).eq("id", sus.id).in("estado", ["pendiente", "en_prueba", "activa"]).select("*");
  if (!ganada?.length) return false;
  await alargarGuias(c, ganada[0] as Sus).catch(() => 0);
  const cuenta = await cuentaDe(c, sus.cuenta_id);
  c.enSegundoPlano(avisarFamilia(c, cuenta, mCobroFallido(sus.estado === "pendiente")));
  c.enSegundoPlano(avisarDaniel(c, sus, "SparkEd: no se pudo cobrar una suscripción", `<p>Un cobro de suscripción no pasó. La suscripción quedó «en gracia»: la familia puede abrir sus guías, pero no crear guías nuevas. Mercado Pago lo reintenta solo; si en ${GRACIA_DIAS} días no se cobra, queda vencida.</p><p>${quien(cuenta)}</p>`));
  return true;
}
/** Se acabó la gracia sin cobro: queda «vencida» y se cancela en Mercado Pago para que ya no intente cobrar. */
async function vencer(c: CtxCuenta, sus: Sus): Promise<boolean> {
  const { data: ganada } = await c.supabase.from("suscripciones").update({ estado: "vencida", vencida_en: ya(), motivo_fin: "sin_pago", proximo_cobro: null, actualizada_en: ya() }).eq("id", sus.id).eq("estado", "en_gracia").select("id");
  if (!ganada?.length) return false;
  if (simulada(sus)) await cambiar(c, sus.id, { mp_estado: "cancelled", cancelada_mp_en: ya() });
  else if (sus.mp_preapproval_id && c.mpToken()) {
    const x = await cancelarEnMP(c, sus.mp_preapproval_id).catch((e) => ({ ok: false, detalle: (e as Error).message }));
    await cambiar(c, sus.id, x.ok ? { mp_estado: "cancelled", cancelada_mp_en: ya() } : { mp_error: sinCorreos(x.detalle).slice(0, 300) });
    if (!x.ok) await marcarRevisar(c, sus, "Venció y no se pudo cancelar en Mercado Pago: cancélala a mano en tu cuenta de Mercado Pago para que no se cobre");
  }
  const cuenta = await cuentaDe(c, sus.cuenta_id);
  c.enSegundoPlano(avisarFamilia(c, cuenta, mVencida()));
  c.enSegundoPlano(avisarDaniel(c, sus, "SparkEd: una suscripción venció por falta de pago", `<p>Pasaron ${GRACIA_DIAS} días sin poder cobrar una suscripción: quedó vencida y ya no se le cobra nada.</p><p>${quien(cuenta)}</p>`));
  return true;
}
/** Cancelar: un solo paso. La suscripción deja de cobrarse y conserva lo pagado hasta el fin del periodo, sin reembolso.
 *  Si Mercado Pago no responde, la cancelación vale igual: se reintenta (tarea diaria) y se le avisa a Daniel. */
export async function cancelar(c: CtxCuenta, sus0: Sus, por: "familia" | "daniel" | "sistema"): Promise<{ ok: boolean; ya: boolean; estado: string; hasta: string | null; folio: string; cancelada_en: string | null; en_mercadopago: boolean }> {
  const sus = (await porId(c, sus0.id)) ?? sus0;
  const vigencia = (s: Sus) => (derechos({ ...s, estado: "cancelada" }).crear && s.estado !== "en_gracia" && s.estado !== "pendiente" ? s.periodo_fin : null);
  if (!VIVAS.includes(sus.estado)) return { ok: true, ya: true, estado: sus.estado, hasta: sus.estado === "cancelada" ? vigencia(sus) : null, folio: folioDe(sus.id), cancelada_en: sus.cancelada_en, en_mercadopago: !!sus.cancelada_mp_en };
  // Una que nunca se terminó de contratar (sin tarjeta en Mercado Pago) no es una cancelación: se abandona.
  const sinContratar = sus.estado === "pendiente" && sus.mp_estado !== "authorized";
  const cuando = ya();
  const { data: ganada } = await c.supabase.from("suscripciones").update({ estado: sinContratar ? "abandonada" : "cancelada", motivo_fin: sinContratar ? "cancelada_sin_terminar" : sus.motivo_fin, cancelada_en: cuando, cancelada_por: por, proximo_cobro: null, gracia_desde: null, gracia_hasta: null, actualizada_en: cuando }).eq("id", sus.id).in("estado", VIVAS).select("*");
  if (!ganada?.length) { const s = (await porId(c, sus.id)) ?? sus; return { ok: true, ya: true, estado: s.estado, hasta: s.estado === "cancelada" ? vigencia(s) : null, folio: folioDe(s.id), cancelada_en: s.cancelada_en, en_mercadopago: !!s.cancelada_mp_en }; }
  const hasta = sinContratar ? null : vigencia(sus);
  let enMP = simulada(sus) || !sus.mp_preapproval_id;
  if (!enMP) {
    const x = c.mpToken() ? await cancelarEnMP(c, sus.mp_preapproval_id!).catch((e) => ({ ok: false, detalle: (e as Error).message })) : { ok: false, detalle: "sin llave de Mercado Pago" };
    enMP = x.ok;
    if (!x.ok) {
      await cambiar(c, sus.id, { mp_error: sinCorreos(x.detalle).slice(0, 300), revisar: true, revisar_motivo: "La familia canceló y no se pudo cancelar en Mercado Pago: cancélala a mano en tu cuenta de Mercado Pago para que no se cobre" });
      c.enSegundoPlano(avisoEnPanel(c, sus, `SUSCRIPCIÓN · Una cancelación no se pudo aplicar en Mercado Pago (folio ${folioDe(sus.id)}). Se volverá a intentar; si sigue así, cancélala a mano en tu cuenta de Mercado Pago (Suscripciones) para que no se le cobre a la familia.`, "⚠️ SparkEd: una cancelación no se pudo aplicar en Mercado Pago"));
    }
  }
  if (enMP) await cambiar(c, sus.id, { mp_estado: "cancelled", cancelada_mp_en: ya(), mp_error: null });
  if (!sinContratar) {
    const cuenta = await cuentaDe(c, sus.cuenta_id);
    c.enSegundoPlano(avisarFamilia(c, cuenta, mCancelada(sus, hasta, cuando)));
    c.enSegundoPlano(avisarDaniel(c, sus, "SparkEd: una suscripción se canceló", `<p>${por === "daniel" ? "Cancelaste una suscripción desde el panel" : por === "sistema" ? "El sistema canceló una suscripción" : "Una familia canceló su suscripción"}. ${hasta ? `Sigue activa hasta el ${escHtml(fechaLarga(hasta))}; después ya no se cobra.` : "Ya no tenía nada pagado."}</p><p>${quien(cuenta)}</p>`));
  }
  return { ok: true, ya: false, estado: sinContratar ? "abandonada" : "cancelada", hasta, folio: folioDe(sus.id), cancelada_en: cuando, en_mercadopago: enMP };
}

// ---------- Cobros ----------
const metodoDe = (p: any) => (["credit_card", "debit_card", "prepaid_card"].includes(String(p?.payment_type_id ?? "")) ? "tarjeta" : String(p?.payment_type_id ?? "") === "account_money" ? "mercadopago" : texto(p?.payment_method_id ?? p?.payment_type_id ?? "", 30) || null);
/** Aplica un pago de Mercado Pago a su suscripción. Idempotente: la base anota cada pago una sola vez y solo la primera
 *  vez que queda aprobado alarga el periodo (sparked_registrar_cobro). proximo: solo en pruebas (la fecha del próximo cobro). */
export async function aplicarPago(c: CtxCuenta, sus0: Sus, p: any, facturaId: string | null = null, op: { proximo?: string | null } = {}): Promise<string> {
  if (p?.id === undefined || p?.id === null || String(p.id) === "") return "sin_pago";
  const sus = (await porId(c, sus0.id)) ?? sus0;
  const monto = Number(p.transaction_amount ?? 0) || 0, precio = Number(sus.precio_mxn) || 0, moneda = String(p.currency_id ?? "MXN").toUpperCase();
  const estado = estadoDeCobro(p), huellas = await huellasDePago(p);
  const esMensualidad = moneda === "MXN" && monto + 0.01 >= precio;
  if (!esMensualidad && monto < precio * 0.2) {
    // El cobro mínimo con el que Mercado Pago comprueba la tarjeta (y que devuelve solo) no es una mensualidad. Sirve
    // para la regla de una prueba gratis por tarjeta.
    if (sus.con_prueba && huellas.length && ["pendiente", "en_prueba"].includes(sus.estado)) {
      if (await huellasRepetidas(c, huellas, sus)) return (await negarPrueba(c, sus, await cuentaDe(c, sus.cuenta_id))) ? "prueba_negada" : "validacion_de_tarjeta";
      if (sus.estado === "en_prueba") await anotarPrueba(c, sus, null, huellas, false);
    }
    return "validacion_de_tarjeta";
  }
  let proximo: string | null = op.proximo ?? null;
  if (estado === "aprobado" && esMensualidad && !proximo && !simulada(sus) && sus.mp_preapproval_id) {
    try { const r = await c.mp(`/preapproval/${encodeURIComponent(sus.mp_preapproval_id)}`); if (r.ok) proximo = leerPreapproval(r.datos).proximo; } catch { /* sin la fecha de Mercado Pago, la base suma un mes */ }
  }
  const { data, error } = await c.supabase.rpc("sparked_registrar_cobro", {
    p_suscripcion: sus.id, p_mp_payment_id: String(p.id), p_mp_factura_id: facturaId, p_mp_estado: texto(p.status, 30) || null, p_mp_detalle: texto(p.status_detail, 80) || null,
    p_estado: esMensualidad ? estado : "revisar", p_monto: monto, p_metodo: metodoDe(p), p_cobrado_en: fechaValida(p.date_approved ?? p.date_created) ?? ya(), p_periodo_hasta: proximo,
  });
  if (error) throw error;
  const r = Array.isArray(data) ? data[0] : null;
  if (!r) return "sin_suscripcion";
  if (!esMensualidad) {
    if (r.res_nuevo) { await marcarRevisar(c, sus, `Llegó un pago de ${dinero(monto)} que no es la mensualidad (${dinero(precio)}): revísalo en Mercado Pago`); c.enSegundoPlano(avisoEnPanel(c, sus, `SUSCRIPCIÓN · Llegó un pago de ${dinero(monto)} que no coincide con la mensualidad (folio ${folioDe(sus.id)}). No se alargó el periodo: revísalo en Mercado Pago.`, "⚠️ SparkEd: un cobro de suscripción con un monto distinto")); }
    return "revisar_monto";
  }
  if (r.res_aplicado) { await despuesDeCobro(c, sus, p, r, monto, huellas); return "cobrado"; }
  if (estado === "rechazado" && r.res_estado_anterior !== "rechazado") { await pasarAGracia(c, sus); return "rechazado"; }
  if (estado === "reembolsado" && r.res_estado_anterior !== "reembolsado") {
    await marcarRevisar(c, sus, `Un cobro de ${dinero(monto)} se reembolsó o tuvo un contracargo: ya no cuenta como venta`);
    c.enSegundoPlano(avisoEnPanel(c, sus, `SUSCRIPCIÓN · Un cobro de ${dinero(monto)} se reembolsó o tuvo un contracargo (folio ${folioDe(sus.id)}). Ya no cuenta como venta; la suscripción no cambió: decide tú si la cancelas.`, "SparkEd: un cobro de suscripción se reembolsó"));
    return "reembolsado";
  }
  return r.res_nuevo ? estado : "sin_cambios";
}
/** Lo que pasa la primera vez que un cobro queda aprobado: avisos, guías alargadas y banderas. */
async function despuesDeCobro(c: CtxCuenta, antes: Sus, p: any, r: any, monto: number, huellas: string[]) {
  const ahora = (await porId(c, antes.id)) ?? antes, cuenta = await cuentaDe(c, antes.cuenta_id);
  const fin = String(r.res_periodo_fin ?? ahora.periodo_fin ?? "");
  if (antes.con_prueba && huellas.length) {
    if (await huellasRepetidas(c, huellas, antes)) await marcarRevisar(c, antes, "Esta tarjeta ya había usado una prueba gratis en otra cuenta");
    await anotarPrueba(c, antes, null, huellas, false);
  }
  if (antes.con_prueba && antes.estado === "en_prueba" && Number.isFinite(ms(antes.prueba_hasta)) && ms(p.date_approved ?? p.date_created) < ms(antes.prueba_hasta) - 36 * HORA) {
    await marcarRevisar(c, antes, "Mercado Pago cobró antes de que terminara la prueba gratis: revisa si hay que reembolsar");
    c.enSegundoPlano(avisoEnPanel(c, antes, `SUSCRIPCIÓN · Mercado Pago cobró ${dinero(monto)} antes de que terminara la prueba gratis (folio ${folioDe(antes.id)}). Revisa en Mercado Pago si hay que reembolsarlo.`, "⚠️ SparkEd: un cobro llegó durante la prueba gratis"));
  }
  if (r.res_antes === "cancelada" || r.res_ahora !== "activa") {
    // Llegó un cobro a una suscripción que ya no debía cobrarse: conserva el mes que pagó y se vuelve a pedir la cancelación.
    await marcarRevisar(c, antes, `Llegó un cobro de ${dinero(monto)} después de cancelar: revisa si hay que reembolsarlo`);
    c.enSegundoPlano(avisoEnPanel(c, antes, `SUSCRIPCIÓN · Llegó un cobro de ${dinero(monto)} a una suscripción ${r.res_antes === "cancelada" ? "cancelada" : "que ya había terminado"} (folio ${folioDe(antes.id)}). Revisa en Mercado Pago si hay que reembolsarlo y que la suscripción esté cancelada ahí.`, "⚠️ SparkEd: llegó un cobro después de cancelar"));
    if (!simulada(antes) && antes.mp_preapproval_id) { const x = await cancelarEnMP(c, antes.mp_preapproval_id).catch(() => ({ ok: false })); if (x.ok) await cambiar(c, antes.id, { mp_estado: "cancelled", cancelada_mp_en: ya() }); }
  }
  await alargarGuias(c, ahora).catch(() => 0);
  if (r.res_ahora === "activa") c.enSegundoPlano(avisarFamilia(c, cuenta, mCobro(String(r.res_antes), fin, monto)));
  c.enSegundoPlano(avisarDaniel(c, antes, "Venta SparkEd: suscripción de guías ilimitadas", `<p>Cobro de suscripción aprobado por Mercado Pago: <b>${escHtml(dinero(monto))}</b>${r.res_antes === "en_prueba" ? " (primer cobro, al terminar la prueba gratis)" : r.res_antes === "pendiente" ? " (primer cobro)" : " (renovación)"}. Pagada hasta el ${escHtml(fechaLarga(fin))}.</p><p>${quien(cuenta)}</p>`));
}
/** Una cuota de Mercado Pago (GET /authorized_payments/:id): si ya trae un pago, se aplica ese pago. */
async function aplicarFactura(c: CtxCuenta, sus: Sus, f: any): Promise<string> {
  const pid = f?.payment?.id != null ? String(f.payment.id) : "";
  if (!/^\d{1,20}$/.test(pid)) return "cuota_sin_pago";
  const r = await c.mp(`/v1/payments/${pid}`);
  if (r.status === 404) return "pago_inexistente";
  if (!r.ok) throw new Error(`Mercado Pago respondió ${r.status} al consultar el pago de una cuota`);
  return await aplicarPago(c, sus, r.datos, f?.id != null ? String(f.id) : null);
}
/** Pregunta a Mercado Pago por la suscripción y por sus cobros, y aplica lo que encuentre (por si un aviso no llegó). */
export async function sincronizar(c: CtxCuenta, sus0: Sus): Promise<string> {
  if (simulada(sus0) || !sus0.mp_preapproval_id) return "sin_mercadopago";
  const id = encodeURIComponent(sus0.mp_preapproval_id);
  const r = await c.mp(`/preapproval/${id}`);
  if (!r.ok) throw new Error(`Mercado Pago respondió ${r.status} al consultar la suscripción`);
  const resultado = await aplicarPreapproval(c, sus0, r.datos);
  const { data: conocidos } = await c.supabase.from("suscripcion_cobros").select("mp_payment_id, mp_estado").eq("suscripcion_id", sus0.id).limit(200);
  const yaIgual = (pid: unknown, estado: unknown) => ((conocidos ?? []) as any[]).some((x) => String(x.mp_payment_id) === String(pid) && String(x.mp_estado ?? "") === String(estado ?? ""));
  const vistos = new Set<string>();
  // Los pagos que llevan la referencia de esta suscripción (incluye el cobro mínimo de validación de la tarjeta)…
  try {
    const p = await c.mp(`/v1/payments/search?external_reference=${encodeURIComponent(sus0.id)}&sort=date_created&criteria=asc&limit=30`);
    for (const x of (p.ok ? p.datos?.results ?? [] : []) as any[]) { vistos.add(String(x.id)); if (!yaIgual(x.id, x.status)) await aplicarPago(c, (await porId(c, sus0.id)) ?? sus0, x); }
  } catch (e) { console.warn("pagos de la suscripción:", (e as Error).message); }
  // …y las cuotas de la suscripción, por si sus pagos no llevan la referencia.
  try {
    const f = await c.mp(`/authorized_payments/search?preapproval_id=${id}&limit=30`);
    for (const x of (f.ok ? f.datos?.results ?? [] : []) as any[]) { const pid = x?.payment?.id; if (pid == null || vistos.has(String(pid)) || yaIgual(pid, x.payment.status)) continue; await aplicarFactura(c, (await porId(c, sus0.id)) ?? sus0, x); }
  } catch (e) { console.warn("cuotas de la suscripción:", (e as Error).message); }
  return resultado;
}

// ---------- Avisos de Mercado Pago (los llama index.ts desde POST /pago/mercadopago, con la firma ya validada) ----------
type RespAviso = { status: number; cuerpo: Record<string, unknown> };
/** Temas «Planes y suscripciones»: subscription_preapproval (la suscripción cambió) y subscription_authorized_payment
 *  (una cuota). El aviso solo trae un id: todo lo demás se le pregunta a Mercado Pago con nuestra llave. */
export async function avisoSuscripcionMP(c: CtxCuenta, tipo: string, id: string): Promise<RespAviso> {
  const ignorado = (que: string): RespAviso => ({ status: 200, cuerpo: { ok: true, ignorado: que } });
  if (!id) return ignorado("sin_id");
  if (!c.mpToken()) return { status: 503, cuerpo: { error: "El motor de pagos aún no está configurado" } };
  if (tipo === "subscription_preapproval") {
    if (!/^[A-Za-z0-9_-]{6,64}$/.test(id)) return ignorado("id_no_valido");
    const r = await c.mp(`/preapproval/${encodeURIComponent(id)}`);
    if (r.status === 404) return ignorado("suscripcion_inexistente");
    if (!r.ok) return { status: 502, cuerpo: { error: `Mercado Pago respondió ${r.status}` } };
    const ref = String(r.datos?.external_reference ?? "");
    const sus = ((await c.supabase.from("suscripciones").select("*").eq("mp_preapproval_id", String(r.datos?.id ?? id)).maybeSingle()).data as Sus | null) ?? (esUuid(ref) ? await porId(c, ref) : null);
    if (!sus) return ignorado("sin_suscripcion");
    return { status: 200, cuerpo: { ok: true, suscripcion: true, resultado: await aplicarPreapproval(c, sus, r.datos) } };
  }
  if (tipo === "subscription_authorized_payment") {
    if (!/^\d{1,20}$/.test(id)) return ignorado("id_no_valido");
    const r = await c.mp(`/authorized_payments/${id}`);
    if (r.status === 404) return ignorado("cuota_inexistente");
    if (!r.ok) return { status: 502, cuerpo: { error: `Mercado Pago respondió ${r.status}` } };
    const pre = String(r.datos?.preapproval_id ?? ""), ref = String(r.datos?.external_reference ?? "");
    const sus = (pre ? ((await c.supabase.from("suscripciones").select("*").eq("mp_preapproval_id", pre).maybeSingle()).data as Sus | null) : null) ?? (esUuid(ref) ? await porId(c, ref) : null);
    if (!sus) return ignorado("sin_suscripcion");
    return { status: 200, cuerpo: { ok: true, suscripcion: true, resultado: await aplicarFactura(c, sus, r.datos) } };
  }
  return ignorado(tipo || "sin_tipo");
}
/** Tema «Pagos»: si el pago es el cobro de una suscripción, lo aplica y devuelve el resultado; si no lo es, devuelve null
 *  y el pago sigue su camino de siempre (la compra de una guía o de un paquete). */
export async function pagoSiEsDeSuscripcion(c: CtxCuenta, p: any): Promise<string | null> {
  const ref = String(p?.external_reference ?? "");
  const pre = [p?.metadata?.preapproval_id, p?.point_of_interaction?.transaction_data?.subscription_id, p?.preapproval_id].map((x) => String(x ?? "")).find((x) => /^[A-Za-z0-9_-]{6,64}$/.test(x)) ?? "";
  let sus: Sus | null = esUuid(ref) ? await porId(c, ref) : null;
  if (!sus && pre) sus = ((await c.supabase.from("suscripciones").select("*").eq("mp_preapproval_id", pre).maybeSingle()).data as Sus | null) ?? null;
  if (!sus) return null;
  return await aplicarPago(c, sus, p);
}

// ---------- Lo que ve la familia ----------
const revisadas = new Map<string, number>();
function tocaRevisar(id: string): boolean {
  const antes = revisadas.get(id) ?? 0;
  if (Date.now() - antes < 15_000) return false;
  if (revisadas.size > 500) revisadas.clear();
  revisadas.set(id, Date.now());
  return true;
}
function paraFamilia(s: Sus, ahora: number) {
  const d = derechos(s, ahora), pendiente = s.estado === "pendiente";
  return {
    id: s.id, folio: folioDe(s.id), estado: s.estado, precio: Number(s.precio_mxn) || 0, con_prueba: s.con_prueba === true,
    prueba_hasta: s.estado === "en_prueba" ? s.prueba_hasta ?? s.periodo_fin : null, periodo_fin: s.periodo_fin, proximo_cobro: s.estado === "en_prueba" || s.estado === "activa" ? s.proximo_cobro : null,
    primer_cobro_en: pendiente ? s.primer_cobro_en : null, gracia_hasta: s.estado === "en_gracia" ? s.gracia_hasta : null, cancelada_en: s.cancelada_en,
    hasta: d.crear ? d.hasta : null, puede_crear: d.crear, puede_cancelar: VIVAS.includes(s.estado),
    // pendiente: falta la tarjeta en Mercado Pago («tarjeta») o falta que llegue el primer cobro («cobro»).
    falta: pendiente ? (s.mp_estado === "authorized" ? "cobro" : "tarjeta") : null,
    link_pago: pendiente && s.mp_estado !== "authorized" ? s.mp_init_point : null,
    motivo_fin: s.estado === "vencida" || s.estado === "abandonada" ? s.motivo_fin : null,
  };
}
/** Lo que el sitio necesita saber sin sesión (GET /suscripcion/info y GET /paquete/info): solo si está abierta al público. */
export function infoSuscripcion(cfg: Record<string, string> | null | undefined) {
  const aj = ajustesSuscripcion(cfg);
  return { disponible: aj.modo === "si", precio: aj.precio, prueba_dias: aj.pruebaDias };
}
/** La parte de «Mi cuenta» (GET /cuenta) que habla de la suscripción. */
export async function resumenSuscripcion(c: CtxBase, cuenta: CuentaSus) {
  const [cfg, lista] = await Promise.all([c.config(), deCuenta(c, cuenta.id)]);
  const aj = ajustesSuscripcion(cfg), ahora = Date.now();
  const viva = lista.find((s) => VIVAS.includes(s.estado)), actual = elegirActual(lista, ahora);
  const disponible = puedeSuscribirse(aj, cuenta.telefono) && (!viva || (viva.estado === "pendiente" && viva.mp_estado !== "authorized"));
  const pagadaHasta = Math.max(0, ...lista.map((s) => finPagado(s, ahora)));
  let conPrueba = false;
  if (disponible && !pagadaHasta) { const fresca = await cuentaDe(c, cuenta.id); conPrueba = !!fresca && !(await pruebaYaUsada(c, fresca)); }
  return {
    disponible, precio: aj.precio, prueba_dias: aj.pruebaDias, con_prueba: conPrueba,
    // Si vuelve a suscribirse antes de que termine lo que ya pagó, el primer cobro es ese día.
    primer_cobro_en: disponible && pagadaHasta ? iso(pagadaHasta) : null,
    actual: actual ? paraFamilia(actual, ahora) : null,
  };
}
/** Hasta cuándo llega lo que esta suscripción cancelada ya tiene PAGADO (0 si no tiene nada pagado por delante). Una
 *  prueba gratis cancelada no cuenta como pagada. */
function finPagado(s: Sus, ahora: number): number {
  const fin = ms(s.periodo_fin);
  if (s.estado !== "cancelada" || !Number.isFinite(fin) || fin - ahora < 2 * HORA) return 0;
  if (s.con_prueba && (!Number.isFinite(ms(s.prueba_hasta)) || fin <= ms(s.prueba_hasta) + DIA)) return 0;
  return fin;
}
/** ¿Se puede contratar ahora con esta cuenta? Apagada o fuera de la lista de probadores, solo pasa una cuenta de prueba
 *  que venga con la clave de administrador (las pruebas automáticas). */
async function abiertaPara(c: CtxRutasCuenta, aj: AjustesSus, cuenta: CuentaSus): Promise<boolean> {
  if (puedeSuscribirse(aj, cuenta.telefono)) return true;
  return cuenta.de_prueba === true && c.req.headers.has("x-admin-key") && await c.esAdmin();
}

// POST /suscripcion/crear { acepta: true, nombre?, correo?, correo_pago? } → la página de Mercado Pago para poner la tarjeta.
export async function crearSuscripcion(c: CtxRutasCuenta, cuenta: CuentaSus, canalSesion: string | null): Promise<Response> {
  const b = await c.leerJson(c.req);
  const aj = ajustesSuscripcion(await c.config());
  if (!(await abiertaPara(c, aj, cuenta))) return c.error(MSG_NO_DISPONIBLE, 503);
  if (b.acepta !== true) return c.json({ error: "Para suscribirte, marca la casilla del cobro automático.", campo: "acepta" }, 400);
  const nombre = texto(b.nombre, 80) || String(cuenta.nombre ?? "");
  // El correo de respaldo de la cuenta solo lo cambia una sesión comprobada por WhatsApp (o una cuenta que no tiene correo).
  const escrito = correoLimpio(b.correo);
  const correo = escrito && (canalSesion === "whatsapp" || !cuenta.correo) ? escrito : String(cuenta.correo ?? "") || escrito;
  if (nombre.length < 2) return c.json({ error: "Escribe tu nombre.", campo: "nombre" }, 400);
  if (!esCorreo(correo)) return c.json({ error: "Escribe un correo válido.", campo: "correo" }, 400);
  // Mercado Pago rechaza el pago si el correo no es el de quien paga: por eso se puede indicar otro solo para el cobro.
  // Vacío (o el correo a medias que enseña «Mi cuenta», que no es un correo) = el correo de la cuenta.
  const pagoEscrito = String(b.correo_pago ?? "").trim();
  const correoPago = !pagoEscrito || pagoEscrito.includes("•") ? correo : correoLimpio(pagoEscrito);
  if (!correoPago) return c.json({ error: "Escribe un correo válido.", campo: "correo_pago" }, 400);
  const cambios: Record<string, unknown> = {};
  if (nombre !== (cuenta.nombre ?? "")) cambios.nombre = nombre;
  if (correo !== (cuenta.correo ?? "")) { cambios.correo = correo; cambios.correo_verificado_en = null; }
  if (Object.keys(cambios).length) { await c.supabase.from("cuentas").update(cambios).eq("id", cuenta.id); Object.assign(cuenta, cambios); }

  const ahora = Date.now(), lista = await deCuenta(c, cuenta.id);
  const viva = lista.find((s) => VIVAS.includes(s.estado));
  if (viva && viva.estado !== "pendiente") return c.json({ error: MSG_YA, ya: true }, 409);
  // Prueba gratis: una sola por WhatsApp (la tarjeta se revisa cuando Mercado Pago la deja ver). Si vuelve antes de que
  // termine lo que ya pagó, no hay prueba y el primer cobro es el día en que termina lo pagado.
  const condiciones = async (todas: Sus[]) => {
    const pagada = Math.max(0, ...todas.map((s) => finPagado(s, ahora)));
    const prueba = !pagada && !(await pruebaYaUsada(c, (await cuentaDe(c, cuenta.id)) ?? cuenta));
    return { conPrueba: prueba, primerCobroMs: pagada || (prueba ? ahora + aj.pruebaDias * DIA : 0) };
  };
  let { conPrueba, primerCobroMs } = await condiciones(lista);
  const respuesta = (s: Sus, modo: string, extra: Record<string, unknown> = {}) => c.json({ modo, url: s.mp_init_point, suscripcion_id: s.id, folio: folioDe(s.id), con_prueba: s.con_prueba === true, primer_cobro_en: s.primer_cobro_en, precio: Number(s.precio_mxn), ...extra });
  if (viva) {
    if (viva.mp_estado === "authorized") return respuesta(viva, "confirmando");
    const reciente = ahora - ms(viva.creada_en) < 2 * HORA;
    // Dos clics seguidos: la primera petición todavía está hablando con Mercado Pago.
    if (!viva.mp_init_point && ahora - ms(viva.creada_en) < 60_000) return c.error("Ya estamos preparando tu suscripción. Espera unos segundos y vuelve a intentar.", 409);
    const igual = reciente && !!viva.mp_init_point && Number(viva.precio_mxn) === aj.precio && (viva.correo_pago ?? "") === correoPago && viva.con_prueba === conPrueba && !!viva.primer_cobro_en === !!primerCobroMs;
    if (igual) return respuesta(viva, simulada(viva) ? "simulada" : "mercadopago");
    // Antes de descartarla para abrir otra: ¿y si ya puso su tarjeta y el aviso todavía no llega? Se le pregunta a
    // Mercado Pago. Una suscripción ya autorizada (o ya cobrada) nunca se cancela por oprimir «Suscribirme» otra vez.
    if (!simulada(viva) && viva.mp_preapproval_id && c.mpToken()) {
      try { await sincronizar(c, viva); } catch (e) { console.warn("No se pudo revisar la suscripción anterior en Mercado Pago:", sinCorreos((e as Error).message)); }
      const fresca = (await porId(c, viva.id)) ?? viva;
      if (fresca.estado !== "pendiente" && VIVAS.includes(fresca.estado)) return c.json({ error: MSG_YA, ya: true }, 409);
      if (fresca.estado === "pendiente" && fresca.mp_estado === "authorized") return respuesta(fresca, "confirmando");
      // Al revisarla pudo cambiar algo (por ejemplo, se le negó la prueba gratis): las condiciones se calculan de nuevo.
      ({ conPrueba, primerCobroMs } = await condiciones(await deCuenta(c, cuenta.id)));
    }
    await abandonar(c, viva, "reemplazada");
  }
  const primerCobro = primerCobroMs ? iso(primerCobroMs) : null;
  const alta = await c.supabase.from("suscripciones").insert({
    cuenta_id: cuenta.id, estado: "pendiente", precio_mxn: aj.precio, correo_pago: correoPago, con_prueba: conPrueba, primer_cobro_en: primerCobro, prueba_hasta: conPrueba ? primerCobro : null,
    acepto_en: ya(), acepto_texto: textoAceptado(aj.precio, conPrueba, primerCobro), de_prueba: cuenta.de_prueba === true,
  }).select("*").single();
  if (alta.error) { if (alta.error.code === "23505") return c.json({ error: MSG_YA, ya: true }, 409); throw alta.error; }
  const sus = alta.data as Sus;
  if (simulada(sus)) {
    // Cuenta de prueba: no se toca Mercado Pago. Los avisos y los pagos se simulan con POST /admin/suscripciones/:id/prueba.
    const cambiosP = { mp_preapproval_id: "prueba-" + alAzar(24), mp_estado: "pending", mp_init_point: `${await c.sitio()}cuenta.html?suscripcion=${sus.id}` };
    await cambiar(c, sus.id, cambiosP);
    return respuesta({ ...sus, ...cambiosP } as Sus, "simulada");
  }
  if (!c.mpToken()) {
    await c.supabase.from("suscripciones").delete().eq("id", sus.id).eq("estado", "pendiente");
    return c.error("El cobro en línea no está disponible en este momento. Inténtalo de nuevo más tarde.", 503);
  }
  try {
    const mp = await crearEnMP(c, sus, { correo: correoPago, precio: aj.precio, primerCobroMs: primerCobroMs || null });
    const cambiosMP = { mp_preapproval_id: mp.id, mp_estado: "pending", mp_init_point: mp.url, mp_error: null, mp_revisado_en: ya() };
    await cambiar(c, sus.id, cambiosMP);
    return respuesta({ ...sus, ...cambiosMP } as Sus, "mercadopago");
  } catch (e) {
    const detalle = sinCorreos((e as Error).message).slice(0, 300);
    console.error("Mercado Pago no abrió la suscripción:", detalle);
    await c.supabase.from("suscripciones").update({ estado: "abandonada", motivo_fin: "mercadopago_no_respondio", mp_error: detalle, actualizada_en: ya() }).eq("id", sus.id).eq("estado", "pendiente");
    c.enSegundoPlano(avisoEnPanel(c, sus, `SUSCRIPCIÓN · Mercado Pago no pudo abrir una suscripción (folio ${folioDe(sus.id)}): ${detalle}. A la familia no se le cobró nada.`, "⚠️ SparkEd: Mercado Pago no pudo abrir una suscripción"));
    return c.error("En este momento Mercado Pago no pudo abrir tu suscripción. No se te cobró nada. Inténtalo de nuevo en unos minutos.", 502);
  }
}

// GET /suscripcion/estado → cómo va. Si falta que Mercado Pago confirme algo, se le pregunta (una vez cada 15 s).
export async function estadoSuscripcion(c: CtxRutasCuenta, cuenta: CuentaSus): Promise<Response> {
  const viva = (await deCuenta(c, cuenta.id)).find((s) => s.estado === "pendiente");
  if (viva && !simulada(viva) && viva.mp_preapproval_id && c.mpToken() && tocaRevisar(viva.id)) {
    try { await sincronizar(c, viva); } catch (e) { console.warn("No se pudo revisar la suscripción en Mercado Pago:", (e as Error).message); }
  }
  return c.json({ ok: true, suscripcion: await resumenSuscripcion(c, cuenta) });
}

// POST /suscripcion/cancelar → un clic. Conserva lo pagado hasta el fin del periodo; ya no se cobra nada.
export async function cancelarDeFamilia(c: CtxRutasCuenta, cuenta: CuentaSus): Promise<Response> {
  const lista = await deCuenta(c, cuenta.id);
  const sus = lista.find((s) => VIVAS.includes(s.estado)) ?? lista.find((s) => s.estado === "cancelada");
  if (!sus) return c.error("Tu cuenta no tiene ninguna suscripción que cancelar.", 404);
  const r = await cancelar(c, sus, "familia");
  return c.json({ ...r, mensaje: r.estado === "cancelada" ? textoCancelacion(r.hasta) : "Listo: no se contrató ninguna suscripción y no se te cobrará nada.", suscripcion: await resumenSuscripcion(c, cuenta) });
}

/** Solo cuentas de prueba: borra sus suscripciones, cobros y pruebas gratis anotadas (la usa DELETE /admin/cuentas/:id). */
export async function borrarSuscripcionesDePrueba(c: CtxBase, cuentaId: string): Promise<number> {
  const { data } = await c.supabase.from("suscripciones").select("id").eq("cuenta_id", cuentaId).eq("de_prueba", true);
  const ids = ((data ?? []) as any[]).map((x) => x.id);
  await c.supabase.from("pruebas_usadas").delete().eq("cuenta_id", cuentaId);
  if (!ids.length) return 0;
  await c.supabase.from("suscripcion_cobros").delete().in("suscripcion_id", ids);
  await c.supabase.from("suscripciones").delete().in("id", ids).eq("de_prueba", true);
  return ids.length;
}

// ---------- Tarea diaria ----------
/** Lo que hay que revisar una vez al día: confirmar con Mercado Pago, abandonar las que nunca se contrataron, avisar de
 *  la renovación 6 días antes de cada cobro, pasar a gracia las que no se cobraron y vencer las que agotaron su gracia.
 *  ahoraMs: fecha simulada (solo con soloPrueba: nunca se le adelanta el reloj a una familia). No imprime datos personales. */
export async function tareaDiaria(c: CtxCuenta, op: { ahoraMs?: number; soloPrueba?: boolean; sincronizar?: boolean } = {}) {
  const ahora = op.ahoraMs ?? Date.now(), T0 = Date.now();
  const R = { fecha: iso(ahora), solo_prueba: !!op.soloPrueba, revisadas: 0, sincronizadas: 0, abandonadas: 0, avisos_renovacion: 0, avisos_tarde: 0, a_gracia: 0, vencidas: 0, cancelaciones_confirmadas: 0, errores: [] as string[], sin_terminar: false };
  let q = c.supabase.from("suscripciones").select("*").in("estado", [...VIVAS, "cancelada"]).order("actualizada_en", { ascending: true }).limit(400);
  if (op.soloPrueba) q = q.eq("de_prueba", true);
  const { data, error } = await q;
  if (error) throw error;
  for (const s0 of (data ?? []) as Sus[]) {
    if (Date.now() - T0 > 100_000) { R.sin_terminar = true; break; }
    R.revisadas++;
    try {
      let s = s0;
      if (s.estado === "cancelada") {
        // Solo falta que Mercado Pago confirme que ya no cobra.
        if (!s.cancelada_mp_en && !simulada(s) && s.mp_preapproval_id && c.mpToken()) {
          const x = await cancelarEnMP(c, s.mp_preapproval_id);
          if (x.ok) { await cambiar(c, s.id, { mp_estado: "cancelled", cancelada_mp_en: ya(), mp_error: null }); R.cancelaciones_confirmadas++; }
          else R.errores.push(`${folioDe(s.id)}: sigue sin cancelarse en Mercado Pago (${texto(x.detalle, 100)})`);
        }
        continue;
      }
      if (op.sincronizar !== false && !simulada(s) && s.mp_preapproval_id && c.mpToken()) { await sincronizar(c, s); R.sincronizadas++; s = (await porId(c, s.id)) ?? s; }
      if (s.estado === "pendiente") {
        const edad = ahora - ms(s.creada_en);
        if (s.mp_estado !== "authorized") { if (edad > PENDIENTE_DIAS * DIA && await abandonar(c, s, "sin_terminar")) R.abandonadas++; }
        else if (edad > COLCHON_HORAS * HORA && await pasarAGracia(c, s, { desdeMs: ahora })) R.a_gracia++;   // autorizada y el primer cobro nunca llegó
        continue;
      }
      if (s.estado === "en_gracia") { if (Number.isFinite(ms(s.gracia_hasta)) && ahora >= ms(s.gracia_hasta) && await vencer(c, s)) R.vencidas++; continue; }
      if (s.estado !== "en_prueba" && s.estado !== "activa") continue;
      const fin = ms(s.periodo_fin), cobro = ms(s.proximo_cobro);
      if (Number.isFinite(fin) && ahora > fin + COLCHON_HORAS * HORA) { if (await pasarAGracia(c, s, { desdeMs: fin })) R.a_gracia++; continue; }
      // Ya se avisó de este cobro si la marca apunta a esa fecha (o a una casi igual: Mercado Pago puede moverla unas horas).
      const yaAvisado = Math.abs(ms(s.aviso_renovacion_para) - cobro) < 3 * DIA;
      if (Number.isFinite(cobro) && cobro > ahora && cobro - ahora <= AVISO_DIAS * DIA && !yaAvisado) {
        // Un aviso por cobro: gana quien cambia la marca desde el valor que leyó.
        let u = c.supabase.from("suscripciones").update({ aviso_renovacion_para: s.proximo_cobro, aviso_renovacion_en: ya(), actualizada_en: ya() }).eq("id", s.id).in("estado", ["en_prueba", "activa"]);
        u = s.aviso_renovacion_para === null || s.aviso_renovacion_para === undefined ? u.is("aviso_renovacion_para", null) : u.eq("aviso_renovacion_para", s.aviso_renovacion_para);
        const { data: ganada } = await u.select("id");
        if (ganada?.length) {
          R.avisos_renovacion++;
          if (cobro - ahora < 5 * DIA) R.avisos_tarde++;
          await avisarFamilia(c, await cuentaDe(c, s.cuenta_id), mRenovacion(s.proximo_cobro!, Number(s.precio_mxn)));
        }
      }
    } catch (e) { R.errores.push(`${folioDe(s0.id)}: ${texto(sinCorreos((e as Error).message), 160)}`); }
  }
  return R;
}

// ---------- Cifras para el Resumen del panel (index.ts) ----------
/** Un cobro de suscripción es venta con la misma regla de siempre (ventaCobrada): solo si Mercado Pago lo aprobó. */
export const cobroEsVenta = (x: { mp_estado?: string | null; de_prueba?: boolean | null }) => x.de_prueba !== true && ventaCobrada({ estado: "pagada", mp_estado: x.mp_estado ?? null });
export async function resumenSuscripciones(c: CtxBase, hoyIso: string, mesIso: string) {
  const [s, k] = await Promise.all([
    c.supabase.from("suscripciones").select("estado, periodo_fin, cancelada_en, vencida_en, de_prueba, revisar").limit(5000),
    c.supabase.from("suscripcion_cobros").select("mp_estado, monto_mxn, cobrado_en, de_prueba").gte("creado_en", new Date(new Date(mesIso).getTime() - 2 * DIA).toISOString()).limit(5000),
  ]);
  if (s.error) throw s.error;
  if (k.error) throw k.error;
  const S = ((s.data ?? []) as any[]).filter((x) => !x.de_prueba), K = ((k.data ?? []) as any[]).filter(cobroEsVenta), ahora = Date.now();
  const cuenta = (f: (x: any) => boolean) => S.filter(f).length;
  const suma = (arr: any[]) => arr.reduce((n, x) => n + (Number(x.monto_mxn) || 0), 0);
  const hoy = K.filter((x) => String(x.cobrado_en ?? "") >= hoyIso), mes = K.filter((x) => String(x.cobrado_en ?? "") >= mesIso);
  return {
    en_prueba: cuenta((x) => x.estado === "en_prueba"), activas: cuenta((x) => x.estado === "activa"), en_gracia: cuenta((x) => x.estado === "en_gracia"),
    canceladas_vigentes: cuenta((x) => x.estado === "cancelada" && ms(x.periodo_fin) > ahora), canceladas_mes: cuenta((x) => x.estado === "cancelada" && String(x.cancelada_en ?? "") >= mesIso),
    vencidas_mes: cuenta((x) => x.estado === "vencida" && String(x.vencida_en ?? "") >= mesIso), pendientes: cuenta((x) => x.estado === "pendiente"),
    cobros_hoy: hoy.length, ingresos_hoy: suma(hoy), cobros_mes: mes.length, ingresos_mes: suma(mes),
    por_revisar: cuenta((x) => x.revisar === true),   // banderas que Daniel todavía no mira (la marca del menú del panel)
  };
}

// ---------- Administración ----------
const CLAVES_CFG = ["sparked_suscripcion", "sparked_suscripcion_precio", "sparked_suscripcion_probadores"];
/** Los ajustes de la suscripción leídos directo de la base (sin la copia de un minuto que guarda cada servidor). */
async function ajustesFrescos(c: CtxBase): Promise<AjustesSus> {
  const { data } = await c.supabase.from("config").select("clave, valor").in("clave", CLAVES_CFG);
  return ajustesSuscripcion(Object.fromEntries(((data ?? []) as any[]).map((x) => [x.clave, String(x.valor ?? "")])));
}
const idProbador = async (tel: string) => (await sha256hex("sparked-probador:" + tel)).slice(0, 12);
async function probadoresParaPanel(lista: string[]) { return await Promise.all(lista.map(async (t) => ({ id: await idProbador(t), whatsapp: enmascararTelefono(t) }))); }
const ESTADOS_TEXTO: Record<string, string> = { pendiente: "Sin terminar de contratar", en_prueba: "En prueba gratis", activa: "Activa", en_gracia: "En gracia (cobro pendiente)", cancelada: "Cancelada", vencida: "Vencida (sin pago)", abandonada: "No se contrató" };

async function traerPorLotes(c: CtxBase, tabla: string, columnas: string, llave: string, ids: string[]): Promise<any[]> {
  const out: any[] = [];
  for (const lote of enLotes([...new Set(ids.filter(Boolean))], 80)) { const { data } = await c.supabase.from(tabla).select(columnas).in(llave, lote); out.push(...((data ?? []) as any[])); }
  return out;
}
// GET /admin/suscripciones → lo que Daniel necesita ver. El WhatsApp y el correo salen siempre enmascarados.
async function adminLista(c: CtxRutasCuenta): Promise<Response> {
  const [aj, susR, cobR, guiR] = await Promise.all([
    ajustesFrescos(c),
    c.supabase.from("suscripciones").select("*").order("creada_en", { ascending: false }).limit(1000),
    c.supabase.from("suscripcion_cobros").select("id, suscripcion_id, mp_estado, estado, monto_mxn, cobrado_en, periodo_hasta, de_prueba, creado_en").order("creado_en", { ascending: false }).limit(5000),
    c.supabase.from("compras").select("id, suscripcion_id, cuenta_id, estado, creada_en, grado, colegio_texto, guia_id, acceso_id").eq("metodo_pago", "suscripcion").order("creada_en", { ascending: false }).limit(3000),
  ]);
  for (const r of [susR, cobR, guiR]) if (r.error) throw r.error;
  const S = (susR.data ?? []) as Sus[], K = (cobR.data ?? []) as any[], G = (guiR.data ?? []) as any[];
  const [cuentas, costos, dispositivos] = await Promise.all([
    traerPorLotes(c, "cuentas", "id, telefono, correo, nombre, de_prueba", "id", S.map((s) => s.cuenta_id)),
    traerPorLotes(c, "guias", "id, costo_mxn", "id", G.slice(0, 800).map((g) => g.guia_id)),
    traerPorLotes(c, "acceso_dispositivos", "acceso_id", "acceso_id", G.slice(0, 800).map((g) => g.acceso_id)),
  ]);
  const { hoy, mes } = inicioDiaVentas(Date.now());
  const ahora = Date.now(), reales = S.filter((s) => !s.de_prueba), ventas = K.filter(cobroEsVenta);
  const sumaK = (arr: any[]) => arr.reduce((n, x) => n + (Number(x.monto_mxn) || 0), 0);
  const filas = S.slice(0, 300).map((s) => {
    const cta = cuentas.find((x) => x.id === s.cuenta_id), cobros = K.filter((x) => x.suscripcion_id === s.id), guias = G.filter((g) => g.suscripcion_id === s.id && g.estado !== "fallida");
    const delMes = guias.filter((g) => String(g.creada_en) >= mes), d = derechos(s, ahora);
    const grados = new Set(guias.map((g) => g.grado).filter(Boolean)), colegios = new Set(guias.map((g) => String(g.colegio_texto ?? "").trim().toLowerCase()).filter(Boolean));
    const nDisp = dispositivos.filter((x) => guias.some((g) => g.acceso_id === x.acceso_id)).length;
    const costo = guias.reduce((n, g) => n + (Number(costos.find((x) => x.id === g.guia_id)?.costo_mxn) || 0), 0);
    // Uso justo: sin topes. Solo se marca para que Daniel lo mire (decisión del 24 nov 2026).
    const avisos = [delMes.length > 20 ? `más de 20 guías este mes (${delMes.length})` : "", grados.size > 3 ? `${grados.size} grados distintos` : "", colegios.size > 2 ? `${colegios.size} colegios distintos` : "", nDisp > 6 ? `guías abiertas en ${nDisp} dispositivos` : ""].filter(Boolean);
    const motivos = [...String(s.revisar_motivo ?? "").split(" · ").filter(Boolean), ...avisos];
    return {
      id: s.id, folio: folioDe(s.id), estado: s.estado, estado_texto: ESTADOS_TEXTO[s.estado] ?? s.estado, de_prueba: s.de_prueba === true,
      nombre: primerNombre(cta?.nombre) || null, whatsapp: cta ? enmascararTelefono(cta.telefono) : null, correo: cta?.correo ? enmascararCorreo(cta.correo) : null,
      precio: Number(s.precio_mxn) || 0, con_prueba: s.con_prueba === true, creada_en: s.creada_en, prueba_hasta: s.prueba_hasta, periodo_fin: s.periodo_fin, proximo_cobro: s.proximo_cobro,
      gracia_hasta: s.gracia_hasta, cancelada_en: s.cancelada_en, cancelada_por: s.cancelada_por, vencida_en: s.vencida_en, motivo_fin: s.motivo_fin,
      // De qué cobro ya se avisó a la familia (la ley pide avisar al menos 5 días antes): lo usa la ronda de la guardia.
      aviso_renovacion_para: s.aviso_renovacion_para, aviso_renovacion_en: s.aviso_renovacion_en,
      puede_crear: d.crear, vigente_hasta: d.crear ? d.hasta : null, mp_estado: s.mp_estado, mp_medio: s.mp_medio, mp_error: s.mp_error, cancelada_en_mp: !!s.cancelada_mp_en,
      falta_cancelar_en_mp: ["cancelada", "vencida"].includes(s.estado) && !s.cancelada_mp_en && !!s.mp_preapproval_id && !s.de_prueba,
      revisar: s.revisar === true || avisos.length > 0, revisar_motivos: motivos,
      uso: { guias: guias.length, guias_mes: delMes.length, guias_hoy: guias.filter((g) => String(g.creada_en) >= hoy).length, grados: grados.size, colegios: colegios.size, dispositivos: nDisp, costo_ia_mxn: Math.round(costo * 100) / 100 },
      cobros: cobros.slice(0, 24).map((x) => ({ fecha: x.cobrado_en ?? x.creado_en, monto_mxn: Number(x.monto_mxn) || 0, estado: x.estado, es_venta: cobroEsVenta(x), pagado_hasta: x.periodo_hasta })),
      ingreso_mxn: sumaK(cobros.filter(cobroEsVenta)),
    };
  });
  const cuentaS = (f: (x: Sus) => boolean) => reales.filter(f).length;
  return c.json({
    ajustes: { modo: aj.modo, precio: aj.precio, prueba_dias: aj.pruebaDias, gracia_dias: GRACIA_DIAS, aviso_dias: AVISO_DIAS, probadores: await probadoresParaPanel(aj.probadores) },
    mercadopago: { encendido: !!c.mpToken(), prueba: c.mpPrueba() },
    resumen: {
      en_prueba: cuentaS((x) => x.estado === "en_prueba"), activas: cuentaS((x) => x.estado === "activa"), en_gracia: cuentaS((x) => x.estado === "en_gracia"),
      canceladas: cuentaS((x) => x.estado === "cancelada"), canceladas_vigentes: cuentaS((x) => x.estado === "cancelada" && derechos(x, ahora).crear), vencidas: cuentaS((x) => x.estado === "vencida"), pendientes: cuentaS((x) => x.estado === "pendiente"),
      cobros: ventas.length, ingreso_mxn: sumaK(ventas), cobros_mes: ventas.filter((x) => String(x.cobrado_en ?? "") >= mes).length, ingreso_mes_mxn: sumaK(ventas.filter((x) => String(x.cobrado_en ?? "") >= mes)),
      guias: G.filter((g) => g.estado !== "fallida" && reales.some((s) => s.id === g.suscripcion_id)).length, guias_mes: G.filter((g) => g.estado !== "fallida" && String(g.creada_en) >= mes && reales.some((s) => s.id === g.suscripcion_id)).length,
      por_revisar: filas.filter((x) => x.revisar && !x.de_prueba).length, de_prueba: S.length - reales.length,
    },
    suscripciones: filas,
  });
}
async function adminProbadores(c: CtxRutasCuenta): Promise<Response> {
  const b = await c.leerJson(c.req);
  let lista = (await ajustesFrescos(c)).probadores;
  if (b.agregar !== undefined) {
    const tel = c.limpiarTel(b.agregar);
    if (!tel) return c.error("Escribe un WhatsApp válido (en México, 10 dígitos).");
    if (lista.length >= 50 && !lista.includes(tel)) return c.error("La lista de probadores admite hasta 50 números.");
    lista = [...new Set([...lista, tel])];
  } else if (typeof b.quitar === "string") {
    const ids = await Promise.all(lista.map(idProbador));
    lista = lista.filter((_t, i) => ids[i] !== b.quitar);
  } else return c.error("Di qué número agregar o cuál quitar.");
  const { error } = await c.supabase.from("config").upsert({ clave: "sparked_suscripcion_probadores", valor: lista.join(",") });
  if (error) throw error;
  return c.json({ ok: true, probadores: await probadoresParaPanel(lista), nota: "El cambio puede tardar hasta un minuto en verse en el sitio." });
}
async function adminUna(c: CtxRutasCuenta, id: string, accion: string | undefined): Promise<Response | null> {
  const sus = await porId(c, id);
  if (!sus) return c.error("Esa suscripción no existe", 404);
  if (!accion && c.m === "GET") {
    const [cobros, guias, cuenta] = await Promise.all([
      c.supabase.from("suscripcion_cobros").select("mp_estado, mp_detalle, estado, monto_mxn, metodo, cobrado_en, periodo_desde, periodo_hasta, creado_en").eq("suscripcion_id", id).order("creado_en", { ascending: false }).limit(100),
      c.supabase.from("compras").select("id, estado, creada_en, entregada_en, grado, materia").eq("suscripcion_id", id).order("creada_en", { ascending: false }).limit(200),
      cuentaDe(c, sus.cuenta_id),
    ]);
    return c.json({ id, folio: folioDe(id), estado: sus.estado, estado_texto: ESTADOS_TEXTO[sus.estado] ?? sus.estado, de_prueba: sus.de_prueba === true, nombre: primerNombre(cuenta?.nombre) || null, whatsapp: cuenta ? enmascararTelefono(cuenta.telefono) : null, precio: Number(sus.precio_mxn) || 0, con_prueba: sus.con_prueba, creada_en: sus.creada_en, primer_cobro_en: sus.primer_cobro_en, prueba_hasta: sus.prueba_hasta, periodo_inicio: sus.periodo_inicio, periodo_fin: sus.periodo_fin, proximo_cobro: sus.proximo_cobro, aviso_renovacion_en: sus.aviso_renovacion_en, aviso_renovacion_para: sus.aviso_renovacion_para, gracia_desde: sus.gracia_desde, gracia_hasta: sus.gracia_hasta, cancelada_en: sus.cancelada_en, cancelada_por: sus.cancelada_por, cancelada_mp_en: sus.cancelada_mp_en, vencida_en: sus.vencida_en, motivo_fin: sus.motivo_fin, mp_estado: sus.mp_estado, mp_medio: sus.mp_medio, mp_error: sus.mp_error, revisar: sus.revisar, revisar_motivo: sus.revisar_motivo, aviso_uso_prueba_en: sus.aviso_uso_prueba_en, acepto_en: sus.acepto_en, acepto_texto: sus.acepto_texto, puede_crear: derechos(sus).crear, cobros: cobros.data ?? [], guias: ((guias.data ?? []) as any[]).map((g) => ({ folio: folioDe(g.id), estado: g.estado, creada_en: g.creada_en, entregada_en: g.entregada_en, grado: g.grado, materia: g.materia })) });
  }
  if (c.m !== "POST" || c.ruta[4]) return null;
  if (accion === "cancelar") { const r = await cancelar(c, sus, "daniel"); return c.json({ ...r, mensaje: r.ya ? "Esta suscripción ya no estaba activa." : r.hasta ? `Cancelada. Sigue activa hasta el ${fechaLarga(r.hasta)}; la familia ya recibió su comprobante.` : "Cancelada: ya no se cobra nada." }); }
  if (accion === "revisar") {
    if (simulada(sus)) return c.json({ ok: true, resultado: "de_prueba", estado: sus.estado });
    if (!c.mpToken()) return c.error("Mercado Pago no está encendido (falta MP_ACCESS_TOKEN)");
    if (!sus.mp_preapproval_id) return c.json({ ok: true, resultado: "sin_mercadopago", estado: sus.estado });
    const resultado = await sincronizar(c, sus);
    return c.json({ ok: true, resultado, estado: (await porId(c, id))?.estado ?? sus.estado });
  }
  if (accion === "revisado") { await cambiar(c, id, { revisar: false, revisar_motivo: null }); return c.json({ ok: true }); }
  if (accion === "prueba") {
    // Solo para las pruebas automáticas: lo que diría Mercado Pago llega aquí escrito, y pasa por el mismo código de verdad.
    if (!simulada(sus)) return c.error("Solo sirve con suscripciones de prueba.", 403);
    const b = await c.leerJson(c.req);
    const fin = async (resultado: unknown) => c.json({ ok: true, resultado, suscripcion: await porId(c, id) });
    if (b.accion === "preapproval") return await fin(await aplicarPreapproval(c, sus, { id: sus.mp_preapproval_id, external_reference: sus.id, ...(b.datos ?? {}) }, { pagos: Array.isArray(b.pagos) ? b.pagos : [] }));
    if (b.accion === "pago") return await fin(await aplicarPago(c, sus, b.pago ?? {}, null, { proximo: fechaValida(b.proximo) }));
    if (b.accion === "uso") return await fin(await revisarUsoEnPrueba(c, sus, { guias: Math.max(0, Math.trunc(Number(b.guias)) || 0) }));
    if (b.accion === "fechas") {
      const cambios: Record<string, unknown> = {};
      for (const k of ["periodo_fin", "proximo_cobro", "gracia_hasta", "creada_en", "prueba_hasta", "aviso_renovacion_para"]) if (k in b) cambios[k] = b[k] === null ? null : fechaValida(b[k]);
      if (!Object.keys(cambios).length) return c.error("Di qué fecha cambiar.");
      await cambiar(c, id, cambios);
      return await fin("fechas");
    }
    return c.error("Acción de prueba desconocida.");
  }
  return null;
}

// ---------- Rutas (solo administración; las de la familia las recibe cuenta.ts) ----------
export async function rutasSuscripcion(c: CtxRutasCuenta): Promise<Response | null> {
  const [r0, r1, r2, r3] = c.ruta;
  if (r0 !== "admin" || r1 !== "suscripciones") return null;
  try {
    if (!(await c.esAdmin())) return c.error("Clave de administrador incorrecta", 401);
    if (!r2 && c.m === "GET") return await adminLista(c);
    if (r2 === "diario" && !r3 && c.m === "POST") {
      // Con una fecha simulada solo se revisan las suscripciones de prueba: a una familia nunca se le adelanta el reloj.
      const b = await c.leerJson(c.req), fecha = ms(b.fecha);
      return c.json({ ok: true, ...(await tareaDiaria(c, Number.isFinite(fecha) ? { ahoraMs: fecha, soloPrueba: true } : { soloPrueba: b.solo_prueba === true })) });
    }
    if (r2 === "probadores" && !r3 && c.m === "POST") return await adminProbadores(c);
    if (esUuid(r2)) { const r = await adminUna(c, r2, r3); if (r) return r; }
    return c.error("Ruta de administración no reconocida", 404);
  } catch (e) {
    console.error("suscripcion:", sinCorreos((e as Error)?.message ?? e));
    return c.error("Algo salió mal. Intenta de nuevo en un momento.", 500);
  }
}
