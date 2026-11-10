// Los juegos del estante (Documento 2 + mecánicas que pidió Daniel): carrera, puertas, montaña, castillo, verdadero o
// falso express, súper dato, mix & match, super sort, rank order, ruleta, mini-examen y duelo. Todos se califican solos y dan
// retroalimentación al instante. Versión "videojuego actual" (6 nov 2026): movimiento continuo, motor que acelera,
// saltos, flechas en arco, parejas que se juntan con animación y todo se puede jugar tocando o arrastrando.
// Cada actividad tiene plantillas distintas (vehículos, escenarios, colores) para que ninguna guía repita la misma.
import { esc, h, mezclar, toast, inicio, fin, gameOver, arrastrable, panelPregunta, temporizador, personaje, selectorPersonaje, conectarSelector, attrsFoto } from "./ui.js";
import { marco } from "./teoria.js";
import { sonido } from "./sonido.js";
import { escenaCiudad, escenaMontana, escenaCastillo, escenaPlaneta, escenaSvg, capaVehiculo, vehiculo, capaEscalador, capaSoldado, capaArquero, capaIcono, capaSparky, icono, COLORES_DE_COCHE, escenaDuelo, capaDragonDuelo, capaHeroe, capaEscaladorDe, capaArqueroDe, escenaEnemigos, capaEnemigo, ENEMIGOS, escenaPinguino, capaPinguino, capaJuez, escenaPerro, capaPerro, capaPlato } from "./arte.js";

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
  const previa = (p) => fondoPrevio(el, escenaSvg(fondo.svg, W, H, `<g transform="translate(${enPunto(0).x} ${enPunto(0).y})">${capaEscaladorDe(p, 0, 0)}</g>`));
  previa(personaje());
  const jugar = () => {
    const quien = personaje();
    let pos = 0, i = 0, aciertos = 0, timer = null, puntos = 0;
    const caja = el.querySelector("#caja");
    const bandera = `<g>${capaIcono("bandera", fondo.puntos[N].x + 4, fondo.puntos[N].y - 16)}</g>`;
    caja.innerHTML = escenaSvg(fondo.svg + bandera, W, H, `<g id="estrellas"></g><g id="heroe">${capaEscaladorDe(quien, 0, 0)}</g>`) + `<div style="position:absolute;left:12px;top:10px;display:flex;gap:8px">${hudPill("", "hudst")}${hudPill("", "hudpt")}</div>`;
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
  conectarSelector(arranque(el, T, "montana", jugar, selectorPersonaje(ctx)), previa);
  return el;
}

