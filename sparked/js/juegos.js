// Los juegos del estante (Documento 2 + mecánicas que pidió Daniel): carrera, puertas, montaña, castillo, verdadero o
// falso express, súper dato, mix & match, super sort, rank order, ruleta, mini-examen y duelo. Todos se califican solos y dan
// retroalimentación al instante. Versión "videojuego actual" (6 nov 2026): movimiento continuo, motor que acelera,
// saltos, flechas en arco, parejas que se juntan con animación y todo se puede jugar tocando o arrastrando.
// Cada actividad tiene plantillas distintas (vehículos, escenarios, colores) para que ninguna guía repita la misma.
import { esc, h, mezclar, toast, inicio, fin, gameOver, arrastrable, panelPregunta, temporizador, personaje, selectorPersonaje, conectarSelector } from "./ui.js";
import { marco } from "./teoria.js";
import { sonido } from "./sonido.js";
import { escenaCiudad, escenaMontana, escenaCastillo, escenaPlaneta, escenaSvg, capaVehiculo, vehiculo, capaEscalador, capaSoldado, capaArquero, capaIcono, capaSparky, icono, COLORES_DE_COCHE, escenaDuelo, capaDragonDuelo, capaHeroe, capaEscaladorDe, capaArqueroDe, escenaEnemigos, capaEnemigo, ENEMIGOS } from "./arte.js";

const W = 172, H = 140;
const TEMAS = {
  ciudad_neon: {}, formula1: { cielo1: "#38BDF8", cielo2: "#BAE6FD", cielo3: "#FDE68A", estrellas: false, sol: false, edif1: "#E11D48", edif2: "#F8FAFC", ventana: "#1F2937", ventana2: "#64748B", neon: "#111827", carretera: "#374151", linea: "#F8FAFC", borde: "#EF4444" },
  callejera: { cielo1: "#3B0A0A", cielo2: "#9A3412", cielo3: "#F97316", estrellas: true, edif1: "#431407", edif2: "#7C2D12", ventana: "#FDE68A", ventana2: "#FB923C", neon: "#FB923C", carretera: "#1C1917", linea: "#FBBF24", borde: "#F97316" },
  espacio: { estilo: "espacio" }, hipodromo: { estilo: "hipodromo" }, dragones: { estilo: "cielo" },
  nevada: {}, volcan: { cielo1: "#3B0A0A", cielo2: "#7F1D1D", cielo3: "#F97316", fondo1: "#7F1D1D", fondo2: "#991B1B", roca: "#44403C", rocaOscura: "#1C1917", nieve: "#F97316", pasto: "#57534E", pastoOscuro: "#292524", sol: "#FCA5A5" },
  aurora: { cielo1: "#052E16", cielo2: "#065F46", cielo3: "#34D399", fondo1: "#065F46", fondo2: "#047857", roca: "#365314", rocaOscura: "#1A2E05", nieve: "#A7F3D0", pasto: "#86EFAC", pastoOscuro: "#166534", sol: "#D9F99D" },
  noche: {}, amanecer: { cielo1: "#FDBA74", cielo2: "#FDE68A", cielo3: "#BAE6FD", luna: "#FFF7ED", colinas: "#9A3412", colinas2: "#C2410C", suelo: "#65A30D", piedra: "#A8A29E", piedra2: "#D6D3D1", piedraOscura: "#78716C" },
  dragon: { cielo1: "#1C0A0A", cielo2: "#450A0A", cielo3: "#B91C1C", luna: "#EF4444", colinas: "#450A0A", colinas2: "#7F1D1D", suelo: "#3F3F46", piedra: "#52525B", piedra2: "#71717A", piedraOscura: "#27272A" },
};
// Qué corre en cada plantilla de la carrera (misma mecánica, distinto personaje).
const VEHICULOS = { ciudad_neon: "coche", formula1: "coche", callejera: "coche", espacio: "nave", hipodromo: "caballo", dragones: "dragon" };
const TEMAS_PUERTAS = {
  torre: { pared1: "#2E2566", pared2: "#4C1D95", piedra: "#8E97AD", piedra2: "#B7BFD1", madera: "#D9A066", puerta: "#8B5A2B", marco: "#5C3A1A", luz: "#FFE9A8", cielo: "#1B1340" },
  mansion: { pared1: "#1C0A1A", pared2: "#4A1D4A", piedra: "#6B5B6B", piedra2: "#8C7B8C", madera: "#A0522D", puerta: "#3B2314", marco: "#20120A", luz: "#FF6B9D", cielo: "#0B0A1A" },
  bodega: { pared1: "#0B2545", pared2: "#13315C", piedra: "#5F7A8A", piedra2: "#8DA7B8", madera: "#C98B4D", puerta: "#3F5E80", marco: "#1E3A5F", luz: "#7DD3FC", cielo: "#061A2E" },
};

