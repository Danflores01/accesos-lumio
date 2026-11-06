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

export function inicio(sl, instruccion, fn, extraHtml = "") {
  const o = h(`<div class="inicio">${extraHtml}<div class="instruccion">${esc(instruccion)}</div><button class="start">START</button></div>`);
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
