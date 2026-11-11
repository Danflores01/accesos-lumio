// Instala (o actualiza) la guardia de SparkEd en esta computadora: copia la skill y el agente de esta carpeta a la
// carpeta de usuario de Claude, para que estén disponibles en cualquier sesión nueva.
//
//   node _guardia/instalar.mjs             instala o actualiza
//   node _guardia/instalar.mjs --revisar   solo dice si lo instalado está al día (código 1 si no)
//
// Lo que manda es esta carpeta (_guardia/, en el repositorio). La copia instalada se pisa completa; solo se conserva
// repo.txt, donde queda anotado dónde está esta copia del repositorio para que la ronda la encuentre.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(AQUI, "..");
const CLAUDE = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude");
const SOLO_REVISAR = process.argv.includes("--revisar");
const PARES = [
  [path.join(AQUI, "skill", "guardia-sparked"), path.join(CLAUDE, "skills", "guardia-sparked")],
  [path.join(AQUI, "agente", "guardia-sparked.md"), path.join(CLAUDE, "agents", "guardia-sparked.md")],
];

const listar = (base, rel = "") => !fs.existsSync(path.join(base, rel)) ? [] : fs.statSync(path.join(base, rel)).isFile() ? [rel] : fs.readdirSync(path.join(base, rel)).flatMap((n) => listar(base, path.join(rel, n)));
// Se comparan sin distinguir finales de línea: Git puede cambiarlos al bajar el repositorio.
const leer = (archivo) => { try { return fs.readFileSync(archivo, "utf8").replace(/\r\n/g, "\n"); } catch { return null; } };

let distintos = 0, copiados = 0;
for (const [origen, destino] of PARES) {
  if (!fs.existsSync(origen)) { console.log("FALTA en el repositorio: " + path.relative(REPO, origen)); process.exit(2); }
  const archivos = listar(origen);
  for (const rel of archivos) {
    const de = path.join(origen, rel), a = path.join(destino, rel);
    if (leer(de) === leer(a)) continue;
    distintos++;
    if (SOLO_REVISAR) { console.log("atrasado: " + path.join(path.basename(destino), rel)); continue; }
    fs.mkdirSync(path.dirname(a), { recursive: true });
    fs.copyFileSync(de, a); copiados++;
  }
  // Lo que ya no existe en el repositorio se quita de la copia instalada (menos repo.txt).
  if (fs.existsSync(destino) && fs.statSync(destino).isDirectory()) {
    for (const rel of listar(destino)) {
      if (rel === "repo.txt" || archivos.includes(rel)) continue;
      distintos++;
      if (SOLO_REVISAR) console.log("sobra: " + path.join(path.basename(destino), rel)); else fs.rmSync(path.join(destino, rel), { force: true });
    }
  }
}
if (SOLO_REVISAR) {
  console.log(distintos ? `La guardia instalada está atrasada (${distintos} archivo(s)). Actualízala: node _guardia/instalar.mjs` : "La guardia instalada está al día.");
  process.exit(distintos ? 1 : 0);
}
fs.writeFileSync(path.join(PARES[0][1], "repo.txt"), REPO + "\n");
console.log(`Guardia de SparkEd instalada en ${CLAUDE}`);
console.log(`  skill:  ${path.join("skills", "guardia-sparked")} (${listar(PARES[0][0]).length} archivos)`);
console.log(`  agente: ${path.join("agents", "guardia-sparked.md")}`);
console.log(`  ${copiados ? copiados + " archivo(s) copiados o actualizados" : "ya estaba al día"} · copia del repositorio anotada en repo.txt`);
console.log("Estará disponible en las sesiones nuevas de Claude. Para probarla: node " + path.join(PARES[0][1], "scripts", "ronda.mjs"));
