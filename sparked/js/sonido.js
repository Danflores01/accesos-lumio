// Sonidos sintetizados con Web Audio (sin archivos ni licencias). Versión "videojuego actual" (6 nov 2026):
// tonos suaves con ataque y caída, ruido filtrado para golpes y ráfagas, y un motor que acelera de verdad.
let ctx = null, ruidoBuf = null;
let silencio = false;
// Registro de lo que está sonando: los motores continuos (carreras) y los sonidos cortos ya programados (con su hora
// de creación). detenerTodo() los apaga para que ningún sonido se salga de su slide (Daniel, 7 nov 2026).
const motores = new Set();
const sueltos = new Set();
function registrarSuelto(nodo) { const r = { nodo, creado: performance.now() }; sueltos.add(r); nodo.onended = () => sueltos.delete(r); }
try { silencio = localStorage.getItem("sparked_silencio") === "1"; } catch {}

function audio() {
  if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}
function ruido(c) {
  if (ruidoBuf) return ruidoBuf;
  const b = c.createBuffer(1, c.sampleRate * 1.5, c.sampleRate); const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return (ruidoBuf = b);
}
// Un tono con envolvente: f (Hz) puede deslizarse a f2 durante la duración.
function tono({ f = 440, f2 = null, dur = .2, tipo = "sine", vol = .08, inicio = 0, ataque = .012, filtro = null, q = 1 }) {
  const c = audio(); if (!c || silencio) return;
  const t0 = c.currentTime + inicio;
  const o = c.createOscillator(); const g = c.createGain();
  o.type = tipo; o.frequency.setValueAtTime(f, t0);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + ataque); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  let salida = o;
  if (filtro) { const fl = c.createBiquadFilter(); fl.type = "lowpass"; fl.frequency.value = filtro; fl.Q.value = q; o.connect(fl); salida = fl; }
  salida.connect(g).connect(c.destination);
  o.start(t0); o.stop(t0 + dur + .05);
  registrarSuelto(o);
}
// Ráfaga de ruido filtrado (golpes, silbidos, tics).
function rafaga({ dur = .12, vol = .06, inicio = 0, tipo = "bandpass", f = 1200, f2 = null, q = 1 }) {
  const c = audio(); if (!c || silencio) return;
  const t0 = c.currentTime + inicio;
  const s = c.createBufferSource(); s.buffer = ruido(c);
  const fl = c.createBiquadFilter(); fl.type = tipo; fl.frequency.setValueAtTime(f, t0); fl.Q.value = q;
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + .01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(fl).connect(g).connect(c.destination);
  s.start(t0); s.stop(t0 + dur + .05);
  registrarSuelto(s);
}

