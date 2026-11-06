// Arte propio de SparkEd en pixel art: Sparky, coches, soldados, escalador, íconos y escenas.
// Todo se dibuja en código (sin archivos, sin derechos de terceros) y escala nítido.
import { sprite, capa, medidas } from "./pixel.js";

// ---------- Paletas de sprites ----------
const PAL_SPARKY = { N: "#1f2a5c", W: "#f4f4f6", G: "#c9ccd6", V: "#1e3a8a", L: "#93c5fd", B: "#2563eb", R: "#ef4444", Y: "#fde047", P: "#fb7185" };

// Sparky, el astronauta (16 x 20). Frames: quieto, saludo, festejo, triste, pensando.
const SPARKY = {
  quieto: `
......NNNN......
....NNWWWWNN....
...NWWWWWWWWN...
..NWWWWWWWWWWN..
..NWNVVVVVVNWN..
..NWNVLLVVVNWN..
..NWNVLVVVVNWN..
..NWNVVVVVVNWN..
..NWNNVVVVNNWN..
..NWWWNNNNWWWN..
...NWWWWWWWWN...
....NNNWWNNN....
..NNWWWWWWWWNN..
.NWWNWWWBWWNWWN.
.NWGNWWWWWWNGWN.
.NWGNWWWWWWNGWN.
..NNNWWWWWWNNN..
....NWWNNWWN....
....NWWN.NWWN...
....NNNN.NNNN...`,
  saludo: `
......NNNN....NN
....NNWWWWNN.NWN
...NWWWWWWWWNNWN
..NWWWWWWWWWWNWN
..NWNVVVVVVNWNWN
..NWNVLLVVVNWNWN
..NWNVLVVVVNWNWN
..NWNVVVVVVNWWN.
..NWNNVVVVNNWWN.
..NWWWNNNNWWWN..
...NWWWWWWWWN...
....NNNWWNNN....
..NNWWWWWWWWNN..
.NWWNWWWBWWWWN..
.NWGNWWWWWWNNN..
.NWGNWWWWWWN....
..NNNWWWWWWN....
....NWWNNWWN....
....NWWN.NWWN...
....NNNN.NNNN...`,
  festejo: `
NN....NNNN....NN
NWN.NNWWWWNN.NWN
NWNNWWWWWWWWNNWN
NWNWWWWWWWWWWNWN
NWNWNYVVVVYNWNWN
.NWNNVYVVYVNNWN.
.NWNNVVVVVVNNWN.
.NWWNVYVVVYNWWN.
..NWNNVYYVNNWN..
..NWWWNNNNWWWN..
...NWWWWWWWWN...
....NNNWWNNN....
..NNWWWWWWWWNN..
..NWWWWWBWWWWN..
..NWWWWWWWWWWN..
...NWWWWWWWWN...
..NNNWWWWWWNNN..
....NWWNNWWN....
...NWWN...NWWN..
...NNNN...NNNN..`,
  triste: `
......NNNN......
....NNWWWWNN....
...NWWWWWWWWN...
..NWWWWWWWWWWN..
..NWNVVVVVVNWN..
..NWNVVLVLVNWN..
..NWNVVVVVVNWN..
..NWNVVLLLVNWN..
..NWNNVLVVLNWN..
..NWWWNNNNWWWN..
...NWWWWWWWWN...
....NNNWWNNN....
..NNWWWWWWWWNN..
.NWWNWWWBWWNWWN.
.NWGNWWWWWWNGWN.
.NWGNWWWWWWNGWN.
..NNNWWWWWWNNN..
....NWWNNWWN....
....NWWN.NWWN...
....NNNN.NNNN...`,
  pensando: `
......NNNN...YY.
....NNWWWWNN.YYY
...NWWWWWWWWN.Y.
..NWWWWWWWWWWN..
..NWNVVVVVVNWN..
..NWNVLLVLLNWN..
..NWNVVVVVVNWN..
..NWNVVLLVVNWN..
..NWNNVVVVNNWN..
..NWWWNNNNWWWN..
...NWWWWWWWWN...
....NNNWWNNN....
..NNWWWWWWWWNN..
.NWWNWWWBWWNWWN.
.NWGNWWWWWWNNWN.
.NWGNWWWWWWWNN..
..NNNWWWWWWNNN..
....NWWNNWWN....
....NWWN.NWWN...
....NNNN.NNNN...`,
};

