// La cadena de generación por pasos (Documento 1): extraer → unir → planear → generar por bloque → revisar →
// reparar → verificar → imágenes → armar. Cada ejecución hace UN paso y deja el siguiente listo.
import { jsonrepair } from "npm:jsonrepair@3";
import { EXTRACTOR, PLANIFICADOR, ESQUEMA_PLAN, GENERADOR, REPARADOR, CORRECTOR, VERIFICADOR, INVESTIGADOR, DOMINIOS_CONFIABLES, DOMINIOS_OFICIALES, NIVEL_LECTURA, TIPOS_JUEGO, MECANICAS_QUIZ, MIN_PREGUNTAS, MIN_PAREJAS, MIN_TARJETAS } from "./prompts.ts";

export type Trabajo = { id: string; borrador_id: string | null; guia_id: string | null; alcance: string; paso: string; estado: string; progreso: Record<string, unknown>; datos: Record<string, unknown>; intentos: number; costo_usd: number; tokens_entrada: number; tokens_salida: number };
type Supa = ReturnType<typeof import("npm:@supabase/supabase-js@2").createClient>;
export type Fuente = { archivos: { ruta: string; nombre: string }[]; grado: string; materia: string; colegio?: string; idioma_alumno?: string; opciones?: Record<string, unknown> };

const MODELO_HAIKU = "claude-haiku-5-5";
const MODELO_SONNET = "claude-sonnet-5-5";
const MODELO_OPUS = "claude-opus-5-5";
const MODELOS: Record<string, string> = { haiku: MODELO_HAIKU, sonnet: MODELO_SONNET, opus: MODELO_OPUS };
// USD por millón de tokens: [entrada, salida, lectura de caché]. Escribir en caché cuesta 1.25× la entrada. Lectura de
// caché de Sonnet 5.5: 0.10 (11 nov 2026). Haiku 5.5 cobra 5 veces más si el prompt pasa de 100 000 tokens (HAIKU_LARGO).
const PRECIO: Record<string, [number, number, number]> = { [MODELO_HAIKU]: [0.10, 0.50, 0.01], [MODELO_SONNET]: [2, 10, 0.10], [MODELO_OPUS]: [4, 20, 0.20] };
const HAIKU_LARGO: [number, number, number] = [0.50, 2.50, 0.05];
export function precioDe(modelo: string, entrada: number): [number, number, number] {
  return modelo === MODELO_HAIKU && entrada > 100_000 ? HAIKU_LARGO : PRECIO[modelo] ?? PRECIO[MODELO_HAIKU];
}
// Modelo y esfuerzo de cada paso. El defecto es el comportamiento de siempre; se cambia con la tabla config
// (sparked_modelo_plan, sparked_esfuerzo_plan, …) o, para pruebas, por trabajo en datos.opciones.
const AJUSTES: Record<string, [string, string]> = { extraer: ["haiku", "medium"], plan: ["haiku", "low"], escribir: ["haiku", "low"], reparar: ["haiku", "low"], verificar: ["haiku", "medium"], investigar: ["haiku", "medium"] };
const ESFUERZOS = ["low", "medium", "high"];
export function ajusteDe(paso: string, opciones: Record<string, unknown> = {}): { nombre: string; modelo: string; esfuerzo: string } {
  const [m0, e0] = AJUSTES[paso];
  const m = String(opciones[`modelo_${paso}`] ?? "").toLowerCase().trim();
  const e = String(opciones[`esfuerzo_${paso}`] ?? "").toLowerCase().trim();
  const nombre = MODELOS[m] ? m : m0;
  return { nombre, modelo: MODELOS[nombre], esfuerzo: ESFUERZOS.includes(e) ? e : e0 };
}
const FOTOS_POR_LOTE = 2; // pocas fotos por llamada: cada llamada debe terminar en menos de ~110 s
const LOTE_ANTERIOR = 3; // tamaño de lote de las versiones anteriores, para retomar trabajos que se quedaron a medias

// "urls": las páginas que de verdad devolvió el buscador en esta llamada (resultados y citas); con ellas se comprueba
// que las fuentes de la investigación existen y no salieron de la memoria de la IA.
// "busqueda": cuántas búsquedas hizo, con qué consultas y qué errores dio el buscador (se registran en el log).
export type Respuesta = { json: any; reparado: boolean; texto: string; parada: string | null; formato: boolean; ms: number; uso: { entrada: number; salida: number; costo: number }; urls: string[]; busqueda: { usadas: number; consultas: string[]; errores: string[] } };

