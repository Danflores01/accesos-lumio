// Candado contra el fallo del 10 nov 2026: un módulo aparte se quedó con una ruta que no era suya.
//
// En funciones/sparked/index.ts los módulos aparte (acceso.ts, extras.ts, whatsapp.ts) se ejecutan ANTES que las rutas
// principales. Si un módulo responde algo en una ruta ajena, la ruta de verdad nunca se ejecuta. Así pasó con
// POST /acceso/<clave de la familia> (la que abre una guía pagada): acceso.ts respondía «Ruta no encontrada» y ninguna
// familia pudo abrir su guía durante unas horas.
//
// Esta prueba revisa, sin Supabase ni internet, que cada módulo devuelva null (o sea, «no es mía») en todas las rutas
// que atiende index.ts, y que siga atendiendo las suyas.
//
//   node herramientas/probar-rutas.mjs        (Node 22 o más nuevo; desde la raíz del repositorio)
//
// Hay que correrla antes de CADA despliegue de la función. Si se agrega una ruta a index.ts, se agrega aquí.
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ENV = { SUPABASE_URL: "https://demo.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "llave-de-prueba" };
globalThis.Deno = { env: { get: (k) => ENV[k] } };
const traer = (f) => import(pathToFileURL(path.join(REPO, "funciones/sparked", f)).href);
const [{ rutasAcceso }, { rutasExtras }, { rutasWhatsApp }] = await Promise.all([traer("acceso.ts"), traer("extras.ts"), traer("whatsapp.ts")]);
const MODULOS = { "acceso.ts": rutasAcceso, "extras.ts": rutasExtras, "whatsapp.ts": rutasWhatsApp };

// En una ruta ajena un módulo no debe tocar nada: ni la base de datos, ni internet, ni preguntar quién es.
const tocado = [];
const prohibido = (que) => new Proxy(function () {}, { get: (_o, k) => (k === "then" ? undefined : (tocado.push(`${que}.${String(k)}`), prohibido(que))), apply: () => (tocado.push(que + "()"), prohibido(que)) });
globalThis.fetch = async (u) => { tocado.push("internet: " + String(u).slice(0, 60)); return new Response("{}", { status: 500 }); };
function contexto(m, ruta, cuerpo) {
  const req = new Request("https://demo.supabase.co/functions/v1/sparked/" + ruta.join("/"), { method: m, body: cuerpo && m !== "GET" ? JSON.stringify(cuerpo) : undefined });
  const json = (b, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
  return {
    req, m, ruta, json, error: (msg, s = 400) => json({ error: msg }, s), leerJson: async (r) => { try { return await r.json(); } catch { return {}; } },
    esAdmin: async () => { tocado.push("esAdmin"); return false; }, conClave: async () => { tocado.push("conClave"); return false; }, ip: null,
    supabase: prohibido("supabase"), config: async () => { tocado.push("config"); return {}; }, sitio: async () => "https://sparkeducation-mx.com/sparked/", ahora: () => new Date().toISOString(),
    mandarCorreo: async () => { tocado.push("correo"); }, avisarDaniel: async () => { tocado.push("aviso"); }, enSegundoPlano: () => { tocado.push("segundo plano"); },
  };
}

// Claves de familia con todas las formas posibles (8 a 64 letras y números), incluidas las que se parecen a las rutas
// del panel: «entrar», «renovar» y «salir» nunca pueden ser claves (son más cortas), pero estas sí.
const CLAVES = ["79wcZFJkApbHbw", "a1B2c3D4", "entrar1234", "renovar99", "salir0000", "ENTRARENTRAR", "x".repeat(64), "0123456789abcdefABCDEF"];
const UUID = "93470423-3ffa-4ade-a48c-c8f0929f02ed", CLAVE_BORRADOR = "AbCdEfGhIjKlMnOpQrStUv12";
// Todas las rutas que atiende index.ts (método y partes de la dirección después de /sparked).
const DE_INDEX = [
  ...CLAVES.flatMap((k) => [["POST", ["acceso", k]], ["GET", ["acceso", k, "estado"]], ["POST", ["progreso", k]]]),
  ["GET", ["vista-previa", UUID]], ["POST", ["borrador"]], ["GET", ["borrador", CLAVE_BORRADOR]], ["POST", ["borrador", CLAVE_BORRADOR, "generar"]],
  ["POST", ["pago", "crear"]], ["GET", ["pago", "estado", UUID]], ["POST", ["pago", "reintentar", UUID]], ["POST", ["pago", "mercadopago"]], ["POST", ["pago", "webhook"]],
  ["POST", ["reporte"]], ["GET", ["datos-curiosos"]], ["GET", ["colegios"]], ["POST", ["buscar"]], ["POST", ["solicitud"]],
  ["POST", ["trabajo", UUID, "paso"]], ["GET", ["trabajo", UUID]],
  ["GET", ["admin", "ping"]], ["GET", ["admin", "resumen"]], ["GET", ["admin", "compras"]], ["POST", ["admin", "compras", UUID, "pagar"]], ["POST", ["admin", "compras", UUID, "revisar"]],
  ["GET", ["admin", "codigos"]], ["POST", ["admin", "codigos"]], ["PATCH", ["admin", "codigos", UUID]], ["GET", ["admin", "reportes"]], ["PATCH", ["admin", "reportes", UUID]],
  ["GET", ["admin", "config"]], ["POST", ["admin", "config"]], ["POST", ["admin", "limpiar"]], ["POST", ["admin", "trabajos", UUID, "reintentar"]], ["GET", ["admin", "guias"]],
];

let fallas = 0, total = 0;
const revisar = async (nombre, fn) => { total++; try { await fn(); } catch (e) { fallas++; console.log("FALLA", nombre, "\n      ", e.message); return; } };

for (const [nombre, modulo] of Object.entries(MODULOS)) {
  for (const [m, ruta] of DE_INDEX) {
    await revisar(`${nombre} deja pasar ${m} /${ruta.join("/")}`, async () => {
      tocado.length = 0;
      const r = await modulo(contexto(m, ruta, { dispositivo: "x" }));
      assert.equal(r, null, `${nombre} respondió ${r?.status} en ${m} /${ruta.join("/")}, que es una ruta de index.ts: ${r ? await r.text() : ""}`);
      assert.deepEqual(tocado, [], `${nombre} tocó ${tocado.join(", ")} en ${m} /${ruta.join("/")}, que no es su ruta`);
    });
  }
}
console.log(`${fallas ? "FALLA" : "ok   "} ningún módulo se queda con rutas de index.ts (${Object.keys(MODULOS).length} módulos × ${DE_INDEX.length} rutas)`);

// Y cada módulo sigue atendiendo lo suyo.
const estado = async (modulo, m, ruta, cuerpo) => (await modulo(contexto(m, ruta, cuerpo)))?.status ?? null;
await revisar("acceso.ts atiende sus tres rutas", async () => {
  assert.equal(await estado(rutasAcceso, "POST", ["acceso", "entrar"], { correo: "no-es-correo", contrasena: "x" }), 401);
  assert.equal(await estado(rutasAcceso, "POST", ["acceso", "renovar"], { renovar: "" }), 401);
  assert.equal(await estado(rutasAcceso, "POST", ["acceso", "salir"]), 200);
  assert.equal(await estado(rutasAcceso, "GET", ["acceso", "entrar"]), 404);
  assert.equal(await estado(rutasAcceso, "GET", ["admin", "acceso"]), 401);
  assert.equal(await estado(rutasAcceso, "POST", ["acceso", "entrar", "algo"]), null);
  assert.equal(await estado(rutasAcceso, "POST", ["acceso"]), null);
});
await revisar("extras.ts y whatsapp.ts atienden lo suyo", async () => {
  assert.equal(await estado(rutasExtras, "GET", ["comentarios"]), 405);
  assert.equal(await estado(rutasExtras, "GET", ["admin", "comentarios"]), 401);
  assert.equal(await estado(rutasExtras, "GET", ["admin", "costos"]), 401);
  assert.equal(await estado(rutasExtras, "DELETE", ["admin", "codigos", UUID]), 401);
  assert.equal(await estado(rutasWhatsApp, "GET", ["publico"]), 200);
  assert.equal(await estado(rutasWhatsApp, "POST", ["whatsapp", "webhook"]), 200);
  assert.equal(await estado(rutasWhatsApp, "GET", ["admin", "whatsapp"]), 401);
  assert.equal(await estado(rutasWhatsApp, "GET", ["admin", "whatsapp", "chats"]), 401);
});
console.log(`${fallas ? "FALLA" : "ok   "} cada módulo sigue atendiendo sus propias rutas`);

console.log(fallas ? `\n${fallas} de ${total} comprobaciones fallaron: NO DESPLEGAR` : `\n${total} comprobaciones bien`);
process.exit(fallas ? 1 : 0);
