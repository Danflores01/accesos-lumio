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
// azar: saluda, camina de un lado a otro de su recuadro, escribe un dato curioso letra por letra en la burbuja, vuela
// con su jetpack y hace una travesura, o el dato se traba y Sparky sube volando con su llave a arreglarlo.
// Si le pasan el mouse encima saluda; si lo tocan hace una de sus reacciones (brinco, giro, voltereta con jetpack,
// risa, corazones o baile) con un sonidito robótico de alegría. Nada de esto estorba lo demás de la página.
// En la pantalla de espera se queda construyendo (reposo "construyendo") y al tocarlo reacciona sin moverse de su
// lugar (los bloques van en el mismo dibujo). Con "reducir movimiento" no camina, no vuela, no brinca ni escribe letra
// por letra: solo cambia de pose (y suena si lo tocan).
// op = { escala, reposo, acciones, burbuja (donde escribe), globo (la burbuja completa; si no, la .burbuja que la
//        contiene), siguienteDato: () => texto, cada: [ms, ms], saludoInicial, accesorios ("+casco+taller" en la
//        espera) }. Devuelve { detener, hacer(accion o reacción) }.
const CORTE = Symbol("corte");
export const movimientoReducido = () => !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const GLIFOS = "▓▒░#%&@$*¿?!§";

// Escribe un texto letra por letra dentro de "el", con cursor. Devuelve { listo, terminar(), trabado, destrabar() }.
// Con op.trabar, a media frase se "traba": la caja op.caja tiembla y salen símbolos raros hasta que llaman destrabar().
// Los lectores de pantalla reciben el texto completo desde el principio.
export function escribirTexto(el, texto, ms = 32, op = {}) {
  const letras = Array.from(String(texto ?? ""));
  el.innerHTML = `<span class="sr"></span><span class="tecleo activo" aria-hidden="true"><span class="t"></span><span class="basura"></span></span>`;
  const sr = el.firstElementChild, vis = el.lastElementChild, txt = vis.firstElementChild, basura = vis.lastElementChild;
  sr.textContent = letras.join("");
  const caja = op.caja ?? el;
  let i = 0, id = null, ruido = null, fin, avisar, velocidad = ms, hecho = false, atorado = false, destrabado = !op.trabar;
  const listo = new Promise((r) => (fin = r));
  const trabado = new Promise((r) => (avisar = r));
  const corte = op.trabar ? Math.max(4, Math.floor(letras.length * (.35 + Math.random() * .2))) : -1;
  const limpiar = () => { clearInterval(ruido); ruido = null; basura.textContent = ""; caja.classList.remove("sk-trabado", "sk-reparando"); };
  const terminar = () => { if (hecho) return; hecho = true; clearTimeout(id); limpiar(); txt.textContent = letras.join(""); vis.classList.remove("activo"); avisar(); fin(); };
  const trabar = () => {
    atorado = true; caja.classList.add("sk-trabado");
    const raro = () => { basura.textContent = Array.from({ length: 2 + Math.floor(Math.random() * 3) }, () => GLIFOS[Math.floor(Math.random() * GLIFOS.length)]).join(""); };
    raro(); ruido = setInterval(raro, 110);
    avisar();
  };
  const paso = () => {
    if (!el.isConnected) return terminar();
    i = Math.min(letras.length, i + (Math.random() < .3 ? 2 : 1));
    if (!destrabado && i >= corte) i = corte;
    txt.textContent = letras.slice(0, i).join("");
    if (i >= letras.length) return terminar();
    if (!destrabado && i === corte) return trabar();
    const c = letras[i - 1];
    id = setTimeout(paso, velocidad * (/[.,;:!?…]/.test(c) ? 5 : c === " " ? 1.5 : 1) * (.7 + Math.random() * .6));
  };
  const destrabar = () => {
    if (hecho || destrabado) return;
    destrabado = true; velocidad = ms * .75;
    if (atorado) { atorado = false; limpiar(); id = setTimeout(paso, velocidad); }
  };
  if (!letras.length || movimientoReducido()) terminar();
  else id = setTimeout(paso, ms);
  return { listo, terminar, trabado, destrabar };
}

