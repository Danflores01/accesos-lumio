// Candado de la suscripción mensual «Guías ilimitadas» (349 MXN al mes; decisiones de Daniel del 23 al 25 nov 2026).
// Uso: node herramientas/probar-suscripciones.ts   (Node 23.6 o más nuevo: corre TypeScript sin compilar; no usa internet ni la base)
//
// Carga el servidor ENTERO tal como se despliega (el index.ts real con cuenta.ts, suscripcion.ts y los demás módulos; solo
// cambian sus imports de fuera por dobles) con una base de datos de juguete, un Mercado Pago de juguete (suscripciones,
// cuotas y pagos), WhatsApp y correo de juguete y un reloj que se puede adelantar. Le manda peticiones como las del sitio
// y avisos de Mercado Pago FIRMADOS como los de verdad, y revisa:
//   · apagada ('no') nadie la contrata; en «solo probadores» un número que no está en la lista tampoco;
//   · alta con 7 días gratis (la fecha del primer cobro la confirma Mercado Pago) y aviso de cobro en la bienvenida;
//   · una sola prueba gratis por WhatsApp y una por tarjeta (y por cuenta de Mercado Pago);
//   · el cobro: activa la suscripción, alarga el periodo UNA sola vez aunque el aviso llegue repetido o dos a la vez;
//   · rechazo → en gracia (abre sus guías, no crea nuevas) → vencida (y se cancela en Mercado Pago);
//   · cancelar en un clic: conserva lo pagado hasta el fin del periodo, con el mensaje que pidió Daniel;
//   · la guía de la suscriptora se genera completa, no gasta el saldo del paquete, no es venta y sigue abierta mientras
//     la suscripción esté pagada; más de 15 guías en la prueba avisa a Daniel y no bloquea;
//   · la tarea diaria con fechas simuladas: aviso de renovación 6 días antes (una vez), gracia → vencida;
//   · las cuentas del panel: un cobro es venta solo si Mercado Pago lo aprobó; el WhatsApp nunca sale completo;
//   · cambiar el método de pago SIN cancelar (25 nov 2026): activa, en prueba y en gracia; el contrato anterior se
//     cancela solo después de que Mercado Pago confirma el nuevo; abandonar a la mitad no toca nada; el aviso repetido
//     no lo aplica dos veces; no hay cobro doble ni otra prueba gratis; la tarjeta nueva queda en pruebas_usadas; y el
//     aviso de cobro fallido trae el link directo a «Cambiar método de pago».
// La prueba en vivo (contra producción, con una cuenta de prueba) es _guardia/skill/guardia-sparked/scripts/probar-suscripcion.mjs.
import { createHmac, createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdtempSync, rmSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const origen = join(raiz, "funciones", "sparked");
const fuente = readFileSync(join(origen, "index.ts"), "utf8");

// ---------- Entorno y reloj de juguete ----------
const ENV: Record<string, string | undefined> = { SUPABASE_URL: "https://demo.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "llave-de-prueba", GREEN_API_ID_INSTANCE: "7107", GREEN_API_TOKEN_INSTANCE: "token-de-prueba", RESEND_API_KEY: "re_prueba", MP_ACCESS_TOKEN: "APP_USR-solo-para-la-prueba", MP_WEBHOOK_SECRET: "clave-secreta-de-prueba" };
(globalThis as any).Deno = { env: { get: (k: string) => ENV[k] } };
const DIA = 86400_000, HORA = 3600_000, MIN = 60_000;
// Todo el servidor lee la hora de aquí: así se puede adelantar el tiempo (7 días de prueba, un mes, 10 días de gracia).
let reloj = Date.parse("2026-11-25T18:00:00Z"), serie = 0;
Date.now = () => reloj;
const iso = (ms: number) => new Date(ms).toISOString();
const ahoraIso = () => iso(reloj);
const ms = (x: unknown) => (typeof x === "number" ? x : new Date(String(x)).getTime());
const masUnMes = (t: number) => { const d = new Date(t); d.setUTCMonth(d.getUTCMonth() + 1); return d.getTime(); };
const VIVAS = ["pendiente", "en_prueba", "activa", "en_gracia"];

// ---------- Base de datos de juguete ----------
type Fila = Record<string, any>;
const db: Record<string, Fila[]> = {};
const NUMERADAS = ["cuenta_codigos", "cuenta_saldo_movimientos", "wa_mensajes", "pruebas_usadas"];
const FECHA_ALTA: Record<string, string> = { cuentas: "creada_en", cuenta_sesiones: "creada_en", compras: "creada_en", guias: "creada_en", suscripciones: "creada_en", solicitudes: "creada_en" };
const UNICAS: Record<string, string[]> = { cuentas: ["telefono"], cuenta_sesiones: ["token_sha256"], suscripcion_cobros: ["mp_payment_id"] };
const DEFECTO: Record<string, () => Fila> = {
  cuentas: () => ({ de_prueba: false, correo: null, nombre: null, prueba_gratis_usada_en: null, telefono_verificado_en: null, correo_verificado_en: null, ultimo_acceso_en: null }),
  cuenta_codigos: () => ({ intentos: 0, usado_en: null }),
  compras: () => ({ producto: "guia", estado: "pendiente", entregada_en: null, acceso_id: null, guia_id: null, borrador_id: null, cuenta_id: null, suscripcion_id: null, mp_estado: null, metodo_pago: null, mp_preferencia_id: null, pagada_en: null, stripe_session_id: null, codigo: null, codigo_usado_en: null, wa_estado: null, correo: null, telefono: null }),
  borradores: () => ({ trabajo_id: null, guia_id: null, expira_en: iso(reloj + DIA) }),
  guias: () => ({ cartucho: null, clase_id: null, borrar_en: null }),
  trabajos: () => ({ actualizado_en: ahoraIso(), intentos: 0, costo_usd: 0, error: null }),
  accesos: () => ({ primer_uso_en: null, revocado: false, usos: 0 }),
  reportes: () => ({ estado: "nuevo" }),
  suscripciones: () => ({ estado: "pendiente", motor: "mercadopago", frecuencia: "mensual", correo_pago: null, con_prueba: false, primer_cobro_en: null, prueba_hasta: null, acepto_en: null, acepto_texto: null, mp_preapproval_id: null, mp_estado: null, mp_init_point: null, mp_medio: null, mp_tarjeta: null, mp_error: null, mp_revisado_en: null, periodo_inicio: null, periodo_fin: null, proximo_cobro: null, aviso_renovacion_en: null, aviso_renovacion_para: null, gracia_desde: null, gracia_hasta: null, cancelada_en: null, cancelada_por: null, cancelada_mp_en: null, motivo_fin: null, vencida_en: null, revisar: false, revisar_motivo: null, aviso_uso_prueba_en: null, de_prueba: false, actualizada_en: ahoraIso() }),
  pruebas_usadas: () => ({ cuenta_id: null, telefono: null, huella_tarjeta: null, suscripcion_id: null, usada_en: ahoraIso() }),
  suscripcion_cambios_pago: () => ({ estado: "pendiente", motivo: null, estado_al_pedir: null, inmediato: false, primer_cobro_en: null, correo_pago: null, mp_preapproval_id: null, mp_estado: null, mp_init_point: null, mp_medio: null, mp_tarjeta: null, mp_error: null, mp_preapproval_anterior: null, aplicando_desde: null, anterior_cancelado_en: null, nuevo_cancelado_en: null, aplicado_en: null, de_prueba: false, actualizado_en: ahoraIso() }),
};
const DUPLICADO = { code: "23505", message: "duplicate key value violates unique constraint" };
function consulta(tabla: string) {
  if (!db[tabla]) db[tabla] = [];
  const filtros: ((f: Fila) => boolean)[] = [];
  let modo = "select", cambios: Fila | null = null, nuevas: Fila[] = [], contar = false, cabeza = false, conDatos = false, limite: number | null = null, columnas = "*", llave = "id";
  const parecido = (p: string, banderas: string) => new RegExp("^" + p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*") + "$", banderas);
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
        for (const k of UNICAS[tabla] ?? []) if (db[tabla].some((f) => f[k] === n[k])) return { data: null, error: DUPLICADO };
        // Los índices únicos parciales de la migración: una suscripción viva por cuenta; una prueba gratis por WhatsApp y por tarjeta.
        if (tabla === "suscripciones" && VIVAS.includes(n.estado ?? "pendiente") && db[tabla].some((f) => f.cuenta_id === n.cuenta_id && VIVAS.includes(f.estado))) return { data: null, error: DUPLICADO };
        if (tabla === "pruebas_usadas" && db[tabla].some((f) => (n.telefono && f.telefono === n.telefono) || (n.huella_tarjeta && f.huella_tarjeta === n.huella_tarjeta))) return { data: null, error: DUPLICADO };
        // Los de la migración del método de pago: un solo cambio pendiente por suscripción y un contrato por cambio.
        if (tabla === "suscripcion_cambios_pago" && db[tabla].some((f) => (f.suscripcion_id === n.suscripcion_id && f.estado === "pendiente" && (n.estado ?? "pendiente") === "pendiente") || (n.mp_preapproval_id && f.mp_preapproval_id === n.mp_preapproval_id))) return { data: null, error: DUPLICADO };
        const fila: Fila = { id: NUMERADAS.includes(tabla) ? ++serie : crypto.randomUUID(), [FECHA_ALTA[tabla] ?? "creado_en"]: ahoraIso(), ...(DEFECTO[tabla]?.() ?? {}), ...n };
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
    gt(k: string, v: string) { filtros.push((f) => (f[k] ?? null) !== null && String(f[k]) > v); return q; },
    gte(k: string, v: string) { filtros.push((f) => (f[k] ?? null) !== null && String(f[k]) >= v); return q; },
    lt(k: string, v: string) { filtros.push((f) => (f[k] ?? null) !== null && String(f[k]) < v); return q; },
    lte(k: string, v: string) { filtros.push((f) => (f[k] ?? null) !== null && String(f[k]) <= v); return q; },
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

// Las funciones SQL de las migraciones, con la misma regla (aquí cada una corre de un tirón, como con su candado en la base).
const movs = () => (db.cuenta_saldo_movimientos ??= []);
const vigentes = (cuenta: string) => movs().filter((m) => m.cuenta_id === cuenta && m.cambio > 0 && m.lote_id == null)
  .map((l) => ({ lote: l.id, quedan: l.cambio + movs().filter((d) => d.lote_id === l.id).reduce((n, d) => n + d.cambio, 0), vence: l.vence_en }))
  .filter((l) => l.quedan > 0 && ms(l.vence) > reloj);
const RPC: Record<string, (p: any) => Fila[]> = {
  sparked_usar_guia_de_saldo(p) {
    const l = vigentes(p.p_cuenta)[0];
    if (!l) return [];
    const m = { id: ++serie, cuenta_id: p.p_cuenta, cambio: -1, motivo: "guia", compra_id: p.p_compra ?? null, guia_id: p.p_guia ?? null, lote_id: l.lote, revierte_id: null, vence_en: null, de_prueba: false, nota: null, creado_en: ahoraIso() };
    movs().push(m);
    return [{ res_movimiento: m.id, res_lote: l.lote, res_vence: l.vence, res_quedan: vigentes(p.p_cuenta).reduce((n, x) => n + x.quedan, 0) }];
  },
  sparked_revisar_codigo(p) {
    const vivos = (db.cuenta_codigos ?? []).filter((c) => c.telefono === p.p_telefono && !c.usado_en && ms(c.expira_en) > reloj && c.intentos < p.p_max_intentos);
    const bueno = vivos.filter((c) => c.codigo_sha256 === p.p_codigo_sha256).at(-1);
    if (bueno) return [{ res_estado: "ok", res_codigo: bueno.id, res_canal: bueno.canal, res_correo: bueno.correo ?? null, res_nombre: bueno.nombre ?? null }];
    for (const c of vivos) c.intentos++;
    return [{ res_estado: vivos.length ? "mal" : "sin_codigo", res_codigo: null, res_canal: null, res_correo: null, res_nombre: null }];
  },
  sparked_abrir_sesion(p) {
    const cuenta = db.cuentas.find((c) => c.id === p.p_cuenta);
    if (!cuenta) return [{ res_estado: "sin_cuenta", res_sesion: null, res_abiertas: 0, res_cerradas: 0 }];
    const abiertas = (db.cuenta_sesiones ??= []).filter((s) => s.cuenta_id === p.p_cuenta && !s.cerrada_en && ms(s.expira_en) > reloj);
    if (abiertas.length >= p.p_max && !p.p_cerrar_antigua) return [{ res_estado: "limite", res_sesion: null, res_abiertas: abiertas.length, res_cerradas: 0 }];
    for (const c of db.cuenta_codigos) if (c.telefono === cuenta.telefono && !c.usado_en) c.usado_en = ahoraIso();
    const s = { id: crypto.randomUUID(), cuenta_id: p.p_cuenta, token_sha256: p.p_token_sha256, canal: p.p_canal, dispositivo: p.p_dispositivo, origen: p.p_origen, creada_en: ahoraIso(), ultimo_uso_en: ahoraIso(), expira_en: iso(reloj + (p.p_dias ?? 60) * DIA), cerrada_en: null };
    db.cuenta_sesiones.push(s); cuenta.ultimo_acceso_en = ahoraIso(); reloj += 1;
    return [{ res_estado: "ok", res_sesion: s.id, res_abiertas: abiertas.length + 1, res_cerradas: 0 }];
  },
  // sql/migraciones/20261125_sparked_suscripciones.sql: anota el cobro y, si quedó aprobado, alarga el periodo UNA vez.
  sparked_registrar_cobro(p) {
    if (!p.p_mp_payment_id || !["aprobado", "pendiente", "rechazado", "reembolsado", "revisar"].includes(p.p_estado)) return [];
    const s = (db.suscripciones ?? []).find((x) => x.id === p.p_suscripcion);
    if (!s) return [];
    const antes = s.estado, cuando = p.p_cobrado_en ?? ahoraIso(), cobros = (db.suscripcion_cobros ??= []);
    let c = cobros.find((x) => x.mp_payment_id === p.p_mp_payment_id), nuevo = false;
    const prev = c?.estado ?? null, ya = c?.periodo_aplicado === true;
    if (!c) {
      c = { id: crypto.randomUUID(), suscripcion_id: s.id, mp_payment_id: p.p_mp_payment_id, mp_factura_id: p.p_mp_factura_id ?? null, mp_estado: p.p_mp_estado ?? null, mp_detalle: p.p_mp_detalle ?? null, estado: p.p_estado, monto_mxn: p.p_monto ?? 0, metodo: p.p_metodo ?? null, cobrado_en: p.p_estado === "aprobado" ? cuando : null, periodo_desde: null, periodo_hasta: null, periodo_aplicado: false, de_prueba: s.de_prueba, creado_en: ahoraIso(), actualizado_en: ahoraIso() };
      cobros.push(c); nuevo = true;
    } else if (c.estado !== p.p_estado || c.mp_estado !== p.p_mp_estado) {
      Object.assign(c, { mp_estado: p.p_mp_estado ?? null, mp_detalle: p.p_mp_detalle ?? null, estado: p.p_estado, monto_mxn: p.p_monto ?? c.monto_mxn, cobrado_en: p.p_estado === "aprobado" ? c.cobrado_en ?? cuando : c.cobrado_en, actualizado_en: ahoraIso() });
    }
    let aplicado = false;
    if (p.p_estado === "aprobado" && !ya) {
      const t = ms(cuando), fin0 = s.periodo_fin ? ms(s.periodo_fin) : NaN;
      const base = !Number.isFinite(fin0) || t > fin0 + 25 * DIA ? t : fin0;
      let fin = masUnMes(base);
      const hasta = p.p_periodo_hasta ? ms(p.p_periodo_hasta) : NaN;
      if (Number.isFinite(hasta) && hasta >= t + 20 * DIA && hasta <= t + 45 * DIA) fin = hasta;
      if (Number.isFinite(fin0) && fin < fin0) fin = fin0;
      let estado = s.estado;
      if (VIVAS.includes(s.estado)) estado = "activa";
      else if (["vencida", "abandonada"].includes(s.estado) && !db.suscripciones.some((o) => o.cuenta_id === s.cuenta_id && o.id !== s.id && VIVAS.includes(o.estado))) estado = "activa";
      Object.assign(s, { estado, periodo_inicio: iso(base), periodo_fin: iso(fin), proximo_cobro: estado === "activa" ? iso(fin) : s.proximo_cobro, gracia_desde: null, gracia_hasta: null, vencida_en: estado === "activa" ? null : s.vencida_en, motivo_fin: estado === "activa" ? null : s.motivo_fin, actualizada_en: ahoraIso() });
      Object.assign(c, { periodo_aplicado: true, periodo_desde: iso(base), periodo_hasta: iso(fin) });
      aplicado = true;
    }
    return [{ res_cobro: c.id, res_nuevo: nuevo, res_estado_anterior: prev, res_aplicado: aplicado, res_antes: antes, res_ahora: s.estado, res_periodo_inicio: s.periodo_inicio, res_periodo_fin: s.periodo_fin }];
  },
  // sql/migraciones/20261125_sparked_suscripcion_metodo_de_pago.sql: la suscripción pasa al contrato nuevo y el cambio
  // queda aplicado, las dos cosas o ninguna.
  sparked_aplicar_cambio_pago(p) {
    const k = (db.suscripcion_cambios_pago ?? []).find((x) => x.id === p.p_cambio);
    const s = k ? (db.suscripciones ?? []).find((x) => x.id === k.suscripcion_id) : null;
    if (!k || !s) return [];
    const fila = (estado: string, anterior = k.mp_preapproval_anterior) => [{ res_estado: estado, res_suscripcion: s.id, res_estado_suscripcion: s.estado, res_anterior: anterior ?? null, res_nuevo: k.mp_preapproval_id }];
    if (k.estado === "aplicado") return fila("ya_aplicado");
    if (k.estado !== "pendiente" || !k.mp_preapproval_id) return fila("descartado");
    if (!["en_prueba", "activa", "en_gracia"].includes(s.estado)) return fila("suscripcion_terminada");
    if ((k.mp_preapproval_anterior ?? null) !== (s.mp_preapproval_id ?? null)) return fila("no_coincide");
    const anterior = s.mp_preapproval_id;
    Object.assign(s, { mp_preapproval_id: k.mp_preapproval_id, mp_estado: "authorized", mp_medio: p.p_medio ?? k.mp_medio ?? null, mp_tarjeta: k.mp_tarjeta ?? null, mp_init_point: null, correo_pago: k.correo_pago ?? s.correo_pago, mp_error: null, mp_revisado_en: ahoraIso(), actualizada_en: ahoraIso() });
    Object.assign(k, { estado: "aplicado", aplicado_en: ahoraIso(), mp_estado: "authorized", mp_medio: p.p_medio ?? k.mp_medio ?? null, aplicando_desde: null, mp_error: null, actualizado_en: ahoraIso() });
    reloj += 1;
    return fila("aplicado", anterior);
  },
};
const subidas = new Set<string>();
const almacen = {
  createSignedUploadUrl: async (ruta: string) => { subidas.add(ruta); return { data: { signedUrl: "https://demo.supabase.co/storage/v1/object/upload/sign/materiales/" + ruta, path: ruta }, error: null }; },
  list: async (carpeta: string) => ({ data: [...subidas].filter((r) => r.startsWith(carpeta + "/")).map((r) => ({ name: r.slice(carpeta.length + 1) })), error: null }),
  remove: async (rutas: string[]) => { for (const r of rutas) subidas.delete(r); return { data: [], error: null }; },
};
const supabase = { from: consulta, storage: { from: () => almacen }, async rpc(nombre: string, p: any) { await null; return RPC[nombre] ? { data: RPC[nombre](p), error: null } : { data: null, error: { message: "función desconocida: " + nombre } }; } };

// ---------- Mercado Pago de juguete: suscripciones (preapproval), cuotas (authorized_payments) y pagos ----------
const MP = { pre: {} as Record<string, any>, pagos: {} as Record<string, any>, cuotas: {} as Record<string, any>, llamadas: [] as string[], n: 0, caido: false, soloCanceled: false, ignoraFecha: false, noCancela: new Set<string>() };
let nPago = 500000;
const responder = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
function mercadoPago(metodo: string, ruta: string, cuerpo: any): Response {
  MP.llamadas.push(`${metodo} ${ruta.split("?")[0]}`);
  if (MP.caido) return responder({ message: "internal_error" }, 500);
  const consultaUrl = new URLSearchParams(ruta.split("?")[1] ?? "");
  let m: RegExpMatchArray | null;
  if (metodo === "POST" && ruta === "/preapproval") {
    const id = (++MP.n).toString(16).padStart(32, "2c93808");
    const ar = { ...cuerpo.auto_recurring };
    if (MP.ignoraFecha) { delete ar.start_date; delete ar.end_date; }   // así se vería un Mercado Pago que no respeta la fecha de inicio
    MP.pre[id] = { id, status: "pending", reason: cuerpo.reason, external_reference: cuerpo.external_reference, payer_email: cuerpo.payer_email, back_url: cuerpo.back_url, auto_recurring: ar, init_point: `https://www.mercadopago.com.mx/subscriptions/checkout?preapproval_id=${id}`, next_payment_date: null, payer_id: null, pedido: cuerpo };
    return responder(MP.pre[id], 201);
  }
  if ((m = ruta.match(/^\/preapproval\/([A-Za-z0-9_-]+)$/))) {
    const pre = MP.pre[m[1]];
    if (!pre) return responder({ message: "preapproval not found" }, 404);
    if (metodo === "PUT") {
      if (cuerpo.status === "cancelled" && MP.soloCanceled) return responder({ message: "status: invalid value" }, 400);
      if (/^cancel/.test(String(cuerpo.status ?? "")) && MP.noCancela.has(pre.id)) return responder({ message: "internal_error" }, 500);   // así se vería un contrato que Mercado Pago no deja cancelar
      if (/^cancel/.test(String(cuerpo.status ?? ""))) pre.status = cuerpo.status;
    }
    return responder(pre);
  }
  if ((m = ruta.match(/^\/authorized_payments\/(\d+)$/))) return MP.cuotas[m[1]] ? responder(MP.cuotas[m[1]]) : responder({ message: "not found" }, 404);
  if (ruta.startsWith("/authorized_payments/search")) {
    // Las cuotas se buscan por contrato (preapproval_id) o por pago (payment_id): así se sabe de qué contrato es un pago.
    const deContrato = consultaUrl.get("preapproval_id"), dePago = consultaUrl.get("payment_id");
    return responder({ results: Object.values(MP.cuotas).filter((f: any) => (deContrato || dePago) && (!deContrato || f.preapproval_id === deContrato) && (!dePago || String(f.payment?.id) === dePago)) });
  }
  if ((m = ruta.match(/^\/v1\/payments\/(\d+)$/))) return MP.pagos[m[1]] ? responder(MP.pagos[m[1]]) : responder({ message: "Payment not found" }, 404);
  if (ruta.startsWith("/v1/payments/search")) return responder({ results: Object.values(MP.pagos).filter((p: any) => String(p.external_reference ?? "") === consultaUrl.get("external_reference")) });
  return responder({ message: "ruta desconocida de la prueba: " + ruta }, 404);
}
type Tarjeta = [string, string, number, number];
const TARJETA_X: Tarjeta = ["415231", "4242", 11, 2029], TARJETA_Y: Tarjeta = ["520416", "1881", 3, 2030], TARJETA_Z: Tarjeta = ["491566", "0077", 8, 2028];
/** La familia terminó en la página de Mercado Pago: la suscripción queda autorizada. */
const autorizar = (pre: string, x: { proximo?: string | null; pagador?: number } = {}) => Object.assign(MP.pre[pre], { status: "authorized", payer_id: x.pagador ?? null, payment_method_id: "visa", next_payment_date: x.proximo === undefined ? MP.pre[pre].auto_recurring.start_date ?? null : x.proximo });
/** Mercado Pago intenta un cobro: crea el pago y su cuota. conReferencia: false = el pago no lleva la referencia de la suscripción. */
function cobrar(pre: string, x: { estado?: string; monto?: number; tarjeta?: Tarjeta; pagador?: number; proximo?: string; cuota?: boolean; conReferencia?: boolean; diceContrato?: boolean } = {}): { pago: string; cuota: string } {
  const p = MP.pre[pre], id = ++nPago, estado = x.estado ?? "approved";
  MP.pagos[id] = { id, status: estado, status_detail: estado === "approved" ? "accredited" : "cc_rejected_insufficient_amount", transaction_amount: x.monto ?? 349, currency_id: "MXN", payment_type_id: "credit_card", payment_method_id: "visa", external_reference: x.conReferencia === false ? null : p.external_reference, date_created: ahoraIso(), date_approved: estado === "approved" ? ahoraIso() : null, card: x.tarjeta ? { first_six_digits: x.tarjeta[0], last_four_digits: x.tarjeta[1], expiration_month: x.tarjeta[2], expiration_year: x.tarjeta[3] } : {}, payer: { id: x.pagador ?? p.payer_id ?? null, email: p.payer_email }, ...(x.diceContrato ? { point_of_interaction: { transaction_data: { subscription_id: pre } } } : {}) };
  const cuota = id + 1_000_000;
  if (x.cuota !== false) MP.cuotas[cuota] = { id: cuota, preapproval_id: pre, external_reference: p.external_reference, status: estado === "approved" ? "processed" : "recycling", transaction_amount: x.monto ?? 349, payment: { id, status: estado } };
  if (x.proximo) p.next_payment_date = x.proximo;
  return { pago: String(id), cuota: String(cuota) };
}

// ---------- Green API, correo y los pasos de la generación ----------
const whatsapps: { chat: string; texto: string }[] = [], correos: any[] = [], pasos: string[] = [];
(globalThis as any).fetch = async (url: string, init: any = {}) => {
  const u = String(url), cuerpo = init?.body ? JSON.parse(init.body) : {};
  if (u.includes("/getStateInstance/")) return responder({ stateInstance: "authorized" });
  if (u.includes("/checkWhatsapp/")) return responder({ existsWhatsapp: true, phoneNumber: `${String(cuerpo.chatId ?? "").split("@")[0]}@c.us` });
  if (u.includes("/sendMessage/")) { whatsapps.push({ chat: cuerpo.chatId, texto: cuerpo.message }); return responder({ idMessage: "m" + whatsapps.length }); }
  if (u === "https://api.resend.com/emails") { correos.push(cuerpo); return responder({ id: "correo-" + correos.length }); }
  if (u.startsWith("https://api.mercadopago.com/")) return mercadoPago(init?.method ?? "GET", u.slice("https://api.mercadopago.com".length), cuerpo);
  const paso = u.match(/\/functions\/v1\/sparked\/trabajo\/([0-9a-f-]{36})\/paso$/);
  if (paso) { pasos.push(paso[1]); return responder({ ok: true, aceptado: true }, 202); }
  throw new Error("La prueba no esperaba esta petición: " + u.replace(/token-de-prueba/g, "***"));
};
Math.random = () => 0.99;   // sin la limpieza ocasional: la prueba hace siempre lo mismo

// ---------- Los módulos reales ----------
const traer = (f: string) => import(pathToFileURL(join(origen, f)).href);
const S: any = await traer("suscripcion.ts");
const X: any = await traer("extras.ts");
// El servidor: los mismos archivos de funciones/sparked, con sus imports de fuera cambiados por dobles y la hora de
// index.ts tomada del reloj de la prueba.
const copiaServidor = mkdtempSync(join(tmpdir(), "probar-suscripciones-"));
const DOBLES: Record<string, [string, string][]> = {
  "index.ts": [[`import "jsr:@supabase/functions-js/edge-runtime.d.ts";`, ``], [`import { createClient } from "npm:@supabase/supabase-js@2";`, `const createClient = (..._a: unknown[]) => (globalThis as any).__supabaseDeJuguete;`], [`const ahora = () => new Date().toISOString();`, `const ahora = () => new Date(Date.now()).toISOString();`]],
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
(globalThis as any).__supabaseDeJuguete = supabase;
await import(pathToFileURL(join(copiaServidor, "index.ts")).href);
rmSync(copiaServidor, { recursive: true, force: true });

// ---------- Cómo se le habla al servidor ----------
const CLAVE_ADMIN = "ClaveDeAdministradorDePrueba", DANIEL = "daniel@sparked.invalid";
db.config = [{ clave: "admin_key_sha256", valor: createHash("sha256").update(CLAVE_ADMIN).digest("hex") }, { clave: "sparked_correo_aviso", valor: DANIEL }, { clave: "sparked_wa_imagenes", valor: "no" }, { clave: "sparked_paquete3", valor: "si" }];
const asentar = async () => { for (let i = 0; i < 40 && enCurso.length; i++) await Promise.all(enCurso.splice(0)); };
async function servidor(m: string, ruta: string, cuerpo?: unknown, op: { sesion?: string; admin?: boolean; cab?: Record<string, string> } = {}) {
  const cabeceras: Record<string, string> = { "content-type": "application/json", "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)", "x-forwarded-for": "200.1.1.9", ...(op.cab ?? {}) };
  if (op.sesion) cabeceras["x-cuenta"] = op.sesion;
  if (op.admin) cabeceras["x-admin-key"] = CLAVE_ADMIN;
  const r = await manejador(new Request(`https://demo.supabase.co/functions/v1/sparked/${ruta}`, { method: m, headers: cabeceras, body: cuerpo !== undefined && m !== "GET" ? JSON.stringify(cuerpo) : undefined }));
  await asentar();
  return { st: r.status, d: (await r.json().catch(() => null)) as any };
}
const admin = (m: string, ruta: string, cuerpo?: unknown) => servidor(m, "admin/" + ruta, cuerpo, { admin: true });
let nAviso = 0;
/** Un aviso de Mercado Pago, firmado como los de verdad (HMAC-SHA256 del manifiesto con la clave secreta del webhook). */
function avisoMP(tipo: string, id: string, clave = ENV.MP_WEBHOOK_SECRET!) {
  const t = String(1764000000000 + ++nAviso), rid = `aviso-${nAviso}`;
  const firma = createHmac("sha256", clave).update(`id:${id.toLowerCase()};request-id:${rid};ts:${t};`).digest("hex");
  return servidor("POST", `pago/mercadopago?data.id=${id}&type=${tipo}`, { type: tipo, data: { id } }, { cab: { "x-signature": `ts=${t},v1=${firma}`, "x-request-id": rid } });
}
const codigoDe = (texto: string) => texto.match(/\*(\d{3}) (\d{3})\*/)?.slice(1, 3).join("") ?? "";
/** Una familia entra con su WhatsApp: pide el código (llega por WhatsApp) y abre su sesión. */
async function entrar(tel: string, nombre: string, correo: string): Promise<string> {
  await servidor("POST", "cuenta/codigo", { telefono: tel, correo, nombre });
  const r = await servidor("POST", "cuenta/entrar", { telefono: tel, codigo: codigoDe(whatsapps.at(-1)?.texto ?? "") });
  if (r.st !== 200 || !r.d?.sesion) throw new Error(`no se pudo entrar con ${tel.slice(-4)}: HTTP ${r.st} ${JSON.stringify(r.d)}`);
  return r.d.sesion as string;
}
const cuentaDe = (tel: string) => db.cuentas.find((c) => c.telefono === "+52" + tel)!;
const susDe = (tel: string) => (db.suscripciones ?? []).filter((s) => s.cuenta_id === cuentaDe(tel)?.id);
const ultimaSus = (tel: string) => susDe(tel).at(-1)!;
const waDe = (tel: string, patron: RegExp) => whatsapps.filter((x) => String(x.chat).includes(tel) && patron.test(x.texto));
const paraDaniel = (patron: RegExp) => correos.filter((x) => x.to?.[0] === DANIEL && patron.test(String(x.subject)));
const cartuchoBueno = () => ({ completo: true, plan: { presupuesto_slides: 25 }, bloques: [{ id: "b1", titulo: "La Independencia", pistas: [{ id: "b1p1", titulo: "El inicio", ideas: ["El inicio: 1810"] }], actividades: [1, 2, 3, 4, 5, 6].map((n) => ({ id: "b1om" + n, tipo: "opcion_multiple", pregunta: `¿Pregunta ${n}?`, opciones: ["a", "b", "c", "d"], correcta: 0 })), mini_examen: [], duelo: [] }] });
/** Crea una guía desde «Mi cuenta» (borrador + POST /cuenta/guia). Devuelve la respuesta y la compra. */
async function pedirGuia(sesion: string) {
  const b = await servidor("POST", "borrador", { grado: "6° primaria", materia: "Historia", paginas: [{ nombre: "pagina-1.jpg", tipo: "image/jpeg", tamano: 250000 }] });
  const r = await servidor("POST", "cuenta/guia", { clave: b.d?.clave }, { sesion });
  return { r, compra: db.compras.find((x) => x.id === r.d?.compra_id) ?? null };
}
/** La generación termina (aquí sin IA): la guía queda completa y, al consultarla, el servidor la entrega. */
async function terminarGuia(sesion: string, compra: Fila) {
  Object.assign(db.guias.find((g) => g.id === compra.guia_id)!, { cartucho: cartuchoBueno(), titulo: "La Independencia de México", estado: "publicada" });
  Object.assign(db.trabajos.find((t) => t.guia_id === compra.guia_id)!, { estado: "listo", actualizado_en: ahoraIso() });
  return await servidor("GET", `cuenta/guia/${compra.id}`, undefined, { sesion });
}
const fechaLarga = (v: string) => new Date(v).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Mexico_City" });
const cerca = (a: unknown, b: unknown, margen = 5 * MIN) => Math.abs(ms(a) - ms(b)) <= margen;

let fallas = 0, total = 0;
const ok = (cond: boolean, que: string) => { total++; if (!cond) { fallas++; console.log("✗ " + que); } else console.log("✓ " + que); };
const titulo = (t: string) => console.log("\n" + t);

// ---------- 1. Las reglas, sin servidor ----------
titulo("1. Las reglas (cálculo puro)");
{
  const a = S.ajustesSuscripcion({});
  ok(a.modo === "no" && a.precio === 349 && a.probadores.length === 0 && a.pruebaDias === 7, "ajustes por omisión: apagada, $349 al mes, 7 días de prueba y sin probadores");
  ok(S.ajustesSuscripcion({ sparked_suscripcion: " SI " }).modo === "si" && S.ajustesSuscripcion({ sparked_suscripcion: "Probadores" }).modo === "probadores" && S.ajustesSuscripcion({ sparked_suscripcion: "true" }).modo === "no" && S.ajustesSuscripcion({ sparked_suscripcion_precio: "gratis" }).precio === 349, "un valor raro en los ajustes la deja apagada y a $349");
  ok(JSON.stringify(S.listaProbadores("+525511110001, +525511110002\n5511110003 +525511110001 hola")) === JSON.stringify(["+525511110001", "+525511110002"]), "la lista de probadores solo acepta números completos (+52…) y sin repetir");
  const prob = S.ajustesSuscripcion({ sparked_suscripcion: "probadores", sparked_suscripcion_probadores: "+525511110001" });
  ok(S.puedeSuscribirse(prob, "+525511110001") && !S.puedeSuscribirse(prob, "+525511110002") && !S.puedeSuscribirse(a, "+525511110001") && S.puedeSuscribirse(S.ajustesSuscripcion({ sparked_suscripcion: "si" }), "+525599990000"), "quién puede contratar: apagada nadie, probadores solo la lista, pública todos");
  const t = reloj, s = (estado: string, extra: Fila = {}) => ({ estado, periodo_fin: iso(t + 10 * DIA), ...extra });
  ok(S.derechos(s("en_prueba"), t).crear && S.derechos(s("activa"), t).crear && S.derechos(s("cancelada"), t).crear, "en prueba, activa o cancelada con periodo vigente: puede crear guías");
  ok(!S.derechos(s("en_gracia"), t).crear && !S.derechos(s("vencida"), t).crear && !S.derechos(s("pendiente"), t).crear && !S.derechos(s("abandonada"), t).crear && !S.derechos(null, t).crear, "en gracia, vencida, pendiente o sin suscripción: no puede crear guías");
  ok(S.derechos(s("activa"), t + 10 * DIA + 47 * HORA).crear && !S.derechos(s("activa"), t + 10 * DIA + 49 * HORA).crear, "activa: se espera el cobro hasta 48 horas después del fin del periodo; luego ya no crea");
  ok(S.derechos(s("cancelada"), t + 10 * DIA - MIN).crear && !S.derechos(s("cancelada"), t + 10 * DIA + MIN).crear, "cancelada: conserva lo pagado justo hasta el fin del periodo");
  ok(S.finDeAcceso(s("activa")) === t + 10 * DIA + 48 * HORA && S.finDeAcceso(s("cancelada")) === t + 10 * DIA && S.finDeAcceso(s("en_gracia", { gracia_hasta: iso(t + 20 * DIA) })) === t + 20 * DIA && S.finDeAcceso(s("vencida")) === null, "sus guías siguen abiertas hasta donde llega lo pagado (o la gracia)");
  ok(S.estadoDeCobro({ status: "approved" }) === "aprobado" && S.estadoDeCobro({ status: "rejected" }) === "rechazado" && S.estadoDeCobro({ status: "refunded" }) === "reembolsado" && S.estadoDeCobro({ status: "charged_back" }) === "reembolsado" && S.estadoDeCobro({ status: "in_process" }) === "pendiente", "estados de un pago de Mercado Pago: aprobado, rechazado, reembolsado o pendiente");
  ok(S.cobroEsVenta({ mp_estado: "approved" }) && !S.cobroEsVenta({ mp_estado: "rejected" }) && !S.cobroEsVenta({ mp_estado: "refunded" }) && !S.cobroEsVenta({ mp_estado: "approved", de_prueba: true }) && !S.cobroEsVenta({ mp_estado: null }), "un cobro es venta SOLO si Mercado Pago lo aprobó (regla ventaCobrada); reembolsado o de prueba no cuenta");
  ok(S.textoCancelacion("2026-12-25T18:00:00Z") === "Lamentamos que te vayas. Esperamos que regreses pronto al salón de clases. Tu suscripción seguirá activa hasta el 25 de diciembre de 2026; después ya no se te cobrará nada.", "el mensaje de cancelación es el que pidió Daniel, con la fecha de fin");
  const h1 = await S.huellasDePago({ card: { first_six_digits: "415231", last_four_digits: "4242", expiration_month: 11, expiration_year: 2029 }, payer: { id: 9001 } });
  const h2 = await S.huellasDePago({ card: { first_six_digits: "415231", last_four_digits: "4242", expiration_month: 11, expiration_year: 2029 }, payer: { id: 9002 } });
  ok(h1.length === 2 && h1[0] === h2[0] && h1[1] !== h2[1] && !JSON.stringify(h1).includes("4242") && !JSON.stringify(h1).includes("415231"), "la huella de una tarjeta es la misma con otro pagador y no deja ver sus dígitos");
  ok(/sparked_suscripcion: "no", sparked_suscripcion_precio: "349", sparked_suscripcion_probadores: ""/.test(fuente), "en el código la suscripción nace apagada, a $349 y sin probadores");
  ok(/if \(TEMAS_SUSCRIPCION\.includes\(tipo\)\) return await avisoDeSuscripcion\(tipo, pagoId\);\s*\n\s*if \(tipo !== "payment"/.test(fuente), "en el aviso de Mercado Pago, los temas de suscripción se separan ANTES de la lógica de las guías sueltas");
}

// ---------- 2. Apagada: nadie la contrata ----------
titulo("2. Apagada para el público (como queda en producción)");
const A = "5511110001", B = "5511110002", D = "5511110004", E = "5511110005", F = "5511110006", G = "5511110007", H = "5511110008";
const inicio = await servidor("GET", "");
ok(inicio.st === 200 && inicio.d.version === fuente.match(/const VERSION = "([^"]+)"/)![1], `el servidor completo arranca y dice su versión (${inicio.d?.version})`);
const sesA = await entrar(A, "Ana Prueba", "ana@correo.com");
{
  const info = await servidor("GET", "suscripcion/info"), paq = await servidor("GET", "paquete/info");
  ok(info.st === 200 && info.d.disponible === false && info.d.precio === 349 && info.d.prueba_dias === 7 && paq.d.suscripcion?.disponible === false, "el sitio recibe «no disponible»: la portada sigue diciendo «Próximamente»");
  const mia = await servidor("GET", "cuenta", undefined, { sesion: sesA });
  ok(mia.st === 200 && mia.d.suscripcion?.disponible === false && mia.d.suscripcion.actual === null, "«Mi cuenta» no ofrece suscribirse");
  const r = await servidor("POST", "suscripcion/crear", { acepta: true }, { sesion: sesA });
  ok(r.st === 503 && (db.suscripciones ?? []).length === 0 && !MP.llamadas.length, "con 'no' nadie puede suscribirse y no se le pide nada a Mercado Pago");
  ok((await servidor("POST", "suscripcion/crear", { acepta: true })).st === 401 && (await servidor("GET", "suscripcion/estado")).st === 401 && (await servidor("POST", "suscripcion/cancelar")).st === 401, "sin sesión, las rutas de la suscripción piden entrar");
  const panel = await admin("GET", "suscripciones");
  ok((await servidor("GET", "admin/suscripciones")).st === 401 && panel.st === 200 && panel.d.ajustes.modo === "no" && panel.d.ajustes.probadores.length === 0 && panel.d.suscripciones.length === 0, "el panel (con clave) dice: modo apagado, sin probadores, sin suscripciones");
}

// ---------- 3. Solo probadores ----------
titulo("3. Solo probadores");
const sesB = await entrar(B, "Beto Fuera", "beto@correo.com");
{
  const alta = await admin("POST", "suscripciones/probadores", { agregar: A });
  ok(alta.st === 200 && alta.d.probadores.length === 1 && alta.d.probadores[0].whatsapp === "••• ••• 0001" && !JSON.stringify(alta.d).includes(A), "Daniel agrega un número de probador desde el panel; el panel lo enseña enmascarado");
  ok((await admin("POST", "suscripciones/probadores", { agregar: "123" })).st === 400, "un número mal escrito no entra a la lista");
  const cambio = await admin("POST", "config", { sparked_suscripcion: "probadores", sparked_suscripcion_probadores: "+525599990000" });
  ok(cambio.st === 200, "el interruptor del panel pasa a «solo probadores»");
  const ping = await admin("GET", "ping");
  ok(ping.d.config.sparked_suscripcion === "probadores" && ping.d.config.sparked_suscripcion_probadores === "1" && cambio.d.config.sparked_suscripcion_probadores === "1" && !JSON.stringify(ping.d).includes(A) && db.config.find((x) => x.clave === "sparked_suscripcion_probadores")?.valor === "+52" + A, "los ajustes del panel solo dicen CUÁNTOS probadores hay (nunca sus números) y la lista solo se cambia desde su propia ruta");
  reloj += 61_000;   // cada servidor guarda los ajustes un minuto
  ok((await servidor("GET", "suscripcion/info")).d.disponible === false, "para el público sigue «no disponible»");
  const miaB = await servidor("GET", "cuenta", undefined, { sesion: sesB });
  const rB = await servidor("POST", "suscripcion/crear", { acepta: true, nombre: "Beto Fuera", correo: "beto@correo.com" }, { sesion: sesB });
  ok(miaB.d.suscripcion.disponible === false && rB.st === 503 && (db.suscripciones ?? []).length === 0 && !MP.llamadas.length, "un número que NO es probador no ve «Suscribirme» ni puede suscribirse");
  const miaA = await servidor("GET", "cuenta", undefined, { sesion: sesA });
  ok(miaA.d.suscripcion.disponible === true && miaA.d.suscripcion.con_prueba === true && miaA.d.suscripcion.precio === 349 && miaA.d.suscripcion.prueba_dias === 7, "la probadora sí ve la suscripción: $349 al mes con 7 días gratis");
  const sin = await servidor("POST", "suscripcion/crear", { nombre: "Ana Prueba", correo: "ana@correo.com" }, { sesion: sesA });
  ok(sin.st === 400 && sin.d.campo === "acepta" && !MP.llamadas.length, "sin marcar la casilla del cobro automático no se crea nada");
}

// ---------- 4. Alta con 7 días gratis ----------
titulo("4. Alta con prueba gratis de 7 días");
let preA = "";
{
  const t0 = reloj;
  const r = await servidor("POST", "suscripcion/crear", { acepta: true, nombre: "Ana Prueba", correo: "ana@correo.com" }, { sesion: sesA });
  const sus = ultimaSus(A); preA = sus?.mp_preapproval_id ?? "";
  const pedido = MP.pre[preA]?.pedido ?? {}, ar = pedido.auto_recurring ?? {};
  ok(r.st === 200 && r.d.modo === "mercadopago" && r.d.url === MP.pre[preA]?.init_point && r.d.con_prueba === true && sus.estado === "pendiente" && sus.con_prueba === true, "«Suscribirme» abre la página de Mercado Pago para poner la tarjeta (aquí nunca se pide una tarjeta)");
  ok(pedido.status === "pending" && pedido.external_reference === sus.id && pedido.payer_email === "ana@correo.com" && pedido.reason === "SparkEd · Guías ilimitadas" && ar.frequency === 1 && ar.frequency_type === "months" && ar.transaction_amount === 349 && ar.currency_id === "MXN" && !("preapproval_plan_id" in pedido) && !("card_token_id" in pedido), "a Mercado Pago se le pide una suscripción sin plan: $349 MXN cada mes, con nuestra referencia");
  ok(cerca(ar.start_date, t0 + 7 * DIA) && ms(ar.end_date) > ms(ar.start_date) + 365 * DIA && /cuenta\.html\?suscripcion=/.test(pedido.back_url ?? ""), "el primer cobro se pide para dentro de 7 días y al terminar regresa a «Mi cuenta»");
  ok(/prueba gratis de 7 días/.test(sus.acepto_texto ?? "") && /\$349 cada mes de forma automática hasta que cancele/.test(sus.acepto_texto) && /al menos 5 días antes/.test(sus.acepto_texto) && !!sus.acepto_en, "queda guardado el texto que aceptó (cobro automático, aviso 5 días antes) y cuándo");
  const otra = await servidor("POST", "suscripcion/crear", { acepta: true, nombre: "Ana Prueba", correo: "ana@correo.com" }, { sesion: sesA });
  ok(otra.st === 200 && otra.d.url === r.d.url && Object.keys(MP.pre).length === 1 && susDe(A).length === 1, "oprimir «Suscribirme» otra vez reutiliza la misma: no se duplica");
  const est = await servidor("GET", "suscripcion/estado", undefined, { sesion: sesA });
  ok(est.st === 200 && est.d.suscripcion.actual?.estado === "pendiente" && est.d.suscripcion.actual.falta === "tarjeta" && est.d.suscripcion.actual.link_pago === r.d.url && est.d.suscripcion.actual.puede_crear === false, "mientras no termine en Mercado Pago: pendiente, sin derecho a crear guías y con el link para continuar");

  // La familia pone su tarjeta en Mercado Pago: cobro mínimo de validación (que Mercado Pago devuelve) y suscripción autorizada.
  const validacion = cobrar(preA, { monto: 5, tarjeta: TARJETA_X, pagador: 9001, cuota: false });
  autorizar(preA, { pagador: 9001 });
  const falsa = await avisoMP("subscription_preapproval", preA, "clave-de-otro");
  ok(falsa.st === 401 && ultimaSus(A).estado === "pendiente", "un aviso con firma falsa no activa nada (401)");
  const [a1, a2] = await Promise.all([avisoMP("subscription_preapproval", preA), avisoMP("subscription_preapproval", preA)]);
  const a3 = await avisoMP("subscription_preapproval", preA);
  const s = ultimaSus(A);
  ok([a1, a2, a3].every((x) => x.st === 200 && x.d.suscripcion === true) && s.estado === "en_prueba" && s.mp_estado === "authorized" && s.periodo_fin === iso(ms(ar.start_date)) && s.proximo_cobro === s.periodo_fin && s.prueba_hasta === s.periodo_fin, `el aviso firmado de Mercado Pago (se le pregunta el estado a Mercado Pago) la deja «en prueba» hasta la fecha del primer cobro (${[a1, a2, a3].map((x) => x.d?.resultado).join(" / ")})`);
  const bienvenida = waDe(A, /prueba gratis termina/);
  ok(bienvenida.length === 1 && bienvenida[0].texto.includes(fechaLarga(s.periodo_fin)) && /Aviso de cobro: ese día se cobrarán \$349 MXN/.test(bienvenida[0].texto) && /cuenta\.html\?cancelar=1/.test(bienvenida[0].texto), "tres avisos iguales: UNA sola bienvenida por WhatsApp, con el aviso del cobro (7 días antes) y el link para cancelar");
  ok(correos.filter((x) => x.to?.[0] === "ana@correo.com" && /prueba gratis/.test(x.subject)).length === 1 && paraDaniel(/nueva suscripción en prueba gratis/).length === 1, "y UN correo a la familia y UN aviso a Daniel (todavía no es una venta)");
  const usadas = db.pruebas_usadas ?? [];
  ok(usadas.filter((x) => x.telefono === "+52" + A).length === 1 && usadas.filter((x) => x.huella_tarjeta && x.suscripcion_id === s.id).length === 2 && !!cuentaDe(A).prueba_gratis_usada_en && !JSON.stringify(usadas).includes("4242"), "la prueba gratis queda anotada: su WhatsApp, la huella de su tarjeta y la de su cuenta de Mercado Pago (nunca los dígitos)");
  const v = await avisoMP("payment", validacion.pago);
  ok(v.st === 200 && v.d.suscripcion === true && v.d.resultado === "validacion_de_tarjeta" && (db.suscripcion_cobros ?? []).length === 0, "el cobro mínimo con el que Mercado Pago comprueba la tarjeta no cuenta como mensualidad ni como venta");
  const mia = await servidor("GET", "cuenta", undefined, { sesion: sesA });
  ok(mia.d.suscripcion.actual.estado === "en_prueba" && mia.d.suscripcion.actual.puede_crear === true && mia.d.suscripcion.actual.puede_cancelar === true && mia.d.suscripcion.disponible === false, "«Mi cuenta»: en prueba, puede crear guías y puede cancelar");
}

// ---------- 5. La guía de la suscriptora ----------
titulo("5. Crear guías con la suscripción");
let compraGuia: Fila = {};
{
  // La cuenta además tiene 1 guía de un paquete: con suscripción vigente se usa la suscripción y el saldo se guarda.
  movs().push({ id: ++serie, cuenta_id: cuentaDe(A).id, cambio: 1, motivo: "ajuste", compra_id: null, guia_id: null, lote_id: null, revierte_id: null, vence_en: iso(reloj + 90 * DIA), de_prueba: false, nota: null, creado_en: ahoraIso() });
  const antesDaniel = correos.filter((x) => x.to?.[0] === DANIEL && /^Venta/.test(x.subject)).length;
  const { r, compra } = await pedirGuia(sesA); compraGuia = compra ?? {};
  const s = ultimaSus(A);
  ok(r.st === 202 && r.d.con_suscripcion === true && compraGuia.metodo_pago === "suscripcion" && compraGuia.suscripcion_id === s.id && Number(compraGuia.monto_mxn) === 0 && compraGuia.estado === "pagada" && !!compraGuia.acceso_id, "la guía se hace con la suscripción (sin cobro) y se le aparta su acceso");
  ok(movs().filter((m) => m.motivo === "guia").length === 0 && (await servidor("GET", "cuenta", undefined, { sesion: sesA })).d.saldo.guias === 1, "no gasta el saldo del paquete: su guía de paquete sigue ahí para después");
  const trabajos = db.trabajos.filter((t) => t.guia_id === compraGuia.guia_id);
  ok(trabajos.length === 1 && trabajos[0].alcance === "completa" && pasos.includes(trabajos[0].id), "arranca UN trabajo de guía completa, sin vista previa (el mismo camino del saldo)");
  ok(X.ventaCobrada(compraGuia) === false && X.tipoSinCobro(compraGuia) === "suscripcion" && !X.confirmadaAMano(compraGuia), "una guía hecha con la suscripción no es venta ni cortesía");
  const antes = { wa: whatsapps.length, correo: correos.length };
  const lista = await terminarGuia(sesA, compraGuia);
  const acceso = db.accesos.find((a) => a.id === compraGuia.acceso_id) ?? {}, guia = db.guias.find((g) => g.id === compraGuia.guia_id) ?? {};
  ok(lista.st === 200 && lista.d.estado === "lista" && lista.d.con_suscripcion === true && /guia\.html#/.test(lista.d.link ?? "") && !!compraGuia.entregada_en, "al quedar completa se entrega con su link");
  ok(cerca(acceso.expira_en, ms(s.periodo_fin) + 48 * HORA) && ms(acceso.expira_en) > reloj + 7 * DIA && acceso.minutos_tras_apertura > 1_000_000 && cerca(guia.borrar_en, ms(s.periodo_fin) + 72 * HORA), "su acceso no se queda en 7 días: llega hasta donde llega la suscripción");
  const waEntrega = whatsapps.slice(antes.wa).map((x) => x.texto).join("\n"), correoEntrega = correos.slice(antes.correo).find((x) => x.to?.[0] === "ana@correo.com");
  ok(waEntrega.includes(lista.d.link) && /seguirá abierta mientras tu suscripción esté activa/.test(waEntrega), "el WhatsApp de entrega lleva el link y dice que sigue abierta mientras la suscripción esté activa");
  ok(!!correoEntrega && /es parte de tu suscripción de guías ilimitadas/.test(correoEntrega.html) && /mientras tu suscripción esté activa/.test(correoEntrega.html) && /Guía de tu suscripción/.test(correoEntrega.html) && !/\$0/.test(correoEntrega.html) && !/Tu pago se confirmó/.test(correoEntrega.html), "el correo de entrega habla de su suscripción (no de un pago de $0)");
  ok(correos.filter((x) => x.to?.[0] === DANIEL && /^Venta/.test(x.subject)).length === antesDaniel, "Daniel no recibe «Venta» por una guía de suscripción");
  const mia = await servidor("GET", "cuenta", undefined, { sesion: sesA });
  ok(mia.d.guias.length === 1 && mia.d.guias[0].estado === "lista" && mia.d.guias[0].con_suscripcion === true, "la guía aparece en «Mi cuenta» con su link");
}

// ---------- 6. Más de 15 guías durante la prueba: avisa a Daniel, no bloquea ----------
titulo("6. Uso durante la prueba gratis");
{
  const s = ultimaSus(A);
  for (let i = 0; i < 14; i++) db.compras.push({ id: crypto.randomUUID(), ...DEFECTO.compras(), cuenta_id: cuentaDe(A).id, suscripcion_id: s.id, metodo_pago: "suscripcion", estado: "pagada", monto_mxn: 0, grado: "6° primaria", creada_en: ahoraIso(), pagada_en: ahoraIso() });
  const reportesAntes = (db.reportes ?? []).length;
  const g16 = await pedirGuia(sesA);
  const avisos = (db.reportes ?? []).slice(reportesAntes);
  ok(g16.r.st === 202 && avisos.length === 1 && /^SUSCRIPCIÓN · Una cuenta lleva 16 guías durante su prueba gratis/.test(avisos[0].comentario) && !/^AVISO AUTOM/.test(avisos[0].comentario) && /no se bloqueó nada/.test(avisos[0].comentario), "la guía 16 de la prueba se crea igual (sin topes) y queda un aviso para Daniel en Reportes");
  ok(ultimaSus(A).revisar === true && !!ultimaSus(A).aviso_uso_prueba_en && paraDaniel(/más de 15 guías/).length === 1 && !avisos[0].comentario.includes(A), "la suscripción queda con la bandera «revisar» y Daniel recibe UN correo (sin datos de la familia)");
  const g17 = await pedirGuia(sesA);
  ok(g17.r.st === 202 && (db.reportes ?? []).length === reportesAntes + 1 && paraDaniel(/más de 15 guías/).length === 1, "la guía 17 también se crea y el aviso no se repite");
  await terminarGuia(sesA, g16.compra!); await terminarGuia(sesA, g17.compra!);
  const res = await admin("GET", "resumen");
  ok(res.st === 200 && res.d.compras.de_suscripcion_mes === 17 && res.d.compras.pagadas_mes === 0 && res.d.compras.ingresos_mes === 0 && res.d.compras.cortesias_mes === 0 && res.d.suscripciones?.en_prueba === 1 && res.d.suscripciones.cobros_mes === 0, `Resumen del panel: 17 guías de suscripción aparte, 0 ventas y 0 cortesías (salió ${res.d?.compras?.de_suscripcion_mes} · ${res.d?.compras?.pagadas_mes} · ${res.d?.compras?.cortesias_mes})`);
}

// ---------- 6b. Una guía de la suscripción que no se pudo crear ----------
titulo("6b. Si una guía de la suscripción no se puede crear");
{
  const { r, compra } = await pedirGuia(sesA);
  const trabajo = db.trabajos.find((t) => t.guia_id === compra!.guia_id)!;
  // Así deja el servidor un trabajo que falló de forma definitiva: con el motivo en palabras sencillas en su avance.
  const motivo = "Las fotos no parecen material de estudio. Sube apuntes, páginas del libro o temarios.";
  Object.assign(trabajo, { estado: "error", error: "Las fotos no parecen material de estudio", progreso: { pct: 0, mensaje: motivo, paso: "leer" }, actualizado_en: ahoraIso() });
  reloj += 2 * MIN;
  const fin = await servidor("GET", `cuenta/guia/${compra!.id}`, undefined, { sesion: sesA });
  ok(r.st === 202 && fin.st === 200 && fin.d.estado === "devuelta" && fin.d.con_suscripcion === true && fin.d.mensaje === motivo && compra!.estado === "fallida" && !compra!.entregada_en, "la guía queda como «no se pudo crear» y la página dice por qué (para no repetir las mismas fotos)");
  ok(movs().filter((m) => m.motivo === "devolucion").length === 0 && (await servidor("GET", "cuenta", undefined, { sesion: sesA })).d.saldo.guias === 1 && ultimaSus(A).estado === "en_prueba", "no hay saldo que devolver ni se toca la suscripción: sigue igual");
  const wa = waDe(A, /Tu suscripción sigue activa\. Puedes intentarlo de nuevo aquí/);
  await servidor("GET", `cuenta/guia/${compra!.id}`, undefined, { sesion: sesA });
  ok(wa.length === 1 && waDe(A, /Tu suscripción sigue activa\. Puedes intentarlo de nuevo aquí/).length === 1, "la familia recibe UN aviso por WhatsApp de que puede intentarlo de nuevo");
  const mia = await servidor("GET", "cuenta", undefined, { sesion: sesA });
  const fila = mia.d.guias.find((g: any) => g.id === compra!.id);
  ok(fila?.estado === "devuelta" && fila.con_suscripcion === true && !fila.link && mia.d.suscripcion.actual.puede_crear === true, "en «Mi cuenta» sale como no creada, sin link, y puede crear otra");
  const otra = await pedirGuia(sesA);
  ok(otra.r.st === 202 && otra.r.d.con_suscripcion === true, "y la siguiente guía se crea normal (sin topes)");
  await terminarGuia(sesA, otra.compra!);
}

// ---------- 7. Fin de la prueba: el primer cobro ----------
titulo("7. El cobro (y el cobro repetido)");
{
  const d0 = await admin("POST", "suscripciones/diario", {});
  ok(d0.st === 200 && d0.d.revisadas === 1 && d0.d.sincronizadas === 1 && d0.d.avisos_renovacion === 0 && d0.d.a_gracia === 0 && ultimaSus(A).estado === "en_prueba", "tarea diaria el primer día: la revisa con Mercado Pago y no manda otro aviso (el de la bienvenida ya cubre ese cobro)");
  const finPrueba = ms(ultimaSus(A).periodo_fin);
  reloj = finPrueba + 10 * MIN;
  const proximo = iso(masUnMes(finPrueba));
  const c1 = cobrar(preA, { tarjeta: TARJETA_X, pagador: 9001, proximo });
  const r = await avisoMP("subscription_authorized_payment", c1.cuota);
  const s = ultimaSus(A), cobros = db.suscripcion_cobros ?? [];
  ok(r.st === 200 && r.d.resultado === "cobrado" && s.estado === "activa" && s.periodo_fin === proximo && s.proximo_cobro === proximo && cobros.length === 1 && cobros[0].estado === "aprobado" && Number(cobros[0].monto_mxn) === 349 && cobros[0].mp_estado === "approved", "al terminar la prueba Mercado Pago cobra $349: la suscripción queda activa y pagada hasta la fecha del siguiente cobro");
  ok(waDe(A, /Tu prueba gratis terminó y cobramos \$349 MXN/).length === 1 && paraDaniel(/^Venta SparkEd: suscripción/).length === 1, "la familia recibe el aviso del cobro y Daniel su «Venta SparkEd: suscripción»");
  const r2 = await avisoMP("subscription_authorized_payment", c1.cuota), r3 = await avisoMP("payment", c1.pago);
  ok(r2.st === 200 && r3.st === 200 && r2.d.resultado === "sin_cambios" && r3.d.resultado === "sin_cambios" && r3.d.suscripcion === true && ultimaSus(A).periodo_fin === proximo && cobros.length === 1 && waDe(A, /cobramos \$349/).length === 1 && paraDaniel(/^Venta SparkEd: suscripción/).length === 1, "el mismo cobro avisado otra vez (por «cuota» y por «pago»): sin doble periodo, sin doble venta y sin más mensajes");
  const acceso = db.accesos.find((a) => a.id === compraGuia.acceso_id) ?? {};
  ok(cerca(acceso.expira_en, ms(proximo) + 48 * HORA), "con el cobro, sus guías se quedan abiertas un mes más");
  const mia = await servidor("GET", "cuenta", undefined, { sesion: sesA });
  ok(mia.d.suscripcion?.actual?.estado === "activa" && mia.d.suscripcion.actual.proximo_cobro === proximo && mia.d.suscripcion.actual.prueba_hasta === null && mia.d.suscripcion.disponible === false, "«Mi cuenta»: activa, con la fecha de su próximo cobro");
  const panel = await admin("GET", "suscripciones"), fila = panel.d.suscripciones.find((x: any) => x.id === s.id) ?? {};
  ok(panel.d.resumen.activas === 1 && panel.d.resumen.en_prueba === 0 && panel.d.resumen.cobros === 1 && panel.d.resumen.ingreso_mxn === 349 && fila.ingreso_mxn === 349 && fila.uso?.guias === 18 && fila.whatsapp === "••• ••• 0001" && fila.cobros?.[0]?.es_venta === true, "panel → Suscripciones: 1 activa, 1 cobro, $349 cobrados y el uso de la suscriptora (18 guías; la que no se pudo crear no cuenta)");
  const res = await admin("GET", "resumen");
  ok(res.d.suscripciones.activas === 1 && res.d.suscripciones.por_revisar === 1 && res.d.suscripciones.cobros_mes === 1 && res.d.suscripciones.ingresos_mes === 349 && res.d.compras.pagadas_mes === 0 && res.d.compras.ingresos_mes === 0, "Resumen: el cobro de suscripción va en su propio bloque ($349), separado de las guías sueltas (0 ventas)");
  const costos = X.calcularCostos({ trabajos: [], previasDeGuias: [], tipos: [], ajusteTc: 18.5, hoy: X.diaMx(reloj), dias: 30, servicios: [], compras: cobros.map((x) => ({ estado: "pagada", monto_mxn: x.monto_mxn, pagada_en: x.cobrado_en, metodo_pago: "tarjeta", mp_estado: x.mp_estado, stripe_session_id: null, producto: "suscripcion" })) });
  ok(costos.ingresos.mes.ventas === 1 && costos.ingresos.mes.mxn === 349 && costos.ingresos.mes.cobros_suscripcion === 1, "Costos e impuestos: ese cobro suma como una venta de $349");
}

// ---------- 8. Tarea diaria: aviso de renovación ----------
titulo("8. Tarea diaria con fechas simuladas: aviso de renovación");
{
  const fin = ms(ultimaSus(A).periodo_fin);
  reloj = fin - 8 * DIA;
  const antes = await admin("POST", "suscripciones/diario", {});
  ok(antes.d.avisos_renovacion === 0 && waDe(A, /se renueva el/).length === 0, "8 días antes del cobro todavía no avisa");
  reloj = fin - 6 * DIA + HORA;
  const d1 = await admin("POST", "suscripciones/diario", {});
  const aviso = waDe(A, /se renueva el/);
  ok(d1.d.avisos_renovacion === 1 && d1.d.avisos_tarde === 0 && aviso.length === 1 && aviso[0].texto.includes(`se renueva el *${fechaLarga(iso(fin))}* por $349 MXN`) && /cancela aquí en un clic:\n\S+cuenta\.html\?cancelar=1/.test(aviso[0].texto), "6 días antes (la ley pide al menos 5) sale el aviso de renovación, con la fecha, el monto y el link para cancelar");
  const d2 = await admin("POST", "suscripciones/diario", {});
  reloj += DIA;
  const d3 = await admin("POST", "suscripciones/diario", {});
  ok(d2.d.avisos_renovacion === 0 && d3.d.avisos_renovacion === 0 && waDe(A, /se renueva el/).length === 1, "correr la tarea otra vez (el mismo día o al siguiente) no repite el aviso");
  ok(correos.filter((x) => x.to?.[0] === "ana@correo.com" && /se renueva el/.test(x.subject)).length === 1, "el aviso también llega por correo");
}

// ---------- 9. Renovación con dos avisos al mismo tiempo ----------
titulo("9. Renovación: dos avisos a la vez");
{
  const fin = ms(ultimaSus(A).periodo_fin), proximo = iso(masUnMes(fin));
  reloj = fin + 5 * MIN;
  const c2 = cobrar(preA, { tarjeta: TARJETA_X, pagador: 9001, proximo });
  const [x, y] = await Promise.all([avisoMP("subscription_authorized_payment", c2.cuota), avisoMP("payment", c2.pago)]);
  const s = ultimaSus(A);
  ok(x.st === 200 && y.st === 200 && s.estado === "activa" && s.periodo_fin === proximo && (db.suscripcion_cobros ?? []).length === 2 && (db.suscripcion_cobros ?? []).filter((c) => c.periodo_aplicado).length === 2, `dos avisos del mismo cobro al mismo tiempo: el periodo se alarga UNA vez, a la fecha del siguiente cobro (${x.d?.resultado} / ${y.d?.resultado})`);
  ok(waDe(A, /^Hola, Ana:\n\nCobramos \$349 MXN/).length === 1 && paraDaniel(/^Venta SparkEd: suscripción/).length === 2, "un solo mensaje de «Cobramos $349» y una sola venta más para Daniel");
  ok((await servidor("GET", "suscripcion/estado", undefined, { sesion: sesA })).d.suscripcion?.actual?.periodo_fin === proximo, "(la familia entra a su cuenta: su sesión sigue abierta porque la usa)");
}

// ---------- 10. Rechazo → gracia → (se recupera) → rechazo → gracia → vencida ----------
titulo("10. Cobro rechazado: en gracia y vencida");
{
  let fin = ms(ultimaSus(A).periodo_fin);
  reloj = fin + 5 * MIN;
  const malo = cobrar(preA, { estado: "rejected", tarjeta: TARJETA_X, pagador: 9001 });
  const r = await avisoMP("subscription_authorized_payment", malo.cuota);
  let s = ultimaSus(A);
  ok(r.st === 200 && r.d.resultado === "rechazado" && s.estado === "en_gracia" && cerca(s.gracia_hasta, reloj + 10 * DIA) && waDe(A, /No pudimos cobrar tu suscripción de SparkEd\./).length === 1, "cobro rechazado → «en gracia» por 10 días, con un aviso a la familia");
  const panel = await admin("GET", "suscripciones");
  ok(panel.d.resumen.en_gracia === 1 && panel.d.resumen.cobros === 2 && panel.d.resumen.ingreso_mxn === 698, "un cobro rechazado no es venta: el panel sigue en 2 cobros y $698");
  movs().length = 0;   // sin saldo de paquete, para ver qué pasa con la suscripción detenida
  const mia = await servidor("GET", "cuenta", undefined, { sesion: sesA });
  const sinCrear = await pedirGuia(sesA);
  ok(mia.d.suscripcion.actual.estado === "en_gracia" && mia.d.suscripcion.actual.puede_crear === false && sinCrear.r.st === 402 && sinCrear.r.d.en_gracia === true && /No pudimos cobrar tu suscripción/.test(sinCrear.r.d.error), "en gracia no puede crear guías nuevas (y se le dice por qué)");
  const acceso = db.accesos.find((a) => a.id === compraGuia.acceso_id) ?? {};
  ok(ms(acceso.expira_en) >= ms(s.gracia_hasta) - MIN && ms(acceso.expira_en) > reloj, "pero sus guías siguen abriendo durante la gracia");
  reloj += 2 * DIA;
  const malo2 = cobrar(preA, { estado: "rejected", tarjeta: TARJETA_X, pagador: 9001 });
  const r2 = await avisoMP("payment", malo2.pago);
  ok(r2.d.resultado === "rechazado" && ultimaSus(A).estado === "en_gracia" && waDe(A, /No pudimos cobrar tu suscripción de SparkEd\./).length === 1, "un segundo intento rechazado no repite el aviso ni cambia nada");
  reloj += 2 * DIA;
  const proximo = iso(masUnMes(fin));
  const bueno = cobrar(preA, { tarjeta: TARJETA_X, pagador: 9001, proximo });
  const r3 = await avisoMP("subscription_authorized_payment", bueno.cuota);
  s = ultimaSus(A);
  ok(r3.d.resultado === "cobrado" && s.estado === "activa" && s.periodo_fin === proximo && s.gracia_hasta === null && waDe(A, /Ya pudimos cobrar tu suscripción \(\$349 MXN\)/).length === 1 && (await servidor("GET", "cuenta", undefined, { sesion: sesA })).d.suscripcion.actual.puede_crear === true, "si un reintento sí pasa: vuelve a activa, pagada hasta la fecha de siempre (no se recorre), y ya puede crear");
  // El mes siguiente vuelve a fallar y esta vez nadie paga.
  fin = ms(s.periodo_fin); reloj = fin + 5 * MIN;
  await avisoMP("subscription_authorized_payment", cobrar(preA, { estado: "rejected" }).cuota);
  ok(ultimaSus(A).estado === "en_gracia" && waDe(A, /No pudimos cobrar tu suscripción de SparkEd\./).length === 2, "al mes siguiente vuelve a fallar: otra vez en gracia");
  reloj += 9 * DIA;
  const d9 = await admin("POST", "suscripciones/diario", {});
  ok(d9.d.vencidas === 0 && ultimaSus(A).estado === "en_gracia", "a los 9 días de gracia la tarea diaria todavía no la vence");
  reloj += DIA + HORA;
  const d10 = await admin("POST", "suscripciones/diario", {});
  s = ultimaSus(A);
  ok(d10.d.vencidas === 1 && s.estado === "vencida" && s.motivo_fin === "sin_pago" && /^cancel/.test(MP.pre[preA].status) && !!s.cancelada_mp_en && waDe(A, /terminó porque no se pudo cobrar\. Ya no se te cobrará nada/).length === 1, "pasados los 10 días la tarea diaria la deja «vencida», la cancela en Mercado Pago y le avisa a la familia");
  const d11 = await admin("POST", "suscripciones/diario", {});
  ok(d11.d.vencidas === 0 && d11.d.revisadas === 0 && waDe(A, /terminó porque no se pudo cobrar/).length === 1, "y no vuelve a tocarla");
  const fuera = await pedirGuia(sesA);
  ok(fuera.r.st === 402 && fuera.r.d.en_gracia === undefined, "vencida: ya no puede crear guías con la suscripción");
}

// ---------- 11. Volver a suscribirse: ya sin prueba gratis ----------
titulo("11. Alta sin prueba: el número ya usó la suya");
let preA2 = "";
{
  const mia = await servidor("GET", "cuenta", undefined, { sesion: sesA });
  ok(mia.d.suscripcion.disponible === true && mia.d.suscripcion.con_prueba === false && mia.d.suscripcion.actual.estado === "vencida", "«Mi cuenta» le ofrece suscribirse de nuevo, ya sin días gratis");
  const r = await servidor("POST", "suscripcion/crear", { acepta: true }, { sesion: sesA });
  const sus = ultimaSus(A); preA2 = sus.mp_preapproval_id;
  const ar = MP.pre[preA2]?.pedido?.auto_recurring ?? {};
  ok(r.st === 200 && r.d.con_prueba === false && sus.con_prueba === false && sus.primer_cobro_en === null && !("start_date" in ar) && !("end_date" in ar) && ar.transaction_amount === 349 && !/prueba gratis/.test(sus.acepto_texto), "la segunda vez se crea SIN prueba gratis: Mercado Pago cobra desde el primer día");
  autorizar(preA2, { pagador: 9001 });
  const a = await avisoMP("subscription_preapproval", preA2);
  const est = await servidor("GET", "suscripcion/estado", undefined, { sesion: sesA });
  ok(a.d.resultado === "esperando_primer_cobro" && ultimaSus(A).estado === "pendiente" && est.d.suscripcion.actual.falta === "cobro" && est.d.suscripcion.actual.puede_crear === false, "con la tarjeta ya puesta, sin prueba no se activa hasta que Mercado Pago apruebe el primer cobro");
  // El pago llega solo por el tema «Pagos» (como si Daniel todavía no hubiera activado «Planes y suscripciones»).
  const c = cobrar(preA2, { tarjeta: TARJETA_X, pagador: 9001, proximo: iso(masUnMes(reloj)) });
  const p = await avisoMP("payment", c.pago);
  const s = ultimaSus(A);
  ok(p.d.resultado === "cobrado" && p.d.suscripcion === true && s.estado === "activa" && cerca(s.periodo_fin, masUnMes(reloj)) && waDe(A, /Tu pago de \$349 MXN se confirmó y ya tienes \*guías ilimitadas\*/).length === 1, "el primer cobro aprobado la activa por un mes y sale la bienvenida");
}

// ---------- 12. Cancelar en un clic ----------
titulo("12. Cancelar en un clic");
{
  const s0 = ultimaSus(A), fin = s0.periodo_fin;
  const r = await servidor("POST", "suscripcion/cancelar", {}, { sesion: sesA });
  const s = ultimaSus(A), esperado = `Lamentamos que te vayas. Esperamos que regreses pronto al salón de clases. Tu suscripción seguirá activa hasta el ${fechaLarga(fin)}; después ya no se te cobrará nada.`;
  ok(r.st === 200 && r.d.estado === "cancelada" && r.d.hasta === fin && r.d.mensaje === esperado && r.d.en_mercadopago === true && s.estado === "cancelada" && s.cancelada_por === "familia" && s.proximo_cobro === null && s.periodo_fin === fin, "un clic: queda cancelada, conserva lo pagado hasta el fin del periodo y la respuesta trae el mensaje de Daniel");
  ok(/^cancel/.test(MP.pre[preA2].status) && !!s.cancelada_mp_en, "en ese momento se cancela en Mercado Pago: ya no habrá más cobros");
  const wa = waDe(A, /Lamentamos que te vayas/);
  ok(wa.length === 1 && wa[0].texto.startsWith(esperado) && new RegExp(`Comprobante de cancelación: folio ${s.id.slice(0, 8).toUpperCase()}`).test(wa[0].texto) && correos.filter((x) => x.to?.[0] === "ana@correo.com" && /quedó cancelada/.test(x.subject)).length === 1, "le llega el comprobante por WhatsApp y por correo, con el folio y la fecha");
  const otra = await servidor("POST", "suscripcion/cancelar", {}, { sesion: sesA });
  ok(otra.st === 200 && otra.d.ya === true && otra.d.hasta === fin && waDe(A, /Lamentamos que te vayas/).length === 1, "cancelar dos veces no hace nada más (ni repite el mensaje)");
  const mia = await servidor("GET", "cuenta", undefined, { sesion: sesA });
  const act = mia.d.suscripcion.actual;
  ok(act.estado === "cancelada" && act.puede_crear === true && act.puede_cancelar === false && act.hasta === fin && act.proximo_cobro === null, "«Mi cuenta»: cancelada, sin próximo cobro y con derecho a crear guías hasta esa fecha");
  const g = await pedirGuia(sesA);
  ok(g.r.st === 202 && g.r.d.con_suscripcion === true, "después de cancelar sigue creando guías mientras dure lo que pagó");
  await terminarGuia(sesA, g.compra!);
  const d = await admin("POST", "suscripciones/diario", {});
  ok(d.d.avisos_renovacion === 0 && d.d.a_gracia === 0 && ultimaSus(A).estado === "cancelada", "la tarea diaria no le manda avisos de renovación ni la toca");
  ok(mia.d.suscripcion.disponible === true && mia.d.suscripcion.con_prueba === false && mia.d.suscripcion.primer_cobro_en === fin, "si quiere volver antes de que termine lo pagado, el primer cobro sería ese día");
}

// ---------- 13. Volver antes de que termine lo pagado ----------
titulo("13. Volver a suscribirse con días pagados por delante");
{
  const fin = ultimaSus(A).periodo_fin;
  const r = await servidor("POST", "suscripcion/crear", { acepta: true }, { sesion: sesA });
  const sus = ultimaSus(A), pre = sus.mp_preapproval_id, ar = MP.pre[pre]?.pedido?.auto_recurring ?? {};
  ok(r.st === 200 && sus.con_prueba === false && sus.primer_cobro_en === fin && ar.start_date === fin && susDe(A).filter((x) => x.estado === "cancelada").length === 1, "la nueva suscripción no cobra hoy: su primer cobro se pide para el día en que termina lo pagado");
  autorizar(pre, { pagador: 9001 });
  const a = await avisoMP("subscription_preapproval", pre);
  const s = ultimaSus(A);
  ok(a.d.resultado === "activa" && s.estado === "activa" && s.periodo_fin === fin && s.proximo_cobro === fin && waDe(A, /quedó activa otra vez/).length === 1 && (db.pruebas_usadas ?? []).filter((x) => x.suscripcion_id === s.id).length === 0, "queda activa de inmediato, pagada hasta la misma fecha, y se le avisa cuándo será su cobro");
  const c = await servidor("POST", "suscripcion/cancelar", {}, { sesion: sesA });
  ok(c.d.estado === "cancelada" && c.d.hasta === fin, "y la puede cancelar igual, en un clic");
  reloj = ms(fin) + HORA;
  const mia = await servidor("GET", "cuenta", undefined, { sesion: sesA });
  const g = await pedirGuia(sesA);
  ok(mia.d.suscripcion.actual.puede_crear === false && g.r.st === 402 && g.r.d.sin_saldo === true, "al terminar lo pagado ya no puede crear guías con la suscripción");
}

// ---------- 14. Una prueba gratis por tarjeta (y por cuenta de Mercado Pago) ----------
titulo("14. Alta sin prueba: la tarjeta ya usó la suya");
for (const t of [D, G, E, F, H]) await admin("POST", "suscripciones/probadores", { agregar: t });
reloj += 61_000;
{
  const sesD = await entrar(D, "Dora Tarjeta", "dora@correo.com");
  ok((await servidor("GET", "cuenta", undefined, { sesion: sesD })).d.suscripcion.con_prueba === true, "un número nuevo ve los 7 días gratis");
  await servidor("POST", "suscripcion/crear", { acepta: true, nombre: "Dora Tarjeta", correo: "dora@correo.com" }, { sesion: sesD });
  const sus = ultimaSus(D), pre = sus.mp_preapproval_id;
  cobrar(pre, { monto: 5, tarjeta: TARJETA_X, pagador: 9004, cuota: false });   // la MISMA tarjeta con la que Ana tuvo su prueba
  autorizar(pre, { pagador: 9004 });
  const a = await avisoMP("subscription_preapproval", pre);
  const s = ultimaSus(D);
  ok(a.d.resultado === "prueba_negada" && s.estado === "abandonada" && s.motivo_fin === "prueba_ya_usada" && /^cancel/.test(MP.pre[pre].status) && (db.suscripcion_cobros ?? []).every((c) => c.suscripcion_id !== s.id), "la misma tarjeta con otro número: no hay segunda prueba gratis; se cancela en Mercado Pago antes de cualquier cobro");
  ok(waDe(D, /ya había usado una\. No se te cobró nada/).length === 1 && waDe(D, /prueba gratis termina/).length === 0, "la familia recibe el aviso (no se le cobró nada) y no la bienvenida");
  const mia = await servidor("GET", "cuenta", undefined, { sesion: sesD });
  const r2 = await servidor("POST", "suscripcion/crear", { acepta: true }, { sesion: sesD });
  const ar2 = MP.pre[ultimaSus(D).mp_preapproval_id]?.pedido?.auto_recurring ?? {};
  ok(mia.d.suscripcion.disponible === true && mia.d.suscripcion.con_prueba === false && r2.st === 200 && r2.d.con_prueba === false && !("start_date" in ar2), "si quiere, se suscribe sin prueba: la suscripción se crea sin días gratis");
  // Otra tarjeta, pero la misma cuenta de Mercado Pago que ya tuvo una prueba.
  const sesG = await entrar(G, "Gil Pagador", "gil@correo.com");
  await servidor("POST", "suscripcion/crear", { acepta: true, nombre: "Gil Pagador", correo: "gil@correo.com" }, { sesion: sesG });
  const preG = ultimaSus(G).mp_preapproval_id;
  cobrar(preG, { monto: 5, tarjeta: TARJETA_Y, pagador: 9001, cuota: false });
  autorizar(preG, { pagador: 9001 });
  const aG = await avisoMP("subscription_preapproval", preG);
  ok(aG.d.resultado === "prueba_negada" && ultimaSus(G).estado === "abandonada", "la misma cuenta de Mercado Pago con otro número y otra tarjeta tampoco repite la prueba");
}

// ---------- 15. Si Mercado Pago no respeta la fecha del primer cobro ----------
titulo("15. La prueba gratis depende de Mercado Pago: si no respeta la fecha, no hay cobro sorpresa");
{
  const sesE = await entrar(E, "Eva Fecha", "eva@correo.com");
  MP.ignoraFecha = true;
  const reportesAntes = (db.reportes ?? []).length;
  const r = await servidor("POST", "suscripcion/crear", { acepta: true, nombre: "Eva Fecha", correo: "eva@correo.com" }, { sesion: sesE });
  const s = ultimaSus(E);
  ok(r.st === 502 && /No se te cobró nada/.test(r.d.error) && s.estado === "abandonada" && /^cancel/.test(Object.values(MP.pre).at(-1).status) && /no confirmó la fecha del primer cobro/.test(s.mp_error ?? "") && (db.reportes ?? []).length === reportesAntes + 1, "si Mercado Pago no confirma la fecha del primer cobro, no se sigue: se cancela ahí y Daniel recibe el aviso");
  MP.ignoraFecha = false;
  const r2 = await servidor("POST", "suscripcion/crear", { acepta: true }, { sesion: sesE });
  const pre = ultimaSus(E).mp_preapproval_id;
  autorizar(pre, { pagador: 9005, proximo: iso(reloj + HORA) });   // Mercado Pago dice que cobrará HOY, no en 7 días
  const a = await avisoMP("subscription_preapproval", pre);
  const s2 = ultimaSus(E);
  ok(r2.st === 200 && a.d.resultado === "fecha_no_respetada" && s2.estado === "abandonada" && s2.motivo_fin === "fecha_no_respetada" && /^cancel/.test(MP.pre[pre].status) && s2.revisar === true && waDe(E, /La cancelamos para que no se te cobre nada/).length === 1, "si al autorizar Mercado Pago piensa cobrar antes de lo prometido, se cancela en ese momento y se le avisa a la familia");
  ok(!cuentaDe(E).prueba_gratis_usada_en && (await servidor("GET", "cuenta", undefined, { sesion: sesE })).d.suscripcion.con_prueba === true, "y su prueba gratis no se da por usada");
}

// ---------- 16. Cancelar: casos raros ----------
titulo("16. Cancelar cuando Mercado Pago no coopera");
{
  const sesF = await entrar(F, "Fer Cancela", "fer@correo.com");
  await servidor("POST", "suscripcion/crear", { acepta: true, nombre: "Fer Cancela", correo: "fer@correo.com" }, { sesion: sesF });
  const sinTerminar = await servidor("POST", "suscripcion/cancelar", {}, { sesion: sesF });
  ok(sinTerminar.d.estado === "abandonada" && ultimaSus(F).estado === "abandonada" && /^cancel/.test(MP.pre[ultimaSus(F).mp_preapproval_id].status) && waDe(F, /Lamentamos/).length === 0 && /no se contrató ninguna suscripción/.test(sinTerminar.d.mensaje), "cancelar algo que nunca se terminó de contratar: no es una cancelación, solo se descarta");
  await servidor("POST", "suscripcion/crear", { acepta: true }, { sesion: sesF });
  const pre = ultimaSus(F).mp_preapproval_id;
  cobrar(pre, { monto: 5, tarjeta: TARJETA_Z, pagador: 9006, cuota: false }); autorizar(pre, { pagador: 9006 });
  await avisoMP("subscription_preapproval", pre);
  const finPrueba = ultimaSus(F).periodo_fin;
  MP.soloCanceled = true;   // Mercado Pago solo entiende «canceled», con una ele
  const c = await servidor("POST", "suscripcion/cancelar", {}, { sesion: sesF });
  MP.soloCanceled = false;
  ok(ultimaSus(F).con_prueba === true && c.d.estado === "cancelada" && c.d.hasta === finPrueba && c.d.en_mercadopago === true && MP.pre[pre].status === "canceled" && c.d.mensaje.includes(`seguirá activa hasta el ${fechaLarga(finPrueba)}`), "cancelar durante la prueba: sigue activa hasta el fin de la prueba y no se cobra nada; Mercado Pago la cancela aunque escriba el estado de otra forma");
  // Mercado Pago caído al cancelar.
  const sesH = await entrar(H, "Hugo Caido", "hugo@correo.com");
  await servidor("POST", "suscripcion/crear", { acepta: true, nombre: "Hugo Caido", correo: "hugo@correo.com" }, { sesion: sesH });
  const preH = ultimaSus(H).mp_preapproval_id;
  autorizar(preH, { pagador: 9008 });
  await avisoMP("subscription_preapproval", preH);
  ok(ultimaSus(H).estado === "en_prueba", "(otra familia en prueba)");
  const reportesAntes = (db.reportes ?? []).length;
  MP.caido = true;
  const cH = await servidor("POST", "suscripcion/cancelar", {}, { sesion: sesH });
  const sH = ultimaSus(H);
  ok(cH.st === 200 && cH.d.estado === "cancelada" && cH.d.en_mercadopago === false && sH.estado === "cancelada" && sH.cancelada_mp_en === null && sH.revisar === true && waDe(H, /Lamentamos que te vayas/).length === 1 && (db.reportes ?? []).slice(reportesAntes).some((x) => /no se pudo aplicar en Mercado Pago/.test(x.comentario)), "con Mercado Pago caído la cancelación vale igual: la familia recibe su comprobante y Daniel el aviso de que falta cancelarla allá");
  MP.caido = false;
  const d = await admin("POST", "suscripciones/diario", {});
  ok(d.d.cancelaciones_confirmadas === 1 && /^cancel/.test(MP.pre[preH].status) && !!ultimaSus(H).cancelada_mp_en, "la tarea diaria vuelve a intentarlo y la deja cancelada en Mercado Pago");
  // Si aun así llegara un cobro después de cancelar: no se pierde y Daniel lo ve.
  const tarde = cobrar(preH, { tarjeta: TARJETA_Z, pagador: 9008 });
  const rt = await avisoMP("payment", tarde.pago);
  const sH2 = ultimaSus(H);
  ok(rt.d.resultado === "cobrado" && sH2.estado === "cancelada" && /después de cancelar/.test(sH2.revisar_motivo ?? "") && (db.reportes ?? []).some((x) => /Llegó un cobro de \$349 MXN a una suscripción cancelada/.test(x.comentario)), "un cobro que llega después de cancelar queda anotado, la suscripción sigue cancelada y Daniel recibe el aviso para reembolsar");
}

// ---------- 16b. Oprimir «Suscribirme» otra vez con otro correo de pago ----------
titulo("16b. Empezar de nuevo con otro correo de pago");
const I = "5511110009";
{
  await admin("POST", "suscripciones/probadores", { agregar: I }); reloj += 61_000;
  const sesI = await entrar(I, "Iris Correo", "iris@correo.com");
  const r1 = await servidor("POST", "suscripcion/crear", { acepta: true, nombre: "Iris Correo", correo: "iris@correo.com" }, { sesion: sesI });
  const pre1 = ultimaSus(I).mp_preapproval_id;
  const r2 = await servidor("POST", "suscripcion/crear", { acepta: true, correo_pago: "iris.pagos@correo.com" }, { sesion: sesI });
  const [vieja, nueva] = susDe(I);
  ok(r1.st === 200 && r2.st === 200 && r2.d.suscripcion_id !== r1.d.suscripcion_id && vieja.estado === "abandonada" && vieja.motivo_fin === "reemplazada" && /^cancel/.test(MP.pre[pre1].status) && nueva.estado === "pendiente" && nueva.con_prueba === true && nueva.correo_pago === "iris.pagos@correo.com" && MP.pre[nueva.mp_preapproval_id].pedido.payer_email === "iris.pagos@correo.com" && cuentaDe(I).correo === "iris@correo.com", "con otro correo de pago se abre una suscripción nueva; la anterior (todavía sin tarjeta) se descarta y se cancela en Mercado Pago; el correo de respaldo de la cuenta no cambia");
  // Ya puso su tarjeta en la nueva y el aviso todavía no llega: oprime «Suscribirme» otra vez, con otro correo.
  autorizar(nueva.mp_preapproval_id, { pagador: 9009 });
  const r3 = await servidor("POST", "suscripcion/crear", { acepta: true, correo_pago: "otro@correo.com" }, { sesion: sesI });
  ok(r3.st === 409 && r3.d.ya === true && susDe(I).length === 2 && ultimaSus(I).id === nueva.id && ultimaSus(I).estado === "en_prueba" && MP.pre[nueva.mp_preapproval_id].status === "authorized", "si ya había puesto su tarjeta, oprimir «Suscribirme» otra vez NO la cancela: se le pregunta a Mercado Pago y queda su prueba gratis");
  const c = await servidor("POST", "suscripcion/cancelar", {}, { sesion: sesI });
  ok(c.d.estado === "cancelada" && /^cancel/.test(MP.pre[nueva.mp_preapproval_id].status), "(y la cancela desde su cuenta)");
}

// ---------- 16c. El correo a medias que enseña «Mi cuenta» nunca se usa como correo de verdad ----------
// «Mi cuenta» solo conoce el correo a medias (j•••@correo.com). Si una página lo mandara de regreso (la del 25 nov 2026
// lo ponía ya escrito en «Correo con el que pagas en Mercado Pago»), el servidor no debe pasárselo a Mercado Pago.
titulo("16c. El correo a medias nunca llega a Mercado Pago");
const J = "5511110010";
{
  await admin("POST", "suscripciones/probadores", { agregar: J }); reloj += 61_000;
  const sesJ = await entrar(J, "Juana Media", "juana@correo.com");
  const aMedias = String((await servidor("GET", "cuenta", undefined, { sesion: sesJ })).d?.cuenta?.correo ?? "");
  const r1 = await servidor("POST", "suscripcion/crear", { acepta: true, correo_pago: aMedias }, { sesion: sesJ });
  const s = ultimaSus(J);
  ok(aMedias === "j•••@correo.com" && r1.st === 200 && s.correo_pago === "juana@correo.com" && MP.pre[s.mp_preapproval_id].pedido.payer_email === "juana@correo.com", "si llega el correo a medias como correo de pago, a Mercado Pago se le manda el correo de verdad de la cuenta");
  // Tampoco como correo de respaldo: la cuenta conserva el suyo, y pedir lo mismo otra vez no abre otra suscripción.
  const r2 = await servidor("POST", "suscripcion/crear", { acepta: true, correo: aMedias, correo_pago: "juana@correo.com" }, { sesion: sesJ });
  const fin = await servidor("POST", "suscripcion/cancelar", {}, { sesion: sesJ });
  ok(r2.st === 200 && r2.d.suscripcion_id === r1.d.suscripcion_id && susDe(J).length === 1 && cuentaDe(J).correo === "juana@correo.com" && fin.st === 200 && ultimaSus(J).estado === "abandonada" && /^cancel/.test(MP.pre[s.mp_preapproval_id].status), "tampoco reemplaza el correo de respaldo de la cuenta (y «Ya no quiero suscribirme» la deja sin nada pendiente)");
}

// ---------- 17. Cancelada desde Mercado Pago, y pendientes que nadie terminó ----------
titulo("17. Lo que pasa del lado de Mercado Pago");
{
  // Una suscriptora en prueba cancela desde su cuenta de Mercado Pago (no desde SparkEd).
  await admin("POST", "suscripciones/probadores", { agregar: B }); reloj += 61_000;
  ok((await servidor("GET", "cuenta", undefined, { sesion: sesB })).st === 401, "(una sesión que nadie usó en más de 60 días ya se cerró sola)");
  const sesB2 = await entrar(B, "Beto Fuera", "beto@correo.com");
  await servidor("POST", "suscripcion/crear", { acepta: true, nombre: "Beto Fuera", correo: "beto@correo.com" }, { sesion: sesB2 });
  const pre = ultimaSus(B).mp_preapproval_id;
  autorizar(pre, { pagador: 9002 });
  await avisoMP("subscription_preapproval", pre);
  MP.pre[pre].status = "cancelled";
  const a = await avisoMP("subscription_preapproval", pre);
  const s = ultimaSus(B);
  ok(a.d.resultado === "cancelada" && s.estado === "cancelada" && s.cancelada_por === "mercadopago" && waDe(B, /se canceló en Mercado Pago\. Seguirá activa hasta el/).length === 1, "si la cancelan desde Mercado Pago, aquí queda cancelada (conserva su periodo) y se le avisa");
  // Una pendiente que nadie terminó se abandona a los 3 días y su link deja de servir.
  await servidor("POST", "suscripcion/cancelar", {}, { sesion: sesB2 });
  reloj = ms(s.periodo_fin) + HORA;
  const r = await servidor("POST", "suscripcion/crear", { acepta: true }, { sesion: sesB2 });
  const pend = ultimaSus(B), prePend = pend.mp_preapproval_id;
  ok(r.st === 200 && pend.estado === "pendiente" && pend.con_prueba === false, "(una suscripción a medio contratar)");
  reloj += 2 * DIA;
  const viejaD = ultimaSus(D);   // la que Dora dejó a medias hace más de 3 días
  const d2 = await admin("POST", "suscripciones/diario", {});
  ok(d2.d.abandonadas === 1 && viejaD.estado === "abandonada" && viejaD.motivo_fin === "sin_terminar" && /^cancel/.test(MP.pre[viejaD.mp_preapproval_id].status) && ultimaSus(B).estado === "pendiente", "la tarea diaria abandona la que lleva más de 3 días sin terminar de contratarse (y cancela su link en Mercado Pago); la de 2 días sigue esperando");
  reloj += DIA + HORA;
  const d3 = await admin("POST", "suscripciones/diario", {});
  ok(d3.d.abandonadas === 1 && ultimaSus(B).estado === "abandonada" && /^cancel/.test(MP.pre[prePend].status) && waDe(B, /No pudimos|terminó/).length === 0, "al pasar los 3 días también abandona esa, sin molestar a la familia");
}

// ---------- 18. Cuentas de prueba: todo simulado, sin tocar Mercado Pago ni mandar mensajes ----------
titulo("18. Pruebas automáticas (cuenta de prueba): nada sale a Mercado Pago ni a nadie");
{
  ok((await admin("POST", "config", { sparked_suscripcion: "no" })).st === 200, "(el interruptor vuelve a «apagada»)");
  reloj += 61_000;
  const NUM = "0001234567";
  const cod = await servidor("POST", "cuenta/codigo", { telefono: NUM, simular: true }, { admin: true });
  const ent = await servidor("POST", "cuenta/entrar", { telefono: NUM, codigo: cod.d?.codigo });
  const ses = ent.d?.sesion ?? "", cta = db.cuentas.find((c) => c.telefono === "+52" + NUM)!;
  const antes = { mp: MP.llamadas.length, wa: whatsapps.length, correo: correos.length, reportes: (db.reportes ?? []).length };
  const sinClave = await servidor("POST", "suscripcion/crear", { acepta: true, nombre: "Prueba", correo: "prueba@sparked.invalid" }, { sesion: ses });
  const conClave = await servidor("POST", "suscripcion/crear", { acepta: true, nombre: "Prueba", correo: "prueba@sparked.invalid" }, { sesion: ses, admin: true });
  const sus = db.suscripciones.find((x) => x.cuenta_id === cta.id)!;
  ok(cta.de_prueba === true && sinClave.st === 503 && conClave.st === 200 && conClave.d.modo === "simulada" && sus.de_prueba === true && /^prueba-/.test(sus.mp_preapproval_id) && MP.llamadas.length === antes.mp, "apagada, solo una cuenta de prueba con la clave de administrador puede contratar, y sin tocar Mercado Pago");
  const p = (cuerpo: unknown) => admin("POST", `suscripciones/${sus.id}/prueba`, cuerpo);
  const a = await p({ accion: "preapproval", datos: { status: "authorized", next_payment_date: sus.primer_cobro_en, payer_id: 777 }, pagos: [] });
  ok(a.st === 200 && a.d.resultado === "en_prueba" && a.d.suscripcion.estado === "en_prueba", "un aviso simulado de «autorizada» la deja en prueba (pasa por el mismo código de verdad)");
  const uso = await p({ accion: "uso", guias: 16 });
  ok(uso.d.resultado === true && uso.d.suscripcion.revisar === true && (db.reportes ?? []).length === antes.reportes, "más de 15 guías en la prueba: deja la bandera, pero una cuenta de prueba no llena los Reportes de Daniel");
  await p({ accion: "fechas", proximo_cobro: iso(reloj + 5 * DIA + HORA), periodo_fin: iso(reloj + 5 * DIA + HORA), aviso_renovacion_para: null });
  const real = ultimaSus(F);   // la de una familia: la fecha simulada no debe tocarla
  const fotoReal = JSON.stringify(real);
  const d = await admin("POST", "suscripciones/diario", { fecha: iso(reloj + 40 * DIA) });
  ok(d.st === 200 && d.d.solo_prueba === true && d.d.revisadas === 1 && d.d.a_gracia === 1 && JSON.stringify(ultimaSus(F)) === fotoReal, "tarea diaria con una fecha simulada: solo toca las suscripciones de prueba (nunca le adelanta el reloj a una familia)");
  const pago = await p({ accion: "pago", pago: { id: "prueba-pago-1", status: "approved", transaction_amount: 349, currency_id: "MXN", payment_type_id: "credit_card", date_approved: ahoraIso() }, proximo: iso(masUnMes(reloj)) });
  const pago2 = await p({ accion: "pago", pago: { id: "prueba-pago-1", status: "approved", transaction_amount: 349, currency_id: "MXN", payment_type_id: "credit_card", date_approved: ahoraIso() }, proximo: iso(masUnMes(reloj)) });
  ok(pago.d.resultado === "cobrado" && pago.d.suscripcion.estado === "activa" && pago2.d.resultado === "sin_cambios" && pago2.d.suscripcion.periodo_fin === pago.d.suscripcion.periodo_fin, "un pago simulado la activa; repetido, no alarga dos veces");
  ok(MP.llamadas.length === antes.mp && whatsapps.length === antes.wa && correos.length === antes.correo, "en toda la prueba simulada no salió ni una llamada a Mercado Pago, ni un WhatsApp, ni un correo");
  const panel = await admin("GET", "suscripciones");
  ok(panel.d.resumen.de_prueba === 1 && panel.d.resumen.cobros === 5 && panel.d.resumen.ingreso_mxn === 5 * 349 && panel.d.suscripciones.find((x: any) => x.id === sus.id)?.de_prueba === true, `las cifras del panel no cuentan la suscripción de prueba ni su cobro (${panel.d?.resumen?.cobros} cobros · $${panel.d?.resumen?.ingreso_mxn})`);
  const borrar = await admin("DELETE", `cuentas/${cta.id}`);
  ok(borrar.st === 200 && borrar.d.borrado.suscripciones === 1 && !db.suscripciones.some((x) => x.cuenta_id === cta.id) && !(db.suscripcion_cobros ?? []).some((x) => x.suscripcion_id === sus.id) && !(db.pruebas_usadas ?? []).some((x) => x.cuenta_id === cta.id) && !db.cuentas.some((x) => x.id === cta.id), "la cuenta de prueba se borra con su suscripción, sus cobros y su prueba gratis anotada");
}

// ---------- 19. Apagada otra vez, abierta al público, y lo que ve Daniel ----------
titulo("19. El interruptor y el panel");
{
  const mia = await servidor("GET", "cuenta", undefined, { sesion: sesA });
  const r = await servidor("POST", "suscripcion/crear", { acepta: true }, { sesion: sesA });
  ok(mia.d.suscripcion.disponible === false && r.st === 503, "apagada otra vez: ni una probadora puede contratar");
  ok((await servidor("POST", "suscripcion/cancelar", {}, { sesion: sesA })).st === 200, "pero quien ya tiene (o tuvo) una suscripción puede seguir viéndola y cancelarla");
  await admin("POST", "config", { sparked_suscripcion: "si" }); reloj += 61_000;
  const nueva = await entrar("5511119999", "Zoe Publica", "zoe@correo.com");
  const info = await servidor("GET", "suscripcion/info");
  const z = await servidor("GET", "cuenta", undefined, { sesion: nueva });
  ok(info.d.disponible === true && z.d.suscripcion.disponible === true && z.d.suscripcion.con_prueba === true, "abierta al público ('si'): cualquiera con cuenta la ve (este paso necesita el sí de Daniel)");
  await admin("POST", "config", { sparked_suscripcion: "probadores", sparked_paquete3: "no" }); reloj += 61_000;
  const waAntes = whatsapps.length;
  await admin("POST", "suscripciones/probadores", { agregar: "5511118888" }); reloj += 61_000;
  const c1 = await servidor("POST", "cuenta/codigo", { telefono: "5511118888", nombre: "Probadora Nueva", correo: "nueva@correo.com" });
  const c2 = await servidor("POST", "cuenta/codigo", { telefono: "5511117777", nombre: "Otra Persona", correo: "otra@correo.com" });
  ok(c1.st === 200 && c2.st === 200 && whatsapps.length === waAntes + 1 && String(whatsapps.at(-1)!.chat).includes("5511118888"), "con el paquete apagado, solo un probador puede abrir cuenta: a otro número no se le manda ningún código");
  const quitar = await admin("POST", "suscripciones/probadores", { quitar: (await admin("GET", "suscripciones")).d.ajustes.probadores.find((x: any) => x.whatsapp.endsWith("8888"))?.id });
  ok(quitar.st === 200 && !quitar.d.probadores.some((x: any) => x.whatsapp.endsWith("8888")), "Daniel puede quitar un número de la lista");
  const panel = await admin("GET", "suscripciones"), textoPanel = JSON.stringify(panel.d);
  const telefonos = [A, B, D, E, F, G, H, I, J, "5511119999"], correosFam = ["ana@correo.com", "beto@correo.com", "dora@correo.com", "eva@correo.com", "fer@correo.com", "hugo@correo.com", "juana@correo.com"];
  ok(panel.st === 200 && telefonos.every((t) => !textoPanel.includes(t)) && correosFam.every((c) => !textoPanel.includes(c)) && panel.d.suscripciones.every((x: any) => /^••• ••• \d{4}$/.test(x.whatsapp ?? "")), "en todo lo que ve el panel el WhatsApp y el correo salen enmascarados");
  const R = panel.d.resumen;
  ok(R.activas === 0 && R.en_prueba === 0 && R.en_gracia === 0 && R.pendientes === 0 && R.canceladas === 6 && R.vencidas === 1 && R.cobros === 5 && R.ingreso_mxn === 1745 && R.por_revisar === 3 && R.de_prueba === 0, `cifras finales: ${R.cobros} cobros aprobados · $${R.ingreso_mxn}; ${R.canceladas} canceladas, ${R.vencidas} vencida, ${R.por_revisar} por revisar`);
  const revisado = await admin("POST", `suscripciones/${ultimaSus(H).id}/revisado`, {});
  ok(revisado.st === 200 && ultimaSus(H).revisar === false, "Daniel puede marcar una bandera como revisada");
  const una = await admin("GET", `suscripciones/${susDe(A)[0].id}`);
  ok(una.st === 200 && una.d.cobros.length === 6 && una.d.cobros.filter((x: any) => x.estado === "aprobado").length === 3 && una.d.cobros.filter((x: any) => x.estado === "rechazado").length === 3 && una.d.guias.length === 19 && una.d.guias.filter((g: any) => g.estado === "fallida").length === 1 && una.d.whatsapp === "••• ••• 0001" && /prueba gratis de 7 días/.test(una.d.acepto_texto), "el detalle de una suscripción trae sus cobros (3 aprobados y 3 rechazados), sus 19 guías (una no se pudo crear) y el texto que aceptó");
  ok((await admin("GET", "suscripciones/otra-cosa")).st === 404 && (await admin("POST", `suscripciones/${ultimaSus(F).id}/prueba`, { accion: "pago" })).st === 403, "las acciones de prueba no sirven con la suscripción de una familia");
}

// ====================================================================================================================
// Cambiar el método de pago SIN cancelar la suscripción («como Xbox», Daniel, 25 nov 2026)
// La tarjeta nueva se pone en Mercado Pago, en un contrato nuevo de la MISMA suscripción. El contrato anterior se
// cancela solo después de que Mercado Pago confirma el nuevo. Lo que se cuida: que nunca queden dos contratos con
// permiso de cobrar, que no haya cobro doble, que no se pierdan días y que no haya otra prueba gratis.
// ====================================================================================================================
const cambiosDe = (tel: string) => (db.suscripcion_cambios_pago ?? []).filter((k) => susDe(tel).some((s) => s.id === k.suscripcion_id));
const ultimoCambio = (tel: string) => cambiosDe(tel).at(-1)!;
/** Contratos de esa familia que Mercado Pago tiene con permiso de cobrar. Lo sano es 1 (o 0 si ya canceló). */
const vivos = (tel: string) => Object.values(MP.pre).filter((p: any) => susDe(tel).some((s) => s.id === p.external_reference) && p.status === "authorized").length;
const cobrosDe = (tel: string, estado?: string) => (db.suscripcion_cobros ?? []).filter((x) => susDe(tel).some((s) => s.id === x.suscripcion_id) && (!estado || x.estado === estado));
const mensajesA = (tel: string) => whatsapps.filter((x) => String(x.chat).includes(tel)).length;
const T: Record<string, Tarjeta> = { k1: ["411111", "1111", 1, 2030], k2: ["422222", "2222", 2, 2030], l1: ["433333", "3331", 3, 2030], p1: ["444444", "4441", 4, 2030], p2: ["444445", "4442", 4, 2031], q1: ["455555", "5551", 5, 2030], q2: ["455556", "5552", 5, 2031], r1: ["466666", "6661", 6, 2030], r2: ["466667", "6662", 6, 2031], u1: ["477777", "7771", 7, 2030], v1: ["488888", "8881", 8, 2030], w1: ["499999", "9991", 9, 2030], x1: ["400001", "0011", 10, 2030], y1: ["400002", "0021", 11, 2030], y2: ["400003", "0022", 11, 2031] };
let nPagador = 9100;
/** Una familia nueva se suscribe con prueba gratis y pone su tarjeta en Mercado Pago: queda «en prueba». */
async function familiaEnPrueba(tel: string, nombre: string, tarjeta: Tarjeta) {
  const pagador = ++nPagador, correo = `${nombre.split(" ")[0].toLowerCase()}@correo.com`;
  await admin("POST", "suscripciones/probadores", { agregar: tel }); reloj += 61_000;
  const sesion = await entrar(tel, nombre, correo);
  await servidor("POST", "suscripcion/crear", { acepta: true, nombre, correo }, { sesion });
  const pre = ultimaSus(tel).mp_preapproval_id as string;
  const v = cobrar(pre, { monto: 5, tarjeta, pagador, cuota: false });
  autorizar(pre, { pagador });
  await avisoMP("subscription_preapproval", pre);
  await avisoMP("payment", v.pago);
  return { sesion, pre, pagador, correo };
}
/** …y ya pasó su prueba: Mercado Pago cobró el primer mes y queda «activa». */
async function familiaActiva(tel: string, nombre: string, tarjeta: Tarjeta) {
  const f = await familiaEnPrueba(tel, nombre, tarjeta);
  const fin = ms(ultimaSus(tel).periodo_fin);
  reloj = fin + 10 * MIN;
  await avisoMP("subscription_authorized_payment", cobrar(f.pre, { tarjeta, pagador: f.pagador, proximo: iso(masUnMes(fin)) }).cuota);
  return f;
}
/** …o su primer cobro no pasó: queda «en gracia». */
async function familiaEnGracia(tel: string, nombre: string, tarjeta: Tarjeta) {
  const f = await familiaEnPrueba(tel, nombre, tarjeta);
  reloj = ms(ultimaSus(tel).periodo_fin) + 10 * MIN;
  await avisoMP("subscription_authorized_payment", cobrar(f.pre, { estado: "rejected", tarjeta, pagador: f.pagador }).cuota);
  return f;
}
const pedirCambio = (sesion: string, cuerpo: unknown = {}) => servidor("POST", "suscripcion/metodo-de-pago", cuerpo, { sesion });
const metodoDe = async (sesion: string) => (await servidor("GET", "cuenta", undefined, { sesion })).d?.suscripcion?.actual?.metodo ?? null;
/** Corre algo que se espera que falle sin llenar la salida con el error que el servidor anota en su registro. */
async function sinRuido<X>(fn: () => Promise<X>): Promise<X> { const original = console.error; console.error = () => {}; try { return await fn(); } finally { console.error = original; } }

titulo("20. Cambiar el método de pago con la suscripción activa: sin cancelar, sin cobro hoy y sin cobro doble");
const K = "5511120001", M2 = "5511120002";
{
  const t0 = reloj, s = (estado: string, extra: Fila = {}) => ({ estado, periodo_fin: iso(t0 + 10 * DIA), ...extra });
  const g = S.puedeCambiarMetodo(s("en_gracia"), t0), a = S.puedeCambiarMetodo(s("activa"), t0), p = S.puedeCambiarMetodo(s("en_prueba"), t0), cerca3 = S.puedeCambiarMetodo(s("activa", { periodo_fin: iso(t0 + 2 * HORA) }), t0), pasado = S.puedeCambiarMetodo(s("activa", { periodo_fin: iso(t0 - HORA) }), t0);
  ok(g.puede && g.inmediato && a.puede && !a.inmediato && a.primerCobroMs === t0 + 10 * DIA && p.puede && !p.inmediato && !cerca3.puede && cerca3.cobroCerca && !pasado.puede && pasado.cobroCerca && ["cancelada", "vencida", "pendiente", "abandonada"].every((e) => !S.puedeCambiarMetodo(s(e), t0).puede) && !S.puedeCambiarMetodo(null, t0).puede, "la regla: en gracia se cambia cuando sea (y se cobra ese día); activa o en prueba, si faltan más de 3 horas para el cobro (y el contrato nuevo cobra ese día); sin suscripción viva, no");

  const f = await familiaActiva(K, "Karla Activa", T.k1);
  const s0 = { ...ultimaSus(K) }, A0 = f.pre, fin = s0.periodo_fin as string;
  reloj += 3 * DIA;
  const m0 = await metodoDe(f.sesion);
  ok(s0.estado === "activa" && m0?.tarjeta === "1111" && m0.puede_cambiar === true && m0.inmediato === false && m0.cobro_cerca === false && m0.cambio === null && m0.cambiado_en === null && !JSON.stringify(m0).includes("411111"), "«Mi cuenta» dice con qué tarjeta se cobra (solo los últimos 4 dígitos) y que se puede cambiar");
  ok((await servidor("POST", "suscripcion/metodo-de-pago", {})).st === 401, "sin sesión no se puede cambiar el método de pago");
  const antes = { pre: Object.keys(MP.pre).length, wa: mensajesA(K), cobros: cobrosDe(K).length };
  const r = await pedirCambio(f.sesion);
  const k = ultimoCambio(K), B = k?.mp_preapproval_id as string, pedido = MP.pre[B]?.pedido ?? {}, ar = pedido.auto_recurring ?? {};
  ok(r.st === 200 && r.d.modo === "mercadopago" && r.d.url === MP.pre[B]?.init_point && r.d.inmediato === false && r.d.primer_cobro_en === fin && r.d.cambio_id === k.id && r.d.precio === 349, "«Cambiar método de pago» abre la página de Mercado Pago para poner la tarjeta nueva (aquí nunca se pide una tarjeta)");
  ok(pedido.status === "pending" && pedido.external_reference === s0.id && pedido.payer_email === f.correo && pedido.reason === "SparkEd · Guías ilimitadas" && ar.transaction_amount === 349 && ar.frequency === 1 && ar.frequency_type === "months" && ar.currency_id === "MXN" && ar.start_date === fin && ms(ar.end_date) > ms(fin) + 365 * DIA && !("card_token_id" in pedido) && String(pedido.back_url ?? "").endsWith("cuenta.html?metodo=" + k.id), "a Mercado Pago se le pide un contrato nuevo de la MISMA suscripción (misma referencia y precio) cuyo primer cobro es el día en que termina lo ya pagado: hoy no se cobra y no se pierden días");
  const s1 = ultimaSus(K);
  ok(s1.estado === "activa" && s1.mp_preapproval_id === A0 && s1.periodo_fin === fin && MP.pre[A0].status === "authorized" && k.estado === "pendiente" && k.inmediato === false && k.estado_al_pedir === "activa" && mensajesA(K) === antes.wa, "mientras la familia no termine en Mercado Pago NADA cambia: sigue activa con su contrato de siempre");
  const otra = await pedirCambio(f.sesion);
  ok(otra.st === 200 && otra.d.url === r.d.url && otra.d.cambio_id === k.id && Object.keys(MP.pre).length === antes.pre + 1 && cambiosDe(K).length === 1, "oprimir el botón otra vez reutiliza el mismo: no se abre otro contrato");
  reloj += 20_000;
  const est = await servidor("GET", "suscripcion/estado", undefined, { sesion: f.sesion });
  const m1 = est.d?.suscripcion?.actual?.metodo;
  ok(est.st === 200 && m1?.cambio?.estado === "pendiente" && m1.cambio.link === r.d.url && m1.cambio.id === k.id && est.d.suscripcion.actual.estado === "activa" && est.d.suscripcion.actual.puede_crear === true && ultimoCambio(K).estado === "pendiente" && MP.pre[A0].status === "authorized", "si abandona a la mitad, «Mi cuenta» le ofrece continuar y todo sigue igual (se le preguntó a Mercado Pago: todavía no pone su tarjeta)");

  // La familia pone su tarjeta nueva en Mercado Pago: cobro mínimo de validación y contrato nuevo autorizado.
  const v = cobrar(B, { monto: 5, tarjeta: T.k2, pagador: f.pagador, cuota: false });
  autorizar(B, { pagador: f.pagador });
  const falso = await avisoMP("subscription_preapproval", B, "clave-de-otro");
  ok(falso.st === 401 && ultimaSus(K).mp_preapproval_id === A0 && MP.pre[A0].status === "authorized" && ultimoCambio(K).estado === "pendiente", "un aviso con firma falsa no cambia nada (el contrato anterior sigue intacto)");
  const [a1, a2] = await Promise.all([avisoMP("subscription_preapproval", B), avisoMP("subscription_preapproval", B)]);
  const a3 = await avisoMP("subscription_preapproval", B);
  const s2 = ultimaSus(K), k2 = ultimoCambio(K), res = [a1, a2, a3].map((x) => String(x.d?.resultado));
  ok([a1, a2, a3].every((x) => x.st === 200) && res.filter((x) => x === "metodo_cambiado").length === 1 && res.every((x) => ["metodo_cambiado", "metodo_ya_cambiado", "cambio_en_curso", "al_dia"].includes(x)), `tres avisos firmados del contrato nuevo (dos a la vez): el cambio se aplica UNA sola vez (${res.join(" / ")})`);
  ok(s2.id === s0.id && s2.estado === "activa" && s2.mp_preapproval_id === B && s2.periodo_fin === fin && s2.proximo_cobro === s0.proximo_cobro && s2.cancelada_en === null && susDe(K).length === 1, "la suscripción es la MISMA (mismo folio y misma fecha de cobro) y sigue activa: no se canceló; solo cambió el contrato con el que cobra Mercado Pago");
  ok(/^cancel/.test(MP.pre[A0].status) && MP.pre[B].status === "authorized" && vivos(K) === 1 && k2.estado === "aplicado" && k2.mp_preapproval_anterior === A0 && !!k2.anterior_cancelado_en && !!k2.aplicado_en, "el contrato anterior se canceló en Mercado Pago DESPUÉS de confirmar el nuevo: queda UN solo contrato con permiso de cobrar");
  const wa = waDe(K, /cambiamos tu método de pago/);
  ok(cobrosDe(K).length === antes.cobros && wa.length === 1 && /sigue igual; no se canceló/.test(wa[0].texto) && /Hoy no se cobró nada/.test(wa[0].texto) && wa[0].texto.includes(`Tu próximo cobro será el *${fechaLarga(fin)}* por $349 MXN`) && /Es normal que Mercado Pago te avise/.test(wa[0].texto), "hoy no se cobró nada, y la familia recibe UN WhatsApp: su suscripción sigue igual y cuándo es su próximo cobro");
  ok(correos.filter((x) => x.to?.[0] === f.correo && /Cambiamos tu método de pago/.test(x.subject)).length === 1 && paraDaniel(/cambió su método de pago/).length === 1, "también UN correo a la familia y UN aviso a Daniel");
  // Mercado Pago avisa que el contrato anterior quedó cancelado: eso NO termina la suscripción.
  const aA = await avisoMP("subscription_preapproval", A0);
  ok(aA.st === 200 && aA.d.resultado === "contrato_anterior_cancelado" && ultimaSus(K).estado === "activa" && ultimaSus(K).mp_preapproval_id === B && ultimaSus(K).mp_estado === "authorized" && waDe(K, /se canceló en Mercado Pago/).length === 0, "el aviso de «contrato anterior cancelado» NO cancela la suscripción (ya cobra con el nuevo)");
  const vv = await avisoMP("payment", v.pago);
  const m2 = await metodoDe(f.sesion);
  ok(vv.d.resultado === "validacion_de_tarjeta" && ultimaSus(K).estado === "activa" && m2.tarjeta === "2222" && m2.cambio?.estado === "aplicado" && !!m2.cambiado_en && m2.puede_cambiar === true && m2.cambio.link === null, "«Mi cuenta» ya dice la tarjeta nueva (terminada en 2222) y cuándo se cambió");
  const usadas = (db.pruebas_usadas ?? []).filter((x) => x.suscripcion_id === s0.id && x.huella_tarjeta);
  ok(usadas.length === 3 && !JSON.stringify(db.pruebas_usadas).includes("2222") && !JSON.stringify(db.pruebas_usadas).includes("422222"), "la tarjeta nueva queda anotada en pruebas_usadas (una prueba gratis por tarjeta), sin sus dígitos");
  // Otra familia, con otro número, intenta su prueba gratis con esa misma tarjeta nueva.
  await admin("POST", "suscripciones/probadores", { agregar: M2 }); reloj += 61_000;
  const sesM = await entrar(M2, "Mora Otra", "mora@correo.com");
  await servidor("POST", "suscripcion/crear", { acepta: true, nombre: "Mora Otra", correo: "mora@correo.com" }, { sesion: sesM });
  const preM = ultimaSus(M2).mp_preapproval_id;
  cobrar(preM, { monto: 5, tarjeta: T.k2, pagador: 9199, cuota: false }); autorizar(preM, { pagador: 9199 });
  const aM = await avisoMP("subscription_preapproval", preM);
  ok(aM.d.resultado === "prueba_negada" && ultimaSus(M2).estado === "abandonada" && ultimaSus(M2).motivo_fin === "prueba_ya_usada", "esa tarjeta ya no sirve para otra prueba gratis con otro número: la regla de una prueba por tarjeta sigue en pie");

  // El día del cobro cobra SOLO el contrato nuevo.
  reloj = ms(fin) + 10 * MIN;
  const prox = iso(masUnMes(ms(fin)));
  const c = cobrar(B, { tarjeta: T.k2, pagador: f.pagador, proximo: prox });
  const rc = await avisoMP("payment", c.pago);
  const s3 = ultimaSus(K);
  ok(rc.d.resultado === "cobrado" && s3.estado === "activa" && s3.periodo_fin === prox && cobrosDe(K, "aprobado").length === 2 && cobrosDe(K).at(-1)!.mp_preapproval_id === B && cobrosDe(K)[0].mp_preapproval_id === A0 && !/cobro doble/.test(s3.revisar_motivo ?? "") && Object.values(MP.cuotas).filter((q: any) => q.preapproval_id === A0).length === 1, "el día del cobro cobra solo el contrato nuevo: un cobro por mes, sin cobro doble (y queda anotado qué contrato hizo cada cobro)");
  const panel = await admin("GET", "suscripciones"), fila = panel.d.suscripciones.find((x: any) => x.id === s0.id) ?? {};
  const una = await admin("GET", `suscripciones/${s0.id}`);
  ok(fila.metodo_pago?.cambios === 1 && fila.metodo_pago.tarjeta === "2222" && fila.metodo_pago.ultimo_cambio_en === k2.aplicado_en && fila.metodo_pago.historial?.length === 1 && fila.metodo_pago.historial[0].fecha === k2.aplicado_en && fila.metodo_pago.historial[0].con_cobro === false && fila.metodo_pago.en_curso === false && fila.metodo_pago.falta_cancelar === 0, "panel: el renglón de la suscripción trae cuántas veces cambió su método de pago, la fecha de cada cambio y la tarjeta de ahora");
  ok(una.st === 200 && una.d.cambios_pago?.length === 1 && una.d.cambios_pago[0].estado === "aplicado" && una.d.cambios_pago[0].anterior_cancelado === true && una.d.metodo_pago?.cambios === 1 && !JSON.stringify(una.d).includes(B) && !JSON.stringify(panel.d).includes(B) && !JSON.stringify(panel.d).includes(K), "y el detalle, cada cambio con lo que pasó (sin identificadores de Mercado Pago ni datos de la familia)");
}

titulo("21. Cambiar el método de pago durante la prueba gratis: sigue la misma prueba (ni se pierde ni se repite)");
const L = "5511120003";
{
  const f = await familiaEnPrueba(L, "Luis Prueba", T.l1);
  const s0 = { ...ultimaSus(L) }, A0 = f.pre, finPrueba = s0.prueba_hasta as string;
  reloj += 2 * DIA;   // van 2 de los 7 días
  const r = await pedirCambio(f.sesion);
  const k = ultimoCambio(L), B = k.mp_preapproval_id as string, ar = MP.pre[B]?.pedido?.auto_recurring ?? {};
  ok(r.st === 200 && r.d.inmediato === false && r.d.primer_cobro_en === finPrueba && ar.start_date === finPrueba && ms(ar.start_date) < reloj + 6 * DIA && ms(ar.start_date) > reloj + 4 * DIA && k.estado_al_pedir === "en_prueba", "el contrato nuevo hará su primer cobro el día en que termina la prueba de siempre: no hay otros 7 días gratis, ni se cobra antes");
  // La tarjeta nueva es una que YA usó una prueba gratis en otra cuenta (la de Ana, al principio de esta prueba).
  const v = cobrar(B, { monto: 5, tarjeta: TARJETA_X, pagador: 9001, cuota: false });
  autorizar(B, { pagador: 9001 });
  const rv = await avisoMP("payment", v.pago);   // llega primero el aviso del cobro mínimo de validación (tema «Pagos»)
  const s1 = ultimaSus(L), k1 = ultimoCambio(L);
  ok(rv.st === 200 && rv.d.resultado === "validacion_de_tarjeta" && s1.estado === "en_prueba" && s1.motivo_fin === null && waDe(L, /ya había usado una/).length === 0, "una tarjeta que ya tuvo su prueba en otra cuenta NO le cancela esta suscripción: la prueba se le dio a la tarjeta con la que se contrató");
  ok(k1.estado === "aplicado" && s1.mp_preapproval_id === B && /^cancel/.test(MP.pre[A0].status) && vivos(L) === 1, "y con ese pago del contrato nuevo el cambio se termina de aplicar (se le preguntó a Mercado Pago), sin esperar otro aviso");
  const ap = await avisoMP("subscription_preapproval", B);
  ok(ap.d.resultado === "al_dia" && s1.prueba_hasta === finPrueba && s1.periodo_fin === finPrueba && s1.proximo_cobro === finPrueba && s1.con_prueba === true && cobrosDe(L).length === 0, "sigue en prueba hasta la MISMA fecha y no se cobró nada");
  const wa = waDe(L, /cambiamos tu método de pago/);
  ok(wa.length === 1 && wa[0].texto.includes(`Tu prueba gratis sigue hasta el *${fechaLarga(finPrueba)}*`) && /Ese día se cobrarán \$349 MXN con tu método de pago nuevo/.test(wa[0].texto), "el aviso dice que su prueba gratis sigue hasta la misma fecha y que ese día se cobra con el método nuevo");
  reloj = ms(finPrueba) + 10 * MIN;
  const rc = await avisoMP("subscription_authorized_payment", cobrar(B, { tarjeta: TARJETA_X, pagador: 9001, proximo: iso(masUnMes(ms(finPrueba))) }).cuota);
  ok(rc.d.resultado === "cobrado" && ultimaSus(L).estado === "activa" && cobrosDe(L).length === 1 && cobrosDe(L)[0].mp_preapproval_id === B && waDe(L, /Tu prueba gratis terminó y cobramos \$349 MXN/).length === 1, "al terminar la prueba cobra el contrato nuevo, una sola vez, y queda activa");
}

titulo("22. Cobro fallido (en gracia): el aviso trae «Cambiar método de pago»; al cambiarlo se cobra ese día y vuelve a activa");
const P = "5511120005";
{
  const f = await familiaEnGracia(P, "Paty Gracia", T.p1);
  const s0 = { ...ultimaSus(P) }, A0 = f.pre;
  const aviso = waDe(P, /No pudimos cobrar tu suscripción de SparkEd\./), correoAviso = correos.filter((x) => x.to?.[0] === f.correo && /No pudimos cobrar/.test(x.subject));
  ok(s0.estado === "en_gracia" && aviso.length === 1 && /¿Quieres cambiar tu método de pago\? Puedes agregar otra tarjeta de crédito o débito aquí, sin cancelar tu suscripción:\n\S+cuenta\.html\?metodo=1/.test(aviso[0].texto) && !/suscríbete de nuevo/.test(aviso[0].texto) && /puedes abrir tus guías, pero no crear guías nuevas/.test(aviso[0].texto), "el WhatsApp de cobro fallido pregunta «¿Quieres cambiar tu método de pago?» y trae el link directo (ya no pide cancelar y suscribirse de nuevo)");
  ok(correoAviso.length === 1 && /cuenta\.html\?metodo=1/.test(correoAviso[0].html) && /¿Quieres cambiar tu método de pago\?/.test(correoAviso[0].html), "el correo de cobro fallido trae el mismo link");
  const m0 = await metodoDe(f.sesion);
  ok(m0.puede_cambiar === true && m0.inmediato === true && m0.tarjeta === "4441" && (await servidor("GET", "cuenta", undefined, { sesion: f.sesion })).d.suscripcion.actual.puede_crear === false, "en gracia «Mi cuenta» ofrece cambiar el método de pago en cualquier momento (y avisa que el cobro se hace ese día)");
  reloj += 9 * DIA;   // noveno día de los 10 de gracia
  const r = await pedirCambio(f.sesion);
  const k = ultimoCambio(P), B = k.mp_preapproval_id as string, ar = MP.pre[B]?.pedido?.auto_recurring ?? {};
  ok(r.st === 200 && r.d.inmediato === true && r.d.primer_cobro_en === null && !("start_date" in ar) && !("end_date" in ar) && ar.transaction_amount === 349 && MP.pre[B].pedido.external_reference === s0.id && k.estado_al_pedir === "en_gracia" && k.inmediato === true, "el contrato nuevo se pide SIN fecha de inicio: Mercado Pago cobra al poner la tarjeta");
  ok(ultimaSus(P).estado === "en_gracia" && ultimaSus(P).mp_preapproval_id === A0 && MP.pre[A0].status === "authorized" && vivos(P) === 1, "si abandona a la mitad, sigue en gracia con su contrato anterior (Mercado Pago lo sigue reintentando)");
  cobrar(B, { monto: 5, tarjeta: T.p2, pagador: f.pagador, cuota: false });
  autorizar(B, { pagador: f.pagador, proximo: iso(reloj + HORA) });
  const a = await avisoMP("subscription_preapproval", B);
  const s1 = ultimaSus(P), k1 = ultimoCambio(P);
  ok(a.d.resultado === "metodo_cambiado" && s1.estado === "en_gracia" && s1.mp_preapproval_id === B && /^cancel/.test(MP.pre[A0].status) && vivos(P) === 1 && k1.estado === "aplicado" && k1.mp_tarjeta === "4442" && s1.mp_tarjeta === "4442", "al terminar en Mercado Pago se cancela el contrato anterior (ya no habrá más reintentos con la tarjeta vieja) y queda solo el nuevo");
  ok(cerca(s1.gracia_hasta, reloj + 3 * DIA) && ms(s1.gracia_hasta) <= ms(s0.gracia_desde) + 13 * DIA && ms(s1.gracia_hasta) > ms(s0.gracia_hasta), "como cambió su tarjeta al final de la gracia, se le dan 3 días para que el cobro pase (no vence al día siguiente)");
  const wa = waDe(P, /cambiamos tu método de pago/);
  ok(wa.length === 1 && /Mercado Pago hará el cobro de \$349 MXN con tu método de pago nuevo en unos minutos/.test(wa[0].texto) && /podrás crear guías nuevas/.test(wa[0].texto), "el aviso dice que Mercado Pago cobrará en unos minutos y que entonces podrá crear guías");
  reloj += 20 * MIN;
  const prox = iso(masUnMes(reloj));
  const rc = await avisoMP("subscription_authorized_payment", cobrar(B, { tarjeta: T.p2, pagador: f.pagador, proximo: prox }).cuota);
  const s2 = ultimaSus(P);
  ok(rc.d.resultado === "cobrado" && s2.estado === "activa" && s2.gracia_hasta === null && s2.periodo_fin === prox && cobrosDe(P, "aprobado").length === 1 && cobrosDe(P, "rechazado").length === 1 && cobrosDe(P, "aprobado")[0].mp_preapproval_id === B && (await servidor("GET", "cuenta", undefined, { sesion: f.sesion })).d.suscripcion.actual.puede_crear === true && waDe(P, /Ya pudimos cobrar tu suscripción \(\$349 MXN\)/).length === 1, "Mercado Pago cobra con la tarjeta nueva: vuelve a activa, ya puede crear guías y hubo UN solo cobro aprobado");
  // Rechazos viejos del contrato anterior que llegan tarde: uno que dice su contrato (por su cuota) y uno que no lo dice.
  const t1 = cobrar(A0, { estado: "rejected", tarjeta: T.p1, pagador: f.pagador });
  const t2 = cobrar(A0, { estado: "rejected", tarjeta: T.p1, pagador: f.pagador, cuota: false });
  MP.pagos[t2.pago].date_created = iso(ms(k1.aplicado_en) - HORA);
  const [rt1, rt2] = [await avisoMP("payment", t1.pago), await avisoMP("payment", t2.pago)];
  ok(rt1.d.resultado === "rechazado_del_contrato_anterior" && rt2.d.resultado === "rechazado_del_contrato_anterior" && ultimaSus(P).estado === "activa" && ultimaSus(P).mp_tarjeta === "4442" && waDe(P, /No pudimos cobrar tu suscripción de SparkEd\./).length === 1, "un rechazo viejo del contrato anterior que llega tarde NO la regresa a gracia, ni repite el aviso, ni cambia la tarjeta que se enseña");
}

titulo("22b. En gracia, recién cambiado el método de pago: se espera el cobro del método nuevo (no se abre otro cambio encima)");
const P2 = "5511120019", P3 = "5511120020";
Object.assign(T, { pe1: ["445001", "4501", 4, 2032], pe2: ["445002", "4502", 5, 2032], pf1: ["445003", "4503", 6, 2032] });
{
  const f = await familiaEnGracia(P2, "Pilar Espera", T.pe1);
  await pedirCambio(f.sesion);
  const B = ultimoCambio(P2).mp_preapproval_id as string;
  autorizar(B, { pagador: f.pagador, proximo: iso(reloj + HORA) });
  await avisoMP("subscription_preapproval", B);
  const m1 = await metodoDe(f.sesion), contratos = Object.keys(MP.pre).length;
  const otra = await pedirCambio(f.sesion);
  ok(ultimaSus(P2).estado === "en_gracia" && ultimaSus(P2).mp_preapproval_id === B && m1.esperando_cobro === true && m1.puede_cambiar === false && otra.st === 409 && otra.d.esperando_cobro === true && /Mercado Pago está haciendo el cobro/.test(otra.d.error) && Object.keys(MP.pre).length === contratos && cambiosDe(P2).length === 1, "recién puesta la tarjeta nueva (con un cobro sin pasar), «Mi cuenta» dice que Mercado Pago está cobrando y no deja abrir otro cambio encima: nunca hay dos contratos cobrando al mismo tiempo");
  // El método nuevo tampoco pasa: se le avisa (una sola vez) y ya puede cambiarlo otra vez.
  reloj += 10 * MIN;
  const rj = await avisoMP("subscription_authorized_payment", cobrar(B, { estado: "rejected", tarjeta: T.pe2, pagador: f.pagador }).cuota);
  const m2 = await metodoDe(f.sesion), tampoco = waDe(P2, /Tampoco pudimos cobrar tu suscripción de SparkEd con tu método de pago nuevo\./);
  ok(rj.d.resultado === "rechazado" && ultimaSus(P2).estado === "en_gracia" && tampoco.length === 1 && /cuenta\.html\?metodo=1/.test(tampoco[0]?.texto ?? "") && m2.esperando_cobro === false && m2.puede_cambiar === true, "si el método de pago nuevo tampoco pasa, la familia recibe el aviso con el link para cambiarlo y «Mi cuenta» se lo vuelve a ofrecer");
  reloj += DIA;
  await avisoMP("subscription_authorized_payment", cobrar(B, { estado: "rejected", tarjeta: T.pe2, pagador: f.pagador }).cuota);
  const r3 = await pedirCambio(f.sesion);
  ok(waDe(P2, /Tampoco pudimos cobrar/).length === 1 && waDe(P2, /No pudimos cobrar tu suscripción de SparkEd\./).length === 1 && r3.st === 200 && r3.d.inmediato === true && cambiosDe(P2).length === 2, "los reintentos rechazados de Mercado Pago no repiten el aviso, y la familia puede cambiar su método de pago otra vez");
  // Si ese cobro nunca llega, a los 90 minutos se deja de esperar.
  const g = await familiaEnGracia(P3, "Pía Tarda", T.pf1);
  await pedirCambio(g.sesion);
  const B3 = ultimoCambio(P3).mp_preapproval_id as string;
  autorizar(B3, { pagador: g.pagador, proximo: iso(reloj + HORA) });
  await avisoMP("subscription_preapproval", B3);
  const antes = (await pedirCambio(g.sesion)).st;
  reloj += 91 * MIN;
  const m3 = await metodoDe(g.sesion), r4 = await pedirCambio(g.sesion);
  ok(antes === 409 && m3.esperando_cobro === false && m3.puede_cambiar === true && r4.st === 200 && cambiosDe(P3).length === 2, "si el cobro del método nuevo no llega en 90 minutos, se puede cambiar otra vez");
}

titulo("23. Sin cobro doble: el reintento de la tarjeta vieja pasa mientras la familia pone la nueva");
const Q = "5511120006";
{
  const f = await familiaEnGracia(Q, "Quique Doble", T.q1);
  const s0 = { ...ultimaSus(Q) }, A0 = f.pre;
  reloj += DIA;
  const r = await pedirCambio(f.sesion);
  const B = ultimoCambio(Q).mp_preapproval_id as string;
  reloj += 5 * MIN;
  const prox = iso(masUnMes(ms(s0.periodo_fin)));
  const rb = await avisoMP("payment", cobrar(A0, { tarjeta: T.q1, pagador: f.pagador, proximo: prox }).pago);
  ok(r.d.inmediato === true && rb.d.resultado === "cobrado" && ultimaSus(Q).estado === "activa" && ultimoCambio(Q).estado === "pendiente" && cobrosDe(Q, "aprobado")[0].mp_preapproval_id === A0, "(mientras la familia está en la página de Mercado Pago, el reintento con la tarjeta de siempre SÍ pasa: ya está activa otra vez)");
  reloj += 2 * MIN;
  cobrar(B, { monto: 5, tarjeta: T.q2, pagador: f.pagador, cuota: false });
  autorizar(B, { pagador: f.pagador, proximo: iso(reloj + HORA) });
  const a = await avisoMP("subscription_preapproval", B);
  const s1 = ultimaSus(Q), k1 = ultimoCambio(Q);
  ok(a.d.resultado === "cambio_descartado" && k1.estado === "descartado" && k1.motivo === "ya_se_cobro" && /^cancel/.test(MP.pre[B].status) && !!k1.nuevo_cancelado_en && MP.pre[A0].status === "authorized" && s1.mp_preapproval_id === A0 && s1.estado === "activa" && s1.periodo_fin === prox && vivos(Q) === 1, "el contrato nuevo iba a cobrar otra vez el mismo mes: se cancela ANTES de que cobre y la suscripción sigue con el de siempre");
  ok(cobrosDe(Q, "aprobado").length === 1 && waDe(Q, /No pudimos cambiar tu método de pago\. El cobro que estaba pendiente ya pasó con tu método de pago de siempre/).length === 1 && waDe(Q, /cambiamos tu método de pago/).length === 0 && !/cobro doble/.test(s1.revisar_motivo ?? ""), "un solo cobro aprobado, y a la familia se le explica por qué no se cambió");
  reloj += 20_000;
  const r2 = await pedirCambio(f.sesion);
  ok(r2.st === 200 && r2.d.inmediato === false && r2.d.primer_cobro_en === prox && ultimoCambio(Q).id !== k1.id && cambiosDe(Q).length === 2, "si todavía quiere cambiarla, lo pide de nuevo: ahora el contrato nuevo cobrará hasta su próxima fecha");
}

titulo("24. Si el aviso del contrato nuevo no llega: basta el aviso de su primer cobro, o que la familia vuelva a su cuenta");
const R = "5511120007", Y1 = "5511120012";
{
  const f = await familiaEnGracia(R, "Rita Aviso", T.r1);
  const A0 = f.pre;
  await pedirCambio(f.sesion);
  const B = ultimoCambio(R).mp_preapproval_id as string;
  autorizar(B, { pagador: f.pagador });   // puso su tarjeta, pero el aviso de «Planes y suscripciones» nunca llega
  reloj += 30 * MIN;
  const prox = iso(masUnMes(reloj));
  const rc = await avisoMP("payment", cobrar(B, { tarjeta: T.r2, pagador: f.pagador, proximo: prox }).pago);   // solo llega el tema «Pagos»
  const s1 = ultimaSus(R), k1 = ultimoCambio(R);
  ok(rc.d.resultado === "cobrado" && s1.estado === "activa" && s1.periodo_fin === prox && s1.mp_preapproval_id === B && k1.estado === "aplicado" && /^cancel/.test(MP.pre[A0].status) && vivos(R) === 1, "el primer cobro del contrato nuevo (aprobado) la deja activa Y termina el cambio: el contrato anterior se cancela en ese momento");
  ok(cobrosDe(R, "aprobado").length === 1 && cobrosDe(R, "aprobado")[0].mp_preapproval_id === B && s1.mp_tarjeta === "6662" && waDe(R, /El cobro de \$349 MXN ya pasó con tu método de pago nuevo/).length === 1 && waDe(R, /Ya pudimos cobrar tu suscripción/).length === 1 && !/cobro doble/.test(s1.revisar_motivo ?? ""), "un solo cobro (el del contrato nuevo), la tarjeta nueva en «Mi cuenta» y el aviso de que el cobro ya pasó");
  // Activa, sin avisos de ningún tipo: la familia regresa a «Mi cuenta» y la página pregunta cómo va.
  const g = await familiaActiva(Y1, "Yael Regresa", T.y1);
  const AY = g.pre, finY = ultimaSus(Y1).periodo_fin;
  reloj += DIA;
  await pedirCambio(g.sesion);
  const BY = ultimoCambio(Y1).mp_preapproval_id as string;
  cobrar(BY, { monto: 5, tarjeta: T.y2, pagador: g.pagador, cuota: false });
  autorizar(BY, { pagador: g.pagador });
  reloj += 20_000;
  const est = await servidor("GET", "suscripcion/estado", undefined, { sesion: g.sesion });
  const sY = ultimaSus(Y1), mY = est.d?.suscripcion?.actual?.metodo;
  ok(est.st === 200 && mY?.cambio?.estado === "aplicado" && mY.tarjeta === "0022" && sY.mp_preapproval_id === BY && sY.estado === "activa" && sY.periodo_fin === finY && /^cancel/.test(MP.pre[AY].status) && vivos(Y1) === 1 && waDe(Y1, /cambiamos tu método de pago/).length === 1, "sin ningún aviso de Mercado Pago: al volver a «Mi cuenta» el servidor le pregunta a Mercado Pago y aplica el cambio");
}

titulo("25. Si Mercado Pago no deja cancelar el contrato anterior, el cambio no se aplica: nunca quedan dos cobrando");
const U = "5511120008";
{
  const f = await familiaActiva(U, "Ulises Terco", T.u1);
  const A0 = f.pre;
  reloj += DIA;
  await pedirCambio(f.sesion);
  const B = ultimoCambio(U).mp_preapproval_id as string;
  autorizar(B, { pagador: f.pagador });
  MP.noCancela.add(A0);
  const a = await avisoMP("subscription_preapproval", B);
  const s1 = ultimaSus(U), k1 = ultimoCambio(U);
  ok(a.st === 200 && a.d.resultado === "cambio_descartado" && k1.estado === "descartado" && k1.motivo === "no_se_pudo_cancelar_el_anterior" && /^cancel/.test(MP.pre[B].status) && MP.pre[A0].status === "authorized" && s1.mp_preapproval_id === A0 && s1.estado === "activa" && vivos(U) === 1 && waDe(U, /No pudimos cambiar tu método de pago\. Mercado Pago no respondió a tiempo\./).length === 1, "si el contrato anterior no se deja cancelar, se cancela el NUEVO y todo queda como estaba (un solo contrato vivo); la familia recibe el aviso para intentarlo de nuevo");
  MP.noCancela.clear(); reloj += 20_000;
  await pedirCambio(f.sesion);
  const B2 = ultimoCambio(U).mp_preapproval_id as string;
  autorizar(B2, { pagador: f.pagador });
  MP.noCancela.add(A0); MP.noCancela.add(B2);
  const reportesAntes = (db.reportes ?? []).length;
  const a2 = await sinRuido(() => avisoMP("subscription_preapproval", B2));
  const s2 = ultimaSus(U);
  ok(a2.st === 500 && ultimoCambio(U).estado === "pendiente" && ultimoCambio(U).aplicando_desde === null && s2.mp_preapproval_id === A0 && s2.estado === "activa" && s2.revisar === true && /quedó a medias/.test(s2.revisar_motivo ?? "") && (db.reportes ?? []).slice(reportesAntes).filter((x) => /quedó a medias/.test(x.comentario)).length === 1, "si Mercado Pago no deja cancelar NINGUNO de los dos, el servidor contesta con error (Mercado Pago repetirá el aviso), la suscripción no cambia y Daniel recibe UN aviso");
  const a2b = await sinRuido(() => avisoMP("subscription_preapproval", B2));
  ok(a2b.st === 500 && (db.reportes ?? []).slice(reportesAntes).filter((x) => /quedó a medias/.test(x.comentario)).length === 1, "el aviso repetido no llena los Reportes de Daniel");
  MP.noCancela.clear();
  const a3 = await avisoMP("subscription_preapproval", B2);
  ok(a3.st === 200 && a3.d.resultado === "metodo_cambiado" && ultimaSus(U).mp_preapproval_id === B2 && /^cancel/.test(MP.pre[A0].status) && vivos(U) === 1, "cuando Mercado Pago vuelve a contestar, el mismo aviso termina el cambio");
}

titulo("26. Fechas: con el cobro encima no se abre un cambio; si la fecha cambió, no se aplica");
const V = "5511120009", W = "5511120010";
{
  const f = await familiaActiva(V, "Vera Cerca", T.v1);
  const fin = ms(ultimaSus(V).periodo_fin);
  reloj = fin - 2 * HORA;
  const antesPre = Object.keys(MP.pre).length;
  const m = await metodoDe(f.sesion), r = await pedirCambio(f.sesion);
  ok(m.puede_cambiar === false && m.cobro_cerca === true && r.st === 409 && r.d.cobro_cerca === true && /Mercado Pago está haciendo tu cobro/.test(r.d.error) && cambiosDe(V).length === 0 && Object.keys(MP.pre).length === antesPre, "a menos de 3 horas del cobro no se abre un cambio: el cobro del contrato anterior y el del nuevo podrían cruzarse");
  reloj = fin + 49 * HORA;
  const r2 = await pedirCambio(f.sesion);
  ok(r2.st === 200 && r2.d.inmediato === true && ultimaSus(V).estado === "en_gracia" && waDe(V, /No pudimos cobrar tu suscripción de SparkEd\./).length === 1, "si el cobro nunca llegó y ya pasaron las 48 horas de espera, cuenta como cobro sin pasar: queda en gracia y el contrato nuevo cobrará al poner la tarjeta");

  const g = await familiaActiva(W, "Wendy Fecha", T.w1);
  const A0 = g.pre, fin1 = ms(ultimaSus(W).periodo_fin);
  reloj = fin1 - 5 * HORA;
  await pedirCambio(g.sesion);
  const B = ultimoCambio(W).mp_preapproval_id as string;
  // La familia deja abierta la página de Mercado Pago; llega el día del cobro y cobra el contrato de siempre…
  reloj = fin1 + 5 * MIN;
  const fin2 = iso(masUnMes(fin1));
  await avisoMP("subscription_authorized_payment", cobrar(A0, { tarjeta: T.w1, pagador: g.pagador, proximo: fin2 }).cuota);
  // …y entonces termina de poner su tarjeta nueva.
  reloj += HORA;
  autorizar(B, { pagador: g.pagador });
  const a = await avisoMP("subscription_preapproval", B);
  const s1 = ultimaSus(W);
  ok(a.d.resultado === "cambio_descartado" && ultimoCambio(W).motivo === "fecha_no_coincide" && /^cancel/.test(MP.pre[B].status) && s1.mp_preapproval_id === A0 && s1.estado === "activa" && s1.periodo_fin === fin2 && cobrosDe(W, "aprobado").length === 2 && vivos(W) === 1 && waDe(W, /Tu fecha de cobro cambió mientras ponías tu tarjeta nueva/).length === 1, "si el contrato de siempre ya cobró ese periodo, el contrato nuevo (que iba a cobrar ese mismo día) se cancela: sin cobro doble");
  reloj += 20_000;
  const r3 = await pedirCambio(g.sesion);
  const B3 = ultimoCambio(W).mp_preapproval_id as string;
  autorizar(B3, { pagador: g.pagador, proximo: iso(reloj + HORA) });   // Mercado Pago dice que cobrará HOY, no el día pedido
  const reportesAntes = (db.reportes ?? []).length;
  const a3 = await avisoMP("subscription_preapproval", B3);
  ok(r3.d.primer_cobro_en === fin2 && a3.d.resultado === "cambio_descartado" && ultimoCambio(W).motivo === "fecha_no_respetada" && /^cancel/.test(MP.pre[B3].status) && ultimaSus(W).mp_preapproval_id === A0 && vivos(W) === 1 && (db.reportes ?? []).slice(reportesAntes).some((x) => /no respetó la fecha del primer cobro en un cambio de método de pago/.test(x.comentario)), "si Mercado Pago fuera a cobrar con el contrato nuevo antes del día pedido, el cambio no se aplica (se cancela el nuevo) y Daniel recibe el aviso");
  let ultimo: any = null;
  for (let i = 0; i < 6; i++) { reloj += 20_000; ultimo = await pedirCambio(g.sesion, { correo_pago: `wendy${i}@correo.com` }); }
  const pendW = cambiosDe(W).filter((x) => x.estado === "pendiente");
  ok(ultimo.st === 429 && /varias veces hoy/.test(ultimo.d.error) && cambiosDe(W).length === 6 && pendW.length === 1 && pendW[0].correo_pago === "wendy3@correo.com" && MP.pre[pendW[0].mp_preapproval_id].pedido.payer_email === "wendy3@correo.com" && MP.pre[pendW[0].mp_preapproval_id].status === "pending" && cuentaDe(W).correo === "wendy@correo.com" && vivos(W) === 1, "freno: 6 cambios por día; al llegar al tope no se abre otro contrato ni se pierde el que ya tenía (y puede poner otro correo de Mercado Pago sin cambiar el de su cuenta)");
}

titulo("26b. Lo que pasa del lado de Mercado Pago mientras se cambia el método de pago");
const Z1 = "5511120013", Z2 = "5511120014", Z3 = "5511120015", Z4 = "5511120016", Z5 = "5511120017", Z6 = "5511120018";
Object.assign(T, { z1: ["410001", "1001", 1, 2031], z2: ["410002", "1002", 2, 2031], z3: ["410003", "1003", 3, 2031], z4: ["410004", "1004", 4, 2031], z5: ["410005", "1005", 5, 2031], z5b: ["410006", "1006", 6, 2031], z6: ["410007", "1007", 7, 2031] });
{
  // (1) Con un cambio a medias, la familia cancela su contrato de siempre desde su cuenta de Mercado Pago.
  const f = await familiaActiva(Z1, "Zoe Cancela", T.z1);
  const A1 = f.pre, fin1 = ultimaSus(Z1).periodo_fin;
  reloj += DIA;
  await pedirCambio(f.sesion);
  const B1 = ultimoCambio(Z1).mp_preapproval_id as string;
  MP.pre[A1].status = "cancelled";
  const a1 = await avisoMP("subscription_preapproval", A1);
  const s1 = ultimaSus(Z1);
  ok(a1.d.resultado === "cancelada" && s1.estado === "cancelada" && s1.cancelada_por === "mercadopago" && s1.periodo_fin === fin1 && ultimoCambio(Z1).estado === "descartado" && ultimoCambio(Z1).motivo === "suscripcion_terminada" && /^cancel/.test(MP.pre[B1].status) && vivos(Z1) === 0, "si el contrato de siempre se cancela en Mercado Pago y la tarjeta nueva todavía no está puesta, la suscripción queda cancelada (conserva su periodo) y el cambio a medias se descarta");
  // (2) Lo mismo, pero ya había puesto su tarjeta nueva: la suscripción sigue con el contrato nuevo.
  const g = await familiaActiva(Z2, "Zara Sigue", T.z2);
  const A2 = g.pre, fin2 = ultimaSus(Z2).periodo_fin;
  reloj += DIA;
  await pedirCambio(g.sesion);
  const B2 = ultimoCambio(Z2).mp_preapproval_id as string;
  autorizar(B2, { pagador: g.pagador });
  MP.pre[A2].status = "cancelled";
  const a2 = await avisoMP("subscription_preapproval", A2);
  const s2 = ultimaSus(Z2);
  ok(a2.d.resultado === "metodo_cambiado" && s2.estado === "activa" && s2.mp_preapproval_id === B2 && s2.periodo_fin === fin2 && ultimoCambio(Z2).estado === "aplicado" && vivos(Z2) === 1 && waDe(Z2, /se canceló en Mercado Pago/).length === 0, "si el contrato de siempre aparece cancelado y el nuevo ya está autorizado, la suscripción NO se cancela: sigue con el contrato nuevo");
  // (3) El servidor se corta justo después de cancelar el contrato anterior y antes de terminar el cambio.
  const h = await familiaActiva(Z3, "Zoila Corte", T.z3);
  const A3 = h.pre;
  reloj += DIA;
  await pedirCambio(h.sesion);
  const k3 = ultimoCambio(Z3), B3 = k3.mp_preapproval_id as string;
  autorizar(B3, { pagador: h.pagador });
  Object.assign(k3, { aplicando_desde: ahoraIso(), mp_preapproval_anterior: A3 }); MP.pre[A3].status = "cancelled";
  const a3 = await avisoMP("subscription_preapproval", A3);   // el aviso de «contrato anterior cancelado» llega enseguida
  ok(a3.d.resultado === "cambio_en_curso" && ultimaSus(Z3).estado === "activa" && ultimaSus(Z3).mp_preapproval_id === A3 && waDe(Z3, /se canceló en Mercado Pago/).length === 0, "mientras un cambio se está aplicando, el aviso de «contrato anterior cancelado» NO cancela la suscripción");
  reloj += 2 * MIN;
  const a3b = await avisoMP("subscription_preapproval", B3);
  ok(a3b.d.resultado === "metodo_cambiado" && ultimaSus(Z3).mp_preapproval_id === B3 && ultimaSus(Z3).estado === "activa" && ultimoCambio(Z3).estado === "aplicado" && !!ultimoCambio(Z3).anterior_cancelado_en && vivos(Z3) === 1, "y si el servidor se cortó a la mitad (con el contrato anterior ya cancelado), el siguiente aviso termina el cambio: la familia no se queda sin contrato");
  // (4) El contrato nuevo de un cambio descartado que Mercado Pago no deja cancelar: se reintenta hasta que quede cancelado.
  const j = await familiaActiva(Z6, "Zulma Suelto", T.z6);
  const A6 = j.pre;
  reloj += DIA;
  await pedirCambio(j.sesion);
  const B6 = ultimoCambio(Z6).mp_preapproval_id as string;
  autorizar(B6, { pagador: j.pagador, proximo: iso(reloj + HORA) });   // Mercado Pago no respeta la fecha: el cambio se descarta
  MP.noCancela.add(B6);
  const a6 = await avisoMP("subscription_preapproval", B6);
  const fila6 = (await admin("GET", "suscripciones")).d.suscripciones.find((x: any) => x.id === ultimaSus(Z6).id) ?? {};
  ok(a6.d.resultado === "cambio_descartado" && ultimoCambio(Z6).estado === "descartado" && ultimoCambio(Z6).nuevo_cancelado_en === null && vivos(Z6) === 2 && ultimaSus(Z6).mp_preapproval_id === A6 && ultimaSus(Z6).revisar === true && /su contrato nuevo no se pudo cancelar/.test(ultimaSus(Z6).revisar_motivo ?? "") && fila6.metodo_pago?.falta_cancelar === 1, "si el contrato nuevo de un cambio descartado no se deja cancelar, queda la bandera para Daniel (el panel dice que falta cancelarlo)");
  MP.noCancela.clear(); reloj += 20_000;
  await servidor("GET", "suscripcion/estado", undefined, { sesion: j.sesion });
  ok(/^cancel/.test(MP.pre[B6].status) && !!ultimoCambio(Z6).nuevo_cancelado_en && vivos(Z6) === 1 && MP.pre[A6].status === "authorized", "y se reintenta solo (al volver la familia a su cuenta, o en la revisión diaria) hasta que queda cancelado: un solo contrato vivo");
}

titulo("26c. Si de todos modos hubiera un cobro doble, Daniel lo sabe");
{
  const f = await familiaActiva(Z5, "Zuri Doble", T.z5);
  const A0 = f.pre, fin = ultimaSus(Z5).periodo_fin as string;
  reloj += DIA;
  await pedirCambio(f.sesion);
  const B = ultimoCambio(Z5).mp_preapproval_id as string;
  autorizar(B, { pagador: f.pagador });
  await avisoMP("subscription_preapproval", B);
  reloj = ms(fin) + 5 * MIN;
  const reportesAntes = (db.reportes ?? []).length;
  // Un cobro del contrato anterior (que ya estaba cancelado: no debería pasar) y, enseguida, el cobro normal del nuevo.
  const r1 = await avisoMP("subscription_authorized_payment", cobrar(A0, { tarjeta: T.z5, pagador: f.pagador }).cuota);
  const s1 = ultimaSus(Z5);
  ok(r1.d.resultado === "cobrado" && s1.estado === "activa" && s1.mp_preapproval_id === B && /del contrato anterior, después de cambiar el método de pago/.test(s1.revisar_motivo ?? "") && (db.reportes ?? []).slice(reportesAntes).some((x) => /cobro de \$349 MXN del contrato anterior/.test(x.comentario)) && /^cancel/.test(MP.pre[A0].status), "si el contrato anterior llegara a cobrar después del cambio, el mes pagado se conserva, se vuelve a pedir su cancelación y Daniel recibe el aviso para reembolsar");
  const pagadaHasta = s1.periodo_fin;
  const r2 = await avisoMP("subscription_authorized_payment", cobrar(B, { tarjeta: T.z5b, pagador: f.pagador, proximo: iso(masUnMes(ms(fin))) }).cuota);
  const s2 = ultimaSus(Z5);
  ok(r2.d.resultado === "cobrado" && s2.periodo_fin === pagadaHasta && /Dos cobros aprobados con menos de 15 días de diferencia/.test(s2.revisar_motivo ?? "") && (db.reportes ?? []).slice(reportesAntes).some((x) => /dos cobros aprobados con menos de 15 días/.test(x.comentario)) && paraDaniel(/posible cobro doble/).length === 1 && cobrosDe(Z5, "aprobado").length === 3 && s2.mp_tarjeta === "1006", "y con dos cobros aprobados el mismo mes, Daniel recibe el aviso de posible cobro doble (el periodo no se alarga dos veces)");
  // Con una familia en gracia y un cambio a medias: si se acaba la gracia, vence y no queda ningún contrato vivo.
  const g = await familiaEnGracia(Z4, "Zenón Vence", T.z4);
  await pedirCambio(g.sesion);
  const B4 = ultimoCambio(Z4).mp_preapproval_id as string;
  reloj = ms(ultimaSus(Z4).gracia_hasta) + HORA;
  await admin("POST", "suscripciones/diario", {});
  ok(ultimaSus(Z4).estado === "vencida" && ultimoCambio(Z4).estado === "descartado" && /^cancel/.test(MP.pre[B4].status) && /^cancel/.test(MP.pre[g.pre].status) && vivos(Z4) === 0, "si se acaba la gracia sin pagar, la suscripción vence y el cambio a medias se descarta: los dos contratos quedan cancelados");
}

titulo("26d. Si nadie avisó de que la tarjeta nueva ya estaba puesta, el día del cobro no se quedan cobrando los dos contratos");
const N1 = "5511120021", N2 = "5511120022", N3 = "5511120023", N4 = "5511120024";
Object.assign(T, { n1: ["420001", "2101", 1, 2033], n2: ["420002", "2201", 2, 2033], n2b: ["420003", "2202", 3, 2033], n3: ["420004", "2301", 4, 2033], n4: ["420005", "2401", 5, 2033] });
{
  // La familia terminó en Mercado Pago, pero cerró la página y el aviso de Mercado Pago nunca llegó: el servidor no sabe
  // que el contrato nuevo ya está autorizado, y los dos contratos tienen fecha de cobro el mismo día.
  const sinAviso = async (tel: string, nombre: string, tarjeta: Tarjeta) => {
    const f = await familiaActiva(tel, nombre, tarjeta);
    const A = f.pre, fin = ultimaSus(tel).periodo_fin as string;
    reloj += DIA;
    await pedirCambio(f.sesion);
    const B = ultimoCambio(tel).mp_preapproval_id as string;
    autorizar(B, { pagador: f.pagador });
    reloj = ms(fin) + 5 * MIN;   // llega el día del cobro
    return { ...f, A, B, fin };
  };
  // (1) Cobra primero el contrato de siempre: el nuevo se descarta y se cancela en ese momento, antes de que cobre.
  const f = await sinAviso(N1, "Nora Calla", T.n1);
  const rA = await avisoMP("subscription_authorized_payment", cobrar(f.A, { tarjeta: T.n1, pagador: f.pagador, proximo: iso(masUnMes(ms(f.fin))) }).cuota);
  ok(ultimoCambio(N1).mp_estado !== "authorized" || ultimoCambio(N1).estado !== "pendiente", "(el servidor no sabía que el contrato nuevo ya estaba autorizado)");
  ok(rA.d.resultado === "cobrado" && ultimaSus(N1).estado === "activa" && ultimaSus(N1).mp_preapproval_id === f.A && ultimoCambio(N1).estado === "descartado" && ultimoCambio(N1).motivo === "fecha_no_coincide" && /^cancel/.test(MP.pre[f.B].status) && MP.pre[f.A].status === "authorized" && vivos(N1) === 1 && cobrosDe(N1, "aprobado").length === 2 && waDe(N1, /No pudimos cambiar tu método de pago/).length === 1, "al cobrar el contrato de siempre se revisa el cambio a medias: el contrato nuevo (que nadie avisó) se cancela antes de que cobre el mismo mes, y la familia recibe el aviso");
  // (2) Cobra primero el contrato NUEVO (llega el aviso de su pago): se sigue con él y el de siempre se cancela ahí mismo.
  const g = await sinAviso(N2, "Noel Calla", T.n2);
  const rB = await avisoMP("payment", cobrar(g.B, { tarjeta: T.n2b, pagador: g.pagador, proximo: iso(masUnMes(ms(g.fin))) }).pago);
  const s2 = ultimaSus(N2);
  ok(rB.d.resultado === "cobrado" && s2.estado === "activa" && s2.mp_preapproval_id === g.B && /^cancel/.test(MP.pre[g.A].status) && vivos(N2) === 1 && ultimoCambio(N2).estado === "aplicado" && cerca(s2.periodo_fin, masUnMes(ms(g.fin)), DIA) && cobrosDe(N2, "aprobado").length === 2 && s2.mp_tarjeta === "2202" && waDe(N2, /cambiamos tu método de pago/).length === 1 && waDe(N2, /No pudimos cambiar/).length === 0, "al cobrar el contrato nuevo se termina el cambio en ese momento: el contrato de siempre se cancela antes de que cobre el mismo mes (UN cobro, con la tarjeta nueva)");
  // …y si el contrato de siempre alcanzó a cobrar también, Daniel recibe el aviso de cobro doble (lo pagado de más se conserva hasta que él lo revise).
  const rA2 = await avisoMP("subscription_authorized_payment", cobrar(g.A, { tarjeta: T.n2, pagador: g.pagador }).cuota);
  ok(rA2.d.resultado === "cobrado" && ms(ultimaSus(N2).periodo_fin) >= ms(s2.periodo_fin) && ultimaSus(N2).mp_preapproval_id === g.B && vivos(N2) === 1 && /del contrato anterior, después de cambiar el método de pago/.test(ultimaSus(N2).revisar_motivo ?? "") && paraDaniel(/posible cobro doble/).length >= 1, "si aun así el contrato anterior alcanzó a cobrar, queda la bandera y el aviso a Daniel para reembolsar");
  // (3) El cobro del contrato de siempre NO pasa: el nuevo se descarta; queda en gracia y ahí puede cambiar su método de pago.
  const h = await sinAviso(N3, "Nuria Calla", T.n3);
  const rR = await avisoMP("subscription_authorized_payment", cobrar(h.A, { estado: "rejected", tarjeta: T.n3, pagador: h.pagador }).cuota);
  const m3 = await metodoDe(h.sesion);
  ok(rR.d.resultado === "rechazado" && ultimaSus(N3).estado === "en_gracia" && ultimaSus(N3).mp_preapproval_id === h.A && ultimoCambio(N3).estado === "descartado" && /^cancel/.test(MP.pre[h.B].status) && vivos(N3) === 1 && m3.puede_cambiar === true && m3.inmediato === true && waDe(N3, /No pudimos cobrar tu suscripción de SparkEd\./).length === 1, "si el cobro del contrato de siempre no pasa, el contrato nuevo que nadie avisó también se cancela (no cobra por su cuenta): queda en gracia y «Mi cuenta» le ofrece cambiar su método de pago");
  // (4) Con el cambio todavía sin terminar en Mercado Pago (lo pidió unas horas antes y nunca puso su tarjeta), el cobro de siempre pasa y no se toca nada.
  const j = await familiaActiva(N4, "Néstor Calla", T.n4);
  const fin4 = ultimaSus(N4).periodo_fin as string;
  reloj = ms(fin4) - 5 * HORA;
  await pedirCambio(j.sesion);
  const B4 = ultimoCambio(N4).mp_preapproval_id as string;
  reloj = ms(fin4) + 5 * MIN;
  const r4 = await avisoMP("subscription_authorized_payment", cobrar(j.pre, { tarjeta: T.n4, pagador: j.pagador, proximo: iso(masUnMes(ms(fin4))) }).cuota);
  ok(r4.d.resultado === "cobrado" && ultimaSus(N4).estado === "activa" && ultimaSus(N4).mp_preapproval_id === j.pre && ultimoCambio(N4).estado === "pendiente" && MP.pre[B4].status === "pending" && vivos(N4) === 1 && waDe(N4, /No pudimos cambiar/).length === 0, "si la familia nunca terminó en Mercado Pago, el cobro de siempre pasa normal y el cambio a medias sigue a medias (sin avisos de más)");
  // …y si después sí pone su tarjeta, ese cambio ya no vale (su fecha era la del cobro que ya pasó): se descarta y se le avisa.
  autorizar(B4, { pagador: j.pagador });
  const r4b = await avisoMP("subscription_preapproval", B4);
  ok(r4b.d.resultado === "cambio_descartado" && ultimoCambio(N4).motivo === "fecha_no_coincide" && /^cancel/.test(MP.pre[B4].status) && ultimaSus(N4).mp_preapproval_id === j.pre && vivos(N4) === 1 && cobrosDe(N4, "aprobado").length === 2 && waDe(N4, /No pudimos cambiar tu método de pago/).length === 1, "y si termina en Mercado Pago después de ese cobro, el cambio ya no se aplica (cobraría el mismo mes otra vez): se cancela y se le avisa");
}

titulo("27. Abandonar a la mitad, cancelar con un cambio a medias y la limpieza diaria");
const X1 = "5511120011";
{
  const f = await familiaActiva(X1, "Ximena Deja", T.x1);
  const s0 = { ...ultimaSus(X1) }, A0 = f.pre;
  reloj += DIA;
  await pedirCambio(f.sesion);
  const B = ultimoCambio(X1).mp_preapproval_id as string, antesWa = mensajesA(X1);
  reloj += 20 * HORA;
  await admin("POST", "suscripciones/diario", {});
  ok(ultimoCambio(X1).estado === "pendiente" && MP.pre[B].status === "pending", "la revisión diaria no toca un cambio de menos de un día (la familia todavía puede terminar)");
  reloj += 5 * HORA;
  const d2 = await admin("POST", "suscripciones/diario", {});
  const s1 = ultimaSus(X1);
  ok(d2.st === 200 && d2.d.cambios_descartados >= 1 && ultimoCambio(X1).estado === "descartado" && ultimoCambio(X1).motivo === "sin_terminar" && /^cancel/.test(MP.pre[B].status) && s1.estado === "activa" && s1.mp_preapproval_id === A0 && MP.pre[A0].status === "authorized" && s1.periodo_fin === s0.periodo_fin && mensajesA(X1) === antesWa, "el cambio que nadie terminó en un día se descarta (su link deja de servir) sin tocar la suscripción ni molestar a la familia");
  // Apagada para todos: quien ya tiene suscripción puede seguir cambiando su tarjeta (igual que puede cancelar).
  await admin("POST", "config", { sparked_suscripcion: "no" }); reloj += 61_000;
  const r = await pedirCambio(f.sesion);
  const B2 = ultimoCambio(X1).mp_preapproval_id as string;
  ok(r.st === 200 && r.d.modo === "mercadopago" && ultimoCambio(X1).estado === "pendiente", "con la suscripción apagada para el público, quien ya la tiene puede cambiar su método de pago");
  const c = await servidor("POST", "suscripcion/cancelar", {}, { sesion: f.sesion });
  ok(c.d.estado === "cancelada" && ultimoCambio(X1).estado === "descartado" && ultimoCambio(X1).motivo === "suscripcion_terminada" && /^cancel/.test(MP.pre[B2].status) && /^cancel/.test(MP.pre[A0].status) && vivos(X1) === 0, "si cancela su suscripción con un cambio a medias, también se cancela el contrato nuevo: no queda nada que pueda cobrar");
  MP.pre[B2].status = "authorized";   // como si alguien terminara ese link viejo
  const a = await avisoMP("subscription_preapproval", B2);
  ok(a.d.resultado === "contrato_cancelado" && /^cancel/.test(MP.pre[B2].status) && ultimaSus(X1).estado === "cancelada" && vivos(X1) === 0, "un contrato descartado que Mercado Pago reportara vivo se cancela otra vez: no puede cobrar");
  ok((await pedirCambio(f.sesion)).st === 409, "una suscripción cancelada ya no tiene método de pago que cambiar");
}

titulo("28. Cuenta de prueba: el cambio de método de pago también se simula, sin tocar Mercado Pago ni mandar nada");
{
  const NUM = "0007654321";
  const cod = await servidor("POST", "cuenta/codigo", { telefono: NUM, simular: true }, { admin: true });
  const ent = await servidor("POST", "cuenta/entrar", { telefono: NUM, codigo: cod.d?.codigo });
  const ses = ent.d?.sesion ?? "", cta = db.cuentas.find((c) => c.telefono === "+52" + NUM)!;
  const antes = { mp: MP.llamadas.length, wa: whatsapps.length, correo: correos.length };
  await servidor("POST", "suscripcion/crear", { acepta: true, nombre: "Prueba", correo: "prueba@sparked.invalid" }, { sesion: ses, admin: true });
  const sus = db.suscripciones.find((x) => x.cuenta_id === cta.id)!;
  const p = (cuerpo: unknown) => admin("POST", `suscripciones/${sus.id}/prueba`, cuerpo);
  await p({ accion: "preapproval", datos: { status: "authorized", next_payment_date: sus.primer_cobro_en, payer_id: 778 }, pagos: [] });
  const A0 = sus.mp_preapproval_id, fin = sus.periodo_fin;
  ok((await p({ accion: "preapproval", contrato: "nuevo", datos: { status: "authorized" } })).st === 400, "(sin un cambio pedido no hay contrato nuevo que simular)");
  const r = await pedirCambio(ses);
  const k = (db.suscripcion_cambios_pago ?? []).find((x) => x.suscripcion_id === sus.id)!;
  ok(sus.estado === "en_prueba" && r.st === 200 && r.d.modo === "simulada" && r.d.inmediato === false && r.d.primer_cobro_en === fin && k.de_prueba === true && /^prueba-/.test(k.mp_preapproval_id) && k.mp_preapproval_id !== A0, "una cuenta de prueba pide el cambio y se le arma un contrato simulado (el primer cobro, el día en que termina su prueba)");
  const a = await p({ accion: "preapproval", contrato: "nuevo", datos: { status: "authorized", next_payment_date: k.primer_cobro_en, payer_id: 778, payment_method_id: "master" }, pagos: [{ id: "v-1", transaction_amount: 5, date_created: ahoraIso(), card: { first_six_digits: "433334", last_four_digits: "3334", expiration_month: 3, expiration_year: 2031 }, payer: { id: 778 } }] });
  ok(a.st === 200 && a.d.resultado === "metodo_cambiado" && a.d.suscripcion.mp_preapproval_id === k.mp_preapproval_id && a.d.suscripcion.estado === "en_prueba" && a.d.suscripcion.periodo_fin === fin && a.d.suscripcion.mp_tarjeta === "3334" && a.d.suscripcion.mp_medio === "master" && k.estado === "aplicado" && k.mp_preapproval_anterior === A0, "el aviso simulado de «tarjeta nueva autorizada» pasa por el mismo código de verdad: misma suscripción, misma fecha, contrato nuevo");
  const rep = await p({ accion: "preapproval", contrato: "nuevo", datos: { status: "authorized", next_payment_date: k.primer_cobro_en } });
  const viejo = await p({ accion: "preapproval", contrato: "anterior", datos: { status: "cancelled" } });
  ok(rep.d.resultado === "al_dia" && viejo.d.resultado === "contrato_anterior_cancelado" && viejo.d.suscripcion.estado === "en_prueba", "repetir el aviso no cambia nada, y el aviso de «contrato anterior cancelado» no cancela la suscripción");
  ok(MP.llamadas.length === antes.mp && whatsapps.length === antes.wa && correos.length === antes.correo, "en todo el cambio simulado no salió ni una llamada a Mercado Pago, ni un WhatsApp, ni un correo");
  const fila = (await admin("GET", "suscripciones")).d.suscripciones.find((x: any) => x.id === sus.id);
  ok(fila?.metodo_pago?.cambios === 1 && fila.metodo_pago.tarjeta === "3334" && fila.de_prueba === true, "el panel enseña el cambio en la suscripción de prueba");
  const borrar = await admin("DELETE", `cuentas/${cta.id}`);
  ok(borrar.st === 200 && !(db.suscripcion_cambios_pago ?? []).some((x) => x.suscripcion_id === sus.id) && !db.suscripciones.some((x) => x.cuenta_id === cta.id), "la cuenta de prueba se borra con sus cambios de método de pago");
  const textoPanel = JSON.stringify((await admin("GET", "suscripciones")).d);
  ok([K, M2, L, P, Q, R, Y1, U, V, W, X1].every((t) => !textoPanel.includes(t)) && !/@correo\.com/.test(textoPanel.replace(/•••@correo\.com/g, "")), "y en el panel siguen sin salir completos ni un WhatsApp ni un correo");
}

titulo("28b. Cuenta de prueba: el mismo recorrido de la prueba en vivo (activa sin cobro; cobro fallido → método nuevo → activa)");
{
  const NUM = "0007654322", PG = 779;
  const cod = await servidor("POST", "cuenta/codigo", { telefono: NUM, simular: true }, { admin: true });
  const ses = (await servidor("POST", "cuenta/entrar", { telefono: NUM, codigo: cod.d?.codigo })).d?.sesion ?? "";
  const cta = db.cuentas.find((c) => c.telefono === "+52" + NUM)!;
  const antes = { mp: MP.llamadas.length, wa: whatsapps.length, correo: correos.length };
  const act = async () => (await servidor("GET", "cuenta", undefined, { sesion: ses })).d?.suscripcion?.actual ?? null;
  const p = (id: string, cuerpo: unknown) => admin("POST", `suscripciones/${id}/prueba`, cuerpo);
  const cobrosDeSus = (id: string, estado?: string) => (db.suscripcion_cobros ?? []).filter((x) => x.suscripcion_id === id && (!estado || x.estado === estado));
  const rechazo = (id: string) => ({ id, status: "rejected", status_detail: "cc_rejected_insufficient_amount", transaction_amount: 349, currency_id: "MXN", payment_type_id: "credit_card" });
  const aprobado = (id: string) => ({ id, status: "approved", status_detail: "accredited", transaction_amount: 349, currency_id: "MXN", payment_type_id: "credit_card", date_approved: ahoraIso() });
  // Activa: cambia su método de pago sin cancelar y sin cobro.
  const alta = await servidor("POST", "suscripcion/crear", { acepta: true, nombre: "Prueba", correo: "prueba@sparked.invalid" }, { sesion: ses, admin: true });
  const id1 = alta.d.suscripcion_id as string;
  await p(id1, { accion: "preapproval", datos: { status: "authorized", next_payment_date: alta.d.primer_cobro_en, payer_id: PG, payment_method_id: "visa" }, pagos: [] });
  await p(id1, { accion: "pago", pago: aprobado("vivo-1") });
  const a0 = await act();
  const c1 = await pedirCambio(ses), c2 = await pedirCambio(ses), aMitad = await act();
  const apl = await p(id1, { accion: "preapproval", contrato: "nuevo", datos: { status: "authorized", next_payment_date: a0.periodo_fin, payer_id: PG, payment_method_id: "master" }, pagos: [] });
  const a1 = await act(), det = (await admin("GET", `suscripciones/${id1}`)).d;
  ok(a0.estado === "activa" && a0.metodo.puede_cambiar === true && a0.metodo.inmediato === false && a0.metodo.cambio === null && c1.st === 200 && c1.d.modo === "simulada" && c1.d.inmediato === false && c1.d.primer_cobro_en === a0.periodo_fin && c2.d.cambio_id === c1.d.cambio_id && aMitad.estado === "activa" && aMitad.periodo_fin === a0.periodo_fin && aMitad.metodo.cambio.estado === "pendiente", "(en vivo 4b) activa: pedir el cambio abre un contrato simulado para el día en que termina lo pagado; repetirlo lo reutiliza y, a la mitad, todo sigue igual");
  ok(apl.d.resultado === "metodo_cambiado" && a1.estado === "activa" && a1.id === a0.id && a1.folio === a0.folio && a1.periodo_fin === a0.periodo_fin && cerca(a1.proximo_cobro, ms(a0.proximo_cobro)) && a1.puede_crear === true && a1.metodo.cambio.estado === "aplicado" && !!a1.metodo.cambiado_en && a1.metodo.medio === "master" && det.cobros.length === 1 && det.metodo_pago.cambios === 1 && !JSON.stringify(det).includes("prueba-"), "(en vivo 4b) al autorizarse la tarjeta nueva: misma suscripción, mismo periodo y mismo próximo cobro; ningún cobro; el panel cuenta 1 cambio y no enseña identificadores de Mercado Pago");
  const rep = await p(id1, { accion: "preapproval", contrato: "nuevo", datos: { status: "authorized", next_payment_date: a0.periodo_fin, payer_id: PG }, pagos: [] });
  const viejo = await p(id1, { accion: "preapproval", contrato: "anterior", datos: { status: "cancelled" }, pagos: [] });
  const fila = (await admin("GET", "suscripciones")).d.suscripciones.find((x: any) => x.id === id1);
  ok(["al_dia", "metodo_ya_cambiado"].includes(rep.d.resultado) && viejo.d.resultado === "contrato_anterior_cancelado" && (await act()).estado === "activa" && fila.metodo_pago.cambios === 1 && fila.metodo_pago.historial.length === 1 && !!fila.metodo_pago.ultimo_cambio_en && fila.metodo_pago.en_curso === false && fila.metodo_pago.falta_cancelar === 0, "(en vivo 4b) el aviso repetido y el de «contrato anterior cancelado» no cambian nada; el panel enseña el cambio con su fecha");
  // El cobro del mes siguiente no pasa: gracia normal (no «esperando el cobro del método nuevo»), y luego vence.
  reloj += 2 * MIN;
  const malo = await p(id1, { accion: "pago", pago: rechazo("vivo-malo") });
  const a4 = await act();
  ok(malo.d.resultado === "rechazado" && a4.estado === "en_gracia" && a4.metodo.puede_cambiar === true && a4.metodo.inmediato === true && a4.metodo.esperando_cobro === false, "(en vivo 5) un cobro que no pasa poco después de un cambio hecho al corriente es un cobro fallido normal: «Mi cuenta» ofrece cambiar el método de pago");
  const d4 = await admin("POST", "suscripciones/diario", { fecha: iso(reloj + 10 * DIA + HORA) });
  ok(d4.d.vencidas === 1 && (await act()).estado === "vencida", "(en vivo 5) pasados los 10 días de gracia queda vencida");
  // Segunda suscripción (sin prueba): el primer cobro no pasa → cambia su método de pago → se cobra con el nuevo.
  const alta2 = await servidor("POST", "suscripcion/crear", { acepta: true }, { sesion: ses, admin: true });
  const id2 = alta2.d.suscripcion_id as string;
  const aut2 = await p(id2, { accion: "preapproval", datos: { status: "authorized", payer_id: PG }, pagos: [] });
  const malo6 = await p(id2, { accion: "pago", pago: rechazo("vivo-malo6") });
  const g6 = await act();
  ok(alta2.d.con_prueba === false && aut2.d.resultado === "esperando_primer_cobro" && malo6.d.resultado === "rechazado" && g6.estado === "en_gracia" && g6.puede_crear === false && g6.metodo.puede_cambiar === true && g6.metodo.inmediato === true, "(en vivo 6) sin prueba gratis, el primer cobro no pasa: queda en gracia y puede cambiar su método de pago");
  const cg = await pedirCambio(ses), sinTocar = await act();
  const aplG = await p(id2, { accion: "preapproval", contrato: "nuevo", datos: { status: "authorized", payer_id: PG, payment_method_id: "debvisa" }, pagos: [] });
  const esperando = await act(), otro = await pedirCambio(ses);
  ok(cg.st === 200 && cg.d.inmediato === true && cg.d.primer_cobro_en === null && sinTocar.estado === "en_gracia" && sinTocar.metodo.cambio.estado === "pendiente" && aplG.d.resultado === "metodo_cambiado" && esperando.estado === "en_gracia" && esperando.id === g6.id && esperando.metodo.esperando_cobro === true && esperando.metodo.puede_cambiar === false && otro.st === 409 && otro.d.esperando_cobro === true, "(en vivo 6) el cambio se pide sin fecha de inicio; al autorizarse queda esperando el cobro del método nuevo y no deja abrir otro encima");
  const k5 = await p(id2, { accion: "pago", contrato: "nuevo", pago: aprobado("vivo-2") });
  const a7 = await act(), det6 = (await admin("GET", `suscripciones/${id2}`)).d;
  ok(k5.d.resultado === "cobrado" && a7.estado === "activa" && a7.puede_crear === true && cerca(a7.periodo_fin, masUnMes(reloj), DIA) && a7.metodo.esperando_cobro === false && det6.cobros.filter((x: any) => x.estado === "aprobado").length === 1 && det6.metodo_pago.cambios === 1 && cobrosDeSus(id2, "aprobado").length === 1, "(en vivo 6) Mercado Pago cobra con el método nuevo: activa por un mes, con UN solo cobro aprobado");
  ok(MP.llamadas.length === antes.mp && whatsapps.length === antes.wa && correos.length === antes.correo, "y en todo el recorrido no salió ni una llamada a Mercado Pago, ni un WhatsApp, ni un correo");
  await admin("DELETE", `cuentas/${cta.id}`);
  ok(!db.suscripciones.some((x) => x.cuenta_id === cta.id) && !(db.suscripcion_cambios_pago ?? []).some((x) => x.suscripcion_id === id1 || x.suscripcion_id === id2), "la cuenta de prueba se borra con sus dos suscripciones y sus cambios");
}

console.log(`\n${fallas ? `${fallas} de ${total} comprobaciones FALLARON` : `${total} de ${total} comprobaciones bien.`}`);
process.exit(fallas ? 1 : 0);
