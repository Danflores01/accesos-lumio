// deno-lint-ignore-file no-explicit-any
// Imágenes de los mensajes de WhatsApp (pedido de Daniel, 9 nov 2026).
//  - Entrega: una plantilla PNG (Sparky sujetando una tarjeta blanca) con el código QR de ESA guía dibujado en la zona
//    vacía de la tarjeta, para que la familia abra la guía con el link o escaneando el código desde otro dispositivo.
//  - Compartir: una imagen fija (Sparky saludando).
// El arte vive en el sitio, no en la función: <sitio>img/wa/entrega-<idioma>.png, <sitio>img/wa/compartir-<idioma>.png y
// <sitio>img/wa/manifiesto.json (dónde va el QR). Cambiar el arte no requiere desplegar; si un archivo no existe o algo
// falla, estas funciones devuelven null y whatsapp.ts manda el texto de siempre.
// Sin bibliotecas de imagen: lector y escritor de PNG mínimos con la compresión nativa (DecompressionStream y
// CompressionStream). Este módulo no importa nada: la matriz del QR la calcula qr.ts y llega ya hecha (así se prueba con Node).

export type Zona = { x: number; y: number; lado: number };
// Imagen en memoria: siempre RGB de 8 bits (la transparencia de la plantilla, si la hay, se aplana sobre blanco).
export type Imagen = { ancho: number; alto: number; px: Uint8Array };
export type Idioma = "es" | "en";

// ---------- PNG ----------
const FIRMA = [137, 80, 78, 71, 13, 10, 26, 10];
const TABLA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(bytes: Uint8Array): number {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) crc = TABLA_CRC[(crc ^ bytes[i]) & 255] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
async function pasar(datos: Uint8Array, flujo: any): Promise<Uint8Array> {
  return new Uint8Array(await new Response(new Blob([datos as any]).stream().pipeThrough(flujo)).arrayBuffer());
}

// Lee un PNG de 8 bits RGB o RGBA sin entrelazado (lo que exporta cualquier programa) y lo deja en RGB.
export async function leerPng(bytes: Uint8Array): Promise<Imagen> {
  for (let i = 0; i < 8; i++) if (bytes[i] !== FIRMA[i]) throw new Error("no es un PNG");
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let p = 8, ancho = 0, alto = 0, canales = 0;
  const idat: Uint8Array[] = [];
  while (p + 12 <= bytes.length) {
    const largo = v.getUint32(p), tipo = String.fromCharCode(bytes[p + 4], bytes[p + 5], bytes[p + 6], bytes[p + 7]);
    if (tipo === "IHDR") {
      ancho = v.getUint32(p + 8); alto = v.getUint32(p + 12);
      const tipoColor = bytes[p + 17];
      if (bytes[p + 16] !== 8 || (tipoColor !== 2 && tipoColor !== 6) || bytes[p + 20] !== 0) throw new Error("PNG no admitido: se espera RGB o RGBA de 8 bits, sin entrelazado");
      canales = tipoColor === 6 ? 4 : 3;
    } else if (tipo === "IDAT") idat.push(bytes.subarray(p + 8, p + 8 + largo));
    else if (tipo === "IEND") break;
    p += 12 + largo;
  }
  if (!ancho || !alto || !canales || !idat.length || ancho * alto > 4_000_000) throw new Error("PNG incompleto o demasiado grande");
  const junto = new Uint8Array(idat.reduce((n, d) => n + d.length, 0));
  let o = 0; for (const d of idat) { junto.set(d, o); o += d.length; }
  const crudo = await pasar(junto, new DecompressionStream("deflate"));
  const fila = ancho * canales;
  if (crudo.length !== (fila + 1) * alto) throw new Error("PNG dañado");
  // Quita el filtro de cada renglón, sobre el mismo arreglo (a = píxel de la izquierda, b = de arriba, c = arriba a la izquierda).
  for (let y = 0; y < alto; y++) {
    const f = crudo[y * (fila + 1)], ini = y * (fila + 1) + 1, arr = ini - (fila + 1);
    if (f === 0) continue;
    if (f > 4) throw new Error("PNG dañado");
    for (let x = 0; x < fila; x++) {
      const a = x >= canales ? crudo[ini + x - canales] : 0, b = y > 0 ? crudo[arr + x] : 0, c = x >= canales && y > 0 ? crudo[arr + x - canales] : 0;
      let suma = a;
      if (f === 2) suma = b;
      else if (f === 3) suma = (a + b) >> 1;
      else if (f === 4) { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c); suma = pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      crudo[ini + x] = (crudo[ini + x] + suma) & 255;
    }
  }
  const px = new Uint8Array(ancho * alto * 3);
  for (let y = 0, d = 0; y < alto; y++) {
    let s = y * (fila + 1) + 1;
    for (let x = 0; x < ancho; x++, s += canales, d += 3) {
      if (canales === 3 || crudo[s + 3] === 255) { px[d] = crudo[s]; px[d + 1] = crudo[s + 1]; px[d + 2] = crudo[s + 2]; }
      else { const al = crudo[s + 3], bl = 255 - al; px[d] = (crudo[s] * al + 255 * bl) / 255; px[d + 1] = (crudo[s + 1] * al + 255 * bl) / 255; px[d + 2] = (crudo[s + 2] * al + 255 * bl) / 255; }
    }
  }
  return { ancho, alto, px };
}

