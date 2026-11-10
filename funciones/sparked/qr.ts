// Matriz de un código QR (true = módulo oscuro), con la misma biblioteca que usa la página listo.html del sitio
// (qrcode-generator 1.4.4): nivel de corrección M y tamaño automático. Va en su propio archivo para que imagen-wa.ts
// no dependa de nada externo y se pueda probar con Node.
import qrcode from "npm:qrcode-generator@1.4.4";

export function matrizQr(texto: string): boolean[][] {
  const q = qrcode(0, "M");
  q.addData(texto);
  q.make();
  const n = q.getModuleCount();
  return Array.from({ length: n }, (_, f) => Array.from({ length: n }, (_, c) => q.isDark(f, c)));
}
