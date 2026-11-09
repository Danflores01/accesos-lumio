// Módulo aparte: entrega de guías por WhatsApp (Green API) y comando "compartir".
// index.ts llama a rutasWhatsApp() en cada petición y a avisarPorWhatsApp() cuando una guía pagada queda 100 % lista.
import type { CtxBase, CtxRutas, Entrega } from "./tipos.ts";

// true cuando las llaves de Green API están puestas en los secretos de Supabase.
export function motorWhatsApp(): boolean {
  return false;
}

// Manda la guía lista por WhatsApp. Nunca lanza errores: devuelve qué pasó.
// deno-lint-ignore no-explicit-any
export async function avisarPorWhatsApp(_c: CtxBase, _compra: any, _entrega: Entrega): Promise<{ ok: boolean; estado: string }> {
  return { ok: false, estado: "sin_motor" };
}

export async function rutasWhatsApp(_c: CtxRutas): Promise<Response | null> {
  return null;
}