// Escribe un PNG RGB de 8 bits. Cada renglón se guarda como diferencia con el de arriba (filtro «Up»): con arte de
// colores planos y degradados verticales comprime bien y cuesta un solo recorrido.
export async function escribirPng(img: Imagen): Promise<Uint8Array> {
  const { ancho, alto, px } = img, fila = ancho * 3;
  const crudo = new Uint8Array((fila + 1) * alto);
  crudo.set(px.subarray(0, fila), 1);
  for (let y = 1; y < alto; y++) {
    const o = y * (fila + 1), s = y * fila;
    crudo[o] = 2;
    for (let i = 0; i < fila; i++) crudo[o + 1 + i] = (px[s + i] - px[s - fila + i]) & 255;
  }
  const z = await pasar(crudo, new CompressionStream("deflate"));
  const trozo = (tipo: string, datos: Uint8Array) => {
    const t = new Uint8Array(12 + datos.length), dv = new DataView(t.buffer);
    dv.setUint32(0, datos.length);
    for (let i = 0; i < 4; i++) t[4 + i] = tipo.charCodeAt(i);
    t.set(datos, 8);
    dv.setUint32(8 + datos.length, crc32(t.subarray(4, 8 + datos.length)));
    return t;
  };
  const ihdr = new Uint8Array(13), dv = new DataView(ihdr.buffer);
  dv.setUint32(0, ancho); dv.setUint32(4, alto); ihdr[8] = 8; ihdr[9] = 2;
  const partes = [new Uint8Array(FIRMA), trozo("IHDR", ihdr), trozo("IDAT", z), trozo("IEND", new Uint8Array(0))];
  const out = new Uint8Array(partes.reduce((n, q) => n + q.length, 0));
  let o = 0; for (const q of partes) { out.set(q, o); o += q.length; }
  return out;
}

// ---------- Código QR ----------
const TINTA: [number, number, number] = [30, 27, 58];   // #1E1B3A, el azul casi negro de las líneas de SparkEd
function rectangulo(img: Imagen, x: number, y: number, w: number, h: number, [r, g, b]: [number, number, number]) {
  for (let j = y; j < y + h; j++) {
    let p = (j * img.ancho + x) * 3;
    for (let i = 0; i < w; i++, p += 3) { img.px[p] = r; img.px[p + 1] = g; img.px[p + 2] = b; }
  }
}
export function zonaValida(z: any, img: Imagen): Zona {
  const x = Math.round(Number(z?.x)), y = Math.round(Number(z?.y)), lado = Math.round(Number(z?.lado));
  if (![x, y, lado].every(Number.isFinite) || x < 0 || y < 0 || lado < 200 || x + lado > img.ancho || y + lado > img.alto) throw new Error("la zona del QR del manifiesto no cabe en la plantilla");
  return { x, y, lado };
}
// Dibuja la matriz del QR (true = módulo oscuro) centrada en la zona, con 2 módulos de margen por lado (además del
// blanco que la plantilla deja alrededor). Los módulos miden píxeles enteros: bordes nítidos, fácil de escanear.
export function ponerQr(img: Imagen, zona: Zona, matriz: boolean[][]): void {
  const n = matriz.length;
  const paso = Math.floor(zona.lado / (n + 4));
  if (!n || paso < 6) throw new Error("la zona del QR es muy chica para este link");
  const margen = Math.floor((zona.lado - paso * n) / 2);
  rectangulo(img, zona.x, zona.y, zona.lado, zona.lado, [255, 255, 255]);
  for (let f = 0; f < n; f++) for (let c = 0; c < n; c++) if (matriz[f][c]) rectangulo(img, zona.x + margen + c * paso, zona.y + margen + f * paso, paso, paso, TINTA);
}

// ---------- Archivos del sitio, con memoria ----------
// Los que existen se guardan 10 minutos (el arte cambia poco); los que faltan, 2 minutos (para no insistir en cada mensaje).
const memoria = new Map<string, { cuando: number; bytes: Uint8Array | null }>();
const plantillas = new Map<string, { de: Uint8Array; img: Imagen }>();   // plantilla ya leída, por dirección
export function olvidarImagenes() { memoria.clear(); plantillas.clear(); }
async function bajar(url: string): Promise<Uint8Array | null> {
  const g = memoria.get(url), t = Date.now();
  if (g && t - g.cuando < (g.bytes ? 600_000 : 120_000)) return g.bytes;
  let bytes: Uint8Array | null = null;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (r.ok) bytes = new Uint8Array(await r.arrayBuffer()); else await r.body?.cancel();
    if (bytes && (bytes.length < 20 || bytes.length > 5_000_000)) bytes = null;
  } catch { bytes = null; }
  memoria.set(url, { cuando: t, bytes });
  return bytes;
}

// Imagen de la entrega: la plantilla del idioma con el QR del link. null si falta la plantilla o el manifiesto.
export async function imagenEntrega(sitio: string, idioma: Idioma, link: string, matrizQr: (texto: string) => boolean[][]): Promise<Uint8Array | null> {
  const url = `${sitio}img/wa/entrega-${idioma}.png`;
  const [bytes, manif] = await Promise.all([bajar(url), bajar(`${sitio}img/wa/manifiesto.json`)]);
  if (!bytes || !manif) return null;
  let guardada = plantillas.get(url);
  if (!guardada || guardada.de !== bytes) { guardada = { de: bytes, img: await leerPng(bytes) }; plantillas.set(url, guardada); }
  const img: Imagen = { ancho: guardada.img.ancho, alto: guardada.img.alto, px: guardada.img.px.slice() };
  const m = JSON.parse(new TextDecoder().decode(manif));
  ponerQr(img, zonaValida(m?.[`entrega-${idioma}`]?.zona, img), matrizQr(link));
  return await escribirPng(img);
}
// Imagen de «compartir»: el archivo tal cual. null si no existe.
export async function imagenCompartir(sitio: string, idioma: Idioma): Promise<Uint8Array | null> {
  return await bajar(`${sitio}img/wa/compartir-${idioma}.png`);
}
