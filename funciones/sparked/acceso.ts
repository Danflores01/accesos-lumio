// deno-lint-ignore-file no-explicit-any
// Módulo aparte: entrada al panel con correo y contraseña (pedido de Daniel, 10 nov 2026).
//
// Las cuentas viven en el servicio de cuentas de Supabase (Auth): él guarda la contraseña cifrada y entrega una sesión
// (un pase de una hora y otro para renovarlo). Aquí NO se guarda ninguna contraseña. Solo cuenta como administrador la
// cuenta marcada con app_metadata.rol = "admin", y esa marca solo la pone este servidor; una cuenta que alguien se
// creara por su lado con cualquier correo no entra al panel.
//
// El panel no habla con Supabase Auth directamente: pasa por estas rutas, para no publicar ninguna llave en el sitio y
// para frenar a quien pruebe contraseñas (tabla acceso_intentos).
//   POST /acceso/entrar  { correo, contrasena }   → { ok, acceso, renovar, expira_en, correo }
//   POST /acceso/renovar { renovar }              → lo mismo, con pases nuevos
//   POST /acceso/salir   (Authorization: Bearer)  → cierra la sesión en el servicio de cuentas
//   GET  /admin/acceso                            → { correos: [...] } cuentas de administrador que existen
//   POST /admin/acceso   { correo, contrasena }   → crea la cuenta o le cambia la contraseña. SOLO con la clave de
//                                                   administrador (x-admin-key); una sesión no basta, para que un
//                                                   pase robado no pueda cambiar la contraseña.
// La clave de administrador de siempre (x-admin-key) sigue funcionando: es el respaldo si se olvida la contraseña.
import type { CtxBase, CtxRutas } from "./tipos.ts";

const env = (k: string) => String((globalThis as any).Deno?.env?.get(k) ?? "").trim();
const urlAuth = () => `${env("SUPABASE_URL").replace(/\/+$/, "")}/auth/v1`;
const llave = () => env("SUPABASE_ANON_KEY") || env("SUPABASE_SERVICE_ROLE_KEY");   // solo para llamar al servicio de cuentas; nunca sale del servidor

export const MIN_CONTRASENA = 10;       // caracteres mínimos de la contraseña
const MAX_CONTRASENA = 72;              // lo más que admite el cifrado del servicio de cuentas
const VENTANA_MIN = 15;                 // minutos que se miran hacia atrás para frenar intentos
const FALLOS_POR_ORIGEN = 8;            // contraseñas malas desde una misma conexión en esa ventana
const FALLOS_POR_CORREO = 30;           // contraseñas malas para un mismo correo en esa ventana
const MSG_MAL = "Correo o contraseña incorrectos.";
const MSG_FRENO = "Demasiados intentos. Espera 15 minutos y vuelve a intentar, o entra con tu clave de administrador.";

const esCorreo = (s: string) => s.length <= 120 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);
const limpiarCorreo = (v: unknown) => String(v ?? "").trim().toLowerCase();
const esAdmin = (u: any) => u?.app_metadata?.rol === "admin" && !!u?.email;
async function huella(s: string): Promise<string> {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("sparked-acceso:" + s));
  return [...new Uint8Array(b)].slice(0, 16).map((x) => x.toString(16).padStart(2, "0")).join("");
}

// ---------- Sesión de administrador ----------
// Pases ya comprobados, un minuto en memoria: el panel hace varias peticiones seguidas y no hace falta preguntar al
// servicio de cuentas en cada una.
const vistas = new Map<string, { hasta: number; correo: string }>();
export function olvidarSesiones() { vistas.clear(); }

// Correo del administrador si la petición trae un pase válido (Authorization: Bearer …); si no, null.
export async function sesionAdmin(c: CtxBase, req: Request): Promise<string | null> {
  const m = (req.headers.get("authorization") ?? "").match(/^Bearer\s+([A-Za-z0-9._-]{20,4000})$/);
  if (!m) return null;
  const pase = m[1], ahora = Date.now();
  const v = vistas.get(pase);
  if (v && v.hasta > ahora) return v.correo;
  try {
    const { data, error } = await c.supabase.auth.getUser(pase);
    if (error || !esAdmin(data?.user)) return null;
    if (vistas.size > 200) vistas.clear();
    vistas.set(pase, { hasta: ahora + 60_000, correo: String(data.user.email) });
    return String(data.user.email);
  } catch {
    return null;
  }
}

