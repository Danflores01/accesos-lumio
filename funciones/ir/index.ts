// Función pública: es la que usa el link que reciben los alumnos (a través de la página entrar.html).
//   GET  /ir/<token>           -> si lo abre un navegador real: consume el acceso y redirige a Lumio (un solo toque)
//                                 si lo abre un robot (vista previa de WhatsApp, rastreadores): texto plano, NO consume
//   GET  /ir/<token>?json=1    -> consulta el estado sin consumir (para la página entrar.html)
//   POST /ir/<token>?json=1    -> consume y responde JSON. Cuerpo opcional {dispositivo}: el secreto que identifica
//                                 al aparato; si no viene, se crea uno nuevo (cuenta como aparato nuevo) y se devuelve
//                                 en la respuesta como "dispositivo" para que la página lo guarde.
//   POST /ir/<token>           -> consume y redirige
// Regla de familia: un link de clase limitada acepta hasta clases.max_dispositivos aparatos distintos (2 por defecto).
// El servidor solo guarda el hash del secreto de cada aparato (tabla acceso_dispositivos).
// Nota: el dominio gratuito de Supabase convierte todo HTML a texto plano, por eso aquí no hay páginas.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type",
  "access-control-allow-methods": "GET, POST, OPTIONS",
};

const TEXTOS: Record<string, string> = {
  inexistente: "Este enlace no existe o está incompleto. Revisa que lo hayas abierto completo.",
  borrador: "Este enlace todavía no está activo.",
  expirado: "Este enlace ya pasó su fecha de vigencia.",
  cerrado: "Este enlace ya fue abierto y su tiempo de uso terminó.",
  agotado: "Este enlace ya se usó el máximo de veces permitido.",
  revocado: "Este acceso fue cancelado por el profesor.",
  clase_inactiva: "Esta clase ya no está disponible.",
  otro_dispositivo: "Este acceso ya se usa en los aparatos permitidos. Si es tu propio aparato, cierra la navegación privada y vuelve a abrir el link; si no, pídele al profesor un link nuevo.",
};
const PIE = "\n\nSi eres el alumno, pídele al profesor un enlace nuevo. Los enlaces son de una sola familia y no se pueden compartir.";

const texto = (s: string, status = 200) =>
  new Response(s, { status, headers: { ...CORS, "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" } });
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const redirigir = (u: string) =>
  new Response(null, { status: 303, headers: { ...CORS, location: u, "cache-control": "no-store" } });

// Agentes que generan vistas previas o rastrean: nunca deben consumir un acceso.
const BOTS = /bot|crawl|spider|preview|facebookexternalhit|whatsapp|telegram|slack|discord|twitter|linkedin|skype|snapchat|pinterest|curl|wget|python|java\/|okhttp|go-http|headless|lighthouse|pingdom|uptime|monitor|scan|validator|embed/i;

function esNavegador(req: Request): boolean {
  if (req.method === "HEAD") return false;
  const ua = req.headers.get("user-agent") ?? "";
  const accept = req.headers.get("accept") ?? "";
  if (!ua || BOTS.test(ua)) return false;
  return accept.includes("text/html");
}

function quiereJson(req: Request, url: URL): boolean {
  if (url.searchParams.get("json") === "1") return true;
  const accept = req.headers.get("accept") ?? "";
  return accept.includes("application/json") && !accept.includes("text/html");
}

function tokenDe(url: URL): string | null {
  const partes = url.pathname.split("/").filter(Boolean);
  const i = partes.lastIndexOf("ir");
  const t = i >= 0 ? partes[i + 1] : partes[partes.length - 1];
  if (!t || !/^[A-Za-z0-9]{8,64}$/.test(t)) return null;
  return t;
}

// Secreto que identifica a un aparato: lo guarda la página entrar.html en ese navegador.
const ALFABETO = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function nuevoSecreto(n = 32): string {
  const b = crypto.getRandomValues(new Uint8Array(n));
  let s = "";
  for (const x of b) s += ALFABETO[x % ALFABETO.length];
  return s;
}
const esSecreto = (s: unknown): s is string => typeof s === "string" && /^[A-Za-z0-9]{16,64}$/.test(s);

// "#7" es solo el número de orden del link, no un nombre: al alumno solo se le muestra un nombre real.
function nombreReal(s: unknown): string | null {
  const t = typeof s === "string" ? s.trim() : "";
  return t && !/^#\d+$/.test(t) ? t : null;
}

async function urlError(): Promise<string | null> {
  const { data } = await supabase.from("config").select("valor").eq("clave", "url_error").maybeSingle();
  return data?.valor || null;
}

async function fallo(estado: string): Promise<Response> {
  const u = await urlError();
  if (u) return redirigir(`${u}${u.includes("?") ? "&" : "?"}motivo=${encodeURIComponent(estado)}`);
  return texto((TEXTOS[estado] ?? TEXTOS.inexistente) + PIE, estado === "inexistente" ? 404 : 200);
}

type Resultado = { estado: string; url?: string | null; alumno?: string | null; clase?: string | null };

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  const url = new URL(req.url);
  const token = tokenDe(url);
  const modoJson = quiereJson(req, url);
  if (!token) return modoJson ? json({ estado: "inexistente" }, 404) : fallo("inexistente");

  const consumir = async (dispositivo: string | null): Promise<Resultado> => {
    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("cf-connecting-ip") || "";
    const ua = req.headers.get("user-agent") ?? "";
    const { data, error } = await supabase.rpc("consumir_acceso", { p_token: token, p_ip: ip, p_ua: ua, p_dispositivo: dispositivo });
    if (error) throw error;
    return (data?.[0] ?? { estado: "inexistente" }) as Resultado;
  };

  try {
    if (req.method === "POST") {
      // Secreto del aparato: el que manda la página o, si no trae ninguno, uno nuevo (cuenta como aparato nuevo).
      let dispositivo = nuevoSecreto();
      if (modoJson) {
        const cuerpo = (await req.json().catch(() => null)) as { dispositivo?: unknown } | null;
        const recibido = cuerpo?.dispositivo;
        if (esSecreto(recibido)) dispositivo = recibido;
      }
      const r = await consumir(dispositivo);
      if (modoJson) {
        return json({
          estado: r.estado,
          url: r.url ?? null,
          alumno: nombreReal(r.alumno),
          clase: r.clase ?? null,
          dispositivo: r.estado === "ok" ? dispositivo : null,
        }, r.estado === "ok" ? 200 : 403);
      }
      return r.estado === "ok" && r.url ? redirigir(r.url) : fallo(r.estado);
    }

    // GET / HEAD
    if (modoJson) {
      const { data, error } = await supabase.rpc("consultar_acceso", { p_token: token });
      if (error) throw error;
      const r = data?.[0] as Resultado | undefined;
      return r ? json({ ...r, alumno: nombreReal(r.alumno) }) : json({ estado: "inexistente" }, 404);
    }
    if (!esNavegador(req)) {
      return texto("Acceso a clase. Abre este enlace desde tu teléfono o computadora para entrar.");
    }
    // Clic directo a esta dirección (sin la página): cada clic cuenta como un aparato nuevo.
    const r = await consumir(nuevoSecreto());
    return r.estado === "ok" && r.url ? redirigir(r.url) : fallo(r.estado);
  } catch (e) {
    console.error(e);
    return modoJson ? json({ estado: "error" }, 500) : texto("No se pudo validar el enlace. Intenta de nuevo en un momento.", 500);
  }
});
