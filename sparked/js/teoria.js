// Slides que no son juego: portada, tutorial, teoría (formato de la lección "Historia de México 2"),
// resultados, candado de la vista previa, pantalla de carga y mensajes de acceso.
import { esc, h, idea, toast } from "./ui.js";
import { sparky, icono } from "./arte.js";
import { formatoDePista } from "./cartucho.js";

const TONOS = ["var(--b1)", "var(--b2)", "var(--b3)", "var(--b4)", "#7c3aed", "#15803d", "#db2777", "#0e7490"];
const colorBloque = (bi) => bi >= 0 ? `var(--b${(bi % 5) + 1})` : "var(--oro)";

// Marco común: barra de bloques arriba, píldora, título.
export function marco(s, ctx) {
  const col = colorBloque(s.blk);
  const barra = ctx.c.bloques.map((b, i) => `<i style="background:var(--b${(i % 5) + 1});opacity:${i === s.blk ? 1 : .18}"></i>`).join("") || `<i style="background:${col}"></i>`;
  return h(`<div class="sl"><div class="era">${barra}</div><div class="cabeza"><span class="pildora" style="background:${col}">${esc(s.tag ?? "")}</span><h1>${esc(s.t)}</h1></div></div>`);
}

export function portada(s, ctx) {
  const c = ctx.c, I = c.plan.identidad;
  const titulo = String(I.titulo ?? "").trim();
  const palabras = titulo.split(" ");
  const corte = Math.max(1, palabras.length - Math.min(2, Math.ceil(palabras.length / 3)));
  const tituloHtml = `${esc(palabras.slice(0, corte).join(" "))} <em>${esc(palabras.slice(corte).join(" "))}</em>`;
  const retratos = (I.retratos_portada ?? []).filter((r) => r?.url).slice(0, 4);
  const derecha = retratos.length >= 2
    ? `<div class="retratos">${retratos.map((r) => `<div class="retrato"><img src="${esc(r.url)}" alt="${esc(r.nombre ?? "")}" loading="lazy">${esc(r.nombre ?? "")}</div>`).join("")}</div>`
    : `<div class="mosaicos">${(I.emojis_portada ?? []).slice(0, 4).map((e, i) => `<div class="m" style="background:${["#fff", "var(--b1)", "var(--b3)", "var(--p-suave)"][i]}">${esc(e)}</div>`).join("")}</div>`;
  const pildora = [c.plan.materia, c.plan.grado, ctx.t("portada_tag")].filter(Boolean).join(" · ");
  const el = h(`<div class="sl portada"><div class="texto"><span class="pildora">${esc(pildora)}</span><h1>${tituloHtml}</h1><div class="sub">${esc(I.subtitulo ?? "")}</div></div>
    ${derecha}
    <div class="aprender">${esc(ctx.t("aprender"))}</div>
    <div class="objetivos">${(I.objetivos ?? []).slice(0, 3).map((o, i) => `<div><b>${i + 1}</b>${esc(o)}</div>`).join("")}</div>
    <div class="bloques">${c.bloques.map((b, i) => `<div style="background:var(--b${(i % 5) + 1})">${esc(ctx.t("bloque"))} ${i + 1} · ${esc(b.titulo)}</div>`).join("")}</div></div>`);
  if (ctx.modo === "vista_previa") el.appendChild(h(`<div class="pildora" style="position:absolute;right:24px;top:22px;background:var(--oro);color:#111">${esc(ctx.t("vista_previa"))}</div>`));
  return el;
}

export function tutorial(s, ctx) {
  const T = ctx.t;
  const el = marco({ ...s, tag: T("antes"), blk: -1 }, ctx);
  const fases = [["🔥", T("calentamiento"), "var(--oro-suave)"], ["📘🎮", `${T("pista")} + juegos`, "var(--p-suave)"], ["✅", `${T("mini")}`, "#dcfce7"], ["🏆", T("reto"), "#ede9fe"]];
  el.appendChild(h(`<div class="cuerpo"><div class="tut3">
    <div class="tc"><h2><span class="n">1</span>${esc(T("mover"))}</h2><div class="it"><div class="ic">↓</div>${esc(T("abajo"))}</div><div class="it"><div class="ic">↑</div>${esc(T("arriba"))}</div></div>
    <div class="tc"><h2><span class="n">2</span>${esc(T("barrita"))}</h2><div class="it"><div class="ic">▦</div>${esc(T("cuadritos"))}</div><div class="it"><div class="ic">✋</div>${esc(T("lupa"))}</div></div>
    <div class="tc"><h2><span class="n">3</span>${esc(T("juega"))}</h2><div class="it"><div class="ic" style="font-size:14px">START</div>${esc(T("start"))}</div><div class="it"><div class="ic">↻</div>${esc(T("reintenta"))}</div></div></div>
    <div class="tut-pasos">${fases.map(([e, n, bg]) => `<div style="background:${bg}">${e} ${esc(n)}</div>`).join("")}</div>
    <div class="banda tut-banda" style="text-align:center;font-size:20px"><b>${esc(T("importante"))}</b> ${esc(T("termina"))}</div></div>`));
  return el;
}

// ---------- Teoría ----------
function tarjeta(p, i, ctx, opciones = {}) {
  const col = TONOS[(i + (opciones.desfase ?? 0)) % TONOS.length];
  const ideas = (p.ideas ?? []).map((x) => `<li>${idea(x)}</li>`).join("");
  const apoyo = p.ideas_apoyo?.length ? `<p class="apoyo">${p.ideas_apoyo.map(esc).join(" · ")}</p>` : "";
  const ej = p.ejemplo ? `<div class="caja-ej"><b>${esc(ctx.t("ejemplo"))}</b> ${esc(p.ejemplo)}</div>` : "";
  const corr = (p.correcciones ?? []).map((cr) => `<div class="caja-corregido"><b>${esc(ctx.t("corregido"))}</b> ${esc(cr.dato_correcto ?? cr.mensaje ?? "")}${cr.dato_apuntes ? ` <span style="color:var(--gris)">(${esc(ctx.t("de_tus_notas"))}: “${esc(cr.dato_apuntes)}”)</span>` : ""}</div>`).join("");
  const img = opciones.conImagen && p.imagenes?.find((x) => x.tipo !== "retrato" && x.url);
  const imgHtml = img ? `<div class="img"><img src="${esc(img.url)}" alt="${esc(img.pie ?? "")}" loading="lazy"></div><div class="pie">${esc(img.pie ?? img.credito ?? "")}</div>` : "";
  const rapido = p.dato_rapido ? `<div class="dato-rapido" style="--c:${col}">${esc(p.dato_rapido.titulo ?? "")}<b>${esc(p.dato_rapido.valor ?? "")}</b></div>` : "";
  return `<div class="tcard" style="--c:${col}"><div class="th"><span class="em">${esc(p.emoji ?? "💡")}</span>${esc(p.titulo ?? "")}</div>${ideas ? `<ul>${ideas}</ul>` : ""}${apoyo}${ej}${corr}${rapido}${imgHtml}</div>`;
}

