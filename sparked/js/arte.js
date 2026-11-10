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

// ---------- Sparky, el astronauta-robot (16 × 20) ----------
// Versión 2.1 (6 nov 2026, referencia de Daniel: astronauta chaparrito, detallado y con "rayitas" retro, sin pixeles).
// La cara son luces LED sobre el visor: ojos y boca se encienden distinto en cada expresión (desde el 7 nov ya no
// lleva cachetes rosas, para que se note la lengüita cuando se concentra). El traje es crema con sombra gris-lavanda
// rayada (como impresión retro), franjas y guantes naranja, panel de pecho amarillo, hombreras, articulaciones con
// rayitas, reloj en la muñeca, bolsillo, botas con suela y hebilla, mochila gris con luz roja y tanques, anillo del
// cuello, visera sobre el visor y una chispa en la antena (la "spark" de SparkEd).
// Sparky vivo (7 nov 2026, Daniel: "que tenga un poquito más de vida y no parezca que está confundido todo el tiempo"):
// poses que se mueven solo con CSS (construyendo, caminando, escribiendo, volando, arreglando…) y accesorios que se
// suman a cualquier pose con "+": "+casco" (casco amarillo de obra; la antena sale por arriba), "+taller" (bloques de
// colores en el piso; el dibujo se hace más ancho) y "+jetpack" (propulsores en la mochila). Las piezas que se mueven
// van en grupos con clase (sk-cuerpo, sk-cara, sk-mano, sk-martillo, sk-llave, sk-llama, sk-pierna-a…); las
// animaciones están en base.css y solo corren dentro de un contenedor .sk-anima.
const S = { luz: "#FBF7EE", sombra: "#DAD8E8", costura: "#B9B4D0", gris: "#9CA2B8", grisOscuro: "#636A86", naranja: "#FF7A3D", amarillo: "#FFC247", rojo: "#FF4D5E", visor: "#1A1733", led: "#7DF9FF", ledSuave: "#5BB8FF", lengua: "#FF7FA8", rosa: "#FF6B9D" };
const r2 = (v) => Math.round(v * 100) / 100;
const RAYAS = `<defs><pattern id="sk-rayas" width="1" height=".6" patternUnits="userSpaceOnUse"><rect width="1" height=".2" fill="#2A2340" opacity=".13"/></pattern><pattern id="sk-scan" width="1" height=".5" patternUnits="userSpaceOnUse"><rect width="1" height=".16" fill="#fff" opacity=".07"/></pattern></defs>`;
const chispa = (cx, cy, R, r, fill, sw = .3) => { const k = r * Math.SQRT1_2; return `<path d="M${cx} ${cy - R} L${cx + k} ${cy - k} L${cx + R} ${cy} L${cx + k} ${cy + k} L${cx} ${cy + R} L${cx - k} ${cy + k} L${cx - R} ${cy} L${cx - k} ${cy - k} Z" fill="${fill}" ${o(sw)}/>`; };
const ojoLed = (x, y, w, h, color) => `<g class="led-ojo"><rect x="${x - .35}" y="${y - .35}" width="${w + .7}" height="${h + .7}" rx="${h / 2}" fill="${color}" opacity=".28"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.min(w, h) * .4}" fill="${color}"/></g>`;
const bocaLed = (d, color, sw = .5) => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`;
// Corazón centrado en (cx, cy); s es su tamaño.
const pathCorazon = (cx, cy, s) => `M${cx} ${r2(cy + .85 * s)} C${r2(cx - 1.5 * s)} ${r2(cy - .05 * s)} ${r2(cx - .75 * s)} ${r2(cy - 1.15 * s)} ${cx} ${r2(cy - .3 * s)} C${r2(cx + .75 * s)} ${r2(cy - 1.15 * s)} ${r2(cx + 1.5 * s)} ${r2(cy - .05 * s)} ${cx} ${r2(cy + .85 * s)} Z`;
const corazonLed = (cx, cy, s, color) => `<g class="led-ojo"><path d="${pathCorazon(cx, cy, s)}" fill="${color}" stroke="${color}" stroke-width=".55" stroke-linejoin="round" opacity=".3"/><path d="${pathCorazon(cx, cy, s)}" fill="${color}"/></g>`;
// Lengüita de concentración: sale por un lado de la sonrisa, con su rayita en medio para que se lea como lengua.
const lengua = (x, y) => `<path d="M${x} ${y} h.95 v.32 a.475 .475 0 0 1 -.95 0 z" fill="${S.lengua}"/><path d="M${r2(x + .475)} ${r2(y + .1)} v.42" stroke="#C93F6E" stroke-width=".13" stroke-linecap="round"/>`;
// La expresión de cada pose, dibujada solo con luces.
function caraLed(pose) {
  if (pose === "saludo") return `${bocaLed("M5.75 6.25 q.85 -1.35 1.7 0", S.led, .6)}${bocaLed("M8.55 6.25 q.85 -1.35 1.7 0", S.led, .6)}${bocaLed("M6.9 7.3 q1.1 1.3 2.2 0", S.led)}`;
  if (pose === "festejo") return `${chispa(6.65, 5.9, 1.05, .38, S.led, 0)}${chispa(9.35, 5.9, 1.05, .38, S.led, 0)}<path d="M6.8 7.15 h2.4 a1.2 1.1 0 0 1 -2.4 0 z" fill="${S.led}"/>`;
  if (pose === "triste") return `${ojoLed(5.9, 5.5, 1.5, 1.3, S.ledSuave)}${ojoLed(8.6, 5.5, 1.5, 1.3, S.ledSuave)}${bocaLed("M5.8 5.35 l1.5 -.55", S.ledSuave, .4)}${bocaLed("M10.2 5.35 l-1.5 -.55", S.ledSuave, .4)}${bocaLed("M7.1 7.95 q.9 -.85 1.8 0", S.ledSuave)}<path d="M6.5 7.1 q.55 .95 0 1.35 q-.55 -.4 0 -1.35 z" fill="${S.ledSuave}"/>`;
  if (pose === "pensando") return `${ojoLed(5.9, 4.9, 1.5, 2, S.led)}<rect x="8.6" y="5.55" width="1.5" height=".65" rx=".32" fill="${S.led}"/>${bocaLed("M7.3 7.7 l1.4 -.35", S.led)}`;
  // Construyendo: mira el martillo (abajo a la derecha) muy contento, con la boca abierta.
  if (pose === "construyendo") return `${ojoLed(6.3, 5.15, 1.5, 1.85, S.led)}${ojoLed(9, 5.15, 1.5, 1.85, S.led)}<path d="M7.45 7.3 h2.2 a1.1 1 0 0 1 -2.2 0 z" fill="${S.led}"/>`;
  // Caminando: los ojos miran hacia donde va (a la derecha; al voltear, el dibujo se refleja).
  if (pose === "caminando") return `${ojoLed(6.35, 4.9, 1.5, 2, S.led)}${ojoLed(9.05, 4.9, 1.5, 2, S.led)}${bocaLed("M7.55 7.5 q.9 .85 1.8 0", S.led)}`;
  // Escribiendo: mira la hoja (abajo) y saca la lengüita, como quien escribe con cuidado.
  if (pose === "escribiendo") return `${ojoLed(5.75, 5.45, 1.5, 1.7, S.led)}${ojoLed(8.45, 5.45, 1.5, 1.7, S.led)}${bocaLed("M6.85 7.6 q.8 .7 1.6 0", S.led)}${lengua(7.8, 7.78)}`;
  // Volando: ojos felices ^ ^ y boca abierta, como diciendo "¡wiii!".
  if (pose === "volando") return `${bocaLed("M5.75 6.25 q.85 -1.35 1.7 0", S.led, .6)}${bocaLed("M8.55 6.25 q.85 -1.35 1.7 0", S.led, .6)}<path d="M6.9 7.2 h2.2 a1.1 1.05 0 0 1 -2.2 0 z" fill="${S.led}"/>`;
  // Arreglando: mira hacia arriba (lo que arregla) y saca la lengüita de concentración.
  if (pose === "arreglando") return `${ojoLed(6.2, 4.15, 1.5, 1.75, S.led)}${ojoLed(8.9, 4.15, 1.5, 1.75, S.led)}${bocaLed("M7.15 7.05 q.85 .65 1.7 0", S.led)}${lengua(8.15, 7.25)}`;
  // Sorprendido: ojos muy abiertos y boca en "o" (cuando el dato se traba).
  if (pose === "sorprendido") return `${ojoLed(5.7, 4.5, 1.8, 2.4, S.led)}${ojoLed(8.5, 4.5, 1.8, 2.4, S.led)}<circle cx="8" cy="7.85" r=".5" fill="none" stroke="${S.led}" stroke-width=".42"/>`;
  // Riendo: ojos apretados > < y boca grande.
  if (pose === "riendo") return `${bocaLed("M5.8 5.1 l1.3 .75 l-1.3 .75", S.led, .55)}${bocaLed("M10.2 5.1 l-1.3 .75 l1.3 .75", S.led, .55)}<path d="M6.6 7 h2.8 a1.4 1.3 0 0 1 -2.8 0 z" fill="${S.led}"/>`;
  // Enamorado: ojos de corazón (cuando lo tocan con cariño).
  if (pose === "enamorado") return `${corazonLed(6.65, 5.9, .95, S.rosa)}${corazonLed(9.35, 5.9, .95, S.rosa)}${bocaLed("M7.1 7.65 q.9 .8 1.8 0", S.led)}`;
  // Decidido (duelo): ojos firmes con cejas inclinadas hacia dentro y media sonrisa valiente.
  if (pose === "decidido") return `${ojoLed(6, 5.15, 1.5, 1.6, S.led)}${ojoLed(8.6, 5.15, 1.5, 1.6, S.led)}${bocaLed("M5.7 4.35 l1.7 .55", S.led, .42)}${bocaLed("M10.3 4.35 l-1.7 .55", S.led, .42)}${bocaLed("M7.1 7.55 q1 .5 1.9 -.2", S.led)}`;
  return `${ojoLed(5.9, 4.9, 1.5, 2, S.led)}${ojoLed(8.6, 4.9, 1.5, 2, S.led)}${bocaLed("M7.1 7.5 q.9 .85 1.8 0", S.led)}`;
}
// Brazo articulado: hombro-brazo con franja naranja, articulación gris con rayita, antebrazo (con reloj si se pide) y
// guante naranja. Gira alrededor del hombro, así que el guante siempre queda en la punta.
const brazo = (x, y, rot, reloj) => `<g transform="rotate(${rot} ${x + 1.15} ${y + .2})">
  <rect x="${x}" y="${y}" width="2.3" height="2.3" rx="1" fill="${S.luz}" ${o(.5)}/>
  <rect x="${x}" y="${y + .95}" width="2.3" height=".75" fill="${S.naranja}" ${o(.3)}/>
  <rect x="${x + .15}" y="${y + 2.15}" width="2" height=".85" fill="${S.sombra}" ${o(.4)}/>
  <line x1="${x + .45}" y1="${y + 2.58}" x2="${x + 1.85}" y2="${y + 2.58}" stroke="${S.costura}" stroke-width=".2"/>
  <rect x="${x + .1}" y="${y + 2.85}" width="2.1" height="1.75" rx=".8" fill="${S.luz}" ${o(.5)}/>
  ${reloj ? `<rect x="${x + .35}" y="${y + 3.55}" width="1.6" height=".8" rx=".22" fill="${S.grisOscuro}" ${o(.3)}/><rect x="${x + .65}" y="${y + 3.78}" width="1" height=".35" fill="${S.led}"/>` : ""}
  <circle cx="${x + 1.15}" cy="${y + 5.1}" r="1.15" fill="${S.naranja}" ${o(.45)}/><ellipse cx="${x + .8}" cy="${y + 4.7}" rx=".4" ry=".25" fill="#fff" opacity=".5"/>
</g>`;
// Botas (Daniel, 9 nov 2026): el lado interior de cada bota, el que mira a la otra, va recto y con esquinas cuadradas,
// y las dos comparten una sola línea en el centro del cuerpo (x = 8). Antes cada bota era una píldora y las dos esquinas
// redondas juntas formaban un pico entre los pies. El lado de afuera sigue redondo, igual que siempre.
const medioRedondo = (x, y, w, h, r, rectoDerecha) => rectoDerecha
  ? `M${r2(x + r)} ${y} H${r2(x + w)} V${r2(y + h)} H${r2(x + r)} a${r} ${r} 0 0 1 ${-r} ${-r} V${r2(y + r)} a${r} ${r} 0 0 1 ${r} ${-r} z`
  : `M${x} ${y} H${r2(x + w - r)} a${r} ${r} 0 0 1 ${r} ${r} V${r2(y + h - r)} a${r} ${r} 0 0 1 ${-r} ${r} H${x} z`;
const bota = (x) => {
  const izquierda = x < 8, bx = izquierda ? r2(x - .4) : 8, bw = izquierda ? r2(8 - bx) : r2(x + 3.2 - 8);
  const forma = (y, h, r) => medioRedondo(bx, y, bw, h, r, izquierda);
  return `<path d="${forma(17.9, 1.4, .65)}" fill="${S.luz}"/>
    <path d="${forma(18.75, .55, .27)}" fill="${S.grisOscuro}"/>
    <path d="${forma(17.9, 1.4, .65)}" fill="none" stroke="${C.linea}" stroke-width=".45" stroke-linejoin="miter" stroke-linecap="butt"/>`;
};
const pierna = (x) => `
    <rect x="${x}" y="16" width="2.8" height="2.6" rx="1.1" fill="${S.luz}" ${o(.5)}/>
    <rect x="${x}" y="16.6" width="2.8" height=".7" fill="${S.naranja}" ${o(.3)}/>
    <line x1="${x + .5}" y1="17.75" x2="${x + 2.3}" y2="17.75" stroke="${S.costura}" stroke-width=".22"/><line x1="${x + .5}" y1="18.1" x2="${x + 2.3}" y2="18.1" stroke="${S.costura}" stroke-width=".22"/>
    ${bota(x)}
    <rect x="${x + .7}" y="18.15" width=".9" height=".45" rx=".15" fill="${S.gris}" ${o(.25)}/>`;
// Piernas en grupos (para caminar o patalear en el aire); "sk-arriba" hace que giren desde la cadera.
const piernasAnimadas = () => `<g class="sk-arriba sk-pierna sk-pierna-a">${pierna(4.6)}</g><g class="sk-arriba sk-pierna sk-pierna-b">${pierna(8.6)}</g>`;
// Grupo que gira alrededor de (cx, cy) —un hombro, una muñeca—: el cuadro invisible centrado en ese punto hace que
// "transform-box: fill-box; transform-origin: center" caiga justo ahí en Chrome, Safari y Firefox.
const giro = (cx, cy, clase, inner, r = 7) => `<g class="sk-giro ${clase}"><rect x="${r2(cx - r)}" y="${r2(cy - r)}" width="${r2(2 * r)}" height="${r2(2 * r)}" fill="none"/>${inner}</g>`;

// Accesorios de las poses nuevas.
// Casco amarillo de obra sobre el casco de astronauta: cúpula con cresta, sombra rayada, ala y la antena saliendo arriba.
const cascoObra = () => `<g class="sk-casco-obra">
  <path d="M3.3 3.3 C3.5 0 12.5 0 12.7 3.3 Z" fill="#FFD23F"/>
  <path d="M3.4 2.6 C5.5 2.2 10.5 2.2 12.6 2.6 L12.7 3.3 L3.3 3.3 Z" fill="#E9A21B"/><path d="M3.4 2.6 C5.5 2.2 10.5 2.2 12.6 2.6 L12.7 3.3 L3.3 3.3 Z" fill="url(#sk-rayas)"/>
  <path d="M7.2 .95 Q8 .7 8.8 .95 L9 3.25 L7 3.25 Z" fill="#FFE27A" ${o(.3)}/>
  <ellipse cx="5.2" cy="1.8" rx=".85" ry=".4" fill="#fff" opacity=".6" transform="rotate(-30 5.2 1.8)"/>
  <path d="M3.3 3.3 C3.5 0 12.5 0 12.7 3.3 Z" fill="none" ${o(.5)}/>
  <rect x="2.4" y="3.05" width="11.2" height=".95" rx=".47" fill="#E9A21B" ${o(.45)}/>
  <rect x="3" y="3.17" width="10" height=".3" rx=".15" fill="#fff" opacity=".4"/>
  <line x1="8" y1=".8" x2="8" y2=".1" ${o(.5)}/>
  ${chispa(8, -.32, .8, .28, S.amarillo)}
</g>`;
// Jetpack: dos propulsores a los lados de la mochila (franja naranja y tobera oscura). Con fuego, cada tobera echa una
// llama naranja, amarilla y blanca que titila con la animación.
const propulsor = (x) => `<rect x="${x}" y="12.3" width="1.75" height="3.5" rx=".6" fill="${S.gris}"/>
  <rect x="${r2(x + 1)}" y="12.3" width=".75" height="3.5" rx=".35" fill="${S.grisOscuro}"/>
  <rect x="${x}" y="13.25" width="1.75" height=".55" fill="${S.naranja}"/>
  <rect x="${x}" y="12.3" width="1.75" height="3.5" rx=".6" fill="none" ${o(.45)}/>
  <path d="M${r2(x + .2)} 15.75 h1.35 l.35 .95 h-2.05 z" fill="${S.grisOscuro}" ${o(.4)}/>`;
const llama = (cx, clase) => `<g class="sk-arriba sk-llama ${clase}"><path d="M${r2(cx - .78)} 16.7 Q${r2(cx - .95)} 18.4 ${cx} 19.95 Q${r2(cx + .95)} 18.4 ${r2(cx + .78)} 16.7 Z" fill="#FF7A3D"/><path d="M${r2(cx - .48)} 16.7 Q${r2(cx - .55)} 17.9 ${cx} 19 Q${r2(cx + .55)} 17.9 ${r2(cx + .48)} 16.7 Z" fill="#FFD23F"/><path d="M${r2(cx - .2)} 16.7 Q${r2(cx - .22)} 17.3 ${cx} 17.85 Q${r2(cx + .22)} 17.3 ${r2(cx + .2)} 16.7 Z" fill="#fff"/></g>`;
const jetpack = (fuego) => `${propulsor(1.5)}${propulsor(12.75)}${fuego ? llama(2.38, "sk-llama-a") + llama(13.63, "sk-llama-b") : ""}`;
// Llave de tuercas dibujada sobre el brazo colgando (guante en 12.75, 16): mango hacia abajo y boca abierta al final.
// Con el brazo arriba (-172°) la boca queda hacia arriba, lista para apretar lo que se trabó.
const llave = () => `<rect x="12.42" y="16.3" width=".66" height="2.7" rx=".3" fill="${S.gris}" ${o(.35)}/>
  <path d="M11.75 18.95 q0 -.2 .2 -.2 h1.6 q.2 0 .2 .2 v.95 q0 .2 -.2 .2 h-.45 v-.6 h-.7 v.6 h-.45 q-.2 0 -.2 -.2 z" fill="${S.gris}" ${o(.4)}/>
  <rect x="11.95" y="18.95" width=".3" height=".9" rx=".15" fill="#fff" opacity=".45"/>`;
// Chispitas en la boca de la llave (invisibles hasta que la animación las enciende con cada apretón).
const chispasLlave = () => [[12.6, 1.5, .55], [15.1, 1.25, .6], [14.25, .5, .42]].map(([x, y, R], i) => `<g class="sk-centro sk-chispa-llave sk-chispa-llave-${i + 1}" opacity="0">${chispa(x, y, R, r2(R * .36), i % 2 ? S.amarillo : "#FFE680", .22)}</g>`).join("");
// Martillo dibujado sobre el brazo colgando (guante en 12.75, 16): mango de madera hacia abajo-derecha y cabeza de acero.
// Con el brazo a -52.3° el mango queda horizontal y la cara de la cabeza pega hacia abajo, sobre el bloque de arriba.
const martillo = () => `<g transform="translate(13.91 17.5) rotate(52.3)">
  <rect x="-2.15" y="-.32" width="2.4" height=".64" rx=".32" fill="#C98B4D" ${o(.35)}/>
  <rect x="-.75" y="-1.5" width="1.5" height="3" rx=".35" fill="${S.gris}"/>
  <rect x=".1" y="-1.5" width=".65" height="3" rx=".3" fill="${S.grisOscuro}"/>
  <rect x="-.55" y="-1.25" width=".35" height="1.9" rx=".17" fill="#fff" opacity=".45"/>
  <rect x="-.75" y="-1.5" width="1.5" height="3" rx=".35" fill="none" ${o(.45)}/>
