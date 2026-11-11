// Prueba local (sin IA) de los ayudantes nuevos de pipeline.ts: tope de slides, pistas largas, variedad y correcciones.
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const repo = process.argv[2];
const dir = mkdtempSync(join(tmpdir(), "pp-"));
const pipe = readFileSync(join(repo, "funciones/sparked/pipeline.ts"), "utf8").replace(`import { jsonrepair } from "npm:jsonrepair@3";`, `const jsonrepair = (s: string) => s;`);
writeFileSync(join(dir, "pipeline.ts"), pipe);
writeFileSync(join(dir, "prompts.ts"), readFileSync(join(repo, "funciones/sparked/prompts.ts"), "utf8"));
const P: any = await import(pathToFileURL(join(dir, "pipeline.ts")).href);
const PR: any = await import(pathToFileURL(join(dir, "prompts.ts")).href);
let fallos = 0;
const ok = (c: boolean, m: string) => { console.log((c ? "OK   " : "FALLA") + " " + m); if (!c) fallos++; };

// 1. Plan excesivo: 4 bloques, 4 pistas y 7 juegos cada uno → se recorta a ≤ 25.
const juegos = { opcion_multiple: 7, completar: 3, verdadero_falso: 5, super_dato: 1, conceptos: 6, ordenar: 2, clasificar: 1, quien_es_quien: 0, duelo: 6 };
const plan: any = { presupuesto_slides: 35, slides_estimados: 40, justificacion_slides: "", primera_actividad: "duelo",
  bloques: [1, 2, 3, 4].map((i) => ({ id: `b${i}`, titulo: `B${i}`, pistas: ["a", "b", "c", "d"], juegos: { ...juegos }, mini_examen: 6, orden_actividades: ["opcion_multiple", "conceptos", "mini_examen"], ids_inventario: [`x${i}`] })) };
ok(P.estimarSlidesPlan(plan) > 25, `plan inicial ${P.estimarSlidesPlan(plan)} slides`);
const notas = P.ajustarPlan(plan);
ok(P.estimarSlidesPlan(plan) <= 25, `plan ajustado ${P.estimarSlidesPlan(plan)} slides (${notas.length} recortes)`);
ok(plan.presupuesto_slides === 25, "presupuesto = 25 sin justificación");
ok(plan.bloques.every((pb: any) => pb.orden_actividades.length >= 2), "cada bloque conserva 2 juegos o más");
const firmas = new Set(plan.bloques.map((pb: any) => pb.orden_actividades.join(",")));
ok(firmas.size > 1 || plan.bloques.length < 2, "las secuencias no son todas iguales: " + [...firmas].join(" | "));
ok(plan.bloques.every((pb: any) => pb.orden_actividades.every((x: string) => x !== "completar")), "completar va junto con opción múltiple");
console.log("   ", notas.join("; "));
// Justificado: tope hasta 30.
ok(P.topeDe({ justificacion_slides: "Los apuntes tienen 6 temas distintos que entran al examen", presupuesto_slides: 29 }) === 29, "justificado → 29");
ok(P.topeDe({ justificacion_slides: "Los apuntes tienen 6 temas distintos que entran al examen", presupuesto_slides: 40 }) === 30, "justificado nunca pasa de 30");

// 2. Variedad: la sugerencia cambia con la semilla.
const sug = new Set(["a", "b", "c", "d", "e", "f", "g", "h"].map((s) => P.sugerenciaVariedad(P.semillaDe(crypto.randomUUID() + s)).match(/"(\w+)"/)[1]));
ok(sug.size >= 3, "sugerencias de primera actividad distintas: " + [...sug].join(", "));
ok(PR.ESQUEMA_PLAN.properties.bloques.items.properties.juegos.required.includes("duelo"), "el esquema del plan conoce el duelo");
ok(PR.PLANIFICADOR.includes("duelo") && PR.GENERADOR.includes("\"duelo\""), "planificador y generador conocen el duelo");

// 3. Pistas largas.
const corta = { id: "b1p1", titulo: "Used to", ideas: ["Used to: hábito del pasado que ya no ocurre.", "Would: acción repetida en el pasado."] };
const larga = { id: "b1p2", titulo: "Word formation con sufijos y prefijos", ideas: Array.from({ length: 8 }, (_, i) => `Sufijo ${i}: forma sustantivos a partir de verbos comunes del inglés.`), ejemplo: "happy → happiness", clave: "Sufijos: cambian la clase de palabra", personajes: [] };
ok(P.problemaDePista(corta) === null, "una pista corta cabe");
ok(!!P.problemaDePista(larga), "una pista de 8 ideas no cabe: " + P.problemaDePista(larga));
const piezas = P.dividirPistaCodigo(larga);
ok(piezas.length >= 2 && piezas.every((p: any) => !P.problemaDePista(p)), `se divide en ${piezas.length} piezas que sí caben`);
ok(piezas[0].id === "b1p2" && piezas[1].id === "b1p2_2" && piezas.at(-1).ejemplo && !piezas[0].ejemplo, "ids de continuación y ejemplo al final");
ok(P.problemaDePista({ titulo: "x", ideas: ["Clave: " + "palabra ".repeat(22)] })?.includes("idea"), "una idea de 23 palabras no cabe");

// 4. Recorte de la guía real.
const act = (id: string, tipo: string, extra = {}) => ({ id, tipo, ...extra });
const bloque = (i: number) => ({ id: `b${i}`, pistas: [{ id: `b${i}p1`, titulo: "A", ideas: ["A: uno"] }, { id: `b${i}p2`, titulo: "B", ideas: ["B: dos"] }, { id: `b${i}p3`, titulo: "C", ideas: ["C: tres"] }],
  actividades: [act(`b${i}om1`, "opcion_multiple"), act(`b${i}vf1`, "verdadero_falso"), act(`b${i}c1`, "conceptos", { pares: [{ termino: "a", definicion: "1" }] }), act(`b${i}c2`, "conceptos", { pares: [{ termino: "b", definicion: "2" }] }), act(`b${i}or1`, "ordenar"), act(`b${i}du1`, "duelo")], mini_examen: [act(`b${i}me1`, "opcion_multiple")] });
const bloques = [1, 2, 3].map(bloque);
const antes = P.estimarSlides(bloques);
const rec = P.recortarBloques(bloques, 25);
ok(antes > 25 && P.estimarSlides(bloques) <= 25, `guía real ${antes} → ${P.estimarSlides(bloques)} slides`);
ok(rec.some((n: string) => n.includes("fusionad")), "primero fusiona (conceptos o pistas cortas)");
console.log("   ", rec.join("; "));