function esquemaHtml(e, col, ctx) {
  if (!e?.tipo) return "";
  const els = e.elementos ?? [];
  if (e.tipo === "linea_tiempo") return `<div class="linea-tiempo">${els.map((x, i) => `${i ? '<span class="fl">→</span>' : ""}<div class="hito" style="background:${TONOS[i % TONOS.length]}">${x.imagen ? `<img src="${esc(x.imagen)}" alt="">` : ""}<b>${esc(x.nombre ?? "")}</b><small>${esc(x.detalle ?? "")}${x.emoji ? " " + esc(x.emoji) : ""}</small></div>`).join("")}</div>`;
  if (e.tipo === "comparacion") return `<div class="comparacion" style="--cols:${Math.min(3, Math.max(2, els.length))}">${els.map((x, i) => `<div class="col" style="--c:${TONOS[i % TONOS.length]}"><h3>${esc(x.emoji ?? "")} ${esc(x.nombre ?? "")}</h3><ul style="margin:0;padding-left:20px">${String(x.detalle ?? "").split(/\s*[;·|]\s*/).filter(Boolean).map((d) => `<li>${idea(d)}</li>`).join("")}</ul></div>`).join("")}</div>`;
  if (e.tipo === "ciclo") return `<div class="ciclo">${els.map((x, i) => `${i ? '<span class="fl">→</span>' : ""}<div class="paso" style="background:${TONOS[i % TONOS.length]}">${esc(x.emoji ?? "")} ${esc(x.nombre ?? "")}</div>`).join("")}<span class="fl">↻</span></div>`;
  if (e.tipo === "causa_efecto") return `<div class="lista-iconos">${els.map((x) => `<div class="fila"><div class="ic">${esc(x.emoji ?? "➡️")}</div><div><b>${esc(x.nombre ?? "")}</b> ${esc(x.detalle ?? "")}</div></div>`).join("")}</div>`;
  if (e.tipo === "mapa" || e.tipo === "partes") return `<div class="categorias">${els.map((x, i) => `<div class="cat" style="--c:${TONOS[i % TONOS.length]}"><b>${esc(x.emoji ?? "")} ${esc(x.nombre ?? "")}</b>${esc(x.detalle ?? "")}</div>`).join("")}</div>`;
  return "";
}

export function teoria(s, ctx) {
  const el = marco(s, ctx);
  // Nada se desborda: el reproductor mide la slide y elige la letra (de 22 a 18 px) que cabe; si no cabe, la divide.
  el.classList.add("teoria-sl");
  if (s.letra) el.style.setProperty("--letra", s.letra + "px");
  const pistas = s.pistas ?? [];
  const idx = pistas.findIndex((p) => p.esquema?.tipo);
  const conEsquema = idx >= 0 ? pistas[idx] : null;
  const formato = pistas.length ? formatoDePista(pistas[idx >= 0 ? idx : 0]) : "tarjetas";
  const retratos = pistas.flatMap((p) => (p.imagenes ?? []).filter((x) => x.tipo === "retrato" && x.url));
  const otrasImgs = pistas.flatMap((p) => (p.imagenes ?? []).filter((x) => x.tipo !== "retrato" && x.url));
  const cuerpo = h('<div class="cuerpo"></div>');
  const desfase = (s.parte - 1) * 3;
  const defin = pistas.length >= 2 && pistas.length <= 3 && pistas.every((p) => (p.ideas ?? []).length <= 3 && (p.ideas ?? []).every((i) => String(i).length < 70) && !p.esquema && !p.imagenes?.length);
  // síntesis de la página: caja clave o banda (van debajo de las tarjetas)
  const clave = pistas.map((p) => p.clave).find(Boolean);
  const concl = pistas.map((p) => p.conclusion).find(Boolean);
  // Si debajo de las tarjetas viene algo más (esquema, clave o banda), la cuadrícula no debe ocupar toda la altura,
  // porque lo que sigue quedaría fuera de la slide.
  const altura = (conEsquema || clave || concl) ? "auto" : "100%";

  let cuerpoHtml = "";
  if (retratos.length && formato === "retratos" || (retratos.length && !conEsquema)) {
    // Retratos a la izquierda, tarjetas al centro, pintura o mapa a la derecha
    const lateral = otrasImgs[0];
    cuerpoHtml = `<div style="display:grid;grid-template-columns:150px 1fr ${lateral ? "300px" : ""};gap:20px;height:${altura}">
      <div class="retrato-col">${retratos.slice(0, 3).map((r, i) => `<div class="r" style="--c:${TONOS[i % TONOS.length]}"><img src="${esc(r.url)}" alt="${esc(r.nombre ?? "")}" loading="lazy">${esc(r.nombre ?? "")}</div>`).join("")}</div>
      <div class="tarjetas" style="grid-template-columns:1fr">${pistas.map((p, i) => tarjeta(p, i, ctx, { desfase })).join("")}</div>
      ${lateral ? `<div class="lado-img"><div class="cuadro"><img src="${esc(lateral.url)}" alt="${esc(lateral.pie ?? "")}" loading="lazy"><div class="pie">${esc(lateral.pie ?? lateral.credito ?? "")}</div></div></div>` : ""}</div>`;
  } else if (defin) {
    cuerpoHtml = `<div class="definiciones">${pistas.map((p, i) => `<div class="tcard" style="--c:${TONOS[(i + desfase) % TONOS.length]}"><div class="em-grande">${esc(p.emoji ?? "💡")}</div><div class="th">${esc(p.titulo ?? "")}</div><ul style="padding:0;list-style:none;text-align:center">${(p.ideas ?? []).map((x) => `<li>${idea(x)}</li>`).join("")}</ul>${p.ejemplo ? `<div class="caja-ej"><b>${esc(ctx.t("ejemplo"))}</b> ${esc(p.ejemplo)}</div>` : ""}${(p.correcciones ?? []).map((cr) => `<div class="caja-corregido"><b>${esc(ctx.t("corregido"))}</b> ${esc(cr.dato_correcto ?? "")}</div>`).join("")}</div>`).join("")}</div>`;
  } else {
    const cols = Math.max(1, pistas.length);
    const conImagen = otrasImgs.length > 0;
    cuerpoHtml = `<div class="tarjetas" style="grid-template-columns:repeat(${cols},1fr)${conImagen ? ";grid-auto-rows:1fr" : ""};height:${altura}">${pistas.map((p, i) => tarjeta(p, i, ctx, { desfase, conImagen })).join("")}</div>`;
    if (conEsquema) cuerpoHtml += esquemaHtml(conEsquema.esquema, TONOS[(idx + desfase) % TONOS.length], ctx);
  }
  // En la última slide antes de un juego, el botón "¡A jugar!" ocupa la esquina inferior derecha: la caja clave o la banda le dejan sitio.
  const sig = ctx.siguienteTitulo();
  const sangria = sig ? ' style="margin-right:380px"' : "";
  if (clave) cuerpoHtml += `<div class="caja-clave fila-clave"${sangria}>🔑 ${idea(clave)}</div>`;
  if (concl) cuerpoHtml += `<div class="banda fila-clave"${sangria}>${idea(concl)}</div>`;
  cuerpo.innerHTML = cuerpoHtml;

  // última slide de teoría del bloque: "Ojo con esto" y "Palabras clave"
  if (s.ultima && s.b) {
    const pds = ctx.c.plan.puntos_dificiles.filter((p) => ctx.c.bloqueDePunto[p.id] === s.b.id);
    const terminos = s.b.actividades.filter((a) => a.tipo === "conceptos").flatMap((a) => (a.pares ?? []).map((p) => p.termino)).slice(0, 10);
    if (pds.length || terminos.length) {
      const lado = h(`<div style="display:flex;flex-direction:column;gap:12px">${pds.length ? `<div class="ojo"><h3>${esc(ctx.t("cuidado"))}</h3>${pds.map((p) => `<div>• ${esc(p.descripcion)}</div>`).join("")}</div>` : ""}${terminos.length ? `<div class="claves"><h3>${esc(ctx.t("claves"))}</h3><div class="kchips">${terminos.map((x) => `<span class="chip">${esc(x)}</span>`).join("")}</div></div>` : ""}</div>`);
      const grid = cuerpo.querySelector(".tarjetas, .definiciones");
      if (grid) { grid.style.gridTemplateColumns = `repeat(${Math.max(1, pistas.length)},1fr) 300px`; grid.classList.remove("definiciones"); grid.classList.add("tarjetas"); grid.appendChild(lado); }
      else cuerpo.appendChild(lado);
    }
  }
  el.appendChild(cuerpo);
  if (sig) el.appendChild(h(`<div class="a-jugar">🎮 <span>${esc(ctx.t("a_jugar"))}</span> ${esc(sig)}</div>`));
  return el;
}

