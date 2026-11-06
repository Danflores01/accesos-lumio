// Servidor local para ver las páginas del repositorio en el navegador (igual que en GitHub Pages).
// Uso:  node herramientas/servir.js [puerto]      (por defecto 8787)
// No hace falta instalar nada: usa solo lo que trae Node.
const http = require("http");
const fs = require("fs");
const path = require("path");

const RAIZ = path.resolve(__dirname, "..");
const PUERTO = Number(process.argv[2] || process.env.PORT || 8787);
const TIPOS = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif",
  ".ico": "image/x-icon", ".webmanifest": "application/manifest+json", ".woff2": "font/woff2", ".woff": "font/woff",
  ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".wav": "audio/wav", ".txt": "text/plain; charset=utf-8", ".md": "text/plain; charset=utf-8",
};

http.createServer((req, res) => {
  let ruta = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (ruta.endsWith("/")) ruta += "index.html";
  const archivo = path.normalize(path.join(RAIZ, ruta));
  if (!archivo.startsWith(RAIZ) || archivo.includes("CLAVES")) { res.writeHead(403); return res.end("No"); }
  fs.stat(archivo, (err, st) => {
    if (err || !st.isFile()) {
      if (!err && st.isDirectory()) { res.writeHead(302, { location: ruta + "/" }); return res.end(); }
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" }); return res.end("No existe: " + ruta);
    }
    res.writeHead(200, { "content-type": TIPOS[path.extname(archivo).toLowerCase()] || "application/octet-stream", "cache-control": "no-store" });
    fs.createReadStream(archivo).pipe(res);
  });
}).listen(PUERTO, () => console.log(`Sirviendo ${RAIZ} en http://localhost:${PUERTO}/`));
