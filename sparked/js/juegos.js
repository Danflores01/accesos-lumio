// Los juegos del estante (Documento 2 + mecánicas que pidió Daniel): carrera, montaña, castillo, swipe, súper dato,
// mix & match, super sort, rank order, ruleta y mini-examen. Todos se califican solos y dan retroalimentación al instante.
// Versión "videojuego actual" (6 nov 2026): movimiento continuo, motor que acelera, saltos, flechas en arco, parejas
// que se juntan con animación y todo se puede jugar tocando (tarjeta → destino) o arrastrando.
import { esc, h, mezclar, toast, inicio, fin, gameOver, arrastrable, panelPregunta, temporizador } from "./ui.js";
import { marco } from "./teoria.js";
import { sonido } from "./sonido.js";
import { escenaCiudad, escenaMontana, escenaCastillo, escenaPlaneta, escenaSvg, capaCoche, capaEscalador, capaSoldado, capaArquero, capaIcono, capaSparky, coche, icono, COLORES_DE_COCHE } from "./arte.js";

const W = 172, H = 140;
const TEMAS = {
  ciudad_neon: {}, formula1: { cielo1: "#38BDF8", cielo2: "#BAE6FD", cielo3: "#FDE68A", estrellas: false, sol: false, edif1: "#E11D48", edif2: "#F8FAFC", ventana: "#1F2937", ventana2: "#64748B", neon: "#111827", carretera: "#374151", linea: "#F8FAFC", borde: "#EF4444" },
  callejera: { cielo1: "#3B0A0A", cielo2: "#9A3412", cielo3: "#F97316", estrellas: true, edif1: "#431407", edif2: "#7C2D12", ventana: "#FDE68A", ventana2: "#FB923C", neon: "#FB923C", carretera: "#1C1917", linea: "#FBBF24", borde: "#F97316" },
  nevada: {}, volcan: { cielo1: "#3B0A0A", cielo2: "#7F1D1D", cielo3: "#F97316", fondo1: "#7F1D1D", fondo2: "#991B1B", roca: "#44403C", rocaOscura: "#1C1917", nieve: "#F97316", pasto: "#57534E", pastoOscuro: "#292524", sol: "#FCA5A5" },
  aurora: { cielo1: "#052E16", cielo2: "#065F46", cielo3: "#34D399", fondo1: "#065F46", fondo2: "#047857", roca: "#365314", rocaOscura: "#1A2E05", nieve: "#A7F3D0", pasto: "#86EFAC", pastoOscuro: "#166534", sol: "#D9F99D" },
  noche: {}, amanecer: { cielo1: "#FDBA74", cielo2: "#FDE68A", cielo3: "#BAE6FD", luna: "#FFF7ED", colinas: "#9A3412", colinas2: "#C2410C", suelo: "#65A30D", piedra: "#A8A29E", piedra2: "#D6D3D1", piedraOscura: "#78716C" },
  dragon: { cielo1: "#1C0A0A", cielo2: "#450A0A", cielo3: "#B91C1C", luna: "#EF4444", colinas: "#450A0A", colinas2: "#7F1D1D", suelo: "#3F3F46", piedra: "#52525B", piedra2: "#71717A", piedraOscura: "#27272A" },
};

const hudPill = (txt, id = "", px = false) => `<span class="hud-pill ${px ? "px" : ""}" ${id ? `id="${id}"` : ""}>${txt}</span>`;
// Un <g> de SVG de verdad (crearlo con innerHTML en un div lo volvería un elemento HTML que no se dibuja).
function gSvg(inner, style = "") { const g = document.createElementNS("http://www.w3.org/2000/svg", "g"); if (style) g.setAttribute("style", style); g.innerHTML = inner; return g; }
// Fondo de la escena visible desde antes de START.
function fondoPrevio(el, svg) { const caja = el.querySelector("#caja"); if (caja) caja.innerHTML = svg; }
const panel = (ctx, extra = "") => `<div class="panel-q"><div class="barra-tiempo"><i id="tm"></i></div><div class="pill" id="qn"></div><div id="qbox"></div>${extra}</div>`;
// Pantalla de instrucciones (estilo Lumio) antes de cada actividad, con el texto propio de ese juego.
const arranque = (el, T, clave, fn, extra = "") => inicio(el, T("instr_" + clave), fn, extra, { titulo: T("como_jugar"), boton: T("iniciar") });
// Bucle de animación que se apaga solo cuando la slide se quita de la pantalla.
function bucle(el, ctx, paso) {
  let lt = 0;
  const tick = (t) => { if (!el.isConnected) { paso(0, t, true); return; } const dt = lt ? Math.min(.05, (t - lt) / 1000) : 0; lt = t; if (paso(dt, t, false) !== false) ctx.raf(requestAnimationFrame(tick)); };
  ctx.raf(requestAnimationFrame(tick));
}
const suave = (t) => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
// Juego por toques: una tarjeta seleccionada espera a que se toque un destino.
function seleccion(el) {
  let activa = null;
  const zonas = () => [...el.querySelectorAll(".drop")];
  const limpiar = () => { activa?.classList.remove("sel"); activa = null; zonas().forEach((z) => z.classList.remove("listo")); };
  return {
    get activa() { return activa; },
    elegir(c) { if (activa === c) { limpiar(); return; } limpiar(); activa = c; c.classList.add("sel"); zonas().forEach((z) => { if (!z.children.length) z.classList.add("listo"); }); sonido.toque(); },
    limpiar,
    enZona(zona, onDrop) { if (!activa) return; const c = activa; limpiar(); const ok = onDrop(c, zona); if (!ok) { zona.classList.add("mal"); setTimeout(() => zona.classList.remove("mal"), 450); } },
  };
}
const juntar = (c, zona) => { zona.appendChild(c); c.classList.add("locked", "pop"); zona.classList.add("ok"); zona.classList.remove("listo"); sonido.pop(); setTimeout(() => c.classList.remove("pop"), 450); };

