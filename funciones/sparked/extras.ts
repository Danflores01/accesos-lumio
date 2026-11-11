// Módulo aparte: comentarios de la portada (testimonios y reseñas) y costos en pesos con el tipo de cambio del DOF.
// index.ts llama a rutasExtras() en cada petición; si la ruta no es de este módulo, devuelve null.
//
// Rutas:
//   POST /comentarios                         (público) { nombre, texto, estrellas, relacion, permiso_publicar, sitio_web, idioma }
//   GET  /admin/comentarios?estado=…          { comentarios: [...], nuevos }
//   PATCH /admin/comentarios/:id { estado }   · DELETE /admin/comentarios/:id
//   GET  /admin/costos?dias=30                gasto de IA en pesos (tipo de cambio del DOF del día de cada trabajo)
//   POST /admin/costos/servicios { servicios } lista de servicios fijos mensuales (fila sparked_servicios_fijos de config)
//   GET  /admin/costos/guias?dias=90          costo de IA por guía, SIN datos personales ni títulos: conteos, promedios y
//                                             una lista de { fecha, tipo, usd, mxn } (pestaña «Guías» del panel)
//   DELETE /admin/codigos/:id                 borra un código (borrado suave: activo = false y borrado_en = ahora; el
//                                             historial de intentos y compras se conserva)
//
// Tipo de cambio: el "tipo de cambio para solventar obligaciones denominadas en dólares" (FIX de Banxico publicado en
// el DOF), de la API abierta del DOF (sidofqa.segob.gob.mx, indicador 158; sin llave). Alternativa opcional: la API SIE
// de Banxico (serie SF60653, la misma cifra por fecha de publicación en el DOF) si existe el secreto BANXICO_TOKEN.
// Cada día publicado se guarda en la tabla tipos_cambio; los fines de semana y festivos usan el último publicado.
// deno-lint-ignore-file no-explicit-any
import type { CtxRutas } from "./tipos.ts";

