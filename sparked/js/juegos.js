// Los juegos del estante (Documento 2 + mecánicas que pidió Daniel): carrera, montaña, castillo, swipe, súper dato,
// mix & match, super sort, rank order, ruleta y mini-examen. Todos se califican solos y dan retroalimentación al instante.
import { esc, h, mezclar, toast, inicio, fin, gameOver, arrastrable, panelPregunta, temporizador } from "./ui.js";
import { marco } from "./teoria.js";
import { sonido } from "./sonido.js";
import { escenaCiudad, escenaMontana, escenaCastillo, escenaPlaneta, escenaSvg, capaCoche, capaEscalador, capaSoldado, capaArquero, capaIcono, capaSparky, coche, icono, COLORES_DE_COCHE } from "./arte.js";

const W = 172, H = 140;
const TEMAS = {
  ciudad_neon: {}, formula1: { cielo: "#7dd3fc", estrellas: false, edif1: "#e11d48", edif2: "#f8fafc", neon: "#111827", luz: "#1f2937", carretera: "#374151", linea: "#f8fafc", borde: "#ef4444", luna: "#fde047" },
  callejera: { cielo: "#7c2d12", estrellas: true, edif1: "#431407", edif2: "#9a3412", neon: "#fb923c", luz: "#fde68a", carretera: "#1c1917", linea: "#fbbf24", borde: "#f97316", luna: "#fed7aa" },
  nevada: {}, volcan: { cielo: "#3b0a0a", fondo1: "#7f1d1d", fondo2: "#991b1b", roca: "#44403c", nieve: "#f97316", pasto: "#292524", sol: "#fca5a5" },
  aurora: { cielo: "#052e16", fondo1: "#065f46", fondo2: "#047857", roca: "#365314", nieve: "#a7f3d0", pasto: "#166534", sol: "#d9f99d" },
  noche: {}, amanecer: { cielo: "#fdba74", luna: "#fff7ed", colinas: "#9a3412", suelo: "#65a30d", piedra: "#a8a29e", piedra2: "#d6d3d1" },
  dragon: { cielo: "#1c0a0a", luna: "#ef4444", colinas: "#450a0a", suelo: "#3f3f46", piedra: "#52525b", piedra2: "#71717a" },
};

function hudPill(txt, id = "") { return `<span class="hud-pill" ${id ? `id="${id}"` : ""}>${txt}</span>`; }
// Un <g> de SVG de verdad (crearlo con innerHTML en un div lo volvería un elemento HTML que no se dibuja).
function gSvg(inner, style = "") { const g = document.createElementNS("http://www.w3.org/2000/svg", "g"); if (style) g.setAttribute("style", style); g.innerHTML = inner; return g; }
// Fondo de la escena visible desde antes de START.
function fondoPrevio(el, svg) { const caja = el.querySelector("#caja"); if (caja) caja.innerHTML = svg; }
function panel(ctx, extra = "") { return `<div class="panel-q"><div class="barra-tiempo"><i id="tm"></i></div><div class="pill" id="qn"></div><div id="qbox"></div>${extra}</div>`; }