// ---------- CARRERA: los coches corren todo el tiempo; acierto = acelerón y rebase, error = te rebasan ----------
export function carrera(s, ctx) {
  const el = marco(s, ctx); const ids = s.ids; const T = ctx.t; const N = ids.length;
  const tema = { ...(TEMAS[s.plantilla] ?? {}), carriles: 5 };
  const fondo = escenaCiudad(W, H, ctx.c.semilla + ctx.cur, tema);
  const colores = COLORES_DE_COCHE.slice(0, 5);
  el.appendChild(h(`<div class="juego"><div class="escena-caja" id="caja"></div>${panel(ctx, `<div class="pill" id="pos"></div>`)}</div>`));
  fondoPrevio(el, escenaSvg(fondo.svg, W, H));
  const TL = s.calentamiento ? 12 : 10;

  const correr = (elegido) => {
    const rivales = colores.filter((c) => c !== elegido).slice(0, 4);
    const coches = [elegido, ...rivales];
    let lugar = [5, 1, 2, 3, 4]; // el jugador arranca al final
    let i = 0, aciertos = 0, timer = null, terminado = false;
    const caja = el.querySelector("#caja");
    const capas = coches.map((c, k) => `<g id="c${k}">${capaCoche(c, 0, 0)}${k === 0 ? `<rect x="6" y="-4.6" width="12" height="3.4" rx="1.4" fill="#FFD400" stroke="#2A2340" stroke-width=".5"/><text x="12" y="-2" font-size="2.6" font-weight="800" fill="#2A2340" text-anchor="middle" font-family="Outfit, Arial, sans-serif">TÚ</text>` : ""}</g>`).join("");
    const meta = `<defs><pattern id="cuadros" width="3" height="3" patternUnits="userSpaceOnUse"><rect width="1.5" height="1.5" fill="#fff"/><rect x="1.5" y="1.5" width="1.5" height="1.5" fill="#fff"/><rect x="1.5" width="1.5" height="1.5" fill="#2A2340"/><rect y="1.5" width="1.5" height="1.5" fill="#2A2340"/></pattern></defs><rect x="151" y="${fondo.suelo + 2}" width="4" height="${H - fondo.suelo - 2}" fill="url(#cuadros)"/>`;
    caja.innerHTML = escenaSvg(fondo.svg + meta, W, H, capas) + `<div style="position:absolute;left:12px;top:10px;display:flex;gap:8px">${hudPill("LAP 1", "lap")}${hudPill("", "hudpos")}</div>`;
    const svg = caja.querySelector("svg");
    const lejos = svg.querySelector("#" + fondo.capas.lejos), cerca = svg.querySelector("#" + fondo.capas.cerca), rayas = svg.querySelector("#" + fondo.capas.rayas);
    const ys = (k) => fondo.suelo + 3 + (k % fondo.carriles) * fondo.alturaCarril;
    const estado = coches.map((_, k) => ({ x: 6 + (5 - lugar[k]) * 8, objetivo: 6 + (5 - lugar[k]) * 8, fase: Math.random() * 6 }));
    let velocidad = 46, impulso = 0, desplazamiento = 0; // unidades por segundo
    const motor = sonido.motorIniciar(); motor.acelerar(.5);
    const objetivo = (final = false) => { const prog = i / N; coches.forEach((c, k) => { estado[k].objetivo = 6 + prog * 112 + (5 - lugar[k]) * 8 + (final ? 36 : 0); }); el.querySelector("#hudpos").textContent = `P${lugar[0]} / 5`; el.querySelector("#pos").textContent = `${T("pregunta")} ${Math.min(i + 1, N)} ${T("de")} ${N} · ${aciertos} ✓`; };
    const swap = (a, b) => { const ka = lugar.indexOf(a), kb = lugar.indexOf(b); lugar[ka] = b; lugar[kb] = a; };
    bucle(el, ctx, (dt, t, fuera) => {
      if (fuera) { motor.detener(); return false; }
      const v = velocidad + impulso; impulso *= Math.pow(.2, dt);
      desplazamiento += v * dt;
      rayas?.setAttribute("transform", `translate(${-(desplazamiento % fondo.periodoRayas)} 0)`);
      cerca?.setAttribute("transform", `translate(${-((desplazamiento * .35) % W)} 0)`);
      lejos?.setAttribute("transform", `translate(${-((desplazamiento * .12) % W)} 0)`);
      coches.forEach((c, k) => { const e = estado[k]; e.x += (e.objetivo - e.x) * Math.min(1, dt * 3.2); const bob = Math.sin(t / 90 + e.fase) * .35; const g = svg.querySelector(`#c${k}`); if (g) g.setAttribute("transform", `translate(${e.x.toFixed(2)} ${(ys(k) - 2 + bob).toFixed(2)})`); });
      return !terminado || t < 0;
    });
    const preguntar = () => {
      const qb = el.querySelector("#qbox"); qb.innerHTML = "";
      if (i >= N) { objetivo(true); impulso = 60; motor.impulso(); const p = lugar[0]; ctx.luego(() => { terminado = true; motor.detener(); fin(el, ctx, p === 1 ? T("ganaste") : p === 2 ? T("segundo") : p === 3 ? T("tercero") : T("sigue"), `${aciertos}/${N}`, T("correctas"), () => ctx.go(ctx.cur), p <= 2); }, 1500); return; }
      el.querySelector("#qn").textContent = `${T("pregunta")} ${i + 1} ${T("de")} ${N}`;
      const a = ctx.c.porId[ids[i]];
      const q = panelPregunta(a, ctx, (ok, txt) => {
        timer?.detener();
        if (ok) { aciertos++; if (lugar[0] > 1) swap(lugar[0], lugar[0] - 1); impulso = 70; motor.impulso(); }
        else { if (lugar[0] < 5) swap(lugar[0], lugar[0] + 1); impulso = -22; motor.frenar(); }
        i++; objetivo(); toast(el, ok, txt, ok ? 1800 : 3200); ctx.luego(preguntar, ok ? 1900 : 3300);
      });
      qb.appendChild(q);
      timer = temporizador(el.querySelector("#tm"), TL, () => q.agotar(), ctx);
    };
    objetivo(); preguntar();
  };

  // Elegir coche antes de empezar: "para sentir que tiene su personaje".
  const elegidoAntes = ctx.coche();
  const selector = `<div class="elige">${colores.map((c) => `<button data-c="${c}" class="${c === elegidoAntes ? "sel" : ""}">${coche(c, 3)}<span>${c.toUpperCase()}</span></button>`).join("")}</div>`;
  const ov = arranque(el, T, "carrera", () => correr(ctx.coche() ?? colores[0]), `<div class="ayuda" style="font-weight:800;color:#2A2340">${esc(T("elige_coche"))}</div>${selector}`);
  ov.querySelectorAll(".elige button").forEach((b) => b.onclick = () => { ov.querySelectorAll(".elige button").forEach((x) => x.classList.remove("sel")); b.classList.add("sel"); ctx.setCoche(b.dataset.c); sonido.toque(); });
  return el;
}

