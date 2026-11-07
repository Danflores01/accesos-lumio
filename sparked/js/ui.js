// Piezas de interfaz que comparten la teoría y los juegos.
import { sonido } from "./sonido.js";
import { icono, sparky } from "./arte.js";

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const h = (html) => { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; };
export const mezclar = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
// "Palabra clave: explicación" → la palabra clave en negritas
export const idea = (x) => { const m = String(x).match(/^([^:]{2,48}):(.*)$/); return m ? `<b>${esc(m[1])}:</b>${esc(m[2])}` : esc(x); };

export function toast(sl, ok, txt, ms = 2600) {
  let t = sl.querySelector(".toast");
  if (!t) { t = h('<div class="toast"></div>'); sl.appendChild(t); }
  t.className = "toast " + (ok ? "ok" : "mal");
  t.textContent = txt;
  requestAnimationFrame(() => t.classList.add("on"));
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove("on"), ms);
  ok ? sonido.bien() : sonido.mal();
}

// Pantalla de instrucciones estilo Lumio: película transparente sobre la actividad, tarjeta con Sparky, el título
// "¿Cómo se juega?", la instrucción de ese juego y el botón Iniciar. op = { titulo, boton } en el idioma de la guía.
export function inicio(sl, instruccion, fn, extraHtml = "", op = {}) {
  const o = h(`<div class="inicio"><div class="tarjeta-inicio">${sparky("saludo", 3)}<div class="titulo">${esc(op.titulo ?? "¿Cómo se juega?")}</div><div class="instruccion">${esc(instruccion)}</div>${extraHtml}<button class="start">${esc(op.boton ?? "Iniciar")}</button></div></div>`);
  o.querySelector(".start").onclick = () => { sonido.toque(); o.remove(); fn(); };
  sl.appendChild(o);
  return o;
}

export function fin(sl, ctx, titulo, grande, sub, otraVez, exito = true) {
  const d = h(`<div class="${exito ? "victoria" : "fin"}">${exito ? `<div class="confeti">${confeti()}</div>${icono("trofeo", 5)}` : ""}<div class="caja" style="${exito ? "background:#fff;color:var(--tinta)" : ""}"><h2 style="font-family:var(--titulos);font-size:30px;color:var(--tinta);text-shadow:none">${esc(titulo)}</h2><div class="grande" style="color:var(--p)">${grande}</div><div>${sub}</div><div class="botones"><button class="btn alt" id="ag">${esc(ctx.t("de_nuevo"))}</button><button class="btn" id="nx">${esc(ctx.t("siguiente"))}</button></div></div></div>`);
  d.querySelector("#ag").onclick = () => { sonido.toque(); otraVez(); };
  d.querySelector("#nx").onclick = () => { sonido.toque(); ctx.go(ctx.cur + 1); };
  sl.appendChild(d);
  exito ? sonido.victoria() : sonido.nivel();
  return d;
}

export function gameOver(sl, ctx, puntos, nivel, otraVez) {
  const g = h(`<div class="gameover crt"><div class="hud-top"><span>${esc(ctx.t("nivel"))} ${String(nivel).padStart(2, "0")}</span><span>SCORE ${String(puntos).padStart(5, "0")}</span></div>
    <div style="display:flex;gap:18px;align-items:center">${icono("calavera", 7)}${sparky("triste", 5)}</div>
    <h2>GAME <span>OVER</span></h2><div class="sub">${icono("calavera", 3)} ${esc(ctx.t("suerte"))}</div><button class="press">▶ ${esc(ctx.t("press_start"))}</button></div>`);
  g.querySelector(".press").onclick = () => { sonido.toque(); g.remove(); otraVez(); };
  sl.appendChild(g);
  sonido.gameover();
  return g;
}

function confeti() {
  const colores = ["#FFD400", "#ef4444", "#3b82f6", "#22c55e", "#a855f7", "#f97316"];
  let s = "";
  for (let i = 0; i < 40; i++) s += `<i style="left:${Math.random() * 100}%;background:${colores[i % colores.length]};animation-duration:${2 + Math.random() * 2}s;animation-delay:${Math.random() * 1.5}s"></i>`;
  return s;
}

