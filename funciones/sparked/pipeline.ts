// La cadena de generación por pasos (Documento 1): extraer → unir → planear → generar por bloque → revisar →
// reparar → verificar → imágenes → armar. Cada ejecución hace UN paso y deja el siguiente listo.
import { EXTRACTOR, PLANIFICADOR, GENERADOR, REPARADOR, VERIFICADOR, DOMINIOS_CONFIABLES, NIVEL_LECTURA } from "./prompts.ts";

export type Trabajo = { id: string; borrador_id: string | null; guia_id: string | null; alcance: string; paso: string; estado: string; progreso: Record<string, unknown>; datos: Record<string, unknown>; intentos: number; costo_usd: number; tokens_entrada: number; tokens_salida: number };
type Supa = ReturnType<typeof import("npm:@supabase/supabase-js@2").createClient>;

const MODELO_HAIKU = "claude-haiku-5-5";
const MODELO_SONNET = "claude-sonnet-5-5";
const PRECIO: Record<string, [number, number]> = { [MODELO_HAIKU]: [0.10, 0.50], [MODELO_SONNET]: [2, 10] }; // USD por millón, hasta 100K tokens
const FOTOS_POR_LOTE = 3; // pocas fotos por llamada para que cada paso termine en menos de 2 minutos

// ---------- Llamada al API de Claude (fetch directo, sin SDK) ----------
export async function claude(opts: { modelo?: string; sistema: string; contenido: unknown[]; esquema?: unknown; maxTokens?: number; herramientas?: unknown[]; esfuerzo?: string }): Promise<{ json: any; texto: string; parada: string | null; uso: { entrada: number; salida: number; costo: number } }> {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) throw new Error("Falta configurar ANTHROPIC_API_KEY en los secretos de Supabase");
  const modelo = opts.modelo ?? MODELO_HAIKU;
  const cuerpo: Record<string, unknown> = {
    model: modelo, max_tokens: opts.maxTokens ?? 12000,
    system: [{ type: "text", text: opts.sistema, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: opts.contenido }],
    output_config: { effort: opts.esfuerzo ?? "medium", ...(opts.esquema ? { format: { type: "json_schema", schema: opts.esquema } } : {}) },
  };
  if (opts.herramientas?.length) cuerpo.tools = opts.herramientas;
  const helicone = Deno.env.get("HELICONE_API_KEY");
  const url = helicone ? "https://anthropic.helicone.ai/v1/messages" : "https://api.anthropic.com/v1/messages";
  const cab: Record<string, string> = { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2026-10-21" };
  if (helicone) cab["Helicone-Auth"] = `Bearer ${helicone}`;
  // Cada paso debe caber en una ejecución de la función (tope de 150 s): si Claude tarda más, se corta y se reintenta.
  const pedir = () => fetch(url, { method: "POST", headers: cab, body: JSON.stringify(cuerpo), signal: AbortSignal.timeout(125_000) });
  let r = await pedir();
  if (r.status === 400) {
    // Si el API rechaza output_config (formato o esfuerzo), se pide JSON libre y se valida aquí.
    const err = await r.text();
    console.warn("Petición rechazada, reintento sin output_config:", err.slice(0, 300));
    delete cuerpo.output_config;
    r = await pedir();
  }
  if (!r.ok) throw new Error(`Claude ${r.status}: ${(await r.text()).slice(0, 400)}`);
  const d = await r.json();
  const texto = (d.content ?? []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n");
  const entrada = (d.usage?.input_tokens ?? 0) + (d.usage?.cache_creation_input_tokens ?? 0) + (d.usage?.cache_read_input_tokens ?? 0) * 0.1;
  const salida = d.usage?.output_tokens ?? 0;
  const [pe, ps] = PRECIO[modelo] ?? PRECIO[MODELO_HAIKU];
  const costo = (entrada * pe + salida * ps) / 1e6 + (d.usage?.server_tool_use?.web_search_requests ?? 0) * 0.01;
  return { json: extraerJson(texto), texto, parada: d.stop_reason ?? null, uso: { entrada: Math.round(entrada), salida, costo } };
}

export function extraerJson(texto: string): any {
  if (!texto) return null;
  const candidatos = [texto];
  const m = texto.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m) candidatos.push(m[1]);
  const a = texto.indexOf("{"), b = texto.lastIndexOf("}");
  if (a >= 0 && b > a) candidatos.push(texto.slice(a, b + 1));
  for (const c of candidatos) {
    try { return JSON.parse(c); } catch { /* sigue */ }
    // Reparación común: comas sobrantes antes de } o ].
    try { return JSON.parse(c.replace(/,\s*([}\]])/g, "$1")); } catch { /* sigue */ }
  }
  return null;
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
export async function ejecutarPaso(supabase: Supa, t: Trabajo, fuente: { archivos: { ruta: string; nombre: string }[]; grado: string; materia: string; colegio?: string; idioma_alumno?: string }): Promise<string | null> {
  const D = t.datos as any;
  const nivel = NIVEL_LECTURA(fuente.grado);
  const total = fuente.archivos.length;
  const lotes = Math.ceil(total / FOTOS_POR_LOTE);
  const progreso = async (pct: number, mensaje: string, paso?: string) => guardar(supabase, t, { progreso: { pct, mensaje, paso: paso ?? t.paso }, ...(paso ? { paso } : {}) });

  if (t.paso === "inicio") { await progreso(2, "Leyendo tus fotos 📖", "extraer:0"); return "extraer:0"; }

  if (t.paso.startsWith("extraer:")) {
    const i = Number(t.paso.split(":")[1]);
    const archivos = fuente.archivos.slice(i * FOTOS_POR_LOTE, (i + 1) * FOTOS_POR_LOTE);
    const contenido: unknown[] = [{ type: "text", text: `Datos: grado ${fuente.grado} · nivel ${nivel} · materia indicada ${fuente.materia} · fotos ${i * FOTOS_POR_LOTE + 1}–${i * FOTOS_POR_LOTE + archivos.length} de ${total}. Numera las fotos desde ${i * FOTOS_POR_LOTE + 1}.` }];
    for (const a of archivos) contenido.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: await base64De(supabase, a.ruta) } });
    const r = await claude({ sistema: EXTRACTOR, contenido, maxTokens: 9000 });
    sumar(t, r.uso);
    if (!r.json || !r.json.inventario) throw new Error("El extractor no devolvió inventario");
    D.inventarios = D.inventarios ?? []; D.inventarios[i] = r.json;
    const sig = i + 1 < lotes ? `extraer:${i + 1}` : "unir";
    await guardar(supabase, t, { datos: D, progreso: { pct: 5 + Math.round(25 * (i + 1) / lotes), mensaje: `Leyendo tus fotos 📖 (${Math.min(total, (i + 1) * FOTOS_POR_LOTE)} de ${total})`, paso: sig }, paso: sig, costo_usd: t.costo_usd, tokens_entrada: t.tokens_entrada, tokens_salida: t.tokens_salida });
    return sig;
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
    const contenido = [{ type: "text", text: `Datos: grado ${fuente.grado} · nivel ${nivel} · idioma del alumno ${fuente.idioma_alumno ?? "es"} · fotos subidas ${total} · materia indicada ${fuente.materia} · tipo de material ${JSON.stringify(D.tipo_material)}.\n\nINVENTARIO:\n${JSON.stringify(D.inventario)}` }];
    const r = await claude({ sistema: PLANIFICADOR, contenido, maxTokens: 16000 });
    sumar(t, r.uso);
    const plan = r.json?.bloques?.length ? r.json : r.json?.plan?.bloques?.length ? r.json.plan : null;
    if (!plan) {
      // Se guarda qué contestó la IA para poder diagnosticar sin repetir la llamada.
      const txt = r.texto ?? "";
      console.error("Planificador sin bloques", JSON.stringify({ parada: r.parada, largo: txt.length, inicio: txt.slice(0, 300), fin: txt.slice(-300) }));
      D.diagnostico_plan = { parada: r.parada, largo: txt.length, inicio: txt.slice(0, 600), fin: txt.slice(-600), en: new Date().toISOString() };
      await guardar(supabase, t, { datos: D, costo_usd: t.costo_usd, tokens_entrada: t.tokens_entrada, tokens_salida: t.tokens_salida });
      throw new Error(`El planificador no devolvió bloques (${r.parada ?? "sin motivo"}, ${txt.length} caracteres)`);
    }
    D.plan = plan;
    D.plan.grado = fuente.grado; D.plan.presupuesto_slides = Math.min(40, D.plan.presupuesto_slides ?? 25);
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
    const sistema = GENERADOR.replaceAll("{idioma_guia}", plan.idioma_guia ?? "es").replaceAll("{perfil_edad}", plan.perfil_edad ?? "juvenil");
    const contenido = [{ type: "text", text: `Datos: nivel ${nivel} · perfil ${plan.perfil_edad} · idioma de la guía ${plan.idioma_guia} · apoyo ${JSON.stringify(plan.apoyo)}\nPlan del bloque: ${JSON.stringify(pb)}\nInventario del bloque: ${JSON.stringify(invBloque)}\nPuntos difíciles: ${JSON.stringify(plan.puntos_dificiles)}` }];
    const r = await claude({ sistema, contenido, maxTokens: 11000 });
    sumar(t, r.uso);
    if (!r.json?.pistas) throw new Error(`El generador no devolvió el bloque ${bi + 1}`);
    const b = r.json;
    const tipoDe = (a: any) => a.tipo ?? (Array.isArray(a.opciones) ? "opcion_multiple" : a.afirmacion !== undefined ? "verdadero_falso" : "completar");
    D.bloques[bi] = { id: pb.id ?? `b${bi + 1}`, titulo: pb.titulo, pistas: (b.pistas ?? []).map((p: any, k: number) => ({ ...p, id: p.id ?? `${pb.id ?? "b" + (bi + 1)}p${k + 1}` })), actividades: aplanar(b.actividades), mini_examen: (b.mini_examen ?? []).map((a: any, k: number) => ({ ...a, tipo: tipoDe(a), id: a.id ?? `${pb.id ?? "b" + (bi + 1)}me${k + 1}` })) };
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
    for (const b of D.bloques as any[]) {
      const antes = b.actividades.length;
      b.actividades = b.actividades.filter((a: any) => revisarActividad(a, citas, nivel, huecos, b.id));
      b.mini_examen = b.mini_examen.filter((a: any) => revisarActividad(a, citas, nivel, huecos, b.id));
      if (b.actividades.length < Math.max(6, antes * 0.5)) huecos.push(`Bloque ${b.id}: quedaron ${b.actividades.length} actividades válidas de ${antes}; faltan ${Math.max(0, 10 - b.actividades.length)} de opción múltiple o verdadero/falso`);
      for (const pd of D.plan.puntos_dificiles ?? []) { const n = b.actividades.filter((a: any) => a.punto_dificil === pd.id).length; if (n > 0 && n < 3) huecos.push(`Punto difícil ${pd.id} '${pd.descripcion}' tiene ${n} actividad(es) en el bloque ${b.id}: faltan ${3 - n}`); }
    }
    D.huecos = huecos.slice(0, 8);
    const sig = huecos.length ? "reparar" : "verificar";
    await guardar(supabase, t, { datos: D, paso: sig, progreso: { pct: 72, mensaje: huecos.length ? "Arreglando detallitos 🔧" : "Verificando los datos 🔎", paso: sig } });
    return sig;
  }

  if (t.paso === "reparar") {
    const plan = D.plan;
    const sistema = REPARADOR;
    const contenido = [{ type: "text", text: `Idioma de la guía: ${plan.idioma_guia}. Nivel: ${nivel}. Perfil: ${plan.perfil_edad}.\nHuecos a reparar:\n${(D.huecos ?? []).map((h: string) => "- " + h).join("\n")}\nIds que ya existen: ${JSON.stringify((D.bloques as any[]).flatMap((b) => b.actividades.map((a: any) => a.id)))}\nInventario:\n${JSON.stringify(D.inventario)}\nPuntos difíciles: ${JSON.stringify(plan.puntos_dificiles)}` }];
    try {
      const r = await claude({ sistema, contenido, maxTokens: 8000 });
      sumar(t, r.uso);
      const nuevas = aplanar(r.json?.actividades_nuevas);
      const citas: string[] = D.citas ?? [];
      const okNuevas = nuevas.filter((a: any) => revisarActividad(a, citas, nivel, [], "r"));
      // se reparten en el bloque del punto difícil o en el primero
      for (const a of okNuevas) { const b = (D.bloques as any[]).find((x) => x.actividades.some((y: any) => y.punto_dificil && y.punto_dificil === a.punto_dificil)) ?? D.bloques[0]; b.actividades.push(a); }
    } catch (e) { console.warn("Reparación falló, sigue sin ella:", (e as Error).message); }
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
      const r = await claude({ sistema: VERIFICADOR, contenido, maxTokens: 8000, herramientas: [{ type: "web_search_20260209", name: "web_search", max_uses: hayApuntes ? 10 : 4, allowed_domains: DOMINIOS_CONFIABLES }] });
      sumar(t, r.uso);
      for (const res of r.json?.resultados ?? []) {
        reporte.push(res);
        const id = String(res.actividad ?? "");
        for (const b of D.bloques as any[]) {
          if (res.estado === "no_confirmada") { b.actividades = b.actividades.filter((a: any) => a.id !== id); b.mini_examen = b.mini_examen.filter((a: any) => a.id !== id); }
          if (res.estado === "corregida") {
            const act = [...b.actividades, ...b.mini_examen].find((a: any) => a.id === id);
            const pista = b.pistas.find((p: any) => p.id === id) ?? (act ? b.pistas.find((p: any) => p.id === act.pista) : null) ?? b.pistas[0];
            if (pista) { pista.correcciones = pista.correcciones ?? []; pista.correcciones.push({ dato_apuntes: res.decia_la_foto, dato_correcto: res.dato_correcto, mensaje: res.mensaje_para_alumno, fuentes: res.fuentes ?? [] }); }
            // la actividad con el dato equivocado se quita: la pista ya enseña el dato correcto
            if (act) { b.actividades = b.actividades.filter((a: any) => a.id !== id); b.mini_examen = b.mini_examen.filter((a: any) => a.id !== id); }
          }
        }
      }
    } catch (e) { console.warn("Verificación falló, se marca para revisión:", (e as Error).message); reporte.push({ estado: "error", detalle: (e as Error).message }); }
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