// Coche de carreras visto de lado (24 x 10). C = color, H = brillo, L = ventana, K = llanta, N = contorno.
const COCHE = `
........NNNNNNNN........
......NNHHHHHHHHNN......
.....NHHLLLLLLLLHHN.....
....NCCCLLLLLLLLCCCN....
...NCCCCCCCCCCCCCCCCN...
..NCCCCCCCCCCCCCCCCCCN..
..NCCCCCCCCCCCCCCCCCCN..
..NNNKKNNNNNNNNNNKKNN...
...NKKKKN......NKKKKN...
....NNNN........NNNN....`;
const COLORES_COCHE = {
  rojo: { C: "#ef4444", H: "#fca5a5" }, azul: { C: "#3b82f6", H: "#93c5fd" }, amarillo: { C: "#facc15", H: "#fef08a" },
  verde: { C: "#84cc16", H: "#d9f99d" }, morado: { C: "#a855f7", H: "#d8b4fe" }, naranja: { C: "#f97316", H: "#fdba74" },
  cian: { C: "#06b6d4", H: "#a5f3fc" }, rosa: { C: "#ec4899", H: "#f9a8d4" },
};
const PAL_COCHE_BASE = { L: "#bae6fd", K: "#1f2937", N: "#0f172a" };

// Soldado que avanza hacia la torre (12 x 16): casco gris, túnica roja, escudo.
const SOLDADO = `
....NNNN....
...NGGGGN...
...NGGGGN...
...NSSSSN...
...NNSSNN...
..NRRRRRRN..
.NRNRRRRNRN.
.NRNRRRRNEN.
.NRNRRRRNEN.
..NRRRRRRN..
..NRRRRRRN..
..NNRRRRNN..
...NKKKKN...
...NKNNKN...
...NKN.NKN..
...NNN.NNN..`;
const PAL_SOLDADO = { N: "#1f2937", G: "#9ca3af", S: "#f5c6a0", R: "#dc2626", E: "#f59e0b", K: "#6b4423" };

// Arquero en la torre (12 x 16): capucha verde, arco.
const ARQUERO = `
....NNNN....
...NVVVVN...
..NVVVVVVN..
..NVSSSSVN..
..NNSSSSNN..
...NVVVVN.A.
..NVVVVVVNA.
.NVNVVVVNAA.
.NVNVVVVNA..
..NVVVVVVNA.
..NVVVVVVN..
..NNVVVVNN..
...NKKKKN...
...NKNNKN...
...NKN.NKN..
...NNN.NNN..`;
const PAL_ARQUERO = { N: "#14532d", V: "#22c55e", S: "#f5c6a0", A: "#a16207", K: "#4a2f1a" };

// Escalador (12 x 16): gorro naranja, mochila azul.
const ESCALADOR = `
....NNNN....
...NOOOON...
..NOOOOOON..
..NOSSSSON..
..NNSSSSNN..
...NAAAAN...
.BBNAAAANN..
.BBNAAAANSN.
.BBNAAAANSN.
...NAAAAN...
..NNAAAANN..
..NKKKKKKN..
..NKKNNKKN..
..NKKN.NKKN.
..NKKN.NKKN.
..NNNN.NNNN.`;
const PAL_ESCALADOR = { N: "#1f2937", O: "#f97316", S: "#f5c6a0", A: "#3b82f6", B: "#1d4ed8", K: "#374151" };