// ---------- Resultados (7 nov 2026) ----------
// Calificación honesta: se cuenta TODA actividad de la guía que da resultado (cada pregunta de los juegos, cada
// tarjeta del verdadero o falso, cada súper dato, relacionar, ordenar y clasificar, y cada pregunta de los
// mini-exámenes y del reto). Los juegos guardan en ctx.resultados[id] el acierto al primer intento (ctx.registrar).
// Una actividad que aparece en dos juegos (calentamiento o reto final) cuenta una sola vez.
const NO_JUEGO = new Set(["portada", "tutorial", "teoria", "resultados", "candado", "terminando"]);
const idsDeSlide = (s) => s.ids ?? (s.items ? s.items.map((a) => a?.id) : s.a?.id ? [s.a.id] : []);
export function resumenAvance(ctx) {
  const c = ctx.c, S = ctx.S, R = ctx.resultados ?? {};
  const bloqueDe = {};
  c.bloques.forEach((b, bi) => [...b.actividades, ...b.mini_examen, ...(b.duelo ?? [])].forEach((a) => { if (a?.id) bloqueDe[a.id] = bi; }));
  const primeraSlide = {}, todas = [];
  S.forEach((s, i) => { if (NO_JUEGO.has(s.k)) return; idsDeSlide(s).forEach((id) => { if (!id || !c.porId[id] || id in primeraSlide) return; primeraSlide[id] = i; todas.push(id); }); });
  const estado = (id) => !(id in R) ? "sin" : R[id] ? "bien" : "mal";
  const total = todas.length;
  const bien = todas.filter((id) => estado(id) === "bien").length;
  const contestadas = todas.filter((id) => estado(id) !== "sin").length;
  const pendientes = todas.filter((id) => estado(id) === "sin");
  const primeraPendiente = pendientes.length ? Math.min(...pendientes.map((id) => primeraSlide[id])) : -1;
  // por bloque: conteos y temas (pistas) a repasar, con los no contestados
  const bloques = c.bloques.map((b, bi) => {
    const ids = todas.filter((id) => bloqueDe[id] === bi);
    const n = { bien: 0, mal: 0, sin: 0 };
    const temas = new Map();
    ids.forEach((id) => {
      const e = estado(id); n[e]++;
      if (e === "bien") return;
      const a = c.porId[id];
      const pista = b.pistas.find((p) => p.id === a?.pista);
      const clave = pista ? pista.id : "a:" + id;
      if (!temas.has(clave)) temas.set(clave, { titulo: pista ? `${pista.emoji ?? ""} ${pista.titulo ?? ""}`.trim() : String(a?.pregunta ?? a?.afirmacion ?? a?.enunciado ?? a?.instruccion ?? "").slice(0, 90), pista: pista?.id ?? a?.pista ?? null, mal: 0, sin: 0 });
      temas.get(clave)[e]++;
    });
    const tot = ids.length, hechas = n.bien + n.mal;
    // Dominado: todo contestado y 90 % o más bien. A reforzar: hay errores y menos de 90 %, o todo contestado con menos de 90 %. Sin contestar: sin errores
    // pero con actividades pendientes (aunque ya haya empezado el bloque).
    const nivel = !tot ? "vacio" : (!n.sin && n.bien / tot >= .9) ? "dominado" : n.mal || !n.sin ? "reforzar" : "sin";
    // primero lo que salió mal, luego lo que falta
    const lista = [...temas.values()].sort((x, y) => (y.mal - x.mal) || (y.sin - x.sin));
    return { b, bi, total: tot, ...n, nivel, empezado: hechas > 0, temas: lista };
  }).filter((x) => x.total);
  return { total, bien, contestadas, faltan: total - contestadas, primeraPendiente, bloques,
    calif: total ? Math.round(100 * bien / total) : 0, pctAvance: total ? Math.round(100 * contestadas / total) : 0 };
}