// Arrastre genérico (dedo, lápiz o mouse). onDrop(el, zona) devuelve true si se aceptó; si no, la tarjeta regresa con sacudida.
// Si se pasa onTap, un toque sin arrastre (menos de 6 px) llama a onTap(el) en vez de soltar: así se puede jugar
// tocando primero la tarjeta y luego su destino (más cómodo en celular y tablet).
export function arrastrable(el, ctx, onDrop, onTap = null) {
  el.classList.add("card-d");
  el.addEventListener("pointerdown", (e) => {
    if (el.classList.contains("locked")) return;
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    const sx = e.clientX, sy = e.clientY;
    let movio = false;
    el.classList.add("dragging"); el.style.transition = "none";
    const mv = (ev) => { if (Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) > 6) movio = true; el.style.transform = `translate(${(ev.clientX - sx) / ctx.escala()}px,${(ev.clientY - sy) / ctx.escala()}px) rotate(-2deg) scale(1.04)`; };
    const up = (ev) => {
      el.removeEventListener("pointermove", mv); el.removeEventListener("pointerup", up); el.removeEventListener("pointercancel", up);
      el.classList.remove("dragging");
      if (!movio && onTap) { el.style.transition = ""; el.style.transform = ""; onTap(el); return; }
      el.style.visibility = "hidden";
      const zona = document.elementsFromPoint(ev.clientX, ev.clientY).find((x) => x.classList && x.classList.contains("drop"));
      el.style.visibility = "";
      const ok = zona ? onDrop(el, zona) : false;
      if (!ok) { el.style.transition = "transform .3s"; el.style.transform = ""; if (zona) { el.classList.add("shake"); setTimeout(() => el.classList.remove("shake"), 400); } }
      else el.style.transform = "";
    };
    el.addEventListener("pointermove", mv); el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
  });
  return el;
}

// Panel de pregunta con 4 opciones (o 2 para V/F). onAns(ok, texto, actividad).
export function panelPregunta(a, ctx, onAns) {
  const tf = a.tipo === "verdadero_falso";
  const ops = tf ? [ctx.t("verdadero"), ctx.t("falso")] : a.tipo === "completar" ? mezclar([a.respuesta, ...(a.distractores ?? [])]) : (a.opciones ?? []);
  const buena = tf ? (a.es_verdadera ? 0 : 1) : a.tipo === "completar" ? ops.indexOf(a.respuesta) : a.correcta;
  const qt = a.pregunta ?? a.afirmacion ?? a.enunciado ?? "";
  const el = h(`<div class="qcard"><div class="q">${a.emoji ? esc(a.emoji) + " " : ""}${esc(qt)}</div>${a.pregunta_apoyo || a.afirmacion_apoyo || a.enunciado_apoyo ? `<div class="apoyo" style="font-size:15px;color:var(--gris);font-style:italic">${esc(a.pregunta_apoyo ?? a.afirmacion_apoyo ?? a.enunciado_apoyo)}</div>` : ""}</div>`);
  let listo = false;
  ops.forEach((o, i) => {
    const b = h(`<button class="opt">${esc(o)}</button>`);
    b.onclick = () => {
      if (listo) return; listo = true;
      el.querySelectorAll(".opt").forEach((x, j) => { x.disabled = true; if (j === buena) x.classList.add("ok"); });
      const ok = i === buena;
      if (!ok) b.classList.add("mal");
      ctx.registrar(a.id, ok);
      onAns(ok, ok ? (a.retro_correcta ?? "✓") : (a.retro_incorrecta ?? `${ctx.t("respuesta")}: ${ops[buena]}`), a);
    };
    el.appendChild(b);
  });
  if (a.fuente?.cita) el.appendChild(h(`<div class="fuente-cita" style="font-size:13px;color:var(--gris)">📎 ${esc(ctx.t("de_tus_notas"))}${a.fuente.foto ? ` (${esc(String(a.fuente.foto))})` : ""}: “${esc(a.fuente.cita)}”</div>`));
  el.agotar = () => { if (listo) return; listo = true; el.querySelectorAll(".opt").forEach((x, j) => { x.disabled = true; if (j === buena) x.classList.add("ok"); }); ctx.registrar(a.id, false); onAns(false, `${ctx.t("tiempo")} ${ctx.t("respuesta")}: ${ops[buena]}`, a); };
  return el;
}

