// Arte de SparkEd, versión "retro 2.5D" (6 nov 2026, referencias de Daniel): dibujos vectoriales con contorno grueso,
// volúmenes con dos tonos (cara clara y cara en sombra), brillos suaves y sombra en el piso. Nada de pixeles.
// Todo se dibuja en "unidades" (los mismos tamaños de caja que tenían los sprites) para que las escenas y las páginas
// sigan funcionando igual: sparky 16×20, coche 24×10, soldado y arquero 12×16, íconos 16×16, escenas 172×140.

export const C = {
  linea: "#2A2340", blanco: "#FFFFFF", gris: "#E9EDF5", grisOscuro: "#C9D0E0", grisMedio: "#9AA3B8",
  amarillo: "#FFD400", amarilloOscuro: "#E0A800", azul: "#2F6DF6", azulOscuro: "#1E4FC2", visor: "#1F3A8A", visorLuz: "#5B8CFF",
  rojo: "#E53935", rojoOscuro: "#B71C1C", verde: "#2BB673", verdeOscuro: "#1E8A55", morado: "#7C4DFF", moradoOscuro: "#5A2ED6",
  naranja: "#FF8A3D", naranjaOscuro: "#E0661F", teal: "#27C4B4", tealOscuro: "#1A9A8D", piel: "#F3C7A5", cafe: "#8B5A2B", cafeOscuro: "#5C3A1A",
  sombra: "rgba(42, 35, 64, .22)", cielo: "#7DD3FC",
};
const o = (sw = 0.7) => `stroke="${C.linea}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"`;
const envoltura = (w, h, escala, clase, inner, extra = "") => `<svg class="vec ${clase}" viewBox="0 0 ${w} ${h}" width="${w * escala}" height="${h * escala}" xmlns="http://www.w3.org/2000/svg" ${extra}>${inner}</svg>`;
const grupo = (dx, dy, inner, extra = "") => `<g transform="translate(${dx} ${dy})" ${extra}>${inner}</g>`;

// ---------- Sparky, el astronauta (16 × 20) ----------
function cuerpoSparky(pose) {
  const brazoIzq = pose === "festejo"
    ? `<rect x="1.6" y="6.4" width="2.2" height="5" rx="1.1" fill="${C.blanco}" ${o(.5)} transform="rotate(30 2.7 9)"/><circle cx="1.4" cy="5.6" r="1.1" fill="${C.blanco}" ${o(.45)}/>`
    : `<rect x="1.8" y="10.4" width="2.2" height="4.6" rx="1.1" fill="${C.blanco}" ${o(.5)}/><circle cx="2.9" cy="15.3" r="1.05" fill="${C.blanco}" ${o(.45)}/>`;
  const brazoDer = pose === "saludo" || pose === "festejo"
    ? `<rect x="12.2" y="6.4" width="2.2" height="5" rx="1.1" fill="${C.blanco}" ${o(.5)} transform="rotate(-30 13.3 9)"/><circle cx="14.6" cy="5.6" r="1.1" fill="${C.blanco}" ${o(.45)}/>`
    : pose === "pensando"
      ? `<rect x="11.4" y="7.6" width="2.2" height="4.6" rx="1.1" fill="${C.blanco}" ${o(.5)} transform="rotate(-62 12.5 9.9)"/><circle cx="11.9" cy="7.2" r="1.05" fill="${C.blanco}" ${o(.45)}/>`
      : `<rect x="12" y="10.4" width="2.2" height="4.6" rx="1.1" fill="${C.blanco}" ${o(.5)}/><circle cx="13.1" cy="15.3" r="1.05" fill="${C.blanco}" ${o(.45)}/>`;
  const extras = pose === "festejo"
    ? `<polygon points="1.6,2.2 2.1,3.4 3.3,3.6 2.4,4.4 2.6,5.6 1.6,5 .6,5.6 .8,4.4 -.1,3.6 1.1,3.4" fill="${C.amarillo}" ${o(.3)}/><polygon points="14.6,1.2 15,2.1 16,2.3 15.3,2.9 15.4,3.9 14.6,3.4 13.8,3.9 13.9,2.9 13.2,2.3 14.2,2.1" fill="${C.amarillo}" ${o(.3)}/>`
    : pose === "triste"
      ? `<path d="M12.6 4.4 q.9 1.3 0 2 q-.9 -.7 0 -2 z" fill="${C.teal}" ${o(.3)}/>`
      : pose === "pensando"
        ? `<circle cx="14" cy="2.6" r="1.7" fill="${C.blanco}" ${o(.4)}/><circle cx="12.2" cy="4.6" r=".5" fill="${C.blanco}" ${o(.3)}/><text x="14" y="3.4" font-size="2.3" font-weight="800" text-anchor="middle" fill="${C.linea}" font-family="Outfit, Arial, sans-serif">?</text>`
        : "";
  const inclinacion = pose === "triste" ? `transform="rotate(8 8 7)"` : "";
  return `
    <ellipse cx="8" cy="19.2" rx="5" ry=".8" fill="${C.sombra}"/>
    <rect x="3" y="9.2" width="10" height="6.8" rx="2.6" fill="${C.linea}"/>
    <rect x="3.4" y="9.6" width="9.2" height="6" rx="2.4" fill="${C.blanco}"/>
    <rect x="3.4" y="12.9" width="9.2" height="2.7" rx="1.6" fill="${C.gris}"/>
    ${brazoIzq}${brazoDer}
    <rect x="4.6" y="15.2" width="2.6" height="3.2" rx="1.2" fill="${C.blanco}" ${o(.5)}/>
    <rect x="8.8" y="15.2" width="2.6" height="3.2" rx="1.2" fill="${C.blanco}" ${o(.5)}/>
    <rect x="4.2" y="17.6" width="3.4" height="1.5" rx=".75" fill="${C.amarillo}" ${o(.4)}/>
    <rect x="8.4" y="17.6" width="3.4" height="1.5" rx=".75" fill="${C.amarillo}" ${o(.4)}/>
    <rect x="6.6" y="10.4" width="2.8" height="1.8" rx=".6" fill="${C.amarillo}" ${o(.4)}/>
    <g ${inclinacion}>
      <line x1="8" y1="1.4" x2="8" y2="3" ${o(.5)}/>
      <circle cx="8" cy="1.2" r=".75" fill="${C.amarillo}" ${o(.4)}/>
      <circle cx="8" cy="6.6" r="4.2" fill="${C.blanco}" ${o(.6)}/>
      <ellipse cx="8.2" cy="6.8" rx="3" ry="2.6" fill="${pose === "triste" ? "#172C6B" : C.visor}" ${o(.4)}/>
      <ellipse cx="7.1" cy="5.8" rx=".95" ry=".6" fill="${C.blanco}" opacity=".85" transform="rotate(-20 7.1 5.8)"/>
      <circle cx="9.4" cy="7.8" r=".32" fill="${C.visorLuz}"/>
      <rect x="6" y="9.1" width="4" height="1" rx=".5" fill="${C.amarillo}" ${o(.4)}/>
    </g>
    ${extras}`;
}
const POSES = ["quieto", "saludo", "festejo", "triste", "pensando"];
export const sparky = (frame = "quieto", escala = 4, extra = "") => envoltura(16, 20, escala, "sparky", cuerpoSparky(POSES.includes(frame) ? frame : "quieto"), extra);
export const capaSparky = (frame, dx, dy) => grupo(dx, dy, cuerpoSparky(POSES.includes(frame) ? frame : "quieto"));