// Íconos chicos.
const ICONOS = {
  corazon: { pal: { R: "#ef4444", N: "#7f1d1d", W: "#fecaca" }, mapa: `
.RR.RR.
RWRRRRR
RRRRRRR
.RRRRR.
..RRR..
...R...` },
  corazon_vacio: { pal: { N: "#64748b" }, mapa: `
.NN.NN.
N..N..N
N.....N
.N...N.
..N.N..
...N...` },
  moneda: { pal: { Y: "#facc15", O: "#ca8a04", W: "#fef9c3" }, mapa: `
..YYYY..
.YWWYYY.
YWYYYYOY
YYYOOYOY
YYYOOYOY
YYYYYYOY
.YYYOOY.
..YYYY..` },
  estrella: { pal: { Y: "#facc15", O: "#ca8a04" }, mapa: `
....Y....
...YYY...
YYYYYYYYY
.YYYYYYY.
..YYYYY..
.YYY.YYY.
YY.....YY` },
  calavera: { pal: { W: "#e5e7eb", N: "#111827" }, mapa: `
..WWWW..
.WWWWWW.
WWNWWNWW
WWNWWNWW
WWWWWWWW
.WWNNWW.
..WWWW..
..W.W.W.` },
  bandera: { pal: { R: "#ef4444", N: "#1f2937", W: "#fff" }, mapa: `
N.........
NRRRRRRRR.
NRRWWRRRR.
NRRRRRRRR.
NRRRRRR...
NRRRR.....
N.........
N.........
N.........
N.........
N.........
N.........` },
  trofeo: { pal: { Y: "#facc15", O: "#ca8a04", N: "#78350f" }, mapa: `
YYYYYYYYYY
.YYYYYYYY.
Y.YYYYYY.Y
Y.YYYYYY.Y
.Y.YYYY.Y.
...YYYY...
....YY....
....YY....
...OOOO...
..NNNNNN..
..NNNNNN..
.NNNNNNNN.` },
  flecha: { pal: { A: "#a16207", N: "#374151", W: "#e5e7eb" }, mapa: `
NAAAAAAAAW.
NAAAAAAAAWW
NAAAAAAAAW.` },
  rayo: { pal: { Y: "#FFD400" }, mapa: `
...YYY
..YYY.
.YYY..
YYYYYY
...YY.
..YY..
.YY...
YY....` },
  telefono: { pal: { N: "#1f2937", P: "#e5e7eb", V: "#22c55e", W: "#fff", B: "#2563eb" }, mapa: `
..NNNNNNNN..
.NPPPPPPPPN.
.NPNNNNNNPN.
.NPNWWWWNPN.
.NPNWBBWNPN.
.NPNWWWWNPN.
.NPNWVVWNPN.
.NPNWVVWNPN.
.NPNWWWWNPN.
.NPNNNNNNPN.
.NPPPPPPPPN.
.NPPPNNPPPN.
..NNNNNNNN..` },
  formulario: { pal: { N: "#1f2937", W: "#fff", B: "#2563eb", G: "#9ca3af", Y: "#FFD400" }, mapa: `
.NNNNNNNNNNNN.
NWWWWWWWWWWWWN
NWBBBBWWWWWWWN
NWWWWWWWWWWWWN
NWGGGGGGGGGGWN
NWWWWWWWWWWWWN
NWGGGGGGGGGGWN
NWWWWWWWWWWWWN
NWGGGGGGGGGGWN
NWWWWWWWWWWWWN
NWWWWWYYYYYYWN
NWWWWWYYYYYYWN
.NNNNNNNNNNNN.` },
  camara: { pal: { N: "#1f2937", C: "#374151", L: "#60a5fa", W: "#fff", R: "#ef4444" }, mapa: `
....NNNN......
...NCCCCN.....
NNNNCCCCNNNNNN
NCCCCCCCCCCCCN
NCCCNNNNNCCCRN
NCCNLLLLLNCCCN
NCCNLWLLLNCCCN
NCCNLLLLLNCCCN
NCCCNNNNNCCCCN
NCCCCCCCCCCCCN
NNNNNNNNNNNNNN` },
  pantalla: { pal: { N: "#1f2937", W: "#fff", P: "#6d28d9", Y: "#FFD400", G: "#22c55e", B: "#93c5fd" }, mapa: `
NNNNNNNNNNNNNNNN
NWWWWWWWWWWWWWWN
NWPPPPPWWWWWWWWN
NWWWWWWWWWWWWWWN
NWBBBBBWBBBBBBWN
NWBBBBBWBBBBBBWN
NWWWWWWWWWWWWWWN
NWYYYYWWGGGGWWWN
NWWWWWWWWWWWWWWN
NNNNNNNNNNNNNNNN
.......NN.......
.....NNNNNN.....` },
  libro: { pal: { N: "#1f2937", R: "#dc2626", W: "#fff", G: "#9ca3af" }, mapa: `
.NNNNNNNNNNN.
NRRRRRNWWWWWN
NRRRRRNWGGGWN
NRRRRRNWWWWWN
NRRRRRNWGGGWN
NRRRRRNWWWWWN
NRRRRRNWGGGWN
NRRRRRNWWWWWN
NRRRRRNWWWWWN
.NNNNNNNNNNN.` },
  check: { pal: { G: "#16a34a", W: "#fff" }, mapa: `
.GGGGGGGG.
GGGGGGGGGG
GGGGGGGWGG
GGGGGGWWGG
GGWGGWWGGG
GGWWWWGGGG
GGGWWGGGGG
GGGGGGGGGG
.GGGGGGGG.` },
};