// ---------- Freno a quien prueba contraseñas ----------
async function demasiados(c: CtxBase, origen: string | null, correo: string): Promise<boolean> {
  try {
    const desde = new Date(Date.now() - VENTANA_MIN * 60_000).toISOString();
    const contar = async (campo: string, valor: string) => {
      const { count } = await c.supabase.from("acceso_intentos").select("id", { count: "exact", head: true }).eq("ok", false).eq(campo, valor).gte("creado_en", desde);
      return count ?? 0;
    };
    const [porOrigen, porCorreo] = await Promise.all([origen ? contar("origen", origen) : 0, contar("correo", correo)]);
    return porOrigen >= FALLOS_POR_ORIGEN || porCorreo >= FALLOS_POR_CORREO;
  } catch {
    return false;   // si la tabla falla no se bloquea a nadie: el servicio de cuentas tiene su propio freno
  }
}
async function anotar(c: CtxBase, origen: string | null, correo: string, ok: boolean) {
  try { await c.supabase.from("acceso_intentos").insert({ origen, correo, ok }); } catch { /* sin efecto */ }
}

// ---------- Servicio de cuentas ----------
async function pedirPases(tipo: "password" | "refresh_token", cuerpo: Record<string, string>): Promise<any | null> {
  try {
    const r = await fetch(`${urlAuth()}/token?grant_type=${tipo}`, { method: "POST", headers: { "content-type": "application/json", apikey: llave(), authorization: `Bearer ${llave()}` }, body: JSON.stringify(cuerpo), signal: AbortSignal.timeout(10000) });
    if (!r.ok) { await r.body?.cancel(); return null; }
    return await r.json();
  } catch {
    return null;
  }
}
const respuestaSesion = (s: any) => ({ ok: true, acceso: String(s.access_token), renovar: String(s.refresh_token), expira_en: Number(s.expires_at) || Math.floor(Date.now() / 1000) + (Number(s.expires_in) || 3600), correo: String(s.user?.email ?? "") });

// Crea la cuenta de administrador o le cambia la contraseña. Si existía una cuenta con ese correo que NO era de
// administrador (alguien se registró por fuera), se descarta y se crea una nueva: así ningún pase viejo sirve.
export async function fijarAdministrador(c: CtxBase, correo: string, contrasena: string): Promise<{ ok: boolean; creada?: boolean; error?: string }> {
  const cuentas = c.supabase.auth.admin;
  const { data: lista, error: e0 } = await cuentas.listUsers({ page: 1, perPage: 1000 });
  if (e0) return { ok: false, error: "No se pudo consultar el servicio de cuentas." };
  const previa = (lista?.users ?? []).find((u: any) => limpiarCorreo(u.email) === correo);
  if (previa && esAdmin(previa)) {
    const { error } = await cuentas.updateUserById(previa.id, { password: contrasena });
    if (error) return { ok: false, error: "El servicio de cuentas no aceptó esa contraseña. Prueba con una más larga o distinta." };
    olvidarSesiones();
    return { ok: true, creada: false };
  }
  if (previa) {
    const { error } = await cuentas.deleteUser(previa.id);
    if (error) return { ok: false, error: "No se pudo preparar la cuenta. Inténtalo de nuevo." };
  }
  const { error } = await cuentas.createUser({ email: correo, password: contrasena, email_confirm: true, app_metadata: { rol: "admin" } });
  if (error) return { ok: false, error: "El servicio de cuentas no aceptó esa contraseña. Prueba con una más larga o distinta." };
  return { ok: true, creada: true };
}

