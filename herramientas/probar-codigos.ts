// Prueba, sin base de datos real, de los códigos de descuento y del avance de la entrega en dos tiempos de la función
// sparked (funciones/sparked/index.ts).
// Uso: node herramientas/probar-codigos.ts   (Node 23.6 o más nuevo: corre TypeScript sin compilar)
//
// Toma del código real las funciones de los códigos (revisarCodigo, usarCodigo, entregarConCodigo, contarUsoCodigo…)
// y avanceDeGuia, les pone una base de datos de juguete y revisa: mayúsculas y espacios, precio con descuento, motivos
// por los que un código no sirve, el tope de 5 intentos fallidos por hora, que un código gratis entregue la guía una
// sola vez y gaste un solo uso, y que una guía cuyo trabajo falló diga "revisando" en vez de "generando" para siempre.
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
  i = fuente.indexOf(" {" + String.fromCharCode(10), i) + 1; // el cuerpo abre al final de la línea (el tipo de retorno puede traer llaves)
  let llaves = 0, j = i;
  for (; j < fuente.length; j++) { if (fuente[j] === "{") llaves++; else if (fuente[j] === "}" && --llaves === 0) break; }
  return fuente.slice(inicio, j + 1);
}
const linea = (nombre: string) => { const m = fuente.match(new RegExp(`^(const|type) ${nombre} =.*$`, "m")); if (!m) throw new Error("No encontré " + nombre); return m[0]; };

// ---------- Base de datos de juguete (solo lo que usan estas funciones) ----------
type Fila = Record<string, any>;
const db: Record<string, Fila[]> = { codigos: [], codigo_intentos: [], compras: [], trabajos: [] };
function consulta(tabla: string) {
  const filtros: ((f: Fila) => boolean)[] = [];
  let modo = "select", cambios: Fila | null = null, nueva: Fila | null = null, cuenta = false, conDatos = false;
  const filas = () => (db[tabla] ?? []).filter((f) => filtros.every((p) => p(f)));
  const valor = (s: string) => s.replace(/^"|"$/g, "");
  const q: any = {
    select(_c?: string, op?: { count?: string; head?: boolean }) { if (op?.head) cuenta = true; conDatos = true; return q; },
    insert(f: Fila) { modo = "insert"; nueva = f; return q; },
    update(c: Fila) { modo = "update"; cambios = c; return q; },
    eq(k: string, v: unknown) { filtros.push((f) => f[k] === v); return q; },
    in(k: string, vs: unknown[]) { filtros.push((f) => vs.includes(f[k])); return q; },
    is(k: string, v: null) { filtros.push((f) => (f[k] ?? null) === v); return q; },
    gte(k: string, v: string) { filtros.push((f) => String(f[k]) >= v); return q; },
    not(k: string, op: string, v: any) {
      if (op === "is") filtros.push((f) => (f[k] ?? null) !== null);
      else if (op === "in") { const lista = String(v).replace(/[()]/g, "").split(","); filtros.push((f) => !lista.includes(f[k])); }
      return q;
    },
    or(expr: string) {
      const partes = expr.split(/,(?=\w+\.eq\.)/).map((p) => { const [k, , ...r] = p.split("."); return [k, valor(r.join("."))]; });
      filtros.push((f) => partes.some(([k, v]) => String(f[k] ?? "") === v)); return q;
    },
    order() { return q; }, limit() { return q; },
    async maybeSingle() { await null; const r = filas(); return { data: r[0] ? { ...r[0] } : null, error: null }; },
    then(ok: any, mal: any) {
      return Promise.resolve().then(() => {
        if (modo === "insert") { (db[tabla] ??= []).push({ id: "i" + (db[tabla].length + 1), creado_en: new Date().toISOString(), ...nueva }); return { data: null, error: null }; }
        if (modo === "update") { const r = filas(); for (const f of r) Object.assign(f, cambios); return { data: conDatos ? r.map((f) => ({ ...f })) : null, error: null }; }
        const r = filas(); return cuenta ? { count: r.length, data: null, error: null } : { data: r.map((f) => ({ ...f })), error: null };
      }).then(ok, mal);
    },
  };
  return q;
}
const supabase = {
  from: consulta,
  // Lo mismo que la función SQL sparked_usar_codigo de la migración.
  async rpc(_n: string, p: { p_codigo: string; p_forzar: boolean; p_delta: number }) {
    await null;
    const c = db.codigos.find((x) => x.codigo === p.p_codigo);
    const sirve = c && (p.p_forzar || p.p_delta < 0 || (c.activo && (!c.expira_en || new Date(c.expira_en) > new Date()) && (c.usos_max === null || c.usos < c.usos_max)));
    if (!sirve) return { data: [], error: null };
    c.usos = Math.max(0, c.usos + p.p_delta); return { data: [{ ...c }], error: null };
  },
};
let confirmados: string[] = [];
const contexto = {
  supabase, ahora: () => new Date().toISOString(),
  json: (cuerpo: unknown, status = 200) => ({ status, cuerpo }),
  error: (mensaje: string, status = 400) => ({ status, cuerpo: { error: mensaje } }),
  sitio: async () => "https://sitio/sparked/",
  confirmarPago: async (id: string) => { confirmados.push(id); },
  reanudarSiAtorado: async () => {},
};