// ---------- MONTAÑA: plataformas; cada acierto es un salto, cada error un resbalón ----------
export function montana(s, ctx) {
  const el = marco(s, ctx); const ids = s.ids; const T = ctx.t; const N = ids.length, TL = 25;
  const fondo = escenaMontana(W, H, N, ctx.c.semilla + ctx.cur, TEMAS[s.plantilla] ?? {});
  el.appendChild(h(`<div class="juego"><div class="escena-caja" id="caja"></div>${panel(ctx, `<div class="pill" id="st"></div>`)}</div>`));
  const enPunto = (k) => ({ x: fondo.puntos[k].x - 4, y: fondo.puntos[k].y - 16 });
  fondoPrevio(el, escenaSvg(fondo.svg, W, H, `<g transform="translate(${enPunto(0).x} ${enPunto(0).y})">${capaEscalador(0, 0)}</g>`));
  const jugar = () => {
    let pos = 0, i = 0, aciertos = 0, timer = null, puntos = 0;
    const caja = el.querySelector("#caja");
    const bandera = `<g>${capaIcono("bandera", fondo.puntos[N].x + 4, fondo.puntos[N].y - 16)}</g>`;
    caja.innerHTML = escenaSvg(fondo.svg + bandera, W, H, `<g id="estrellas"></g><g id="heroe">${capaEscalador(0, 0)}</g>`) + `<div style="position:absolute;left:12px;top:10px;display:flex;gap:8px">${hudPill("", "hudst")}${hudPill("", "hudpt")}</div>`;
    const svg = caja.querySelector("svg"); const heroe = svg.querySelector("#heroe");
    const hero = { ...enPunto(0), sx: 1, sy: 1 }; let anim = null;
    bucle(el, ctx, (dt, t, fuera) => {
      if (fuera) return false;
      if (anim) { const p = Math.min(1, (t - anim.t0) / anim.dur); const e = suave(p); hero.x = anim.x0 + (anim.x1 - anim.x0) * e; hero.y = anim.y0 + (anim.y1 - anim.y0) * e - anim.alto * Math.sin(Math.PI * p); hero.sx = 1 + .12 * Math.sin(Math.PI * p); hero.sy = 1 - .12 * Math.sin(Math.PI * p); if (p >= 1) { anim.fin?.(); anim = null; } }
      else { hero.sx += (1 - hero.sx) * .2; hero.sy += (1 - hero.sy) * .2; }
      const bob = anim ? 0 : Math.sin(t / 260) * .5;
      heroe.setAttribute("transform", `translate(${hero.x.toFixed(2)} ${(hero.y + bob).toFixed(2)}) translate(6 16) scale(${hero.sx.toFixed(3)} ${hero.sy.toFixed(3)}) translate(-6 -16)`);
      return true;
    });
    const textos = () => { el.querySelector("#st").textContent = `${T("nivel")} ${pos} ${T("de")} ${N}`; el.querySelector("#hudst").textContent = `${pos}/${N}`; el.querySelector("#hudpt").textContent = `★ ${puntos}`; };
    const saltarA = (k, alto, fin2) => { const d = enPunto(k); anim = { t0: performance.now(), dur: alto > 0 ? 560 : 420, x0: hero.x, y0: hero.y, x1: d.x, y1: d.y, alto, fin: fin2 }; };
    const estrellaEn = (k) => { const p = fondo.puntos[k]; const g = gSvg(capaIcono("estrella", p.x + 2, p.y - 30), "transition:transform .9s ease-out, opacity .9s"); svg.querySelector("#estrellas").appendChild(g); requestAnimationFrame(() => requestAnimationFrame(() => { g.style.transform = "translate(0px,-18px)"; g.style.opacity = "0"; })); ctx.luego(() => g.remove(), 1000); };
    const preguntar = () => {
      const qb = el.querySelector("#qbox"); qb.innerHTML = "";
      if (i >= N) { fin(el, ctx, pos === N ? T("cima") : T("buen_intento"), `${aciertos}/${N}`, T("correctas"), () => ctx.go(ctx.cur), pos === N); return; }
      el.querySelector("#qn").textContent = `${T("pregunta")} ${i + 1} ${T("de")} ${N}`;
      const a = ctx.c.porId[ids[i]];
      const q = panelPregunta(a, ctx, (ok, txt) => {
        timer?.detener();
        if (ok) { aciertos++; pos = Math.min(N, pos + 1); sonido.salto(); saltarA(pos, 14, () => { puntos += 10; estrellaEn(pos); sonido.brillo(); textos(); }); }
        else { pos = Math.max(0, pos - 1); sonido.golpe(); heroe.classList.add("shake"); ctx.luego(() => { heroe.classList.remove("shake"); saltarA(pos, -2); }, 350); }
        i++; textos(); toast(el, ok, txt, ok ? 1800 : 3200); ctx.luego(preguntar, ok ? 1900 : 3400);
      });
      qb.appendChild(q);
      timer = temporizador(el.querySelector("#tm"), TL, () => q.agotar(), ctx);
    };
    textos(); preguntar();
  };
  arranque(el, T, "montana", jugar);
  return el;
}