// ---------- Coches (24 × 10): perfil con techo en sombra y cara superior clara ----------
const COLORES_COCHE = { rojo: [C.rojo, C.rojoOscuro], azul: [C.azul, C.azulOscuro], amarillo: [C.amarillo, C.amarilloOscuro], verde: [C.verde, C.verdeOscuro], morado: [C.morado, C.moradoOscuro] };
export const COLORES_DE_COCHE = Object.keys(COLORES_COCHE);
function cuerpoCoche(color) {
  const [c1, c2] = COLORES_COCHE[color] ?? COLORES_COCHE.rojo;
  return `
    <ellipse cx="12" cy="9.4" rx="10.5" ry=".7" fill="${C.sombra}"/>
    <path d="M6.2 5.6 L8 2.5 Q8.5 1.8 9.3 1.8 L15.4 1.8 Q16.2 1.8 16.7 2.5 L18.8 5.6 Z" fill="${c2}" ${o(.5)}/>
    <path d="M8.7 5.1 L9.9 2.8 L12 2.8 L12 5.1 Z" fill="#BFE3FF" ${o(.35)}/>
    <path d="M12.8 2.8 L15 2.8 L16.5 5.1 L12.8 5.1 Z" fill="#BFE3FF" ${o(.35)}/>
    <rect x=".8" y="5.2" width="22.4" height="3.5" rx="1.6" fill="${c1}" ${o(.5)}/>
    <rect x="1.7" y="5.7" width="20.6" height=".9" rx=".45" fill="${C.blanco}" opacity=".4"/>
    <rect x="1.4" y="7.6" width="21.2" height=".8" rx=".4" fill="${c2}" opacity=".55"/>
    <rect x="21.9" y="6.1" width="1.4" height="1.4" rx=".4" fill="${C.amarillo}" ${o(.3)}/>
    <rect x=".7" y="6.1" width="1.1" height="1.4" rx=".4" fill="${C.rojoOscuro}" ${o(.3)}/>
    <circle cx="6" cy="8.5" r="1.9" fill="${C.linea}"/><circle cx="6" cy="8.5" r="1.05" fill="${C.gris}"/><circle cx="6" cy="8.5" r=".4" fill="${C.linea}"/>
    <circle cx="18" cy="8.5" r="1.9" fill="${C.linea}"/><circle cx="18" cy="8.5" r="1.05" fill="${C.gris}"/><circle cx="18" cy="8.5" r=".4" fill="${C.linea}"/>`;
}
export const coche = (color = "rojo", escala = 3, flip = false) => envoltura(24, 10, escala, "coche", flip ? `<g transform="translate(24 0) scale(-1 1)">${cuerpoCoche(color)}</g>` : cuerpoCoche(color));
export const capaCoche = (color, dx, dy) => grupo(dx, dy, cuerpoCoche(color));

