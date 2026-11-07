// Prueba, sin llaves, del cobro con Mercado Pago de la función sparked (funciones/sparked/index.ts).
// Uso: node herramientas/probar-mercadopago.ts   (Node 23.6 o más nuevo: corre TypeScript sin compilar)
//
// Toma del código real las funciones firmaMPValida, metodoMP, procesarPagoMP y avisoMercadoPago, les pone una base de
// datos y una API de Mercado Pago de juguete y revisa: la firma de los avisos (con vectores calculados aparte con
// node:crypto), que el aviso rechace firmas malas con 401, que un pago pendiente de OXXO quede anotado y que un pago
// aprobado entregue la guía una sola vez aunque el aviso llegue repetido o dos veces al mismo tiempo.
import { createHmac } from "node:crypto";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
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
  i = fuente.indexOf("{", i);
  let llaves = 0, j = i;
  for (; j < fuente.length; j++) { if (fuente[j] === "{") llaves++; else if (fuente[j] === "}" && --llaves === 0) break; }
  return fuente.slice(inicio, j + 1);
}
const lineaDe = (patron: RegExp) => { const m = fuente.match(patron); if (!m) throw new Error("No encontré " + patron); return m[0]; };

// ---------- Juguetes: variables de entorno, base de datos y API de Mercado Pago ----------
const env: Record<string, string | undefined> = {};
type Fila = Record<string, any>;
const db: Record<string, Fila[]> = { compras: [] };
function consulta(tabla: string) {
  const filtros: ((f: Fila) => boolean)[] = [];
  let cambios: Fila | null = null, columnas: string | null = null;
  const filas = () => (db[tabla] ?? []).filter((f) => filtros.every((p) => p(f)));
  const q: any = {
    select(c?: string) { columnas = c ?? "*"; return q; },
    update(c: Fila) { cambios = c; return q; },
    eq(k: string, v: unknown) { filtros.push((f) => f[k] === v); return q; },
    neq(k: string, v: unknown) { filtros.push((f) => f[k] !== v); return q; },
    in(k: string, vs: unknown[]) { filtros.push((f) => vs.includes(f[k])); return q; },
    async maybeSingle() { await null; const r = filas(); return { data: r[0] ? { ...r[0] } : null, error: null }; },
    then(ok: any, mal: any) {
      return Promise.resolve().then(() => {
        const r = filas();
        if (cambios) for (const f of r) Object.assign(f, cambios);
        return { data: columnas ? r.map((f) => ({ ...f })) : null, error: null };
      }).then(ok, mal);
    },
  };
  return q;
}
const pagos: Record<string, any> = {};
const confirmados: string[] = [];
Object.assign(globalThis as any, {
  __env: env,
  __supabase: { from: consulta },
  __mp: async (ruta: string) => {
    const busqueda = ruta.match(/^\/v1\/payments\/search\?external_reference=([^&]+)/);
    if (busqueda) return { ok: true, status: 200, datos: { results: Object.values(pagos).filter((p) => p.external_reference === decodeURIComponent(busqueda[1])).sort((a, b) => b.id - a.id) } };
    const m = ruta.match(/^\/v1\/payments\/(\d+)$/);
    const p = m ? pagos[m[1]] : null;
    return p ? { ok: true, status: 200, datos: p } : { ok: false, status: 404, datos: { message: "not_found" } };
  },
  __confirmar: async (id: string) => { confirmados.push(id); return {}; },
});

const modulo = `
const env = globalThis.__env;
const Deno = { env: { get: (k: string) => env[k] } };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const error = (mensaje: string, status = 400) => json({ error: mensaje }, status);
async function leerJson(req: Request): Promise<Record<string, any>> { try { return (await req.json()) ?? {}; } catch { return {}; } }
const ahora = () => new Date().toISOString();
const esUuid = (u: unknown): u is string => typeof u === "string" && /^[0-9a-f-]{36}$/i.test(u);
const mpToken = () => env.MP_ACCESS_TOKEN ?? "";
const mp = (ruta: string, op?: unknown) => globalThis.__mp(ruta, op);
const confirmarPago = (id: string) => globalThis.__confirmar(id);
const supabase = globalThis.__supabase;
${lineaDe(/const MP_VIVOS = [^;]*;/)}
${extraer("firmaMPValida")}
${extraer("metodoMP")}
${extraer("procesarPagoMP")}
${extraer("avisoMercadoPago")}
${extraer("revisarCompraMP")}
export { firmaMPValida, metodoMP, procesarPagoMP, avisoMercadoPago, revisarCompraMP };
`;
const carpeta = mkdtempSync(join(tmpdir(), "sparked-mp-"));
const archivo = join(carpeta, "modulo.ts");
writeFileSync(archivo, modulo);
const { firmaMPValida, metodoMP, avisoMercadoPago, revisarCompraMP } = await import(pathToFileURL(archivo).href);
rmSync(carpeta, { recursive: true, force: true });

