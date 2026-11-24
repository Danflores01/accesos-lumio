// Cuenta de SparkEd (paquete de 3 guías): la sesión de este dispositivo y las llamadas al servidor que la usan.
// La cuenta es el número de WhatsApp de la familia; se entra con un código de 6 dígitos (cuenta.html). El servidor
// entrega un «pase» que se guarda aquí, en este dispositivo, y va en la cabecera x-cuenta de cada petición. El saldo de
// guías vive en el servidor, no en el dispositivo: si se borra el pase, basta volver a entrar con el número.
import { CONFIG } from "./config.js";
import { poner } from "./idioma.js";

const CLAVE_PASE = "sparked_cuenta", CLAVE_INFO = "sparked_paquete_info";

export function paseGuardado() { try { const p = localStorage.getItem(CLAVE_PASE) || ""; return /^[A-Za-z0-9]{32,64}$/.test(p) ? p : ""; } catch { return ""; } }
export function guardarPase(pase) { try { localStorage.setItem(CLAVE_PASE, pase); } catch {} }
export function olvidarPase() { try { localStorage.removeItem(CLAVE_PASE); } catch {} }
export const haySesion = () => !!paseGuardado();

// El error lleva la respuesta completa (err.datos) y el estado (err.status): 401 = la sesión terminó.
const falla = (d, r) => Object.assign(new Error(d.error || "Error del servidor"), { datos: d, status: r.status });
async function pedir(metodo, ruta, cuerpo) {
  const cabeceras = { "content-type": "application/json" }, pase = paseGuardado();
  if (pase) cabeceras["x-cuenta"] = pase;
  const r = await fetch(`${CONFIG.api}${ruta}`, { method: metodo, headers: cabeceras, body: metodo === "GET" ? undefined : JSON.stringify(cuerpo ?? {}) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw falla(d, r);
  return d;
}
export const cuentaApi = { get: (ruta) => pedir("GET", ruta), post: (ruta, cuerpo) => pedir("POST", ruta, cuerpo) };

// Lo que el sitio necesita saber del paquete (GET /paquete/info): si se vende, precio, guías y días. Se guarda unos
// minutos en la pestaña para no preguntarlo en cada página. Si el servidor no responde, cuenta como no disponible.
export async function infoPaquete(fresca = false) {
  if (!fresca) {
    try { const g = JSON.parse(sessionStorage.getItem(CLAVE_INFO) || "null"); if (g && Date.now() - g.en < 180000) return g.info; } catch {}
  }
  try {
    const r = await fetch(`${CONFIG.api}/paquete/info`);
    if (!r.ok) return null;
    const info = await r.json();
    try { sessionStorage.setItem(CLAVE_INFO, JSON.stringify({ en: Date.now(), info })); } catch {}
    return info;
  } catch { return null; }
}

// En cualquier página del sitio: lo que lleva [data-paquete] solo se ve si el paquete está a la venta; la entrada a
// «Mi cuenta» ([data-cuenta]) se ve además cuando este dispositivo ya tiene una sesión guardada (quien ya compró debe
// poder entrar siempre) y dice «Mi cuenta» o «Entrar» según el caso; [data-sin-paquete] es lo contrario de [data-paquete].
// Devuelve la información del paquete (o null si el servidor no respondió).
export async function mostrarPaquete(raiz = document, fresca = false) {
  const conSesion = haySesion();
  const ver = (sel, si) => raiz.querySelectorAll(sel).forEach((el) => { el.hidden = !si; });
  const entrada = (si) => {
    ver("[data-cuenta]", si);
    raiz.querySelectorAll("a[data-cuenta]").forEach((a) => poner(a, conSesion ? "nav.cuenta" : "nav.entrar"));
    raiz.querySelectorAll("header.cab nav").forEach((n) => n.classList.toggle("con-cuenta", si));
  };
  if (conSesion) entrada(true);
  const info = await infoPaquete(fresca);
  const disponible = info?.disponible === true;
  ver("[data-paquete]", disponible);
  ver("[data-sin-paquete]", !disponible);
  entrada(disponible || conSesion);
  return info;
}