// ---------- Sparky vivo (7 nov 2026) ----------
// Sparky con vida en las páginas del sitio. En reposo flota, parpadea y mira a los lados; cada 8–15 s hace algo al
// azar: saludar, caminar de un lado a otro de su recuadro o escribir un dato curioso letra por letra en la burbuja.
// Si le pasan el mouse encima saluda y si lo tocan festeja con un brinco, sin estorbar lo demás de la página.
// En la pantalla de espera se queda construyendo (reposo "construyendo"). Con "reducir movimiento" no camina, no
// brinca ni escribe letra por letra: solo cambia de pose.
// op = { escala, reposo, acciones: ["saludar", "caminar", "escribir"], burbuja (elemento donde escribe),
//        siguienteDato: () => texto, cada: [ms, ms], saludoInicial, accesorios ("+casco+taller" en la espera,
//        para que al reaccionar conserve el casco y los bloques) }. Devuelve { detener, hacer(accion) }.
const CORTE = Symbol("corte");
export const movimientoReducido = () => !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// Escribe un texto letra por letra dentro de "el", con cursor. Devuelve { listo (promesa), terminar() }.
// Los lectores de pantalla reciben el texto completo desde el principio.
export function escribirTexto(el, texto, ms = 32) {
  const letras = Array.from(String(texto ?? ""));
  el.innerHTML = `<span class="sr"></span><span class="tecleo activo" aria-hidden="true"></span>`;
  const [sr, vis] = el.children;
  sr.textContent = letras.join("");
  let i = 0, id = null, fin;
  const listo = new Promise((r) => (fin = r));
  const terminar = () => { clearTimeout(id); vis.textContent = letras.join(""); vis.classList.remove("activo"); fin(); };
  if (!letras.length || movimientoReducido()) { terminar(); return { listo, terminar }; }
  const paso = () => {
    if (!el.isConnected) return terminar();
    i = Math.min(letras.length, i + (Math.random() < .3 ? 2 : 1));
    vis.textContent = letras.slice(0, i).join("");
    if (i >= letras.length) return terminar();
    const c = letras[i - 1];
    id = setTimeout(paso, ms * (/[.,;:!?…]/.test(c) ? 5 : c === " " ? 1.5 : 1) * (.7 + Math.random() * .6));
  };
  id = setTimeout(paso, ms);
  return { listo, terminar };
}

