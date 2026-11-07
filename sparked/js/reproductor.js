// El reproductor: carga la guía (demo, vista previa o acceso con clave), arma el estante y navega como Lumio.
import { normalizar, armarSlides, recortarVistaPrevia, t as tx } from "./cartucho.js";
import { portada, tutorial, teoria, resultados, candado, pantallaCarga, mensaje } from "./teoria.js";
import * as J from "./juegos.js";
import { h, esc } from "./ui.js";
import { sonido } from "./sonido.js";
import { CONFIG } from "./config.js";

const escenario = document.getElementById("escenario");
const params = new URLSearchParams(location.search);
const token = (location.hash || "").replace(/^#/, "").trim();
const esToken = /^[A-Za-z0-9]{8,64}$/.test(token);
// Si en la misma pestaña se abre otro link (cambia lo que va después de #), se vuelve a cargar la guía correcta.
window.addEventListener("hashchange", () => location.reload());

let c = null, S = [], cur = 0, escala = 1, timers = [], rafs = [];
const ctx = {
  get c() { return c; }, get S() { return S; }, get cur() { return cur; },
  modo: "demo", precio: CONFIG.precio, resultados: {}, minis: {}, reto: null, guiaId: null,
  t: (k) => tx(c?.plan?.idioma_guia ?? "es", k),
  escala: () => escala,
  go: (i) => { cur = Math.max(0, Math.min(S.length - 1, i)); render(); },
  luego: (f, ms) => { const id = setTimeout(f, ms); timers.push(id); return id; },
  raf: (id) => rafs.push(id),
  registrar: (id, ok) => { if (!(id in ctx.resultados)) { ctx.resultados[id] = ok; ctx.guardar(); } },
  guardar: () => guardar(),
  siguienteTitulo: () => { const n = S[cur + 1]; return n && !["teoria", "portada", "tutorial", "resultados", "candado"].includes(n.k) ? n.t : ""; },
  slideDePista: (pid) => S.findIndex((s) => s.k === "teoria" && (s.pistas ?? []).some((p) => p.id === pid)),
  coche: () => { try { return localStorage.getItem("sparked_coche"); } catch { return null; } },
  setCoche: (v) => { try { localStorage.setItem("sparked_coche", v); } catch {} },
  desbloquear: () => { const volver = params.get("volver"); if (volver) location.href = volver; else if (ctx.guiaId) location.href = `biblioteca.html?guia=${encodeURIComponent(ctx.guiaId)}&paso=pagar`; else location.href = "index.html"; },
};

const R = { portada, tutorial, teoria, resultados, candado, carrera: J.carrera, puertas: J.puertas, montana: J.montana, castillo: J.castillo, swipe: J.swipe, superdato: J.superdato, match: J.match, sort: J.sort, rank: J.rank, ruleta: J.ruleta, quiz: J.quiz };

function limpiar() { timers.forEach(clearTimeout); timers = []; rafs.forEach(cancelAnimationFrame); rafs = []; }
function ajustar() { const vp = document.getElementById("vp").getBoundingClientRect(); escala = Math.min(vp.width / 1280, vp.height / 720) * 0.985; escenario.style.transform = `scale(${escala})`; }
addEventListener("resize", ajustar);
// En teléfonos en vertical la guía queda chica: se sugiere girar el dispositivo (se puede seguir en vertical).
function avisoGiro() {
  const angostoVertical = matchMedia("(orientation: portrait) and (max-width: 600px)").matches;
  const previo = document.getElementById("giro");
  if (!angostoVertical) { previo?.remove(); return; }
  let visto = false; try { visto = !!sessionStorage.getItem("sparked_giro"); } catch {}
  if (visto || previo) return;
  const d = document.createElement("div"); d.id = "giro";
  d.innerHTML = `<div class="caja"><div class="icono">🔄</div><h2>Gira tu teléfono</h2><p>En horizontal la guía se ve mucho más grande y los juegos se controlan mejor.</p><button class="boton chico" type="button">Seguir en vertical</button></div>`;
  d.querySelector("button").onclick = () => { try { sessionStorage.setItem("sparked_giro", "1"); } catch {} d.remove(); };
  document.body.appendChild(d);
}
addEventListener("resize", avisoGiro);
avisoGiro();

function render() {
  limpiar(); escenario.innerHTML = "";
  const s = S[cur]; if (!s) return;
  const el = (R[s.k] ?? portada)(s, ctx);
  el.appendChild(h(`<div class="marca-pie">Spark<b>Ed</b></div>`));
  escenario.appendChild(el);
  document.getElementById("pg").textContent = `${cur + 1}/${S.length}`;
  ajustar(); guardar();
}

// ---------- Navegación ----------
document.getElementById("arriba").onclick = () => ctx.go(cur - 1);
document.getElementById("abajo").onclick = () => ctx.go(cur + 1);
document.getElementById("rejilla").onclick = () => {
  const lista = document.getElementById("lista-mini"); lista.innerHTML = "";
  S.forEach((s, i) => { const b = h(`<button class="${i === cur ? "actual" : ""}" style="border-top-color:${s.blk >= 0 ? `var(--b${(s.blk % 5) + 1})` : "var(--oro)"}"><small>${i + 1}</small><span>${esc(s.t)}</span></button>`); b.onclick = () => { document.getElementById("miniaturas").classList.add("oculto"); ctx.go(i); }; lista.appendChild(b); });
  document.getElementById("miniaturas").classList.remove("oculto");
};
document.getElementById("miniaturas").onclick = (e) => { if (e.target.id === "miniaturas") e.target.classList.add("oculto"); };
document.getElementById("sonido").onclick = (e) => { const s = sonido.alternar(); e.currentTarget.textContent = s ? "🔇" : "🔊"; };
document.getElementById("sonido").textContent = sonido.silencio ? "🔇" : "🔊";
document.getElementById("reportar").onclick = async () => {
  const comentario = prompt(ctx.t("reportar_pregunta") === "reportar_pregunta" ? "¿Qué error viste en esta slide?" : ctx.t("reportar_pregunta"));
  if (!comentario) return;
  try { await fetch(`${CONFIG.api}/reporte`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: esToken ? token : null, guia_id: ctx.guiaId, slide: cur + 1, comentario }) }); alert("¡Gracias! Lo revisamos."); } catch { alert("No se pudo enviar. Intenta de nuevo."); }
};
addEventListener("keydown", (e) => {
  if (e.target?.matches?.("input, textarea")) return;
  // Un juego que se controla con las flechas (data-teclas) se queda con ellas; las slides no cambian.
  if (e.key.startsWith("Arrow") && escenario.querySelector("[data-teclas]")) return;
  if (e.key === "ArrowDown" || e.key === "PageDown") ctx.go(cur + 1);
  if (e.key === "ArrowUp" || e.key === "PageUp") ctx.go(cur - 1);
  if (e.key === "Escape") document.getElementById("miniaturas").classList.add("oculto");
});

