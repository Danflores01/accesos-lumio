// La cadena de generación por pasos (Documento 1): extraer → unir → planear → generar por bloque → revisar →
// reparar → verificar → imágenes → armar. Cada ejecución hace UN paso y deja el siguiente listo.
import { jsonrepair } from "npm:jsonrepair@3";
import { EXTRACTOR, PLANIFICADOR, ESQUEMA_PLAN, GENERADOR, REPARADOR, VERIFICADOR, DOMINIOS_CONFIABLES, NIVEL_LECTURA, TIPOS_JUEGO } from "./prompts.ts";

export type Trabajo = { id: string; borrador_id: string | null; guia_id: string | null; alcance: string; paso: string; estado: string; progreso: Record<string, unknown>; datos: Record<string, unknown>; intentos: number; costo_usd: number; tokens_entrada: number; tokens_salida: number };
type Supa = ReturnType<typeof import("npm:@supabase/supabase-js@2").createClient>;
export type Fuente = { archivos: { ruta: string; nombre: string }[]; grado: string; materia: string; colegio?: string; idioma_alumno?: string; opciones?: Record<string, unknown> };

const MODELO_HAIKU = "claude-haiku-5-5";
const MODELO_SONNET = "claude-sonnet-5-5";
const MODELO_OPUS = "claude-opus-5-5";
const MODELOS: Record<string, string> = { haiku: MODELO_HAIKU, sonnet: MODELO_SONNET, opus: MODELO_OPUS };
// USD por millón de tokens con prompts de hasta 100K: [entrada, salida, lectura de caché]. Escribir en caché cuesta 1.25×
// la entrada.
const PRECIO: Record<string, [number, number, number]> = { [MODELO_HAIKU]: [0.10, 0.50, 0.01], [MODELO_SONNET]: [2, 10, 0.20], [MODELO_OPUS]: [4, 20, 0.20] };
// Modelo y esfuerzo de cada paso. El defecto es el comportamiento de siempre; se cambia con la tabla config
// (sparked_modelo_plan, sparked_esfuerzo_plan, …) o, para pruebas, por trabajo en datos.opciones.
const AJUSTES: Record<string, [string, string]> = { extraer: ["haiku", "medium"], plan: ["haiku", "low"], escribir: ["haiku", "low"], reparar: ["haiku", "low"], verificar: ["haiku", "medium"] };
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