let fallas = 0;
function revisa(bien: boolean, texto: string) { console.log((bien ? "  ✓ " : "  ✗ ") + texto); if (!bien) fallas++; }

// ---------- 1. Firma: vectores calculados aparte con node:crypto (como el ejemplo oficial en Node) ----------
console.log("1. Firma x-signature");
const secreto = "clave-secreta-de-prueba-sparked";
const hmac = (manifiesto: string, clave = secreto) => createHmac("sha256", clave).update(manifiesto).digest("hex");
const ts = "1742505638683", rid = "bb56a2f1-6aae-46ac-982e-9dcd3581d08e", id = "123456";
const manifiesto = `id:${id};request-id:${rid};ts:${ts};`;
const v1 = hmac(manifiesto);
console.log(`  vector: clave "${secreto}", manifiesto "${manifiesto}" → v1=${v1}`);
revisa(await firmaMPValida(secreto, `ts=${ts},v1=${v1}`, rid, id), "firma correcta → válida");
revisa(await firmaMPValida(secreto, `ts=${ts}, v1=${v1.toUpperCase()}`, rid, id), "con espacio y en mayúsculas → válida");
revisa(!(await firmaMPValida("otra-clave", `ts=${ts},v1=${v1}`, rid, id)), "clave secreta equivocada → no válida");
revisa(!(await firmaMPValida(secreto, `ts=${Number(ts) + 1},v1=${v1}`, rid, id)), "ts alterado → no válida");
revisa(!(await firmaMPValida(secreto, `ts=${ts},v1=${v1}`, rid, "123457")), "otro número de pago → no válida");
revisa(!(await firmaMPValida(secreto, `ts=${ts},v1=${v1}`, "otro-request-id", id)), "otro x-request-id → no válida");
revisa(!(await firmaMPValida(secreto, `ts=${ts}`, rid, id)), "sin v1 → no válida");
revisa(!(await firmaMPValida(secreto, null, rid, id)), "sin cabecera → no válida");
revisa(!(await firmaMPValida("", `ts=${ts},v1=${v1}`, rid, id)), "sin clave secreta → no válida");
const conLetras = "ORD01JQ4S4KY8HWQ6NA5PXB65B3D3";
revisa(await firmaMPValida(secreto, `ts=${ts},v1=${hmac(`id:${conLetras.toLowerCase()};request-id:${rid};ts:${ts};`)}`, rid, conLetras), "data.id con letras va en minúsculas → válida");
revisa(await firmaMPValida(secreto, `ts=${ts},v1=${hmac(`id:${id};ts:${ts};`)}`, null, id), "sin x-request-id se quita del manifiesto → válida");

// ---------- 2. Método de pago en palabras del sitio ----------
console.log("2. Método de pago");
revisa(metodoMP({ payment_type_id: "credit_card", payment_method_id: "visa" }) === "tarjeta", "tarjeta de crédito → tarjeta");
revisa(metodoMP({ payment_type_id: "debit_card", payment_method_id: "debmaster" }) === "tarjeta", "tarjeta de débito → tarjeta");
revisa(metodoMP({ payment_type_id: "ticket", payment_method_id: "oxxo" }) === "oxxo", "ticket oxxo → oxxo");
revisa(metodoMP({ payment_type_id: "bank_transfer", payment_method_id: "clabe" }) === "spei", "bank_transfer clabe → spei");
revisa(metodoMP({ payment_type_id: "account_money", payment_method_id: "account_money" }) === "mercadopago", "saldo de Mercado Pago → mercadopago");

