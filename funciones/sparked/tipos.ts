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
  // Imagen PNG que acompaña a un mensaje de WhatsApp (imagen-wa.ts): "entrega" lleva el QR del link; "compartir" es
  // fija. Devuelve null si no hay arte publicado en el sitio. Opcional: sin ella, los mensajes salen solo con texto.
  imagenWhatsApp?: (tipo: "entrega" | "compartir", idioma: "es" | "en", link?: string) => Promise<Uint8Array | null>;
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

// Datos de una entrega (guía 100 % lista) para avisar a la familia. extra (opcional) = un renglón más al final del
// mensaje; lo usan las guías hechas con el saldo de un paquete para decir cuántas guías quedan (cuenta.ts).
export type Entrega = { titulo: string; link: string; expira_en: string; extra?: string };

// Lo que el módulo de cuentas y paquetes (cuenta.ts) necesita de index.ts además de lo común: el cobro con Mercado
// Pago, la entrega de una guía y el arranque de un trabajo. Así cuenta.ts no importa nada de index.ts.
export type ExtrasCuenta = {
  limpiarTel: (t: unknown) => string;               // teléfono en formato internacional ("+52" + 10 dígitos) o ""
  mpToken: () => string;                            // llave de Mercado Pago ("" = cobro en línea apagado)
  // Link de pago (preferencia de Checkout Pro: tarjeta, OXXO y SPEI) de un paquete; regresa a cuenta.html.
  crearPreferenciaPaquete: (compra: any, precio: number, guias: number, dias: number) => Promise<{ id: string; url: string }>;
  revisarCompraMP: (compraId: string, pagoId?: string | null) => Promise<string | null>;
  tocaRevisarMP: (compraId: string) => boolean;     // freno: una consulta a Mercado Pago cada 20 s por compra
  // Crea (una vez) la clase y el acceso de una compra pagada; el link no sale hasta que la guía está completa.
  entregar: (compra: any) => Promise<{ token: string; expira_en: string; link: string; lista: boolean; recien: boolean }>;
  entregarGuiaLista: (compraId: string) => Promise<{ entregada: boolean; recien: boolean; problemas?: string[] }>;
  avanceDeGuia: (guiaId: string, desde?: number) => Promise<{ revision: boolean; avance: any }>;
  archivosSubidos: (carpeta: string) => Promise<Set<string>>;
  borrarCarpeta: (carpeta: string) => Promise<void>;
  disparar: (trabajoId: string, retrasoMs?: number) => void;   // arranca (o continúa) un trabajo de generación
  linkDe: (base: string, token: string) => string;
  diasAcceso: number;                               // días de acceso de cada guía (7)
  dispositivos: number;                             // dispositivos por guía (2)
};
export type CtxCuenta = CtxBase & ExtrasCuenta;
export type CtxRutasCuenta = CtxRutas & ExtrasCuenta;