export const sonido = {
  get silencio() { return silencio; },
  // Apaga todos los motores continuos y los sonidos cortos que siguen sonando o esperando su turno. Respeta lo que se
  // creó hace menos de 120 ms (el "toque" del mismo botón que cambió de slide). No cambia el botón de silencio.
  detenerTodo() {
    [...motores].forEach((m) => { try { m.detener(); } catch {} });
    motores.clear();
    const ahora = performance.now();
    for (const r of [...sueltos]) {
      if (ahora - r.creado < 120) continue;
      try { r.nodo.stop(); } catch {}
      sueltos.delete(r);
    }
  },
  get activos() { return motores.size; },
  alternar() { silencio = !silencio; try { localStorage.setItem("sparked_silencio", silencio ? "1" : "0"); } catch {} if (silencio) this.detenerTodo(); return silencio; },
  // interfaz
  toque() { tono({ f: 560, f2: 380, dur: .07, vol: .05 }); },
  tic() { rafaga({ dur: .03, vol: .04, f: 2400, q: 3 }); },
  pop() { tono({ f: 320, f2: 680, dur: .09, vol: .07 }); rafaga({ dur: .04, vol: .02, f: 1800 }); },
  // acierto y error
  bien() { tono({ f: 660, dur: .14, vol: .07 }); tono({ f: 990, dur: .22, vol: .07, inicio: .09 }); tono({ f: 1320, dur: .3, tipo: "triangle", vol: .035, inicio: .16 }); },
  mal() { tono({ f: 220, f2: 140, dur: .32, vol: .07, tipo: "triangle" }); rafaga({ dur: .14, vol: .03, tipo: "lowpass", f: 400 }); },
  moneda() { tono({ f: 1318, dur: .08, vol: .06 }); tono({ f: 1760, dur: .32, vol: .07, inicio: .07 }); },
  brillo() { [1500, 2000, 2500].forEach((f, i) => tono({ f, dur: .18, vol: .035, inicio: i * .05 })); },
  // movimiento
  salto() { tono({ f: 300, f2: 760, dur: .2, vol: .06 }); },
  whoosh() { rafaga({ dur: .26, vol: .06, f: 500, f2: 2600, q: .8 }); },
  golpe() { tono({ f: 130, f2: 60, dur: .22, vol: .09 }); rafaga({ dur: .07, vol: .05, tipo: "lowpass", f: 500 }); },
  // Voz de Sparky (Daniel, 7 nov 2026): bips robóticos de alegría cuando lo tocan, uno distinto para cada reacción.
  // Solo suena con un toque o un clic de la persona (nunca solo), y respeta el botón de silencio de las guías.
  sparky(reaccion = "brinco") {
    const bip = (f, f2, dur, inicio, onda = "square", vol = .04) => tono({ f, f2, dur, inicio, tipo: onda, vol, filtro: 2600, q: .8 });
    const VOZ = {
      brinco: () => { bip(660, 990, .09, 0); bip(990, 1480, .12, .1); bip(1480, 1980, .1, .23, "triangle", .05); },
      giro: () => [740, 1110, 830, 1245, 990].forEach((f, i) => bip(f, f * 1.12, .07, i * .065, "triangle", .05)),
      voltereta: () => { rafaga({ dur: .45, vol: .035, f: 380, f2: 1900, q: .7 }); bip(520, 1560, .38, .08, "sine", .05); bip(1560, 2080, .1, .48, "triangle", .045); },
      risa: () => [1250, 1080, 1180, 1000, 1120].forEach((f, i) => bip(f, f * .82, .06, i * .085)),
      corazones: () => { bip(523, 784, .24, 0, "sine", .055); bip(784, 1175, .32, .2, "sine", .05); bip(1568, 1568, .12, .48, "triangle", .03); },
      baile: () => [784, 988, 1175, 1568, 1175, 1568].forEach((f, i) => bip(f, f, .07, i * .09, i % 2 ? "triangle" : "square", .04)),
    };
    (VOZ[reaccion] ?? VOZ.brinco)();
  },
  // momentos
  nivel() { [523, 659, 784, 1047].forEach((f, i) => { tono({ f, dur: .18, vol: .06, inicio: i * .09 }); tono({ f: f / 2, dur: .2, tipo: "triangle", vol: .03, inicio: i * .09 }); }); },
  gameover() { [392, 349, 311, 262].forEach((f, i) => tono({ f, dur: .3, tipo: "triangle", vol: .07, inicio: i * .2 })); rafaga({ dur: .9, vol: .04, tipo: "lowpass", f: 900, f2: 120, inicio: .1 }); },
  victoria() { [523, 523, 523, 659, 784, 659, 784, 1047].forEach((f, i) => { tono({ f, dur: i === 7 ? .6 : .14, vol: .07, inicio: i * .11 }); tono({ f: f * 2, dur: i === 7 ? .6 : .14, tipo: "triangle", vol: .025, inicio: i * .11 }); }); },
  // Galope para la carrera de caballos: cascos rítmicos que se aceleran.
  galopeIniciar() {
    const c = audio();
    if (!c || silencio) return { acelerar() {}, impulso() {}, frenar() {}, detener() {} };
    let intervalo = 520, vivo = true, timer = null;
    const casco = () => { if (!vivo) return; rafaga({ dur: .07, vol: .05, tipo: "lowpass", f: 420 }); rafaga({ dur: .05, vol: .035, tipo: "lowpass", f: 300, inicio: .09 }); timer = setTimeout(casco, intervalo); };
    casco();
    const m = {
      acelerar(v = .5) { intervalo = 620 - v * 320; },
      impulso() { intervalo = 240; setTimeout(() => m.acelerar(.55), 750); },
      frenar() { if (!vivo) return; intervalo = 760; rafaga({ dur: .25, vol: .04, f: 700, f2: 250 }); setTimeout(() => m.acelerar(.4), 900); },
      detener() { if (!vivo) return; vivo = false; clearTimeout(timer); motores.delete(m); },
    };
    motores.add(m);
    return m;
  },
  // Viento y aleteo para la carrera de dragones.
  vientoIniciar() {
    const c = audio();
    if (!c || silencio) return { acelerar() {}, impulso() {}, frenar() {}, detener() {} };
    const s = c.createBufferSource(); s.buffer = ruido(c); s.loop = true;
    const fl = c.createBiquadFilter(); fl.type = "bandpass"; fl.frequency.value = 500; fl.Q.value = .7;
    const g = c.createGain(); g.gain.value = 0.0001;
    s.connect(fl).connect(g).connect(c.destination); s.start();
    g.gain.exponentialRampToValueAtTime(0.03, c.currentTime + .5);
    let vivo = true, timer = null, intervalo = 900;
    const aleteo = () => { if (!vivo) return; rafaga({ dur: .3, vol: .045, f: 260, f2: 900, q: .6 }); timer = setTimeout(aleteo, intervalo); };
    aleteo();
    const m = {
      acelerar(v = .5) { fl.frequency.setTargetAtTime(350 + v * 900, c.currentTime, .3); intervalo = 1100 - v * 500; },
      impulso() { if (!vivo) return; g.gain.setTargetAtTime(0.06, c.currentTime, .05); intervalo = 380; setTimeout(() => { if (!vivo) return; g.gain.setTargetAtTime(0.03, c.currentTime, .4); m.acelerar(.55); }, 750); },
      frenar() { if (!vivo) return; fl.frequency.setTargetAtTime(250, c.currentTime, .1); intervalo = 1300; setTimeout(() => m.acelerar(.4), 900); },
      detener() { if (!vivo) return; vivo = false; clearTimeout(timer); motores.delete(m); g.gain.setTargetAtTime(0.0001, c.currentTime, .3); setTimeout(() => { try { s.stop(); } catch {} }, 900); },
    };
    motores.add(m);
    return m;
  },
  // motor corto (compatibilidad) y motor continuo para la carrera
  motor() { tono({ f: 90, f2: 200, dur: .5, tipo: "sawtooth", vol: .035, filtro: 700, q: 2 }); },
  motorIniciar() {
    const c = audio();
    if (!c || silencio) return { acelerar() {}, impulso() {}, frenar() {}, detener() {} };
    const osc = c.createOscillator(); osc.type = "sawtooth"; osc.frequency.value = 70;
    const osc2 = c.createOscillator(); osc2.type = "square"; osc2.frequency.value = 35;
    const fl = c.createBiquadFilter(); fl.type = "lowpass"; fl.frequency.value = 420; fl.Q.value = 2.5;
    const g = c.createGain(); g.gain.value = 0.0001;
    osc.connect(fl); osc2.connect(fl); fl.connect(g).connect(c.destination);
    osc.start(); osc2.start();
    g.gain.exponentialRampToValueAtTime(0.04, c.currentTime + .5);
    let vivo = true;
    const m = {
      acelerar(v = .5) { if (!vivo) return; const f = 60 + v * 120; osc.frequency.setTargetAtTime(f, c.currentTime, .18); osc2.frequency.setTargetAtTime(f / 2, c.currentTime, .18); fl.frequency.setTargetAtTime(320 + v * 1000, c.currentTime, .18); },
      impulso() { if (!vivo) return; osc.frequency.setTargetAtTime(230, c.currentTime, .04); osc2.frequency.setTargetAtTime(115, c.currentTime, .04); fl.frequency.setTargetAtTime(1800, c.currentTime, .04); g.gain.setTargetAtTime(0.06, c.currentTime, .04); setTimeout(() => { if (!vivo) return; m.acelerar(.55); g.gain.setTargetAtTime(0.04, c.currentTime, .3); }, 750); },
      frenar() { if (!vivo) return; osc.frequency.setTargetAtTime(55, c.currentTime, .1); fl.frequency.setTargetAtTime(260, c.currentTime, .1); rafaga({ dur: .3, vol: .04, f: 900, f2: 300 }); setTimeout(() => m.acelerar(.4), 900); },
      detener() { if (!vivo) return; vivo = false; motores.delete(m); g.gain.setTargetAtTime(0.0001, c.currentTime, .25); setTimeout(() => { try { osc.stop(); osc2.stop(); } catch {} }, 900); },
    };
    motores.add(m);
    return m;
  },
};
