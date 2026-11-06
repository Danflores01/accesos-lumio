// Pixel art en código: cada sprite es un mapa de letras; cada letra es un color de la paleta.
// Se dibuja como SVG con bordes nítidos, así escala a cualquier tamaño sin verse borroso.
// "." = transparente.

export function sprite(mapa, paleta, opciones = {}) {
  const filas = mapa.trim().split("\n").map((f) => f.trim());
  const alto = filas.length;
  const ancho = Math.max(...filas.map((f) => f.length));
  const escala = opciones.escala ?? 4;
  const extra = opciones.atributos ?? "";
  let rects = "";
  for (let y = 0; y < alto; y++) {
    const fila = filas[y];
    let x = 0;
    while (x < ancho) {
      const c = fila[x] ?? ".";
      if (c === "." || c === " ") { x++; continue; }
      let w = 1;
      while (x + w < ancho && (fila[x + w] ?? ".") === c) w++;
      const color = paleta[c] ?? "#000";
      rects += `<rect x="${x}" y="${y}" width="${w}" height="1" fill="${color}"/>`;
      x += w;
    }
  }
  const clase = opciones.clase ? ` class="${opciones.clase}"` : "";
  return `<svg${clase} viewBox="0 0 ${ancho} ${alto}" width="${ancho * escala}" height="${alto * escala}" shape-rendering="crispEdges" ${extra} xmlns="http://www.w3.org/2000/svg">${rects}</svg>`;
}

// Devuelve solo los <rect> de un mapa, desplazados, para componer escenas dentro de un SVG más grande.
export function capa(mapa, paleta, dx = 0, dy = 0, flip = false) {
  const filas = mapa.trim().split("\n").map((f) => f.trim());
  const ancho = Math.max(...filas.map((f) => f.length));
  let rects = "";
  filas.forEach((fila, y) => {
    for (let x = 0; x < ancho; x++) {
      const c = fila[x] ?? ".";
      if (c === "." || c === " ") continue;
      const px = flip ? ancho - 1 - x : x;
      rects += `<rect x="${dx + px}" y="${dy + y}" width="1" height="1" fill="${paleta[c] ?? "#000"}"/>`;
    }
  });
  return rects;
}

export const medidas = (mapa) => {
  const filas = mapa.trim().split("\n").map((f) => f.trim());
  return { ancho: Math.max(...filas.map((f) => f.length)), alto: filas.length };
};