// Nombre de cada corredor en el selector (arte 3.0): pintura de escudería, pelaje real o color de escamas.
const NOMBRES_CORREDOR = {
  es: { coche: { rojo: "Rojo carreras", azul: "Azul noche", amarillo: "Negro y oro", verde: "Verde inglés", morado: "Plata" }, caballo: { rojo: "Alazán", azul: "Negro", amarillo: "Bayo", verde: "Tordo", morado: "Blanco" }, dragon: { rojo: "Verde bosque", azul: "Gris pizarra", amarillo: "Arena", verde: "Musgo", morado: "Carbón" } },
  en: { coche: { rojo: "Racing red", azul: "Midnight", amarillo: "Black and gold", verde: "British green", morado: "Silver" }, caballo: { rojo: "Chestnut", azul: "Black", amarillo: "Buckskin", verde: "Grey", morado: "White" }, dragon: { rojo: "Forest green", azul: "Slate grey", amarillo: "Sand", verde: "Moss", morado: "Charcoal" } },
  fr: { coche: { rojo: "Rouge course", azul: "Bleu nuit", amarillo: "Noir et or", verde: "Vert anglais", morado: "Argent" }, caballo: { rojo: "Alezan", azul: "Noir", amarillo: "Isabelle", verde: "Gris", morado: "Blanc" }, dragon: { rojo: "Vert forêt", azul: "Gris ardoise", amarillo: "Sable", verde: "Mousse", morado: "Charbon" } },
};
const nombreCorredor = (ctx, tipo, c) => (NOMBRES_CORREDOR[ctx.c?.plan?.idioma_guia] ?? NOMBRES_CORREDOR.es)[tipo]?.[c] ?? c.toUpperCase();
const hudPill = (txt, id = "", px = false) => `<span class="hud-pill ${px ? "px" : ""}" ${id ? `id="${id}"` : ""}>${txt}</span>`;
// Un <g> de SVG de verdad (crearlo con innerHTML en un div lo volvería un elemento HTML que no se dibuja).
function gSvg(inner, style = "") { const g = document.createElementNS("http://www.w3.org/2000/svg", "g"); if (style) g.setAttribute("style", style); g.innerHTML = inner; return g; }
// Fondo de la escena visible desde antes de Iniciar.
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
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
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