// ---------- 3. Aviso de pago completo (POST /pago/mercadopago) ----------
console.log("3. Aviso de pago");
const BASE = "https://wfqfqfsbkqbaejnkhidz.supabase.co/functions/v1/sparked/pago/mercadopago";
async function aviso(query: string, cabeceras: Record<string, string> = {}, cuerpo: unknown = {}) {
  const url = new URL(BASE + query);
  const req = new Request(url, { method: "POST", headers: { "content-type": "application/json", ...cabeceras }, body: JSON.stringify(cuerpo) });
  const r = await avisoMercadoPago(req, url);
  return { status: r.status as number, datos: await r.json() as any };
}
let n = 0;
const firmado = (pagoId: string, clave = secreto) => { const t = String(1762500000000 + ++n), r = `req-${n}`; return { "x-signature": `ts=${t},v1=${hmac(`id:${pagoId};request-id:${r};ts:${t};`, clave)}`, "x-request-id": r }; };
const pagoCuerpo = (pagoId: string) => ({ action: "payment.updated", api_version: "v1", data: { id: pagoId }, type: "payment", live_mode: false });
env.MP_WEBHOOK_SECRET = secreto; env.MP_ACCESS_TOKEN = "APP_USR-solo-para-la-prueba";
const C1 = "11111111-1111-4111-8111-111111111111", C2 = "22222222-2222-4222-8222-222222222222", C3 = "33333333-3333-4333-8333-333333333333";
db.compras.push({ id: C1, estado: "pendiente", monto_mxn: 100 }, { id: C2, estado: "pendiente", monto_mxn: 100 }, { id: C3, estado: "fallida", monto_mxn: 100 });
pagos["9001"] = { id: 9001, status: "pending", status_detail: "pending_waiting_payment", payment_type_id: "ticket", payment_method_id: "oxxo", external_reference: C1, transaction_amount: 100, currency_id: "MXN", date_of_expiration: "2026-11-10T18:00:00.000-06:00", transaction_details: { external_resource_url: "https://www.mercadopago.com.mx/payments/9001/ticket" } };
pagos["9002"] = { id: 9002, status: "rejected", payment_type_id: "credit_card", payment_method_id: "visa", external_reference: C1, transaction_amount: 100, currency_id: "MXN" };
pagos["9003"] = { id: 9003, status: "approved", payment_type_id: "ticket", payment_method_id: "oxxo", external_reference: C1, transaction_amount: 100, currency_id: "MXN" };
pagos["9004"] = { id: 9004, status: "approved", payment_type_id: "credit_card", payment_method_id: "master", external_reference: C2, transaction_amount: 1, currency_id: "MXN" };
pagos["9005"] = { id: 9005, status: "approved", payment_type_id: "bank_transfer", payment_method_id: "clabe", external_reference: C3, transaction_amount: 100, currency_id: "MXN" };
const compra = (cid: string) => db.compras.find((c) => c.id === cid)!;