const nombres = ["CODIGO_NO_VALIDO", "CODIGO_INTENTOS_MAX", "MSG_REVISANDO", "Codigo", "Quien", "normalizarCodigo", "formatoCodigo", "redondear", "comillas"];
const funciones = ["motivoCodigo", "precioConCodigo", "anotarIntento", "revisarCodigo", "usarCodigo", "contarUsoCodigo", "entregarConCodigo", "avanceDeGuia"];
const modulo = [
  "const { supabase, ahora, json, error, sitio, confirmarPago, reanudarSiAtorado } = (globalThis as any).__ctx;",
  ...nombres.map(linea), ...funciones.map(extraer),
  `export { ${nombres.filter((n) => !["Codigo", "Quien"].includes(n)).concat(funciones).join(", ")} };`,
].join("\n");
const dir = mkdtempSync(join(tmpdir(), "probar-codigos-"));
writeFileSync(join(dir, "codigos.ts"), modulo);
(globalThis as any).__ctx = contexto;
const M: any = await import(pathToFileURL(join(dir, "codigos.ts")).href);
rmSync(dir, { recursive: true, force: true });

let fallas = 0, total = 0;
const ok = (cond: boolean, que: string) => { total++; if (!cond) { fallas++; console.log("✗ " + que); } else console.log("✓ " + que); };
const hace = (min: number) => new Date(Date.now() - min * 60_000).toISOString();

// ---------- Formato y precio ----------
ok(M.normalizarCodigo("  prueba 2026 ") === "PRUEBA2026", "el código se compara en mayúsculas y sin espacios");
ok(M.formatoCodigo("SPARK-7KQ2") && !M.formatoCodigo("AB") && !M.formatoCodigo("A;B--DROP"), "solo letras, números y guiones (3 a 40)");
ok(M.precioConCodigo(50, { tipo: "gratis", valor: 100 }) === 0, "código gratis: precio 0");
ok(M.precioConCodigo(50, { tipo: "porcentaje", valor: 15 }) === 42.5, "15 % de descuento sobre 50 = 42.50");
ok(M.precioConCodigo(100, { tipo: "porcentaje", valor: 100 }) === 0, "descuento de 100 % = gratis");
const base = { id: "c0", codigo: "X", tipo: "gratis", valor: 100, usos: 0, usos_max: 1, activo: true, expira_en: null };
ok(M.motivoCodigo(null) === "no_existe" && M.motivoCodigo({ ...base, activo: false }) === "apagado" && M.motivoCodigo({ ...base, expira_en: hace(1) }) === "vencido" && M.motivoCodigo({ ...base, usos: 1 }) === "agotado", "motivos: no existe, apagado, vencido, agotado");
ok(M.motivoCodigo(base) === null && M.motivoCodigo({ ...base, usos: 9, usos_max: null }) === null, "un código vigente (o sin límite de usos) sirve");

// ---------- Revisar el código que escribe la familia ----------
db.codigos.push({ id: "cod-1", codigo: "PRUEBA-GRATIS", tipo: "gratis", valor: 100, usos: 0, usos_max: 2, activo: true, expira_en: null });
const fam = { telefono: "5512345678", correo: "familia@correo.com", ip: "1.2.3.4" };
ok(await M.revisarCodigo("", fam) === null, "sin código: el pago sigue igual");
const malo = await M.revisarCodigo("noexiste", fam);
ok(malo?.error === "Ese código no es válido" && db.codigo_intentos.at(-1)?.resultado === "no_existe", "código que no existe: mensaje neutro y queda anotado");
const bueno = await M.revisarCodigo(" prueba-gratis ", fam);
ok(bueno?.codigo?.id === "cod-1", "el código bueno se reconoce aunque venga en minúsculas y con espacios");
for (let k = 0; k < 4; k++) await M.revisarCodigo("OTRO" + k, fam);
const bloqueado = await M.revisarCodigo("PRUEBA-GRATIS", fam);
ok(bloqueado?.error === "Ese código no es válido" && db.codigo_intentos.at(-1)?.resultado === "bloqueado", "con 5 intentos fallidos en una hora, el sexto se rechaza aunque el código sea bueno");
ok((await M.revisarCodigo("PRUEBA-GRATIS", { telefono: "5599999999", correo: "otra@correo.com", ip: "1.2.3.4" }))?.error, "el bloqueo también cuenta por la misma conexión (IP)");
ok((await M.revisarCodigo("PRUEBA-GRATIS", { telefono: "5599999999", correo: "otra@correo.com", ip: "9.9.9.9" }))?.codigo, "otra familia, en otra conexión, sí puede usarlo");
db.codigo_intentos.forEach((i) => { if (i.telefono === fam.telefono) i.creado_en = hace(61); });
ok((await M.revisarCodigo("PRUEBA-GRATIS", fam))?.codigo, "una hora después, el bloqueo se levanta solo");