// ---------- Fábrica de sprites ----------
export const sparky = (frame = "quieto", escala = 4, extra = "") => sprite(SPARKY[frame] ?? SPARKY.quieto, PAL_SPARKY, { escala, clase: "px sparky", atributos: extra });
export const coche = (color = "rojo", escala = 3, flip = false) => {
  const pal = { ...PAL_COCHE_BASE, ...(COLORES_COCHE[color] ?? COLORES_COCHE.rojo) };
  const { ancho, alto } = medidas(COCHE);
  return `<svg class="px coche" viewBox="0 0 ${ancho} ${alto}" width="${ancho * escala}" height="${alto * escala}" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg">${capa(COCHE, pal, 0, 0, flip)}</svg>`;
};
export const soldado = (escala = 4) => sprite(SOLDADO, PAL_SOLDADO, { escala, clase: "px soldado" });
export const arquero = (escala = 4) => sprite(ARQUERO, PAL_ARQUERO, { escala, clase: "px arquero" });
export const escalador = (escala = 4) => sprite(ESCALADOR, PAL_ESCALADOR, { escala, clase: "px escalador" });
export const icono = (nombre, escala = 4) => { const i = ICONOS[nombre]; return i ? sprite(i.mapa, i.pal, { escala, clase: "px icono" }) : ""; };
export const COLORES_DE_COCHE = Object.keys(COLORES_COCHE);

// Capas para escenas grandes (rects en coordenadas de la escena).
export const capaSparky = (frame, dx, dy) => capa(SPARKY[frame] ?? SPARKY.quieto, PAL_SPARKY, dx, dy);
export const capaSoldado = (dx, dy) => capa(SOLDADO, PAL_SOLDADO, dx, dy);
export const capaArquero = (dx, dy) => capa(ARQUERO, PAL_ARQUERO, dx, dy);
export const capaEscalador = (dx, dy) => capa(ESCALADOR, PAL_ESCALADOR, dx, dy);
export const capaCoche = (color, dx, dy) => capa(COCHE, { ...PAL_COCHE_BASE, ...(COLORES_COCHE[color] ?? COLORES_COCHE.rojo) }, dx, dy);
export const capaIcono = (nombre, dx, dy) => { const i = ICONOS[nombre]; return i ? capa(i.mapa, i.pal, dx, dy) : ""; };

// ---------- Escenas (fondos en pixel art, dibujados con rectángulos) ----------
// Todas se dibujan en una cuadrícula de "unidades" para que el estilo sea consistente; el SVG escala al tamaño del área.
function azar(semilla) { let s = semilla >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }

// Ciudad de noche con neón, vista lateral: la pista de la carrera. Devuelve el fondo (sin coches).
export function escenaCiudad(w = 172, h = 140, semilla = 7, tema = {}) {
  const T = { cielo: "#120a2e", estrellas: true, edif1: "#2a1659", edif2: "#3b1f7a", neon: "#d946ef", luz: "#f0abfc", luz2: "#67e8f9", carretera: "#1e1b4b", linea: "#f9a8d4", borde: "#ec4899", luna: "#fde68a", carriles: 4, ...tema };
  const r = azar(semilla);
  let s = `<rect width="${w}" height="${h}" fill="${T.cielo}"/>`;
  if (T.estrellas) for (let i = 0; i < 60; i++) s += `<rect x="${Math.floor(r() * w)}" y="${Math.floor(r() * (h * 0.45))}" width="1" height="1" fill="${r() > .7 ? T.luz : "#e9d5ff"}" opacity="${(.4 + r() * .6).toFixed(2)}"/>`;
  // luna o sol pixel
  s += `<rect x="${w - 30}" y="10" width="8" height="8" fill="${T.luna}"/><rect x="${w - 32}" y="12" width="2" height="4" fill="${T.luna}"/><rect x="${w - 22}" y="12" width="2" height="4" fill="${T.luna}"/><rect x="${w - 28}" y="8" width="4" height="2" fill="${T.luna}"/><rect x="${w - 28}" y="18" width="4" height="2" fill="${T.luna}"/>`;
  // edificios (dos planos)
  const suelo = Math.floor(h * 0.62);
  let x = 0;
  while (x < w) { const bw = 6 + Math.floor(r() * 12), bh = 18 + Math.floor(r() * 36); s += `<rect x="${x}" y="${suelo - bh}" width="${bw}" height="${bh}" fill="${T.edif1}"/>`;
    for (let yy = suelo - bh + 2; yy < suelo - 2; yy += 3) for (let xx = x + 1; xx < x + bw - 1; xx += 3) if (r() > .45) s += `<rect x="${xx}" y="${yy}" width="1" height="1" fill="${r() > .5 ? T.luz : T.luz2}"/>`;
    x += bw + 1 + Math.floor(r() * 3); }
  x = 0;
  while (x < w) { const bw = 10 + Math.floor(r() * 16), bh = 8 + Math.floor(r() * 20); s += `<rect x="${x}" y="${suelo - bh}" width="${bw}" height="${bh}" fill="${T.edif2}"/><rect x="${x}" y="${suelo - bh}" width="${bw}" height="1" fill="${T.neon}"/>`;
    for (let yy = suelo - bh + 2; yy < suelo - 1; yy += 3) for (let xx = x + 1; xx < x + bw - 1; xx += 2) if (r() > .5) s += `<rect x="${xx}" y="${yy}" width="1" height="1" fill="${T.luz}"/>`;
    x += bw + 2 + Math.floor(r() * 4); }
  // suelo y carretera
  s += `<rect x="0" y="${suelo}" width="${w}" height="2" fill="${T.neon}"/><rect x="0" y="${suelo + 2}" width="${w}" height="${h - suelo - 2}" fill="${T.carretera}"/>`;
  const carriles = T.carriles, alturaCarril = Math.floor((h - suelo - 6) / carriles);
  for (let c = 1; c < carriles; c++) { const y = suelo + 4 + c * alturaCarril; for (let xx = 0; xx < w; xx += 8) s += `<rect x="${xx}" y="${y}" width="4" height="1" fill="${T.linea}"/>`; }
  s += `<rect x="0" y="${h - 3}" width="${w}" height="3" fill="${T.borde}"/>`;
  return { svg: s, suelo, carriles, alturaCarril };
}