// ---------- CARRERA: arranca en la línea de salida; acierto rebasa, error te rebasan ----------
export function carrera(s, ctx) {
  const el = marco(s, ctx); const ids = s.ids; const T = ctx.t; const N = ids.length;
  const tema = { ...(TEMAS[s.plantilla] ?? {}), carriles: 5 };
  const fondo = escenaCiudad(W, H, ctx.c.semilla + ctx.cur, tema);
  const colores = COLORES_DE_COCHE.slice(0, 5);
  const area = h(`<div class="juego"><div class="escena-caja crt" id="caja"></div>${panel(ctx, `<div class="pill" id="pos"></div>`)}</div>`);
  el.appendChild(area);
  fondoPrevio(el, escenaSvg(fondo.svg, W, H));
  const TL = s.calentamiento ? 12 : 10;

  const correr = (elegido) => {
    const rivales = colores.filter((c) => c !== elegido).slice(0, 4);
    const coches = [elegido, ...rivales];
    let lugar = [5, 1, 2, 3, 4]; // el jugador arranca al final
    let i = 0, aciertos = 0, timer = null;
    const caja = el.querySelector("#caja");
    const capas = coches.map((c, k) => `<g id="c${k}" style="transition:transform .9s cubic-bezier(.2,.8,.2,1)">${capaCoche(c, 0, 0)}${k === 0 ? `<rect x="4" y="-4" width="16" height="3" fill="#FFD400"/><text x="12" y="-5" font-size="5" fill="#FFD400" text-anchor="middle" font-family="monospace">YOU</text>` : ""}</g>`).join("");
    const meta = `<rect x="150" y="${fondo.suelo + 2}" width="3" height="${H - fondo.suelo - 2}" fill="url(#cuadros)"/><defs><pattern id="cuadros" width="3" height="3" patternUnits="userSpaceOnUse"><rect width="1.5" height="1.5" fill="#fff"/><rect x="1.5" y="1.5" width="1.5" height="1.5" fill="#fff"/></pattern></defs>`;
    caja.innerHTML = escenaSvg(fondo.svg + meta, W, H, capas) + `<div style="position:absolute;left:12px;top:10px;display:flex;gap:8px">${hudPill("LAP 1", "lap")}${hudPill("", "hudpos")}</div>`;
    const ys = (k) => fondo.suelo + 3 + (k % fondo.carriles) * fondo.alturaCarril;
    const colocar = (final = false) => {
      const prog = i / N;
      coches.forEach((c, k) => { const x = 6 + prog * 112 + (5 - lugar[k]) * 8 + (final ? 30 : 0); el.querySelector(`#c${k}`).style.transform = `translate(${x}px, ${ys(k) - 2}px)`; });
      el.querySelector("#hudpos").textContent = `P${lugar[0]} / 5`;
      el.querySelector("#pos").textContent = `${T("pregunta")} ${Math.min(i + 1, N)} ${T("de")} ${N} · ${aciertos} ✓`;
    };
    const swap = (a, b) => { const ka = lugar.indexOf(a), kb = lugar.indexOf(b); lugar[ka] = b; lugar[kb] = a; };
    const preguntar = () => {
      const qb = el.querySelector("#qbox"); qb.innerHTML = "";
      if (i >= N) { colocar(true); const p = lugar[0]; ctx.luego(() => fin(el, ctx, p === 1 ? T("ganaste") : p === 2 ? T("segundo") : p === 3 ? T("tercero") : T("sigue"), `${aciertos}/${N}`, T("correctas"), () => ctx.go(ctx.cur), p <= 2), 1000); return; }
      el.querySelector("#qn").textContent = `${T("pregunta")} ${i + 1} ${T("de")} ${N}`;
      const a = ctx.c.porId[ids[i]];
      const q = panelPregunta(a, ctx, (ok, txt) => {
        timer?.detener();
        if (ok) { aciertos++; if (lugar[0] > 1) swap(lugar[0], lugar[0] - 1); sonido.motor(); } else if (lugar[0] < 5) swap(lugar[0], lugar[0] + 1);
        i++; colocar(); toast(el, ok, txt, ok ? 1800 : 3200); ctx.luego(preguntar, ok ? 1900 : 3300);
      });
      qb.appendChild(q);
      timer = temporizador(el.querySelector("#tm"), TL, () => q.agotar(), ctx);
    };
    colocar(); preguntar();
  };

  // Elegir coche antes de empezar: "para sentir que tiene su personaje".
  const elegidoAntes = ctx.coche();
  const selector = `<div class="elige">${colores.map((c) => `<button data-c="${c}" class="${c === elegidoAntes ? "sel" : ""}">${coche(c, 3)}<span>${c.toUpperCase()}</span></button>`).join("")}</div>`;
  const ov = inicio(el, T("elige_coche"), () => correr(ctx.coche() ?? colores[0]), selector);
  ov.querySelectorAll(".elige button").forEach((b) => b.onclick = () => { ov.querySelectorAll(".elige button").forEach((x) => x.classList.remove("sel")); b.classList.add("sel"); ctx.setCoche(b.dataset.c); sonido.toque(); });
  return el;
}