// ---------- Progreso (se reanuda donde se quedó) ----------
const claveProgreso = () => "sparked_prog_" + (esToken ? token : params.get("demo") ?? params.get("vp") ?? params.get("clave") ?? "x");
let guardarPendiente = null;
function guardar() {
  const datos = { cur, resultados: ctx.resultados, minis: ctx.minis, reto: ctx.reto, en: Date.now() };
  try { localStorage.setItem(claveProgreso(), JSON.stringify(datos)); } catch {}
  if (ctx.modo === "acceso" && esToken) { clearTimeout(guardarPendiente); guardarPendiente = setTimeout(() => fetch(`${CONFIG.api}/progreso/${token}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ dispositivo: leerSecreto(), datos }) }).catch(() => {}), 3000); }
}
function recuperar(remoto) {
  let local = null; try { local = JSON.parse(localStorage.getItem(claveProgreso()) || "null"); } catch {}
  const p = [local, remoto].filter(Boolean).sort((a, b) => (b.en ?? 0) - (a.en ?? 0))[0];
  if (p) { ctx.resultados = p.resultados ?? {}; ctx.minis = p.minis ?? {}; ctx.reto = p.reto ?? null; cur = Math.min(S.length - 1, p.cur ?? 0); }
}

// Secreto del dispositivo (regla de familia), igual que en entrar.html.
const CLAVE_DISP = "disp_" + token;
function leerSecreto() { try { return localStorage.getItem(CLAVE_DISP) || ""; } catch { return ""; } }
function guardarSecreto(s) { try { if (s) localStorage.setItem(CLAVE_DISP, s); } catch {} }

// ---------- Arranque ----------
function aplicarPaleta() { document.documentElement.dataset.paleta = c.plan.identidad.paleta; document.title = `${c.plan.identidad.titulo} · SparkEd`; }
function montar(cartucho, modo) {
  ctx.modo = modo;
  c = normalizar(cartucho); aplicarPaleta();
  S = armarSlides(c);
  if (modo === "vista_previa") { S = S.filter((s) => s.k !== "resultados" && s.k !== "ruleta"); S.push({ k: "candado", t: ctx.t("desbloquea"), blk: -1 }); }
  return S;
}

async function cargarDatos() { try { return await (await fetch("datos/curiosos.json")).json(); } catch { return []; } }

async function arrancar() {
  ajustar();
  const carga = pantallaCarga({ t: (k) => tx("es", k) }, await cargarDatos());
  escenario.appendChild(carga); carga.actualizar(15, "LOADING…");
  try {
    if (esToken) {
      // Acceso real: pide la guía al servidor con la clave y la marca del dispositivo.
      const r = await fetch(`${CONFIG.api}/acceso/${token}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ dispositivo: leerSecreto() || undefined }) });
      const d = await r.json().catch(() => ({ estado: "error" }));
      if (d.dispositivo) guardarSecreto(d.dispositivo);
      if (d.estado === "generando") {
        // La guía ya está pagada pero Sparky sigue escribiendo bloques: se muestra el avance y se vuelve a intentar.
        carga.detener(); escenario.innerHTML = ""; const msj = mensaje("generando"); escenario.appendChild(msj);
        const pr = d.progreso ?? {}; const p = document.createElement("p"); p.style.cssText = "font-weight:700;color:var(--p)"; p.textContent = `${pr.pct ? pr.pct + "% · " : ""}${pr.mensaje ?? ""}`; msj.querySelector(".caja")?.appendChild(p);
        setTimeout(() => location.reload(), 8000); return;
      }
      if (d.estado !== "ok" || !d.cartucho) { carga.detener(); escenario.innerHTML = ""; escenario.appendChild(mensaje(d.estado ?? "error")); return; }
      ctx.guiaId = d.guia_id ?? null;
      montar(d.cartucho, "acceso"); recuperar(d.progreso ?? null);
    } else if (params.get("vp")) {
      const r = await fetch(`${CONFIG.api}/vista-previa/${encodeURIComponent(params.get("vp"))}`);
      const d = await r.json();
      if (!d.vista_previa) throw new Error("sin vista previa");
      ctx.guiaId = params.get("vp"); montar(d.vista_previa, "vista_previa");
    } else if (params.get("clave")) {
      const r = await fetch(`${CONFIG.api}/borrador/${encodeURIComponent(params.get("clave"))}`);
      const d = await r.json();
      if (!d.vista_previa) throw new Error("borrador sin vista previa");
      montar(d.vista_previa, "vista_previa");
    } else if (params.get("local")) {
      // "Ver como profesor" desde el panel SparkEd: el cartucho viene guardado en este navegador.
      const guardado = localStorage.getItem("sparked_cartucho_" + params.get("local").replace(/[^a-z0-9_-]/gi, ""));
      if (!guardado) throw new Error("sin cartucho local");
      montar(JSON.parse(guardado), "demo"); recuperar(null);
    } else {
      const demo = (params.get("demo") || "historia1").replace(/[^a-z0-9_-]/gi, "");
      const cartucho = await (await fetch(`ejemplos/${demo}.json`)).json();
      const vp = params.get("vista") === "previa";
      montar(vp ? recortarVistaPrevia(normalizar(cartucho)) : cartucho, vp ? "vista_previa" : "demo");
      if (!vp) recuperar(null);
    }
    carga.actualizar(100, "READY");
    await new Promise((r) => setTimeout(r, 350));
    carga.detener(); render();
  } catch (e) {
    console.error(e); carga.detener(); escenario.innerHTML = ""; escenario.appendChild(mensaje("error"));
  }
}
arrancar();