// Montaña con escalones para subir contestando.
export function escenaMontana(w = 172, h = 140, pasos = 8, semilla = 3, tema = {}) {
  const T = { cielo: "#0c4a6e", fondo1: "#164e63", fondo2: "#1e5f7a", roca: "#7c5a3c", nieve: "#f8fafc", pasto: "#a3e635", base: "#4a7c59", sol: "#fef3c7", ...tema };
  const r = azar(semilla);
  let s = `<rect width="${w}" height="${h}" fill="${T.cielo}"/>`;
  for (let i = 0; i < 40; i++) s += `<rect x="${Math.floor(r() * w)}" y="${Math.floor(r() * (h * .5))}" width="1" height="1" fill="#e0f2fe" opacity="${(.3 + r() * .7).toFixed(2)}"/>`;
  s += `<rect x="${w - 26}" y="8" width="10" height="10" fill="${T.sol}"/>`;
  // montañas de fondo
  s += `<polygon points="0,${h} 30,${h * .55} 60,${h * .75} 90,${h * .4} 120,${h * .7} 150,${h * .5} ${w},${h * .8} ${w},${h}" fill="${T.fondo1}"/>`;
  s += `<polygon points="0,${h} 40,${h * .7} 80,${h * .85} 110,${h * .6} 140,${h * .85} ${w},${h * .65} ${w},${h}" fill="${T.fondo2}"/>`;
  // escalones (de abajo-izquierda a arriba-derecha) con nieve arriba
  const puntos = [];
  const x0 = 12, y0 = h - 14, x1 = w - 40, y1 = 26;
  for (let k = 0; k <= pasos; k++) {
    const x = Math.round(x0 + (x1 - x0) * (k / pasos)), y = Math.round(y0 - (y0 - y1) * (k / pasos));
    puntos.push({ x, y });
    s += `<rect x="${x - 6}" y="${y}" width="${Math.round((x1 - x0) / pasos) + 8}" height="${h - y}" fill="${T.roca}"/><rect x="${x - 6}" y="${y}" width="${Math.round((x1 - x0) / pasos) + 8}" height="2" fill="${k >= pasos - 2 ? T.nieve : T.pasto}"/>`;
  }
  s += `<rect x="0" y="${h - 4}" width="${w}" height="4" fill="${T.base}"/>`;
  return { svg: s, puntos };
}