const rellenar = (txt, v) => String(txt).replace(/\{(\w+)\}/g, (_, k) => v[k] ?? "");

// ---------- Compartir resultados (7 nov 2026) ----------
// Para que mamá o papá reciban el reporte aunque no estén frente al dispositivo: un texto corto (WhatsApp) y una
// imagen PNG de 1080 x 1350 dibujada con canvas. Sin el link de la guía (cada link es de una sola familia) y sin
// datos personales. Usa los mismos números de resumenAvance: aquí no se calcula nada nuevo.
const LIMITE_TEXTO = 900;
const sinEmoji = (s) => String(s ?? "").replace(/^[^\p{L}\p{N}¿¡"“«(]+/u, "").replace(/\s+/g, " ").trim();
const corta = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);
function sugerenciaPapas(r, T) {
  const completo = r.faltan === 0 && r.total > 0;
  return !completo ? T("papas_falta") : r.bloques.some((x) => x.nivel !== "dominado") ? T("papas_repasar") : T("papas_ok");
}
function fechaHoy(T) {
  try { return new Date().toLocaleDateString(T("comp_locale"), { day: "numeric", month: "long", year: "numeric" }); }
  catch { return new Date().toISOString().slice(0, 10); }
}
const NIVEL_TXT = (T) => ({ dominado: ["✅", T("dominado")], reforzar: ["💪", T("reforzar")], sin: ["⏳", T("sin_contestar")] });
const masTemas = (T, n) => (n === 1 ? T("comp_mas1") : rellenar(T("comp_mas"), { n }));

export function textoResultados(ctx, r = resumenAvance(ctx)) {
  const T = ctx.t, N = NIVEL_TXT(T);
  const titulo = corta(sinEmoji(ctx.c.plan?.identidad?.titulo ?? ctx.c.plan?.materia ?? "SparkEd"), 80);
  const armar = (maxTemas, largoTema) => {
    const l = [`📚 *${titulo}*`, `📅 ${fechaHoy(T)}`, "",
      `${T("avance")}: ${r.contestadas} ${T("de")} ${r.total} ${T("actividades")}`, `*${T("calif_final")}: ${r.calif} %*`, ""];
    r.bloques.forEach((x) => {
      l.push(`${N[x.nivel][0]} ${T("bloque")} ${x.bi + 1} · ${corta(sinEmoji(x.b.titulo), 50)}: *${N[x.nivel][1]}*`);
      if (!x.temas.length) return;
      const temas = x.temas.slice(0, maxTemas).map((tm) => corta(sinEmoji(tm.titulo), largoTema));
      const resto = x.temas.length - temas.length;
      if (resto) temas.push(masTemas(T, resto));
      l.push(`   ${T("comp_repasar")}: ${temas.join("; ")}`);
    });
    l.push("", sugerenciaPapas(r, T), "", "SparkEd · sparkeducation-mx.com");
    return l.join("\n");
  };
  // Si no cabe en unas 900 letras, se resumen los temas: primero menos por bloque, luego más cortos.
  for (const [n, largo] of [[3, 60], [3, 40], [2, 40], [1, 40], [1, 28], [0, 0]]) {
    const txt = armar(n, largo);
    if (txt.length <= LIMITE_TEXTO || n === 0) return txt.slice(0, LIMITE_TEXTO);
  }
}

// --- Imagen 1080 x 1350 ---
const FUENTE = (peso, px) => `${peso} ${px}px Poppins, Outfit, "Atkinson Hyperlegible", "Segoe UI", -apple-system, BlinkMacSystemFont, system-ui, Roboto, Arial, sans-serif`;
const CHIP = { dominado: ["#dcfce7", "#14532d", "#16a34a"], reforzar: ["#fff3c4", "#7c2d12", "#FFD400"], sin: ["#eef0f6", "#374151", "#9aa1b5"] };
function colorDeBloque(bi) {
  const css = getComputedStyle(document.documentElement).getPropertyValue(`--b${(bi % 5) + 1}`).trim();
  return css || ["#1d4ed8", "#c2410c", "#b91c1c", "#4d7c0f", "#0f766e"][bi % 5];
}
function caja(g, x, y, w, h, r) {
  g.beginPath();
  if (g.roundRect) g.roundRect(x, y, w, h, r);
  else { g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
}
// Corta el texto en renglones que caben en el ancho; el último lleva "…" si sobra texto.
function renglones(g, texto, ancho, max) {
  const palabras = String(texto).split(/\s+/).filter(Boolean), out = [];
  let linea = "";
  for (let i = 0; i < palabras.length; i++) {
    const prueba = linea ? linea + " " + palabras[i] : palabras[i];
    if (g.measureText(prueba).width <= ancho || !linea) { linea = prueba; continue; }
    out.push(linea); linea = palabras[i];
    if (out.length === max) { linea = ""; out[max - 1] = recortar(g, out[max - 1] + " " + palabras.slice(i).join(" "), ancho); break; }
  }
  if (linea) out.push(linea);
  return out.map((l) => recortar(g, l, ancho));
}
function recortar(g, s, ancho) {
  if (g.measureText(s).width <= ancho) return s;
  while (s.length > 1 && g.measureText(s + "…").width > ancho) s = s.slice(0, -1);
  return s.trimEnd() + "…";
}

export async function imagenResultados(ctx, r = resumenAvance(ctx)) {
  const T = ctx.t, N = NIVEL_TXT(T);
  // Las fuentes de la página (si ya están cargadas) se usan; si no hay red, el sistema pone la suya.
  try { await Promise.race([document.fonts?.ready, new Promise((ok) => setTimeout(ok, 800))]); } catch {}
  const W = 1080, H = 1350, M = 56;
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const g = cv.getContext("2d");
  g.textBaseline = "alphabetic";
  // Fondo claro y cabeza amarilla
  g.fillStyle = "#F7F8FC"; g.fillRect(0, 0, W, H);
  g.fillStyle = "#FFD400"; g.fillRect(0, 0, W, 196);
  g.fillStyle = "#111"; g.font = FUENTE(800, 56); g.fillText("Spark", M, 92);
  const wSpark = g.measureText("Spark").width;
  caja(g, M + wSpark + 6, 42, g.measureText("Ed").width + 24, 66, 14); g.fill();
  g.fillStyle = "#FFD400"; g.fillText("Ed", M + wSpark + 18, 92);
  g.font = FUENTE(800, 30);
  const pil = T("resultados"), wPil = g.measureText(pil).width + 40;
  g.fillStyle = "#111"; caja(g, W - M - wPil, 46, wPil, 56, 28); g.fill();
  g.fillStyle = "#FFD400"; g.fillText(pil, W - M - wPil + 20, 84);
  g.fillStyle = "#111"; g.font = FUENTE(600, 30); g.fillText(fechaHoy(T), M, 160);
  // Título de la guía (hasta 2 renglones)
  let y = 262;
  g.font = FUENTE(800, 48); g.fillStyle = "#111";
  renglones(g, sinEmoji(ctx.c.plan?.identidad?.titulo ?? "SparkEd"), W - 2 * M, 2).forEach((l) => { g.fillText(l, M, y); y += 58; });
  // Tarjeta de calificación y avance
  y += 4;
  const yC = y, hC = 224;
  g.fillStyle = "#fff"; caja(g, M, yC, W - 2 * M, hC, 28); g.fill();
  g.lineWidth = 4; g.strokeStyle = "#111"; g.stroke();
  g.fillStyle = "#3b3f52"; g.font = FUENTE(800, 30); g.fillText(T("calif_final"), M + 34, yC + 58);
  g.fillStyle = "#111"; g.font = FUENTE(800, 128); g.fillText(`${r.calif} %`, M + 28, yC + 180);
  const xA = M + 430, wA = W - M - 34 - xA;
  g.fillStyle = "#111"; g.font = FUENTE(800, 32);
  g.fillText(`${T("avance")}:`, xA, yC + 62);
  g.font = FUENTE(600, 32);
  g.fillText(recortar(g, `${r.contestadas} ${T("de")} ${r.total} ${T("actividades")}`, wA), xA, yC + 104);
  g.fillStyle = "#e9ebf3"; caja(g, xA, yC + 128, wA, 38, 19); g.fill();
  if (r.pctAvance > 0) { g.fillStyle = "#FFD400"; caja(g, xA, yC + 128, Math.max(38, wA * r.pctAvance / 100), 38, 19); g.fill(); }
  g.lineWidth = 3; g.strokeStyle = "#111"; caja(g, xA, yC + 128, wA, 38, 19); g.stroke();
  g.fillStyle = "#3b3f52"; g.font = FUENTE(600, 28);
  const aciertos = `${r.bien} ${T("de")} ${r.total} ${T("correctas")}`, conIntento = `${aciertos} ${T("primer_intento")}`;
  g.fillText(recortar(g, g.measureText(conIntento).width <= wA ? conIntento : aciertos, wA), xA, yC + 200);
  y = yC + hC + 24;
  // Bloques: cada uno con su color, su chip de estado y hasta 3 temas. Si no caben, primero menos temas por bloque y
  // luego dos columnas (guías con muchos bloques). Nunca se omite un bloque.
  const pie = 96, fin = H - pie - 24, GAP = 12, TEMA = 40;
  const lineas = (x, m, junto) => !x.temas.length ? 1 : junto ? 1 : Math.min(m, x.temas.length) + (x.temas.length > m ? 1 : 0);
  const MODOS = [[1, 3], [1, 2], [1, 1], [2, 3], [2, 2], [2, 1], [2, 1, true]];
  // Una columna: cabeza de 74 px. Dos columnas: número y chip arriba, título debajo (cabeza de 106 px).
  const altoDe = (x, cols, m, junto) => (cols === 1 ? 14 + 60 : 12 + 52 + 42) + lineas(x, m, junto) * TEMA + 12;
  const altoTotal = ([cols, m, junto]) => {
    let s = 0;
    for (let i = 0; i < r.bloques.length; i += cols) s += Math.max(...r.bloques.slice(i, i + cols).map((x) => altoDe(x, cols, m, junto))) + GAP;
    return s - GAP;
  };
  const modo = MODOS.find((md) => altoTotal(md) <= fin - y) ?? MODOS[MODOS.length - 1];
  const [cols, maxT, junto] = modo;
  const anchoC = cols === 1 ? W - 2 * M : (W - 2 * M - GAP) / 2;
  const chipDe = (x, xDer, yChip, px) => {
    const [fondo, tinta, borde] = CHIP[x.nivel] ?? CHIP.sin;
    g.font = FUENTE(800, px);
    const chip = N[x.nivel]?.[1] ?? "", wChip = g.measureText(chip).width + 36, xChip = xDer - wChip;
    g.fillStyle = fondo; caja(g, xChip, yChip, wChip, 52, 26); g.fill();
    g.lineWidth = 3; g.strokeStyle = borde; g.stroke();
    g.fillStyle = tinta; g.fillText(chip, xChip + 18, yChip + 36);
    return xChip;
  };
  for (let i = 0; i < r.bloques.length; i += cols) {
    const fila = r.bloques.slice(i, i + cols);
    const hF = Math.max(...fila.map((x) => altoDe(x, cols, maxT, junto)));
    if (y + hF > fin) break;
    fila.forEach((x, k) => {
      const x0 = M + k * (anchoC + GAP), col = colorDeBloque(x.bi);
      g.fillStyle = "#fff"; caja(g, x0, y, anchoC, hF, 22); g.fill();
      g.lineWidth = 3; g.strokeStyle = "#111"; g.stroke();
      g.save(); caja(g, x0, y, anchoC, hF, 22); g.clip(); g.fillStyle = col; g.fillRect(x0, y, 14, hF); g.restore();
      // número, chip de estado y título
      const yN = cols === 1 ? y + 14 + 28 : y + 12 + 26;
      g.fillStyle = col; g.beginPath(); g.arc(x0 + 58, yN, 27, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#fff"; g.font = FUENTE(800, 32); g.textAlign = "center"; g.fillText(String(x.bi + 1), x0 + 58, yN + 11); g.textAlign = "left";
      const xChip = chipDe(x, x0 + anchoC - 20, yN - 26, 28);
      g.fillStyle = "#111";
      let yt;
      if (cols === 1) { g.font = FUENTE(800, 34); g.fillText(recortar(g, sinEmoji(x.b.titulo), xChip - 20 - (x0 + 100)), x0 + 100, yN + 12); yt = y + 14 + 60 + 28; }
      else { g.font = FUENTE(800, 32); g.fillText(recortar(g, sinEmoji(x.b.titulo), anchoC - 56), x0 + 34, y + 12 + 52 + 34); yt = y + 12 + 52 + 42 + 28; }
      // temas a repasar
      const xT = x0 + 34, anchoT = anchoC - 34 - 24;
      g.font = FUENTE(600, 28);
      if (!x.temas.length) { g.fillStyle = "#14532d"; g.fillText(recortar(g, "✓ " + T("todo_bien"), anchoT), xT, yt); return; }
      const vistos = x.temas.slice(0, maxT), resto = x.temas.length - vistos.length;
      vistos.forEach((tm, j) => {
        if (junto && j > 0) return;
        g.fillStyle = tm.mal ? "#b91c1c" : "#6b7280"; g.fillText(tm.mal ? "✗" : "○", xT, yt);
        const cola = junto && resto ? ` (+${resto})` : "";
        g.font = FUENTE(600, 28);
        const wCola = cola ? g.measureText(cola).width : 0;
        const tema = recortar(g, sinEmoji(tm.titulo), anchoT - 36 - wCola);
        g.fillStyle = "#1f2937"; g.fillText(tema + cola, xT + 36, yt);
        yt += TEMA;
      });
      if (resto && !junto) { g.fillStyle = "#4b5563"; g.font = FUENTE(600, 28); g.fillText(recortar(g, masTemas(T, resto), anchoT - 36), xT + 36, yt); }
    });
    y += hF + GAP;
  }
  // Sugerencia para mamá o papá, si queda sitio
  const sug = sugerenciaPapas(r, T);
  g.font = FUENTE(600, 30);
  const lsug = renglones(g, sug, W - 2 * M - 60, 3), hS = 34 + lsug.length * 40;
  if (fin - y >= hS) {
    g.fillStyle = "#eef6ff"; caja(g, M, y, W - 2 * M, hS, 22); g.fill();
    g.setLineDash([12, 8]); g.lineWidth = 3; g.strokeStyle = "#0369a1"; g.stroke(); g.setLineDash([]);
    g.fillStyle = "#0c4a6e"; lsug.forEach((l, i) => g.fillText(l, M + 30, y + 50 + i * 40));
  }
  // Pie
  g.fillStyle = "#111"; g.fillRect(0, H - pie, W, pie);
  g.fillStyle = "#FFD400"; g.font = FUENTE(800, 34); g.textAlign = "center";
  g.fillText("SparkEd · sparkeducation-mx.com", W / 2, H - pie / 2 + 12); g.textAlign = "left";
  return await new Promise((ok, mal) => cv.toBlob((b) => (b ? ok(b) : mal(new Error("png"))), "image/png"));
}

// iPad y teléfonos: hoja nativa de compartir con archivos. En computadoras se usa WhatsApp Web y la descarga.
function puedeCompartirArchivos() {
  try {
    if (!navigator.share || !navigator.canShare || !matchMedia("(pointer: coarse)").matches) return false;
    return navigator.canShare({ files: [new File(["x"], "x.png", { type: "image/png" })] });
  } catch { return false; }
}
function nombreArchivo() { const d = new Date(), p = (n) => String(n).padStart(2, "0"); return `SparkEd-resultados-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.png`; }
function descargar(blob) {
  const url = URL.createObjectURL(blob), a = document.createElement("a");
  a.href = url; a.download = nombreArchivo(); document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
const abrirWhatsApp = (texto) => window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank", "noopener");

function botonCompartir(ctx, r, sl) {
  const T = ctx.t;
  const el = h(`<div class="rep-compartir">
    <button type="button" class="boton rep-comp-btn" aria-haspopup="menu" aria-expanded="false">📤 ${esc(T("compartir"))}</button>
    <div class="rep-menu" role="menu" hidden>
      <button type="button" role="menuitem" data-op="wa"><span class="ic">💬</span>${esc(T("comp_whatsapp"))}</button>
      <button type="button" role="menuitem" data-op="img"><span class="ic">🖼️</span>${esc(T("comp_imagen"))}</button>
    </div></div>`);
  const btn = el.querySelector(".rep-comp-btn"), menu = el.querySelector(".rep-menu");
  let png = null;
  const imagen = () => (png ??= imagenResultados(ctx, r).catch((e) => { png = null; throw e; }));
  const fuera = (e) => { if (!el.isConnected || !el.contains(e.target)) cerrar(); };
  const tecla = (e) => { if (e.key === "Escape") { cerrar(); btn.focus(); } };
  function cerrar() { menu.hidden = true; btn.setAttribute("aria-expanded", "false"); document.removeEventListener("pointerdown", fuera, true); document.removeEventListener("keydown", tecla, true); }
  function abrir() {
    menu.hidden = false; btn.setAttribute("aria-expanded", "true");
    document.addEventListener("pointerdown", fuera, true); document.addEventListener("keydown", tecla, true);
    // La imagen se prepara al abrir el menú: así la hoja de compartir sale enseguida al tocar una opción.
    imagen().catch(() => {});
  }
  btn.onclick = () => (menu.hidden ? abrir() : cerrar());
  el.querySelector('[data-op="wa"]').onclick = async () => {
    cerrar();
    const texto = textoResultados(ctx, r);
    if (!puedeCompartirArchivos()) return abrirWhatsApp(texto);
    try {
      const file = new File([await imagen()], nombreArchivo(), { type: "image/png" });
      await navigator.share({ text: texto, files: [file] });
    } catch (e) {
      if (e?.name === "AbortError") return;
      try { await navigator.share({ text: texto }); } catch (e2) { if (e2?.name !== "AbortError") abrirWhatsApp(texto); }
    }
  };
  el.querySelector('[data-op="img"]').onclick = async () => {
    cerrar();
    try {
      const blob = await imagen();
      if (puedeCompartirArchivos()) {
        try { await navigator.share({ files: [new File([blob], nombreArchivo(), { type: "image/png" })] }); return; }
        catch (e) { if (e?.name === "AbortError") return; }
      }
      descargar(blob);
      toast(sl, true, T("comp_guardada"));
    } catch { toast(sl, false, T("comp_error")); }
  };
  return el;
}

export function resultados(s, ctx) {
  const T = ctx.t, r = resumenAvance(ctx);
  const completo = r.faltan === 0 && r.total > 0;
  const pose = completo && r.calif >= 70 ? "festejo" : r.contestadas ? "escribiendo" : "saludo";
  const barra = ctx.c.bloques.map((b, i) => `<i style="background:var(--b${(i % 5) + 1})"></i>`).join("");
  const minis = Object.entries(ctx.minis ?? {}).filter(([i]) => ctx.S[i]?.k === "quiz").map(([i, g]) => `<li><span>${esc(ctx.S[i]?.tag ?? T("mini"))}</span><b>${esc(g)}/10</b></li>`).join("");
  const reto = ctx.reto != null ? `<li><span>🏆 ${esc(T("reto"))}</span><b>${esc(ctx.reto)} ${esc(T("puntos"))}</b></li>` : "";
  const aviso = completo
    ? `<div class="rep-aviso listo">🎉 ${esc(T("completo"))}</div>`
    : `<div class="rep-aviso">${esc(r.faltan === 1 ? T("te_falta_una") : rellenar(T("te_faltan"), { n: r.faltan }))}${r.primeraPendiente >= 0 ? `<button class="boton rep-ir" type="button" data-ir="${r.primeraPendiente}">▶ ${esc(T("ir_pendiente"))}</button>` : ""}</div>`;
  const NIVEL = { dominado: ["✅", T("dominado")], reforzar: ["💪", T("reforzar")], sin: ["⏳", T("sin_contestar")] };
  const ANIMO = { dominado: T("animo_dominado"), reforzar: T("animo_reforzar"), sin: T("animo_sin") };
  const tarjetas = r.bloques.map((x) => {
    const col = `var(--b${(x.bi % 5) + 1})`;
    const pc = (n) => (100 * n / x.total).toFixed(1);
    // Temas con errores: un renglón cada uno con "Ver pista". Temas que solo faltan por contestar: fichas compactas
    // (cada una lleva a su pista) bajo la marca "Sin contestar", para que el reporte no se haga larguísimo.
    const irA = (tm) => tm.pista ? ctx.slideDePista(tm.pista) : -1;
    const conError = x.temas.filter((tm) => tm.mal), soloFaltan = x.temas.filter((tm) => !tm.mal);
    const filas = conError.length ? `<ul class="rep-temas">${conError.map((tm) => {
      const ir = irA(tm);
      return `<li><span class="rep-tema">${esc(tm.titulo)}</span><span class="rep-tag mal">✗ ${tm.mal} ${esc(T("mal"))}</span>${tm.sin ? `<span class="rep-tag sin">${esc(T("sin_contestar"))}</span>` : ""}${ir >= 0 ? `<button type="button" class="rep-pista" data-ir="${ir}">${esc(T("ver_pista"))} →</button>` : ""}</li>`;
    }).join("")}</ul>` : "";
    const fichas = soloFaltan.length ? `<div class="rep-faltan"><span class="rep-tag sin">○ ${esc(T("sin_contestar"))}</span>${soloFaltan.map((tm) => { const ir = irA(tm); return ir >= 0 ? `<button type="button" class="rep-ficha" data-ir="${ir}">${esc(tm.titulo)}</button>` : `<span class="rep-ficha">${esc(tm.titulo)}</span>`; }).join("")}</div>` : "";
    const temas = filas || fichas ? filas + fichas : `<p class="rep-ok">⭐ ${esc(T("todo_bien"))}</p>`;
    return `<article class="rep-bloque ${x.nivel}" style="--c:${col}">
      <header><span class="rep-num">${x.bi + 1}</span><h3>${esc(x.b.titulo)}</h3><span class="rep-estado ${x.nivel}">${NIVEL[x.nivel][0]} ${esc(NIVEL[x.nivel][1])}</span></header>
      <div class="rep-barra" aria-hidden="true"><i class="ok" style="width:${pc(x.bien)}%"></i><i class="mal" style="width:${pc(x.mal)}%"></i></div>
      <div class="rep-conteo"><span class="ok">✓ ${x.bien} ${esc(T("bien"))}</span><span class="mal">✗ ${x.mal} ${esc(T("mal"))}</span><span class="sin">○ ${x.sin} ${esc(T("sin_contestar").toLowerCase())}</span></div>
      ${temas}
      <p class="rep-animo">${esc(x.nivel === "sin" && x.empezado ? T("animo_pendiente") : ANIMO[x.nivel])}</p></article>`;
  }).join("");
  // Para mamá o papá: el resumen en lenguaje llano.
  const nombres = (nivel) => r.bloques.filter((x) => x.nivel === nivel).map((x) => `${T("bloque")} ${x.bi + 1} (${x.b.titulo})`).join(", ");
  const papas = [
    rellenar(T("papas_avance"), { x: r.contestadas, y: r.total, p: r.pctAvance, z: r.calif }),
    nombres("dominado") && rellenar(T("papas_domina"), { lista: nombres("dominado") }),
    nombres("reforzar") && rellenar(T("papas_reforzar"), { lista: nombres("reforzar") }),
    nombres("sin") && rellenar(T("papas_sin"), { lista: nombres("sin") }),
    !completo ? T("papas_falta") : r.bloques.some((x) => x.nivel !== "dominado") ? T("papas_repasar") : T("papas_ok"),
  ].filter(Boolean).map((x) => `<li>${esc(x)}</li>`).join("");

  const el = h(`<div class="sl reporte"><div class="era">${barra}</div>
    <div class="rep-cabeza"><div class="rep-titulos"><span class="pildora" style="background:var(--oro)">${esc(T("resultados"))}</span><h1>${esc(T("como_te_fue"))}</h1></div></div>
    <div class="rep-cuerpo">
      <section class="rep-resumen">
        <div class="rep-sparky sk-anima">${sparky(pose, 4)}</div>
        <div class="rep-calif"><small>${esc(T("calif_final"))}</small><b>${r.calif} %</b><span>${r.bien} ${esc(T("de"))} ${r.total} ${esc(T("correctas"))} ${esc(T("primer_intento"))}</span></div>
        <div class="rep-avance"><div class="rep-avance-txt"><b>${esc(T("avance"))}:</b> ${r.contestadas} ${esc(T("de"))} ${r.total} ${esc(T("actividades"))}</div><div class="rep-avance-barra"><i style="width:${r.pctAvance}%"></i></div></div>
        ${aviso}
        <p class="rep-nota">${esc(T("sobre_total"))}</p>
        ${minis || reto ? `<div class="rep-minis"><h3>${esc(T("examenes"))}</h3><ul>${minis}${reto}</ul></div>` : ""}
      </section>
      <section class="rep-lista">
        <h2>📚 ${esc(T("que_repasar"))}</h2>
        <div class="rep-bloques">${tarjetas}</div>
        <div class="rep-papas"><h3>👪 ${esc(T("para_papas"))}</h3><ul>${papas}</ul></div>
      </section>
    </div></div>`);
  el.querySelectorAll("[data-ir]").forEach((a) => a.onclick = () => ctx.go(Number(a.dataset.ir)));
  // Compartir resultados: arriba, junto al título, para que se vea sin desplazarse.
  el.querySelector(".rep-cabeza").appendChild(botonCompartir(ctx, r, el));
  return el;
}

// Fin de la vista previa: lo que falta y el botón para comprar.
export function candado(s, ctx) {
  const c = ctx.c;
  const el = h(`<div class="sl candado"><div class="caja">${sparky("saludo", 5)}<h2>${esc(ctx.t("desbloquea"))}</h2>
    <ul><li><b>${c.bloques_totales ?? c.bloques.length}</b> ${esc(ctx.t("bloque")).toLowerCase()}s con teoría a todo color</li><li><b>${c.actividades_totales ?? "+40"}</b> actividades y juegos con retroalimentación al instante</li><li>${esc(ctx.t("mini"))} por bloque y ${esc(ctx.t("reto")).toLowerCase()}</li><li>7 días de acceso ilimitado a tu guía · 2 dispositivos por familia</li></ul>
    <div class="precio">$${ctx.precio ?? 100}<small>MXN · IVA incluido</small></div>
    <button class="boton" id="pagar">🔓 ${esc(ctx.t("desbloquea"))}</button></div></div>`);
  el.querySelector("#pagar").onclick = () => ctx.desbloquear();
  return el;
}

// Guía pagada que todavía se está terminando (ajuste "jugar durante la generación"): fin de los bloques que ya existen.
export function terminando(s, ctx) {
  const c = ctx.c;
  const faltan = Math.max(0, (c.plan?.bloques_plan?.length ?? 0) - c.bloques.length);
  const el = h(`<div class="sl candado"><div class="caja">${sparky("construyendo", 5)}<h2>Estamos terminando los demás bloques</h2>
    <p style="font-size:20px;margin:0">${faltan ? `Faltan ${faltan} bloque${faltan === 1 ? "" : "s"} con su teoría, juegos y mini-examen.` : "Falta la revisión final de tu guía."} Te avisamos por correo en cuanto esté lista; este mismo link la abre completa.</p>
    <button class="boton" id="recargar">🔄 Ver si ya está lista</button></div></div>`);
  el.querySelector("#recargar").onclick = () => location.reload();
  return el;
}

// Pantalla de carga: Sparky trabaja con su casco de obra (martilla los bloques A, B y C) y aparecen datos curiosos de uno en uno.
export function pantallaCarga(ctx, datos = []) {
  const el = h(`<div class="sl carga crt"><div class="carga-sparky sk-anima">${sparky("construyendo", 7)}</div><h2>${esc(ctx.t("cargando"))}</h2><div class="progreso"><i></i></div><div class="paso"></div><div class="dato"><div class="texto"></div><small></small></div><button class="boton chico" style="background:#fff">${esc(ctx.t("otro_dato"))}</button></div>`);
  let orden = datos.slice().sort(() => Math.random() - .5), i = 0;
  const pinta = () => { const d = orden[i % orden.length]; if (!d) { el.querySelector(".dato").style.display = "none"; return; } el.querySelector(".dato .texto").innerHTML = `${esc(ctx.t("sabias"))} ${esc(d.emoji ?? "")} ${esc(d.texto)}`; el.querySelector(".dato small").textContent = d.fuente ? "Fuente: " + d.fuente : ""; i++; };
  pinta();
  el.querySelector("button").onclick = pinta;
  const rot = setInterval(pinta, 9000);
  el.actualizar = (pct, paso) => { el.querySelector(".progreso i").style.width = Math.max(0, Math.min(100, pct)) + "%"; if (paso) el.querySelector(".paso").textContent = paso; };
  el.detener = () => clearInterval(rot);
  return el;
}

const MENSAJES = {
  inexistente: ["🔗", "Enlace no válido", "Este enlace no existe o está incompleto. Revisa que lo hayas abierto completo."],
  borrador: ["⏳", "Enlace aún no activo", "Este enlace todavía no está activo."],
  expirado: ["⏰", "Tu acceso venció", "Los 7 días de tu guía ya terminaron. Si quieres seguir estudiando, puedes volver a comprarla."],
  cerrado: ["🔒", "Enlace cerrado", "Este enlace ya terminó su tiempo de uso."],
  agotado: ["🔒", "Enlace agotado", "Este enlace ya se usó el máximo de veces permitido."],
  revocado: ["⛔", "Acceso cancelado", "Este acceso fue cancelado."],
  clase_inactiva: ["📕", "Guía no disponible", "Esta guía ya no está disponible."],
  otro_dispositivo: ["📵", "Acceso en uso en otros dispositivos", "Este acceso ya se usa en los dispositivos permitidos. Si es tu propio dispositivo, cierra la navegación privada y vuelve a abrir el link."],
  generando: ["⏳", "Tu guía se está terminando de armar", "Sparky está escribiendo los últimos bloques. Esta página se actualiza sola en unos segundos; no cierres el link."],
  revisando: ["🔎", "Estamos revisando tu guía", "Estamos revisando tu guía; te avisamos por correo en cuanto esté lista. No necesitas hacer nada más."],
  error: ["⚠️", "Algo falló", "No se pudo abrir la guía. Intenta de nuevo en un momento."],
};
export function mensaje(estado) {
  const m = MENSAJES[estado] ?? MENSAJES.inexistente;
  return h(`<div class="sl mensaje"><div class="caja"><div class="icono">${m[0]}</div><h2>${esc(m[1])}</h2><p>${esc(m[2])}</p><p style="font-size:14px;color:var(--gris)">Cada link es de una sola familia y se abre en hasta 2 dispositivos.</p></div></div>`);
}

export { colorBloque, TONOS, icono };
