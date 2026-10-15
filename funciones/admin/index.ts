// API de administración, protegida con la clave de administrador (cabecera x-admin-key).
// El panel (panel.html) es un archivo aparte que llama a esta API.
//   *    /admin/api/...   -> JSON
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const BASE = (Deno.env.get("PUBLIC_BASE_URL") ?? Deno.env.get("SUPABASE_URL") ?? "").replace(/\/$/, "");
const BUCKET = "paginas";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type, x-admin-key",
  "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
};

const ALFABETO = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function nuevoToken(n = 14): string {
  const b = crypto.getRandomValues(new Uint8Array(n));
  let s = "";
  for (const x of b) s += ALFABETO[x % ALFABETO.length];
  return s;
}

async function sha256hex(s: string): Promise<string> {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

async function leerConfig(clave: string): Promise<string | null> {
  const { data } = await supabase.from("config").select("valor").eq("clave", clave).maybeSingle();
  return data?.valor ?? null;
}

let hashGuardado: string | null = null;
async function autorizado(req: Request): Promise<boolean> {
  const clave = req.headers.get("x-admin-key") ?? "";
  if (!clave) return false;
  const h = await sha256hex(clave);
  if (!hashGuardado) hashGuardado = await leerConfig("admin_key_sha256");
  if (hashGuardado && h === hashGuardado) return true;
  // Por si la clave se rotó desde la base: recargar una vez.
  hashGuardado = await leerConfig("admin_key_sha256");
  return !!hashGuardado && h === hashGuardado;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

const esUrl = (u: unknown) => typeof u === "string" && /^https?:\/\/\S+$/i.test(u);
const esUuid = (u: unknown) => typeof u === "string" && /^[0-9a-f-]{36}$/i.test(u);
const limpiarTel = (t: unknown) => String(t ?? "").replace(/\D/g, "") || null;

async function leerJson(req: Request): Promise<Record<string, unknown>> {
  try { return (await req.json()) ?? {}; } catch { return {}; }
}

// Base pública de los links de alumnos: la página "entrar" publicada en Storage,
// o, si no existe, la función "ir" directa.
async function baseLinks(): Promise<string> {
  const cfg = await leerConfig("base_links");
  return cfg ?? `${BASE}/functions/v1/ir/`;
}
const linkDe = (base: string, token: string) => base + token;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  const url = new URL(req.url);
  const partes = url.pathname.split("/").filter(Boolean);
  const i = partes.lastIndexOf("admin");
  const ruta = partes.slice(i + 1);

  if (ruta.length === 0) return json({ info: "API de Accesos Lumio. El panel es el archivo panel.html." });
  if (ruta[0] !== "api") return json({ error: "No encontrado" }, 404);
  if (!(await autorizado(req))) return json({ error: "Clave de administrador incorrecta" }, 401);

  const [, recurso, id, accion] = ruta;
  const m = req.method;

  try {
    // ---------- Verificación de clave ----------
    if (recurso === "ping") return json({ ok: true, base: BASE, base_links: await baseLinks() });

    // ---------- Cambiar la contraseña de administrador (ya autenticado con la actual) ----------
    if (recurso === "clave" && m === "POST") {
      const b = await leerJson(req);
      const nueva = String(b.nueva ?? "");
      if (nueva.length < 8 || nueva.length > 200) return json({ error: "La contraseña debe tener entre 8 y 200 caracteres" }, 400);
      const h = await sha256hex(nueva);
      const { error } = await supabase.from("config").upsert({ clave: "admin_key_sha256", valor: h });
      if (error) throw error;
      hashGuardado = h;
      return json({ ok: true });
    }

    // ---------- Configuración ----------
    if (recurso === "config" && m === "GET") {
      const { data } = await supabase.from("config").select("clave, valor").neq("clave", "admin_key_sha256");
      return json(Object.fromEntries((data ?? []).map((r) => [r.clave, r.valor])));
    }
    if (recurso === "config" && m === "POST") {
      const b = await leerJson(req);
      const permitidas = ["base_links", "url_error", "vigencia_horas", "minutos_tras_apertura", "max_usos", "plantilla"];
      const filas = permitidas.filter((k) => typeof b[k] === "string").map((k) => ({ clave: k, valor: String(b[k]) }));
      if (!filas.length) return json({ error: "Nada que guardar" }, 400);
      const { error } = await supabase.from("config").upsert(filas);
      if (error) throw error;
      return json({ ok: true });
    }

    // ---------- Archivos en Storage (bucket público "paginas"). Nota: Supabase no sirve HTML
    // en su dominio gratuito, así que esto solo sirve para imágenes u otros archivos. ----------
    if (recurso === "publicar" && m === "POST") {
      const b = await leerJson(req);
      const rutaArchivo = String(b.ruta ?? "").replace(/^\/+/, "");
      const contenido = String(b.contenido ?? "");
      const tipo = String(b.tipo ?? "text/plain; charset=utf-8");
      if (!/^[\w./-]+$/.test(rutaArchivo) || rutaArchivo.includes("..")) return json({ error: "Ruta no válida" }, 400);
      const { data: buckets } = await supabase.storage.listBuckets();
      if (!buckets?.some((x) => x.name === BUCKET)) {
        const { error } = await supabase.storage.createBucket(BUCKET, { public: true });
        if (error) throw error;
      }
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(rutaArchivo, new Blob([contenido], { type: tipo }), { contentType: tipo, upsert: true, cacheControl: "60" });
      if (error) throw error;
      return json({ ok: true, url: `${BASE}/storage/v1/object/public/${BUCKET}/${rutaArchivo}` });
    }
    if (recurso === "publicar" && m === "DELETE") {
      const rutaArchivo = url.searchParams.get("ruta");
      if (rutaArchivo) {
        const { error } = await supabase.storage.from(BUCKET).remove([rutaArchivo]);
        if (error) throw error;
        return json({ ok: true });
      }
      // Sin ruta: vaciar y eliminar el bucket completo.
      const { data: buckets } = await supabase.storage.listBuckets();
      if (buckets?.some((x) => x.name === BUCKET)) {
        await supabase.storage.emptyBucket(BUCKET);
        const { error } = await supabase.storage.deleteBucket(BUCKET);
        if (error) throw error;
      }
      return json({ ok: true, bucket_eliminado: true });
    }

    // ---------- Clases ----------
    if (recurso === "clases" && !id && m === "GET") {
      const { data: clases, error } = await supabase.from("clases").select("*").order("creada_en", { ascending: false });
      if (error) throw error;
      const { data: acc } = await supabase.from("accesos_vista").select("clase_id, estado");
      const conteo: Record<string, Record<string, number>> = {};
      for (const a of acc ?? []) {
        conteo[a.clase_id] ??= {};
        conteo[a.clase_id][a.estado] = (conteo[a.clase_id][a.estado] ?? 0) + 1;
      }
      return json((clases ?? []).map((c) => ({ ...c, conteo: conteo[c.id] ?? {} })));
    }
    if (recurso === "clases" && !id && m === "POST") {
      const b = await leerJson(req);
      const nombre = String(b.nombre ?? "").trim();
      const url_destino = String(b.url_destino ?? "").trim();
      if (!nombre) return json({ error: "Falta el nombre de la clase" }, 400);
      if (!esUrl(url_destino)) return json({ error: "El link de Lumio debe empezar con http:// o https://" }, 400);
      const { data, error } = await supabase.from("clases").insert({ nombre, url_destino }).select().single();
      if (error) throw error;
      return json(data, 201);
    }
    if (recurso === "clases" && esUuid(id) && m === "PATCH") {
      const b = await leerJson(req);
      const cambios: Record<string, unknown> = {};
      if (typeof b.nombre === "string" && b.nombre.trim()) cambios.nombre = b.nombre.trim();
      if (typeof b.url_destino === "string") {
        if (!esUrl(b.url_destino.trim())) return json({ error: "Link no válido" }, 400);
        cambios.url_destino = b.url_destino.trim();
      }
      if (typeof b.activa === "boolean") cambios.activa = b.activa;
      const { data, error } = await supabase.from("clases").update(cambios).eq("id", id).select().single();
      if (error) throw error;
      return json(data);
    }
    if (recurso === "clases" && esUuid(id) && m === "DELETE") {
      const { error } = await supabase.from("clases").delete().eq("id", id);
      if (error) throw error;
      return json({ ok: true });
    }

    // ---------- Accesos ----------
    if (recurso === "accesos" && !id && m === "GET") {
      const base = await baseLinks();
      const clase_id = url.searchParams.get("clase_id");
      let q = supabase.from("accesos_vista").select("*").order("creado_en", { ascending: false }).limit(500);
      if (esUuid(clase_id)) q = q.eq("clase_id", clase_id);
      const { data, error } = await q;
      if (error) throw error;
      return json((data ?? []).map((a) => ({ ...a, link: linkDe(base, a.token) })));
    }
    if (recurso === "accesos" && !id && m === "POST") {
      const b = await leerJson(req);
      if (!esUuid(b.clase_id)) return json({ error: "Falta la clase" }, 400);
      const alumnos = Array.isArray(b.alumnos) ? b.alumnos : [];
      const expira = new Date(String(b.expira_en ?? ""));
      if (isNaN(expira.getTime())) return json({ error: "Fecha de vigencia no válida" }, 400);
      if (expira.getTime() < Date.now()) return json({ error: "La vigencia ya pasó; elige una hora futura" }, 400);
      const minutos = Math.min(1440, Math.max(1, Number(b.minutos_tras_apertura ?? 5) || 5));
      const maxUsos = Math.min(50, Math.max(1, Number(b.max_usos ?? 3) || 3));
      const filas = alumnos
        .map((x: Record<string, unknown>) => ({
          token: nuevoToken(),
          clase_id: b.clase_id,
          alumno: String(x.alumno ?? "").trim(),
          telefono: limpiarTel(x.telefono),
          nota: String(x.nota ?? "").trim() || null,
          expira_en: expira.toISOString(),
          minutos_tras_apertura: minutos,
          max_usos: maxUsos,
        }))
        .filter((f: { alumno: string }) => f.alumno);
      if (!filas.length) return json({ error: "Escribe al menos un alumno" }, 400);
      const { data, error } = await supabase.from("accesos").insert(filas).select();
      if (error) throw error;
      const base = await baseLinks();
      return json((data ?? []).map((a) => ({ ...a, estado: "pendiente", link: linkDe(base, a.token) })), 201);
    }
    // Siguiente link para la clase: devuelve el borrador pendiente o crea uno nuevo (no vive hasta "enviar").
    if (recurso === "siguiente" && m === "POST") {
      const b = await leerJson(req);
      if (!esUuid(b.clase_id)) return json({ error: "Falta la clase" }, 400);
      const base = await baseLinks();
      const { data: borrador } = await supabase
        .from("accesos").select("*")
        .eq("clase_id", b.clase_id).is("enviado_en", null).eq("revocado", false)
        .order("creado_en", { ascending: false }).limit(1).maybeSingle();
      if (borrador) return json({ ...borrador, estado: "borrador", link: linkDe(base, borrador.token) });
      const { count } = await supabase.from("accesos").select("id", { count: "exact", head: true }).eq("clase_id", b.clase_id);
      const minutos = Math.min(1440, Math.max(1, Number(b.minutos_tras_apertura ?? 10) || 10));
      const maxUsos = Math.min(50, Math.max(1, Number(b.max_usos ?? 3) || 3));
      const fila = {
        token: nuevoToken(),
        clase_id: b.clase_id,
        alumno: `#${(count ?? 0) + 1}`,
        enviado_en: null,
        expira_en: new Date(Date.now() + 30 * 86400 * 1000).toISOString(), // se fija de verdad al enviar
        minutos_tras_apertura: minutos,
        max_usos: maxUsos,
      };
      const { data, error } = await supabase.from("accesos").insert(fila).select().single();
      if (error) throw error;
      return json({ ...data, estado: "borrador", link: linkDe(base, data.token) }, 201);
    }
    // Marca el borrador como enviado: desde este momento vive "vigencia_horas".
    if (recurso === "accesos" && esUuid(id) && m === "POST" && accion === "enviar") {
      const b = await leerJson(req);
      const horas = Math.min(24 * 30, Math.max(0.1, Number(b.vigencia_horas ?? 24) || 24));
      const { data, error } = await supabase.rpc("enviar_acceso", { p_id: id, p_vigencia_horas: horas });
      if (error) throw error;
      const { data: fila } = await supabase.from("accesos_vista").select("*").eq("id", id).maybeSingle();
      if (!fila) return json({ error: "Ese link no existe" }, 404);
      return json({ ...fila, recien_enviado: (data?.length ?? 0) > 0, link: linkDe(await baseLinks(), fila.token) });
    }
    if (recurso === "accesos" && esUuid(id) && m === "POST" && accion === "revocar") {
      const { error } = await supabase.from("accesos").update({ revocado: true }).eq("id", id);
      if (error) throw error;
      return json({ ok: true });
    }
    if (recurso === "accesos" && esUuid(id) && m === "POST" && accion === "reactivar") {
      const b = await leerJson(req);
      let expira = new Date(String(b.expira_en ?? ""));
      if (isNaN(expira.getTime()) || expira.getTime() < Date.now()) expira = new Date(Date.now() + 3 * 3600 * 1000);
      const { data, error } = await supabase
        .from("accesos")
        .update({ revocado: false, usos: 0, primer_uso_en: null, ultimo_uso_en: null, expira_en: expira.toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return json({ ...data, link: linkDe(await baseLinks(), data.token) });
    }
    if (recurso === "accesos" && esUuid(id) && m === "DELETE") {
      const { error } = await supabase.from("accesos").delete().eq("id", id);
      if (error) throw error;
      return json({ ok: true });
    }

    // ---------- Eventos (bitácora de intentos) ----------
    if (recurso === "eventos" && m === "GET") {
      const clase_id = url.searchParams.get("clase_id");
      const limite = Math.min(500, Number(url.searchParams.get("limite") ?? 100) || 100);
      const campos = "id, resultado, ip, user_agent, creado_en, token_intentado";
      let q;
      if (esUuid(clase_id)) {
        q = supabase.from("eventos").select(`${campos}, accesos!inner(alumno, clase_id)`).eq("accesos.clase_id", clase_id);
      } else {
        q = supabase.from("eventos").select(`${campos}, accesos(alumno, clase_id)`);
      }
      const { data, error } = await q.order("creado_en", { ascending: false }).limit(limite);
      if (error) throw error;
      return json((data ?? []).map((e) => ({
        id: e.id, resultado: e.resultado, ip: e.ip, user_agent: e.user_agent, creado_en: e.creado_en,
        token_intentado: e.token_intentado, alumno: (e as { accesos?: { alumno?: string } }).accesos?.alumno ?? null,
      })));
    }

    return json({ error: "Ruta no reconocida" }, 404);
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message ?? "Error interno" }, 500);
  }
});
