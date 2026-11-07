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
// La cara son luces LED sobre el visor: ojos, boca y cachetes se encienden distinto en cada expresión. El traje es crema
// con sombra gris-lavanda rayada (como impresión retro), franjas y guantes naranja, panel de pecho amarillo, hombreras,
// articulaciones con rayitas, reloj en la muñeca, bolsillo, botas con suela y hebilla, mochila gris con luz roja y
// tanques, anillo del cuello, visera sobre el visor y una chispa en la antena (la "spark" de SparkEd).
// Sparky vivo (7 nov 2026, Daniel: "que tenga un poquito más de vida y no parezca que está confundido todo el tiempo"):
// poses nuevas que se mueven solo con CSS (construyendo, caminando, escribiendo) y accesorios que se suman a cualquier
// pose con "+": "+casco" (casco amarillo de obra; la antena sale por arriba) y "+taller" (bloques de colores en el piso;
// el dibujo se hace más ancho). Las piezas que se mueven van en grupos con clase (sk-cuerpo, sk-cara, sk-mano,
// sk-martillo, sk-pierna-a…); las animaciones están en base.css y solo corren dentro de un contenedor .sk-anima.
const S = { luz: "#FBF7EE", sombra: "#DAD8E8", costura: "#B9B4D0", gris: "#9CA2B8", grisOscuro: "#636A86", naranja: "#FF7A3D", amarillo: "#FFC247", rojo: "#FF4D5E", visor: "#1A1733", led: "#7DF9FF", ledSuave: "#5BB8FF", cachete: "#FF8FB1" };
const r2 = (v) => Math.round(v * 100) / 100;
const RAYAS = `<defs><pattern id="sk-rayas" width="1" height=".6" patternUnits="userSpaceOnUse"><rect width="1" height=".2" fill="#2A2340" opacity=".13"/></pattern><pattern id="sk-scan" width="1" height=".5" patternUnits="userSpaceOnUse"><rect width="1" height=".16" fill="#fff" opacity=".07"/></pattern></defs>`;
const chispa = (cx, cy, R, r, fill, sw = .3) => { const k = r * Math.SQRT1_2; return `<path d="M${cx} ${cy - R} L${cx + k} ${cy - k} L${cx + R} ${cy} L${cx + k} ${cy + k} L${cx} ${cy + R} L${cx - k} ${cy + k} L${cx - R} ${cy} L${cx - k} ${cy - k} Z" fill="${fill}" ${o(sw)}/>`; };
const ojoLed = (x, y, w, h, color) => `<g class="led-ojo"><rect x="${x - .35}" y="${y - .35}" width="${w + .7}" height="${h + .7}" rx="${h / 2}" fill="${color}" opacity=".28"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.min(w, h) * .4}" fill="${color}"/></g>`;
const bocaLed = (d, color, sw = .5) => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`;
const cachetes = (color = S.cachete) => `<circle cx="5.5" cy="7.05" r=".38" fill="${color}" opacity=".9"/><circle cx="10.5" cy="7.05" r=".38" fill="${color}" opacity=".9"/>`;
// La expresión de cada pose, dibujada solo con luces.
function caraLed(pose) {
  if (pose === "saludo") return `${bocaLed("M5.75 6.25 q.85 -1.35 1.7 0", S.led, .6)}${bocaLed("M8.55 6.25 q.85 -1.35 1.7 0", S.led, .6)}${bocaLed("M6.9 7.3 q1.1 1.3 2.2 0", S.led)}${cachetes()}`;
  if (pose === "festejo") return `${chispa(6.65, 5.9, 1.05, .38, S.led, 0)}${chispa(9.35, 5.9, 1.05, .38, S.led, 0)}<path d="M6.8 7.15 h2.4 a1.2 1.1 0 0 1 -2.4 0 z" fill="${S.led}"/>${cachetes()}`;
  if (pose === "triste") return `${ojoLed(5.9, 5.5, 1.5, 1.3, S.ledSuave)}${ojoLed(8.6, 5.5, 1.5, 1.3, S.ledSuave)}${bocaLed("M5.8 5.35 l1.5 -.55", S.ledSuave, .4)}${bocaLed("M10.2 5.35 l-1.5 -.55", S.ledSuave, .4)}${bocaLed("M7.1 7.95 q.9 -.85 1.8 0", S.ledSuave)}<path d="M6.5 7.1 q.55 .95 0 1.35 q-.55 -.4 0 -1.35 z" fill="${S.ledSuave}"/>`;
  if (pose === "pensando") return `${ojoLed(5.9, 4.9, 1.5, 2, S.led)}<rect x="8.6" y="5.55" width="1.5" height=".65" rx=".32" fill="${S.led}"/>${bocaLed("M7.3 7.7 l1.4 -.35", S.led)}${cachetes()}`;
  // Construyendo: mira el martillo (abajo a la derecha) muy contento, con la boca abierta.
  if (pose === "construyendo") return `${ojoLed(6.3, 5.15, 1.5, 1.85, S.led)}${ojoLed(9, 5.15, 1.5, 1.85, S.led)}<path d="M7.45 7.3 h2.2 a1.1 1 0 0 1 -2.2 0 z" fill="${S.led}"/>${cachetes()}`;
  // Caminando: los ojos miran hacia donde va (a la derecha; al voltear, el dibujo se refleja).
  if (pose === "caminando") return `${ojoLed(6.35, 4.9, 1.5, 2, S.led)}${ojoLed(9.05, 4.9, 1.5, 2, S.led)}${bocaLed("M7.55 7.5 q.9 .85 1.8 0", S.led)}${cachetes()}`;
  // Escribiendo: mira la hoja (abajo) y saca la lengüita, como quien escribe con cuidado.
  if (pose === "escribiendo") return `${ojoLed(5.75, 5.45, 1.5, 1.7, S.led)}${ojoLed(8.45, 5.45, 1.5, 1.7, S.led)}${bocaLed("M6.85 7.6 q.8 .7 1.6 0", S.led)}<path d="M7.95 7.88 q.48 -.04 .48 .42 q0 .36 -.36 .34 q-.34 -.04 -.28 -.42 z" fill="${S.cachete}"/>${cachetes()}`;
  return `${ojoLed(5.9, 4.9, 1.5, 2, S.led)}${ojoLed(8.6, 4.9, 1.5, 2, S.led)}${bocaLed("M7.1 7.5 q.9 .85 1.8 0", S.led)}${cachetes()}`;
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
const pierna = (x) => `
    <rect x="${x}" y="16" width="2.8" height="2.6" rx="1.1" fill="${S.luz}" ${o(.5)}/>
    <rect x="${x}" y="16.6" width="2.8" height=".7" fill="${S.naranja}" ${o(.3)}/>
    <line x1="${x + .5}" y1="17.75" x2="${x + 2.3}" y2="17.75" stroke="${S.costura}" stroke-width=".22"/><line x1="${x + .5}" y1="18.1" x2="${x + 2.3}" y2="18.1" stroke="${S.costura}" stroke-width=".22"/>
    <rect x="${x - .4}" y="17.9" width="3.6" height="1.4" rx=".65" fill="${S.luz}"/>
    <rect x="${x - .4}" y="18.75" width="3.6" height=".55" rx=".27" fill="${S.grisOscuro}"/>
    <rect x="${x - .4}" y="17.9" width="3.6" height="1.4" rx=".65" fill="none" ${o(.45)}/>
    <rect x="${x + .7}" y="18.15" width=".9" height=".45" rx=".15" fill="${S.gris}" ${o(.25)}/>`;
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

function cuerpoSparky(frame) {
  const { pose, casco, taller } = typeof frame === "string" ? leerPose(frame) : frame;
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
    piernas = `<g class="sk-pierna sk-pierna-a">${pierna(4.6)}</g><g class="sk-pierna sk-pierna-b">${pierna(8.6)}</g>`;
    brazosAtras = giro(3.25, 11.1, "sk-braceo", brazo(2.1, 10.9, 0, true)) + giro(12.75, 11.1, "sk-braceo", brazo(11.6, 10.9, 0, false));
  } else if (pose === "construyendo") {
    // Quieto, el martillo queda arriba listo para pegar (-130°); la animación lo baja hasta el bloque (+78°).
    brazosAtras = brazo(2.1, 10.9, 0, true) + giro(12.75, 11.1, "sk-martillo", `<g transform="rotate(-130 12.75 11.1)">${martillo()}${brazo(11.6, 10.9, 0, false)}</g>`, 8.3);
  } else if (pose === "escribiendo") {
    // Los dos brazos van al frente, detrás de la tabla: la mano izquierda la sostiene por la orilla y la derecha
    // escribe encima de la hoja (renglón por renglón, con el lápiz garabateando).
    brazosAtras = "";
    frente = `${brazo(11.6, 10.9, 51.2, false)}${brazo(2.1, 10.9, -31.6, true)}${tablaNotas()}${guante(5.82, 15.27)}<g class="sk-escritura">${giro(8.93, 14.17, "sk-garabato", manoConLapiz(), 3.5)}</g>`;
  }
  const inclinacion = pose === "triste" ? `transform="rotate(8 8 7)"` : "";
  const antena = casco ? "" : `<line x1="8" y1="1.9" x2="8" y2="1.3" ${o(.5)}/>${chispa(8, .95, .85, .3, S.amarillo)}`;
  return `${RAYAS}
    <ellipse class="sk-sombra" cx="8" cy="19.35" rx="5.4" ry=".62" fill="${C.sombra}"/>
    ${taller ? tallerBloques() : ""}
    <g class="sk-cuerpo"><rect x="-5" y="-2" width="26" height="21.3" fill="none"/>
    <rect x="3.3" y="8.5" width="1.2" height="1.4" rx=".5" fill="${S.grisOscuro}" ${o(.4)}/><rect x="11.5" y="8.5" width="1.2" height="1.4" rx=".5" fill="${S.grisOscuro}" ${o(.4)}/>
    <rect x="3" y="9.4" width="10" height="6.8" rx="1.8" fill="${S.gris}" ${o(.5)}/>
    <rect x="3.3" y="14" width="9.4" height="1.9" rx="1" fill="${S.grisOscuro}"/>
    <rect x="12" y="10.2" width=".6" height="1.5" rx=".25" fill="${S.rojo}"/><rect x="11.8" y="10" width="1" height="1.9" rx=".4" fill="${S.rojo}" opacity=".35"/>
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
      <circle cx="8" cy="6.1" r="4.7" fill="${S.sombra}" ${o(.6)}/><circle cx="8" cy="6.1" r="4.7" fill="url(#sk-rayas)"/>
      <circle cx="7.7" cy="5.7" r="4.1" fill="${S.luz}"/>
      <rect x="4.7" y="3.4" width="6.6" height="5.3" rx="2.4" fill="${S.visor}" ${o(.45)}/><rect x="4.7" y="3.4" width="6.6" height="5.3" rx="2.4" fill="url(#sk-scan)"/>
      <path d="M5.3 5.2 q.1 -1.3 1.3 -1.5 h1.3 l-2.3 3.6 q-.5 -1 -.3 -2.1 z" fill="#fff" opacity=".12"/>
      <g class="sk-cara">${caraLed(pose)}</g>
      <rect x="4.4" y="2.75" width="7.2" height=".85" rx=".4" fill="${S.gris}" ${o(.35)}/>
      <ellipse cx="5.7" cy="4.35" rx=".65" ry=".34" fill="#fff" opacity=".5" transform="rotate(-25 5.7 4.35)"/>
      ${casco ? cascoObra() : ""}
    </g>
    ${encima}</g>
    ${extras}${taller ? chispasGolpe() : ""}`;
}
const POSES = ["quieto", "saludo", "festejo", "triste", "pensando", "construyendo", "caminando", "escribiendo"];
// "festejo+casco+taller" → pose festejo con casco de obra y los bloques del taller. "construyendo" ya trae los dos.
function leerPose(frame) {
  const [p, ...acc] = String(frame ?? "quieto").split("+");
  const pose = POSES.includes(p) ? p : "quieto";
  return { pose, casco: pose === "construyendo" || acc.includes("casco"), taller: pose === "construyendo" || acc.includes("taller") };
}
// Marco del dibujo: 16 × 20 de siempre; con casco crece hacia arriba (la antena) y con taller hacia la derecha (bloques).
const marcoSparky = ({ casco, taller }) => [0, casco ? -1.4 : 0, taller ? 21.8 : 16, casco ? 21.4 : 20];
export const sparky = (frame = "quieto", escala = 4, extra = "") => {
  const f = leerPose(frame), [x, y, w, h] = marcoSparky(f);
  return `<svg class="vec sparky pose-${f.pose}" viewBox="${x} ${y} ${w} ${h}" width="${r2(w * escala)}" height="${r2(h * escala)}" xmlns="http://www.w3.org/2000/svg" ${extra}>${cuerpoSparky(f)}</svg>`;
};
export const capaSparky = (frame, dx, dy) => grupo(dx, dy, cuerpoSparky(leerPose(frame)));

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
function cuerpoCaballo(color) {
  const [c1, c2] = COLORES_COCHE[color] ?? COLORES_COCHE.rojo;
  return `
    <ellipse cx="12" cy="9.5" rx="9" ry=".6" fill="${C.sombra}"/>
    <path d="M6 5.6 Q2.4 4.2 1 6.8 Q2.8 5.8 4.4 7.6 Q4.6 6.4 6.4 6.6 Z" fill="${c2}" ${o(.4)}/>
    <rect x="6.2" y="6.4" width="1.8" height="3.2" rx=".8" fill="${c1}" ${o(.4)} transform="rotate(18 7.1 6.4)"/>
    <rect x="8.2" y="6.4" width="1.8" height="3.2" rx=".8" fill="${c2}" ${o(.4)} transform="rotate(-12 9.1 6.4)"/>
    <rect x="15.4" y="6.4" width="1.8" height="3.2" rx=".8" fill="${c2}" ${o(.4)} transform="rotate(14 16.3 6.4)"/>
    <rect x="17.2" y="6.4" width="1.8" height="3.2" rx=".8" fill="${c1}" ${o(.4)} transform="rotate(-22 18.1 6.4)"/>
    <ellipse cx="12" cy="5.4" rx="6.6" ry="2.6" fill="${c1}" ${o(.5)}/>
    <ellipse cx="12" cy="6.4" rx="5.4" ry="1.3" fill="#fff" opacity=".2"/>
    <path d="M16.2 3.6 L19.6 .9 L21.8 2.4 L18.6 5.6 Z" fill="${c1}" ${o(.5)}/>
    <path d="M17.2 3 Q18.8 1.6 20.4 1.2 L20.2 2.2 Q18.8 2.6 17.6 3.6 Z" fill="${c2}" ${o(.3)}/>
    <ellipse cx="21.6" cy="2.4" rx="2.6" ry="1.35" fill="${c1}" ${o(.5)} transform="rotate(-24 21.6 2.4)"/>
    <circle cx="23.2" cy="1.9" r=".55" fill="${c2}"/>
    <path d="M20.2 1.4 L19.8 -.2 L21.2 1 Z" fill="${c1}" ${o(.3)}/>
    <circle cx="21.4" cy="1.8" r=".35" fill="${C.linea}"/>
    <rect x="9.6" y="3" width="4.2" height="2" rx=".9" fill="#FFD400" ${o(.4)}/>
    <rect x="11.2" y="2.4" width="1" height="3.4" rx=".5" fill="${C.linea}" opacity=".5"/>`;
}
function cuerpoDragon(color) {
  const [c1, c2] = COLORES_COCHE[color] ?? COLORES_COCHE.rojo;
  return `
    <ellipse cx="12" cy="9.5" rx="9" ry=".6" fill="${C.sombra}"/>
    <path d="M10.5 4 Q7.5 -.5 3.2 .4 Q8 .2 10.8 4.6 Z" fill="${c2}" ${o(.4)}/>
    <path d="M6.4 5.6 Q2.6 4.4 .6 6.6 Q2.4 5.8 3.6 7.2 Q4.4 6.2 6.6 6.8 Z" fill="${c1}" ${o(.4)}/>
    <path d="M1.2 6.4 L-.2 5.6 L.2 7.6 Z" fill="${c2}" ${o(.3)}/>
    <ellipse cx="12" cy="5.8" rx="6.2" ry="2.5" fill="${c1}" ${o(.5)}/>
    <ellipse cx="12" cy="6.9" rx="5" ry="1.1" fill="#FFE9A8" opacity=".55"/>
    <rect x="9" y="7.4" width="1.8" height="2.2" rx=".8" fill="${c1}" ${o(.35)}/><rect x="13.4" y="7.4" width="1.8" height="2.2" rx=".8" fill="${c1}" ${o(.35)}/>
    <path d="M16.4 4.6 L19.6 2.2 L23 2.6 L23.6 4.1 L21 5 L17.8 5.9 Z" fill="${c1}" ${o(.5)}/>
    <path d="M19.8 2.2 L19.4 .6 L21 2.2 Z" fill="${c2}" ${o(.3)}/><path d="M21.4 2.4 L21.6 .9 L22.6 2.5 Z" fill="${c2}" ${o(.3)}/>
    <circle cx="21.6" cy="3.3" r=".6" fill="#fff"/><circle cx="21.8" cy="3.3" r=".3" fill="${C.linea}"/>
    <path d="M23.6 3.6 L25 3.1 L25.2 3.9 L24.2 4.3 Z" fill="#FF8A3D"/><path d="M23.8 3.7 L24.8 3.4 L24.6 4 Z" fill="#FFE066"/>
    <path d="M11.2 4.2 Q9.8 -.6 5.6 -.4 Q10 .6 12.6 4.4 Z" fill="${c2}" ${o(.45)}/>
    <path d="M7 3.4 L8.4 2.4 L9 3.8 L10.4 2.8 L11 4.2" fill="none" stroke="${c2}" stroke-width=".5"/>`;
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

// Marco SVG listo para insertar: toma el fondo y agrega capas (personajes) encima.
export function escenaSvg(fondo, w, h, capas = "", extra = "") {
  return `<svg class="escena" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" ${extra}>${fondo}${capas}</svg>`;
}