// ---------- Soldado y arquero (12 × 16) y escalador (Sparky compacto, 12 × 16) ----------
function cuerpoSoldado() {
  return `
    <ellipse cx="6" cy="15.4" rx="4" ry=".7" fill="${C.sombra}"/>
    <rect x="3.6" y="11.6" width="2.2" height="3.4" rx="1" fill="${C.grisOscuro}" ${o(.45)}/><rect x="6.4" y="11.6" width="2.2" height="3.4" rx="1" fill="${C.grisOscuro}" ${o(.45)}/>
    <line x1="9.6" y1="6.4" x2="11.6" y2="1.8" stroke="${C.gris}" stroke-width=".9" stroke-linecap="round"/><line x1="9.6" y1="6.4" x2="11.6" y2="1.8" ${o(.35)} opacity=".5"/>
    <rect x="8.6" y="6" width="2" height=".9" rx=".4" fill="${C.amarilloOscuro}" ${o(.3)}/>
    <rect x="3.2" y="6.8" width="5.6" height="5.4" rx="1.4" fill="${C.gris}" ${o(.5)}/>
    <rect x="3.2" y="9.6" width="5.6" height="2.6" rx="1.2" fill="${C.grisOscuro}"/>
    <circle cx="2.6" cy="9.4" r="2.1" fill="${C.rojo}" ${o(.45)}/><rect x="2.3" y="8" width=".6" height="2.8" fill="${C.blanco}"/><rect x="1.2" y="9.1" width="2.8" height=".6" fill="${C.blanco}"/>
    <circle cx="6" cy="4.4" r="2.7" fill="${C.grisOscuro}" ${o(.5)}/>
    <rect x="4.1" y="4.1" width="3.8" height="1" rx=".4" fill="${C.linea}"/>
    <path d="M6 1.3 q1.6 -1.1 2.6 .4 q-1.2 .2 -2.6 -.4 z" fill="${C.rojo}" ${o(.3)}/>`;
}
function cuerpoArquero() {
  return `
    <ellipse cx="6" cy="15.4" rx="4" ry=".7" fill="${C.sombra}"/>
    <path d="M2.4 2.6 Q-1 8 2.4 13.4" fill="none" stroke="${C.cafe}" stroke-width=".9" stroke-linecap="round"/><path d="M2.4 2.6 Q-1 8 2.4 13.4" fill="none" ${o(.35)} opacity=".5"/>
    <line x1="2.4" y1="2.6" x2="2.4" y2="13.4" stroke="${C.gris}" stroke-width=".35"/>
    <rect x="3.6" y="11.6" width="2.2" height="3.4" rx="1" fill="${C.cafeOscuro}" ${o(.45)}/><rect x="6.4" y="11.6" width="2.2" height="3.4" rx="1" fill="${C.cafeOscuro}" ${o(.45)}/>
    <rect x="3.2" y="6.8" width="5.6" height="5.4" rx="1.4" fill="${C.verde}" ${o(.5)}/>
    <rect x="3.2" y="9.6" width="5.6" height="2.6" rx="1.2" fill="${C.verdeOscuro}"/>
    <rect x="3.2" y="9.2" width="5.6" height=".9" fill="${C.cafe}" ${o(.3)}/>
    <circle cx="6" cy="4.4" r="2.7" fill="${C.verdeOscuro}" ${o(.5)}/>
    <ellipse cx="6.2" cy="4.9" rx="1.7" ry="1.5" fill="${C.piel}"/>
    <circle cx="5.7" cy="4.8" r=".3" fill="${C.linea}"/><circle cx="6.9" cy="4.8" r=".3" fill="${C.linea}"/>
    <line x1="2.6" y1="8" x2="7.8" y2="8" stroke="${C.cafeOscuro}" stroke-width=".5"/>`;
}
function cuerpoEscalador() {
  return `
    <ellipse cx="6" cy="15.4" rx="4" ry=".7" fill="${C.sombra}"/>
    <rect x="2.2" y="7.4" width="7.6" height="5.4" rx="2" fill="${C.linea}"/>
    <rect x="2.6" y="7.8" width="6.8" height="4.6" rx="1.8" fill="${C.blanco}"/>
    <rect x="2.6" y="10.2" width="6.8" height="2.2" rx="1.1" fill="${C.gris}"/>
    <rect x="1" y="8.2" width="1.8" height="3.4" rx=".9" fill="${C.blanco}" ${o(.45)}/><rect x="9.2" y="8.2" width="1.8" height="3.4" rx=".9" fill="${C.blanco}" ${o(.45)}/>
    <rect x="3.4" y="11.8" width="2.2" height="2.6" rx="1" fill="${C.blanco}" ${o(.45)}/><rect x="6.4" y="11.8" width="2.2" height="2.6" rx="1" fill="${C.blanco}" ${o(.45)}/>
    <rect x="3.1" y="13.6" width="2.8" height="1.2" rx=".6" fill="${C.amarillo}" ${o(.35)}/><rect x="6.1" y="13.6" width="2.8" height="1.2" rx=".6" fill="${C.amarillo}" ${o(.35)}/>
    <rect x="4.9" y="8.4" width="2.2" height="1.4" rx=".5" fill="${C.amarillo}" ${o(.35)}/>
    <line x1="6" y1="1" x2="6" y2="2.2" ${o(.45)}/><circle cx="6" cy=".9" r=".6" fill="${C.amarillo}" ${o(.35)}/>
    <circle cx="6" cy="5" r="3.2" fill="${C.blanco}" ${o(.55)}/>
    <ellipse cx="6.2" cy="5.2" rx="2.3" ry="2" fill="${C.visor}" ${o(.35)}/>
    <ellipse cx="5.3" cy="4.4" rx=".7" ry=".45" fill="${C.blanco}" opacity=".85" transform="rotate(-20 5.3 4.4)"/>`;
}
export const soldado = (escala = 4) => envoltura(12, 16, escala, "soldado", cuerpoSoldado());
export const arquero = (escala = 4) => envoltura(12, 16, escala, "arquero", cuerpoArquero());
export const escalador = (escala = 4) => envoltura(12, 16, escala, "escalador", cuerpoEscalador());
export const capaSoldado = (dx, dy) => grupo(dx, dy, cuerpoSoldado());
export const capaArquero = (dx, dy) => grupo(dx, dy, cuerpoArquero());
export const capaEscalador = (dx, dy) => grupo(dx, dy, cuerpoEscalador());