// Revisiones por código (Documento 1, sección 6). Devuelve true si la actividad sirve.
function revisarActividad(a: any, citas: string[], nivel: string, huecos: string[], bloque: string): boolean {
  if (!a || !a.tipo) return false;
  const texto = String(a.pregunta ?? a.afirmacion ?? a.enunciado ?? a.instruccion ?? a.texto ?? "");
  const tl = texto.toLowerCase();
  if (PROHIBIDAS.some((p) => tl.includes(p)) && !/\bp[aá]gina web\b/.test(tl)) return false;
  if (["opcion_multiple", "verdadero_falso", "completar"].includes(a.tipo)) {
    if (palabras(texto) > (topePalabras[nivel] ?? 25) + 5) return false;
    if (!a.retro_incorrecta || !a.retro_correcta) { huecos.push(`Actividad ${a.id} sin retroalimentación`); return false; }
    if (a.tipo === "opcion_multiple") { if (!Array.isArray(a.opciones) || a.opciones.length !== 4 || !(a.correcta >= 0 && a.correcta < 4)) return false; if (new Set(a.opciones.map((o: string) => normaliza(o))).size < 4) return false; }
    if (a.tipo === "completar" && (!a.respuesta || !Array.isArray(a.distractores) || a.distractores.length < 2)) return false;
    if (a.tipo === "verdadero_falso" && typeof a.es_verdadera !== "boolean") return false;
  }
  if (a.tipo === "super_dato") { const huecosSD = (String(a.texto ?? "").match(/\[\[(.+?)\]\]/g) ?? []).length; if (huecosSD < 3 || !Array.isArray(a.distractores)) return false; }
  if (a.tipo === "conceptos" || a.tipo === "quien_es_quien") { if (!Array.isArray(a.pares) || a.pares.length < 3) return false; a.pares = a.pares.filter((p: any) => p?.termino && p?.definicion); if (a.pares.length < 3) return false; }
  if (a.tipo === "ordenar") { if (!Array.isArray(a.pasos) || a.pasos.length < 3) return false; a.pasos = a.pasos.map((p: any) => typeof p === "string" ? { texto: p, emoji: "" } : p); }
  if (a.tipo === "clasificar") { if (!Array.isArray(a.grupos) || a.grupos.length < 2 || !Array.isArray(a.elementos) || a.elementos.length < 4) return false; a.elementos = a.elementos.filter((e: any) => e && (e.grupo === 0 || e.grupo === 1)); if (a.elementos.length < 4) return false; }
  // cita respaldada
  const cita = a.fuente?.cita;
  if (cita && citas.length && !citaExiste(cita, citas) && a.fuente?.tipo !== "practica") { huecos.push(`Actividad ${a.id} del bloque ${bloque}: su cita no aparece en las fotos`); return false; }
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
