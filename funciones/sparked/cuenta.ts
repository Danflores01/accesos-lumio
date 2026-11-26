// deno-lint-ignore-file no-explicit-any
// Módulo aparte: cuentas de SparkEd, saldo de guías y paquete de 3 guías (decidido por Daniel el 24 nov 2026).
// index.ts llama a rutasCuenta() en cada petición; si la ruta no es de este módulo, devuelve null sin tocar nada.
//
// La idea, en simple:
//   · La CUENTA es el número de WhatsApp. No hay contraseñas: se entra con un código de 6 dígitos que llega por
//     WhatsApp (Green API, el mismo motor de las entregas) y, si WhatsApp falla, por correo (Resend).
//   · El PAQUETE de 3 guías se paga una sola vez (tarjeta, OXXO o SPEI, con el mismo Checkout Pro de Mercado Pago).
//     Al confirmarse el pago se abonan 3 guías al SALDO de la cuenta; se pueden usar durante 90 días.
//   · Cada guía hecha con saldo se genera COMPLETA, sin vista previa. Se descuenta 1 al lanzarla (paso atómico en la
//     base) y, si la guía falla o las fotos no sirven, se devuelve sola.
//   · El saldo es un LIBRO de movimientos (tabla cuenta_saldo_movimientos): el número que ve la familia es la suma
//     del libro. Migración: sql/migraciones/20261124_sparked_cuentas_paquete3.sql.
//
// Rutas de la familia:
//   GET  /paquete/info                      → { disponible, precio, guias, dias } (lo que la portada necesita saber)
//   POST /cuenta/codigo  { telefono, correo?, nombre?, canal? }  → manda el código (WhatsApp; respaldo: correo)
//   POST /cuenta/entrar  { telefono, codigo, cerrar_antigua? }   → { sesion, cuenta… } (máximo 2 dispositivos)
//   GET  /cuenta          (cabecera x-cuenta) → saldo, vencimientos, guías hechas y paquetes
//   POST /cuenta/salir    (x-cuenta)          → cierra la sesión de este dispositivo
//   POST /cuenta/correo   (x-cuenta) { correo } → pone o cambia el correo de respaldo (sesión comprobada por WhatsApp)
//   POST /paquete/comprar (x-cuenta) { nombre?, correo? }        → link de pago de Mercado Pago
//   GET  /paquete/estado/:compra (x-cuenta)   → estado del pago y del abono
//   POST /paquete/reintentar/:compra (x-cuenta) → otro link de pago para una compra que sigue pendiente
//   POST /cuenta/guia     (x-cuenta) { clave } → usa 1 guía del saldo y lanza la guía completa con esas páginas
//   GET  /cuenta/guia/:compra (x-cuenta)      → avance de esa guía; el link cuando ya está lista
// Rutas de administración (clave de administrador o sesión del panel):
//   GET  /admin/paquetes                      → cifras, paquetes y cuentas con su saldo (WhatsApp siempre enmascarado)
//   GET  /admin/cuentas/:id                   → una cuenta: saldo, movimientos y dispositivos
//   POST /admin/cuentas/:id/ajuste { cambio, nota?, dias? } → Daniel suma o resta guías a mano (queda en el libro)
//   POST /admin/cuentas/:id/prueba { accion } → solo cuentas de prueba: usar o devolver una guía sin generar nada
//   DELETE /admin/cuentas/:id                 → solo cuentas de prueba: borra la cuenta y todo lo que creó
//
// Suscripción mensual «Guías ilimitadas» (25 nov 2026; la lógica vive en suscripcion.ts, aquí solo se reciben sus rutas
// de la familia porque este módulo es el que conoce la sesión):
//   GET  /suscripcion/info                    → { disponible, precio, prueba_dias } (solo dice si está abierta al público)
//   POST /suscripcion/crear (x-cuenta) { acepta: true, nombre?, correo?, correo_pago? } → página de Mercado Pago
//   GET  /suscripcion/estado (x-cuenta)       → cómo va la suscripción (pregunta a Mercado Pago si falta confirmar algo)
//   POST /suscripcion/cancelar (x-cuenta)     → cancelar en un clic (conserva lo pagado hasta el fin del periodo)
//   POST /suscripcion/metodo-de-pago (x-cuenta) { correo_pago? } → cambiar el método de pago SIN cancelar: abre la página
//                                                de Mercado Pago para poner la tarjeta nueva
// Con una suscripción que da derecho a crear, POST /cuenta/guia hace la guía con la suscripción (metodo_pago
// "suscripcion", sin tocar el saldo del paquete).
//
// El ajuste sparked_paquete3 ('si' | 'no') enciende la VENTA. Apagado: /paquete/info dice que no está disponible (el
// sitio esconde los botones), no se puede comprar ni se crean cuentas nuevas, y no se manda ningún código a un número
// que no tenga cuenta. Quien ya tiene cuenta puede seguir entrando y usar el saldo que ya pagó.
//
// Regla de la casa (10 nov 2026): este módulo solo responde en sus rutas exactas. /acceso/… no es suya ni la toca.
import type { CtxBase, CtxRutasCuenta } from "./tipos.ts";
import { mandarTextoA, telefonoInternacional, idiomaDe, motorWhatsApp } from "./whatsapp.ts";
import { ventaCobrada, tipoSinCobro } from "./extras.ts";
import { ajustesSuscripcion, puedeSuscribirse, infoSuscripcion, resumenSuscripcion, crearSuscripcion, estadoSuscripcion, cancelarDeFamilia, cambiarMetodoDePago, suscripcionParaCrear, suscripcionDetenida, revisarUsoEnPrueba, avisarGuiaFallida, borrarSuscripcionesDePrueba, MSG_EN_GRACIA, MSG_FALLO_GUIA_SUS, FALLAS_POR_DIA } from "./suscripcion.ts";

// ---------- Reglas (números que deciden cómo se comporta) ----------
export const GUIAS_PAQUETE = 3;            // guías que abona un paquete
export const CODIGO_MINUTOS = 10;          // lo que dura un código
export const CODIGO_INTENTOS = 5;          // intentos fallidos antes de quemar el código
export const CODIGOS_POR_HORA = 3;         // códigos por número cada hora
export const CODIGOS_POR_DIA = 10;         // códigos por número cada 24 horas
export const CODIGOS_POR_CONEXION = 20;    // códigos pedidos desde una misma conexión cada hora (todos los números)
export const CODIGOS_WA_POR_DIA = 150;     // freno general: códigos por WhatsApp en 24 horas en todo el sitio; los demás salen por correo
export const SESION_DIAS = 60;             // lo que dura una sesión sin usarse (se renueva sola con el uso)
export const SESIONES_MAX = 2;             // dispositivos con la cuenta abierta (como las guías)
export const DEVOLUCIONES_POR_DIA = 3;     // guías devueltas en 24 horas antes de pedir una pausa (cada intento gasta IA)
export const PAQUETES_POR_DIA = 5;         // compras de paquete por cuenta cada 24 horas
const GRACIA_DEVOLUCION_HORAS = 24;        // una guía devuelta se puede usar al menos este tiempo
const MINUTOS_PARA_REVISAR = 25;           // una guía de saldo sin terminar después de esto se revisa (y se devuelve si falló)

const MSG_SESION = "Tu sesión terminó. Entra de nuevo con tu número de WhatsApp.";
const MSG_CODIGO_MAL = "El código no es correcto o ya venció. Revísalo o pide uno nuevo.";
const MSG_NO_DISPONIBLE = "El paquete de guías todavía no está disponible.";
const MSG_SIN_SALDO = "No tienes guías disponibles en tu cuenta. Compra un paquete para crear más guías.";
const MSG_FALLO_GUIA = "No pudimos terminar tu guía. Inténtalo de nuevo.";