// ---------- Íconos (16 × 16): simples, con contorno, para la landing y los juegos ----------
const estrella = (cx, cy, R, r, fill, sw = .5) => { let p = ""; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r : R; p += `${(cx + rr * Math.cos(a)).toFixed(2)},${(cy + rr * Math.sin(a)).toFixed(2)} `; } return `<polygon points="${p.trim()}" fill="${fill}" ${o(sw)}/>`; };
const ICONOS = {
  corazon: () => `<path d="M8 14.2 L2.6 8.8 A3.3 3.3 0 0 1 7.3 4.2 L8 4.9 L8.7 4.2 A3.3 3.3 0 0 1 13.4 8.8 Z" fill="${C.rojo}" ${o(.6)}/><ellipse cx="5.6" cy="6.6" rx="1" ry=".6" fill="${C.blanco}" opacity=".7" transform="rotate(-30 5.6 6.6)"/>`,
  corazon_vacio: () => `<path d="M8 14.2 L2.6 8.8 A3.3 3.3 0 0 1 7.3 4.2 L8 4.9 L8.7 4.2 A3.3 3.3 0 0 1 13.4 8.8 Z" fill="none" ${o(.7)} opacity=".55"/>`,
  moneda: () => `<circle cx="8" cy="8.4" r="6.2" fill="${C.amarilloOscuro}" ${o(.6)}/><circle cx="7.4" cy="7.8" r="5.4" fill="${C.amarillo}" ${o(.5)}/>${estrella(7.4, 7.9, 2.6, 1.1, C.amarilloOscuro, .35)}`,
  estrella: () => estrella(8, 8.4, 7, 3, C.amarillo, .6) + `<ellipse cx="6.2" cy="6.4" rx="1.1" ry=".6" fill="${C.blanco}" opacity=".7" transform="rotate(-30 6.2 6.4)"/>`,
  calavera: () => `<path d="M3 7.2 a5 5 0 0 1 10 0 v2.4 a1.6 1.6 0 0 1 -1.6 1.6 h-.4 v2.2 h-6 v-2.2 h-.4 a1.6 1.6 0 0 1 -1.6 -1.6 z" fill="${C.gris}" ${o(.6)}/><circle cx="6" cy="7.6" r="1.4" fill="${C.linea}"/><circle cx="10" cy="7.6" r="1.4" fill="${C.linea}"/><rect x="7.3" y="9.6" width="1.4" height="1.2" fill="${C.linea}"/><rect x="6" y="11.4" width="1" height="1.8" fill="${C.linea}"/><rect x="9" y="11.4" width="1" height="1.8" fill="${C.linea}"/>`,
  bandera: () => `<rect x="3.2" y="1.6" width="1.4" height="13" rx=".7" fill="${C.grisOscuro}" ${o(.45)}/><path d="M4.6 2.4 L13.4 5 L4.6 7.6 Z" fill="${C.rojo}" ${o(.5)}/><ellipse cx="8" cy="14.6" rx="3.4" ry=".6" fill="${C.sombra}"/>`,
  trofeo: () => `<path d="M4.2 2.6 h7.6 v4 a3.8 3.8 0 0 1 -7.6 0 z" fill="${C.amarillo}" ${o(.6)}/><path d="M4.2 3.6 h-1.6 a1.2 1.2 0 0 0 0 2.4 h1.6" fill="none" ${o(.5)}/><path d="M11.8 3.6 h1.6 a1.2 1.2 0 0 1 0 2.4 h-1.6" fill="none" ${o(.5)}/><rect x="7" y="10.4" width="2" height="2" fill="${C.amarilloOscuro}" ${o(.4)}/><rect x="4.6" y="12.3" width="6.8" height="1.8" rx=".7" fill="${C.amarilloOscuro}" ${o(.45)}/><ellipse cx="6.3" cy="4.6" rx="1" ry=".6" fill="${C.blanco}" opacity=".7" transform="rotate(-30 6.3 4.6)"/>`,
  flecha: () => `<line x1="1.5" y1="8" x2="12" y2="8" stroke="${C.cafe}" stroke-width="1.1" stroke-linecap="round"/><path d="M11.2 5.8 L15 8 L11.2 10.2 Z" fill="${C.grisOscuro}" ${o(.45)}/><path d="M1.2 6.4 L3.8 8 L1.2 9.6 Z" fill="${C.rojo}" ${o(.35)}/>`,
  rayo: () => `<polygon points="9.2,1 4,9 7.4,9 6.2,15 12.2,6.8 8.8,6.8 10.4,1" fill="${C.amarillo}" ${o(.6)}/>`,
  telefono: () => `<rect x="4.2" y="1.4" width="7.6" height="13.2" rx="1.8" fill="${C.linea}"/><rect x="5" y="2.8" width="6" height="9.6" rx=".8" fill="${C.azul}"/><rect x="5" y="2.8" width="6" height="3.2" rx=".8" fill="${C.visorLuz}" opacity=".7"/><circle cx="8" cy="13.3" r=".6" fill="${C.gris}"/>`,
  formulario: () => `<rect x="3" y="1.6" width="10" height="12.8" rx="1.4" fill="${C.blanco}" ${o(.6)}/><rect x="5" y="4.2" width="6" height="1.2" rx=".6" fill="${C.azul}"/><rect x="5" y="6.8" width="6" height="1.2" rx=".6" fill="${C.grisOscuro}"/><rect x="5" y="9.4" width="4" height="1.2" rx=".6" fill="${C.grisOscuro}"/><circle cx="11.2" cy="11.6" r="1.6" fill="${C.verde}" ${o(.35)}/><path d="M10.4 11.6 l.6 .6 l1.2 -1.3" fill="none" stroke="${C.blanco}" stroke-width=".5" stroke-linecap="round"/>`,
  camara: () => `<rect x="1.6" y="4.6" width="12.8" height="9" rx="1.8" fill="${C.azul}" ${o(.6)}/><rect x="5.4" y="2.8" width="5.2" height="2.4" rx=".8" fill="${C.azulOscuro}" ${o(.45)}/><circle cx="8" cy="9.1" r="3" fill="${C.linea}"/><circle cx="8" cy="9.1" r="1.9" fill="${C.visorLuz}"/><circle cx="7.2" cy="8.3" r=".55" fill="${C.blanco}" opacity=".9"/><rect x="11.4" y="6" width="1.6" height="1" rx=".4" fill="${C.amarillo}"/>`,
  pantalla: () => `<rect x="1.6" y="2.6" width="12.8" height="8.6" rx="1.4" fill="${C.linea}"/><rect x="2.6" y="3.6" width="10.8" height="6.6" rx=".8" fill="${C.azul}"/><rect x="4" y="5" width="4.6" height="1" rx=".5" fill="${C.blanco}" opacity=".9"/><rect x="4" y="6.8" width="7" height="1" rx=".5" fill="${C.blanco}" opacity=".6"/><rect x="6.6" y="11.4" width="2.8" height="1.6" fill="${C.grisOscuro}" ${o(.35)}/><rect x="4.6" y="13" width="6.8" height="1" rx=".5" fill="${C.grisOscuro}" ${o(.35)}/>`,
  libro: () => `<path d="M2.4 3 h5 a1.2 1.2 0 0 1 1.2 1.2 v9.4 h-5 a1.2 1.2 0 0 1 -1.2 -1.2 z" fill="${C.azul}" ${o(.55)}/><path d="M13.6 3 h-5 a1.2 1.2 0 0 0 -1.2 1.2 v9.4 h5 a1.2 1.2 0 0 0 1.2 -1.2 z" fill="${C.azulOscuro}" ${o(.55)}/><rect x="4" y="5.4" width="3" height=".9" rx=".45" fill="${C.blanco}" opacity=".85"/><rect x="9.4" y="5.4" width="3" height=".9" rx=".45" fill="${C.blanco}" opacity=".6"/>`,
  check: () => `<circle cx="8" cy="8" r="6.4" fill="${C.verde}" ${o(.6)}/><path d="M4.8 8.2 l2.2 2.2 l4.4 -4.8" fill="none" stroke="${C.blanco}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`,
};
export const icono = (nombre, escala = 4) => ICONOS[nombre] ? envoltura(16, 16, escala, "icono icono-" + nombre, ICONOS[nombre]()) : "";
export const capaIcono = (nombre, dx, dy) => ICONOS[nombre] ? grupo(dx, dy, ICONOS[nombre]()) : "";

