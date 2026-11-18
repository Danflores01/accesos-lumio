// El reproductor: carga la guía (demo, vista previa o acceso con clave), arma el estante y navega como Lumio.
import { normalizar, armarSlides, recortarVistaPrevia, prepararVistaPrevia, slidesVistaPrevia, dividirSlide, retitular, t as tx } from "./cartucho.js";
import { portada, tutorial, teoria, resultados, candado, terminando, pantallaCarga, mensaje } from "./teoria.js";
import * as J from "./juegos.js";
import { h, esc, desborda, ajustarInicio, precargarFotos, formaDe, vigilarJuego, encajarJuego, algoSeSale, seEnciman } from "./ui.js";
import { sonido } from "./sonido.js";
import { CONFIG } from "./config.js";

const escenario = document.getElementById("escenario");
// La capa "Cargando tu guía…" que guia.html pinta desde el primer byte (17 nov 2026). El reproductor le avisa cuando ya
// puso su pantalla de espera (arriba) y cuando ya hay una slide o un mensaje en pantalla (quitar).
const cargador = window.sparkedCargador ?? null;
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const params = new URLSearchParams(location.search);
const token = (location.hash || "").replace(/^#/, "").trim();
const esToken = /^[A-Za-z0-9]{8,64}$/.test(token);
// Botón "Salir de pantalla completa" (Daniel, 8 nov 2026): la guía abierta a página entera desde el sitio (vista previa
// con "volver", o la demo de la portada) no tenía cómo regresar a la compra. Dentro de un marco no hace falta.
// "volver" llega en el link: solo se acepta si apunta a este mismo sitio (nunca a otro dominio ni a "javascript:").
const volverA = (() => { const v = params.get("volver"); if (!v) return null; try { const u = new URL(v, location.href); return u.origin === location.origin && /^https?:$/.test(u.protocol) ? u.href : null; } catch { return null; } })();
// El botón es del sitio, no de la guía: va en el idioma del sitio (selector ES | EN), no en el de la guía.
const idiomaSitio = (() => { try { return localStorage.getItem("sparked_idioma") === "en" ? "en" : "es"; } catch { return "es"; } })();
// Va en la barra de herramientas (Daniel, 9 nov 2026: nada se encima): flotando arriba a la izquierda tapaba la
// etiqueta del título de cada slide. En vertical flota justo arriba de la barra de abajo, fuera de la slide.
const botonSalir = document.getElementById("salir");
if (botonSalir && window.top === window && (volverA || params.has("demo"))) {
  botonSalir.hidden = false;
  const largo = tx(idiomaSitio, "salir_pantalla");
  botonSalir.innerHTML = `<span aria-hidden="true">✕</span><small>${esc(idiomaSitio === "en" ? "Exit" : "Salir")}</small>`;
  botonSalir.title = largo; botonSalir.setAttribute("aria-label", largo);
  botonSalir.onclick = () => { location.href = volverA || "index.html"; };
}
// Si en la misma pestaña se abre otro link (cambia lo que va después de #), se vuelve a cargar la guía correcta.
window.addEventListener("hashchange", () => location.reload());

let c = null, S = [], cur = 0, escala = 1, timers = [], rafs = [], vigia = null;
const ctx = {
  get c() { return c; }, get S() { return S; }, get cur() { return cur; },
  modo: "demo", precio: CONFIG.precio, resultados: {}, minis: {}, reto: null, guiaId: null,
  // En las guías de universidad algunos textos son más sobrios (cartucho.js, TEXTOS_UNIVERSIDAD): por eso va el perfil.
  t: (k) => tx(c?.plan?.idioma_guia ?? "es", k, c?.plan?.perfil_edad),
  escala: () => escala,
  go: (i) => irA(i),
  luego: (f, ms) => { const id = setTimeout(f, ms); timers.push(id); return id; },
  raf: (id) => rafs.push(id),
  // Apaga motores y sonidos que sigan sonando (lo llama fin() de ui.js al terminar un juego).
  detenerSonidos: () => sonido.detenerTodo(),
  registrar: (id, ok) => { if (!(id in ctx.resultados)) { ctx.resultados[id] = ok; ctx.guardar(); } },
  guardar: () => guardar(),
  siguienteTitulo: () => { const n = S[cur + 1]; return n && !["teoria", "portada", "tutorial", "resultados", "candado"].includes(n.k) ? n.t : ""; },
  slideDePista: (pid) => S.findIndex((s) => s.k === "teoria" && (s.pistas ?? []).some((p) => p.id === pid)),
  coche: () => { try { return localStorage.getItem("sparked_coche"); } catch { return null; } },
  setCoche: (v) => { try { localStorage.setItem("sparked_coche", v); } catch {} },
  desbloquear: () => { const volver = volverA; if (volver) location.href = volver; else if (ctx.guiaId) location.href = `biblioteca.html?guia=${encodeURIComponent(ctx.guiaId)}&paso=pagar`; else location.href = "index.html"; },
};

const R = { portada, tutorial, teoria, resultados, candado, terminando, carrera: J.carrera, puertas: J.enemigos, enemigos: J.enemigos, montana: J.montana, castillo: J.castillo, pinguino: J.pinguino, perro: J.perro, swipe: J.swipe, superdato: J.superdato, match: J.match, sort: J.sort, rank: J.rank, ruleta: J.ruleta, quiz: J.quiz, duelo: J.duelo };

function limpiar() { timers.forEach(clearTimeout); timers = []; rafs.forEach(cancelAnimationFrame); rafs = []; vigia?.disconnect(); vigia = null; }
// El escenario mide 1280 x 720 y se escala a la pantalla. El reporte final es "fluido": toma la forma de la pantalla
// (vertical en teléfono) y nunca se dibuja más chico que su tamaño real, para que sus letras se lean en iPad y teléfono.
function ajustar() {
  const vp = document.getElementById("vp").getBoundingClientRect();
  const fluido = S[cur]?.k === "resultados" && vp.width > 0 && vp.height > 0;
  let w = 1280, h = 720;
  if (fluido) { const k = Math.max(1, Math.min(vp.width / 1280, vp.height / 720)); w = Math.round(vp.width / k); h = Math.round(vp.height / k); }
  escenario.style.width = w + "px"; escenario.style.height = h + "px";
  escenario.classList.toggle("fluido", fluido);
  escenario.classList.toggle("angosto", fluido && w < 760);
  escala = Math.min(vp.width / w, vp.height / h) * 0.985;
  escenario.style.transform = `scale(${escala})`;
  if (fluido) encajarResultados(escenario.querySelector(".reporte"));
}
addEventListener("resize", ajustar);
// El sonido se queda dentro de su slide: si la pestaña se oculta (otra app, otra pestaña, pantalla apagada), se apaga.
document.addEventListener("visibilitychange", () => { if (document.hidden) sonido.detenerTodo(); });
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

// Ir a una slide. Lo normal es que la forma de sus fotos ya se conozca (se miden dos slides antes de llegar) y se
// muestre en el acto. Si todavía no (se llegó muy rápido, se saltó desde las miniaturas o la conexión es muy lenta), se
// espera un momento a conocerla: así la slide sale ya acomodada y nada se mueve cuando la foto termina de bajar.
let abierta = false, viaje = 0, relojFotos = 0;
function irA(i) {
  if (!abierta) return;   // mientras la guía carga, las flechas todavía no llevan a ningún lado
  i = Math.max(0, Math.min(S.length - 1, Number(i) || 0));
  const mio = ++viaje;
  if (!porMedir(S[i]).length) { cur = i; render(); return; }
  clearTimeout(relojFotos);
  relojFotos = setTimeout(() => {
    if (mio !== viaje || escenario.querySelector(".aviso-fotos")) return;
    const texto = { es: "Cargando fotos…", en: "Loading photos…", fr: "Chargement des photos…" }[c?.plan?.idioma_guia] ?? "Cargando fotos…";
    escenario.appendChild(h(`<div class="aviso-fotos" role="status" style="position:absolute;right:16px;top:16px;z-index:30;padding:9px 16px;border-radius:999px;background:rgba(18,24,38,.88);color:#fff;font:700 16px var(--texto)">${esc(texto)}</div>`));
  }, 500);
  formasDe(S[i], ESPERA_FOTOS).then(() => { if (mio === viaje) { cur = i; render(); } });
}

function render() {
  // Cambiar de slide (siguiente, anterior, miniaturas, "Jugar de nuevo") apaga los sonidos de la slide anterior.
  clearTimeout(relojFotos);
  limpiar(); sonido.detenerTodo(); escenario.innerHTML = "";
  cargador?.quitar?.();
  const s = S[cur]; if (!s) return;
  const el = (R[s.k] ?? portada)(s, ctx);
  el.appendChild(h(`<div class="marca-pie">Spark<b>Ed</b></div>`));
  escenario.appendChild(el);
  // Nada se desborda: la teoría se mide ya en pantalla; si ni con la letra mínima cabe, se divide aquí mismo.
  if (s.k === "teoria" && !encajarTeoria(el, s)) {
    const partes = ctx.modo === "vista_previa" ? null : dividirSlide(s); // la vista previa siempre tiene 4 slides
    if (partes) { insertarPartes(cur, partes); return render(); }
    el.querySelector(".cuerpo")?.classList.add("con-desplazamiento");
  }
  // La portada acomoda su título, objetivos y bloques; los juegos y el tutorial bajan su letra hasta que todo quepa
  // (y la vuelven a revisar cada vez que cambia la pregunta o la tarjeta).
  if (s.k === "portada") encajarPortada(el);
  else if (s.k !== "teoria" && s.k !== "resultados") vigia = vigilarJuego(el);
  // Red de seguridad: si una foto o una letra llega tarde y algo deja de caber, la slide se vuelve a acomodar. Una foto
  // que se mostró sin conocer su forma (no llegó a tiempo) la recibe en cuanto baja, para verse igual que las demás.
  const pendientes = [...el.querySelectorAll("img")].filter((im) => !im.complete);
  const llegaron = Promise.all(pendientes.map(fotoTerminada));
  if (pendientes.length) llegaron.then(() => { ponerFormas(el); reacomodar(el, s); });
  // Las fotos de las slides que siguen empiezan a bajar cuando esta ya tiene las suyas (o a los 4 s, lo que pase antes).
  Promise.race([llegaron, espera(4000)]).then(() => { if (S[cur] === s) adelantarFotos(); });
  el.querySelectorAll(".inicio").forEach(ajustarInicio);
  document.getElementById("pg").textContent = `${cur + 1}/${S.length}`;
  ajustar(); guardar();
}

// ---------- Nada se desborda (Daniel, 7 nov 2026) ----------
// Caja invisible de 1280 x 720 donde se miden las slides de teoría antes de mostrarlas.
const medidor = document.createElement("div");
medidor.id = "medidor"; medidor.setAttribute("aria-hidden", "true");
medidor.style.cssText = "position:fixed;left:-40000px;top:0;width:1280px;height:720px;visibility:hidden;pointer-events:none;overflow:hidden";
document.body.appendChild(medidor);
// Elige la letra (de 22 a 18 px) y el alto de las fotos de una slide de teoría ya dibujada, achica el título si se
// monta sobre el cuerpo y deja libre el botón "¡A jugar!". Cabe = nada se sale del cuerpo, ninguna caja se desborda
// por dentro y ninguna caja queda debajo del botón (Daniel, 9 nov 2026). Devuelve false si ni con lo más chico cabe
// (entonces la slide se divide). Con fotos se prefiere la foto grande y la letra de 20 px o más; luego se achica todo.
const HOJAS_TEORIA = ".tcard, .ojo, .claves, .caja-clave, .banda, .dato-rapido, .cat, .lista-iconos .fila, .hito, .comparacion .col, .ciclo .paso, .retrato-col .r, .cuadro, .linea-tiempo";
const COMBOS_TEXTO = [[22, 0], [21, 0], [20, 0], [19, 0], [18, 0]];
const COMBOS_FOTO = [[22, 190], [21, 190], [20, 190], [22, 165], [21, 165], [20, 165], [21, 140], [20, 140], [19, 140], [20, 120], [19, 120], [18, 120], [18, 100], [18, 84]];
function encajarTeoria(el, s) {
  const cuerpo = el.querySelector(".cuerpo"), h1 = el.querySelector(".cabeza h1"), cabeza = el.querySelector(".cabeza");
  if (!cuerpo) return true;
  // Título: de 40 a 28 px; si aun así llega al cuerpo, el cuerpo empieza más abajo.
  h1.style.fontSize = ""; cuerpo.style.top = "";
  for (const px of [36, 32, 30, 28]) { if (cabeza.offsetTop + cabeza.offsetHeight <= cuerpo.offsetTop - 6) break; h1.style.fontSize = px + "px"; }
  const bajo = cabeza.offsetTop + cabeza.offsetHeight + 8;
  if (bajo > cuerpo.offsetTop) cuerpo.style.top = bajo + "px";
  // Botón "¡A jugar!": la caja clave y la banda le dejan su ancho real.
  const boton = el.querySelector(".a-jugar");
  if (boton) cuerpo.querySelectorAll(".fila-clave").forEach((f) => { f.style.marginRight = (boton.offsetWidth + 24) + "px"; });
  const hojas = [...cuerpo.querySelectorAll(HOJAS_TEORIA)];
  const cabe = () => !desborda(cuerpo) && !algoSeSale(el, HOJAS_TEORIA) && !(boton && hojas.some((x) => seEnciman(x, boton, el, 0)));
  for (const [letra, foto] of (cuerpo.querySelector("img") ? COMBOS_FOTO : COMBOS_TEXTO)) {
    el.style.setProperty("--letra", letra + "px");
    if (foto) el.style.setProperty("--alto-foto", foto + "px");
    if (cabe()) { s.letra = letra; return true; }
  }
  s.letra = 18;
  return false;
}
// Portada: el título, el subtítulo, los objetivos, los retratos y la barra de bloques nunca se enciman ni se salen.
// Los títulos largos bajan de tamaño; si aun así no caben, lo de abajo se recorre (nunca queda encima).
function encajarPortada(el) {
  const $ = (q) => el.querySelector(q);
  const texto = $(".texto"), h1 = $(".texto h1"), sub = $(".texto .sub"), aprender = $(".aprender"), objs = $(".objetivos"), bloques = $(".bloques"), derecha = $(".retratos, .mosaicos"), sello = $(".sello-vp");
  if (!texto || !h1 || !aprender || !objs || !bloques) return;
  const fin = (e) => e.offsetTop + e.offsetHeight;
  for (const px of [74, 68, 62, 56, 52, 48, 44]) { h1.style.fontSize = px + "px"; if (fin(texto) <= 396) break; }
  if (sub) for (const px of [20, 18]) { if (fin(texto) <= 396) break; sub.style.fontSize = px + "px"; }
  const arriba = Math.max(410, fin(texto) + 14);
  aprender.style.top = arriba + "px"; objs.style.top = (arriba + 36) + "px";
  const limite = el.offsetHeight - 34; // la marca SparkEd va abajo a la izquierda
  afuera: for (const po of [17, 16, 15, 14]) {
    objs.querySelectorAll(":scope > div").forEach((d) => { d.style.fontSize = po + "px"; });
    for (const pb of [14, 13, 12, 11]) {
      bloques.querySelectorAll(":scope > div").forEach((d) => { d.style.fontSize = pb + "px"; });
      bloques.style.top = Math.max(622, fin(objs) + 14) + "px";
      if (fin(bloques) <= limite) break afuera;
    }
  }
  if (derecha) {
    if (sello && seEnciman(sello, derecha, el)) derecha.style.top = (fin(sello) + 10) + "px";
    for (const px of [124, 112, 100, 90, 80]) { el.style.setProperty("--alto-portada", px + "px"); if (fin(derecha) <= objs.offsetTop - 12) break; }
  }
}
// Vuelve a acomodar la slide que está en pantalla (llegó tarde una foto o una letra). Si la teoría ya no cabe, se
// redibuja para que se divida; la portada y los juegos se reacomodan ahí mismo.
function reacomodar(el, s) {
  if (S[cur] !== s || !el.isConnected) return;
  if (s.k === "teoria") {
    if (encajarTeoria(el, s)) return;
    const partes = ctx.modo === "vista_previa" ? null : dividirSlide(s);
    if (partes) { insertarPartes(cur, partes); render(); } else el.querySelector(".cuerpo")?.classList.add("con-desplazamiento");
  }
  else if (s.k === "portada") encajarPortada(el);
  else if (s.k === "resultados") encajarResultados(el);
  else encajarJuego(el);
}
try { document.fonts?.addEventListener?.("loadingdone", () => { const el = escenario.firstElementChild; if (el && S[cur]) reacomodar(el, S[cur]); }); } catch {}
// Resultados: la columna de la calificación cabe completa; si no hay sitio, Sparky se esconde.
function encajarResultados(el) {
  const res = el?.querySelector(".rep-resumen"); if (!res) return;
  res.classList.remove("compacto");
  if (!escenario.classList.contains("angosto") && desborda(res)) res.classList.add("compacto");
}
// ---------- Fotos con datos celulares (17 nov 2026) ----------
// La guía de ejemplo bajaba 5.5 MB de fotos y esperaba hasta 7 s por todas antes de mostrar la primera slide. Ahora:
//  1. Al abrir solo se piden las fotos de la slide en la que se empieza. Las de las dos slides siguientes bajan cuando
//     esa ya tiene las suyas, y así se va adelantando conforme se avanza: nunca se baja la guía entera de golpe.
//  2. En celular, o con conexión lenta, las fotos de Wikimedia se piden en miniatura: 330 px las que se ven chicas
//     (retratos, línea del tiempo, «¿Quién es quién?») y 500 px las pinturas, mapas y fotos. Si la miniatura no existe,
//     va la foto que venía en la guía. Las fotos que no son de Wikimedia no se tocan. En computadora nada cambia.
//  3. La regla de siempre sigue igual: una slide no se muestra sin conocer la forma de sus fotos (ui.js la saca de los
//     primeros bytes), así que nada se mueve ni se encima cuando la foto termina de bajar.
const FOTO_CHICA = 330, FOTO_GRANDE = 500, ADELANTO = 2, ESPERA_FOTOS = 5000;
const FOTOS_LIGERAS = (() => {
  let chica = false, lenta = false;
  try { chica = Math.min(screen.width || 9999, screen.height || 9999) <= 600; } catch {}
  try { const n = navigator.connection; lenta = !!n && (n.saveData === true || ["slow-2g", "2g", "3g"].includes(n.effectiveType)); } catch {}
  return chica || lenta;
})();
// Miniatura de Wikimedia del ancho pedido. Devuelve la misma URL si no es de upload.wikimedia.org, si no tiene la forma
// conocida o si ya es de ese ancho o más chica (Wikimedia no agranda). Solo usa anchos que Wikimedia sirve siempre.
function fotoLigera(url, ancho) {
  if (!(ancho > 0) || typeof url !== "string") return url;
  const m = /^(https:\/\/upload\.wikimedia\.org\/wikipedia\/[a-z0-9_-]+\/)(thumb\/)?([0-9a-f]\/[0-9a-f]{2}\/)([^\/?#]+)(?:\/([^\/?#]+))?$/i.exec(url);
  if (!m) return url;
  const [, base, thumb, carpeta, archivo, mini] = m;
  if (thumb) {
    // «960px-Foto.jpg», «lossy-page1-960px-Foto.tif.jpg»…: solo cambia el número.
    const n = /^((?:[a-z0-9]+-)*?)(\d+)px-/i.exec(mini ?? "");
    return n && Number(n[2]) > ancho ? `${base}thumb/${carpeta}${archivo}/${n[1]}${ancho}px-${mini.slice(n[0].length)}` : url;
  }
  // Foto original (el servidor la guarda así cuando mide 960 px o menos): se arma su miniatura. Solo fotos comunes.
  const ext = /\.(jpe?g|png)$/i.exec(archivo);
  if (mini || !ext) return url;
  let largo = 0; try { largo = new TextEncoder().encode(decodeURIComponent(archivo)).length; } catch { return url; }
  return `${base}thumb/${carpeta}${archivo}/${ancho}px-${largo > 160 ? "thumbnail" + ext[0].toLowerCase() : archivo}`;
}
// Los lugares donde una guía trae fotos: f(objeto, campo, chica). «chica» = se dibuja en pequeño (retrato o miniatura).
function cadaFoto(c, f) {
  const es = (o, k) => !!o && typeof o[k] === "string" && /^https?:\/\//.test(o[k]);
  (c.plan?.identidad?.retratos_portada ?? []).forEach((r) => es(r, "url") && f(r, "url", true));
  (c.bloques ?? []).forEach((b) => {
    (b.pistas ?? []).forEach((p) => {
      (p.imagenes ?? []).forEach((x) => es(x, "url") && f(x, "url", x.tipo === "retrato"));
      (p.esquema?.elementos ?? []).forEach((e) => es(e, "imagen") && f(e, "imagen", true));
    });
    [...(b.actividades ?? []), ...(b.mini_examen ?? []), ...(b.duelo ?? [])].forEach((a) => (a?.pares ?? []).forEach((p) => es(p, "imagen") && f(p, "imagen", true)));
  });
}
const GUARDADA = new Map();   // miniatura ligera → la dirección que venía en la guía
function aligerarFotos(c) {
  if (!FOTOS_LIGERAS) return;
  // Una misma foto puede salir chica en la portada y grande en una pista: se pide una sola vez, del tamaño mayor.
  const ancho = new Map();
  cadaFoto(c, (o, k, chica) => ancho.set(o[k], Math.max(ancho.get(o[k]) ?? 0, chica ? FOTO_CHICA : FOTO_GRANDE)));
  cadaFoto(c, (o, k) => { const u = o[k], ligera = fotoLigera(u, ancho.get(u)); if (ligera !== u) { GUARDADA.set(ligera, u); o[k] = ligera; } });
}
// La miniatura ligera falló: en la guía y en pantalla vuelve la foto que venía (nunca se pierde una foto por aligerarla).
function regresarFoto(ligera) {
  const guardada = GUARDADA.get(ligera);
  if (!guardada) return null;
  if (c) cadaFoto(c, (o, k) => { if (o[k] === ligera) o[k] = guardada; });
  document.querySelectorAll("#escenario img, #medidor img").forEach((im) => { if (im.getAttribute("src") === ligera) im.src = guardada; });
  return guardada;
}
document.addEventListener("error", (e) => { const im = e.target; if (im?.tagName === "IMG" && GUARDADA.has(im.getAttribute("src"))) regresarFoto(im.getAttribute("src")); }, true);
// Las fotos que puede mostrar una slide: [objeto, campo] de cada una, tal como están en la guía.
function lugaresDeFotos(s) {
  const L = [], es = (o, k) => !!o && typeof o[k] === "string" && /^https?:\/\//.test(o[k]);
  if (s.k === "portada") {
    // Igual que la portada: hasta 4 retratos, y solo si hay 2 o más (con uno solo van los dibujos).
    const retratos = (c.plan?.identidad?.retratos_portada ?? []).filter((r) => r?.url).slice(0, 4);
    if (retratos.length >= 2) retratos.forEach((r) => es(r, "url") && L.push([r, "url"]));
  }
  (s.pistas ?? []).forEach((p) => {
    (p.imagenes ?? []).forEach((x) => es(x, "url") && L.push([x, "url"]));
    (p.esquema?.elementos ?? []).forEach((e) => es(e, "imagen") && L.push([e, "imagen"]));
  });
  [s.a, ...(s.items ?? []), ...(s.ids ?? []).map((id) => c.porId?.[id])].forEach((a) => (a?.pares ?? []).forEach((p) => es(p, "imagen") && L.push([p, "imagen"])));
  return L;
}
const fotosDeSlide = (s) => [...new Set(lugaresDeFotos(s).map(([o, k]) => o[k]))];
// Mide una foto (y la deja bajando). La promesa se cumple cuando ya se sabe su forma, o cuando se sabe que no cargó.
const medidas = new Map(), intentadas = new Set();
function medirFoto(u) {
  if (!medidas.has(u)) medidas.set(u, (async () => {
    let fallo = false;
    await precargarFotos([u], 25000, () => { fallo = true; });
    intentadas.add(u);
    if (fallo && !formaDe(u)) { const guardada = regresarFoto(u); if (guardada) await medirFoto(guardada); }
  })());
  return medidas.get(u);
}
// Las fotos de una slide cuya forma falta por conocer (las que ya se intentaron y no cargaron no se vuelven a esperar).
const porMedir = (s) => (s ? fotosDeSlide(s).filter((u) => !formaDe(u) && !intentadas.has(u)) : []);
const formasDe = (s, ms) => { const urls = porMedir(s); return urls.length ? Promise.race([Promise.all(urls.map(medirFoto)), espera(ms)]) : Promise.resolve(); };
function adelantarFotos() { for (let j = cur + 1; j <= cur + ADELANTO && j < S.length; j++) porMedir(S[j]).forEach(medirFoto); }
// Promesa que se cumple cuando una foto ya en pantalla terminó de bajar (o falló sin remedio). Si la miniatura ligera
// falla, la foto se cambia por la que venía en la guía y se espera esa.
const fotoTerminada = (im) => new Promise((ok) => {
  const oir = () => { im.addEventListener("load", ok, { once: true }); im.addEventListener("error", () => setTimeout(() => (im.complete ? ok() : oir()), 0), { once: true }); };
  oir();
});
function ponerFormas(el) {
  el.querySelectorAll("img:not([data-forma])").forEach((im) => {
    if (!im.naturalWidth || !im.naturalHeight) return;
    im.style.setProperty("--r", Math.max(.2, Math.min(5, im.naturalWidth / im.naturalHeight)).toFixed(4)); im.dataset.forma = "1";
  });
}
// Cambia la slide i por sus partes y recorre lo que depende del número de slide (calificaciones de los mini-exámenes).
function insertarPartes(i, partes) {
  const extra = partes.length - 1;
  S.splice(i, 1, ...partes);
  retitular(S, c.plan.idioma_guia);
  if (extra > 0) {
    const m = {};
    Object.entries(ctx.minis ?? {}).forEach(([k, v]) => { m[Number(k) > i ? Number(k) + extra : k] = v; });
    ctx.minis = m;
  }
}
// Antes de mostrar la guía se mide cada slide de teoría: así la numeración, las miniaturas y el progreso ya salen con
// las slides de continuación incluidas y no cambian a media sesión.
async function prepararTeoria() {
  // Las letras con las que se mide. guia.html pide su hoja sin detener la página y avisa cuando ya está puesta
  // (window.sparkedLetras): se le esperan hasta 3 s y, después, hasta 2.5 s a las letras mismas. Si Google Fonts no
  // responde, la guía se mide con la letra del dispositivo y se reacomoda cuando lleguen (como siempre).
  try { await Promise.race([window.sparkedLetras, espera(3000)]); } catch {}
  try { await Promise.race([Promise.all(['400 20px "Atkinson Hyperlegible"', '700 20px "Atkinson Hyperlegible"', '800 24px "Outfit"'].map((x) => document.fonts.load(x))), espera(2500)]); } catch {}
  const antes = cur, limite = Date.now() + 7000;   // lo más que se espera, en total, por fotos que hagan falta para decidir
  for (let i = 0; i < S.length; i++) {
    if (S[i].k !== "teoria") continue;
    for (let intento = 0; intento < 8; intento++) {
      cur = i;
      if (await cabeTeoria(S[i], limite)) break;
      const partes = dividirSlide(S[i]); if (!partes) break;
      insertarPartes(i, partes);
    }
  }
  medidor.innerHTML = ""; cur = antes;
}
// ¿Cabe esta slide de teoría? Casi siempre se sabe SIN bajar sus fotos, midiéndola dos veces con un hueco en lugar de
// cada foto: con el hueco más grande que una foto puede ocupar (si así cabe, cabe con cualquier foto) y con el más
// chico (si ni así cabe, no cabe con ninguna y la slide se divide). Solo cuando cabe con el chico y no con el grande
// hace falta la forma real de sus fotos para decidir, y entonces sí se piden. El resultado es el de siempre (las mismas
// slides, con la misma numeración), pero abrir la guía ya no espera a las fotos de toda la teoría.
const HUECO = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
async function cabeTeoria(s, limite) {
  // hueco: "" = las fotos de verdad (con la forma que se conozca); "grande" o "chico" = un hueco en lugar de cada foto.
  const medir = (hueco = "") => {
    const lugares = hueco ? lugaresDeFotos(s) : [], urls = lugares.map(([o, k]) => o[k]);
    let el;
    lugares.forEach(([o, k]) => { o[k] = HUECO; });
    try { el = teoria(s, ctx); } finally { lugares.forEach(([o, k], n) => { o[k] = urls[n]; }); }
    // El hueco más chico: la foto más ancha y bajita que se admite (--r = 5, el tope de attrsFoto en ui.js).
    if (hueco === "chico") el.querySelectorAll("img").forEach((im) => { im.style.setProperty("--r", "5"); im.dataset.forma = "1"; });
    medidor.innerHTML = ""; medidor.appendChild(el);
    return encajarTeoria(el, s);
  };
  if (!lugaresDeFotos(s).length) return medir();
  if (medir("grande")) return true;
  if (!medir("chico")) return false;
  const aqui = cur;
  await formasDe(s, Math.max(0, limite - Date.now()));
  cur = aqui;
  return medir();
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
// El avance guardado más reciente (el de este dispositivo o el del servidor), o null si se empieza de cero.
function avanceGuardado(remoto) {
  let local = null; try { local = JSON.parse(localStorage.getItem(claveProgreso()) || "null"); } catch {}
  return [local, remoto].filter(Boolean).sort((a, b) => (b.en ?? 0) - (a.en ?? 0))[0] ?? null;
}
function recuperar(remoto) {
  const p = avanceGuardado(remoto);
  if (p) { ctx.resultados = p.resultados ?? {}; ctx.minis = p.minis ?? {}; ctx.reto = p.reto ?? null; cur = Math.min(S.length - 1, p.cur ?? 0); }
}

// Secreto del dispositivo (regla de familia), igual que en entrar.html.
const CLAVE_DISP = "disp_" + token;
function leerSecreto() { try { return localStorage.getItem(CLAVE_DISP) || ""; } catch { return ""; } }
function guardarSecreto(s) { try { if (s) localStorage.setItem(CLAVE_DISP, s); } catch {} }
// El secreto lo pone este navegador ANTES de pedir la guía (17 nov 2026). Con datos lentos la respuesta puede perderse
// y hay que pedirla otra vez: si el secreto lo pusiera el servidor en cada intento, cada intento gastaría uno de los 2
// dispositivos de la familia. Con el mismo secreto, el servidor reconoce que es el mismo dispositivo. Si el navegador
// no puede crearlo, se pide como antes (sin secreto) y no se reintenta.
let secretoDeEstaVez = "";
function secretoPropio() {
  if (secretoDeEstaVez) return secretoDeEstaVez;
  let s = leerSecreto();
  if (!/^[A-Za-z0-9]{16,64}$/.test(s)) {
    try { const letras = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"; s = Array.from(crypto.getRandomValues(new Uint8Array(32)), (x) => letras[x % letras.length]).join(""); } catch { return ""; }
    guardarSecreto(s);
  }
  return (secretoDeEstaVez = s);
}

// ---------- Arranque ----------
function aplicarPaleta() { document.documentElement.dataset.paleta = c.plan.identidad.paleta; document.documentElement.lang = c.plan.idioma_guia || "es"; document.title = `${c.plan.identidad.titulo} · SparkEd`; }
async function montar(cartucho, modo, parcial = false, enPortada = true) {
  ctx.modo = modo;
  c = normalizar(cartucho); aplicarPaleta();
  // En celular o con conexión lenta, las fotos de Wikimedia se piden en miniatura ligera.
  aligerarFotos(c);
  // Vista previa gratis: portada, una pista (una sola página), dos juegos de formato distinto y el candado.
  if (modo === "vista_previa") prepararVistaPrevia(c);
  S = armarSlides(c);
  if (modo === "vista_previa") { S = slidesVistaPrevia(S); S.push({ k: "candado", t: ctx.t("desbloquea"), blk: -1 }); }
  // Guía pagada que todavía se está terminando: se juegan los bloques que ya existen y al final va un letrero.
  if (parcial) { S = S.filter((s) => s.k !== "resultados" && s.k !== "ruleta"); S.push({ k: "terminando", t: "Estamos terminando los demás bloques", blk: -1 }); }
  // Fotos completas (Daniel, 9 nov 2026): cada foto se acomoda entera y sin recortes, con su forma real. Desde el 17 nov
  // 2026 la forma se mide slide por slide, justo antes de mostrarla (antes se esperaba aquí por las fotos de toda la guía).
  // Si se empieza en la portada, sus fotos se piden de una vez, mientras se acomoda la teoría.
  if (enPortada) porMedir(S[0]).forEach(medirFoto);
  await prepararTeoria();
  // Si la pista de la vista previa no cupo en una página, solo se muestra la primera (lo demás va en la guía completa).
  if (modo === "vista_previa") { let una = false; S = S.filter((s) => s.k !== "teoria" || (!una && (una = true))); retitular(S, c.plan.idioma_guia); }
  return S;
}

// Letrero de arriba mientras se termina la guía (ajuste "jugar durante la generación"). Pregunta cada 30 s, sin gastar
// el acceso, si la guía completa ya está lista; cuando lo está, ofrece abrirla.
function avisoParcial(d) {
  const el = document.createElement("div"); el.id = "aviso-parcial";
  const TERMINANDO = "⏳ Estamos terminando los demás bloques. Te avisamos por correo en cuanto esté lista.";
  const REVISANDO = "🔎 Estamos revisando tu guía; te avisamos por correo en cuanto esté lista.";
  const pinta = (txt, lista = false) => {
    el.innerHTML = `<span>${esc(txt)}</span>${lista ? `<button class="boton chico" type="button">Abrir la guía completa</button>` : ""}`;
    el.classList.toggle("listo", lista);
    const b = el.querySelector("button"); if (b) b.onclick = () => location.reload();
  };
  pinta(d.revision ? REVISANDO : TERMINANDO);
  document.body.appendChild(el);
  const vigila = async () => {
    try {
      const r = await (await fetch(`${CONFIG.api}/acceso/${token}/estado`)).json();
      if (r.completo) { pinta("✅ ¡Tu guía completa está lista!", true); return; }
      pinta(r.revision ? REVISANDO : TERMINANDO);
    } catch {}
    setTimeout(vigila, 30000);
  };
  setTimeout(vigila, 30000);
}

// ---------- Pedir sin quedarse esperando para siempre (17 nov 2026) ----------
// Con datos celulares una petición puede quedarse colgada sin avisar. Si en 15 s no llega nada (ni la respuesta ni un
// dato más) se corta y se intenta una vez más; mientras sigan llegando datos, aunque sea despacio, no se corta. Si
// tampoco responde, quien llama muestra «Algo falló» con el botón «Reintentar» (nunca una pantalla en blanco).
// Devuelve { r, d }: la respuesta y su contenido ya leído (d = null si no era JSON).
const ESPERA_RED = 15000;
async function pedir(hacer, intentos = 2) {
  let fallo = null;
  for (let n = 0; n < intentos; n++) {
    if (n) await espera(1500);
    const corte = new AbortController();
    let reloj = 0, tardo = false;
    const sigue = () => { clearTimeout(reloj); reloj = setTimeout(() => { tardo = true; corte.abort(); }, ESPERA_RED); };
    try {
      sigue();
      const r = await hacer(corte.signal);
      sigue();
      let texto = "";
      if (r.body?.getReader) {
        const lector = r.body.getReader(), letras = new TextDecoder();
        for (;;) { const { done, value } = await lector.read(); if (done) break; texto += letras.decode(value, { stream: true }); sigue(); }
        texto += letras.decode();
      } else texto = await r.text();
      clearTimeout(reloj);
      let d = null; try { d = JSON.parse(texto); } catch {}
      return { r, d };
    } catch (e) {
      clearTimeout(reloj);
      fallo = tardo ? new Error(`no hubo respuesta en ${ESPERA_RED / 1000} s (intento ${n + 1} de ${intentos})`) : e;
    }
  }
  throw fallo;
}
// Los datos curiosos de la pantalla de espera son un adorno: un solo intento y, si no llegan, la pantalla sale sin ellos.
async function cargarDatos() { try { const { r, d } = await pedir((signal) => fetch("datos/curiosos.json", { signal }), 1); return r.ok && Array.isArray(d) ? d : []; } catch { return []; } }
// La guía que toca abrir, según la dirección: acceso con clave, vista previa, borrador o guía de ejemplo. Devuelve la
// promesa de { r, d } (null cuando la guía viene guardada en este navegador, con ?local=).
function pedirGuia() {
  if (esToken) {
    // Acceso real: pide la guía al servidor con la clave y la marca del dispositivo.
    // La dirección termina en /abrir (11 nov 2026): del 10 al 11 de noviembre el servidor respondía «Ruta no
    // encontrada» a POST /acceso/<clave>, porque la entrada con correo del panel se quedaba con esa dirección, y
    // ninguna familia podía abrir su guía. Con /abrir la petición llega siempre a la ruta de las guías.
    const secreto = secretoPropio();
    return pedir((signal) => fetch(`${CONFIG.api}/acceso/${token}/abrir`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ dispositivo: secreto || undefined }), signal }), secreto ? 2 : 1);
  }
  if (params.get("vp")) return pedir((signal) => fetch(`${CONFIG.api}/vista-previa/${encodeURIComponent(params.get("vp"))}`, { signal }));
  if (params.get("clave")) return pedir((signal) => fetch(`${CONFIG.api}/borrador/${encodeURIComponent(params.get("clave"))}`, { signal }));
  if (params.get("local")) return null;
  return pedir((signal) => fetch(`ejemplos/${(params.get("demo") || "historia1").replace(/[^a-z0-9_-]/gi, "")}.json`, { signal }));
}

// Aviso automático (11 nov 2026): si una guía pagada no abre por un fallo nuestro, queda un reporte nuevo en el panel
// para que Daniel se entere en el momento y no cuando una familia le escriba. No se avisa de lo que es normal (link
// vencido, inexistente, en otros dispositivos…). Un solo aviso por link en cada sesión del navegador.
const ESTADOS_NORMALES = new Set(["ok", "generando", "revisando", "inexistente", "borrador", "expirado", "cerrado", "agotado", "revocado", "clase_inactiva", "otro_dispositivo"]);
function avisarFallo(detalle) {
  if (!esToken) return;
  try { if (sessionStorage.getItem("sparked_fallo_" + token)) return; sessionStorage.setItem("sparked_fallo_" + token, "1"); } catch {}
  const equipo = (navigator.userAgent.match(/iPhone|iPad|Android|Windows|Macintosh|Linux/) ?? ["otro equipo"])[0];
  const comentario = `AVISO AUTOMÁTICO: una guía pagada no abrió. ${String(detalle).replace(/\s+/g, " ")} · ${equipo}`.slice(0, 480);
  fetch(`${CONFIG.api}/reporte`, { method: "POST", headers: { "content-type": "application/json" }, keepalive: true, body: JSON.stringify({ token, guia_id: ctx.guiaId ?? undefined, comentario }) }).catch(() => {});
}

async function arrancar() {
  ajustar();
  // La guía se pide de una vez, mientras llegan los datos curiosos de la pantalla de espera (antes iba una cosa después
  // de la otra). Si falla, se atiende abajo, donde se espera su respuesta.
  const pedido = pedirGuia();
  pedido?.catch(() => {});
  const carga = pantallaCarga({ t: (k) => tx("es", k) }, await Promise.race([cargarDatos(), espera(4000).then(() => [])]));
  escenario.appendChild(carga); carga.actualizar(15, "LOADING…");
  cargador?.arriba?.();
  // Un mensaje en lugar de la guía (enlace vencido, guía en preparación, algo falló…). «Algo falló» lleva el botón
  // «Reintentar»: con datos lentos lo más común es que la conexión se haya cortado a medio camino.
  const avisar = (estado) => {
    carga.detener(); escenario.innerHTML = "";
    const m = mensaje(estado), caja = m.querySelector(".caja");
    if (estado === "error" && caja) {
      const b = h(`<button class="boton" type="button" data-reintentar style="margin:4px 0 2px">🔄 Reintentar</button>`);
      b.onclick = () => location.reload();
      caja.insertBefore(b, caja.lastElementChild);
    }
    escenario.appendChild(m); cargador?.quitar?.();
    return m;
  };
  try {
    if (esToken) {
      const { r, d: leido } = await pedido;
      const d = leido ?? { estado: "error" };
      carga.actualizar(55, "LOADING…");
      if (!ESTADOS_NORMALES.has(d.estado) || (d.estado === "ok" && !d.cartucho)) avisarFallo(`El servidor respondió HTTP ${r.status}: ${d.error ?? d.estado ?? "sin estado"}${d.estado === "ok" ? " (sin contenido)" : ""}`);
      if (d.dispositivo) guardarSecreto(d.dispositivo);
      if (d.estado === "generando") {
        // La guía ya está pagada pero Sparky sigue escribiendo bloques: se muestra el avance y se vuelve a intentar.
        const msj = avisar("generando");
        const pr = d.progreso ?? {}; const p = document.createElement("p"); p.style.cssText = "font-weight:700;color:var(--p)"; p.textContent = `${pr.pct ? pr.pct + "% · " : ""}${pr.mensaje ?? ""}`; msj.querySelector(".caja")?.appendChild(p);
        setTimeout(() => location.reload(), 8000); return;
      }
      if (d.estado === "revisando") {
        // El trabajo que termina la guía falló: ya no se dice "generando" para siempre. Se vuelve a revisar cada minuto.
        avisar("revisando");
        setTimeout(() => location.reload(), 60000); return;
      }
      // Un estado que el reproductor no conoce (o «ok» sin contenido) es un fallo nuestro: se dice «Algo falló», no «Enlace no válido».
      if (d.estado !== "ok" || !d.cartucho) { avisar(d.estado && d.estado !== "ok" && ESTADOS_NORMALES.has(d.estado) ? d.estado : "error"); return; }
      ctx.guiaId = d.guia_id ?? null;
      await montar(d.cartucho, "acceso", !!d.parcial, !(avanceGuardado(d.progreso ?? null)?.cur > 0)); recuperar(d.progreso ?? null);
      if (d.parcial) avisoParcial(d);
    } else if (params.get("vp")) {
      const { d } = await pedido;
      if (!d?.vista_previa) throw new Error("sin vista previa");
      carga.actualizar(55, "LOADING…");
      ctx.guiaId = params.get("vp"); await montar(d.vista_previa, "vista_previa");
    } else if (params.get("clave")) {
      const { d } = await pedido;
      if (!d?.vista_previa) throw new Error("borrador sin vista previa");
      carga.actualizar(55, "LOADING…");
      await montar(d.vista_previa, "vista_previa");
    } else if (params.get("local")) {
      // "Ver como profesor" desde el panel SparkEd: el cartucho viene guardado en este navegador.
      const guardado = localStorage.getItem("sparked_cartucho_" + params.get("local").replace(/[^a-z0-9_-]/gi, ""));
      if (!guardado) throw new Error("sin cartucho local");
      await montar(JSON.parse(guardado), "demo", false, !(avanceGuardado(null)?.cur > 0)); recuperar(null);
    } else {
      const { r, d: cartucho } = await pedido;
      if (!r.ok || !cartucho) throw new Error(`sin guía de ejemplo (HTTP ${r.status})`);
      carga.actualizar(55, "LOADING…");
      const vp = params.get("vista") === "previa";
      await montar(vp ? recortarVistaPrevia(normalizar(cartucho)) : cartucho, vp ? "vista_previa" : "demo", false, vp || !(avanceGuardado(null)?.cur > 0));
      if (!vp) recuperar(null);
    }
    // La slide en la que se empieza necesita la forma de sus fotos (solo las suyas): se espera, a lo más, lo que antes
    // se esperaba por las de toda la guía.
    carga.actualizar(85, "LOADING…");
    await formasDe(S[cur], 7000);
    carga.actualizar(100, "READY");
    await espera(350);
    carga.detener(); abierta = true; render();
  } catch (e) {
    console.error(e); avisar("error");
    avisarFallo(`Error al abrirla en el navegador: ${e?.message ?? e}`);
  }
}
arrancar();