// Castillo: torre a la izquierda y camino por donde llegan los soldados.
export function escenaCastillo(w = 172, h = 140, semilla = 5, tema = {}) {
  const T = { cielo: "#1e1b4b", luna: "#fde68a", colinas: "#312e81", suelo: "#3f6212", pasto: "#a3e635", piedra: "#6b7280", piedra2: "#9ca3af", puerta: "#92400e", ...tema };
  const r = azar(semilla);
  let s = `<rect width="${w}" height="${h}" fill="${T.cielo}"/>`;
  for (let i = 0; i < 40; i++) s += `<rect x="${Math.floor(r() * w)}" y="${Math.floor(r() * (h * .5))}" width="1" height="1" fill="#fef3c7" opacity="${(.3 + r() * .7).toFixed(2)}"/>`;
  s += `<rect x="${w - 34}" y="12" width="10" height="10" fill="${T.luna}"/><rect x="${w - 32}" y="10" width="6" height="14" fill="${T.luna}"/>`;
  const suelo = h - 24;
  s += `<polygon points="0,${suelo} 40,${suelo - 30} 90,${suelo - 12} 140,${suelo - 36} ${w},${suelo - 10} ${w},${suelo}" fill="${T.colinas}"/>`;
  s += `<rect x="0" y="${suelo}" width="${w}" height="${h - suelo}" fill="${T.suelo}"/><rect x="0" y="${suelo}" width="${w}" height="2" fill="${T.pasto}"/>`;
  // torre de piedra
  const tx = 10, tw = 34, ty = 30;
  s += `<rect x="${tx}" y="${ty}" width="${tw}" height="${suelo - ty}" fill="${T.piedra}"/>`;
  for (let yy = ty + 4; yy < suelo; yy += 6) for (let xx = tx + ((yy / 6) % 2 ? 0 : 4); xx < tx + tw - 2; xx += 8) s += `<rect x="${xx}" y="${yy}" width="6" height="3" fill="${T.piedra2}"/>`;
  for (let xx = tx - 2; xx < tx + tw + 2; xx += 8) s += `<rect x="${xx}" y="${ty - 6}" width="5" height="6" fill="${T.piedra}"/>`;
  s += `<rect x="${tx + 12}" y="${suelo - 16}" width="10" height="16" fill="${T.puerta}"/><rect x="${tx + 14}" y="${suelo - 18}" width="6" height="2" fill="${T.puerta}"/>`;
  s += `<rect x="${tx + tw - 6}" y="${ty - 14}" width="1" height="10" fill="#e5e7eb"/><rect x="${tx + tw - 5}" y="${ty - 14}" width="6" height="4" fill="#ef4444"/>`;
  return { svg: s, suelo, torreX: tx + tw, torreTop: ty };
}

// Planeta con el astronauta: fondo de Mix and match y de la pantalla de carga.
export function escenaPlaneta(w = 172, h = 140, semilla = 11, tema = {}) {
  const T = { cielo: "#0b1026", suelo: "#7c3aed", borde: "#c4b5fd", roca: "#5b21b6", ...tema };
  const r = azar(semilla);
  let s = `<rect width="${w}" height="${h}" fill="${T.cielo}"/>`;
  for (let i = 0; i < 70; i++) s += `<rect x="${Math.floor(r() * w)}" y="${Math.floor(r() * h * .7)}" width="1" height="1" fill="#dbeafe" opacity="${(.3 + r() * .7).toFixed(2)}"/>`;
  s += `<rect x="${w - 40}" y="14" width="12" height="12" fill="#60a5fa"/><rect x="${w - 42}" y="16" width="16" height="8" fill="#60a5fa"/><rect x="${w - 36}" y="18" width="4" height="2" fill="#1d4ed8"/><rect x="${w - 32}" y="22" width="3" height="2" fill="#1d4ed8"/>`;
  s += `<rect x="${w - 58}" y="30" width="18" height="2" fill="#a78bfa" opacity=".8"/>`;
  s += `<rect x="20" y="30" width="6" height="6" fill="#f472b6"/>`;
  const suelo = h - 36;
  s += `<rect x="0" y="${suelo}" width="${w}" height="${h - suelo}" fill="${T.suelo}"/><rect x="0" y="${suelo}" width="${w}" height="3" fill="${T.borde}"/>`;
  for (let i = 0; i < 12; i++) { const cx = Math.floor(r() * w), cy = suelo + 6 + Math.floor(r() * (h - suelo - 10)); s += `<rect x="${cx}" y="${cy}" width="${3 + Math.floor(r() * 5)}" height="2" fill="${T.roca}"/>`; }
  return { svg: s, suelo };
}

// Marco SVG listo para insertar: toma el fondo y agrega capas (sprites) encima.
export function escenaSvg(fondo, w, h, capas = "", extra = "") {
  return `<svg class="px escena" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg" ${extra}>${fondo}${capas}</svg>`;
}
