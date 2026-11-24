// Candado del paquete de 3 guías: cuentas (entrar con WhatsApp + código), saldo de guías y sus cuentas claras.
// Uso: node herramientas/probar-saldo.ts   (Node 23.6 o más nuevo: corre TypeScript sin compilar; no usa internet ni la base)
//
// Carga el módulo real funciones/sparked/cuenta.ts (y de index.ts toma confirmarPago y el aviso de Mercado Pago) con una
// base de datos de juguete que imita las funciones SQL de la migración 20261124_sparked_cuentas_paquete3.sql, y revisa:
//   · el saldo: +3 al pagar, −1 al crear, +1 si la guía falla; vence a los 90 días; nunca queda negativo;
//   · que dos usos al mismo tiempo con saldo 1 gasten una sola guía;
//   · que el aviso de Mercado Pago repetido (o dos a la vez) abone el paquete UNA sola vez;
//   · los códigos: 6 dígitos, caducan, se queman a los 5 intentos, frenos por número y por conexión;
//   · las sesiones: máximo 2 dispositivos; el tercero pregunta antes de cerrar el más antiguo;
//   · que con la venta apagada no se pueda comprar ni se mande nada a un número sin cuenta;
//   · que el paquete cuente como UNA venta de $199 solo si se cobró, y que las guías hechas con saldo no sean ventas;
//   · que el WhatsApp nunca salga completo en lo que ve el panel;
//   · y, al final, el servidor ENTERO (el index.ts real con sus módulos): compra del paquete, aviso de Mercado Pago,
//     guía con saldo que falla y se devuelve, guía que se entrega, y la venta de una guía suelta, que no debe cambiar.
// La prueba en vivo (contra producción, con una cuenta de prueba) es _guardia/skill/guardia-sparked/scripts/probar-paquete.mjs.
import { createHmac, createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdtempSync, rmSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const fuente = readFileSync(join(raiz, "funciones", "sparked", "index.ts"), "utf8");
function extraer(nombre: string): string {
  const inicio = fuente.search(new RegExp(`(async )?function ${nombre}\\(`));
  if (inicio < 0) throw new Error("No encontré la función " + nombre);
  let i = fuente.indexOf("(", inicio), prof = 0;
  for (; i < fuente.length; i++) { if (fuente[i] === "(") prof++; else if (fuente[i] === ")" && --prof === 0) break; }
  i = fuente.indexOf(" {" + String.fromCharCode(10), i) + 1;
  let llaves = 0, j = i;
  for (; j < fuente.length; j++) { if (fuente[j] === "{") llaves++; else if (fuente[j] === "}" && --llaves === 0) break; }
  return fuente.slice(inicio, j + 1);
}
const lineaDe = (patron: RegExp) => { const m = fuente.match(patron); if (!m) throw new Error("No encontré " + patron); return m[0]; };

// ---------- Entorno de juguete ----------
const ENV: Record<string, string | undefined> = { SUPABASE_URL: "https://demo.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "llave-de-prueba", GREEN_API_ID_INSTANCE: "7107", GREEN_API_TOKEN_INSTANCE: "token-de-prueba", RESEND_API_KEY: "re_prueba", MP_ACCESS_TOKEN: "APP_USR-solo-para-la-prueba", MP_WEBHOOK_SECRET: "clave-secreta-de-prueba" };
(globalThis as any).Deno = { env: { get: (k: string) => ENV[k] } };

// ---------- Base de datos de juguete ----------
type Fila = Record<string, any>;
const TABLAS = ["cuentas", "cuenta_codigos", "cuenta_sesiones", "cuenta_saldo_movimientos", "compras", "borradores", "guias", "trabajos", "accesos", "clases", "wa_mensajes"];
const db: Record<string, Fila[]> = Object.fromEntries(TABLAS.map((t) => [t, []]));
// El reloj de la prueba: todo el código (el módulo real y las funciones SQL de juguete) lee la hora de aquí, así se
// puede adelantar el tiempo (un código que vence, una sesión de 60 días, un saldo de 90 días) sin esperar.
let serie = 0, reloj = Date.now();
Date.now = () => reloj;
const ahoraIso = () => new Date(reloj).toISOString();
const NUMERADAS = ["cuenta_codigos", "cuenta_saldo_movimientos", "wa_mensajes"];
const FECHA_ALTA: Record<string, string> = { cuentas: "creada_en", cuenta_sesiones: "creada_en", compras: "creada_en", guias: "creada_en" };
const UNICAS: Record<string, string[]> = { cuentas: ["telefono"], cuenta_sesiones: ["token_sha256"] };
function consulta(tabla: string) {
  if (!db[tabla]) db[tabla] = [];
  const filtros: ((f: Fila) => boolean)[] = [];
  let modo = "select", cambios: Fila | null = null, nuevas: Fila[] = [], contar = false, cabeza = false, conDatos = false, limite: number | null = null, columnas = "*", llave = "id";
  const parecido = (p: string, banderas: string) => new RegExp("^" + p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*") + "$", banderas);
  // Un término de .or(): "columna.eq.valor" o "columna.is.null" (lo que usa el servidor en los topes por familia).
  const terminoOr = (t: string): ((f: Fila) => boolean) => {
    const [k, op, ...resto] = t.split("."); const v = resto.join(".").replace(/^"(.*)"$/, "$1");
    if (op === "eq") return (f) => (f[k] ?? null) !== null && String(f[k]) === v;
    if (op === "is" && v === "null") return (f) => (f[k] ?? null) === null;
    throw new Error("La base de juguete no entiende este filtro: " + t);
  };
  const orden: [string, boolean][] = [];
  const filas = () => {
    let r = db[tabla].filter((f) => filtros.every((p) => p(f)));
    for (const [k, asc] of [...orden].reverse()) r = r.slice().sort((a, b) => (a[k] < b[k] ? -1 : a[k] > b[k] ? 1 : 0) * (asc ? 1 : -1));
    return limite !== null ? r.slice(0, limite) : r;
  };
  const copia = (f: Fila) => { const c = { ...f }; if (columnas.includes("completo:cartucho->completo")) c.completo = f.cartucho?.completo ?? null; return c; };
  const correr = (): { data: any; error: any; count?: number } => {
    if (modo === "insert") {
      const hechas: Fila[] = [];
      for (const n of nuevas) {
        for (const k of UNICAS[tabla] ?? []) if (db[tabla].some((f) => f[k] === n[k])) return { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } };
        const fila: Fila = { id: NUMERADAS.includes(tabla) ? ++serie : crypto.randomUUID(), [FECHA_ALTA[tabla] ?? "creado_en"]: ahoraIso(), ...(tabla === "cuenta_codigos" ? { intentos: 0, usado_en: null } : {}), ...(tabla === "cuenta_sesiones" ? { ultimo_uso_en: ahoraIso(), cerrada_en: null } : {}), ...(tabla === "cuentas" ? { de_prueba: false } : {}), ...(tabla === "compras" ? { producto: "guia", estado: "pendiente", entregada_en: null, acceso_id: null, guia_id: null, mp_estado: null, metodo_pago: null, mp_preferencia_id: null, pagada_en: null } : {}), ...(tabla === "borradores" ? { trabajo_id: null, guia_id: null } : {}), ...(tabla === "guias" ? { cartucho: null } : {}), ...(tabla === "trabajos" ? { actualizado_en: ahoraIso(), intentos: 0, costo_usd: 0, error: null } : {}), ...n };
        db[tabla].push(fila); hechas.push(fila); reloj += 1;
      }
      return { data: conDatos ? hechas.map(copia) : null, error: null };
    }
    if (modo === "update") { const r = filas(); for (const f of r) Object.assign(f, cambios); return { data: conDatos ? r.map(copia) : null, error: null }; }
    if (modo === "upsert") { for (const n of nuevas) { const vieja = db[tabla].find((f) => f[llave] === n[llave]); if (vieja) Object.assign(vieja, n); else db[tabla].push({ ...n }); } return { data: conDatos ? nuevas.map(copia) : null, error: null }; }
    if (modo === "delete") { const r = filas(); db[tabla] = db[tabla].filter((f) => !r.includes(f)); return { data: conDatos ? r.map(copia) : null, error: null }; }
    const r = filas();
    return contar ? { count: r.length, data: cabeza ? null : r.map(copia), error: null } : { data: r.map(copia), error: null };
  };
  const q: any = {
    select(c?: string, op?: { count?: string; head?: boolean }) { if (op?.count) contar = true; if (op?.head) cabeza = true; conDatos = true; columnas = c ?? "*"; return q; },
    insert(n: Fila | Fila[]) { modo = "insert"; nuevas = Array.isArray(n) ? n : [n]; return q; },
    update(c: Fila) { modo = "update"; cambios = c; return q; },
    delete() { modo = "delete"; return q; },
    eq(k: string, v: unknown) { filtros.push((f) => (f[k] ?? null) === (v ?? null)); return q; },
    neq(k: string, v: unknown) { filtros.push((f) => f[k] !== v); return q; },
    is(k: string, v: null) { filtros.push((f) => (f[k] ?? null) === v); return q; },
    in(k: string, vs: unknown[]) { filtros.push((f) => vs.includes(f[k])); return q; },
    gt(k: string, v: string) { filtros.push((f) => String(f[k]) > v); return q; },
    gte(k: string, v: string) { filtros.push((f) => String(f[k]) >= v); return q; },
    lt(k: string, v: string) { filtros.push((f) => String(f[k]) < v); return q; },
    lte(k: string, v: string) { filtros.push((f) => String(f[k]) <= v); return q; },
    like(k: string, p: string) { const re = parecido(p, ""); filtros.push((f) => re.test(String(f[k] ?? ""))); return q; },
    ilike(k: string, p: string) { const re = parecido(p, "i"); filtros.push((f) => re.test(String(f[k] ?? ""))); return q; },
    not(k: string, op: string, v: unknown) {
      if (op === "is" && v === null) filtros.push((f) => (f[k] ?? null) !== null);
      else if (op === "in") { const vs = String(v).replace(/^\(|\)$/g, "").split(","); filtros.push((f) => !vs.includes(String(f[k]))); }
      else throw new Error("La base de juguete no entiende not." + op);
      return q;
    },
    or(expr: string) { const ts = expr.split(",").map(terminoOr); filtros.push((f) => ts.some((p) => p(f))); return q; },
    upsert(n: Fila | Fila[], op?: { onConflict?: string }) { modo = "upsert"; nuevas = Array.isArray(n) ? n : [n]; llave = op?.onConflict ?? (tabla === "config" ? "clave" : "id"); return q; },
    order(k: string, op?: { ascending?: boolean }) { orden.push([k, op?.ascending !== false]); return q; },
    limit(n: number) { limite = n; return q; },
    async maybeSingle() { await null; const r = correr(); return { data: Array.isArray(r.data) ? r.data[0] ?? null : null, error: r.error }; },
    async single() { await null; const r = correr(); return r.error ? { data: null, error: r.error } : { data: r.data?.[0] ?? null, error: r.data?.[0] ? null : { message: "sin filas" } }; },
    then(ok: any, mal: any) { return Promise.resolve().then(correr).then(ok, mal); },
  };
  return q;
}

// Las funciones SQL de la migración, con la misma regla (aquí cada una corre de un tirón, como con su candado en la base).
const movs = () => db.cuenta_saldo_movimientos;
const lotesSql = (cuenta: string) => movs().filter((m) => m.cuenta_id === cuenta && m.cambio > 0 && m.lote_id == null)
  .map((l) => ({ lote: l.id, quedan: l.cambio + movs().filter((d) => d.lote_id === l.id).reduce((n, d) => n + d.cambio, 0), vence: l.vence_en, de_prueba: l.de_prueba }))
  .sort((a, b) => String(a.vence).localeCompare(String(b.vence)) || a.lote - b.lote);
const vigentes = (cuenta: string) => lotesSql(cuenta).filter((l) => l.quedan > 0 && new Date(l.vence).getTime() > reloj);
const saldoSql = (cuenta: string) => vigentes(cuenta).reduce((n, l) => n + l.quedan, 0);
const enDias = (d: number) => new Date(reloj + d * 86400_000).toISOString();
const RPC: Record<string, (p: any) => Fila[]> = {
  sparked_usar_guia_de_saldo(p) {
    if (!db.cuentas.some((c) => c.id === p.p_cuenta)) return [];
    const l = vigentes(p.p_cuenta)[0];
    if (!l) return [];
    const m = { id: ++serie, cuenta_id: p.p_cuenta, cambio: -1, motivo: "guia", compra_id: p.p_compra ?? null, guia_id: p.p_guia ?? null, lote_id: l.lote, revierte_id: null, vence_en: null, de_prueba: !!l.de_prueba, nota: p.p_nota ?? null, creado_en: ahoraIso() };
    movs().push(m);
    return [{ res_movimiento: m.id, res_lote: l.lote, res_vence: l.vence, res_quedan: saldoSql(p.p_cuenta) }];
  },
  sparked_devolver_guia_de_saldo(p) {
    const d = movs().find((m) => m.id === p.p_movimiento && m.motivo === "guia" && m.cambio < 0);
    if (!d || movs().some((m) => m.revierte_id === d.id)) return [];
    const lote = movs().find((m) => m.id === d.lote_id);
    const minimo = new Date(reloj + Math.max(0, p.p_gracia_horas ?? 24) * 3600_000).toISOString();
    const vence = lote && String(lote.vence_en) > minimo ? lote.vence_en : minimo;
    const m = { id: ++serie, cuenta_id: d.cuenta_id, cambio: -d.cambio, motivo: "devolucion", compra_id: d.compra_id, guia_id: d.guia_id, lote_id: null, revierte_id: d.id, vence_en: vence, de_prueba: d.de_prueba, nota: p.p_nota ?? null, creado_en: ahoraIso() };
    movs().push(m);
    return [{ res_movimiento: m.id, res_cuenta: d.cuenta_id, res_vence: vence, res_quedan: saldoSql(d.cuenta_id) }];
  },
  sparked_abonar_saldo(p) {
    if (!(p.p_guias > 0) || !["compra", "ajuste"].includes(p.p_motivo) || (p.p_motivo === "compra" && !p.p_compra)) return [];
    if (!db.cuentas.some((c) => c.id === p.p_cuenta)) return [];
    if (p.p_motivo === "compra" && movs().some((m) => m.motivo === "compra" && m.compra_id === p.p_compra)) return [];   // un solo abono por compra
    const m = { id: ++serie, cuenta_id: p.p_cuenta, cambio: p.p_guias, motivo: p.p_motivo, compra_id: p.p_compra ?? null, guia_id: null, lote_id: null, revierte_id: null, vence_en: enDias(Math.max(0, p.p_dias ?? 90)), de_prueba: !!p.p_de_prueba, nota: p.p_nota ?? null, creado_en: ahoraIso() };
    movs().push(m);
    return [{ res_movimiento: m.id, res_vence: m.vence_en, res_quedan: saldoSql(p.p_cuenta) }];
  },
  sparked_quitar_saldo(p) {
    let faltan = p.p_guias, quitadas = 0;
    for (const l of vigentes(p.p_cuenta)) { if (faltan <= 0) break; const toma = Math.min(l.quedan, faltan); movs().push({ id: ++serie, cuenta_id: p.p_cuenta, cambio: -toma, motivo: "ajuste", lote_id: l.lote, revierte_id: null, vence_en: null, de_prueba: !!l.de_prueba, nota: p.p_nota ?? null, creado_en: ahoraIso() }); faltan -= toma; quitadas += toma; }
    return [{ res_quitadas: quitadas, res_quedan: saldoSql(p.p_cuenta) }];
  },
  sparked_revisar_codigo(p) {
    const vivos = db.cuenta_codigos.filter((c) => c.telefono === p.p_telefono && !c.usado_en && new Date(c.expira_en).getTime() > reloj && c.intentos < p.p_max_intentos);
    const bueno = vivos.filter((c) => c.codigo_sha256 === p.p_codigo_sha256).at(-1);
    if (bueno) return [{ res_estado: "ok", res_codigo: bueno.id, res_canal: bueno.canal, res_correo: bueno.correo ?? null, res_nombre: bueno.nombre ?? null }];
    for (const c of vivos) c.intentos++;
    return [{ res_estado: vivos.length ? "mal" : "sin_codigo", res_codigo: null, res_canal: null, res_correo: null, res_nombre: null }];
  },
  sparked_abrir_sesion(p) {
    const cuenta = db.cuentas.find((c) => c.id === p.p_cuenta);
    if (!cuenta) return [{ res_estado: "sin_cuenta", res_sesion: null, res_abiertas: 0, res_cerradas: 0 }];
    const abiertas = () => db.cuenta_sesiones.filter((s) => s.cuenta_id === p.p_cuenta && !s.cerrada_en && new Date(s.expira_en).getTime() > reloj);
    const n = abiertas().length;
    if (n >= p.p_max && !p.p_cerrar_antigua) return [{ res_estado: "limite", res_sesion: null, res_abiertas: n, res_cerradas: 0 }];
    if (p.p_codigo != null) {
      const cod = db.cuenta_codigos.find((c) => c.id === p.p_codigo && c.telefono === cuenta.telefono && !c.usado_en && new Date(c.expira_en).getTime() > reloj);
      if (!cod) return [{ res_estado: "codigo_usado", res_sesion: null, res_abiertas: n, res_cerradas: 0 }];
      for (const c of db.cuenta_codigos) if (c.telefono === cuenta.telefono && !c.usado_en) c.usado_en = ahoraIso();
    }
    let cerradas = 0;
    if (n >= p.p_max) for (const s of abiertas().sort((a, b) => String(a.ultimo_uso_en).localeCompare(String(b.ultimo_uso_en))).slice(0, n - p.p_max + 1)) { s.cerrada_en = ahoraIso(); cerradas++; }
    const s = { id: crypto.randomUUID(), cuenta_id: p.p_cuenta, token_sha256: p.p_token_sha256, canal: p.p_canal, dispositivo: p.p_dispositivo, origen: p.p_origen, creada_en: ahoraIso(), ultimo_uso_en: ahoraIso(), expira_en: enDias(p.p_dias ?? 60), cerrada_en: null };
    db.cuenta_sesiones.push(s); cuenta.ultimo_acceso_en = ahoraIso(); reloj += 1;
    return [{ res_estado: "ok", res_sesion: s.id, res_abiertas: n - cerradas + 1, res_cerradas: cerradas }];
  },
};
const supabase = { from: consulta, async rpc(nombre: string, p: any) { await null; return RPC[nombre] ? { data: RPC[nombre](p), error: null } : { data: null, error: { message: "función desconocida: " + nombre } }; } };

// ---------- Green API, correo y Mercado Pago de juguete ----------
const whatsapps: { chat: string; texto: string }[] = [], correos: { para: string; asunto: string; html: string }[] = [], avisosDaniel: string[] = [];
let estadoWhatsApp = "authorized";
const sinWhatsApp = new Set<string>();   // números (dígitos) que no tienen WhatsApp
(globalThis as any).fetch = async (url: string, init: any = {}) => {
  const u = String(url), cuerpo = init?.body ? JSON.parse(init.body) : {};
  const responder = (b: unknown) => new Response(JSON.stringify(b), { status: 200, headers: { "content-type": "application/json" } });
  if (u.includes("/getStateInstance/")) return responder({ stateInstance: estadoWhatsApp });
  if (u.includes("/checkWhatsapp/")) { const d = String(cuerpo.chatId ?? "").split("@")[0]; return responder(sinWhatsApp.has(d.slice(-10)) ? { existsWhatsapp: false } : { existsWhatsapp: true, phoneNumber: `${d}@c.us` }); }
  if (u.includes("/sendMessage/")) { whatsapps.push({ chat: cuerpo.chatId, texto: cuerpo.message }); return responder({ idMessage: "m" + whatsapps.length }); }
  throw new Error("La prueba no esperaba esta petición: " + u.replace(/token-de-prueba/g, "***"));
};
const pagosMP: Record<string, any> = {};

// ---------- Los módulos reales ----------
const traer = (f: string) => import(pathToFileURL(join(raiz, "funciones", "sparked", f)).href);
const C: any = await traer("cuenta.ts");
const X: any = await traer("extras.ts");
// De index.ts: confirmarPago y el aviso de Mercado Pago, tal como están escritos, con entregar() de juguete.
const entregasDeGuia: string[] = [];
Object.assign(globalThis as any, {
  __saldo: {
    env: ENV, supabase, ahora: ahoraIso, abonarPaquete: C.abonarPaquete,
    mp: async (ruta: string) => { const m = ruta.match(/^\/v1\/payments\/(\d+)$/); const p = m ? pagosMP[m[1]] : null; return p ? { ok: true, status: 200, datos: p } : { ok: false, status: 404, datos: {} }; },
    entregar: async (compra: any) => { entregasDeGuia.push(compra.id); return { token: "t", expira_en: ahoraIso(), link: "l", lista: false, recien: false }; },
  },
});
const modulo = `
const { env, supabase, ahora, abonarPaquete, mp, entregar } = (globalThis as any).__saldo;
const Deno = { env: { get: (k: string) => env[k] } };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const error = (mensaje: string, status = 400) => json({ error: mensaje }, status);
async function leerJson(req: Request): Promise<Record<string, any>> { try { return (await req.json()) ?? {}; } catch { return {}; } }
const esUuid = (u: unknown): u is string => typeof u === "string" && /^[0-9a-f-]{36}$/i.test(u);
const mpToken = () => env.MP_ACCESS_TOKEN ?? "";
const ctxBase = () => (globalThis as any).__saldo.ctx();
${lineaDe(/const MP_VIVOS = [^;]*;/)}
${extraer("limpiarTel")}
${extraer("firmaMPValida")}
${extraer("metodoMP")}
${extraer("procesarPagoMP")}
${extraer("avisoMercadoPago")}
${extraer("confirmarPago")}
export { limpiarTel, avisoMercadoPago, confirmarPago };
`;
const carpeta = mkdtempSync(join(tmpdir(), "probar-saldo-"));
writeFileSync(join(carpeta, "index-recorte.ts"), modulo);
const I: any = await import(pathToFileURL(join(carpeta, "index-recorte.ts")).href);
rmSync(carpeta, { recursive: true, force: true });

// ---------- Contexto de una petición (lo que arma index.ts) ----------
let config: Record<string, string> = { sparked_paquete3: "si", sparked_paquete3_precio: "199", sparked_paquete3_dias: "90", sparked_precio: "100" };
const segundoPlano: Promise<unknown>[] = [];
const preferencias: string[] = [], disparados: string[] = [], carpetasBorradas: string[] = [];
let avance: { revision: boolean; avance: any } = { revision: false, avance: { pct: 30, mensaje: "Leyendo tus fotos 📖 (1 de 2)" } };
const base = () => ({
  supabase, config: async () => config, sitio: async () => "https://sitio/sparked/", ahora: ahoraIso,
  mandarCorreo: async (para: string, asunto: string, html: string) => { correos.push({ para, asunto, html }); },
  avisarDaniel: async (asunto: string) => { avisosDaniel.push(asunto); },
  enSegundoPlano: (p: Promise<unknown>) => { segundoPlano.push(p.catch((e) => console.log("segundo plano:", e.message))); },
});
(globalThis as any).__saldo.ctx = base;
const extras = () => ({
  limpiarTel: I.limpiarTel, mpToken: () => ENV.MP_ACCESS_TOKEN ?? "",
  crearPreferenciaPaquete: async (compra: any) => { preferencias.push(compra.id); return { id: "pref-" + preferencias.length, url: "https://www.mercadopago.com.mx/checkout/v1/redirect?pref_id=pref-" + preferencias.length }; },
  revisarCompraMP: async () => null, tocaRevisarMP: () => true,
  // Lo que hace entregar() de verdad con una guía hecha con saldo: crea el acceso y deja el borrador «pagado».
  entregar: async (compra: any) => { const a = { id: crypto.randomUUID(), token: "Clave" + (db.accesos.length + 1), expira_en: enDias(7) }; db.accesos.push(a); db.compras.find((x) => x.id === compra.id)!.acceso_id = a.id; const b = db.borradores.find((x) => x.id === compra.borrador_id); if (b) b.estado = "pagado"; entregasDeGuia.push(compra.id); return { token: a.token, expira_en: a.expira_en, link: "l", lista: false, recien: false }; },
  entregarGuiaLista: async (id: string) => { const x = db.compras.find((y) => y.id === id)!; x.entregada_en = ahoraIso(); return { entregada: true, recien: true }; },
  avanceDeGuia: async () => avance,
  archivosSubidos: async (c: string) => new Set(db.borradores.flatMap((b) => (b.archivos ?? []).map((a: any) => a.ruta)).filter((r: string) => r.startsWith(c))),
  borrarCarpeta: async (c: string) => { carpetasBorradas.push(c); },
  disparar: (id: string) => { disparados.push(id); }, linkDe: (b: string, t: string) => `${b}guia.html#${t}`, diasAcceso: 7, dispositivos: 2,
});
let esAdmin = false;
async function pedir(m: string, ruta: string, cuerpo?: unknown, op: { sesion?: string; ip?: string; ua?: string; consulta?: string; admin?: boolean } = {}) {
  const cabeceras: Record<string, string> = { "content-type": "application/json", "user-agent": op.ua ?? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)" };
  if (op.sesion) cabeceras["x-cuenta"] = op.sesion;
  if (op.admin) cabeceras["x-admin-key"] = "clave";
  const req = new Request(`https://demo.supabase.co/functions/v1/sparked/${ruta}${op.consulta ?? ""}`, { method: m, headers: cabeceras, body: cuerpo !== undefined && m !== "GET" ? JSON.stringify(cuerpo) : undefined });
  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
  const r: Response | null = await C.rutasCuenta({ ...base(), ...extras(), req, m, ruta: ruta.split("/"), json, error: (msg: string, s = 400) => json({ error: msg }, s), leerJson: async (x: Request) => { try { return await x.json(); } catch { return {}; } }, esAdmin: async () => esAdmin || op.admin === true, ip: op.ip ?? "200.1.1.1" });
  await Promise.all(segundoPlano.splice(0));
  return r ? { st: r.status, d: (await r.json()) as any } : { st: 0, d: null as any };
}
const codigoDe = (texto: string) => texto.match(/\*(\d{3}) (\d{3})\*/)?.slice(1, 3).join("") ?? texto.match(/(\d{3}) (\d{3})/)?.slice(1, 3).join("") ?? "";
const ultimoCodigoWA = () => codigoDe(whatsapps.at(-1)?.texto ?? "");
const ultimoCodigoCorreo = () => codigoDe(correos.at(-1)?.asunto ?? "");

let fallas = 0, total = 0;
const ok = (cond: boolean, que: string) => { total++; if (!cond) { fallas++; console.log("✗ " + que); } else console.log("✓ " + que); };
const TEL = "5512345678", TEL_I = "+525512345678";

// ---------- 1. El saldo es la suma del libro (cálculo puro) ----------
{
  const t0 = Date.parse("2026-11-24T18:00:00Z"), dia = 86400_000, iso = (ms: number) => new Date(ms).toISOString();
  const libro = [
    { id: 1, cuenta_id: "a", cambio: 3, motivo: "compra", lote_id: null, vence_en: iso(t0 + 90 * dia), creado_en: iso(t0) },
    { id: 2, cuenta_id: "a", cambio: -1, motivo: "guia", lote_id: 1, creado_en: iso(t0 + 1000) },
    { id: 3, cuenta_id: "a", cambio: -1, motivo: "guia", lote_id: 1, creado_en: iso(t0 + 2000) },
    { id: 4, cuenta_id: "a", cambio: 1, motivo: "devolucion", lote_id: null, revierte_id: 3, vence_en: iso(t0 + 90 * dia), creado_en: iso(t0 + 3000) },
  ];
  const s = C.resumirSaldo(libro, t0 + dia);
  ok(s.guias === 2 && s.vencidas === 0 && s.vence_en === iso(t0 + 90 * dia), "+3 de la compra, −1 y −1 de dos guías, +1 de una devolución: quedan 2 y vencen a los 90 días de la compra");
  ok(C.guiasUsadas(libro) === 1, "una guía devuelta no cuenta como usada: se usó 1");
  ok(C.resumirSaldo(libro, t0 + 89.9 * dia).guias === 2 && C.resumirSaldo(libro, t0 + 90 * dia + 1).guias === 0 && C.resumirSaldo(libro, t0 + 91 * dia).vencidas === 2, "el día 90 todavía sirven; después ya no: quedan como 2 guías vencidas sin usar");
  const dos = [...libro, { id: 5, cuenta_id: "a", cambio: 3, motivo: "compra", lote_id: null, vence_en: iso(t0 + 120 * dia), creado_en: iso(t0 + 30 * dia) }];
  const s2 = C.resumirSaldo(dos, t0 + 31 * dia);
  ok(s2.guias === 5 && s2.lotes.length === 2 && s2.lotes[0].quedan === 2 && s2.lotes[1].quedan === 3 && s2.vence_en === iso(t0 + 90 * dia), "un segundo paquete se acumula: 5 guías, y se dice qué vence primero (2) y qué después (3)");
  ok(C.lotesDe(libro).every((l: any) => l.quedan >= 0), "ningún lote queda negativo");
  const a = C.ajustesPaquete({});
  ok(a.encendido === false && a.precio === 199 && a.dias === 90 && a.guias === 3, "ajustes por omisión: apagado, $199, 90 días, 3 guías");
  ok(C.ajustesPaquete({ sparked_paquete3: "si", sparked_paquete3_precio: "249", sparked_paquete3_dias: "60" }).precio === 249 && C.ajustesPaquete({ sparked_paquete3: " SI " }).encendido && C.ajustesPaquete({ sparked_paquete3_precio: "gratis", sparked_paquete3_dias: "-4" }).precio === 199, "los ajustes se leen del panel y un valor malo no rompe nada");
}

// ---------- 2. Lo que nunca sale completo ----------
ok(C.enmascararTelefono(TEL_I) === "••• ••• 5678" && !C.enmascararTelefono(TEL_I).includes("551234"), "el WhatsApp se enmascara: solo los últimos 4 dígitos");
ok(C.enmascararCorreo("daniela@gmail.com") === "d•••@gmail.com" && C.enmascararCorreo("") === "", "el correo sale a medias");
ok(C.esTelefonoDePrueba("+520001234567") && !C.esTelefonoDePrueba(TEL_I), "los números de prueba son +52 000…: ninguno es de una familia");
ok(C.nombreDispositivo("Mozilla/5.0 (iPad; CPU OS 17_0)") === "iPad" && C.nombreDispositivo("Mozilla/5.0 (Windows NT 10.0)") === "Computadora con Windows" && C.nombreDispositivo("") === "Dispositivo", "cada dispositivo lleva un nombre que la familia reconoce");

// ---------- 3. Venta apagada ----------
config.sparked_paquete3 = "no";
{
  const info = await pedir("GET", "paquete/info");
  ok(info.st === 200 && info.d.disponible === false && info.d.precio === 199 && info.d.guias === 3 && info.d.dias === 90, "apagado: /paquete/info dice que no está disponible (el sitio esconde los botones)");
  const r = await pedir("POST", "cuenta/codigo", { telefono: TEL, correo: "mama@correo.com", nombre: "María" });
  ok(r.st === 200 && r.d.ok === true && whatsapps.length === 0 && correos.length === 0, "apagado: a un número sin cuenta no se le manda nada, y la respuesta es la de siempre");
  ok(db.cuenta_codigos.length === 1 && db.cuenta_codigos[0].envio === "sin_cuenta", "apagado: el pedido queda anotado (para los frenos) con una huella que ningún código iguala");
  const e = await pedir("POST", "cuenta/entrar", { telefono: TEL, codigo: "123456" });
  ok(e.st === 401 && db.cuentas.length === 0, "apagado: no se crea ninguna cuenta");
  db.cuenta_codigos.length = 0;
}
config.sparked_paquete3 = "si";

// ---------- 4. Entrar con WhatsApp + código ----------
let sesion1 = "";
{
  const info = await pedir("GET", "paquete/info");
  ok(info.d.disponible === true, "encendido: /paquete/info dice que está disponible");
  const malTel = await pedir("POST", "cuenta/codigo", { telefono: "12345" });
  ok(malTel.st === 400, "un teléfono mal escrito se rechaza antes de mandar nada");
  const r = await pedir("POST", "cuenta/codigo", { telefono: TEL, correo: "mama@correo.com", nombre: "María López" });
  ok(r.st === 200 && r.d.canal === "whatsapp" && r.d.minutos === 10 && r.d.codigo === undefined, "el código sale por WhatsApp y nunca viaja en la respuesta");
  const codigo = ultimoCodigoWA();
  ok(/^\d{6}$/.test(codigo) && whatsapps.at(-1)!.chat.startsWith("52") && /Vence en 10 minutos/.test(whatsapps.at(-1)!.texto), "el mensaje trae un código de 6 dígitos y dice que vence en 10 minutos");
  ok(db.cuenta_codigos[0].codigo_sha256.length === 64 && !JSON.stringify(db.cuenta_codigos).includes(codigo) && !JSON.stringify(db.wa_mensajes).includes(codigo), "en la base solo queda la huella del código (tampoco en la bitácora de WhatsApp)");
  ok(db.cuentas.length === 0, "pedir un código no crea la cuenta");
  const mal = await pedir("POST", "cuenta/entrar", { telefono: TEL, codigo: codigo === "000000" ? "111111" : "000000" });
  ok(mal.st === 401 && db.cuenta_codigos[0].intentos === 1, "un código equivocado no entra y cuenta un intento");
  const bien = await pedir("POST", "cuenta/entrar", { telefono: TEL, codigo: `${codigo.slice(0, 3)} ${codigo.slice(3)}` });
  sesion1 = bien.d.sesion;
  ok(bien.st === 200 && /^[A-Za-z0-9]{40,}$/.test(sesion1) && bien.d.saldo.guias === 0 && bien.d.cuenta.whatsapp === "••• ••• 5678", "el código correcto (aunque se escriba con espacio) abre la sesión; la cuenta empieza con 0 guías");
  const c = db.cuentas[0];
  ok(db.cuentas.length === 1 && c.telefono === TEL_I && c.correo === "mama@correo.com" && c.nombre === "María López" && !!c.telefono_verificado_en && c.de_prueba === false, "la cuenta nace con el WhatsApp comprobado, el correo de respaldo y el nombre");
  ok(db.cuenta_sesiones.length === 1 && db.cuenta_sesiones[0].token_sha256.length === 64 && !JSON.stringify(db.cuenta_sesiones).includes(sesion1) && db.cuenta_sesiones[0].dispositivo === "iPhone", "de la sesión solo se guarda la huella del pase, con el nombre del dispositivo");
  const otra = await pedir("POST", "cuenta/entrar", { telefono: TEL, codigo });
  ok(otra.st === 401, "un código usado no sirve otra vez");
  const mia = await pedir("GET", "cuenta", undefined, { sesion: sesion1 });
  ok(mia.st === 200 && mia.d.saldo.guias === 0 && mia.d.dispositivos.abiertos === 1 && mia.d.dispositivos.maximo === 2 && mia.d.suscripcion.disponible === false && mia.d.cuenta.correo === "m•••@correo.com", "«Mi cuenta» abre con el pase y no enseña ni el WhatsApp ni el correo completos");
  ok((await pedir("GET", "cuenta")).st === 401 && (await pedir("GET", "cuenta", undefined, { sesion: "x".repeat(44) })).st === 401, "sin pase, o con un pase inventado, «Mi cuenta» no abre");
}

// ---------- 5. Códigos: caducan, se queman y tienen frenos ----------
{
  db.cuenta_codigos.length = 0;
  await pedir("POST", "cuenta/codigo", { telefono: TEL });
  const c1 = ultimoCodigoWA();
  for (let i = 0; i < 5; i++) await pedir("POST", "cuenta/entrar", { telefono: TEL, codigo: String((Number(c1) + 1 + i) % 1_000_000).padStart(6, "0") });
  ok((await pedir("POST", "cuenta/entrar", { telefono: TEL, codigo: c1 })).st === 401, "con 5 intentos fallidos el código se quema: ni el bueno entra ya");
  await pedir("POST", "cuenta/codigo", { telefono: TEL });
  const c2 = ultimoCodigoWA();
  db.cuenta_codigos.at(-1)!.expira_en = new Date(reloj - 1000).toISOString();
  ok((await pedir("POST", "cuenta/entrar", { telefono: TEL, codigo: c2 })).st === 401, "un código vencido (más de 10 minutos) no entra");
  ok((await pedir("POST", "cuenta/codigo", { telefono: TEL })).st === 200, "tercer código de la hora: todavía se puede");
  const antes = whatsapps.length;
  const cuarto = await pedir("POST", "cuenta/codigo", { telefono: TEL });
  ok(cuarto.st === 429 && whatsapps.length === antes, "cuarto código en una hora para el mismo número: se frena y no se manda nada");
  db.cuenta_codigos.forEach((c) => { c.creado_en = new Date(reloj - 61 * 60_000).toISOString(); });
  ok((await pedir("POST", "cuenta/codigo", { telefono: TEL })).st === 200, "una hora después se puede pedir otro");
  db.cuenta_codigos.forEach((c, i) => { c.creado_en = new Date(reloj - (2 + i) * 3600_000).toISOString(); });
  for (let i = db.cuenta_codigos.length; i < 10; i++) db.cuenta_codigos.push({ id: ++serie, telefono: TEL_I, canal: "whatsapp", codigo_sha256: "x", envio: "enviado", origen: "otro", expira_en: ahoraIso(), intentos: 0, usado_en: null, creado_en: new Date(reloj - (2 + i) * 3600_000).toISOString() });
  ok((await pedir("POST", "cuenta/codigo", { telefono: TEL })).st === 429, "más de 10 códigos en un día para el mismo número: se frena");
  db.cuenta_codigos.length = 0;
  let frenado = 0;
  for (let i = 0; i < 22; i++) { const r = await pedir("POST", "cuenta/codigo", { telefono: "55100000" + String(i).padStart(2, "0") }, { ip: "9.9.9.9" }); if (r.st === 429) frenado++; }
  ok(frenado === 2 && db.cuenta_codigos.length === 20, "20 códigos por hora desde una misma conexión; el 21 y el 22 se frenan aunque sean para otros números");
  ok((await pedir("POST", "cuenta/codigo", { telefono: "5510000099" }, { ip: "8.8.8.8" })).st === 200, "desde otra conexión sí se puede");
  ok(!JSON.stringify(db.cuenta_codigos).includes("9.9.9.9"), "de la conexión solo se guarda una huella, no la dirección");
  db.cuenta_codigos.length = 0; whatsapps.length = 0;
}

// ---------- 6. Respaldo por correo ----------
{
  estadoWhatsApp = "notAuthorized";
  const r = await pedir("POST", "cuenta/codigo", { telefono: TEL, correo: "otra-persona@correo.com" });
  ok(r.st === 200 && r.d.canal === "correo" && whatsapps.length === 0 && correos.at(-1)?.para === "mama@correo.com", "con WhatsApp desconectado el código sale solo por correo… y al correo REGISTRADO de la cuenta, no al que escriba cualquiera");
  ok((await pedir("POST", "cuenta/entrar", { telefono: TEL, codigo: ultimoCodigoCorreo() })).st === 200, "el código del correo también abre la sesión");
  ok(db.cuentas[0].correo === "mama@correo.com", "entrar por correo no cambia el correo de respaldo");
  estadoWhatsApp = "authorized";
  sinWhatsApp.add("5587654321");
  const nuevo = await pedir("POST", "cuenta/codigo", { telefono: "5587654321", correo: "papa@correo.com" });
  ok(nuevo.st === 200 && nuevo.d.canal === "correo" && correos.at(-1)?.para === "papa@correo.com", "número nuevo sin WhatsApp: el código va al correo que escribió");
  const sinNada = await pedir("POST", "cuenta/codigo", { telefono: "5587654322" });
  sinWhatsApp.add("5587654322");
  const antesW = whatsapps.length, antesC = correos.length;
  const sinNada2 = await pedir("POST", "cuenta/codigo", { telefono: "5587654322" });
  ok(sinNada.st === 200 && sinNada.d.respaldo === false && sinNada2.st === 200 && sinNada2.d.canal === "correo" && sinNada2.d.respaldo === true && whatsapps.length === antesW && correos.length === antesC, "sin WhatsApp y sin correo no se manda nada, y la respuesta es la misma que si el número tuviera cuenta (no revela quién es cliente)");
  const pedido = await pedir("POST", "cuenta/codigo", { telefono: TEL, canal: "correo" });
  ok(pedido.st === 200 && pedido.d.canal === "correo" && correos.at(-1)?.para === "mama@correo.com", "«Mándalo a mi correo»: llega al correo de la cuenta");
  db.cuenta_codigos.length = 0; db.cuenta_sesiones.length = 0; correos.length = 0; whatsapps.length = 0;
}

// ---------- 7. Máximo 2 dispositivos ----------
let sesionA = "", sesionB = "";
{
  const entra = async (ua: string, extra: Record<string, unknown> = {}) => { db.cuenta_codigos.forEach((c) => { c.creado_en = new Date(reloj - 2 * 3600_000).toISOString(); }); await pedir("POST", "cuenta/codigo", { telefono: TEL }); return await pedir("POST", "cuenta/entrar", { telefono: TEL, codigo: ultimoCodigoWA(), ...extra }, { ua }); };
  const a = await entra("Mozilla/5.0 (iPhone)"); sesionA = a.d.sesion; reloj += 60_000;
  const b = await entra("Mozilla/5.0 (iPad)"); sesionB = b.d.sesion; reloj += 60_000;
  ok(a.st === 200 && b.st === 200 && b.d.dispositivos.abiertos === 2, "dos dispositivos pueden tener la cuenta abierta");
  db.cuenta_codigos.forEach((c) => { c.creado_en = new Date(reloj - 2 * 3600_000).toISOString(); });
  await pedir("POST", "cuenta/codigo", { telefono: TEL });
  const cod3 = ultimoCodigoWA();
  const c = await pedir("POST", "cuenta/entrar", { telefono: TEL, codigo: cod3 }, { ua: "Mozilla/5.0 (Windows NT 10.0)" });
  ok(c.st === 409 && c.d.limite === true && c.d.dispositivos.length === 2 && c.d.dispositivos[0].nombre === "iPhone" && !c.d.sesion, "el tercer dispositivo no entra solo: se le dice que ya hay 2 y cuál lleva más tiempo sin usarse");
  ok((await pedir("GET", "cuenta", undefined, { sesion: sesionA })).st === 200, "preguntar no cierra nada: el primer dispositivo sigue dentro");
  const c2 = await pedir("POST", "cuenta/entrar", { telefono: TEL, codigo: cod3, cerrar_antigua: true }, { ua: "Mozilla/5.0 (Windows NT 10.0)" });
  ok(c2.st === 200 && c2.d.cerradas === 1 && c2.d.dispositivos.abiertos === 2, "con su visto bueno (y el mismo código) entra y se cierra la sesión más antigua");
  ok((await pedir("GET", "cuenta", undefined, { sesion: sesionA })).st === 401 && (await pedir("GET", "cuenta", undefined, { sesion: sesionB })).st === 200, "el dispositivo más antiguo quedó fuera; el otro sigue dentro");
  ok(db.cuenta_sesiones.filter((s) => !s.cerrada_en).length === 2, "nunca hay más de 2 sesiones abiertas");
  await pedir("POST", "cuenta/salir", {}, { sesion: c2.d.sesion });
  ok((await pedir("GET", "cuenta", undefined, { sesion: c2.d.sesion })).st === 401, "«Cerrar sesión» deja ese pase sin efecto");
  db.cuenta_sesiones.find((s) => !s.cerrada_en)!.expira_en = new Date(reloj - 1000).toISOString();
  ok((await pedir("GET", "cuenta", undefined, { sesion: sesionB })).st === 401, "una sesión vencida (60 días sin usarse) ya no abre");
  db.cuenta_sesiones.length = 0; db.cuenta_codigos.length = 0;
  await pedir("POST", "cuenta/codigo", { telefono: TEL });
  sesionA = (await pedir("POST", "cuenta/entrar", { telefono: TEL, codigo: ultimoCodigoWA() })).d.sesion;
}

// ---------- 8. Comprar el paquete ----------
let paquete: Fila;
{
  config.sparked_paquete3 = "no";
  const cerrado = await pedir("POST", "paquete/comprar", { nombre: "María López", correo: "mama@correo.com" }, { sesion: sesionA });
  ok(cerrado.st === 503 && db.compras.length === 0 && preferencias.length === 0, "apagado: comprar responde «no disponible» y no se crea nada");
  config.sparked_paquete3 = "si";
  ok((await pedir("POST", "paquete/comprar", {})).st === 401, "sin sesión no se puede comprar");
  const r = await pedir("POST", "paquete/comprar", { nombre: "María López", correo: "mama@correo.com" }, { sesion: sesionA });
  paquete = db.compras[0];
  ok(r.st === 200 && r.d.modo === "mercadopago" && /mercadopago/.test(r.d.url) && r.d.compra_id === paquete.id && preferencias.length === 1, "comprar crea el link de pago de Mercado Pago");
  ok(paquete.producto === "paquete3" && Number(paquete.monto_mxn) === 199 && paquete.estado === "pendiente" && paquete.cuenta_id === db.cuentas[0].id && paquete.guia_id === null && paquete.telefono === TEL_I, "la compra queda pendiente: producto paquete3, $199, de esa cuenta y sin guía");
  const otra = await pedir("POST", "paquete/comprar", { nombre: "María López", correo: "mama@correo.com" }, { sesion: sesionA });
  ok(otra.d.compra_id === paquete.id && db.compras.length === 1, "si vuelve a oprimir Pagar, se reutiliza la misma compra pendiente");
  const est = await pedir("GET", `paquete/estado/${paquete.id}`, undefined, { sesion: sesionA });
  ok(est.st === 200 && est.d.estado === "pendiente" && est.d.abonado === false && est.d.saldo.guias === 0, "mientras no se paga: pendiente y sin saldo");
  ok(X.ventaCobrada(paquete) === false, "un paquete sin pagar no es venta");
}

// ---------- 9. El aviso de Mercado Pago abona el paquete UNA sola vez ----------
{
  const secreto = ENV.MP_WEBHOOK_SECRET!;
  let n = 0;
  const aviso = async (pagoId: string) => {
    const t = String(1762500000000 + ++n), rid = `req-${n}`;
    const firma = createHmac("sha256", secreto).update(`id:${pagoId};request-id:${rid};ts:${t};`).digest("hex");
    const url = new URL(`https://demo.supabase.co/functions/v1/sparked/pago/mercadopago?data.id=${pagoId}&type=payment`);
    const r = await I.avisoMercadoPago(new Request(url, { method: "POST", headers: { "content-type": "application/json", "x-signature": `ts=${t},v1=${firma}`, "x-request-id": rid }, body: JSON.stringify({ type: "payment", data: { id: pagoId } }) }), url);
    await Promise.all(segundoPlano.splice(0));
    return { st: r.status, d: await r.json() };
  };
  pagosMP["7001"] = { id: 7001, status: "pending", payment_type_id: "ticket", payment_method_id: "oxxo", external_reference: paquete.id, transaction_amount: 199, currency_id: "MXN", date_of_expiration: "2026-11-27T18:00:00.000-06:00" };
  await aviso("7001");
  ok(paquete.estado === "pendiente" && paquete.metodo_pago === "oxxo" && movs().length === 0, "ficha de OXXO sin pagar: la compra sigue pendiente y no se abona nada");
  pagosMP["7001"] = { ...pagosMP["7001"], status: "approved" };
  const [a, b] = await Promise.all([aviso("7001"), aviso("7001")]);
  const abonos = () => movs().filter((m) => m.motivo === "compra");
  ok(a.st === 200 && b.st === 200 && paquete.estado === "pagada" && abonos().length === 1 && abonos()[0].cambio === 3, "dos avisos de pago aprobado al mismo tiempo: se abonan +3 una sola vez");
  await aviso("7001");
  await I.confirmarPago(paquete.id);
  await C.abonarPaquete(base(), paquete);
  ok(abonos().length === 1 && saldoSql(paquete.cuenta_id) === 3, "el mismo aviso otra vez (y revisar la compra a mano): sigue habiendo un solo abono de 3");
  const dias = (new Date(abonos()[0].vence_en).getTime() - reloj) / 86400_000;
  ok(Math.abs(dias - 90) < 0.01 && abonos()[0].compra_id === paquete.id && abonos()[0].de_prueba === false, "el abono vence a los 90 días de la compra y queda ligado a su compra");
  ok(entregasDeGuia.length === 0 && !!paquete.entregada_en, "un paquete no pasa por la entrega de guías (no tiene link): queda marcado como abonado");
  ok(whatsapps.filter((w) => /Se agregaron \*3 guías\*/.test(w.texto)).length === 1 && correos.filter((c) => /3 guías/.test(c.asunto)).length === 1 && avisosDaniel.filter((x) => /Venta SparkEd: paquete/.test(x)).length === 1, "la familia recibe UN WhatsApp y UN correo («Se agregaron 3 guías…»), y Daniel un aviso de venta");
  ok(/cuenta\.html/.test(whatsapps.find((w) => /Se agregaron/.test(w.texto))!.texto) && /7 días de acceso ilimitado a tu guía, en 2 dispositivos/.test(whatsapps.find((w) => /Se agregaron/.test(w.texto))!.texto), "el mensaje trae el link a «Mi cuenta» y dice «7 días de acceso ilimitado a tu guía, en 2 dispositivos»");
  ok(X.ventaCobrada(paquete) === true && Number(paquete.monto_mxn) === 199, "el paquete cobrado por Mercado Pago es UNA venta de $199");
  const est = await pedir("GET", `paquete/estado/${paquete.id}`, undefined, { sesion: sesionA });
  ok(est.d.estado === "pagada" && est.d.abonado === true && est.d.saldo.guias === 3 && est.d.guias === 3, "la página del pago ve: pagada, abonada y 3 guías");
  // Un pago aprobado por menos dinero no abona nada (queda para revisar), igual que con las guías.
  const barato = (await consulta("compras").insert({ producto: "paquete3", cuenta_id: paquete.cuenta_id, monto_mxn: 199, estado: "pendiente" }).select("*").single()).data;
  pagosMP["7002"] = { id: 7002, status: "approved", payment_type_id: "credit_card", payment_method_id: "visa", external_reference: barato.id, transaction_amount: 1, currency_id: "MXN" };
  await aviso("7002");
  ok(db.compras.find((x) => x.id === barato.id)!.estado === "pendiente" && abonos().length === 1, "un pago aprobado por menos de $199 no abona nada: queda para revisar");
  db.compras = db.compras.filter((x) => x.id !== barato.id);
  // Confirmado a mano en el panel: cobrado por fuera = venta; cortesía = no es venta. En los dos casos se abona una vez.
  const aMano = (await consulta("compras").insert({ producto: "paquete3", cuenta_id: paquete.cuenta_id, monto_mxn: 199, estado: "pendiente", nombre: "María López", telefono: TEL_I }).select("*").single()).data;
  await I.confirmarPago(aMano.id, { manual: true, cobro: "cortesia" });
  await I.confirmarPago(aMano.id, { manual: true, cobro: "cortesia" });
  const fila = db.compras.find((x) => x.id === aMano.id)!;
  ok(fila.estado === "pagada" && fila.metodo_pago === "cortesia" && abonos().length === 2 && X.ventaCobrada(fila) === false && X.tipoSinCobro(fila) === "cortesia", "paquete de cortesía (marcado a mano): abona 3 una vez y NO cuenta como venta");
  await Promise.all(segundoPlano.splice(0));
  movs().splice(movs().findIndex((m) => m.compra_id === aMano.id), 1); db.compras = db.compras.filter((x) => x.id !== aMano.id);
  whatsapps.length = 0; correos.length = 0; avisosDaniel.length = 0;
}

// ---------- 10. Crear guías con saldo ----------
const cuentaId = () => db.cuentas[0].id as string;
const nuevoBorrador = (clave: string) => { const id = crypto.randomUUID(); const b = { id, clave, estado: "subiendo", grado: "1° Secundaria", materia: "Historia", colegio_id: null, colegio_texto: null, paginas: 1, archivos: [{ ruta: `borradores/${id}/1.jpg`, nombre: "1.jpg" }], trabajo_id: null, guia_id: null }; db.borradores.push(b); return b; };
let compraGuia1: Fila;
{
  const b1 = nuevoBorrador("ClaveDelBorradorUno0001");
  ok((await pedir("POST", "cuenta/guia", { clave: b1.clave })).st === 401, "sin sesión no se puede crear una guía con saldo");
  const r = await pedir("POST", "cuenta/guia", { clave: b1.clave }, { sesion: sesionA });
  compraGuia1 = db.compras.find((x) => x.id === r.d.compra_id)!;
  ok(r.st === 202 && r.d.quedan === 2 && r.d.usadas_de === 3 && saldoSql(cuentaId()) === 2, "crear una guía gasta 1: «Se usará 1 de tus 3 guías. Te quedarán 2»");
  ok(compraGuia1.metodo_pago === "saldo" && compraGuia1.estado === "pagada" && Number(compraGuia1.monto_mxn) === 0 && compraGuia1.producto === "guia" && compraGuia1.cuenta_id === cuentaId() && !!compraGuia1.acceso_id, "la guía queda como una compra sin cobro (método «saldo», $0) con su acceso creado");
  ok(X.ventaCobrada(compraGuia1) === false && X.tipoSinCobro(compraGuia1) === "saldo" && X.confirmadaAMano(compraGuia1) === false, "una guía hecha con saldo NO es venta, ni cortesía, ni se puede «cambiar a cobrada»");
  const t = db.trabajos[0], g = db.guias[0];
  ok(db.trabajos.length === 1 && t.alcance === "completa" && t.paso === "inicio" && t.guia_id === g.id && disparados.join() === t.id && g.origen === "personalizada", "arranca UN trabajo de guía completa (sin vista previa)");
  ok(b1.estado === "pagado" && b1.trabajo_id === t.id && b1.guia_id === g.id, "el borrador queda ligado a su guía y a su trabajo");
  const m = movs().find((x) => x.motivo === "guia")!;
  ok(m.cambio === -1 && m.compra_id === compraGuia1.id && m.guia_id === g.id && m.lote_id === movs().find((x) => x.motivo === "compra")!.id, "el libro anota −1 con su compra, su guía y el paquete del que salió");
  const repetida = await pedir("POST", "cuenta/guia", { clave: b1.clave }, { sesion: sesionA });
  ok(repetida.st === 409 && saldoSql(cuentaId()) === 2 && db.trabajos.length === 1, "las mismas páginas no gastan dos guías (doble clic o dos pestañas)");
  const est = await pedir("GET", `cuenta/guia/${compraGuia1.id}`, undefined, { sesion: sesionA });
  ok(est.st === 200 && est.d.estado === "generando" && est.d.progreso.pct === 30 && !est.d.link, "mientras se genera: avance, y todavía sin link");
  // La guía termina: se entrega y aparece con su link.
  g.cartucho = { completo: true }; g.titulo = "Las civilizaciones antiguas";
  const lista = await pedir("GET", `cuenta/guia/${compraGuia1.id}`, undefined, { sesion: sesionA });
  ok(lista.d.estado === "lista" && /guia\.html#Clave1$/.test(lista.d.link) && lista.d.titulo === "Las civilizaciones antiguas" && !!compraGuia1.entregada_en, "al terminar: «lista», con su link y su título");
  const mia = await pedir("GET", "cuenta", undefined, { sesion: sesionA });
  ok(mia.d.saldo.guias === 2 && mia.d.guias.length === 1 && mia.d.guias[0].estado === "lista" && !!mia.d.guias[0].link && mia.d.paquetes.length === 1 && mia.d.paquetes[0].guias === 3, "«Mi cuenta»: te quedan 2, tu guía hecha con su link y tu paquete");
  const nota = await C.notaDeSaldo(base(), compraGuia1);
  ok(/Te quedan 2 guías en tu paquete; puedes usarlas hasta el /.test(nota) && /cuenta\.html/.test(nota), "el mensaje de entrega dice cuántas guías quedan y dónde está la cuenta");
  ok((await C.devolverGuiaDeSaldo(base(), g.id, "x")) === false && saldoSql(cuentaId()) === 2 && compraGuia1.estado === "pagada", "una guía ya entregada no se devuelve");
}

// ---------- 11. Si la guía falla, se devuelve sola (una vez) ----------
{
  const b2 = nuevoBorrador("ClaveDelBorradorDos0002");
  const r = await pedir("POST", "cuenta/guia", { clave: b2.clave }, { sesion: sesionA });
  const compra = db.compras.find((x) => x.id === r.d.compra_id)!, guiaId = compra.guia_id;
  ok(r.st === 202 && saldoSql(cuentaId()) === 1, "segunda guía: queda 1");
  const motivo = "Las fotos no parecen material de estudio. Sube apuntes, páginas del libro o temarios.";
  const [d1, d2] = await Promise.all([C.devolverGuiaDeSaldo(base(), guiaId, motivo), C.devolverGuiaDeSaldo(base(), guiaId, motivo)]);
  await C.devolverGuiaDeSaldo(base(), guiaId, motivo);
  await Promise.all(segundoPlano.splice(0));
  const devoluciones = movs().filter((m) => m.motivo === "devolucion");
  ok(d1 === true && d2 === true && devoluciones.length === 1 && devoluciones[0].cambio === 1 && saldoSql(cuentaId()) === 2 && compra.estado === "fallida", "la guía falla: la compra queda «fallida» y el saldo recupera 1, una sola vez aunque el fallo se avise tres veces");
  ok(devoluciones[0].vence_en === movs().find((m) => m.motivo === "compra")!.vence_en, "la guía devuelta conserva el vencimiento de su paquete");
  ok(whatsapps.filter((w) => /No se usó ninguna guía de tu paquete: tienes 2 guías/.test(w.texto)).length === 1 && correos.length === 1 && avisosDaniel.length === 1, "la familia recibe UN aviso («No se usó ninguna guía de tu paquete…») y Daniel otro");
  const est = await pedir("GET", `cuenta/guia/${compra.id}`, undefined, { sesion: sesionA });
  ok(est.d.estado === "devuelta" && est.d.mensaje === motivo && est.d.saldo.guias === 2, "la página lo dice: no se pudo crear, por qué, y que el saldo sigue en 2");
  const mia = await pedir("GET", "cuenta", undefined, { sesion: sesionA });
  ok(mia.d.guias.length === 2 && mia.d.guias.some((g: any) => g.estado === "devuelta" && g.mensaje === motivo) && C.guiasUsadas(movs()) === 1, "en «Mi cuenta» aparece como devuelta; guías usadas de verdad: 1");
  // El trabajo falló y la devolución no salió en su momento: la página la repara.
  const b3 = nuevoBorrador("ClaveDelBorradorTres003");
  const r3 = await pedir("POST", "cuenta/guia", { clave: b3.clave }, { sesion: sesionA });
  const compra3 = db.compras.find((x) => x.id === r3.d.compra_id)!;
  compra3.pagada_en = new Date(reloj - 3 * 60_000).toISOString(); avance = { revision: true, avance: { pct: 0, mensaje: "x" } };
  const rep = await pedir("GET", `cuenta/guia/${compra3.id}`, undefined, { sesion: sesionA });
  ok(rep.d.estado === "devuelta" && saldoSql(cuentaId()) === 2 && compra3.estado === "fallida", "si el trabajo falló y nadie devolvió la guía, se devuelve al mirar su avance (red de seguridad)");
  avance = { revision: false, avance: { pct: 30, mensaje: "Leyendo tus fotos 📖 (1 de 2)" } };
  // Con tres devoluciones en un día, una pausa: cada intento gasta inteligencia artificial.
  const b4 = nuevoBorrador("ClaveDelBorradorCuatro4");
  const r4 = await pedir("POST", "cuenta/guia", { clave: b4.clave }, { sesion: sesionA });
  await C.devolverGuiaDeSaldo(base(), db.compras.find((x) => x.id === r4.d.compra_id)!.guia_id, motivo);
  const b5 = nuevoBorrador("ClaveDelBorradorCinco05");
  const r5 = await pedir("POST", "cuenta/guia", { clave: b5.clave }, { sesion: sesionA });
  ok(r5.st === 429 && saldoSql(cuentaId()) === 2 && b5.estado === "subiendo", "tres guías devueltas en un día: se pide una pausa y el saldo no se toca");
  movs().filter((m) => m.motivo === "devolucion").forEach((m) => { m.creado_en = new Date(reloj - 25 * 3600_000).toISOString(); });
  whatsapps.length = 0; correos.length = 0; avisosDaniel.length = 0; await Promise.all(segundoPlano.splice(0));
}

// ---------- 12. Dos usos al mismo tiempo con saldo 1: solo uno pasa ----------
{
  const b6 = nuevoBorrador("ClaveDelBorradorSeis006");
  ok((await pedir("POST", "cuenta/guia", { clave: b6.clave }, { sesion: sesionA })).st === 202 && saldoSql(cuentaId()) === 1, "queda 1 guía");
  const b7 = nuevoBorrador("ClaveDelBorradorSiete07"), b8 = nuevoBorrador("ClaveDelBorradorOcho008");
  const trabajosAntes = db.trabajos.length, comprasAntes = db.compras.length;
  const [x, y] = await Promise.all([pedir("POST", "cuenta/guia", { clave: b7.clave }, { sesion: sesionA }), pedir("POST", "cuenta/guia", { clave: b8.clave }, { sesion: sesionA })]);
  const estados = [x.st, y.st].sort().join();
  ok(estados === "202,402" && saldoSql(cuentaId()) === 0, `dos guías a la vez con saldo 1: una pasa y la otra recibe «no tienes guías» (${estados}); el saldo queda en 0, nunca negativo`);
  ok(db.trabajos.length === trabajosAntes + 1 && db.compras.length === comprasAntes + 1 && [b7, b8].filter((b) => b.estado === "subiendo").length === 1, "la que no pasó no dejó trabajo ni compra, y sus páginas quedan libres");
  ok(C.lotesDe(movs()).every((l: any) => l.quedan >= 0), "ningún lote quedó negativo");
  const sin = await pedir("POST", "cuenta/guia", { clave: [b7, b8].find((b) => b.estado === "subiendo")!.clave }, { sesion: sesionA });
  ok(sin.st === 402 && sin.d.sin_saldo === true, "sin saldo: «No tienes guías disponibles…»");
}

// ---------- 13. Vencimiento a los 90 días ----------
{
  const abono = movs().find((m) => m.motivo === "compra")!;
  await consulta("cuenta_saldo_movimientos").insert({ cuenta_id: cuentaId(), cambio: 2, motivo: "ajuste", lote_id: null, revierte_id: null, vence_en: enDias(10), de_prueba: false, nota: "Ajuste de Daniel" });
  ok(saldoSql(cuentaId()) === 2, "Daniel suma 2 guías a mano (ajuste)");
  const guardado = reloj;
  reloj += 11 * 86400_000;
  const tarde = await pedir("GET", "cuenta", undefined, { sesion: sesionA });
  const b9 = nuevoBorrador("ClaveDelBorradorNueve09");
  const r = await pedir("POST", "cuenta/guia", { clave: b9.clave }, { sesion: sesionA });
  ok(tarde.st === 401 || tarde.d.saldo.guias === 0, "pasado el vencimiento, el saldo vigente es 0");
  ok(r.st === 401 || r.st === 402, "y una guía vencida ya no se puede gastar");
  reloj = guardado;
  ok(Math.round((new Date(abono.vence_en).getTime() - new Date(abono.creado_en).getTime()) / 86400_000) === 90, "el paquete vence exactamente 90 días después de la compra");
}

// ---------- 14. La cuenta es de quien tiene el número ----------
{
  // Alguien aparta un número ajeno usando solo su correo (con WhatsApp desconectado).
  estadoWhatsApp = "notAuthorized";
  await pedir("POST", "cuenta/codigo", { telefono: "5599990001", correo: "intruso@correo.com" }, { ip: "7.7.7.7" });
  const intruso = await pedir("POST", "cuenta/entrar", { telefono: "5599990001", codigo: ultimoCodigoCorreo() });
  const cta = db.cuentas.find((c) => c.telefono === "+525599990001")!;
  ok(intruso.st === 200 && cta.telefono_verificado_en === null && cta.correo === "intruso@correo.com", "una cuenta que nace por correo queda con el WhatsApp SIN comprobar");
  // La dueña del número llega después y sí recibe el código por WhatsApp.
  estadoWhatsApp = "authorized";
  await pedir("POST", "cuenta/codigo", { telefono: "5599990001", correo: "duena@correo.com" }, { ip: "6.6.6.6" });
  const duena = await pedir("POST", "cuenta/entrar", { telefono: "5599990001", codigo: ultimoCodigoWA() });
  ok(duena.st === 200 && cta.correo === "duena@correo.com" && !!cta.telefono_verificado_en, "la primera vez que el número se comprueba por WhatsApp, el correo de respaldo pasa a ser el de esa persona");
  ok((await pedir("GET", "cuenta", undefined, { sesion: intruso.d.sesion })).st === 401 && (await pedir("GET", "cuenta", undefined, { sesion: duena.d.sesion })).st === 200, "y la sesión anterior (la del correo ajeno) se cierra: el saldo es de quien tiene el número");
  estadoWhatsApp = "notAuthorized";
  db.cuenta_codigos.forEach((c) => { c.creado_en = new Date(reloj - 2 * 3600_000).toISOString(); });
  await pedir("POST", "cuenta/codigo", { telefono: "5599990001", correo: "intruso@correo.com" }, { ip: "7.7.7.7" });
  ok(correos.at(-1)?.para === "duena@correo.com", "desde entonces el respaldo solo va al correo de la dueña, escriba lo que escriba el intruso");
  // El correo de respaldo solo se cambia desde un dispositivo que entró con el código de WhatsApp.
  const porCorreo = await pedir("POST", "cuenta/entrar", { telefono: "5599990001", codigo: ultimoCodigoCorreo() });
  const negado = await pedir("POST", "cuenta/correo", { correo: "intruso@correo.com" }, { sesion: porCorreo.d.sesion });
  ok(porCorreo.st === 200 && porCorreo.d.cuenta.correo_editable === false && negado.st === 403 && cta.correo === "duena@correo.com", "un dispositivo que entró por correo no puede cambiar el correo de respaldo");
  const cambio = await pedir("POST", "cuenta/correo", { correo: " Nueva@Correo.com " }, { sesion: duena.d.sesion });
  ok(cambio.st === 200 && cta.correo === "nueva@correo.com" && cambio.d.correo === "n•••@correo.com" && (await pedir("POST", "cuenta/correo", { correo: "no-es-correo" }, { sesion: duena.d.sesion })).st === 400, "el que entró con el código de WhatsApp sí puede cambiarlo (y un correo mal escrito se rechaza)");
  estadoWhatsApp = "authorized"; correos.length = 0; whatsapps.length = 0;
}

// ---------- 15. Pruebas automáticas: solo números de prueba, sin mandar nada ----------
{
  ok((await pedir("POST", "cuenta/codigo", { telefono: "0001234567", simular: true })).st === 401, "simular el envío exige la clave de administrador");
  ok((await pedir("POST", "cuenta/codigo", { telefono: TEL, simular: true }, { admin: true })).st === 400, "y solo sirve con números de prueba (+52 000…), nunca con el de una familia");
  ok((await pedir("POST", "cuenta/codigo", { telefono: "0001234567" })).st === 400, "un número de prueba no entra por la puerta de las familias");
  const sim = await pedir("POST", "cuenta/codigo", { telefono: "0001234567", simular: true, ip_prueba: "203.0.113.9" }, { admin: true });
  ok(sim.st === 200 && /^\d{6}$/.test(sim.d.codigo) && sim.d.simulado === true && whatsapps.length === 0 && correos.length === 0, "con la clave y un número de prueba: devuelve el código y no manda nada");
  const e = await pedir("POST", "cuenta/entrar", { telefono: "0001234567", codigo: sim.d.codigo });
  const prueba = db.cuentas.find((c) => c.telefono === "+520001234567")!;
  ok(e.st === 200 && prueba.de_prueba === true && prueba.telefono_verificado_en === null, "la cuenta que nace así queda marcada «de prueba»");
  config.sparked_paquete3 = "no";
  ok((await pedir("POST", "paquete/comprar", { nombre: "Prueba", correo: "prueba@sparked.invalid" }, { sesion: e.d.sesion })).st === 503, "apagado, ni una cuenta de prueba compra sin la clave de administrador");
  const compra = await pedir("POST", "paquete/comprar", { nombre: "Prueba", correo: "prueba@sparked.invalid" }, { sesion: e.d.sesion, admin: true });
  const fila = db.compras.find((x) => x.id === compra.d.compra_id)!;
  ok(compra.st === 200 && fila.telefono === null && fila.correo === null, "con la clave sí (para probar con la venta apagada), y su compra no lleva teléfono ni correo: ninguna prueba manda mensajes");
  config.sparked_paquete3 = "si";
  await I.confirmarPago(fila.id, { manual: true, cobro: "cortesia" }); await Promise.all(segundoPlano.splice(0));
  const abono = movs().find((m) => m.compra_id === fila.id)!;
  ok(abono.de_prueba === true && whatsapps.length === 0 && correos.length === 0 && avisosDaniel.length === 0, "el abono de una cuenta de prueba queda marcado de prueba y no avisa a nadie");
}

// ---------- 16. Lo que ve Daniel en el panel ----------
{
  ok((await pedir("GET", "admin/paquetes")).st === 401, "el panel de paquetes pide la clave de administrador");
  esAdmin = true;
  const r = await pedir("GET", "admin/paquetes");
  const R = r.d.resumen;
  ok(r.st === 200 && R.paquetes_vendidos === 1 && R.paquetes_cobrados === 1 && R.ingreso_mxn === 199, `paquetes vendidos y cobrados: 1 · $199 (salió ${R.paquetes_vendidos}, ${R.paquetes_cobrados} y $${R.ingreso_mxn}); el de prueba no cuenta`);
  ok(R.guias_abonadas === 3 && R.guias_usadas === 3 && R.guias_sin_usar === 2 && R.guias_devueltas === 3, `guías: 3 abonadas por compra, 3 usadas, 2 sin usar (el ajuste de Daniel) y 3 devueltas (salió ${R.guias_abonadas}, ${R.guias_usadas}, ${R.guias_sin_usar}, ${R.guias_devueltas})`);
  const texto = JSON.stringify(r.d);
  ok(!texto.includes("5512345678") && !texto.includes("mama@correo.com") && !texto.includes("López") && texto.includes("••• ••• 5678"), "en el panel el WhatsApp sale enmascarado; ni el número, ni el correo, ni el apellido salen completos");
  const cta = r.d.cuentas.find((c: any) => c.whatsapp === "••• ••• 5678");
  ok(cta.saldo === 2 && cta.usadas === 3 && cta.movimientos.length >= 8 && cta.movimientos.some((m: any) => m.motivo_texto === "Compra de un paquete" && m.cambio === 3) && cta.movimientos.some((m: any) => m.motivo_texto === "Guía devuelta (no se pudo crear)"), "cada cuenta trae su saldo y sus movimientos en palabras simples");
  const aj = await pedir("POST", `admin/cuentas/${cuentaId()}/ajuste`, { cambio: 1, nota: "Compensación" });
  ok(aj.st === 200 && aj.d.saldo.guias === 3 && movs().at(-1)!.motivo === "ajuste" && movs().at(-1)!.nota === "Compensación", "Daniel puede sumar una guía a mano: queda en el libro como ajuste");
  const menos = await pedir("POST", `admin/cuentas/${cuentaId()}/ajuste`, { cambio: -9 });
  ok(menos.st === 200 && menos.d.saldo.guias === 0 && menos.d.cambio === -3 && C.lotesDe(movs()).every((l: any) => l.quedan >= 0), "y restar: quita lo que hay (3), nunca deja el saldo negativo");
  ok((await pedir("DELETE", `admin/cuentas/${cuentaId()}`)).st === 403 && db.cuentas.some((c) => c.id === cuentaId()), "la cuenta de una familia NO se puede borrar");
  const prueba = db.cuentas.find((c) => c.de_prueba)!;
  const borrar = await pedir("DELETE", `admin/cuentas/${prueba.id}`);
  ok(borrar.st === 200 && !db.cuentas.some((c) => c.id === prueba.id) && !movs().some((m) => m.cuenta_id === prueba.id) && !db.compras.some((x) => x.cuenta_id === prueba.id), "una cuenta de prueba se borra con todo lo que creó");
  esAdmin = false;
}

// ---------- 17. Las cuentas del panel (ventas) ----------
{
  const P = { estado: "pagada", pagada_en: "2026-11-24T18:00:00Z" };
  const compras = [
    { ...P, monto_mxn: "199.00", metodo_pago: "tarjeta", mp_estado: "approved" },     // paquete cobrado
    { ...P, monto_mxn: "0.00", metodo_pago: "saldo", mp_estado: null },               // guía hecha con saldo
    { ...P, monto_mxn: "0.00", metodo_pago: "saldo", mp_estado: null },
    { ...P, monto_mxn: "100.00", metodo_pago: "oxxo", mp_estado: "approved" },        // guía suelta cobrada
    { ...P, monto_mxn: "199.00", metodo_pago: "oxxo", mp_estado: "pending", estado: "pendiente" },   // paquete sin pagar
    { ...P, monto_mxn: "199.00", metodo_pago: "tarjeta", mp_estado: "refunded" },     // paquete reembolsado
  ];
  const r = X.calcularCostos({ trabajos: [], previasDeGuias: [], tipos: [], ajusteTc: 18.5, hoy: "2026-11-24", dias: 30, servicios: [], compras });
  const m = r.ingresos.mes;
  ok(m.ventas === 2 && m.mxn === 299 && m.de_paquete === 2 && m.cortesias === 1 && m.con_codigo === 0, `un paquete cobrado ($199) + una guía suelta ($100) = 2 ventas y $299; las 2 guías de paquete no son ventas ni cortesías (salió ${m.ventas}, $${m.mxn}, ${m.de_paquete} de paquete)`);
  ok(/sparked_paquete3: "no", sparked_paquete3_precio: "199", sparked_paquete3_dias: "90"/.test(fuente), "en el código el paquete nace apagado, a $199 y con 90 días");
  ok(/if \(compra\.producto === "paquete3"\) \{\s*const abono = await abonarPaquete\(/.test(fuente) && /q\.neq\("producto", "paquete3"\)/.test(fuente), "confirmarPago abona los paquetes en vez de entregar una guía, y los paquetes no salen en la lista de compras de guías");
}

// ---------- 18. El servidor entero, tal como se despliega ----------
// Lo anterior prueba cuenta.ts con un contexto armado aquí. Esta parte carga el index.ts REAL completo (solo cambia sus
// imports de fuera por dobles) y le manda peticiones como las del sitio y las de Mercado Pago. Así se ve que lo nuevo
// quedó bien conectado con el cobro, la entrega y la generación de verdad, y que la venta de siempre sigue funcionando
// de punta a punta (el 10 nov 2026 un choque de rutas dejó nueve horas sin abrir las guías ya pagadas).
{
  for (const t of Object.keys(db)) db[t] = [];
  whatsapps.length = 0; correos.length = 0; avisosDaniel.length = 0;
  reloj = Date.parse("2026-11-24T18:00:00Z");
  const CLAVE_ADMIN = "ClaveDeAdministradorDePrueba", DANIEL = "daniel@sparked.invalid";
  db.config = [{ clave: "admin_key_sha256", valor: createHash("sha256").update(CLAVE_ADMIN).digest("hex") }, { clave: "sparked_correo_aviso", valor: DANIEL }, { clave: "sparked_wa_imagenes", valor: "no" }];

  // Los archivos de las familias (bucket privado): pedir el link de subida cuenta aquí como página ya subida.
  const subidas = new Set<string>();
  const almacen = {
    createSignedUploadUrl: async (ruta: string) => { subidas.add(ruta); return { data: { signedUrl: "https://demo.supabase.co/storage/v1/object/upload/sign/materiales/" + ruta, path: ruta }, error: null }; },
    list: async (carpeta: string) => ({ data: [...subidas].filter((r) => r.startsWith(carpeta + "/")).map((r) => ({ name: r.slice(carpeta.length + 1) })), error: null }),
    remove: async (rutas: string[]) => { for (const r of rutas) subidas.delete(r); return { data: [], error: null }; },
    download: async (_ruta: string) => ({ data: new Blob([new Uint8Array([255, 216, 255, 217])]), error: null }),
  };
  // Lo que sale del servidor: correos (Resend), links de pago y consultas de pagos (Mercado Pago) y sus propios pasos.
  const fetchDeAntes = (globalThis as any).fetch;
  const correosResend: any[] = [], preferenciasMP: any[] = [], pasos: { id: string; interno: string }[] = [];
  (globalThis as any).fetch = async (url: string, init: any = {}) => {
    const u = String(url), cuerpo = init?.body ? JSON.parse(init.body) : {};
    const responder = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
    if (u === "https://api.resend.com/emails") { correosResend.push(cuerpo); return responder({ id: "correo-" + correosResend.length }); }
    if (u === "https://api.mercadopago.com/checkout/preferences") { preferenciasMP.push(cuerpo); const id = "pref-servidor-" + preferenciasMP.length; return responder({ id, init_point: "https://www.mercadopago.com.mx/checkout/v1/redirect?pref_id=" + id }, 201); }
    const pago = u.match(/^https:\/\/api\.mercadopago\.com\/v1\/payments\/(\d+)$/);
    if (pago) return pagosMP[pago[1]] ? responder(pagosMP[pago[1]]) : responder({ message: "Payment not found" }, 404);
    if (u.startsWith("https://api.mercadopago.com/v1/payments/search")) return responder({ results: Object.values(pagosMP).filter((p: any) => u.includes(encodeURIComponent(String(p.external_reference)))) });
    const paso = u.match(/\/functions\/v1\/sparked\/trabajo\/([0-9a-f-]{36})\/paso$/);
    if (paso) { pasos.push({ id: paso[1], interno: String(init?.headers?.["x-interno"] ?? "") }); return responder({ ok: true, aceptado: true }, 202); }
    return fetchDeAntes(url, init);
  };
  const azar = Math.random; Math.random = () => 0.99;   // sin la limpieza ocasional: la prueba hace siempre lo mismo

  // El servidor: los mismos archivos de funciones/sparked, con sus imports de fuera cambiados por dobles.
  const origen = join(raiz, "funciones", "sparked"), copiaServidor = mkdtempSync(join(tmpdir(), "probar-servidor-"));
  const DOBLES: Record<string, [string, string][]> = {
    "index.ts": [[`import "jsr:@supabase/functions-js/edge-runtime.d.ts";`, ``], [`import { createClient } from "npm:@supabase/supabase-js@2";`, `const createClient = (..._a: unknown[]) => (globalThis as any).__saldo.supabaseEntero;`]],
    "pipeline.ts": [[`import { jsonrepair } from "npm:jsonrepair@3";`, `const jsonrepair = (s: string) => s;`]],
    "qr.ts": [[`import qrcode from "npm:qrcode-generator@1.4.4";`, `const qrcode = (..._a: unknown[]) => ({ addData(_t: string) {}, make() {}, getModuleCount: () => 21, isDark: (f: number, c: number) => (f + c) % 2 === 0 });`]],
  };
  for (const f of readdirSync(origen).filter((x) => x.endsWith(".ts"))) {
    let s = readFileSync(join(origen, f), "utf8");
    for (const [de, a] of DOBLES[f] ?? []) { if (!s.includes(de)) throw new Error(`El doble de ${f} ya no encaja: ${de}`); s = s.replace(de, a); }
    if (/from "(npm|jsr|https?):/.test(s)) throw new Error(`${f} tiene un import de fuera sin doble: agrégalo a DOBLES`);
    writeFileSync(join(copiaServidor, f), s);
  }
  let manejador: (req: Request) => Promise<Response> = async () => new Response("{}", { status: 500 });
  const enCurso: Promise<unknown>[] = [];
  (globalThis as any).Deno.serve = (h: typeof manejador) => { manejador = h; };
  (globalThis as any).EdgeRuntime = { waitUntil: (p: Promise<unknown>) => { enCurso.push(p); } };
  (globalThis as any).__saldo.supabaseEntero = { ...supabase, storage: { from: () => almacen } };
  await import(pathToFileURL(join(copiaServidor, "index.ts")).href);
  rmSync(copiaServidor, { recursive: true, force: true });

  const asentar = async () => { for (let i = 0; i < 30 && enCurso.length; i++) await Promise.all(enCurso.splice(0)); };
  const servidor = async (m: string, ruta: string, cuerpo?: unknown, op: { sesion?: string; admin?: boolean; cab?: Record<string, string> } = {}) => {
    const cabeceras: Record<string, string> = { "content-type": "application/json", "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)", "x-forwarded-for": "200.1.1.9", ...(op.cab ?? {}) };
    if (op.sesion) cabeceras["x-cuenta"] = op.sesion;
    if (op.admin) cabeceras["x-admin-key"] = CLAVE_ADMIN;
    const r = await manejador(new Request(`https://demo.supabase.co/functions/v1/sparked/${ruta}`, { method: m, headers: cabeceras, body: cuerpo !== undefined && m !== "GET" ? JSON.stringify(cuerpo) : undefined }));
    await asentar();
    return { st: r.status, d: (await r.json().catch(() => null)) as any };
  };
  let nAviso = 0;
  const avisoMP = (pagoId: string) => {
    const t = String(1762600000000 + ++nAviso), rid = `servidor-${nAviso}`;
    const firma = createHmac("sha256", ENV.MP_WEBHOOK_SECRET!).update(`id:${pagoId};request-id:${rid};ts:${t};`).digest("hex");
    return servidor("POST", `pago/mercadopago?data.id=${pagoId}&type=payment`, { type: "payment", data: { id: pagoId } }, { cab: { "x-signature": `ts=${t},v1=${firma}`, "x-request-id": rid } });
  };
  const paraDaniel = () => correosResend.filter((x) => x.to?.[0] === DANIEL).map((x) => String(x.subject));
  const cartuchoBueno = () => ({ completo: true, plan: { presupuesto_slides: 25 }, bloques: [{ id: "b1", titulo: "La Independencia", pistas: [{ id: "b1p1", titulo: "El inicio", ideas: ["El inicio: 1810"] }], actividades: [1, 2, 3, 4, 5, 6].map((n) => ({ id: "b1om" + n, tipo: "opcion_multiple", pregunta: `¿Pregunta ${n}?`, opciones: ["a", "b", "c", "d"], correcta: 0 })), mini_examen: [], duelo: [] }] });

  // a) Arranca y las rutas de siempre responden lo de siempre.
  const inicio = await servidor("GET", "");
  ok(inicio.st === 200 && inicio.d.version === fuente.match(/const VERSION = "([^"]+)"/)![1], `el servidor completo arranca y dice su versión (${inicio.d?.version})`);
  const ping = await servidor("GET", "admin/ping", undefined, { admin: true });
  ok((await servidor("GET", "admin/ping")).st === 401 && ping.st === 200 && ping.d.config.sparked_paquete3 === "no" && ping.d.config.sparked_paquete3_precio === "199", "la clave de administrador de siempre sigue abriendo el panel; el paquete nace apagado y a $199");
  const viejas = [await servidor("GET", "colegios"), await servidor("GET", "pago/estado/00000000-0000-4000-8000-000000000000"), await servidor("GET", "ruta-que-no-existe"), await servidor("POST", "pago/crear", {})];
  ok(viejas[0].st === 200 && Array.isArray(viejas[0].d.colegios) && viejas[1].st === 404 && viejas[1].d.error === "Esa compra no existe" && viejas[2].st === 404 && viejas[3].st === 400, "las rutas de siempre responden lo de siempre (colegios, estado de un pago, crear un pago, ruta desconocida)");

  // b) Apagado no vende; se enciende desde los Ajustes del panel.
  ok((await servidor("GET", "paquete/info")).d.disponible === false, "apagado: el sitio recibe «no disponible» y esconde los botones");
  const encender = await servidor("POST", "admin/config", { sparked_paquete3: "si" }, { admin: true });
  const info = await servidor("GET", "paquete/info");
  ok(encender.st === 200 && info.d.disponible === true && info.d.precio === 199 && info.d.guias === 3 && info.d.dias === 90 && info.d.precio_guia === 100, "se enciende desde los Ajustes del panel y en ese momento el sitio lo ve: 3 guías, $199, 90 días");

  // c) Una familia entra con su WhatsApp y compra el paquete: el link de pago sale del cobro de verdad.
  const TEL2 = "5533334444", CORREO2 = "papa@correo.com";
  const pedido = await servidor("POST", "cuenta/codigo", { telefono: TEL2, correo: CORREO2, nombre: "Pedro Ruiz" });
  const entrada = await servidor("POST", "cuenta/entrar", { telefono: TEL2, codigo: ultimoCodigoWA() });
  const sesion2: string = entrada.d?.sesion ?? "";
  ok(pedido.st === 200 && entrada.st === 200 && sesion2.length >= 32 && entrada.d.saldo.guias === 0 && (await servidor("GET", "cuenta", undefined, { sesion: sesion2 })).st === 200, "en el servidor real: el código llega por WhatsApp, se entra con él y la sesión abre «Mi cuenta»");
  const compraP = await servidor("POST", "paquete/comprar", { nombre: "Pedro Ruiz", correo: CORREO2 }, { sesion: sesion2 });
  const pref = preferenciasMP.at(-1) ?? {};
  ok(compraP.st === 200 && compraP.d.modo === "mercadopago" && /pref-servidor-1$/.test(compraP.d.url) && pref.external_reference === compraP.d.compra_id && pref.items?.[0]?.unit_price === 199 && /paquete de 3 guías/.test(pref.items?.[0]?.title ?? "") && /90 días/.test(pref.items?.[0]?.description ?? ""), "«Comprar» crea en Mercado Pago el link de pago del paquete: $199, 3 guías, 90 días");
  const excluidos = (pref.payment_methods?.excluded_payment_types ?? []).map((x: any) => x.id);
  ok(/cuenta\.html\?compra=/.test(pref.back_urls?.success ?? "") && /&pago=pendiente$/.test(pref.back_urls?.pending ?? "") && String(pref.notification_url).endsWith("/pago/mercadopago") && !["credit_card", "debit_card", "ticket", "bank_transfer"].some((x) => excluidos.includes(x)) && pref.payer?.email === CORREO2, "ese link acepta tarjeta, OXXO y transferencia, regresa a «Mi cuenta» y avisa al servidor");
  const publico = await servidor("GET", `pago/estado/${compraP.d.compra_id}`);
  ok(publico.st === 200 && publico.d.producto === "paquete3" && publico.d.estado === "pendiente" && !("correo" in publico.d) && !("telefono" in publico.d) && !("link" in publico.d), "la ruta pública del estado de un pago no cuenta nada del paquete (ni correo ni teléfono): eso se ve con sesión");

  // d) Mercado Pago avisa del pago (dos veces a la vez y una más): el paquete se abona una sola vez.
  pagosMP["8001"] = { id: 8001, status: "approved", payment_type_id: "credit_card", payment_method_id: "visa", external_reference: compraP.d.compra_id, transaction_amount: 199, currency_id: "MXN" };
  const [av1, av2] = await Promise.all([avisoMP("8001"), avisoMP("8001")]); const av3 = await avisoMP("8001");
  const abonosP = movs().filter((x) => x.motivo === "compra" && x.compra_id === compraP.d.compra_id);
  const cuenta2 = await servidor("GET", "cuenta", undefined, { sesion: sesion2 });
  ok([av1, av2, av3].every((x) => x.st === 200) && abonosP.length === 1 && abonosP[0].cambio === 3 && cuenta2.d.saldo.guias === 3 && cuenta2.d.paquetes[0]?.estado === "pagada", `tres avisos de Mercado Pago del mismo pago: un solo abono de 3 guías (saldo ${cuenta2.d?.saldo?.guias})`);
  ok(whatsapps.filter((x) => /Se agregaron \*3 guías\*/.test(x.texto)).length === 1 && correosResend.filter((x) => x.to?.[0] === CORREO2).length === 1 && paraDaniel().filter((x) => /paquete/i.test(x)).length === 1, "la familia recibe UN WhatsApp y UN correo del abono, y Daniel UN aviso de la venta del paquete");
  ok((await servidor("POST", "pago/mercadopago?data.id=8001&type=payment", {}, { cab: { "x-signature": "ts=1,v1=falsa", "x-request-id": "x" } })).st === 401 && movs().length === 1, "un aviso con firma falsa no abona nada");

  // e) Crear una guía con saldo: la entrega y la generación son las de verdad. Si la generación falla, se devuelve sola.
  const nuevoBorrador = () => servidor("POST", "borrador", { grado: "6° primaria", materia: "Historia", paginas: [{ nombre: "pagina-1.jpg", tipo: "image/jpeg", tamano: 250000 }] });
  const b1 = await nuevoBorrador();
  const antesDeGuia = paraDaniel().length;
  const g1 = await servidor("POST", "cuenta/guia", { clave: b1.d?.clave }, { sesion: sesion2 });
  const compra1 = db.compras.find((x) => x.id === g1.d?.compra_id) ?? {};
  const trabajos1 = db.trabajos.filter((t) => t.guia_id === compra1.guia_id);
  ok(b1.st === 201 && g1.st === 202 && g1.d.quedan === 2 && compra1.metodo_pago === "saldo" && Number(compra1.monto_mxn) === 0 && compra1.estado === "pagada" && !!compra1.acceso_id && db.accesos.length === 1 && db.clases.length === 1, "crear con saldo: descuenta 1 (quedan 2) y la entrega de verdad le aparta su acceso de 7 días y 2 dispositivos");
  ok(trabajos1.length === 1 && trabajos1[0].alcance === "completa" && trabajos1[0].paso === "inicio" && pasos.length === 1 && pasos[0].id === trabajos1[0].id && db.borradores[0].estado === "pagado", "y arranca UN trabajo de guía completa (sin vista previa ni trabajo «resto»)");
  ok(paraDaniel().length === antesDeGuia && X.ventaCobrada(compra1) === false && compra1.entregada_en === null, "una guía hecha con saldo no es venta ni manda aviso de venta, y el link no sale mientras no esté completa");
  const correrPasoDe = (id: string) => servidor("POST", `trabajo/${id}/paso`, {}, { cab: { "x-interno": pasos.find((p) => p.id === id)!.interno } });
  await correrPasoDe(trabajos1[0].id);   // inicio → leer las fotos
  const antesDeFallar = whatsapps.length;
  await correrPasoDe(trabajos1[0].id);   // leer las fotos: aquí no hay IA encendida → falla definitiva
  await correrPasoDe(trabajos1[0].id);   // un paso de más no cambia nada
  const tras = await servidor("GET", "cuenta", undefined, { sesion: sesion2 });
  ok(trabajos1[0].estado === "error" && compra1.estado === "fallida" && movs().filter((x) => x.motivo === "devolucion").length === 1 && tras.d.saldo.guias === 3 && tras.d.guias[0]?.estado === "devuelta", `si la generación falla, el servidor devuelve la guía al saldo él solo y una sola vez (saldo ${tras.d?.saldo?.guias})`);
  ok(whatsapps.length === antesDeFallar + 1 && /No se usó ninguna guía de tu paquete: tienes 3 guías/.test(whatsapps.at(-1)!.texto) && paraDaniel().filter((x) => /no se pudo crear/.test(x)).length === 1, "la familia y Daniel reciben un solo aviso de la devolución");

  // f) La segunda sí termina: se entrega completa, con su link, y el mensaje dice cuántas guías quedan.
  reloj += 120_000;
  const b2 = await nuevoBorrador();
  const g2 = await servidor("POST", "cuenta/guia", { clave: b2.d?.clave }, { sesion: sesion2 });
  const compra2 = db.compras.find((x) => x.id === g2.d?.compra_id) ?? {};
  const guia2 = db.guias.find((x) => x.id === compra2.guia_id) ?? {}, trabajo2 = db.trabajos.find((t) => t.guia_id === compra2.guia_id) ?? {};
  const generando = await servidor("GET", `cuenta/guia/${compra2.id}`, undefined, { sesion: sesion2 });
  ok(g2.st === 202 && generando.st === 200 && generando.d.estado === "generando" && !("link" in generando.d), "mientras se genera, «Mi cuenta» enseña el avance y ningún link");
  // La generación termina (aquí sin IA): la guía queda completa y verificada, como la deja el generador.
  Object.assign(guia2, { cartucho: cartuchoBueno(), titulo: "La Independencia de México", estado: "publicada" }); Object.assign(trabajo2, { estado: "listo", actualizado_en: ahoraIso() });
  const antesDeEntregar = { wa: whatsapps.length, correo: correosResend.length };
  const lista = await servidor("GET", `cuenta/guia/${compra2.id}`, undefined, { sesion: sesion2 });
  const acceso2 = db.accesos.find((a) => a.id === compra2.acceso_id) ?? {};
  ok(lista.st === 200 && lista.d.estado === "lista" && lista.d.link === `https://sparkeducation-mx.com/sparked/guia.html#${acceso2.token}` && !!compra2.entregada_en && lista.d.saldo.guias === 2, "al quedar completa se entrega: «Mi cuenta» ya enseña su link de 7 días");
  const waEntrega = whatsapps.slice(antesDeEntregar.wa).map((x) => x.texto).join("\n"), correoEntrega = correosResend.slice(antesDeEntregar.correo).find((x) => x.to?.[0] === CORREO2);
  ok(waEntrega.includes(lista.d.link) && /Te quedan 2 guías en tu paquete/.test(waEntrega) && /cuenta\.html/.test(waEntrega), "el WhatsApp de entrega lleva el link y dice «Te quedan 2 guías en tu paquete»");
  ok(!!correoEntrega && /Usaste 1 guía de tu paquete/.test(correoEntrega.html) && /Te quedan 2 guías/.test(correoEntrega.html) && /Guía de tu paquete/.test(correoEntrega.html) && !/\$0/.test(correoEntrega.html), "el correo de entrega dice «Usaste 1 guía de tu paquete» (no habla de un pago de $0)");
  await servidor("GET", `cuenta/guia/${compra2.id}`, undefined, { sesion: sesion2 });
  ok(whatsapps.length === antesDeEntregar.wa + 1 && correosResend.filter((x) => x.to?.[0] === CORREO2).length === 3, "volver a consultar no la entrega otra vez");

  // g) La venta de siempre (una guía suelta de $100) sigue igual, de punta a punta.
  reloj += 120_000;
  const idBiblio = crypto.randomUUID();
  db.guias.push({ id: idBiblio, titulo: "Fracciones", grado: "5° primaria", materia: "Matemáticas", colegio_id: null, origen: "biblioteca", estado: "publicada", clase_id: null, borrador_id: null, cartucho: cartuchoBueno(), creada_en: ahoraIso() });
  const TEL3 = "+525511112222", CORREO3 = "mama.suelta@correo.com";
  const compraS = await servidor("POST", "pago/crear", { guia_id: idBiblio, nombre: "Lucía Paz", telefono: "5511112222", correo: CORREO3 });
  const prefS = preferenciasMP.at(-1) ?? {};
  ok(compraS.st === 200 && compraS.d.modo === "mercadopago" && prefS.items?.[0]?.title === "Guía SparkEd: Fracciones" && prefS.items?.[0]?.unit_price === 100 && /7 días de acceso ilimitado a tu guía, en 2 dispositivos/.test(prefS.items?.[0]?.description ?? "") && /listo\.html\?compra=/.test(prefS.back_urls?.success ?? ""), "guía suelta: su link de pago es el de siempre ($100, regresa a listo.html)");
  pagosMP["8002"] = { id: 8002, status: "approved", payment_type_id: "ticket", payment_method_id: "oxxo", external_reference: compraS.d.compra_id, transaction_amount: 100, currency_id: "MXN" };
  const antesS = { wa: whatsapps.length, correo: correosResend.length };
  await avisoMP("8002");
  const estadoS = await servidor("GET", `pago/estado/${compraS.d.compra_id}`);
  const filaS = db.compras.find((x) => x.id === compraS.d.compra_id) ?? {};
  ok(estadoS.st === 200 && estadoS.d.estado === "pagada" && estadoS.d.guia_lista === true && /guia\.html#[A-Za-z0-9]{8,}$/.test(estadoS.d.link ?? "") && filaS.producto === "guia" && filaS.cuenta_id == null && X.ventaCobrada(filaS) === true, "guía suelta pagada en OXXO: se entrega con su link, como siempre, y es una venta");
  const waS = whatsapps.slice(antesS.wa).map((x) => x.texto).join("\n"), correoS = correosResend.slice(antesS.correo).find((x) => x.to?.[0] === CORREO3);
  ok(whatsapps.slice(antesS.wa).some((x) => String(x.chat).endsWith(TEL3.slice(-10) + "@c.us")) && waS.includes(estadoS.d.link) && !/paquete/i.test(waS) && !!correoS && /Tu pago se confirmó/.test(correoS.html) && !/paquete/i.test(correoS.html) && paraDaniel().some((x) => x === "Venta SparkEd: Fracciones"), "su WhatsApp y su correo son los de siempre (nada de paquetes) y Daniel recibe «Venta SparkEd»");

  // h) Lo que ve Daniel: el paquete es una venta de $199; las guías con saldo no; los paquetes van en su sección.
  const resumen = await servidor("GET", "admin/resumen", undefined, { admin: true });
  const RC = resumen.d?.compras ?? {}, RP = resumen.d?.paquetes ?? {};
  ok(resumen.st === 200 && RC.pagadas_mes === 2 && RC.ingresos_mes === 299 && RC.de_paquete_mes === 1 && RC.cortesias_mes === 0 && RC.pendientes === 0 && RP.vendidos_mes === 1 && RP.ingresos_mes === 199 && RP.pendientes === 0, `Resumen del panel: 2 ventas · $299 (un paquete de $199 y una guía de $100) y 1 guía hecha con saldo aparte (salió ${RC.pagadas_mes} · $${RC.ingresos_mes} · ${RC.de_paquete_mes})`);
  const listaCompras = await servidor("GET", "admin/compras", undefined, { admin: true }), soloPaquetes = await servidor("GET", "admin/compras?producto=paquete3", undefined, { admin: true });
  ok(listaCompras.st === 200 && listaCompras.d.length === 3 && listaCompras.d.every((x: any) => x.producto !== "paquete3") && listaCompras.d.find((x: any) => x.id === compra2.id)?.cobro === "saldo" && soloPaquetes.d.length === 1 && soloPaquetes.d[0].cobro === "linea", "en Compras salen las guías (las de saldo marcadas como tales) y no los paquetes; los paquetes se piden aparte");
  ok((await servidor("POST", `admin/compras/${compraP.d.compra_id}/reenviar`, {}, { admin: true })).st === 409 && (await servidor("POST", `pago/reintentar/${compraP.d.compra_id}`, {})).d.modo === "pagada", "un paquete no tiene link que reenviar");
  const panel = await servidor("GET", "admin/paquetes", undefined, { admin: true });
  const PR = panel.d?.resumen ?? {};
  ok((await servidor("GET", "admin/paquetes")).st === 401 && panel.st === 200 && PR.paquetes_vendidos === 1 && PR.paquetes_cobrados === 1 && PR.ingreso_mxn === 199 && PR.guias_usadas === 1 && PR.guias_sin_usar === 2 && PR.guias_devueltas === 1 && !JSON.stringify(panel.d).includes(TEL2), `sección Paquetes del panel: 1 vendido y cobrado ($199), 1 guía usada, 2 sin usar, 1 devuelta; el WhatsApp sale enmascarado`);

  Math.random = azar; (globalThis as any).fetch = fetchDeAntes;
}

console.log(`\n${total - fallas} de ${total} comprobaciones bien${fallas ? `; ${fallas} fallaron` : ""}.`);
process.exit(fallas ? 1 : 0);