</g>`;
// Un bloque 2.5D (cara clara arriba, sombra rayada abajo, brillo y contorno), con letra si se pide.
const bloque = (x, y, w, h, luz, sombra, letra = "") => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx=".4" fill="${luz}"/>
  <rect x="${x}" y="${r2(y + h * .58)}" width="${w}" height="${r2(h * .42)}" rx=".35" fill="${sombra}"/><rect x="${x}" y="${r2(y + h * .58)}" width="${w}" height="${r2(h * .42)}" rx=".35" fill="url(#sk-rayas)"/>
  <rect x="${r2(x + .35)}" y="${r2(y + .25)}" width="${r2(w - .7)}" height=".28" rx=".14" fill="#fff" opacity=".5"/>
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx=".4" fill="none" ${o(.45)}/>
  ${letra ? `<text x="${r2(x + w / 2)}" y="${r2(y + h * .74)}" font-size="${r2(h * .66)}" font-weight="800" text-anchor="middle" fill="#fff" stroke="${C.linea}" stroke-width=".2" paint-order="stroke" font-family="Outfit, Arial, sans-serif">${letra}</text>` : ""}`;
// El taller: bloques de letras A, B y C en el piso (los bloques de la guía) que Sparky acomoda a martillazos.
const tallerBloques = () => `<ellipse cx="18.5" cy="19.35" rx="3.1" ry=".5" fill="${C.sombra}"/>
  ${bloque(16.2, 17.45, 2.2, 1.85, C.teal, C.tealOscuro, "A")}${bloque(18.65, 17.45, 2.2, 1.85, "#8F6BFF", "#5A2ED6", "B")}
  <g class="sk-pie sk-golpeado">${bloque(17.4, 15.6, 2.25, 1.85, S.naranja, "#D9541A", "C")}</g>`;
// Chispitas del golpe (invisibles hasta que la animación las enciende en cada martillazo).
const chispasGolpe = () => [[16.7, 14.75, .85], [20.4, 14.55, .9], [20.05, 12.85, .6], [17.05, 13.05, .55]].map(([x, y, R], i) => `<g class="sk-centro sk-chispa sk-chispa-${i + 1}" opacity="0">${chispa(x, y, R, r2(R * .36), i % 2 ? S.amarillo : "#FFE680", .25)}</g>`).join("");
// Tabla con hoja delante del cuerpo: pinza, título naranja y tres renglones que se van escribiendo (trazos ondulados
// con pathLength 1 para que la animación los "dibuje" de izquierda a derecha).
const tablaNotas = () => `<g class="sk-tabla">
  <rect x="5.25" y="11.95" width="5.5" height="4.3" rx=".45" fill="#C98B4D"/>
  <rect x="5.25" y="15.2" width="5.5" height="1.05" rx=".4" fill="#A46B33"/><rect x="5.25" y="15.2" width="5.5" height="1.05" rx=".4" fill="url(#sk-rayas)"/>
  <rect x="5.25" y="11.95" width="5.5" height="4.3" rx=".45" fill="none" ${o(.45)}/>
  <rect x="5.7" y="12.45" width="4.6" height="3.45" rx=".2" fill="#FFFDF6" ${o(.3)}/>
  <rect x="6.25" y="12.85" width="2.2" height=".38" rx=".19" fill="${S.naranja}"/>
  ${[13.65, 14.35, 15.05].map((y, i) => `<path class="sk-linea sk-linea-${i + 1}" d="M6.3 ${y} q.18 -.26 .36 0${" t.36 0".repeat(i < 2 ? 8 : 5)}" pathLength="1" fill="none" stroke="${S.visor}" stroke-width=".2" stroke-linecap="round" opacity=".7"/>`).join("")}
  <rect x="7.1" y="11.55" width="1.8" height="1.15" rx=".35" fill="${S.gris}" ${o(.35)}/><rect x="7.5" y="11.8" width="1" height=".35" rx=".17" fill="${S.grisOscuro}"/>
</g>`;
const guante = (cx, cy) => `<circle cx="${cx}" cy="${cy}" r="1.15" fill="${S.naranja}" ${o(.45)}/><ellipse cx="${r2(cx - .35)}" cy="${r2(cy - .4)}" rx=".4" ry=".25" fill="#fff" opacity=".5"/>`;
// Mano que escribe (guante en 8.93, 14.17) con un lápiz amarillo de goma rosa; la punta queda en 7.73, 15.07 (inicio
// del tercer renglón) y el pulgar lo sujeta.
const manoConLapiz = () => `${guante(8.93, 14.17)}<g transform="translate(8.93 14.17) rotate(53.1)">
  <rect x="-.39" y="-2" width=".78" height=".6" rx=".22" fill="#FF8FB1" ${o(.3)}/>
  <rect x="-.39" y="-1.45" width=".78" height=".38" fill="${S.gris}" ${o(.25)}/>
  <rect x="-.39" y="-1.1" width=".78" height="1.95" fill="${S.amarillo}"/><rect x=".1" y="-1.1" width=".29" height="1.95" fill="#E89B1C"/>
  <rect x="-.39" y="-1.1" width=".78" height="1.95" fill="none" ${o(.3)}/>
  <path d="M-.39 .85 L.39 .85 L0 1.5 Z" fill="#F6D7AE" ${o(.3)}/><path d="M-.13 1.22 L.13 1.22 L0 1.5 Z" fill="${C.linea}"/>
  <circle cx="-.55" cy="-.25" r=".46" fill="${S.naranja}" ${o(.3)}/>
</g>`;
// Corazoncitos que suben cuando está enamorado.
const corazoncitos = () => [[13.3, 2.6, .62, 1], [2.75, 3.3, .5, 2]].map(([x, y, s, i]) => `<g class="sk-centro sk-corazoncito sk-corazoncito-${i}"><path d="${pathCorazon(x, y, s)}" fill="${S.rosa}" ${o(.25)}/></g>`).join("");

// Accesorios del duelo (7 nov 2026): "+espada" (espada de caballero en la mano derecha) y "+yelmo" (penacho naranja y
// cresta de acero sobre el casco). Acabado 3.0: hoja de acero con degradado, guarda dorada y brillo en la punta.
const DEFS_CABALLERO = `<defs><linearGradient id="sk-acero" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".45" stop-color="#D5DBE6"/><stop offset="1" stop-color="#7D8698"/></linearGradient>
  <linearGradient id="sk-oro" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE7A3"/><stop offset=".5" stop-color="#FFC247"/><stop offset="1" stop-color="#C98A12"/></linearGradient>
  <linearGradient id="sk-penacho" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFB27A"/><stop offset=".55" stop-color="#FF7A3D"/><stop offset="1" stop-color="#C9461A"/></linearGradient></defs>`;
// La espada se dibuja a lo largo de +x desde el guante (12.75, 16) del brazo colgando; "rl" la gira para que, ya con el
// brazo girado, la hoja apunte hacia donde se quiere (arriba = -90° en el mundo).
const espada = (rl) => `<g transform="translate(12.75 16) rotate(${rl})">
  <circle cx="-1.35" cy="0" r=".45" fill="url(#sk-oro)"/>
  <rect x="-1.1" y="-.34" width="2.2" height=".68" rx=".3" fill="#6B3F22"/><path d="M-.7 -.34 l.3 .68 M-.1 -.34 l.3 .68 M.5 -.34 l.3 .68" stroke="#3E2414" stroke-width=".14"/>
  <path d="M1.8 -.66 L9.6 -.5 L11 0 L9.6 .5 L1.8 .66 Z" fill="url(#sk-acero)"/>
  <path d="M2.3 0 L9.2 0" stroke="#8E97A8" stroke-width=".2" stroke-linecap="round"/>
  <path d="M2.2 -.5 L9.4 -.38" stroke="#fff" stroke-width=".16" stroke-linecap="round" opacity=".85"/>
  <ellipse cx="9.6" cy="-.22" rx=".9" ry=".14" fill="#fff" opacity=".9"/>
  <path d="M1.05 -1.75 Q1.5 -1.9 1.85 -1.6 L1.85 1.6 Q1.5 1.9 1.05 1.75 Z" fill="url(#sk-oro)"/><circle cx="1.45" cy="0" r=".32" fill="#C93F6E"/>
</g>`;
const penacho = () => `<path d="M7.9 1.7 C6 -.1 3.1 0 1.4 2.3 C3.1 1.7 4.5 1.9 5.5 2.6 C4.1 2.5 2.9 3.1 2.3 4.4 C4.3 3.1 6.3 2.9 7.9 2.8 Z" fill="url(#sk-penacho)"/><path d="M7.4 2 C5.8 1 4 1.1 2.6 2" fill="none" stroke="#FFD9B8" stroke-width=".22" stroke-linecap="round" opacity=".8"/>`;
const cresta = () => `<path d="M4.6 2.9 Q8 .25 11.4 2.9" fill="none" stroke="url(#sk-acero)" stroke-width=".75" stroke-linecap="round"/><path d="M5.6 2.35 Q8 .9 10.4 2.35" fill="none" stroke="#fff" stroke-width=".18" stroke-linecap="round" opacity=".8"/>`;
// Brazo derecho con la espada: en guardia (-60°, hoja vertical), en festejo arriba (-165°) y triste hacia abajo (-10°).
const brazoEspada = (pose) => { const rot = pose === "festejo" ? -165 : pose === "triste" ? -10 : -60; const rl = pose === "triste" ? 20 : -90 - rot; return giro(12.75, 11.1, "sk-espada", `<g transform="rotate(${rot} 12.75 11.1)">${espada(rl)}${brazo(11.6, 10.9, 0, false)}</g>`, 16); };

function cuerpoSparky(frame) {
  const { pose, casco, taller, jetpack: conJetpack, vuelo, espada: conEspada, yelmo } = typeof frame === "string" ? leerPose(frame) : frame;
  let brazosAtras = `${brazo(2.1, 10.9, 0, true)}${brazo(11.6, 10.9, 0, false)}`;
  let piernas = `${pierna(4.6)}${pierna(8.6)}`, frente = "", encima = "", extras = "";
  if (pose === "festejo") {
    brazosAtras = giro(3.25, 11.1, "sk-fiesta-a", brazo(2.1, 10.9, 160, false)) + giro(12.75, 11.1, "sk-fiesta-b", brazo(11.6, 10.9, -160, false));
    extras = [[1.9, 3.2, 1.1, .4, S.amarillo], [14.4, 2.2, 1.3, .45, S.amarillo], [13.2, 5.2, .6, .22, S.naranja]].map(([x, y, R, r, c]) => `<g class="sk-centro sk-destello">${chispa(x, y, R, r, c)}</g>`).join("");
  } else if (pose === "saludo") {
    brazosAtras = brazo(2.1, 10.9, 0, true) + giro(12.75, 11.1, "sk-mano", brazo(11.6, 10.9, -160, false));
  } else if (pose === "pensando") {
    // El brazo se dibuja al final, encima del casco: la mano toca el visor.
    brazosAtras = brazo(2.1, 10.9, 0, true);
    encima = brazo(11.6, 10.9, 169, false);
    extras = `<circle cx="12.3" cy="4.5" r=".45" fill="${S.visor}" ${o(.3)}/><circle cx="11.6" cy="5.4" r=".3" fill="${S.visor}" ${o(.3)}/><circle cx="13.7" cy="2.4" r="1.7" fill="${S.visor}" ${o(.4)}/><text x="13.7" y="3.25" font-size="2.4" font-weight="800" text-anchor="middle" fill="${S.led}" font-family="Outfit, Arial, sans-serif">?</text>`;
  } else if (pose === "caminando") {
    piernas = piernasAnimadas();
    brazosAtras = giro(3.25, 11.1, "sk-braceo", brazo(2.1, 10.9, 0, true)) + giro(12.75, 11.1, "sk-braceo", brazo(11.6, 10.9, 0, false));
  } else if (pose === "construyendo") {
    // Quieto, el martillo queda arriba listo para pegar (-130°); la animación lo baja hasta el bloque (+78°).
    brazosAtras = brazo(2.1, 10.9, 0, true) + giro(12.75, 11.1, "sk-martillo", `<g transform="rotate(-130 12.75 11.1)">${martillo()}${brazo(11.6, 10.9, 0, false)}</g>`, 8.3);
  } else if (pose === "escribiendo") {
    // Los dos brazos van al frente, detrás de la tabla: la mano izquierda la sostiene por la orilla y la derecha
    // escribe encima de la hoja (renglón por renglón, con el lápiz garabateando).
    brazosAtras = "";
    frente = `${brazo(11.6, 10.9, 51.2, false)}${brazo(2.1, 10.9, -31.6, true)}${tablaNotas()}${guante(5.82, 15.27)}<g class="sk-escritura">${giro(8.93, 14.17, "sk-garabato", manoConLapiz(), 3.5)}</g>`;
  } else if (pose === "volando") {
    // Brazos arriba como alas (se mecen) y piernas colgando que patalean; el jetpack echa fuego.
    piernas = piernasAnimadas();
    brazosAtras = giro(3.25, 11.1, "sk-ala-a", brazo(2.1, 10.9, 155, true)) + giro(12.75, 11.1, "sk-ala-b", brazo(11.6, 10.9, -155, false));
  } else if (pose === "arreglando") {
    // Vuela con la llave arriba (-172°) para apretar lo que se trabó; la otra mano arriba para equilibrarse.
    piernas = piernasAnimadas();
    brazosAtras = giro(3.25, 11.1, "sk-ala-a", brazo(2.1, 10.9, 155, true)) + giro(12.75, 11.1, "sk-llave", `<g transform="rotate(-172 12.75 11.1)">${llave()}${brazo(11.6, 10.9, 0, false)}</g>`, 9.3);
    extras = chispasLlave();
  } else if (pose === "enamorado") {
    extras = corazoncitos();
  }
  // Con espada, el brazo derecho la sostiene (el izquierdo se queda como en la pose, o colgando).
  if (conEspada && !["escribiendo", "construyendo", "arreglando", "pensando"].includes(pose)) {
    const izq = pose === "festejo" ? giro(3.25, 11.1, "sk-fiesta-a", brazo(2.1, 10.9, 160, false)) : pose === "volando" ? giro(3.25, 11.1, "sk-ala-a", brazo(2.1, 10.9, 155, true)) : brazo(2.1, 10.9, 0, true);
    brazosAtras = izq + brazoEspada(pose);
  }
  const inclinacion = pose === "triste" ? `transform="rotate(8 8 7)"` : "";
  const antena = casco ? "" : `<line x1="8" y1="1.9" x2="8" y2="1.3" ${o(.5)}/>${chispa(8, .95, .85, .3, S.amarillo)}`;
  // En el aire no se dibuja la sombra del piso (la pone sparkyVivo abajo, en su lugar).
  return `${RAYAS}${conEspada || yelmo ? DEFS_CABALLERO : ""}
    ${vuelo ? "" : `<ellipse class="sk-sombra" cx="8" cy="19.35" rx="5.4" ry=".62" fill="${C.sombra}"/>`}
    ${taller ? tallerBloques() : ""}
    <g class="sk-cuerpo"><rect x="-5" y="-2" width="26" height="21.3" fill="none"/>
    <rect x="3.3" y="8.5" width="1.2" height="1.4" rx=".5" fill="${S.grisOscuro}" ${o(.4)}/><rect x="11.5" y="8.5" width="1.2" height="1.4" rx=".5" fill="${S.grisOscuro}" ${o(.4)}/>
    <rect x="3" y="9.4" width="10" height="6.8" rx="1.8" fill="${S.gris}" ${o(.5)}/>
    <rect x="3.3" y="14" width="9.4" height="1.9" rx="1" fill="${S.grisOscuro}"/>
    <rect x="12" y="10.2" width=".6" height="1.5" rx=".25" fill="${S.rojo}"/><rect x="11.8" y="10" width="1" height="1.9" rx=".4" fill="${S.rojo}" opacity=".35"/>
    ${conJetpack ? jetpack(vuelo) : ""}
    ${piernas}
    ${brazosAtras}
    <rect x="3.6" y="10.4" width="8.8" height="6" rx="2" fill="${S.luz}"/>
    <rect x="3.6" y="13.9" width="8.8" height="2.5" rx="1.5" fill="${S.sombra}"/><rect x="3.6" y="13.9" width="8.8" height="2.5" rx="1.5" fill="url(#sk-rayas)"/>
    <rect x="3.6" y="13.2" width="8.8" height=".9" fill="${S.naranja}" ${o(.3)}/><rect x="7.4" y="13.05" width="1.2" height="1.2" rx=".2" fill="${S.gris}" ${o(.3)}/>
    <line x1="4.7" y1="11.3" x2="4.7" y2="12.9" stroke="${S.costura}" stroke-width=".22"/><line x1="11.3" y1="11.3" x2="11.3" y2="12.9" stroke="${S.costura}" stroke-width=".22"/>
    <rect x="4.4" y="14.5" width="1.7" height="1.1" rx=".25" fill="none" stroke="${S.costura}" stroke-width=".25"/><line x1="4.4" y1="14.85" x2="6.1" y2="14.85" stroke="${S.costura}" stroke-width=".22"/>
    <rect x="3.6" y="10.4" width="8.8" height="6" rx="2" fill="none" ${o(.6)}/>
    <rect x="6.4" y="11.1" width="3.6" height="2" rx=".5" fill="${S.amarillo}" ${o(.4)}/>
    <circle cx="7.1" cy="11.8" r=".33" fill="${S.rojo}" ${o(.2)}/><circle cx="8" cy="11.8" r=".33" fill="${S.grisOscuro}" ${o(.2)}/><circle cx="8.9" cy="11.8" r=".33" fill="${S.led}" ${o(.2)}/>
    <rect x="6.9" y="12.3" width="2.6" height=".55" rx=".15" fill="${S.visor}"/><rect x="7.1" y="12.48" width="1.3" height=".2" fill="${S.led}"/>
    ${frente}
    <ellipse cx="3.9" cy="10.8" rx="1.55" ry="1" fill="${S.luz}" ${o(.45)}/><ellipse cx="12.1" cy="10.8" rx="1.55" ry="1" fill="${S.luz}" ${o(.45)}/>
    <line x1="2.9" y1="11.05" x2="4.9" y2="11.05" stroke="${S.costura}" stroke-width=".22"/><line x1="11.1" y1="11.05" x2="13.1" y2="11.05" stroke="${S.costura}" stroke-width=".22"/>
    <g ${inclinacion}>
      <rect x="5.3" y="9.8" width="5.4" height="1.1" rx=".5" fill="${S.gris}" ${o(.4)}/>
      ${antena}
      <rect x="2.7" y="5" width="1.4" height="2.7" rx=".6" fill="${S.gris}" ${o(.45)}/><rect x="11.9" y="5" width="1.4" height="2.7" rx=".6" fill="${S.gris}" ${o(.45)}/>
      <circle cx="3.4" cy="5.85" r=".3" fill="${S.naranja}"/><circle cx="12.6" cy="5.85" r=".3" fill="${S.naranja}"/>
      <line x1="3" y1="6.65" x2="3.8" y2="6.65" stroke="${S.grisOscuro}" stroke-width=".2"/><line x1="3" y1="7.05" x2="3.8" y2="7.05" stroke="${S.grisOscuro}" stroke-width=".2"/><line x1="12.2" y1="6.65" x2="13" y2="6.65" stroke="${S.grisOscuro}" stroke-width=".2"/><line x1="12.2" y1="7.05" x2="13" y2="7.05" stroke="${S.grisOscuro}" stroke-width=".2"/>
      ${yelmo ? penacho() : ""}
      <circle cx="8" cy="6.1" r="4.7" fill="${S.sombra}" ${o(.6)}/><circle cx="8" cy="6.1" r="4.7" fill="url(#sk-rayas)"/>
      <circle cx="7.7" cy="5.7" r="4.1" fill="${S.luz}"/>
      <rect x="4.7" y="3.4" width="6.6" height="5.3" rx="2.4" fill="${S.visor}" ${o(.45)}/><rect x="4.7" y="3.4" width="6.6" height="5.3" rx="2.4" fill="url(#sk-scan)"/>
      <path d="M5.3 5.2 q.1 -1.3 1.3 -1.5 h1.3 l-2.3 3.6 q-.5 -1 -.3 -2.1 z" fill="#fff" opacity=".12"/>
      <g class="sk-cara">${caraLed(pose)}</g>
      <rect x="4.4" y="2.75" width="7.2" height=".85" rx=".4" fill="${S.gris}" ${o(.35)}/>
      <ellipse cx="5.7" cy="4.35" rx=".65" ry=".34" fill="#fff" opacity=".5" transform="rotate(-25 5.7 4.35)"/>
      ${yelmo && !casco ? cresta() : ""}
      ${casco ? cascoObra() : ""}
    </g>
    ${encima}</g>
    ${extras}${taller ? chispasGolpe() : ""}`;
}
const POSES = ["decidido", "quieto", "saludo", "festejo", "triste", "pensando", "construyendo", "caminando", "escribiendo", "volando", "arreglando", "sorprendido", "riendo", "enamorado"];
const EN_EL_AIRE = ["volando", "arreglando"];
// "festejo+casco+taller" → pose festejo con casco de obra y los bloques del taller. "construyendo" ya trae los dos y
// las poses en el aire ya traen el jetpack encendido.
function leerPose(frame) {
  const [p, ...acc] = String(frame ?? "quieto").split("+");
  const pose = POSES.includes(p) ? p : "quieto", vuelo = EN_EL_AIRE.includes(pose);
  return { pose, vuelo, espada: acc.includes("espada"), yelmo: acc.includes("yelmo"), casco: pose === "construyendo" || acc.includes("casco"), taller: pose === "construyendo" || acc.includes("taller"), jetpack: vuelo || acc.includes("jetpack") };
}
// Marco del dibujo: 16 × 20 de siempre; con casco crece hacia arriba (la antena) y con taller hacia la derecha (bloques).
const marcoSparky = ({ casco, taller, espada, yelmo }) => { const y0 = espada || yelmo ? -2.6 : casco ? -1.4 : 0; const w = taller ? 21.8 : espada ? 19.6 : 16; return [0, y0, w, 20 - y0]; };
export const sparky = (frame = "quieto", escala = 4, extra = "") => {
  const f = leerPose(frame), [x, y, w, h] = marcoSparky(f);
  return `<svg class="vec sparky pose-${f.pose}" viewBox="${x} ${y} ${w} ${h}" width="${r2(w * escala)}" height="${r2(h * escala)}" xmlns="http://www.w3.org/2000/svg" ${extra}>${cuerpoSparky(f)}</svg>`;
};
export const capaSparky = (frame, dx, dy) => grupo(dx, dy, cuerpoSparky(leerPose(frame)));

