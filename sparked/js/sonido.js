// Sonidos de interfaz sintetizados con Web Audio: sin archivos, sin licencias, se pueden apagar.
let ctx = null;
let silencio = false;
try { silencio = localStorage.getItem("sparked_silencio") === "1"; } catch {}

function audio() {
  if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

function nota(freq, inicio, dur, tipo = "square", vol = 0.08) {
  const c = audio(); if (!c || silencio) return;
  const o = c.createOscillator(); const g = c.createGain();
  o.type = tipo; o.frequency.setValueAtTime(freq, c.currentTime + inicio);
  g.gain.setValueAtTime(0, c.currentTime + inicio);
  g.gain.linearRampToValueAtTime(vol, c.currentTime + inicio + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + inicio + dur);
  o.connect(g).connect(c.destination);
  o.start(c.currentTime + inicio); o.stop(c.currentTime + inicio + dur + 0.02);
}

export const sonido = {
  get silencio() { return silencio; },
  alternar() { silencio = !silencio; try { localStorage.setItem("sparked_silencio", silencio ? "1" : "0"); } catch {} return silencio; },
  toque() { nota(880, 0, 0.05, "square", 0.05); },
  bien() { nota(660, 0, 0.08); nota(880, 0.08, 0.08); nota(1320, 0.16, 0.16); },
  mal() { nota(220, 0, 0.12, "sawtooth", 0.06); nota(160, 0.12, 0.2, "sawtooth", 0.06); },
  moneda() { nota(1568, 0, 0.06); nota(2093, 0.06, 0.14); },
  nivel() { [523, 659, 784, 1047].forEach((f, i) => nota(f, i * 0.09, 0.14)); },
  gameover() { [392, 349, 311, 261].forEach((f, i) => nota(f, i * 0.18, 0.22, "triangle", 0.08)); },
  victoria() { [523, 523, 523, 659, 784, 659, 784, 1047].forEach((f, i) => nota(f, i * 0.11, i === 7 ? 0.5 : 0.12)); },
  tic() { nota(1200, 0, 0.03, "square", 0.03); },
  motor() { nota(110, 0, 0.3, "sawtooth", 0.04); nota(140, 0.1, 0.3, "sawtooth", 0.04); },
};