// ---------- CARRERA: los corredores avanzan todo el tiempo; acierto = acelerón y rebase, error = te rebasan ----------
// Plantillas: ciudad de neón con coches, espacio con naves, hipódromo con caballos, cielo con dragones.
export function carrera(s, ctx) {
  if (esDuelo(s, ctx)) return duelo(s, ctx);
  const el = marco(s, ctx); const ids = s.ids; const T = ctx.t; const N = ids.length;
  const tipo = VEHICULOS[s.plantilla] ?? "coche";
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
    const capas = coches.map((c, k) => `<g id="c${k}">${capaVehiculo(tipo, c, 0, 0)}${k === 0 ? `<rect x="6" y="-4.6" width="12" height="3.4" rx="1.4" fill="#FFD400" stroke="#2A2340" stroke-width=".5"/><text x="12" y="-2" font-size="2.6" font-weight="800" fill="#2A2340" text-anchor="middle" font-family="Outfit, Arial, sans-serif">TÚ</text>` : ""}</g>`).join("");
    const meta = `<defs><pattern id="cuadros" width="3" height="3" patternUnits="userSpaceOnUse"><rect width="1.5" height="1.5" fill="#fff"/><rect x="1.5" y="1.5" width="1.5" height="1.5" fill="#fff"/><rect x="1.5" width="1.5" height="1.5" fill="#2A2340"/><rect y="1.5" width="1.5" height="1.5" fill="#2A2340"/></pattern></defs><rect x="151" y="${fondo.suelo + 2}" width="4" height="${H - fondo.suelo - 2}" fill="url(#cuadros)"/>`;
    caja.innerHTML = escenaSvg(fondo.svg + meta, W, H, capas) + `<div style="position:absolute;left:12px;top:10px;display:flex;gap:8px">${hudPill("LAP 1", "lap")}${hudPill("", "hudpos")}</div>`;
    const svg = caja.querySelector("svg");
    const lejos = svg.querySelector("#" + fondo.capas.lejos), cerca = svg.querySelector("#" + fondo.capas.cerca), rayas = svg.querySelector("#" + fondo.capas.rayas);
    const ys = (k) => fondo.suelo + 3 + (k % fondo.carriles) * fondo.alturaCarril;
    const estado = coches.map((_, k) => ({ x: 6 + (5 - lugar[k]) * 8, objetivo: 6 + (5 - lugar[k]) * 8, fase: Math.random() * 6 }));
    let velocidad = 46, impulso = 0, desplazamiento = 0; // unidades por segundo
    const motor = tipo === "caballo" ? sonido.galopeIniciar() : tipo === "dragon" ? sonido.vientoIniciar() : sonido.motorIniciar(); motor.acelerar(.5);
    const objetivo = (final = false) => { const prog = i / N; coches.forEach((c, k) => { estado[k].objetivo = 6 + prog * 112 + (5 - lugar[k]) * 8 + (final ? 36 : 0); }); el.querySelector("#hudpos").textContent = `P${lugar[0]} / 5`; el.querySelector("#pos").textContent = `${T("pregunta")} ${Math.min(i + 1, N)} ${T("de")} ${N} · ${aciertos} ✓`; };
    const swap = (a, b) => { const ka = lugar.indexOf(a), kb = lugar.indexOf(b); lugar[ka] = b; lugar[kb] = a; };
    const amplitud = tipo === "caballo" ? 1.1 : tipo === "dragon" ? 1.6 : .35, ritmo = tipo === "caballo" ? 60 : tipo === "dragon" ? 160 : 90;
    bucle(el, ctx, (dt, t, fuera) => {
      if (fuera) { motor.detener(); return false; }
      const v = velocidad + impulso; impulso *= Math.pow(.2, dt);
      desplazamiento += v * dt;
      rayas?.setAttribute("transform", `translate(${-(desplazamiento % fondo.periodoRayas)} 0)`);
      cerca?.setAttribute("transform", `translate(${-((desplazamiento * .35) % W)} 0)`);
      lejos?.setAttribute("transform", `translate(${-((desplazamiento * .12) % W)} 0)`);
      coches.forEach((c, k) => { const e = estado[k]; e.x += (e.objetivo - e.x) * Math.min(1, dt * 3.2); const bob = Math.sin(t / ritmo + e.fase) * amplitud; const g = svg.querySelector(`#c${k}`); if (g) g.setAttribute("transform", `translate(${e.x.toFixed(2)} ${(ys(k) - 2 + bob).toFixed(2)})`); });
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

  // Elegir personaje antes de empezar: "para sentir que tiene su personaje".
  const elegidoAntes = ctx.coche();
  const selector = `<div class="ayuda" style="font-weight:800;color:#2A2340">${esc(T("elige_" + tipo))}</div><div class="elige">${colores.map((c) => `<button data-c="${c}" class="${c === elegidoAntes ? "sel" : ""}">${vehiculo(tipo, c, 3)}<span>${esc(nombreCorredor(ctx, tipo, c))}</span></button>`).join("")}</div>`;
  const ov = arranque(el, T, "carrera", () => correr(ctx.coche() ?? colores[0]), selector);
  ov.querySelectorAll(".elige button").forEach((b) => b.onclick = () => { ov.querySelectorAll(".elige button").forEach((x) => x.classList.remove("sel")); b.classList.add("sel"); ctx.setCoche(b.dataset.c); sonido.toque(); });
  return el;
}

// ---------- ENEMIGOS (8 nov 2026; sustituye al juego de puertas): cada enemigo es una pregunta; 3 vidas ----------
// El personaje (Sparky o la princesa) avanza por un camino. Acierto = lo derrota y avanza; error o tiempo agotado = el
// enemigo golpea, se pierde una vida (con la retroalimentación) y ese enemigo regresa al final de la fila para volver a
// intentarlo (solo cuenta el primer intento). Sin vidas = "¡Inténtalo de nuevo!" con el botón para repasar la pista.
// Las slides viejas con k: "puertas" se dibujan con este juego (alias), así las guías ya publicadas no se rompen.
const ESCENARIOS_ENEMIGOS = { bosque: "bosque", cueva: "cueva", desierto: "desierto", torre: "bosque", mansion: "cueva", bodega: "desierto" };
export function enemigos(s, ctx) {
  if (esDuelo(s, ctx)) return duelo(s, ctx);
  const T = ctx.t;
  if (!String(s.t).startsWith("👾")) s.t = `👾 ${String(s.t).replace(/^\S+\s+/, "") || T("enemigos")}`;
  const el = marco(s, ctx); el.classList.add("pl-enemigos");
  const TL = 20, sem = ctx.c.semilla + ctx.cur;
  const fondo = escenaEnemigos(W, H, sem, ESCENARIOS_ENEMIGOS[s.plantilla] ?? "bosque");
  const HE = 2, EE = 1.55, HX = 18, EX = 100, hy = fondo.suelo - 19.35 * HE;
  const ey = (tipo) => fondo.suelo - 23 * EE - (tipo === "murcielago" ? 16 : 0);
  const tipos = mezclar(ENEMIGOS);
  const capaHe = (p, pose) => `<g class="ene-flota">${capaHeroe(p, pose + "+espada", 0, 0)}</g>`;
  const escena = (p, tipo) => escenaSvg(fondo.svg, W, H, `<g id="eh" transform="translate(${HX} ${hy}) scale(${HE})"><g class="ene-golpe">${capaHe(p, "decidido")}</g></g><g id="ee" transform="translate(${EX} ${ey(tipo)}) scale(${EE})"><g class="ene-golpe">${capaEnemigo(tipo, 0, 0)}</g></g><g id="fx"></g>`);
  el.appendChild(h(`<div class="juego"><div class="escena-caja duelo-arena ene-arena" id="caja"></div>${panel(ctx, `<div class="pill" id="st"></div>`)}</div>`));
  fondoPrevio(el, escena(personaje(), tipos[0]));

  const jugar = (ids) => {
    const quien = personaje(), total = ids.length;
    const fila = ids.map((id, k) => ({ id, tipo: tipos[k % tipos.length] }));
    let vidas = 3, vencidos = 0, primeros = 0, timer = null, terminado = false, actual = null;
    const vistos = new Set(), malas = [];
    const caja = el.querySelector("#caja");
    caja.classList.remove("parado");
    caja.innerHTML = escena(quien, fila[0]?.tipo ?? "baba") + `<div style="position:absolute;left:12px;top:10px;display:flex;gap:8px;align-items:center"><span class="vidas" id="vidas"></span>${hudPill("", "hudev")}</div><div class="duelo-combo" id="combo"></div>`;
    const svg = caja.querySelector("svg"), gH = svg.querySelector("#eh"), gE = svg.querySelector("#ee"), fx = svg.querySelector("#fx");
    const lejos = svg.querySelector("#" + fondo.capas.lejos), cerca = svg.querySelector("#" + fondo.capas.cerca), rayas = svg.querySelector("#" + fondo.capas.rayas);
    const he = { dx: 0, anim: null }, en = { x: W + 30, y: 0, rot: 0, op: 1, estado: "fuera", t0: 0, tipo: "baba" };
    let avance = 0, recorrido = 0;
    const ponerPose = (pose) => { gH.querySelector(".ene-golpe").innerHTML = capaHe(quien, pose); };
    const ponerEnemigo = (tipo, ko = false) => { gE.querySelector(".ene-golpe").innerHTML = capaEnemigo(tipo, 0, 0, ko); };
    const destello = (g) => { g.classList.remove("golpeado"); void g.getBoundingClientRect(); g.classList.add("golpeado"); };
    const temblor = () => { svg.classList.remove("temblor"); void svg.getBoundingClientRect(); svg.classList.add("temblor"); };
    const hud = () => {
      el.querySelector("#vidas").innerHTML = [0, 1, 2].map((k) => icono(k < vidas ? "corazon" : "corazon_vacio", 3)).join("");
      el.querySelector("#hudev").textContent = `👾 ${vencidos}/${total}`;
      el.querySelector("#st").textContent = `${T("vidas")}: ${vidas} · ${vencidos} ✓`;
    };
    const cartelito = (txt) => { const c = caja.querySelector("#combo"); c.textContent = txt; c.classList.remove("on"); void c.offsetWidth; c.classList.add("on"); };
    bucle(el, ctx, (dt, t, fuera) => {
      if (fuera || terminado) return false;
      // avance del camino (parallax) mientras el personaje camina al siguiente enemigo
      if (avance > 0) { const v = 70 * dt; recorrido += v; avance = Math.max(0, avance - v); }
      rayas?.setAttribute("transform", `translate(${-(recorrido % W)} 0)`);
      cerca?.setAttribute("transform", `translate(${-((recorrido * .6) % W)} 0)`);
      lejos?.setAttribute("transform", `translate(${-((recorrido * .2) % W)} 0)`);
      const pasoHe = avance > 0 ? Math.abs(Math.sin(recorrido / 4)) * -1.5 : 0;
      if (he.anim) { const p = Math.min(1, (t - he.anim.t0) / he.anim.dur); he.dx = he.anim.dist * Math.sin(Math.PI * Math.min(1, p * 1.1)); if (p >= 1) { he.anim = null; he.dx = 0; } }
      const e = (t - en.t0) / 1000;
      if (en.estado === "entra") { en.x = Math.max(EX, en.x - 90 * dt); if (en.x === EX) en.estado = "quieto"; }
      else if (en.estado === "ataca") { const p = Math.min(1, e / .7); en.x = EX - 44 * Math.sin(Math.PI * p); if (p >= 1) en.estado = "quieto"; }
      else if (en.estado === "cae") { en.x += 70 * dt; en.y -= (34 - 140 * e) * dt; en.rot = Math.min(80, en.rot + 260 * dt); en.op = Math.max(0, en.op - 1.1 * dt); }
      else if (en.estado === "huye") { en.x += 110 * dt; }
      gH.setAttribute("transform", `translate(${(HX + he.dx).toFixed(2)} ${(hy + pasoHe).toFixed(2)}) scale(${HE})`);
      gE.setAttribute("transform", `translate(${en.x.toFixed(2)} ${(ey(en.tipo) + en.y).toFixed(2)}) rotate(${en.rot.toFixed(1)} ${(12 * EE).toFixed(1)} ${(23 * EE).toFixed(1)}) scale(${EE})`);
      gE.setAttribute("opacity", en.op.toFixed(2));
      return true;
    });
    const nuevoEnemigo = (u) => { actual = u; en.tipo = u.tipo; en.x = W + 30; en.y = 0; en.rot = 0; en.op = 1; en.estado = "entra"; en.t0 = performance.now(); ponerEnemigo(u.tipo); };
    const siguiente = () => {
      if (terminado) return;
      if (!fila.length) { ganar(); return; }
      nuevoEnemigo(fila.shift());
      ctx.luego(preguntar, 1300);
    };
    const preguntar = () => {
      if (terminado) return;
      const a = ctx.c.porId[actual.id];
      if (!a) { vencidos++; hud(); siguiente(); return; }
      const qb = el.querySelector("#qbox"); qb.innerHTML = "";
      el.querySelector("#qn").textContent = `${T("enemigo")} ${vencidos + 1} ${T("de")} ${total}`;
      const primera = !vistos.has(actual.id); vistos.add(actual.id);
      const q = panelPregunta(a, ctx, (ok, txt) => {
        timer?.detener();
        if (ok) {
          vencidos++; if (primera) primeros++;
          he.anim = { t0: performance.now(), dur: 650, dist: EX - HX - 30 }; sonido.whoosh();
          if (quien === "princesa") { ponerPose("golpe"); ctx.luego(() => !terminado && ponerPose("decidido"), 650); }
          else { gH.classList.remove("tajo"); void gH.getBoundingClientRect(); gH.classList.add("tajo"); ctx.luego(() => gH.classList.remove("tajo"), 650); }
          ctx.luego(() => { if (terminado) return; sonido.golpe(); ponerEnemigo(actual.tipo, true); destello(gE.querySelector(".ene-golpe")); temblor(); en.estado = "cae"; en.t0 = performance.now(); cartelito(({ en: "POW!", fr: "PAF !" })[ctx.c?.plan?.idioma_guia] ?? "¡ZAS!"); hud(); }, 300);
          ctx.luego(() => { if (!terminado) avance = 46; }, 1200);
          toast(el, true, txt, 1800); ctx.luego(siguiente, 2100);
        } else {
          malas.push(a); fila.push(actual);
          en.estado = "ataca"; en.t0 = performance.now(); sonido.whoosh();
          ctx.luego(() => { if (terminado) return; vidas--; sonido.golpe(); destello(gH.querySelector(".ene-golpe")); temblor(); hud(); }, 330);
          toast(el, false, txt, 3200);
          ctx.luego(() => { if (terminado) return; if (vidas <= 0) { perder(); return; } en.estado = "huye"; ctx.luego(siguiente, 600); }, 3000);
        }
      });
      qb.appendChild(q);
      timer = temporizador(el.querySelector("#tm"), TL, () => q.agotar(), ctx);
    };
    const cerrar = () => { terminado = true; timer?.detener(); el.querySelector("#qbox").innerHTML = ""; caja.classList.add("parado"); };
    const ganar = () => {
      cerrar(); ponerPose("festejo"); sonido.brillo();
      ctx.luego(() => { const d = fin(el, ctx, T("enemigos_ok"), `${primeros}/${total}`, `${esc(T("correctas"))} ${esc(T("primer_intento"))}`, () => { d.remove(); jugar(mezclar(ids)); }, true); }, 900);
    };
    const perder = () => {
      cerrar(); ponerPose("triste"); gH.classList.add("vencido");
      ctx.luego(() => {
        const pista = malas.map((a) => a.pista).find((p) => p && ctx.slideDePista(p) >= 0);
        const d = fin(el, ctx, T("enemigos_mal"), `${vencidos}/${total}`, `👾 ${esc(T("enemigos_vencidos"))}<p class="duelo-animo">${esc(T("enemigos_animo"))}</p>${pista ? `<button class="btn alt duelo-repasar" type="button">${esc(T("repasar_pista"))}</button>` : ""}`, () => { d.remove(); jugar(mezclar(ids)); }, false);
        d.querySelector(".duelo-repasar")?.addEventListener("click", () => { sonido.toque(); ctx.go(ctx.slideDePista(pista)); });
      }, 1100);
    };
    hud();
    if (!total) { ganar(); return; }
    siguiente();
  };
  const ov = arranque(el, T, "enemigos", () => jugar(s.ids.slice()), selectorPersonaje(ctx));
  conectarSelector(ov, (p) => fondoPrevio(el, escena(p, tipos[0])));
  return el;
}
// Alias: las guías publicadas antes del 8 nov 2026 traen slides "puertas"; ahora se juegan como enemigos.
export const puertas = enemigos;

// ---------- MONTAÑA: plataformas; cada acierto es un salto, cada error un resbalón ----------
export function montana(s, ctx) {
  if (esDuelo(s, ctx)) return duelo(s, ctx);
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
  if (esDuelo(s, ctx)) return duelo(s, ctx);
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

// ---------- VERDADERO O FALSO EXPRESS: contra reloj, 7 segundos por tarjeta para todas ----------
export function swipe(s, ctx) {
  const el = marco(s, ctx); const T = ctx.t; const items = s.items; let i = 0, aciertos = 0, acabado = false, fin0 = 0, ultimo = -1;
  const TOTAL = 7 * items.length;
  el.classList.add("pl-" + (s.plantilla ?? "arcade"));
  el.appendChild(h(`<div class="cuerpo" style="display:flex;flex-direction:column;align-items:center;gap:12px"><div class="swipe-marcas"><span style="color:var(--mal)">👈 ${esc(T("falso")).toUpperCase()}</span><span class="reloj" id="reloj">⏱ ${TOTAL} s</span><span style="color:var(--ok)">${esc(T("verdadero")).toUpperCase()} 👉</span></div><div class="barra-tiempo" style="width:640px"><i id="tm" style="width:100%"></i></div><div class="mazo" id="mazo"></div><div style="display:flex;gap:16px;align-items:center"><button class="btn mal" id="bf">✗ ${esc(T("falso"))}</button><span class="pill" id="cnt"></span><button class="btn ok" id="bt">✓ ${esc(T("verdadero"))}</button></div></div>`));
  const mazo = el.querySelector("#mazo"), reloj = el.querySelector("#reloj"), barra = el.querySelector("#tm");
  const terminar = (porTiempo) => { if (acabado) return; acabado = true; for (let k = i; k < items.length; k++) ctx.registrar(items[k].id, false); fin(el, ctx, porTiempo ? T("tiempo") : T("vf_express"), `${aciertos}/${items.length}`, T("correctas"), () => ctx.go(ctx.cur), aciertos >= items.length * .7); };
  const sig = () => {
    mazo.innerHTML = ""; el.querySelector("#cnt").textContent = `${Math.min(i + 1, items.length)} ${T("de")} ${items.length}`;
    if (i >= items.length) { terminar(false); return; }
    const a = items[i];
    const c = h(`<div class="carta-swipe"><div class="em">${esc(a.emoji ?? "🤔")}</div><div class="afirmacion">${esc(a.afirmacion)}</div>${a.afirmacion_apoyo ? `<div style="color:var(--gris);font-style:italic">${esc(a.afirmacion_apoyo)}</div>` : ""}</div>`);
    mazo.appendChild(c);
    let hecho = false;
    const juzgar = (v) => { if (hecho || acabado) return; hecho = true; const ok = v === !!a.es_verdadera; ctx.registrar(a.id, ok); if (ok) aciertos++; sonido.whoosh(); c.style.transition = "transform .4s cubic-bezier(.3,.8,.4,1), opacity .4s"; c.style.transform = `translateX(${v ? 760 : -760}px) rotate(${v ? 28 : -28}deg)`; c.style.opacity = 0; toast(el, ok, ok ? a.retro_correcta : a.retro_incorrecta, ok ? 1200 : 2200); i++; ctx.luego(sig, ok ? 500 : 1400); };
    el.querySelector("#bt").onclick = () => juzgar(true); el.querySelector("#bf").onclick = () => juzgar(false);
    c.addEventListener("pointerdown", (e) => { e.preventDefault(); c.setPointerCapture(e.pointerId); const sx = e.clientX;
      const mv = (ev) => { const dx = (ev.clientX - sx) / ctx.escala(); c.style.transform = `translateX(${dx}px) rotate(${dx / 18}deg)`; c.style.borderColor = dx > 40 ? "var(--ok)" : dx < -40 ? "var(--mal)" : "#2A2340"; };
      const up = (ev) => { c.removeEventListener("pointermove", mv); c.removeEventListener("pointerup", up); const dx = (ev.clientX - sx) / ctx.escala(); if (Math.abs(dx) > 120) juzgar(dx > 0); else { c.style.transition = "transform .3s cubic-bezier(.3,1.5,.6,1)"; c.style.transform = ""; c.style.borderColor = "#2A2340"; ctx.luego(() => c.style.transition = "", 320); } };
      c.addEventListener("pointermove", mv); c.addEventListener("pointerup", up); });
  };
  sig();
  arranque(el, T, "swipe", () => {
    fin0 = performance.now() + TOTAL * 1000;
    bucle(el, ctx, (dt, t, fuera) => {
      if (fuera || acabado) return false;
      const resta = Math.max(0, fin0 - t); const seg = Math.ceil(resta / 1000);
      reloj.textContent = `⏱ ${seg} s`; reloj.classList.toggle("urgente", seg <= 10); barra.style.width = (100 * resta / (TOTAL * 1000)) + "%";
      if (seg <= 5 && seg !== ultimo) { ultimo = seg; sonido.tic(); }
      if (resta <= 0) { terminar(true); return false; }
      return true;
    });
  });
  return el;
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

// ---------- DUELO (7 nov 2026): pelea por rounds, Sparky con casco y espada contra un dragón ----------
// Mismo contenido que opción múltiple (s.ids → actividades opcion_multiple o completar del cartucho) y mismo registro:
// panelPregunta llama a ctx.registrar(id, ok) una vez por pregunta. Acierto = Sparky ataca y el dragón pierde vida;
// error o tiempo agotado = el dragón echa fuego y Sparky pierde vida. El round termina con un K.O. o cuando se acaban
// las preguntas (gana quien conserve más vida). Derrota = pantalla de revancha que invita a repasar la pista.
// Textos propios en español, inglés y francés (el cartucho todavía no los trae).
const TEXTOS_DUELO = {
  es: { titulo: "Duelo", instr: "Duelo contra el dragón: contesta cada pregunta antes de que se acabe el tiempo. Si aciertas, Sparky ataca con su espada y el dragón pierde vida; si fallas, el dragón te lanza fuego y pierdes vida. Gana quien deje al otro sin vida.", sparky: "SPARKY", dragon: "DRAGÓN", round: "ROUND", pelea: "¡A pelear!", ko: "K.O.", ganaste: "¡Venciste al dragón!", gano_tiempo: "¡Ganaste el duelo!", revancha: "¡Revancha!", animo: "El dragón ganó este round. Repasa la pista y vuelve a intentarlo: cada pregunta que repasas te hace más fuerte.", repasar: "📖 Repasar la pista", combo: "COMBO", golpe: "¡GOLPE!", vida: "Vida", preguntas_fin: "Se acabaron las preguntas" },
  en: { titulo: "Duel", instr: "Duel against the dragon: answer each question before time runs out. If you are right, Sparky strikes with his sword and the dragon loses health; if you are wrong, the dragon breathes fire and you lose health. Whoever runs out of health first loses.", sparky: "SPARKY", dragon: "DRAGON", round: "ROUND", pelea: "Fight!", ko: "K.O.", ganaste: "You defeated the dragon!", gano_tiempo: "You won the duel!", revancha: "Rematch!", animo: "The dragon won this round. Review the clue and try again: every question you review makes you stronger.", repasar: "📖 Review the clue", combo: "COMBO", golpe: "HIT!", vida: "Health", preguntas_fin: "No more questions" },
  fr: { titulo: "Duel", instr: "Duel contre le dragon : réponds à chaque question avant la fin du temps. Si tu as raison, Sparky frappe avec son épée et le dragon perd de la vie ; si tu te trompes, le dragon crache du feu et tu perds de la vie. Celui qui n'a plus de vie perd.", sparky: "SPARKY", dragon: "DRAGON", round: "ROUND", pelea: "Au combat !", ko: "K.O.", ganaste: "Tu as vaincu le dragon !", gano_tiempo: "Tu as gagné le duel !", revancha: "Revanche !", animo: "Le dragon a gagné cette manche. Revois l'indice et réessaie : chaque question revue te rend plus fort.", repasar: "📖 Revoir l'indice", combo: "COMBO", golpe: "TOUCHÉ !", vida: "Vie", preguntas_fin: "Plus de questions" },
};
const td = (ctx, k) => (TEXTOS_DUELO[ctx.c?.plan?.idioma_guia] ?? TEXTOS_DUELO.es)[k] ?? TEXTOS_DUELO.es[k];
// ¿Esta slide de preguntas se juega como duelo? Sí si el estante la marcó así (k: "duelo") o si el bloque lo pide con
// "juego": "duelo" (el planificador decide qué juego recibe las preguntas de cada bloque). El calentamiento nunca.
const esDuelo = (s, ctx) => s.k === "duelo" || (!s.calentamiento && s.blk >= 0 && ctx.c?.bloques?.[s.blk]?.juego === "duelo");

export function duelo(s, ctx) {
  const T = ctx.t;
  // Título con espadas (en la rejilla de slides también, porque se cambia en la misma slide del estante).
  if (!String(s.t).startsWith("⚔️")) s.t = `⚔️ ${String(s.t).replace(/^\S+\s+/, "") || td(ctx, "titulo")}`;
  const el = marco(s, ctx); el.classList.add("pl-duelo");
  const N = s.ids.length, TL = 20, AW = 172, AH = 140;
  const paleta = ["verde", "tierra", "gris"][(ctx.c.semilla + ctx.cur) % 3];
  const arena = escenaDuelo(AW, AH, ctx.c.semilla + ctx.cur);
  const SP = { x: 20, esc: 2.5 }, DR = { x: 82, esc: 1.05 };
  const spY = arena.suelo - 19.35 * SP.esc, drY = arena.suelo - 68 * DR.esc;
  const capaSp = (pose) => `<g class="sp-flota">${capaSparky(pose + "+yelmo+espada", 0, 0)}</g>`;
  const escena = () => escenaSvg(arena.svg, AW, AH,
    `<g id="dr" transform="translate(${DR.x} ${drY}) scale(${DR.esc})"><g class="dr-golpe">${capaDragonDuelo(paleta, 0, 0)}</g></g>
     <g id="sp" transform="translate(${SP.x} ${spY}) scale(${SP.esc})"><g class="sp-golpe">${capaSp("decidido")}</g></g>
     <g id="fx"></g>`);
  el.appendChild(h(`<div class="juego duelo-juego"><div class="escena-caja duelo-arena" id="caja"></div>${panel(ctx, `<div class="pill" id="st"></div>`)}</div>`));
  fondoPrevio(el, escena());

  const jugar = (ids, ronda) => {
    let i = 0, aciertos = 0, racha = 0, timer = null, terminado = false, anim = null;
    const golpesDragon = Math.max(1, Math.ceil(ids.length * .6)), golpesSparky = Math.max(1, ids.length - golpesDragon + 1);
    let vidaDr = golpesDragon, vidaSp = golpesSparky;
    const malas = [];
    const caja = el.querySelector("#caja");
    caja.classList.remove("parado");
    caja.innerHTML = escena() + `<div class="duelo-hud">
        <div class="duelo-lado sp"><span class="duelo-nombre">${esc(td(ctx, "sparky"))}</span><div class="duelo-vida" role="meter" aria-label="${esc(td(ctx, "vida"))} ${esc(td(ctx, "sparky"))}"><i class="rastro"></i><i class="vida"></i></div></div>
        <div class="duelo-ronda">${esc(td(ctx, "round"))} ${ronda}</div>
        <div class="duelo-lado dr"><span class="duelo-nombre">${esc(td(ctx, "dragon"))}</span><div class="duelo-vida" role="meter" aria-label="${esc(td(ctx, "vida"))} ${esc(td(ctx, "dragon"))}"><i class="rastro"></i><i class="vida"></i></div></div>
      </div><div class="duelo-cartel" id="cartel"></div><div class="duelo-combo" id="combo"></div>`;
    const svg = caja.querySelector("svg"), gSp = svg.querySelector("#sp"), gDr = svg.querySelector("#dr"), fx = svg.querySelector("#fx");
    const cartel = (txt, ms = 1100, clase = "") => { const c = caja.querySelector("#cartel"); c.className = "duelo-cartel " + clase; c.textContent = txt; void c.offsetWidth; c.classList.add("on"); ctx.luego(() => c.classList.remove("on"), ms); };
    const hud = () => {
      const pSp = 100 * vidaSp / golpesSparky, pDr = 100 * vidaDr / golpesDragon;
      caja.querySelectorAll(".duelo-lado.sp i").forEach((b) => b.style.width = pSp + "%");
      caja.querySelectorAll(".duelo-lado.dr i").forEach((b) => b.style.width = pDr + "%");
      caja.querySelector(".duelo-lado.sp").classList.toggle("peligro", pSp <= 34);
      caja.querySelector(".duelo-lado.dr").classList.toggle("peligro", pDr <= 34);
      el.querySelector("#st").textContent = `${aciertos} ✓ · ${td(ctx, "round")} ${ronda}`;
    };
    const destello = (g) => { g.classList.remove("golpeado"); void g.getBoundingClientRect(); g.classList.add("golpeado"); };
    const ponerPose = (pose) => { gSp.querySelector(".sp-golpe").innerHTML = capaSp(pose); };
    // Animaciones de ataque: el bucle mueve a los peleadores; CSS se encarga del tajo, el fuego y los destellos.
    const ataqueSparky = (alImpacto) => {
      sonido.whoosh();
      gSp.classList.remove("tajo"); void gSp.getBoundingClientRect(); gSp.classList.add("tajo");
      anim = { quien: "sp", t0: performance.now(), dur: 820, golpe: 300 }; ctx.luego(() => impacto("sp", alImpacto), 300);
    };
    const ataqueDragon = (alImpacto) => {
      gDr.classList.remove("sopla"); void gDr.getBoundingClientRect(); gDr.classList.add("sopla");
      sonido.whoosh();
      anim = { quien: "dr", t0: performance.now(), dur: 1000, golpe: 460 }; ctx.luego(() => impacto("dr", alImpacto), 460);
    };
    // El golpe se aplica con un temporizador (no con el cuadro de animación): así la vida baja a tiempo aunque el
    // navegador frene las animaciones, por ejemplo con la pestaña en segundo plano.
    const impacto = (quien, alImpacto) => { if (terminado) return; sonido.golpe(); if (quien === "sp") { tajo(); destello(gDr.querySelector(".dr-golpe")); } else destello(gSp.querySelector(".sp-golpe")); svg.classList.remove("temblor"); void svg.getBoundingClientRect(); svg.classList.add("temblor"); alImpacto?.(); };
    const tajo = () => { const g = gSvg(`<path class="duelo-tajo" d="M${DR.x + 6} ${arena.suelo - 58} Q${DR.x + 34} ${arena.suelo - 44} ${DR.x + 18} ${arena.suelo - 8}" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round"/><circle class="duelo-chispa" cx="${DR.x + 22}" cy="${arena.suelo - 36}" r="6" fill="#FFE9A8"/>`); fx.appendChild(g); ctx.luego(() => g.remove(), 600); };
    bucle(el, ctx, (dt, t, fuera) => {
      if (fuera || terminado) return false;
      let dxSp = 0, dxDr = 0;
      if (anim) {
        const e = t - anim.t0, p = Math.min(1, e / anim.dur);
        if (anim.quien === "sp") dxSp = 46 * Math.sin(Math.PI * Math.min(1, p * 1.15));
        else { dxDr = p < .25 ? 6 * Math.sin(Math.PI * p / .5) : -14 * Math.sin(Math.PI * (p - .25) / .75); dxSp = e > anim.golpe ? -7 * Math.sin(Math.PI * Math.min(1, (e - anim.golpe) / 400)) : 0; }
        if (p >= 1) { gSp.classList.remove("tajo"); gDr.classList.remove("sopla"); anim = null; }
      }
      gSp.setAttribute("transform", `translate(${(SP.x + dxSp).toFixed(2)} ${spY}) scale(${SP.esc})`);
      gDr.setAttribute("transform", `translate(${(DR.x + dxDr).toFixed(2)} ${drY}) scale(${DR.esc})`);
      return true;
    });
    // Fin del round: K.O. o se acabaron las preguntas. Se detienen el bucle y las animaciones de CSS.
    const terminar = (gana, porKO) => {
      if (terminado) return; terminado = true; timer?.detener();
      el.querySelector("#qbox").innerHTML = "";
      cartel(porKO ? td(ctx, "ko") : td(ctx, "preguntas_fin"), 1500, porKO ? "ko" : "");
      if (gana) { gDr.classList.add("vencido"); ponerPose("festejo"); sonido.brillo(); } else { gSp.classList.add("vencido"); ponerPose("triste"); }
      ctx.luego(() => {
        caja.classList.add("parado");
        let d = null;
        const otraVez = () => { d?.remove(); jugar(mezclar(ids), ronda + 1); };
        if (gana) d = fin(el, ctx, porKO ? td(ctx, "ganaste") : td(ctx, "gano_tiempo"), `${aciertos}/${ids.length}`, esc(T("correctas")), otraVez, true);
        else {
          const pista = malas.map((a) => a.pista).find((p) => p && ctx.slideDePista(p) >= 0);
          d = fin(el, ctx, td(ctx, "revancha"), `${aciertos}/${ids.length}`, `${esc(T("correctas"))}<p class="duelo-animo">${esc(td(ctx, "animo"))}</p>${pista ? `<button class="btn alt duelo-repasar" type="button">${esc(td(ctx, "repasar"))}</button>` : ""}`, otraVez, false);
          d.querySelector(".duelo-repasar")?.addEventListener("click", () => { sonido.toque(); ctx.go(ctx.slideDePista(pista)); });
        }
      }, 1700);
    };
    const preguntar = () => {
      if (terminado) return;
      const qb = el.querySelector("#qbox"); qb.innerHTML = "";
      if (i >= ids.length) { terminar(vidaDr / golpesDragon <= vidaSp / golpesSparky, false); return; }
      const a = ctx.c.porId[ids[i]];
      if (!a) { i++; preguntar(); return; }
      el.querySelector("#qn").textContent = `${T("pregunta")} ${i + 1} ${T("de")} ${ids.length}`;
      const q = panelPregunta(a, ctx, (ok, txt) => {
        timer?.detener(); i++;
        if (ok) {
          aciertos++; racha++;
          ataqueSparky(() => { vidaDr = Math.max(0, vidaDr - 1); hud(); const c = caja.querySelector("#combo"); c.textContent = racha > 1 ? `${td(ctx, "combo")} ×${racha}` : td(ctx, "golpe"); c.classList.remove("on"); void c.offsetWidth; c.classList.add("on"); if (vidaDr <= 0) terminar(true, true); });
        } else {
          racha = 0; malas.push(a);
          ataqueDragon(() => { vidaSp = Math.max(0, vidaSp - 1); hud(); if (vidaSp <= 0) terminar(false, true); });
        }
        toast(el, ok, txt, ok ? 1800 : 3200);
        ctx.luego(preguntar, ok ? 1900 : 3300);
      });
      qb.appendChild(q);
      timer = temporizador(el.querySelector("#tm"), TL, () => q.agotar(), ctx);
    };
    hud(); cartel(`${td(ctx, "round")} ${ronda}`, 900); ctx.luego(() => { if (!terminado) cartel(td(ctx, "pelea"), 800, "pelea"); }, 950);
    if (!ids.length) { terminar(true, false); return; }
    ctx.luego(preguntar, 1300);
  };
  inicio(el, td(ctx, "instr"), () => jugar(s.ids.slice(), 1), "", { titulo: T("como_jugar"), boton: T("iniciar") });
  return el;
}