// ---------- Coches (24 × 10): monoplazas de Fórmula 1 vistos de lado (dirección de arte 3.0, 7 nov 2026) ----------
// Trompa larga, alerón delantero y trasero, ruedas descubiertas, halo y casco del piloto. Pinturas de escudería
// realistas y genéricas (sin marcas); el color del bloque solo va de acento (franja, rines y casco).
// Los nombres de color se conservan (rojo, azul, amarillo, verde, morado) para no romper a quien los usa.
const COLORES_COCHE = { rojo: [C.rojo, C.rojoOscuro], azul: [C.azul, C.azulOscuro], amarillo: [C.amarillo, C.amarilloOscuro], verde: [C.verde, C.verdeOscuro], morado: [C.morado, C.moradoOscuro] };
export const COLORES_DE_COCHE = Object.keys(COLORES_COCHE);
// Pintura de cada coche: claro, base, oscuro (volumen), segundo color de la escudería y acento (color de bloque).
const LIBREAS = {
  rojo: { claro: "#E2453E", base: "#B0161E", oscuro: "#5E080D", segundo: "#F4F4F2", acento: C.rojo },
  azul: { claro: "#3A5799", base: "#15244F", oscuro: "#080F24", segundo: "#D7DCE5", acento: C.azul },
  amarillo: { claro: "#4A4C55", base: "#1B1C20", oscuro: "#08090B", segundo: "#D9A520", acento: C.amarillo },
  verde: { claro: "#3B8A5C", base: "#0F4A2C", oscuro: "#05241A", segundo: "#ECE8DA", acento: C.verde },
  morado: { claro: "#F4F6F9", base: "#B9BFC9", oscuro: "#5F6672", segundo: "#1B1C20", acento: C.morado },
};
// Rueda descubierta: llanta de hule con volumen, costado con brillo, rin oscuro con aro de acento y tuerca.
const ruedaF1 = (cx, cy, r, acento, id) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${id}l)"/>
  <circle cx="${cx}" cy="${cy}" r="${r2(r * .86)}" fill="none" stroke="#5B6069" stroke-width=".16" opacity=".8"/>
  <circle cx="${cx}" cy="${cy}" r="${r2(r * .55)}" fill="url(#${id}r)"/>
  <circle cx="${cx}" cy="${cy}" r="${r2(r * .5)}" fill="none" stroke="${acento}" stroke-width=".22"/>
  <circle cx="${cx}" cy="${cy}" r="${r2(r * .16)}" fill="#C9CED8"/>
  <path d="M${r2(cx - r * .7)} ${r2(cy - r * .45)} A${r} ${r} 0 0 1 ${r2(cx + r * .2)} ${r2(cy - r * .82)}" fill="none" stroke="#fff" stroke-width=".28" stroke-linecap="round" opacity=".28"/>`;
function cuerpoCoche(color) {
  const L = LIBREAS[color] ?? LIBREAS.rojo, id = "f1" + (LIBREAS[color] ? color : "rojo");
  return `<defs>
    <linearGradient id="${id}c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${L.claro}"/><stop offset=".45" stop-color="${L.base}"/><stop offset="1" stop-color="${L.oscuro}"/></linearGradient>
    <linearGradient id="${id}k" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4A4E57"/><stop offset="1" stop-color="#121317"/></linearGradient>
    <radialGradient id="${id}l" cx=".42" cy=".38" r=".62"><stop offset="0" stop-color="#3F434B"/><stop offset=".7" stop-color="#1A1B1F"/><stop offset="1" stop-color="#0B0B0D"/></radialGradient>
    <radialGradient id="${id}r" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#5C616B"/><stop offset="1" stop-color="#1E2026"/></radialGradient>
    <linearGradient id="${id}h" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".5" stop-color="${L.acento}"/><stop offset="1" stop-color="${L.oscuro}"/></linearGradient>
    <radialGradient id="${id}s" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#000" stop-opacity=".38"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
  </defs>
  <ellipse cx="12" cy="9.75" rx="12" ry=".85" fill="url(#${id}s)"/>
  <path d="M.6 1.3 L2.9 1.3 L3.2 6.2 L1.1 6.2 Z" fill="url(#${id}c)"/>
  <path d="M.95 2.4 L1.25 5.9" stroke="${L.acento}" stroke-width=".35"/>
  <rect x="0" y=".85" width="3.6" height=".95" rx=".3" fill="url(#${id}k)"/><rect x=".2" y="1.85" width="3" height=".45" rx=".2" fill="#1A1B1F"/>
  <rect x=".15" y=".9" width="3.3" height=".2" rx=".1" fill="#fff" opacity=".35"/>
  <rect x="2.35" y="5.95" width=".55" height=".5" rx=".1" fill="#FF3B30"/>
  <path d="M2.6 7.35 L2.6 5.5 Q5 4.7 7.5 3.75 L9.4 2.8 Q10 2.35 10.55 2.8 L11 4.3 L13.7 4.3 Q15.7 4.55 17.6 5.35 L23.5 6.3 Q24 6.65 23.55 7 L17.6 7.3 L3.2 7.5 Z" fill="url(#${id}c)"/>
  <path d="M4 6.15 Q9 5.1 13.6 5.35 Q17.6 5.6 23.3 6.55 L23.35 6.85 Q17.6 6.2 13.6 6.05 Q9 5.9 4.1 6.75 Z" fill="${L.segundo}" opacity=".95"/>
  <path d="M5 6.9 Q11 6.35 17.5 6.65" fill="none" stroke="${L.acento}" stroke-width=".28" stroke-linecap="round"/>
  <path d="M3.6 5.25 Q6 4.5 8.4 3.45 L9.7 2.75" fill="none" stroke="#fff" stroke-width=".3" stroke-linecap="round" opacity=".55"/>
  <path d="M14.2 4.6 Q17 5 23.1 6.25" fill="none" stroke="#fff" stroke-width=".22" stroke-linecap="round" opacity=".5"/>
  <path d="M9.2 3.3 L10.1 3.3 L10.3 4.1 L9.2 4.1 Z" fill="#0E0F12"/>
  <path d="M6.3 5.6 Q7.4 5.25 8.4 5.35 L8.3 6.05 Q7.3 5.95 6.4 6.2 Z" fill="#0E0F12" opacity=".75"/>
  <rect x="3" y="7.3" width="18.8" height=".55" rx=".2" fill="#141518"/>
  <circle cx="11.85" cy="3.55" r="1.08" fill="url(#${id}h)"/>
  <path d="M12.25 3.05 Q12.95 3.15 12.95 3.75 L12.2 3.85 Z" fill="#101114"/><path d="M12.4 3.2 L12.75 3.25" stroke="#7DD3FC" stroke-width=".14" opacity=".8"/>
  <ellipse cx="11.5" cy="3.05" rx=".42" ry=".22" fill="#fff" opacity=".7"/>
  <path d="M10.85 4.3 Q11.4 2.55 13.25 2.85 Q14.05 3.05 14.25 4.3" fill="none" stroke="#1A1B1F" stroke-width=".42" stroke-linecap="round"/>
  <path d="M11.1 3.85 Q11.6 2.85 13 3.05" fill="none" stroke="#6B717C" stroke-width=".12" stroke-linecap="round"/>
  ${ruedaF1(4.6, 7.55, 2.25, L.acento, id)}
  ${ruedaF1(19.35, 7.85, 1.95, L.acento, id)}
  <path d="M20.6 8.75 L23.9 8.55 L24 9.15 L20.7 9.3 Z" fill="url(#${id}k)"/>
  <path d="M21.4 8.05 L22.9 7.85 L23 8.6 L21.5 8.75 Z" fill="#1A1B1F"/>
  <path d="M23.15 7.55 L24 7.5 L24.05 9.3 L23.2 9.3 Z" fill="url(#${id}c)"/><path d="M23.4 7.8 L23.45 9" stroke="${L.acento}" stroke-width=".22"/>`;
}
export const coche = (color = "rojo", escala = 3, flip = false) => envoltura(24, 10, escala, "coche", flip ? `<g transform="translate(24 0) scale(-1 1)">${cuerpoCoche(color)}</g>` : cuerpoCoche(color));
export const capaCoche = (color, dx, dy) => grupo(dx, dy, cuerpoCoche(color));

// Otros corredores para la misma carrera (24 × 10): nave, caballo y dragón. Mismos cinco colores.
function cuerpoNave(color) {
  const [c1, c2] = COLORES_COCHE[color] ?? COLORES_COCHE.rojo;
  return `
    <ellipse cx="12" cy="9.4" rx="9" ry=".6" fill="${C.sombra}"/>
    <path d="M3 5.2 L0 7.2 L0 3.2 Z" fill="#FFB347"/><path d="M3 5.2 L1.2 6.3 L1.2 4.1 Z" fill="#FFE066"/>
    <path d="M6.5 2.6 L4.2 .6 L9.4 2.6 Z" fill="${c2}" ${o(.4)}/>
    <path d="M6.5 7.8 L4.2 9.8 L9.4 7.8 Z" fill="${c2}" ${o(.4)}/>
    <path d="M2.4 5.2 Q3 2.4 7 2.4 L17.5 2.4 Q23.4 2.9 23.4 5.2 Q23.4 7.5 17.5 8 L7 8 Q3 8 2.4 5.2 Z" fill="${c1}" ${o(.5)}/>
    <path d="M4.2 4.4 Q5 3.1 7.4 3.1 L17 3.1 Q20.6 3.3 22 4.6 L4.6 4.6 Z" fill="#fff" opacity=".35"/>
    <path d="M9.8 2.6 Q11.6 .4 14.6 .7 Q16.6 1 17.3 2.6 Z" fill="#BFE3FF" ${o(.4)}/>
    <circle cx="13" cy="1.9" r=".5" fill="#fff" opacity=".9"/>
    <rect x="2.2" y="4" width="2.2" height="2.6" rx=".8" fill="${C.linea}"/>
    <circle cx="20.6" cy="5.2" r=".9" fill="#FFD400" ${o(.3)}/>
    <rect x="9" y="6" width="7" height="1" rx=".5" fill="${c2}" opacity=".6"/>`;
}
// Caballos de carreras (24 × 10) con pelajes reales: alazán, negro, bayo, tordo y blanco (nunca morado, rojo ni azul).
// Proporciones de caballo de verdad (patas tan largas como el cuerpo es alto, cuello largo, cabeza alargada) al galope.
// El color del bloque solo va en la mantilla y en la chaquetilla del jinete, como en un hipódromo real.
const PELAJES = {
  rojo: { claro: "#D08447", base: "#9A4E22", oscuro: "#552710", crin: "#6E3215", patas: "#7A3A18", hocico: "#4A2A1A" }, // alazán
  azul: { claro: "#5E5650", base: "#2B2622", oscuro: "#0F0D0C", crin: "#0B0A09", patas: "#1A1715", hocico: "#3A3330" }, // negro
  amarillo: { claro: "#EBCB92", base: "#C9A063", oscuro: "#86612F", crin: "#241F1C", patas: "#2B2622", hocico: "#3A2E26" }, // bayo
  verde: { claro: "#DCE0E3", base: "#9EA3A8", oscuro: "#5A5F64", crin: "#45494D", patas: "#5E6368", hocico: "#45494D", motas: true }, // tordo (gris)
  morado: { claro: "#FFFFFF", base: "#ECE7DD", oscuro: "#ADA595", crin: "#DED6C8", patas: "#D3CBBC", hocico: "#B9A39A" }, // blanco
};
export const PELAJES_CABALLO = { rojo: "alazan", azul: "negro", amarillo: "bayo", verde: "tordo", morado: "blanco" };
// Pata en dos tramos (muslo grueso y caña delgada) con casco oscuro al final.
const pata = (p, color, grueso = 1.05, arriba = color) => `<path d="M${p[0]} ${p[1]} L${p[2]} ${p[3]}" stroke="${arriba}" stroke-width="${grueso}" stroke-linecap="round"/><path d="M${p[2]} ${p[3]} L${p[4]} ${p[5]} L${p[6]} ${p[7]}" fill="none" stroke="${color}" stroke-width=".5" stroke-linecap="round" stroke-linejoin="round"/><ellipse cx="${p[6]}" cy="${p[7]}" rx=".36" ry=".24" fill="#1A1614"/>`;
function cuerpoCaballo(color) {
  const P = PELAJES[color] ?? PELAJES.rojo, k = PELAJES[color] ? color : "rojo", id = "cb" + k;
  const acento = (COLORES_COCHE[k] ?? COLORES_COCHE.rojo)[0], acentoOsc = (COLORES_COCHE[k] ?? COLORES_COCHE.rojo)[1];
  return `<defs>
    <linearGradient id="${id}c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.claro}"/><stop offset=".5" stop-color="${P.base}"/><stop offset="1" stop-color="${P.oscuro}"/></linearGradient>
    <radialGradient id="${id}b" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff" stop-opacity=".45"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    <radialGradient id="${id}s" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#000" stop-opacity=".35"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
  </defs>
  <ellipse cx="11.5" cy="9.7" rx="9" ry=".7" fill="url(#${id}s)"/>
  ${pata([13.3, 6.3, 12.9, 7.7, 13.3, 8.6, 14.1, 9.2], P.oscuro)}
  ${pata([9.7, 6.2, 10.4, 7.6, 10.2, 8.8, 11, 9.45], P.oscuro)}
  <path d="M7.4 4 C5.6 3.5 3.9 4.3 2.5 5.9 C3.4 5.6 4.1 5.6 4.6 5.8 C3.9 6.2 3.4 6.8 3.1 7.5 C4.6 6.4 6 5.6 7.2 5.2 Z" fill="${P.crin}"/>
  <path d="M7.1 4.4 C5.6 4.3 4.4 4.9 3.4 5.8" fill="none" stroke="#fff" stroke-width=".14" opacity=".25"/>
  <path d="M7.2 4.6 C7.4 3.2 9.4 3 10.6 3.4 C11.8 3.6 13.4 3.2 14.6 3.9 C15.7 4.6 15.7 6.4 14.4 6.9 C12.8 7.4 9.6 7.4 8.4 7 C7.1 6.6 6.9 5.4 7.2 4.6 Z" fill="url(#${id}c)"/>
  <path d="M13.6 4.1 C14.6 2.8 16 1.6 17.4 1 L18.6 1.9 C17.6 3 16.6 4.4 15.6 5.6 Z" fill="url(#${id}c)"/>
  <path d="M17.2 1 C18 .3 19 .5 19.8 1.3 L21.6 2.7 C21.9 3.1 21.6 3.6 21.1 3.6 L19.9 3.5 C19 3.3 18.2 2.6 17.6 2.1 Z" fill="url(#${id}c)"/>
  <path d="M20.6 2.6 L21.6 2.7 C21.9 3.1 21.6 3.6 21.1 3.6 L20.4 3.55 Z" fill="${P.hocico}" opacity=".85"/>
  <path d="M17.5 .75 L17.35 -.35 L18.1 .55 Z" fill="${P.base}"/><path d="M17.95 .7 L18 -.25 L18.5 .75 Z" fill="${P.oscuro}"/>
  <path d="M17.4 .8 C16.2 1.4 15.2 2.4 14.2 3.6 L13.5 4.2 C14.2 3 15 1.6 16.6 .7 Z" fill="${P.crin}"/>
  <circle cx="18.65" cy="1.35" r=".26" fill="#120E0C"/><circle cx="18.58" cy="1.28" r=".08" fill="#fff"/>
  <ellipse cx="21.15" cy="3.05" rx=".16" ry=".11" fill="#120E0C"/>
  <path d="M18.4 1.05 L20.9 3.05 M18.3 2.25 L19.9 2.2" stroke="#2A1C14" stroke-width=".13" fill="none"/>
  ${P.motas ? [[9.6, 4.6], [11.2, 5.4], [12.6, 4.4], [10.2, 6.1], [13.4, 5.9], [8.4, 5.3]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r=".42" fill="#fff" opacity=".28"/>`).join("") : ""}
  <ellipse cx="8.7" cy="4.5" rx="1.6" ry="1" fill="url(#${id}b)"/><ellipse cx="14" cy="4.6" rx="1.3" ry=".9" fill="url(#${id}b)"/><ellipse cx="18.6" cy=".9" rx="1" ry=".35" fill="url(#${id}b)"/>
  <path d="M10.3 3.35 L12.9 3.3 L13.1 5.2 L10.4 5.3 Z" fill="${acento}"/><path d="M10.4 5.1 L13.1 5" stroke="#fff" stroke-width=".22"/><path d="M10.3 3.35 L12.9 3.3 L13 4" fill="none" stroke="${acentoOsc}" stroke-width=".18" opacity=".6"/>
  <path d="M10.8 3.25 Q11.9 2.85 12.8 3.25 L12.6 3.6 L10.9 3.6 Z" fill="#3B2416"/>
  ${pata([14, 6, 15.5, 7.4, 17, 7.9, 17.6, 8.5], P.patas, 1.15, P.base)}
  ${pata([8.5, 5.6, 8.6, 7.2, 7.2, 8.1, 5.9, 9.4], P.patas, 1.5, P.base)}
  <path d="M11.4 3.1 Q11.7 1.9 13 1.7 L14.2 1.9 Q14 2.7 13 3 Q12.2 3.2 11.4 3.1 Z" fill="${acento}"/>
  <path d="M11.9 2.2 Q12.9 1.9 13.9 2.1" stroke="#fff" stroke-width=".16" opacity=".5"/>
  <path d="M11.5 3 L11.9 4 L12.6 4.1" fill="none" stroke="#F4F1EA" stroke-width=".5" stroke-linecap="round"/>
  <path d="M12.6 4.1 L12.9 4.5" stroke="#111" stroke-width=".42" stroke-linecap="round"/>
  <path d="M13.6 2.2 L15.4 2.6 L16.3 2.4" fill="none" stroke="${acentoOsc}" stroke-width=".32" stroke-linecap="round"/>
  <path d="M16.3 2.4 L20.9 3.05" stroke="#2A1C14" stroke-width=".1"/>
  <circle cx="14.55" cy="1.35" r=".62" fill="${acento}"/><path d="M14 1.2 Q14.5 .55 15.15 1.1 L15.25 1.45 Z" fill="#fff" opacity=".9"/><ellipse cx="14.35" cy="1" rx=".2" ry=".1" fill="#fff" opacity=".8"/>`;
}

// Dragones de la carrera (24 × 10), volando hacia la derecha. Colores creíbles: verde bosque, gris pizarra, arena,
// musgo y carbón (nunca morado, rojo ni azul). El color del bloque solo va en el arnés.
const ESCAMAS = {
  rojo: { claro: "#7FAE5A", base: "#3F6B34", oscuro: "#1E3619", vientre: "#E3D3A0" }, // verde bosque
  azul: { claro: "#A3AAB0", base: "#5E666E", oscuro: "#2C3136", vientre: "#D6CFBE" }, // gris pizarra
  amarillo: { claro: "#D7B47A", base: "#A9864E", oscuro: "#5E4526", vientre: "#F0DFB4" }, // arena
  verde: { claro: "#A2B566", base: "#6B7F3A", oscuro: "#36421C", vientre: "#E2D9A8" }, // musgo
  morado: { claro: "#6A6560", base: "#3A3633", oscuro: "#161413", vientre: "#A79C8C" }, // carbón
};
export const ESCAMAS_DRAGON = { rojo: "bosque", azul: "pizarra", amarillo: "arena", verde: "musgo", morado: "carbon" };
function cuerpoDragon(color) {
  const E = ESCAMAS[color] ?? ESCAMAS.rojo, k = ESCAMAS[color] ? color : "rojo", id = "dg" + k;
  const acento = (COLORES_COCHE[k] ?? COLORES_COCHE.rojo)[0];
  return `<defs>
    <linearGradient id="${id}c" x1="0" y1="0" x2=".3" y2="1"><stop offset="0" stop-color="${E.claro}"/><stop offset=".55" stop-color="${E.base}"/><stop offset="1" stop-color="${E.oscuro}"/></linearGradient>
    <linearGradient id="${id}a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${E.base}"/><stop offset="1" stop-color="${E.oscuro}"/></linearGradient>
    <radialGradient id="${id}s" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#000" stop-opacity=".3"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
  </defs>
  <ellipse cx="12" cy="9.6" rx="8.5" ry=".6" fill="url(#${id}s)"/>
  <path d="M10.6 4.3 Q8.6 .2 4.4 -.2 Q6.2 1.2 6.6 2.4 Q8.4 2.6 10 4.8 Z" fill="url(#${id}a)" opacity=".85"/>
  <path d="M7.2 5.4 Q3.6 4.6 .4 6.6 Q2.6 6.3 3.8 7.1 Q5.4 6.3 7.3 6.7 Z" fill="url(#${id}c)"/>
  <path d="M.4 6.6 L-.4 5.7 L1 6.1 Z M.4 6.6 L-.2 7.6 L1.1 7 Z" fill="${E.oscuro}"/>
  <path d="M6.4 5.6 C7 4 10 3.6 12.6 3.9 C15 4.1 17.2 4.4 17.6 5.6 C17.8 6.9 15.2 7.6 12.4 7.6 C9.2 7.6 6.2 7.1 6.4 5.6 Z" fill="url(#${id}c)"/>
  <path d="M8 6.9 C10.4 7.5 14.4 7.5 16.6 6.6 C15.2 7.3 10.8 7.7 8 6.9 Z" fill="${E.vientre}" opacity=".9"/>
  <path d="M9.2 7.2 L9 8.9 L10 9 L10.4 7.4 Z M13.2 7.4 L13.4 9 L14.4 8.9 L14.2 7.3 Z" fill="${E.oscuro}"/>
  <path d="M16.8 4.9 C17.6 3.8 18.8 2.8 20.2 2.5 L22.6 2.6 C23.6 2.8 24 3.5 23.6 4.1 L21.6 4.6 C20.4 4.8 19 5.4 17.8 6 Z" fill="url(#${id}c)"/>
  <path d="M21.4 4.2 L23.6 4.1 L23.2 4.6 L21.4 4.7 Z" fill="${E.oscuro}"/>
  <path d="M20 2.6 L19.2 1 L20.6 2.3 Z M21 2.5 L21 .8 L21.8 2.5 Z" fill="#E8DCC2"/>
  <ellipse cx="21.5" cy="3.25" rx=".42" ry=".3" fill="#FFC94A"/><ellipse cx="21.55" cy="3.25" rx=".1" ry=".26" fill="#1A1410"/>
  <path d="M8.6 4.2 L9.2 3.3 L9.8 4 L10.6 3.2 L11.2 3.9 L12.2 3.2 L12.6 3.9" fill="${E.oscuro}"/>
  <path d="M15.6 5.1 L16.6 6.5" stroke="${acento}" stroke-width=".5" stroke-linecap="round"/><path d="M13.5 4.1 Q15.2 3.9 16.6 4.6" fill="none" stroke="${acento}" stroke-width=".35"/>
  <path d="M11.8 4.4 Q10.2 -.4 5.6 -.6 Q7.8 .8 8.4 2.4 Q10.4 2.6 12.8 4.6 Z" fill="url(#${id}a)"/>
  <path d="M11.8 4.4 L5.6 -.6 M10.6 3.6 L7.6 .6" stroke="${E.oscuro}" stroke-width=".22" fill="none"/>
  <ellipse cx="11" cy="4.8" rx="3" ry=".55" fill="#fff" opacity=".22"/><ellipse cx="21.2" cy="2.8" rx="1" ry=".25" fill="#fff" opacity=".3"/>`;
}
const CUERPOS = { coche: cuerpoCoche, nave: cuerpoNave, caballo: cuerpoCaballo, dragon: cuerpoDragon };
export const vehiculo = (tipo = "coche", color = "rojo", escala = 3, flip = false) => { const f = CUERPOS[tipo] ?? cuerpoCoche; return envoltura(24, 10, escala, "vehiculo " + tipo, flip ? `<g transform="translate(24 0) scale(-1 1)">${f(color)}</g>` : f(color)); };
export const capaVehiculo = (tipo, color, dx, dy) => grupo(dx, dy, (CUERPOS[tipo] ?? cuerpoCoche)(color));

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
// El escalador de los juegos (montaña y puertas) es el mismo Sparky en chico: cabe en 12 × 16 con los pies en el piso.
function cuerpoEscalador() { return `<g transform="translate(0 .9) scale(.75)">${cuerpoSparky("quieto")}</g>`; }
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

// Pista de la carrera. Estilos: "ciudad" (neón, coches), "espacio" (naves), "hipodromo" (caballos), "cielo" (dragones).
// Devuelve el fondo y los ids de las capas que se mueven (lejos, cerca, rayas) para el parallax.
export function escenaCiudad(w = 172, h = 140, semilla = 7, tema = {}) {
  const estilo = tema.estilo ?? "ciudad";
  const ESTILOS = {
    ciudad: {},
    espacio: { cielo1: "#05030F", cielo2: "#1B1340", cielo3: "#2E1A6E", estrellas: true, sol: false, carretera: "#0B1026", linea: "#67E8F9", borde: "#7C4DFF", neon: "#2EE6FF" },
    hipodromo: { cielo1: "#38BDF8", cielo2: "#BAE6FD", cielo3: "#FDE68A", estrellas: false, sol: false, carretera: "#3E9B3A", carretera2: "#55B04E", linea: "#FFFFFF", borde: "#C98B4D", neon: "#FFFFFF" },
    cielo: { cielo1: "#1B1340", cielo2: "#7C3AED", cielo3: "#FF8A3D", estrellas: true, sol: true, carretera: "#E9EDF5", carretera2: "#DDE3F0", linea: "#FFFFFF", borde: "#C4B5FD", neon: "#FFB347" },
  };
  const T = { cielo1: "#1B1340", cielo2: "#4C1D95", cielo3: "#B8336A", estrellas: true, edif1: "#2A1659", edif2: "#3B1F7A", ventana: "#F0ABFC", ventana2: "#67E8F9", neon: "#FF6B9D", carretera: "#1E1B4B", carretera2: null, linea: "#F9A8D4", borde: "#FF6B9D", carriles: 4, sol: true, ...(ESTILOS[estilo] ?? {}), ...tema };
  const r = azar(semilla); const id = "c" + semilla;
  const suelo = Math.floor(h * 0.62);
  let s = `<defs>${degradado(id + "k", T.cielo1, T.cielo2, T.cielo3)}</defs><rect width="${w}" height="${h}" fill="url(#${id}k)"/>`;
  if (T.estrellas) s += estrellas(r, w, h * .5, estilo === "espacio" ? 90 : 50, "#E9D5FF");
  if (T.sol) s += solRetro(w - 40, 34, 18, id + "s");
  // Capas lejana y cercana (dos copias de ancho w para que se desplacen en bucle).
  const dosCopias = (idCapa, dibujar) => { let g = `<g id="${idCapa}">`; for (let copia = 0; copia < 2; copia++) g += dibujar(copia * w); return g + "</g>"; };
  const edificios = (fill, ventana, minW, maxW, minH, maxH, paso) => (x0) => {
    let g = ""; let x = x0;
    while (x < x0 + w) {
      const bw = minW + Math.floor(r() * (maxW - minW)), bh = minH + Math.floor(r() * (maxH - minH));
      g += `<rect x="${x}" y="${suelo - bh}" width="${bw}" height="${bh}" rx="1.2" fill="${fill}"/><rect x="${x}" y="${suelo - bh}" width="${bw}" height="1" rx=".5" fill="${T.neon}" opacity=".9"/>`;
      for (let yy = suelo - bh + 3; yy < suelo - 3; yy += paso) for (let xx = x + 1.5; xx < x + bw - 2; xx += paso) if (r() > .5) g += `<rect x="${xx.toFixed(1)}" y="${yy}" width="1.4" height="1.4" rx=".3" fill="${r() > .6 ? ventana : T.ventana2}" opacity=".9"/>`;
      x += bw + 1 + Math.floor(r() * 3);
    }
    return g;
  };
  if (estilo === "espacio") {
    s += dosCopias(id + "lejos", (x0) => { let g = ""; for (let k = 0; k < 3; k++) { const cx = x0 + 20 + k * 58 + r() * 20, cy = 18 + r() * 40, R = 5 + r() * 7; const col = ["#60A5FA", "#F472B6", "#FBBF24", "#A78BFA"][Math.floor(r() * 4)]; g += `<g transform="rotate(-18 ${cx} ${cy})"><ellipse cx="${cx}" cy="${cy}" rx="${R * 1.9}" ry="${R * .45}" fill="none" stroke="#C4B5FD" stroke-width="1.4" opacity=".8"/></g><circle cx="${cx}" cy="${cy}" r="${R}" fill="${col}" ${o(.5)}/><circle cx="${cx - R * .35}" cy="${cy - R * .35}" r="${R * .25}" fill="#fff" opacity=".55"/>`; } return g; });
    s += dosCopias(id + "cerca", (x0) => { let g = ""; for (let k = 0; k < 7; k++) { const cx = x0 + r() * w, cy = suelo - 6 - r() * 40, R = 2 + r() * 3.5; g += `<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${R.toFixed(1)}" ry="${(R * .75).toFixed(1)}" fill="#6B7280" ${o(.4)}/><circle cx="${(cx - R * .3).toFixed(1)}" cy="${(cy - R * .2).toFixed(1)}" r="${(R * .25).toFixed(1)}" fill="#4B5563"/>`; } return g; });
  } else if (estilo === "hipodromo") {
    s += dosCopias(id + "lejos", (x0) => { let g = ""; for (let k = 0; k < 2; k++) { const x = x0 + 10 + k * 90; g += `<rect x="${x}" y="${suelo - 30}" width="64" height="30" rx="2" fill="#E9EDF5" ${o(.5)}/><rect x="${x - 2}" y="${suelo - 34}" width="68" height="5" rx="1.5" fill="#E53935" ${o(.4)}/>`; for (let yy = suelo - 26; yy < suelo - 4; yy += 5) for (let xx = x + 3; xx < x + 62; xx += 4) g += `<rect x="${xx}" y="${yy}" width="2.4" height="2.4" rx=".6" fill="${["#2F6DF6", "#FFD400", "#FF6B9D", "#27C4B4"][Math.floor(r() * 4)]}"/>`; } for (let k = 0; k < 4; k++) { const x = x0 + r() * w, R = 6 + r() * 5; g += `<rect x="${(x - 1.2).toFixed(1)}" y="${suelo - 10}" width="2.4" height="10" fill="#8B5A2B"/><circle cx="${x.toFixed(1)}" cy="${suelo - 12}" r="${R.toFixed(1)}" fill="#2BB673" ${o(.45)}/><circle cx="${(x - R * .3).toFixed(1)}" cy="${(suelo - 14 - R * .2).toFixed(1)}" r="${(R * .35).toFixed(1)}" fill="#7CCF4F" opacity=".8"/>`; } return g; });
    s += dosCopias(id + "cerca", (x0) => { let g = `<rect x="${x0}" y="${suelo - 7}" width="${w}" height="1.4" fill="#fff" ${o(.3)}/><rect x="${x0}" y="${suelo - 3.5}" width="${w}" height="1.4" fill="#fff" ${o(.3)}/>`; for (let xx = x0; xx < x0 + w; xx += 12) g += `<rect x="${xx}" y="${suelo - 9}" width="1.8" height="9" rx=".6" fill="#fff" ${o(.3)}/>`; return g; });
  } else if (estilo === "cielo") {
    s += dosCopias(id + "lejos", (x0) => `<polygon points="${x0},${suelo} ${x0 + 24},${suelo - 26} ${x0 + 50},${suelo - 10} ${x0 + 86},${suelo - 34} ${x0 + 110},${suelo - 16} ${x0 + 140},${suelo - 30} ${x0 + 172},${suelo - 8} ${x0 + 172},${suelo}" fill="#2E1A6E"/><polygon points="${x0 + 78},${suelo - 34} ${x0 + 86},${suelo - 40} ${x0 + 94},${suelo - 34}" fill="#FF8A3D"/><circle cx="${x0 + 86}" cy="${suelo - 40}" r="2.2" fill="#FFE066" opacity=".9"/>`);
    s += dosCopias(id + "cerca", (x0) => { let g = ""; for (let k = 0; k < 5; k++) { const cx = x0 + r() * w, cy = 30 + r() * 34; g += `<g opacity=".92"><ellipse cx="${cx.toFixed(1)}" cy="${cy}" rx="10" ry="3.4" fill="#fff"/><ellipse cx="${(cx - 4).toFixed(1)}" cy="${cy - 2.2}" rx="5.5" ry="3.6" fill="#fff"/><ellipse cx="${(cx + 4.5).toFixed(1)}" cy="${cy - 1.6}" rx="6" ry="3.4" fill="#fff"/></g>`; } return g; });
  } else {
    s += dosCopias(id + "lejos", edificios(T.edif1, T.ventana, 7, 16, 20, 52, 3.4));
    s += dosCopias(id + "cerca", edificios(T.edif2, T.ventana, 12, 26, 8, 26, 3.8));
  }
  // pista con carriles
  const carriles = T.carriles, alturaCarril = Math.floor((h - suelo - 6) / carriles);
  s += `<rect x="0" y="${suelo}" width="${w}" height="${h - suelo}" fill="${T.carretera}"/>`;
  if (T.carretera2) for (let c = 0; c < carriles; c++) if (c % 2) s += `<rect x="0" y="${suelo + 4 + c * alturaCarril}" width="${w}" height="${alturaCarril}" fill="${T.carretera2}"/>`;
  s += `<rect x="0" y="${suelo}" width="${w}" height="1.6" fill="${T.neon}"/>`;
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

// ---------- Duelo (7 nov 2026): dragón grande y arena, con acabado tipo render 3D ----------
// Sin contorno grueso: el volumen sale de degradados con una sola luz (arriba a la izquierda), brillos suaves y una
// sombra difusa en el piso. Colores reales de dragón: verde, café/tierra o gris (nunca morado, rojo ni azul).
export const PALETAS_DRAGON = {
  verde: { claro: "#9CC46A", base: "#4F7F3A", oscuro: "#1F3A1A", vientre1: "#F0E1AE", vientre2: "#B4955A", ala1: "#79A055", ala2: "#2C4724", hueso: "#2A3B20", espina: "#D8C9A4" },
  tierra: { claro: "#C99A63", base: "#7A5534", oscuro: "#33220F", vientre1: "#F1DFB6", vientre2: "#B89662", ala1: "#A57B4D", ala2: "#4A321E", hueso: "#3A2716", espina: "#E4D3AE" },
  gris: { claro: "#B7BDC0", base: "#6A7176", oscuro: "#2A2E31", vientre1: "#E2DBCA", vientre2: "#A39A86", ala1: "#8C9397", ala2: "#3A4044", hueso: "#2E3236", espina: "#DCD3BF" },
};
// Dragón de pie mirando a la izquierda, en un cuadro de 84 × 70 con las patas en y = 68. Las piezas que se mueven van en
// grupos con clase (dr-cola, dr-ala, dr-ala-lejos, dr-cabeza, dr-fuego) para animarlas con CSS (duelo.css).
function cuerpoDragonDuelo(paleta = "verde") {
  const P = PALETAS_DRAGON[paleta] ?? PALETAS_DRAGON.verde, id = "drd" + (PALETAS_DRAGON[paleta] ? paleta : "verde");
  const espinas = [[31, 10.5], [35, 15], [39, 19.5], [43.5, 24], [49, 27.5], [55, 29.5], [60, 33.5], [63, 39]].map(([x, y], i) => `<path d="M${x - 1.6} ${y + 1.2} L${x + 1.2 - i * .1} ${y - 2.6 + i * .1} L${x + 1.8} ${y + 1.5} Z" fill="url(#${id}e)"/>`).join("");
  const dientes = [9, 11, 13, 15].map((x) => `<path d="M${x} 17.9 L${x + .6} 19.3 L${x + 1.2} 17.95 Z" fill="#FBF6E8"/>`).join("");
  const garras = (pts) => pts.map(([x, y, a]) => `<path d="M${x} ${y} q${a} 1.2 ${a * 1.8} .2 l-.2 -.9 z" fill="#EFE6CF"/>`).join("");
  return `<defs>
    <linearGradient id="${id}c" x1="0" y1="0" x2=".55" y2="1"><stop offset="0" stop-color="${P.claro}"/><stop offset=".5" stop-color="${P.base}"/><stop offset="1" stop-color="${P.oscuro}"/></linearGradient>
    <linearGradient id="${id}o" x1="0" y1="0" x2=".4" y2="1"><stop offset="0" stop-color="${P.base}"/><stop offset="1" stop-color="${P.oscuro}"/></linearGradient>
    <linearGradient id="${id}v" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${P.vientre1}"/><stop offset="1" stop-color="${P.vientre2}"/></linearGradient>
    <linearGradient id="${id}a" x1="0" y1="0" x2=".3" y2="1"><stop offset="0" stop-color="${P.ala1}"/><stop offset="1" stop-color="${P.ala2}"/></linearGradient>
    <linearGradient id="${id}e" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFF8E6"/><stop offset="1" stop-color="${P.espina}"/></linearGradient>
    <linearGradient id="${id}h" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#B9A684"/><stop offset=".6" stop-color="#EDE2C8"/><stop offset="1" stop-color="#FFFBF0"/></linearGradient>
    <radialGradient id="${id}j" cx=".4" cy=".4" r=".6"><stop offset="0" stop-color="#FFF2B0"/><stop offset=".55" stop-color="#FFB627"/><stop offset="1" stop-color="#B35F00"/></radialGradient>
    <radialGradient id="${id}b" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff" stop-opacity=".5"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    <radialGradient id="${id}s" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#000" stop-opacity=".42"/><stop offset=".6" stop-color="#000" stop-opacity=".18"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
    <linearGradient id="${id}f" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#FFFBE0"/><stop offset=".18" stop-color="#FFD54A"/><stop offset=".55" stop-color="#FF8A1F" stop-opacity=".9"/><stop offset="1" stop-color="#E2531A" stop-opacity="0"/></linearGradient>
  </defs>
  <ellipse cx="48" cy="68" rx="34" ry="4.2" fill="url(#${id}s)"/>
  <g class="dr-cuerpo">
  <g class="dr-cola"><path d="M57 46 C66 47 71 55 78 56.5 C80.5 57 82 55.5 83 53 L85.5 58.5 L81 60.5 C73 63 64 58.5 56 56.5 Z" fill="url(#${id}o)"/><path d="M83 53 L87 50.5 L85.5 58.5 Z" fill="${P.oscuro}"/><path d="M60 49 C66 50.5 71 56 77 57.5" fill="none" stroke="#fff" stroke-width=".7" stroke-linecap="round" opacity=".18"/></g>
  <g class="dr-ala-lejos"><path d="M47 29 L57 6 L60 13 L67 8 L68 18 L75 17 L67 33 Z" fill="${P.ala2}" opacity=".95"/><path d="M47 29 L57 6 M57 6 L67 8 M57 6 L75 17" stroke="${P.hueso}" stroke-width="1" stroke-linecap="round" fill="none" opacity=".8"/></g>
  <path d="M58 53 C60 59 59 63 57 67 L63.5 67.5 C64 63 64.5 57 62.5 51 Z" fill="${P.oscuro}"/>${garras([[57.5, 66.6, -1], [60, 66.8, -1], [62.5, 66.8, -1]])}
  <path d="M37 44 C33 48 31 50 28.5 50.3 L28 53 C32 53 36 51 40 48 Z" fill="${P.oscuro}"/>
  <path d="M34 36 C36 28 46 26 54 30 C62 34 64.5 46 60.5 54 C56.5 60.5 44 62 38 56 C34 52 32 44 34 36 Z" fill="url(#${id}c)"/>
  <path d="M22 22 C28 26 33 32 35 40 C36 48 40 56 46 60 C42 60.5 38 58.5 35 54.5 C31 48.5 30 40.5 27 33.5 C25 29.5 22 26.5 19 25 Z" fill="url(#${id}v)"/>
  ${[[24.5, 26], [28, 30.5], [30.5, 36], [32, 42], [34, 48], [37.5, 53.5]].map(([x, y]) => `<path d="M${x - 3} ${y + 1} Q${x} ${y - .2} ${x + 2.6} ${y - 1.4}" fill="none" stroke="${P.vientre2}" stroke-width=".55" opacity=".7"/>`).join("")}
  <path d="M46 29 C42 22 36 14 30 9 L24 15.5 C28 20 32 28 35 36 Z" fill="url(#${id}c)"/>
  ${espinas}
  <g class="dr-cabeza">
    <path d="M27 8 C30.5 3 35.5 1 40 -1.2 C37 3 33 6.5 29.8 10.5 Z" fill="url(#${id}h)"/>
    <path d="M24.2 7.4 C26 3.6 28 1.6 31 .4 C29.4 3.2 27.6 5.4 26.3 8.4 Z" fill="url(#${id}h)" opacity=".92"/>
    <path d="M17 18.2 L7 18.6 C5.8 19.6 6.8 21.2 9 21.3 L18 21.7 C22 21.7 25 20.2 26 18.2 Z" fill="url(#${id}o)"/>
    ${dientes}
    <path d="M30.5 8 C27 4.8 21 5 17 8 L8 12 C5 13 4 16 6 17.5 L16.5 18.3 C19.5 19 24 19 28 17 C31 15 32.5 11 30.5 8 Z" fill="url(#${id}c)"/>
    <path d="M27.5 17.2 L33 19.5 L28.8 14.6 Z M29.6 13.6 L34.6 14.4 L30.6 11 Z" fill="${P.oscuro}"/>
    <path d="M15.5 10.2 C18 8.6 21.5 8.6 23.8 10" fill="none" stroke="${P.oscuro}" stroke-width="1.1" stroke-linecap="round"/>
    <path d="M17 12 C18.4 10.6 20.8 10.5 22.4 11.6 C21 13 18.6 13.3 17 12 Z" fill="url(#${id}j)"/>
    <ellipse cx="19.8" cy="11.9" rx=".55" ry="1.15" fill="#1A1208"/><circle cx="18.7" cy="11.4" r=".45" fill="#fff" opacity=".9"/>
    <ellipse cx="7.6" cy="13.8" rx="1" ry=".6" fill="${P.oscuro}" transform="rotate(-20 7.6 13.8)"/>
    <ellipse cx="20" cy="7.6" rx="6" ry="1.5" fill="url(#${id}b)"/><ellipse cx="11" cy="11.6" rx="3.4" ry=".9" fill="url(#${id}b)" opacity=".8"/>
  </g>
  <ellipse cx="45" cy="33.5" rx="7" ry="3.4" fill="url(#${id}b)"/>
  <path d="M51 46 C52 40 58 39 62 43.5 C65 48 63.5 55 58.5 57.5 C55.5 59 52 57 51 54 Z" fill="url(#${id}c)"/>
  <path d="M52.5 55 C50.5 61 50.5 63.5 48.5 67 L56.5 67.5 C56.5 64 58 60.5 59 55.5 Z" fill="url(#${id}o)"/>${garras([[48.5, 66.8, -1.1], [51.3, 67, -1.1], [54.1, 67.1, -1.1]])}
  <ellipse cx="56" cy="45.6" rx="3.6" ry="2.4" fill="url(#${id}b)"/>
  <path d="M40.5 42 C36.5 46 32.5 49 27.5 48 C25.5 47.6 24.5 49.6 26 50.6 C30.5 52 36.5 52 42.5 48 Z" fill="url(#${id}c)"/>${garras([[25.6, 47.4, -1], [25, 49.4, -1], [25.6, 51.2, -.9]])}
  <g class="dr-ala"><path d="M46 31 L53 7 L49 -1.5 C56 3 60 4 64.5 1.5 C66 8 70 10 76.5 10.5 C76.5 17 78.5 21 81.5 25 C74 25 66 28 60 34.5 Z" fill="url(#${id}a)"/>
    <path d="M53 7 L49 -1.5 M53 7 L64.5 1.5 M53 7 L76.5 10.5 M53 7 L81.5 25" stroke="${P.hueso}" stroke-width=".9" stroke-linecap="round" fill="none"/>
    <path d="M46 31 L53 7" stroke="${P.base}" stroke-width="2.4" stroke-linecap="round"/><path d="M46.6 29 L52.6 8.4" stroke="#fff" stroke-width=".5" stroke-linecap="round" opacity=".3"/>
    <path d="M53 7 L52 4.5 L54.8 6.2 Z" fill="url(#${id}e)"/>
    <path d="M55 9 C60 7 66 8 72 12" fill="none" stroke="#fff" stroke-width=".8" stroke-linecap="round" opacity=".16"/></g>
  </g>
  <g class="dr-fuego"><path d="M7 16.5 C-6 11 -32 8 -58 12.5 C-38 15.5 -40 21.5 -58 25 C-32 27 -8 25 7 21.5 Z" fill="url(#${id}f)"/><path d="M7 17.6 C-4 15.2 -20 14.6 -36 16.8 C-22 18.6 -20 20.4 -34 22.6 C-18 23 -4 22.4 7 20.6 Z" fill="#FFF6C8" opacity=".8"/></g>`;
}
export const dragonDuelo = (paleta = "verde", escala = 3) => envoltura(84, 70, escala, "dragon-duelo", cuerpoDragonDuelo(paleta));
export const capaDragonDuelo = (paleta, dx, dy) => grupo(dx, dy, cuerpoDragonDuelo(paleta));

// Arena del duelo (172 × 140): cielo de atardecer, montañas lejanas con bruma, castillo en ruinas, colinas y una
// plataforma de piedra con volumen. Devuelve el fondo y la línea del piso donde se paran los dos peleadores.
export function escenaDuelo(w = 172, h = 140, semilla = 21) {
  const r = azar(semilla), id = "ad" + (semilla % 997), suelo = 118;
  let s = `<defs>${degradado(id + "k", "#7FA7C4", "#E9D2A2", "#F3B47C")}
    <radialGradient id="${id}sol" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FFF6D6" stop-opacity=".95"/><stop offset=".35" stop-color="#FFE3A0" stop-opacity=".55"/><stop offset="1" stop-color="#FFE3A0" stop-opacity="0"/></radialGradient>
    <linearGradient id="${id}m1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9AAAB5"/><stop offset="1" stop-color="#C9C4B4"/></linearGradient>
    <linearGradient id="${id}m2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6F8A63"/><stop offset="1" stop-color="#4C6444"/></linearGradient>
    <linearGradient id="${id}p" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#D9C7A0"/><stop offset=".5" stop-color="#B49B72"/><stop offset="1" stop-color="#7C6649"/></linearGradient>
    <linearGradient id="${id}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8A7354"/><stop offset="1" stop-color="#4D3E2B"/></linearGradient>
    <linearGradient id="${id}t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5E7F45"/><stop offset="1" stop-color="#2F4524"/></linearGradient>
    <linearGradient id="${id}bruma" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F3E3C0" stop-opacity="0"/><stop offset="1" stop-color="#F3E3C0" stop-opacity=".7"/></linearGradient>
  </defs><rect width="${w}" height="${h}" fill="url(#${id}k)"/>
  <circle cx="34" cy="34" r="30" fill="url(#${id}sol)"/>`;
  for (let k = 0; k < 4; k++) { const cx = 20 + k * 44 + r() * 16, cy = 14 + r() * 18; s += `<g opacity=".75"><ellipse cx="${r2(cx)}" cy="${r2(cy)}" rx="12" ry="2.6" fill="#FFF4E0"/><ellipse cx="${r2(cx - 4)}" cy="${r2(cy - 1.6)}" rx="6" ry="2.4" fill="#FFF9EE"/></g>`; }
  s += `<path d="M0 82 L14 64 L26 72 L44 52 L60 68 L74 58 L92 72 L110 54 L126 66 L142 56 L160 70 L172 62 L172 92 L0 92 Z" fill="url(#${id}m1)" opacity=".85"/>
    <path d="M44 52 L50 59 L46 58 L40 60 Z M110 54 L116 61 L111 60 L105 62 Z" fill="#F4F1EA" opacity=".8"/>
    <rect x="0" y="70" width="${w}" height="24" fill="url(#${id}bruma)"/>
    <g opacity=".9"><path d="M118 86 L118 66 L121 66 L121 63 L124 63 L124 66 L127 66 L127 70 L133 70 L133 60 L136 60 L136 57 L139 57 L139 60 L142 60 L142 86 Z" fill="#6E6A66"/><path d="M118 86 L118 66 L121 66 L121 86 Z M133 86 L133 70 L136 70 L136 86 Z" fill="#8C8781"/><rect x="137" y="64" width="2" height="3" rx="1" fill="#3F3B38"/><rect x="123" y="73" width="2" height="3" rx="1" fill="#3F3B38"/></g>
    <path d="M0 96 C20 84 44 88 64 92 C86 96 104 84 130 86 C150 88 162 92 172 90 L172 112 L0 112 Z" fill="url(#${id}m2)"/>
    <path d="M0 96 C20 84 44 88 64 92 C86 96 104 84 130 86 C150 88 162 92 172 90" fill="none" stroke="#9FBF7A" stroke-width="1" opacity=".6"/>`;
  for (let k = 0; k < 7; k++) { const x = r() * w, y = 93 + r() * 8, R = 3 + r() * 3; s += `<ellipse cx="${r2(x)}" cy="${r2(y + R * .9)}" rx="${r2(R * .9)}" ry=".8" fill="#000" opacity=".12"/><circle cx="${r2(x)}" cy="${r2(y)}" r="${r2(R)}" fill="#3F5E36"/><circle cx="${r2(x - R * .3)}" cy="${r2(y - R * .35)}" r="${r2(R * .55)}" fill="#6E9150" opacity=".85"/>`; }
  s += `<rect x="0" y="108" width="${w}" height="${h - 108}" fill="url(#${id}t)"/>
    <ellipse cx="${w / 2}" cy="127" rx="88" ry="12" fill="url(#${id}b)"/>
    <ellipse cx="${w / 2}" cy="${suelo + 1}" rx="86" ry="11" fill="url(#${id}p)"/>`;
  for (let k = 0; k < 14; k++) { const a = (k / 14) * Math.PI * 2, x = w / 2 + Math.cos(a) * 60 * (.4 + r() * .55), y = suelo + 1 + Math.sin(a) * 7 * (.4 + r() * .5); s += `<ellipse cx="${r2(x)}" cy="${r2(y)}" rx="${r2(4 + r() * 4)}" ry="${r2(1 + r() * .8)}" fill="#fff" opacity=".1"/>`; }
  s += `<path d="M${w / 2 - 80} ${suelo - 1} Q${w / 2} ${suelo - 13} ${w / 2 + 80} ${suelo - 1}" fill="none" stroke="#fff" stroke-width=".8" opacity=".35"/>`;
  return { svg: s, suelo };
}

// Marco SVG listo para insertar: toma el fondo y agrega capas (personajes) encima.
export function escenaSvg(fondo, w, h, capas = "", extra = "") {
  return `<svg class="escena" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" ${extra}>${fondo}${capas}</svg>`;
}

// ======================================================================================================================
// Juegos nuevos (8 nov 2026): princesa guerrera, enemigos, clavados de pingüino y el perro con sus platos.
// Acabado 3.0 (sección 20): volumen con degradados y una sola luz (arriba a la izquierda), brillos suaves, sombra difusa
// en el piso y contorno fino. Colores reales en los animales; los colores fuertes solo van en accesorios.
// ======================================================================================================================

// ---------- Princesa guerrera (16 × 20): misma escala y mismos puntos de apoyo que Sparky ----------
// Hombros en (3.25, 11.1) y (12.75, 11.1), manos en y = 16 y pies en y = 19.35, para que la espada de Sparky (+espada)
// y las animaciones del duelo (.sk-espada) le sirvan igual. Poses: decidido, golpe, festejo, triste (caída) y quieto.
const PR = { piel: "#E9B98F", pielSombra: "#C98E62", pelo: "#4A2614", peloLuz: "#8A4B2A", malla: "#3B3550", oro2: "#C9921E" };
const DEFS_PRINCESA = `<defs>
  <linearGradient id="pr-capa" x1="0" y1="0" x2=".35" y2="1"><stop offset="0" stop-color="#E0485A"/><stop offset=".6" stop-color="#A9233A"/><stop offset="1" stop-color="#6E1428"/></linearGradient>
  <linearGradient id="pr-tunica" x1="0" y1="0" x2=".4" y2="1"><stop offset="0" stop-color="#5ED6C6"/><stop offset=".5" stop-color="#22A393"/><stop offset="1" stop-color="#0F6259"/></linearGradient>
  <linearGradient id="pr-plata" x1="0" y1="0" x2=".55" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".45" stop-color="#D5DCE8"/><stop offset="1" stop-color="#7F8AA0"/></linearGradient>
  <linearGradient id="pr-oro" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFF3B0"/><stop offset=".5" stop-color="#FFC93D"/><stop offset="1" stop-color="#B57A12"/></linearGradient>
  <radialGradient id="pr-piel" cx=".38" cy=".32" r=".8"><stop offset="0" stop-color="#F8D5B4"/><stop offset=".65" stop-color="${PR.piel}"/><stop offset="1" stop-color="${PR.pielSombra}"/></radialGradient>
  <radialGradient id="pr-pelo" cx=".35" cy=".28" r=".85"><stop offset="0" stop-color="${PR.peloLuz}"/><stop offset=".7" stop-color="${PR.pelo}"/><stop offset="1" stop-color="#2A140A"/></radialGradient>
  <linearGradient id="pr-bota" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#A86B3C"/><stop offset="1" stop-color="#4E2E16"/></linearGradient>
</defs>`;
const lp = (sw = .3) => `stroke="${C.linea}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"`;
// Brazo: manga de la túnica, brazal de plata con filo dorado y mano. Gira desde el hombro (px, 11.1).
const brazoPr = (px, rot) => `<g transform="rotate(${rot} ${px} 11.1)"><rect x="${r2(px - 1)}" y="10.2" width="2" height="3.4" rx="1" fill="url(#pr-tunica)" ${lp()}/><rect x="${r2(px - .95)}" y="13.1" width="1.9" height="2.3" rx=".8" fill="url(#pr-plata)" ${lp()}/><rect x="${r2(px - .95)}" y="13.25" width="1.9" height=".38" fill="${PR.oro2}"/><circle cx="${px}" cy="16" r="1" fill="url(#pr-piel)" ${lp()}/></g>`;
const piernaPr = (x) => `<rect x="${r2(x - .85)}" y="15.6" width="1.7" height="2.4" rx=".7" fill="${PR.malla}"/><path d="M${r2(x - 1)} 17.3 h2 v1.1 q1.3 .1 1.4 .7 v.3 h-3.4 z" fill="url(#pr-bota)" ${lp()}/><path d="M${r2(x - .7)} 17.6 h1.4" stroke="#D9A066" stroke-width=".25" stroke-linecap="round"/>`;
function caraPr(pose) {
  const ojo = (x, ry = .72) => `<ellipse cx="${x}" cy="6.55" rx=".52" ry="${ry}" fill="#2B1A12"/><circle cx="${r2(x + .18)}" cy="6.22" r=".2" fill="#fff"/>`;
  const rubor = `<ellipse cx="7.4" cy="7.7" rx=".7" ry=".34" fill="#F07C7C" opacity=".4"/><ellipse cx="11.1" cy="7.6" rx=".5" ry=".3" fill="#F07C7C" opacity=".4"/>`;
  const ceja = (d) => `<path d="${d}" stroke="${PR.pelo}" stroke-width=".32" fill="none" stroke-linecap="round"/>`;
  if (pose === "festejo") return `${[8.1, 10.3].map((x) => `<path d="M${r2(x - .55)} 6.75 q.55 -.85 1.1 0" stroke="#2B1A12" stroke-width=".36" fill="none" stroke-linecap="round"/>`).join("")}${rubor}<path d="M8.5 7.85 q1 1.5 2.1 0 z" fill="#7A2626"/><path d="M8.95 8.55 q.6 .35 1.2 0" stroke="#F28B9B" stroke-width=".35" fill="none" stroke-linecap="round"/>`;
  if (pose === "golpe") return `${ojo(8.1)}${ojo(10.3)}${ceja("M7.4 5.3 L8.7 5.85 M9.8 5.85 L11.1 5.3")}${rubor}<ellipse cx="9.55" cy="8.25" rx=".6" ry=".5" fill="#7A2626"/>`;
  if (pose === "triste") return `${ojo(8.1, .5)}${ojo(10.3, .5)}${ceja("M7.5 5.75 L8.6 5.35 M9.85 5.35 L10.95 5.75")}${rubor}<path d="M8.95 8.45 q.6 -.4 1.2 0" stroke="#7A2626" stroke-width=".3" fill="none" stroke-linecap="round"/>`;
  if (pose === "decidido") return `${ojo(8.1)}${ojo(10.3)}${ceja("M7.45 5.4 L8.7 5.8 M9.8 5.8 L11.05 5.4")}${rubor}<path d="M8.9 8.1 q.65 .35 1.3 -.05" stroke="#7A2626" stroke-width=".3" fill="none" stroke-linecap="round"/>`;
  return `${ojo(8.1)}${ojo(10.3)}${rubor}<path d="M8.8 7.95 q.75 .6 1.5 0" stroke="#7A2626" stroke-width=".3" fill="none" stroke-linecap="round"/>`;
}
const POSES_PR = { decidido: [-30, -60], golpe: [35, -100], festejo: [160, -165], triste: [8, -10], quieto: [10, -8] };
function cuerpoPrincesa(frame = "quieto") {
  const [p, ...acc] = String(frame).split("+");
  const pose = POSES_PR[p] ? p : "quieto", conEspada = acc.includes("espada");
  const [izq, der] = POSES_PR[pose];
  const rl = pose === "triste" ? 20 : pose === "golpe" ? 105 : -90 - der;
  const brazoDer = conEspada ? giro(12.75, 11.1, "sk-espada", `<g transform="rotate(${der} 12.75 11.1)">${espada(rl)}${brazoPr(12.75, 0)}</g>`, 16) : brazoPr(12.75, der);
  const inclina = pose === "golpe" ? `transform="rotate(7 8 19)"` : "";
  const cabeza = pose === "triste" ? `transform="rotate(9 8.5 8.5)"` : "";
  return `${DEFS_PRINCESA}${conEspada ? DEFS_CABALLERO : ""}
    <ellipse class="sk-sombra" cx="8" cy="19.35" rx="5.4" ry=".62" fill="${C.sombra}"/>
    <g class="sk-cuerpo pr-cuerpo" ${inclina}><rect x="-5" y="-2" width="26" height="21.3" fill="none"/>
    <path class="pr-capa" d="M4.7 9.6 C3.2 12.2 1.8 15.4 1.3 18.7 Q3.6 18.1 5.6 18.9 Q8.2 18.1 10.4 18.7 C10.3 15.2 10.8 12.3 11.2 9.6 Z" fill="url(#pr-capa)" ${lp()}/>
    <path d="M3.6 12.5 C3 14.5 2.5 16.5 2.3 18.2" stroke="#fff" stroke-width=".35" opacity=".22" fill="none" stroke-linecap="round"/>
    ${piernaPr(6.5)}${piernaPr(9.6)}
    ${brazoPr(3.25, izq)}
    <path d="M4.9 13.8 L11.1 13.8 L12.1 16.6 Q8 17.5 3.9 16.6 Z" fill="url(#pr-tunica)" ${lp()}/>
    <path d="M4 16.45 Q8 17.3 12 16.45" stroke="url(#pr-oro)" stroke-width=".45" fill="none"/>
    <path d="M5 9.9 Q8 8.8 11 9.9 L11.2 13.4 Q8 14.4 4.8 13.4 Z" fill="url(#pr-plata)" ${lp()}/>
    <ellipse cx="6.9" cy="11" rx="1.3" ry=".7" fill="#fff" opacity=".55" transform="rotate(-20 6.9 11)"/>
    <path d="M8 10 L8 13" stroke="#8590A6" stroke-width=".2" opacity=".6"/>
    <rect x="4.8" y="13.2" width="6.4" height=".9" rx=".4" fill="url(#pr-oro)" ${lp(.2)}/><circle cx="8" cy="13.65" r=".45" fill="#3FE0D0" stroke="${PR.oro2}" stroke-width=".18"/>
    <ellipse cx="4.7" cy="10.4" rx="1.55" ry="1" fill="url(#pr-plata)" ${lp()}/><ellipse cx="11.3" cy="10.4" rx="1.55" ry="1" fill="url(#pr-plata)" ${lp()}/>
    <rect x="7.3" y="8.4" width="1.5" height="1.5" fill="${PR.pielSombra}"/>
    <g class="pr-cabeza" ${cabeza}>
      <ellipse cx="4.9" cy="8.8" rx=".95" ry=".9" fill="url(#pr-pelo)"/><ellipse cx="4.3" cy="10.3" rx=".85" ry=".85" fill="url(#pr-pelo)"/><ellipse cx="3.95" cy="11.7" rx=".72" ry=".75" fill="url(#pr-pelo)"/>
      <rect x="3.4" y="12.25" width="1.05" height=".5" rx=".2" fill="url(#pr-oro)"/><path d="M3.9 12.7 q-.5 .6 -.3 1.1 q.4 -.2 .7 0 q.1 -.6 -.4 -1.1z" fill="url(#pr-pelo)"/>
      <circle cx="8.2" cy="5.6" r="4" fill="url(#pr-pelo)" ${lp()}/>
      <circle cx="8.6" cy="6.3" r="3.25" fill="url(#pr-piel)" ${lp()}/>
      <ellipse cx="6.3" cy="6.8" rx=".55" ry=".75" fill="${PR.pielSombra}"/>
      <path d="M4.6 6.3 C4.4 2.8 7.6 1.4 10.3 2.3 C11.9 2.9 12.4 4.3 12.1 5.4 C11.2 4.4 9.9 4 8.9 4.3 C8.2 5.1 7.2 5.2 6.4 4.9 C5.6 5.4 5.1 5.8 4.6 6.3 Z" fill="url(#pr-pelo)" ${lp(.25)}/>
      <path d="M6.2 2.9 C7.6 2.2 9.4 2.2 10.6 2.9" stroke="#C07A4A" stroke-width=".3" fill="none" opacity=".7" stroke-linecap="round"/>
      ${caraPr(pose)}
      <path d="M5.3 3.75 Q8.45 1.85 11.6 3.6" stroke="url(#pr-oro)" stroke-width=".8" fill="none" stroke-linecap="round"/>
      <path d="M6.6 3.2 L6.9 2.35 L7.35 2.95 Z M9.6 2.9 L10.05 2.3 L10.3 3.15 Z" fill="url(#pr-oro)"/>
      <path d="M7.9 2.75 L8.45 1.25 L9 2.75 Z" fill="url(#pr-oro)"/>
      <ellipse cx="8.45" cy="2.6" rx=".42" ry=".55" fill="#3FE0D0" stroke="${PR.oro2}" stroke-width=".2"/><circle cx="8.32" cy="2.4" r=".14" fill="#fff"/>
    </g>
    ${brazoDer}
    </g>`;
}
// Personajes que se pueden elegir en los juegos con protagonista (duelo, enemigos, castillo y montaña).
export const PERSONAJES = ["sparky", "princesa"];
// "decidido+espada" para los dos; a Sparky se le agrega el yelmo. Sparky no tiene pose "golpe": el tajo lo hace la
// animación de la espada, así que usa "decidido".
const cuerpoHeroe = (quien, frame = "quieto") => {
  if (quien === "princesa") return cuerpoPrincesa(frame);
  const [p, ...acc] = String(frame).split("+");
  return cuerpoSparky(leerPose([p === "golpe" ? "decidido" : p, ...acc, ...(acc.includes("espada") && !acc.includes("yelmo") ? ["yelmo"] : [])].join("+")));
};
export const heroe = (quien = "sparky", frame = "decidido+espada", escala = 3) => {
  const espadaSi = String(frame).includes("espada"), [x, y, w, h] = marcoSparky({ espada: espadaSi, yelmo: espadaSi });
  return `<svg class="vec heroe heroe-${quien === "princesa" ? "princesa" : "sparky"}" viewBox="${x} ${y} ${w} ${h}" width="${r2(w * escala)}" height="${r2(h * escala)}" xmlns="http://www.w3.org/2000/svg">${cuerpoHeroe(quien, frame)}</svg>`;
};
export const capaHeroe = (quien, frame, dx, dy) => grupo(dx, dy, cuerpoHeroe(quien, frame));
// El personaje en chico (12 × 16, pies en el piso) para la montaña, y con arco para la torre del castillo.
export const capaEscaladorDe = (quien, dx, dy) => grupo(dx, dy, `<g transform="translate(0 .9) scale(.75)">${cuerpoHeroe(quien, "quieto")}</g>`);
export const capaArqueroDe = (quien, dx, dy) => grupo(dx, dy, `<g transform="translate(0 .9) scale(.75)">${cuerpoHeroe(quien, "decidido")}</g><path d="M10.6 5.4 Q14.2 10 10.6 14.6" fill="none" stroke="#8B5A2B" stroke-width=".9" stroke-linecap="round"/><path d="M10.6 5.4 Q14.2 10 10.6 14.6" fill="none" stroke="#C8925A" stroke-width=".35" stroke-linecap="round"/><line x1="10.6" y1="5.4" x2="10.6" y2="14.6" stroke="#EEE" stroke-width=".25"/>`);

// ---------- Enemigos (24 × 24, pies en y = 23, miran a la izquierda) ----------
// Seis diseños para el juego de enemigos: baba, duende, murciélago, gólem de piedra, hongo y robot oxidado. Con ko = true
// ponen ojos de "noqueado". La clase en-cuerpo respira y en-ala aletea (juegos-nuevos.css).
export const ENEMIGOS = ["baba", "duende", "murcielago", "golem", "hongo", "robot"];
const sombraEn = (rx = 9, op = .28) => `<ellipse cx="12" cy="23.1" rx="${rx}" ry="1.3" fill="#000" opacity="${op}"/>`;
const ojosKo = (pts, color = "#1A1A1A") => pts.map(([x, y]) => `<path d="M${r2(x - .8)} ${r2(y - .8)} L${r2(x + .8)} ${r2(y + .8)} M${r2(x + .8)} ${r2(y - .8)} L${r2(x - .8)} ${r2(y + .8)}" stroke="${color}" stroke-width=".55" stroke-linecap="round"/>`).join("");
const DIBUJOS_ENEMIGO = {
  baba: (ko) => `<defs><radialGradient id="en-baba" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="#D4F7A6"/><stop offset=".5" stop-color="#6CC24A"/><stop offset="1" stop-color="#2C6E26"/></radialGradient></defs>
    ${sombraEn(9.5)}<g class="en-cuerpo">
    <path d="M2.5 22.6 C1.8 16 5.5 9 12 9 C18.5 9 22.2 16 21.5 22.6 Q17 23.8 12 23.4 Q7 23.8 2.5 22.6 Z" fill="url(#en-baba)" stroke="#24581F" stroke-width=".35"/>
    <circle cx="16" cy="18.5" r="1.1" fill="#fff" opacity=".25"/><circle cx="18" cy="15.4" r=".6" fill="#fff" opacity=".3"/><circle cx="9" cy="20" r=".7" fill="#fff" opacity=".22"/>
    <ellipse cx="8" cy="12.6" rx="2.6" ry="1.3" fill="#fff" opacity=".55" transform="rotate(-28 8 12.6)"/>
    ${ko ? ojosKo([[8.2, 15.2], [12.6, 15.2]], "#1B3412") : `<ellipse cx="8.2" cy="15.2" rx="1.6" ry="2" fill="#fff"/><ellipse cx="12.6" cy="15.2" rx="1.6" ry="2" fill="#fff"/><circle cx="7.5" cy="15.6" r=".9" fill="#14240E"/><circle cx="11.9" cy="15.6" r=".9" fill="#14240E"/><circle cx="7.2" cy="15.2" r=".3" fill="#fff"/><circle cx="11.6" cy="15.2" r=".3" fill="#fff"/>
    <path d="M6.4 12.5 L9.6 13.5 M11.2 13.5 L14.4 12.5" stroke="#1F4F1A" stroke-width=".7" stroke-linecap="round"/>`}
    <path d="M7.6 19.2 q2.4 1.5 4.8 0" stroke="#1F4F1A" stroke-width=".55" fill="none" stroke-linecap="round"/><path d="M8.6 19.75 l.5 1 l.5 -.85 z" fill="#fff"/></g>`,
  duende: (ko) => `<defs><radialGradient id="en-duende" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="#C3E08A"/><stop offset=".6" stop-color="#7FAE48"/><stop offset="1" stop-color="#3E6526"/></radialGradient>
    <linearGradient id="en-duende-t" x1="0" y1="0" x2=".4" y2="1"><stop offset="0" stop-color="#B07A45"/><stop offset="1" stop-color="#5A381C"/></linearGradient>
    <linearGradient id="en-duende-m" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#C08A55"/><stop offset="1" stop-color="#6B4320"/></linearGradient></defs>
    ${sombraEn(7)}<g class="en-cuerpo">
    <rect x="9" y="19.3" width="2.1" height="3.4" rx=".9" fill="#5A3A1E"/><rect x="13" y="19.3" width="2.1" height="3.4" rx=".9" fill="#5A3A1E"/><ellipse cx="9.6" cy="22.8" rx="1.7" ry=".7" fill="#2E1D0E"/><ellipse cx="13.6" cy="22.8" rx="1.7" ry=".7" fill="#2E1D0E"/>
    <path d="M7 13 Q12 11.4 17 13 L18 20 Q12 21.6 6 20 Z" fill="url(#en-duende-t)" stroke="#3A2410" stroke-width=".3"/><rect x="6.6" y="16" width="11" height="1" fill="#3A2410"/><rect x="11.4" y="15.9" width="1.4" height="1.2" rx=".2" fill="#D9B45A"/>
    <path d="M3.4 17.6 L2.2 6.8" stroke="url(#en-duende-m)" stroke-width="1.6" stroke-linecap="round"/><ellipse cx="2.3" cy="6.6" rx="2.1" ry="2.6" fill="url(#en-duende-m)" stroke="#3A2410" stroke-width=".3"/><circle cx="1.6" cy="5.8" r=".5" fill="#fff" opacity=".35"/>
    <path d="M8 14 L4 17" stroke="#6E9A3E" stroke-width="1.6" stroke-linecap="round"/><circle cx="3.6" cy="17.4" r="1.1" fill="url(#en-duende)"/>
    <path d="M7.8 8.2 L2.4 5.4 L7.6 10.4 Z" fill="url(#en-duende)" stroke="#2F4F1A" stroke-width=".3"/><path d="M16.2 8.2 L21.6 5.4 L16.4 10.4 Z" fill="url(#en-duende)" stroke="#2F4F1A" stroke-width=".3"/>
    <path d="M7 8.5 L4 6.6 L7 9.4 Z" fill="#E7A7A0" opacity=".7"/>
    <circle cx="12" cy="8.6" r="4.6" fill="url(#en-duende)" stroke="#2F4F1A" stroke-width=".35"/><ellipse cx="10.4" cy="6.2" rx="1.6" ry=".8" fill="#fff" opacity=".35" transform="rotate(-20 10.4 6.2)"/>
    ${ko ? ojosKo([[10.2, 8.4], [13.6, 8.4]], "#1E2A10") : `<ellipse cx="10.2" cy="8.4" rx="1.1" ry="1.3" fill="#FFF3B0"/><ellipse cx="13.6" cy="8.4" rx="1.1" ry="1.3" fill="#FFF3B0"/><circle cx="9.8" cy="8.7" r=".55" fill="#1A1A1A"/><circle cx="13.2" cy="8.7" r=".55" fill="#1A1A1A"/><path d="M8.8 6.6 L11 7.3 M12.6 7.3 L14.8 6.6" stroke="#2F4F1A" stroke-width=".55" stroke-linecap="round"/>`}
    <ellipse cx="11.4" cy="10.4" rx="1" ry=".75" fill="#5E8A34"/><path d="M9.4 11.7 Q12 13.2 14.6 11.5" stroke="#2A3A14" stroke-width=".45" fill="none" stroke-linecap="round"/><path d="M10.3 12.1 l.4 .8 l.4 -.65 z M13.2 12.15 l.4 .75 l.35 -.8 z" fill="#FFFBEA"/></g>`,
  murcielago: (ko) => `<defs><radialGradient id="en-murc" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="#A88672"/><stop offset=".6" stop-color="#6B4E3E"/><stop offset="1" stop-color="#3A2A21"/></radialGradient>
    <linearGradient id="en-murc-a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6E5244"/><stop offset="1" stop-color="#2E211B"/></linearGradient></defs>
    ${sombraEn(5, .18)}<g class="en-vuela"><g class="en-cuerpo">
    <g class="en-ala"><path d="M10 12 C7 8 3 7 .5 9 C2 10 2.4 11.6 2 13.2 C3.6 12.3 4.8 12.9 5.4 14.3 C6.6 13 8.4 13.2 10 14.6 Z" fill="url(#en-murc-a)" stroke="#20160F" stroke-width=".3"/><path d="M10 12 L2 13.2 M10 12 L5.4 14.3 M10 12 L.5 9" stroke="#8C6A58" stroke-width=".25" opacity=".7"/></g>
    <g class="en-ala en-ala-b"><path d="M14 12 C17 8 21 7 23.5 9 C22 10 21.6 11.6 22 13.2 C20.4 12.3 19.2 12.9 18.6 14.3 C17.4 13 15.6 13.2 14 14.6 Z" fill="url(#en-murc-a)" stroke="#20160F" stroke-width=".3"/><path d="M14 12 L22 13.2 M14 12 L18.6 14.3 M14 12 L23.5 9" stroke="#8C6A58" stroke-width=".25" opacity=".7"/></g>
    <path d="M9.7 9.8 L9 5.2 L11.3 8.6 Z M14.3 9.8 L15 5.2 L12.7 8.6 Z" fill="url(#en-murc)" stroke="#20160F" stroke-width=".3"/><path d="M9.8 8.8 L9.4 6.4 L10.6 8.3 Z" fill="#C9918A"/>
    <ellipse cx="12" cy="13" rx="3.6" ry="4.4" fill="url(#en-murc)" stroke="#20160F" stroke-width=".3"/><ellipse cx="10.8" cy="11" rx="1.2" ry=".7" fill="#fff" opacity=".25"/>
    ${ko ? ojosKo([[10.9, 11.6], [13.1, 11.6]], "#140C08") : `<circle cx="10.9" cy="11.6" r=".8" fill="#FFB74D"/><circle cx="13.1" cy="11.6" r=".8" fill="#FFB74D"/><circle cx="10.7" cy="11.7" r=".38" fill="#140C08"/><circle cx="12.9" cy="11.7" r=".38" fill="#140C08"/><path d="M10 10.5 L11.6 11 M12.4 11 L14 10.5" stroke="#20160F" stroke-width=".4" stroke-linecap="round"/>`}
    <ellipse cx="12" cy="13.2" rx=".6" ry=".4" fill="#3A2420"/><path d="M11 14.2 l.35 .9 l.35 -.8 z M12.6 14.2 l.35 .9 l.35 -.8 z" fill="#fff"/>
    <path d="M10.8 17.2 l-.4 1.3 M13.2 17.2 l.4 1.3" stroke="#3A2A21" stroke-width=".45" stroke-linecap="round"/></g></g>`,
  golem: (ko) => `<defs><linearGradient id="en-golem" x1="0" y1="0" x2=".5" y2="1"><stop offset="0" stop-color="#C9CDD1"/><stop offset=".5" stop-color="#8A9096"/><stop offset="1" stop-color="#4E5459"/></linearGradient>
    <radialGradient id="en-golem-o" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FFF4B8"/><stop offset=".5" stop-color="#FFB627"/><stop offset="1" stop-color="#FFB627" stop-opacity="0"/></radialGradient></defs>
    ${sombraEn(9.5, .3)}<g class="en-cuerpo">
    <rect x="7" y="18" width="4" height="5" rx="1.4" fill="url(#en-golem)" stroke="#33383C" stroke-width=".3"/><rect x="13" y="18" width="4" height="5" rx="1.4" fill="url(#en-golem)" stroke="#33383C" stroke-width=".3"/>
    <circle cx="20" cy="15.5" r="2.2" fill="#6A7075"/>
    <path d="M5 10.5 Q12 6.4 19 10.5 L20 18.6 Q12 21 4 18.6 Z" fill="url(#en-golem)" stroke="#33383C" stroke-width=".35"/>
    <path d="M9 11 l2 2.5 l-1 2 M15 12 l-1.5 3" stroke="#4A4F54" stroke-width=".35" fill="none"/>
    <path d="M5.2 12 Q7 10.6 9 11.4 Q8 12.6 5.6 13.2 Z M15.5 9.4 Q17.6 9.2 18.6 10.6 Q17 11 15.5 9.4 Z" fill="#6E9150"/><path d="M5.6 12.2 Q7 11.2 8.4 11.6" stroke="#9FBF7A" stroke-width=".3" fill="none"/>
    <path d="M16.6 8.4 L17.6 5.6 L18.6 8.6 Z" fill="#5EEAD4" stroke="#1A9A8D" stroke-width=".25"/><path d="M17.2 7.8 L17.6 6.2" stroke="#fff" stroke-width=".25" opacity=".8"/>
    <circle cx="3.6" cy="14" r="2.5" fill="url(#en-golem)" stroke="#33383C" stroke-width=".3"/><circle cx="3" cy="18.2" r="2.3" fill="url(#en-golem)" stroke="#33383C" stroke-width=".3"/>
    <ellipse cx="12" cy="7.6" rx="3.8" ry="3.1" fill="url(#en-golem)" stroke="#33383C" stroke-width=".35"/><ellipse cx="10.8" cy="6.2" rx="1.4" ry=".6" fill="#fff" opacity=".35"/>
    ${ko ? ojosKo([[10.6, 7.6], [13.4, 7.6]], "#2A2E31") : `<circle cx="10.6" cy="7.6" r="1.6" fill="url(#en-golem-o)"/><circle cx="13.4" cy="7.6" r="1.6" fill="url(#en-golem-o)"/><rect x="9.9" y="7.2" width="1.4" height=".8" rx=".3" fill="#FFE27A"/><rect x="12.7" y="7.2" width="1.4" height=".8" rx=".3" fill="#FFE27A"/>`}
    <path d="M10.4 9.6 h3.2" stroke="#33383C" stroke-width=".45" stroke-linecap="round"/></g>`,
  hongo: (ko) => `<defs><radialGradient id="en-hongo" cx=".35" cy=".25" r=".9"><stop offset="0" stop-color="#FF8A7A"/><stop offset=".55" stop-color="#D93A2F"/><stop offset="1" stop-color="#8E1A16"/></radialGradient>
    <linearGradient id="en-hongo-t" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FFF6E2"/><stop offset="1" stop-color="#D4BC98"/></linearGradient></defs>
    ${sombraEn(7.5)}<g class="en-cuerpo">
    <ellipse cx="9.6" cy="22.5" rx="2" ry="1" fill="#7A5230"/><ellipse cx="14.4" cy="22.5" rx="2" ry="1" fill="#7A5230"/>
    <path d="M8 13 Q7.2 19 8.4 22 Q12 23 15.6 22 Q16.8 19 16 13 Z" fill="url(#en-hongo-t)" stroke="#8C7350" stroke-width=".3"/>
    <path d="M8.2 16 L5.6 18.2 M15.8 16 L18.2 17.6" stroke="#D4BC98" stroke-width="1.2" stroke-linecap="round"/>
    ${ko ? ojosKo([[10.6, 16.6], [13.4, 16.6]], "#3A2A1A") : `<ellipse cx="10.6" cy="16.6" rx=".75" ry="1" fill="#2A1C10"/><ellipse cx="13.4" cy="16.6" rx=".75" ry="1" fill="#2A1C10"/><circle cx="10.4" cy="16.2" r=".25" fill="#fff"/><circle cx="13.2" cy="16.2" r=".25" fill="#fff"/><path d="M9.4 15 L11.4 15.6 M12.6 15.6 L14.6 15" stroke="#5A4026" stroke-width=".45" stroke-linecap="round"/>`}
    <path d="M10.6 19.2 q1.4 -.9 2.8 0" stroke="#5A4026" stroke-width=".45" fill="none" stroke-linecap="round"/>
    <ellipse cx="12" cy="13.6" rx="9" ry="1.3" fill="#E8D3B4"/>
    <path d="M2 13.6 C2 6 7 3 12 3 C17 3 22 6 22 13.6 Q12 15.4 2 13.6 Z" fill="url(#en-hongo)" stroke="#6E1210" stroke-width=".35"/>
    <circle cx="7" cy="8" r="1.4" fill="#FFF8EE"/><circle cx="12" cy="5.4" r="1.2" fill="#FFF8EE"/><circle cx="16.6" cy="8.4" r="1.6" fill="#FFF8EE"/><circle cx="10" cy="11" r=".9" fill="#FFF8EE"/><circle cx="19.2" cy="11.6" r=".8" fill="#FFF8EE"/><circle cx="4.6" cy="11.6" r=".7" fill="#FFF8EE"/>
    <ellipse cx="7.4" cy="5.6" rx="2.2" ry=".9" fill="#fff" opacity=".35" transform="rotate(-25 7.4 5.6)"/></g>`,
  robot: (ko) => `<defs><linearGradient id="en-robot" x1="0" y1="0" x2=".5" y2="1"><stop offset="0" stop-color="#F2A15E"/><stop offset=".5" stop-color="#C0682C"/><stop offset="1" stop-color="#6E3612"/></linearGradient>
    <radialGradient id="en-robot-o" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FFD0D0"/><stop offset=".45" stop-color="#FF4D4D"/><stop offset="1" stop-color="#FF4D4D" stop-opacity="0"/></radialGradient></defs>
    ${sombraEn(8)}<g class="en-cuerpo">
    <rect x="5.5" y="19.5" width="13" height="3.5" rx="1.7" fill="#3A3A40" stroke="#1E1E22" stroke-width=".3"/>${[7.4, 10.4, 13.6, 16.6].map((x) => `<circle cx="${x}" cy="21.25" r="1" fill="#6A6A72"/><circle cx="${x}" cy="21.25" r=".35" fill="#2A2A30"/>`).join("")}
    <path d="M6.4 14.4 L3.2 16.4" stroke="#8A8F98" stroke-width="1.2" stroke-linecap="round"/><path d="M3.2 16.4 l-1.6 -.6 M3.2 16.4 l-1 1.4" stroke="#5A5F68" stroke-width=".8" stroke-linecap="round"/>
    <rect x="6" y="11" width="12" height="9" rx="2" fill="url(#en-robot)" stroke="#4A2208" stroke-width=".35"/>
    <rect x="8.4" y="13" width="5" height="3.6" rx=".8" fill="#2A2340"/><circle cx="9.6" cy="14.8" r=".6" fill="#7DF9FF"/><circle cx="11.4" cy="14.8" r=".6" fill="#FFC247"/><rect x="8.9" y="15.9" width="4" height=".35" fill="#7DF9FF" opacity=".7"/>
    ${[[6.8, 11.8], [17.2, 11.8], [6.8, 19.2], [17.2, 19.2]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r=".32" fill="#FFE0B8"/>`).join("")}
    <path d="M14.6 12.4 q1.4 .4 1.8 2" stroke="#8E4A1A" stroke-width=".35" fill="none" opacity=".7"/><ellipse cx="8" cy="12" rx="1.6" ry=".5" fill="#fff" opacity=".3"/>
    <rect x="10.6" y="10" width="2.8" height="1.2" fill="#6A6A72"/>
    <rect x="7.5" y="4.4" width="9" height="6.2" rx="2" fill="url(#en-robot)" stroke="#4A2208" stroke-width=".35"/>
    <rect x="8.3" y="6" width="7.4" height="2.8" rx="1.2" fill="#1A1733"/>
    ${ko ? ojosKo([[10.4, 7.4]], "#FF8A8A") : `<circle cx="10.4" cy="7.4" r="1.6" fill="url(#en-robot-o)"/><circle cx="10.4" cy="7.4" r=".7" fill="#FF6B6B"/><circle cx="10.2" cy="7.2" r=".22" fill="#fff"/>`}
    <line x1="12" y1="4.4" x2="12" y2="2" stroke="#6A6A72" stroke-width=".45"/><circle cx="12" cy="1.6" r=".7" fill="#FF4D4D"/><ellipse cx="9.6" cy="5" rx="1.4" ry=".45" fill="#fff" opacity=".35"/></g>`,
};
export const capaEnemigo = (tipo, dx, dy, ko = false) => grupo(dx, dy, (DIBUJOS_ENEMIGO[tipo] ?? DIBUJOS_ENEMIGO.baba)(ko));
export const enemigo = (tipo, escala = 3) => envoltura(24, 24, escala, "enemigo", (DIBUJOS_ENEMIGO[tipo] ?? DIBUJOS_ENEMIGO.baba)(false));

// ---------- Escenarios del juego de enemigos (172 × 140): bosque, cueva y desierto ----------
// Camino de izquierda a derecha con capas que se desplazan (lejos, cerca y piso) cuando el personaje avanza. Cada capa
// se dibuja dos veces seguidas (0 y 172) y nada cruza la orilla, así el desplazamiento no se nota.
export function escenaEnemigos(w = 172, h = 140, semilla = 9, tema = "bosque") {
  const r = azar(semilla), id = "ene" + (semilla % 997), suelo = 116;
  const dos = (inner) => `${inner}<g transform="translate(${w} 0)">${inner}</g>`;
  let cielo = "", lejos = "", cerca = "", piso = "", rayas = "", defs = "";
  if (tema === "cueva") {
    defs = `${degradado(id + "k", "#14112B", "#25214A", "#3A3566")}<linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6A6690"/><stop offset="1" stop-color="#2E2B4A"/></linearGradient>
      <radialGradient id="${id}g" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#7FFFE8" stop-opacity=".7"/><stop offset="1" stop-color="#7FFFE8" stop-opacity="0"/></radialGradient>
      <linearGradient id="${id}c" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#C9FFF6"/><stop offset=".5" stop-color="#3FD6C4"/><stop offset="1" stop-color="#127A70"/></linearGradient>
      <linearGradient id="${id}r" x1="0" y1="0" x2=".4" y2="1"><stop offset="0" stop-color="#4A4670"/><stop offset="1" stop-color="#211E3A"/></linearGradient>`;
    cielo = `<rect width="${w}" height="${h}" fill="url(#${id}k)"/>`;
    for (let k = 0; k < 9; k++) { const x = 8 + k * 19 + r() * 6, l = 10 + r() * 22; cielo += `<path d="M${r2(x - 5)} 0 L${r2(x)} ${r2(l)} L${r2(x + 5)} 0 Z" fill="#2A2650"/><path d="M${r2(x - 1.5)} 0 L${r2(x)} ${r2(l * .7)}" stroke="#4E4A80" stroke-width=".6"/>`; }
    let l = ""; for (let k = 0; k < 4; k++) { const x = 18 + k * 40, a = 40 + r() * 20; l += `<path d="M${x - 9} ${suelo} L${x - 6} ${suelo - a} Q${x} ${suelo - a - 8} ${x + 6} ${suelo - a} L${x + 9} ${suelo} Z" fill="#2B2850" opacity=".9"/><circle cx="${x}" cy="${suelo - a + 6}" r="9" fill="url(#${id}g)"/><path d="M${x - 2} ${suelo - a + 10} L${x} ${suelo - a} L${x + 2} ${suelo - a + 10} Z" fill="url(#${id}c)" opacity=".8"/>`; }
    lejos = dos(l);
    let c = ""; [[22, 1], [96, .8], [146, 1.1]].forEach(([x, e]) => { c += `<circle cx="${x}" cy="${suelo - 4}" r="${16 * e}" fill="url(#${id}g)"/>${[-4, 0, 4].map((dx, j) => `<path d="M${r2(x + dx * e - 2.2 * e)} ${suelo + 1} L${r2(x + dx * e)} ${r2(suelo - (8 + j * 4 - Math.abs(dx)) * e)} L${r2(x + dx * e + 2.2 * e)} ${suelo + 1} Z" fill="url(#${id}c)" stroke="#0E5C54" stroke-width=".3"/>`).join("")}`; });
    c += `<path d="M58 ${suelo + 1} L62 ${suelo - 16} L66 ${suelo + 1} Z M120 ${suelo + 1} L125 ${suelo - 20} L130 ${suelo + 1} Z" fill="url(#${id}r)"/>`;
    cerca = dos(c);
    piso = `<rect x="0" y="${suelo}" width="${w}" height="${h - suelo}" fill="url(#${id}s)"/><rect x="0" y="${suelo - 1}" width="${w}" height="2" fill="#8A86B8" opacity=".6"/>`;
    let ry = ""; for (let x = 4; x < w; x += 22) ry += `<ellipse cx="${x}" cy="${suelo + 8 + (x % 3)}" rx="4" ry="1.2" fill="#24213E" opacity=".6"/><ellipse cx="${x + 11}" cy="${suelo + 16}" rx="2.6" ry=".9" fill="#7F7BAA" opacity=".35"/>`;
    rayas = dos(ry);
  } else if (tema === "desierto") {
    defs = `${degradado(id + "k", "#F3A15F", "#F8CF92", "#FCEBC8")}<radialGradient id="${id}sol" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FFF7D6"/><stop offset=".4" stop-color="#FFE29A" stop-opacity=".8"/><stop offset="1" stop-color="#FFE29A" stop-opacity="0"/></radialGradient>
      <linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F0CF92"/><stop offset="1" stop-color="#C08E4E"/></linearGradient>
      <linearGradient id="${id}d" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E9B572"/><stop offset="1" stop-color="#C98A4A"/></linearGradient>
      <linearGradient id="${id}p" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#F3D7A6"/><stop offset=".6" stop-color="#D2A86C"/><stop offset="1" stop-color="#9C7442"/></linearGradient>
      <linearGradient id="${id}v" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8CBF5A"/><stop offset="1" stop-color="#3F6E28"/></linearGradient>`;
    cielo = `<rect width="${w}" height="${h}" fill="url(#${id}k)"/><circle cx="128" cy="58" r="34" fill="url(#${id}sol)"/><circle cx="128" cy="58" r="11" fill="#FFF3C4"/>`;
    lejos = dos(`<path d="M0 96 C24 82 46 84 70 92 C96 100 120 80 146 86 C158 89 166 92 172 96 L172 ${suelo} L0 ${suelo} Z" fill="url(#${id}d)" opacity=".85"/><path d="M0 96 C24 82 46 84 70 92" stroke="#FCE3B4" stroke-width=".8" fill="none" opacity=".7"/>`);
    let c = "";
    [[34, 26], [118, 34]].forEach(([x, a]) => { c += `<rect x="${x}" y="${suelo - a}" width="7" height="${a}" fill="url(#${id}p)"/><rect x="${x - 1.5}" y="${suelo - a - 3}" width="10" height="3" rx=".6" fill="#E9C994"/>${[1, 2, 3].map((k) => `<line x1="${x}" y1="${suelo - k * a / 4}" x2="${x + 7}" y2="${suelo - k * a / 4}" stroke="#9C7442" stroke-width=".3" opacity=".5"/>`).join("")}`; });
    c += `<rect x="45" y="${suelo - 10}" width="18" height="4" rx="1" fill="url(#${id}p)" transform="rotate(-8 54 ${suelo - 8})"/>`;
    [[82, 1], [152, .8]].forEach(([x, e]) => { c += `<g transform="translate(${x} ${suelo}) scale(${e})"><rect x="-2" y="-20" width="4" height="20" rx="2" fill="url(#${id}v)"/><path d="M-2 -10 h-3 a1.6 1.6 0 0 1 -1.6 -1.6 v-5 a1.5 1.5 0 0 1 3 0 v3.6 h1.6 Z M2 -13 h3 a1.6 1.6 0 0 0 1.6 -1.6 v-4 a1.5 1.5 0 0 0 -3 0 v2.6 h-1.6 Z" fill="url(#${id}v)"/><line x1="-.6" y1="-19" x2="-.6" y2="-1" stroke="#CDE8A8" stroke-width=".35" opacity=".6"/></g>`; });
    cerca = dos(c);
    piso = `<rect x="0" y="${suelo}" width="${w}" height="${h - suelo}" fill="url(#${id}s)"/><path d="M0 ${suelo} Q86 ${suelo - 3} ${w} ${suelo}" stroke="#FFF1CF" stroke-width="1" fill="none" opacity=".7"/>`;
    let ry = ""; for (let x = 2; x < w; x += 20) ry += `<path d="M${x} ${suelo + 9} q4 -2 8 0" stroke="#B88445" stroke-width=".5" fill="none" opacity=".6"/><circle cx="${x + 12}" cy="${suelo + 17}" r=".9" fill="#A9773C" opacity=".6"/>`;
    rayas = dos(ry);
  } else {
    defs = `${degradado(id + "k", "#86C3EA", "#CFE9F3", "#F6E9C4")}<radialGradient id="${id}sol" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FFFBE6"/><stop offset=".4" stop-color="#FFF0B0" stop-opacity=".7"/><stop offset="1" stop-color="#FFF0B0" stop-opacity="0"/></radialGradient>
      <linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C79B62"/><stop offset="1" stop-color="#7E5A34"/></linearGradient>
      <radialGradient id="${id}a" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#9FD36E"/><stop offset=".6" stop-color="#4E9038"/><stop offset="1" stop-color="#25521F"/></radialGradient>
      <linearGradient id="${id}t" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8A5E36"/><stop offset="1" stop-color="#4A2F18"/></linearGradient>`;
    cielo = `<rect width="${w}" height="${h}" fill="url(#${id}k)"/><circle cx="132" cy="28" r="26" fill="url(#${id}sol)"/>`;
    for (let k = 0; k < 3; k++) { const cx = 20 + k * 58 + r() * 14, cy = 16 + r() * 12; cielo += `<g opacity=".85"><ellipse cx="${r2(cx)}" cy="${r2(cy)}" rx="11" ry="3" fill="#fff"/><ellipse cx="${r2(cx - 3)}" cy="${r2(cy - 2)}" rx="6" ry="3" fill="#fff"/></g>`; }
    let l = `<path d="M0 90 C30 72 60 78 86 86 C112 94 140 72 172 90 L172 ${suelo} L0 ${suelo} Z" fill="#86AE8E" opacity=".85"/>`;
    for (let k = 0; k < 8; k++) { const x = 10 + k * 20 + r() * 6, a = 14 + r() * 8, y = 92 + r() * 6; l += `<path d="M${r2(x - 4)} ${r2(y)} L${r2(x)} ${r2(y - a)} L${r2(x + 4)} ${r2(y)} Z" fill="#5F8C6C" opacity=".9"/>`; }
    lejos = dos(l);
    let c = "";
    [[24, 1], [92, .85], [146, 1.05]].forEach(([x, e]) => { c += `<g transform="translate(${x} ${suelo}) scale(${e})"><ellipse cx="0" cy="0" rx="9" ry="1.6" fill="#000" opacity=".15"/><rect x="-2" y="-26" width="4" height="26" rx="1.2" fill="url(#${id}t)"/><circle cx="-5" cy="-28" r="8" fill="url(#${id}a)"/><circle cx="5" cy="-30" r="8.5" fill="url(#${id}a)"/><circle cx="0" cy="-37" r="8" fill="url(#${id}a)"/><ellipse cx="-3" cy="-40" rx="3.4" ry="1.6" fill="#fff" opacity=".25"/></g>`; });
    [[56, 6], [120, 5]].forEach(([x, R]) => { c += `<circle cx="${x}" cy="${suelo - 2}" r="${R}" fill="url(#${id}a)"/><circle cx="${x + R}" cy="${suelo - 1}" r="${R * .75}" fill="url(#${id}a)"/>`; });
    cerca = dos(c);
    piso = `<rect x="0" y="${suelo}" width="${w}" height="${h - suelo}" fill="url(#${id}s)"/><rect x="0" y="${suelo - 2}" width="${w}" height="3.5" rx="1.5" fill="#7CB342"/><rect x="0" y="${suelo - 2}" width="${w}" height="1" fill="#B5E07A" opacity=".8"/>`;
    let ry = ""; for (let x = 3; x < w; x += 21) ry += `<ellipse cx="${x}" cy="${suelo + 9}" rx="2.4" ry="1.1" fill="#9E7A4E"/><ellipse cx="${x - .5}" cy="${suelo + 8.6}" rx="1" ry=".4" fill="#E2C69A" opacity=".7"/><path d="M${x + 10} ${suelo + 17} l1 -2.4 l1 2.4" stroke="#6E9A3E" stroke-width=".5" fill="none"/>`;
    rayas = dos(ry);
  }
  const svg = `<defs>${defs}</defs>${cielo}<g id="${id}L">${lejos}</g>${piso}<g id="${id}R">${rayas}</g><g id="${id}C">${cerca}</g>`;
  return { svg, suelo, capas: { lejos: id + "L", cerca: id + "C", rayas: id + "R" } };
}

