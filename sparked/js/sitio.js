// Pequeñas ayudas para las páginas del sitio: dibuja los sprites y conecta con el servidor.
import { sparky, icono, coche } from "./arte.js";
import { CONFIG } from "./config.js";

// <span data-sprite="telefono" data-escala="4"></span>  →  el dibujo en pixel art
export function pintarSprites(raiz = document) {
  raiz.querySelectorAll("[data-sprite]").forEach((el) => {
    const n = el.dataset.sprite, e = Number(el.dataset.escala || 4);
    el.innerHTML = n.startsWith("sparky:") ? sparky(n.split(":")[1], e) : n.startsWith("coche:") ? coche(n.split(":")[1], e) : icono(n, e);
  });
}

export const api = {
  async get(ruta) { const r = await fetch(`${CONFIG.api}${ruta}`); const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || "Error del servidor"); return d; },
  async post(ruta, cuerpo, extra = {}) { const r = await fetch(`${CONFIG.api}${ruta}`, { method: "POST", headers: { "content-type": "application/json", ...extra }, body: JSON.stringify(cuerpo ?? {}) }); const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || "Error del servidor"); return d; },
};

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const GRADOS = ["1° Primaria", "2° Primaria", "3° Primaria", "4° Primaria", "5° Primaria", "6° Primaria", "1° Secundaria", "2° Secundaria", "3° Secundaria", "1° Preparatoria", "2° Preparatoria", "3° Preparatoria", "Universidad"];
export const MATERIAS = ["Historia", "Español", "Matemáticas", "Ciencias", "Química", "Biología", "Física", "Geografía", "Formación Cívica y Ética", "Inglés", "Francés", "Otra"];

export function opciones(select, lista, placeholder) {
  select.innerHTML = `<option value="">${esc(placeholder)}</option>` + lista.map((x) => `<option value="${esc(typeof x === "string" ? x : x.valor)}">${esc(typeof x === "string" ? x : x.texto)}</option>`).join("");
}
export function limpiarTel(t) { return String(t ?? "").replace(/\D/g, ""); }
export function waLink(tel, texto) { const n = limpiarTel(tel); return `https://wa.me/${n.length === 10 ? "52" + n : n}?text=${encodeURIComponent(texto)}`; }

pintarSprites();
