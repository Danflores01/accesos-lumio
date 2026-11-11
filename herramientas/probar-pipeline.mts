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
const sinQuiz = JSON.parse(JSON.stringify(cBueno)); sinQuiz.bloques[0].actividades = sinQuiz.bloques[0].actividades.filter((a: any) => a.tipo !== "opcion_multiple").concat([{ id: "vf1", tipo: "verdadero_falso" }]);
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
const apiTexto = (j: unknown, urls: string[] = []) => ({ content: [
  ...(urls.length ? [{ type: "server_tool_use", id: "s1", name: "web_search", input: { query: "x" } }, { type: "web_search_tool_result", tool_use_id: "s1", content: urls.map((url) => ({ type: "web_search_result", url, title: "t" })) }] : []),
  { type: "text", text: JSON.stringify(j) }], stop_reason: "end_turn", usage: { input_tokens: 1000, output_tokens: 400, server_tool_use: { web_search_requests: urls.length ? 2 : 0 } } });

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
  { tema: "Tradición oral", estado: "confirmado", datos: [{ texto: "Coplas: versos breves para cantar.", fuentes: [{ nombre: "INAH", url: "https://www.inah.gob.mx/coplas" }] }, { texto: "Refranes: dichos con una enseñanza.", fuentes: [{ nombre: "INAH", url: "https://www.inah.gob.mx/refranes" }] }] }] }, vistasF)];
const sig1 = await P.ejecutarPaso(falso, tG, fuenteG);
const inv = tG.datos.investigacion ?? [];
const pedInv = pedidos[0];
ok(sig1 === "generar:0" && pedidos.length === 1 && /ERES EL INVESTIGADOR/.test(pedInv.system[0].text) && pedInv.tools[0].max_uses === 6 && pedInv.tools[0].allowed_domains.includes("conaliteg.sep.gob.mx") && !/Gapped/.test(pedInv.messages[0].content[0].text), "paso: una llamada de investigación con búsqueda en dominios confiables y sin la práctica del examen");
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
ok(pendM.length === P.MAX_TEMAS_INVESTIGAR && muchos.investigacion.length === 3 && muchos.investigacion.every((r: any) => r.estado === "no_confirmado"), `tope: se investigan ${P.MAX_TEMAS_INVESTIGAR} temas por guía; los demás quedan como nota`);
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
ok(P.reportesContradice([{ estado: "corregida" }, { estado: "no_confirmada" }], []).length === 0, "solo «contradice_libro» va a Reportes (corregida y no_confirmada, no)");

// 24. El reproductor muestra la marca: caja azul en la pista y la fuente en las preguntas (nunca «De tus notas»).
const leerRepo = (r: string) => readFileSync(join(repo, r), "utf8");
const cartJs = leerRepo("sparked/js/cartucho.js"), teoJs = leerRepo("sparked/js/teoria.js"), uiJs = leerRepo("sparked/js/ui.js");
ok((cartJs.match(/con_fuentes: "/g) ?? []).length === 3 && /"completado_con_fuentes"\]/.test(cartJs) && /caja-fuentes/.test(teoJs) && /fuente\?\.tipo === "investigado"/.test(uiJs) && /\.caja-fuentes/.test(leerRepo("sparked/css/base.css")), "reproductor: «Completado con fuentes» en español, inglés y francés; caja en la pista y fuente en las preguntas");

console.log(fallos ? `\n${fallos} prueba(s) fallaron` : "\nTodo bien");
process.exit(fallos ? 1 : 0);