// ---------- CASTILLO: una escuadra avanza hacia la torre; la flecha vuela en arco; tres vidas ----------
export function castillo(s, ctx) {
  const el = marco(s, ctx); const T = ctx.t; const TL = 15;
  const fondo = escenaCastillo(W, H, ctx.c.semilla + ctx.cur, TEMAS[s.plantilla] ?? {});
  el.appendChild(h(`<div class="juego"><div class="escena-caja" id="caja"></div>${panel(ctx, `<div class="pill" id="st"></div>`)}</div>`));
  fondoPrevio(el, escenaSvg(fondo.svg, W, H, `<g>${capaArquero(fondo.torreX - 20, fondo.torreTop - 14)}</g>`));
  const jugar = (ids) => {
    let i = 0, aciertos = 0, vidas = 3, timer = null;
    const N = ids.length;
    const caja = el.querySelector("#caja");
    caja.innerHTML = escenaSvg(fondo.svg, W, H, `<g id="torre-g"><g>${capaArquero(fondo.torreX - 20, fondo.torreTop - 14)}</g></g><g id="soldados"></g><g id="flecha" style="opacity:0">${capaIcono("flecha", 0, 0)}</g><g id="impactos"></g>`) + `<div style="position:absolute;left:12px;top:10px;display:flex;gap:8px;align-items:center">${hudPill("", "hudsc")}<span class="vidas" id="vidas"></span></div>`;
    const svg = caja.querySelector("svg");
    let escuadra = []; let flecha = null; let temblor = 0;
    const pintarVidas = () => { el.querySelector("#vidas").innerHTML = [0, 1, 2].map((k) => icono(k < vidas ? "corazon" : "corazon_vacio", 3)).join(""); el.querySelector("#hudsc").textContent = `${aciertos * 100} pts`; el.querySelector("#st").textContent = `${T("vidas")}: ${vidas} · ${aciertos} ✓`; };
    bucle(el, ctx, (dt, t, fuera) => {
      if (fuera) return false;
      escuadra.forEach((sd) => {
        if (sd.estado === "camina") { sd.x = Math.max(sd.destino, sd.x - sd.vel * dt); sd.paso = (sd.paso + dt * 9) % (Math.PI * 2); }
        else if (sd.estado === "huye") { sd.x += 90 * dt; sd.paso = (sd.paso + dt * 14) % (Math.PI * 2); if (sd.x > W + 10) sd.g.remove(); }
        else if (sd.estado === "cae") { sd.rot = Math.min(90, sd.rot + 420 * dt); sd.op = Math.max(0, sd.op - 1.6 * dt); if (sd.op <= 0) sd.g.remove(); }
        const bob = sd.estado === "cae" ? 0 : Math.abs(Math.sin(sd.paso)) * 1.2;
        sd.g.setAttribute("transform", `translate(${sd.x.toFixed(2)} ${(fondo.suelo - 16 - bob).toFixed(2)}) rotate(${(sd.rot ?? 0).toFixed(1)} 6 16)`); sd.g.setAttribute("opacity", (sd.op ?? 1).toFixed(2));
      });
      if (flecha) { const p = Math.min(1, (t - flecha.t0) / flecha.dur); const x = flecha.x0 + (flecha.x1 - flecha.x0) * p, y = flecha.y0 + (flecha.y1 - flecha.y0) * p - 22 * Math.sin(Math.PI * p); const ang = Math.atan2((flecha.y1 - flecha.y0) / flecha.dur - 22 * Math.PI * Math.cos(Math.PI * p) / flecha.dur, (flecha.x1 - flecha.x0) / flecha.dur) * 180 / Math.PI; const g = svg.querySelector("#flecha"); g.setAttribute("transform", `translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${ang.toFixed(1)} 8 8)`); g.style.opacity = "1"; if (p >= 1) { g.style.opacity = "0"; flecha.fin?.(); flecha = null; } }
      if (temblor > 0) { temblor -= dt; svg.style.transform = `translate(${(Math.random() * 4 - 2).toFixed(1)}px, ${(Math.random() * 4 - 2).toFixed(1)}px)`; } else svg.style.transform = "";
      return true;
    });
    const preguntar = () => {
      const qb = el.querySelector("#qbox"); qb.innerHTML = "";
      if (i >= N) { fin(el, ctx, T("castillo_ok"), `${aciertos}/${N}`, T("correctas"), () => ctx.go(ctx.cur), aciertos >= N / 2); return; }
      el.querySelector("#qn").textContent = `${T("pregunta")} ${i + 1} ${T("de")} ${N}`;
      // entra una escuadra de tres y marcha hacia la torre durante el tiempo de la pregunta
      const g = svg.querySelector("#soldados"); g.innerHTML = ""; escuadra = [];
      [0, 1, 2].forEach((k) => { const sd = { g: gSvg(capaSoldado(0, 0)), x: W - 6 + k * 14, destino: fondo.torreX + 2 + k * 14, vel: 0, paso: k * 1.3, estado: "camina", rot: 0, op: 1 }; sd.vel = (sd.x - sd.destino) / (TL - 1); g.appendChild(sd.g); escuadra.push(sd); });
      const a = ctx.c.porId[ids[i]];
      const q = panelPregunta(a, ctx, (ok, txt) => {
        timer?.detener();
        const lider = escuadra[0];
        if (ok) {
          aciertos++; sonido.whoosh();
          flecha = { t0: performance.now(), dur: 420, x0: fondo.torreX - 10, y0: fondo.torreTop - 6, x1: lider.x - 2, y1: fondo.suelo - 14, fin: () => { lider.estado = "cae"; sonido.golpe(); const im = gSvg(`<circle cx="${lider.x + 6}" cy="${fondo.suelo - 8}" r="2" fill="#FFD400" opacity=".9"><animate attributeName="r" from="2" to="12" dur=".35s" fill="freeze"/><animate attributeName="opacity" from=".9" to="0" dur=".35s" fill="freeze"/></circle>`); svg.querySelector("#impactos").appendChild(im); ctx.luego(() => im.remove(), 500); escuadra.slice(1).forEach((sd) => { sd.estado = "huye"; }); } };
        } else {
          vidas--; escuadra.forEach((sd) => { sd.estado = "camina"; sd.x = sd.destino; }); temblor = .5; sonido.golpe();
          ctx.luego(() => escuadra.forEach((sd) => { sd.estado = "huye"; }), 500);
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
  arranque(el, T, "castillo", () => jugar(s.ids.slice()));
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
    const juzgar = (v) => { if (hecho) return; hecho = true; const ok = v === !!a.es_verdadera; ctx.registrar(a.id, ok); if (ok) aciertos++; sonido.whoosh(); c.style.transition = "transform .45s cubic-bezier(.3,.8,.4,1), opacity .45s"; c.style.transform = `translateX(${v ? 760 : -760}px) rotate(${v ? 28 : -28}deg)`; c.style.opacity = 0; toast(el, ok, ok ? a.retro_correcta : a.retro_incorrecta, ok ? 1800 : 3200); i++; ctx.luego(sig, ok ? 900 : 2400); };
    el.querySelector("#bt").onclick = () => juzgar(true); el.querySelector("#bf").onclick = () => juzgar(false);
    c.addEventListener("pointerdown", (e) => { e.preventDefault(); c.setPointerCapture(e.pointerId); const sx = e.clientX;
      const mv = (ev) => { const dx = (ev.clientX - sx) / ctx.escala(); c.style.transform = `translateX(${dx}px) rotate(${dx / 18}deg)`; c.style.borderColor = dx > 40 ? "var(--ok)" : dx < -40 ? "var(--mal)" : "#2A2340"; };
      const up = (ev) => { c.removeEventListener("pointermove", mv); c.removeEventListener("pointerup", up); const dx = (ev.clientX - sx) / ctx.escala(); if (Math.abs(dx) > 120) juzgar(dx > 0); else { c.style.transition = "transform .3s cubic-bezier(.3,1.5,.6,1)"; c.style.transform = ""; c.style.borderColor = "#2A2340"; ctx.luego(() => c.style.transition = "", 320); } };
      c.addEventListener("pointermove", mv); c.addEventListener("pointerup", up); });
  };
  sig(); arranque(el, T, "swipe", () => {}); return el;
}

// ---------- SÚPER DATO: toca o arrastra cada palabra a su hueco ----------
export function superdato(s, ctx) {
  const el = marco(s, ctx); const T = ctx.t; const a = s.a; const resp = []; let k = 0;
  el.classList.add("pl-" + (s.plantilla ?? "laboratorio"));
  const html = esc(a.texto ?? "").replace(/\[\[(.+?)\]\]/g, (m, w) => { resp.push(w); return `<span class="drop hueco" data-i="${k++}" aria-label="hueco ${k}"></span>`; });
  let faltan = resp.length, fallos = 0;
  const body = h(`<div class="cuerpo" style="display:flex;flex-direction:column;gap:16px"><div class="superdato-texto">${html}</div><div style="display:flex;gap:14px;align-items:flex-start"><div style="background:var(--oro);color:#fff;border-radius:14px;padding:10px 14px;font:800 20px var(--titulos);flex:none;border:3px solid #2A2340;box-shadow:0 5px 0 rgba(42,35,64,.2)">⭐ Súper dato <span id="sdp" style="font-size:15px;opacity:.9"></span></div><div class="banco" id="banco"></div></div><div class="ayuda" style="color:var(--gris)">${esc(T("banco"))} · o toca la palabra y luego el hueco</div></div>`);
  el.appendChild(body);
  const sel = seleccion(body);
  const progreso = () => { body.querySelector("#sdp").textContent = `${resp.length - faltan}/${resp.length}`; };
  const soltar = (c, zona) => {
    if (zona.children.length || !zona.classList.contains("hueco")) return false;
    const quiere = resp[+zona.dataset.i];
    if (c.dataset.w === quiere) { juntar(c, zona); zona.style.minWidth = "0"; toast(el, true, "✓ " + quiere, 1500); faltan--; progreso(); if (!faltan) { ctx.registrar(a.id, fallos === 0); ctx.luego(() => fin(el, ctx, "⭐ Súper dato", fallos ? `${fallos} ✗` : T("perfecto"), "", () => ctx.go(ctx.cur), fallos === 0), 900); } return true; }
    fallos++; toast(el, false, `${T("respuesta")}: “${quiere}”`, 2800); return false;
  };
  mezclar([...resp, ...(a.distractores ?? [])]).forEach((w) => {
    const c = h(`<div>${esc(w)}</div>`); c.dataset.w = w;
    arrastrable(c, ctx, soltar, (c2) => sel.elegir(c2));
    body.querySelector("#banco").appendChild(c);
  });
  body.querySelectorAll(".hueco").forEach((z) => z.addEventListener("click", () => sel.enZona(z, soltar)));
  progreso();
  arranque(el, T, "superdato", () => {});
  return el;
}

// ---------- MIX & MATCH: toca o arrastra el término a su definición (o el retrato a su nombre) ----------
export function match(s, ctx) {
  const el = marco(s, ctx); const T = ctx.t; const a = s.a; const pares = a.pares ?? []; let faltan = pares.length, fallos = 0;
  el.classList.add("pl-" + (s.plantilla ?? "planeta"));
  if ((s.plantilla ?? "planeta") === "planeta" || s.plantilla === "luna" || s.plantilla === "estacion") {
    const f = escenaPlaneta(W, H, ctx.c.semilla + ctx.cur, s.plantilla === "luna" ? { cielo3: "#334155", suelo: "#9CA3AF", sueloOscuro: "#6B7280", borde: "#E5E7EB" } : s.plantilla === "estacion" ? { cielo3: "#1E3A8A", suelo: "#2F6DF6", sueloOscuro: "#1E4FC2", borde: "#93C5FD" } : {});
    el.appendChild(h(`<div style="position:absolute;inset:0;opacity:.4">${escenaSvg(f.svg, W, H, `<g>${capaSparky("saludo", 8, f.suelo - 20)}</g>`)}</div>`));
  }
  const body = h(`<div class="cuerpo match"><div class="izq" id="L"></div><div class="der" id="R"></div></div>`); el.appendChild(body);
  const sel = seleccion(body);
  const soltar = (c, zona) => {
    if (zona.children.length || !zona.dataset.k) return false;
    const p = pares.find((x) => x.termino === c.dataset.k);
    if (zona.dataset.k === c.dataset.k) { juntar(c, zona); zona.style.borderStyle = "solid"; toast(el, true, `${p.termino} = ${p.definicion}`, 1600); if (!--faltan) { ctx.registrar(a.id, fallos === 0); ctx.luego(() => fin(el, ctx, "🧩 Mix & match", fallos ? `${fallos} ✗` : T("perfecto"), "", () => ctx.go(ctx.cur), fallos === 0), 800); } return true; }
    fallos++; toast(el, false, `${p.termino} = ${p.definicion}`, 2800); return false;
  };
  mezclar(pares).forEach((p) => { const fila = h(`<div class="fila"><div class="drop" data-k="${esc(p.termino)}"></div>${p.imagen && !s.retratos ? `<img class="retrato-chico" src="${esc(p.imagen)}" alt="">` : ""}<div class="def">${esc(p.definicion)}</div></div>`); body.querySelector("#R").appendChild(fila); const z = fila.querySelector(".drop"); z.addEventListener("click", () => sel.enZona(z, soltar)); });
  mezclar(pares).forEach((p) => { const c = h(p.imagen && s.retratos ? `<div style="display:flex;align-items:center;gap:8px"><img class="retrato-chico" src="${esc(p.imagen)}" alt="">${esc(p.termino)}</div>` : `<div>${esc(p.termino)}</div>`); c.dataset.k = p.termino;
    arrastrable(c, ctx, soltar, (c2) => sel.elegir(c2));
    body.querySelector("#L").appendChild(c); });
  arranque(el, T, "match", () => {});
  return el;
}

// ---------- SUPER SORT: dos grupos ----------
export function sort(s, ctx) {
  const el = marco(s, ctx); const T = ctx.t; const a = s.a; let faltan = (a.elementos ?? []).length, fallos = 0; const gc = ["var(--b1)", "var(--b3)"];
  el.classList.add("pl-" + (s.plantilla ?? "naves"));
  const body = h(`<div class="cuerpo sort"><div class="pila" id="pila"></div><div class="grupos">${(a.grupos ?? []).slice(0, 2).map((g, i) => `<div class="drop grupo" data-g="${i}" style="--g:${gc[i]}"><h3>${esc(g)}</h3></div>`).join("")}</div></div>`); el.appendChild(body);
  const sel = seleccion(body);
  const soltar = (c, zona) => { if (!zona.classList.contains("grupo")) return false; const it = c.__it; if (+zona.dataset.g === it.grupo) { juntar(c, zona); toast(el, true, `“${it.texto}” → ${a.grupos[it.grupo]}`, 1500); if (!--faltan) { ctx.registrar(a.id, fallos === 0); ctx.luego(() => fin(el, ctx, "🗂️ Super sort", fallos ? `${fallos} ✗` : T("perfecto"), "", () => ctx.go(ctx.cur), fallos === 0), 800); } return true; } fallos++; toast(el, false, `“${it.texto}” → ${a.grupos[it.grupo]}`, 2800); return false; };
  body.querySelectorAll(".grupo").forEach((z) => z.addEventListener("click", (e) => { if (e.target.closest(".card-d")) return; sel.enZona(z, soltar); }));
  mezclar(a.elementos ?? []).forEach((it) => { const c = h(`<div>${esc(it.texto)}</div>`); c.__it = it;
    arrastrable(c, ctx, soltar, (c2) => sel.elegir(c2));
    body.querySelector("#pila").appendChild(c); });
  arranque(el, T, "sort", () => {});
  return el;
}

// ---------- RANK ORDER: casillas numeradas ----------
export function rank(s, ctx) {
  const el = marco(s, ctx); const T = ctx.t; const a = s.a; const pasos = a.pasos ?? [];
  el.classList.add("pl-" + (s.plantilla ?? "cohetes"));
  const body = h(`<div class="cuerpo rank"><div class="casillas">${pasos.map((_, i) => `<div class="casilla"><b>${i + 1}</b><div class="drop" data-i="${i}"></div></div>`).join("")}<button class="btn" id="chk" style="align-self:flex-start">${esc(T("revisar"))}</button></div><div class="pool drop" id="pool"></div></div>`); el.appendChild(body);
  const pool = body.querySelector("#pool");
  const sel = seleccion(body);
  const soltar = (c, zona) => { if (zona.id === "pool") { pool.appendChild(c); return true; } if (!("i" in zona.dataset)) return false; if (zona.children.length) pool.appendChild(zona.firstElementChild); zona.appendChild(c); sonido.pop(); return true; };
  body.querySelectorAll(".drop[data-i]").forEach((z) => z.addEventListener("click", (e) => { if (e.target.closest(".card-d")) return; sel.enZona(z, soltar); }));
  mezclar(pasos).forEach((p) => { const c = h(`<div>${esc(p.emoji ?? "")} ${esc(p.texto)}</div>`); c.__p = p; pool.appendChild(c);
    arrastrable(c, ctx, soltar, (c2) => { if (c2.parentElement !== pool) { pool.appendChild(c2); sonido.toque(); } else sel.elegir(c2); }); });
  let intentos = 0;
  body.querySelector("#chk").onclick = () => {
    const slots = [...body.querySelectorAll(".drop[data-i]")];
    if (slots.some((z) => !z.firstElementChild)) { toast(el, false, "⬇️", 1500); return; }
    let ok = true; slots.forEach((z, i) => { const bien = z.firstElementChild.__p === pasos[i]; ok = ok && bien; z.style.borderStyle = "solid"; z.style.borderColor = bien ? "var(--ok)" : "var(--mal)"; });
    if (intentos++ === 0) ctx.registrar(a.id, ok);
    if (ok) { toast(el, true, a.por_que ?? a.retro_correcta ?? "✓", 2200); ctx.luego(() => fin(el, ctx, "🔢 Rank order", "✓", esc(a.por_que ?? ""), () => ctx.go(ctx.cur), true), 1200); }
    else toast(el, false, (a.por_que ? a.por_que + " · " : "") + pasos.map((p) => String(p.texto).split(":")[0]).join(" → "), 4500);
  };
  arranque(el, T, "rank", () => {});
  return el;
}

// ---------- RULETA: solo en el reto final ----------
export function ruleta(s, ctx) {
  const el = marco(s, ctx); const T = ctx.t; const ids = s.ids; const vals = [100, 300, 200, 500, 100, 400, 200, 800];
  const cols = ["#7C4DFF", "#FFB347", "#27C4B4", "#FF6B9D", "#2BB673", "#FF8A3D", "#2F6DF6", "#E53935"]; const seg = 360 / vals.length, R0 = 230;
  el.classList.add("pl-" + (s.plantilla ?? "luces"));
  const arco = (k) => { const a0 = (k * seg - 90) * Math.PI / 180, a1 = ((k + 1) * seg - 90) * Math.PI / 180; return `M0,0 L${R0 * Math.cos(a0)},${R0 * Math.sin(a0)} A${R0},${R0} 0 0 1 ${R0 * Math.cos(a1)},${R0 * Math.sin(a1)} Z`; };
  const luces = Array.from({ length: 24 }, (_, k) => { const an = k * 15 * Math.PI / 180; return `<circle cx="${(243 * Math.cos(an)).toFixed(1)}" cy="${(243 * Math.sin(an)).toFixed(1)}" r="5" fill="${k % 2 ? "#FFD400" : "#fff"}"><animate attributeName="opacity" values="1;.3;1" dur="${k % 2 ? 1 : 1.4}s" repeatCount="indefinite"/></circle>`; }).join("");
  el.appendChild(h(`<div class="juego" style="grid-template-columns:560px 1fr"><div class="ruleta-caja"><svg id="wh" viewBox="-252 -252 504 504" width="500" height="500"><g id="rot">${vals.map((v, k) => `<path d="${arco(k)}" fill="${cols[k]}" stroke="#fff" stroke-width="4"/><text transform="rotate(${k * seg + seg / 2}) translate(0,-160)" text-anchor="middle" fill="#fff" font-size="36" font-weight="800" font-family="Outfit, Bricolage Grotesque, sans-serif">${v}</text>`).join("")}<circle r="40" fill="#fff" stroke="#2A2340" stroke-width="4"/><text y="12" text-anchor="middle" font-size="34">⭐</text></g><circle r="236" fill="none" stroke="#2A2340" stroke-width="10"/>${luces}</svg><div class="ruleta-flecha"></div></div>
    <div class="panel-q"><div style="display:flex;gap:10px"><span class="pill" id="pts">0 ${esc(T("puntos"))}</span><span class="pill" id="qn">${esc(T("ronda"))} 1 ${esc(T("de"))} ${ids.length}</span></div><div id="qbox"><div class="qcard"><div class="q">✋ ${esc(T("gira"))}</div><button class="btn" id="spin">${esc(T("o_toca"))}</button></div></div></div></div>`));
  const rot = el.querySelector("#rot"), svg = el.querySelector("#wh"); let ang = 0, vel = 0, girando = false, i = 0, pts = 0, listo = true, premio = 0, ultimoTic = 0;
  const setA = () => { rot.setAttribute("transform", `rotate(${ang})`); const sector = Math.floor(((-ang % 360) + 360) % 360 / seg); if (sector !== ultimoTic) { ultimoTic = sector; if (girando) sonido.tic(); } };
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
  arranque(el, T, "ruleta", () => {});
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
  mostrar(); arranque(el, T, "quiz", () => {}); return el;
}