// ---------- Llamada al API de Claude (fetch directo, sin SDK) ----------
// Una sola llamada por ejecución de la función. "previo" es la segunda oportunidad: se le muestra su respuesta anterior
// (que no fue JSON) y se le pide únicamente el JSON.
export async function claude(opts: { modelo?: string; sistema: string; contenido: unknown[]; esquema?: unknown; maxTokens?: number; herramientas?: unknown[]; esfuerzo?: string; previo?: string; etiqueta?: string }): Promise<Respuesta> {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) throw new Error("Falta configurar ANTHROPIC_API_KEY en los secretos de Supabase");
  const modelo = opts.modelo ?? MODELO_HAIKU;
  const mensajes: unknown[] = [{ role: "user", content: opts.contenido }];
  const previo = (opts.previo ?? "").trim();
  if (previo) mensajes.push({ role: "assistant", content: previo }, { role: "user", content: "Eso no fue JSON válido; responde únicamente con el JSON pedido, sin texto antes ni después." });
  const cuerpo: Record<string, unknown> = {
    model: modelo, max_tokens: opts.maxTokens ?? 12000,
    system: [{ type: "text", text: opts.sistema, cache_control: { type: "ephemeral" } }],
    messages: mensajes,
    output_config: { effort: opts.esfuerzo ?? "medium", ...(opts.esquema ? { format: { type: "json_schema", schema: opts.esquema } } : {}) },
  };
  if (opts.herramientas?.length) cuerpo.tools = opts.herramientas;
  const helicone = Deno.env.get("HELICONE_API_KEY");
  const url = helicone ? "https://anthropic.helicone.ai/v1/messages" : "https://api.anthropic.com/v1/messages";
  const cab: Record<string, string> = { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2026-10-21" };
  if (helicone) cab["Helicone-Auth"] = `Bearer ${helicone}`;
  // Cada paso debe caber en una ejecución de la función (tope de 150 s): si Claude tarda más, se corta y se reintenta.
  const pedir = () => fetch(url, { method: "POST", headers: cab, body: JSON.stringify(cuerpo), signal: AbortSignal.timeout(125_000) });
  const inicio = Date.now();
  let r = await pedir();
  // Un dominio que el buscador no puede consultar hace que rechace TODA la petición (7 nov 2026: bbc.co.uk y fundeu.es
  // dejaron sin verificar todas las guías). Se quitan los dominios que nombra el error y se pide otra vez, una sola vez.
  if (r.status === 400 && opts.herramientas?.length) {
    const txt = await r.text();
    const fuera = dominiosRechazados(txt);
    let quitados = 0;
    for (const h of cuerpo.tools as any[]) if (Array.isArray(h?.allowed_domains)) { const antes = h.allowed_domains.length; h.allowed_domains = h.allowed_domains.filter((x: string) => !fuera.includes(x)); quitados += antes - h.allowed_domains.length; }
    if (quitados) { console.warn("El buscador no puede consultar estos dominios; se quitan y se pide otra vez:", fuera.join(", ")); r = await pedir(); }
    else r = new Response(txt, { status: 400 });
  }
  const oc = cuerpo.output_config as Record<string, unknown>;
  if (r.status === 400 && oc.format) {
    // Si el API no acepta el esquema, se pide JSON libre (con el mismo esfuerzo) y se valida aquí.
    console.warn("Esquema rechazado, reintento sin formato:", (await r.text()).slice(0, 300));
    delete oc.format;
    r = await pedir();
  }
  if (r.status === 400) {
    // Si el API rechaza output_config (esfuerzo), se pide sin él.
    console.warn("Petición rechazada, reintento sin output_config:", (await r.text()).slice(0, 300));
    delete cuerpo.output_config;
    r = await pedir();
  }
  if (!r.ok) throw new Error(`Claude ${r.status}: ${(await r.text()).slice(0, 400)}`);
  const d = await r.json();
  const ms = Date.now() - inicio;
  const texto = (d.content ?? []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n");
  const u = d.usage ?? {};
  const entrada = (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0);
  const salida = u.output_tokens ?? 0;
  const [pe, ps, pc] = precioDe(modelo, entrada);
  const costo = ((u.input_tokens ?? 0) * pe + (u.cache_creation_input_tokens ?? 0) * pe * 1.25 + (u.cache_read_input_tokens ?? 0) * pc + salida * ps) / 1e6 + (u.server_tool_use?.web_search_requests ?? 0) * 0.01;
  const formato = !!(cuerpo.output_config as any)?.format;
  const parada = d.stop_reason ?? null;
  const { json, reparado } = leerJson(texto);
  const urls = urlsDeBusqueda(d);
  const busqueda = { usadas: Number(u.server_tool_use?.web_search_requests ?? 0), ...detalleBusqueda(d) };
  // Una línea por llamada en los logs para medir tiempos y tokens de cada paso; con buscador, también sus consultas y
  // los errores que dio (11 nov 2026: dos temas quedaron como nota por un «error de entrada» que no se veía).
  console.log("IA", JSON.stringify({ etiqueta: opts.etiqueta ?? "", modelo, esfuerzo: (cuerpo.output_config as any)?.effort ?? null, ms, entrada, salida, parada, formato, reparado, json: !!json, ...(opts.herramientas?.length ? { busquedas: busqueda.usadas, paginas: urls.length, consultas: busqueda.consultas.slice(0, 8), errores: busqueda.errores.slice(0, 8) } : {}) }));
  return { json, reparado, texto, parada, formato, ms, uso: { entrada, salida, costo }, urls, busqueda };
}

// Consultas que hizo la IA y errores del buscador. Un error del buscador llega con HTTP 200, dentro del bloque de
// resultado: su contenido es un objeto con error_code (no la lista de páginas).
export function detalleBusqueda(d: any): { consultas: string[]; errores: string[] } {
  const consultas: string[] = [], errores: string[] = [];
  for (const b of Array.isArray(d?.content) ? d.content : []) {
    const q = b?.type === "server_tool_use" ? b?.input?.query : undefined;
    if (typeof q === "string" && q.trim()) consultas.push(q.trim().slice(0, 120));
    const c = b?.content;
    if (/_tool_result$/.test(String(b?.type ?? "")) && c && typeof c === "object" && !Array.isArray(c) && (c.error_code || /_error$/.test(String(c.type ?? "")))) errores.push(String(c.error_code ?? c.type));
  }
  return { consultas, errores };
}

// Dominios que el error 400 del buscador dice que no puede consultar ("...not accessible to our user agent: ['a', 'b']").
export function dominiosRechazados(texto: string): string[] {
  const m = String(texto ?? "").match(/not accessible to our user agent[^\[]*\[([^\]]*)\]/i);
  return m ? [...m[1].matchAll(/['"]([^'"]+)['"]/g)].map((x) => x[1].trim()).filter(Boolean) : [];
}
// Las páginas que devolvió el buscador en una respuesta: resultados de búsqueda y citas del texto.
export function urlsDeBusqueda(d: any): string[] {
  const vistas = new Set<string>();
  for (const b of Array.isArray(d?.content) ? d.content : []) {
    if (b?.type === "web_search_tool_result" && Array.isArray(b.content)) for (const x of b.content) if (typeof x?.url === "string") vistas.add(x.url);
    if (b?.type === "text" && Array.isArray(b.citations)) for (const c of b.citations) if (typeof c?.url === "string") vistas.add(c.url);
  }
  return [...vistas];
}

// Una llamada a la IA con el modelo y el esfuerzo del paso; queda anotada en datos.metricas (costo y tiempo por paso).
// Regla para los modelos caros (Sonnet, Opus): si se pasan de 125 s no se repiten (se anota y el paso sigue con Haiku);
// si rechazan la petición, se anota y se reintenta una sola vez más tarde; si la rechazan otra vez, el paso sigue con Haiku.
const REPETIR = "repetir" as const;
const esTiempo = (e: unknown) => (e as Error)?.name === "TimeoutError" || /timed out|abort/i.test((e as Error)?.message ?? "");
async function llamar(supabase: Supa, t: Trabajo, fuente: Fuente, paso: string, etiqueta: string, opts: { sistema: string; contenido: unknown[]; esquema?: unknown; maxTokens: number; herramientas?: unknown[]; previo?: string }): Promise<Respuesta | typeof REPETIR> {
  const D = t.datos as any;
  const a = ajusteDe(paso, D.con_haiku?.[paso] ? {} : fuente.opciones ?? {});
  const caro = a.nombre !== "haiku";
  const anotar = (resultado: string, r?: Respuesta) => {
    D.metricas = [...(Array.isArray(D.metricas) ? D.metricas : []), { paso: etiqueta, modelo: a.nombre, esfuerzo: a.esfuerzo, entrada: r?.uso.entrada ?? 0, salida: r?.uso.salida ?? 0, costo_usd: r?.uso.costo ?? 0, ms: r?.ms ?? 0, parada: r?.parada ?? null, resultado, ...(r?.busqueda?.usadas ? { busquedas: r.busqueda.usadas } : {}), ...(r?.busqueda?.errores?.length ? { errores_busqueda: r.busqueda.errores.slice(0, 6) } : {}), en: new Date().toISOString() }].slice(-80);
  };
  let r: Respuesta;
  try {
    r = await claude({ ...opts, modelo: a.modelo, esfuerzo: a.esfuerzo, etiqueta: `${etiqueta} · ${a.nombre}/${a.esfuerzo}` });
  } catch (e) {
    if (!caro || !esTiempo(e)) throw e;
    anotar("se pasó de 125 s; el paso sigue con Haiku");
    D.con_haiku = { ...(D.con_haiku ?? {}), [paso]: true };
    await guardar(supabase, t, { datos: D });
    return REPETIR;
  }
  sumar(t, r.uso);
  if (caro && r.parada === "refusal") {
    const veces = Number(D.rechazos?.[paso] ?? 0) + 1;
    D.rechazos = { ...(D.rechazos ?? {}), [paso]: veces };
    if (veces >= 2) D.con_haiku = { ...(D.con_haiku ?? {}), [paso]: true };
    anotar(veces >= 2 ? "rechazada otra vez; el paso sigue con Haiku" : "rechazada; se reintenta una vez más tarde", r);
    await guardar(supabase, t, { datos: D, costo_usd: t.costo_usd, tokens_entrada: t.tokens_entrada, tokens_salida: t.tokens_salida });
    if (veces < 2) throw Object.assign(new Error(`${a.nombre} rechazó el paso ${etiqueta}; se reintenta una vez`), { reintentar: true });
    return REPETIR;
  }
  anotar(r.parada === "max_tokens" ? "cortada por largo" : r.json ? "ok" : "sin JSON", r);
  return r;
}

// Prueba de velocidad: una sola llamada del planificador con el modelo y el esfuerzo dados, sobre el inventario de un
// trabajo ya leído. No guarda nada; devuelve tiempo, tokens, costo y un resumen del plan.
const contenidoPlan = (D: any, fuente: Fuente, variedad = "") => [{ type: "text", text: `Datos: grado ${fuente.grado} · nivel ${NIVEL_LECTURA(fuente.grado)} · idioma del alumno ${fuente.idioma_alumno ?? "es"} · fotos subidas ${fuente.archivos.length} · materia indicada ${String(fuente.materia ?? "").slice(0, 60)}${esUniversidad(fuente.grado) ? " (texto libre de lo que cursa)" : ""} · tipo de material ${JSON.stringify(D.tipo_material)}.${variedad ? "\n" + variedad : ""}\n\nINVENTARIO:\n${JSON.stringify(D.inventario)}` }];
export async function medirPlan(D: any, fuente: Fuente, modelo: string, esfuerzo: string) {
  const a = ajusteDe("plan", { modelo_plan: modelo, esfuerzo_plan: esfuerzo });
  try {
    const r = await claude({ sistema: PLANIFICADOR, contenido: contenidoPlan(D, fuente), esquema: ESQUEMA_PLAN, modelo: a.modelo, esfuerzo: a.esfuerzo, maxTokens: 16000, etiqueta: `medir plan · ${a.nombre}/${a.esfuerzo}` });
    const plan = planDe(r.json);
    return { modelo: a.nombre, esfuerzo: a.esfuerzo, ms: r.ms, entrada: r.uso.entrada, salida: r.uso.salida, costo_usd: r.uso.costo, parada: r.parada, plan_valido: !!plan, titulo: plan?.identidad?.titulo ?? null, bloques: plan ? plan.bloques.map((b: any) => ({ titulo: b.titulo, ids: Array.isArray(b.ids_inventario) ? b.ids_inventario.length : 0, juegos: b.juegos, mini_examen: b.mini_examen })) : null };
  } catch (e) {
    return { modelo: a.nombre, esfuerzo: a.esfuerzo, error: (e as Error).message, tiempo_agotado: esTiempo(e) };
  }
}

export function extraerJson(texto: string): any {
  return leerJson(texto).json;
}

// Lee el JSON de una respuesta. Primero tal cual (o dentro de ```json), luego quitando comas sobrantes y, como último
// recurso, con jsonrepair, que arregla JSON mal formado o cortado (comillas, comas, llaves sin cerrar).
function leerJson(texto: string): { json: any; reparado: boolean } {
  if (!texto) return { json: null, reparado: false };
  const candidatos = [texto];
  const m = texto.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m) candidatos.push(m[1]);
  const o = primerObjeto(texto);
  if (o) candidatos.push(o);
  const a = texto.indexOf("{"), b = texto.lastIndexOf("}");
  if (a >= 0 && b > a) candidatos.push(texto.slice(a, b + 1));
  for (const c of candidatos) {
    try { return { json: JSON.parse(c), reparado: false }; } catch { /* sigue */ }
    // Reparación común: comas sobrantes antes de } o ].
    try { return { json: JSON.parse(c.replace(/,\s*([}\]])/g, "$1")), reparado: false }; } catch { /* sigue */ }
  }
  if (a < 0) return { json: null, reparado: false };
  // Desde la primera llave hasta el final (si se cortó, jsonrepair cierra lo que quedó abierto).
  for (const c of [texto.slice(a).replace(/```\s*$/, ""), ...candidatos.slice(1)]) {
    try {
      const j = JSON.parse(jsonrepair(c));
      if (j && typeof j === "object" && !Array.isArray(j)) return { json: j, reparado: true };
    } catch { /* sigue */ }
  }
  return { json: null, reparado: false };
}

// El primer objeto JSON completo del texto (cuenta llaves fuera de las comillas), por si después viene más texto.
function primerObjeto(texto: string): string | null {
  const a = texto.indexOf("{");
  if (a < 0) return null;
  let nivel = 0, enCadena = false, escape = false;
  for (let i = a; i < texto.length; i++) {
    const ch = texto[i];
    if (enCadena) { if (escape) escape = false; else if (ch === "\\") escape = true; else if (ch === '"') enCadena = false; continue; }
    if (ch === '"') enCadena = true;
    else if (ch === "{") nivel++;
    else if (ch === "}" && --nivel === 0) return texto.slice(a, i + 1);
  }
  return null;
}

// Guarda por qué una respuesta de la IA no sirvió (paso, motivo de parada, tokens, tiempo, inicio y fin del texto) y el
// costo de ese intento, para diagnosticar sin repetir la llamada: datos.diagnostico (el último) y datos.diagnosticos
// (los últimos 10).
async function diagnosticar(supabase: Supa, t: Trabajo, paso: string, r: Respuesta, extra: Record<string, unknown> = {}) {
  const D = t.datos as any;
  const txt = r.texto ?? "";
  const diag = { paso, parada: r.parada, formato: r.formato, reparado: r.reparado, tokens_salida: r.uso.salida, ms: r.ms, largo: txt.length, inicio: txt.slice(0, 600), fin: txt.slice(-600), en: new Date().toISOString(), ...extra };
  console.error("Respuesta de la IA sin JSON útil", JSON.stringify({ ...diag, inicio: diag.inicio.slice(0, 300), fin: diag.fin.slice(-300) }));
  D.diagnostico = diag;
  D.diagnosticos = [...(Array.isArray(D.diagnosticos) ? D.diagnosticos : []), diag].slice(-10);
  await guardar(supabase, t, { datos: D, costo_usd: t.costo_usd, tokens_entrada: t.tokens_entrada, tokens_salida: t.tokens_salida });
}

// ---------- Utilidades ----------
const normaliza = (s: string) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9ñ\s]/g, " ").replace(/\s+/g, " ").trim();
function citaExiste(cita: string, citas: string[]): boolean {
  const c = normaliza(cita); if (!c) return false;
  const palabras = c.split(" ").filter((w) => w.length > 2);
  if (!palabras.length) return false;
  for (const x of citas) { const n = normaliza(x); if (n.includes(c)) return true; const hit = palabras.filter((w) => n.includes(w)).length; if (hit / palabras.length >= 0.8) return true; }
  // también contra el texto completo unido
  const todo = normaliza(citas.join(" ")); const hit = palabras.filter((w) => todo.includes(w)).length;
  return hit / palabras.length >= 0.85;
}
const PROHIBIDAS = ["gap", "huecos", "en el examen", "del examen", "página", "pagina", "color de la clave", "ejercicio número", "en el ejercicio", "en el mapa del ejercicio"];
const palabras = (s: string) => String(s ?? "").trim().split(/\s+/).filter(Boolean).length;
const topePalabras: Record<string, number> = { peques: 10, primaria: 18, secundaria: 25, prepa_uni: 35 };

async function base64De(supabase: Supa, ruta: string): Promise<string> {
  const { data, error } = await supabase.storage.from("materiales").download(ruta);
  if (error || !data) throw new Error("No se pudo leer " + ruta);
  const bytes = new Uint8Array(await data.arrayBuffer());
  let bin = ""; const trozo = 0x8000;
  for (let i = 0; i < bytes.length; i += trozo) bin += String.fromCharCode(...bytes.subarray(i, i + trozo));
  return btoa(bin);
}

async function guardar(supabase: Supa, t: Trabajo, cambios: Partial<Trabajo>) {
  Object.assign(t, cambios);
  const { error } = await supabase.from("trabajos").update({ ...cambios, actualizado_en: new Date().toISOString() }).eq("id", t.id);
  if (error) throw error;
}
function sumar(t: Trabajo, uso: { entrada: number; salida: number; costo: number }) {
  t.costo_usd = Number(t.costo_usd ?? 0) + uso.costo; t.tokens_entrada = Number(t.tokens_entrada ?? 0) + uso.entrada; t.tokens_salida = Number(t.tokens_salida ?? 0) + uso.salida;
}

// ---------- Un paso ----------
// Devuelve el nombre del siguiente paso, o null si terminó. Lanza error si falla.
export async function ejecutarPaso(supabase: Supa, t: Trabajo, fuente: Fuente): Promise<string | null> {
  const D = t.datos as any;
  const nivel = NIVEL_LECTURA(fuente.grado);
  const total = fuente.archivos.length;
  const progreso = async (pct: number, mensaje: string, paso?: string) => guardar(supabase, t, { progreso: { pct, mensaje, paso: paso ?? t.paso }, ...(paso ? { paso } : {}) });

  if (t.paso === "inicio") { await progreso(2, "Leyendo tus fotos 📖", "extraer:0"); return "extraer:0"; }

  if (t.paso.startsWith("extraer:")) {
    const k = Number(t.paso.split(":")[1]) || 0;
    D.inventarios = Array.isArray(D.inventarios) ? D.inventarios : [];
    // Fila de páginas por leer, en rangos [desde, hasta). Un trabajo que venía de la versión anterior (lotes de 3)
    // sigue donde se quedó.
    if (!Array.isArray(D.pendientes)) D.pendientes = rangos(Math.min(total, k * LOTE_ANTERIOR), total);
    const avanzar = async () => {
      const sig = D.pendientes.length ? `extraer:${k + 1}` : "unir";
      const leidas = total - D.pendientes.reduce((n: number, rg: number[]) => n + rg[1] - rg[0], 0);
      await guardar(supabase, t, { datos: D, paso: sig, progreso: { pct: 5 + Math.round(25 * leidas / Math.max(1, total)), mensaje: `Leyendo tus fotos 📖 (${leidas} de ${total})`, paso: sig }, costo_usd: t.costo_usd, tokens_entrada: t.tokens_entrada, tokens_salida: t.tokens_salida });
      return sig;
    };
    if (!D.pendientes.length) return await avanzar();
    const [desde, hasta] = D.pendientes[0] as number[];
    const rango = `${desde + 1}-${hasta}`;
    const segunda = D.reintento?.rango === rango ? D.reintento : null; // segunda oportunidad para este rango
    const archivos = fuente.archivos.slice(desde, hasta);
    const contenido: unknown[] = [{ type: "text", text: `Datos: grado ${fuente.grado} · nivel ${nivel} · materia indicada ${fuente.materia} · fotos ${desde + 1}–${hasta} de ${total}. Numera las fotos desde ${desde + 1}.` }];
    for (const a of archivos) contenido.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: await base64De(supabase, a.ruta) } });
    let r: Respuesta;
    try {
      const res = await llamar(supabase, t, fuente, "extraer", `extraer ${rango}`, { sistema: EXTRACTOR, contenido, maxTokens: 16000, previo: segunda?.previo });
      if (res === REPETIR) return t.paso;
      r = res;
    } catch (e) {
      // Si la llamada se pasa de tiempo dos veces con el mismo rango, se parte o se marca sin leer. Los demás errores del
      // API (saturado, sin saldo) siguen el reintento normal del trabajo.
      const tiempo = (e as Error).name === "TimeoutError" || /timed out|abort/i.test((e as Error).message ?? "");
      const veces = Number(D.tiempos_agotados?.[rango] ?? 0) + 1;
      if (!tiempo || veces < 2) {
        if (tiempo) { D.tiempos_agotados = { ...(D.tiempos_agotados ?? {}), [rango]: veces }; await guardar(supabase, t, { datos: D }); }
        throw e;
      }
      partirOMarcar(D, "se pasó de tiempo");
      return await avanzar();
    }
    const j = r.json && typeof r.json === "object" ? r.json : null;
    const leido = j && (j.inventario && typeof j.inventario === "object" || j.estado === "no_es_material_de_estudio") ? { inventario: {}, ...j } : null;
    if (leido && r.parada !== "max_tokens") {
      D.inventarios.push(leido); D.pendientes.shift(); delete D.reintento;
      return await avanzar();
    }
    await diagnosticar(supabase, t, `extraer ${rango}`, r);
    if (r.parada === "max_tokens" && hasta - desde > 1) {
      // Se cortó por largo: el rango se parte en dos y se lee por mitades.
      delete D.reintento; partirOMarcar(D, "");
      return await avanzar();
    }
    if (leido) {
      // Una sola foto que se cortó: se usa lo que alcanzó a leer (JSON reparado).
      D.inventarios.push({ ...leido, estado: "parcial", nota: "Lectura cortada por largo; se usa lo que alcanzó a leer." });
      D.pendientes.shift(); delete D.reintento;
      return await avanzar();
    }
    if (!segunda && r.parada !== "refusal" && r.texto.trim()) {
      // Segunda oportunidad: se le muestra lo que contestó y se le pide solo el JSON.
      D.reintento = { rango, previo: r.texto.trim().slice(0, 40000) };
      return await avanzar();
    }
    // Ni así: se parte el rango; si ya es una sola foto, se marca como no leída y la guía sigue con las demás.
    delete D.reintento; partirOMarcar(D, r.parada === "refusal" ? "rechazada por el filtro de seguridad" : "sin JSON válido");
    return await avanzar();
  }

  if (t.paso === "unir") {
    const invs = (D.inventarios ?? []) as any[];
    if (invs.some((x) => x?.estado === "no_es_material_de_estudio") && invs.every((x) => x?.estado !== "ok" && x?.estado !== "parcial")) throw new Error("Las fotos no parecen material de estudio");
    const fotos = invs.flatMap((x) => x?.fotos ?? []);
    const legibles = fotos.filter((f: any) => f?.legible !== false).length;
    if (!legibles) throw new Error("No se pudo leer ninguna foto. Prueba con fotos más claras y con buena luz.");
    const inv: Record<string, any[]> = {};
    const vistos = new Set<string>();
    for (const x of invs) for (const [k, lista] of Object.entries(x?.inventario ?? {})) {
      inv[k] = inv[k] ?? [];
      for (const crudo of Array.isArray(lista) ? lista : lista ? [lista] : []) {
        // El extractor a veces devuelve textos sueltos en vez de objetos (p. ej. en "recursos_mencionados"):
        // se envuelven para que todo elemento sea un objeto y pueda recibir su id.
        const el = crudo && typeof crudo === "object" ? crudo : typeof crudo === "string" || typeof crudo === "number" ? { texto: String(crudo) } : null;
        if (!el) continue;
        const clave = k + "|" + normaliza(JSON.stringify(el)).slice(0, 120);
        if (vistos.has(clave)) continue;
        vistos.add(clave); inv[k].push(el);
      }
    }
    // ids para que el Planificador y el Generador se refieran a los elementos
    let n = 0; for (const [k, lista] of Object.entries(inv)) for (const el of lista) el.id = `${k.slice(0, 3)}${++n}`;
    D.inventario = inv; D.fotos = fotos; D.tipo_material = invs.map((x) => x?.tipo_material).filter(Boolean);
    D.citas = Object.values(inv).flat().map((e: any) => e?.cita).filter(Boolean).concat(Object.values(inv).flat().map((e: any) => e?.texto ?? e?.significado ?? e?.ejemplo).filter(Boolean));
    await guardar(supabase, t, { datos: D, paso: "planear", progreso: { pct: 32, mensaje: "Planeando tu guía 🧭", paso: "planear" } });
    return "planear";
  }

  if (t.paso === "planear") {
    const n = D.intento_ia?.paso === "planear" ? Number(D.intento_ia.n) || 0 : 0;
    let plan: any = null;
    if (n < 2) {
      // El plan sale con un esquema JSON obligatorio (structured outputs); el esfuerzo por defecto es bajo porque el
      // pensamiento de la IA cuenta dentro de max_tokens. Segundo intento: tope mayor si se cortó, o se le muestra su
      // respuesta si no fue JSON.
      const cortado = n === 1 && D.intento_ia?.motivo === "max_tokens";
      const res = await llamar(supabase, t, fuente, "plan", "planear", { sistema: PLANIFICADOR, contenido: contenidoPlan(D, fuente, [sugerenciaVariedad(semillaDe(t.borrador_id ?? t.id)), notaIdioma(idiomaForzado(fuente)), investigacionActiva(fuente) ? NOTA_PLAN_INVESTIGAR : ""].filter(Boolean).join("\n")), esquema: ESQUEMA_PLAN, maxTokens: cortado ? 24000 : 16000, previo: n === 1 && !cortado ? D.intento_ia?.previo : undefined });
      if (res === REPETIR) return "planear";
      const r = res;
      plan = r.parada !== "max_tokens" || n === 1 ? planDe(r.json) : null;
      if (!plan) {
        D.intento_ia = { paso: "planear", n: n + 1, motivo: r.parada === "max_tokens" ? "max_tokens" : "sin_json", previo: r.texto.trim().slice(0, 40000) || undefined };
        await diagnosticar(supabase, t, "planear", r);
        return "planear";
      }
    } else {
      // Tercer intento: el plan lo arma el código con el inventario, para que siempre salga una guía.
      plan = planPorCodigo(D, fuente);
      console.warn("Plan armado por código", t.id);
    }
    delete D.intento_ia;
    // Solo se quedan los ids que existen en el inventario (si un bloque se queda sin ids, el Generador recibe todo).
    const idsValidos = new Set(Object.values(D.inventario as Record<string, any[]>).flat().map((e: any) => e?.id));
    plan.bloques = plan.bloques.slice(0, 5).map((pb: any, i: number) => ({ ...pb, id: pb.id || `b${i + 1}`, juegos: pb.juegos ?? {}, ids_inventario: (Array.isArray(pb.ids_inventario) ? pb.ids_inventario : []).filter((x: unknown) => idsValidos.has(x)) }));
    // Tope de slides, orden variado de los juegos y primera actividad (ver ajustarPlan).
    const slidesIa = plan.slides_estimados ?? null;
    // Universidad (Daniel, 12 nov 2026: «que las actividades no sean tan infantiles»): el perfil lo fija el grado, no la IA.
    if (perfilDe(fuente.grado) === "universitario") plan.perfil_edad = "universitario";
    const recortesPlan = ajustarPlan(plan, semillaDe(t.borrador_id ?? t.id));
    const forzado = idiomaForzado(fuente);
    if (forzado) {
      plan.idioma_guia = forzado; plan.idioma_forzado = true;
      // El apoyo en el idioma del alumno sobra si la guía ya está en ese idioma.
      if (plan.apoyo?.idioma === forzado) plan.apoyo = null;
    }
    // Temas del temario sin contenido: cada uno con su bloque y su página (ver normalizarTemas). Con la investigación
    // encendida, lo que el temario separa con «;» como tema distinto va aparte (11 nov 2026: «Verbo» se perdió dentro de
    // «Reglamento»; ver completarTemasDelTemario).
    plan.temas_a_investigar = normalizarTemas(plan);
    if (investigacionActiva(fuente)) plan.temas_a_investigar = completarTemasDelTemario(plan, D.inventario);
    D.plan = plan;
    D.plan.grado = fuente.grado;
    D.slides = { plan_ia: slidesIa, plan: plan.slides_estimados, tope: plan.presupuesto_slides, recortes_plan: recortesPlan, sugerencia: sugerenciaVariedad(semillaDe(t.borrador_id ?? t.id)) };
    D.bloques = [];
    await guardar(supabase, t, { datos: D, paso: "generar:0", progreso: { pct: 40, mensaje: `Escribiendo el bloque 1 de ${D.plan.bloques.length} ✍️`, paso: "generar:0" }, costo_usd: t.costo_usd, tokens_entrada: t.tokens_entrada, tokens_salida: t.tokens_salida });
    return "generar:0";
  }

  if (t.paso.startsWith("generar:")) {
    const bi = Number(t.paso.split(":")[1]);
    const plan = D.plan; const pb = plan.bloques[bi];
    // Temas del temario sin contenido (Daniel, 11 nov 2026): antes de escribir el bloque se investigan en fuentes
    // confiables, de 2 en 2 (una llamada por ejecución). Nunca detienen la guía: lo que no se confirma queda como nota.
    if (investigacionActiva(fuente)) {
      const pend = temasPendientes(D, pb.id);
      if (pend.length) return await investigarTemas(supabase, t, fuente, pb, pend, nivel);
    }
    const ids = new Set(((pb.ids_inventario ?? []) as string[]).filter((x) => !String(x).startsWith("inv")));
    const invBloque: Record<string, any[]> = {};
    for (const [k, lista] of Object.entries(D.inventario as Record<string, any[]>)) { if (k === "investigado") continue; const sel = ids.size ? lista.filter((e) => ids.has(e.id)) : lista; if (sel.length) invBloque[k] = sel; }
    if (!Object.keys(invBloque).length) for (const [k, lista] of Object.entries(D.inventario as Record<string, any[]>)) if (k !== "investigado") invBloque[k] = lista;
    // Lo investigado y confirmado de ESTE bloque va al Generador como categoría "investigado".
    const investigados = ((D.inventario?.investigado ?? []) as any[]).filter((e) => e?.bloque === pb.id);
    if (investigados.length) invBloque.investigado = investigados;
    const resB = resultadosDeBloque(D, pb.id);
    const confirmados = resB.filter((r) => r.estado === "confirmado");
    const sinConfirmar = resB.filter((r) => r.estado === "no_confirmado");
    // Pistas del plan sin datos (11 nov 2026: la pista «Verbo» solo repetía la lista del temario): con la investigación
    // encendida, en un bloque sin contenido propio en los apuntes, una pista que no se parece a ningún dato confirmado no
    // se escribe; queda como nota «repásalo en tu libro», igual que un tema sin confirmar.
    const propio = tieneContenidoPropio(invBloque);
    const sinDatos = investigacionActiva(fuente) && !propio ? pistasSinDatos(pb.pistas, confirmados, sinConfirmar) : [];
    const paraRepasar = [...sinConfirmar, ...sinDatos.map((p) => ({ tema: p, pagina: "" }))];
    // Un bloque sin nada confirmado y sin contenido propio en los apuntes no se escribe: la IA solo podría inventar
    // (11 nov 2026). Queda con su nota «repásalo en tu libro» y, al armar, la nota pasa al bloque vecino. En la vista
    // previa se sigue con el bloque siguiente (la familia ve un bloque de verdad; el trabajo "resto" empieza después).
    if (bloqueSoloNota(resB, invBloque) || (sinDatos.length && !confirmados.length && !propio)) {
      const ultimo = bi + 1 >= plan.bloques.length;
      if (ultimo && !(D.bloques as any[]).some((x: any, k: number) => k !== bi && x && !x.solo_nota)) throw new Error("Ningún tema del temario se pudo confirmar con fuentes confiables y las fotos no traen su contenido: la guía no se hace para no inventar");
      D.bloques[bi] = { id: pb.id ?? `b${bi + 1}`, titulo: pb.titulo, solo_nota: true, pistas: [], actividades: [], mini_examen: [], ...(sinDatos.length ? { pistas_sin_datos: sinDatos } : {}) };
      agregarNotasTemario(D.bloques[bi], paraRepasar, plan.idioma_guia ?? "es");
      const sigN = !ultimo ? `generar:${bi + 1}` : t.alcance === "vista_previa" ? "armar" : "revisar";
      await guardar(supabase, t, { datos: D, paso: sigN, progreso: { pct: 40 + Math.round(30 * (bi + 1) / plan.bloques.length), mensaje: sigN.startsWith("generar") ? `Escribiendo el bloque ${bi + 2} de ${plan.bloques.length} ✍️` : "Revisando que todo esté perfecto ✅", paso: sigN }, costo_usd: t.costo_usd, tokens_entrada: t.tokens_entrada, tokens_salida: t.tokens_salida });
      return sigN;
    }
    const n = D.intento_ia?.paso === t.paso ? Number(D.intento_ia.n) || 0 : 0;
    const cortado = n > 0 && D.intento_ia?.motivo === "max_tokens";
    // Si la respuesta anterior se cortó por largo, se pide la mitad de los juegos (respuesta más corta).
    let pbPedido = cortado ? { ...pb, ...mitadConMinimos(pb) } : pb;
    // Las pistas de temas sin confirmar y las pistas sin datos no se piden (se vuelven nota); cada tema confirmado lleva
    // su pista.
    if (resB.length || sinDatos.length) pbPedido = { ...pbPedido, pistas: pistasParaPedido(pbPedido.pistas, confirmados, sinConfirmar).filter((p) => !sinDatos.includes(p)) };
    const sistema = GENERADOR.replaceAll("{idioma_guia}", plan.idioma_guia ?? "es").replaceAll("{perfil_edad}", plan.perfil_edad ?? "juvenil");
    const nota = [notaIdioma(idiomaForzado(fuente) ?? (plan.idioma_forzado ? plan.idioma_guia : null)), notaDeTemas(confirmados, sinConfirmar, sinDatos)].filter(Boolean).join("\n");
    const contenido = [{ type: "text", text: `${nota ? nota + "\n" : ""}Datos: nivel ${nivel} · perfil ${plan.perfil_edad} · idioma de la guía ${plan.idioma_guia} · apoyo ${JSON.stringify(plan.apoyo)}\nPlan del bloque: ${JSON.stringify(pbPedido)}\nInventario del bloque: ${JSON.stringify(invBloque)}\nPuntos difíciles: ${JSON.stringify(plan.puntos_dificiles)}` }];
    // Esfuerzo bajo por defecto y tope de 20 000 tokens (~80 s a la velocidad medida de Haiku): el pensamiento de la IA
    // cuenta dentro de max_tokens, y un bloque de inglés con apoyo en español pasó de 16 000 aun con esfuerzo bajo.
    let r: Respuesta;
    try {
      const res = await llamar(supabase, t, fuente, "escribir", `generar ${bi + 1}`, { sistema, contenido, maxTokens: 20000, previo: n > 0 && !cortado ? D.intento_ia?.previo : undefined });
      if (res === REPETIR) return t.paso;
      r = res;
    } catch (e) {
      // Si se pasó de tiempo, se trata como respuesta demasiado larga: el siguiente intento pide la mitad de los juegos.
      const tiempo = (e as Error).name === "TimeoutError" || /timed out|abort/i.test((e as Error).message ?? "");
      if (!tiempo || n >= 2) throw e;
      D.intento_ia = { paso: t.paso, n: n + 1, motivo: "max_tokens" };
      await guardar(supabase, t, { datos: D });
      return t.paso;
    }
    const completo = Array.isArray(r.json?.pistas) && r.parada !== "max_tokens";
    // Tercer intento: si aun así se cortó, se usa lo que alcanzó a escribir (JSON reparado) con tal de que traiga pistas.
    const parcial = !completo && n >= 2 && Array.isArray(r.json?.pistas) && r.json.pistas.length > 0;
    if (!completo && !parcial) {
      if (n >= 2) {
        // Se acabó la escalera: el reintento normal del trabajo la empieza de nuevo (hasta 3 veces).
        delete D.intento_ia;
        await diagnosticar(supabase, t, `generar ${bi + 1}`, r);
        throw new Error(`El generador no devolvió el bloque ${bi + 1} (${r.parada ?? "sin motivo"}, ${r.texto.length} caracteres)`);
      }
      D.intento_ia = { paso: t.paso, n: n + 1, motivo: r.parada === "max_tokens" ? "max_tokens" : "sin_json", previo: r.texto.trim().slice(0, 40000) || undefined };
      await diagnosticar(supabase, t, `generar ${bi + 1}`, r);
      return t.paso;
    }
    delete D.intento_ia;
    const b = r.json;
    // El duelo va en la lista "duelo" del bloque; si la IA lo puso dentro de "actividades" también se acepta. Mientras
    // se revisa, vive en "actividades" con tipo "duelo"; al armar el cartucho pasa a la lista "duelo" del bloque.
    const duelo = (Array.isArray(b.duelo) ? b.duelo : []).filter((a: any) => a && typeof a === "object").map((a: any) => ({ ...a, tipo: "duelo" }));
    const tipoDe = (a: any) => a.tipo ?? (Array.isArray(a.opciones) ? "opcion_multiple" : a.afirmacion !== undefined ? "verdadero_falso" : "completar");
    D.bloques[bi] = { id: pb.id ?? `b${bi + 1}`, titulo: pb.titulo, ...(cortado ? { reducido: true } : {}), ...(parcial ? { parcial: true } : {}), pistas: (b.pistas ?? []).map((p: any, k: number) => ({ ...p, id: p.id ?? `${pb.id ?? "b" + (bi + 1)}p${k + 1}` })), actividades: [...aplanar(b.actividades), ...duelo], mini_examen: (b.mini_examen ?? []).map((a: any, k: number) => ({ ...a, tipo: tipoDe(a), id: a.id ?? `${pb.id ?? "b" + (bi + 1)}me${k + 1}` })) };
    // Los juegos de clasificar quedan con dos grupos desde que se escriben (también en la vista previa), y cada pregunta
    // con sus campos de siempre: la vista previa no pasa por revisar (11 nov 2026: una salió vacía por venir en "texto").
    for (const a of [...D.bloques[bi].actividades, ...D.bloques[bi].mini_examen]) { normalizarActividad(a, plan.idioma_guia ?? "es"); normalizarClasificar(a); }
    // Pistas y actividades con datos investigados llevan la marca «Completado con fuentes»; los temas que no se
    // pudieron confirmar quedan como nota para repasarlos en el libro (nunca con contenido inventado).
    if (resB.length || sinDatos.length) { marcarInvestigado(D.bloques[bi], resB); agregarNotasTemario(D.bloques[bi], paraRepasar, plan.idioma_guia ?? "es"); }
    if (sinDatos.length) D.bloques[bi].pistas_sin_datos = sinDatos;
    const ultimoVp = t.alcance === "vista_previa";
    let sig: string;
    if (ultimoVp) sig = "armar";
    else if (bi + 1 < plan.bloques.length) sig = `generar:${bi + 1}`;
    else sig = "revisar";
    await guardar(supabase, t, { datos: D, paso: sig, progreso: { pct: 40 + Math.round(30 * (bi + 1) / plan.bloques.length), mensaje: bi + 1 < plan.bloques.length && !ultimoVp ? `Escribiendo el bloque ${bi + 2} de ${plan.bloques.length} ✍️` : "Revisando que todo esté perfecto ✅", paso: sig }, costo_usd: t.costo_usd, tokens_entrada: t.tokens_entrada, tokens_salida: t.tokens_salida });
    return sig;
  }

  if (t.paso === "revisar") {
    const huecos: string[] = [];
    const citas: string[] = D.citas ?? [];
    const idioma = D.plan.idioma_guia ?? "es";
    const descartes: Descarte[] = [];
    for (const b of D.bloques as any[]) {
      // Un bloque que solo trae la nota del temario no pide huecos: el reparador no debe inventar preguntas para él.
      if (b?.solo_nota) continue;
      b.actividades = fusionarParejas(b.actividades, idioma);
      const antes = b.actividades.length;
      b.actividades = b.actividades.filter((a: any) => revisarActividad(a, citas, nivel, huecos, b.id, descartes, idioma));
      b.mini_examen = b.mini_examen.filter((a: any) => revisarActividad(a, citas, nivel, huecos, b.id, descartes, idioma));
      // Hueco si quedan menos de la mitad de las actividades que el plan pidió (los juegos de una pieza cuentan 1), con un
      // mínimo de 6 solo si el plan pidió 6 o más: un bloque planeado con ordenar y clasificar no tiene hueco.
      const pbPlan = (D.plan.bloques ?? []).find((x: any) => x.id === b.id);
      const esperado = pbPlan ? Object.entries(pbPlan.juegos ?? {}).reduce((n: number, [k, v]) => n + (POR_PIEZA.includes(k) ? Math.min(1, ent(v)) : ent(v)), 0) : antes;
      const tiposB = [...new Set(b.actividades.map((a: any) => juegoDe(a.tipo)))].join(", ") || "opcion_multiple";
      // Mínimos de cada juego (Daniel, 8 nov 2026): lo que se quedó corto lo COMPLETA la reparación con el mismo tipo.
      for (const fa of faltasDeBloque(b)) huecos.push(textoFalta(b, fa));
      if (b.actividades.length < Math.max(Math.min(6, esperado), esperado * 0.5)) huecos.push(`Bloque ${b.id}: quedaron ${b.actividades.length} actividades válidas de ${antes}; agrega preguntas a los juegos que ya tiene el bloque (${tiposB})`);
      for (const pd of D.plan.puntos_dificiles ?? []) { const n = b.actividades.filter((a: any) => a.punto_dificil === pd.id).length; if (n > 0 && n < 3) huecos.push(`Punto difícil ${pd.id} '${pd.descripcion}' tiene ${n} actividad(es) en el bloque ${b.id}: faltan ${3 - n}, de los tipos que ya tiene el bloque (${tiposB})`); }
    }
    // Primero los mínimos (no se pueden quedar fuera), luego lo demás.
    D.huecos = [...huecos.filter((h) => h.startsWith("MÍNIMO")), ...huecos.filter((h) => !h.startsWith("MÍNIMO")).slice(0, 8)];
    // Cada actividad descartada queda anotada con su motivo (en datos.descartes, en datos.diagnostico y en el log).
    anotarDescartes(D, "revisar", descartes);
    // Pistas que no caben en una slide y exceso de slides: los arregla el paso reparar.
    const perfil = D.plan.perfil_edad ?? "juvenil";
    // Las notas del temario («repásalo en tu libro») las escribe el código y no se dividen.
    D.pistas_largas = (D.bloques as any[]).flatMap((b) => b.pistas.filter((p: any) => !p.nota_temario).map((p: any) => ({ bloque: b.id, id: p.id, motivo: problemaDePista(p, perfil) })).filter((x: any) => x.motivo));
    const tope = topeDe(D.plan);
    const estimado = estimarSlides(D.bloques) + D.pistas_largas.length;
    D.slides = { ...(D.slides ?? {}), tope, generado: estimarSlides(D.bloques), exceso: Math.max(0, estimado - tope) };
    const arreglar = huecos.length > 0 || D.pistas_largas.length > 0 || estimado > tope;
    const sig = arreglar ? "reparar" : "ortografia";
    await guardar(supabase, t, { datos: D, paso: sig, progreso: { pct: 72, mensaje: arreglar ? "Arreglando detallitos 🔧" : "Revisando la ortografía ✍️", paso: sig } });
    return sig;
  }

  if (t.paso === "reparar") {
    const plan = D.plan;
    const sistema = REPARADOR;
    const perfil = plan.perfil_edad ?? "juvenil";
    const largas = (D.pistas_largas ?? []) as { bloque: string; id: string; motivo: string }[];
    const pistaPorId = (id: string) => (D.bloques as any[]).flatMap((b) => b.pistas).find((p: any) => p.id === id);
    const textoLargas = largas.length ? `\nPistas demasiado largas (divídelas en dos):\n${largas.map((l) => `- ${l.id} (${l.motivo}): ${JSON.stringify(pistaPorId(l.id))}`).join("\n")}` : "";
    const notaR = notaIdioma(idiomaForzado(fuente) ?? (plan.idioma_forzado ? plan.idioma_guia : null));
    // Lo que ya tiene cada bloque (tipos y textos), para completar con el mismo tipo y sin repetir preguntas. Los bloques
    // que solo llevan la nota del temario no se muestran: ahí no hay nada confirmado con qué escribir preguntas.
    const conJuegos = (D.bloques as any[]).filter((b) => b && !b.solo_nota);
    const actuales = Object.fromEntries(conJuegos.map((b) => [b.id, { tipos: [...new Set(b.actividades.map((a: any) => a.tipo))], mini_examen: b.mini_examen.length, preguntas: [...b.actividades, ...b.mini_examen].map((a: any) => ({ id: a.id, tipo: a.tipo, pregunta: a.pregunta ?? a.afirmacion ?? a.enunciado ?? a.instruccion, pares: a.pares?.map((p: any) => p.termino), grupos: a.grupos, tarjetas: a.elementos?.map((e: any) => ({ texto: e.texto, grupo: e.grupo })) })) }]));
    // Inventario completo, como antes (2026-11-11.6: con solo el del bloque, un juego que no alcanzaba se borraba y, si
    // era el único, la guía no se entregaba), pero lo investigado sin sus urls. Las notas «repásalo en tu libro» no
    // reciben preguntas: no se ofrecen como pista.
    const invRep = inventarioParaReparar(D);
    const contenido = [{ type: "text", text: `${notaR ? notaR + "\n" : ""}Idioma de la guía: ${plan.idioma_guia}. Nivel: ${nivel}. Perfil: ${plan.perfil_edad}.\nHuecos a reparar:\n${(D.huecos ?? []).map((h: string) => "- " + h).join("\n") || "(ninguno)"}${textoLargas}\nPistas de cada bloque (cada actividad nueva lleva en "pista" una de las del bloque de su hueco): ${JSON.stringify(Object.fromEntries(conJuegos.map((b) => [b.id, b.pistas.filter((p: any) => !p?.nota_temario).map((p: any) => p.id)])))}\nJuegos que ya tiene cada bloque (no repitas sus preguntas): ${JSON.stringify(actuales)}\nIds que ya existen: ${JSON.stringify((D.bloques as any[]).flatMap((b) => [...b.actividades, ...b.mini_examen].map((a: any) => a.id)))}\nInventario:\n${JSON.stringify(invRep)}\nPuntos difíciles: ${JSON.stringify(plan.puntos_dificiles)}` }];
    let divididas: any[] = [];
    if ((D.huecos ?? []).length || largas.length) try {
      const res = await llamar(supabase, t, fuente, "reparar", "reparar", { sistema, contenido, maxTokens: 16000 });
      if (res === REPETIR) return "reparar";
      const r = res;
      if (!r.json?.actividades_nuevas && !r.json?.pistas_divididas && !r.json?.ampliaciones) await diagnosticar(supabase, t, "reparar", r);
      divididas = Array.isArray(r.json?.pistas_divididas) ? r.json.pistas_divididas : [];
      const reparado = aplicarReparacion(D.bloques, r.json ?? {}, D.citas ?? [], nivel, plan.idioma_guia ?? "es", D.huecos ?? []);
      anotarDescartes(D, "reparar", reparado.descartes);
      D.reparadas = reparado.colocadas;
      D.sin_contenido = Array.isArray(r.json?.sin_contenido) ? r.json.sin_contenido.slice(0, 20) : [];
    } catch (e) { if ((e as any)?.reintentar) throw e; console.warn("Reparación falló, sigue sin ella:", (e as Error).message); }
    // Pistas largas: se usan las pistas de continuación de la IA si ya caben; si no, se dividen por código.
    const notas: string[] = [];
    for (const l of largas) {
      const b = (D.bloques as any[]).find((x) => x.id === l.bloque); if (!b) continue;
      const i = b.pistas.findIndex((p: any) => p.id === l.id); if (i < 0) continue;
      const p = b.pistas[i];
      const ia = divididas.find((d: any) => d?.id === l.id)?.pistas;
      const piezasIa = Array.isArray(ia) && ia.length >= 2 && ia.every((x: any) => x && typeof x === "object" && x.titulo && Array.isArray(x.ideas) && x.ideas.length && !problemaDePista(x, perfil))
        ? ia.slice(0, 3).map((x: any, k: number) => ({ ...x, id: k === 0 ? p.id : `${p.id}_${k + 1}`, emoji: x.emoji ?? p.emoji, ...(k === 0 && p.titulo_pagina ? { titulo_pagina: p.titulo_pagina } : {}) }))
        : null;
      const piezas = piezasIa ?? dividirPistaCodigo(p, perfil);
      if (piezas.length > 1) { b.pistas.splice(i, 1, ...piezas); notas.push(`${l.id} dividida en ${piezas.length} (${piezasIa ? "IA" : "código"})`); }
    }
    // Lo que siga por debajo del mínimo después de completar se descarta entero, con su motivo (nunca se publica un
    // juego de 1 o 2 preguntas).
    const cortos: Descarte[] = [];
    for (const b of D.bloques as any[]) descartarCortos(b, cortos, "no hubo contenido suficiente en los apuntes para completarlo");
    if (cortos.length) anotarDescartes(D, "reparar · mínimos", cortos);
    // Tope de slides: si la guía se pasa, se fusiona y luego se recorta (ver recortarBloques).
    const recortes = recortarBloques(D.bloques, topeDe(plan), perfil, plan.primera_actividad ?? "");
    D.slides = { ...(D.slides ?? {}), pistas_divididas: notas, recortes, tras_reparar: estimarSlides(D.bloques) };
    await guardar(supabase, t, { datos: D, paso: "ortografia", progreso: { pct: 76, mensaje: "Revisando la ortografía ✍️", paso: "ortografia" }, costo_usd: t.costo_usd, tokens_entrada: t.tokens_entrada, tokens_salida: t.tokens_salida });
    return "ortografia";
  }

  // Segunda parte de la reparación (Daniel, 8 nov 2026): revisión ortográfica de todos los textos, sin cambiar el
  // contenido. Usa el modelo del paso reparar. El código solo acepta cambios pequeños (tildes, signos, mayúsculas,
  // concordancia) y nunca toca opciones ni respuestas de las guías de lengua (ahí los distractores mal escritos son a
  // propósito).
  if (t.paso === "ortografia") {
    const plan = D.plan;
    const reg = textosDeGuia(D);
    const fijas = corregirFijas(reg);
    const textos = Object.fromEntries(Object.entries(reg).map(([k, v]) => [k, leerRuta(v)]));
    let resultado = { aplicadas: [] as any[], rechazadas: [] as any[] };
    if (Object.keys(textos).length) try {
      const nota = notaIdioma(idiomaForzado(fuente) ?? (plan.idioma_forzado ? plan.idioma_guia : null));
      const contenido = [{ type: "text", text: `${nota ? nota + "\n" : ""}Idioma de la guía: ${plan.idioma_guia}. Materia: ${plan.materia}. Nivel: ${nivel}.\nTEXTOS (ruta → texto):\n${JSON.stringify(textos)}` }];
      const res = await llamar(supabase, t, fuente, "reparar", "reparar · ortografía", { sistema: CORRECTOR, contenido, maxTokens: 12000 });
      if (res === REPETIR) return "ortografia";
      if (!Array.isArray(res.json?.correcciones)) await diagnosticar(supabase, t, "ortografia", res);
      resultado = aplicarOrtografia(reg, res.json?.correcciones ?? []);
    } catch (e) { if ((e as any)?.reintentar) throw e; console.warn("Revisión ortográfica falló, sigue sin ella:", (e as Error).message); }
    D.ortografia = { textos: Object.keys(textos).length, fijas, aplicadas: resultado.aplicadas.slice(0, 120), rechazadas: resultado.rechazadas.slice(0, 60) };
    await guardar(supabase, t, { datos: D, paso: "verificar", progreso: { pct: 80, mensaje: "Verificando los datos 🔎", paso: "verificar" }, costo_usd: t.costo_usd, tokens_entrada: t.tokens_entrada, tokens_salida: t.tokens_salida });
    return "verificar";
  }

  if (t.paso === "verificar") {
    const plan = D.plan; const tipos = (D.fotos ?? []).map((f: any) => f.tipo);
    const hayApuntes = tipos.some((x: string) => x && x !== "libro_impreso");
    const modeloV = ajusteDe("verificar", D.con_haiku?.verificar ? {} : fuente.opciones ?? {}).modelo;
    // La verificación va POR PARTES (2026-11-11.6): cada llamada lleva máx. 3 búsquedas y solo SU parte del contenido,
    // una línea por pista o actividad. En una sola llamada con hasta 10 búsquedas, cada búsqueda volvía a leer todo:
    // 93 000 a 313 000 tokens, y arriba de 100 000 Haiku cobra 5 veces más. Las búsquedas son las mismas: 10 con apuntes a
    // mano; 4 con libro impreso o si más de la mitad ya trae sus fuentes (lo investigado y confirmado no se vuelve a
    // buscar). El tope de 5 MXN las ajusta con el precio real y deja rastro (anotarCandado). Nunca detiene la guía.
    if (!D.verif || !Array.isArray(D.verif.partes)) {
      const { bloques: bloquesResumen, total, omitidos } = contenidoParaVerificar(D);
      D.verif = planVerificacion(lineasParaVerificar(bloquesResumen), hayApuntes && omitidos * 2 <= total ? 10 : 4);
      D.verif.reporte = bloquesResumen.length ? [] : [{ estado: "omitida", detalle: `No se llamó a la IA: todo el contenido (${total}) viene de fuentes confirmadas al investigar los temas del temario` }];
      ajustarVerificacion(D, modeloV, 0);
    }
    const v = D.verif;
    v.reporte = Array.isArray(v.reporte) ? v.reporte : Array.isArray(D.verificacion) ? D.verificacion : [];
    if (v.i < v.partes.length) {
      const i = v.i;
      // Antes de cada parte, el tope otra vez, con lo que de verdad se lleva gastado.
      ajustarVerificacion(D, modeloV, i);
      const busquedas = v.busquedas[i] ?? 0;
      try {
        const sospechas = i === 0 ? Object.values((D.inventario ?? {}) as Record<string, any[]>).flat().filter((e: any) => e?.motivo) : [];
        const contenido = [{ type: "text", text: `Idioma: ${plan.idioma_guia}. Materia: ${plan.materia}. Grado: ${fuente.grado}. Tipos de foto: ${JSON.stringify(tipos)}. ${hayApuntes ? "Hay apuntes a mano o pizarrón: verifica las afirmaciones clave." : "Es libro impreso: verifica solo lo dudoso."} Parte ${i + 1} de ${v.partes.length}${busquedas ? ` (${busquedas} búsqueda${busquedas === 1 ? "" : "s"})` : " (sin buscador: lo que creas que está mal va como «revisar_dato»)"}.${sospechas.length ? `\nSospechas del extractor: ${JSON.stringify(sospechas)}` : ""}\n\nCONTENIDO A VERIFICAR (una línea por pista o actividad; empieza con su id):\n${v.partes[i].lineas.join("\n")}` }];
        const res = await llamar(supabase, t, fuente, "verificar", `verificar ${i + 1}/${v.partes.length}`, { sistema: VERIFICADOR, contenido, maxTokens: 16000, herramientas: busquedas > 0 ? [{ type: "web_search_20260209", name: "web_search", max_uses: busquedas, allowed_domains: DOMINIOS_CONFIABLES }] : undefined });
        if (res === REPETIR) return "verificar";
        const r = res;
        if (!Array.isArray(r.json?.resultados)) await diagnosticar(supabase, t, "verificar", r);
        for (const res of r.json?.resultados ?? []) {
          // Un id por entrada; si la IA juntó varios ("b2p2, b2vf3, b2c2"), cada uno se trata por separado.
          const ids = idsDeVerificacion(D.bloques as any[], res.actividad);
          // "no_confirmada" solo queda en el reporte: no quita actividades ni pistas (decisión del 8 nov 2026). Solo lo
          // que la IA marcó como incorrecto Y corrigió CON FUENTE se modifica (Daniel, 11 nov 2026: «lápiz es
          // esdrújula», sin ninguna búsqueda, borró un juego y puso un «Dato corregido» falso). Basta 1 fuente oficial
          // o 1 sitio confiable de la lista (Cambridge, Oxford, Merriam-Webster, RAE…) que haya salido en ESTA búsqueda;
          // sin ella, nada cambia y va a Reportes como «revisar_dato».
          const corrige = res?.estado === "corregida" && !!String(res.dato_correcto ?? "").trim();
          const fuentes = corrige ? fuentesValidas(listaDeFuentes(res.fuentes), r.urls) : [];
          if (corrige && !fuentes.length) {
            v.reporte.push({ ...res, ids, estado: "revisar_dato", estado_ia: "corregida", sin_cambio: "sin una fuente oficial o confiable que haya salido en su búsqueda" });
            continue;
          }
          v.reporte.push({ ...res, ids, ...(corrige ? { fuentes: fuentes.map((f) => f.url) } : {}) });
          if (!corrige) continue;
          for (const id of ids) aplicarCorreccion(D.bloques as any[], id, { ...res, fuentes: fuentes.map((f) => ({ nombre: f.nombre, url: f.url })) });
        }
      } catch (e) { if ((e as any)?.reintentar) throw e; console.warn("Verificación falló, se marca para revisión:", (e as Error).message); v.reporte.push({ estado: "error", parte: i + 1, detalle: (e as Error).message }); }
      v.i = i + 1;
      if (v.i < v.partes.length) {
        await guardar(supabase, t, { datos: D, costo_usd: t.costo_usd, tokens_entrada: t.tokens_entrada, tokens_salida: t.tokens_salida });
        return "verificar";
      }
    }
    const reporte = v.reporte;
    D.verificacion = reporte;
    delete v.reporte;
    // «contradice_libro» y las correcciones sin fuente («revisar_dato») (Daniel, 11 nov 2026): cada dato llega a Reportes
    // del panel para que Daniel decida, con su motivo y su bloque, sin datos de la familia. Una sola vez por trabajo (si
    // el paso se repite, no se duplican).
    if (D.reportes_contradice === undefined && t.guia_id) {
      const filas = reportesDeVerificacion(reporte, D.bloques as any[]).map((comentario) => ({ guia_id: t.guia_id, slide: null, comentario }));
      if (filas.length) {
        const { error } = await supabase.from("reportes").insert(filas);
        if (error) console.warn("No se pudieron guardar los reportes de «contradice el libro»:", error.message);
      }
      D.reportes_contradice = filas.length;
    }
    await guardar(supabase, t, { datos: D, paso: "imagenes", progreso: { pct: 88, mensaje: "Buscando las fotografías de los personajes 🖼️", paso: "imagenes" }, costo_usd: t.costo_usd, tokens_entrada: t.tokens_entrada, tokens_salida: t.tokens_salida });
    return "imagenes";
  }

  if (t.paso === "imagenes") {
    const idioma = D.plan.idioma_guia ?? "es";
    const nombres = new Set<string>();
    for (const b of D.bloques as any[]) { for (const p of b.pistas) for (const n of p.personajes ?? []) nombres.add(n); for (const a of b.actividades) if (a.tipo === "quien_es_quien") for (const par of a.pares ?? []) nombres.add(par.termino); }
    for (const n of D.plan.identidad?.retratos_portada ?? []) nombres.add(n);
    const cache: Record<string, any> = D.imagenes ?? {};
    let buscados = 0;
    for (const n of [...nombres].slice(0, 12)) { if (cache[n] !== undefined) continue; cache[n] = await imagenWikipedia(n, idioma); buscados++; }
    D.imagenes = cache;
    for (const b of D.bloques as any[]) {
      for (const p of b.pistas) { const imgs = (p.personajes ?? []).map((n: string) => cache[n] ? { tipo: "retrato", nombre: n, url: cache[n].url, pie: cache[n].pie, credito: cache[n].credito } : null).filter(Boolean); if (imgs.length) p.imagenes = [...(p.imagenes ?? []), ...imgs]; }
      for (const a of b.actividades) if (a.tipo === "quien_es_quien") { a.pares = (a.pares ?? []).map((par: any) => ({ ...par, imagen: cache[par.termino]?.url ?? null })); if (!a.pares.some((x: any) => x.imagen)) a.tipo = "conceptos"; }
    }
    D.plan.identidad.retratos_portada = (D.plan.identidad.retratos_portada ?? []).map((n: string) => cache[n] ? { nombre: n, url: cache[n].url } : null).filter(Boolean);
    await guardar(supabase, t, { datos: D, paso: "armar", progreso: { pct: 94, mensaje: "Armando tu guía 🧩", paso: "armar" } });
    return "armar";
  }

  if (t.paso === "armar") {
    const plan = D.plan;
    // Copia: el cartucho se arregla aquí sin tocar datos.bloques (el trabajo "resto" sigue desde ahí).
    const bloques = JSON.parse(JSON.stringify((D.bloques as any[]).filter(Boolean)));
    // Temas del temario: la marca «Completado con fuentes» también en las pistas que la reparación dividió, y cada
    // bloque lleva la lista de lo completado (con fuentes) y de lo que se queda para repasar en el libro.
    for (const b of bloques) {
      const resB = resultadosDeBloque(D, b.id);
      // Las pistas del plan que no tenían datos (ya son nota) también se listan para repasar en el libro.
      const sinDatos: string[] = Array.isArray(b.pistas_sin_datos) ? b.pistas_sin_datos : [];
      delete b.pistas_sin_datos;
      if (!resB.length && !sinDatos.length) continue;
      marcarInvestigado(b, resB);
      b.temas_completados = resB.filter((r) => r.estado === "confirmado").map((r) => ({ tema: r.tema, fuentes: r.fuentes }));
      b.temas_para_repasar = [...resB.filter((r) => r.estado === "no_confirmado").map((r) => ({ tema: r.tema, pagina: r.pagina })), ...sinDatos.map((tema) => ({ tema, pagina: "" }))];
    }
    // Bloques que solo traen la nota del temario: la nota pasa al bloque anterior (o al siguiente) y el bloque vacío no se
    // arma (nunca un bloque sin juegos ni preguntas inventadas para llenarlo).
    for (let i = bloques.length - 1; i >= 0; i--) {
      if (!bloques[i].solo_nota || bloques.length < 2) continue;
      const vecino = bloques[i - 1] ?? bloques[i + 1];
      vecino.pistas = [...(vecino.pistas ?? []), ...bloques[i].pistas];
      vecino.temas_para_repasar = [...(vecino.temas_para_repasar ?? []), ...(bloques[i].temas_para_repasar ?? [])];
      bloques.splice(i, 1);
    }
    const cartucho: any = { version_formato: "1.3", plan: { ...plan, identidad: { ...plan.identidad } }, bloques, calentamiento: [], reto_final: [] };
    delete cartucho.plan.bloques; delete cartucho.plan.inventario_no_usado;
    cartucho.plan.bloques_plan = plan.bloques;
    // Red de seguridad (también en la vista previa, que no pasa por revisar): ningún juego por debajo del mínimo y
    // nunca dos juegos del mismo tipo seguidos dentro de un bloque.
    const fuera: Descarte[] = [];
    for (const b of bloques) { descartarCortos(b, fuera, "por debajo del mínimo al armar"); quitarRepetidos(b, fuera); }
    if (fuera.length) anotarDescartes(D, "armar", fuera);
    const om = (b: any) => b.actividades.filter((a: any) => a.tipo === "opcion_multiple");
    // Calentamiento: 5 o 6 preguntas fáciles de los dos primeros bloques (si faltan fáciles, cualquiera).
    let cal = bloques.slice(0, 2).flatMap((b: any) => om(b).filter((a: any) => a.dificultad !== "retadora").slice(0, 3).map((a: any) => a.id)).slice(0, 6);
    if (cal.length < MIN_PREGUNTAS) cal = [...new Set([...cal, ...bloques.slice(0, 2).flatMap((b: any) => om(b).map((a: any) => a.id))])].slice(0, 6);
    cartucho.calentamiento = cal.length >= MIN_PREGUNTAS ? cal : [];
    const pdIds = new Set((plan.puntos_dificiles ?? []).map((p: any) => p.id));
    const candidatos = bloques.flatMap((b: any) => b.actividades.filter((a: any) => ["opcion_multiple", "verdadero_falso", "completar"].includes(a.tipo)));
    const conPeso = candidatos.sort((a: any, b: any) => Number(pdIds.has(b.punto_dificil)) - Number(pdIds.has(a.punto_dificil)));
    const reto = conPeso.slice(0, Math.min(20, Math.max(8, plan.reto_final ?? 16))).map((a: any) => a.id);
    cartucho.reto_final = reto.length >= MIN_PREGUNTAS ? reto : [];
    // Orden de los juegos: cada bloque lleva "orden" (tipos en el orden en que se juegan, después de sus pistas) y sus
    // actividades vienen ya en ese orden; nunca el mismo tipo al final de un bloque y al principio del siguiente.
    const primera = plan.primera_actividad ?? "calentamiento";
    for (const b of bloques) {
      const pb = (plan.bloques ?? []).find((x: any) => x.id === b.id) ?? {};
      const hay = [...new Set(b.actividades.map((a: any) => juegoDe(a.tipo)))] as string[];
      if (b.mini_examen?.length) hay.push("mini_examen");
      b.orden = [...new Set([...(pb.orden_actividades ?? []).filter((x: string) => hay.includes(x)), ...hay])];
      b.mecanica_quiz = pb.mecanica_quiz ?? null;
    }
    arreglarAdyacencias(bloques.map((b: any) => b.orden), primera === "calentamiento" ? null : juegoDe(primera));
    for (const b of bloques) {
      const pos = (a: any) => b.orden.indexOf(juegoDe(a.tipo));
      b.actividades = b.actividades.map((a: any, i: number) => [a, i]).sort((x: any, y: any) => pos(x[0]) - pos(y[0]) || x[1] - y[1]).map((x: any) => x[0]);
      // El duelo va en la lista "duelo" del bloque (así lo lee el reproductor), nunca dentro de "actividades".
      b.duelo = b.actividades.filter((a: any) => a.tipo === "duelo").map(({ tipo: _t, ...a }: any) => a);
      b.actividades = b.actividades.filter((a: any) => a.tipo !== "duelo");
    }
    cartucho.primera_actividad = primera === "calentamiento" || bloques[0]?.orden?.[0] === primera ? primera : "calentamiento";
    cartucho.slides_estimados = estimarSlides(bloques);
    cartucho.plan.presupuesto_slides = topeDe(plan);
    cartucho.verificacion = D.verificacion ?? [];
    cartucho.completo = t.alcance !== "vista_previa"; // la vista previa solo trae el bloque 1
    D.cartucho = cartucho;
    await guardar(supabase, t, { datos: D, paso: "listo", estado: "listo", progreso: { pct: 100, mensaje: "¡Tu guía está lista! 🎉", paso: "listo" } });
    return null;
  }

  return null;
}

export function aplanar(obj: any): any[] {
  if (!obj) return [];
  if (Array.isArray(obj)) return obj.map((a: any) => (a && typeof a === "object" && !a.tipo && Array.isArray(a.opciones)) ? { ...a, tipo: "opcion_multiple" } : a);
  const out: any[] = [];
  for (const [tipo, lista] of Object.entries(obj)) for (const a of (lista as any[]) ?? []) if (a && typeof a === "object") out.push({ ...a, tipo: a.tipo ?? tipo });
  return out;
}

// ---------- Idioma forzado (pruebas y guías del administrador) ----------
// datos.opciones.idioma_guia = "es" | "en" | "fr" obliga a escribir toda la guía en ese idioma aunque los apuntes estén
// en otro. Las citas de la fuente ("De tus notas") se copian tal cual, en el idioma original.
const NOMBRE_IDIOMA: Record<string, string> = { es: "español", en: "inglés", fr: "francés" };
export function idiomaForzado(fuente: { opciones?: Record<string, unknown> }): string | null {
  const v = String(fuente.opciones?.idioma_guia ?? "").trim().toLowerCase();
  return NOMBRE_IDIOMA[v] ? v : null;
}
export function notaIdioma(idioma: string | null): string {
  if (!idioma) return "";
  return `IDIOMA OBLIGATORIO DE LA GUÍA: ${idioma} (${NOMBRE_IDIOMA[idioma]}). Escribe TODO lo que redactas (títulos, objetivos, pistas, preguntas, opciones, retroalimentación, instrucciones) en ${NOMBRE_IDIOMA[idioma]}, aunque los apuntes estén en otro idioma: traduce con fidelidad, sin agregar datos. Los nombres propios se quedan como son. La "cita" de cada "fuente" se copia TAL CUAL del inventario, en su idioma original.`;
}

// ---------- Tamaño, pistas y variedad (criterios de Daniel, 7 nov 2026) ----------
// Cuenta de slides: 5 fijas (portada, tutorial, calentamiento, reto final y resultados) + 1 por pista + 1 por juego
// (opción múltiple y completar juntos son uno; verdadero o falso, duelo y mini-examen juntan sus preguntas en una sola;
// cada conceptos, súper dato, ordenar, clasificar y quién es quién es uno). Tope: 25; hasta 30 si el plan lo justifica.
export const SLIDES_FIJAS = 5;
export const TOPE_SLIDES = 25;
const TOPE_JUSTIFICADO = 30;
const POR_PIEZA = ["conceptos", "super_dato", "ordenar", "clasificar", "quien_es_quien"];
// Juegos que se pueden quitar cuando sobra, del primero al último (siempre quedan al menos 2 juegos por bloque).
const PRESCINDIBLES = ["verdadero_falso", "super_dato", "quien_es_quien", "ordenar", "clasificar", "conceptos", "duelo"];
const ent = (x: unknown) => Math.max(0, Math.round(Number(x) || 0));
const juegoDe = (k: string) => k === "completar" ? "opcion_multiple" : k;

function juegosDelPlan(pb: any): string[] {
  const j = pb.juegos ?? {};
  const out: string[] = [];
  for (const k of TIPOS_JUEGO) if (ent(j[k]) > 0 && !out.includes(juegoDe(k))) out.push(juegoDe(k));
  if (ent(pb.mini_examen) > 0) out.push("mini_examen");
  return out;
}
export function estimarSlidesPlan(plan: any): number {
  return SLIDES_FIJAS + (plan?.bloques ?? []).reduce((n: number, pb: any) => n + (Array.isArray(pb.pistas) ? pb.pistas.length : 0) + juegosDelPlan(pb).length, 0);
}
function juegosDelBloque(b: any): number {
  const acts = (b?.actividades ?? []) as any[];
  const hay = (...t: string[]) => acts.some((a) => t.includes(a?.tipo));
  return (hay("opcion_multiple", "completar") ? 1 : 0) + (hay("verdadero_falso") ? 1 : 0) + (hay("duelo") || (b?.duelo?.length ?? 0) > 0 ? 1 : 0) + acts.filter((a) => POR_PIEZA.includes(a?.tipo)).length + ((b?.mini_examen?.length ?? 0) > 0 ? 1 : 0);
}
export const slidesDeBloque = (b: any) => (b?.pistas?.length ?? 0) + juegosDelBloque(b);
export const estimarSlides = (bloques: any[]) => SLIDES_FIJAS + (bloques ?? []).filter(Boolean).reduce((n, b) => n + slidesDeBloque(b), 0);
export function topeDe(plan: any): number {
  const justificado = String(plan?.justificacion_slides ?? "").trim().length > 10;
  return justificado ? Math.min(TOPE_JUSTIFICADO, Math.max(TOPE_SLIDES, ent(plan?.presupuesto_slides), ent(plan?.slides_estimados))) : TOPE_SLIDES;
}

// Semilla de variedad por guía (del id del borrador): sugiere una primera actividad distinta para que no todas las
// guías empiecen igual.
const PRIMERAS = ["conceptos", "calentamiento", "verdadero_falso", "duelo", "ordenar", "clasificar", "opcion_multiple", "super_dato"];
export function semillaDe(s: string): number { let h = 2166136261; for (const ch of String(s ?? "")) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
export function sugerenciaVariedad(semilla: number): string {
  const a = PRIMERAS[semilla % PRIMERAS.length];
  let b = PRIMERAS[(semilla >>> 7) % PRIMERAS.length]; if (b === a) b = PRIMERAS[(semilla + 3) % PRIMERAS.length];
  const m = barajar(MECANICAS_QUIZ.filter((x) => x !== "carrera"), azar(semilla)).slice(0, 3);
  return `Semilla de variedad ${semilla % 1000}. Sugerencia de primera actividad: "${a}" (si el contenido no lo permite: "${b}"). Sugerencia de mecanica_quiz para los primeros bloques: ${m.join(", ")}.`;
}

/// ---------- Variedad y mínimos (criterios de Daniel, 8 nov 2026) ----------
// Generador de números al azar con semilla (la misma guía siempre sale igual; dos guías distintas, distinto).
export function azar(semilla: number): () => number {
  let a = (semilla >>> 0) || 1;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function barajar<T>(lista: T[], rnd: () => number): T[] {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
// Juegos que se sienten parecidos (preguntas de opción múltiple; parejas): se evita ponerlos juntos si se puede.
const PARECIDOS = [["opcion_multiple", "duelo", "mini_examen"], ["conceptos", "quien_es_quien"]];
const familia = (x: string) => PARECIDOS.find((g) => g.includes(x))?.[0] ?? x;
// Formatos que la vista previa muestra junto a la opción múltiple del bloque 1.
export const VARIEDAD_B1 = ["conceptos", "clasificar", "verdadero_falso", "ordenar"];

// Orden al azar (con semilla) de los juegos de cada bloque: el mini-examen cierra el bloque, la primera actividad va
// primero en el bloque 1, nunca el mismo tipo al final de un bloque y al principio del siguiente, y se evitan juegos
// parecidos juntos. Devuelve un orden por bloque.
export function ordenarJuegos(listas: string[][], semilla: number, primeraFija: string | null = null): string[][] {
  const rnd = azar(semilla ^ 0x5bd1e995);
  const out: string[][] = [];
  listas.forEach((js, i) => {
    const prev = i ? out[i - 1].at(-1) ?? null : null;
    const fijo = i === 0 && primeraFija && js.includes(primeraFija) ? primeraFija : null;
    const cierre = js.includes("mini_examen") && fijo !== "mini_examen" ? ["mini_examen"] : [];
    const mov = js.filter((x) => x !== fijo && !cierre.includes(x));
    const puntos = (sec: string[]) => {
      let p = prev && prev === sec[0] ? 100 : 0;
      if (prev && familia(prev) === familia(sec[0] ?? "")) p += 1;
      for (let k = 1; k < sec.length; k++) if (familia(sec[k]) === familia(sec[k - 1])) p += 1;
      return p;
    };
    let mejor: string[] | null = null, pm = Infinity;
    for (let n = 0; n < 200 && pm > 0; n++) {
      const sec = [...(fijo ? [fijo] : []), ...barajar(mov, rnd), ...cierre];
      const p = puntos(sec);
      if (p < pm) { pm = p; mejor = sec; }
    }
    out.push(mejor ?? [...js]);
  });
  return out;
}
// Arregla en su lugar los órdenes para que ningún bloque empiece con el mismo tipo con que terminó el anterior.
export function arreglarAdyacencias(ordenes: string[][], primeraFija: string | null = null): void {
  for (let i = 1; i < ordenes.length; i++) {
    const prev = ordenes[i - 1], cur = ordenes[i];
    if (!prev.length || !cur.length || prev.at(-1) !== cur[0]) continue;
    // 1) Cambiar el primero del bloque por otro que no sea el mini-examen.
    const k = cur.findIndex((x, j) => j > 0 && x !== "mini_examen" && x !== prev.at(-1));
    if (k > 0) { [cur[0], cur[k]] = [cur[k], cur[0]]; continue; }
    // 2) Cambiar el último del bloque anterior (sin mover su mini-examen ni la primera actividad fija del bloque 1).
    const desde = i - 1 === 0 && primeraFija && prev[0] === primeraFija ? 1 : 0;
    const m = prev.findIndex((x, j) => j >= desde && j < prev.length - 1 && x !== cur[0] && x !== "mini_examen" && (j + 1 >= prev.length - 1 || prev[j + 1] !== x));
    if (m >= 0 && prev.at(-1) !== "mini_examen") { const u = prev.length - 1; [prev[m], prev[u]] = [prev[u], prev[m]]; }
  }
}
// Juego que se agrega al bloque 1 cuando el plan no trae otro formato además de la opción múltiple: según lo que hay
// en su inventario (vocabulario → conceptos, categorías → clasificar, secuencias → ordenar); si no, verdadero o falso.
function juegoParaB1(pb: any, semilla: number): string {
  const ids = (Array.isArray(pb.ids_inventario) ? pb.ids_inventario : []).map(String);
  const posibles = [["voc", "conceptos"], ["cat", "clasificar"], ["sec", "ordenar"]].filter(([p]) => ids.some((x: string) => x.startsWith(p))).map(([, k]) => k);
  return posibles.length ? posibles[semilla % posibles.length] : "verdadero_falso";
}
// Mecánica visual de las preguntas de cada bloque: la del planificador si cumple (no "carrera" en el bloque 1, no la
// misma en dos bloques seguidos, no "duelo" si el bloque ya tiene juego de duelo); si no, una al azar, de preferencia
// una que la guía no haya usado.
export function ajustarMecanicas(bloques: any[], semilla: number, permitidas: string[] = MECANICAS_QUIZ): string[] {
  const notas: string[] = [];
  const lista = barajar(permitidas, azar(semilla ^ 0x27d4eb2f));
  const usadas = new Set<string>();
  bloques.forEach((pb, i) => {
    const prev = i ? bloques[i - 1].mecanica_quiz : null;
    const valida = (m: string) => permitidas.includes(m) && m !== prev && !(i === 0 && m === "carrera") && !(m === "duelo" && ent(pb.juegos?.duelo) > 0);
    let m = normaliza(String(pb.mecanica_quiz ?? "")).replace(/\s/g, "_");
    if (!valida(m)) {
      const nueva = lista.find((x) => valida(x) && !usadas.has(x)) ?? lista.find(valida) ?? "montana";
      if (m) notas.push(`${pb.id}: mecánica "${m}" → "${nueva}"`);
      m = nueva;
    }
    pb.mecanica_quiz = m; usadas.add(m);
  });
  return notas;
}

// El plan de la IA se ajusta por código: mínimos de preguntas, bloque 1 con dos formatos, juegos de una pieza a 1 por
// bloque, tope de slides (primero juegos prescindibles, luego pistas de más), orden al azar sin repeticiones seguidas,
// primera actividad válida y mecánica de las preguntas de cada bloque.
export function ajustarPlan(plan: any, semilla = 0): string[] {
  const notas: string[] = [];
  const tope = topeDe(plan);
  const uni = plan.perfil_edad === "universitario";
  if (uni && juegoDe(String(plan.primera_actividad ?? "")) === "duelo") plan.primera_actividad = "calentamiento";
  for (const pb of plan.bloques) {
    pb.pistas = (Array.isArray(pb.pistas) ? pb.pistas : []).map((x: unknown) => String(x ?? "").trim()).filter(Boolean).slice(0, 4);
    if (!pb.pistas.length) pb.pistas = (Array.isArray(pb.temas) && pb.temas.length ? pb.temas : [pb.titulo]).slice(0, 2).map(String);
    pb.juegos = Object.fromEntries(TIPOS_JUEGO.map((k) => [k, ent(pb.juegos?.[k])]));
    for (const k of POR_PIEZA) if (k !== "conceptos" && pb.juegos[k] > 1) pb.juegos[k] = 1;
    pb.mini_examen = ent(pb.mini_examen);
    // Universidad: el duelo contra el dragón se ve infantil; sus preguntas pasan al mini-examen.
    if (uni) { for (const k of Object.keys(pb.juegos)) if (!JUEGOS_UNIVERSIDAD.includes(k)) { if (k === "duelo" && pb.juegos.duelo > 0 && !pb.mini_examen) pb.mini_examen = Math.max(MIN_PREGUNTAS, pb.juegos.duelo); pb.juegos[k] = 0; } if (Array.isArray(pb.orden_actividades)) pb.orden_actividades = pb.orden_actividades.filter((x: string) => x === "mini_examen" || JUEGOS_UNIVERSIDAD.includes(x)); }
    // Mínimos: 5 preguntas por juego de preguntas, 4 parejas en conceptos; el duelo, de 5 a 7.
    const j = pb.juegos;
    if (j.opcion_multiple + j.completar > 0 && j.opcion_multiple + j.completar < MIN_PREGUNTAS) j.opcion_multiple = MIN_PREGUNTAS - j.completar;
    for (const k of ["verdadero_falso", "duelo"]) if (j[k] > 0 && j[k] < MIN_PREGUNTAS) j[k] = MIN_PREGUNTAS;
    if (j.duelo > 7) j.duelo = 7;
    if (j.conceptos > 0 && j.conceptos < MIN_PAREJAS) j.conceptos = MIN_PAREJAS;
    if (pb.mini_examen > 0 && pb.mini_examen < MIN_PREGUNTAS) pb.mini_examen = MIN_PREGUNTAS;
  }
  if (ent(plan.reto_final) < MIN_PREGUNTAS) plan.reto_final = 15;
  // Bloque 1 (vista previa): opción múltiple y al menos otro formato.
  const b1 = plan.bloques[0];
  if (b1) {
    if (b1.juegos.opcion_multiple + b1.juegos.completar === 0) { b1.juegos.opcion_multiple = 6; notas.push("b1: con opción múltiple (vista previa)"); }
    if (!VARIEDAD_B1.some((k) => b1.juegos[k] > 0)) {
      const k = juegoParaB1(b1, semilla);
      b1.juegos[k] = k === "conceptos" ? 5 : k === "verdadero_falso" ? MIN_PREGUNTAS : 1;
      notas.push(`b1: con ${k} para que la vista previa muestre dos formatos`);
    }
  }
  const primera0 = juegoDe(String(plan.primera_actividad ?? ""));
  const protegido = (pb: any, x: string) => pb === b1 && (x === primera0 || (VARIEDAD_B1.includes(x) && VARIEDAD_B1.filter((k) => b1.juegos[k] > 0).length <= 1));
  // Cuántos bloques usan cada juego: al recortar se quita primero lo que se repite en otros bloques (así se usa todo el
  // repertorio a lo largo de la guía).
  const usos = (x: string) => plan.bloques.filter((pb: any) => juegosDelPlan(pb).includes(x)).length;
  const quitar = (pb: any, k: string) => { pb.juegos[k] = 0; if (k === "opcion_multiple") pb.juegos.completar = 0; if (k === "mini_examen") pb.mini_examen = 0; };
  let guarda = 60;
  while (estimarSlidesPlan(plan) > tope && guarda-- > 0) {
    const orden = [...plan.bloques].sort((x: any, y: any) => (y.pistas.length + juegosDelPlan(y).length) - (x.pistas.length + juegosDelPlan(x).length));
    let hecho = false;
    for (const pb of orden) {
      if (pb.pistas.length > 3) { notas.push(`${pb.id}: sin la pista "${pb.pistas.pop()}"`); hecho = true; break; }
      const js = juegosDelPlan(pb);
      if (js.includes("duelo") && js.includes("mini_examen") && js.length > 2) { quitar(pb, "mini_examen"); notas.push(`${pb.id}: sin mini-examen (cierra con duelo)`); hecho = true; break; }
      const cand = js.length > 2 ? PRESCINDIBLES.filter((x) => js.includes(x) && !protegido(pb, x)) : [];
      const k = cand.sort((x, y) => usos(y) - usos(x) || PRESCINDIBLES.indexOf(x) - PRESCINDIBLES.indexOf(y))[0];
      if (k) { quitar(pb, k); notas.push(`${pb.id}: sin ${k}`); hecho = true; break; }
      if (pb.pistas.length > 2) { notas.push(`${pb.id}: sin la pista "${pb.pistas.pop()}"`); hecho = true; break; }
    }
    if (!hecho && plan.bloques.length > 2) {
      const ultimo = plan.bloques.pop();
      plan.inventario_no_usado = [...(plan.inventario_no_usado ?? []), ...(ultimo.ids_inventario ?? [])];
      notas.push(`sin el bloque "${ultimo.titulo}"`); hecho = true;
    }
    if (!hecho) break;
  }
  // Primera actividad: "calentamiento" o un juego del bloque 1, que entonces va primero en ese bloque.
  const primera = juegoDe(String(plan.primera_actividad ?? ""));
  if (!(b1 && primera !== "calentamiento" && juegosDelPlan(b1).includes(primera))) plan.primera_actividad = "calentamiento";
  // Orden al azar con la semilla de la guía (nunca dos juegos del mismo tipo seguidos, tampoco entre bloques).
  const ordenes = ordenarJuegos(plan.bloques.map((pb: any) => juegosDelPlan(pb)), semilla, plan.primera_actividad === "calentamiento" ? null : primera);
  plan.bloques.forEach((pb: any, i: number) => { pb.orden_actividades = ordenes[i]; });
  notas.push(...ajustarMecanicas(plan.bloques, semilla, plan.perfil_edad === "universitario" ? MECANICAS_UNIVERSIDAD : MECANICAS_QUIZ));
  plan.presupuesto_slides = tope;
  plan.slides_estimados = estimarSlidesPlan(plan);
  return notas;
}

// Lo que le falta a cada juego de un bloque para llegar al mínimo (opción múltiple + completar, verdadero o falso,
// duelo y mini-examen ≥ 5 preguntas; conceptos ≥ 4 parejas; quién es quién ≥ 3; clasificar ≥ 6 tarjetas, 2 grupos).
export type Falta = { juego: string; id?: string; tiene: number; minimo: number; unidad: string };
export function faltasDeBloque(b: any): Falta[] {
  const acts = (b?.actividades ?? []) as any[];
  const out: Falta[] = [];
  const cuenta = (...t: string[]) => acts.filter((a) => t.includes(a?.tipo)).length;
  const grupos: [string, number][] = [["opcion_multiple", cuenta("opcion_multiple", "completar")], ["verdadero_falso", cuenta("verdadero_falso")], ["duelo", cuenta("duelo")], ["mini_examen", (b?.mini_examen ?? []).length]];
  for (const [juego, n] of grupos) if (n > 0 && n < MIN_PREGUNTAS) out.push({ juego, tiene: n, minimo: MIN_PREGUNTAS, unidad: "preguntas" });
  for (const a of acts) {
    if (a?.tipo === "conceptos" || a?.tipo === "quien_es_quien") {
      const n = (a.pares ?? []).filter((p: any) => p?.termino && p?.definicion).length;
      const min = a.tipo === "conceptos" ? MIN_PAREJAS : 3;
      if (n < min) out.push({ juego: a.tipo, id: a.id, tiene: n, minimo: min, unidad: "parejas" });
    }
    if (a?.tipo === "clasificar") {
      const el = (a.elementos ?? []).filter((e: any) => e && (e.grupo === 0 || e.grupo === 1));
      const vacio = !el.some((e: any) => e.grupo === 0) || !el.some((e: any) => e.grupo === 1);
      if (el.length < MIN_TARJETAS || vacio) out.push({ juego: "clasificar", id: a.id, tiene: el.length, minimo: MIN_TARJETAS, unidad: vacio ? "tarjetas (un grupo está vacío)" : "tarjetas" });
    }
  }
  return out;
}
export function textoFalta(b: any, f: Falta): string {
  if (f.id) return `MÍNIMO · Actividad ${f.id} (${f.juego}, bloque ${b.id}): tiene ${f.tiene} ${f.unidad}; agrega ${Math.max(1, f.minimo - f.tiene)} o más en "ampliaciones" (mín. ${f.minimo}).`;
  return `MÍNIMO · Bloque ${b.id} · ${f.juego}: tiene ${f.tiene} preguntas; escribe ${f.minimo - f.tiene} o más NUEVAS de ${f.juego === "opcion_multiple" ? "opcion_multiple o completar" : f.juego} (mín. ${f.minimo}), con pista de ${b.id}.`;
}
// Quita los juegos que siguen por debajo del mínimo (enteros, nunca a medias) y anota el motivo.
export function descartarCortos(b: any, motivos: Descarte[], porque: string): void {
  for (const f of faltasDeBloque(b)) {
    const motivo = `${f.juego} con ${f.tiene} ${f.unidad} (mín. ${f.minimo}): ${porque}`;
    if (f.id) { b.actividades = b.actividades.filter((a: any) => a.id !== f.id); motivos.push({ id: f.id, tipo: f.juego, bloque: b.id, motivo }); continue; }
    if (f.juego === "mini_examen") { motivos.push({ id: `${b.id}·mini_examen`, tipo: "mini_examen", bloque: b.id, motivo }); b.mini_examen = []; continue; }
    const tipos = f.juego === "opcion_multiple" ? ["opcion_multiple", "completar"] : [f.juego];
    motivos.push({ id: `${b.id}·${f.juego}`, tipo: f.juego, bloque: b.id, motivo });
    b.actividades = b.actividades.filter((a: any) => !tipos.includes(a.tipo));
  }
}
// Dos juegos del mismo tipo en un bloque se jugarían seguidos: los de parejas se juntan (hasta 8 parejas) y de los
// demás se queda el primero.
export function quitarRepetidos(b: any, motivos: Descarte[]): void {
  for (const tipo of ["conceptos", "quien_es_quien"]) {
    const g = b.actividades.filter((a: any) => a.tipo === tipo);
    if (g.length < 2) continue;
    const pares = g.flatMap((a: any) => a.pares ?? []);
    g[0].pares = pares.filter((p: any, i: number) => pares.findIndex((q: any) => normaliza(q.termino) === normaliza(p.termino)) === i).slice(0, 8);
    b.actividades = b.actividades.filter((a: any) => a === g[0] || !g.includes(a));
  }
  for (const tipo of ["super_dato", "ordenar", "clasificar"]) {
    const g = b.actividades.filter((a: any) => a.tipo === tipo);
    for (const a of g.slice(1)) motivos.push({ id: a.id, tipo, bloque: b.id, motivo: `segundo ${tipo} del bloque (se jugarían dos iguales seguidos)` });
    if (g.length > 1) b.actividades = b.actividades.filter((a: any) => a === g[0] || !g.includes(a));
  }
}
// Cuando la respuesta del escritor se cortó por largo, se pide menos, pero sin bajar de los mínimos.
export function mitadConMinimos(pb: any): { juegos: Record<string, number>; mini_examen: number } {
  const j = Object.fromEntries(TIPOS_JUEGO.map((k) => [k, ent(pb.juegos?.[k])])) as Record<string, number>;
  const om = Math.ceil(j.opcion_multiple / 2), co = Math.ceil(j.completar / 2);
  const out: Record<string, number> = { ...j, opcion_multiple: om, completar: co };
  if (j.opcion_multiple + j.completar > 0 && om + co < MIN_PREGUNTAS) out.opcion_multiple = MIN_PREGUNTAS - co;
  for (const k of ["verdadero_falso", "duelo"]) out[k] = j[k] > 0 ? MIN_PREGUNTAS : 0;
  out.conceptos = j.conceptos > 0 ? MIN_PAREJAS : 0;
  // Si el bloque cierra con duelo, el mini-examen se omite; si no, se piden solo 5 preguntas.
  const mini = ent(pb.mini_examen) > 0 && !(j.duelo > 0) ? MIN_PREGUNTAS : 0;
  return { juegos: out, mini_examen: mini };
}

// Una pista cabe en una slide: título corto, máx. 5 ideas (3 con esquema) de unas 12 palabras, unas 60 palabras en
// total. El código da un margen sobre lo que pide el prompt. Devuelve el problema, o null si cabe.
const textoDe = (x: any): string => typeof x === "string" ? x : x && typeof x === "object" ? String(x.texto ?? x.idea ?? Object.values(x).filter((v) => typeof v === "string").join(" ")) : "";
export function problemaDePista(p: any, perfil = "juvenil"): string | null {
  const ideas = (Array.isArray(p?.ideas) ? p.ideas : []).map(textoDe);
  const max = perfil === "infantil" ? 3 : 5;
  const elementos = Array.isArray(p?.esquema?.elementos) ? p.esquema.elementos : [];
  if (palabras(p?.titulo) > 8) return `título de ${palabras(p.titulo)} palabras (máx. 6)`;
  if (ideas.length > max) return `${ideas.length} ideas (máx. ${max})`;
  if (elementos.length && ideas.length > 4) return `esquema y ${ideas.length} ideas (con esquema, máx. 3)`;
  if (elementos.length > 7) return `esquema con ${elementos.length} elementos (máx. 6)`;
  const larga = ideas.find((i: string) => palabras(i) > 18);
  if (larga) return `una idea de ${palabras(larga)} palabras (máx. 12)`;
  const detalle = elementos.find((e: any) => palabras(e?.detalle) > 16);
  if (detalle) return `un elemento del esquema de ${palabras(detalle.detalle)} palabras (máx. 10)`;
  const total = ideas.reduce((n: number, i: string) => n + palabras(i), 0) + palabras(textoDe(p?.ejemplo));
  if (total > 80) return `${total} palabras de texto (máx. unas 60)`;
  return null;
}

// Respaldo si la IA no dividió una pista larga: se reparte en piezas de continuación (la primera conserva el id, el
// esquema y la foto; el ejemplo y la clave van en la última).
export function dividirPistaCodigo(p: any, perfil = "juvenil"): any[] {
  const ideas = Array.isArray(p.ideas) ? p.ideas : [];
  const conEsquema = Array.isArray(p?.esquema?.elementos) && p.esquema.elementos.length > 0;
  const porPieza = perfil === "infantil" ? 3 : 4;
  const trozos: any[][] = [];
  let resto = ideas;
  if (conEsquema) { trozos.push(resto.slice(0, 2)); resto = resto.slice(2); }
  if (resto.length) { const n = Math.max(conEsquema ? 1 : 2, Math.ceil(resto.length / porPieza)); const t = Math.ceil(resto.length / n); for (let i = 0; i < resto.length; i += t) trozos.push(resto.slice(i, i + t)); }
  if (trozos.length < 2) return [p];
  const nombres = (Array.isArray(p.personajes) ? p.personajes : []) as string[];
  return trozos.map((ids, k) => {
    const pieza: any = { ...p, id: k === 0 ? p.id : `${p.id}_${k + 1}`, titulo: k === 0 ? p.titulo : `${p.titulo} (${k + 1})`, ideas: ids };
    if (k > 0) { delete pieza.titulo_pagina; pieza.esquema = null; pieza.dato_rapido = null; }
    if (k < trozos.length - 1) { pieza.ejemplo = null; pieza.clave = null; }
    const texto = normaliza(ids.map(textoDe).join(" "));
    pieza.personajes = nombres.filter((n) => texto.includes(normaliza(n)) || (k === 0 && !trozos.slice(1).some((o) => normaliza(o.map(textoDe).join(" ")).includes(normaliza(n)))));
    return pieza;
  });
}

// Si la guía real se pasa del tope: primero se fusiona (varios conceptos del bloque en uno, dos pistas cortas en una)
// y luego se recortan juegos prescindibles; nunca se deja un bloque con menos de 2 juegos ni con menos de 2 pistas.
export function recortarBloques(bloques: any[], tope: number, perfil = "juvenil", primera = ""): string[] {
  // El juego que el plan eligió como primera actividad (en el bloque 1) no se recorta.
  // Tampoco el último formato distinto de la opción múltiple del bloque 1 (la vista previa debe mostrar dos formatos).
  const protegido = (b: any, tipo: string) => b === bloques[0] && (juegoDe(tipo) === primera || (VARIEDAD_B1.includes(tipo) && VARIEDAD_B1.filter((k) => b.actividades.some((a: any) => a.tipo === k)).length <= 1));
  const usos = (tipo: string) => bloques.filter((b) => b?.actividades?.some((a: any) => a.tipo === tipo)).length;
  const notas: string[] = [];
  let guarda = 80;
  while (estimarSlides(bloques) > tope && guarda-- > 0) {
    const orden = bloques.filter(Boolean).sort((x, y) => slidesDeBloque(y) - slidesDeBloque(x));
    let hecho = false;
    for (const b of orden) {
      // 1) Fusionar los juegos de conceptos del bloque (hasta 8 parejas).
      const cs = b.actividades.filter((a: any) => a.tipo === "conceptos");
      if (cs.length > 1) {
        const [c0, c1] = cs;
        c0.pares = [...(c0.pares ?? []), ...(c1.pares ?? [])].filter((p: any, i: number, arr: any[]) => arr.findIndex((q: any) => normaliza(q.termino) === normaliza(p.termino)) === i).slice(0, 8);
        b.actividades = b.actividades.filter((a: any) => a !== c1);
        notas.push(`${b.id}: dos juegos de conceptos fusionados`); hecho = true; break;
      }
      // 2) Juegos de una pieza repetidos en el bloque: se queda el primero.
      const repetido = ["super_dato", "ordenar", "clasificar", "quien_es_quien"].find((t) => b.actividades.filter((a: any) => a.tipo === t).length > 1);
      if (repetido) { const sobra = b.actividades.filter((a: any) => a.tipo === repetido)[1]; b.actividades = b.actividades.filter((a: any) => a !== sobra); notas.push(`${b.id}: un ${repetido} de más`); hecho = true; break; }
      // 3) Dos pistas cortas seguidas que juntas caben en una slide.
      for (let i = 0; i + 1 < b.pistas.length && b.pistas.length > 2; i++) {
        const [p, q] = [b.pistas[i], b.pistas[i + 1]];
        if (p.esquema && q.esquema) continue;
        // Nunca se juntan una pista de los apuntes con una completada con fuentes ni con una nota del temario.
        if ([p, q].some((x) => x.nota_temario || x.completado_con_fuentes || x.tema_investigado)) continue;
        const junta = { ...p, ideas: [...(p.ideas ?? []), ...(q.ideas ?? [])], esquema: p.esquema ?? q.esquema ?? null, ejemplo: p.ejemplo ?? q.ejemplo ?? null, clave: p.clave ?? q.clave ?? null, dato_rapido: p.dato_rapido ?? q.dato_rapido ?? null, personajes: [...new Set([...(p.personajes ?? []), ...(q.personajes ?? [])])] };
        if (problemaDePista(junta, perfil)) continue;
        b.pistas.splice(i, 2, junta);
        for (const a of [...b.actividades, ...b.mini_examen]) if (a.pista === q.id) a.pista = p.id;
        notas.push(`${b.id}: pistas "${p.titulo}" y "${q.titulo}" fusionadas`); hecho = true; break;
      }
      if (hecho) break;
      // 4) Mini-examen si el bloque ya cierra con duelo; luego juegos prescindibles.
      if (juegosDelBloque(b) > 2 && b.mini_examen.length && b.actividades.some((a: any) => a.tipo === "duelo")) { b.mini_examen = []; notas.push(`${b.id}: sin mini-examen (cierra con duelo)`); hecho = true; break; }
      const k = juegosDelBloque(b) > 2 ? PRESCINDIBLES.filter((t) => !protegido(b, t) && b.actividades.some((a: any) => a.tipo === t)).sort((x, y) => usos(y) - usos(x) || PRESCINDIBLES.indexOf(x) - PRESCINDIBLES.indexOf(y))[0] : undefined;
      if (k) { const i = b.actividades.findLastIndex((a: any) => a.tipo === k); const fuera = POR_PIEZA.includes(k) ? [b.actividades[i]] : b.actividades.filter((a: any) => a.tipo === k); b.actividades = b.actividades.filter((a: any) => !fuera.includes(a)); notas.push(`${b.id}: sin ${k}`); hecho = true; break; }
    }
    if (!hecho) { notas.push(`no se pudo bajar de ${estimarSlides(bloques)} slides sin quitar teoría`); break; }
  }
  return notas;
}

// Coloca una corrección UNA sola vez: en la pista de la actividad o pista corregida; si el id no es de ninguna, en la
// pista que más se parece al dato (y si ninguna se parece, en la primera pista de la guía).
export function pistaDeCorreccion(bloques: any[], id: string, res: any): { b: any; pista: any; act: any } | null {
  for (const b of bloques) {
    const act = [...b.actividades, ...b.mini_examen].find((a: any) => a.id === id) ?? null;
    const pista = b.pistas.find((p: any) => p.id === id) ?? (act ? b.pistas.find((p: any) => p.id === act.pista) ?? b.pistas[0] : null);
    if (pista) return { b, pista, act };
  }
  const buscar = new Set(normaliza(`${res.decia_la_foto ?? ""} ${res.dato_correcto ?? ""} ${res.afirmacion ?? ""}`).split(" ").filter((w) => w.length > 3));
  let mejor: { b: any; pista: any; act: any } | null = null, puntos = 0;
  for (const b of bloques) for (const p of b.pistas) {
    const txt = new Set(normaliza([p.titulo, ...(p.ideas ?? []).map(textoDe), textoDe(p.ejemplo), textoDe(p.clave)].join(" ")).split(" "));
    const n = [...buscar].filter((w) => txt.has(w)).length;
    if (n > puntos) { puntos = n; mejor = { b, pista: p, act: null }; }
  }
  const b0 = bloques.find((b) => b.pistas?.length);
  return mejor ?? (b0 ? { b: b0, pista: b0.pistas[0], act: null } : null);
}

// Ids de una entrada del verificador. Debe venir uno solo, pero a veces junta varios ("b2p2, b2vf3, b2c2") o agrega
// texto ("b1om3 (pregunta…)"): se quedan los que existen en la guía; si ninguno existe, el primero tal cual (la
// corrección se coloca entonces por su texto).
export function idsDeVerificacion(bloques: any[], actividad: unknown): string[] {
  const existentes = new Set(bloques.flatMap((b) => [...(b.actividades ?? []), ...(b.mini_examen ?? []), ...(b.pistas ?? [])].map((x: any) => x?.id)));
  const piezas = String(actividad ?? "").split(/[\s,;()|/]+/).map((x) => x.trim()).filter(Boolean);
  const ids = [...new Set(piezas.filter((x) => existentes.has(x)))];
  return ids.length ? ids : piezas.slice(0, 1);
}
// Aplica una corrección del verificador a un id: la pista la muestra una sola vez y la actividad con el dato
// equivocado se quita.
export function aplicarCorreccion(bloques: any[], id: string, res: any): void {
  const lugar = pistaDeCorreccion(bloques, id, res);
  if (!lugar) return;
  const c = { dato_apuntes: res.decia_la_foto, dato_correcto: res.dato_correcto, mensaje: res.mensaje_para_alumno, fuentes: res.fuentes ?? [] };
  lugar.pista.correcciones = lugar.pista.correcciones ?? [];
  if (!lugar.pista.correcciones.some((x: any) => normaliza(x.dato_correcto) === normaliza(c.dato_correcto))) lugar.pista.correcciones.push(c);
  if (lugar.act) { lugar.b.actividades = lugar.b.actividades.filter((a: any) => a.id !== id); lugar.b.mini_examen = lugar.b.mini_examen.filter((a: any) => a.id !== id); }
}

// Aplica la respuesta del reparador: preguntas nuevas (solo de tipos que el bloque ya tiene; nunca tipos nuevos),
// parejas o tarjetas que completan un juego, y descarta lo que no pasa la revisión.
export function aplicarReparacion(bloques: any[], j: any, citas: string[], nivel: string, idioma: string, huecos: string[]): { colocadas: string[]; descartes: Descarte[] } {
  const descartes: Descarte[] = [];
  const colocadas: string[] = [];
  const an = j?.actividades_nuevas && typeof j.actividades_nuevas === "object" && !Array.isArray(j.actividades_nuevas) ? { ...j.actividades_nuevas } : {};
  const mini = (Array.isArray(an.mini_examen) ? an.mini_examen : []).filter((a: any) => a && typeof a === "object").map((a: any) => ({ ...a, tipo: "opcion_multiple", _mini: true }));
  delete an.mini_examen;
  const nuevas = [...aplanar(Array.isArray(j?.actividades_nuevas) ? j.actividades_nuevas : an), ...mini];
  const tiene = (b: any, a: any) => a._mini ? b.mini_examen.length > 0 : b.actividades.some((x: any) => juegoDe(x.tipo) === juegoDe(a.tipo)) || (!b.actividades.length && juegoDe(a.tipo) === "opcion_multiple");
  for (const a of nuevas) {
    if (!revisarActividad(a, citas, nivel, [], "reparar", descartes, idioma)) continue;
    const b = bloqueDeNueva(bloques, a, huecos);
    if (!b) continue;
    if (b.solo_nota) { descartes.push({ id: String(a.id ?? "?"), tipo: String(a.tipo), bloque: b.id, motivo: "bloque sin temas confirmados (solo lleva la nota del temario): no se inventan preguntas" }); continue; }
    if (!tiene(b, a)) { descartes.push({ id: String(a.id ?? "?"), tipo: String(a.tipo), bloque: b.id, motivo: "tipo de juego que el bloque no tiene (la reparación solo completa juegos existentes)" }); continue; }
    if (a._mini) { delete a._mini; b.mini_examen.push(a); } else b.actividades.push(a);
    colocadas.push(`${a.id}→${b.id}`);
  }
  for (const am of Array.isArray(j?.ampliaciones) ? j.ampliaciones : []) {
    const id = String(am?.id ?? "").trim().split(/[\s,(]/)[0];
    const act = bloques.flatMap((b) => b.actividades).find((a: any) => a.id === id);
    if (!act) continue;
    if ((act.tipo === "conceptos" || act.tipo === "quien_es_quien") && Array.isArray(am.pares)) {
      const tmp: any = { tipo: act.tipo, pares: am.pares }; normalizarActividad(tmp, idioma);
      const pares = [...(act.pares ?? []), ...(tmp.pares ?? []).filter((p: any) => p?.termino && p?.definicion)];
      act.pares = pares.filter((p: any, i: number) => pares.findIndex((q: any) => normaliza(q.termino) === normaliza(p.termino)) === i).slice(0, 8);
      colocadas.push(`${id}: ${act.pares.length} parejas`);
    }
    if (act.tipo === "clasificar" && Array.isArray(am.elementos)) {
      const nuevos = am.elementos.filter((e: any) => e && typeof e === "object" && String(e.texto ?? "").trim()).map((e: any) => ({ ...e, texto: sinGrupoEscrito(e.texto, act.grupos), grupo: Number(e.grupo) }));
      const todos = [...(act.elementos ?? []), ...nuevos.filter((e: any) => e.grupo === 0 || e.grupo === 1)];
      act.elementos = todos.filter((e: any, i: number) => todos.findIndex((q: any) => normaliza(q.texto) === normaliza(e.texto)) === i).slice(0, 12);
      colocadas.push(`${id}: ${act.elementos.length} tarjetas`);
    }
  }
  return { colocadas, descartes };
}

// ---------- Revisión ortográfica (Daniel, 8 nov 2026) ----------
// Registro de los textos de la guía: ruta → [objeto, clave]. En las guías de lengua (español, inglés, francés…) no se
// mandan las opciones, respuestas, distractores, términos ni tarjetas: ahí los errores pueden ser a propósito.
type Lugar = [any, string | number];
export const leerRuta = (l: Lugar): string => String(l[0][l[1]] ?? "");
export function esGuiaDeLengua(plan: any): boolean {
  return !!plan?.es_lengua_extranjera || /espa|lengua|ingl|franc|english|french|literat|ortograf|gramat|redacc/i.test(normaliza(String(plan?.materia ?? "")));
}
export function textosDeGuia(D: any): Record<string, Lugar> {
  const reg: Record<string, Lugar> = {};
  const poner = (ruta: string, obj: any, k: string | number) => { if (obj && typeof obj[k] === "string" && obj[k].trim()) reg[ruta] = [obj, k]; };
  const lista = (ruta: string, arr: unknown) => { if (Array.isArray(arr)) arr.forEach((_, i) => poner(`${ruta}.${i}`, arr, i)); };
  const plan = D.plan ?? {};
  const lengua = esGuiaDeLengua(plan);
  const id = plan.identidad ?? {};
  poner("plan.titulo", id, "titulo"); poner("plan.subtitulo", id, "subtitulo"); lista("plan.objetivos", id.objetivos);
  for (const b of (D.bloques ?? []).filter(Boolean)) {
    poner(`${b.id}.titulo`, b, "titulo");
    // Las notas «repásalo en tu libro» las escribe el código: no se revisan (ni se cobran).
    for (const p of (b.pistas ?? []).filter((x: any) => x && !x.nota_temario)) {
      for (const k of ["titulo", "titulo_pagina", "ejemplo", "clave"]) poner(`${p.id}.${k}`, p, k);
      lista(`${p.id}.ideas`, p.ideas);
      if (p.dato_rapido && typeof p.dato_rapido === "object") poner(`${p.id}.dato_rapido.titulo`, p.dato_rapido, "titulo");
      if (p.esquema && typeof p.esquema === "object") {
        poner(`${p.id}.esquema.titulo`, p.esquema, "titulo");
        (Array.isArray(p.esquema.elementos) ? p.esquema.elementos : []).forEach((e: any, i: number) => { poner(`${p.id}.esquema.${i}.nombre`, e, "nombre"); poner(`${p.id}.esquema.${i}.detalle`, e, "detalle"); });
      }
    }
    for (const a of [...(b.actividades ?? []), ...(b.mini_examen ?? []), ...(b.duelo ?? [])]) {
      if (!a?.id) continue;
      for (const k of ["pregunta", "afirmacion", "enunciado", "instruccion", "texto", "retro_correcta", "retro_incorrecta", "por_que"]) poner(`${a.id}.${k}`, a, k);
      (Array.isArray(a.pasos) ? a.pasos : []).forEach((x: any, i: number) => poner(`${a.id}.pasos.${i}`, x, "texto"));
      (Array.isArray(a.pares) ? a.pares : []).forEach((x: any, i: number) => { poner(`${a.id}.pares.${i}.definicion`, x, "definicion"); if (!lengua && a.tipo !== "quien_es_quien") poner(`${a.id}.pares.${i}.termino`, x, "termino"); });
      if (!lengua) {
        lista(`${a.id}.opciones`, a.opciones); lista(`${a.id}.distractores`, a.distractores); poner(`${a.id}.respuesta`, a, "respuesta"); lista(`${a.id}.grupos`, a.grupos);
        (Array.isArray(a.elementos) ? a.elementos : []).forEach((x: any, i: number) => poner(`${a.id}.elementos.${i}`, x, "texto"));
      }
    }
  }
  return reg;
}
// Correcciones que no dependen de la IA: "exámen" (singular) siempre es "examen", y ningún espacio suelto antes de "." o ","
// (el francés sí lleva espacio antes de ; : ! ?, así que esos no se tocan).
export function corregirFijas(reg: Record<string, Lugar>): number {
  let n = 0;
  for (const l of Object.values(reg)) {
    const v = leerRuta(l);
    const w = v.replace(/(^|[^\p{L}])([Ee])x[áá]men(?![\p{L}])/gu, (_m, a, e) => `${a}${e}xamen`).replace(/(^|[^\p{L}])EXÁMEN(?![\p{L}])/gu, "$1EXAMEN").replace(/ +([.,])(?![0-9])/g, "$1");
    if (w !== v) { l[0][l[1]] = w; n++; }
  }
  return n;
}
function distancia(a: string, b: string): number {
  if (a === b) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let k = 1; k <= b.length; k++) cur[k] = Math.min(prev[k] + 1, cur[k - 1] + 1, prev[k - 1] + (a[i - 1] === b[k - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}
// Un cambio solo ortográfico: sin tildes, signos ni mayúsculas, el texto queda casi igual (tildes, signos y mayúsculas
// cuentan 0; letras cambiadas, un 12 % del largo como máximo, o las mismas palabras con terminaciones cambiadas). Los huecos ___ y las [[palabras]] del súper dato no se
// tocan, y nunca se acepta "exámen".
export function cambioOrtografico(antes: string, despues: string): boolean {
  if (typeof despues !== "string" || !despues.trim() || despues === antes) return false;
  if (/(^|[^\p{L}])exámen(?![\p{L}])/iu.test(despues)) return false;
  const marcas = (s: string) => `${(s.match(/_{2,}/g) ?? []).length}|${(s.match(/\[\[(.+?)\]\]/g) ?? []).map((x) => normaliza(x)).join("·")}`;
  if (marcas(antes) !== marcas(despues)) return false;
  const a = normaliza(antes), b = normaliza(despues);
  if (!b) return false;
  const d = distancia(a, b);
  if (d <= Math.max(2, Math.round(a.length * 0.12))) return true;
  // Concordancia ("los pais que participo" → "los países que participaron"): mismas palabras, cada una apenas cambiada.
  const pa = a.split(" "), pb = b.split(" ");
  return pa.length === pb.length && d <= Math.round(a.length * 0.25) && pa.every((w, i) => distancia(w, pb[i]) <= Math.max(2, Math.ceil(w.length * 0.4)));
}
export function aplicarOrtografia(reg: Record<string, Lugar>, correcciones: any[]): { aplicadas: any[]; rechazadas: any[] } {
  const aplicadas: any[] = [], rechazadas: any[] = [];
  for (const c of Array.isArray(correcciones) ? correcciones : []) {
    const ruta = String(c?.ruta ?? "").trim();
    const l = reg[ruta];
    if (!l) { rechazadas.push({ ruta, motivo: "ruta desconocida" }); continue; }
    const antes = leerRuta(l), despues = String(c?.texto ?? "");
    if (despues === antes) continue;
    if (!cambioOrtografico(antes, despues)) { rechazadas.push({ ruta, antes, despues, motivo: "cambia el contenido" }); continue; }
    l[0][l[1]] = despues;
    aplicadas.push({ ruta, antes, despues, motivo: c?.motivo ?? "" });
  }
  return { aplicadas, rechazadas };
}

// Anota los descartes de un paso: datos.descartes (todos, últimos 200), datos.diagnostico.descartes (los de este paso)
// y una línea por descarte en el log.
function anotarDescartes(D: any, paso: string, lista: Descarte[]) {
  for (const d of lista) console.warn("Actividad descartada", JSON.stringify({ paso, ...d }));
  D.descartes = [...(Array.isArray(D.descartes) ? D.descartes : []), ...lista.map((d) => ({ paso, ...d }))].slice(-200);
  D.diagnostico = { ...(D.diagnostico && typeof D.diagnostico === "object" ? D.diagnostico : {}), descartes: { paso, total: lista.length, lista: lista.slice(0, 60), en: new Date().toISOString() } };
}
// Bloque al que pertenece una actividad nueva de la reparación.
export function bloqueDeNueva(bloques: any[], a: any, huecos: string[]): any {
  const pista = String(a?.pista ?? "").trim();
  const porPista = pista && bloques.find((b) => b.pistas?.some((p: any) => p.id === pista));
  if (porPista) return porPista;
  // Id del bloque dentro de la pista o del id de la actividad ("b2p1", "r_b2om1", "rb2_vf1").
  for (const txt of [pista, String(a?.id ?? "")]) {
    const m = txt.match(/b(\d+)/i);
    const b = m && bloques.find((x) => x.id === `b${m[1]}`);
    if (b) return b;
  }
  // Sin pista: el bloque con hueco (mencionado en los huecos) que tenga menos actividades; si ninguno, el más corto.
  // Nunca un bloque que solo lleva la nota del temario.
  const vivos = bloques.filter((b) => b && !b.solo_nota);
  const conHueco = vivos.filter((b) => huecos.some((h) => new RegExp(`\\b${b.id}\\b`).test(h)));
  const lista = conHueco.length ? conHueco : vivos;
  return [...lista].sort((x, y) => x.actividades.length - y.actividades.length)[0];
}

// ---------- Respaldos para que siempre salga una guía ----------
function rangos(desde: number, total: number): number[][] {
  const out: number[][] = [];
  for (let i = desde; i < total; i += FOTOS_POR_LOTE) out.push([i, Math.min(total, i + FOTOS_POR_LOTE)]);
  return out;
}
// Parte en dos el primer rango pendiente; si ya es de una sola foto, la marca como no leída (la guía sigue con las
// demás y solo falla si no se pudo leer ninguna).
function partirOMarcar(D: any, motivo: string) {
  const [desde, hasta] = D.pendientes.shift() as number[];
  if (hasta - desde > 1) { const m = desde + Math.ceil((hasta - desde) / 2); D.pendientes.unshift([desde, m], [m, hasta]); return; }
  D.no_leidas = [...(Array.isArray(D.no_leidas) ? D.no_leidas : []), desde + 1];
  D.inventarios.push({ fotos: [{ indice: desde + 1, legible: false, motivo }], estado: "ilegible", inventario: {} });
}
// Un plan sirve si trae al menos un bloque con título.
function planDe(j: any): any {
  const p = Array.isArray(j?.bloques) ? j : Array.isArray(j?.plan?.bloques) ? j.plan : null;
  const bloques = (p?.bloques ?? []).filter((b: any) => b && typeof b === "object" && typeof b.titulo === "string" && b.titulo.trim());
  return bloques.length ? { ...p, bloques, identidad: { ...(p.identidad ?? {}) } } : null;
}
// Juegos y mecánicas que no se ven infantiles para universidad (12 nov 2026): quizzes, completar, verdadero o falso,
// conceptos, ordenar, clasificar, súper dato y quién es quién; sin duelo contra el dragón. Mecánicas: carrera, montaña y
// castillo (sin pingüino, enemigos ni duelo).
export const JUEGOS_UNIVERSIDAD = ["opcion_multiple", "completar", "verdadero_falso", "conceptos", "ordenar", "clasificar", "super_dato", "quien_es_quien"];
export const MECANICAS_UNIVERSIDAD = ["carrera", "montana", "castillo"];
export const esUniversidad = (grado: string) => /universi|licenciatura|ingenier|maestr[ií]a|doctorado|posgrado/.test(String(grado ?? "").toLowerCase());
export function perfilDe(grado: string): string {
  const g = String(grado ?? "").toLowerCase(); const n = Number((g.match(/\d/) ?? ["0"])[0]);
  if (esUniversidad(g)) return "universitario";
  if (g.includes("primaria")) return n <= 3 ? "infantil" : "caricatura";
  if (g.includes("secundaria")) return n <= 1 ? "caricatura" : "juvenil";
  return "sobrio";
}
export function paletaDe(materia: string): string {
  const m = String(materia ?? "").toLowerCase().normalize("NFD").replace(/[^a-z ]/g, "");
  const reglas: [RegExp, string][] = [[/derecho|juridic|constitucional|civic|\betica|filosof|sociolog|politic|psicolog/, "civica_morado"], [/econom|contab|finanz|estadist|actuar/, "mate_naranja"], [/anatom|medicin|enfermer|fisiolog|farmac|odontolog|veterinar|nutric|biomedic|ingenieri/, "ciencias_verde"], [/histor/, "historia_azul"], [/espanol|lengua|literatura|lectura/, "espanol_rojo"], [/mate|algebra|geometr|calculo/, "mate_naranja"], [/cienc|quimic|fisic|biolog/, "ciencias_verde"], [/frances|french/, "frances_cielo"], [/civic|\betica/, "civica_morado"], [/ingles|english/, "ingles_mostaza"], [/geograf/, "geo_turquesa"]];
  return reglas.find(([re]) => re.test(m))?.[1] ?? "otra";
}
// Plan de respaldo armado por código cuando la IA no devolvió un plan válido: hasta 3 bloques en el orden de las fotos,
// con juegos sencillos.
function planPorCodigo(D: any, fuente: { grado: string; materia: string }): any {
  const inv = (D.inventario ?? {}) as Record<string, any[]>;
  const temas = (inv.temas ?? []) as any[];
  const elementos = Object.entries(inv).filter(([k]) => !["sospechas", "recursos_mencionados", "formato_examen"].includes(k)).flatMap(([, l]) => Array.isArray(l) ? l : []).filter((e: any) => e?.id).sort((a: any, b: any) => (Number(a.foto) || 0) - (Number(b.foto) || 0));
  const nb = Math.max(1, Math.min(3, Math.ceil(elementos.length / 25)));
  const tam = Math.max(1, Math.ceil(elementos.length / nb));
  const idiomas = (D.fotos ?? []).map((f: any) => f?.idioma);
  const idioma = ["es", "en", "fr"].sort((a, b) => idiomas.filter((x: string) => x === b).length - idiomas.filter((x: string) => x === a).length)[0];
  const extranjera = /ingl|franc|english|french/i.test(fuente.materia ?? "");
  const corto = (s: unknown) => String(s ?? "").slice(0, 70);
  const bloques = Array.from({ length: nb }, (_, i) => {
    const parte = elementos.slice(i * tam, (i + 1) * tam);
    const titulos = parte.filter((e: any) => temas.includes(e)).map((e: any) => corto(e.texto)).filter(Boolean);
    return { id: `b${i + 1}`, titulo: titulos[0] || `Parte ${i + 1}`, temas: titulos.slice(0, 4), ids_inventario: parte.map((e: any) => e.id), pistas: titulos.slice(0, 3), slides_teoria: 1, juegos: { opcion_multiple: 6, completar: 3, verdadero_falso: 4, super_dato: 0, conceptos: 0, ordenar: 0, clasificar: 0, quien_es_quien: 0 }, formato_practica: null, mini_examen: 6 };
  });
  return {
    materia: fuente.materia, es_lengua_extranjera: extranjera, idioma_guia: idioma, apoyo: extranjera && idioma !== "es" ? { idioma: "es", formato: "linea_corta" } : null,
    camino: "convertir", temas_a_investigar: [], presupuesto_slides: 20, perfil_edad: perfilDe(fuente.grado), plantillas_sugeridas: [],
    identidad: { paleta: paletaDe(fuente.materia), titulo: `${fuente.materia}: tu guía de estudio`, subtitulo: fuente.grado, emojis_portada: ["📘", "✏️", "🧠"], objetivos: temas.slice(0, 3).map((e: any) => corto(e.texto)).filter(Boolean), retratos_portada: [] },
    puntos_dificiles: [], bloques, reto_final: 15, inventario_no_usado: [], nota_planificador: "Plan armado por código: la IA no devolvió un plan válido.",
  };
}

// Juegos de clasificar: el reproductor muestra solo dos grupos. La IA a veces arma tres (la revisión borraba las
// tarjetas del tercero y ese grupo quedaba vacío), numera los grupos desde 1 o pone el nombre del grupo. Aquí cada
// tarjeta pasa al número de su grupo (desde 0) y, si hay más de dos grupos, se quedan los dos con más tarjetas.
// Una tarjeta nunca dice su grupo (11 nov 2026: el reparador escribió «mesa → Graves» y el alumno veía la respuesta).
// Quita el nombre de un grupo escrito después del texto («mesa → Graves», «mesa -> Graves», «mesa: Graves», «mesa —
// Graves», «mesa (Graves)») o antes («Graves: mesa»). Solo si lo escrito es exactamente uno de los grupos.
export function sinGrupoEscrito(texto: string, grupos: unknown[]): string {
  const t = String(texto ?? "").trim();
  const nombres = (Array.isArray(grupos) ? grupos : []).map((g) => normaliza(String(g ?? ""))).filter(Boolean);
  if (!t || !nombres.length) return t;
  const esGrupo = (s: string) => nombres.includes(normaliza(s));
  const despues = t.match(/^(.+?)\s*(?:→|->|=>|⇒|:|\s[-–—]\s)\s*([^→:]+)$/);
  if (despues && despues[1].trim() && esGrupo(despues[2])) return despues[1].trim();
  const parentesis = t.match(/^(.+?)\s*[([]\s*([^)\]]+?)\s*[)\]]$/);
  if (parentesis && parentesis[1].trim() && esGrupo(parentesis[2])) return parentesis[1].trim();
  const antes = t.match(/^([^→:]+?)\s*(?:→|->|=>|⇒|:)\s*(.+)$/);
  if (antes && antes[2].trim() && esGrupo(antes[1])) return antes[2].trim();
  return t;
}
export function normalizarClasificar(a: any): void {
  if (!a || a.tipo !== "clasificar" || !Array.isArray(a.grupos) || !Array.isArray(a.elementos)) return;
  const nombres = a.grupos.map((g: unknown) => String(g ?? "").trim().toLowerCase());
  const numero = (g: unknown): number | null => typeof g === "number" ? g : typeof g === "string" && /^ *[0-9]+ *$/.test(g) ? Number(g) : null;
  const nums = a.elementos.map((e: any) => numero(e?.grupo)).filter((n: number | null) => n !== null) as number[];
  // Numerados desde 1: alguna tarjeta trae un número igual a la cantidad de grupos y ninguna trae 0.
  const desdeUno = nums.length > 0 && Math.min(...nums) >= 1 && Math.max(...nums) === a.grupos.length;
  const indice = (g: unknown): number => {
    const n = numero(g);
    if (n === null) return nombres.indexOf(String(g ?? "").trim().toLowerCase());
    return Number.isInteger(n) ? (desdeUno ? n - 1 : n) : -1;
  };
  let elementos = a.elementos.filter((e: any) => e && typeof e === "object").map((e: any) => ({ ...e, ...(typeof e.texto === "string" ? { texto: sinGrupoEscrito(e.texto, a.grupos) } : {}), grupo: indice(e.grupo) })).filter((e: any) => e.grupo >= 0 && e.grupo < a.grupos.length);
  if (a.grupos.length > 2) {
    const cuenta = a.grupos.map((_: unknown, i: number) => elementos.filter((e: any) => e.grupo === i).length);
    const dos = cuenta.map((n: number, i: number) => [n, i]).sort((x: number[], y: number[]) => y[0] - x[0] || x[1] - y[1]).slice(0, 2).map((x: number[]) => x[1]).sort((x: number, y: number) => x - y);
    a.grupos = dos.map((i: number) => a.grupos[i]);
    elementos = elementos.filter((e: any) => dos.includes(e.grupo)).map((e: any) => ({ ...e, grupo: dos.indexOf(e.grupo) }));
  }
  a.elementos = elementos;
}

// Revisiones por código (Documento 1, sección 6). Devuelve true si la actividad sirve. Antes de descartar, arregla los
// formatos que la IA usa a menudo (respuesta correcta como texto o letra, opciones como objetos, verdadero o falso como
// texto, parejas con otros nombres, retroalimentación faltante). Cada descarte queda anotado en "motivos" con su causa.
export type Descarte = { id: string; tipo: string; bloque: string; motivo: string };
const RETRO: Record<string, [string, (x: string) => string]> = {
  es: ["¡Correcto!", (x) => `La respuesta correcta es «${x}».`],
  en: ["Correct!", (x) => `The correct answer is "${x}".`],
  fr: ["Bravo !", (x) => `La bonne réponse est « ${x} ».`],
};
const textoOpcion = (o: any): string => typeof o === "string" ? o : typeof o === "number" ? String(o) : o && typeof o === "object" ? String(o.texto ?? o.text ?? o.opcion ?? o.valor ?? o.label ?? "") : "";
// Índice de la respuesta correcta a partir de lo que mandó la IA: número, número en texto, letra (A–D) o el texto de la
// opción. Devuelve -1 si no se puede saber.
export function indiceCorrecta(valor: unknown, opciones: string[]): number {
  if (typeof valor === "number" && Number.isInteger(valor)) return valor;
  const v = String(valor ?? "").trim();
  if (!v) return -1;
  if (/^[0-9]+$/.test(v)) return Number(v);
  // Primero el texto exacto de una opción (en inglés "a" puede ser una opción), luego la letra.
  const n = normaliza(v);
  const exacta = opciones.findIndex((o) => normaliza(o) === n);
  if (exacta >= 0) return exacta;
  const letra = v.match(/^\(?([a-dA-D])[).:]?$/);
  if (letra) return letra[1].toLowerCase().charCodeAt(0) - 97;
  // "B) texto" o "b. texto": letra seguida del texto de esa opción.
  const conLetra = v.match(/^\(?([a-dA-D])[).:]\s+(.+)$/);
  if (conLetra) { const i = conLetra[1].toLowerCase().charCodeAt(0) - 97; if (normaliza(opciones[i] ?? "") === normaliza(conLetra[2])) return i; }
  return -1;
}
// Arregla en su lugar los formatos frecuentes de la IA. No inventa contenido: solo cambia la forma.
export function normalizarActividad(a: any, idioma = "es"): void {
  if (!a || typeof a !== "object") return;
  const [bien, malTxt] = RETRO[idioma] ?? RETRO.es;
  // La IA a veces escribe el texto en "texto" y la fuente como texto suelto (11 nov 2026: el reparador dejó preguntas que
  // el reproductor mostraba vacías). Cada tipo lleva su campo: pregunta, afirmacion o enunciado.
  const campo = a.tipo === "verdadero_falso" ? "afirmacion" : a.tipo === "completar" ? "enunciado" : ["opcion_multiple", "duelo"].includes(a.tipo) ? "pregunta" : "";
  // Un campo vacío ("") tapa al bueno: el reproductor muestra pregunta ?? afirmacion ?? enunciado.
  if (campo) for (const k of ["pregunta", "afirmacion", "enunciado"]) if (typeof a[k] === "string" && !a[k].trim()) delete a[k];
  if (campo && !String(a[campo] ?? "").trim() && String(a.texto ?? "").trim()) { a[campo] = String(a.texto).trim(); delete a.texto; }
  // El juego de deslizar (verdadero o falso) solo lee "afirmacion".
  if (a.tipo === "verdadero_falso" && !String(a.afirmacion ?? "").trim() && String(a.pregunta ?? "").trim()) a.afirmacion = String(a.pregunta).trim();
  if (typeof a.fuente === "string") a.fuente = { foto: 0, tipo: "textual", cita: a.fuente };
  if (!a.retro_correcta && typeof a.retroalimentacion === "string" && a.retroalimentacion.trim()) a.retro_correcta = a.retroalimentacion.trim();
  if (["opcion_multiple", "duelo"].includes(a.tipo)) {
    if (!Array.isArray(a.opciones) && a.opciones && typeof a.opciones === "object") a.opciones = Object.values(a.opciones);
    if (Array.isArray(a.opciones)) a.opciones = a.opciones.map(textoOpcion).map((o: string) => o.trim());
    const ops: string[] = Array.isArray(a.opciones) ? a.opciones : [];
    let c = indiceCorrecta(a.correcta ?? a.respuesta_correcta ?? a.respuesta, ops);
    // Cinco o más opciones: se quedan la correcta y las tres primeras de las demás.
    if (ops.length > 4 && c >= 0 && c < ops.length) {
      const otras = ops.filter((_, i) => i !== c).slice(0, 3);
      const pos = Math.min(c, 3);
      a.opciones = [...otras.slice(0, pos), ops[c], ...otras.slice(pos)];
      c = pos;
    }
    a.correcta = c;
  }
  if (a.tipo === "verdadero_falso" && typeof a.es_verdadera !== "boolean") {
    const v = normaliza(String(a.es_verdadera ?? a.respuesta ?? a.correcta ?? ""));
    if (["true", "verdadero", "verdadera", "v", "t", "vrai", "si", "yes"].includes(v)) a.es_verdadera = true;
    else if (["false", "falso", "falsa", "f", "faux", "no"].includes(v)) a.es_verdadera = false;
  }
  if (a.tipo === "completar") {
    if (!a.enunciado && a.pregunta) a.enunciado = a.pregunta;
    const ops: string[] = Array.isArray(a.opciones) ? a.opciones.map(textoOpcion) : [];
    if (!a.respuesta && ops.length) { const c = indiceCorrecta(a.correcta, ops); if (c >= 0 && c < ops.length) a.respuesta = ops[c]; }
    if (typeof a.respuesta !== "string" && a.respuesta != null) a.respuesta = textoOpcion(a.respuesta);
    if (typeof a.distractores === "string") a.distractores = a.distractores.split(/\s*[,;|]\s*/).filter(Boolean);
    if ((!Array.isArray(a.distractores) || a.distractores.length < 2) && ops.length && a.respuesta) a.distractores = ops.filter((o) => normaliza(o) !== normaliza(a.respuesta));
    if (Array.isArray(a.distractores)) a.distractores = a.distractores.map(textoOpcion).filter((d: string) => d && normaliza(d) !== normaliza(a.respuesta ?? ""));
  }
  if (["opcion_multiple", "duelo", "verdadero_falso", "completar"].includes(a.tipo)) {
    // Sin retroalimentación: la escribe el código con la respuesta correcta (no inventa datos).
    const correcta = a.tipo === "verdadero_falso" ? (typeof a.es_verdadera === "boolean" ? (a.es_verdadera ? { es: "Verdadero", en: "True", fr: "Vrai" } : { es: "Falso", en: "False", fr: "Faux" })[idioma as "es"] ?? "" : "") : a.tipo === "completar" ? String(a.respuesta ?? "") : String(a.opciones?.[a.correcta] ?? "");
    if (!a.retro_correcta) a.retro_correcta = bien;
    if (!a.retro_incorrecta && correcta) a.retro_incorrecta = malTxt(correcta);
  }
  if (a.tipo === "conceptos" || a.tipo === "quien_es_quien") {
    if (!Array.isArray(a.pares) && a.pares && typeof a.pares === "object") a.pares = Object.entries(a.pares).map(([termino, definicion]) => ({ termino, definicion }));
    if (Array.isArray(a.pares)) a.pares = a.pares.map((p: any) => Array.isArray(p) ? { termino: p[0], definicion: p[1] } : p && typeof p === "object" ? { ...p, termino: p.termino ?? p.concepto ?? p.palabra ?? p.term ?? p.nombre, definicion: p.definicion ?? p.significado ?? p.definition ?? p.descripcion } : p);
  }
  if (a.tipo === "ordenar" && !Array.isArray(a.pasos) && Array.isArray(a.elementos)) a.pasos = a.elementos;
}
// La IA a veces escribe cada pareja de conceptos (o de quién es quién) como una actividad aparte, con 1 o 2 parejas.
// Si en un bloque hay varias de esas, se juntan en una sola (hasta 8 parejas, sin términos repetidos).
export function fusionarParejas(acts: any[], idioma = "es"): any[] {
  let out = acts;
  for (const tipo of ["conceptos", "quien_es_quien"]) {
    const grupo = out.filter((a: any) => a?.tipo === tipo);
    grupo.forEach((a: any) => normalizarActividad(a, idioma));
    const cortas = grupo.filter((a: any) => !Array.isArray(a.pares) || a.pares.filter((p: any) => p?.termino && p?.definicion).length < 3);
    if (grupo.length < 2 || !cortas.length) continue;
    const base = grupo[0];
    const pares = grupo.flatMap((a: any) => Array.isArray(a.pares) ? a.pares : []).filter((p: any) => p?.termino && p?.definicion);
    base.pares = pares.filter((p: any, i: number) => pares.findIndex((q: any) => normaliza(q.termino) === normaliza(p.termino)) === i).slice(0, 8);
    out = out.filter((a: any) => a === base || !grupo.includes(a));
  }
  return out;
}
// Preguntas sobre el examen o el libro (regla 3 del generador). "gap" y "huecos" solo cuentan cuando hablan del número
// o la posición de un hueco del examen ("How many gaps…", "gap 3"); en inglés "fill the gap" es una instrucción normal.
const SOBRE_EL_EXAMEN = [/\b(how many|cu[aá]ntos)\s+(gaps|huecos)\b/i, /\b(gap|hueco)\s+(n[uú]mero\s+)?\d+\b/i];
function revisarActividad(a: any, citas: string[], nivel: string, huecos: string[], bloque: string, motivos: Descarte[] = [], idioma = "es"): boolean {
  const fuera = (motivo: string) => { motivos.push({ id: String(a?.id ?? "?"), tipo: String(a?.tipo ?? "?"), bloque, motivo }); return false; };
  if (!a || !a.tipo) return fuera("sin tipo");
  normalizarActividad(a, idioma);
  const texto = String(a.pregunta ?? a.afirmacion ?? a.enunciado ?? a.instruccion ?? a.texto ?? "");
  const tl = texto.toLowerCase();
  const prohibida = PROHIBIDAS.filter((p) => p !== "gap" && p !== "huecos").find((p) => tl.includes(p));
  if (prohibida && !/\bp[aá]gina web\b/.test(tl)) return fuera(`pregunta sobre el examen o el libro ("${prohibida}")`);
  if (SOBRE_EL_EXAMEN.some((re) => re.test(texto))) return fuera("pregunta sobre los huecos del examen");
  if (["opcion_multiple", "duelo", "verdadero_falso", "completar"].includes(a.tipo)) {
    if (!texto.trim()) return fuera("sin pregunta");
    const tope = (topePalabras[nivel] ?? 25) + 5;
    if (palabras(texto) > tope) return fuera(`pregunta de ${palabras(texto)} palabras (máx. ${tope})`);
    if (!a.retro_incorrecta || !a.retro_correcta) { huecos.push(`Actividad ${a.id} del bloque ${bloque} sin retroalimentación`); return fuera("sin retroalimentación"); }
    if (a.tipo === "opcion_multiple" || a.tipo === "duelo") {
      // 3 o 4 opciones: el reproductor muestra las que haya (en gramática a veces solo hay 3 formas posibles).
      if (!Array.isArray(a.opciones) || a.opciones.length < 3 || a.opciones.length > 4) return fuera(`${Array.isArray(a.opciones) ? a.opciones.length : 0} opciones (deben ser 3 o 4)`);
      if (!(a.correcta >= 0 && a.correcta < a.opciones.length)) return fuera(`respuesta correcta ilegible (${JSON.stringify(a.correcta)})`);
      if (new Set(a.opciones.map((o: string) => normaliza(o))).size < a.opciones.length) return fuera("opciones repetidas");
    }
    if (a.tipo === "completar" && (!a.respuesta || !Array.isArray(a.distractores) || a.distractores.length < 2)) return fuera(!a.respuesta ? "completar sin respuesta" : "completar con menos de 2 distractores");
    if (a.tipo === "verdadero_falso" && typeof a.es_verdadera !== "boolean") return fuera(`verdadero o falso ilegible (${JSON.stringify(a.es_verdadera)})`);
  }
  if (a.tipo === "super_dato") { const huecosSD = (String(a.texto ?? "").match(/\[\[(.+?)\]\]/g) ?? []).length; if (huecosSD < 3) return fuera(`súper dato con ${huecosSD} huecos (mín. 3)`); if (!Array.isArray(a.distractores)) return fuera("súper dato sin distractores"); }
  if (a.tipo === "conceptos" || a.tipo === "quien_es_quien") { if (!Array.isArray(a.pares)) return fuera("sin parejas"); a.pares = a.pares.filter((p: any) => p?.termino && p?.definicion); if (a.pares.length < 2) return fuera(`${a.pares.length} parejas completas (mín. 2 para completarlo)`); }
  if (a.tipo === "ordenar") { if (!Array.isArray(a.pasos) || a.pasos.length < 3) return fuera(`${Array.isArray(a.pasos) ? a.pasos.length : 0} pasos (mín. 3)`); a.pasos = a.pasos.map((p: any) => typeof p === "string" ? { texto: p, emoji: "" } : p); }
  if (a.tipo === "clasificar") { if (!Array.isArray(a.grupos) || a.grupos.length < 2 || !Array.isArray(a.elementos) || a.elementos.length < 2) return fuera("clasificar con menos de 2 grupos o 2 tarjetas"); normalizarClasificar(a); a.elementos = a.elementos.filter((e: any) => e && (e.grupo === 0 || e.grupo === 1)); if (a.elementos.length < 2) return fuera("clasificar con menos de 2 tarjetas válidas"); }
  // cita respaldada
  const cita = a.fuente?.cita;
  if (cita && citas.length && !citaExiste(cita, citas) && a.fuente?.tipo !== "practica") { huecos.push(`Actividad ${a.id} del bloque ${bloque}: su cita no aparece en las fotos`); return fuera(`cita que no aparece en las fotos ("${String(cita).slice(0, 60)}")`); }
  return true;
}

// Fotografía de un personaje: Wikipedia solo para la imagen, nunca para datos. Las miniaturas que da el resumen de
// Wikipedia (a veces en thumb.wikimedia.org, o redimensionadas a 400 px) respondían error 400 en el reproductor; las que
// sí cargan son las de upload.wikimedia.org a 960 px. Cada URL se comprueba antes de guardarla: si no responde 200, no
// se pone.
export function urlWikimedia(fuente: string, ancho?: number): string | null {
  const m = String(fuente ?? "").match(/^https?:\/\/upload\.wikimedia\.org\/wikipedia\/([^/]+)\/(?:thumb\/)?([0-9a-f])\/([0-9a-f]{2})\/([^/?#]+)/i);
  if (!m) return null;
  const [, proyecto, a, ab, archivo] = m;
  if (/\.(tiff?|pdf|djvu|webm|ogv|ogg)$/i.test(archivo)) return null;
  const original = `https://upload.wikimedia.org/wikipedia/${proyecto}/${a}/${ab}/${archivo}`;
  // Si la imagen original mide 960 px o menos, se usa tal cual (Wikimedia no agranda miniaturas).
  if (ancho && ancho <= 960 && !/\.svg$/i.test(archivo)) return original;
  return `https://upload.wikimedia.org/wikipedia/${proyecto}/thumb/${a}/${ab}/${archivo}/960px-${archivo}${/\.svg$/i.test(archivo) ? ".png" : ""}`;
}
const UA = { "user-agent": "SparkEd/1.0 (guias de estudio; sparkeducation-mx.com)" };
async function responde(url: string): Promise<boolean> {
  try {
    const r = await fetch(url, { method: "HEAD", headers: UA, signal: AbortSignal.timeout(8000) });
    return r.status === 200;
  } catch { return false; }
}
async function imagenWikipedia(nombre: string, idioma: string): Promise<{ url: string; pie: string; credito: string } | null> {
  for (const lang of [idioma, "es", "en"].filter((v, i, a) => a.indexOf(v) === i)) {
    try {
      const r = await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(nombre.replace(/ /g, "_"))}`, { headers: { accept: "application/json", ...UA }, signal: AbortSignal.timeout(8000) });
      if (!r.ok) continue;
      const d = await r.json();
      if (d.type === "disambiguation") continue;
      const candidatas = [urlWikimedia(d.originalimage?.source, Number(d.originalimage?.width) || undefined), urlWikimedia(d.thumbnail?.source, Number(d.originalimage?.width) || undefined)].filter((x, i, a): x is string => !!x && a.indexOf(x) === i);
      for (const url of candidatas) if (await responde(url)) return { url, pie: d.title ?? nombre, credito: "Wikimedia Commons" };
    } catch { /* siguiente idioma */ }
  }
  return null;
}

// Vista previa: calentamiento y bloque 1 (pistas, sus preguntas de opción múltiple y otro formato: conceptos,
// clasificar, verdadero o falso u ordenar), para que se vean al menos dos formatos distintos. Lo demás se bloquea.
// Vista previa gratis (Daniel, 9 nov 2026): 4 slides — portada, UNA pista (una sola página de teoría) y DOS juegos de
// formato distinto (el primer juego de preguntas, que el reproductor nunca pone como carrera, y otro: conceptos,
// clasificar, verdadero o falso u ordenar). Sin tutorial ni calentamiento. Solo se manda lo que se muestra; el bloque 1
// completo se sigue generando y guardando porque se reutiliza al pagar.
const PESO_PISTA_UNA_PAGINA = 1300; // el mismo límite que usa el reproductor para que una pista quepa en una slide
function pesoPista(p: any): number {
  const l = (x: unknown) => String(x ?? "").length;
  let n = 70 + l(p?.titulo);
  n += (p?.ideas ?? []).reduce((a: number, x: unknown) => a + l(x) + 45, 0);
  n += (p?.ideas_apoyo ?? []).reduce((a: number, x: unknown) => a + l(x) + 10, 0);
  if (p?.ejemplo) n += l(p.ejemplo) + 45;
  n += (p?.correcciones ?? []).reduce((a: number, cr: any) => a + l(cr?.dato_correcto ?? cr?.mensaje) + l(cr?.dato_apuntes) + 60, 0);
  if (p?.clave) n += l(p.clave) + 60;
  if (p?.conclusion) n += l(p.conclusion) + 60;
  if (p?.dato_rapido) n += 90;
  if ((p?.imagenes ?? []).some((x: any) => x?.url)) n += 240;
  if (p?.esquema?.tipo) n += 140 + (p.esquema.elementos ?? []).reduce((a: number, e: any) => a + l(e?.nombre) + l(e?.detalle) + 35, 0);
  if (p?.completado_con_fuentes) n += 90 + (p.completado_con_fuentes.fuentes ?? []).slice(0, 2).reduce((a: number, f: any) => a + l(f?.nombre), 0);
  return n;
}
export function recortarVistaPrevia(c: any): any {
  const bloques = (c.bloques ?? []).filter(Boolean);
  const b0 = bloques[0];
  const planeados = Array.isArray(c.plan?.bloques_plan) ? c.plan.bloques_plan : [];
  const hechas = bloques.reduce((n: number, b: any) => n + (b.actividades?.length ?? 0) + (b.mini_examen?.length ?? 0) + (b.duelo?.length ?? 0), 0);
  // Si solo existe el bloque 1 (vista previa), los totales se estiman con el plan.
  const estimadas = planeados.reduce((n: number, pb: any) => n + Object.values(pb.juegos ?? {}).reduce((s: number, x: any) => s + (Number(x) || 0), 0) + (Number(pb.mini_examen) || 0), 0);
  const v: any = { version_formato: c.version_formato, plan: { ...c.plan }, bloques: [], calentamiento: [], reto_final: [], vista_previa: true, bloques_totales: Math.max(planeados.length, bloques.length), actividades_totales: Math.max(hechas, estimadas) };
  delete v.plan.bloques_plan;
  if (b0) {
    // Nunca una pregunta en blanco en la vista previa (11 nov 2026).
    const acts = ((b0.actividades ?? []) as any[]).filter((a: any) => !TIPOS_PREGUNTA.includes(a?.tipo) || textoPregunta(a));
    const quiz = acts.filter((a: any) => a.tipo === "opcion_multiple" || a.tipo === "completar").slice(0, 6);
    const orden = (Array.isArray(b0.orden) ? b0.orden : []) as string[];
    // Otro formato (el que el plan pone primero); sin juego de preguntas en el bloque 1, dos formatos distintos.
    const otros = [...new Set([...orden.filter((x) => VARIEDAD_B1.includes(x)), ...VARIEDAD_B1])].filter((k) => acts.some((a: any) => a.tipo === k)).slice(0, quiz.length ? 1 : 2);
    const extra = otros.flatMap((otro) => otro === "verdadero_falso" ? acts.filter((a: any) => a.tipo === otro) : acts.filter((a: any) => a.tipo === otro).slice(0, 1));
    const actividades = [...quiz, ...extra];
    // La pista de muestra es de contenido (nunca la nota «repásalo en tu libro», salvo que no haya otra).
    const pistas = (b0.pistas ?? []) as any[];
    const deContenido = pistas.filter((p) => !p.nota_temario);
    const pista = deContenido.find((p) => pesoPista(p) <= PESO_PISTA_UNA_PAGINA) ?? deContenido[0] ?? pistas[0];
    const tipos = new Set(actividades.map((a: any) => juegoDe(a.tipo)));
    const ordenVp = orden.filter((x) => tipos.has(x));
    v.bloques.push({ id: b0.id, titulo: b0.titulo, pistas: pista ? [pista] : [], actividades: actividades.sort((x: any, y: any) => ordenVp.indexOf(juegoDe(x.tipo)) - ordenVp.indexOf(juegoDe(y.tipo))), mini_examen: [], duelo: [], orden: ordenVp.length ? ordenVp : [...tipos], mecanica_quiz: b0.mecanica_quiz ?? null });
    // Sin calentamiento ni primera actividad especial en la vista previa (sí en la guía completa).
  }
  return v;
}

// ---------- Verificación final antes de entregar (Daniel, 9 nov 2026) ----------
// La familia solo recibe su link cuando la guía está 100 % armada. Esta revisión, sin IA, mira el cartucho completo:
// al menos un bloque; cada bloque con pistas y con juegos que cumplen los mínimos; solo tipos de actividad que el
// reproductor conoce; total de slides dentro del tope y completo === true. Devuelve la lista de problemas (vacía = pasa).
export const TIPOS_REPRODUCTOR = ["opcion_multiple", "completar", "verdadero_falso", "super_dato", "conceptos", "quien_es_quien", "ordenar", "clasificar", "duelo"];
const TIPOS_PREGUNTA = ["opcion_multiple", "completar", "verdadero_falso"];
// El texto que el alumno ve en una pregunta: el reproductor muestra pregunta ?? afirmacion ?? enunciado, y el juego de
// deslizar de verdadero o falso, solo la afirmacion. Vacío = la pregunta sale en blanco.
export function textoPregunta(a: any): string {
  return String((a?.tipo === "verdadero_falso" ? a?.afirmacion : a?.pregunta ?? a?.afirmacion ?? a?.enunciado) ?? "").trim();
}
export const TOPE_SLIDES_ENTREGA = TOPE_JUSTIFICADO + 2; // el tope más alto del plan, con margen para la cuenta del reproductor
export function verificarCartucho(c: any): string[] {
  const out: string[] = [];
  if (!c || typeof c !== "object") return ["No hay cartucho"];
  if (c.completo !== true) out.push("La guía no está marcada como completa");
  if (c.vista_previa === true) out.push("Es una vista previa, no la guía completa");
  const bloques = Array.isArray(c.bloques) ? c.bloques.filter(Boolean) : [];
  if (!bloques.length) out.push("No tiene bloques");
  for (const b of bloques) {
    const id = String(b.id ?? "?");
    const pistas = Array.isArray(b.pistas) ? b.pistas.filter((p: any) => p && (String(p.titulo ?? "").trim() || (p.ideas ?? []).length)) : [];
    if (!pistas.length) out.push(`Bloque ${id}: no tiene pistas`);
    const acts = Array.isArray(b.actividades) ? b.actividades : [];
    for (const a of acts) if (!TIPOS_REPRODUCTOR.includes(a?.tipo)) out.push(`Bloque ${id}: tipo de actividad desconocido "${a?.tipo}"`);
    for (const a of [...(b.mini_examen ?? []), ...(b.duelo ?? []).map((x: any) => ({ tipo: "opcion_multiple", ...x }))]) if (!TIPOS_PREGUNTA.includes(a?.tipo)) out.push(`Bloque ${id}: pregunta de tipo desconocido "${a?.tipo}"`);
    if (juegosDelBloque(b) < 1) out.push(`Bloque ${id}: no tiene juegos`);
    // Nunca una pregunta vacía (11 nov 2026): ver textoPregunta.
    const sinTexto = [...acts.filter((a: any) => TIPOS_PREGUNTA.includes(a?.tipo)), ...(b.mini_examen ?? []), ...(b.duelo ?? [])].filter((a: any) => !textoPregunta(a));
    if (sinTexto.length) out.push(`Bloque ${id}: ${sinTexto.length} pregunta(s) sin texto (${sinTexto.slice(0, 3).map((a: any) => a?.id).join(", ")})`);
    // Nunca una tarjeta de clasificar que diga su grupo (sería la respuesta escrita).
    for (const a of acts.filter((x: any) => x?.tipo === "clasificar")) {
      const reveladas = (Array.isArray(a.elementos) ? a.elementos : []).filter((e: any) => typeof e?.texto === "string" && sinGrupoEscrito(e.texto, a.grupos) !== e.texto.trim());
      if (reveladas.length) out.push(`Bloque ${id}: ${reveladas.length} tarjeta(s) de ${a.id} con la respuesta escrita («${reveladas[0].texto}»)`);
    }
    // Mínimos: los mismos del generador (el duelo ya vive en su lista propia).
    const conDuelo = { ...b, actividades: [...acts, ...(b.duelo ?? []).map((x: any) => ({ ...x, tipo: "duelo" }))] };
    for (const f of faltasDeBloque(conDuelo)) out.push(`Bloque ${id}: ${f.juego}${f.id ? " " + f.id : ""} tiene ${f.tiene} ${f.unidad} (mínimo ${f.minimo})`);
  }
  const slides = estimarSlides(bloques);
  const tope = Math.max(TOPE_SLIDES_ENTREGA, ent(c.plan?.presupuesto_slides) + 2);
  if (slides > tope) out.push(`Tiene ${slides} slides; el tope es ${tope}`);
  return out;
}

// ---------- Temas del temario completados con fuentes (Daniel, 11 nov 2026) ----------
// «No podemos inventar temas, pero sí es necesario hacer las guías lo más completas posibles.» Solo se investigan los
// temas que el alumno trae ESCRITOS en su material sin su contenido (temas_a_investigar del plan); nunca temas nuevos
// ni la práctica del examen. Un dato se queda solo con 1 fuente oficial o 2 confiables de sitios distintos, y solo si
// esa página salió de verdad en la búsqueda (nada de memoria). Lo que no se confirma se queda como nota para repasar
// en el libro. Se enciende con el ajuste sparked_investigar = "si" (o por trabajo, en las pruebas del administrador).
export type TemaInv = { tema: string; bloque: string; pagina: string };
export type FuenteInv = { nombre: string; url: string; oficial?: boolean; sitio?: string };
export type ResultadoInv = TemaInv & { estado: "confirmado" | "no_confirmado" | "practica_examen"; datos: { texto: string; fuentes: FuenteInv[] }[]; fuentes: { nombre: string; url: string }[]; motivo: string; busqueda?: { consultas: string[]; errores: string[]; segunda?: boolean } };
// Tope de 6 MXN por guía (Daniel, 11 nov 2026): hasta 6 subtemas por guía, repartidos entre los temas del temario
// (ver temasQueSeInvestigan), y 2 búsquedas por subtema (antes 8 y 3).
export const MAX_TEMAS_INVESTIGAR = 6; // subtemas por guía; los que sigan quedan como nota para repasar en el libro
// Búsquedas (tope de 5 MXN por guía, Daniel, 11 nov 2026; cada búsqueda cuesta 0.01 USD ≈ 0.19 MXN): 1 por tema en la
// primera vuelta. Si el tema no se confirmó porque el buscador dio error o se acabaron las búsquedas, tiene una segunda
// oportunidad él solo, con 2 búsquedas (registrando las consultas y los errores de la primera).
export const BUSQUEDAS_POR_TEMA = 1;
export const BUSQUEDAS_SEGUNDA = 2;
// Tope de costo de una guía completa con investigación (vista previa + resto). La segunda oportunidad de un tema solo
// se da si, con ella y con lo que falta de la guía (reserva medida en las pruebas), la guía no pasa del tope; si no, el
// tema queda como nota para repasar en el libro. Nunca se corta una guía: solo se omite esa búsqueda extra.
export const TOPE_GUIA_MXN = 5;
export const MXN_POR_USD = 18.5;
// Lo que falta después de escribir, sin las búsquedas de verificar (esas se ajustan al final con lo que quede):
// reparar (0.48 a 1.2 en las guías del 8 al 11 nov) + ortografía (0.33 a 0.66) + los tokens de verificar.
const RESERVA_FINAL_MXN = 1.4;
const RESERVA_POR_BLOQUE_MXN = 0.15; // escribir un bloque (medido: 0.11 a 0.15)
const FIJOS_INVESTIGAR = 1800; // tokens que relee cada vuelta de una llamada de investigación (instrucciones + tema)
const FIJOS_VERIFICAR = 1100; // ídem en verificar, sin contar las líneas de su parte
// Lo que lleva gastado la guía (las métricas del trabajo «resto» incluyen las de su vista previa).
export function costoGuiaMxn(D: any): number {
  return (Array.isArray(D?.metricas) ? D.metricas : []).reduce((n: number, m: any) => n + (Number(m?.costo_usd) || 0), 0) * MXN_POR_USD;
}
// Costo estimado de una llamada con buscador, con el PRECIO REAL: cada búsqueda cuesta 0.01 USD y trae unos 15 000
// tokens de páginas, cada vuelta vuelve a leer lo fijo, y arriba de 100 000 tokens Haiku cobra 5 veces más (precioDe).
// Medido en 8 guías (8 a 11 nov 2026): 44 000 a 131 500 tokens con 3 a 6 búsquedas en una sola llamada.
export function costoLlamadaMxn(modelo: string, busquedas: number, tokensFijos: number): number {
  const entrada = (busquedas + 1) * tokensFijos + 15_000 * busquedas;
  const salida = 2_500 + 1_500 * busquedas;
  const [pe, ps] = precioDe(modelo, entrada);
  return ((entrada * pe + salida * ps) / 1e6 + 0.01 * busquedas) * MXN_POR_USD;
}
// Rastro del tope de 5 MXN: cada vez que quita búsquedas queda en datos.metricas (costo 0) y en el log («CANDADO»).
export function anotarCandado(D: any, paso: string, detalle: string): void {
  D.metricas = [...(Array.isArray(D.metricas) ? D.metricas : []), { paso: `candado ${TOPE_GUIA_MXN} MXN · ${paso}`, modelo: "—", esfuerzo: "—", entrada: 0, salida: 0, costo_usd: 0, ms: 0, parada: null, resultado: detalle, en: new Date().toISOString() }].slice(-80);
  console.log("CANDADO", JSON.stringify({ tope_mxn: TOPE_GUIA_MXN, paso, detalle }));
}
export function puedeSegunda(D: any, bloquesPorEscribir: number, modelo = MODELO_HAIKU): boolean {
  return costoGuiaMxn(D) + costoLlamadaMxn(modelo, BUSQUEDAS_SEGUNDA, FIJOS_INVESTIGAR) + RESERVA_FINAL_MXN + RESERVA_POR_BLOQUE_MXN * Math.max(0, bloquesPorEscribir) <= TOPE_GUIA_MXN;
}

// ---------- Verificación por partes (2026-11-11.6) ----------
export const VERIF_BUSQUEDAS_POR_LLAMADA = 3;
// Lo que se verifica, una línea por pista o actividad: solo el dato y su respuesta (las parejas, tarjetas y pasos en su
// misma línea). Cada búsqueda vuelve a leer todo lo que se manda: en JSON eran 7 000 a 13 000 caracteres por guía.
export function lineasParaVerificar(bloques: any[]): { bloque: string; id: string; texto: string }[] {
  const c = (x: unknown) => String(x ?? "").replace(/\s+/g, " ").trim();
  const out: { bloque: string; id: string; texto: string }[] = [];
  for (const b of Array.isArray(bloques) ? bloques : []) {
    for (const p of b?.pistas ?? []) out.push({ bloque: b.id, id: p.id, texto: `${p.id} [pista] ${c(p.titulo)}: ${(Array.isArray(p.ideas) ? p.ideas : []).map(c).filter(Boolean).join(" | ")}` });
    for (const a of b?.actividades ?? []) {
      const partes: string[] = [];
      const resp = a?.tipo === "verdadero_falso" && (a.respuesta === "true" || a.respuesta === "false") ? (a.respuesta === "true" ? "verdadero" : "falso") : c(a?.respuesta);
      const preg = c(a?.pregunta);
      if (preg || resp) partes.push(resp ? `${preg} → ${resp}` : preg);
      if (Array.isArray(a?.pares) && a.pares.length) partes.push(a.pares.map((x: any) => `${c(x?.termino)} = ${c(x?.definicion)}`).join("; "));
      if (Array.isArray(a?.elementos) && a.elementos.length && Array.isArray(a?.grupos)) partes.push(a.grupos.map((g: unknown, gi: number) => `${c(g)}: ${a.elementos.filter((e: any) => e?.grupo === gi).map((e: any) => c(typeof e === "object" ? e?.texto : e)).join(", ")}`).join(" · "));
      if (Array.isArray(a?.pasos) && a.pasos.length) partes.push(a.pasos.map((x: unknown) => c(typeof x === "object" ? (x as any)?.texto : x)).join(" > "));
      out.push({ bloque: b.id, id: a.id, texto: `${a.id} [${c(a.tipo)}] ${partes.join(" · ")}` });
    }
  }
  return out;
}
// Partes seguidas de tamaño parecido, con las búsquedas repartidas (máx. 3 por llamada).
export function planVerificacion(lineas: { texto: string }[], base: number): any {
  if (!lineas.length) return { i: 0, partes: [], busquedas: [], base, recortes: [] };
  const n = Math.max(1, Math.min(Math.ceil(base / VERIF_BUSQUEDAS_POR_LLAMADA), lineas.length));
  const total = lineas.reduce((s, l) => s + l.texto.length, 0);
  const grupos: string[][] = [];
  let actual: string[] = [], acum = 0;
  for (const l of lineas) {
    actual.push(l.texto); acum += l.texto.length;
    if (grupos.length < n - 1 && acum >= (total * (grupos.length + 1)) / n) { grupos.push(actual); actual = []; }
  }
  if (actual.length) grupos.push(actual);
  const partes = grupos.map((g) => ({ lineas: g, tokens: Math.ceil(g.join("\n").length / 3.5) }));
  const busquedas = partes.map((_, k) => Math.min(VERIF_BUSQUEDAS_POR_LLAMADA, Math.floor(base / partes.length) + (k < base % partes.length ? 1 : 0)));
  return { i: 0, partes, busquedas, original: [...busquedas], base, recortes: [] };
}
// Tope de 5 MXN para lo que falta de verificar (de la parte «desde» en adelante), con el precio real. Parte del plan
// original (si una parte usó menos búsquedas, las siguientes las recuperan) y, si no alcanza, quita búsquedas (primero
// a la parte que tiene más) y deja rastro. Sin búsquedas, la parte se verifica sin buscador. Cuenta todas las búsquedas
// permitidas como usadas: la IA casi nunca las usa todas (en 8 guías, de 0 a 10 de 10), así que el costo real queda abajo.
export function ajustarVerificacion(D: any, modelo: string, desde: number): string | null {
  const v = D?.verif;
  if (!v || !Array.isArray(v.partes) || desde >= v.partes.length) return null;
  if (Array.isArray(v.original)) for (let k = desde; k < v.partes.length; k++) v.busquedas[k] = Number(v.original[k]) || 0;
  const presupuesto = TOPE_GUIA_MXN - costoGuiaMxn(D) - 0.05;
  const costo = () => v.partes.slice(desde).reduce((s: number, p: any, k: number) => s + costoLlamadaMxn(modelo, v.busquedas[desde + k] ?? 0, FIJOS_VERIFICAR + (Number(p?.tokens) || 0)), 0);
  const suma = () => v.busquedas.slice(desde).reduce((s: number, x: number) => s + (Number(x) || 0), 0);
  const antes = suma();
  while (costo() > presupuesto) {
    let k = -1;
    for (let j = desde; j < v.busquedas.length; j++) if (v.busquedas[j] > 0 && (k < 0 || v.busquedas[j] >= v.busquedas[k])) k = j;
    if (k < 0) break;
    v.busquedas[k]--;
  }
  const despues = suma();
  if (despues === antes) return null;
  const detalle = `verificar: ${antes} → ${despues} búsquedas${desde ? ` (desde la parte ${desde + 1})` : ""}; la guía llevaba ${costoGuiaMxn(D).toFixed(2)} MXN`;
  v.recortes = [...(Array.isArray(v.recortes) ? v.recortes : []), detalle];
  anotarCandado(D, "verificar", detalle);
  return detalle;
}
// Nota para el Planificador cuando la investigación está encendida: cada tema del temario lleva su pista (y su slide).
const NOTA_PLAN_INVESTIGAR = "TEMAS DEL TEMARIO: SparkEd completará con fuentes confiables los temas_a_investigar. Pon cada uno en su bloque con su propia pista (un título de \"pistas\"; cuenta como slide). Si no se puede confirmar, esa pista se vuelve una nota para repasarlo en el libro.";
const TEMAS_POR_LLAMADA = 2; // cada llamada, con sus búsquedas, debe terminar antes de 125 s

export function investigacionActiva(fuente: { opciones?: Record<string, unknown> }): boolean {
  return ["si", "sí", "true", "1", "on"].includes(String(fuente?.opciones?.investigar ?? "").toLowerCase().trim());
}

// Práctica o formato del examen: no es contenido y no se investiga ni se anota (la EXCEPCIÓN de las habilidades del
// Planificador sigue: "Writing: opinion essays" o "Exam skills: how to answer…" sí son contenido).
const PRACTICA_EXAMEN = /^(gapped text|listening|speaking|use of english|open cloze|multiple choice cloze|key word transformations?|sentence transformations?|(reading|writing|listening|speaking) (part|paper|task) ?\d*|(part|paper) \d+|exam (tips?|practice|format|instructions)|mock exams?|practice tests?|simulacros?|formato del examen|partes del examen|instrucciones del examen|practica (de|del) examen|examen de practica)\b/;
export function esPracticaDeExamen(tema: string): boolean {
  const t = normaliza(tema);
  return PRACTICA_EXAMEN.test(t) || /^(reading|writing)$/.test(t);
}

// Los temas del plan como { tema, bloque, pagina }: acepta textos sueltos (planes anteriores), quita repetidos y, si el
// bloque no existe, lo asigna al bloque que más se parece.
export function normalizarTemas(plan: any): TemaInv[] {
  const bloques = (plan?.bloques ?? []).filter(Boolean);
  const ids = bloques.map((b: any) => String(b.id));
  const out: TemaInv[] = [];
  const vistos = new Set<string>();
  for (const x of Array.isArray(plan?.temas_a_investigar) ? plan.temas_a_investigar : []) {
    const obj = x && typeof x === "object" ? x : {};
    const tema = String(typeof x === "string" ? x : (obj as any).tema ?? "").replace(/\s+/g, " ").trim().slice(0, 140);
    const k = normaliza(tema);
    if (!k || vistos.has(k)) continue;
    vistos.add(k);
    let bloque = String((obj as any).bloque ?? "").trim();
    if (!ids.includes(bloque)) bloque = bloqueParecido(bloques, tema) ?? ids[ids.length - 1] ?? "b1";
    out.push({ tema, bloque, pagina: String((obj as any).pagina ?? "").replace(/\s+/g, " ").trim().slice(0, 60) });
  }
  return out;
}
function bloqueParecido(bloques: any[], tema: string): string | null {
  const ws = normaliza(tema).split(" ").filter((w) => w.length > 3);
  let mejor: string | null = null, puntos = 0;
  for (const b of bloques) {
    const txt = new Set(normaliza([b.titulo, ...(b.temas ?? []), ...(b.pistas ?? [])].join(" ")).split(" "));
    const n = ws.filter((w) => txt.has(w)).length;
    if (n > puntos) { puntos = n; mejor = String(b.id); }
  }
  return mejor;
}

// Lo que el temario separa con «;» como tema DISTINTO va como tema aparte (Daniel, 11 nov 2026: en «Reglamento:
// definición-función; contiene derechos, responsabilidades y sanciones; verbo (infinitivo y modos…)» el verbo se perdió
// dentro de «Reglamento»: no se investigó ni quedó como nota). Una parte es un tema distinto si es un nombre solo (con o
// sin paréntesis) que no repite palabras del tema de su línea; no lo es un detalle: «definición», «teoría y práctica»,
// «contiene…» o una lista («coplas, pregones, refranes y dichos»).
const GENERICAS = new Set(["definicion", "funcion", "concepto", "conceptos", "teoria", "practica", "practicas", "ejemplos", "ejemplo", "caracteristicas", "tipos", "clasificacion", "usos", "ejercicios", "elementos", "partes", "estructura", "importancia", "proposito", "repaso", "introduccion"]);
const CONECTORES = /^(contiene|contienen|incluye|incluyen|tiene|tienen|con|sus|su|y|e|asi como|ademas|como|que|el|la|los|las|un|una|uso|usos|de|del)\b/;
export function esTemaAparte(parte: string, cabeza: string): boolean {
  const sinParen = String(parte ?? "").replace(/\([^)]*\)/g, " ");
  const n = normaliza(sinParen);
  if (!n || CONECTORES.test(n) || sinParen.includes(",") || /\s(y|e|o|u)\s/.test(` ${n} `)) return false;
  const ws = n.split(" ").filter((w) => w.length > 3);
  if (!ws.length || ws.every((w) => GENERICAS.has(w))) return false;
  const cab = new Set(normaliza(cabeza).split(" ").filter((w) => w.length > 3));
  return !ws.some((w) => cab.has(w));
}
const conMayuscula = (s: string) => { const x = String(s ?? "").replace(/\s+/g, " ").trim(); return x.charAt(0).toUpperCase() + x.slice(1); };
// 1) Un tema del plan que junta dos temas distintos con «;» se parte. 2) Un tema distinto de una línea del temario
// (categoría «temas» del inventario) que ningún tema del plan cubre se agrega, en el bloque que más se parece, solo si
// ese bloque no trae contenido propio en los apuntes (si lo trae, el escritor lo convierte como siempre).
export function completarTemasDelTemario(plan: any, inventario: Record<string, any[]>): TemaInv[] {
  const bloques = (plan?.bloques ?? []).filter(Boolean);
  const out: TemaInv[] = [];
  for (const tm of (Array.isArray(plan?.temas_a_investigar) ? plan.temas_a_investigar : []) as TemaInv[]) {
    const partes = String(tm.tema ?? "").split(";").map((s) => s.trim()).filter(Boolean);
    if (partes.length < 2) { out.push(tm); continue; }
    const cabeza = partes[0].split(":")[0];
    const aparte = partes.slice(1).filter((p) => esTemaAparte(p, cabeza));
    out.push({ ...tm, tema: [partes[0], ...partes.slice(1).filter((p) => !aparte.includes(p))].join("; ").slice(0, 140) });
    for (const p of aparte) out.push({ tema: conMayuscula(p).slice(0, 140), bloque: tm.bloque, pagina: tm.pagina });
  }
  const conContenido = (bloqueId: string) => {
    const pb = bloques.find((b: any) => String(b.id) === bloqueId);
    const ids = new Set(((pb?.ids_inventario ?? []) as string[]).filter((x) => !String(x).startsWith("inv")));
    const inv: Record<string, any[]> = {};
    for (const [k, lista] of Object.entries(inventario ?? {})) { if (k === "investigado" || !Array.isArray(lista)) continue; const sel = ids.size ? lista.filter((e) => ids.has(e?.id)) : lista; if (sel.length) inv[k] = sel; }
    return tieneContenidoPropio(inv);
  };
  for (const el of Array.isArray(inventario?.temas) ? inventario.temas : []) {
    const partes = String(el?.texto ?? el?.cita ?? "").split(";").map((s) => s.trim()).filter(Boolean);
    if (partes.length < 2) continue;
    const cabeza = partes[0].split(":")[0];
    for (const p of partes.slice(1)) {
      if (!esTemaAparte(p, cabeza)) continue;
      const ws = normaliza(p.replace(/\([^)]*\)/g, " ")).split(" ").filter((w) => w.length > 3);
      if (out.some((t) => normaliza(t.tema).split(" ").some((w) => ws.includes(w)))) continue;
      const deLaLinea = out.find((t) => seParece(String(t.tema).split(":")[0], cabeza))?.bloque;
      const bloque = bloqueParecido(bloques, p) ?? deLaLinea ?? String(bloques.at(-1)?.id ?? "b1");
      if (conContenido(bloque)) continue;
      out.push({ tema: conMayuscula(p).slice(0, 140), bloque, pagina: "" });
    }
  }
  const vistos = new Set<string>();
  return out.filter((t) => { const k = normaliza(t.tema); if (!k || vistos.has(k)) return false; vistos.add(k); return true; });
}

// ¿El inventario del bloque trae contenido de los apuntes (no solo la lista de temas)? No cuentan el «ninguno» de los
// ejercicios, las palabras de vocabulario que la foto no define («sin_definicion») ni los datos de la hoja que no son
// contenido («Maestra: …», «Fecha de aplicación del examen: …», «Materia: …», «Temario del primer trimestre»).
const PROPIAS = ["datos_clave", "vocabulario", "reglas", "secuencias", "categorias", "personajes", "diagramas", "textos_dificiles", "ejercicios_del_libro"];
export function esDatoAdministrativo(texto: unknown): boolean {
  const s = String(texto ?? "");
  const i = s.indexOf(":");
  if (i > 0) return /^(maestr[oa]|profesora?|docente|fecha( de .+)?|materia|asignatura|grados?|grupos?|ciclo escolar|escuela|colegio|nombre( del alumno)?)$/.test(normaliza(s.slice(0, i)));
  return /^temario( .+)?$/.test(normaliza(s));
}
export function tieneContenidoPropio(inv: Record<string, any[]>): boolean {
  const vacio = (k: string, e: any) => (k === "ejercicios_del_libro" && /^ninguno$/i.test(String(e.instruccion ?? "").trim())) || (k === "vocabulario" && /^sin_definici[oó]n$/i.test(String(e.significado ?? "").trim())) || (k === "datos_clave" && esDatoAdministrativo(e.texto ?? e.cita));
  return PROPIAS.some((k) => (Array.isArray(inv?.[k]) ? inv[k] : []).some((e: any) => e && (typeof e === "object" ? !vacio(k, e) : String(e).trim() !== "")));
}
// Bloque que solo lleva la nota del temario: tenía temas por investigar, ninguno se confirmó y los apuntes no traen
// contenido propio para él. Sin investigación (resB vacío) nunca aplica: todo sigue como antes.
export function bloqueSoloNota(resB: ResultadoInv[], invBloque: Record<string, any[]>): boolean {
  return resB.some((r) => r.estado === "no_confirmado") && !resB.some((r) => r.estado === "confirmado") && !tieneContenidoPropio(invBloque);
}
// Lo que el paso verificar le manda a la IA. Fuera quedan las notas «repásalo en tu libro», las pistas marcadas
// «Completado con fuentes» y las actividades cuya cita es un dato confirmado al investigar (ya traen 1 fuente oficial o
// 2 confiables). Sin investigación, el resumen es el mismo de siempre. total y omitidos cuentan pistas y actividades.
export function contenidoParaVerificar(D: any): { bloques: any[]; total: number; omitidos: number } {
  const datos = (Array.isArray(D?.investigacion) ? D.investigacion : []).filter((r: any) => r?.estado === "confirmado").flatMap((r: any) => (r.datos ?? []).map((d: any) => String(d?.texto ?? ""))).filter(Boolean);
  const conFuentes = (a: any) => a?.fuente?.tipo === "investigado" && datos.length > 0 && citaExiste(String(a.fuente?.cita ?? ""), datos);
  let total = 0, omitidos = 0;
  const bloques: any[] = [];
  for (const b of (Array.isArray(D?.bloques) ? D.bloques : []).filter(Boolean)) {
    const pistas = (b.pistas ?? []).filter((p: any) => p && !p.nota_temario);
    const acts = [...(b.actividades ?? []), ...(b.mini_examen ?? [])].filter(Boolean);
    const pistasV = pistas.filter((p: any) => !p.completado_con_fuentes);
    const actsV = acts.filter((a: any) => !conFuentes(a));
    total += pistas.length + acts.length;
    omitidos += pistas.length - pistasV.length + acts.length - actsV.length;
    if (!pistasV.length && !actsV.length) continue;
    bloques.push({ id: b.id, pistas: pistasV.map((p: any) => ({ id: p.id, titulo: p.titulo, ideas: p.ideas })), actividades: actsV.map((a: any) => ({ id: a.id, tipo: a.tipo, pregunta: a.pregunta ?? a.afirmacion ?? a.enunciado ?? a.texto ?? a.instruccion, respuesta: a.opciones ? a.opciones[a.correcta] : a.respuesta ?? (a.es_verdadera !== undefined ? String(a.es_verdadera) : undefined), pares: a.pares, pasos: a.pasos?.map((p: any) => p.texto), grupos: a.grupos, elementos: a.elementos })) });
  }
  return { bloques, total, omitidos };
}
export function resultadosDeBloque(D: any, bloqueId: string): ResultadoInv[] {
  return (Array.isArray(D?.investigacion) ? D.investigacion : []).filter((r: any) => r?.bloque === bloqueId);
}
// El tema del temario al que pertenece un subtema: lo que va antes de «:» («Acento normativo: esdrújulas» → «acento
// normativo»); sin «:», el subtema entero.
export function raizDeTema(tema: string): string {
  const t = String(tema ?? "");
  const i = t.indexOf(":");
  return normaliza(i > 0 ? t.slice(0, i) : t);
}
// Los subtemas que se investigan (opción «segura» de la jefe, 11 nov 2026): hasta MAX_TEMAS_INVESTIGAR, primero uno
// de cada tema del temario, en el orden del plan, y luego los segundos, y así. El planificador no parte igual el mismo
// temario dos veces (6 subtemas en una corrida y 8 en otra): así ningún tema del temario se queda sin investigar
// mientras otro investiga su segundo subtema. Lo que no entra queda como nota para repasar en el libro.
export function temasQueSeInvestigan(todos: TemaInv[]): Set<string> {
  const porRaiz = new Map<string, TemaInv[]>();
  for (const x of todos.filter((t) => !esPracticaDeExamen(t.tema))) {
    const r = raizDeTema(x.tema);
    porRaiz.set(r, [...(porRaiz.get(r) ?? []), x]);
  }
  const dentro = new Set<string>();
  for (let vuelta = 0; dentro.size < MAX_TEMAS_INVESTIGAR; vuelta++) {
    const deEstaVuelta = [...porRaiz.values()].map((lista) => lista[vuelta]).filter(Boolean);
    if (!deEstaVuelta.length) break;
    for (const x of deEstaVuelta) if (dentro.size < MAX_TEMAS_INVESTIGAR) dentro.add(normaliza(x.tema));
  }
  return dentro;
}
// Temas de un bloque que todavía no tienen resultado. La práctica del examen y los que pasan del tope de la guía se
// resuelven aquí mismo, sin gastar: la primera se ignora y los segundos quedan como nota.
export function temasPendientes(D: any, bloqueId: string): TemaInv[] {
  const todos = normalizarTemas(D?.plan);
  D.investigacion = Array.isArray(D.investigacion) ? D.investigacion : [];
  const hecho = new Set(D.investigacion.map((r: any) => normaliza(r.tema)));
  const dentro = temasQueSeInvestigan(todos);
  const pend: TemaInv[] = [];
  for (const tm of todos) {
    if (tm.bloque !== bloqueId || hecho.has(normaliza(tm.tema))) continue;
    if (esPracticaDeExamen(tm.tema)) D.investigacion.push({ ...tm, estado: "practica_examen", datos: [], fuentes: [], motivo: "práctica o formato del examen: no es contenido" });
    else if (!dentro.has(normaliza(tm.tema))) D.investigacion.push({ ...tm, estado: "no_confirmado", datos: [], fuentes: [], motivo: `tope de ${MAX_TEMAS_INVESTIGAR} subtemas por guía (primero se investiga uno de cada tema del temario)` });
    else pend.push(tm);
  }
  return pend;
}

// Una llamada de investigación (con búsqueda web solo en dominios confiables). Primera vuelta: hasta 2 temas, 1
// búsqueda por tema. Si un tema no se confirma porque el buscador dio error, no devolvió páginas o se acabaron las
// búsquedas, queda pendiente para su SEGUNDA OPORTUNIDAD: una llamada para él solo, con 2 búsquedas y las consultas de
// la primera vez (Daniel, 11 nov 2026), si la guía no pasa del tope de 5 MXN. Devuelve el mismo paso: la siguiente
// ejecución sigue con los temas que falten y, al final, escribe el bloque. Si la IA falla dos veces (sin JSON o error),
// esos temas quedan como nota: la investigación nunca detiene una guía.
async function investigarTemas(supabase: Supa, t: Trabajo, fuente: Fuente, pb: any, pend: TemaInv[], nivel: string): Promise<string> {
  const D = t.datos as any; const plan = D.plan;
  D.inv_segunda = D.inv_segunda && typeof D.inv_segunda === "object" ? D.inv_segunda : {};
  const primeras = pend.filter((x) => !D.inv_segunda[normaliza(x.tema)]);
  const segunda = !primeras.length;
  const lote = segunda ? pend.slice(0, 1) : primeras.slice(0, TEMAS_POR_LLAMADA);
  const clave = lote.map((x) => normaliza(x.tema)).join("|");
  const previa = segunda ? D.inv_segunda[clave] ?? {} : null;
  const guardarTodo = () => guardar(supabase, t, { datos: D, costo_usd: t.costo_usd, tokens_entrada: t.tokens_entrada, tokens_salida: t.tokens_salida });
  if (segunda) {
    const bi = (plan.bloques ?? []).findIndex((b: any) => b?.id === pb.id);
    const porEscribir = Math.max(1, (plan.bloques?.length ?? 1) - Math.max(0, bi));
    // Nunca una tercera búsqueda (si por algo ya tuvo su segunda oportunidad) ni pasar del tope de la guía (con el precio
    // real; si el tope la quita, queda rastro en datos.metricas y en el log).
    const yaHecha = previa?.hecha === true;
    const modeloI = ajusteDe("investigar", D.con_haiku?.investigar ? {} : fuente.opciones ?? {}).modelo;
    if (yaHecha || !puedeSegunda(D, porEscribir, modeloI)) {
      if (!yaHecha) {
        D.inv_segunda[clave] = { ...previa, hecha: false, omitida: "tope" };
        anotarCandado(D, "investigar", `sin segunda búsqueda para «${lote[0].tema}»; la guía llevaba ${costoGuiaMxn(D).toFixed(2)} MXN`);
      }
      guardarInvestigacion(D, [{ ...lote[0], estado: "no_confirmado", datos: [], fuentes: [], motivo: `${previa?.motivo ?? "no se pudo confirmar"}${yaHecha ? "" : `; sin segunda búsqueda para no pasar del tope de ${TOPE_GUIA_MXN} MXN por guía`}`, ...(previa?.busqueda ? { busqueda: previa.busqueda } : {}) }]);
      await guardarTodo();
      return t.paso;
    }
  }
  const intento = D.intento_inv?.clave === clave ? Number(D.intento_inv.n) || 0 : 0;
  await guardar(supabase, t, { progreso: { pct: Number((t.progreso as any)?.pct) || 40, mensaje: `Buscando en fuentes confiables: ${lote.map((x) => x.tema).join(", ").slice(0, 70)} 🔎`, paso: t.paso } });
  const maxUsos = segunda ? BUSQUEDAS_SEGUNDA : BUSQUEDAS_POR_TEMA * lote.length;
  // La IA sabe qué falló antes (11 nov 2026: «entrada inválida» del buscador, 0 páginas) y qué consultas ya se hicieron.
  const consultasPrevias: string[] = Array.isArray(previa?.busqueda?.consultas) ? previa.busqueda.consultas : [];
  const aviso = segunda
    ? `\nSEGUNDA OPORTUNIDAD para este tema (tienes ${BUSQUEDAS_SEGUNDA} búsquedas): la primera vez ${String(previa?.motivo ?? "no se confirmó").slice(0, 160)}.${consultasPrevias.length ? ` Consultas que ya se hicieron: ${consultasPrevias.slice(0, 4).map((q) => `«${q}»`).join(", ")}.` : ""} Usa otras palabras: consultas cortas y sencillas (3 a 7 palabras, sin site:, comillas ni OR).`
    : intento > 0 ? `\nINTENTO ANTERIOR FALLIDO (${String(D.intento_inv?.motivo ?? "").slice(0, 120)}): haz consultas MÁS CORTAS y sencillas (3 a 7 palabras, sin site:, comillas ni OR).` : "";
  const contenido = [{ type: "text", text: `Materia: ${plan.materia ?? fuente.materia}. Grado: ${fuente.grado}. Nivel: ${nivel}. Idioma de la guía: ${plan.idioma_guia ?? "es"}.\nBloque de la guía: «${pb.titulo}» (sus temas: ${JSON.stringify(pb.temas ?? [])}).\nTEMAS A INVESTIGAR (${maxUsos === lote.length ? "1 búsqueda por tema" : `${maxUsos} búsquedas en total`}): ${JSON.stringify(lote.map((x) => ({ tema: x.tema, pagina: x.pagina })))}${aviso}` }];
  let resultados: ResultadoInv[] | null = null;
  let res: Respuesta | null = null;
  let motivo = "";
  let fallaIa = false;
  try {
    const r0 = await llamar(supabase, t, fuente, "investigar", `investigar ${pb.id}${segunda ? " · 2.ª oportunidad" : ""}`, { sistema: INVESTIGADOR, contenido, maxTokens: 12000, herramientas: [{ type: "web_search_20260209", name: "web_search", max_uses: maxUsos, allowed_domains: DOMINIOS_CONFIABLES }] });
    if (r0 === REPETIR) return t.paso;
    res = r0;
    if (Array.isArray(res.json?.temas)) resultados = validarInvestigacion(res.json, lote, res.urls);
    else { motivo = `sin JSON (${res.parada ?? "sin motivo"})`; await diagnosticar(supabase, t, `investigar ${pb.id}`, res); }
  } catch (e) {
    if ((e as any)?.reintentar) throw e;
    motivo = String((e as Error)?.message ?? e).slice(0, 160);
  }
  if (!resultados) {
    if (intento < 1) {
      // La IA no respondió bien: se reintenta (el trabajo espera unos segundos y vuelve a este mismo paso).
      D.intento_inv = { clave, n: intento + 1, motivo };
      await guardarTodo();
      throw new Error(`Investigación de ${lote.map((x) => x.tema).join(", ")}: ${motivo}; se reintenta`);
    }
    fallaIa = true;
    resultados = lote.map((x) => ({ ...x, estado: "no_confirmado" as const, datos: [], fuentes: [], motivo: `no se pudo investigar (${motivo})` }));
  }
  delete D.intento_inv;
  // Lo que pasó con el buscador en esta llamada: va con cada tema al reporte (y al log, desde claude()).
  const bq = res?.busqueda ?? { usadas: 0, consultas: [], errores: [] };
  const errores = [...new Set(bq.errores)];
  const problema = errores.length ? `el buscador dio error (${errores.join(", ")})` : res && !res.urls.length ? "el buscador no devolvió ninguna página" : bq.usadas >= maxUsos ? `se acabaron las búsquedas (${maxUsos})` : "";
  const finales: ResultadoInv[] = [];
  for (const r of resultados) {
    const k = normaliza(r.tema);
    const conBq: ResultadoInv = { ...r, busqueda: { consultas: bq.consultas.slice(0, 6), errores: errores.slice(0, 6), ...(segunda ? { segunda: true } : {}) } };
    const fallaEnMotivo = /error|fall[oóa]|inv[aá]lid|invalid|no (pude|se pudo|fue posible) (buscar|consultar)|sin b[uú]squedas|l[ií]mite de b[uú]squedas/i.test(String(r.motivo ?? ""));
    if (!segunda && !fallaIa && r.estado === "no_confirmado" && (problema || fallaEnMotivo)) {
      D.inv_segunda[k] = { motivo: problema || "el buscador falló", busqueda: conBq.busqueda };
      continue; // pendiente: la siguiente ejecución lo vuelve a buscar, él solo
    }
    finales.push(conBq);
  }
  if (segunda) D.inv_segunda[clave] = { ...previa, hecha: true };
  guardarInvestigacion(D, finales);
  await guardarTodo();
  return t.paso;
}

const hostDe = (url: string): string => { try { const u = new URL(url); return /^https?:$/.test(u.protocol) ? u.hostname.toLowerCase().replace(/^www\./, "") : ""; } catch { return ""; } };
const terminaEn = (host: string, d: string) => host === d || host.endsWith("." + d);
export const dominioPermitido = (host: string) => !!host && !/(^|\.)(wikipedia|wikimedia)\.org$/.test(host) && DOMINIOS_CONFIABLES.some((d) => terminaEn(host, d));
export const esOficial = (host: string) => DOMINIOS_OFICIALES.some((d) => terminaEn(host, d));
// El sitio de una página, para contar fuentes distintas: kids.britannica.com y britannica.com son el mismo sitio.
export function sitioDe(host: string): string {
  const p = String(host ?? "").split(".");
  const dos = p.slice(-2).join(".");
  return p.length >= 3 && /^(gob|org|com|edu|ac|co|net)\.[a-z]{2}$/.test(dos) ? p.slice(-3).join(".") : dos;
}
const normUrl = (url: string): string => { try { const u = new URL(url); return (u.hostname.replace(/^www\./, "") + u.pathname.replace(/\/+$/, "")).toLowerCase(); } catch { return ""; } };
// Fuentes que valen: url de un dominio confiable (nunca Wikipedia) que el buscador SÍ devolvió en esta llamada.
function fuentesValidas(lista: unknown, vistas: string[]): FuenteInv[] {
  const vistasN = new Set(vistas.map(normUrl).filter(Boolean));
  const out: FuenteInv[] = [];
  const ya = new Set<string>();
  for (const f of Array.isArray(lista) ? lista : []) {
    const url = String((f as any)?.url ?? "").trim();
    const host = hostDe(url); const n = normUrl(url);
    if (!host || !dominioPermitido(host) || !vistasN.has(n) || ya.has(n)) continue;
    ya.add(n);
    out.push({ nombre: String((f as any)?.nombre ?? "").replace(/\s+/g, " ").trim().slice(0, 90) || host, url, oficial: esOficial(host), sitio: sitioDe(host) });
  }
  return out;
}
// Regla de siempre: 1 fuente oficial o 2 confiables de sitios distintos.
export const confirmaDato = (fs: FuenteInv[]) => fs.some((f) => f.oficial) || new Set(fs.map((f) => f.sitio)).size >= 2;
// Las fuentes del verificador llegan como urls sueltas ("https://…") o como { nombre, url }.
export const listaDeFuentes = (x: unknown): { nombre: string; url: string }[] => (Array.isArray(x) ? x : []).map((f: any) => typeof f === "string" ? { nombre: "", url: f } : { nombre: String(f?.nombre ?? ""), url: String(f?.url ?? "") });

// El inventario que ve el reparador: COMPLETO, como antes (2026-11-11.6), pero lo investigado sin sus fuentes ni texto
// repetido («cita» = «texto»): en la prueba v52 eran 10 000 de sus 12 500 caracteres, casi todo urls.
export function inventarioParaReparar(D: any): Record<string, any[]> {
  const out: Record<string, any[]> = {};
  for (const [k, lista] of Object.entries((D?.inventario ?? {}) as Record<string, any[]>)) {
    if (!Array.isArray(lista) || !lista.length) continue;
    out[k] = k === "investigado" ? lista.map((e: any) => ({ id: e?.id, bloque: e?.bloque, tema: e?.tema, cita: e?.cita ?? e?.texto })) : lista;
  }
  return out;
}
function limpiarDato(x: unknown): string {
  const t = String(x ?? "").replace(/https?:\/\/\S+/g, "").replace(/\s+/g, " ").trim();
  const n = palabras(t);
  return n >= 3 && n <= 40 ? t : "";
}
function resumenFuentes(datos: { fuentes: FuenteInv[] }[]): { nombre: string; url: string }[] {
  const todas = datos.flatMap((d) => d.fuentes);
  const unicas = todas.filter((f, i) => todas.findIndex((g) => normUrl(g.url) === normUrl(f.url)) === i);
  return unicas.sort((a, b) => Number(!!b.oficial) - Number(!!a.oficial)).slice(0, 3).map((f) => ({ nombre: f.nombre, url: f.url }));
}
// Revisa por código la respuesta del Investigador: cada dato con fuentes que valen y que confirman; un tema queda
// "confirmado" con 2 datos o más. Si la IA dice "practica_examen" y el código no lo reconoce como tal, se trata como no
// confirmado (nota para repasar), para que ningún tema del temario desaparezca en silencio.
export function validarInvestigacion(j: any, pedidos: TemaInv[], vistas: string[]): ResultadoInv[] {
  const lista = Array.isArray(j?.temas) ? j.temas : [];
  return pedidos.map((p): ResultadoInv => {
    const base = { tema: p.tema, bloque: p.bloque, pagina: p.pagina };
    const no = (motivo: string): ResultadoInv => ({ ...base, estado: "no_confirmado", datos: [], fuentes: [], motivo });
    if (esPracticaDeExamen(p.tema)) return { ...base, estado: "practica_examen", datos: [], fuentes: [], motivo: "práctica o formato del examen: no es contenido" };
    const k = normaliza(p.tema);
    const r = lista.find((x: any) => normaliza(x?.tema) === k)
      ?? lista.find((x: any) => { const n = normaliza(x?.tema); return !!n && (n.includes(k) || k.includes(n)); })
      ?? (pedidos.length === 1 && lista.length === 1 ? lista[0] : null);
    if (!r) return no("la IA no respondió este tema");
    if (r.estado === "practica_examen") return no("la IA lo marcó como práctica del examen; queda para repasar en el libro");
    const datos: { texto: string; fuentes: FuenteInv[] }[] = [];
    for (const d of Array.isArray(r.datos) ? r.datos : []) {
      const texto = limpiarDato(d?.texto);
      const fuentes = fuentesValidas(d?.fuentes, vistas);
      if (!texto || !confirmaDato(fuentes)) continue;
      datos.push({ texto, fuentes });
      if (datos.length >= 6) break;
    }
    if (datos.length < 2) return no(String(r.motivo ?? "").replace(/\s+/g, " ").trim().slice(0, 200) || "sin 1 fuente oficial o 2 confiables que coincidan");
    return { ...base, estado: "confirmado", datos, fuentes: resumenFuentes(datos), motivo: "" };
  });
}

// Guarda los resultados: el reporte (datos.investigacion) y, de lo confirmado, elementos "investigado" del inventario
// (con su bloque y sus fuentes) cuyo texto vale como cita para la revisión de las actividades.
export function guardarInvestigacion(D: any, resultados: ResultadoInv[]): void {
  D.investigacion = Array.isArray(D.investigacion) ? D.investigacion : [];
  D.inventario = D.inventario ?? {};
  let inv: any[] = Array.isArray(D.inventario.investigado) ? D.inventario.investigado : [];
  D.citas = Array.isArray(D.citas) ? D.citas : [];
  let n = inv.reduce((m: number, x: any) => Math.max(m, Number(String(x?.id ?? "").slice(3)) || 0), 0);
  for (const r of resultados) {
    const k = normaliza(r.tema);
    D.investigacion = D.investigacion.filter((x: any) => normaliza(x?.tema) !== k);
    D.investigacion.push(r);
    inv = inv.filter((x) => normaliza(x?.tema) !== k);
    if (r.estado !== "confirmado") continue;
    for (const d of r.datos) {
      inv.push({ id: `inv${++n}`, bloque: r.bloque, tema: r.tema, texto: d.texto, cita: d.texto, fuentes: d.fuentes.map((f) => ({ nombre: f.nombre, url: f.url })) });
      D.citas.push(d.texto);
    }
  }
  D.inventario.investigado = inv;
}

// ¿Un título de pista habla de ese tema? (igual, uno contiene al otro, o comparten palabras largas)
export function seParece(a: string, b: string): boolean {
  const x = normaliza(a), y = normaliza(b);
  if (!x || !y) return false;
  if (x === y || x.includes(y) || y.includes(x)) return true;
  const wx = x.split(" ").filter((w) => w.length > 3), wy = new Set(y.split(" ").filter((w) => w.length > 3));
  const comunes = wx.filter((w) => wy.has(w)).length;
  return comunes >= 2 || (comunes >= 1 && Math.min(wx.length, wy.size) === 1);
}
const tituloCorto = (s: string) => String(s ?? "").split(/[:(–—]/)[0].trim().split(/\s+/).slice(0, 6).join(" ");
// Títulos de pistas que se piden al Generador: sin los de temas sin confirmar (se vuelven nota) y con una pista por
// tema confirmado, si el plan no la traía.
export function pistasParaPedido(pistas: unknown, confirmados: ResultadoInv[], sinConfirmar: ResultadoInv[]): string[] {
  const lista = (Array.isArray(pistas) ? pistas : []).map((x) => String(x ?? "").trim()).filter(Boolean);
  const quedan = lista.filter((p) => !(sinConfirmar.some((r) => seParece(p, r.tema)) && !confirmados.some((r) => seParece(p, r.tema))));
  for (const r of confirmados) if (!quedan.some((p) => seParece(p, r.tema))) quedan.push(tituloCorto(r.tema));
  return quedan;
}
export function notaDeTemas(confirmados: ResultadoInv[], sinConfirmar: ResultadoInv[], sinDatos: string[] = []): string {
  return [
    confirmados.length ? `TEMAS DEL TEMARIO COMPLETADOS CON FUENTES (sus datos vienen en "investigado"): ${confirmados.map((r) => `«${r.tema}»`).join(", ")}. Cada uno lleva su propia pista con "tema_investigado" y usa SOLO sus datos; las actividades con esos datos llevan fuente.tipo "investigado".` : "",
    sinConfirmar.length ? `TEMAS DEL TEMARIO SIN CONFIRMAR: ${sinConfirmar.map((r) => `«${r.tema}»`).join(", ")}. No escribas pistas ni actividades sobre ellos (la plataforma agrega una nota para repasarlos en el libro).` : "",
    sinDatos.length ? `PISTAS SIN DATOS (no vienen en los apuntes ni se confirmaron al investigar): ${sinDatos.map((p) => `«${p}»`).join(", ")}. No escribas pistas ni actividades sobre ellas (la plataforma agrega una nota para repasarlas en el libro).` : "",
  ].filter(Boolean).join("\n");
}
// Pistas del plan sin datos (11 nov 2026: la pista «Verbo» de la guía de prueba solo repetía la lista del temario). Se
// usa en un bloque sin contenido propio en los apuntes, con la investigación encendida: ahí una pista solo puede salir de
// datos confirmados. No tiene datos si ninguna de sus palabras clave aparece en los datos confirmados del bloque (las
// palabras se comparan por sus 5 primeras letras: «refrán» y «refranes» cuentan igual). Las pistas de temas sin
// confirmar ya se vuelven nota por su tema (pistasParaPedido) y no se repiten aquí.
const VACIAS = new Set(["para", "como", "este", "esta", "estos", "estas", "sobre", "entre", "cada", "todo", "todos", "toda", "todas", "tiene", "tienen", "segun", "cual", "cuales", "cuando", "donde", "desde", "hasta", "porque", "pero", "otra", "otro", "otros", "otras", "basico", "basicos", "basica", "basicas", "formas", "tipos", "partes", "ejemplos", "ejemplo", "definicion", "concepto", "conceptos", "caracteristicas", "clasificacion", "importancia", "repaso", "introduccion", "teoria", "practica"]);
export function palabrasClave(s: string): string[] {
  return [...new Set(normaliza(s).split(" ").filter((w) => w.length > 3 && !VACIAS.has(w)))];
}
const raiz5 = (w: string) => (w.length >= 5 ? w.slice(0, 5) : w);
export function pistasSinDatos(pistas: unknown, confirmados: ResultadoInv[], sinConfirmar: ResultadoInv[]): string[] {
  const lista = (Array.isArray(pistas) ? pistas : []).map((x) => String(x ?? "").trim()).filter(Boolean);
  const claves = new Set(confirmados.flatMap((r) => (r.datos ?? []).flatMap((d) => palabrasClave(d.texto).map(raiz5))));
  return lista.filter((p) => {
    if (sinConfirmar.some((r) => seParece(p, r.tema))) return false;
    if (!claves.size) return true;
    const ws = palabrasClave(p);
    return ws.length > 0 && !ws.some((w) => claves.has(raiz5(w)));
  });
}

// Marca «Completado con fuentes»: en la pista del tema (con sus fuentes) y en cada actividad cuyo dato salió de la
// investigación (el reproductor muestra la fuente en lugar de «De tus notas»). Se puede aplicar varias veces.
// El subtema (o los subtemas) de una pista: primero el que la IA anotó tal cual en tema_investigado; si no, entre los
// que se parecen, el que comparte más palabras que lo distinguen de los otros (sin «acento normativo», que comparten
// todos), mirando el título y las palabras clave de las ideas. Si quedan empatados, la pista lleva las fuentes de todos.
export function temasDePista(p: any, conf: ResultadoInv[]): ResultadoInv[] {
  const ti = String(p?.tema_investigado ?? "").trim();
  const exacto = ti ? conf.find((x) => normaliza(x.tema) === normaliza(ti)) : undefined;
  if (exacto) return [exacto];
  const titulo = String(p?.titulo ?? "").replace(/\s*\(\d+\)\s*$/, "");
  const candidatos = conf.filter((x) => (ti && seParece(ti, x.tema)) || seParece(titulo, x.tema));
  if (candidatos.length <= 1) return candidatos;
  const palabras = (s: string) => normaliza(s).split(" ").filter((w) => w.length > 3);
  const comunes = new Set(palabras(candidatos[0].tema).filter((w) => candidatos.every((x) => palabras(x.tema).includes(w))));
  const deLaPista = new Set([ti, titulo, ...(Array.isArray(p?.ideas) ? p.ideas : []).map((i: unknown) => String(i ?? "").split(":")[0])].flatMap(palabras));
  const puntos = candidatos.map((x) => new Set(palabras(x.tema).filter((w) => !comunes.has(w) && deLaPista.has(w))).size);
  const max = Math.max(...puntos);
  return max > 0 ? candidatos.filter((_, i) => puntos[i] === max) : candidatos;
}
export function marcarInvestigado(b: any, resultados: ResultadoInv[]): void {
  const conf = (resultados ?? []).filter((r) => r?.estado === "confirmado" && r.datos?.length);
  if (!b || !conf.length) return;
  // Las fuentes de SU subtema (11 nov 2026: la pista de esdrújulas mostraba las de agudas, porque los dos empiezan con
  // «Acento normativo:»). tema_investigado no se sobreescribe: así, al volver a marcar al armar, sale lo mismo.
  const marca = (rs: ResultadoInv[]) => {
    const vistas = new Set<string>();
    return { fuentes: rs.flatMap((r) => r.fuentes ?? []).filter((f) => f?.url && !vistas.has(f.url) && vistas.add(f.url)).slice(0, 3).map((f) => ({ nombre: f.nombre, url: f.url })) };
  };
  for (const p of b.pistas ?? []) {
    if (!p || p.nota_temario) continue;
    const rs = temasDePista(p, conf);
    if (rs.length) p.completado_con_fuentes = marca(rs);
  }
  // Cada actividad lleva la fuente de SU dato (la del tema, si la IA la marcó como investigada sin citar el dato).
  const textos = conf.flatMap((r) => r.datos.map((d) => ({ r, t: d.texto, nombre: d.fuentes?.[0]?.nombre ?? "" })));
  for (const a of [...(b.actividades ?? []), ...(b.mini_examen ?? []), ...(b.duelo ?? [])]) {
    if (!a || typeof a !== "object") continue;
    const cita = String(a.fuente?.cita ?? "");
    const hit = cita ? textos.find((x) => citaExiste(cita, [x.t])) : null;
    // Sin cita que coincida: el subtema de la pista de la actividad (y, si no hay, el primero del bloque).
    const pista = (b.pistas ?? []).find((p: any) => p?.id && p.id === a.pista);
    const r = hit?.r ?? (a.fuente?.tipo === "investigado" ? ((pista ? temasDePista(pista, conf)[0] : undefined) ?? conf[0]) : null);
    if (r) a.fuente = { ...(a.fuente ?? {}), tipo: "investigado", foto: 0, nombre: hit?.nombre || r.fuentes?.[0]?.nombre || "" };
  }
}

// Nota para los temas que no se pudieron confirmar: «Este tema venía en tu temario: repásalo en tu libro» (con la
// página, si el temario la da). La escribe el código, en el idioma de la guía; nunca lleva contenido.
const NOTA_TEMARIO: Record<string, { titulo: string; nota: string; pag: string; dos: string }> = {
  es: { titulo: "Repásalo en tu libro", nota: "este tema venía en tu temario; repásalo en tu libro", pag: "pág.", dos: ":" },
  en: { titulo: "Review it in your textbook", nota: "this topic was in your syllabus; review it in your textbook", pag: "p.", dos: ":" },
  fr: { titulo: "Révise-le dans ton manuel", nota: "ce thème était dans ton programme ; révise-le dans ton manuel", pag: "p.", dos: " :" },
};
export function textoNotaTemario(tm: { tema: string; pagina?: string }, idioma = "es"): string {
  const T = NOTA_TEMARIO[idioma] ?? NOTA_TEMARIO.es;
  const tema = String(tm.tema ?? "").replace(/:/g, " ").replace(/\s+/g, " ").trim().split(" ").slice(0, 8).join(" ");
  const pg = String(tm.pagina ?? "").replace(/\s+/g, " ").trim();
  const pag = !pg ? "" : /^\d+(\s*[-–]\s*\d+)?$/.test(pg) ? ` (${T.pag} ${pg})` : ` (${pg.split(" ").slice(0, 4).join(" ")})`;
  return `${tema}${T.dos} ${T.nota}${pag}.`;
}
export function agregarNotasTemario(b: any, temas: { tema: string; pagina?: string }[], idioma = "es"): void {
  if (!b) return;
  b.pistas = (b.pistas ?? []).filter((p: any) => !p?.nota_temario);
  const T = NOTA_TEMARIO[idioma] ?? NOTA_TEMARIO.es;
  for (let i = 0; i < (temas ?? []).length; i += 4) {
    b.pistas.push({ id: `${b.id}nt${i / 4 + 1}`, titulo: T.titulo, emoji: "📖", ideas: temas.slice(i, i + 4).map((x) => textoNotaTemario(x, idioma)), ejemplo: null, clave: null, dato_rapido: null, personajes: [], esquema: null, nota_temario: true });
  }
}

// «contradice_libro» y «revisar_dato» (una corrección sin una fuente que haya salido en la búsqueda) → un reporte por
// dato para la lista de Reportes del panel (con su bloque y su motivo; sin datos de la familia). Ninguno de los dos
// cambia la guía: Daniel decide. Máximo 10 por guía.
export function reportesDeVerificacion(verificacion: any[], bloques: any[]): string[] {
  const corto = (x: unknown, n: number) => { const s = String(x ?? "").replace(/\s+/g, " ").trim().replace(/[.\s]+$/, ""); return s.length > n ? s.slice(0, n - 1) + "…" : s; };
  const out: string[] = [];
  for (const r of Array.isArray(verificacion) ? verificacion : []) {
    const contradice = r?.estado === "contradice_libro";
    if (!contradice && r?.estado !== "revisar_dato") continue;
    const ids: string[] = Array.isArray(r.ids) && r.ids.length ? r.ids : idsDeVerificacion(bloques ?? [], r.actividad);
    const bi = (bloques ?? []).findIndex((b: any) => [...(b?.actividades ?? []), ...(b?.mini_examen ?? []), ...(b?.duelo ?? []), ...(b?.pistas ?? [])].some((x: any) => ids.includes(x?.id)));
    const b = bi >= 0 ? bloques[bi] : null;
    const fuentes = (Array.isArray(r.fuentes) ? r.fuentes : []).map((f: any) => typeof f === "string" ? f : f?.url).filter(Boolean).slice(0, 2);
    const segun = r.dato_correcto || r.mensaje_para_alumno;
    out.push(corto([
      contradice ? "🔎 REVISAR DATO: la verificación dice que contradice el libro." : "🔎 REVISAR DATO: la verificación cree que hay un error, pero no trajo una fuente que haya salido en su búsqueda; no se cambió nada en la guía.",
      b ? `Bloque ${bi + 1} «${corto(b.titulo, 60)}»${ids[0] ? ` (${ids[0]})` : ""}.` : ids[0] ? `Actividad ${ids[0]}.` : "",
      r.afirmacion ? `En la guía: «${corto(r.afirmacion, 220)}».` : "",
      segun ? `${contradice ? "Según las fuentes" : "La IA propone"}: ${corto(segun, 220)}.` : "",
      fuentes.length ? `${contradice ? "Fuentes" : "Fuentes que dio (no bastan para cambiar la guía)"}: ${fuentes.join(" · ")}` : "",
    ].filter(Boolean).join(" "), 900));
    if (out.length >= 10) break;
  }
  return out;
}