let r = await aviso("?data.id=9003&type=payment", {}, pagoCuerpo("9003"));
revisa(r.status === 401, `sin firma → 401 (${r.status})`);
r = await aviso("?data.id=9003&type=payment", { "x-signature": "hola", "x-request-id": "x" }, pagoCuerpo("9003"));
revisa(r.status === 401, `firma con formato raro → 401 (${r.status})`);
r = await aviso("?data.id=9003&type=payment", firmado("9003", "clave-de-otro"), pagoCuerpo("9003"));
revisa(r.status === 401 && compra(C1).estado === "pendiente" && !confirmados.length, `firma hecha con otra clave → 401 y la compra no cambia (${r.status})`);
const robado = firmado("9001");
r = await aviso("?data.id=9003&type=payment", robado, pagoCuerpo("9003"));
revisa(r.status === 401 && compra(C1).estado === "pendiente", `firma válida de otro pago reusada → 401 (${r.status})`);
r = await aviso("?topic=payment&id=9003");
revisa(r.status === 200 && r.datos.ignorado === "ipn" && compra(C1).estado === "pendiente", "aviso viejo (IPN) sin firma validable → 200 sin tocar nada");
r = await aviso("?data.id=9001&type=payment", firmado("9001"), pagoCuerpo("9001"));
const c1 = compra(C1);
revisa(r.status === 200 && c1.estado === "pendiente" && c1.metodo_pago === "oxxo" && c1.mp_estado === "pending" && !!c1.mp_ficha_url && !!c1.mp_vence_en, `OXXO pendiente → 200, la compra sigue pendiente con método oxxo, ficha y fecha límite (${r.datos.resultado})`);
r = await aviso("?data.id=9002&type=payment", firmado("9002"), pagoCuerpo("9002"));
revisa(r.status === 200 && compra(C1).metodo_pago === "oxxo" && compra(C1).mp_estado === "pending", `tarjeta rechazada después de la ficha → no tapa la ficha de OXXO (${r.datos.resultado})`);
r = await aviso("?data.id=7777&type=payment", firmado("7777"), pagoCuerpo("7777"));
revisa(r.status === 200 && r.datos.ignorado === "pago_inexistente", "pago que no existe (prueba «Simular» del panel) → 200 ignorado");
r = await aviso("?data.id=555&type=merchant_order", firmado("555"), { type: "merchant_order", data: { id: "555" } });
revisa(r.status === 200 && r.datos.ignorado === "merchant_order", "otro tema (merchant_order) con firma válida → 200 ignorado");
const [a, b] = await Promise.all([aviso("?data.id=9003&type=payment", firmado("9003"), pagoCuerpo("9003")), aviso("?data.id=9003&type=payment", firmado("9003"), pagoCuerpo("9003"))]);
revisa(a.status === 200 && b.status === 200 && compra(C1).estado === "pagada" && confirmados.filter((x) => x === C1).length === 1, `dos avisos de pago aprobado al mismo tiempo → se entrega una sola vez (${a.datos.resultado} / ${b.datos.resultado})`);
r = await aviso("?data.id=9003&type=payment", firmado("9003"), pagoCuerpo("9003"));
revisa(r.status === 200 && r.datos.resultado === "ya_pagada" && confirmados.filter((x) => x === C1).length === 1, "el mismo aviso otra vez → ya_pagada, no se repite la entrega");
r = await aviso("?data.id=9004&type=payment", firmado("9004"), pagoCuerpo("9004"));
revisa(r.status === 200 && compra(C2).estado === "pendiente" && compra(C2).mp_estado === "revisar_monto" && !confirmados.includes(C2), `pago aprobado por menos dinero → no se entrega, queda para revisar (${r.datos.resultado})`);
r = await aviso("?data.id=9005&type=payment", firmado("9005"), pagoCuerpo("9005"));
revisa(r.status === 200 && compra(C3).estado === "pagada" && confirmados.includes(C3) && compra(C3).metodo_pago === "spei", `compra cancelada en el panel que sí se pagó por SPEI → se entrega (${r.datos.resultado})`);
pagos["9003"] = { ...pagos["9003"], status: "refunded" };
r = await aviso("?data.id=9003&type=payment", firmado("9003"), pagoCuerpo("9003"));
revisa(compra(C1).estado === "pagada" && compra(C1).mp_estado === "refunded" && confirmados.filter((x) => x === C1).length === 1, "reembolso del mismo pago → se anota refunded, nada más");
delete env.MP_WEBHOOK_SECRET;
r = await aviso("?data.id=9003&type=payment", firmado("9003"), pagoCuerpo("9003"));
revisa(r.status === 503, `sin MP_WEBHOOK_SECRET → 503, Mercado Pago reintenta más tarde (${r.status})`);
r = await aviso("?data.id=9003&type=payment", {}, pagoCuerpo("9003"));
revisa(r.status === 401, `sin MP_WEBHOOK_SECRET y sin firma → 401 (${r.status})`);

// ---------- 4. Revisión directa (cuando el aviso tarda): GET /pago/estado y botón del panel ----------
console.log("4. Revisión directa en Mercado Pago");
const C4 = "44444444-4444-4444-8444-444444444444";
db.compras.push({ id: C4, estado: "pendiente", monto_mxn: 100 });
revisa(await revisarCompraMP(C4) === null, "sin pagos todavía → nada que hacer");
pagos["9010"] = { id: 9010, status: "rejected", payment_type_id: "credit_card", payment_method_id: "visa", external_reference: C4, transaction_amount: 100, currency_id: "MXN" };
pagos["9011"] = { id: 9011, status: "pending", payment_type_id: "bank_transfer", payment_method_id: "clabe", external_reference: C4, transaction_amount: 100, currency_id: "MXN", date_of_expiration: "2026-11-10T18:00:00.000-06:00" };
let res = await revisarCompraMP(C4, "9010");
revisa(res === "pending" && compra(C4).metodo_pago === "spei" && compra(C4).estado === "pendiente", `tarjeta rechazada en la dirección pero hay SPEI pendiente → se anota SPEI (${res})`);
pagos["9012"] = { id: 9012, status: "approved", payment_type_id: "bank_transfer", payment_method_id: "clabe", external_reference: C4, transaction_amount: 100, currency_id: "MXN" };
res = await revisarCompraMP(C4, "9010");
revisa(res === "pagada" && compra(C4).estado === "pagada" && confirmados.filter((x) => x === C4).length === 1, `la búsqueda encuentra el pago aprobado → se entrega (${res})`);
res = await revisarCompraMP(C4, "9012");
revisa(res === "ya_pagada" && confirmados.filter((x) => x === C4).length === 1, `revisar otra vez → ya_pagada, sin repetir (${res})`);

console.log(fallas ? `\n${fallas} prueba(s) fallaron` : "\nTodo bien");
process.exit(fallas ? 1 : 0);