// ---------- Código gratis: entrega inmediata, un solo uso ----------
const quien = { telefono: "5511111111", correo: "a@b.com", ip: "5.5.5.5" };
db.compras.push({ id: "compra-1", estado: "pendiente", monto_mxn: 50 }, { id: "compra-2", estado: "pendiente", monto_mxn: 50 }, { id: "compra-3", estado: "pagada", monto_mxn: 50 });
const cod = { ...db.codigos[0] };
const r1 = await M.entregarConCodigo(db.compras[0], cod, quien, 50);
const c1 = db.compras[0];
ok(r1.status === 200 && r1.cuerpo.modo === "codigo" && r1.cuerpo.url === "https://sitio/sparked/listo.html?compra=compra-1", "código gratis: responde modo 'codigo' con la dirección de listo.html");
ok(c1.estado === "pagada" && c1.monto_mxn === 0 && c1.metodo_pago === "codigo" && c1.codigo === "PRUEBA-GRATIS" && c1.descuento_mxn === 50 && !!c1.codigo_usado_en, "la compra queda pagada con monto 0, método 'codigo', el código y el descuento");
ok(db.codigos[0].usos === 1 && confirmados.join() === "compra-1", "se gasta un uso y la guía se entrega una vez");
await M.contarUsoCodigo("compra-1");
ok(db.codigos[0].usos === 1, "el uso de una compra gratis no se vuelve a contar al entregar");
const r3 = await M.entregarConCodigo(db.compras[2], { ...db.codigos[0] }, quien, 50);
ok(r3.status === 400 && db.codigos[0].usos === 1, "si la compra ya no está pendiente, el uso se devuelve");
await M.entregarConCodigo(db.compras[1], { ...db.codigos[0] }, quien, 50);
ok(db.codigos[0].usos === 2 && db.compras[1].estado === "pagada", "el segundo uso (límite 2) también sirve");
db.compras.push({ id: "compra-4", estado: "pendiente", monto_mxn: 50 });
const r4 = await M.entregarConCodigo(db.compras[3], { ...db.codigos[0] }, quien, 50);
ok(r4.status === 400 && r4.cuerpo.campo === "codigo" && db.compras[3].estado === "pendiente" && db.codigos[0].usos === 2, "sin usos libres: mensaje neutro, la compra no se paga y no se pasa del límite");

// ---------- Código de descuento: el uso se cuenta al pagar, una sola vez ----------
db.codigos.push({ id: "cod-2", codigo: "MITAD", tipo: "porcentaje", valor: 50, usos: 0, usos_max: null, activo: true, expira_en: null });
db.compras.push({ id: "compra-5", estado: "pagada", monto_mxn: 25, codigo: "MITAD", codigo_usado_en: null }, { id: "compra-6", estado: "pagada", monto_mxn: 50, codigo: null });
await Promise.all([M.contarUsoCodigo("compra-5"), M.contarUsoCodigo("compra-5")]);
await M.contarUsoCodigo("compra-6");
ok(db.codigos[1].usos === 1, "descuento: un solo uso aunque la entrega se repita; una compra sin código no cuenta");

// ---------- Avance de la guía pagada (entrega en dos tiempos) ----------
db.trabajos.push({ id: "t1", guia_id: "g1", alcance: "resto", estado: "corriendo", progreso: { pct: 60, mensaje: "Escribiendo el bloque 3 de 3 ✍️" }, actualizado_en: hace(0) });
db.trabajos.push({ id: "t2", guia_id: "g2", alcance: "resto", estado: "error", progreso: { pct: 0 }, actualizado_en: hace(1) });
db.trabajos.push({ id: "t3", guia_id: "g3", alcance: "resto", estado: "listo", progreso: { pct: 100 }, actualizado_en: hace(5) });
const a1 = await M.avanceDeGuia("g1"), a2 = await M.avanceDeGuia("g2"), a3 = await M.avanceDeGuia("g3");
ok(!a1.revision && a1.avance.pct === 60, "trabajo en curso: se devuelve su avance");
ok(a2.revision && a2.avance.mensaje === M.MSG_REVISANDO, "trabajo con error: 'Estamos revisando tu guía…' (ya no 'generando' para siempre)");
ok(a3.revision, "trabajo terminado hace rato sin pegar la guía: también 'revisando'");
ok(!(await M.avanceDeGuia("g4", Date.now() - 5_000)).revision && (await M.avanceDeGuia("g4", Date.now() - 120_000)).revision, "sin trabajo: espera un minuto antes de decir 'revisando'");

console.log(`\n${total - fallas} de ${total} comprobaciones bien${fallas ? `; ${fallas} fallaron` : ""}.`);
process.exit(fallas ? 1 : 0);