// ---------- MONTAÑA: cada acierto sube un escalón, cada error baja ----------
export function montana(s, ctx) {
  const el = marco(s, ctx); const ids = s.ids; const T = ctx.t; const N = ids.length, TL = 25;
  const fondo = escenaMontana(W, H, N, ctx.c.semilla + ctx.cur, TEMAS[s.plantilla] ?? {});
  el.appendChild(h(`<div class="juego"><div class="escena-caja crt" id="caja"></div>${panel(ctx, `<div class="pill" id="st"></div>`)}</div>`));
  fondoPrevio(el, escenaSvg(fondo.svg, W, H, `<g>${capaEscalador(fondo.puntos[0].x - 4, fondo.puntos[0].y - 16)}</g>`));
  const jugar = () => {
    let pos = 0, i = 0, aciertos = 0, timer = null;
    const caja = el.querySelector("#caja");
    const bandera = `<g>${capaIcono("bandera", fondo.puntos[N].x + 4, fondo.puntos[N].y - 12)}</g>`;
    caja.innerHTML = escenaSvg(fondo.svg + bandera, W, H, `<g id="heroe" style="transition:transform .45s cubic-bezier(.3,1.6,.6,1)">${capaEscalador(0, 0)}</g>`) + `<div style="position:absolute;left:12px;top:10px">${hudPill("", "hudst")}</div>`;
    const poner = () => { const p = fondo.puntos[pos]; el.querySelector("#heroe").style.transform = `translate(${p.x - 4}px, ${p.y - 16}px)`; el.querySelector("#st").textContent = `${T("nivel")} ${pos} ${T("de")} ${N}`; el.querySelector("#hudst").textContent = `STEP ${pos}/${N}`; };
    const preguntar = () => {
      const qb = el.querySelector("#qbox"); qb.innerHTML = "";
      if (i >= N) { fin(el, ctx, pos === N ? T("cima") : T("buen_intento"), `${aciertos}/${N}`, T("correctas"), () => ctx.go(ctx.cur), pos === N); return; }
      el.querySelector("#qn").textContent = `${T("pregunta")} ${i + 1} ${T("de")} ${N}`;
      const a = ctx.c.porId[ids[i]];
      const q = panelPregunta(a, ctx, (ok, txt) => {
        timer?.detener();
        if (ok) { aciertos++; pos = Math.min(N, pos + 1); } else { pos = Math.max(0, pos - 1); el.querySelector("#heroe").classList.add("shake"); ctx.luego(() => el.querySelector("#heroe")?.classList.remove("shake"), 500); }
        i++; poner(); toast(el, ok, txt, ok ? 1800 : 3200); ctx.luego(preguntar, ok ? 1900 : 3400);
      });
      qb.appendChild(q);
      timer = temporizador(el.querySelector("#tm"), TL, () => q.agotar(), ctx);
    };
    poner(); preguntar();
  };
  inicio(el, T("start"), jugar);
  return el;
}

// ---------- CASTILLO: el arquero defiende la torre; tres vidas ----------
export function castillo(s, ctx) {
  const el = marco(s, ctx); const T = ctx.t; const TL = 15;
  const fondo = escenaCastillo(W, H, ctx.c.semilla + ctx.cur, TEMAS[s.plantilla] ?? {});
  el.appendChild(h(`<div class="juego"><div class="escena-caja crt" id="caja"></div>${panel(ctx, `<div class="pill" id="st"></div>`)}</div>`));
  fondoPrevio(el, escenaSvg(fondo.svg, W, H, `<g>${capaArquero(fondo.torreX - 20, fondo.torreTop - 14)}</g>`));
  const jugar = (ids) => {
    let i = 0, aciertos = 0, vidas = 3, timer = null;
    const N = ids.length;
    const caja = el.querySelector("#caja");
    caja.innerHTML = escenaSvg(fondo.svg, W, H, `<g>${capaArquero(fondo.torreX - 20, fondo.torreTop - 14)}</g><g id="soldados"></g><g id="flecha" style="opacity:0;transition:transform .25s linear,opacity .1s">${capaIcono("flecha", 0, 0)}</g>`) + `<div style="position:absolute;left:12px;top:10px;display:flex;gap:8px;align-items:center">${hudPill("", "hudsc")}<span class="vidas" id="vidas"></span></div>`;
    const pintarVidas = () => { el.querySelector("#vidas").innerHTML = [0, 1, 2].map((k) => icono(k < vidas ? "corazon" : "corazon_vacio", 3)).join(""); el.querySelector("#hudsc").textContent = `SCORE ${String(aciertos * 100).padStart(4, "0")}`; el.querySelector("#st").textContent = `${T("vidas")}: ${vidas} · ${aciertos} ✓`; };
    const preguntar = () => {
      const qb = el.querySelector("#qbox"); qb.innerHTML = "";
      if (i >= N) { fin(el, ctx, T("castillo_ok"), `${aciertos}/${N}`, T("correctas"), () => ctx.go(ctx.cur), aciertos >= N / 2); return; }
      el.querySelector("#qn").textContent = `${T("pregunta")} ${i + 1} ${T("de")} ${N}`;
      // entra un soldado y camina hacia la torre durante el tiempo de la pregunta
      const sold = gSvg(capaSoldado(0, 0), `transform:translate(${W - 12}px, ${fondo.suelo - 16}px);transition:transform ${TL}s linear, opacity .4s`);
      const g = el.querySelector("#soldados"); g.innerHTML = ""; g.appendChild(sold);
      requestAnimationFrame(() => requestAnimationFrame(() => { sold.style.transform = `translate(${fondo.torreX + 2}px, ${fondo.suelo - 16}px)`; }));
      const a = ctx.c.porId[ids[i]];
      const q = panelPregunta(a, ctx, (ok, txt) => {
        timer?.detener();
        const sx = sold.getBoundingClientRect ? null : null;
        if (ok) {
          aciertos++;
          const fl = el.querySelector("#flecha"); const m = new DOMMatrix(getComputedStyle(sold).transform); const destino = m.m41;
          fl.style.transition = "none"; fl.style.transform = `translate(${fondo.torreX - 8}px, ${fondo.torreTop - 4}px)`; fl.style.opacity = "1";
          requestAnimationFrame(() => { fl.style.transition = "transform .3s linear, opacity .2s"; fl.style.transform = `translate(${destino}px, ${fondo.suelo - 10}px)`; });
          sold.style.transition = "transform .3s, opacity .5s"; sold.style.transform = `translate(${destino}px, ${fondo.suelo - 16}px)`;
          ctx.luego(() => { sold.style.transform = `translate(${destino}px, ${fondo.suelo - 4}px) rotate(80deg)`; sold.style.opacity = "0"; fl.style.opacity = "0"; }, 300);
        } else {
          vidas--; sold.style.transition = "transform .3s, opacity .4s"; sold.style.transform = `translate(${fondo.torreX + 2}px, ${fondo.suelo - 16}px)`; sold.style.opacity = "0";
          el.querySelector("#caja").classList.add("shake"); ctx.luego(() => el.querySelector("#caja")?.classList.remove("shake"), 500);
        }
        i++; pintarVidas(); toast(el, ok, txt, ok ? 1800 : 3200);
        if (vidas <= 0) { ctx.luego(() => gameOver(el, ctx, aciertos * 100, s.blk + 1, () => jugar(mezclar(ids))), 1500); return; }
        ctx.luego(preguntar, ok ? 1900 : 3400);
      });
      qb.appendChild(q);
      timer = temporizador(el.querySelector("#tm"), TL, () => q.agotar(), ctx);
    };
    pintarVidas(); preguntar();
  };
  inicio(el, T("start"), () => jugar(s.ids.slice()));
  return el;
}