// ---------- Escenas (172 × 140): fondos de los juegos ----------
function azar(semilla) { let s = semilla >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
const degradado = (id, c1, c2, c3) => `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c1}"/>${c3 ? `<stop offset=".55" stop-color="${c2}"/><stop offset="1" stop-color="${c3}"/>` : `<stop offset="1" stop-color="${c2}"/>`}</linearGradient>`;
const estrellas = (r, w, h, n, color = "#ffffff") => { let s = ""; for (let i = 0; i < n; i++) s += `<circle cx="${(r() * w).toFixed(1)}" cy="${(r() * h).toFixed(1)}" r="${(.3 + r() * .5).toFixed(2)}" fill="${color}" opacity="${(.4 + r() * .6).toFixed(2)}"/>`; return s; };
const solRetro = (cx, cy, R, id) => `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE066"/><stop offset="1" stop-color="#FF6B9D"/></linearGradient><clipPath id="${id}c"><circle cx="${cx}" cy="${cy}" r="${R}"/></clipPath></defs><circle cx="${cx}" cy="${cy}" r="${R}" fill="url(#${id})"/><g clip-path="url(#${id}c)">${[0, 1, 2, 3].map((k) => `<rect x="${cx - R}" y="${cy + R * (.15 + k * .22)}" width="${2 * R}" height="${(.9 + k * .4).toFixed(1)}" fill="#B8336A" opacity=".55"/>`).join("")}</g>`;

// Ciudad de noche (pista de la carrera). Devuelve el fondo y los ids de las capas que se mueven.
export function escenaCiudad(w = 172, h = 140, semilla = 7, tema = {}) {
  const T = { cielo1: "#1B1340", cielo2: "#4C1D95", cielo3: "#B8336A", estrellas: true, edif1: "#2A1659", edif2: "#3B1F7A", ventana: "#F0ABFC", ventana2: "#67E8F9", neon: "#FF6B9D", carretera: "#1E1B4B", linea: "#F9A8D4", borde: "#FF6B9D", carriles: 4, sol: true, ...tema };
  const r = azar(semilla); const id = "c" + semilla;
  const suelo = Math.floor(h * 0.62);
  let s = `<defs>${degradado(id + "k", T.cielo1, T.cielo2, T.cielo3)}</defs><rect width="${w}" height="${h}" fill="url(#${id}k)"/>`;
  if (T.estrellas) s += estrellas(r, w, h * .5, 50, "#E9D5FF");
  if (T.sol) s += solRetro(w - 40, 34, 18, id + "s");
  // edificios lejanos (dos copias para que puedan desplazarse en bucle)
  const capa = (fill, ventana, minW, maxW, minH, maxH, paso, idCapa) => {
    let g = `<g id="${idCapa}">`;
    for (let copia = 0; copia < 2; copia++) {
      let x = copia * w;
      while (x < (copia + 1) * w) {
        const bw = minW + Math.floor(r() * (maxW - minW)), bh = minH + Math.floor(r() * (maxH - minH));
        g += `<rect x="${x}" y="${suelo - bh}" width="${bw}" height="${bh}" rx="1.2" fill="${fill}"/><rect x="${x}" y="${suelo - bh}" width="${bw}" height="1" rx=".5" fill="${T.neon}" opacity=".9"/>`;
        for (let yy = suelo - bh + 3; yy < suelo - 3; yy += paso) for (let xx = x + 1.5; xx < x + bw - 2; xx += paso) if (r() > .5) g += `<rect x="${xx.toFixed(1)}" y="${yy}" width="1.4" height="1.4" rx=".3" fill="${r() > .6 ? ventana : T.ventana2}" opacity=".9"/>`;
        x += bw + 1 + Math.floor(r() * 3);
      }
    }
    return g + "</g>";
  };
  s += capa(T.edif1, T.ventana, 7, 16, 20, 52, 3.4, id + "lejos");
  s += capa(T.edif2, T.ventana, 12, 26, 8, 26, 3.8, id + "cerca");
  // carretera
  s += `<rect x="0" y="${suelo}" width="${w}" height="${h - suelo}" fill="${T.carretera}"/><rect x="0" y="${suelo}" width="${w}" height="1.6" fill="${T.neon}"/>`;
  const carriles = T.carriles, alturaCarril = Math.floor((h - suelo - 6) / carriles);
  let rayas = `<g id="${id}rayas">`;
  for (let c = 1; c < carriles; c++) { const y = suelo + 4 + c * alturaCarril; for (let xx = -12; xx < w + 12; xx += 12) rayas += `<rect x="${xx}" y="${y - .6}" width="6" height="1.2" rx=".6" fill="${T.linea}" opacity=".9"/>`; }
  s += rayas + "</g>";
  s += `<rect x="0" y="${h - 3}" width="${w}" height="3" fill="${T.borde}"/>`;
  return { svg: s, suelo, carriles, alturaCarril, capas: { lejos: id + "lejos", cerca: id + "cerca", rayas: id + "rayas" }, periodoRayas: 12 };
}

// Montaña con plataformas para subir contestando (estilo plataformas).
export function escenaMontana(w = 172, h = 140, pasos = 8, semilla = 3, tema = {}) {
  const T = { cielo1: "#0C4A6E", cielo2: "#38BDF8", cielo3: "#BAE6FD", fondo1: "#1E5F7A", fondo2: "#2B7A99", roca: "#8B5E3C", rocaOscura: "#5C3A1A", nieve: "#F8FAFC", pasto: "#7CCF4F", pastoOscuro: "#4F9A2E", sol: "#FFE066", ...tema };
  const r = azar(semilla); const id = "m" + semilla;
  let s = `<defs>${degradado(id + "k", T.cielo1, T.cielo2, T.cielo3)}</defs><rect width="${w}" height="${h}" fill="url(#${id}k)"/>`;
  s += estrellas(r, w, h * .35, 18, "#ffffff");
  s += `<circle cx="${w - 28}" cy="22" r="9" fill="${T.sol}" ${o(.5)}/><circle cx="${w - 31}" cy="19" r="2.2" fill="#fff" opacity=".6"/>`;
  s += `<polygon points="0,${h} 30,${h * .5} 48,${h * .68} 90,${h * .36} 125,${h * .66} 150,${h * .46} ${w},${h * .78} ${w},${h}" fill="${T.fondo1}"/>`;
  s += `<polygon points="84,${h * .36} 90,${h * .36 - 1} 96,${h * .36} 92,${h * .43} 88,${h * .41}" fill="${T.nieve}"/><polygon points="26,${h * .52} 30,${h * .5} 34,${h * .52} 32,${h * .57} 28,${h * .56}" fill="${T.nieve}"/>`;
  s += `<polygon points="0,${h} 38,${h * .68} 76,${h * .84} 108,${h * .58} 142,${h * .84} ${w},${h * .64} ${w},${h}" fill="${T.fondo2}"/>`;
  for (let i = 0; i < 4; i++) { const cx = 10 + r() * (w - 20), cy = 14 + r() * 30; s += `<g opacity=".85"><ellipse cx="${cx}" cy="${cy}" rx="9" ry="3.2" fill="#fff"/><ellipse cx="${cx - 4}" cy="${cy - 2}" rx="5" ry="3.4" fill="#fff"/><ellipse cx="${cx + 4}" cy="${cy - 1.5}" rx="5.5" ry="3.2" fill="#fff"/></g>`; }
  const puntos = [];
  const x0 = 12, y0 = h - 14, x1 = w - 40, y1 = 26;
  const ancho = Math.round((x1 - x0) / pasos) + 10;
  for (let k = 0; k <= pasos; k++) {
    const x = Math.round(x0 + (x1 - x0) * (k / pasos)), y = Math.round(y0 - (y0 - y1) * (k / pasos));
    puntos.push({ x, y });
    s += `<rect x="${x - 6}" y="${y}" width="${ancho}" height="${h - y}" rx="2.2" fill="${T.roca}" ${o(.5)}/><rect x="${x - 4}" y="${y + 6}" width="${ancho - 4}" height="${Math.max(0, h - y - 7)}" rx="1.6" fill="${T.rocaOscura}" opacity=".35"/>`;
    s += `<rect x="${x - 6}" y="${y - 1.4}" width="${ancho}" height="3.2" rx="1.6" fill="${k >= pasos - 2 ? T.nieve : T.pasto}" ${o(.45)}/>`;
    if (k < pasos - 2) s += `<rect x="${x - 3}" y="${y + 1.6}" width="${ancho - 6}" height="1" rx=".5" fill="${T.pastoOscuro}" opacity=".6"/>`;
  }
  s += `<rect x="0" y="${h - 4}" width="${w}" height="4" fill="${T.pastoOscuro}"/>`;
  return { svg: s, puntos };
}

// Castillo: torre a la izquierda y camino por donde llegan los soldados.
export function escenaCastillo(w = 172, h = 140, semilla = 5, tema = {}) {
  const T = { cielo1: "#1B1340", cielo2: "#3B2A7A", cielo3: "#7C4DFF", luna: "#FFE9A8", colinas: "#2E2566", colinas2: "#3B3080", suelo: "#3F6212", pasto: "#7CCF4F", piedra: "#8E97AD", piedra2: "#B7BFD1", piedraOscura: "#5F6880", puerta: "#8B5A2B", ...tema };
  const r = azar(semilla); const id = "t" + semilla;
  let s = `<defs>${degradado(id + "k", T.cielo1, T.cielo2, T.cielo3)}</defs><rect width="${w}" height="${h}" fill="url(#${id}k)"/>`;
  s += estrellas(r, w, h * .5, 36, "#FEF3C7");
  s += `<circle cx="${w - 34}" cy="22" r="10" fill="${T.luna}" ${o(.5)}/><circle cx="${w - 38}" cy="18" r="2" fill="#fff" opacity=".7"/><circle cx="${w - 30}" cy="26" r="1.6" fill="#E8D48A" opacity=".8"/>`;
  const suelo = h - 24;
  s += `<path d="M0 ${suelo} Q40 ${suelo - 34} 90 ${suelo - 12} T${w} ${suelo - 16} V${suelo} Z" fill="${T.colinas}"/>`;
  s += `<path d="M30 ${suelo} Q70 ${suelo - 20} 120 ${suelo - 8} T${w} ${suelo - 4} V${suelo} Z" fill="${T.colinas2}"/>`;
  s += `<rect x="0" y="${suelo}" width="${w}" height="${h - suelo}" fill="${T.suelo}"/><rect x="0" y="${suelo - 1}" width="${w}" height="3" rx="1.5" fill="${T.pasto}" ${o(.4)}/>`;
  const tx = 10, tw = 34, ty = 30;
  s += `<rect x="${tx}" y="${ty}" width="${tw}" height="${suelo - ty}" rx="2" fill="${T.piedra}" ${o(.6)}/>`;
  s += `<rect x="${tx + tw - 9}" y="${ty + 2}" width="7" height="${suelo - ty - 2}" fill="${T.piedraOscura}" opacity=".5"/>`;
  for (let yy = ty + 6; yy < suelo - 4; yy += 7) for (let xx = tx + ((Math.round(yy / 7) % 2) ? 2 : 6); xx < tx + tw - 8; xx += 9) s += `<rect x="${xx}" y="${yy}" width="6" height="3" rx="1" fill="${T.piedra2}" opacity=".9"/>`;
  for (let k = 0; k < 4; k++) s += `<rect x="${tx - 1 + k * 9}" y="${ty - 7}" width="7" height="8" rx="1.4" fill="${T.piedra}" ${o(.55)}/>`;
  s += `<path d="M${tx + 11} ${suelo} v-14 a6 6 0 0 1 12 0 v14 z" fill="${T.puerta}" ${o(.5)}/><circle cx="${tx + 20}" cy="${suelo - 7}" r=".9" fill="${C.amarillo}"/>`;
  s += `<rect x="${tx + 14}" y="${ty + 12}" width="6" height="8" rx="3" fill="${C.amarillo}" ${o(.4)}/>`;
  s += `<line x1="${tx + tw - 6}" y1="${ty - 18}" x2="${tx + tw - 6}" y2="${ty - 7}" ${o(.6)}/><path d="M${tx + tw - 6} ${ty - 18} L${tx + tw + 3} ${ty - 15} L${tx + tw - 6} ${ty - 12} Z" fill="${C.rojo}" ${o(.4)}/>`;
  return { svg: s, suelo, torreX: tx + tw, torreTop: ty };
}

// Planeta con el astronauta: fondo de Mix and match y de la pantalla de carga.
export function escenaPlaneta(w = 172, h = 140, semilla = 11, tema = {}) {
  const T = { cielo1: "#0B1026", cielo2: "#1B1340", cielo3: "#4C1D95", suelo: "#7C4DFF", sueloOscuro: "#5A2ED6", borde: "#C4B5FD", roca: "#5B21B6", ...tema };
  const r = azar(semilla); const id = "p" + semilla;
  let s = `<defs>${degradado(id + "k", T.cielo1, T.cielo2, T.cielo3)}</defs><rect width="${w}" height="${h}" fill="url(#${id}k)"/>`;
  s += estrellas(r, w, h * .75, 60, "#DBEAFE");
  s += `<g transform="rotate(-18 ${w - 40} 28)"><ellipse cx="${w - 40}" cy="28" rx="19" ry="4.6" fill="none" stroke="#A78BFA" stroke-width="2.2" opacity=".85"/></g><circle cx="${w - 40}" cy="28" r="10" fill="#60A5FA" ${o(.5)}/><path d="M${w - 48} 24 q6 -5 14 -1 q-4 6 -14 1 z" fill="#2F6DF6" opacity=".7"/><circle cx="${w - 44}" cy="23" r="2.2" fill="#fff" opacity=".6"/>`;
  s += `<circle cx="24" cy="30" r="3.4" fill="#F472B6" ${o(.4)}/>`;
  const suelo = h - 36;
  s += `<path d="M0 ${suelo + 10} Q${w / 2} ${suelo - 14} ${w} ${suelo + 10} V${h} H0 Z" fill="${T.suelo}" ${o(.6)}/>`;
  s += `<path d="M0 ${suelo + 10} Q${w / 2} ${suelo - 14} ${w} ${suelo + 10} V${suelo + 14} Q${w / 2} ${suelo - 8} 0 ${suelo + 14} Z" fill="${T.borde}" opacity=".55"/>`;
  for (let i = 0; i < 9; i++) { const cx = 6 + r() * (w - 12), cy = suelo + 8 + r() * (h - suelo - 14); s += `<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${(2 + r() * 3).toFixed(1)}" ry="1.1" fill="${T.sueloOscuro}" opacity=".8"/>`; }
  return { svg: s, suelo: suelo - 2 };
}

// Marco SVG listo para insertar: toma el fondo y agrega capas (personajes) encima.
export function escenaSvg(fondo, w, h, capas = "", extra = "") {
  return `<svg class="escena" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" ${extra}>${fondo}${capas}</svg>`;
}