export function sparkyVivo(destino, op = {}) {
  const escala = op.escala ?? 6, reposo = op.reposo ?? "quieto", acc = op.accesorios ?? "";
  // En el taller (pantalla de espera) los bloques van en el mismo dibujo: ahí reacciona sin moverse de su lugar.
  const taller = reposo === "construyendo" || acc.includes("taller");
  const [minimo, maximo] = op.cada ?? [8000, 15000];
  const globo = op.globo ?? op.burbuja?.closest?.(".burbuja") ?? null;
  const lista = (op.acciones ?? ["saludar", "caminar", "escribir", "volar", "arreglar"])
    .filter((a) => !["escribir", "arreglar"].includes(a) || (op.burbuja && op.siguienteDato))
    .filter((a) => a !== "arreglar" || globo);
  // La capa .sk-toque (transparente, encima del dibujo) recibe el mouse y los toques: como nunca se reemplaza, un clic
  // no se pierde aunque el dibujo cambie de pose en ese instante. .sk-vuelo lo sube con el jetpack y .sk-piso es su
  // sombra, que se queda en el piso.
  destino.innerHTML = `<div class="sparky-vivo sk-anima" aria-hidden="true"><div class="sk-pista"><i class="sk-piso"></i><div class="sk-vuelo"><div class="sk-actor"><div class="sk-dibujo"></div><i class="sk-toque"></i></div></div></div></div>`;
  const raiz = destino.firstElementChild, pista = raiz.firstElementChild, piso = pista.firstElementChild, vuelo = piso.nextElementSibling;
  const actor = vuelo.firstElementChild, dibujo = actor.firstElementChild, toque = actor.lastElementChild;
  let pose = "", x = 0, alto = 0, timer = null, tarea = null, prioridad = 0, vivo = true, ultima = "", ultimaReaccion = "", enfriar = 0;
  let primera = op.saludoInicial ? "saludar" : null;

  // Cambia de pose. Si la tarea que la pide ya fue interrumpida, se detiene ahí (no le pisa la pose a la nueva).
  const pon = (p, t) => {
    if (t && (t.cortado || t !== tarea)) throw CORTE;
    const f = p === reposo ? p : p + acc;
    if (f !== pose) { dibujo.innerHTML = sparky(f, escala); pose = f; }
  };
  const sigue = (t) => { if (t.cortado || t !== tarea) throw CORTE; };
  const mirar = (dir) => actor.classList.toggle("izquierda", dir < 0);
  // Cada acción recibe una "tarea" t; si otra la interrumpe (un toque, por ejemplo), sus esperas se cortan.
  const alCortar = (t, f) => { t.alCortar.add(f); return () => t.alCortar.delete(f); };
  const esperar = (t, ms) => new Promise((ok, no) => {
    if (t.cortado) return no(CORTE);
    const quitar = alCortar(t, () => { clearTimeout(id); no(CORTE); });
    const id = setTimeout(() => { quitar(); ok(); }, ms);
  });
  // Camina (o vuela de lado) hasta "a" px desde el centro de su recuadro, mirando hacia donde va. "rapidez" en figuras
  // por segundo. La promesa trae parar() para detenerse donde va sin cortar la tarea. Si el navegador no avisa que la
  // animación terminó (pestaña oculta, ahorro de batería), un temporizador de respaldo la da por terminada.
  const ir = (t, a, rapidez = .5) => {
    let parar = () => {};
    const p = new Promise((ok, no) => {
      if (t.cortado) return no(CORTE);
      const de = x, dur = Math.abs(a - de) / Math.max(30, actor.offsetWidth * rapidez) * 1000;
      if (dur < 40) { x = a; pista.style.transform = a ? `translateX(${a}px)` : ""; return ok(); }
      mirar(a - de);
      const an = pista.animate([{ transform: `translateX(${de}px)` }, { transform: `translateX(${a}px)` }], { duration: dur, easing: "linear", fill: "forwards" });
      let hecho = false;
      const fija = (v) => { hecho = true; clearTimeout(respaldo); x = v; pista.style.transform = `translateX(${v}px)`; an.cancel(); };
      const aqui = () => { let v = x; try { v = new DOMMatrixReadOnly(getComputedStyle(pista).transform).m41; } catch {} fija(v); };
      const quitar = alCortar(t, () => { if (!hecho) aqui(); no(CORTE); });
      const acabar = () => { if (hecho) return; quitar(); fija(a); ok(); };
      const respaldo = setTimeout(acabar, dur + 250);
      an.onfinish = acabar;
      parar = () => { if (hecho) return; quitar(); aqui(); ok(); };
    });
    p.parar = () => parar();
    return p;
  };
  // Jetpack: sube a "y" px sobre el piso en "ms", con "vueltas" volteretas; la sombra del piso se achica al subir.
  const sombraDe = (y) => { const h = actor.offsetHeight || 100; return { opacity: y > 1 ? Math.max(.25, .9 - y / h) : 0, transform: `scale(${Math.max(.45, 1 - y / (h * 1.4))})` }; };
  const volarA = (t, y, ms, vueltas = 0) => new Promise((ok, no) => {
    if (t.cortado) return no(CORTE);
    const de = alto;
    raiz.classList.add("en-vuelo");
    const a = vuelo.animate([{ transform: `translateY(${-de}px) rotate(0deg)` }, { transform: `translateY(${-y}px) rotate(${360 * vueltas}deg)` }], { duration: ms, easing: "ease-in-out", fill: "forwards" });
    const s = piso.animate([sombraDe(de), sombraDe(y)], { duration: ms, easing: "ease-in-out", fill: "forwards" });
    let hecho = false;
    const fija = (v) => {
      hecho = true; clearTimeout(respaldo);
      alto = v; a.cancel(); s.cancel();
      vuelo.style.transform = v ? `translateY(${-v}px)` : "";
      const sb = sombraDe(v); piso.style.opacity = v ? sb.opacity : ""; piso.style.transform = v ? sb.transform : "";
      if (!v) raiz.classList.remove("en-vuelo");
    };
    const quitar = alCortar(t, () => { if (!hecho) { let v = alto; try { v = -new DOMMatrixReadOnly(getComputedStyle(vuelo).transform).m42; } catch {} fija(Math.max(0, v)); } no(CORTE); });
    // Igual que al caminar: si el navegador no avisa que terminó, el respaldo la da por terminada (nunca se queda en el aire).
    const acabar = () => { if (hecho) return; quitar(); fija(y); ok(); };
    const respaldo = setTimeout(acabar, ms + 250);
    a.onfinish = acabar;
  });
  // Cuánto puede subir sin salirse de su recuadro y cuánto le falta para que la llave toque la burbuja.
  const svg = () => dibujo.firstElementChild?.getBoundingClientRect();
  const techoLibre = () => {
    const s = svg(), c = (raiz.closest(".tile") ?? raiz.parentElement)?.getBoundingClientRect();
    return s && c ? Math.max(0, s.top + alto - c.top - 4) : actor.offsetHeight * .5;
  };
  const hastaGlobo = () => {
    const s = svg(), g = globo?.getBoundingClientRect();
    if (!s || !g) return actor.offsetHeight * .4;
    // La boca de la llave queda como 1.5 unidades (de 20) abajo del borde de arriba del dibujo.
    return Math.max(8, Math.min(techoLibre(), s.top + alto + s.height * 1.5 / 20 - g.bottom + 3));
  };
  const reaccionMovida = (clase) => { if (taller || movimientoReducido()) return; actor.classList.remove("brinca", "gira", "rie", "baila"); void actor.offsetWidth; actor.classList.add(clase); };

  const ACCIONES = {
    async saludar(t) { pon("saludo", t); await esperar(t, 2600); },
    async caminar(t) {
      const lado = Math.floor((raiz.clientWidth - actor.offsetWidth) / 2) - 6;
      if (lado < 24 || movimientoReducido()) return ACCIONES.saludar(t);
      const d = Math.random() < .5 ? 1 : -1;
      pon("caminando", t);
      await ir(t, d * lado); await esperar(t, 300);
      await ir(t, -d * lado); await esperar(t, 300);
      await ir(t, 0);
    },
    async escribir(t) {
      const texto = op.siguienteDato?.();
      if (!texto) return ACCIONES.saludar(t);
      pon("escribiendo", t); await esperar(t, 500);
      const e = escribirTexto(op.burbuja, texto, op.msLetra ?? 34);
      const quitar = alCortar(t, e.terminar);
      await e.listo; quitar(); sigue(t);
      await esperar(t, 1200);
    },
    // Travesura con el jetpack: sube, da una voltereta o se pasea por el aire de un lado a otro, y aterriza.
    async volar(t) {
      if (taller || movimientoReducido()) return ACCIONES.saludar(t);
      const h = actor.offsetHeight;
      pon("volando", t); await esperar(t, 250);
      await volarA(t, Math.min(h * .4, techoLibre()), 520);
      const lado = Math.floor((raiz.clientWidth - actor.offsetWidth) / 2) - 6;
      if (lado > 24 && Math.random() < .5) {
        const d = Math.random() < .5 ? 1 : -1;
        await ir(t, d * lado * .8, 1.1); await ir(t, -d * lado * .5, 1.1); await ir(t, 0, 1.1); mirar(1);
      } else {
        await volarA(t, Math.min(h * .5, techoLibre()), 650, 1);
        await esperar(t, 250);
      }
      await volarA(t, 0, 520);
      pon("festejo", t); await esperar(t, 700);
    },
    // El dato se traba mientras Sparky camina: se sorprende, saca su jetpack y su llave, sube a la burbuja, la aprieta
    // hasta que se compone, da una voltereta de gusto y aterriza mientras el dato termina de escribirse bien.
    async arreglar(t) {
      const texto = op.siguienteDato?.();
      if (!texto || !globo || taller || movimientoReducido()) return ACCIONES.escribir(t);
      const e = escribirTexto(op.burbuja, texto, 42, { trabar: true, caja: globo });
      const quitarE = alCortar(t, e.terminar);
      const lado = Math.floor((raiz.clientWidth - actor.offsetWidth) / 2) - 6;
      if (lado > 24) {
        pon("caminando", t);
        const paseo = ir(t, (Math.random() < .5 ? 1 : -1) * lado * .65);
        await Promise.race([paseo, e.trabado]); sigue(t);
        paseo.parar();
        pon("quieto", t);
      }
      await e.trabado; sigue(t);
      mirar(1); pon("sorprendido", t); await esperar(t, 900);
      pon("arreglando", t); await esperar(t, 200);
      await volarA(t, hastaGlobo(), 700);
      globo.classList.add("sk-reparando");
      await esperar(t, 1600);
      globo.classList.remove("sk-reparando");
      e.destrabar();
      pon("volando", t);
      await volarA(t, Math.min(alto + 14, techoLibre()), 600, 1);
      await volarA(t, 0, 560);
      pon("festejo", t); await esperar(t, 800);
      await e.listo; quitarE(); sigue(t);
      if (x !== 0) { pon("caminando", t); await ir(t, 0); }
    },
  };
  // Repertorio cuando lo tocan (cada una con su sonidito, ver sonido.sparky).
  const REACCIONES = {
    async brinco(t) { pon("festejo", t); reaccionMovida("brinca"); await esperar(t, 1500); },
    async giro(t) { pon("festejo", t); reaccionMovida("gira"); await esperar(t, 1100); },
    async voltereta(t) {
      const h = actor.offsetHeight;
      pon("volando", t);
      await volarA(t, Math.min(h * .35, techoLibre()), 380);
      await volarA(t, Math.min(h * .5, techoLibre()), 560, 1);
      await volarA(t, 0, 420);
      pon("festejo", t); await esperar(t, 650);
    },
    async risa(t) { pon("riendo", t); reaccionMovida("rie"); await esperar(t, 1500); },
    async corazones(t) { pon("enamorado", t); await esperar(t, 1900); },
    async baile(t) { pon("festejo", t); reaccionMovida("baila"); await esperar(t, 1800); },
  };

  function cortar(t) { t.cortado = true; for (const f of [...t.alCortar]) f(); t.alCortar.clear(); }
  async function correr(fn, prio = 0) {
    if (tarea) cortar(tarea);
    const t = { cortado: false, alCortar: new Set() };
    tarea = t; prioridad = prio;
    try { await fn(t); } catch (e) { if (e !== CORTE) console.error(e); }
    if (tarea !== t || !vivo) return;
    tarea = null; prioridad = 0;
    globo?.classList.remove("sk-reparando");
    if (alto) { alto = 0; vuelo.style.transform = ""; piso.style.opacity = ""; piso.style.transform = ""; raiz.classList.remove("en-vuelo"); }
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
  // Reacción a la gente: mouse encima → saluda; toque o clic → una reacción del repertorio, con su sonidito.
  function reaccionar(tipo, cual) {
    if (!vivo) return;
    const prio = tipo === "toque" ? 2 : 1;
    if (tarea && prioridad >= prio) return;
    if (prio === 1 && Date.now() < enfriar) return;
    enfriar = Date.now() + 3000;
    let nombre = "";
    if (prio === 2) {
      const repertorio = taller || movimientoReducido() ? ["brinco", "risa", "corazones"] : Object.keys(REACCIONES);
      const opciones = repertorio.filter((r) => r !== ultimaReaccion);
      nombre = ultimaReaccion = REACCIONES[cual] ? cual : opciones[Math.floor(Math.random() * opciones.length)];
      sonido.sparky(nombre);
    }
    correr(async (t) => {
      if (alto) { pon("volando", t); await volarA(t, 0, 320); }
      if (nombre) await REACCIONES[nombre](t);
      else { pon("saludo", t); await esperar(t, 2000); }
      actor.classList.remove("brinca", "gira", "rie", "baila");
      if (x !== 0) { pon("caminando", t); await ir(t, 0); }
    }, prio);
  }
  function detener() { vivo = false; clearTimeout(timer); if (tarea) cortar(tarea); }

  actor.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") reaccionar("mouse"); });
  toque.addEventListener("click", () => reaccionar("toque"));
  pon(reposo);
  programar(primera ? 1800 : undefined);
  return {
    detener,
    hacer(a) { if (ACCIONES[a]) { ultima = a; correr(ACCIONES[a]); } else reaccionar(a === "saludo" ? "mouse" : "toque", a); },
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