// ---------- SWIPE: verdadero a la derecha, falso a la izquierda ----------
export function swipe(s, ctx) {
  const el = marco(s, ctx); const T = ctx.t; const items = s.items; let i = 0, aciertos = 0;
  el.classList.add("pl-" + (s.plantilla ?? "arcade"));
  el.appendChild(h(`<div class="cuerpo" style="display:flex;flex-direction:column;align-items:center;gap:14px"><div class="swipe-marcas"><span style="color:var(--mal)">👈 ${esc(T("falso")).toUpperCase()}</span><span class="pill" id="cnt"></span><span style="color:var(--ok)">${esc(T("verdadero")).toUpperCase()} 👉</span></div><div class="mazo" id="mazo"></div><div style="display:flex;gap:16px"><button class="btn mal" id="bf">✗ ${esc(T("falso"))}</button><button class="btn ok" id="bt">✓ ${esc(T("verdadero"))}</button></div></div>`));
  const mazo = el.querySelector("#mazo");
  const sig = () => {
    mazo.innerHTML = ""; el.querySelector("#cnt").textContent = `${Math.min(i + 1, items.length)} ${T("de")} ${items.length}`;
    if (i >= items.length) { fin(el, ctx, "Swipe master!", `${aciertos}/${items.length}`, T("correctas"), () => ctx.go(ctx.cur), aciertos >= items.length * .7); return; }
    const a = items[i];
    const c = h(`<div class="carta-swipe"><div class="em">${esc(a.emoji ?? "🤔")}</div><div class="afirmacion">${esc(a.afirmacion)}</div>${a.afirmacion_apoyo ? `<div style="color:var(--gris);font-style:italic">${esc(a.afirmacion_apoyo)}</div>` : ""}</div>`);
    mazo.appendChild(c);
    let hecho = false;
    const juzgar = (v) => { if (hecho) return; hecho = true; const ok = v === !!a.es_verdadera; ctx.registrar(a.id, ok); if (ok) aciertos++; c.style.transition = "transform .4s, opacity .4s"; c.style.transform = `translateX(${v ? 700 : -700}px) rotate(${v ? 25 : -25}deg)`; c.style.opacity = 0; toast(el, ok, ok ? a.retro_correcta : a.retro_incorrecta, ok ? 1800 : 3200); i++; ctx.luego(sig, ok ? 900 : 2400); };
    el.querySelector("#bt").onclick = () => juzgar(true); el.querySelector("#bf").onclick = () => juzgar(false);
    c.addEventListener("pointerdown", (e) => { e.preventDefault(); c.setPointerCapture(e.pointerId); const sx = e.clientX;
      const mv = (ev) => { const dx = (ev.clientX - sx) / ctx.escala(); c.style.transform = `translateX(${dx}px) rotate(${dx / 18}deg)`; c.style.borderColor = dx > 40 ? "var(--ok)" : dx < -40 ? "var(--mal)" : "var(--p-suave)"; };
      const up = (ev) => { c.removeEventListener("pointermove", mv); c.removeEventListener("pointerup", up); const dx = (ev.clientX - sx) / ctx.escala(); if (Math.abs(dx) > 120) juzgar(dx > 0); else { c.style.transition = "transform .25s"; c.style.transform = ""; ctx.luego(() => c.style.transition = "", 260); } };
      c.addEventListener("pointermove", mv); c.addEventListener("pointerup", up); });
  };
  sig(); return el;
}

