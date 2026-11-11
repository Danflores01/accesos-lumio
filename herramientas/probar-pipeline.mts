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

console.log(fallos ? `\n${fallos} prueba(s) fallaron` : "\nTodo bien");
process.exit(fallos ? 1 : 0);