// ---------- Pingüino (16 × 20, mira a la derecha, pies en y = 19.4) ----------
// Pingüino rey con colores reales: espalda negra con brillo azulado, panza blanca, mancha naranja en el cuello, pico
// negro con franja naranja y patas rosado-naranja. op = { aleta: grados (0 = pegada al cuerpo, negativo = hacia atrás),
// ojos: "normal" | "feliz" | "mareado", sombra: true }.
const DEFS_PINGUINO = `<defs><linearGradient id="pg-espalda" x1="0" y1="0" x2=".6" y2="1"><stop offset="0" stop-color="#4A5468"/><stop offset=".45" stop-color="#1E2430"/><stop offset="1" stop-color="#0A0D13"/></linearGradient>
  <linearGradient id="pg-panza" x1="0" y1="0" x2=".3" y2="1"><stop offset="0" stop-color="#FFE6A8"/><stop offset=".22" stop-color="#FFFFFF"/><stop offset="1" stop-color="#C9D1DC"/></linearGradient>
  <radialGradient id="pg-mancha" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#FFD27A"/><stop offset="1" stop-color="#F28A1E"/></radialGradient></defs>`;
function cuerpoPinguino(op = {}) {
  const aleta = op.aleta ?? 0, ojos = op.ojos ?? "normal";
  const ojo = ojos === "feliz" ? `<path d="M9.4 5.4 q.8 -1 1.6 0" stroke="#111" stroke-width=".4" fill="none" stroke-linecap="round"/>`
    : ojos === "mareado" ? `<path d="M9.5 4.5 l1.4 1.4 M10.9 4.5 l-1.4 1.4" stroke="#111" stroke-width=".35" stroke-linecap="round"/>`
    : `<circle cx="10.2" cy="5.2" r=".9" fill="#fff"/><circle cx="10.5" cy="5.25" r=".52" fill="#111"/><circle cx="10.35" cy="5" r=".18" fill="#fff"/>`;
  return `${DEFS_PINGUINO}${op.sombra === false ? "" : `<ellipse cx="8" cy="19.4" rx="4.6" ry=".6" fill="#000" opacity=".22"/>`}
    <ellipse cx="6.4" cy="19" rx="1.5" ry=".55" fill="#E8875A"/><ellipse cx="9.6" cy="19" rx="1.5" ry=".55" fill="#E8875A"/>
    <path d="M8 2.2 C12 2.2 13.6 7 13.4 12 C13.2 16.6 11.2 19.2 8 19.2 C4.8 19.2 2.8 16.6 2.6 12 C2.4 7 4 2.2 8 2.2 Z" fill="url(#pg-espalda)" stroke="#06080C" stroke-width=".3"/>
    <path d="M9.8 7 C12.2 8 12.6 12 12.2 15 C11.8 17.6 10.2 18.6 8.8 18.6 C7 18.6 6.2 16.8 6.4 14 C6.6 10.6 7.6 7.6 9.8 7 Z" fill="url(#pg-panza)"/>
    <path d="M10.6 5.8 C12 6.2 12.6 7.4 12.2 8.8 C11.4 8.2 10.6 7.4 10.6 5.8 Z" fill="url(#pg-mancha)"/>
    <ellipse cx="6" cy="5" rx="1.8" ry=".9" fill="#fff" opacity=".18" transform="rotate(-30 6 5)"/>
    ${ojo}
    <path d="M11.9 5.5 L15.4 6.3 L11.9 7.1 Z" fill="#1A1A1A"/><path d="M12.1 6.45 L14.8 6.4 L12.1 7 Z" fill="#FF8A3D"/>
    <g transform="rotate(${aleta} 6.4 8.4)"><path d="M6.4 8 C4.6 10 3.6 13 3.4 15.6 C4.8 14.2 6.2 12 7.1 9.6 Z" fill="url(#pg-espalda)" stroke="#06080C" stroke-width=".25"/><path d="M5.6 10 C4.8 11.6 4.3 13 4.1 14.4" stroke="#fff" stroke-width=".25" opacity=".2" fill="none"/></g>`;
}
export const capaPinguino = (op, dx, dy) => grupo(dx, dy, cuerpoPinguino(op));
export const pinguino = (op = {}, escala = 3) => envoltura(16, 20, escala, "pinguino", cuerpoPinguino(op));
// Juez del jurado: pingüino que mira a la izquierda con disfraz discreto (0 = sombrero de copa, 1 = moño, 2 = lentes)
// y una tablilla de calificación. La tablilla está en <g id="idTab"> (se sube con transform) y el número en
// <text id="idTab+n">.
export function capaJuez(k, dx, dy, idTab) {
  const disfraz = k === 0 ? `<ellipse cx="8.4" cy="2.9" rx="3.6" ry=".7" fill="#111"/><rect x="6.2" y="-1.6" width="4.4" height="4.4" rx=".5" fill="#1C1C22"/><rect x="6.2" y="1.4" width="4.4" height=".8" fill="#C62842"/><rect x="6.6" y="-1.2" width=".8" height="3.6" fill="#fff" opacity=".18"/>`
    : k === 1 ? `<path d="M9.6 9 L7.8 8 L7.8 10 Z M9.6 9 L11.4 8 L11.4 10 Z" fill="#D32F2F" stroke="#7A1010" stroke-width=".2"/><circle cx="9.6" cy="9" r=".45" fill="#9A1B1B"/>`
    : `<circle cx="10.2" cy="5.2" r="1.25" fill="#BFE6FF" fill-opacity=".25" stroke="#C9921E" stroke-width=".32"/><circle cx="12.6" cy="5.5" r="1" fill="#BFE6FF" fill-opacity=".25" stroke="#C9921E" stroke-width=".32"/><path d="M11.45 5.2 L11.6 5.3" stroke="#C9921E" stroke-width=".3"/>`;
  return grupo(dx, dy, `<g transform="translate(16 0) scale(-1 1)">${cuerpoPinguino({ aleta: 0 })}${disfraz}</g>
    <g id="${idTab}" transform="translate(0 16)" opacity="0"><rect x="7.6" y="-2" width=".7" height="12" rx=".3" fill="#9C7442"/><rect x="2.6" y="-9" width="10.7" height="7.6" rx="1.2" fill="#FFFFFF" stroke="#2A2340" stroke-width=".45"/><rect x="2.6" y="-9" width="10.7" height="2" rx="1" fill="#E9EDF5"/><text id="${idTab}n" x="7.95" y="-2.9" font-size="5.2" font-weight="800" text-anchor="middle" fill="#2A2340" font-family="Outfit, Arial, sans-serif">–</text></g>`);
}