// ---------- SÚPER DATO: arrastra cada palabra a su hueco ----------
export function superdato(s, ctx) {
  const el = marco(s, ctx); const T = ctx.t; const a = s.a; const resp = []; let k = 0;
  el.classList.add("pl-" + (s.plantilla ?? "laboratorio"));
  const html = esc(a.texto ?? "").replace(/\[\[(.+?)\]\]/g, (m, w) => { resp.push(w); return `<span class="drop hueco" data-i="${k++}"></span>`; });
  let faltan = resp.length, fallos = 0;
  const body = h(`<div class="cuerpo" style="display:flex;flex-direction:column;gap:16px"><div class="superdato-texto">${html}</div><div style="display:flex;gap:14px;align-items:flex-start"><div style="background:var(--oro);color:#fff;border-radius:14px;padding:10px 14px;font:800 20px var(--titulos);flex:none">⭐ Súper dato</div><div class="banco" id="banco"></div></div><div class="ayuda" style="color:var(--gris)">${esc(T("banco"))}</div></div>`);
  el.appendChild(body);
  mezclar([...resp, ...(a.distractores ?? [])]).forEach((w) => {
    const c = h(`<div>${esc(w)}</div>`); c.dataset.w = w;
    arrastrable(c, ctx, (c, zona) => { if (zona.children.length || !zona.classList.contains("hueco")) return false; const quiere = resp[+zona.dataset.i];
      if (c.dataset.w === quiere) { zona.appendChild(c); c.classList.add("locked"); zona.classList.add("ok"); zona.style.minWidth = "0"; toast(el, true, "✓ " + quiere, 1500); if (!--faltan) { ctx.registrar(a.id, fallos === 0); ctx.luego(() => fin(el, ctx, "⭐ Súper dato", fallos ? `${fallos} ✗` : T("perfecto"), "", () => ctx.go(ctx.cur), fallos === 0), 900); } return true; }
      fallos++; toast(el, false, `${T("respuesta")}: “${quiere}”`, 2800); return false; });
    body.querySelector("#banco").appendChild(c);
  });
  return el;
}

// ---------- MIX & MATCH: arrastra el término a su definición (o el retrato a su nombre) ----------
export function match(s, ctx) {
  const el = marco(s, ctx); const T = ctx.t; const a = s.a; const pares = a.pares ?? []; let faltan = pares.length, fallos = 0;
  el.classList.add("pl-" + (s.plantilla ?? "planeta"));
  if ((s.plantilla ?? "planeta") === "planeta" || s.plantilla === "luna" || s.plantilla === "estacion") {
    const f = escenaPlaneta(W, H, ctx.c.semilla + ctx.cur, s.plantilla === "luna" ? { cielo: "#111827", suelo: "#9ca3af", borde: "#e5e7eb", roca: "#6b7280" } : s.plantilla === "estacion" ? { cielo: "#0f172a", suelo: "#1e3a8a", borde: "#60a5fa", roca: "#1d4ed8" } : {});
    el.appendChild(h(`<div style="position:absolute;inset:0;opacity:.35">${escenaSvg(f.svg, W, H, `<g>${capaSparky("saludo", 8, f.suelo - 20)}</g>`)}</div>`));
  }
  const body = h(`<div class="cuerpo match"><div class="izq" id="L"></div><div class="der" id="R"></div></div>`); el.appendChild(body);
  mezclar(pares).forEach((p) => body.querySelector("#R").appendChild(h(`<div class="fila"><div class="drop" data-k="${esc(p.termino)}"></div>${p.imagen && !s.retratos ? `<img class="retrato-chico" src="${esc(p.imagen)}" alt="">` : ""}<div class="def">${esc(p.definicion)}</div></div>`)));
  mezclar(pares).forEach((p) => { const c = h(p.imagen && s.retratos ? `<div style="display:flex;align-items:center;gap:8px"><img class="retrato-chico" src="${esc(p.imagen)}" alt="">${esc(p.termino)}</div>` : `<div>${esc(p.termino)}</div>`); c.dataset.k = p.termino;
    arrastrable(c, ctx, (c, zona) => { if (zona.children.length || !zona.dataset.k) return false; if (zona.dataset.k === c.dataset.k) { zona.appendChild(c); zona.classList.add("ok"); zona.style.borderStyle = "solid"; c.classList.add("locked"); toast(el, true, `${p.termino} = ${p.definicion}`, 1600); if (!--faltan) { ctx.registrar(a.id, fallos === 0); ctx.luego(() => fin(el, ctx, "🧩 Mix & match", fallos ? `${fallos} ✗` : T("perfecto"), "", () => ctx.go(ctx.cur), fallos === 0), 800); } return true; } fallos++; toast(el, false, `${p.termino} = ${p.definicion}`, 2800); return false; });
    body.querySelector("#L").appendChild(c); });
  return el;
}