// 5. Correcciones: una que no es de ninguna actividad aparece UNA sola vez.
const src = readFileSync(join(dir, "pipeline.ts"), "utf8");
ok(!/\?\? b\.pistas\[0\];\s*\n\s*if \(pista\) \{ pista\.correcciones/.test(src), "ya no se pega en la primera pista de cada bloque");
const bs = [1, 2, 3].map((i) => ({ id: `b${i}`, pistas: [{ id: `b${i}p1`, titulo: i === 2 ? "Word formation" : "Otro tema", ideas: [i === 2 ? "Word formation: sufijos y prefijos forman palabras nuevas" : "Habits: used to"] }], actividades: [], mini_examen: [] }));
const ts = P;
const lugar = ts.pistaDeCorreccion(bs, "inventario12", { decia_la_foto: "Word formation es la parte 1", dato_correcto: "Word formation es la parte 3", afirmacion: "Word formation" });
ok(lugar?.pista?.id === "b2p1", "la corrección suelta va a la pista que habla de lo mismo (" + lugar?.pista?.id + ")");
const lugar2 = ts.pistaDeCorreccion(bs, "b3p1", {});
ok(lugar2?.pista?.id === "b3p1", "la corrección de una pista va a esa pista");


// 6. Formatos frecuentes de la IA y motivos de descarte.
const ops = ["was", "used to", "would", "use to"];
for (const [v, esp] of [[1, 1], ["2", 2], ["B", 1], ["used to", 1], ["b) used to", 1], ["nada", -1]] as any) ok(P.indiceCorrecta(v, ops) === esp, "correcta " + JSON.stringify(v) + " → " + esp);
const om: any = { id: "b2om1", tipo: "opcion_multiple", pregunta: "I ___ play football every day as a child.", opciones: [{ texto: "was" }, "used to", "would", "use to", "am"], correcta: "used to" };
P.normalizarActividad(om, "en");
ok(om.opciones.length === 4 && om.opciones[om.correcta] === "used to" && !!om.retro_incorrecta, "opciones como objetos, 5 opciones, correcta como texto y sin retro: se arregla (" + om.retro_incorrecta + ")");
const vf: any = { tipo: "verdadero_falso", es_verdadera: "False" }; P.normalizarActividad(vf, "en"); ok(vf.es_verdadera === false, "verdadero o falso como texto");
const co: any = { tipo: "completar", enunciado: "She ___ to the noise.", opciones: ["got used", "use", "uses"], correcta: 0 }; P.normalizarActividad(co); ok(co.respuesta === "got used" && co.distractores.length === 2, "completar con opciones en vez de respuesta y distractores");
const cp: any = { tipo: "conceptos", pares: { "green with envy": "celoso", "red tape": "burocracia", "feel blue": "triste" } }; P.normalizarActividad(cp); ok(cp.pares.length === 3 && cp.pares[0].termino === "green with envy", "parejas como objeto");
// 7. Reparto de actividades reparadas.
const bl = [{ id: "b1", pistas: [{ id: "b1p1" }], actividades: [1, 2, 3, 4, 5, 6] }, { id: "b2", pistas: [{ id: "b2p1" }, { id: "b2p2" }], actividades: [1] }, { id: "b3", pistas: [{ id: "b3p1" }], actividades: [1, 2] }];
ok(P.bloqueDeNueva(bl, { id: "r_om1", pista: "b2p2" }, []).id === "b2", "por pista");
ok(P.bloqueDeNueva(bl, { id: "r_b3om1" }, []).id === "b3", "por id del bloque en el id");
ok(P.bloqueDeNueva(bl, { id: "r_om9" }, ["Bloque b3: quedaron 2 actividades"]).id === "b3", "sin pista: bloque con hueco");
ok(P.bloqueDeNueva(bl, { id: "r_om9" }, []).id === "b2", "sin pista ni hueco: el bloque más corto, nunca el primero por defecto");

// 8. Tres opciones valen; la primera actividad no se recorta.
const tres: any = { id: "b2om1", tipo: "opcion_multiple", pregunta: "When I was a child, I ___ play outside.", opciones: ["used to", "would", "use to"], correcta: 0, retro_correcta: "x", retro_incorrecta: "y" };
ok(P.normalizarActividad && (() => { const m: any[] = []; const src = readFileSync(join(dir, "pipeline.ts"), "utf8"); return /a.opciones.length < 3 || a.opciones.length > 4/.test(src); })(), "opción múltiple con 3 opciones es válida");
const bp = [1, 2].map((i) => ({ id: "b" + i, pistas: [{ id: "p1", titulo: "A", ideas: ["A: x"], esquema: { elementos: [1] } }, { id: "p2", titulo: "B", ideas: ["B: y"], esquema: { elementos: [1] } }], actividades: [act("om" + i, "opcion_multiple"), act("sd" + i, "super_dato"), act("vf" + i, "verdadero_falso"), act("cl" + i, "clasificar")], mini_examen: [] }));
P.recortarBloques(bp, 5 + 2 * 2 + 2 * 3 - 1, "juvenil", "super_dato");
ok(bp[0].actividades.some((a: any) => a.tipo === "super_dato"), "el súper dato elegido como primera actividad sigue en el bloque 1");

// 9. Idioma forzado.
ok(P.idiomaForzado({ opciones: { idioma_guia: "ES" } }) === "es" && P.idiomaForzado({ opciones: { idioma_guia: "de" } }) === null && P.idiomaForzado({}) === null, "idioma forzado solo es, en o fr");
ok(P.notaIdioma("es").includes("español") && P.notaIdioma("es").includes("TAL CUAL") && P.notaIdioma(null) === "", "nota de idioma para la IA");

// 10. Parejas sueltas se juntan.
const sueltas = [1, 2, 3, 4].map((i) => ({ id: "b1cn" + i, tipo: "conceptos", pares: [{ termino: "t" + i, definicion: "d" + i }] }));
const fus = P.fusionarParejas([{ id: "om", tipo: "opcion_multiple" }, ...sueltas]);
ok(fus.length === 2 && fus[1].pares.length === 4 && fus[1].id === "b1cn1", "4 conceptos de 1 pareja → 1 juego de 4 parejas");


// ---------- Criterios del 8 nov 2026 ----------
// 11. Variedad: orden al azar con semilla, sin dos tipos iguales seguidos (también entre bloques), bloque 1 con dos
// formatos, mecánicas válidas y mínimos en el plan.
const MEC = PR.MECANICAS_QUIZ;
const planAzar = (s: number) => ({ presupuesto_slides: 25, justificacion_slides: "", primera_actividad: ["calentamiento", "conceptos", "duelo", "verdadero_falso"][s % 4], reto_final: 3,
  bloques: [1, 2, 3].map((i) => ({ id: `b${i}`, titulo: `B${i}`, pistas: ["a", "b"], ids_inventario: i === 1 ? ["dat1", "dat2"] : ["voc3", "cat4"], mecanica_quiz: ["carrera", "carrera", "carrera"][i - 1],
    juegos: i === 1 ? { opcion_multiple: 3, completar: 1, verdadero_falso: 0, conceptos: 0, clasificar: 0, ordenar: 0, duelo: 0, super_dato: 0, quien_es_quien: 0 } : { opcion_multiple: 6, completar: 2, verdadero_falso: 3, conceptos: 3, clasificar: 1, ordenar: 0, duelo: 2, super_dato: 0, quien_es_quien: 0 },
    mini_examen: i === 3 ? 2 : 0, orden_actividades: [] })) });
let seguidos = 0, b1sinVariedad = 0, mecMal = 0, minMal = 0, firmasAzar = new Set<string>();
for (let s = 1; s <= 60; s++) {
  const p: any = planAzar(s * 7919);
  P.ajustarPlan(p, s * 7919);
  const ords = p.bloques.map((pb: any) => pb.orden_actividades);
  firmasAzar.add(ords.map((o: string[]) => o.join(">")).join("|"));
  for (let i = 0; i < ords.length; i++) { for (let k = 1; k < ords[i].length; k++) if (ords[i][k] === ords[i][k - 1]) seguidos++; if (i && ords[i][0] === ords[i - 1].at(-1)) seguidos++; }
  const b1 = p.bloques[0];
  if (!P.VARIEDAD_B1.some((k: string) => b1.juegos[k] > 0) || b1.juegos.opcion_multiple + b1.juegos.completar < 5) b1sinVariedad++;
  if (b1.mecanica_quiz === "carrera" || p.bloques.some((pb: any, i: number) => !MEC.includes(pb.mecanica_quiz) || (i && pb.mecanica_quiz === p.bloques[i - 1].mecanica_quiz) || (pb.juegos.duelo > 0 && pb.mecanica_quiz === "duelo"))) mecMal++;
  for (const pb of p.bloques) { const j = pb.juegos; if ((j.opcion_multiple + j.completar > 0 && j.opcion_multiple + j.completar < 5) || (j.verdadero_falso > 0 && j.verdadero_falso < 5) || (j.duelo > 0 && (j.duelo < 5 || j.duelo > 7)) || (j.conceptos > 0 && j.conceptos < 4) || (pb.mini_examen > 0 && pb.mini_examen < 5)) minMal++; }
  if (p.reto_final < 5) minMal++;
  if (p.primera_actividad !== "calentamiento" && ords[0][0] !== p.primera_actividad) seguidos += 100;
  if (ords.some((o: string[]) => o.includes("mini_examen") && o.at(-1) !== "mini_examen")) seguidos += 1000;
}
ok(seguidos === 0, `60 planes al azar: ningún tipo repetido seguido (ni entre bloques), primera actividad y mini-examen al final (${seguidos})`);
ok(firmasAzar.size >= 20, `el orden cambia con la semilla (${firmasAzar.size} órdenes distintos en 60 guías)`);
ok(b1sinVariedad === 0, "el bloque 1 siempre trae opción múltiple (≥ 5) y otro formato (conceptos, clasificar, V/F u ordenar)");
ok(mecMal === 0, "mecanica_quiz válida: bloque 1 nunca carrera, nunca la misma en bloques seguidos, nunca duelo si ya hay duelo");
ok(minMal === 0, "mínimos en el plan: OM+completar ≥ 5, V/F ≥ 5, duelo 5–7, conceptos ≥ 4, mini 0 o ≥ 5, reto ≥ 5");
const mismo1: any = planAzar(42), mismo2: any = planAzar(42); P.ajustarPlan(mismo1, 42); P.ajustarPlan(mismo2, 42);
ok(JSON.stringify(mismo1.bloques.map((b: any) => [b.orden_actividades, b.mecanica_quiz])) === JSON.stringify(mismo2.bloques.map((b: any) => [b.orden_actividades, b.mecanica_quiz])), "misma semilla → mismo orden (la guía no cambia si se vuelve a armar)");
ok(PR.ESQUEMA_PLAN.properties.bloques.items.required.includes("mecanica_quiz") && PR.PLANIFICADOR.includes("mecanica_quiz"), "el plan pide mecanica_quiz por bloque");
// El plan del punto 1 (recortado a 25) conserva en el bloque 1 un formato distinto de la opción múltiple.
ok(P.VARIEDAD_B1.some((k: string) => plan.bloques[0].juegos[k] > 0), "aun recortando por slides, el bloque 1 conserva otro formato");
// Adyacencias en el armado.
const ords2 = [["opcion_multiple", "conceptos"], ["conceptos", "verdadero_falso", "mini_examen"], ["verdadero_falso"], ["verdadero_falso", "clasificar"]];
P.arreglarAdyacencias(ords2);
ok(ords2.every((o, i) => !i || o[0] !== ords2[i - 1].at(-1)), "arreglarAdyacencias: " + ords2.map((o) => o.join(">")).join(" | "));

// 12. Mínimo de preguntas: faltas, descarte entero y pedido reducido sin bajar del mínimo.
const preg = (id: string, tipo: string) => ({ id, tipo, pregunta: "¿Qué es?", opciones: ["a", "b", "c", "d"], correcta: 0, retro_correcta: "x", retro_incorrecta: "y" });
const bc: any = { id: "b2", pistas: [{ id: "b2p1" }], actividades: [preg("o1", "opcion_multiple"), preg("o2", "opcion_multiple"), preg("o3", "completar"), { id: "v1", tipo: "verdadero_falso" }, { id: "v2", tipo: "verdadero_falso" },
  { id: "c1", tipo: "conceptos", pares: [1, 2, 3].map((n) => ({ termino: "t" + n, definicion: "d" + n })) }, { id: "k1", tipo: "clasificar", grupos: ["A", "B"], elementos: [0, 1, 0, 1, 0].map((g, n) => ({ texto: "e" + n, grupo: g })) },
  ...[1, 2, 3, 4, 5].map((n) => preg("d" + n, "duelo"))], mini_examen: [preg("m1", "opcion_multiple")] };
const fl = P.faltasDeBloque(bc);
ok(fl.length === 5 && fl.some((f: any) => f.juego === "opcion_multiple" && f.tiene === 3) && fl.some((f: any) => f.id === "c1" && f.minimo === 4) && fl.some((f: any) => f.id === "k1" && f.minimo === 6) && !fl.some((f: any) => f.juego === "duelo"), "faltas: OM 3, V/F 2, conceptos 3 parejas, clasificar 5 tarjetas, mini 1 (duelo de 5 sí cumple)");
ok(P.textoFalta(bc, fl[0]).startsWith("MÍNIMO"), "los huecos de mínimos van primero: " + P.textoFalta(bc, fl[0]));
const dsc: any[] = []; P.descartarCortos(bc, dsc, "prueba");
ok(bc.actividades.length === 5 && bc.actividades.every((a: any) => a.tipo === "duelo") && bc.mini_examen.length === 0 && dsc.length === 5, "lo que sigue corto se descarta ENTERO con su motivo (" + dsc.map((d: any) => d.id).join(", ") + ")");
const mi = P.mitadConMinimos({ juegos: { opcion_multiple: 7, completar: 3, verdadero_falso: 6, duelo: 6, conceptos: 6, clasificar: 1 }, mini_examen: 6 });
ok(mi.juegos.opcion_multiple + mi.juegos.completar >= 5 && mi.juegos.verdadero_falso === 5 && mi.juegos.duelo === 5 && mi.juegos.conceptos === 4 && mi.mini_examen === 0, "pedido reducido (respuesta cortada) sin bajar de los mínimos");
// Reparación: completa con el mismo tipo; nunca tipos nuevos; ampliaciones de parejas y tarjetas.
const br: any[] = [{ id: "b1", pistas: [{ id: "b1p1" }], actividades: [preg("x1", "opcion_multiple"), { id: "b1cn1", tipo: "conceptos", pares: [{ termino: "a", definicion: "1" }, { termino: "b", definicion: "2" }, { termino: "c", definicion: "3" }] }, { id: "b1cl1", tipo: "clasificar", grupos: ["A", "B"], elementos: [{ texto: "p", grupo: 0 }, { texto: "q", grupo: 1 }] }], mini_examen: [] }];
const rep = P.aplicarReparacion(br, { actividades_nuevas: { opcion_multiple: [{ ...preg("r_b1om1", "opcion_multiple"), pista: "b1p1" }], verdadero_falso: [{ id: "r_b1vf1", afirmacion: "Algo", es_verdadera: true, pista: "b1p1", retro_correcta: "x", retro_incorrecta: "y" }], mini_examen: [{ ...preg("r_b1me1", "x"), pista: "b1p1" }] },
  ampliaciones: [{ id: "b1cn1", pares: [{ termino: "d", definicion: "4" }, { termino: "a", definicion: "repetida" }] }, { id: "b1cl1", elementos: [{ texto: "r", grupo: 0 }, { texto: "s", grupo: 1 }, { texto: "t", grupo: 1 }, { texto: "u", grupo: 0 }] }] }, [], "secundaria", "es", []);
ok(br[0].actividades.some((a: any) => a.id === "r_b1om1") && !br[0].actividades.some((a: any) => a.tipo === "verdadero_falso") && rep.descartes.some((d: any) => /no tiene/.test(d.motivo)) && rep.descartes.length === 2, "reparar completa con el mismo tipo y rechaza tipos nuevos (V/F y mini-examen que el bloque no tenía)");
ok(br[0].actividades.find((a: any) => a.id === "b1cn1").pares.length === 4 && br[0].actividades.find((a: any) => a.id === "b1cl1").elementos.length === 6 && P.faltasDeBloque(br[0]).length === 1, "ampliaciones: conceptos llega a 4 parejas (sin repetir), clasificar a 6 tarjetas; solo falta la OM");
ok(/MÍNIMOS/.test(PR.GENERADOR) && /MÍNIMOS/.test(PR.PLANIFICADOR) && /ampliaciones/.test(PR.REPARADOR) && /MISMO tipo/.test(PR.REPARADOR), "mínimos en los prompts del planificador, escritor y reparador");

// 13. Vista previa con dos formatos y sin carrera en el bloque 1.
const cvp: any = { version_formato: "1.3", plan: { bloques_plan: [] }, calentamiento: ["o1", "o2", "o3", "o4", "o5"], primera_actividad: "calentamiento",
  bloques: [{ id: "b1", titulo: "B1", mecanica_quiz: "montana", orden: ["conceptos", "opcion_multiple", "verdadero_falso"], pistas: [{ id: "p" }], actividades: [...[1, 2, 3, 4, 5, 6, 7].map((n) => preg("o" + n, "opcion_multiple")), { id: "cn", tipo: "conceptos", pares: [] }, ...[1, 2, 3, 4, 5].map((n) => ({ id: "v" + n, tipo: "verdadero_falso" }))], mini_examen: [] }] };
const vp = P.recortarVistaPrevia(cvp);
const tiposVp = new Set(vp.bloques[0].actividades.map((a: any) => a.tipo));
ok(tiposVp.has("opcion_multiple") && tiposVp.has("conceptos") && vp.bloques[0].orden.join(",") === "conceptos,opcion_multiple" && vp.calentamiento.length === 0 && vp.bloques[0].pistas.length === 1 && vp.bloques[0].mecanica_quiz === "montana", "vista previa (4 slides): una pista, OM + conceptos con su orden y su mecánica, sin calentamiento");

// 14. 25 páginas.
const idx = readFileSync(join(repo, "funciones/sparked/index.ts"), "utf8");
ok(/const PAGINAS_MAX = 25;/.test(idx) && /hasta \$\{PAGINAS_MAX\} páginas/.test(idx), "se aceptan 25 páginas y el mensaje usa el máximo");
ok(/const FOTOS_POR_LOTE = 2;/.test(src), "25 páginas = 13 pasos de lectura de 2 fotos (cada uno cabe en 150 s)");

// 15. Verificador: un id por corrección; "no_confirmada" no quita nada.
const bv: any[] = [{ id: "b2", pistas: [{ id: "b2p2", titulo: "T", ideas: ["X: y"] }], actividades: [{ id: "b2vf3", tipo: "verdadero_falso", pista: "b2p2" }, { id: "b2c2", tipo: "conceptos", pista: "b2p2" }], mini_examen: [] }];
ok(JSON.stringify(P.idsDeVerificacion(bv, "b2p2, b2vf3, b2c2")) === '["b2p2","b2vf3","b2c2"]' && JSON.stringify(P.idsDeVerificacion(bv, "b2vf3 (pregunta)")) === '["b2vf3"]', "varios ids en una entrada se separan");
for (const id of P.idsDeVerificacion(bv, "b2vf3, b2c2")) P.aplicarCorreccion(bv, id, { dato_correcto: "Z", decia_la_foto: "Y" });
ok(bv[0].actividades.length === 0 && bv[0].pistas[0].correcciones.length === 1, "corregida: se quitan las actividades con el dato malo y la pista lo muestra una sola vez");
ok(!/no_confirmada"\) for/.test(src) && /no_confirmada" solo queda en el reporte/.test(src) && /UN SOLO id/.test(PR.VERIFICADOR), "no_confirmada ya no quita actividades; el prompt pide un id por entrada");

// 16. Gramática y revisión ortográfica.
for (const k of ["PLANIFICADOR", "GENERADOR", "REPARADOR", "CORRECTOR"]) ok(PR[k].includes("\"examen\" NO lleva tilde") && PR[k].includes("¿") && PR[k].includes("\"sí\""), `regla de gramática con ejemplos en ${k}`);
ok(P.cambioOrtografico("Que significa la palabra?", "¿Qué significa la palabra?") && P.cambioOrtografico("los pais que participo", "los países que participaron"), "acepta tildes, signos y concordancia");
ok(!P.cambioOrtografico("La capital es Lima", "La capital de Perú es Lima, fundada en 1535") && !P.cambioOrtografico("Para el examen", "Para el exámen") && !P.cambioOrtografico("El ___ es rojo", "El color es rojo"), "rechaza cambios de contenido, \"exámen\" y huecos borrados");
const Dg: any = { plan: { materia: "Historia", identidad: { titulo: "Repaso para el exámen", objetivos: ["Entender las causas"] } }, bloques: [{ id: "b1", titulo: "B", pistas: [{ id: "b1p1", titulo: "Causas", ideas: ["Causa: algo"] }], actividades: [{ id: "b1om1", tipo: "opcion_multiple", pregunta: "Cual fue la causa?", opciones: ["la guerra", "la paz"], correcta: 0 }], mini_examen: [] }] };
const reg = P.textosDeGuia(Dg);
ok(P.corregirFijas(reg) === 1 && Dg.plan.identidad.titulo === "Repaso para el examen", "\"exámen\" se corrige siempre por código");
const ap = P.aplicarOrtografia(reg, [{ ruta: "b1om1.pregunta", texto: "¿Cuál fue la causa?" }, { ruta: "b1om1.opciones.0", texto: "la Primera Guerra Mundial" }, { ruta: "nada", texto: "x" }]);
ok(Dg.bloques[0].actividades[0].pregunta === "¿Cuál fue la causa?" && ap.aplicadas.length === 1 && ap.rechazadas.length === 2, "aplica solo correcciones ortográficas en rutas conocidas");
const regL = P.textosDeGuia({ plan: { materia: "Inglés", es_lengua_extranjera: true, identidad: {} }, bloques: [{ id: "b1", pistas: [], actividades: [{ id: "x", tipo: "opcion_multiple", pregunta: "I ___ play.", opciones: ["used to", "use to"] }], mini_examen: [] }] });
ok(!Object.keys(regL).some((k) => k.includes("opciones")) && Object.keys(regL).includes("x.pregunta"), "en guías de lengua no se tocan las opciones (distractores a propósito)");

// 17. Duelo como lista del bloque e imágenes de Wikimedia a 960 px.
ok(/"duelo" va vacío/.test(PR.GENERADOR) && !/"actividades": \{[^]*"duelo": \[/.test(PR.GENERADOR.split("\"mini_examen\": [ {")[0].split("\"actividades\": {")[1] ?? ""), "el escritor pone el duelo en la lista del bloque, no dentro de actividades");
ok(P.urlWikimedia("https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Benito_Ju%C3%A1rez.jpg/400px-Benito_Ju%C3%A1rez.jpg", 2000) === "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Benito_Ju%C3%A1rez.jpg/960px-Benito_Ju%C3%A1rez.jpg", "miniatura a 960 px en upload.wikimedia.org");
ok(P.urlWikimedia("https://upload.wikimedia.org/wikipedia/commons/a/ab/X.jpg", 500) === "https://upload.wikimedia.org/wikipedia/commons/a/ab/X.jpg" && P.urlWikimedia("https://upload.wikimedia.org/wikipedia/commons/1/12/M.svg", 300)?.endsWith("/960px-M.svg.png") && P.urlWikimedia("https://thumb.wikimedia.org/x.jpg") === null, "original si mide ≤ 960 px; SVG como PNG; otros dominios no");
// Armado de un cartucho sin base de datos: duelo a su lista, mínimos, sin tipos repetidos seguidos, mecánica.
const falso: any = { from: () => ({ update: () => ({ eq: async () => ({ error: null }) }) }) };
const tA: any = { id: "t1", alcance: "completa", paso: "armar", estado: "corriendo", datos: { plan: { identidad: { titulo: "T" }, primera_actividad: "calentamiento", reto_final: 16, puntos_dificiles: [],
  bloques: [{ id: "b1", orden_actividades: ["opcion_multiple", "conceptos"], mecanica_quiz: "montana" }, { id: "b2", orden_actividades: ["conceptos", "duelo", "opcion_multiple"], mecanica_quiz: "castillo" }] },
  bloques: [{ id: "b1", titulo: "B1", pistas: [{ id: "b1p1" }], actividades: [...[1, 2, 3, 4, 5, 6].map((n) => preg("b1o" + n, "opcion_multiple")), { id: "b1cn", tipo: "conceptos", pares: [1, 2, 3, 4].map((n) => ({ termino: "t" + n, definicion: "d" + n })) }], mini_examen: [preg("b1m", "opcion_multiple")] },
    { id: "b2", titulo: "B2", pistas: [{ id: "b2p1" }], actividades: [...[1, 2, 3, 4, 5].map((n) => preg("b2o" + n, "opcion_multiple")), { id: "b2cn", tipo: "conceptos", pares: [1, 2, 3, 4].map((n) => ({ termino: "u" + n, definicion: "e" + n })) }, ...[1, 2, 3, 4, 5].map((n) => preg("b2d" + n, "duelo"))], mini_examen: [] }] } };
await P.ejecutarPaso(falso, tA, { archivos: [], grado: "3° secundaria", materia: "Historia" });
const cA = tA.datos.cartucho;
ok(cA.bloques.every((b: any) => !b.actividades.some((a: any) => a.tipo === "duelo")) && cA.bloques[1].duelo.length === 5 && !cA.bloques[1].duelo[0].tipo && tA.datos.bloques[1].actividades.some((a: any) => a.tipo === "duelo"), "armar: el duelo pasa a bloque.duelo (sin tocar datos.bloques)");
ok(cA.bloques[0].mini_examen.length === 0 && tA.datos.descartes.some((d: any) => d.tipo === "mini_examen"), "armar: el mini-examen de 1 pregunta no se publica");
ok(cA.bloques.every((b: any, i: number) => !i || b.orden[0] !== cA.bloques[i - 1].orden.at(-1)) && cA.bloques[0].mecanica_quiz === "montana", "armar: " + cA.bloques.map((b: any) => b.orden.join(">")).join(" | "));
ok(cA.calentamiento.length >= 5 && cA.reto_final.length >= 5 && cA.slides_estimados > 0, `armar: calentamiento ${cA.calentamiento.length} y reto final ${cA.reto_final.length} preguntas (≥ 5)`);

// ---------- Entrega (9 nov 2026): verificación final y vista4 previa de 4 slides ----------
const cBueno: any = JSON.parse(JSON.stringify(cA)); cBueno.completo = true; cBueno.bloques.forEach((b: any) => b.pistas.forEach((p: any) => { p.titulo = "Pista " + p.id; p.ideas = ["Una idea."]; }));
ok(P.verificarCartucho(cBueno).length === 0, "verificación: el cartucho armado pasa · " + P.verificarCartucho(cBueno).join(" | "));
ok(P.verificarCartucho({ ...cBueno, completo: false }).some((x: string) => /completa/.test(x)), "verificación: completo !== true no pasa");
ok(P.verificarCartucho({ ...cBueno, bloques: [] }).some((x: string) => /bloques/.test(x)), "verificación: sin bloques no pasa");
ok(P.verificarCartucho(null).length > 0, "verificación: sin cartucho no pasa");
const sinPistas = JSON.parse(JSON.stringify(cBueno)); sinPistas.bloques[0].pistas = [];
ok(P.verificarCartucho(sinPistas).some((x: string) => /pistas/.test(x)), "verificación: bloque sin pistas no pasa");
const tipoRaro = JSON.parse(JSON.stringify(cBueno)); tipoRaro.bloques[0].actividades.push({ id: "zz", tipo: "sopa_de_letras" });
ok(P.verificarCartucho(tipoRaro).some((x: string) => /desconocido/.test(x)), "verificación: tipo de actividad desconocido no pasa");
const corto = JSON.parse(JSON.stringify(cBueno)); corto.bloques[0].actividades = corto.bloques[0].actividades.filter((a: any) => a.tipo !== "opcion_multiple").concat([preg("q1", "opcion_multiple"), preg("q2", "opcion_multiple")]);
ok(P.verificarCartucho(corto).some((x: string) => /mínimo 5/.test(x)), "verificación: juego por debajo del mínimo no pasa");
const dueloCorto = JSON.parse(JSON.stringify(cBueno)); dueloCorto.bloques[1].duelo = dueloCorto.bloques[1].duelo.slice(0, 2);
ok(P.verificarCartucho(dueloCorto).some((x: string) => /duelo/.test(x)), "verificación: duelo de 2 preguntas no pasa");
const enorme = JSON.parse(JSON.stringify(cBueno)); enorme.bloques[0].pistas = Array.from({ length: 40 }, (_, i) => ({ id: "p" + i, titulo: "Pista " + i, ideas: ["x"] }));
ok(P.verificarCartucho(enorme).some((x: string) => /slides/.test(x)), "verificación: demasiadas slides no pasa");
const vista4 = P.recortarVistaPrevia(cBueno);
ok(P.verificarCartucho(vista4).length > 0, "verificación: una vista previa nunca pasa como guía completa");
// Vista previa: una pista, el juego de preguntas y otro formato; sin calentamiento; totales de la guía completa.
const vb4 = vista4.bloques[0];
ok(vista4.bloques.length === 1 && vb4.pistas.length === 1, "vista4 previa: un bloque con UNA pista");
const tiposVp4 = [...new Set(vb4.actividades.map((a: any) => a.tipo === "completar" ? "opcion_multiple" : a.tipo))];
ok(tiposVp4.length === 2 && tiposVp4.includes("opcion_multiple"), "vista4 previa: dos juegos de formato distinto · " + tiposVp4.join(", "));
ok(vista4.calentamiento.length === 0 && !vista4.primera_actividad, "vista4 previa: sin calentamiento");
ok(vista4.bloques_totales === 2 && vista4.actividades_totales >= cBueno.bloques.reduce((n: number, b: any) => n + b.actividades.length, 0), `vista4 previa: el candado conoce la guía completa (${vista4.bloques_totales} bloques, ${vista4.actividades_totales} actividades)`);
const pesada = JSON.parse(JSON.stringify(cBueno)); pesada.bloques[0].pistas = [{ id: "larga", titulo: "Larga", ideas: Array.from({ length: 30 }, () => "Una idea bastante larga para llenar la pista de texto.") }, { id: "corta", titulo: "Corta", ideas: ["Una idea."] }];
ok(P.recortarVistaPrevia(pesada).bloques[0].pistas[0].id === "corta", "vista4 previa: elige una pista que cabe en una página");
const sinQuiz = JSON.parse(JSON.stringify(cBueno)); sinQuiz.bloques[0].actividades = sinQuiz.bloques[0].actividades.filter((a: any) => a.tipo !== "opcion_multiple").concat([{ id: "vf1", tipo: "verdadero_falso", afirmacion: "El dato es cierto.", es_verdadera: true }]);
ok(new Set(P.recortarVistaPrevia(sinQuiz).bloques[0].actividades.map((a: any) => a.tipo)).size === 2, "vista4 previa: sin juego de preguntas, dos formatos distintos");

// ---------- Temas del temario completados con fuentes (Daniel, 11 nov 2026) ----------
// Sin IA de verdad: la API de Claude y la base de datos son de mentira; se revisa lo que el código hace con sus respuestas.
(globalThis as any).Deno = { env: { get: (k: string) => (k === "ANTHROPIC_API_KEY" ? "prueba-sin-llave" : undefined) } };
const pedidos: any[] = [];
let respuestas: any[] = [];
(globalThis as any).fetch = async (_url: string, init: any) => {
  const cuerpo = JSON.parse(init.body); pedidos.push(cuerpo);
  const r = respuestas.shift();
  return r instanceof Response ? r : new Response(JSON.stringify(r), { status: 200, headers: { "content-type": "application/json" } });
};
// usadas: búsquedas que cobra el API (por omisión 2 si hubo páginas); extra: bloques antes del texto (p. ej. un error).
const apiTexto = (j: unknown, urls: string[] = [], usadas?: number, extra: any[] = []) => ({ content: [
  ...(urls.length ? [{ type: "server_tool_use", id: "s1", name: "web_search", input: { query: "x" } }, { type: "web_search_tool_result", tool_use_id: "s1", content: urls.map((url) => ({ type: "web_search_result", url, title: "t" })) }] : []),
  ...extra, { type: "text", text: JSON.stringify(j) }], stop_reason: "end_turn", usage: { input_tokens: 1000, output_tokens: 400, server_tool_use: { web_search_requests: usadas ?? (urls.length ? 2 : 0) } } });

// 18. Qué es práctica del examen (no se investiga) y qué sí es contenido (la EXCEPCIÓN de las habilidades).
ok(P.esPracticaDeExamen("Gapped text: textos de práctica con huecos (esl-lounge, engxam)") && P.esPracticaDeExamen("Listening – Sentence completion: audios de práctica (Test-English)") && P.esPracticaDeExamen("Reading Part 3") && P.esPracticaDeExamen("Speaking"), "práctica del examen: Gapped text, Listening, Reading Part 3 y Speaking no se investigan");
ok(!P.esPracticaDeExamen("Writing: opinion essays") && !P.esPracticaDeExamen("Exam skills: How to answer open questions") && !P.esPracticaDeExamen("Acento normativo") && !P.esPracticaDeExamen("Figuras retóricas"), "contenido: Writing de ensayos, Exam skills (habilidad), Acento normativo y Figuras retóricas sí son temas");
// 19. Temas del plan con su bloque: textos sueltos de planes viejos, repetidos y bloques que no existen.
const planT: any = { bloques: [{ id: "b1", titulo: "Lenguaje figurado", temas: ["Figuras retóricas"], pistas: ["Metáfora"] }, { id: "b2", titulo: "Ortografía", temas: ["Acentos"], pistas: ["Agudas y graves"] }],
  temas_a_investigar: ["Acento normativo: agudas, graves y esdrújulas", { tema: "Figuras retóricas", bloque: "b9", pagina: "45" }, { tema: "figuras retoricas", bloque: "b1", pagina: "" }, { tema: "", bloque: "b1", pagina: "" }] };
const tn = P.normalizarTemas(planT);
ok(tn.length === 2 && tn[0].bloque === "b2" && tn[1].bloque === "b1" && tn[1].pagina === "45", "temas del plan: cada uno con su bloque (por parecido si no existe), sin repetidos ni vacíos · " + JSON.stringify(tn));
ok(PR.ESQUEMA_PLAN.properties.temas_a_investigar.items.required.join(",") === "tema,bloque,pagina" && /Nunca agregues un tema que no esté escrito en las fotos/.test(PR.PLANIFICADOR), "planificador: temas_a_investigar = {tema, bloque, pagina}, solo temas escritos en las fotos");
ok(/1 fuente oficial o 2 fuentes confiables/.test(PR.INVESTIGADOR) && /Wikipedia NO cuenta/.test(PR.INVESTIGADOR) && /libros de texto gratuitos de la SEP/.test(PR.INVESTIGADOR) && /practica_examen/.test(PR.INVESTIGADOR), "investigador: SEP primero, 1 oficial o 2 confiables, sin Wikipedia, ignora la práctica del examen");
ok(P.investigacionActiva({ opciones: { investigar: "si" } }) && !P.investigacionActiva({ opciones: {} }) && !P.investigacionActiva({ opciones: { investigar: "no" } }), "investigación: apagada por omisión; se enciende con investigar = si");
// 20. Fuentes: oficiales, dos sitios distintos, nunca Wikipedia y solo páginas que el buscador devolvió.
const vistas = ["https://www.sep.gob.mx/lenguajes/figuras", "https://www.britannica.com/art/metaphor", "https://www.nationalgeographic.com/x", "https://kids.britannica.com/y", "https://es.wikipedia.org/wiki/Metafora"];
const resV = P.validarInvestigacion({ temas: [
  { tema: "Figuras retóricas", estado: "confirmado", datos: [
    { texto: "Metáfora: identifica un término real con otro imaginario.", fuentes: [{ nombre: "SEP", url: "https://www.sep.gob.mx/lenguajes/figuras/" }] },
    { texto: "Hipérbole: exagera una cualidad para dar énfasis.", fuentes: [{ nombre: "Britannica", url: "https://www.britannica.com/art/metaphor" }, { nombre: "Nat Geo", url: "https://www.nationalgeographic.com/x" }] },
    { texto: "Símil: compara dos cosas usando como.", fuentes: [{ nombre: "Britannica", url: "https://www.britannica.com/art/metaphor" }, { nombre: "Britannica Kids", url: "https://kids.britannica.com/y" }] },
    { texto: "Repetición: repite palabras para dar ritmo.", fuentes: [{ nombre: "Wikipedia", url: "https://es.wikipedia.org/wiki/Metafora" }] },
    { texto: "Personificación: da rasgos humanos a cosas.", fuentes: [{ nombre: "RAE", url: "https://www.rae.es/inventada" }] }] },
  { tema: "Tradición oral", estado: "confirmado", datos: [{ texto: "Coplas: versos breves para cantar.", fuentes: [{ nombre: "SEP", url: "https://www.sep.gob.mx/lenguajes/figuras" }] }] },
  { tema: "Reglamento", estado: "practica_examen", datos: [] }] },
  [{ tema: "Figuras retóricas", bloque: "b1", pagina: "" }, { tema: "Tradición oral", bloque: "b1", pagina: "" }, { tema: "Reglamento", bloque: "b1", pagina: "" }, { tema: "Acento normativo", bloque: "b2", pagina: "" }], vistas);
const [rF, rT, rR, rA] = resV;
ok(rF.estado === "confirmado" && rF.datos.length === 2 && rF.datos[0].fuentes[0].oficial && rF.fuentes.length === 3, "fuentes: 1 oficial basta; 2 sitios distintos también; mismo sitio dos veces, Wikipedia o una página que el buscador no dio, no · " + rF.datos.map((d: any) => d.texto.split(":")[0]).join(", "));
ok(rT.estado === "no_confirmado" && rT.datos.length === 0, "tema con un solo dato confirmado: no se confirma (nota para repasar)");
ok(rR.estado === "no_confirmado" && /práctica/.test(rR.motivo), "la IA dice «práctica del examen» de un tema de contenido: queda como nota, nunca desaparece");
ok(rA.estado === "no_confirmado" && /no respondió/.test(rA.motivo), "tema sin respuesta de la IA: no se confirma");
ok(P.confirmaDato([{ nombre: "a", url: "u", oficial: false, sitio: "britannica.com" }, { nombre: "b", url: "v", oficial: false, sitio: "britannica.com" }]) === false && P.sitioDe("libros.conaliteg.gob.mx") === "conaliteg.gob.mx" && P.esOficial("libros.conaliteg.gob.mx") && P.esOficial("nasa.gov") && !P.esOficial("britannica.com") && !P.dominioPermitido("es.wikipedia.org"), "regla de dos fuentes por sitio; SEP, Conaliteg y .gov son oficiales; Wikipedia no se permite");
ok(P.dominiosRechazados("Error 400: The following domains are not accessible to our user agent: ['bbc.co.uk', 'fundeu.es']").join(",") === "bbc.co.uk,fundeu.es" && P.urlsDeBusqueda(apiTexto({}, ["https://www.rae.es/a"])).join() === "https://www.rae.es/a", "buscador: lee los dominios rechazados y las páginas devueltas");
// 21. Un dominio que el buscador no puede consultar ya no tumba la búsqueda: se quita y se pide otra vez.
pedidos.length = 0;
respuestas = [new Response("The following domains are not accessible to our user agent: ['ejemplo.mx']", { status: 400 }), apiTexto({ ok: true }, ["https://www.rae.es/a"])];
const rD = await P.claude({ sistema: "x", contenido: [{ type: "text", text: "y" }], herramientas: [{ type: "web_search_20260209", name: "web_search", max_uses: 2, allowed_domains: ["rae.es", "ejemplo.mx"] }] });
ok(pedidos.length === 2 && pedidos[1].tools[0].allowed_domains.join() === "rae.es" && rD.json?.ok === true && rD.urls.length === 1, "buscador: el dominio rechazado se quita y la búsqueda sigue");

// 22. El paso completo, con la IA de mentira: investiga 2 temas, ignora la práctica del examen y escribe el bloque.
const vistasF = ["https://www.sep.gob.mx/lenguajes/figuras", "https://www.rae.es/dpd/hiperbole"];
const datosF = ["Metáfora: identifica un término real con otro imaginario.", "Hipérbole: exagera una cualidad para dar énfasis."];
const tG: any = { id: "tg", guia_id: "g1", alcance: "completa", paso: "generar:0", estado: "corriendo", costo_usd: 0, tokens_entrada: 0, tokens_salida: 0, progreso: { pct: 40 }, datos: {
  inventario: { temas: [{ id: "tem1", foto: 1, texto: "Reglamento", cita: "Reglamento" }], datos_clave: [{ id: "dat2", foto: 1, texto: "Reglamento: normas de un grupo", cita: "normas de un grupo" }] }, citas: ["normas de un grupo"], fotos: [{ indice: 1, tipo: "temario" }],
  plan: { idioma_guia: "es", perfil_edad: "caricatura", materia: "Español", apoyo: null, puntos_dificiles: [], temas_a_investigar: [
    { tema: "Figuras retóricas", bloque: "b1", pagina: "45" }, { tema: "Tradición oral", bloque: "b1", pagina: "" }, { tema: "Gapped text: textos de práctica", bloque: "b1", pagina: "" }],
    bloques: [{ id: "b1", titulo: "Lengua y literatura", temas: ["Reglamento"], ids_inventario: ["tem1", "dat2"], pistas: ["Reglamento", "Figuras retóricas", "Tradición oral"], juegos: { opcion_multiple: 5 }, mini_examen: 0 }, { id: "b2", titulo: "B2", ids_inventario: [], pistas: ["X"], juegos: {} }] },
  bloques: [] } };
const fuenteG = { archivos: [], grado: "1° Secundaria", materia: "Español", opciones: { investigar: "si" } };
pedidos.length = 0;
respuestas = [apiTexto({ temas: [
  { tema: "Figuras retóricas", estado: "confirmado", datos: [{ texto: datosF[0], fuentes: [{ nombre: "SEP · Lenguajes 1", url: vistasF[0] }] }, { texto: datosF[1], fuentes: [{ nombre: "RAE · Diccionario panhispánico", url: vistasF[1] }] }] },
  { tema: "Tradición oral", estado: "confirmado", datos: [{ texto: "Coplas: versos breves para cantar.", fuentes: [{ nombre: "INAH", url: "https://www.inah.gob.mx/coplas" }] }, { texto: "Refranes: dichos con una enseñanza.", fuentes: [{ nombre: "INAH", url: "https://www.inah.gob.mx/refranes" }] }] }] }, vistasF, 1)];
const sig1 = await P.ejecutarPaso(falso, tG, fuenteG);
const inv = tG.datos.investigacion ?? [];
const pedInv = pedidos[0];
ok(sig1 === "generar:0" && pedidos.length === 1 && /ERES EL INVESTIGADOR/.test(pedInv.system[0].text) && pedInv.tools[0].max_uses === 2 * P.BUSQUEDAS_POR_TEMA && P.BUSQUEDAS_POR_TEMA === 1 && pedInv.tools[0].allowed_domains.includes("conaliteg.sep.gob.mx") && !/Gapped/.test(pedInv.messages[0].content[0].text), "paso: una llamada de investigación (1 búsqueda por tema) en dominios confiables y sin la práctica del examen");
ok(inv.find((r: any) => /Gapped/.test(r.tema))?.estado === "practica_examen" && inv.find((r: any) => r.tema === "Figuras retóricas")?.estado === "confirmado" && inv.find((r: any) => r.tema === "Tradición oral")?.estado === "no_confirmado", "paso: práctica del examen ignorada; tema con fuentes confirmado; tema con páginas que el buscador no dio, sin confirmar · " + inv.map((r: any) => `${r.tema}=${r.estado}`).join(" | "));
ok((tG.datos.inventario.investigado ?? []).length === 2 && tG.datos.inventario.investigado.every((e: any) => e.bloque === "b1" && e.fuentes.length) && tG.datos.citas.includes(datosF[1]), "paso: lo confirmado entra al inventario del bloque como «investigado» y vale como cita");
respuestas = [apiTexto({ bloque: "b1", pistas: [
  { id: "b1p1", titulo: "Reglamento", emoji: "📜", ideas: ["Reglamento: normas de un grupo."], tema_investigado: null },
  { id: "b1p2", titulo: "Figuras retóricas", emoji: "🎭", ideas: datosF, tema_investigado: "Figuras retóricas" }],
  actividades: { opcion_multiple: [
    { id: "b1om1", pregunta: "¿Qué figura exagera una cualidad?", opciones: ["hipérbole", "metáfora", "símil", "repetición"], correcta: 0, retro_correcta: "¡Sí!", retro_incorrecta: "Es la hipérbole.", pista: "b1p2", fuente: { foto: 0, tipo: "investigado", cita: datosF[1] } },
    { id: "b1om2", pregunta: "¿Qué tiene un reglamento?", opciones: ["normas", "versos", "rimas", "mapas"], correcta: 0, retro_correcta: "¡Sí!", retro_incorrecta: "Tiene normas.", pista: "b1p1", fuente: { foto: 1, tipo: "textual", cita: "normas de un grupo" } }] },
  duelo: [], mini_examen: [] })];
const sig2 = await P.ejecutarPaso(falso, tG, fuenteG);
const pedGen = pedidos[1]?.messages?.[0]?.content?.[0]?.text ?? "";
const bG = tG.datos.bloques[0];
ok(sig2 === "generar:1" && /"investigado":\[/.test(pedGen) && /SIN CONFIRMAR: «Tradición oral»/.test(pedGen) && !/"Tradición oral"\]/.test(pedGen.split("Plan del bloque:")[1].split("Inventario")[0]), "escritor: recibe lo investigado, sabe qué temas no se confirmaron y ya no se le pide la pista de esos");
const pF = bG.pistas.find((p: any) => p.id === "b1p2");
ok(pF?.completado_con_fuentes?.fuentes?.[0]?.nombre === "SEP · Lenguajes 1" && !bG.pistas.find((p: any) => p.id === "b1p1").completado_con_fuentes, "pista del tema investigado marcada «Completado con fuentes» (con sus fuentes); la de los apuntes, no");
ok(bG.actividades.find((a: any) => a.id === "b1om1").fuente.tipo === "investigado" && bG.actividades.find((a: any) => a.id === "b1om1").fuente.nombre === "RAE · Diccionario panhispánico" && bG.actividades.find((a: any) => a.id === "b1om2").fuente.tipo === "textual", "actividad con dato investigado: lleva su fuente (el reproductor ya no dice «De tus notas»)");
const nota = bG.pistas.find((p: any) => p.nota_temario);
ok(nota && nota.ideas.length === 1 && nota.ideas[0] === "Tradición oral: este tema venía en tu temario; repásalo en tu libro." && !bG.pistas.some((p: any) => /Gapped/.test(JSON.stringify(p))), "tema sin confirmar → nota «Este tema venía en tu temario: repásalo en tu libro»; la práctica del examen no aparece");
ok(P.textoNotaTemario({ tema: "Acento normativo", pagina: "45" }) === "Acento normativo: este tema venía en tu temario; repásalo en tu libro (pág. 45)." && P.textoNotaTemario({ tema: "Word order", pagina: "Unit 3" }, "en") === "Word order: this topic was in your syllabus; review it in your textbook (Unit 3)." && P.textoNotaTemario({ tema: "Les nombres", pagina: "12-13" }, "fr") === "Les nombres : ce thème était dans ton programme ; révise-le dans ton manuel (p. 12-13).", "nota del temario con la página que da el temario, en español, inglés y francés");
// Investigación apagada: el bloque se escribe como antes, sin buscar nada.
const tOff: any = JSON.parse(JSON.stringify({ ...tG, paso: "generar:0", datos: { ...tG.datos, investigacion: undefined, bloques: [] } }));
delete tOff.datos.inventario.investigado;
pedidos.length = 0;
respuestas = [apiTexto({ bloque: "b1", pistas: [{ id: "b1p1", titulo: "Reglamento", ideas: ["Reglamento: normas."] }], actividades: {}, duelo: [], mini_examen: [] })];
await P.ejecutarPaso(falso, tOff, { ...fuenteG, opciones: {} });
ok(pedidos.length === 1 && /ERES EL GENERADOR/.test(pedidos[0].system[0].text) && !tOff.datos.bloques[0].pistas.some((p: any) => p.nota_temario), "investigación apagada: nada se busca y la guía sale como antes");
// Tope de temas por guía: los que pasan del tope quedan como nota sin gastar.
const muchos: any = { plan: { bloques: [{ id: "b1" }], temas_a_investigar: Array.from({ length: 11 }, (_, i) => ({ tema: "Tema número " + (i + 1), bloque: "b1", pagina: "" })) } };
const pendM = P.temasPendientes(muchos, "b1");
ok(P.MAX_TEMAS_INVESTIGAR === 6 && pendM.length === P.MAX_TEMAS_INVESTIGAR && muchos.investigacion.length === 11 - P.MAX_TEMAS_INVESTIGAR && muchos.investigacion.every((r: any) => r.estado === "no_confirmado"), `tope: se investigan ${P.MAX_TEMAS_INVESTIGAR} temas por guía; los demás quedan como nota`);
// Las pistas que la reparación divide conservan la marca al armar; cada bloque lleva lo completado y lo que se repasa.
tG.datos.bloques[0].pistas.push({ id: "b1p2_2", titulo: "Figuras retóricas (2)", ideas: ["Símil: compara dos cosas."] });
tG.datos.bloques[0].actividades.push(...[3, 4, 5].map((n) => ({ id: "b1om" + n, tipo: "opcion_multiple", pregunta: "¿P" + n + "?", opciones: ["a" + n, "b", "c", "d"], correcta: 0, retro_correcta: "s", retro_incorrecta: "n", pista: "b1p1", fuente: { foto: 1, tipo: "textual", cita: "normas de un grupo" } })));
tG.datos.bloques[1] = { id: "b2", titulo: "B2", pistas: [{ id: "b2p1", titulo: "X", ideas: ["X: y."] }], actividades: [1, 2, 3, 4, 5].map((n) => ({ id: "b2om" + n, tipo: "opcion_multiple", pregunta: "¿Q" + n + "?", opciones: ["a", "b", "c", "d"], correcta: 1, retro_correcta: "s", retro_incorrecta: "n", pista: "b2p1", fuente: {} })), mini_examen: [] };
tG.datos.plan.identidad = { titulo: "T" }; tG.datos.plan.primera_actividad = "calentamiento"; tG.datos.plan.reto_final = 16;
tG.paso = "armar";
await P.ejecutarPaso(falso, tG, fuenteG);
const cG = tG.datos.cartucho;
ok(cG.bloques[0].pistas.find((p: any) => p.id === "b1p2_2")?.completado_con_fuentes && cG.bloques[0].temas_completados.length === 1 && cG.bloques[0].temas_para_repasar[0].tema === "Tradición oral", "armar: la parte (2) de la pista también va marcada; el bloque lista lo completado y lo que se repasa en el libro");
const vpG = P.recortarVistaPrevia({ ...cG, bloques: [{ ...cG.bloques[0], pistas: [cG.bloques[0].pistas.find((p: any) => p.nota_temario), ...cG.bloques[0].pistas.filter((p: any) => !p.nota_temario)] }] });
ok(!vpG.bloques[0].pistas[0].nota_temario, "vista previa: la pista de muestra es de contenido, nunca la nota del temario");
const bFus: any[] = [{ id: "b1", pistas: [{ id: "a", titulo: "A", ideas: ["A: x"] }, { id: "n", titulo: "Repásalo en tu libro", ideas: ["T: nota"], nota_temario: true }, { id: "c", titulo: "C", ideas: ["C: y"], completado_con_fuentes: { fuentes: [] } }], actividades: [], mini_examen: [] }];
P.recortarBloques(bFus, 3);
ok(bFus[0].pistas.length === 3 && bFus[0].pistas.some((p: any) => p.nota_temario) && bFus[0].pistas.some((p: any) => p.completado_con_fuentes), "recorte de slides: nunca junta una nota del temario ni una pista con fuentes con otra pista");

// 23. «contradice_libro» → un reporte nuevo en el panel, con su bloque y su motivo, sin datos de la familia, una vez.
const insertados: any[] = [];
const falsoR: any = { from: (tabla: string) => ({ update: () => ({ eq: async () => ({ error: null }) }), insert: async (filas: any) => { insertados.push({ tabla, filas }); return { error: null }; } }) };
const tV: any = { id: "tv", guia_id: "g9", alcance: "resto", paso: "verificar", estado: "corriendo", costo_usd: 0, tokens_entrada: 0, tokens_salida: 0, datos: { plan: { idioma_guia: "es", materia: "Español" }, fotos: [{ tipo: "apuntes_a_mano" }], inventario: {},
  bloques: [{ id: "b1", titulo: "Ortografía", pistas: [{ id: "b1p1", titulo: "Acentos", ideas: ["Agudas: llevan tilde si terminan en n, s o vocal."] }], actividades: [{ id: "b1om1", tipo: "opcion_multiple", pregunta: "¿Cuándo lleva tilde una aguda?", opciones: ["n, s o vocal", "siempre"], correcta: 0 }], mini_examen: [] }] } };
respuestas = [apiTexto({ resultados: [
  { actividad: "b1om1", afirmacion: "Las agudas llevan tilde si terminan en n, s o vocal", estado: "contradice_libro", dato_correcto: "Según la RAE, así es; el libro dice otra cosa.", fuentes: ["https://www.rae.es/ortografia/agudas"] },
  { actividad: "b1p1", afirmacion: "x", estado: "verificada" }] }, ["https://www.rae.es/ortografia/agudas"])];
await P.ejecutarPaso(falsoR, tV, { archivos: [], grado: "1° Secundaria", materia: "Español", opciones: {} });
const rep1 = insertados.filter((x) => x.tabla === "reportes").flatMap((x) => x.filas);
ok(rep1.length === 1 && rep1[0].guia_id === "g9" && rep1[0].slide === null && !("acceso_id" in rep1[0]) && /contradice el libro/.test(rep1[0].comentario) && /Bloque 1 «Ortografía» \(b1om1\)/.test(rep1[0].comentario) && /rae\.es/.test(rep1[0].comentario) && !/^AVISO AUTOM/.test(rep1[0].comentario), "contradice el libro: llega a Reportes con bloque, motivo y fuente, sin datos de la familia · " + rep1[0]?.comentario);
tV.paso = "verificar";
respuestas = [apiTexto({ resultados: [{ actividad: "b1om1", afirmacion: "x", estado: "contradice_libro" }] }, [])];
await P.ejecutarPaso(falsoR, tV, { archivos: [], grado: "1° Secundaria", materia: "Español", opciones: {} });
ok(insertados.filter((x) => x.tabla === "reportes").length === 1, "contradice el libro: si el paso se repite, el reporte no se duplica");
ok(P.reportesDeVerificacion([{ estado: "corregida" }, { estado: "no_confirmada" }, { estado: "verificada" }], []).length === 0 && P.reportesDeVerificacion([{ estado: "revisar_dato", afirmacion: "x" }], []).length === 1, "a Reportes van «contradice_libro» y «revisar_dato» (la corregida con fuente, la no confirmada y la verificada, no)");

// 24. El reproductor muestra la marca: caja azul en la pista y la fuente en las preguntas (nunca «De tus notas»).
const leerRepo = (r: string) => readFileSync(join(repo, r), "utf8");
const cartJs = leerRepo("sparked/js/cartucho.js"), teoJs = leerRepo("sparked/js/teoria.js"), uiJs = leerRepo("sparked/js/ui.js");
ok((cartJs.match(/con_fuentes: "/g) ?? []).length === 3 && /"completado_con_fuentes"\]/.test(cartJs) && /caja-fuentes/.test(teoJs) && /fuente\?\.tipo === "investigado"/.test(uiJs) && /\.caja-fuentes/.test(leerRepo("sparked/css/base.css")), "reproductor: «Completado con fuentes» en español, inglés y francés; caja en la pista y fuente en las preguntas");

// 25. Arreglos del 11 nov 2026, antes de encender la investigación (prueba real: preguntas vacías en un bloque sin nada
// confirmado, «Acento normativo» sin ninguna búsqueda, una prueba trabada 22 min y la guía a 0.13 MXN del tope de 6).
// a) El reparador escribió el texto en «texto»: el reproductor lee pregunta, afirmacion o enunciado.
const omT: any = { tipo: "opcion_multiple", texto: "¿Qué es un reglamento?", opciones: ["normas", "versos"], correcta: 0, fuente: "normas de un grupo", retroalimentacion: "¡Muy bien!" };
const vfT: any = { tipo: "verdadero_falso", texto: "Un reglamento tiene normas.", es_verdadera: true };
const coT: any = { tipo: "completar", texto: "Un reglamento tiene ___.", respuesta: "normas", distractores: ["versos", "rimas"] };
const coV: any = { tipo: "completar", pregunta: "", texto: "Un reglamento reúne ___ de un grupo.", respuesta: "normas", distractores: ["versos", "rimas"] };
[omT, vfT, coT, coV].forEach((a) => P.normalizarActividad(a, "es"));
ok(!("pregunta" in coV) && coV.enunciado === "Un reglamento reúne ___ de un grupo.", "una «pregunta» vacía ya no tapa el enunciado (el reproductor lee pregunta ?? afirmacion ?? enunciado)");
ok(omT.pregunta === "¿Qué es un reglamento?" && !("texto" in omT) && vfT.afirmacion === "Un reglamento tiene normas." && coT.enunciado === "Un reglamento tiene ___." && omT.fuente?.tipo === "textual" && omT.fuente?.cita === "normas de un grupo" && omT.retro_correcta === "¡Muy bien!", "pregunta con el texto en «texto»: pasa a pregunta, afirmación o enunciado; la fuente suelta y la retroalimentación también se acomodan");
// b) La revisión final no deja pasar una pregunta sin texto.
const cVac: any = { completo: true, plan: { presupuesto_slides: 25 }, bloques: [{ id: "b1", pistas: [{ id: "b1p1", titulo: "A", ideas: ["A: x"] }], actividades: [1, 2, 3, 4, 5, 6].map((n) => ({ id: "b1om" + n, tipo: "opcion_multiple", pregunta: n === 3 ? "" : "¿P" + n + "?", opciones: ["a", "b", "c", "d"], correcta: 0 })), mini_examen: [], duelo: [] }] };
const probVac = P.verificarCartucho(cVac);
cVac.bloques[0].actividades[2].pregunta = "¿P3?";
ok(probVac.some((x: string) => /1 pregunta\(s\) sin texto \(b1om3\)/.test(x)) && !P.verificarCartucho(cVac).some((x: string) => /sin texto/.test(x)), "revisión final: una pregunta sin texto detiene la entrega; con su texto, pasa · " + probVac.filter((x: string) => /sin texto/.test(x)).join(" | "));
const vfP: any = { tipo: "verdadero_falso", pregunta: "El reglamento tiene normas.", es_verdadera: true };
const cVf: any = { ...cVac, bloques: [{ ...cVac.bloques[0], actividades: [...cVac.bloques[0].actividades, ...[1, 2, 3, 4, 5].map((n) => ({ ...vfP, id: "b1vf" + n }))] }] };
const probVf = P.verificarCartucho(cVf);
P.normalizarActividad(vfP, "es");
ok(probVf.some((x: string) => /5 pregunta\(s\) sin texto \(b1vf1/.test(x)) && vfP.afirmacion === "El reglamento tiene normas.", "verdadero o falso con el texto en «pregunta»: la revisión final lo detiene (el juego de deslizar solo lee la afirmación) y normalizar lo acomoda");
// c) Bloque sin nada confirmado y sin contenido en los apuntes: no se llama al escritor; solo lleva su nota.
const resNo = (tema: string, bloque: string, pagina = "") => ({ tema, bloque, pagina, estado: "no_confirmado", datos: [], fuentes: [], motivo: "sin fuentes confiables" });
const planS: any = { idioma_guia: "es", perfil_edad: "juvenil", materia: "Español", apoyo: null, puntos_dificiles: [], identidad: { titulo: "T" }, primera_actividad: "calentamiento", reto_final: 16,
  temas_a_investigar: [{ tema: "Acento normativo", bloque: "b2", pagina: "12" }],
  bloques: [
    { id: "b1", titulo: "Reglamento", temas: ["Reglamento"], ids_inventario: ["tem1", "dat1"], pistas: ["Reglamento"], juegos: { opcion_multiple: 5 }, mini_examen: 0 },
    { id: "b2", titulo: "Ortografía", temas: ["Acento normativo"], ids_inventario: ["tem2"], pistas: ["Acento normativo"], juegos: { opcion_multiple: 5 }, mini_examen: 0 },
    { id: "b3", titulo: "Literatura", temas: ["Cuento"], ids_inventario: ["tem3", "dat3"], pistas: ["Cuento"], juegos: { opcion_multiple: 5 }, mini_examen: 0 }] };
const invS = { temas: [{ id: "tem1", foto: 1, texto: "Reglamento", cita: "Reglamento" }, { id: "tem2", foto: 1, texto: "Acento normativo", cita: "Acento normativo" }, { id: "tem3", foto: 1, texto: "Cuento", cita: "Cuento" }],
  datos_clave: [{ id: "dat1", foto: 1, texto: "Reglamento: normas de un grupo", cita: "normas de un grupo" }, { id: "dat3", foto: 1, texto: "Cuento: narración breve", cita: "narración breve" }] };
const blq = (id: string, cita = "normas de un grupo") => ({ id, titulo: id.toUpperCase(), pistas: [{ id: id + "p1", titulo: "P " + id, ideas: [id + ": idea."] }], actividades: [1, 2, 3, 4, 5, 6].map((k) => ({ id: `${id}om${k}`, tipo: "opcion_multiple", pregunta: `¿Pregunta ${k} del bloque ${id}?`, opciones: ["uno" + k, "dos" + k, "tres" + k, "cuatro" + k], correcta: 0, retro_correcta: "¡Sí!", retro_incorrecta: "No.", pista: id + "p1", fuente: { foto: 1, tipo: "textual", cita } })), mini_examen: [] });
const tS: any = { id: "ts", guia_id: "gs", alcance: "completa", paso: "generar:1", estado: "corriendo", costo_usd: 0, tokens_entrada: 0, tokens_salida: 0, progreso: { pct: 50 }, datos: { inventario: JSON.parse(JSON.stringify(invS)), citas: ["normas de un grupo", "narración breve"], fotos: [{ indice: 1, tipo: "temario" }], plan: JSON.parse(JSON.stringify(planS)), investigacion: [resNo("Acento normativo", "b2", "12")], bloques: [blq("b1")] } };
pedidos.length = 0; respuestas = [];
const sigS = await P.ejecutarPaso(falso, tS, fuenteG);
const b2S = tS.datos.bloques[1];
ok(sigS === "generar:2" && pedidos.length === 0 && b2S?.solo_nota === true && b2S.actividades.length === 0 && b2S.pistas.length === 1 && b2S.pistas[0].nota_temario && b2S.pistas[0].ideas[0] === "Acento normativo: este tema venía en tu temario; repásalo en tu libro (pág. 12).", "bloque sin nada confirmado y sin contenido en los apuntes: no se llama al escritor (nada inventado); solo lleva su nota");
ok(P.tieneContenidoPropio({ temas: [{ texto: "x" }], ejercicios_del_libro: [{ instruccion: "ninguno" }], vocabulario: [{ palabra: "x", significado: "sin_definicion" }] }) === false && P.tieneContenidoPropio({ temas: [{}], reglas: [{ texto: "Agudas: n, s o vocal" }] }) === true, "contenido propio: no cuentan los temas sueltos, el «ninguno» de los ejercicios ni las palabras sin definición");
tS.datos.bloques[2] = blq("b3", "narración breve");
tS.paso = "revisar";
await P.ejecutarPaso(falso, tS, fuenteG);
ok(!(tS.datos.huecos ?? []).some((h: string) => /\bb2\b/.test(h)), "revisar: el bloque que solo lleva la nota no pide huecos (el reparador no le inventa preguntas) · huecos: " + JSON.stringify(tS.datos.huecos ?? []));
const repS = P.aplicarReparacion(tS.datos.bloques, { actividades_nuevas: { opcion_multiple: [
  { id: "r_b2om1", pregunta: "¿Cuándo lleva tilde una palabra aguda?", opciones: ["n, s o vocal", "siempre", "nunca", "en la última"], correcta: 0, pista: "b2nt1", fuente: { foto: 1, tipo: "textual", cita: "normas de un grupo" } },
  { id: "r_om9", pregunta: "¿Qué tiene un reglamento?", opciones: ["normas", "versos", "rimas", "mapas"], correcta: 0, fuente: { foto: 1, tipo: "textual", cita: "normas de un grupo" } }] } }, tS.datos.citas, "secundaria", "es", []);
ok(repS.descartes.some((d: any) => d.id === "r_b2om1" && /no se inventan/.test(d.motivo)) && tS.datos.bloques[1].actividades.length === 0 && repS.colocadas.some((c: string) => /^r_om9→b[13]$/.test(c)), "reparar: una pregunta para el bloque de la nota se descarta; una sin bloque nunca cae ahí · " + repS.colocadas.join(", "));
tS.paso = "reparar"; tS.datos.huecos = ["Bloque b1: agrega preguntas a los juegos que ya tiene el bloque (opcion_multiple)"]; tS.datos.pistas_largas = [];
pedidos.length = 0; respuestas = [apiTexto({ actividades_nuevas: {} }, [])];
await P.ejecutarPaso(falso, tS, fuenteG);
const txtRep = pedidos[0]?.messages?.[0]?.content?.[0]?.text ?? "";
const parteRep = txtRep.split("Pistas de cada bloque")[1]?.split("Ids que ya existen")[0] ?? "";
ok(pedidos.length === 1 && /"b1"/.test(parteRep) && !/"b2"/.test(parteRep), "reparar: al reparador no se le muestran los bloques que solo llevan la nota");
tS.paso = "armar";
await P.ejecutarPaso(falso, tS, fuenteG);
const cS = tS.datos.cartucho;
ok(cS.bloques.map((b: any) => b.id).join() === "b1,b3" && cS.bloques[0].pistas.at(-1)?.nota_temario && /^Acento normativo/.test(cS.bloques[0].pistas.at(-1).ideas[0]) && cS.bloques[0].temas_para_repasar?.some((x: any) => x.tema === "Acento normativo") && tS.datos.bloques.length === 3, "armar: el bloque de la nota no se arma; su nota pasa al bloque anterior (datos.bloques no cambia) · " + cS.bloques.map((b: any) => b.id).join(","));
ok(!P.verificarCartucho(cS).some((x: string) => /\bb2\b|sin texto|no tiene juegos/.test(x)), "revisión final: ni bloque vacío ni preguntas sin texto · " + P.verificarCartucho(cS).join(" | "));
// d) Vista previa: si el bloque 1 solo lleva la nota, se escribe el siguiente; la familia ve un bloque de verdad.
const planP = { ...JSON.parse(JSON.stringify(planS)), bloques: [planS.bloques[1], planS.bloques[0], planS.bloques[2]] };
const tP: any = { id: "tp", guia_id: null, borrador_id: "bp", alcance: "vista_previa", paso: "generar:0", estado: "corriendo", costo_usd: 0, tokens_entrada: 0, tokens_salida: 0, progreso: { pct: 40 }, datos: { inventario: JSON.parse(JSON.stringify(invS)), citas: ["normas de un grupo"], fotos: [{ indice: 1, tipo: "temario" }], plan: planP, investigacion: [resNo("Acento normativo", "b2", "12")], bloques: [] } };
pedidos.length = 0; respuestas = [];
const sigP = await P.ejecutarPaso(falso, tP, fuenteG);
ok(sigP === "generar:1" && pedidos.length === 0 && tP.datos.bloques[0]?.solo_nota === true, "vista previa: el bloque 1 solo lleva la nota → sigue con el bloque 2 (sin llamar al escritor para el 1)");
// (La pregunta 2 viene con el texto en «texto», como la que salió vacía en una vista previa real del 10 nov.)
respuestas = [apiTexto({ bloque: "b1", pistas: [{ id: "b1p1", titulo: "Reglamento", emoji: "📜", ideas: ["Reglamento: normas de un grupo."], tema_investigado: null }], actividades: { opcion_multiple: [1, 2, 3, 4, 5, 6].map((n) => ({ id: "b1om" + n, [n === 2 ? "texto" : "pregunta"]: "¿Pregunta número " + n + " del reglamento?", opciones: ["normas" + n, "versos" + n, "rimas" + n, "mapas" + n], correcta: 0, retro_correcta: "¡Sí!", retro_incorrecta: "No.", pista: "b1p1", fuente: { foto: 1, tipo: "textual", cita: "normas de un grupo" } })) }, duelo: [], mini_examen: [] })];
const sigP2 = await P.ejecutarPaso(falso, tP, fuenteG);
ok(sigP2 === "armar" && pedidos.length === 1 && /ERES EL GENERADOR/.test(pedidos[0].system[0].text), "vista previa: escribe el bloque con contenido y pasa a armar");
ok(tP.datos.bloques[1].actividades.find((a: any) => a.id === "b1om2")?.pregunta === "¿Pregunta número 2 del reglamento?", "escribir: la pregunta que vino en «texto» queda en «pregunta» desde que se escribe (la vista previa no pasa por revisar)");
await P.ejecutarPaso(falso, tP, fuenteG);
const vpP = P.recortarVistaPrevia(tP.datos.cartucho);
ok(tP.datos.cartucho.bloques.length === 1 && vpP.bloques[0]?.id === "b1" && !vpP.bloques[0].pistas[0]?.nota_temario && vpP.bloques[0].actividades.length > 0 && tP.datos.bloques.length === 2, "vista previa: muestra el bloque con contenido, sin la nota; el trabajo «resto» seguirá en el bloque 3 (datos.bloques tiene 2)");
const cEnBlanco = JSON.parse(JSON.stringify(tP.datos.cartucho));
cEnBlanco.bloques[0].actividades[0].pregunta = "";
const vpBlanco = P.recortarVistaPrevia(cEnBlanco);
ok(vpBlanco.bloques[0].actividades.length > 0 && vpBlanco.bloques[0].actividades.every((a: any) => P.textoPregunta(a)), "vista previa: nunca elige una pregunta en blanco");
// e) Si ningún tema se confirma y las fotos no traen contenido, la guía no se hace: nunca se inventa.
const tE: any = { ...JSON.parse(JSON.stringify(tP)), id: "te", paso: "generar:0", datos: { ...JSON.parse(JSON.stringify(tP.datos)), plan: { ...planP, bloques: [planS.bloques[1]] }, bloques: [], cartucho: undefined } };
let errE = "";
try { await P.ejecutarPaso(falso, tE, fuenteG); } catch (e) { errE = (e as Error).message; }
ok(/no se hace para no inventar/.test(errE), "sin nada confirmado ni contenido en toda la guía: error claro en vez de una guía inventada o vacía");
// f) Búsqueda que no devolvió ninguna página: el tema tiene su segunda oportunidad, él solo, con 2 búsquedas
// (2026-11-11.5; antes se repetía la misma llamada).
const tR: any = { id: "tr", guia_id: "gr", alcance: "completa", paso: "generar:0", estado: "corriendo", costo_usd: 0, tokens_entrada: 0, tokens_salida: 0, progreso: { pct: 40 }, datos: { inventario: JSON.parse(JSON.stringify(invS)), citas: [], fotos: [{ indice: 1, tipo: "temario" }], plan: JSON.parse(JSON.stringify(planP)), bloques: [] } };
const tR2: any = JSON.parse(JSON.stringify(tR));
const tR3: any = JSON.parse(JSON.stringify(tR));
const urlRae = "https://www.rae.es/dpd/tilde";
const respAcento = { temas: [{ tema: "Acento normativo", estado: "confirmado", datos: [{ texto: "Acento normativo: reglas para poner la tilde.", fuentes: [{ nombre: "RAE", url: urlRae }] }, { texto: "Agudas: llevan tilde si terminan en n, s o vocal.", fuentes: [{ nombre: "RAE", url: urlRae }] }] }] };
pedidos.length = 0;
respuestas = [apiTexto({ temas: [{ tema: "Acento normativo", estado: "no_confirmado", motivo: "el buscador dio error", datos: [] }] }, [])];
const sigR1 = await P.ejecutarPaso(falso, tR, fuenteG);
ok(sigR1 === "generar:0" && !!tR.datos.inv_segunda?.["acento normativo"] && /ninguna página/.test(tR.datos.inv_segunda["acento normativo"].motivo) && !(tR.datos.investigacion ?? []).some((r: any) => r.tema === "Acento normativo"), "búsqueda sin ninguna página: el tema no se da por perdido; espera su segunda oportunidad");
respuestas = [apiTexto(respAcento, [urlRae])];
await P.ejecutarPaso(falso, tR, fuenteG);
const txtR = pedidos[1]?.messages?.[0]?.content?.[0]?.text ?? "";
const rAc = tR.datos.investigacion.find((r: any) => r.tema === "Acento normativo");
ok(/SEGUNDA OPORTUNIDAD/.test(txtR) && /ninguna página/.test(txtR) && pedidos[1].tools[0].max_uses === P.BUSQUEDAS_SEGUNDA && rAc?.estado === "confirmado" && rAc?.busqueda?.segunda === true && !tR.datos.intento_inv, "segunda oportunidad: él solo, con 2 búsquedas, sabe qué falló y, con páginas de verdad, el tema se confirma");
pedidos.length = 0;
respuestas = [apiTexto({ temas: [{ tema: "Acento normativo", estado: "no_confirmado", datos: [] }] }, []), apiTexto({ temas: [{ tema: "Acento normativo", estado: "no_confirmado", datos: [] }] }, [])];
await P.ejecutarPaso(falso, tR2, fuenteG);
await P.ejecutarPaso(falso, tR2, fuenteG);
ok(pedidos.length === 2 && tR2.datos.investigacion.find((r: any) => r.tema === "Acento normativo")?.estado === "no_confirmado" && tR2.datos.inv_segunda["acento normativo"].hecha === true, "si la segunda oportunidad tampoco trae páginas, el tema queda como nota (sin tercera búsqueda; la guía nunca se detiene)");
// La IA que no responde JSON se reintenta una vez (como antes) y, si vuelve a fallar, el tema queda como nota.
pedidos.length = 0;
const sinJson = { content: [{ type: "text", text: "no es json" }], stop_reason: "end_turn", usage: { input_tokens: 10, output_tokens: 5 } };
respuestas = [sinJson, sinJson];
let errR = "";
try { await P.ejecutarPaso(falso, tR3, fuenteG); } catch (e) { errR = (e as Error).message; }
await P.ejecutarPaso(falso, tR3, fuenteG);
ok(/se reintenta/.test(errR) && pedidos.length === 2 && tR3.datos.investigacion.find((r: any) => r.tema === "Acento normativo")?.estado === "no_confirmado" && !tR3.datos.inv_segunda?.["acento normativo"], "sin JSON: se reintenta una vez y queda como nota (eso no es falla del buscador: sin segunda oportunidad)");
ok(/consultas CORTAS/.test(PR.INVESTIGADOR) && /nunca uses site:, comillas, OR/.test(PR.INVESTIGADOR) && /no busques más/.test(PR.INVESTIGADOR) && /1 búsqueda por tema/.test(PR.INVESTIGADOR), "investigador: 1 búsqueda por tema, consultas cortas y sin operadores; con una fuente oficial, no busca más");
// g) Verificar no vuelve a buscar lo que ya trae fuentes (1 oficial o 2 confiables).
const pistaF = { id: "b1p2", titulo: "Figuras retóricas", ideas: datosF, completado_con_fuentes: { fuentes: [] } };
const notaF = { id: "b1nt1", titulo: "Repásalo en tu libro", ideas: ["X: nota"], nota_temario: true };
const actF = { id: "b1om1", tipo: "opcion_multiple", pregunta: "¿Qué figura exagera una cualidad?", opciones: ["hipérbole", "metáfora"], correcta: 0, fuente: { tipo: "investigado", cita: datosF[1] } };
const invF = [{ tema: "Figuras retóricas", bloque: "b1", pagina: "", estado: "confirmado", datos: datosF.map((x) => ({ texto: x, fuentes: [] })), fuentes: [], motivo: "" }];
const DV: any = { investigacion: invF, bloques: [{ id: "b1", pistas: [{ id: "b1p1", titulo: "Reglamento", ideas: ["Reglamento: normas."] }, pistaF, notaF], actividades: [actF,
  { id: "b1om2", tipo: "opcion_multiple", pregunta: "¿Qué tiene un reglamento?", opciones: ["normas", "versos"], correcta: 0, fuente: { tipo: "textual", cita: "normas de un grupo" } },
  { id: "b1om3", tipo: "opcion_multiple", pregunta: "¿Otra?", opciones: ["a", "b"], correcta: 0, fuente: { tipo: "investigado", cita: "Algo que no viene en ningún dato" } }], mini_examen: [] }] };
const cvV = P.contenidoParaVerificar(DV);
ok(cvV.total === 5 && cvV.omitidos === 2 && cvV.bloques[0].pistas.map((p: any) => p.id).join() === "b1p1" && cvV.bloques[0].actividades.map((a: any) => a.id).join() === "b1om2,b1om3", "verificar: no vuelve a buscar la pista con fuentes ni la pregunta de un dato confirmado; sí lo de los apuntes (y lo «investigado» sin cita que lo respalde)");
const tVo: any = { id: "tvo", guia_id: "gvo", alcance: "completa", paso: "verificar", estado: "corriendo", costo_usd: 0, tokens_entrada: 0, tokens_salida: 0, datos: { plan: { idioma_guia: "es", materia: "Español" }, fotos: [{ tipo: "temario" }], inventario: {}, investigacion: invF, bloques: [{ id: "b1", pistas: [pistaF, notaF], actividades: [actF], mini_examen: [] }] } };
const tVm: any = JSON.parse(JSON.stringify(tVo));
tVm.datos.bloques[0].pistas.push({ id: "b1p9", titulo: "Reglamento", ideas: ["Reglamento: normas de un grupo."] });
pedidos.length = 0; respuestas = [];
const sigVo = await P.ejecutarPaso(falsoR, tVo, fuenteG);
ok(sigVo === "imagenes" && pedidos.length === 0 && tVo.datos.verificacion[0]?.estado === "omitida", "verificar: si todo viene de fuentes confirmadas, no se llama a la IA (0 MXN)");
respuestas = [apiTexto({ resultados: [] }, [])];
await P.ejecutarPaso(falsoR, tVm, fuenteG);
const txtVm = pedidos[0]?.messages?.[0]?.content?.[0]?.text ?? "";
ok(pedidos.length === 1 && pedidos[0].tools[0].max_uses === 4 && /b1p9/.test(txtVm) && !/b1p2|b1om1|b1nt1/.test(txtVm), "verificar: si más de la mitad ya trae sus fuentes, 4 búsquedas en vez de 10 y solo lo de los apuntes");
const tVp: any = { id: "tvp", guia_id: null, alcance: "resto", paso: "verificar", estado: "corriendo", costo_usd: 0, tokens_entrada: 0, tokens_salida: 0, datos: { plan: { idioma_guia: "es", materia: "Español" }, fotos: [{ tipo: "apuntes_a_mano" }], inventario: {}, bloques: [blq("b1")] } };
pedidos.length = 0; respuestas = [apiTexto({ resultados: [] }, [])];
await P.ejecutarPaso(falsoR, tVp, fuenteG);
ok(pedidos.length === 1 && pedidos[0].tools[0].max_uses === 10 && /b1om6/.test(pedidos[0].messages[0].content[0].text), "verificar sin investigación: igual que antes (10 búsquedas con apuntes a mano, todo el contenido)");
// h) Las guías de prueba y de la biblioteca se reanudan solas; la guía pagada sigue donde la vista previa se quedó.
const idxTs = leerRepo("funciones/sparked/index.ts");
const rutaTrab = idxTs.split('rec === "trabajos" && esUuid(id) && !accion && m === "GET"')[1]?.slice(0, 700) ?? "";
ok(/if \(t\.alcance === "completa"\) await reanudarSiAtorado\(t\);/.test(rutaTrab), "guías de prueba y de la biblioteca: al consultar su trabajo, se reanuda si se trabó (las de las familias, igual que antes)");
ok(/const desde = Math\.max\(1, Array\.isArray\(datos\.bloques\) \? datos\.bloques\.length : 1\);/.test(idxTs) && /const paso = desde < nBloques \? `generar:\$\{desde\}` : "revisar";/.test(idxTs), "guía pagada: el trabajo «resto» empieza en el primer bloque que la vista previa no escribió (casi siempre el 2, como antes)");

// 26. Tras la prueba v51 (11 nov 2026): tope repartido por tema del temario, tarjetas sin la respuesta escrita y la
// fuente exacta de cada pista.
// a) El planificador partió el temario de Español 1.º en 8 subtemas: se investigan 6, primero uno de cada tema.
const temasV51 = ["Reglamento: definición y función", "Reglamento: derechos, responsabilidades y sanciones", "Verbo: infinitivo y modos imperativo, indicativo y subjuntivo", "Acento normativo: palabras agudas y graves", "Acento normativo: esdrújulas y sobresdrújulas", "Tradición oral: coplas, pregones, refranes y dichos", "Lenguaje literal y figurado", "Figuras retóricas: metáfora, hipérbole, repetición y símil"];
const bloqueV51 = (t: string) => /Reglamento|Verbo/.test(t) ? "b1" : /Acento/.test(t) ? "b2" : "b3";
const Dv51: any = { plan: { bloques: [{ id: "b1" }, { id: "b2" }, { id: "b3" }], temas_a_investigar: temasV51.map((tema) => ({ tema, bloque: bloqueV51(tema), pagina: "" })) } };
const pendV51 = ["b1", "b2", "b3"].flatMap((b) => P.temasPendientes(Dv51, b).map((x: any) => x.tema));
const fueraV51 = Dv51.investigacion.filter((r: any) => r.estado === "no_confirmado").map((r: any) => r.tema);
ok(pendV51.length === 6 && fueraV51.join(" | ") === "Reglamento: derechos, responsabilidades y sanciones | Acento normativo: esdrújulas y sobresdrújulas" && Dv51.investigacion.every((r: any) => /tope de 6 subtemas/.test(r.motivo)), "tope «seguro»: de 8 subtemas se investigan 6, primero uno de cada tema del temario; los segundos subtemas quedan como nota · fuera: " + fueraV51.join(" | "));
ok(P.raizDeTema("Acento normativo: esdrújulas") === "acento normativo" && P.raizDeTema("Lenguaje literal y figurado") === "lenguaje literal y figurado" && P.temasQueSeInvestigan(["A: 1", "A: 2", "A: 3", "B"].map((tema) => ({ tema, bloque: "b1", pagina: "" }))).size === 4, "tema del temario = lo que va antes de «:»; con menos de 6 subtemas se investigan todos");
// b) Las tarjetas de clasificar nunca dicen su grupo.
const gruposAG = ["Agudas", "Graves"];
ok(P.sinGrupoEscrito("mesa → Graves", gruposAG) === "mesa" && P.sinGrupoEscrito("jamás -> Agudas", gruposAG) === "jamás" && P.sinGrupoEscrito("mesa (Graves)", gruposAG) === "mesa" && P.sinGrupoEscrito("Graves: mesa", gruposAG) === "mesa" && P.sinGrupoEscrito("césped — graves", gruposAG) === "césped", "tarjeta con su grupo escrito («mesa → Graves», «(Graves)», «Graves: mesa», «— graves»): se queda solo la palabra");
ok(P.sinGrupoEscrito("H2O → agua", ["Sustancias", "Mezclas"]) === "H2O → agua" && P.sinGrupoEscrito("Pre-Graves", gruposAG) === "Pre-Graves" && P.sinGrupoEscrito("canción", gruposAG) === "canción", "una flecha o un guion que no nombran un grupo no se tocan");
const clGen: any = { id: "b2cl1", tipo: "clasificar", grupos: gruposAG, elementos: [{ texto: "canción → Agudas", grupo: 0 }, { texto: "árbol", grupo: 1 }] };
P.normalizarClasificar(clGen);
ok(clGen.elementos.map((e: any) => e.texto).join(",") === "canción,árbol", "escribir: las tarjetas del escritor también se limpian");
const bCl: any[] = [{ id: "b2", pistas: [{ id: "b2p1" }], actividades: [{ id: "b2cl1", tipo: "clasificar", grupos: gruposAG, elementos: [{ texto: "canción", grupo: 0 }, { texto: "árbol", grupo: 1 }] }], mini_examen: [] }];
P.aplicarReparacion(bCl, { ampliaciones: [{ id: "b2cl1", elementos: [{ texto: "jamás → Agudas", grupo: 0 }, { texto: "mesa → Graves", grupo: 1 }] }] }, [], "secundaria", "es", []);
ok(bCl[0].actividades[0].elementos.map((e: any) => e.texto).join(",") === "canción,árbol,jamás,mesa", "reparar: las tarjetas nuevas llegan sin el grupo escrito · " + bCl[0].actividades[0].elementos.map((e: any) => e.texto).join(","));
const cCl: any = { completo: true, plan: { presupuesto_slides: 25 }, bloques: [{ id: "b2", pistas: [{ id: "b2p1", titulo: "A", ideas: ["A: x"] }], actividades: [{ id: "b2cl1", tipo: "clasificar", instruccion: "Clasifica", grupos: gruposAG, elementos: ["canción", "reloj", "jamás → Agudas", "árbol", "lápiz", "mesa"].map((texto, i) => ({ texto, grupo: i < 3 ? 0 : 1 })) }], mini_examen: [], duelo: [] }] };
ok(P.verificarCartucho(cCl).some((x: string) => /1 tarjeta\(s\) de b2cl1 con la respuesta escrita/.test(x)), "revisión final: una tarjeta con la respuesta escrita detiene la entrega");
const tCl: any = { id: "tcl", alcance: "completa", paso: "reparar", estado: "corriendo", costo_usd: 0, tokens_entrada: 0, tokens_salida: 0, datos: { plan: { idioma_guia: "es", perfil_edad: "juvenil", materia: "Español", puntos_dificiles: [] }, inventario: {}, citas: [], huecos: ["MÍNIMO · Actividad b2cl1 (clasificar, bloque b2): tiene 4 tarjetas; agrega 2 o más"], pistas_largas: [], bloques: [{ id: "b2", pistas: [{ id: "b2p1", titulo: "A", ideas: ["A: x"] }], actividades: [{ id: "b2cl1", tipo: "clasificar", grupos: gruposAG, elementos: [{ texto: "canción", grupo: 0 }, { texto: "árbol", grupo: 1 }] }], mini_examen: [] }] } };
pedidos.length = 0; respuestas = [apiTexto({ ampliaciones: [] }, [])];
await P.ejecutarPaso(falso, tCl, fuenteG);
const txtCl = pedidos[0]?.messages?.[0]?.content?.[0]?.text ?? "";
ok(pedidos.length === 1 && !/→/.test(txtCl) && /"tarjetas":\[\{"texto":"canción","grupo":0\}/.test(txtCl) && /nunca el nombre del grupo/.test(pedidos[0].system[0].text), "reparar: las tarjetas se le resumen como {texto, grupo} (sin «→ Grupo» que copiar) y el prompt lo prohíbe");
// c) Cada pista muestra las fuentes de SU subtema (dos subtemas que empiezan igual).
const fA = { nombre: "RAE · reglas generales", url: "https://www.rae.es/agudas" }, fE = { nombre: "SEP · Un acento muy agudo", url: "https://nuevaescuelamexicana.sep.gob.mx/esdrujulas" };
const confAE: any[] = [
  { tema: "Acento normativo: palabras agudas y graves", bloque: "b2", pagina: "", estado: "confirmado", datos: [{ texto: "Palabras agudas: llevan tilde al terminar en n, s o vocal.", fuentes: [fA] }, { texto: "Palabras graves: tónica en la penúltima.", fuentes: [fA] }], fuentes: [fA], motivo: "" },
  { tema: "Acento normativo: esdrújulas y sobresdrújulas", bloque: "b2", pagina: "", estado: "confirmado", datos: [{ texto: "Palabras esdrújulas: siempre llevan tilde.", fuentes: [fE] }, { texto: "Palabras sobresdrújulas: tónica antes de la antepenúltima.", fuentes: [fE] }], fuentes: [fE], motivo: "" }];
const nombresDe = (p: any) => (p.completado_con_fuentes?.fuentes ?? []).map((f: any) => f.nombre).join(" + ");
const bAE: any = { id: "b2", pistas: [
  { id: "b2p1", titulo: "Palabras agudas y graves", ideas: ["Agudas: x"], tema_investigado: "Acento normativo: palabras agudas y graves" },
  { id: "b2p2", titulo: "Esdrújulas y sobresdrújulas", ideas: ["Esdrújulas: y"], tema_investigado: "Acento normativo" },
  { id: "b2p3", titulo: "Acento normativo (2)", ideas: ["Sobresdrújulas: z"], tema_investigado: null },
  { id: "b2p4", titulo: "Acento normativo", ideas: ["Tilde: w"], tema_investigado: null }],
  actividades: [{ id: "b2om9", tipo: "opcion_multiple", pregunta: "¿?", opciones: ["a", "b"], correcta: 0, pista: "b2p2", fuente: { tipo: "investigado", cita: "algo que no coincide con ningún dato" } }], mini_examen: [] };
bAE.pistas.push({ id: "b2p5", titulo: "Reglas de acentuación", ideas: ["Sobresdrújulas: z"], tema_investigado: null });
P.marcarInvestigado(bAE, confAE);
const [pA, pE, pS, pAmb, pNo] = bAE.pistas;
ok(!pNo.completado_con_fuentes, "una pista que no se parece a ningún subtema no se marca (como antes: podría venir de los apuntes)");
ok(nombresDe(pA) === fA.nombre && nombresDe(pE) === fE.nombre && nombresDe(pS) === fE.nombre && nombresDe(pAmb) === `${fA.nombre} + ${fE.nombre}`, `pistas: cada una con las fuentes de su subtema (agudas → ${nombresDe(pA)}; esdrújulas → ${nombresDe(pE)}; por sus ideas → ${nombresDe(pS)}; empate → ${nombresDe(pAmb)})`);
P.marcarInvestigado(bAE, confAE);
ok(nombresDe(bAE.pistas[1]) === fE.nombre && bAE.pistas[1].tema_investigado === "Acento normativo" && bAE.actividades[0].fuente.nombre === fE.nombre, "al volver a marcar (armar) sale lo mismo; la pregunta sin cita lleva la fuente del subtema de su pista");

// 27. Código 2026-11-11.5 (Daniel aprobó los tres arreglos de la prueba v52 y bajó el tope a 5 MXN por guía).
// a) Verificar corrige SOLO con una fuente que salió en SU búsqueda (1 oficial o 2 confiables). Caso real de la prueba
//    v52: «lápiz es esdrújula», sin ninguna búsqueda, borró el Super sort y puso un «Dato corregido» falso.
const bloqueLapiz = () => ({ id: "b2", titulo: "Acento normativo", pistas: [{ id: "b2p2", titulo: "Palabras graves", ideas: ["Graves: tónica en la penúltima; llevan tilde si no terminan en n, s o vocal (lápiz, árbol)."] }],
  actividades: [{ id: "b2cl1", tipo: "clasificar", instruccion: "Clasifica", grupos: ["Agudas", "Graves"], elementos: ["canción", "reloj", "jamás", "lápiz", "árbol", "mesa"].map((texto, i) => ({ texto, grupo: i < 3 ? 0 : 1 })), pista: "b2p2" }], mini_examen: [] });
const tLap = (id: string): any => ({ id, guia_id: "g-" + id, alcance: "completa", paso: "verificar", estado: "corriendo", costo_usd: 0, tokens_entrada: 0, tokens_salida: 0, datos: { plan: { idioma_guia: "es", materia: "Español" }, fotos: [{ tipo: "temario" }], inventario: {}, bloques: [bloqueLapiz()] } });
const lapiz = { actividad: "b2cl1", afirmacion: "«lápiz» es palabra grave", estado: "corregida", dato_correcto: "«lápiz» es esdrújula", decia_la_foto: "lápiz es grave", fuentes: [] as string[], mensaje_para_alumno: "🔎 Estudia esta versión." };
insertados.length = 0;
const tL1 = tLap("l1");
pedidos.length = 0; respuestas = [apiTexto({ resultados: [lapiz] }, [])];
await P.ejecutarPaso(falsoR, tL1, fuenteG);
const repL1 = insertados.filter((x) => x.tabla === "reportes").flatMap((x) => x.filas);
ok(tL1.datos.bloques[0].actividades.some((a: any) => a.id === "b2cl1") && !tL1.datos.bloques[0].pistas[0].correcciones && tL1.datos.verificacion[0]?.estado === "revisar_dato" && repL1.length === 1 && repL1[0].guia_id === "g-l1" && /REVISAR DATO/.test(repL1[0].comentario) && /no se cambió nada/.test(repL1[0].comentario) && /lápiz/.test(repL1[0].comentario), "lápiz → esdrújula sin fuente: la guía no cambia (ni se borra el juego ni sale «Dato corregido») y va a Reportes · " + repL1[0]?.comentario);
const tL2 = tLap("l2");
respuestas = [apiTexto({ resultados: [{ ...lapiz, fuentes: ["https://www.rae.es/inventada"] }] }, ["https://www.rae.es/otra"])];
await P.ejecutarPaso(falsoR, tL2, fuenteG);
ok(tL2.datos.bloques[0].actividades.length === 1 && !tL2.datos.bloques[0].pistas[0].correcciones && tL2.datos.verificacion[0].estado === "revisar_dato", "una url que no salió en la búsqueda (de memoria) no vale: la guía no cambia");
const tL3 = tLap("l3");
respuestas = [apiTexto({ resultados: [{ ...lapiz, fuentes: ["https://www.britannica.com/x"] }] }, ["https://www.britannica.com/x"])];
await P.ejecutarPaso(falsoR, tL3, fuenteG);
ok(tL3.datos.bloques[0].actividades.length === 1 && /1 fuente confiable/.test(tL3.datos.verificacion[0].sin_cambio ?? ""), "una sola fuente confiable que no es oficial: no basta para cambiar la guía");
const tL4 = tLap("l4");
respuestas = [apiTexto({ resultados: [{ actividad: "b2cl1", afirmacion: "«reloj» es esdrújula", estado: "corregida", dato_correcto: "«reloj» es aguda", decia_la_foto: "reloj es esdrújula", fuentes: ["https://www.rae.es/dpd/tilde"] }] }, ["https://www.rae.es/dpd/tilde"])];
await P.ejecutarPaso(falsoR, tL4, fuenteG);
ok(tL4.datos.bloques[0].actividades.length === 0 && tL4.datos.bloques[0].pistas[0].correcciones?.[0]?.fuentes?.[0]?.url === "https://www.rae.es/dpd/tilde" && tL4.datos.verificacion[0].estado === "corregida", "con una fuente oficial que salió en la búsqueda: se corrige como antes (la pista lo muestra y se quita el juego con el dato malo)");
ok(/revisar_dato/.test(PR.VERIFICADOR) && /nunca corrijas de memoria/.test(PR.VERIFICADOR), "verificador: corrige solo con las fuentes de su búsqueda; si no, «revisar_dato»");
// b) Error del buscador: el tema confirmado se queda; el otro espera su segunda oportunidad, él solo, con 2 búsquedas,
//    el error y las consultas de la primera vez. Consultas y errores quedan en el log (claude) y en el reporte.
const errBloque = [{ type: "server_tool_use", id: "s2", name: "web_search", input: { query: "tradición oral coplas secundaria" } }, { type: "web_search_tool_result", tool_use_id: "s2", content: { type: "web_search_tool_result_error", error_code: "invalid_tool_input" } }];
const dB = P.detalleBusqueda({ content: [...errBloque, { type: "server_tool_use", id: "s3", name: "web_search", input: { query: "refranes secundaria SEP" } }, { type: "web_search_tool_result", tool_use_id: "s3", content: [{ type: "web_search_result", url: "https://www.sep.gob.mx/x" }] }, { type: "bash_code_execution_tool_result", content: { type: "bash_code_execution_result", stdout: "ok" } }] });
ok(dB.consultas.join(" | ") === "tradición oral coplas secundaria | refranes secundaria SEP" && dB.errores.join() === "invalid_tool_input" && /consultas: busqueda\.consultas\.slice\(0, 8\), errores: busqueda\.errores\.slice\(0, 8\)/.test(src), "registro: cada llamada con buscador anota sus consultas y los errores del buscador (un resultado normal no es error)");
const planSeg = { idioma_guia: "es", perfil_edad: "caricatura", materia: "Español", apoyo: null, puntos_dificiles: [], temas_a_investigar: [{ tema: "Figuras retóricas", bloque: "b1", pagina: "" }, { tema: "Tradición oral", bloque: "b1", pagina: "" }], bloques: [{ id: "b1", titulo: "Literatura", temas: ["Figuras retóricas", "Tradición oral"], ids_inventario: ["tem1"], pistas: ["Figuras retóricas", "Tradición oral"], juegos: { opcion_multiple: 5 }, mini_examen: 0 }] };
const nuevoSeg = (): any => ({ id: "tseg", guia_id: "gseg", alcance: "completa", paso: "generar:0", estado: "corriendo", costo_usd: 0, tokens_entrada: 0, tokens_salida: 0, progreso: { pct: 40 }, datos: { inventario: { temas: [{ id: "tem1", foto: 1, texto: "Figuras retóricas; tradición oral", cita: "x" }] }, citas: [], fotos: [{ indice: 1, tipo: "temario" }], plan: JSON.parse(JSON.stringify(planSeg)), bloques: [] } });
const figConf = { tema: "Figuras retóricas", estado: "confirmado", datos: [{ texto: datosF[0], fuentes: [{ nombre: "SEP", url: vistasF[0] }] }, { texto: datosF[1], fuentes: [{ nombre: "RAE", url: vistasF[1] }] }] };
const tSeg = nuevoSeg();
pedidos.length = 0;
respuestas = [apiTexto({ temas: [figConf, { tema: "Tradición oral", estado: "no_confirmado", motivo: "la búsqueda dio error de entrada inválida", datos: [] }] }, vistasF, 1, errBloque)];
await P.ejecutarPaso(falso, tSeg, fuenteG);
const invSeg = tSeg.datos.investigacion;
ok(pedidos[0].tools[0].max_uses === 2 && invSeg.length === 1 && invSeg[0].estado === "confirmado" && /invalid_tool_input/.test(tSeg.datos.inv_segunda?.["tradicion oral"]?.motivo ?? "") && invSeg[0].busqueda?.errores?.includes("invalid_tool_input") && invSeg[0].busqueda?.consultas?.includes("tradición oral coplas secundaria"), "buscador con error: el tema confirmado se queda; el otro espera su segunda oportunidad (consultas y error anotados)");
const urlTr = "https://www.sep.gob.mx/tradicion";
respuestas = [apiTexto({ temas: [{ tema: "Tradición oral", estado: "confirmado", datos: [{ texto: "Coplas: versos breves para cantar.", fuentes: [{ nombre: "SEP", url: urlTr }] }, { texto: "Refranes: dichos con una enseñanza.", fuentes: [{ nombre: "SEP", url: urlTr }] }] }] }, [urlTr])];
await P.ejecutarPaso(falso, tSeg, fuenteG);
const txtSeg = pedidos[1]?.messages?.[0]?.content?.[0]?.text ?? "";
const temasSeg = txtSeg.split("TEMAS A INVESTIGAR")[1] ?? "";
ok(pedidos[1].tools[0].max_uses === 2 && P.BUSQUEDAS_SEGUNDA === 2 && /SEGUNDA OPORTUNIDAD/.test(txtSeg) && /invalid_tool_input/.test(txtSeg) && /«tradición oral coplas secundaria»/.test(txtSeg) && !/Figuras/.test(temasSeg), "segunda oportunidad: él solo, con 2 búsquedas; sabe qué error dio y qué consultas ya se hicieron");
ok(tSeg.datos.investigacion.find((r: any) => r.tema === "Tradición oral")?.estado === "confirmado" && tSeg.datos.investigacion.find((r: any) => r.tema === "Tradición oral")?.busqueda?.segunda === true && tSeg.datos.inv_segunda["tradicion oral"].hecha === true, "con páginas de verdad en la segunda oportunidad, el tema se confirma");
// c) Se acabaron las búsquedas (sin error): también hay segunda oportunidad. Sin error ni tope: no (como antes).
const tLim = nuevoSeg();
respuestas = [apiTexto({ temas: [figConf, { tema: "Tradición oral", estado: "no_confirmado", motivo: "sin fuentes", datos: [] }] }, vistasF, 2)];
await P.ejecutarPaso(falso, tLim, fuenteG);
ok(tLim.datos.inv_segunda?.["tradicion oral"]?.motivo === "se acabaron las búsquedas (2)" && tLim.datos.investigacion.length === 1, "se acabaron las búsquedas: el tema sin confirmar tiene su segunda oportunidad");
// d) Tope de 5 MXN: si la segunda búsqueda haría pasar la guía del tope (con lo que falta), no se hace; el tema queda
//    como nota y la guía sigue.
const tTope = JSON.parse(JSON.stringify(tLim));
tTope.datos.metricas = [{ paso: "planear", costo_usd: 3.5 / P.MXN_POR_USD }];
pedidos.length = 0; respuestas = [];
const sigTope = await P.ejecutarPaso(falso, tTope, fuenteG);
const rTope = tTope.datos.investigacion.find((r: any) => r.tema === "Tradición oral");
ok(sigTope === "generar:0" && pedidos.length === 0 && rTope?.estado === "no_confirmado" && /tope de 5 MXN/.test(rTope?.motivo ?? "") && tTope.datos.inv_segunda["tradicion oral"].omitida === "tope", "tope: con 3.5 MXN gastados, la segunda búsqueda no se hace (sin llamar a la IA); el tema queda como nota · " + rTope?.motivo);
ok(P.TOPE_GUIA_MXN === 5 && P.puedeSegunda({ metricas: [{ costo_usd: 1.4 / P.MXN_POR_USD }] }, 3) && P.puedeSegunda({ metricas: [{ costo_usd: 2.9 / P.MXN_POR_USD }] }, 1) && !P.puedeSegunda({ metricas: [{ costo_usd: 3.3 / P.MXN_POR_USD }] }, 1) && Math.abs(P.costoGuiaMxn({ metricas: [{ costo_usd: 0.1 }, { costo_usd: 0.1 }] }) - 3.7) < 1e-9, "candado: con 1.4 MXN gastados (bloque 1) o 2.9 (último bloque, como la v52) sí hay segunda búsqueda; con 3.3 en el último, no");
// Verificar: sus búsquedas salen de lo que le queda a la guía (una guía normal no llega a ese límite).
ok(P.busquedasQueAlcanzan({ metricas: [] }) >= 10 && P.busquedasQueAlcanzan({ metricas: [{ costo_usd: 4.6 / P.MXN_POR_USD }] }) === 1 && P.busquedasQueAlcanzan({ metricas: [{ costo_usd: 4.9 / P.MXN_POR_USD }] }) === 0, "verificar: con 4.6 MXN gastados le alcanza 1 búsqueda; con 4.9, ninguna");
const tVcara: any = JSON.parse(JSON.stringify(tLap("vc")));
tVcara.datos.metricas = [{ paso: "planear", costo_usd: 4.9 / P.MXN_POR_USD }];
pedidos.length = 0; respuestas = [apiTexto({ resultados: [lapiz] }, [])];
await P.ejecutarPaso(falsoR, tVcara, fuenteG);
ok(pedidos.length === 1 && !pedidos[0].tools && tVcara.datos.bloques[0].actividades.length === 1 && tVcara.datos.verificacion[0].estado === "revisar_dato", "verificar sin presupuesto: se verifica sin buscador y nada se corrige sin fuente (va a Reportes)");
// e) Planificador: lo que el temario separa con «;» como tema distinto va aparte (temario real de Español 1.º).
const invEs: any = { temas: [
  { id: "tem1", texto: "Reglamento: definición-función; contiene derechos, responsabilidades y sanciones; verbo (infinitivo y modos imperativo, indicativo y subjuntivo)" },
  { id: "tem2", texto: "Acento normativo: teoría y práctica; palabras agudas, graves, esdrújulas y sobresdrújulas" },
  { id: "tem3", texto: "Tradición oral: definición; coplas, pregones, refranes y dichos" },
  { id: "tem4", texto: "Lenguaje literal y figurado: práctica" },
  { id: "tem5", texto: "Figuras retóricas: definición; metáfora, hipérbole, repetición y símil (comparación)" }],
  categorias: [{ id: "cat6", grupo: "Clasificación de palabras por acento", elementos: ["agudas", "graves", "esdrújulas", "sobresdrújula"] }],
  datos_clave: [{ id: "dat9", texto: "Temario del primer trimestre" }, { id: "dat10", texto: "Fecha de aplicación del examen: 4 de noviembre de 2026" }, { id: "dat11", texto: "Maestra: Luz Divina" }] };
const bloquesEs = [
  { id: "b1", titulo: "El reglamento y el verbo", temas: ["Reglamento", "Verbo y modos"], ids_inventario: ["tem1"], pistas: ["Función del reglamento", "Derechos, deberes y sanciones", "Verbo: infinitivo y modos"] },
  { id: "b2", titulo: "Acento normativo", temas: ["Acento normativo"], ids_inventario: ["tem2", "cat6"], pistas: ["Palabras agudas y graves", "Esdrújulas y sobresdrújulas"] },
  { id: "b3", titulo: "Tradición oral y figuras", temas: ["Tradición oral", "Lenguaje literal y figurado", "Figuras retóricas"], ids_inventario: ["tem3", "tem4", "tem5"], pistas: ["Tradición oral", "Literal y figurado", "Figuras retóricas"] }];
const temasV52 = ["Reglamento", "Acento normativo", "Tradición oral", "Lenguaje literal y figurado", "Figuras retóricas"].map((tema, i) => ({ tema, bloque: ["b1", "b2", "b3", "b3", "b3"][i], pagina: "" }));
const tV52 = P.completarTemasDelTemario({ bloques: bloquesEs, temas_a_investigar: temasV52 }, invEs);
ok(tV52.length === 6 && tV52.some((t: any) => /^Verbo \(infinitivo/.test(t.tema) && t.bloque === "b1") && !tV52.some((t: any) => /palabras agudas|coplas|metáfora|derechos|teoría/i.test(t.tema)), "temario de Español 1.º (plan de la v52): «verbo» va como tema aparte en el bloque 1; los detalles (agudas…, coplas…, metáfora…, derechos…) no · " + tV52.map((t: any) => t.tema).join(" | "));
const temasJuntos = [{ tema: "Reglamento: definición, función, derechos, responsabilidades y sanciones; verbo (infinitivo, imperativo, indicativo y subjuntivo)", bloque: "b1", pagina: "" }, ...temasV52.slice(1)];
const tJ = P.completarTemasDelTemario({ bloques: bloquesEs, temas_a_investigar: temasJuntos }, invEs);
ok(tJ[0].tema === "Reglamento: definición, función, derechos, responsabilidades y sanciones" && tJ[1].tema === "Verbo (infinitivo, imperativo, indicativo y subjuntivo)" && tJ[1].bloque === "b1" && tJ.filter((t: any) => /verbo/i.test(t.tema)).length === 1, "un tema del plan que junta dos con «;» se parte (y no se duplica con el del temario) · " + tJ.slice(0, 2).map((t: any) => t.tema).join(" | "));
const DvEs: any = { plan: { bloques: bloquesEs, temas_a_investigar: tV52 } };
const pendEs = ["b1", "b2", "b3"].flatMap((b) => P.temasPendientes(DvEs, b).map((x: any) => x.tema));
ok(pendEs.length === 6 && DvEs.investigacion.length === 0, "los 6 temas del temario de Español 1.º se investigan (dentro del tope de 6)");
ok(P.esTemaAparte("verbo (infinitivo y modos)", "Reglamento") && !P.esTemaAparte("contiene derechos, responsabilidades y sanciones", "Reglamento") && !P.esTemaAparte("teoría y práctica", "Acento normativo") && !P.esTemaAparte("definición-función", "Reglamento") && !P.esTemaAparte("acento diacrítico", "Acento normativo") && !P.esTemaAparte("coplas, pregones, refranes y dichos", "Tradición oral"), "qué va aparte: un tema nuevo sí; un detalle, una lista o el mismo tema, no");
const invConNotas = { ...invEs, reglas: [{ id: "reg1", texto: "Verbo: palabra que expresa una acción." }] };
ok(!P.completarTemasDelTemario({ bloques: bloquesEs.map((b) => b.id === "b1" ? { ...b, ids_inventario: ["tem1", "reg1"] } : b), temas_a_investigar: temasV52 }, invConNotas).some((t: any) => /^Verbo/.test(t.tema)), "si ese bloque trae contenido en los apuntes, no se agrega (el escritor lo convierte como siempre)");
ok(/temas DISTINTOS separados por «;»/.test(PR.PLANIFICADOR) && /if \(investigacionActiva\(fuente\)\) plan\.temas_a_investigar = completarTemasDelTemario\(plan, D\.inventario\);/.test(src), "planificador: cada tema distinto va aparte; el código lo asegura solo con la investigación encendida");
// f) Pista sin datos = nota «repásalo en tu libro» (en un bloque sin contenido propio, con la investigación encendida).
const datosReg = ["Reglamento: conjunto de reglas que organiza la convivencia en un espacio.", "Propósito: explica para qué sirve el reglamento.", "Numeración: cada apartado lleva un número."];
const confReg: any[] = [{ tema: "Reglamento", bloque: "b1", pagina: "", estado: "confirmado", datos: datosReg.map((texto) => ({ texto, fuentes: [] })), fuentes: [{ nombre: "SEP", url: "https://www.sep.gob.mx/r" }], motivo: "" }];
const sd = P.pistasSinDatos(["Función del reglamento", "Derechos, deberes y sanciones", "Verbo: infinitivo y modos"], confReg, []);
ok(sd.join(" | ") === "Derechos, deberes y sanciones | Verbo: infinitivo y modos", "pistas sin datos: «Derechos…» y «Verbo…» no aparecen en lo confirmado; «Función del reglamento» sí · " + sd.join(" | "));
ok(P.pistasSinDatos(["Refrán"], [{ ...confReg[0], datos: [{ texto: "Refranes: dichos con una enseñanza.", fuentes: [] }] }], []).length === 0 && P.pistasSinDatos(["Tradición oral"], [], [{ tema: "Tradición oral", estado: "no_confirmado" }]).length === 0, "«Refrán» encuentra «Refranes»; la pista de un tema sin confirmar ya es nota por su tema");
ok(P.esDatoAdministrativo("Fecha de aplicación del examen: 4 de noviembre de 2026") && P.esDatoAdministrativo("Maestra: Luz Divina") && P.esDatoAdministrativo("Temario del primer trimestre") && !P.esDatoAdministrativo("Grado de un polinomio: el mayor exponente") && !P.tieneContenidoPropio({ datos_clave: invEs.datos_clave }) && P.tieneContenidoPropio({ datos_clave: [{ texto: "Grado de un polinomio: el mayor exponente" }] }), "maestra, fecha y «Temario del…» no son contenido de estudio; «Grado de un polinomio» sí");
const tSd: any = { id: "tsd", guia_id: "gsd", alcance: "completa", paso: "generar:0", estado: "corriendo", costo_usd: 0, tokens_entrada: 0, tokens_salida: 0, progreso: { pct: 40 }, datos: {
  inventario: { temas: [invEs.temas[0]], datos_clave: invEs.datos_clave, investigado: datosReg.map((texto, i) => ({ id: "inv" + (i + 1), bloque: "b1", tema: "Reglamento", texto, cita: texto, fuentes: [{ nombre: "SEP", url: "https://www.sep.gob.mx/r" }] })) },
  citas: [...datosReg], fotos: [{ indice: 1, tipo: "temario" }],
  plan: { idioma_guia: "es", perfil_edad: "caricatura", materia: "Español", apoyo: null, puntos_dificiles: [], identidad: { titulo: "T" }, primera_actividad: "calentamiento", reto_final: 16, temas_a_investigar: [{ tema: "Reglamento", bloque: "b1", pagina: "" }],
    bloques: [{ id: "b1", titulo: "El reglamento y el verbo", temas: ["Reglamento", "Verbo"], ids_inventario: ["tem1", "dat9", "dat10", "dat11"], pistas: ["Función del reglamento", "Derechos, deberes y sanciones", "Verbo: infinitivo y modos"], juegos: { opcion_multiple: 5 }, mini_examen: 0, orden_actividades: ["opcion_multiple"] }] },
  investigacion: confReg, bloques: [] } };
pedidos.length = 0;
respuestas = [apiTexto({ bloque: "b1", pistas: [{ id: "b1p1", titulo: "Función del reglamento", emoji: "📜", ideas: [datosReg[0], datosReg[1]], tema_investigado: "Reglamento" }], actividades: { opcion_multiple: [1, 2, 3, 4, 5].map((n) => ({ id: "b1om" + n, pregunta: "¿Pregunta " + n + " sobre el reglamento?", opciones: ["a" + n, "b" + n, "c" + n, "d" + n], correcta: 0, retro_correcta: "Sí", retro_incorrecta: "No", pista: "b1p1", fuente: { foto: 0, tipo: "investigado", cita: datosReg[n % 3] } })) }, duelo: [], mini_examen: [] })];
await P.ejecutarPaso(falso, tSd, fuenteG);
const txtSd = pedidos[0]?.messages?.[0]?.content?.[0]?.text ?? "";
const planSd = txtSd.split("Plan del bloque:")[1]?.split("Inventario del bloque")[0] ?? "";
const notasSd = tSd.datos.bloques[0].pistas.filter((p: any) => p.nota_temario).flatMap((p: any) => p.ideas);
ok(pedidos.length === 1 && /PISTAS SIN DATOS[^\n]*«Derechos, deberes y sanciones», «Verbo: infinitivo y modos»/.test(txtSd) && !/Verbo: infinitivo/.test(planSd) && !/Derechos/.test(planSd) && /Función del reglamento/.test(planSd), "escritor: no se le piden las pistas sin datos (y sabe por qué)");
ok(notasSd.includes("Verbo infinitivo y modos: este tema venía en tu temario; repásalo en tu libro.") && notasSd.includes("Derechos, deberes y sanciones: este tema venía en tu temario; repásalo en tu libro.") && tSd.datos.bloques[0].pistas.some((p: any) => p.completado_con_fuentes), "las pistas sin datos quedan como nota «repásalo en tu libro» y la del tema confirmado lleva sus fuentes · " + notasSd.join(" | "));
tSd.paso = "armar";
await P.ejecutarPaso(falso, tSd, fuenteG);
const bSdC = tSd.datos.cartucho.bloques[0];
ok(bSdC.temas_para_repasar.map((x: any) => x.tema).join(" | ") === "Derechos, deberes y sanciones | Verbo: infinitivo y modos" && !("pistas_sin_datos" in bSdC), "armar: el bloque lista para repasar las pistas sin datos (y el campo interno no llega al cartucho)");
// Un bloque solo con el temario, sin temas que investigar ni nada confirmado: no se llama al escritor; solo notas.
const tSn: any = JSON.parse(JSON.stringify(tSd));
tSn.paso = "generar:1"; tSn.datos.bloques = [tSd.datos.bloques[0]]; delete tSn.datos.cartucho;
tSn.datos.plan.bloques.push({ id: "b2", titulo: "Ortografía", temas: ["Acentos"], ids_inventario: ["tem2"], pistas: ["Agudas", "Graves"], juegos: { opcion_multiple: 5 }, mini_examen: 0 });
tSn.datos.inventario.temas.push({ id: "tem2", texto: "Acentos: agudas y graves" });
pedidos.length = 0; respuestas = [];
const sigSn = await P.ejecutarPaso(falso, tSn, fuenteG);
ok(sigSn === "revisar" && pedidos.length === 0 && tSn.datos.bloques[1]?.solo_nota === true && tSn.datos.bloques[1].pistas.every((p: any) => p.nota_temario), "bloque solo con el temario y nada confirmado: no se escribe (nada inventado); solo notas");
// g) Reparar: solo el inventario de los bloques que repara, y lo investigado sin urls.
const Drep: any = { plan: { bloques: [{ id: "b1", ids_inventario: ["tem1", "dat1"] }, { id: "b2", ids_inventario: ["tem2", "cat6"] }] }, inventario: { temas: [{ id: "tem1", texto: "Reglamento" }, { id: "tem2", texto: "Acento" }], datos_clave: [{ id: "dat1", texto: "Reglamento: normas" }], categorias: [{ id: "cat6", grupo: "Acento", elementos: ["agudas"] }], investigado: [{ id: "inv1", bloque: "b1", tema: "Reglamento", texto: "R: x", cita: "R: x", fuentes: [{ nombre: "SEP", url: "https://www.sep.gob.mx/larga/url" }] }, { id: "inv2", bloque: "b2", tema: "Acento", texto: "A: y", cita: "A: y", fuentes: [{ nombre: "RAE", url: "https://www.rae.es/z" }] }] } };
const idsRep = P.bloquesAReparar(["MÍNIMO · Actividad b2cl1 (clasificar, bloque b2): tiene 4 tarjetas; agrega 2 o más"], []);
const invRep = P.inventarioParaReparar(Drep, idsRep);
ok([...idsRep].join() === "b2" && JSON.stringify(invRep) === JSON.stringify({ temas: [{ id: "tem2", texto: "Acento" }], categorias: [{ id: "cat6", grupo: "Acento", elementos: ["agudas"] }], investigado: [{ id: "inv2", bloque: "b2", tema: "Acento", cita: "A: y" }] }), "reparar: solo el inventario del bloque que repara y lo investigado sin urls · " + JSON.stringify(invRep));
const invTodo = P.inventarioParaReparar(Drep, new Set());
ok(Object.keys(invTodo).length === 4 && !JSON.stringify(invTodo).includes("https://") && [...P.bloquesAReparar(["Bloque b1: quedaron 2 actividades", "Punto difícil pd1 'x' tiene 1 actividad(es) en el bloque b3: faltan 2"], [{ bloque: "b2" }])].sort().join() === "b1,b2,b3", "si no se sabe qué bloque es, va todo (lo investigado, sin urls); los bloques salen de los huecos y de las pistas largas");
// h) Costos: lectura de caché de Sonnet 5.5 a 0.10 USD; Haiku 5 veces más arriba de 100 000 tokens; ortografía sin notas.
ok(JSON.stringify(P.precioDe("claude-sonnet-5-5", 5000)) === "[2,10,0.1]" && JSON.stringify(P.precioDe("claude-haiku-5-5", 120000)) === "[0.5,2.5,0.05]" && JSON.stringify(P.precioDe("claude-haiku-5-5", 50000)) === "[0.1,0.5,0.01]", "precios: lectura de caché de Sonnet 5.5 a 0.10; Haiku cobra 5 veces más arriba de 100 000 tokens");
const regN = P.textosDeGuia({ plan: { materia: "Español", identidad: {} }, bloques: [{ id: "b1", pistas: [{ id: "b1p1", titulo: "A", ideas: ["A: x"] }, { id: "b1nt1", titulo: "Repásalo en tu libro", ideas: ["Verbo: este tema venía en tu temario; repásalo en tu libro."], nota_temario: true }], actividades: [], mini_examen: [] }] });
ok(Object.keys(regN).some((k) => k.startsWith("b1p1")) && !Object.keys(regN).some((k) => k.startsWith("b1nt1")), "ortografía: las notas «repásalo en tu libro» no se mandan a revisar (las escribe el código)");

console.log(fallos ? `\n${fallos} prueba(s) fallaron` : "\nTodo bien");
process.exit(fallos ? 1 : 0);