// ---------- Rutas ----------
// c.conClave() dice si la petición trae la clave de administrador (x-admin-key) válida; lo arma index.ts.
export async function rutasAcceso(c: CtxRutas & { conClave: () => Promise<boolean> }): Promise<Response | null> {
  const [r0, r1, r2] = c.ruta;

  // OJO: /acceso/<clave de la familia> es la ruta con la que el reproductor abre una guía pagada (index.ts). Este módulo
  // solo puede quedarse con sus tres rutas exactas; cualquier otra /acceso/… debe seguir de largo (null). El 10 nov 2026
  // se quedaba con todas y respondía «Ruta no encontrada»: durante unas horas ninguna familia pudo abrir su guía.
  if (r0 === "acceso" && !r2 && (r1 === "entrar" || r1 === "renovar" || r1 === "salir")) {
    if (c.m !== "POST") return c.error("Ruta no encontrada", 404);
    if (r1 === "entrar") {
      const b = await c.leerJson(c.req);
      const correo = limpiarCorreo(b.correo), contrasena = String(b.contrasena ?? "");
      if (!esCorreo(correo) || contrasena.length < 1 || contrasena.length > 200) return c.error(MSG_MAL, 401);
      const origen = c.ip ? await huella(c.ip) : null;
      if (await demasiados(c, origen, correo)) return c.error(MSG_FRENO, 429);
      const s = await pedirPases("password", { email: correo, password: contrasena });
      const bien = !!s?.access_token && !!s?.refresh_token && esAdmin(s.user);
      await anotar(c, origen, correo, bien);
      return bien ? c.json(respuestaSesion(s)) : c.error(MSG_MAL, 401);
    }
    if (r1 === "renovar") {
      const b = await c.leerJson(c.req);
      const renovar = String(b.renovar ?? "");
      if (!/^[A-Za-z0-9._-]{6,400}$/.test(renovar)) return c.error("La sesión terminó. Vuelve a entrar.", 401);
      const s = await pedirPases("refresh_token", { refresh_token: renovar });
      return s?.access_token && s?.refresh_token && esAdmin(s.user) ? c.json(respuestaSesion(s)) : c.error("La sesión terminó. Vuelve a entrar.", 401);
    }
    if (r1 === "salir") {
      const pase = (c.req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
      if (pase) {
        vistas.delete(pase);
        try { const r = await fetch(`${urlAuth()}/logout`, { method: "POST", headers: { apikey: llave(), authorization: `Bearer ${pase}` }, signal: AbortSignal.timeout(8000) }); await r.body?.cancel(); } catch { /* da igual: el panel ya olvidó la sesión */ }
      }
      return c.json({ ok: true });
    }
    return c.error("Ruta no encontrada", 404);
  }

  if (r0 === "admin" && r1 === "acceso" && !r2) {
    if (c.m === "GET") {
      if (!(await c.esAdmin())) return c.error("No autorizado", 401);
      const { data, error } = await c.supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (error) return c.error("No se pudo consultar el servicio de cuentas.", 502);
      return c.json({ correos: (data?.users ?? []).filter(esAdmin).map((u: any) => String(u.email)), minimo: MIN_CONTRASENA });
    }
    if (c.m === "POST") {
      if (!(await c.conClave())) return c.error("Para crear o cambiar la contraseña entra con tu clave de administrador.", 401);
      const b = await c.leerJson(c.req);
      const correo = limpiarCorreo(b.correo), contrasena = String(b.contrasena ?? "");
      if (!esCorreo(correo)) return c.error("Escribe un correo válido.");
      if (contrasena.length < MIN_CONTRASENA) return c.error(`La contraseña debe tener al menos ${MIN_CONTRASENA} caracteres.`);
      if (contrasena.length > MAX_CONTRASENA) return c.error(`La contraseña no puede pasar de ${MAX_CONTRASENA} caracteres.`);
      if (contrasena.toLowerCase().includes(correo.split("@")[0]) || /^(.)\1+$/.test(contrasena)) return c.error("Elige una contraseña que no lleve tu correo ni sea un solo carácter repetido.");
      const r = await fijarAdministrador(c, correo, contrasena);
      return r.ok ? c.json({ ok: true, creada: r.creada === true, correo }) : c.error(r.error ?? "No se pudo guardar la contraseña.", 502);
    }
    return c.error("Ruta no encontrada", 404);
  }
  return null;
}