// ---------- CASTILLO: una escuadra avanza hacia la torre; la flecha vuela en arco; tres vidas ----------
export function castillo(s, ctx) {
  if (esDuelo(s, ctx)) return duelo(s, ctx);
  const el = marco(s, ctx); const T = ctx.t; const TL = 15;
  const fondo = escenaCastillo(W, H, ctx.c.semilla + ctx.cur, TEMAS[s.plantilla] ?? {});
  el.appendChild(h(`<div class="juego"><div class="escena-caja" id="caja"></div>${panel(ctx, `<div class="pill" id="st"></div>`)}</div>`));
  const previa = (p) => fondoPrevio(el, escenaSvg(fondo.svg, W, H, `<g>${capaArqueroDe(p, fondo.torreX - 20, fondo.torreTop - 14)}</g>`));
  previa(personaje());
  const jugar = (ids) => {
    const quien = personaje();
    let i = 0, aciertos = 0, vidas = 3, timer = null;
    const N = ids.length;
    const caja = el.querySelector("#caja");
    caja.innerHTML = escenaSvg(fondo.svg, W, H, `<g id="torre-g"><g>${capaArqueroDe(quien, fondo.torreX - 20, fondo.torreTop - 14)}</g></g><g id="soldados"></g><g id="flecha" style="opacity:0">${capaIcono("flecha", 0, 0)}</g><g id="impactos"></g>`) + `<div style="position:absolute;left:12px;top:10px;display:flex;gap:8px;align-items:center">${hudPill("", "hudsc")}<span class="vidas" id="vidas"></span></div>`;
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
  conectarSelector(arranque(el, T, "castillo", () => jugar(s.ids.slice()), selectorPersonaje(ctx)), previa);
  return el;
}

// ---------- CLAVADOS DE PINGÜINO (8 nov 2026): una pregunta por turno, como la carrera ----------
// Un pingüino en lo alto de un iceberg con resbaladilla y un jurado de tres pingüinos (sombrero, moño y lentes).
// Acierto = se desliza, hace un clavado épico (5 distintos) y el jurado levanta 10. Error o tiempo agotado = el clavado
// sale mal (5 fracasos distintos) y el jurado levanta notas bajas. Nunca se repite seguido el mismo clavado ni el mismo
// fracaso. Cada pregunta se registra en ctx.resultados (panelPregunta); al final se muestra el promedio del jurado.
const ESCENARIOS_PINGUINO = ["polo", "aurora", "atardecer"];
export function pinguino(s, ctx) {
  if (esDuelo(s, ctx)) return duelo(s, ctx);
  const T = ctx.t;
  if (!String(s.t).startsWith("🐧")) s.t = `🐧 ${String(s.t).replace(/^\S+\s+/, "") || T("pinguino")}`;
  const el = marco(s, ctx); el.classList.add("pl-pinguino");
  const ids = s.ids, N = ids.length, TL = 20, E = .9, EJ = .8;
  const esc0 = escenaPinguino(W, H, ctx.c.semilla + ctx.cur, ESCENARIOS_PINGUINO.includes(s.plantilla) ? s.plantilla : "polo");
  const nombresBien = String(T("clavados")).split("|"), nombresMal = String(T("fallas")).split("|");
  const cy = 9.4 * E; // del centro del pingüino a sus patas
  const inicioP = { x: esc0.arriba.x, y: esc0.arriba.y - cy };
  const POSES_PG = { parado: { aleta: 0 }, panza: { aleta: 15 }, bola: { aleta: -35 }, brazos: { aleta: 110 } };
  const dibujo = (pose, ojos) => capaPinguino({ ...(POSES_PG[pose] ?? POSES_PG.parado), ojos }, 0, 0);
  const jueces = esc0.jueces.map((x, k) => `<g transform="translate(${(x - 8 * EJ).toFixed(2)} ${(esc0.pisoJueces - 19.4 * EJ).toFixed(2)}) scale(${EJ})">${capaJuez(k, 0, 0, "jz" + k)}</g>`).join("");
  const escena = () => escenaSvg(esc0.svg, W, H, `<g id="hielo"></g><g id="pg" transform="translate(${inicioP.x} ${inicioP.y}) scale(${E}) translate(-8 -10)"><g id="pgc">${dibujo("parado", "normal")}</g></g><g id="fx"></g>${jueces}`);
  el.appendChild(h(`<div class="juego"><div class="escena-caja ping-arena" id="caja"></div>${panel(ctx, `<div class="pill" id="pos"></div>`)}</div>`));
  fondoPrevio(el, escena());

  const jugar = () => {
    let i = 0, aciertos = 0, timer = null, anim = null, ultimoBien = -1, ultimoMal = -1, puntos = 0;
    const promedios = [];
    const caja = el.querySelector("#caja");
    caja.innerHTML = escena() + `<div style="position:absolute;left:12px;top:10px;display:flex;gap:8px">${hudPill("", "hudcl")}${hudPill("", "hudpt")}</div><div class="ping-cartel" id="cartel"></div>`;
    const svg = caja.querySelector("svg"), gP = svg.querySelector("#pg"), gC = svg.querySelector("#pgc"), fx = svg.querySelector("#fx"), hielo = svg.querySelector("#hielo");
    let poseAct = "parado:normal";
    const ponerPose = (pose, ojos = "normal") => { const k = pose + ":" + ojos; if (k !== poseAct) { poseAct = k; gC.innerHTML = dibujo(pose, ojos); } };
    const particulas = [];
    const textos = () => { el.querySelector("#hudcl").textContent = `🐧 ${Math.min(i + 1, N)}/${N}`; el.querySelector("#hudpt").textContent = `★ ${puntos}`; el.querySelector("#pos").textContent = `${T("jurado")}: ${promedios.length ? (promedios.reduce((a, b) => a + b, 0) / promedios.length).toFixed(1) : "–"} · ${aciertos} ✓`; };
    const cartel = (txt, ok) => { const c = caja.querySelector("#cartel"); c.className = "ping-cartel" + (ok ? "" : " mal"); c.textContent = txt; void c.offsetWidth; c.classList.add("on"); };
    // Gotas del chapuzón (y nieve en el fracaso de la nieve): caen con gravedad dentro del bucle.
    const salpicar = (x, y, n, abierto = 1, color = "#E6F7FF") => {
      for (let k = 0; k < n; k++) { const a = -Math.PI / 2 + (Math.random() - .5) * 1.6 * abierto; const v = 30 + Math.random() * 45; const c = document.createElementNS("http://www.w3.org/2000/svg", "circle"); c.setAttribute("r", (.6 + Math.random() * 1.2).toFixed(2)); c.setAttribute("fill", color); fx.appendChild(c); particulas.push({ c, x, y, vx: Math.cos(a) * v * (abierto > 1 ? 1.4 : 1), vy: Math.sin(a) * v, vida: 1 }); }
      const o = gSvg(`<ellipse cx="${x}" cy="${esc0.mar + 1}" rx="3" ry="1" fill="none" stroke="#fff" stroke-width=".8"><animate attributeName="rx" from="3" to="${14 * abierto}" dur=".8s" fill="freeze"/><animate attributeName="opacity" from=".9" to="0" dur=".8s" fill="freeze"/></ellipse>`);
      fx.appendChild(o); ctx.luego(() => o.remove(), 900);
    };
    // Curva de la resbaladilla (cúbica) y su dirección.
    const [P0, P1, P2, P3] = esc0.rampa;
    const bez = (t) => { const u = 1 - t; return [u * u * u * P0[0] + 3 * u * u * t * P1[0] + 3 * u * t * t * P2[0] + t * t * t * P3[0], u * u * u * P0[1] + 3 * u * u * t * P1[1] + 3 * u * t * t * P2[1] + t * t * t * P3[1]]; };
    const ang = (t) => { const a = bez(Math.max(0, t - .01)), b = bez(Math.min(1, t + .01)); return Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI; };
    const [SX, SY] = esc0.salida;
    // Fases de una animación: cada una dura "dur" ms y devuelve la posición, el giro y la pose para p de 0 a 1.
    const caminar = { dur: 320, f: (p) => ({ x: inicioP.x + (P0[0] - inicioP.x) * p, y: inicioP.y + (P0[1] - cy - inicioP.y) * p - Math.abs(Math.sin(p * Math.PI * 3)) * 1.2, rot: Math.sin(p * Math.PI * 6) * 6, pose: "parado" }) };
    const deslizar = (giro = 0) => ({ dur: 820, f: (p) => { const e = p * p * (1.6 - .6 * p); const [x, y] = bez(e); return { x, y: y - 3.2, rot: ang(e) + 90 + giro * p, pose: "panza" }; } });
    const subida = { dur: 160, f: (p) => ({ x: P3[0] + (SX - P3[0]) * p, y: P3[1] - 3.2 + (SY - P3[1]) * p, rot: 90 - 10 * p, pose: "panza" }) };
    const vuelo = (a, b, alto, dur, rotF, pose = "parado", extra = {}) => ({ dur, f: (p) => ({ x: a[0] + (b[0] - a[0]) * p, y: a[1] + (b[1] - a[1]) * p - alto * 4 * p * (1 - p), rot: rotF(p), pose: typeof pose === "function" ? pose(p) : pose, ...(typeof extra === "function" ? extra(p) : extra) }) });
    const hundir = (x, rot) => ({ dur: 380, f: (p) => ({ x, y: esc0.mar + 2 + 12 * p, rot, pose: "parado", op: 1 - p }) });
    const suave2 = (p) => p * p * (3 - 2 * p);
    const entrada = () => [108 + Math.random() * 12, esc0.mar + 2];
    // Los 5 clavados buenos.
    const CLAVADOS = [
      () => { const b = entrada(); return { fases: [caminar, deslizar(), subida, vuelo([SX, SY], b, 40, 1300, (p) => 80 + 1170 * suave2(p), (p) => p > .12 && p < .85 ? "bola" : "parado"), hundir(b[0], 180)], al: [[4, () => { salpicar(b[0], esc0.mar, 10, .6); sonido.chapuzon(); }]] }; },
      () => { const b = entrada(); return { fases: [caminar, deslizar(), subida, vuelo([SX, SY], b, 36, 1250, (p) => 80 + 100 * suave2(p), "parado", (p) => ({ sx: Math.cos(p * Math.PI * 6) }))], al: [[4, () => { salpicar(b[0], esc0.mar, 9, .6); sonido.chapuzon(); }]], fin: hundir(b[0], 180) }; },
      () => { const b = entrada(); return { fases: [caminar, deslizar(), subida, vuelo([SX, SY], b, 46, 1250, (p) => 80 + 720 * p, "bola")], al: [[4, () => { salpicar(b[0], esc0.mar, 26, 1.1); sonido.chapuzon(true); }]], fin: hundir(b[0], 180) }; },
      () => { const b = entrada(); return { fases: [caminar, deslizar(), subida, vuelo([SX, SY], b, 50, 1450, (p) => 80 + 100 * suave2(p), (p) => p < .75 ? "brazos" : "parado")], al: [[4, () => { salpicar(b[0], esc0.mar, 5, .4); sonido.chapuzon(); }]], fin: hundir(b[0], 180) }; },
      () => { const b = entrada(); return { fases: [caminar, deslizar(), subida, vuelo([SX, SY], b, 44, 1300, (p) => 80 - 980 * suave2(p), (p) => p > .1 && p < .8 ? "bola" : "parado")], al: [[4, () => { salpicar(b[0], esc0.mar, 10, .6); sonido.chapuzon(); }]], fin: hundir(b[0], -900) }; },
    ];
    // Los 5 fracasos.
    const FALLAS = [
      // panzazo: cae plano, con los brazos abiertos
      () => { const b = [104 + Math.random() * 10, esc0.mar - 2]; return { fases: [caminar, deslizar(), subida, vuelo([SX, SY], b, 22, 950, (p) => 80 + 10 * p, "brazos", (p) => ({ ojos: p > .7 ? "mareado" : "normal" })), { dur: 600, f: (p) => ({ x: b[0], y: b[1] + 1.5 * p, rot: 90, pose: "brazos", ojos: "mareado" }) }], al: [[4, () => { salpicar(b[0], esc0.mar, 24, 2.2); sonido.plaf(); sonido.chapuzon(true); }]], fin: hundir(b[0], 90) }; },
      // resbalón: da vueltas sin control por la resbaladilla y cae de lado
      () => { const b = [86 + Math.random() * 6, esc0.mar + 1]; return { fases: [caminar, deslizar(620), { dur: 160, f: (p) => ({ x: P3[0] + (SX - P3[0]) * p, y: P3[1] - 3.2 + (SY - P3[1]) * p, rot: ang(1) + 90 + 620 + 200 * p, pose: "brazos", ojos: "mareado" }) }, vuelo([SX, SY], b, 6, 520, (p) => 780 + 260 * p, "brazos", { ojos: "mareado" })], al: [[4, () => { salpicar(b[0], esc0.mar, 14, 1.2); sonido.chapuzon(); }]], fin: hundir(b[0], 1040) }; },
      // choque con el hielo: un témpano se atraviesa, se pega y cae
      () => { const c = [96, 80]; return { hielo: `<g opacity="0"><animate attributeName="opacity" from="0" to="1" dur=".4s" fill="freeze"/><path d="M89 ${esc0.mar + 1} L92 84 L99 79 L105 82 L107 ${esc0.mar + 1} Z" fill="#E6F7FF" stroke="#7CB8D2" stroke-width=".4"/><path d="M99 79 L105 82 L107 ${esc0.mar + 1} L101 ${esc0.mar + 1} Z" fill="#9ED3EA" opacity=".7"/></g>`, fases: [caminar, deslizar(), subida, vuelo([SX, SY], [c[0] - 6, c[1] - 2], 16, 700, (p) => 80 + 30 * p, "parado"), { dur: 260, f: (p) => ({ x: c[0] - 6 - 5 * p, y: c[1] - 2 - 4 * Math.sin(Math.PI * p), rot: 110 - 70 * p, pose: "brazos", ojos: "mareado" }) }, vuelo([c[0] - 11, c[1] - 2], [c[0] - 12, esc0.mar + 1], 0, 420, (p) => 40 + 160 * p, "brazos", { ojos: "mareado" })], al: [[4, () => { sonido.golpe(); const g = gSvg(`<g><circle cx="${c[0] - 4}" cy="${c[1] - 5}" r="1.4" fill="#FFE45C"/><circle cx="${c[0] - 8}" cy="${c[1] - 8}" r="1" fill="#FFE45C"/><circle cx="${c[0]}" cy="${c[1] - 8}" r="1.1" fill="#FFE45C"/></g>`); fx.appendChild(g); ctx.luego(() => g.remove(), 900); }], [6, () => { salpicar(c[0] - 12, esc0.mar, 10, .8); sonido.chapuzon(); }]], fin: hundir(c[0] - 12, 200) }; },
      // se quedó corto: aterriza en la orilla del iceberg y se resbala despacito al agua
      () => { const b = [66, esc0.mar - 5]; return { fases: [caminar, deslizar(), subida, vuelo([SX, SY], b, 3, 420, (p) => 80 + 30 * p, "panza"), { dur: 380, f: (p) => ({ x: b[0] + Math.sin(p * Math.PI * 4) * .6, y: b[1], rot: 110, pose: "brazos" }) }, { dur: 900, f: (p) => ({ x: b[0] + 6 * p, y: b[1] + 7 * p * p, rot: 110 + 40 * p, pose: "brazos", ojos: "mareado" }) }], al: [[4, () => sonido.plaf()], [6, () => { salpicar(b[0] + 6, esc0.mar, 7, .7); sonido.chapuzon(); }]], fin: hundir(b[0] + 6, 150) }; },
      // de cabeza en la nieve: brinca antes de la resbaladilla y se clava en un montón de nieve
      () => { const m = [40, 55]; return { hielo: `<g><ellipse cx="${m[0]}" cy="${m[1] + 1}" rx="9" ry="4" fill="#FFFFFF" stroke="#BFE3F2" stroke-width=".4"/><ellipse cx="${m[0] - 2}" cy="${m[1] - 1}" rx="5" ry="2.2" fill="#FFFFFF"/></g>`, fases: [vuelo([inicioP.x, inicioP.y], [m[0], m[1] - 2], 14, 760, (p) => 200 * suave2(p), (p) => p < .5 ? "brazos" : "parado"), { dur: 1400, f: (p) => ({ x: m[0] + Math.sin(p * Math.PI * 7) * .5, y: m[1] - 2, rot: 180 + Math.sin(p * Math.PI * 9) * 7, pose: "parado", ojos: "mareado" }) }], al: [[1, () => { salpicar(m[0], m[1] - 3, 16, 1, "#FFFFFF"); sonido.plaf(); }]], frente: `<ellipse cx="${m[0]}" cy="${m[1] + .5}" rx="7.5" ry="2.6" fill="#FFFFFF"/>` }; },
    ];
    const elegirSin = (n, ultimo) => { let k; do { k = Math.floor(Math.random() * n); } while (n > 1 && k === ultimo); return k; };
    const clavar = (ok, listo) => {
      const k = ok ? (ultimoBien = elegirSin(CLAVADOS.length, ultimoBien)) : (ultimoMal = elegirSin(FALLAS.length, ultimoMal));
      const a = (ok ? CLAVADOS : FALLAS)[k]();
      if (a.fin) a.fases.push(a.fin);
      hielo.innerHTML = a.hielo ?? "";
      fx.querySelectorAll(".frente").forEach((x) => x.remove());
      if (a.frente) fx.appendChild(gSvg(a.frente, "")).classList.add("frente");
      a.fases.push({ dur: 450, f: (p) => ({ x: inicioP.x, y: inicioP.y - 6 * (1 - p), rot: 0, pose: "parado", op: p }) });
      anim = { ...a, t0: performance.now(), hechos: new Set(), listo, nombre: (ok ? nombresBien : nombresMal)[k] ?? "", ok };
      sonido.whoosh();
      const nombre = anim.nombre, este = anim, total = a.fases.reduce((n, f) => n + f.dur, 0);
      ctx.luego(() => cartel(nombre, ok), ok ? 2300 : 1900);
      ctx.luego(() => { if (anim === este) terminarAnim(); }, total + 700);
    };
    // Fin de la animación (también por temporizador, por si el navegador frena los cuadros con la pestaña oculta).
    const terminarAnim = () => { if (!anim) return; const a0 = anim; a0.fases.forEach((_, k) => { if (!a0.hechos.has(k)) { a0.hechos.add(k); a0.al?.filter(([n]) => n === k + 1).forEach(([, f]) => f()); } }); hielo.innerHTML = ""; fx.querySelectorAll(".frente").forEach((x) => x.remove()); anim = null; pintarP({ x: inicioP.x, y: inicioP.y, rot: 0 }); a0.listo?.(); };
    const pintarP = (st) => {
      ponerPose(st.pose ?? "parado", st.ojos ?? (anim?.ok ? "normal" : "normal"));
      gP.setAttribute("transform", `translate(${st.x.toFixed(2)} ${st.y.toFixed(2)}) rotate(${(st.rot ?? 0).toFixed(1)}) scale(${((st.sx ?? 1) * E).toFixed(3)} ${E}) translate(-8 -10)`);
      gP.setAttribute("opacity", (st.op ?? 1).toFixed(2));
    };
    bucle(el, ctx, (dt, t, fuera) => {
      if (fuera) return false;
      if (anim) {
        let e = t - anim.t0, k = 0;
        while (k < anim.fases.length && e > anim.fases[k].dur) { e -= anim.fases[k].dur; if (!anim.hechos.has(k)) { anim.hechos.add(k); anim.al?.filter(([n]) => n === k + 1).forEach(([, f]) => f()); } k++; }
        if (k >= anim.fases.length) terminarAnim();
        else pintarP(anim.fases[k].f(Math.min(1, e / anim.fases[k].dur)));
      } else pintarP({ x: inicioP.x, y: inicioP.y + Math.sin(t / 300) * .3, rot: Math.sin(t / 700) * 2 });
      for (let k = particulas.length - 1; k >= 0; k--) { const q = particulas[k]; q.vy += 160 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vida -= dt * .9; if (q.vida <= 0 || q.y > esc0.mar + 8) { q.c.remove(); particulas.splice(k, 1); continue; } q.c.setAttribute("cx", q.x.toFixed(2)); q.c.setAttribute("cy", q.y.toFixed(2)); q.c.setAttribute("opacity", Math.max(0, q.vida).toFixed(2)); }
      return true;
    });
    // El jurado levanta sus tablillas: 10 en un acierto; de 1 a 4 en un error.
    const calificar = (ok) => {
      const notas = [0, 1, 2].map(() => ok ? 10 : 1 + Math.floor(Math.random() * 4));
      notas.forEach((n, k) => { const tab = svg.querySelector("#jz" + k), tx = svg.querySelector("#jz" + k + "n"); tx.textContent = String(n); tab.style.transition = `transform .35s cubic-bezier(.3,1.5,.6,1) ${k * .12}s, opacity .2s ${k * .12}s`; tab.style.transform = "translate(0px, 0px)"; tab.style.opacity = "1"; ctx.luego(() => { tab.style.transform = "translate(0px, 16px)"; tab.style.opacity = "0"; }, 1900 + k * 100); });
      ok ? sonido.brillo() : sonido.nivel();
      puntos += notas.reduce((a, b) => a + b, 0); promedios.push(notas.reduce((a, b) => a + b, 0) / 3);
    };
    const preguntar = () => {
      const qb = el.querySelector("#qbox"); qb.innerHTML = ""; textos();
      if (i >= N) {
        const prom = promedios.length ? promedios.reduce((a, b) => a + b, 0) / promedios.length : 0;
        const titulo = prom >= 9 ? T("ping_oro") : prom >= 7 ? T("ping_plata") : prom >= 5 ? T("ping_bronce") : T("ping_sigue");
        fin(el, ctx, titulo, prom.toFixed(1), `${esc(T("promedio"))} · ${aciertos}/${N} ${esc(T("correctas"))}`, () => ctx.go(ctx.cur), prom >= 7);
        return;
      }
      el.querySelector("#qn").textContent = `${T("pregunta")} ${i + 1} ${T("de")} ${N}`;
      const a = ctx.c.porId[ids[i]];
      if (!a) { i++; preguntar(); return; }
      const q = panelPregunta(a, ctx, (ok, txt) => {
        timer?.detener();
        if (ok) aciertos++;
        toast(el, ok, txt, ok ? 2600 : 3800);
        clavar(ok, () => { calificar(ok); i++; textos(); ctx.luego(preguntar, 2200); });
      });
      qb.appendChild(q);
      timer = temporizador(el.querySelector("#tm"), TL, () => q.agotar(), ctx);
    };
    preguntar();
  };
  arranque(el, T, "pinguino", jugar);
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

// ---------- EL PERRO Y SU PLATO (8 nov 2026): verdadero o falso ----------
// Un border collie entre dos platos ("Verdadero" y "Falso"). La tarjeta de la afirmación se arrastra al plato (o se toca
// y luego se toca el plato). Correcto = el perro se la come feliz y mueve la cola. Incorrecto = el perro la huele, dice que
// no y la regresa con la nariz, con la retroalimentación; la tarjeta se queda hasta que llegue al plato correcto. Solo
// cuenta el primer intento (ctx.registrar). Usa las afirmaciones que trae el bloque: no se inventan.
export function perro(s, ctx) {
  const T = ctx.t;
  if (!String(s.t).startsWith("🐶")) s.t = `🐶 ${T("perro")}`;
  const el = marco(s, ctx); el.classList.add("pl-perro");
  const items = (s.items ?? []).slice(), N = items.length;
  const PE = 1.05, SUELO = 122, PX = 150, PLATOS = { v: 62, f: 238 };
  const esc0 = escenaPerro(300, 146);
  const platos = Object.entries(PLATOS).map(([k, x]) => `<g transform="translate(${x - 28} ${SUELO + 2 - 14 * 1.4}) scale(1.4)">${capaPlato(0, 0, k === "v" ? "#2BB673" : "#E5533D", "pl" + k)}</g>`).join("");
  const cont = h(`<div class="perro-juego"><svg viewBox="0 0 300 146" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">${esc0.svg}<g id="perro-mover" style="transition: transform .45s ease-in-out"><g id="perro-g" transform="translate(${PX - 40 * PE} ${SUELO - 68 * PE}) scale(${PE})">${capaPerro(0, 0)}</g></g>${platos}<g id="fx"></g></svg>
    <div class="perro-cuenta">${hudPill("", "pecnt")}${hudPill("", "peok")}</div>
    <div class="perro-plato v drop" data-v="1" role="button" tabindex="0" aria-label="${esc(T("verdadero"))}"><span class="etiqueta">✓ ${esc(T("verdadero"))}</span></div>
    <div class="perro-plato f drop" data-v="0" role="button" tabindex="0" aria-label="${esc(T("falso"))}"><span class="etiqueta">✗ ${esc(T("falso"))}</span></div></div>`);
  el.appendChild(cont);
  const svg = cont.querySelector("svg"), mover = svg.querySelector("#perro-mover"), perroG = svg.querySelector("#perro-g"), fx = svg.querySelector("#fx");
  const zonas = [...cont.querySelectorAll(".perro-plato")];
  let i = 0, primeros = 0, ocupado = false, carta = null, elegida = false, terminado = false;
  const intentos = new Set();
  const hud = () => { cont.querySelector("#pecnt").textContent = `🦴 ${Math.min(i + 1, N)}/${N}`; cont.querySelector("#peok").textContent = `${primeros} ✓`; };
  const clase = (c, on = true) => perroG.classList.toggle(c, on);
  const casa = () => ({ left: (cont.clientWidth - carta.offsetWidth) / 2, top: 18 });
  const ponerEn = (pos, anim = true, extra = "") => { carta.style.transition = anim ? "left .45s cubic-bezier(.3,.9,.4,1), top .45s cubic-bezier(.3,.9,.4,1), transform .45s, opacity .35s" : "none"; carta.style.left = pos.left + "px"; carta.style.top = pos.top + "px"; carta.style.transform = extra; };
  const marcar = (on) => { elegida = on; carta?.classList.toggle("sel", on); zonas.forEach((z) => z.classList.toggle("listo", on)); };
  const corazones = (x) => { const g = gSvg([[-6, 0], [0, -5], [7, -1]].map(([dx, dy]) => `<path class="corazon-pe" d="M${x + dx} ${44 + dy} c-1.2 -1.6 -3.6 -.6 -2.8 1.2 l2.8 2.6 l2.8 -2.6 c.8 -1.8 -1.6 -2.8 -2.8 -1.2 z" fill="#FF6B9D"/>`).join("")); fx.appendChild(g); ctx.luego(() => g.remove(), 1300); };
  const nueva = () => {
    carta?.remove(); carta = null; marcar(false);
    if (i >= N) { terminado = true; fin(el, ctx, T("perro_listo"), `${primeros}/${N}`, `${esc(T("correctas"))} ${esc(T("primer_intento"))}`, () => ctx.go(ctx.cur), primeros >= N * .7); return; }
    hud();
    const a = items[i];
    carta = h(`<div class="perro-carta"><div class="em">${esc(a.emoji ?? "🤔")}</div><div><div class="afirmacion">${esc(a.afirmacion ?? a.pregunta ?? "")}</div>${a.afirmacion_apoyo ? `<div class="apoyo">${esc(a.afirmacion_apoyo)}</div>` : ""}</div></div>`);
    cont.appendChild(carta);
    ponerEn(casa(), false, "scale(.6)"); carta.style.opacity = "0";
    const esta = carta; ctx.luego(() => { if (carta !== esta) return; ponerEn(casa(), true, ""); carta.style.opacity = "1"; }, 40);
    arrastrable(carta, ctx, (c, zona) => {
      if (ocupado || !zona.classList.contains("perro-plato")) return false;
      // La tarjeta se queda donde la soltaron (arrastrable quita su desplazamiento) y de ahí vuela al plato.
      const m = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(c.style.transform), p = casa();
      ponerEn({ left: p.left + (m ? +m[1] : 0), top: p.top + (m ? +m[2] : 0) }, false);
      ctx.luego(() => juzgar(zona.dataset.v === "1"), 30);
      return true;
    }, () => { if (!ocupado) { marcar(!elegida); sonido.toque(); } });
  };
  const juzgar = (v) => {
    if (ocupado || !carta || terminado) return; ocupado = true; marcar(false);
    const a = items[i], ok = v === !!a.es_verdadera, lado = v ? "v" : "f";
    const primera = !intentos.has(a.id ?? i); intentos.add(a.id ?? i);
    if (a.id) ctx.registrar(a.id, ok);
    if (ok && primera) primeros++;
    const x = PLATOS[lado] / 300 * cont.clientWidth, y = (SUELO - 12) / 146 * cont.clientHeight;
    ponerEn({ left: x - carta.offsetWidth / 2, top: y - carta.offsetHeight / 2 }, true, "scale(.42)");
    sonido.whoosh();
    mover.style.transform = `translate(${(PLATOS[lado] - PX) * .9}px, 0px)`;
    clase("atento");
    if (ok) {
      ctx.luego(() => { clase("atento", false); clase("comiendo"); sonido.nam(); }, 480);
      ctx.luego(() => carta?.classList.add("comida"), 800);
      ctx.luego(() => { sonido.nam(); }, 1000);
      ctx.luego(() => { clase("comiendo", false); clase("feliz"); corazones(PLATOS[lado] * .9 + PX * .1); sonido.ladrido(); toast(el, true, a.retro_correcta ?? "✓", 2200); hud(); }, 1500);
      ctx.luego(() => { mover.style.transform = ""; }, 2300);
      ctx.luego(() => { clase("feliz", false); i++; ocupado = false; nueva(); }, 2800);
    } else {
      ctx.luego(() => { clase("atento", false); clase("no"); toast(el, false, a.retro_incorrecta ?? `${T("respuesta")}: ${a.es_verdadera ? T("verdadero") : T("falso")}`, 3800); }, 600);
      ctx.luego(() => { clase("no", false); clase("empuja"); }, 1500);
      ctx.luego(() => { if (carta) ponerEn(casa(), true, ""); sonido.whoosh(); }, 1750);
      ctx.luego(() => { mover.style.transform = ""; }, 2200);
      ctx.luego(() => { clase("empuja", false); ocupado = false; hud(); }, 2700);
    }
  };
  zonas.forEach((z) => { const ir = () => { if (carta && !ocupado) juzgar(z.dataset.v === "1"); }; z.addEventListener("click", ir); z.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); ir(); } }); });
  ctx.luego(() => { if (cont.isConnected) nueva(); }, 0);
  arranque(el, T, "perro", () => {});
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
  mezclar(pares).forEach((p) => { const fila = h(`<div class="fila"><div class="drop" data-k="${esc(p.termino)}"></div>${p.imagen && !s.retratos ? `<img class="retrato-chico" src="${esc(p.imagen)}" alt=""${attrsFoto(p.imagen)}>` : ""}<div class="def">${esc(p.definicion)}</div></div>`); body.querySelector("#R").appendChild(fila); const z = fila.querySelector(".drop"); z.addEventListener("click", () => sel.enZona(z, soltar)); });
  mezclar(pares).forEach((p) => { const c = h(p.imagen && s.retratos ? `<div style="display:flex;align-items:center;gap:8px"><img class="retrato-chico" src="${esc(p.imagen)}" alt=""${attrsFoto(p.imagen)}>${esc(p.termino)}</div>` : `<div>${esc(p.termino)}</div>`); c.dataset.k = p.termino;
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
  es: { titulo: "Duelo", instr: "Duelo contra el dragón: contesta cada pregunta antes de que se acabe el tiempo. Si aciertas, tu personaje ataca con su espada y el dragón pierde vida; si fallas, el dragón te lanza fuego y pierdes vida. Gana quien deje al otro sin vida.", sparky: "SPARKY", princesa: "PRINCESA", dragon: "DRAGÓN", round: "ROUND", pelea: "¡A pelear!", ko: "K.O.", ganaste: "¡Venciste al dragón!", gano_tiempo: "¡Ganaste el duelo!", revancha: "¡Revancha!", animo: "El dragón ganó este round. Repasa la pista y vuelve a intentarlo: cada pregunta que repasas te hace más fuerte.", repasar: "📖 Repasar la pista", combo: "COMBO", golpe: "¡GOLPE!", vida: "Vida", preguntas_fin: "Se acabaron las preguntas" },
  en: { titulo: "Duel", instr: "Duel against the dragon: answer each question before time runs out. If you are right, your character strikes with the sword and the dragon loses health; if you are wrong, the dragon breathes fire and you lose health. Whoever runs out of health first loses.", sparky: "SPARKY", princesa: "PRINCESS", dragon: "DRAGON", round: "ROUND", pelea: "Fight!", ko: "K.O.", ganaste: "You defeated the dragon!", gano_tiempo: "You won the duel!", revancha: "Rematch!", animo: "The dragon won this round. Review the clue and try again: every question you review makes you stronger.", repasar: "📖 Review the clue", combo: "COMBO", golpe: "HIT!", vida: "Health", preguntas_fin: "No more questions" },
  fr: { titulo: "Duel", instr: "Duel contre le dragon : réponds à chaque question avant la fin du temps. Si tu as raison, ton personnage frappe avec son épée et le dragon perd de la vie ; si tu te trompes, le dragon crache du feu et tu perds de la vie. Celui qui n'a plus de vie perd.", sparky: "SPARKY", princesa: "PRINCESSE", dragon: "DRAGON", round: "ROUND", pelea: "Au combat !", ko: "K.O.", ganaste: "Tu as vaincu le dragon !", gano_tiempo: "Tu as gagné le duel !", revancha: "Revanche !", animo: "Le dragon a gagné cette manche. Revois l'indice et réessaie : chaque question revue te rend plus fort.", repasar: "📖 Revoir l'indice", combo: "COMBO", golpe: "TOUCHÉ !", vida: "Vie", preguntas_fin: "Plus de questions" },
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
  let quien = personaje();
  const capaSp = (pose) => `<g class="sp-flota">${capaHeroe(quien, pose + "+espada", 0, 0)}</g>`;
  const nombreSp = () => td(ctx, quien === "princesa" ? "princesa" : "sparky");
  const escena = () => escenaSvg(arena.svg, AW, AH,
    `<g id="dr" transform="translate(${DR.x} ${drY}) scale(${DR.esc})"><g class="dr-golpe">${capaDragonDuelo(paleta, 0, 0)}</g></g>
     <g id="sp" transform="translate(${SP.x} ${spY}) scale(${SP.esc})"><g class="sp-golpe">${capaSp("decidido")}</g></g>
     <g id="fx"></g>`);
  el.appendChild(h(`<div class="juego duelo-juego"><div class="escena-caja duelo-arena" id="caja"></div>${panel(ctx, `<div class="pill" id="st"></div>`)}</div>`));
  fondoPrevio(el, escena());

  const jugar = (ids, ronda) => {
    quien = personaje();
    let i = 0, aciertos = 0, racha = 0, timer = null, terminado = false, anim = null;
    const golpesDragon = Math.max(1, Math.ceil(ids.length * .6)), golpesSparky = Math.max(1, ids.length - golpesDragon + 1);
    let vidaDr = golpesDragon, vidaSp = golpesSparky;
    const malas = [];
    const caja = el.querySelector("#caja");
    caja.classList.remove("parado");
    caja.innerHTML = escena() + `<div class="duelo-hud">
        <div class="duelo-lado sp"><span class="duelo-nombre">${esc(nombreSp())}</span><div class="duelo-vida" role="meter" aria-label="${esc(td(ctx, "vida"))} ${esc(nombreSp())}"><i class="rastro"></i><i class="vida"></i></div></div>
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
  const ov = inicio(el, td(ctx, "instr"), () => jugar(s.ids.slice(), 1), selectorPersonaje(ctx), { titulo: T("como_jugar"), boton: T("iniciar") });
  conectarSelector(ov, (p) => { quien = p; fondoPrevio(el, escena()); });
  return el;
}