export function sparkyVivo(destino, op = {}) {
  const escala = op.escala ?? 6, reposo = op.reposo ?? "quieto", acc = op.accesorios ?? "";
  const [minimo, maximo] = op.cada ?? [8000, 15000];
  const lista = (op.acciones ?? ["saludar", "caminar", "escribir"]).filter((a) => a !== "escribir" || (op.burbuja && op.siguienteDato));
  // La capa .sk-toque (transparente, encima del dibujo) recibe el mouse y los toques: como nunca se reemplaza, un clic
  // no se pierde aunque el dibujo cambie de pose en ese instante.
  destino.innerHTML = `<div class="sparky-vivo sk-anima" aria-hidden="true"><div class="sk-pista"><div class="sk-actor"><div class="sk-dibujo"></div><i class="sk-toque"></i></div></div></div>`;
  const raiz = destino.firstElementChild, pista = raiz.firstElementChild, actor = pista.firstElementChild, dibujo = actor.firstElementChild;
  let pose = "", x = 0, timer = null, tarea = null, prioridad = 0, vivo = true, ultima = "", enfriar = 0;
  let primera = op.saludoInicial ? "saludar" : null;

  const pon = (p) => { const f = p === reposo ? p : p + acc; if (f !== pose) { dibujo.innerHTML = sparky(f, escala); pose = f; } };
  const mirar = (dir) => actor.classList.toggle("izquierda", dir < 0);
  // Cada acción recibe una "tarea" t; si otra la interrumpe (un toque, por ejemplo), sus esperas se cortan.
  const alCortar = (t, f) => { t.alCortar.add(f); return () => t.alCortar.delete(f); };
  const esperar = (t, ms) => new Promise((ok, no) => {
    if (t.cortado) return no(CORTE);
    const quitar = alCortar(t, () => { clearTimeout(id); no(CORTE); });
    const id = setTimeout(() => { quitar(); ok(); }, ms);
  });
  // Camina hasta "a" (px desde el centro de su recuadro) a media figura por segundo, mirando hacia donde va.
  const ir = (t, a) => new Promise((ok, no) => {
    if (t.cortado) return no(CORTE);
    const de = x, dur = Math.abs(a - de) / Math.max(30, actor.offsetWidth * .5) * 1000;
    if (dur < 40) { x = a; pista.style.transform = a ? `translateX(${a}px)` : ""; return ok(); }
    mirar(a - de);
    const an = pista.animate([{ transform: `translateX(${de}px)` }, { transform: `translateX(${a}px)` }], { duration: dur, easing: "linear", fill: "forwards" });
    const fija = (v) => { x = v; pista.style.transform = `translateX(${v}px)`; an.cancel(); };
    const quitar = alCortar(t, () => { let v = x; try { v = new DOMMatrixReadOnly(getComputedStyle(pista).transform).m41; } catch {} fija(v); no(CORTE); });
    an.onfinish = () => { quitar(); fija(a); ok(); };
  });

  const ACCIONES = {
    async saludar(t) { pon("saludo"); await esperar(t, 2600); },
    async caminar(t) {
      const lado = Math.floor((raiz.clientWidth - actor.offsetWidth) / 2) - 6;
      if (lado < 24 || movimientoReducido()) return ACCIONES.saludar(t);
      const d = Math.random() < .5 ? 1 : -1;
      pon("caminando");
      await ir(t, d * lado); await esperar(t, 300);
      await ir(t, -d * lado); await esperar(t, 300);
      await ir(t, 0);
    },
    async escribir(t) {
      const texto = op.siguienteDato?.();
      if (!texto) return ACCIONES.saludar(t);
      pon("escribiendo"); await esperar(t, 500);
      const e = escribirTexto(op.burbuja, texto, op.msLetra ?? 34);
      const quitar = alCortar(t, e.terminar);
      await e.listo; quitar();
      await esperar(t, 1200);
    },
  };

  function cortar(t) { t.cortado = true; for (const f of [...t.alCortar]) f(); t.alCortar.clear(); }
  async function correr(fn, prio = 0) {
    if (tarea) cortar(tarea);
    const t = { cortado: false, alCortar: new Set() };
    tarea = t; prioridad = prio;
    try { await fn(t); } catch (e) { if (e !== CORTE) console.error(e); }
    if (tarea !== t || !vivo) return;
    tarea = null; prioridad = 0;
    if (x !== 0) { x = 0; pista.style.transform = ""; }
    mirar(1); pon(reposo); programar();
  }
  function programar(ms) {
    clearTimeout(timer);
    if (!vivo || !lista.length || movimientoReducido()) return;
    timer = setTimeout(turno, ms ?? minimo + Math.random() * (maximo - minimo));
  }
  function turno() {
    if (!vivo) return;
    if (!raiz.isConnected) return detener();
    if (document.hidden || tarea) return programar();
    const opciones = lista.length > 1 ? lista.filter((a) => a !== ultima) : lista;
    ultima = primera && lista.includes(primera) ? primera : opciones[Math.floor(Math.random() * opciones.length)];
    primera = null;
    correr(ACCIONES[ultima]);
  }
  // Reacción a la gente: mouse encima → saluda; toque o clic → festeja con un brinco. Luego vuelve a lo suyo.
  function reaccionar(tipo) {
    if (!vivo) return;
    const prio = tipo === "toque" ? 2 : 1;
    if (tarea && prioridad >= prio) return;
    if (prio === 1 && Date.now() < enfriar) return;
    enfriar = Date.now() + 3000;
    correr(async (t) => {
      const festeja = prio === 2;
      actor.classList.remove("brinca");
      pon(festeja ? "festejo" : "saludo");
      if (festeja && !movimientoReducido()) { void actor.offsetWidth; actor.classList.add("brinca"); }
      await esperar(t, festeja ? 1500 : 2000);
      actor.classList.remove("brinca");
      if (x !== 0) { pon("caminando"); await ir(t, 0); }
    }, prio);
  }
  function detener() { vivo = false; clearTimeout(timer); if (tarea) cortar(tarea); }

  actor.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") reaccionar("mouse"); });
  actor.addEventListener("pointerdown", () => reaccionar("toque"));
  pon(reposo);
  programar(primera ? 1800 : undefined);
  return {
    detener,
    hacer(a) { if (ACCIONES[a]) { ultima = a; correr(ACCIONES[a]); } else reaccionar(a === "festejo" ? "toque" : "mouse"); },
  };
}

// Barra de tiempo: devuelve {detener}. Llama a onFin cuando se acaba.
export function temporizador(barra, segundos, onFin, ctx) {
  const fin = performance.now() + segundos * 1000;
  let vivo = true;
  const tick = (t) => {
    if (!vivo) return;
    const queda = Math.max(0, fin - t);
    barra.style.width = (100 * queda / (segundos * 1000)) + "%";
    if (queda <= 0) { vivo = false; onFin(); return; }
    if (queda < 4000 && Math.floor(queda / 1000) !== Math.floor((queda + 16) / 1000)) sonido.tic();
    ctx.raf(requestAnimationFrame(tick));
  };
  ctx.raf(requestAnimationFrame(tick));
  return { detener: () => { vivo = false; } };
}