// ---------- SUPER SORT: dos grupos ----------
export function sort(s, ctx) {
  const el = marco(s, ctx); const T = ctx.t; const a = s.a; let faltan = (a.elementos ?? []).length, fallos = 0; const gc = ["var(--b1)", "var(--b3)"];
  el.classList.add("pl-" + (s.plantilla ?? "naves"));
  const body = h(`<div class="cuerpo sort"><div class="pila" id="pila"></div><div class="grupos">${(a.grupos ?? []).slice(0, 2).map((g, i) => `<div class="drop grupo" data-g="${i}" style="--g:${gc[i]}"><h3>${esc(g)}</h3></div>`).join("")}</div></div>`); el.appendChild(body);
  mezclar(a.elementos ?? []).forEach((it) => { const c = h(`<div>${esc(it.texto)}</div>`);
    arrastrable(c, ctx, (c, zona) => { if (!zona.classList.contains("grupo")) return false; if (+zona.dataset.g === it.grupo) { zona.appendChild(c); c.classList.add("locked"); toast(el, true, `“${it.texto}” → ${a.grupos[it.grupo]}`, 1500); if (!--faltan) { ctx.registrar(a.id, fallos === 0); ctx.luego(() => fin(el, ctx, "🗂️ Super sort", fallos ? `${fallos} ✗` : T("perfecto"), "", () => ctx.go(ctx.cur), fallos === 0), 800); } return true; } fallos++; toast(el, false, `“${it.texto}” → ${a.grupos[it.grupo]}`, 2800); return false; });
    body.querySelector("#pila").appendChild(c); });
  return el;
}

// ---------- RANK ORDER: casillas numeradas ----------
export function rank(s, ctx) {
  const el = marco(s, ctx); const T = ctx.t; const a = s.a; const pasos = a.pasos ?? [];
  el.classList.add("pl-" + (s.plantilla ?? "cohetes"));
  const body = h(`<div class="cuerpo rank"><div class="casillas">${pasos.map((_, i) => `<div class="casilla"><b>${i + 1}</b><div class="drop" data-i="${i}"></div></div>`).join("")}<button class="btn" id="chk" style="align-self:flex-start">${esc(T("revisar"))}</button></div><div class="pool drop" id="pool"></div></div>`); el.appendChild(body);
  const pool = body.querySelector("#pool");
  mezclar(pasos).forEach((p) => { const c = h(`<div>${esc(p.emoji ?? "")} ${esc(p.texto)}</div>`); c.__p = p; pool.appendChild(c);
    arrastrable(c, ctx, (c, zona) => { if (zona.id === "pool") { pool.appendChild(c); return true; } if (!("i" in zona.dataset)) return false; if (zona.children.length) pool.appendChild(zona.firstElementChild); zona.appendChild(c); return true; }); });
  let intentos = 0;
  body.querySelector("#chk").onclick = () => {
    const slots = [...body.querySelectorAll(".drop[data-i]")];
    if (slots.some((z) => !z.firstElementChild)) { toast(el, false, "⬇️", 1500); return; }
    let ok = true; slots.forEach((z, i) => { const bien = z.firstElementChild.__p === pasos[i]; ok = ok && bien; z.style.borderStyle = "solid"; z.style.borderColor = bien ? "var(--ok)" : "var(--mal)"; });
    if (intentos++ === 0) ctx.registrar(a.id, ok);
    if (ok) { toast(el, true, a.por_que ?? a.retro_correcta ?? "✓", 2200); ctx.luego(() => fin(el, ctx, "🔢 Rank order", "✓", esc(a.por_que ?? ""), () => ctx.go(ctx.cur), true), 1200); }
    else toast(el, false, (a.por_que ? a.por_que + " · " : "") + pasos.map((p) => String(p.texto).split(":")[0]).join(" → "), 4500);
  };
  return el;
}