// ---------- Utilidades ----------
const env = (k: string) => String((globalThis as any).Deno?.env?.get(k) ?? "").trim();
const esUuid = (u: unknown): u is string => typeof u === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(u);
const esClave = (c: unknown): c is string => typeof c === "string" && /^[A-Za-z0-9]{16,40}$/.test(c);
const esPase = (p: unknown): p is string => typeof p === "string" && /^[A-Za-z0-9]{32,64}$/.test(p);
/** Correo escrito por la familia, limpio (sin espacios y en minúsculas), o "" si no es un correo. */
const correoLimpio = (v: unknown): string => { const x = String(v ?? "").trim().toLowerCase(); return esCorreo(x) ? x : ""; };
const esCorreo = (x: unknown): x is string => typeof x === "string" && x.length <= 120 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x);
const texto = (v: unknown, max = 120) => String(v ?? "").replace(/[\x00-\x1f\x7f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const escHtml = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch] as string));
const folioDe = (id: unknown) => String(id ?? "").slice(0, 8).toUpperCase();
const primerNombre = (n: unknown) => String(n ?? "").trim().split(/\s+/)[0]?.replace(/[*_~`{}]/g, "") ?? "";
const haceMs = (ms: number) => new Date(Date.now() - ms).toISOString();
async function sha256hex(s: string): Promise<string> {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
const ALFABETO = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
function alAzar(n: number): string { const b = crypto.getRandomValues(new Uint8Array(n)); let s = ""; for (const x of b) s += ALFABETO[x % ALFABETO.length]; return s; }

/** Números reservados para las pruebas automáticas: "+52" + 000 + 7 dígitos (ninguna lada de México empieza con 0). */
export const esTelefonoDePrueba = (t: unknown) => /^\+52000\d{7}$/.test(String(t ?? ""));
/** WhatsApp enmascarado para el panel y para la familia: solo los últimos 4 dígitos. Nunca sale completo. */
export function enmascararTelefono(t: unknown): string { const d = String(t ?? "").replace(/\D/g, ""); return d.length >= 6 ? "••• ••• " + d.slice(-4) : "•••"; }
/** Correo a medias: la primera letra y el dominio ("d•••@gmail.com"). */
export function enmascararCorreo(c: unknown): string { const [u, dom] = String(c ?? "").trim().split("@"); return u && dom ? `${u[0]}•••@${dom}` : ""; }
/** Nombre corto del dispositivo, para que la familia reconozca dónde tiene abierta su cuenta. */
export function nombreDispositivo(ua: unknown): string {
  const u = String(ua ?? "");
  if (/iPad/i.test(u)) return "iPad";
  if (/iPhone/i.test(u)) return "iPhone";
  if (/Android/i.test(u)) return /Mobile/i.test(u) ? "Celular Android" : "Tableta Android";
  if (/Windows/i.test(u)) return "Computadora con Windows";
  if (/Macintosh|Mac OS X/i.test(u)) return "Mac";
  if (/CrOS/i.test(u)) return "Chromebook";
  if (/Linux/i.test(u)) return "Computadora con Linux";
  return "Dispositivo";
}
const fechaLarga = (iso: unknown, idioma: "es" | "en" = "es") => new Date(String(iso)).toLocaleDateString(idioma === "en" ? "en-US" : "es-MX", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Mexico_City" });
const idiomaDeTelefono = (t: unknown): "es" | "en" => idiomaDe(telefonoInternacional(t));
const guiasTexto = (n: number, idioma: "es" | "en" = "es") => idioma === "en" ? `${n} ${n === 1 ? "guide" : "guides"}` : `${n} ${n === 1 ? "guía" : "guías"}`;

// ---------- Ajustes ----------
type Ajustes = { encendido: boolean; precio: number; dias: number; guias: number };
export function ajustesPaquete(cfg: Record<string, string> | null | undefined): Ajustes {
  const precio = Number(String(cfg?.sparked_paquete3_precio ?? "").replace(",", "."));
  const dias = Math.round(Number(cfg?.sparked_paquete3_dias));
  return {
    encendido: String(cfg?.sparked_paquete3 ?? "").trim().toLowerCase() === "si",
    precio: Number.isFinite(precio) && precio >= 1 && precio <= 100000 ? Math.round(precio * 100) / 100 : 199,
    dias: Number.isFinite(dias) && dias >= 1 && dias <= 3650 ? dias : 90,
    guias: GUIAS_PAQUETE,
  };
}

/** ¿Se pueden abrir cuentas nuevas con ese WhatsApp? Con el paquete a la venta, cualquiera; si no, solo quien puede
 *  contratar la suscripción (abierta al público, o un número de la lista de probadores). */
const cuentasAbiertas = (cfg: Record<string, string> | null | undefined, telefono: string): boolean => ajustesPaquete(cfg).encendido || puedeSuscribirse(ajustesSuscripcion(cfg), telefono);
/** Guía hecha desde la cuenta, sin cobro propio: con el saldo de un paquete o con la suscripción. */
const deLaCuenta = (x: { metodo_pago?: string | null }) => x.metodo_pago === "saldo" || x.metodo_pago === "suscripcion";
const METODOS_DE_CUENTA = ["saldo", "suscripcion"];

// ---------- El saldo (cálculo puro sobre el libro; se prueba sin base de datos) ----------
export type Movimiento = { id: number; cuenta_id: string; cambio: number; motivo: string; compra_id?: string | null; guia_id?: string | null; lote_id?: number | null; revierte_id?: number | null; vence_en?: string | null; de_prueba?: boolean; nota?: string | null; creado_en: string };
export type Lote = { lote: number; cuenta_id: string; motivo: string; abono: number; quedan: number; vence: string; de_prueba: boolean; creado: string; compra: string | null };
/** Los abonos del libro (lotes) con lo que queda de cada uno: su abono más la suma de los descuentos que salieron de él. */
export function lotesDe(movs: Movimiento[]): Lote[] {
  const gastado = new Map<number, number>();
  for (const m of movs) if (Number(m.cambio) < 0 && m.lote_id != null) gastado.set(Number(m.lote_id), (gastado.get(Number(m.lote_id)) ?? 0) + Number(m.cambio));
  return movs.filter((m) => Number(m.cambio) > 0 && m.lote_id == null)
    .map((m) => ({ lote: Number(m.id), cuenta_id: m.cuenta_id, motivo: m.motivo, abono: Number(m.cambio), quedan: Number(m.cambio) + (gastado.get(Number(m.id)) ?? 0), vence: String(m.vence_en ?? ""), de_prueba: m.de_prueba === true, creado: m.creado_en, compra: m.compra_id ?? null }))
    .sort((a, b) => a.vence.localeCompare(b.vence) || a.lote - b.lote);
}
/** Saldo que ve la familia: guías vigentes, cuándo vence lo primero, el detalle por vencimiento y las que ya vencieron sin usarse. */
export function resumirSaldo(movs: Movimiento[], ahoraMs = Date.now()) {
  const lotes = lotesDe(movs).filter((l) => l.quedan > 0);
  const vive = (l: Lote) => new Date(l.vence).getTime() > ahoraMs;
  const vivos = lotes.filter(vive), vencidos = lotes.filter((l) => !vive(l));
  const suma = (ls: Lote[]) => ls.reduce((n, l) => n + l.quedan, 0);
  // Los lotes que vencen el mismo instante se muestran juntos.
  const porFecha = new Map<string, number>();
  for (const l of vivos) porFecha.set(l.vence, (porFecha.get(l.vence) ?? 0) + l.quedan);
  return { guias: suma(vivos), vence_en: vivos[0]?.vence ?? null, lotes: [...porFecha].map(([vence_en, quedan]) => ({ quedan, vence_en })), vencidas: suma(vencidos) };
}
/** Guías usadas de verdad: descuentos por guía que no se devolvieron. */
export function guiasUsadas(movs: Movimiento[]): number {
  const devueltos = new Set(movs.filter((m) => m.motivo === "devolucion" && m.revierte_id != null).map((m) => Number(m.revierte_id)));
  return movs.filter((m) => m.motivo === "guia" && Number(m.cambio) < 0 && !devueltos.has(Number(m.id))).length;
}
async function movimientosDe(c: CtxBase, cuentaId: string): Promise<Movimiento[]> {
  const { data, error } = await c.supabase.from("cuenta_saldo_movimientos").select("id, cuenta_id, cambio, motivo, compra_id, guia_id, lote_id, revierte_id, vence_en, de_prueba, nota, creado_en").eq("cuenta_id", cuentaId).order("id").limit(2000);
  if (error) throw error;
  return (data ?? []) as Movimiento[];
}

// ---------- Códigos ----------
let pimienta = "";
/** Huella de un código: nunca se guarda el código. Lleva una pimienta del servidor para que la base sola no alcance. */
export async function huellaCodigo(telefono: string, codigo: string): Promise<string> {
  if (!pimienta) pimienta = await sha256hex(env("SUPABASE_SERVICE_ROLE_KEY") + ":sparked-cuenta-codigos");
  return await sha256hex(`sparked-cuenta-codigo:${pimienta}:${telefono}:${codigo}`);
}
export function nuevoCodigo(): string { return String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0"); }
const conEspacio = (codigo: string) => `${codigo.slice(0, 3)} ${codigo.slice(3)}`;
async function huellaOrigen(ip: string | null): Promise<string | null> { return ip ? (await sha256hex("sparked-cuenta-origen:" + ip)).slice(0, 32) : null; }

export function textoCodigoWhatsApp(codigo: string, idioma: "es" | "en"): string {
  return idioma === "en"
    ? `Your SparkEd code is *${conEspacio(codigo)}*.\n\nIt expires in ${CODIGO_MINUTOS} minutes. If you did not ask for it, ignore this message.`
    : `Tu código de SparkEd es *${conEspacio(codigo)}*.\n\nVence en ${CODIGO_MINUTOS} minutos. Si no lo pediste, ignora este mensaje.`;
}
const correoSimple = (parrafos: string[]) => `<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:#1b1b1f;max-width:560px;margin:auto">${parrafos.map((p) => `<p>${p}</p>`).join("")}<p>Daniel, de SparkEd<br><span style="color:#777;font-size:13px">sparkeducation-mx.com</span></p></div>`;
function correoCodigo(codigo: string, idioma: "es" | "en"): { asunto: string; html: string } {
  const c = conEspacio(codigo);
  return idioma === "en"
    ? { asunto: `Your SparkEd code: ${c}`, html: correoSimple([`Your code to sign in to SparkEd is:`, `<b style="font-size:26px;letter-spacing:2px">${c}</b>`, `It expires in ${CODIGO_MINUTOS} minutes. If you did not ask for it, ignore this email.`]) }
    : { asunto: `Tu código de SparkEd: ${c}`, html: correoSimple([`Tu código para entrar a SparkEd es:`, `<b style="font-size:26px;letter-spacing:2px">${c}</b>`, `Vence en ${CODIGO_MINUTOS} minutos. Si no lo pediste, ignora este correo.`]) };
}

// POST /cuenta/codigo. La respuesta es la misma tenga o no cuenta ese número, para no revelar quién es cliente.
// Con la clave de administrador se puede pedir { simular: true } (solo números de prueba: no manda nada y devuelve el
// código) y { ip_prueba } (para probar el freno por conexión sin tocar el de nadie).
async function pedirCodigo(c: CtxRutasCuenta): Promise<Response> {
  const b = await c.leerJson(c.req);
  const pidePrueba = b.simular !== undefined || b.ip_prueba !== undefined;
  if (pidePrueba && !(await c.esAdmin())) return c.error("No autorizado", 401);
  const telefono = c.limpiarTel(b.telefono);
  const simular = pidePrueba && b.simular === true;
  if (!telefono || (esTelefonoDePrueba(telefono) && !simular)) return c.error("Escribe un WhatsApp válido (en México, 10 dígitos).");
  if (simular && !esTelefonoDePrueba(telefono)) return c.error("La simulación solo sirve con números de prueba.");
  const canalPedido: "whatsapp" | "correo" = b.canal === "correo" ? "correo" : "whatsapp";
  const correoEscrito = correoLimpio(b.correo);
  const nombre = texto(b.nombre, 80);
  const origen = await huellaOrigen(pidePrueba && typeof b.ip_prueba === "string" && b.ip_prueba ? texto(b.ip_prueba, 60) : c.ip);

  // Frenos contra el abuso: por número y por conexión. Cuentan todos los códigos pedidos, se hayan podido mandar o no.
  const contar = async (q: any) => (await q).count ?? 0;
  const fila = () => c.supabase.from("cuenta_codigos").select("id", { count: "exact", head: true });
  const [porHora, porDia, porConexion] = await Promise.all([
    contar(fila().eq("telefono", telefono).gte("creado_en", haceMs(3600_000))),
    contar(fila().eq("telefono", telefono).gte("creado_en", haceMs(86400_000))),
    origen ? contar(fila().eq("origen", origen).gte("creado_en", haceMs(3600_000))) : 0,
  ]);
  if (porHora >= CODIGOS_POR_HORA || porDia >= CODIGOS_POR_DIA) return c.error("Ya pediste varios códigos para este número. Espera un rato y vuelve a intentar.", 429);
  if (porConexion >= CODIGOS_POR_CONEXION) return c.error("Se pidieron demasiados códigos desde esta conexión. Intenta más tarde.", 429);

  const [{ data: cuenta }, cfg] = await Promise.all([
    c.supabase.from("cuentas").select("id, correo, de_prueba").eq("telefono", telefono).maybeSingle(),
    c.config(),
  ]);
  if (simular && cuenta && cuenta.de_prueba !== true) return c.error("La simulación solo sirve con cuentas de prueba.");
  const idioma = idiomaDeTelefono(telefono);
  const codigo = nuevoCodigo();
  const expira = new Date(Date.now() + CODIGO_MINUTOS * 60_000).toISOString();
  const guardar = async (canal: "whatsapp" | "correo", envio: string, huella: string) => {
    const { data, error } = await c.supabase.from("cuenta_codigos").insert({ telefono, canal, codigo_sha256: huella, correo: correoEscrito || null, nombre: nombre || null, envio, origen, expira_en: expira }).select("id").single();
    if (error) throw error;
    return data.id as number;
  };
  // respaldo = el código no pudo salir por WhatsApp y se usó (o se habría usado) el correo.
  const respuesta = (canal: "whatsapp" | "correo", extra: Record<string, unknown> = {}) => c.json({ ok: true, canal, minutos: CODIGO_MINUTOS, respaldo: canal !== canalPedido, ...extra });

  // Venta apagada: solo entra quien ya tiene cuenta. A un número sin cuenta no se le manda nada, pero la respuesta (y
  // los frenos) son iguales: por eso queda anotada una fila con una huella que ningún código puede igualar.
  if (!cuentasAbiertas(cfg, telefono) && !cuenta && !simular) {
    await guardar(canalPedido, "sin_cuenta", "x" + alAzar(40));
    return respuesta(canalPedido);
  }
  const huella = await huellaCodigo(telefono, codigo);
  if (simular) { await guardar(canalPedido, "simulado", huella); return respuesta(canalPedido, { simulado: true, codigo }); }

  // A dónde va el respaldo por correo: si el número ya tiene cuenta, SOLO a su correo registrado (así nadie que sepa
  // un número puede pedir su código a otro correo); si la cuenta es nueva, al correo que se escribió.
  const destino = cuenta ? String(cuenta.correo ?? "") : correoEscrito;
  let canal: "whatsapp" | "correo" = canalPedido, envio = "", salio = false;
  const id = await guardar(canal, "pendiente", huella);
  const anotar = (paso: string) => { envio = envio ? `${envio} > ${paso}` : paso; };
  if (canal === "whatsapp") {
    const hoyPorWhatsApp = await contar(fila().eq("canal", "whatsapp").eq("envio", "enviado").gte("creado_en", haceMs(86400_000)));
    const paso = hoyPorWhatsApp >= CODIGOS_WA_POR_DIA ? "tope_whatsapp" : (await mandarTextoA(c, telefono, textoCodigoWhatsApp(codigo, idioma), "codigo")).estado;
    anotar(paso); salio = paso === "enviado";
    if (!salio) canal = "correo";   // respaldo automático
  }
  if (canal === "correo") {
    if (!esCorreo(destino)) anotar("sin_correo");
    else if (!env("RESEND_API_KEY")) anotar("sin_motor_correo");
    else { const m = correoCodigo(codigo, idioma); await c.mandarCorreo(destino, m.asunto, m.html); anotar("correo"); salio = true; }
  }
  await c.supabase.from("cuenta_codigos").update({ canal, envio }).eq("id", id);
  // La respuesta no dice si de verdad salió: «por WhatsApp» o «por correo, si el número tiene cuenta, a su correo de
  // respaldo». Decir «no se pudo» solo cuando no hay cuenta revelaría quién es cliente.
  if (!salio) console.warn("código sin enviar:", envio);
  return respuesta(canal);
}

// ---------- Sesiones ----------
type Sesion = { id: string; cuenta_id: string; canal: string | null };
type Cuenta = { id: string; telefono: string; correo: string | null; nombre: string | null; de_prueba: boolean; telefono_verificado_en: string | null; correo_verificado_en: string | null; creada_en: string };
const huellaPase = (pase: string) => sha256hex("sparked-cuenta-sesion:" + pase);
/** La sesión y la cuenta de una petición (cabecera x-cuenta), o null. Renueva sola la sesión con el uso (cada hora como mucho). */
async function sesionDe(c: CtxRutasCuenta): Promise<{ sesion: Sesion; cuenta: Cuenta } | null> {
  const pase = (c.req.headers.get("x-cuenta") ?? "").trim();
  if (!esPase(pase)) return null;
  const { data: s } = await c.supabase.from("cuenta_sesiones").select("id, cuenta_id, canal, ultimo_uso_en, expira_en, cerrada_en").eq("token_sha256", await huellaPase(pase)).maybeSingle();
  if (!s || s.cerrada_en || new Date(s.expira_en).getTime() <= Date.now()) return null;
  const { data: cuenta } = await c.supabase.from("cuentas").select("id, telefono, correo, nombre, de_prueba, telefono_verificado_en, correo_verificado_en, creada_en").eq("id", s.cuenta_id).maybeSingle();
  if (!cuenta) return null;
  if (Date.now() - new Date(s.ultimo_uso_en).getTime() > 3600_000) {
    c.enSegundoPlano(c.supabase.from("cuenta_sesiones").update({ ultimo_uso_en: c.ahora(), expira_en: new Date(Date.now() + SESION_DIAS * 86400_000).toISOString() }).eq("id", s.id).is("cerrada_en", null).then(() => null));
  }
  return { sesion: { id: s.id, cuenta_id: s.cuenta_id, canal: s.canal }, cuenta: cuenta as Cuenta };
}

// POST /cuenta/entrar { telefono, codigo, cerrar_antigua? }
async function entrar(c: CtxRutasCuenta): Promise<Response> {
  const b = await c.leerJson(c.req);
  const telefono = c.limpiarTel(b.telefono), codigo = String(b.codigo ?? "").replace(/\D/g, "");
  if (!telefono || codigo.length !== 6) return c.error(MSG_CODIGO_MAL, 401);
  const { data, error } = await c.supabase.rpc("sparked_revisar_codigo", { p_telefono: telefono, p_codigo_sha256: await huellaCodigo(telefono, codigo), p_max_intentos: CODIGO_INTENTOS });
  if (error) throw error;
  const r = Array.isArray(data) ? data[0] : null;
  if (r?.res_estado !== "ok") return c.error(MSG_CODIGO_MAL, 401);
  const porWhatsApp = r.res_canal === "whatsapp";
  const correoNuevo = esCorreo(r.res_correo) ? String(r.res_correo) : null;
  const { data: filaCodigo } = await c.supabase.from("cuenta_codigos").select("envio").eq("id", r.res_codigo).maybeSingle();
  const simulado = filaCodigo?.envio === "simulado" && esTelefonoDePrueba(telefono);
  const columnas = "id, telefono, correo, nombre, de_prueba, telefono_verificado_en, correo_verificado_en, creada_en";
  let { data: cuenta } = await c.supabase.from("cuentas").select(columnas).eq("telefono", telefono).maybeSingle();
  if (!cuenta) {
    // Cuenta nueva: solo con la venta encendida (o en una prueba automática).
    if (!cuentasAbiertas(await c.config(), telefono) && !simulado) return c.error(MSG_NO_DISPONIBLE, 503);
    const nueva = { telefono, correo: correoNuevo, nombre: texto(r.res_nombre, 80) || null, de_prueba: simulado, telefono_verificado_en: porWhatsApp && !simulado ? c.ahora() : null, correo_verificado_en: !porWhatsApp && !simulado ? c.ahora() : null };
    const alta = await c.supabase.from("cuentas").insert(nueva).select(columnas).single();
    if (alta.error && alta.error.code !== "23505") throw alta.error;
    cuenta = alta.data ?? (await c.supabase.from("cuentas").select(columnas).eq("telefono", telefono).maybeSingle()).data;
    if (!cuenta) throw new Error("No se pudo crear la cuenta");
  } else if (!simulado) {
    // La cuenta es de quien tiene el número. La primera vez que el número se comprueba por WhatsApp en una cuenta que
    // nació por correo, se cierran las sesiones anteriores y el correo de respaldo pasa a ser el que esa persona escribió
    // (o ninguno): así nadie puede apartar el número de otra persona con su propio correo.
    const cambios: Record<string, unknown> = {};
    if (porWhatsApp) {
      if (!cuenta.telefono_verificado_en) {
        cambios.telefono_verificado_en = c.ahora();
        if ((correoNuevo ?? null) !== (cuenta.correo ?? null)) { cambios.correo = correoNuevo; cambios.correo_verificado_en = null; }
        await c.supabase.from("cuenta_sesiones").update({ cerrada_en: c.ahora() }).eq("cuenta_id", cuenta.id).is("cerrada_en", null);
      } else if (correoNuevo && correoNuevo !== cuenta.correo) { cambios.correo = correoNuevo; cambios.correo_verificado_en = null; }
    } else if (!cuenta.correo_verificado_en) cambios.correo_verificado_en = c.ahora();
    if (!cuenta.nombre && texto(r.res_nombre, 80)) cambios.nombre = texto(r.res_nombre, 80);
    if (Object.keys(cambios).length) { await c.supabase.from("cuentas").update(cambios).eq("id", cuenta.id); Object.assign(cuenta, cambios); }
  }

  const pase = alAzar(44);
  const abrir = await c.supabase.rpc("sparked_abrir_sesion", { p_cuenta: cuenta.id, p_codigo: r.res_codigo, p_token_sha256: await huellaPase(pase), p_canal: r.res_canal, p_dispositivo: nombreDispositivo(c.req.headers.get("user-agent")), p_origen: await huellaOrigen(c.ip), p_dias: SESION_DIAS, p_max: SESIONES_MAX, p_cerrar_antigua: b.cerrar_antigua === true });
  if (abrir.error) throw abrir.error;
  const a = Array.isArray(abrir.data) ? abrir.data[0] : null;
  if (a?.res_estado === "limite") {
    // El código sigue vivo: la familia decide si cierra la sesión del dispositivo que lleva más tiempo sin usarse.
    const { data: abiertas } = await c.supabase.from("cuenta_sesiones").select("dispositivo, ultimo_uso_en").eq("cuenta_id", cuenta.id).is("cerrada_en", null).gt("expira_en", c.ahora()).order("ultimo_uso_en", { ascending: true }).limit(SESIONES_MAX);
    return c.json({ error: `Tu cuenta ya está abierta en ${SESIONES_MAX} dispositivos. Para entrar aquí hay que cerrar la sesión del dispositivo que lleva más tiempo sin usarse.`, limite: true, maximo: SESIONES_MAX, dispositivos: (abiertas ?? []).map((s: any) => ({ nombre: s.dispositivo || "Dispositivo", ultimo_uso_en: s.ultimo_uso_en })) }, 409);
  }
  if (a?.res_estado !== "ok") return c.error(MSG_CODIGO_MAL, 401);
  return c.json({ ok: true, sesion: pase, dias: SESION_DIAS, cerradas: Number(a.res_cerradas ?? 0), ...(await resumenCuenta(c, cuenta as Cuenta, String(r.res_canal ?? ""), Number(a.res_abiertas ?? 1))) });
}

// POST /cuenta/salir
async function salir(c: CtxRutasCuenta): Promise<Response> {
  const pase = (c.req.headers.get("x-cuenta") ?? "").trim();
  if (esPase(pase)) await c.supabase.from("cuenta_sesiones").update({ cerrada_en: c.ahora() }).eq("token_sha256", await huellaPase(pase)).is("cerrada_en", null);
  return c.json({ ok: true });
}

// ---------- Mi cuenta ----------
type CompraCuenta = { id: string; estado: string; producto: string; metodo_pago: string | null; mp_estado: string | null; mp_preferencia_id: string | null; mp_ficha_url: string | null; mp_vence_en: string | null; monto_mxn: number | string | null; titulo: string | null; grado: string | null; materia: string | null; guia_id: string | null; acceso_id: string | null; creada_en: string; pagada_en: string | null; entregada_en: string | null };
const COLUMNAS_COMPRA = "id, estado, producto, metodo_pago, mp_estado, mp_preferencia_id, mp_ficha_url, mp_vence_en, monto_mxn, titulo, grado, materia, guia_id, acceso_id, creada_en, pagada_en, entregada_en";

/** Lo que «Mi cuenta» enseña: saldo y vencimientos, guías hechas con su link, paquetes comprados y dispositivos. */
async function resumenCuenta(c: CtxRutasCuenta, cuenta: Cuenta, canal: string | null, abiertas?: number) {
  const [movs, comprasR, cfg, sesiones] = await Promise.all([
    movimientosDe(c, cuenta.id),
    c.supabase.from("compras").select(COLUMNAS_COMPRA).eq("cuenta_id", cuenta.id).order("creada_en", { ascending: false }).limit(80),
    c.config(),
    abiertas === undefined ? c.supabase.from("cuenta_sesiones").select("id", { count: "exact", head: true }).eq("cuenta_id", cuenta.id).is("cerrada_en", null).gt("expira_en", c.ahora()) : null,
  ]);
  if (comprasR.error) throw comprasR.error;
  let compras = (comprasR.data ?? []) as CompraCuenta[];
  // Red de seguridad: una guía de saldo que se quedó a medias (el arranque se cortó, o el trabajo falló sin avisar) se
  // revisa aquí y, si de verdad falló, se devuelve al saldo. Así una guía pagada nunca se pierde en silencio.
  let reparadas = 0;
  for (const g of compras.filter((x) => deLaCuenta(x) && x.guia_id)) {
    const edadMin = (Date.now() - new Date(g.pagada_en ?? g.creada_en).getTime()) / 60000;
    if (g.estado === "pendiente" && edadMin > 2) { if (await devolverGuiaDeSaldo(c, g.guia_id!, MSG_FALLO_GUIA)) reparadas++; }
    else if (g.estado === "pagada" && !g.entregada_en && edadMin > MINUTOS_PARA_REVISAR) {
      try { const av = await c.avanceDeGuia(g.guia_id!, new Date(g.pagada_en ?? g.creada_en).getTime()); if (av.revision && await devolverGuiaDeSaldo(c, g.guia_id!, MSG_FALLO_GUIA)) reparadas++; } catch (e) { console.warn("revisión de guía de saldo:", (e as Error).message); }
    }
  }
  const movimientos = reparadas ? await movimientosDe(c, cuenta.id) : movs;
  if (reparadas) compras = ((await c.supabase.from("compras").select(COLUMNAS_COMPRA).eq("cuenta_id", cuenta.id).order("creada_en", { ascending: false }).limit(80)).data ?? compras) as CompraCuenta[];

  const conDescuento = new Set(movimientos.filter((m) => m.motivo === "guia" && m.compra_id).map((m) => m.compra_id));
  // Las guías de la cuenta: las hechas con saldo (con su descuento en el libro) y las hechas con la suscripción.
  const deGuia = compras.filter((x) => x.estado !== "pendiente" && ((x.metodo_pago === "saldo" && conDescuento.has(x.id)) || x.metodo_pago === "suscripcion"));
  const idsAcceso = deGuia.map((x) => x.acceso_id).filter(Boolean), idsGuia = deGuia.map((x) => x.guia_id).filter(Boolean);
  const [{ data: accesos }, { data: guias }] = await Promise.all([
    idsAcceso.length ? c.supabase.from("accesos").select("id, token, expira_en").in("id", idsAcceso) : Promise.resolve({ data: [] as any[] }),
    idsGuia.length ? c.supabase.from("guias").select("id, titulo").in("id", idsGuia) : Promise.resolve({ data: [] as any[] }),
  ]);
  const base = await c.sitio();
  const notaDevolucion = (compraId: string) => movimientos.find((m) => m.motivo === "devolucion" && m.compra_id === compraId)?.nota ?? null;
  const listaGuias = deGuia.map((x) => {
    const a = (accesos ?? []).find((y: any) => y.id === x.acceso_id), g = (guias ?? []).find((y: any) => y.id === x.guia_id);
    const conSus = x.metodo_pago === "suscripcion";
    const comun = { id: x.id, titulo: g?.titulo ?? x.titulo ?? null, grado: x.grado, materia: x.materia, creada_en: x.pagada_en ?? x.creada_en, con_suscripcion: conSus };
    if (x.estado === "fallida") return { ...comun, estado: "devuelta", mensaje: conSus ? MSG_FALLO_GUIA_SUS : notaDevolucion(x.id) };
    if (x.entregada_en && a) return new Date(a.expira_en).getTime() > Date.now() ? { ...comun, estado: "lista", link: c.linkDe(base, a.token), expira_en: a.expira_en } : { ...comun, estado: "vencida", expira_en: a.expira_en };
    return { ...comun, estado: "generando" };
  });
  const aj = ajustesPaquete(cfg);
  const paquetes = compras.filter((x) => x.producto === "paquete3" && x.estado !== "fallida").slice(0, 10).map((x) => {
    const abono = movimientos.find((m) => m.motivo === "compra" && m.compra_id === x.id);
    return { id: x.id, folio: folioDe(x.id), estado: x.estado, monto_mxn: Number(x.monto_mxn ?? 0), metodo: x.metodo_pago, pago_mp: x.mp_estado, ficha_url: x.estado === "pendiente" ? x.mp_ficha_url : null, vence_pago_en: x.estado === "pendiente" ? x.mp_vence_en : null, creada_en: x.creada_en, pagada_en: x.pagada_en, guias: abono ? Number(abono.cambio) : null, vence_en: abono?.vence_en ?? null };
  });
  return {
    // correo_editable: el correo de respaldo solo lo cambia un dispositivo que entró con el código de WhatsApp (o una cuenta sin correo).
    cuenta: { whatsapp: enmascararTelefono(cuenta.telefono), correo: cuenta.correo ? enmascararCorreo(cuenta.correo) : null, nombre: cuenta.nombre ?? null, correo_editable: canal === "whatsapp" || !cuenta.correo },
    saldo: resumirSaldo(movimientos),
    guias: listaGuias,
    paquetes,
    paquete: { disponible: aj.encendido, precio: aj.precio, guias: aj.guias, dias: aj.dias },
    dispositivos: { abiertos: abiertas ?? sesiones?.count ?? 1, maximo: SESIONES_MAX },
    // La suscripción mensual (suscripcion.ts). Si algo falla ahí, «Mi cuenta» y el paquete siguen funcionando.
    suscripcion: await resumenSuscripcion(c, cuenta).catch((e) => { console.warn("suscripción en Mi cuenta:", (e as Error).message); return { disponible: false, actual: null }; }),
  };
}

// GET /cuenta
async function miCuenta(c: CtxRutasCuenta): Promise<Response> {
  const s = await sesionDe(c);
  if (!s) return c.error(MSG_SESION, 401);
  return c.json({ ok: true, ...(await resumenCuenta(c, s.cuenta, s.sesion.canal)) });
}

// POST /cuenta/correo { correo } → pone o cambia el correo de respaldo. Solo desde un dispositivo que entró con el
// código de WhatsApp (probó que el número es suyo), o en una cuenta que todavía no tiene correo.
async function cambiarCorreo(c: CtxRutasCuenta): Promise<Response> {
  const s = await sesionDe(c);
  if (!s) return c.error(MSG_SESION, 401);
  if (s.sesion.canal !== "whatsapp" && s.cuenta.correo) return c.error("Para cambiar tu correo de respaldo, entra con el código que llega a tu WhatsApp.", 403);
  const correo = correoLimpio((await c.leerJson(c.req)).correo);
  if (!correo) return c.json({ error: "Escribe un correo válido.", campo: "correo" }, 400);
  if (correo !== s.cuenta.correo) { const { error } = await c.supabase.from("cuentas").update({ correo, correo_verificado_en: null }).eq("id", s.cuenta.id); if (error) throw error; }
  return c.json({ ok: true, correo: enmascararCorreo(correo) });
}

// ---------- El paquete: comprar, abonar y avisar ----------
// GET /paquete/info (público): lo que el sitio necesita para mostrar u ocultar los botones.
async function infoPaquete(c: CtxRutasCuenta): Promise<Response> {
  const cfg = await c.config(), aj = ajustesPaquete(cfg);
  return c.json({ disponible: aj.encendido, precio: aj.precio, guias: aj.guias, dias: aj.dias, precio_guia: Number(cfg.sparked_precio) || 100, whatsapp: motorWhatsApp(), suscripcion: infoSuscripcion(cfg) });
}

/** ¿Se puede vender ahora? Con la venta apagada solo pasa una cuenta de prueba que venga con la clave de administrador. */
async function ventaAbierta(c: CtxRutasCuenta, cuenta: Cuenta): Promise<boolean> {
  if (ajustesPaquete(await c.config()).encendido) return true;
  return cuenta.de_prueba === true && c.req.headers.has("x-admin-key") && await c.esAdmin();
}

// POST /paquete/comprar { nombre?, correo? } → link de pago de Mercado Pago (tarjeta, OXXO o SPEI).
async function comprarPaquete(c: CtxRutasCuenta): Promise<Response> {
  const s = await sesionDe(c);
  if (!s) return c.error(MSG_SESION, 401);
  const { cuenta, sesion } = s;
  if (!(await ventaAbierta(c, cuenta))) return c.error(MSG_NO_DISPONIBLE, 503);
  const b = await c.leerJson(c.req);
  const nombre = texto(b.nombre, 80) || String(cuenta.nombre ?? "");
  // El correo de respaldo solo lo cambia una sesión comprobada por WhatsApp (o una cuenta que todavía no tiene correo).
  const escrito = correoLimpio(b.correo);
  const correo = escrito && (sesion.canal === "whatsapp" || !cuenta.correo) ? escrito : String(cuenta.correo ?? "") || escrito;
  if (nombre.length < 2) return c.json({ error: "Escribe tu nombre.", campo: "nombre" }, 400);
  if (!esCorreo(correo)) return c.json({ error: "Escribe un correo válido.", campo: "correo" }, 400);
  const cambios: Record<string, unknown> = {};
  if (nombre !== (cuenta.nombre ?? "")) cambios.nombre = nombre;
  if (correo !== (cuenta.correo ?? "")) { cambios.correo = correo; cambios.correo_verificado_en = null; }
  if (Object.keys(cambios).length) await c.supabase.from("cuentas").update(cambios).eq("id", cuenta.id);

  const aj = ajustesPaquete(await c.config());
  const { count } = await c.supabase.from("compras").select("id", { count: "exact", head: true }).eq("cuenta_id", cuenta.id).eq("producto", "paquete3").neq("estado", "fallida").gte("creada_en", haceMs(86400_000));
  if ((count ?? 0) >= PAQUETES_POR_DIA) return c.error(`Por seguridad, solo se pueden pedir ${PAQUETES_POR_DIA} paquetes al día por cuenta.`, 429);
  // Si ya hay un paquete pendiente de esta cuenta (últimas 2 horas), se reutiliza: no se duplica la compra.
  const { data: pendiente } = await c.supabase.from("compras").select("*").eq("cuenta_id", cuenta.id).eq("producto", "paquete3").eq("estado", "pendiente").gte("creada_en", haceMs(2 * 3600_000)).order("creada_en", { ascending: false }).limit(1).maybeSingle();
  let compra = pendiente;
  // Las cuentas de prueba no llevan teléfono ni correo en sus compras: así ninguna prueba manda mensajes.
  const contacto = cuenta.de_prueba ? { telefono: null, correo: null } : { telefono: cuenta.telefono, correo };
  if (!compra) {
    const alta = await c.supabase.from("compras").insert({ producto: "paquete3", cuenta_id: cuenta.id, monto_mxn: aj.precio, estado: "pendiente", nombre, ...contacto, titulo: `Paquete de ${aj.guias} guías` }).select("*").single();
    if (alta.error) throw alta.error;
    compra = alta.data;
  } else if (Number(compra.monto_mxn) !== aj.precio || compra.nombre !== nombre || (compra.correo ?? null) !== contacto.correo) {
    await c.supabase.from("compras").update({ monto_mxn: aj.precio, nombre, ...contacto }).eq("id", compra.id).eq("estado", "pendiente");
    Object.assign(compra, { monto_mxn: aj.precio, nombre, ...contacto });
  }
  const folio = folioDe(compra.id);
  if (c.mpToken()) {
    try {
      const pref = await c.crearPreferenciaPaquete(compra, aj.precio, aj.guias, aj.dias);
      await c.supabase.from("compras").update({ mp_preferencia_id: pref.id, mp_actualizado_en: c.ahora() }).eq("id", compra.id);
      return c.json({ modo: "mercadopago", url: pref.url, compra_id: compra.id, folio, precio: aj.precio });
    } catch (e) {
      console.error("Mercado Pago no respondió al crear el pago del paquete; queda apartado:", (e as Error).message);
    }
  }
  // Sin cobro en línea (o Mercado Pago sin responder): el paquete queda apartado y Daniel lo confirma desde el panel.
  return c.json({ modo: "manual", compra_id: compra.id, folio, precio: aj.precio, mensaje: `En este momento el pago en línea no respondió. Tu paquete quedó apartado con el folio ${folio}. Inténtalo de nuevo en unos minutos.` });
}

/** Paquete pagado → +3 guías en el saldo de su cuenta, UNA sola vez (la base no deja abonar dos veces la misma compra),
 *  y un aviso a la familia y a Daniel, también una sola vez. La llaman confirmarPago() de index.ts (aviso de Mercado
 *  Pago, «Marcar pagada» del panel) y GET /paquete/estado (por si el aviso se interrumpió). */
export async function abonarPaquete(c: CtxBase, compra: any): Promise<{ abonado: boolean; recien: boolean; guias: number }> {
  if (!compra?.id || compra.producto !== "paquete3" || compra.estado !== "pagada") return { abonado: false, recien: false, guias: 0 };
  if (!compra.cuenta_id) throw new Error("El paquete no tiene cuenta a la que abonarle las guías");
  const { data: cuenta } = await c.supabase.from("cuentas").select("id, telefono, correo, nombre, de_prueba").eq("id", compra.cuenta_id).maybeSingle();
  if (!cuenta) throw new Error("La cuenta de este paquete ya no existe");
  const aj = ajustesPaquete(await c.config());
  const { data, error } = await c.supabase.rpc("sparked_abonar_saldo", { p_cuenta: cuenta.id, p_guias: aj.guias, p_motivo: "compra", p_dias: aj.dias, p_compra: compra.id, p_de_prueba: cuenta.de_prueba === true, p_nota: null });
  if (error) throw error;
  const recien = Array.isArray(data) && data.length > 0;
  // El aviso sale una sola vez: lo manda la ejecución que marca la compra como entregada (paso atómico).
  const { data: ganada } = await c.supabase.from("compras").update({ entregada_en: c.ahora() }).eq("id", compra.id).is("entregada_en", null).select("id");
  if (ganada?.length && cuenta.de_prueba !== true) {
    c.enSegundoPlano(avisarPaquete(c, compra, cuenta, aj).catch((e) => console.error("aviso del paquete:", (e as Error).message)));
  }
  return { abonado: true, recien, guias: aj.guias };
}

async function avisarPaquete(c: CtxBase, compra: any, cuenta: any, aj: Ajustes) {
  const saldo = resumirSaldo(await movimientosDe(c, cuenta.id));
  const abono = (await c.supabase.from("cuenta_saldo_movimientos").select("vence_en").eq("compra_id", compra.id).eq("motivo", "compra").maybeSingle()).data;
  const idioma = idiomaDeTelefono(cuenta.telefono), link = `${await c.sitio()}cuenta.html`;
  const n = primerNombre(compra.nombre ?? cuenta.nombre), hasta = abono?.vence_en ? fechaLarga(abono.vence_en, idioma) : "";
  const cobrado = ventaCobrada(compra);
  const es = [
    n ? `Hola, ${n}:` : "Hola:",
    `${cobrado ? "Tu pago se confirmó" : "Tu paquete se activó"}. Se agregaron *${guiasTexto(aj.guias)}* a tu cuenta de SparkEd${saldo.guias !== aj.guias ? ` y ahora tienes ${guiasTexto(saldo.guias)} disponibles` : ""}.${hasta ? ` Las guías de este paquete se pueden usar hasta el ${hasta}.` : ""}`,
    `Para crear tus guías, entra con tu número de WhatsApp aquí:\n${link}`,
    `Cada guía se genera completa. Al recibirla tienes 7 días de acceso ilimitado a tu guía, en 2 dispositivos.`,
  ];
  const en = [
    n ? `Hi, ${n}:` : "Hi:",
    `${cobrado ? "Your payment was confirmed" : "Your pack is active"}. *${guiasTexto(aj.guias, "en")}* were added to your SparkEd account${saldo.guias !== aj.guias ? ` and you now have ${guiasTexto(saldo.guias, "en")} available` : ""}.${hasta ? ` The guides in this pack can be used until ${hasta}.` : ""}`,
    `To create your guides, sign in with your WhatsApp number here:\n${link}`,
    `Each guide is created in full. Once you receive it, you have 7 days of unlimited access to your guide, on 2 devices.`,
  ];
  const partes = idioma === "en" ? en : es;
  const html = correoSimple(partes.map((p) => escHtml(p).replace(/\*([^*]+)\*/g, "<b>$1</b>").replace(/\n/g, "<br>").replace(escHtml(link), `<a href="${escHtml(link)}" style="color:#1d4ed8">${escHtml(link)}</a>`)).concat(`<span style="color:#777;font-size:13px">Folio ${escHtml(folioDe(compra.id))}${cobrado ? ` · $${escHtml(compra.monto_mxn)} MXN, IVA incluido` : ""}</span>`));
  const asunto = idioma === "en" ? `Your SparkEd guides are ready to use` : `${n ? n + ", ya" : "Ya"} tienes ${guiasTexto(aj.guias)} en tu cuenta de SparkEd`;
  await Promise.allSettled([
    mandarTextoA(c, cuenta.telefono, partes.join("\n\n"), "cuenta"),
    esCorreo(cuenta.correo) ? c.mandarCorreo(String(cuenta.correo), asunto, html) : Promise.resolve(),
    cobrado
      ? c.avisarDaniel(`Venta SparkEd: paquete de ${aj.guias} guías`, `<p>Compra pagada: <b>Paquete de ${aj.guias} guías</b></p><p>${escHtml(compra.nombre)} · ${escHtml(enmascararTelefono(cuenta.telefono))}</p><p>Folio ${escHtml(folioDe(compra.id))} · $${escHtml(compra.monto_mxn)} MXN${compra.metodo_pago === "manual" ? " · cobrado por fuera y confirmado a mano en el panel" : ""}</p>`)
      : c.avisarDaniel(`Paquete de cortesía SparkEd: ${aj.guias} guías`, `<p>Paquete de ${aj.guias} guías confirmado a mano en el panel, sin cobro (no cuenta como venta).</p><p>${escHtml(compra.nombre)} · ${escHtml(enmascararTelefono(cuenta.telefono))}</p><p>Folio ${escHtml(folioDe(compra.id))}</p>`),
  ]);
}

// GET /paquete/estado/:compra → cómo va el pago y si ya se abonaron las guías. Si el aviso de Mercado Pago tarda, se
// le pregunta directo (máximo una vez cada 20 s por compra), igual que GET /pago/estado con las guías.
async function estadoPaquete(c: CtxRutasCuenta, compraId: string): Promise<Response> {
  const s = await sesionDe(c);
  if (!s) return c.error(MSG_SESION, 401);
  const leer = async () => (await c.supabase.from("compras").select("*").eq("id", compraId).eq("cuenta_id", s.cuenta.id).eq("producto", "paquete3").maybeSingle()).data;
  let compra = await leer();
  if (!compra) return c.error("Esa compra no existe", 404);
  if (compra.estado !== "pagada" && compra.mp_preferencia_id && c.mpToken() && c.tocaRevisarMP(compra.id)) {
    try { if (await c.revisarCompraMP(compra.id, new URL(c.req.url).searchParams.get("pago"))) compra = (await leer()) ?? compra; }
    catch (e) { console.warn("No se pudo revisar el pago del paquete en Mercado Pago:", (e as Error).message); }
  }
  let abonado = false;
  if (compra.estado === "pagada") abonado = (await abonarPaquete(c, compra)).abonado;
  const movs = await movimientosDe(c, s.cuenta.id);
  const abono = movs.find((m) => m.motivo === "compra" && m.compra_id === compra.id);
  return c.json({ estado: compra.estado, folio: folioDe(compra.id), monto_mxn: Number(compra.monto_mxn ?? 0), metodo: compra.metodo_pago, pago_mp: compra.mp_estado, ficha_url: compra.mp_ficha_url, vence_en: compra.mp_vence_en, pagada_en: compra.pagada_en, correo: compra.correo ? enmascararCorreo(compra.correo) : null, abonado, guias: abono ? Number(abono.cambio) : null, guias_vencen_en: abono?.vence_en ?? null, saldo: resumirSaldo(movs) });
}

// POST /paquete/reintentar/:compra → otro intento con Mercado Pago (por ejemplo, después de una tarjeta rechazada).
async function reintentarPaquete(c: CtxRutasCuenta, compraId: string): Promise<Response> {
  const s = await sesionDe(c);
  if (!s) return c.error(MSG_SESION, 401);
  if (!(await ventaAbierta(c, s.cuenta))) return c.error(MSG_NO_DISPONIBLE, 503);
  if (!c.mpToken()) return c.error("El pago en línea no está disponible en este momento. Inténtalo de nuevo más tarde.", 503);
  const { data: compra } = await c.supabase.from("compras").select("*").eq("id", compraId).eq("cuenta_id", s.cuenta.id).eq("producto", "paquete3").maybeSingle();
  if (!compra) return c.error("Esa compra no existe", 404);
  if (compra.estado === "pagada") return c.json({ modo: "pagada", compra_id: compra.id });
  if (compra.estado !== "pendiente") return c.error("Esta compra ya no está activa. Pide tu paquete de nuevo.");
  const aj = ajustesPaquete(await c.config());
  if (Number(compra.monto_mxn) !== aj.precio) { await c.supabase.from("compras").update({ monto_mxn: aj.precio }).eq("id", compra.id).eq("estado", "pendiente"); compra.monto_mxn = aj.precio; }
  const pref = await c.crearPreferenciaPaquete(compra, aj.precio, aj.guias, aj.dias);
  await c.supabase.from("compras").update({ mp_preferencia_id: pref.id, mp_actualizado_en: c.ahora() }).eq("id", compra.id);
  return c.json({ modo: "mercadopago", url: pref.url, compra_id: compra.id });
}

// ---------- Crear una guía con saldo ----------
// POST /cuenta/guia { clave } → gasta 1 guía del saldo (paso atómico) y lanza la guía COMPLETA, sin vista previa, con
// las páginas de ese borrador (POST /borrador y la subida de páginas son las de siempre). Si algo falla al arrancar,
// la guía se devuelve en ese momento.
async function crearGuiaConSaldo(c: CtxRutasCuenta): Promise<Response> {
  const s = await sesionDe(c);
  if (!s) return c.error(MSG_SESION, 401);
  const { cuenta } = s;
  const b = await c.leerJson(c.req);
  if (!esClave(b.clave)) return c.error("Faltan las páginas de tu guía. Súbelas de nuevo.");
  const { data: bo } = await c.supabase.from("borradores").select("*").eq("clave", b.clave).maybeSingle();
  if (!bo || (bo.expira_en && new Date(bo.expira_en).getTime() < Date.now())) return c.error("Ese borrador no existe o ya venció", 404);
  if (bo.estado !== "subiendo" || bo.trabajo_id || bo.guia_id) return c.error("Estas páginas ya se usaron para otra guía. Sube tus fotos de nuevo.", 409);
  const subidos = await c.archivosSubidos(`borradores/${bo.id}`);
  const archivos = ((bo.archivos ?? []) as any[]).filter((a) => subidos.has(a.ruta));
  if (!archivos.length) return c.error("No llegaron las páginas. Intenta subirlas de nuevo.");
  // Con una suscripción que da derecho a crear, la guía sale de la suscripción y el saldo del paquete se guarda para después.
  const sus = await suscripcionParaCrear(c, cuenta.id).catch((e) => { console.warn("suscripción al crear una guía:", (e as Error).message); return null; });
  // Cada intento gasta inteligencia artificial aunque la guía no salga: con varias fallas seguidas, una pausa.
  if (sus) {
    const { count: fallidas } = await c.supabase.from("compras").select("id", { count: "exact", head: true }).eq("cuenta_id", cuenta.id).eq("metodo_pago", "suscripcion").eq("estado", "fallida").gte("creada_en", haceMs(86400_000));
    if ((fallidas ?? 0) >= FALLAS_POR_DIA && !cuenta.de_prueba) return c.error("Hoy varias de tus guías no se pudieron crear. Tu suscripción sigue activa: inténtalo de nuevo mañana o escríbenos por WhatsApp.", 429);
  } else {
    const { count: devueltas } = await c.supabase.from("cuenta_saldo_movimientos").select("id", { count: "exact", head: true }).eq("cuenta_id", cuenta.id).eq("motivo", "devolucion").gte("creado_en", haceMs(86400_000));
    if ((devueltas ?? 0) >= DEVOLUCIONES_POR_DIA && !cuenta.de_prueba) return c.error("Hoy varias de tus guías no se pudieron crear. Tus guías siguen en tu saldo: inténtalo de nuevo mañana o escríbenos por WhatsApp.", 429);
  }
  const saldoAntes = resumirSaldo(await movimientosDe(c, cuenta.id));
  if (!sus && saldoAntes.guias < 1) {
    // Sin saldo y con la suscripción detenida por un cobro pendiente: se le dice eso, no «compra un paquete».
    if (await suscripcionDetenida(c, cuenta.id).catch(() => false)) return c.json({ error: MSG_EN_GRACIA, sin_saldo: true, en_gracia: true }, 402);
    return c.json({ error: MSG_SIN_SALDO, sin_saldo: true }, 402);
  }

  // 1) Apartar el borrador (una sola petición gana: dos pestañas con las mismas páginas no lanzan dos guías).
  const { data: ganado } = await c.supabase.from("borradores").update({ estado: "generando", archivos, paginas: archivos.length }).eq("id", bo.id).eq("estado", "subiendo").is("trabajo_id", null).is("guia_id", null).select("id");
  if (!ganado?.length) return c.error("Estas páginas ya se usaron para otra guía. Sube tus fotos de nuevo.", 409);
  const tituloInicial = `${bo.materia ?? "Guía"} · ${bo.grado ?? ""}`.replace(/ · $/, "").slice(0, 120);
  let guiaId: string | null = null, compra: any = null, descontada = false, pagada = false, quedan = saldoAntes.guias, trabajoId: string | null = null;
  const soltar = async () => {
    // Nada se gastó (o ya se devolvió): el borrador vuelve a quedar libre y la guía vacía se quita.
    await c.supabase.from("borradores").update({ estado: "subiendo", guia_id: null, trabajo_id: null }).eq("id", bo.id).neq("estado", "pagado");
    if (guiaId) await c.supabase.from("guias").delete().eq("id", guiaId).is("cartucho", null);
  };
  try {
    // 2) La guía (vacía) y su compra sin cobro: metodo_pago "saldo" (o "suscripcion") no cuenta como venta (la venta fue
    //    el paquete, o cada cobro mensual de la suscripción).
    const g = await c.supabase.from("guias").insert({ estado: "borrador", origen: "personalizada", titulo: tituloInicial, grado: bo.grado ?? null, materia: bo.materia ?? null, colegio_id: bo.colegio_id ?? null, borrador_id: bo.id }).select("id").single();
    if (g.error) throw g.error;
    guiaId = g.data.id as string;
    const contacto = cuenta.de_prueba ? { telefono: null, correo: null } : { telefono: cuenta.telefono, correo: cuenta.correo };
    const alta = await c.supabase.from("compras").insert({ producto: "guia", cuenta_id: cuenta.id, guia_id: guiaId, borrador_id: bo.id, monto_mxn: 0, estado: "pendiente", metodo_pago: sus ? "suscripcion" : "saldo", ...(sus ? { suscripcion_id: sus.id } : {}), nombre: cuenta.nombre ?? null, ...contacto, colegio_texto: bo.colegio_texto ?? null, grado: bo.grado ?? null, materia: bo.materia ?? null, titulo: tituloInicial }).select("*").single();
    if (alta.error) throw alta.error;
    compra = alta.data;
    // 3) El descuento: paso atómico en la base. Sin saldo vigente no devuelve fila y aquí no se gasta nada.
    //    Con la suscripción no se descuenta nada: las guías son ilimitadas.
    if (!sus) {
      const uso = await c.supabase.rpc("sparked_usar_guia_de_saldo", { p_cuenta: cuenta.id, p_compra: compra.id, p_guia: guiaId, p_nota: null });
      if (uso.error) throw uso.error;
      const u = Array.isArray(uso.data) ? uso.data[0] : null;
      if (!u) {
        await c.supabase.from("compras").delete().eq("id", compra.id).eq("estado", "pendiente").eq("metodo_pago", "saldo");
        await soltar();
        return c.json({ error: MSG_SIN_SALDO, sin_saldo: true }, 402);
      }
      descontada = true; quedan = Number(u.res_quedan ?? 0);
    }
    // 4) La compra queda «pagada» (con saldo) y arranca el trabajo de la guía completa.
    const paga = await c.supabase.from("compras").update({ estado: "pagada", pagada_en: c.ahora() }).eq("id", compra.id).eq("estado", "pendiente").select("*");
    if (paga.error) throw paga.error;
    if (!paga.data?.length) throw new Error("La compra de la guía cambió de estado antes de arrancar");
    compra = paga.data[0]; pagada = true;
    // 5) El acceso de 7 días y 2 dispositivos se crea ya (el borrador queda «pagado», como en una guía suelta); el link
    //    no se enseña ni se manda hasta que la guía está completa y verificada.
    await c.entregar(compra);
    // 6) El trabajo de la guía completa (alcance «completa»: todos los pasos de una vez, sin vista previa).
    const t = await c.supabase.from("trabajos").insert({ tipo: "generar", borrador_id: bo.id, guia_id: guiaId, alcance: "completa", paso: "inicio", estado: "pendiente", datos: {}, progreso: { pct: 1, mensaje: "Preparando tus páginas 📖", paso: "inicio" } }).select("id").single();
    if (t.error) throw t.error;
    trabajoId = t.data.id as string;
    await c.supabase.from("borradores").update({ trabajo_id: trabajoId, guia_id: guiaId }).eq("id", bo.id);
    c.disparar(trabajoId);
    // Suscripción en prueba gratis: si pasa de 15 guías se le avisa a Daniel (solo avisa; no hay topes).
    if (sus) c.enSegundoPlano(revisarUsoEnPrueba(c, sus).catch((e) => { console.warn("uso de la prueba gratis:", (e as Error).message); return false; }));
    return c.json({ ok: true, compra_id: compra.id, quedan, usadas_de: saldoAntes.guias, con_suscripcion: !!sus }, 202);
  } catch (e) {
    console.error("No se pudo arrancar la guía con saldo:", (e as Error).message);
    try {
      if (trabajoId) await c.supabase.from("trabajos").update({ estado: "error", error: "La guía no arrancó", actualizado_en: c.ahora() }).eq("id", trabajoId).in("estado", ["pendiente", "corriendo"]);
      if ((descontada || pagada) && guiaId) await devolverGuiaDeSaldo(c, guiaId, "No pudimos empezar tu guía. Inténtalo de nuevo.", { avisar: false });
      else if (compra) await c.supabase.from("compras").delete().eq("id", compra.id).eq("estado", "pendiente").in("metodo_pago", METODOS_DE_CUENTA);
      if (!descontada && !pagada) await soltar();
    } catch (e2) { console.error("No se pudo deshacer el arranque de la guía con saldo:", (e2 as Error).message); }
    return c.json({ error: sus ? "No pudimos empezar tu guía. Tu suscripción sigue activa; inténtalo de nuevo." : "No pudimos empezar tu guía. No se usó ninguna guía de tu saldo; inténtalo de nuevo.", devuelta: descontada }, 500);
  }
}

/** La guía de saldo falló (o las fotos no sirvieron): la compra sin cobro queda «fallida» y la guía regresa al saldo,
 *  una sola vez. Devuelve true si esa guía era de saldo y ya quedó devuelta (ahora o antes); false si no era de saldo
 *  o si ya se había entregado. La llaman index.ts (cuando un trabajo «completa» falla) y las revisiones de este módulo. */
export async function devolverGuiaDeSaldo(c: CtxBase, guiaId: string, motivo: string, op: { avisar?: boolean } = {}): Promise<boolean> {
  const { data: comp } = await c.supabase.from("compras").select("id, cuenta_id, estado, entregada_en, titulo, nombre, metodo_pago").eq("guia_id", guiaId).in("metodo_pago", METODOS_DE_CUENTA).order("creada_en", { ascending: false }).limit(1).maybeSingle();
  if (!comp?.cuenta_id || comp.entregada_en) return false;
  // Paso atómico: una compra entregada ya no se devuelve, y una devuelta ya no se entrega (la entrega exige «pagada»).
  const { data: cambiadas } = await c.supabase.from("compras").update({ estado: "fallida" }).eq("id", comp.id).in("estado", ["pagada", "pendiente"]).is("entregada_en", null).select("id");
  const { data: actual } = await c.supabase.from("compras").select("estado, entregada_en").eq("id", comp.id).maybeSingle();
  if (actual?.estado !== "fallida") return false;
  if (comp.metodo_pago === "suscripcion") {
    // Guía de la suscripción: no hay saldo que devolver. La familia recibe UN aviso (lo manda quien dejó la compra como
    // fallida) y puede intentarlo de nuevo cuando quiera.
    if (cambiadas?.length && op.avisar !== false) c.enSegundoPlano(avisarGuiaFallida(c, comp.cuenta_id, texto(motivo, 300) || MSG_FALLO_GUIA_SUS).catch((e) => console.error("aviso de guía fallida:", (e as Error).message)));
    return true;
  }
  const { data: mov } = await c.supabase.from("cuenta_saldo_movimientos").select("id").eq("compra_id", comp.id).eq("motivo", "guia").order("id").limit(1).maybeSingle();
  if (!mov) return true;   // no se había descontado nada
  const { data: dev, error } = await c.supabase.rpc("sparked_devolver_guia_de_saldo", { p_movimiento: mov.id, p_nota: texto(motivo, 300) || MSG_FALLO_GUIA, p_gracia_horas: GRACIA_DEVOLUCION_HORAS });
  if (error) throw error;
  const recien = Array.isArray(dev) && dev.length > 0;
  if (recien && op.avisar !== false) c.enSegundoPlano(avisarDevolucion(c, comp, texto(motivo, 300) || MSG_FALLO_GUIA, Number(dev[0].res_quedan ?? 0)).catch((e) => console.error("aviso de devolución:", (e as Error).message)));
  return true;
}

async function avisarDevolucion(c: CtxBase, comp: any, motivo: string, quedan: number) {
  const { data: cuenta } = await c.supabase.from("cuentas").select("telefono, correo, nombre, de_prueba").eq("id", comp.cuenta_id).maybeSingle();
  if (!cuenta || cuenta.de_prueba === true) return;
  const idioma = idiomaDeTelefono(cuenta.telefono), link = `${await c.sitio()}cuenta.html`;
  const es = [motivo, `No se usó ninguna guía de tu paquete: tienes ${guiasTexto(quedan)} en tu cuenta.`, `Puedes intentarlo de nuevo aquí:\n${link}`];
  const en = ["We could not create your guide. Please try again with clearer photos.", `No guide from your pack was used: you have ${guiasTexto(quedan, "en")} in your account.`, `You can try again here:\n${link}`];
  const partes = idioma === "en" ? en : es;
  const html = correoSimple(partes.map((p) => escHtml(p).replace(/\n/g, "<br>").replace(escHtml(link), `<a href="${escHtml(link)}" style="color:#1d4ed8">${escHtml(link)}</a>`)));
  await Promise.allSettled([
    mandarTextoA(c, cuenta.telefono, partes.join("\n\n"), "cuenta"),
    esCorreo(cuenta.correo) ? c.mandarCorreo(String(cuenta.correo), idioma === "en" ? "Your SparkEd guide could not be created" : "No pudimos crear tu guía de SparkEd (no se usó tu saldo)", html) : Promise.resolve(),
    c.avisarDaniel("⚠️ SparkEd: una guía de paquete no se pudo crear", `<p>Una guía hecha con el saldo de un paquete no se pudo terminar y <b>se devolvió sola al saldo</b> de la familia (folio ${escHtml(folioDe(comp.id))}).</p><p style="color:#555">${escHtml(motivo)}</p><p>La familia recibió el aviso y puede intentarlo de nuevo. No hace falta hacer nada.</p>`),
  ]);
}

/** Renglón que acompaña la entrega de una guía hecha con saldo: cuántas guías quedan y dónde está la cuenta. */
export async function notaDeSaldo(c: CtxBase, compra: any): Promise<string> {
  if (compra?.metodo_pago !== "saldo" || !compra.cuenta_id) return "";
  const { data: cuenta } = await c.supabase.from("cuentas").select("telefono").eq("id", compra.cuenta_id).maybeSingle();
  const saldo = resumirSaldo(await movimientosDe(c, compra.cuenta_id));
  const idioma = idiomaDeTelefono(cuenta?.telefono), link = `${await c.sitio()}cuenta.html`;
  if (idioma === "en") return saldo.guias > 0 ? `You have ${guiasTexto(saldo.guias, "en")} left in your pack; you can use ${saldo.guias === 1 ? "it" : "them"} until ${fechaLarga(saldo.vence_en, "en")}. Your account: ${link}` : `You have used all the guides in your pack. You can get another pack here: ${link}`;
  return saldo.guias > 0 ? `Te ${saldo.guias === 1 ? "queda" : "quedan"} ${guiasTexto(saldo.guias)} en tu paquete; ${saldo.guias === 1 ? "puedes usarla" : "puedes usarlas"} hasta el ${fechaLarga(saldo.vence_en)}. Tu cuenta: ${link}` : `Ya usaste todas las guías de tu paquete. Puedes comprar otro aquí: ${link}`;
}

// GET /cuenta/guia/:compra → cómo va esa guía. Mientras se genera: avance y tiempo estimado; lista: su link; si falló:
// se devuelve al saldo y lo dice.
async function estadoGuia(c: CtxRutasCuenta, compraId: string): Promise<Response> {
  const s = await sesionDe(c);
  if (!s) return c.error(MSG_SESION, 401);
  const leer = async () => (await c.supabase.from("compras").select(COLUMNAS_COMPRA).eq("id", compraId).eq("cuenta_id", s.cuenta.id).in("metodo_pago", METODOS_DE_CUENTA).maybeSingle()).data as CompraCuenta | null;
  let x = await leer();
  if (!x || !x.guia_id) return c.error("Esa guía no existe", 404);
  const { data: g } = await c.supabase.from("guias").select("titulo, completo:cartucho->completo").eq("id", x.guia_id).maybeSingle();
  const titulo = g?.titulo ?? x.titulo ?? null, conSus = x.metodo_pago === "suscripcion";
  const saldo = async () => resumirSaldo(await movimientosDe(c, s.cuenta.id));
  const devuelta = async () => {
    const { data: m } = await c.supabase.from("cuenta_saldo_movimientos").select("nota").eq("compra_id", compraId).eq("motivo", "devolucion").limit(1).maybeSingle();
    // Guía de la suscripción: no hay movimiento de devolución. El motivo en palabras sencillas (por ejemplo, «las fotos no
    // parecen material de estudio») quedó en el avance del trabajo que falló: se le dice para que no repita las mismas fotos.
    let motivo: string | null = m?.nota ?? null;
    if (!motivo && conSus && x?.guia_id) {
      const { data: t } = await c.supabase.from("trabajos").select("progreso").eq("guia_id", x.guia_id).eq("estado", "error").order("creado_en", { ascending: false }).limit(1).maybeSingle();
      const dicho = texto((t?.progreso as any)?.mensaje, 300);
      if (dicho && !/^Estamos revisando/.test(dicho)) motivo = dicho;
    }
    return c.json({ estado: "devuelta", titulo, mensaje: motivo ?? (conSus ? MSG_FALLO_GUIA_SUS : MSG_FALLO_GUIA), saldo: await saldo(), con_suscripcion: conSus });
  };
  if (x.estado === "fallida") return await devuelta();
  if (x.estado === "pagada" && !x.entregada_en && g?.completo === true) {
    // La guía ya quedó completa pero la entrega no salió (se interrumpió): se hace aquí.
    try { await c.entregarGuiaLista(x.id); x = (await leer()) ?? x; } catch (e) { console.warn("entrega de guía de saldo:", (e as Error).message); }
  }
  if (x.estado === "pagada" && x.entregada_en && x.acceso_id) {
    const { data: a } = await c.supabase.from("accesos").select("token, expira_en").eq("id", x.acceso_id).maybeSingle();
    if (a) return c.json({ estado: "lista", titulo, link: c.linkDe(await c.sitio(), a.token), expira_en: a.expira_en, saldo: await saldo(), con_suscripcion: conSus });
  }
  const desde = new Date(x.pagada_en ?? x.creada_en).getTime();
  const av = await c.avanceDeGuia(x.guia_id, desde);
  if (av.revision && Date.now() - desde > 90_000) {
    // El trabajo falló y la devolución no salió en su momento: se devuelve ahora.
    if (await devolverGuiaDeSaldo(c, x.guia_id, MSG_FALLO_GUIA)) return await devuelta();
  }
  const pct = Math.max(1, Math.min(99, Number(av.avance?.pct ?? 1) || 1));
  return c.json({ estado: "generando", titulo, progreso: av.revision ? { pct, mensaje: "Revisando que todo esté perfecto ✅" } : av.avance ?? { pct: 1, mensaje: "Preparando tus páginas 📖" }, iniciada_en: x.pagada_en ?? x.creada_en, con_suscripcion: conSus });
}

// ---------- Administración ----------
const COLUMNAS_MOV = "id, cuenta_id, cambio, motivo, compra_id, guia_id, lote_id, revierte_id, vence_en, de_prueba, nota, creado_en";
const MOTIVOS: Record<string, string> = { compra: "Compra de un paquete", guia: "Guía creada", devolucion: "Guía devuelta (no se pudo crear)", ajuste: "Ajuste de Daniel" };
const movimientoParaPanel = (m: Movimiento) => ({ id: m.id, fecha: m.creado_en, cambio: Number(m.cambio), motivo: m.motivo, motivo_texto: m.de_prueba && m.motivo === "ajuste" ? "Abono de prueba" : MOTIVOS[m.motivo] ?? m.motivo, folio: m.compra_id ? folioDe(m.compra_id) : null, vence_en: m.vence_en ?? null, de_prueba: m.de_prueba === true, nota: m.nota ?? null });

// GET /admin/paquetes → lo que Daniel necesita ver: paquetes vendidos y cobrados, guías usadas, sin usar y vencidas, y
// cada cuenta con su saldo y sus movimientos. El WhatsApp y el correo salen siempre enmascarados.
async function adminPaquetes(c: CtxRutasCuenta): Promise<Response> {
  const [comprasR, movsR, cuentasR, cfg] = await Promise.all([
    c.supabase.from("compras").select("id, estado, producto, monto_mxn, pagada_en, creada_en, metodo_pago, mp_estado, stripe_session_id, mp_preferencia_id, mp_vence_en, cuenta_id, entregada_en, de_prueba").eq("producto", "paquete3").order("creada_en", { ascending: false }).limit(1000),
    c.supabase.from("cuenta_saldo_movimientos").select(COLUMNAS_MOV).order("id").limit(20000),
    c.supabase.from("cuentas").select("id, telefono, correo, nombre, de_prueba, creada_en, ultimo_acceso_en, telefono_verificado_en").order("creada_en", { ascending: false }).limit(5000),
    c.config(),
  ]);
  for (const r of [comprasR, movsR, cuentasR]) if (r.error) throw r.error;
  const cuentas = (cuentasR.data ?? []) as any[], movs = (movsR.data ?? []) as Movimiento[], compras = (comprasR.data ?? []) as any[];
  const dePrueba = new Set(cuentas.filter((x) => x.de_prueba).map((x) => x.id));
  const reales = movs.filter((m) => !m.de_prueba && !dePrueba.has(m.cuenta_id));
  const comprasReales = compras.filter((x) => !dePrueba.has(x.cuenta_id));
  // Una compra marcada como COMPRA DE PRUEBA (compras.de_prueba, 26 nov 2026: Daniel probó el paquete con su propio dinero)
  // no es un paquete vendido ni cobrado: se cuenta aparte (paquetes_de_prueba). Sus guías sí están en el saldo de su cuenta.
  const esCompraDePrueba = (x: any) => x.de_prueba === true;
  const pagados = comprasReales.filter((x) => x.estado === "pagada" && !esCompraDePrueba(x)), cobrados = pagados.filter((x) => ventaCobrada(x));
  const saldoTotal = resumirSaldo(reales);
  const movsPorCuenta = new Map<string, Movimiento[]>();
  for (const m of movs) { if (!movsPorCuenta.has(m.cuenta_id)) movsPorCuenta.set(m.cuenta_id, []); movsPorCuenta.get(m.cuenta_id)!.push(m); }
  const aj = ajustesPaquete(cfg);
  return c.json({
    ajustes: { encendido: aj.encendido, precio: aj.precio, dias: aj.dias, guias: aj.guias },
    resumen: {
      paquetes_vendidos: pagados.length, paquetes_cobrados: cobrados.length, ingreso_mxn: cobrados.reduce((n, x) => n + (Number(x.monto_mxn) || 0), 0),
      paquetes_sin_cobro: pagados.length - cobrados.length, paquetes_de_prueba: comprasReales.filter((x) => x.estado === "pagada" && esCompraDePrueba(x)).length, paquetes_pendientes: comprasReales.filter((x) => x.estado === "pendiente").length,
      guias_abonadas: reales.filter((m) => m.motivo === "compra").reduce((n, m) => n + Number(m.cambio), 0),
      guias_usadas: guiasUsadas(reales), guias_sin_usar: saldoTotal.guias, guias_vencidas: saldoTotal.vencidas,
      guias_devueltas: reales.filter((m) => m.motivo === "devolucion").length,
      cuentas: cuentas.filter((x) => !x.de_prueba).length, cuentas_con_saldo: cuentas.filter((x) => !x.de_prueba && resumirSaldo(movsPorCuenta.get(x.id) ?? []).guias > 0).length,
    },
    paquetes: compras.slice(0, 200).map((x) => {
      const cta = cuentas.find((y) => y.id === x.cuenta_id);
      return { id: x.id, folio: folioDe(x.id), estado: x.estado, cobro: x.estado !== "pagada" ? null : ventaCobrada(x) ? (x.metodo_pago === "manual" ? "por_fuera" : "linea") : tipoSinCobro(x), monto_mxn: Number(x.monto_mxn ?? 0), metodo_pago: x.metodo_pago, mp_estado: x.mp_estado, con_link_de_pago: !!x.mp_preferencia_id, mp_vence_en: x.estado === "pendiente" ? x.mp_vence_en : null, creada_en: x.creada_en, pagada_en: x.pagada_en, abonado: movs.some((m) => m.motivo === "compra" && m.compra_id === x.id), cuenta_id: x.cuenta_id, nombre: primerNombre(cta?.nombre) || null, whatsapp: cta ? enmascararTelefono(cta.telefono) : null, compra_de_prueba: esCompraDePrueba(x), de_prueba: !!cta?.de_prueba };
    }),
    cuentas: cuentas.slice(0, 500).map((x) => {
      const propios = movsPorCuenta.get(x.id) ?? [], saldo = resumirSaldo(propios);
      return { id: x.id, nombre: primerNombre(x.nombre) || null, whatsapp: enmascararTelefono(x.telefono), correo: x.correo ? enmascararCorreo(x.correo) : null, de_prueba: !!x.de_prueba, creada_en: x.creada_en, ultimo_acceso_en: x.ultimo_acceso_en, saldo: saldo.guias, vence_en: saldo.vence_en, vencidas: saldo.vencidas, usadas: guiasUsadas(propios), movimientos: propios.slice(-40).reverse().map(movimientoParaPanel) };
    }),
  });
}

async function adminCuentas(c: CtxRutasCuenta, id: string, accion: string | undefined): Promise<Response | null> {
  const { data: cuenta } = await c.supabase.from("cuentas").select("id, telefono, correo, nombre, de_prueba, creada_en, ultimo_acceso_en").eq("id", id).maybeSingle();
  if (!cuenta) return c.error("Esa cuenta no existe", 404);
  const detalle = async () => {
    const movs = await movimientosDe(c, id), saldo = resumirSaldo(movs);
    const { data: ses } = await c.supabase.from("cuenta_sesiones").select("dispositivo, canal, creada_en, ultimo_uso_en").eq("cuenta_id", id).is("cerrada_en", null).gt("expira_en", c.ahora()).order("ultimo_uso_en", { ascending: false });
    return { id, nombre: primerNombre(cuenta.nombre) || null, whatsapp: enmascararTelefono(cuenta.telefono), correo: cuenta.correo ? enmascararCorreo(cuenta.correo) : null, de_prueba: !!cuenta.de_prueba, creada_en: cuenta.creada_en, ultimo_acceso_en: cuenta.ultimo_acceso_en, saldo, usadas: guiasUsadas(movs), dispositivos: ses ?? [], movimientos: movs.slice().reverse().map(movimientoParaPanel) };
  };
  if (!accion && c.m === "GET") return c.json(await detalle());

  // Daniel suma o resta guías a mano. Queda en el libro como «ajuste». En una cuenta de prueba el abono sale marcado
  // de prueba (no se cuenta en ninguna cifra) y puede traer sus propios días de vigencia.
  if (accion === "ajuste" && c.m === "POST") {
    const b = await c.leerJson(c.req), cambio = Math.trunc(Number(b.cambio));
    if (!Number.isFinite(cambio) || cambio === 0 || Math.abs(cambio) > 50) return c.error("Di cuántas guías sumar o restar (de 1 a 50).");
    const nota = texto(b.nota, 200) || (cuenta.de_prueba ? "Prueba automática" : "Ajuste de Daniel");
    if (cambio > 0) {
      const dias = cuenta.de_prueba && Number.isFinite(Number(b.dias)) ? Math.max(0, Math.min(365, Math.trunc(Number(b.dias)))) : ajustesPaquete(await c.config()).dias;
      const r = await c.supabase.rpc("sparked_abonar_saldo", { p_cuenta: id, p_guias: cambio, p_motivo: "ajuste", p_dias: dias, p_compra: null, p_de_prueba: cuenta.de_prueba === true, p_nota: nota });
      if (r.error) throw r.error;
      if (!r.data?.length) return c.error("No se pudo abonar.", 500);
      return c.json({ ok: true, cambio, vence_en: r.data[0].res_vence, ...(await detalle()) });
    }
    const r = await c.supabase.rpc("sparked_quitar_saldo", { p_cuenta: id, p_guias: -cambio, p_nota: nota });
    if (r.error) throw r.error;
    return c.json({ ok: true, cambio: -Number(r.data?.[0]?.res_quitadas ?? 0), ...(await detalle()) });
  }

  // Solo para las pruebas automáticas (cuentas de prueba): gastar o devolver una guía sin generar nada.
  if (accion === "prueba" && c.m === "POST") {
    if (!cuenta.de_prueba) return c.error("Solo sirve con cuentas de prueba.", 403);
    const b = await c.leerJson(c.req);
    if (b.accion === "usar") {
      const r = await c.supabase.rpc("sparked_usar_guia_de_saldo", { p_cuenta: id, p_compra: null, p_guia: null, p_nota: "Prueba automática" });
      if (r.error) throw r.error;
      const u = r.data?.[0];
      return u ? c.json({ ok: true, movimiento_id: u.res_movimiento, quedan: u.res_quedan, vence_en: u.res_vence }) : c.json({ ok: false, sin_saldo: true }, 402);
    }
    if (b.accion === "devolver") {
      const r = await c.supabase.rpc("sparked_devolver_guia_de_saldo", { p_movimiento: Math.trunc(Number(b.movimiento_id)) || 0, p_nota: "Prueba automática", p_gracia_horas: Number.isFinite(Number(b.gracia_horas)) ? Math.trunc(Number(b.gracia_horas)) : GRACIA_DEVOLUCION_HORAS });
      if (r.error) throw r.error;
      const d = r.data?.[0];
      return c.json(d ? { ok: true, devuelta: true, quedan: d.res_quedan, vence_en: d.res_vence } : { ok: true, devuelta: false });
    }
    return c.error("Acción de prueba desconocida.");
  }

  // Borrar una cuenta de prueba con todo lo que creó (nunca una cuenta de una familia).
  if (!accion && c.m === "DELETE") {
    if (!cuenta.de_prueba || !esTelefonoDePrueba(cuenta.telefono)) return c.error("Solo se pueden borrar cuentas de prueba.", 403);
    const { data: compras } = await c.supabase.from("compras").select("id, guia_id, acceso_id, borrador_id").eq("cuenta_id", id);
    const borrado = { compras: 0, guias: 0, movimientos: 0 };
    const mv = await c.supabase.from("cuenta_saldo_movimientos").delete().eq("cuenta_id", id).select("id");
    if (mv.error) throw mv.error;
    borrado.movimientos = mv.data?.length ?? 0;
    for (const x of (compras ?? []) as any[]) {
      if (x.guia_id) {
        const { data: g } = await c.supabase.from("guias").select("id, clase_id, borrador_id").eq("id", x.guia_id).maybeSingle();
        if (x.acceso_id) await c.supabase.from("accesos").delete().eq("id", x.acceso_id);
        if (g) {
          await c.supabase.from("trabajos").delete().eq("guia_id", g.id);
          await c.supabase.from("borradores").update({ guia_id: null }).eq("guia_id", g.id);
          const dg = await c.supabase.from("guias").delete().eq("id", g.id);
          if (!dg.error) borrado.guias++;
          if (g.clase_id) await c.supabase.from("clases").delete().eq("id", g.clase_id).eq("tipo", "guia");
        }
      }
      if (x.borrador_id) { await c.borrarCarpeta(`borradores/${x.borrador_id}`); await c.supabase.from("borradores").delete().eq("id", x.borrador_id); }
      const dc = await c.supabase.from("compras").delete().eq("id", x.id).eq("cuenta_id", id);
      if (!dc.error) borrado.compras++;
    }
    const suscripciones = await borrarSuscripcionesDePrueba(c, id);
    await c.supabase.from("cuenta_codigos").delete().eq("telefono", cuenta.telefono);
    const dq = await c.supabase.from("cuentas").delete().eq("id", id).eq("de_prueba", true);
    if (dq.error) throw dq.error;
    return c.json({ ok: true, borrado: { ...borrado, suscripciones } });
  }
  return null;
}

// ---------- Rutas ----------
export async function rutasCuenta(c: CtxRutasCuenta): Promise<Response | null> {
  const [r0, r1, r2, r3] = c.ruta;
  const mia = r0 === "cuenta" || r0 === "paquete" || r0 === "suscripcion" || (r0 === "admin" && (r1 === "paquetes" || r1 === "cuentas"));
  if (!mia) return null;
  try {
    if (r0 === "paquete") {
      if (r1 === "info" && !r2 && c.m === "GET") return await infoPaquete(c);
      if (r1 === "comprar" && !r2 && c.m === "POST") return await comprarPaquete(c);
      if (r1 === "estado" && esUuid(r2) && !r3 && c.m === "GET") return await estadoPaquete(c, r2);
      if (r1 === "reintentar" && esUuid(r2) && !r3 && c.m === "POST") return await reintentarPaquete(c, r2);
      return null;
    }
    if (r0 === "suscripcion") {
      // La suscripción mensual: aquí se comprueba la sesión y lo demás lo hace suscripcion.ts.
      if (r2) return null;
      if (r1 === "info" && c.m === "GET") return c.json(infoSuscripcion(await c.config()));
      const suya = (r1 === "crear" && c.m === "POST") || (r1 === "estado" && c.m === "GET") || (r1 === "cancelar" && c.m === "POST") || (r1 === "metodo-de-pago" && c.m === "POST");
      if (!suya) return null;
      const s = await sesionDe(c);
      if (!s) return c.error(MSG_SESION, 401);
      if (r1 === "crear") return await crearSuscripcion(c, s.cuenta, s.sesion.canal);
      if (r1 === "estado") return await estadoSuscripcion(c, s.cuenta);
      if (r1 === "metodo-de-pago") return await cambiarMetodoDePago(c, s.cuenta);
      return await cancelarDeFamilia(c, s.cuenta);
    }
    if (r0 === "cuenta") {
      if (!r1 && c.m === "GET") return await miCuenta(c);
      if (r1 === "codigo" && !r2 && c.m === "POST") return await pedirCodigo(c);
      if (r1 === "entrar" && !r2 && c.m === "POST") return await entrar(c);
      if (r1 === "salir" && !r2 && c.m === "POST") return await salir(c);
      if (r1 === "correo" && !r2 && c.m === "POST") return await cambiarCorreo(c);
      if (r1 === "guia" && !r2 && c.m === "POST") return await crearGuiaConSaldo(c);
      if (r1 === "guia" && esUuid(r2) && !r3 && c.m === "GET") return await estadoGuia(c, r2);
      return null;
    }
    // Administración: /admin/paquetes y /admin/cuentas/…
    if (!(await c.esAdmin())) return c.error("Clave de administrador incorrecta", 401);
    if (r1 === "paquetes" && !r2 && c.m === "GET") return await adminPaquetes(c);
    if (r1 === "cuentas" && esUuid(r2)) { const r = await adminCuentas(c, r2, r3); if (r) return r; }
    return c.error("Ruta de administración no reconocida", 404);
  } catch (e) {
    console.error("cuenta:", (e as Error)?.message ?? e);
    return c.error("Algo salió mal. Intenta de nuevo en un momento.", 500);
  }
}