// ---------- Escena de los clavados (172 × 140): iceberg con resbaladilla, mar y témpano del jurado ----------
// Temas: "polo" (día), "aurora" (noche con aurora) y "atardecer". Devuelve el fondo, la altura del mar, los puntos de
// la resbaladilla (curva cúbica) y dónde se paran los jueces.
export function escenaPinguino(w = 172, h = 140, semilla = 13, tema = "polo") {
  const r = azar(semilla), id = "pg" + (semilla % 997), mar = 96;
  const T = tema === "aurora" ? { c1: "#06142B", c2: "#0E3150", c3: "#1D6170", m1: "#155C78", m2: "#04243A", lejos: "#3E6E86" }
    : tema === "atardecer" ? { c1: "#F59B6B", c2: "#F8C99A", c3: "#FCE6C8", m1: "#3A93B4", m2: "#0C3D5C", lejos: "#E8D2D6" }
    : { c1: "#5FB4E6", c2: "#B6E1F5", c3: "#EAF7FD", m1: "#2E9CC4", m2: "#0A4A68", lejos: "#D6ECF7" };
  let s = `<defs>${degradado(id + "k", T.c1, T.c2, T.c3)}
    <linearGradient id="${id}m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${T.m1}"/><stop offset="1" stop-color="${T.m2}"/></linearGradient>
    <linearGradient id="${id}h" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".5" stop-color="#D4EEF9"/><stop offset="1" stop-color="#8CCBE4"/></linearGradient>
    <linearGradient id="${id}hs" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#A9DCF0"/><stop offset="1" stop-color="#5FA9C9"/></linearGradient>
    <linearGradient id="${id}r" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E8FAFF"/><stop offset="1" stop-color="#7CC6E2"/></linearGradient>
    <linearGradient id="${id}au" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5CFFB0" stop-opacity="0"/><stop offset=".5" stop-color="#5CFFB0" stop-opacity=".55"/><stop offset="1" stop-color="#3FD6E0" stop-opacity="0"/></linearGradient>
  </defs><rect width="${w}" height="${h}" fill="url(#${id}k)"/>`;
  if (tema === "aurora") { s += estrellas(r, w, 60, 40, "#E8F6FF"); s += `<path d="M0 30 C40 10 80 40 120 18 C140 8 160 20 172 14 L172 32 C150 40 130 28 110 42 C80 58 40 30 0 48 Z" fill="url(#${id}au)"/><path d="M10 50 C50 30 90 54 140 34 L172 30 L172 40 C130 52 90 64 10 60 Z" fill="url(#${id}au)" opacity=".6"/>`; }
  else if (tema === "atardecer") s += `<circle cx="128" cy="${mar - 6}" r="16" fill="#FFE9B0" opacity=".9"/><circle cx="128" cy="${mar - 6}" r="26" fill="#FFE9B0" opacity=".25"/>`;
  else s += `<circle cx="140" cy="22" r="10" fill="#FFFBE6"/><circle cx="140" cy="22" r="20" fill="#FFFBE6" opacity=".3"/>${[[40, 18], [100, 30]].map(([x, y]) => `<g opacity=".9"><ellipse cx="${x}" cy="${y}" rx="12" ry="3" fill="#fff"/><ellipse cx="${x - 4}" cy="${y - 2}" rx="6" ry="3" fill="#fff"/></g>`).join("")}`;
  s += `<path d="M70 ${mar} L80 ${mar - 10} L88 ${mar - 6} L96 ${mar - 14} L108 ${mar} Z M146 ${mar} L154 ${mar - 8} L166 ${mar - 5} L172 ${mar - 9} L172 ${mar} Z" fill="${T.lejos}" opacity=".9"/>`;
  s += `<rect x="0" y="${mar}" width="${w}" height="${h - mar}" fill="url(#${id}m)"/>`;
  for (let k = 0; k < 12; k++) { const x = r() * w, y = mar + 4 + r() * (h - mar - 8); s += `<path d="M${r2(x)} ${r2(y)} q3 -1.2 6 0" stroke="#fff" stroke-width=".5" fill="none" opacity="${r2(.2 + r() * .3)}"/>`; }
  // Iceberg con la plataforma arriba y la resbaladilla por el costado.
  s += `<path d="M0 40 L30 37 L36 44 L44 54 L52 66 L62 80 L66 ${mar} L0 ${mar} Z" fill="url(#${id}h)" stroke="#7CB8D2" stroke-width=".4"/>
    <path d="M30 37 L36 44 L44 54 L52 66 L62 80 L66 ${mar} L46 ${mar} L40 70 L34 52 Z" fill="url(#${id}hs)" opacity=".55"/>
    <path d="M0 ${mar} L66 ${mar} L60 ${mar + 12} L4 ${mar + 14} Z" fill="#7CC6E2" opacity=".45"/>
    <path d="M4 44 L26 41" stroke="#fff" stroke-width=".8" opacity=".8"/>
    <path d="M22 37.5 C34 39.5 46 64 58 73 C62 76 68 76 74 72" fill="none" stroke="#5FA9C9" stroke-width="5" stroke-linecap="round"/>
    <path d="M22 37.5 C34 39.5 46 64 58 73 C62 76 68 76 74 72" fill="none" stroke="url(#${id}r)" stroke-width="3.6" stroke-linecap="round"/>
    <path d="M23 36.3 C35 38.3 47 63 58.6 71.6 C62.4 74.4 67.6 74.4 73.4 70.8" fill="none" stroke="#fff" stroke-width=".6" opacity=".9"/>
    ${[[34, 42], [44, 55], [54, 69], [66, 75]].map(([x, y]) => `<rect x="${x - .6}" y="${y + 2}" width="1.2" height="${r2(mar - y - 2)}" fill="#A9DCF0" opacity=".7"/>`).join("")}
    <rect x="4" y="34.6" width="20" height="2.6" rx="1" fill="#C9ECF8" stroke="#7CB8D2" stroke-width=".3"/>`;
  // Témpano del jurado.
  s += `<ellipse cx="148" cy="128" rx="26" ry="5" fill="#0A4A68" opacity=".5"/><path d="M122 124 Q148 116 172 122 L172 130 Q148 134 124 130 Z" fill="url(#${id}h)" stroke="#7CB8D2" stroke-width=".4"/>`;
  return { svg: s, mar, rampa: [[22, 37.5], [34, 39.5], [46, 64], [58, 73]], salida: [74, 72], arriba: { x: 13, y: 35 }, jueces: [128, 142, 156], pisoJueces: 123 };
}