// ---------- RULETA: solo en el reto final ----------
export function ruleta(s, ctx) {
  const el = marco(s, ctx); const T = ctx.t; const ids = s.ids; const vals = [100, 300, 200, 500, 100, 400, 200, 800];
  const cols = ["#7c3aed", "#f59e0b", "#0ea5e9", "#db2777", "#16a34a", "#ea580c", "#4338ca", "#dc2626"]; const seg = 360 / vals.length, R0 = 230;
  el.classList.add("pl-" + (s.plantilla ?? "luces"));
  const arco = (k) => { const a0 = (k * seg - 90) * Math.PI / 180, a1 = ((k + 1) * seg - 90) * Math.PI / 180; return `M0,0 L${R0 * Math.cos(a0)},${R0 * Math.sin(a0)} A${R0},${R0} 0 0 1 ${R0 * Math.cos(a1)},${R0 * Math.sin(a1)} Z`; };
  const luces = Array.from({ length: 24 }, (_, k) => { const an = k * 15 * Math.PI / 180; return `<circle cx="${(243 * Math.cos(an)).toFixed(1)}" cy="${(243 * Math.sin(an)).toFixed(1)}" r="5" fill="${k % 2 ? "#fde047" : "#fff"}"><animate attributeName="opacity" values="1;.3;1" dur="${k % 2 ? 1 : 1.4}s" repeatCount="indefinite"/></circle>`; }).join("");
  el.appendChild(h(`<div class="juego" style="grid-template-columns:560px 1fr"><div class="ruleta-caja"><svg id="wh" viewBox="-252 -252 504 504" width="500" height="500"><g id="rot">${vals.map((v, k) => `<path d="${arco(k)}" fill="${cols[k]}" stroke="#fff" stroke-width="4"/><text transform="rotate(${k * seg + seg / 2}) translate(0,-160)" text-anchor="middle" fill="#fff" font-size="34" font-weight="800" font-family="Bricolage Grotesque, sans-serif">${v}</text>`).join("")}<circle r="40" fill="#fff"/><text y="12" text-anchor="middle" font-size="34">⭐</text></g><circle r="236" fill="none" stroke="#1e1530" stroke-width="10"/>${luces}</svg><div class="ruleta-flecha"></div></div>
    <div class="panel-q"><div style="display:flex;gap:10px"><span class="pill" id="pts">0 ${esc(T("puntos"))}</span><span class="pill" id="qn">${esc(T("ronda"))} 1 ${esc(T("de"))} ${ids.length}</span></div><div id="qbox"><div class="qcard"><div class="q">✋ ${esc(T("gira"))}</div><button class="btn" id="spin">${esc(T("o_toca"))}</button></div></div></div></div>`));
  const rot = el.querySelector("#rot"), svg = el.querySelector("#wh"); let ang = 0, vel = 0, girando = false, i = 0, pts = 0, listo = true, premio = 0;
  const setA = () => rot.setAttribute("transform", `rotate(${ang})`);
  const centro = (e) => { const r = svg.getBoundingClientRect(); return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180 / Math.PI; };
  const girar = (v) => { if (!listo || girando) return; girando = true; vel = v; let lt = 0; const st = (t) => { if (!lt) lt = t; const dt = (t - lt) / 1000; lt = t; ang += vel * dt; vel *= Math.pow(0.25, dt); setA(); if (Math.abs(vel) > 8) ctx.raf(requestAnimationFrame(st)); else { girando = false; aterrizar(); } }; ctx.raf(requestAnimationFrame(st)); };
  const aterrizar = () => { const a = ((-ang % 360) + 360) % 360; premio = vals[Math.floor(a / seg) % vals.length]; listo = false; sonido.moneda(); preguntar(); };
  const preguntar = () => { const qb = el.querySelector("#qbox"); qb.innerHTML = ""; const a = ctx.c.porId[ids[i]]; qb.appendChild(h(`<div class="pill" style="align-self:flex-start;background:#fef3c7;font-size:18px">🎯 ${esc(T("vale"))} <b>${premio}</b> ${esc(T("puntos"))}</div>`));
    qb.appendChild(panelPregunta(a, ctx, (ok, txt) => { if (ok) pts += premio; el.querySelector("#pts").textContent = `${pts} ${T("puntos")}`; ctx.reto = pts; toast(el, ok, txt, ok ? 1800 : 3200); i++; ctx.luego(() => { if (i >= ids.length) { fin(el, ctx, "🏆 " + T("reto"), String(pts), `${T("puntos")} · ${ids.filter((x) => ctx.resultados[x]).length}/${ids.length} ✓`, () => ctx.go(ctx.cur), true); return; } el.querySelector("#qn").textContent = `${T("ronda")} ${i + 1} ${T("de")} ${ids.length}`; qb.innerHTML = `<div class="qcard"><div class="q">✋ ${esc(T("gira"))}</div></div>`; listo = true; }, ok ? 1900 : 3300); })); };
  let drag = null;
  svg.addEventListener("pointerdown", (e) => { if (!listo || girando) return; e.preventDefault(); svg.setPointerCapture(e.pointerId); drag = { a: centro(e), t: performance.now(), v: 0 }; });
  svg.addEventListener("pointermove", (e) => { if (!drag) return; const a = centro(e); let d = a - drag.a; if (d > 180) d -= 360; if (d < -180) d += 360; const t = performance.now(); ang += d; setA(); drag.v = d / Math.max(1, t - drag.t) * 1000; drag.a = a; drag.t = t; });
  svg.addEventListener("pointerup", () => { if (!drag) return; let v = drag.v; drag = null; if (Math.abs(v) < 300) v = (v < 0 ? -1 : 1) * (600 + Math.random() * 500); girar(Math.max(-1800, Math.min(1800, v))); });
  el.querySelector("#spin").onclick = () => girar(700 + Math.random() * 700);
  return el;
}