export type Respuesta = { json: any; reparado: boolean; texto: string; parada: string | null; formato: boolean; ms: number; uso: { entrada: number; salida: number; costo: number } };

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
  const [pe, ps, pc] = PRECIO[modelo] ?? PRECIO[MODELO_HAIKU];
  const costo = ((u.input_tokens ?? 0) * pe + (u.cache_creation_input_tokens ?? 0) * pe * 1.25 + (u.cache_read_input_tokens ?? 0) * pc + salida * ps) / 1e6 + (u.server_tool_use?.web_search_requests ?? 0) * 0.01;
  const formato = !!(cuerpo.output_config as any)?.format;
  const parada = d.stop_reason ?? null;
  const { json, reparado } = leerJson(texto);
  // Una línea por llamada en los logs para medir tiempos y tokens de cada paso.
  console.log("IA", JSON.stringify({ etiqueta: opts.etiqueta ?? "", modelo, esfuerzo: (cuerpo.output_config as any)?.effort ?? null, ms, entrada, salida, parada, formato, reparado, json: !!json }));
  return { json, reparado, texto, parada, formato, ms, uso: { entrada, salida, costo } };
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
    D.metricas = [...(Array.isArray(D.metricas) ? D.metricas : []), { paso: etiqueta, modelo: a.nombre, esfuerzo: a.esfuerzo, entrada: r?.uso.entrada ?? 0, salida: r?.uso.salida ?? 0, costo_usd: r?.uso.costo ?? 0, ms: r?.ms ?? 0, parada: r?.parada ?? null, resultado, en: new Date().toISOString() }].slice(-80);
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
const contenidoPlan = (D: any, fuente: Fuente, variedad = "") => [{ type: "text", text: `Datos: grado ${fuente.grado} · nivel ${NIVEL_LECTURA(fuente.grado)} · idioma del alumno ${fuente.idioma_alumno ?? "es"} · fotos subidas ${fuente.archivos.length} · materia indicada ${fuente.materia} · tipo de material ${JSON.stringify(D.tipo_material)}.${variedad ? "\n" + variedad : ""}\n\nINVENTARIO:\n${JSON.stringify(D.inventario)}` }];
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
      const res = await llamar(supabase, t, fuente, "plan", "planear", { sistema: PLANIFICADOR, contenido: contenidoPlan(D, fuente, sugerenciaVariedad(semillaDe(t.borrador_id ?? t.id))), esquema: ESQUEMA_PLAN, maxTokens: cortado ? 24000 : 16000, previo: n === 1 && !cortado ? D.intento_ia?.previo : undefined });
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
    const recortesPlan = ajustarPlan(plan);
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
    const ids = new Set((pb.ids_inventario ?? []) as string[]);
    const invBloque: Record<string, any[]> = {};
    for (const [k, lista] of Object.entries(D.inventario as Record<string, any[]>)) { const sel = ids.size ? lista.filter((e) => ids.has(e.id)) : lista; if (sel.length) invBloque[k] = sel; }
    if (!Object.keys(invBloque).length) Object.assign(invBloque, D.inventario);
    const n = D.intento_ia?.paso === t.paso ? Number(D.intento_ia.n) || 0 : 0;
    const cortado = n > 0 && D.intento_ia?.motivo === "max_tokens";
    // Si la respuesta anterior se cortó por largo, se pide la mitad de los juegos (respuesta más corta).
    const pbPedido = cortado ? { ...pb, juegos: mitad(pb.juegos), mini_examen: Math.min(4, Number(pb.mini_examen) || 6) } : pb;
    const sistema = GENERADOR.replaceAll("{idioma_guia}", plan.idioma_guia ?? "es").replaceAll("{perfil_edad}", plan.perfil_edad ?? "juvenil");
    const contenido = [{ type: "text", text: `Datos: nivel ${nivel} · perfil ${plan.perfil_edad} · idioma de la guía ${plan.idioma_guia} · apoyo ${JSON.stringify(plan.apoyo)}\nPlan del bloque: ${JSON.stringify(pbPedido)}\nInventario del bloque: ${JSON.stringify(invBloque)}\nPuntos difíciles: ${JSON.stringify(plan.puntos_dificiles)}` }];
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
    const tipoDe = (a: any) => a.tipo ?? (Array.isArray(a.opciones) ? "opcion_multiple" : a.afirmacion !== undefined ? "verdadero_falso" : "completar");
    D.bloques[bi] = { id: pb.id ?? `b${bi + 1}`, titulo: pb.titulo, ...(cortado ? { reducido: true } : {}), ...(parcial ? { parcial: true } : {}), pistas: (b.pistas ?? []).map((p: any, k: number) => ({ ...p, id: p.id ?? `${pb.id ?? "b" + (bi + 1)}p${k + 1}` })), actividades: aplanar(b.actividades), mini_examen: (b.mini_examen ?? []).map((a: any, k: number) => ({ ...a, tipo: tipoDe(a), id: a.id ?? `${pb.id ?? "b" + (bi + 1)}me${k + 1}` })) };
    // Los juegos de clasificar quedan con dos grupos desde que se escriben (también en la vista previa).
    for (const a of D.bloques[bi].actividades) normalizarClasificar(a);
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
      const antes = b.actividades.length;
      b.actividades = b.actividades.filter((a: any) => revisarActividad(a, citas, nivel, huecos, b.id, descartes, idioma));
      b.mini_examen = b.mini_examen.filter((a: any) => revisarActividad(a, citas, nivel, huecos, b.id, descartes, idioma));
      if (b.actividades.length < Math.max(6, antes * 0.5)) huecos.push(`Bloque ${b.id}: quedaron ${b.actividades.length} actividades válidas de ${antes}; faltan ${Math.max(0, 10 - b.actividades.length)} de opción múltiple o verdadero/falso`);
      for (const pd of D.plan.puntos_dificiles ?? []) { const n = b.actividades.filter((a: any) => a.punto_dificil === pd.id).length; if (n > 0 && n < 3) huecos.push(`Punto difícil ${pd.id} '${pd.descripcion}' tiene ${n} actividad(es) en el bloque ${b.id}: faltan ${3 - n}`); }
    }
    D.huecos = huecos.slice(0, 8);
    // Cada actividad descartada queda anotada con su motivo (en datos.descartes, en datos.diagnostico y en el log).
    anotarDescartes(D, "revisar", descartes);
    // Pistas que no caben en una slide y exceso de slides: los arregla el paso reparar.
    const perfil = D.plan.perfil_edad ?? "juvenil";
    D.pistas_largas = (D.bloques as any[]).flatMap((b) => b.pistas.map((p: any) => ({ bloque: b.id, id: p.id, motivo: problemaDePista(p, perfil) })).filter((x: any) => x.motivo));
    const tope = topeDe(D.plan);
    const estimado = estimarSlides(D.bloques) + D.pistas_largas.length;
    D.slides = { ...(D.slides ?? {}), tope, generado: estimarSlides(D.bloques), exceso: Math.max(0, estimado - tope) };
    const arreglar = huecos.length > 0 || D.pistas_largas.length > 0 || estimado > tope;
    const sig = arreglar ? "reparar" : "verificar";
    await guardar(supabase, t, { datos: D, paso: sig, progreso: { pct: 72, mensaje: arreglar ? "Arreglando detallitos 🔧" : "Verificando los datos 🔎", paso: sig } });
    return sig;
  }

  if (t.paso === "reparar") {
    const plan = D.plan;
    const sistema = REPARADOR;
    const perfil = plan.perfil_edad ?? "juvenil";
    const largas = (D.pistas_largas ?? []) as { bloque: string; id: string; motivo: string }[];
    const pistaPorId = (id: string) => (D.bloques as any[]).flatMap((b) => b.pistas).find((p: any) => p.id === id);
    const textoLargas = largas.length ? `\nPistas demasiado largas (divídelas en dos):\n${largas.map((l) => `- ${l.id} (${l.motivo}): ${JSON.stringify(pistaPorId(l.id))}`).join("\n")}` : "";
    const contenido = [{ type: "text", text: `Idioma de la guía: ${plan.idioma_guia}. Nivel: ${nivel}. Perfil: ${plan.perfil_edad}.\nHuecos a reparar:\n${(D.huecos ?? []).map((h: string) => "- " + h).join("\n") || "(ninguno)"}${textoLargas}\nPistas de cada bloque (cada actividad nueva lleva en "pista" una de las del bloque de su hueco): ${JSON.stringify(Object.fromEntries((D.bloques as any[]).map((b) => [b.id, b.pistas.map((p: any) => p.id)])))}\nIds que ya existen: ${JSON.stringify((D.bloques as any[]).flatMap((b) => b.actividades.map((a: any) => a.id)))}\nInventario:\n${JSON.stringify(D.inventario)}\nPuntos difíciles: ${JSON.stringify(plan.puntos_dificiles)}` }];
    let divididas: any[] = [];
    if ((D.huecos ?? []).length || largas.length) try {
      const res = await llamar(supabase, t, fuente, "reparar", "reparar", { sistema, contenido, maxTokens: 16000 });
      if (res === REPETIR) return "reparar";
      const r = res;
      if (!r.json?.actividades_nuevas && !r.json?.pistas_divididas) await diagnosticar(supabase, t, "reparar", r);
      divididas = Array.isArray(r.json?.pistas_divididas) ? r.json.pistas_divididas : [];
      const nuevas = aplanar(r.json?.actividades_nuevas);
      const citas: string[] = D.citas ?? [];
      const descartesR: Descarte[] = [];
      const okNuevas = nuevas.filter((a: any) => revisarActividad(a, citas, nivel, [], "reparar", descartesR, plan.idioma_guia ?? "es"));
      anotarDescartes(D, "reparar", descartesR);
      // Cada actividad nueva va al bloque de su hueco (por su pista o por el id del bloque en su id); si no se sabe, al
      // bloque con huecos que tenga menos actividades. Nunca al primero por defecto.
      const colocadas: string[] = [];
      for (const a of okNuevas) { const b = bloqueDeNueva(D.bloques, a, D.huecos ?? []); b.actividades.push(a); colocadas.push(`${a.id}→${b.id}`); }
      D.reparadas = colocadas;
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
    // Tope de slides: si la guía se pasa, se fusiona y luego se recorta (ver recortarBloques).
    const recortes = recortarBloques(D.bloques, topeDe(plan), perfil);
    D.slides = { ...(D.slides ?? {}), pistas_divididas: notas, recortes, tras_reparar: estimarSlides(D.bloques) };
    await guardar(supabase, t, { datos: D, paso: "verificar", progreso: { pct: 78, mensaje: "Verificando los datos 🔎", paso: "verificar" }, costo_usd: t.costo_usd, tokens_entrada: t.tokens_entrada, tokens_salida: t.tokens_salida });
    return "verificar";
  }

  if (t.paso === "verificar") {
    const plan = D.plan; const tipos = (D.fotos ?? []).map((f: any) => f.tipo);
    const hayApuntes = tipos.some((x: string) => x && x !== "libro_impreso");
    const reporte: any[] = [];
    try {
      const bloquesResumen = (D.bloques as any[]).map((b) => ({ id: b.id, pistas: b.pistas.map((p: any) => ({ id: p.id, titulo: p.titulo, ideas: p.ideas })), actividades: [...b.actividades, ...b.mini_examen].map((a: any) => ({ id: a.id, tipo: a.tipo, pregunta: a.pregunta ?? a.afirmacion ?? a.enunciado ?? a.texto ?? a.instruccion, respuesta: a.opciones ? a.opciones[a.correcta] : a.respuesta ?? (a.es_verdadera !== undefined ? String(a.es_verdadera) : undefined), pares: a.pares, pasos: a.pasos?.map((p: any) => p.texto), grupos: a.grupos, elementos: a.elementos })) }));
      const sospechas = Object.values(D.inventario as Record<string, any[]>).flat().filter((e: any) => e?.motivo);
      const contenido = [{ type: "text", text: `Idioma: ${plan.idioma_guia}. Materia: ${plan.materia}. Grado: ${fuente.grado}. Tipos de foto: ${JSON.stringify(tipos)}. ${hayApuntes ? "Hay apuntes a mano o pizarrón: verifica las afirmaciones clave." : "Es libro impreso: verifica solo lo dudoso."}\nSospechas del extractor: ${JSON.stringify(sospechas)}\n\nCONTENIDO A VERIFICAR:\n${JSON.stringify(bloquesResumen)}` }];
      const res = await llamar(supabase, t, fuente, "verificar", "verificar", { sistema: VERIFICADOR, contenido, maxTokens: 16000, herramientas: [{ type: "web_search_20260209", name: "web_search", max_uses: hayApuntes ? 10 : 4, allowed_domains: DOMINIOS_CONFIABLES }] });
      if (res === REPETIR) return "verificar";
      const r = res;
      if (!Array.isArray(r.json?.resultados)) await diagnosticar(supabase, t, "verificar", r);
      for (const res of r.json?.resultados ?? []) {
        reporte.push(res);
        // El id puede venir con texto después ("b1om3 (pregunta…)"): se toma solo el id.
        const id = String(res.actividad ?? "").trim().split(/[\s,(]/)[0];
        const quitar = (b: any) => { b.actividades = b.actividades.filter((a: any) => a.id !== id); b.mini_examen = b.mini_examen.filter((a: any) => a.id !== id); };
        if (res.estado === "no_confirmada") for (const b of D.bloques as any[]) quitar(b);
        if (res.estado === "corregida") {
          // Antes se revisaba bloque por bloque y, si el id no era de ese bloque, la corrección caía en su primera
          // pista: el alumno la veía una vez por bloque. Ahora va una sola vez, en el lugar que le corresponde.
          const lugar = pistaDeCorreccion(D.bloques as any[], id, res);
          if (lugar) {
            const c = { dato_apuntes: res.decia_la_foto, dato_correcto: res.dato_correcto, mensaje: res.mensaje_para_alumno, fuentes: res.fuentes ?? [] };
            lugar.pista.correcciones = lugar.pista.correcciones ?? [];
            if (!lugar.pista.correcciones.some((x: any) => normaliza(x.dato_correcto) === normaliza(c.dato_correcto))) lugar.pista.correcciones.push(c);
            // la actividad con el dato equivocado se quita: la pista ya enseña el dato correcto
            if (lugar.act) quitar(lugar.b);
          }
        }
      }
    } catch (e) { if ((e as any)?.reintentar) throw e; console.warn("Verificación falló, se marca para revisión:", (e as Error).message); reporte.push({ estado: "error", detalle: (e as Error).message }); }
    D.verificacion = reporte;
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
    const plan = D.plan; const bloques = D.bloques as any[];
    const cartucho: any = { version_formato: "1.2", plan: { ...plan, identidad: { ...plan.identidad } }, bloques: bloques.filter(Boolean), calentamiento: [], reto_final: [] };
    delete cartucho.plan.bloques; delete cartucho.plan.inventario_no_usado;
    cartucho.plan.bloques_plan = plan.bloques;
    const faciles = (b: any) => b.actividades.filter((a: any) => a.tipo === "opcion_multiple" && a.dificultad !== "retadora");
    cartucho.calentamiento = cartucho.bloques.slice(0, 2).flatMap((b: any) => faciles(b).slice(0, 3).map((a: any) => a.id)).slice(0, 6);
    const pdIds = new Set((plan.puntos_dificiles ?? []).map((p: any) => p.id));
    const candidatos = cartucho.bloques.flatMap((b: any) => b.actividades.filter((a: any) => ["opcion_multiple", "verdadero_falso", "completar"].includes(a.tipo)));
    const conPeso = candidatos.sort((a: any, b: any) => Number(pdIds.has(b.punto_dificil)) - Number(pdIds.has(a.punto_dificil)));
    cartucho.reto_final = conPeso.slice(0, Math.min(20, Math.max(8, plan.reto_final ?? 16))).map((a: any) => a.id);
    // Orden variado de los juegos: cada bloque lleva "orden" (tipos en el orden en que se juegan, después de sus pistas)
    // y sus actividades vienen ya en ese orden; "primera_actividad" dice qué va justo después del tutorial.
    for (const b of cartucho.bloques) {
      const pb = (plan.bloques ?? []).find((x: any) => x.id === b.id) ?? {};
      const hay = [...new Set(b.actividades.map((a: any) => juegoDe(a.tipo)))] as string[];
      if (b.mini_examen?.length) hay.push("mini_examen");
      b.orden = [...new Set([...(pb.orden_actividades ?? []).filter((x: string) => hay.includes(x)), ...hay])];
      const pos = (a: any) => b.orden.indexOf(juegoDe(a.tipo));
      b.actividades = b.actividades.map((a: any, i: number) => [a, i]).sort((x: any, y: any) => pos(x[0]) - pos(y[0]) || x[1] - y[1]).map((x: any) => x[0]);
    }
    const primera = plan.primera_actividad ?? "calentamiento";
    cartucho.primera_actividad = primera === "calentamiento" || cartucho.bloques[0]?.orden?.[0] === primera ? primera : "calentamiento";
    cartucho.slides_estimados = estimarSlides(cartucho.bloques);
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
  return (hay("opcion_multiple", "completar") ? 1 : 0) + (hay("verdadero_falso") ? 1 : 0) + (hay("duelo") ? 1 : 0) + acts.filter((a) => POR_PIEZA.includes(a?.tipo)).length + ((b?.mini_examen?.length ?? 0) > 0 ? 1 : 0);
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
  return `Semilla de variedad ${semilla % 1000}. Sugerencia de primera actividad: "${a}" (si el contenido no lo permite: "${b}").`;
}

// El plan de la IA se ajusta por código: juegos de una pieza a 1 por bloque, orden de actividades completo y variado,
// primera actividad válida y, si se pasa del tope, se recorta (primero juegos prescindibles, luego pistas de más).
export function ajustarPlan(plan: any): string[] {
  const notas: string[] = [];
  const tope = topeDe(plan);
  for (const pb of plan.bloques) {
    pb.pistas = (Array.isArray(pb.pistas) ? pb.pistas : []).map((x: unknown) => String(x ?? "").trim()).filter(Boolean).slice(0, 4);
    if (!pb.pistas.length) pb.pistas = (Array.isArray(pb.temas) && pb.temas.length ? pb.temas : [pb.titulo]).slice(0, 2).map(String);
    pb.juegos = Object.fromEntries(TIPOS_JUEGO.map((k) => [k, ent(pb.juegos?.[k])]));
    for (const k of POR_PIEZA) if (k !== "conceptos" && pb.juegos[k] > 1) pb.juegos[k] = 1;
    pb.mini_examen = ent(pb.mini_examen);
  }
  const quitar = (pb: any, k: string) => { pb.juegos[k] = 0; if (k === "opcion_multiple") pb.juegos.completar = 0; if (k === "mini_examen") pb.mini_examen = 0; };
  let guarda = 60;
  while (estimarSlidesPlan(plan) > tope && guarda-- > 0) {
    const orden = [...plan.bloques].sort((x: any, y: any) => (y.pistas.length + juegosDelPlan(y).length) - (x.pistas.length + juegosDelPlan(x).length));
    let hecho = false;
    for (const pb of orden) {
      if (pb.pistas.length > 3) { notas.push(`${pb.id}: sin la pista "${pb.pistas.pop()}"`); hecho = true; break; }
      const js = juegosDelPlan(pb);
      if (js.includes("duelo") && js.includes("mini_examen") && js.length > 2) { quitar(pb, "mini_examen"); notas.push(`${pb.id}: sin mini-examen (cierra con duelo)`); hecho = true; break; }
      const k = js.length > 2 ? PRESCINDIBLES.find((x) => js.includes(x)) : undefined;
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
  // Orden de los juegos de cada bloque: solo los que lleva, sin repetir, y los que falten al final.
  for (const pb of plan.bloques) {
    const js = juegosDelPlan(pb);
    const pedido = (Array.isArray(pb.orden_actividades) ? pb.orden_actividades : []).map((x: unknown) => juegoDe(String(x)));
    pb.orden_actividades = [...new Set([...pedido.filter((x: string) => js.includes(x)), ...js])];
  }
  // Si todos los bloques traen la misma secuencia, se rota (el cierre con mini-examen o duelo se queda al final).
  const firmas = new Set(plan.bloques.map((pb: any) => pb.orden_actividades.join(",")));
  if (plan.bloques.length > 1 && firmas.size === 1) {
    plan.bloques.forEach((pb: any, i: number) => {
      const cierre = pb.orden_actividades.filter((x: string) => x === "mini_examen");
      const resto = pb.orden_actividades.filter((x: string) => x !== "mini_examen");
      const r = resto.length ? i % resto.length : 0;
      pb.orden_actividades = [...resto.slice(r), ...resto.slice(0, r), ...cierre];
    });
    notas.push("secuencias de juegos rotadas para que no se repitan");
  }
  // Primera actividad: "calentamiento" o un juego del bloque 1, que entonces va primero en ese bloque.
  const b1 = plan.bloques[0];
  const primera = juegoDe(String(plan.primera_actividad ?? ""));
  if (b1 && primera !== "calentamiento" && b1.orden_actividades.includes(primera)) b1.orden_actividades = [primera, ...b1.orden_actividades.filter((x: string) => x !== primera)];
  else plan.primera_actividad = "calentamiento";
  plan.presupuesto_slides = tope;
  plan.slides_estimados = estimarSlidesPlan(plan);
  return notas;
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
export function recortarBloques(bloques: any[], tope: number, perfil = "juvenil"): string[] {
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
        const junta = { ...p, ideas: [...(p.ideas ?? []), ...(q.ideas ?? [])], esquema: p.esquema ?? q.esquema ?? null, ejemplo: p.ejemplo ?? q.ejemplo ?? null, clave: p.clave ?? q.clave ?? null, dato_rapido: p.dato_rapido ?? q.dato_rapido ?? null, personajes: [...new Set([...(p.personajes ?? []), ...(q.personajes ?? [])])] };
        if (problemaDePista(junta, perfil)) continue;
        b.pistas.splice(i, 2, junta);
        for (const a of [...b.actividades, ...b.mini_examen]) if (a.pista === q.id) a.pista = p.id;
        notas.push(`${b.id}: pistas "${p.titulo}" y "${q.titulo}" fusionadas`); hecho = true; break;
      }
      if (hecho) break;
      // 4) Mini-examen si el bloque ya cierra con duelo; luego juegos prescindibles.
      if (juegosDelBloque(b) > 2 && b.mini_examen.length && b.actividades.some((a: any) => a.tipo === "duelo")) { b.mini_examen = []; notas.push(`${b.id}: sin mini-examen (cierra con duelo)`); hecho = true; break; }
      const k = juegosDelBloque(b) > 2 ? PRESCINDIBLES.find((t) => b.actividades.some((a: any) => a.tipo === t)) : undefined;
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
  const conHueco = bloques.filter((b) => huecos.some((h) => new RegExp(`\\b${b.id}\\b`).test(h)));
  const lista = conHueco.length ? conHueco : bloques;
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
const mitad = (juegos: Record<string, unknown> | undefined) => Object.fromEntries(Object.entries(juegos ?? {}).map(([k, v]) => [k, Math.ceil((Number(v) || 0) / 2)]));
// Un plan sirve si trae al menos un bloque con título.
function planDe(j: any): any {
  const p = Array.isArray(j?.bloques) ? j : Array.isArray(j?.plan?.bloques) ? j.plan : null;
  const bloques = (p?.bloques ?? []).filter((b: any) => b && typeof b === "object" && typeof b.titulo === "string" && b.titulo.trim());
  return bloques.length ? { ...p, bloques, identidad: { ...(p.identidad ?? {}) } } : null;
}
function perfilDe(grado: string): string {
  const g = String(grado ?? "").toLowerCase(); const n = Number((g.match(/\d/) ?? ["0"])[0]);
  if (g.includes("primaria")) return n <= 3 ? "infantil" : "caricatura";
  if (g.includes("secundaria")) return n <= 1 ? "caricatura" : "juvenil";
  return "sobrio";
}
function paletaDe(materia: string): string {
  const m = String(materia ?? "").toLowerCase().normalize("NFD").replace(/[^a-z ]/g, "");
  const reglas: [RegExp, string][] = [[/histor/, "historia_azul"], [/espanol|lengua|literatura|lectura/, "espanol_rojo"], [/mate|algebra|geometr|calculo/, "mate_naranja"], [/cienc|quimic|fisic|biolog/, "ciencias_verde"], [/frances|french/, "frances_cielo"], [/civic|etica/, "civica_morado"], [/ingles|english/, "ingles_mostaza"], [/geograf/, "geo_turquesa"]];
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
  let elementos = a.elementos.filter((e: any) => e && typeof e === "object").map((e: any) => ({ ...e, grupo: indice(e.grupo) })).filter((e: any) => e.grupo >= 0 && e.grupo < a.grupos.length);
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
    if (!a.retro_incorrecta || !a.retro_correcta) { huecos.push(`Actividad ${a.id} sin retroalimentación`); return fuera("sin retroalimentación"); }
    if (a.tipo === "opcion_multiple" || a.tipo === "duelo") {
      if (!Array.isArray(a.opciones) || a.opciones.length !== 4) return fuera(`${Array.isArray(a.opciones) ? a.opciones.length : 0} opciones (deben ser 4)`);
      if (!(a.correcta >= 0 && a.correcta < 4)) return fuera(`respuesta correcta ilegible (${JSON.stringify(a.correcta)})`);
      if (new Set(a.opciones.map((o: string) => normaliza(o))).size < 4) return fuera("opciones repetidas");
    }
    if (a.tipo === "completar" && (!a.respuesta || !Array.isArray(a.distractores) || a.distractores.length < 2)) return fuera(!a.respuesta ? "completar sin respuesta" : "completar con menos de 2 distractores");
    if (a.tipo === "verdadero_falso" && typeof a.es_verdadera !== "boolean") return fuera(`verdadero o falso ilegible (${JSON.stringify(a.es_verdadera)})`);
  }
  if (a.tipo === "super_dato") { const huecosSD = (String(a.texto ?? "").match(/\[\[(.+?)\]\]/g) ?? []).length; if (huecosSD < 3) return fuera(`súper dato con ${huecosSD} huecos (mín. 3)`); if (!Array.isArray(a.distractores)) return fuera("súper dato sin distractores"); }
  if (a.tipo === "conceptos" || a.tipo === "quien_es_quien") { if (!Array.isArray(a.pares)) return fuera("sin parejas"); a.pares = a.pares.filter((p: any) => p?.termino && p?.definicion); if (a.pares.length < 3) return fuera(`${a.pares.length} parejas completas (mín. 3)`); }
  if (a.tipo === "ordenar") { if (!Array.isArray(a.pasos) || a.pasos.length < 3) return fuera(`${Array.isArray(a.pasos) ? a.pasos.length : 0} pasos (mín. 3)`); a.pasos = a.pasos.map((p: any) => typeof p === "string" ? { texto: p, emoji: "" } : p); }
  if (a.tipo === "clasificar") { if (!Array.isArray(a.grupos) || a.grupos.length < 2 || !Array.isArray(a.elementos) || a.elementos.length < 4) return fuera("clasificar con menos de 2 grupos o 4 tarjetas"); normalizarClasificar(a); a.elementos = a.elementos.filter((e: any) => e && (e.grupo === 0 || e.grupo === 1)); if (a.elementos.length < 4 || !a.elementos.some((e: any) => e.grupo === 0) || !a.elementos.some((e: any) => e.grupo === 1)) return fuera("clasificar con un grupo vacío o menos de 4 tarjetas"); }
  // cita respaldada
  const cita = a.fuente?.cita;
  if (cita && citas.length && !citaExiste(cita, citas) && a.fuente?.tipo !== "practica") { huecos.push(`Actividad ${a.id} del bloque ${bloque}: su cita no aparece en las fotos`); return fuera(`cita que no aparece en las fotos ("${String(cita).slice(0, 60)}")`); }
  return true;
}

// Fotografía de un personaje: Wikipedia solo para la imagen, nunca para datos.
async function imagenWikipedia(nombre: string, idioma: string): Promise<{ url: string; pie: string; credito: string } | null> {
  for (const lang of [idioma, "es", "en"].filter((v, i, a) => a.indexOf(v) === i)) {
    try {
      const r = await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(nombre.replace(/ /g, "_"))}`, { headers: { accept: "application/json", "user-agent": "SparkEd/1.0 (guias de estudio)" } });
      if (!r.ok) continue;
      const d = await r.json();
      if (d.type === "disambiguation") continue;
      const url = d.thumbnail?.source ?? d.originalimage?.source;
      if (!url) continue;
      return { url: url.replace(/\/\d+px-/, "/400px-"), pie: d.title ?? nombre, credito: "Wikimedia Commons" };
    } catch { /* siguiente idioma */ }
  }
  return null;
}

// Vista previa: portada, primera pista y un juego del bloque 1 (lo demás se bloquea).
export function recortarVistaPrevia(c: any): any {
  const bloques = (c.bloques ?? []).filter(Boolean);
  const b0 = bloques[0];
  const planeados = Array.isArray(c.plan?.bloques_plan) ? c.plan.bloques_plan : [];
  const hechas = bloques.reduce((n: number, b: any) => n + (b.actividades?.length ?? 0) + (b.mini_examen?.length ?? 0), 0);
  // Si solo existe el bloque 1 (vista previa), los totales se estiman con el plan.
  const estimadas = planeados.reduce((n: number, pb: any) => n + Object.values(pb.juegos ?? {}).reduce((s: number, x: any) => s + (Number(x) || 0), 0) + (Number(pb.mini_examen) || 0), 0);
  const v: any = { version_formato: c.version_formato, plan: { ...c.plan }, bloques: [], calentamiento: [], reto_final: [], vista_previa: true, bloques_totales: Math.max(planeados.length, bloques.length), actividades_totales: Math.max(hechas, estimadas) };
  delete v.plan.bloques_plan;
  if (b0) v.bloques.push({ id: b0.id, titulo: b0.titulo, pistas: (b0.pistas ?? []).slice(0, 3), actividades: (b0.actividades ?? []).filter((a: any) => a.tipo === "opcion_multiple" || a.tipo === "completar").slice(0, 6), mini_examen: [] });
  return v;
}