// ---------- Perro (border collie blanco y negro, sentado de frente; 80 × 70 con las patas en y = 68) ----------
// Grupos con clase para animar con CSS: perro-cola (mueve la cola), perro-cabeza (inclina, mastica, dice que no),
// boca-cerrada / boca-abierta.
const DEFS_PERRO = `<defs><linearGradient id="pe-negro" x1="0" y1="0" x2=".5" y2="1"><stop offset="0" stop-color="#4A4A55"/><stop offset=".5" stop-color="#1C1C22"/><stop offset="1" stop-color="#08080B"/></linearGradient>
  <linearGradient id="pe-blanco" x1="0" y1="0" x2=".4" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".7" stop-color="#ECEEF2"/><stop offset="1" stop-color="#C4C8D2"/></linearGradient>
  <radialGradient id="pe-ojo" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#B07A3E"/><stop offset="1" stop-color="#5A3414"/></radialGradient>
  <radialGradient id="pe-sombra" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#000" stop-opacity=".35"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient></defs>`;
function cuerpoPerro() {
  return `${DEFS_PERRO}<ellipse cx="40" cy="68" rx="30" ry="4" fill="url(#pe-sombra)"/>
  <g class="perro-cola"><path d="M52 60 C62 60 68 52 70 42 C71 37 75 36 75 41 C75 53 66 64 54 65 Z" fill="url(#pe-negro)"/><path d="M70 42 C71 37 75 36 75 41 C75 44 74 46 73 48 C72 46 70.6 44.6 70 42 Z" fill="url(#pe-blanco)"/></g>
  <ellipse cx="27" cy="58" rx="12" ry="10" fill="url(#pe-negro)"/><ellipse cx="53" cy="58" rx="12" ry="10" fill="url(#pe-negro)"/>
  <ellipse cx="17" cy="66" rx="5.4" ry="2.6" fill="url(#pe-blanco)"/><ellipse cx="63" cy="66" rx="5.4" ry="2.6" fill="url(#pe-blanco)"/>
  <path d="M26 34 C23 46 24 58 28 64 L52 64 C56 58 57 46 54 34 Z" fill="url(#pe-negro)"/>
  <path d="M29 30 C25 40 27 52 33 64 L47 64 C53 52 55 40 51 30 C46 35 34 35 29 30 Z" fill="url(#pe-blanco)"/>
  ${[[33, 38], [40, 40], [47, 38], [35, 45], [45, 45]].map(([x, y]) => `<path d="M${x - 2.6} ${y} q2.6 2 5.2 0" stroke="#C4C8D2" stroke-width=".6" fill="none" opacity=".8"/>`).join("")}
  <rect x="31" y="46" width="7.4" height="20" rx="3.6" fill="url(#pe-blanco)" stroke="#B9BDC8" stroke-width=".4"/><rect x="41.6" y="46" width="7.4" height="20" rx="3.6" fill="url(#pe-blanco)" stroke="#B9BDC8" stroke-width=".4"/>
  <ellipse cx="34.7" cy="66" rx="4.8" ry="2.4" fill="url(#pe-blanco)" stroke="#B9BDC8" stroke-width=".4"/><ellipse cx="45.3" cy="66" rx="4.8" ry="2.4" fill="url(#pe-blanco)" stroke="#B9BDC8" stroke-width=".4"/>
  <path d="M33 66.6 v1 M35.4 66.8 v1 M43.6 66.8 v1 M46 66.6 v1" stroke="#A9AEBA" stroke-width=".5" stroke-linecap="round"/>
  <path d="M28.6 31 Q40 37.4 51.4 31 L51 34 Q40 40.4 29 34 Z" fill="#D23B4E"/><circle cx="40" cy="38.6" r="2.1" fill="#FFC93D" stroke="#B57A12" stroke-width=".4"/><circle cx="39.4" cy="38" r=".6" fill="#fff" opacity=".7"/>
  <g class="perro-cabeza">
    <g class="perro-oreja-a"><path d="M22 15 C19.6 7 21.6 .6 27 .2 C30.2 3 31.4 8.4 30.4 14 Z" fill="url(#pe-negro)"/><path d="M24.2 12 C23 7 24.2 3.4 26.6 2.6 C28.2 5 28.6 8.6 28.2 12 Z" fill="#6E5E66" opacity=".6"/><path d="M27 .2 C29 1.4 30.6 3.6 31 6 C29.2 5 27.6 4.4 26 4.6 Z" fill="#2A2A30"/></g>
    <g class="perro-oreja-b"><path d="M58 15 C60.4 7 58.4 .6 53 .2 C49.8 3 48.6 8.4 49.6 14 Z" fill="url(#pe-negro)"/><path d="M55.8 12 C57 7 55.8 3.4 53.4 2.6 C51.8 5 51.4 8.6 51.8 12 Z" fill="#6E5E66" opacity=".6"/><path d="M53 .2 C51 1.4 49.4 3.6 49 6 C50.8 5 52.4 4.4 54 4.6 Z" fill="#2A2A30"/></g>
    <ellipse cx="40" cy="18" rx="15.5" ry="13.4" fill="url(#pe-negro)"/>
    <path d="M38 5.4 C37 10 35 14 33 20 C31 24.4 31 28.4 34 31.4 L46 31.4 C49 28.4 49 24.4 47 20 C45 14 43 10 42 5.4 Z" fill="url(#pe-blanco)"/>
    <ellipse cx="40" cy="25.6" rx="8.6" ry="6.4" fill="url(#pe-blanco)"/>
    <ellipse cx="34" cy="9" rx="4" ry="2" fill="#fff" opacity=".12" transform="rotate(-20 34 9)"/>
    <circle cx="33.4" cy="16.4" r="2.3" fill="url(#pe-ojo)"/><circle cx="33.6" cy="16.6" r="1.1" fill="#120A04"/><circle cx="32.8" cy="15.6" r=".6" fill="#fff"/>
    <circle cx="46.6" cy="16.4" r="2.3" fill="url(#pe-ojo)"/><circle cx="46.8" cy="16.6" r="1.1" fill="#120A04"/><circle cx="46" cy="15.6" r=".6" fill="#fff"/>
    <path d="M30.6 13.2 Q33.4 11.8 35.8 13 M44.2 13 Q46.6 11.8 49.4 13.2" stroke="#4A4A55" stroke-width=".7" fill="none" stroke-linecap="round"/>
    <path d="M36.6 21 Q40 19.6 43.4 21 Q43 23.6 40 24.2 Q37 23.6 36.6 21 Z" fill="#141418"/><ellipse cx="38.8" cy="20.9" rx="1.1" ry=".5" fill="#fff" opacity=".45"/>
    <g class="boca-cerrada"><path d="M40 24.2 V25.6 M36.2 25.8 Q38.2 27.6 40 25.6 Q41.8 27.6 43.8 25.8" stroke="#2A2A30" stroke-width=".7" fill="none" stroke-linecap="round"/></g>
    <g class="boca-abierta" opacity="0"><path d="M35.4 25.4 Q40 32.6 44.6 25.4 Q40 27 35.4 25.4 Z" fill="#6A1E2A"/><path d="M37.6 27.6 Q40 33.6 42.4 27.6 Q40 28.8 37.6 27.6 Z" fill="#F27A92"/><path d="M40 28.4 V31" stroke="#C94A64" stroke-width=".4"/></g>
  </g>`;
}
export const capaPerro = (dx, dy) => grupo(dx, dy, cuerpoPerro());
// Plato de acero (40 × 14, base en y = 14) con franja de color y croquetas.
export const capaPlato = (dx, dy, franja = "#2BB673", id = "pl") => grupo(dx, dy, `<defs><linearGradient id="${id}a" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#F4F7FB"/><stop offset=".45" stop-color="#C3CAD5"/><stop offset="1" stop-color="#7E8794"/></linearGradient></defs>
  <ellipse cx="20" cy="14" rx="21" ry="2.4" fill="#000" opacity=".18"/>
  <path d="M1 4 L5 13 Q20 16 35 13 L39 4 Z" fill="url(#${id}a)" stroke="#6E7784" stroke-width=".4"/>
  <path d="M2.6 7.6 Q20 10.6 37.4 7.6 L36.4 9.8 Q20 12.8 3.6 9.8 Z" fill="${franja}"/>
  <ellipse cx="20" cy="4" rx="19" ry="3.2" fill="#E9EDF3" stroke="#6E7784" stroke-width=".4"/><ellipse cx="20" cy="4.4" rx="16" ry="2.2" fill="#8E97A4"/>
  ${[[13, 4.2], [17, 3.6], [21, 4.4], [25, 3.8], [28, 4.6], [15.6, 5], [23.4, 5.2]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="1.4" ry=".9" fill="#9A5F2E"/><ellipse cx="${x - .3}" cy="${y - .3}" rx=".5" ry=".25" fill="#D9A066" opacity=".8"/>`).join("")}
  <ellipse cx="8" cy="5.6" rx="3" ry=".5" fill="#fff" opacity=".7"/>`);
// Jardín del perro (300 × 146): cielo, árboles lejanos, cerca blanca y pasto. Piso en y = 128.
export function escenaPerro(w = 300, h = 146) {
  const id = "pe";
  let s = `<defs>${degradado(id + "k", "#9AD3F2", "#D7EEF8", "#F4FAF2")}<linearGradient id="${id}p" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9CD56A"/><stop offset="1" stop-color="#4E8F35"/></linearGradient>
    <radialGradient id="${id}a" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#9FD36E"/><stop offset="1" stop-color="#3C7A2E"/></radialGradient>
    <linearGradient id="${id}c" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#D5DAE2"/></linearGradient></defs>
    <rect width="${w}" height="${h}" fill="url(#${id}k)"/>
    ${[[40, 20], [150, 14], [250, 24]].map(([x, y]) => `<g opacity=".9"><ellipse cx="${x}" cy="${y}" rx="18" ry="4.4" fill="#fff"/><ellipse cx="${x - 6}" cy="${y - 3}" rx="9" ry="4.4" fill="#fff"/></g>`).join("")}
    ${[[20, 1], [70, .8], [230, .9], [285, 1.1]].map(([x, e]) => `<g transform="translate(${x} 92) scale(${e})"><rect x="-2" y="-14" width="4" height="16" fill="#7A5230"/><circle cx="-6" cy="-18" r="10" fill="url(#${id}a)"/><circle cx="6" cy="-20" r="11" fill="url(#${id}a)"/><circle cx="0" cy="-28" r="10" fill="url(#${id}a)"/></g>`).join("")}`;
  for (let x = 2; x < w; x += 12) s += `<path d="M${x} 104 V84 l3.5 -4 l3.5 4 V104 Z" fill="url(#${id}c)" stroke="#B9C0CC" stroke-width=".4"/>`;
  s += `<rect x="0" y="88" width="${w}" height="3" fill="#E9EDF3"/><rect x="0" y="97" width="${w}" height="3" fill="#E9EDF3"/>
    <rect x="0" y="102" width="${w}" height="${h - 102}" fill="url(#${id}p)"/>
    <ellipse cx="${w / 2}" cy="132" rx="140" ry="12" fill="#C9A36E" opacity=".35"/>`;
  for (let k = 0; k < 40; k++) { const x = (k * 37) % w, y = 106 + ((k * 13) % 36); s += `<path d="M${x} ${y} l1 -3 l1 3" stroke="#3E7A2C" stroke-width=".6" fill="none" opacity=".6"/>`; }
  return { svg: s, suelo: 128 };
}
