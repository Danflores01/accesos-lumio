// Contrato compartido entre index.ts y los módulos aparte (extras.ts y whatsapp.ts).
// index.ts arma estos objetos y se los pasa a cada módulo; los módulos NO importan nada de index.ts.
// deno-lint-ignore-file no-explicit-any

// Lo que cualquier módulo necesita para trabajar fuera de una petición (por ejemplo, al entregar una guía).
export type CtxBase = {
  supabase: any;                                    // cliente de Supabase con la llave de servicio
  config: () => Promise<Record<string, string>>;    // ajustes del panel (tabla config), con caché
  sitio: () => Promise<string>;                     // base del sitio público; termina en "/" (…/sparked/)
  ahora: () => string;                              // fecha y hora ISO
  mandarCorreo: (para: string, asunto: string, html: string, texto?: string) => Promise<void>;
  avisarDaniel: (asunto: string, html: string) => Promise<void>; // correo de aviso al dueño (si tiene correo de avisos)
  enSegundoPlano: (p: Promise<unknown>) => void;    // deja corriendo una promesa después de responder
};

// Lo mismo, más los datos de la petición. Cada módulo revisa si la ruta es suya y, si no lo es, devuelve null.
export type CtxRutas = CtxBase & {
  req: Request;
  m: string;                                        // método HTTP
  ruta: string[];                                   // partes después de /sparked, ya decodificadas: ["admin", "comentarios", "<id>"]
  json: (body: unknown, status?: number) => Response;
  error: (mensaje: string, status?: number) => Response;
  leerJson: (req: Request) => Promise<Record<string, any>>;
  esAdmin: () => Promise<boolean>;                  // true si la cabecera x-admin-key es válida
  ip: string | null;
};

// Datos de una entrega (guía 100 % lista) para avisar a la familia.
export type Entrega = { titulo: string; link: string; expira_en: string };