// ---------- Utilidades ----------
const ZONA = "America/Mexico_City";
const FMT_DIA = new Intl.DateTimeFormat("en-CA", { timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit" });
/** Día (AAAA-MM-DD) en hora de Ciudad de México. */
export const diaMx = (d: Date | string | number) => FMT_DIA.format(new Date(d));
/** Suma n días a una fecha AAAA-MM-DD. */
export const sumarDias = (ymd: string, n: number) => { const d = new Date(ymd + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
/** Inicio de un día de Ciudad de México en ISO (desde 2022 México no cambia de horario: UTC-6 todo el año). */
const inicioDiaIso = (ymd: string) => new Date(ymd + "T00:00:00-06:00").toISOString();
const esUuid = (s: unknown) => typeof s === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
const escHtml = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
const largo = (s: string) => [...s].length;
const r2 = (n: number) => Math.round(n * 100) / 100;
const r4 = (n: number) => Math.round(n * 10000) / 10000;

// Caracteres de control e invisibles que no deben guardarse (el salto de línea se respeta solo en textos largos).
const CONTROL_LINEA = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]/g;
const CONTROL_TEXTO = /[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]/g;
/** Limpia un texto de visitante: quita caracteres de control y espacios de sobra. */
export function limpiar(v: unknown, multilinea = false): string {
  let s = typeof v === "string" ? v : typeof v === "number" ? String(v) : "";
  s = s.normalize("NFC");
  if (!multilinea) return s.replace(CONTROL_LINEA, " ").replace(/\s+/g, " ").trim();
  s = s.replace(/\r\n?/g, "\n").replace(CONTROL_TEXTO, " ");
  return s.split("\n").map((l) => l.replace(/[ \t\u00a0]+/g, " ").trim()).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

// ======================================================================
// 1. COMENTARIOS
// ======================================================================
export const RELACIONES = ["mama_papa", "alumno", "docente", "otro"];
export const ESTADOS_COMENTARIO = ["nuevo", "leido", "destacado", "oculto"];
export const MSG = {
  nombre: "Escribe tu nombre.",
  texto: "Escribe tu comentario (de 10 a 600 letras).",
  estrellas: "Elige de 1 a 5 estrellas.",
  tope_ip: "Ya recibimos varios comentarios desde este dispositivo. Inténtalo mañana.",
  guardar: "No pudimos guardar tu comentario. Inténtalo más tarde.",
};
export const TOPE_POR_IP = 3;      // comentarios por conexión cada 24 h
export const TOPE_GLOBAL = 150;    // comentarios en todo el sitio cada 24 h

type Validado = { trampa: true } | { error: string } | { fila: Record<string, unknown> };
/** Revisa el formulario público. No toca la base de datos. */
export function validarComentario(b: Record<string, any>): Validado {
  if (limpiar(b?.sitio_web) !== "") return { trampa: true };
  const nombre = limpiar(b?.nombre);
  if (largo(nombre) < 2 || largo(nombre) > 60) return { error: MSG.nombre };
  const texto = limpiar(b?.texto, true);
  if (largo(texto) < 10 || largo(texto) > 600) return { error: MSG.texto };
  const e = typeof b?.estrellas === "number" || (typeof b?.estrellas === "string" && b.estrellas.trim() !== "") ? Number(b.estrellas) : NaN;
  if (!Number.isInteger(e) || e < 1 || e > 5) return { error: MSG.estrellas };
  const relacion = RELACIONES.includes(b?.relacion) ? b.relacion : null;
  const idioma = b?.idioma === "es" || b?.idioma === "en" ? b.idioma : null;
  const permiso = b?.permiso_publicar === true || b?.permiso_publicar === "true";
  return { fila: { nombre, texto, estrellas: e, relacion, permiso_publicar: permiso, idioma, estado: "nuevo" } };
}

/** Huella de la conexión: sha256 de la IP con sal (nunca se guarda la IP). */
export async function huellaIp(ip: string | null): Promise<string> {
  const g = (globalThis as any).Deno?.env;
  const sal = g?.get("COMENTARIOS_SAL") || "sparked-comentarios:" + (g?.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  const datos = new TextEncoder().encode(sal + "|" + (ip || "sin-ip"));
  const h = await crypto.subtle.digest("SHA-256", datos);
  return [...new Uint8Array(h)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

const NOMBRE_RELACION: Record<string, string> = { mama_papa: "mamá o papá", alumno: "alumno", docente: "docente", otro: "otro" };

async function recibirComentario(c: CtxRutas): Promise<Response> {
  const b = await c.leerJson(c.req);
  const v = validarComentario(b);
  if ("trampa" in v) return c.json({ ok: true });
  if ("error" in v) return c.error(v.error, 400);
  try {
    const hash = await huellaIp(c.ip);
    const desde = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const [porIp, total] = await Promise.all([
      c.supabase.from("comentarios").select("id", { count: "exact", head: true }).eq("ip_hash", hash).gte("creado_en", desde),
      c.supabase.from("comentarios").select("id", { count: "exact", head: true }).gte("creado_en", desde),
    ]);
    if (porIp.error || total.error) throw porIp.error ?? total.error;
    if ((porIp.count ?? 0) >= TOPE_POR_IP) return c.error(MSG.tope_ip, 429);
    if ((total.count ?? 0) >= TOPE_GLOBAL) return c.error(MSG.guardar, 503);
    const { error: e } = await c.supabase.from("comentarios").insert({ ...v.fila, ip_hash: hash, creado_en: c.ahora() });
    if (e) throw e;
  } catch (err) {
    console.error("comentarios:", (err as Error)?.message ?? err);
    return c.error(MSG.guardar, 503);
  }
  const f = v.fila as any;
  c.enSegundoPlano(c.avisarDaniel(`💬 SparkEd: nuevo comentario (${"★".repeat(f.estrellas)})`,
    `<p><b>${escHtml(f.nombre)}</b>${f.relacion ? " · " + escHtml(NOMBRE_RELACION[f.relacion]) : ""} · ${"★".repeat(f.estrellas)}${"☆".repeat(5 - f.estrellas)}</p>` +
    `<p style="white-space:pre-wrap">${escHtml(f.texto)}</p><p style="color:#555">${f.permiso_publicar ? "Dio permiso de publicarlo." : "No dio permiso de publicarlo."} Lo ves en el panel, pestaña Comentarios.</p>`));
  return c.json({ ok: true });
}

async function adminComentarios(c: CtxRutas): Promise<Response> {
  const id = c.ruta[2];
  if (!id && c.m === "GET") {
    const estado = new URL(c.req.url).searchParams.get("estado") || "todos";
    if (estado !== "todos" && !ESTADOS_COMENTARIO.includes(estado)) return c.error("Estado no válido");
    let q = c.supabase.from("comentarios").select("id, nombre, texto, estrellas, relacion, permiso_publicar, idioma, estado, creado_en, actualizado_en").order("creado_en", { ascending: false }).limit(500);
    if (estado !== "todos") q = q.eq("estado", estado);
    const [lista, nuevos] = await Promise.all([q, c.supabase.from("comentarios").select("id", { count: "exact", head: true }).eq("estado", "nuevo")]);
    if (lista.error) throw lista.error;
    return c.json({ comentarios: lista.data ?? [], nuevos: nuevos.count ?? 0 });
  }
  if (esUuid(id) && c.m === "PATCH") {
    const estado = String((await c.leerJson(c.req)).estado ?? "");
    if (!ESTADOS_COMENTARIO.includes(estado)) return c.error("Estado no válido");
    const { data, error: e } = await c.supabase.from("comentarios").update({ estado, actualizado_en: c.ahora() }).eq("id", id).select("id, estado");
    if (e) throw e;
    if (!data?.length) return c.error("No encontramos ese comentario", 404);
    return c.json({ ok: true, comentario: data[0] });
  }
  if (esUuid(id) && c.m === "DELETE") {
    const { data, error: e } = await c.supabase.from("comentarios").delete().eq("id", id).select("id");
    if (e) throw e;
    if (!data?.length) return c.error("No encontramos ese comentario", 404);
    return c.json({ ok: true });
  }
  return c.error("Ruta no encontrada", 404);
}

// ======================================================================
// 2. COSTOS EN PESOS
// ======================================================================
export type TipoCambio = { fecha: string; valor: number; fuente: string };
const DOF_API = "https://sidofqa.segob.gob.mx/dof/sidof/indicadores/158";
const BANXICO_API = "https://www.banxico.org.mx/SieAPIRest/service/v1/series/SF60653/datos";
const dmy = (ymd: string) => ymd.split("-").reverse().join("-");                      // 2026-11-09 → 09-11-2026
const ymdDe = (s: string) => { const [d, m, a] = s.split(/[-/]/); return `${a}-${m}-${d}`; }; // 09-11-2026 o 09/11/2026 → 2026-11-09

/** API abierta del DOF. Devuelve [] si en ese rango no hubo publicación (fin de semana); lanza error si no responde. */
export async function pedirDOF(desde: string, hasta: string, f: typeof fetch = fetch): Promise<TipoCambio[]> {
  const r = await f(`${DOF_API}/${dmy(desde)}/${dmy(hasta)}`, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`DOF respondió ${r.status}`);
  const d = await r.json();
  if (d?.messageCode === 404) return [];
  if (d?.messageCode !== 200 || !Array.isArray(d?.ListaIndicadores)) throw new Error("DOF: respuesta inesperada");
  return d.ListaIndicadores.filter((x: any) => Number(x.codTipoIndicador) === 158)
    .map((x: any) => ({ fecha: ymdDe(String(x.fecha)), valor: Number(String(x.valor).replace(",", ".")), fuente: "DOF" }))
    .filter((x: TipoCambio) => /^\d{4}-\d{2}-\d{2}$/.test(x.fecha) && x.valor > 5 && x.valor < 100);
}

/** API SIE de Banxico (opcional, necesita token). Serie SF60653: FIX por fecha de publicación en el DOF. */
export async function pedirBanxico(desde: string, hasta: string, token: string, f: typeof fetch = fetch): Promise<TipoCambio[]> {
  const r = await f(`${BANXICO_API}/${desde}/${hasta}`, { headers: { accept: "application/json", "Bmx-Token": token }, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`Banxico respondió ${r.status}`);
  const d = await r.json();
  const datos = d?.bmx?.series?.[0]?.datos ?? [];
  return datos.map((x: any) => ({ fecha: ymdDe(String(x.fecha)), valor: Number(String(x.dato).replace(",", "")), fuente: "Banxico" }))
    .filter((x: TipoCambio) => /^\d{4}-\d{2}-\d{2}$/.test(x.fecha) && x.valor > 5 && x.valor < 100);
}

/** Tipo de cambio que aplica a un día: el último publicado en o antes de ese día (o el primero conocido, si es anterior a todos). */
export function tcDelDia(tipos: TipoCambio[], dia: string): TipoCambio | null {
  let mejor: TipoCambio | null = null;
  for (const t of tipos) { if (t.fecha <= dia && (!mejor || t.fecha > mejor.fecha)) mejor = t; }
  if (mejor) return mejor;
  return tipos.reduce<TipoCambio | null>((a, t) => (!a || t.fecha < a.fecha ? t : a), null);
}

let ultimaConsulta = 0;               // por instancia de la función: no pregunta al DOF más de una vez cada 15 min
const ESPERA_CONSULTA = 15 * 60 * 1000;

/** Lee los tipos de cambio guardados y pide al DOF (o a Banxico) los días que falten. */
async function tiposDeCambio(c: CtxRutas, desde: string, hoy: string) {
  const inicio = sumarDias(desde, -10);
  const leer = async () => {
    const { data, error: e } = await c.supabase.from("tipos_cambio").select("fecha, mxn_por_usd, fuente").gte("fecha", inicio).order("fecha");
    if (e) throw e;
    return (data ?? []).map((x: any) => ({ fecha: String(x.fecha), valor: Number(x.mxn_por_usd), fuente: String(x.fuente) })) as TipoCambio[];
  };
  let tipos = await leer();
  // ¿Qué falta? Atrás: si el primer día guardado queda lejos del inicio. Adelante: si el último no es de hoy.
  // Sin nada guardado se pregunta siempre; si ya hay datos, como mucho una vez cada 15 minutos.
  let pedirDesde: string | null = null;
  const pedirHasta = hoy;
  const atras = !tipos.length || tipos[0].fecha > sumarDias(inicio, 5);
  const adelante = !tipos.length || tipos[tipos.length - 1].fecha < hoy;
  if (!tipos.length || ((atras || adelante) && Date.now() - ultimaConsulta > ESPERA_CONSULTA)) {
    pedirDesde = atras ? inicio : sumarDias(tipos[tipos.length - 1].fecha, 1);
  }
  let consulta: "ok" | "no_hacia_falta" | "fallo" = "no_hacia_falta";
  let fallo = "";
  if (pedirDesde) {
    ultimaConsulta = Date.now();
    let nuevos: TipoCambio[] | null = null;
    try { nuevos = await pedirDOF(pedirDesde, pedirHasta); }
    catch (e) {
      fallo = (e as Error).message;
      const token = (globalThis as any).Deno?.env.get("BANXICO_TOKEN");
      if (token) { try { nuevos = await pedirBanxico(pedirDesde, pedirHasta, token); } catch (e2) { fallo += " · " + (e2 as Error).message; } }
    }
    if (nuevos) {
      consulta = "ok";
      if (nuevos.length) {
        const filas = nuevos.map((t) => ({ fecha: t.fecha, mxn_por_usd: t.valor, fuente: t.fuente, obtenido_en: c.ahora() }));
        const { error: e } = await c.supabase.from("tipos_cambio").upsert(filas, { onConflict: "fecha" });
        if (e) console.error("tipos_cambio:", e.message);
        tipos = await leer();
      }
    } else { consulta = "fallo"; console.error("tipo de cambio:", fallo); }
  }
  return { tipos, consulta, fallo };
}

/** Etiqueta simple de cada paso de la IA. */
export function etiquetaPaso(p: unknown): string {
  const s = String(p ?? "").toLowerCase();
  if (s.includes("ortograf")) return "Revisar ortografía";
  if (s.startsWith("extraer")) return "Leer las fotos";
  if (s.startsWith("plan")) return "Planear la guía";
  if (s.startsWith("generar") || s.startsWith("escribir")) return "Escribir los bloques";
  if (s.startsWith("reparar")) return "Reparar";
  if (s.startsWith("verificar")) return "Verificar datos";
  if (s.startsWith("investigar")) return "Investigar temas del temario";
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "Otro";
}

export type Servicio = { nombre: string; monto: number; moneda: "USD" | "MXN"; nota: string };
export const SERVICIOS_INICIALES: Servicio[] = [
  { nombre: "WhatsApp (Green API)", monto: 0, moneda: "USD", nota: "Escribe lo que pagas al mes" },
  { nombre: "Correo (Resend)", monto: 0, moneda: "USD", nota: "Plan gratis" },
  { nombre: "Dominio sparkeducation-mx.com", monto: 0, moneda: "MXN", nota: "Lo que cuesta al año entre 12" },
  { nombre: "Supabase (servidor y base de datos)", monto: 0, moneda: "USD", nota: "Plan gratis" },
];
/** Revisa la lista de servicios fijos que manda el panel. */
export function validarServicios(lista: unknown): Servicio[] | string {
  if (!Array.isArray(lista)) return "Falta la lista de servicios";
  if (lista.length > 20) return "Máximo 20 servicios";
  const out: Servicio[] = [];
  for (const x of lista as any[]) {
    const nombre = limpiar(x?.nombre).slice(0, 60);
    if (!nombre) continue;
    const monto = Number(String(x?.monto ?? "0").replace(",", "."));
    if (!Number.isFinite(monto) || monto < 0 || monto > 100000) return `Revisa el monto de «${nombre}»`;
    out.push({ nombre, monto: r2(monto), moneda: x?.moneda === "MXN" ? "MXN" : "USD", nota: limpiar(x?.nota).slice(0, 120) });
  }
  return out;
}

type TrabajoCosto = { id: string; alcance: string; estado: string; costo_usd: number | string | null; creado_en: string; guia_id: string | null; metricas: any[] | null };
type CompraCosto = { estado: string; monto_mxn: number | string | null; pagada_en: string | null; metodo_pago: string | null; mp_estado?: string | null; stripe_session_id?: string | null };

// ---------- ¿Qué cuenta como venta? ----------
// Una compra «pagada» solo es VENTA (ingreso, impuestos) si de verdad se cobró:
//   · Mercado Pago la aprobó (mp_estado "approved"; si después se reembolsa o hay contracargo, deja de contar);
//   · Stripe la cobró (hoy dormido), o
//   · Daniel la confirmó a mano en el panel diciendo que la cobró por fuera, en efectivo o transferencia (metodo_pago "manual").
// NO es venta lo que se entregó sin cobro: guía con código gratis (metodo_pago "codigo"), cortesía ("cortesia") o
// confirmada a mano sin decir cómo se cobró (metodo_pago vacío: así quedaron las anteriores al 11 nov 2026).
// Nació del 10 nov 2026: el panel decía 5 ventas y $500 cuando Mercado Pago solo había cobrado 3; las otras 2 eran
// compras marcadas como pagadas a mano, sin cobro. Prueba: herramientas/probar-ventas.mjs.
export type CompraCobro = { estado?: string | null; metodo_pago?: string | null; mp_estado?: string | null; stripe_session_id?: string | null };
export const ventaCobrada = (c: CompraCobro): boolean => c.estado === "pagada" && (c.mp_estado === "approved" || c.metodo_pago === "manual" || !!c.stripe_session_id);
/** Para una compra pagada que no es venta: "codigo" (código gratis) o "cortesia" (confirmada a mano sin cobro). */
export const tipoSinCobro = (c: CompraCobro): "codigo" | "cortesia" | null => c.estado !== "pagada" || ventaCobrada(c) ? null : c.metodo_pago === "codigo" ? "codigo" : "cortesia";
/** Inicio del «día de ventas» y del mes para el Resumen del panel: el día termina a las 11 pm de Ciudad de México
 *  (UTC−6 todo el año), o sea a la medianoche de UTC−5. Devuelve fechas ISO en UTC (hoy y mes empiezan a las 05:00 UTC). */
export function inicioDiaVentas(ahoraMs: number): { hoy: string; mes: string } {
  const d = new Date(ahoraMs - 5 * 3600_000);
  const y = d.getUTCFullYear(), m = d.getUTCMonth();
  return { hoy: new Date(Date.UTC(y, m, d.getUTCDate(), 5)).toISOString(), mes: new Date(Date.UTC(y, m, 1, 5)).toISOString() };
}
/** ¿Se confirmó a mano? (ni Mercado Pago ni Stripe ni código): solo a estas se les puede cambiar «cobrada por fuera» ↔ «cortesía». */
export const confirmadaAMano = (c: CompraCobro): boolean => c.estado === "pagada" && c.mp_estado !== "approved" && !c.stripe_session_id && c.metodo_pago !== "codigo";

/** Cálculo puro de la ficha de costos (se prueba sin base de datos). */
export function calcularCostos(e: {
  trabajos: TrabajoCosto[]; previasDeGuias: { guia_id: string; costo_usd: number | string | null }[]; compras: CompraCosto[];
  tipos: TipoCambio[]; ajusteTc: number; hoy: string; dias: number; servicios: Servicio[];
}) {
  const { hoy, dias } = e;
  const tcDe = (dia: string) => tcDelDia(e.tipos, dia)?.valor ?? e.ajusteTc;
  const tcHoy = tcDe(hoy);
  const desdeTabla = sumarDias(hoy, -(dias - 1));
  const d7 = sumarDias(hoy, -6), d30 = sumarDias(hoy, -29), mes = hoy.slice(0, 8) + "01";
  const vacio = () => ({ usd: 0, mxn: 0, trabajos: 0 });
  const periodos = { hoy: vacio(), d7: vacio(), d30: vacio(), mes: vacio(), periodo: vacio() };
  const dias_: Record<string, any> = {};
  for (let d = desdeTabla; d <= hoy; d = sumarDias(d, 1)) dias_[d] = { fecha: d, tc: tcDe(d), usd: 0, mxn: 0, vistas_previas: 0, guias_completas: 0, trabajos: 0, ingresos_mxn: 0, ventas: 0 };
  const pasos: Record<string, { paso: string; modelo: string; llamadas: number; usd: number; mxn: number }> = {};
  const previas: number[] = [];   // costo USD de cada vista previa terminada
  const completas: number[] = []; // costo USD de cada guía completa terminada (vista previa + resto, o completa de una vez)
  const tcCompletas: number[] = [];

  for (const t of e.trabajos) {
    const dia = diaMx(t.creado_en);
    const usd = Number(t.costo_usd ?? 0) || 0;
    const tc = tcDe(dia);
    const mxn = usd * tc;
    const sumar = (p: { usd: number; mxn: number; trabajos: number }) => { p.usd += usd; p.mxn += mxn; p.trabajos++; };
    if (dia === hoy) sumar(periodos.hoy);
    if (dia >= d7 && dia <= hoy) sumar(periodos.d7);
    if (dia >= d30 && dia <= hoy) sumar(periodos.d30);
    if (dia >= mes && dia <= hoy) sumar(periodos.mes);
    if (dia < desdeTabla || dia > hoy) continue;
    sumar(periodos.periodo);
    const fila = dias_[dia];
    fila.usd += usd; fila.mxn += mxn; fila.trabajos++;
    if (t.alcance === "vista_previa") fila.vistas_previas++; else fila.guias_completas++;
    if (t.estado === "listo") {
      if (t.alcance === "vista_previa") previas.push(usd);
      else {
        const previa = t.alcance === "resto" && t.guia_id ? e.previasDeGuias.filter((p) => p.guia_id === t.guia_id).reduce((n, p) => n + (Number(p.costo_usd ?? 0) || 0), 0) : 0;
        completas.push(usd + previa); tcCompletas.push(tc);
      }
    }
    // Desglose por paso: solo las llamadas de ESTE trabajo (el trabajo "resto" arrastra las métricas de su vista previa).
    let suma = 0;
    const desdeMs = new Date(t.creado_en).getTime() - 1000;
    for (const m of Array.isArray(t.metricas) ? t.metricas : []) {
      if (m?.en && new Date(m.en).getTime() < desdeMs) continue;
      const u = Number(m?.costo_usd ?? 0) || 0;
      const paso = etiquetaPaso(m?.paso), modelo = String(m?.modelo ?? "—");
      const k = paso + "|" + modelo;
      pasos[k] = pasos[k] ?? { paso, modelo, llamadas: 0, usd: 0, mxn: 0 };
      pasos[k].llamadas++; pasos[k].usd += u; pasos[k].mxn += u * tc; suma += u;
    }
    const resto = usd - suma;
    if (Math.abs(resto) > 0.0005) {
      const k = "Sin desglose|—";
      pasos[k] = pasos[k] ?? { paso: "Sin desglose", modelo: "—", llamadas: 0, usd: 0, mxn: 0 };
      pasos[k].usd += resto; pasos[k].mxn += resto * tc;
    }
  }

  // Ingresos: solo las compras que de verdad se cobraron (ventaCobrada). Las de código gratis y las cortesías
  // (confirmadas a mano sin cobro) no son ventas: se cuentan aparte.
  type Ingreso = { mxn: number; ventas: number; con_codigo: number; cortesias: number };
  const cero = (): Ingreso => ({ mxn: 0, ventas: 0, con_codigo: 0, cortesias: 0 });
  const ingresos = { periodo: cero(), mes: cero(), d7: cero(), hoy: cero() };
  for (const c of e.compras) {
    if (c.estado !== "pagada" || !c.pagada_en) continue;
    const dia = diaMx(c.pagada_en);
    const cobrada = ventaCobrada(c), sinCobro = tipoSinCobro(c);
    const monto = cobrada ? Number(c.monto_mxn ?? 0) || 0 : 0;
    const sumar = (p: Ingreso) => { if (cobrada) { p.mxn += monto; p.ventas++; } else if (sinCobro === "codigo") p.con_codigo++; else p.cortesias++; };
    if (dia === hoy) sumar(ingresos.hoy);
    if (dia >= d7 && dia <= hoy) sumar(ingresos.d7);
    if (dia >= mes && dia <= hoy) sumar(ingresos.mes);
    if (dia >= desdeTabla && dia <= hoy) { sumar(ingresos.periodo); if (cobrada) { dias_[dia].ingresos_mxn += monto; dias_[dia].ventas++; } }
  }

  const fijos = e.servicios.map((s) => ({ ...s, mxn_mes: r2(s.moneda === "USD" ? s.monto * tcHoy : s.monto) }));
  const fijosMes = fijos.reduce((n, s) => n + s.mxn_mes, 0);
  const fijosPeriodo = fijosMes * dias / 30;
  const prom = (arr: number[], tcs?: number[]) => arr.length ? { n: arr.length, usd: r4(arr.reduce((a, b) => a + b, 0) / arr.length), mxn: r2(arr.reduce((a, b, i) => a + b * (tcs ? tcs[i] : tcHoy), 0) / arr.length) } : { n: 0, usd: 0, mxn: 0 };
  const redondear = (p: { usd: number; mxn: number; trabajos: number }) => ({ usd: r4(p.usd), mxn: r2(p.mxn), trabajos: p.trabajos });
  const gastoMes = r2(periodos.mes.mxn), gastoPer = r2(periodos.periodo.mxn);
  return {
    dias, desde: desdeTabla, hoy,
    gasto_ia: { hoy: redondear(periodos.hoy), d7: redondear(periodos.d7), d30: redondear(periodos.d30), mes: redondear(periodos.mes), periodo: redondear(periodos.periodo) },
    por_dia: Object.values(dias_).reverse().map((d: any) => ({ ...d, usd: r4(d.usd), mxn: r2(d.mxn), ingresos_mxn: r2(d.ingresos_mxn) })),
    por_paso: Object.values(pasos).map((p) => ({ ...p, usd: r4(p.usd), mxn: r2(p.mxn) })).sort((a, b) => b.usd - a.usd),
    promedios: { vista_previa: prom(previas), guia_completa: prom(completas, tcCompletas) },
    ingresos: { hoy: { ...ingresos.hoy, mxn: r2(ingresos.hoy.mxn) }, d7: { ...ingresos.d7, mxn: r2(ingresos.d7.mxn) }, mes: { ...ingresos.mes, mxn: r2(ingresos.mes.mxn) }, periodo: { ...ingresos.periodo, mxn: r2(ingresos.periodo.mxn) } },
    servicios_fijos: fijos,
    fijos_mes_mxn: r2(fijosMes),
    balance: {
      mes: { ingresos_mxn: r2(ingresos.mes.mxn), ia_mxn: gastoMes, fijos_mxn: r2(fijosMes), queda_mxn: r2(ingresos.mes.mxn - gastoMes - fijosMes) },
      periodo: { ingresos_mxn: r2(ingresos.periodo.mxn), ia_mxn: gastoPer, fijos_mxn: r2(fijosPeriodo), queda_mxn: r2(ingresos.periodo.mxn - gastoPer - fijosPeriodo) },
    },
  };
}

// ---------- Impuestos estimados: IVA e ISR (pedido de Daniel, 10 nov 2026) ----------
// Una ESTIMACIÓN para que Daniel aparte lo que le toca al SAT; no sustituye a su contador ni a su declaración.
//   IVA: el precio de la guía ya lo incluye. De lo cobrado, IVA = cobrado × tasa / (100 + tasa). No se resta el IVA
//        que él paga en sus gastos con factura (eso lo acredita su contador), así que es el tope de lo que entrega.
//   ISR: sobre lo cobrado SIN IVA. Modo "resico" (por defecto) = tabla mensual del Régimen Simplificado de Confianza
//        para personas físicas (art. 113-E de la Ley del ISR): la tasa depende del ingreso del mes y se aplica a todo
//        ese ingreso. Modo "fijo" = el porcentaje que Daniel escriba en el panel (el que le dé su contador).
// Ajustes (tabla config): sparked_iva_tasa (16), sparked_isr_modo ("resico" | "fijo"), sparked_isr_tasa (porcentaje).
export const TABLA_RESICO: [number, number][] = [[25000, 1], [50000, 1.1], [83333.33, 1.5], [208333.33, 2], [3500000, 2.5]];
export type AjusteImpuestos = { iva: number; isrModo: "resico" | "fijo"; isrTasa: number };
export function leerAjusteImpuestos(cfg: Record<string, string>): AjusteImpuestos {
  const num = (v: unknown, def: number) => { const t = String(v ?? "").trim().replace(",", "."); const n = Number(t); return t !== "" && Number.isFinite(n) && n >= 0 && n <= 50 ? n : def; };
  return { iva: num(cfg.sparked_iva_tasa, 16), isrModo: cfg.sparked_isr_modo === "fijo" ? "fijo" : "resico", isrTasa: num(cfg.sparked_isr_tasa, 0) };
}
// Tasa de ISR (en %) para un mes, según lo cobrado sin IVA en ese mes.
export function tasaIsr(a: AjusteImpuestos, sinIvaMes: number): number {
  if (a.isrModo === "fijo") return a.isrTasa;
  for (const [tope, tasa] of TABLA_RESICO) if (sinIvaMes <= tope) return tasa;
  return TABLA_RESICO[TABLA_RESICO.length - 1][1];
}
function partirImpuestos(a: AjusteImpuestos, cobrado: number, tasa: number) {
  const sinIva = cobrado / (1 + a.iva / 100), iva = cobrado - sinIva, isr = sinIva * tasa / 100;
  return { cobrado_mxn: r2(cobrado), sin_iva_mxn: r2(sinIva), iva_mxn: r2(iva), isr_mxn: r2(isr), impuestos_mxn: r2(iva + isr), queda_mxn: r2(cobrado - iva - isr) };
}
// Impuestos de un mes: lo cobrado (con IVA) en ventas pagadas con dinero; las guías con código gratis no cuentan.
export function impuestosDelMes(a: AjusteImpuestos, cobrado: number, ventas: number) {
  const tasa = tasaIsr(a, cobrado / (1 + a.iva / 100));
  return { ventas, isr_tasa: tasa, ...partirImpuestos(a, cobrado, tasa) };
}
// Lo que lleva de impuestos UNA guía al precio de hoy, con la tasa de ISR que corresponde al mes en curso.
export function calcularImpuestos(a: AjusteImpuestos, cobradoMes: number, ventasMes: number, precio: number) {
  const mes = impuestosDelMes(a, cobradoMes, ventasMes);
  return { iva_tasa: a.iva, isr_modo: a.isrModo, isr_tasa_fija: a.isrTasa, tabla_resico: TABLA_RESICO, mes, por_guia: { precio_mxn: r2(precio), isr_tasa: mes.isr_tasa, ...partirImpuestos(a, precio, mes.isr_tasa) } };
}
const CLAVE_SERVICIOS = "sparked_servicios_fijos";
async function leerServicios(c: CtxRutas): Promise<{ servicios: Servicio[]; guardados: boolean }> {
  const { data } = await c.supabase.from("config").select("valor").eq("clave", CLAVE_SERVICIOS).maybeSingle();
  if (data?.valor) { try { const v = validarServicios(JSON.parse(data.valor)); if (Array.isArray(v)) return { servicios: v, guardados: true }; } catch { /* fila dañada: se usan los iniciales */ } }
  return { servicios: SERVICIOS_INICIALES, guardados: false };
}

// ---------- Costo de IA por guía (sin datos personales) ----------
type TrabajoGuia = { id?: string; alcance: string; estado: string; costo_usd: number | string | null; creado_en: string; guia_id: string | null; borrador_id: string | null };
export type FilaCostoGuia = { fecha: string; tipo: "vista_previa" | "guia_completa"; usd: number; mxn: number };

/**
 * Cálculo puro del reporte de costos por guía (se prueba sin base de datos).
 * - Vista previa: un trabajo "vista_previa" terminado.
 * - Guía completa: un trabajo "resto" terminado MÁS el costo de su vista previa (la guía pagada reutiliza el bloque 1),
 *   o un trabajo "completa" terminado (guías hechas desde el panel).
 * - Sin terminar: trabajos con error (su gasto fue real, pero no produjeron guía); se cuentan aparte.
 * Cada parte se pasa a pesos con el tipo de cambio del día (Ciudad de México) en que se creó.
 */
export function calcularCostosGuias(e: { trabajos: TrabajoGuia[]; tipos: TipoCambio[]; ajusteTc: number; hoy: string; dias: number; maxFilas?: number }) {
  const { hoy, dias } = e;
  const tcDe = (dia: string) => tcDelDia(e.tipos, dia)?.valor ?? e.ajusteTc;
  const d30 = sumarDias(hoy, -29), desdeTabla = sumarDias(hoy, -(dias - 1));
  const usdDe = (t: TrabajoGuia) => Number(t.costo_usd ?? 0) || 0;
  const mxnDe = (t: TrabajoGuia) => usdDe(t) * tcDe(diaMx(t.creado_en));
  // Vista previa terminada más reciente de cada borrador (o guía), para sumarla a su trabajo "resto".
  const previaDe = (t: TrabajoGuia): TrabajoGuia | null => {
    let mejor: TrabajoGuia | null = null;
    for (const p of e.trabajos) {
      if (p.alcance !== "vista_previa" || p.estado !== "listo") continue;
      const misma = (t.borrador_id && p.borrador_id === t.borrador_id) || (!t.borrador_id && t.guia_id && p.guia_id === t.guia_id);
      if (misma && p.creado_en <= t.creado_en && (!mejor || p.creado_en > mejor.creado_en)) mejor = p;
    }
    return mejor;
  };
  const filas: (FilaCostoGuia & { dia: string })[] = [];
  const sinTerminar = { d30: 0, total: 0, mxn_total: 0 };
  for (const t of e.trabajos) {
    const dia = diaMx(t.creado_en);
    if (t.estado === "error") { sinTerminar.total++; sinTerminar.mxn_total += mxnDe(t); if (dia >= d30) sinTerminar.d30++; continue; }
    if (t.estado !== "listo") continue;
    if (t.alcance === "vista_previa") filas.push({ fecha: t.creado_en, dia, tipo: "vista_previa", usd: usdDe(t), mxn: mxnDe(t) });
    else if (t.alcance === "completa") filas.push({ fecha: t.creado_en, dia, tipo: "guia_completa", usd: usdDe(t), mxn: mxnDe(t) });
    else if (t.alcance === "resto") {
      const p = previaDe(t);
      filas.push({ fecha: t.creado_en, dia, tipo: "guia_completa", usd: usdDe(t) + (p ? usdDe(p) : 0), mxn: mxnDe(t) + (p ? mxnDe(p) : 0) });
    }
  }
  const de = (tipo: string, desde = "") => filas.filter((f) => f.tipo === tipo && f.dia >= desde && f.dia <= hoy);
  const prom = (arr: { usd: number; mxn: number }[]) => arr.length ? { n: arr.length, usd: r4(arr.reduce((a, f) => a + f.usd, 0) / arr.length), mxn: r2(arr.reduce((a, f) => a + f.mxn, 0) / arr.length) } : { n: 0, usd: 0, mxn: 0 };
  const ultimas = filas.filter((f) => f.dia >= desdeTabla && f.dia <= hoy).sort((a, b) => (a.fecha < b.fecha ? 1 : -1)).slice(0, e.maxFilas ?? 200)
    .map((f) => ({ fecha: f.fecha, tipo: f.tipo, usd: r4(f.usd), mxn: r2(f.mxn) }));
  return {
    dias, hoy, desde: desdeTabla,
    conteo: {
      vistas_previas: { d30: de("vista_previa", d30).length, total: de("vista_previa").length },
      guias_completas: { d30: de("guia_completa", d30).length, total: de("guia_completa").length },
      sin_terminar: { ...sinTerminar, mxn_total: r2(sinTerminar.mxn_total) },
    },
    promedio: { vista_previa: prom(de("vista_previa")), guia_completa: prom(de("guia_completa")) },
    promedio_30: { vista_previa: prom(de("vista_previa", d30)), guia_completa: prom(de("guia_completa", d30)) },
    ultimas,
  };
}

async function costosPorGuia(c: CtxRutas): Promise<Response> {
  const dias = Math.min(365, Math.max(1, Math.round(Number(new URL(c.req.url).searchParams.get("dias")) || 90)));
  const hoy = diaMx(Date.now());
  // Solo columnas de costo y fechas: ni títulos, ni nombres, ni teléfonos salen de aquí.
  const { data, error: e } = await c.supabase.from("trabajos").select("id, alcance, estado, costo_usd, creado_en, guia_id, borrador_id").in("alcance", ["vista_previa", "resto", "completa"]).order("creado_en").limit(10000);
  if (e) throw e;
  const T = (data ?? []) as TrabajoGuia[];
  const primero = T.length ? diaMx(T[0].creado_en) : hoy;
  const desde = [primero, sumarDias(hoy, -(dias - 1))].sort()[0];
  const [{ tipos }, cfg] = await Promise.all([tiposDeCambio(c, desde, hoy), c.config()]);
  const ajusteTc = Number(cfg.sparked_tipo_cambio) || 18.5;
  const r = calcularCostosGuias({ trabajos: T, tipos, ajusteTc, hoy, dias });
  const tc = tcDelDia(tipos, hoy);
  return c.json({ tipo_cambio: { valor: tc ? tc.valor : ajusteTc, fecha: tc?.fecha ?? null, fuente: tc ? tc.fuente : "ajuste" }, ...r });
}

async function adminCostos(c: CtxRutas): Promise<Response> {
  if (c.ruta[2] === "guias" && !c.ruta[3] && c.m === "GET") return await costosPorGuia(c);
  if (c.ruta[2] === "servicios" && c.m === "POST") {
    const v = validarServicios((await c.leerJson(c.req)).servicios);
    if (typeof v === "string") return c.error(v);
    const { error: e } = await c.supabase.from("config").upsert({ clave: CLAVE_SERVICIOS, valor: JSON.stringify(v) });
    if (e) throw e;
    return c.json({ ok: true, servicios: v });
  }
  if (c.ruta[2] || c.m !== "GET") return c.error("Ruta no encontrada", 404);

  const dias = Math.min(365, Math.max(1, Math.round(Number(new URL(c.req.url).searchParams.get("dias")) || 30)));
  const hoy = diaMx(Date.now());
  const desdeTabla = sumarDias(hoy, -(dias - 1));
  const desde = [desdeTabla, sumarDias(hoy, -29), hoy.slice(0, 8) + "01"].sort()[0];
  const desdeIso = inicioDiaIso(sumarDias(desde, -1)); // un día de holgura; el cálculo filtra por día de Ciudad de México

  const [{ tipos, consulta, fallo }, trab, comp, serv, cfg] = await Promise.all([
    tiposDeCambio(c, desde, hoy),
    c.supabase.from("trabajos").select("id, alcance, estado, costo_usd, creado_en, guia_id, metricas:datos->metricas").gte("creado_en", desdeIso).order("creado_en").limit(5000),
    c.supabase.from("compras").select("estado, monto_mxn, pagada_en, metodo_pago, mp_estado, stripe_session_id").eq("estado", "pagada").gte("pagada_en", desdeIso).limit(5000),
    leerServicios(c),
    c.config(),
  ]);
  if (trab.error) throw trab.error;
  if (comp.error) throw comp.error;
  const T = (trab.data ?? []) as TrabajoCosto[];
  // Vistas previas de las guías que se terminaron con un trabajo "resto" (pueden ser de antes del periodo).
  const idsResto = [...new Set(T.filter((t) => t.alcance === "resto" && t.guia_id).map((t) => t.guia_id as string))];
  const prev = idsResto.length ? await c.supabase.from("trabajos").select("guia_id, costo_usd").eq("alcance", "vista_previa").in("guia_id", idsResto) : { data: [] };
  const ajusteTc = Number(cfg.sparked_tipo_cambio) || 18.5;

  const r = calcularCostos({ trabajos: T, previasDeGuias: (prev.data ?? []) as any[], compras: (comp.data ?? []) as CompraCosto[], tipos, ajusteTc, hoy, dias, servicios: serv.servicios });
  const tc = tcDelDia(tipos, hoy);
  const fecha = (ymd: string) => new Date(ymd + "T12:00:00Z").toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  let aviso = "";
  if (!tc) aviso = `No hay ningún tipo de cambio del DOF guardado y no se pudo consultar; se usa el de Ajustes (${ajusteTc}).`;
  else if (consulta === "fallo") aviso = `No se pudo consultar el DOF en este momento; se usa el último tipo de cambio guardado (publicado el ${fecha(tc.fecha)}).`;
  const fuenteTexto: Record<string, string> = { DOF: "Diario Oficial de la Federación (API abierta del DOF)", Banxico: "Banco de México (API SIE, mismo dato que publica el DOF)", ajuste: "Ajustes del panel (no es el tipo de cambio oficial)" };
  const fuente = tc ? tc.fuente : "ajuste";
  // Impuestos estimados: lo que va del mes y el mes anterior completo (el que toca declarar).
  const inicioMes = hoy.slice(0, 8) + "01", finAnterior = sumarDias(inicioMes, -1), inicioAnterior = finAnterior.slice(0, 8) + "01";
  const ant = await c.supabase.from("compras").select("estado, monto_mxn, metodo_pago, mp_estado, stripe_session_id").eq("estado", "pagada").gte("pagada_en", inicioDiaIso(inicioAnterior)).lt("pagada_en", inicioDiaIso(inicioMes)).limit(5000);
  let cobradoAnt = 0, ventasAnt = 0;
  for (const x of (ant.data ?? []) as any[]) { const m = ventaCobrada(x) ? Number(x.monto_mxn ?? 0) || 0 : 0; if (m > 0) { cobradoAnt += m; ventasAnt++; } }
  const ajusteImp = leerAjusteImpuestos(cfg);
  const impuestos = { ...calcularImpuestos(ajusteImp, r.ingresos.mes.mxn, r.ingresos.mes.ventas, Number(cfg.sparked_precio) || 100), mes_desde: inicioMes, mes_anterior: { desde: inicioAnterior, hasta: finAnterior, ...impuestosDelMes(ajusteImp, cobradoAnt, ventasAnt) } };
  return c.json({
    impuestos,
    tipo_cambio: {
      valor: tc ? tc.valor : ajusteTc, fecha: tc?.fecha ?? null, fuente, fuente_texto: fuenteTexto[fuente] ?? fuente,
      consulta, aviso, publicado_hoy: tc?.fecha === hoy, dias_guardados: tipos.length,
      nombre: "Tipo de cambio para solventar obligaciones denominadas en dólares (FIX de Banxico publicado en el DOF)",
      ...(fallo ? { detalle_fallo: fallo.slice(0, 200) } : {}),
    },
    servicios_guardados: serv.guardados,
    ...r,
  });
}

// ======================================================================
// 3. BORRAR CÓDIGOS DE DESCUENTO (borrado suave)
// ======================================================================
// Un código borrado queda apagado (activo = false: la función SQL sparked_usar_codigo ya no le suma usos) y con la fecha
// en borrado_en: no aparece en la lista del panel, no se puede volver a encender y, al escribirlo, cuenta como borrado.
// La fila se conserva para no perder el historial (intentos y compras que lo usaron).
// Si la columna borrado_en todavía no existe (falta la migración 20261110), el código solo se apaga y se avisa.

/** true si el código está borrado (con o sin la columna borrado_en en la base). */
export const codigoBorrado = (cod: Record<string, unknown> | null | undefined) => !!cod?.borrado_en;
/** El error de Supabase/PostgREST dice que falta la columna borrado_en (la migración no se ha aplicado). */
export const faltaColumnaBorrado = (e: { message?: string; code?: string } | null | undefined) =>
  !!e && (e.code === "42703" || e.code === "PGRST204" || /borrado_en/i.test(e.message ?? ""));
export const MSG_FALTA_MIGRACION = "El código quedó apagado, pero todavía no se puede borrar: falta aplicar en la base de datos la migración 20261110_sparked_codigos_borrado.sql. Mientras tanto ya no funciona.";

async function borrarCodigo(c: CtxRutas, id: string): Promise<Response> {
  const { data: cod, error: e0 } = await c.supabase.from("codigos").select("*").eq("id", id).maybeSingle();
  if (e0) throw e0;
  if (!cod) return c.error("No encontramos ese código", 404);
  if (codigoBorrado(cod)) return c.json({ ok: true, codigo: cod.codigo, borrado_en: cod.borrado_en });
  const cuando = c.ahora();
  const { data, error: e } = await c.supabase.from("codigos").update({ activo: false, borrado_en: cuando }).eq("id", id).select("id");
  if (faltaColumnaBorrado(e)) {
    const { error: e2 } = await c.supabase.from("codigos").update({ activo: false }).eq("id", id);
    if (e2) throw e2;
    return c.error(MSG_FALTA_MIGRACION, 409);
  }
  if (e) throw e;
  if (!data?.length) return c.error("No encontramos ese código", 404);
  return c.json({ ok: true, codigo: cod.codigo, borrado_en: cuando });
}

// ======================================================================
// Enrutador del módulo
// ======================================================================
export async function rutasExtras(c: CtxRutas): Promise<Response | null> {
  const [r0, r1] = c.ruta;
  if (r0 === "comentarios" && !c.ruta[1]) {
    if (c.m !== "POST") return c.error("Método no permitido", 405);
    return await recibirComentario(c);
  }
  // Solo DELETE /admin/codigos/:id es de este módulo; el resto de /admin/codigos lo atiende index.ts.
  if (r0 === "admin" && r1 === "codigos" && esUuid(c.ruta[2]) && !c.ruta[3] && c.m === "DELETE") {
    if (!(await c.esAdmin())) return c.error("Clave de administrador incorrecta", 401);
    try { return await borrarCodigo(c, c.ruta[2]); }
    catch (e) {
      console.error("extras:", (e as Error)?.message ?? e);
      return c.error("Error del servidor: " + ((e as Error)?.message ?? "desconocido"), 500);
    }
  }
  if (r0 === "admin" && (r1 === "comentarios" || r1 === "costos")) {
    if (!(await c.esAdmin())) return c.error("Clave de administrador incorrecta", 401);
    try {
      return r1 === "comentarios" ? await adminComentarios(c) : await adminCostos(c);
    } catch (e) {
      console.error("extras:", (e as Error)?.message ?? e);
      return c.error("Error del servidor: " + ((e as Error)?.message ?? "desconocido"), 500);
    }
  }
  return null;
}