// ---------- MINI-EXAMEN: una pregunta a la vez, calificación /10 y lista de repaso ----------
export function quiz(s, ctx) {
  const el = marco(s, ctx); const T = ctx.t; const ids = s.ids; let i = 0, aciertos = 0; const malas = [];
  el.classList.add("pl-" + (s.plantilla ?? "consola"));
  const body = h(`<div class="cuerpo quiz"><div id="qbox" style="display:flex;flex-direction:column;gap:14px"></div><div class="marcador"><div class="qcard" style="align-items:center;text-align:center"><div style="font-weight:700;color:var(--gris)">Score</div><div id="sc" style="font:800 54px var(--titulos);color:var(--p)">0</div><div class="puntos" id="pr"></div></div><div class="qcard" style="background:var(--oro-suave);border:3px solid var(--oro)"><b style="color:#b45309">📝</b><div style="font-size:16px">${esc(T("calificacion"))}: /10</div></div></div></div>`); el.appendChild(body);
  const dots = body.querySelector("#pr"); ids.forEach(() => dots.appendChild(h("<i></i>")));
  const mostrar = () => { const qb = body.querySelector("#qbox"); qb.innerHTML = "";
    if (i >= ids.length) { const g = Math.round(100 * aciertos / ids.length) / 10; ctx.minis[ctx.cur] = g; ctx.guardar(); fin(el, ctx, T("calificacion"), `${g}/10`, malas.length ? `<div style="text-align:left;max-width:640px;font-size:16px"><b>${esc(T("repasa"))}</b>${malas.map((a) => `<div>• ${esc(a.pregunta ?? a.afirmacion ?? a.enunciado)} → <b style="color:var(--ok)">${esc(a.tipo === "verdadero_falso" ? (a.es_verdadera ? T("verdadero") : T("falso")) : a.tipo === "completar" ? a.respuesta : a.opciones?.[a.correcta])}</b></div>`).join("")}</div>` : esc(T("perfecto")), () => ctx.go(ctx.cur), g >= 7); return; }
    const a = ctx.c.porId[ids[i]]; qb.appendChild(h(`<div class="pill" style="align-self:flex-start">${esc(T("pregunta"))} ${i + 1} ${esc(T("de"))} ${ids.length}</div>`));
    const card = panelPregunta(a, ctx, (ok, txt) => { if (ok) aciertos++; else malas.push(a); dots.children[i].style.background = ok ? "var(--ok)" : "var(--mal)"; body.querySelector("#sc").textContent = aciertos; ok ? sonido.bien() : sonido.mal();
      card.appendChild(h(`<div class="retro ${ok ? "ok" : "mal"}">${esc(txt)}</div>`)); const nb = h(`<button class="btn" style="align-self:flex-end">${i + 1 < ids.length ? esc(T("siguiente")).replace("↓", "→") : esc(T("calificacion"))}</button>`); nb.onclick = () => { i++; mostrar(); }; card.appendChild(nb); });
    qb.appendChild(card); };
  mostrar(); return el;
}
