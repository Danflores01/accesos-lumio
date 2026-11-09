// Módulo aparte: comentarios de la portada (testimonios y reseñas) y costos en pesos con el tipo de cambio del DOF.
// index.ts llama a rutasExtras() en cada petición; si la ruta no es de este módulo, devuelve null.
import type { CtxRutas } from "./tipos.ts";

export async function rutasExtras(_c: CtxRutas): Promise<Response | null> {
  return null;
}
