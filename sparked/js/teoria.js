// Slides que no son juego: portada, tutorial, teoría (formato de la lección "Historia de México 2"),
// resultados, candado de la vista previa, pantalla de carga y mensajes de acceso.
import { esc, h, idea } from "./ui.js";
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
  c.bloques.forEach((b, bi) => [...b.actividades, ...b.mini_examen].forEach((a) => { if (a?.id) bloqueDe[a.id] = bi; }));
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
    <div class="rep-cabeza"><span class="pildora" style="background:var(--oro)">${esc(T("resultados"))}</span><h1>${esc(T("como_te_fue"))}</h1></div>
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
