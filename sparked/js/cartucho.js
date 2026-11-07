// El cartucho: normaliza lo que manda la inteligencia artificial y arma el "estante" de slides
// según el Documento 2 (orden, presupuesto, rotación de plantillas). Aquí no se inventa contenido.

export const PALETAS = {
  historia: "historia_azul", "historia de méxico": "historia_azul", "world history": "historia_azul", history: "historia_azul",
  español: "espanol_rojo", espanol: "espanol_rojo", lengua: "espanol_rojo", spanish: "espanol_rojo",
  matemáticas: "mate_naranja", matematicas: "mate_naranja", math: "mate_naranja", mathematics: "mate_naranja",
  ciencias: "ciencias_verde", química: "ciencias_verde", quimica: "ciencias_verde", biología: "ciencias_verde", biologia: "ciencias_verde", física: "ciencias_verde", fisica: "ciencias_verde", science: "ciencias_verde", chemistry: "ciencias_verde", biology: "ciencias_verde", physics: "ciencias_verde",
  francés: "frances_cielo", frances: "frances_cielo", français: "frances_cielo", french: "frances_cielo",
  cívica: "civica_morado", civica: "civica_morado", civics: "civica_morado", ética: "civica_morado", etica: "civica_morado", ethics: "civica_morado", "formación cívica": "civica_morado",
  inglés: "ingles_mostaza", ingles: "ingles_mostaza", english: "ingles_mostaza",
  geografía: "geo_turquesa", geografia: "geo_turquesa", geography: "geo_turquesa",
};
const PALETAS_VALIDAS = new Set(["historia_azul", "espanol_rojo", "mate_naranja", "ciencias_verde", "frances_cielo", "civica_morado", "ingles_mostaza", "geo_turquesa", "otra"]);

export function paletaDe(cartucho) {
  const pedida = cartucho?.plan?.identidad?.paleta;
  if (PALETAS_VALIDAS.has(pedida)) return pedida;
  const materia = String(cartucho?.plan?.materia ?? "").toLowerCase();
  for (const [clave, pal] of Object.entries(PALETAS)) if (materia.includes(clave)) return pal;
  return "otra";
}

// Textos de la interfaz en el idioma de la guía.
export const TEXTOS = {
  es: { portada_tag: "Guía de estudio", aprender: "¿Qué vas a aprender hoy?", bloque: "Bloque", pista: "Pista", antes: "Antes de empezar", como_usar: "Cómo usar esta guía",
    mover: "Avanza y regresa", abajo: "Flecha abajo = siguiente slide", arriba: "Flecha arriba = slide anterior", barrita: "Usa la barrita", cuadritos: "Cuadritos = ver todas las slides",
    lupa: "Arrastra con el dedo o el mouse", juega: "¡Juega!", start: "Presiona START y arrastra o toca", reintenta: "Jugar de nuevo para mejorar tu marca", importante: "Importante:", termina: "termina cada juego antes de pasar a la siguiente slide.",
    a_jugar: "¡A jugar!", siguiente: "Siguiente slide ↓", de_nuevo: "Jugar de nuevo", cuidado: "⚠️ Ojo con esto", claves: "🔑 Palabras clave", calentamiento: "Calentamiento", mini: "Mini-examen", reto: "Reto final", resultados: "Mis resultados",
    ejemplo: "Ej.:", corregido: "✓ Dato corregido:", de_tus_notas: "De tus notas", pregunta: "Pregunta", de: "de", correctas: "aciertos", puntos: "puntos", calificacion: "Tu calificación", repasa: "⚠️ Repasa esto", perfecto: "¡Perfecto, sin errores!", nada_repasar: "Nada que repasar todavía. ¡Juega primero!",
    primer_intento: "al primer intento", verdadero: "Verdadero", falso: "Falso", revisar: "Revisar mi orden", banco: "Banco de palabras · arrastra cada una a su hueco", elige_coche: "Elige tu coche", listo: "¡Listo!", vidas: "Vidas", nivel: "Nivel", tiempo: "¡Se acabó el tiempo!", respuesta: "La respuesta era",
    ganaste: "¡Ganaste la carrera!", segundo: "¡Segundo lugar!", tercero: "Tercer lugar", sigue: "Sigue practicando", cima: "¡Llegaste a la cima!", buen_intento: "Buen intento", castillo_ok: "¡Defendiste el castillo!", castillo_mal: "Cayó el castillo…", game_over: "GAME OVER", suerte: "Better luck next time!", press_start: "PRESS START",
    gira: "Gira la ruleta con el dedo", o_toca: "O toca aquí para girar", vale: "Esta pregunta vale", ronda: "Ronda", cargando: "Generando tu guía…", sabias: "¿Sabías que…?", otro_dato: "¡Otro dato!", desbloquea: "Desbloquea tu guía entera", vista_previa: "Vista previa", slide: "slide",
    como_jugar: "¿Cómo se juega?", iniciar: "Iniciar",
    instr_carrera: "Elige tu coche y a correr: contesta cada pregunta antes de que se acabe el tiempo. Si aciertas, aceleras y rebasas; si fallas, te rebasan.",
    instr_montana: "Sube la montaña: cada respuesta correcta es un salto a la siguiente plataforma; cada error, un resbalón hacia abajo.",
    instr_castillo: "Defiende el castillo: contesta bien para lanzar la flecha antes de que los soldados lleguen a la torre. Tienes 3 vidas.",
    instr_swipe: "Lee la tarjeta y clasifícala con tu dedo: deslízala a la derecha si es verdadera y a la izquierda si es falsa (o usa los botones).",
    instr_superdato: "Completa el súper dato: toca una palabra del banco y luego el hueco donde va, o arrástrala. Cuidado: hay palabras de más.",
    instr_match: "Forma las parejas: toca un término y luego su definición, o arrástralo hasta ella. Si te equivocas, la tarjeta regresa.",
    instr_sort: "Clasifica cada tarjeta en su grupo: tócala y luego toca el grupo, o arrástrala.",
    instr_rank: "Pon los pasos en orden: toca una tarjeta y luego la casilla con su número, o arrástrala. Al terminar, pulsa Revisar mi orden.",
    instr_ruleta: "Gira la ruleta con el dedo para ver cuántos puntos vale la pregunta y contéstala. ¡Es el reto final!",
    instr_quiz: "Mini-examen: una pregunta a la vez, sin tiempo. Al final verás tu calificación y lo que te conviene repasar.",
    vf_express: "Verdadero o falso express", contrarreloj: "Contra reloj", instr_swipe: "Contra reloj: tienes 7 segundos por tarjeta y el reloj corre para todas. Lee rápido y clasifica con tu dedo: a la derecha si es verdadera, a la izquierda si es falsa (o usa los botones).",
    instr_puertas: "Muévete con las flechas del teclado o con las flechas de la pantalla: ◀ ▶ para caminar y ▲ ▼ en las escaleras. Cada puerta se abre contestando una pregunta: la respuesta correcta es la llave. Cuidado con los guardias; tienes 3 vidas. Llega a la salida de arriba.",
    puertas: "Puertas", puertas_ok: "¡Escapaste de la torre!", puertas_mal: "Te atraparon…", llega_puerta: "Camina hasta la puerta y contesta para abrirla", controles: "◀ ▶ caminar · ▲ ▼ escaleras · teclado o flechas de la pantalla", salida: "SALIDA",
    elige_nave: "Elige tu nave", elige_caballo: "Elige tu caballo", elige_dragon: "Elige tu dragón" },
  en: { portada_tag: "Study guide", aprender: "What will you learn today?", bloque: "Block", pista: "Clue", antes: "Before you start", como_usar: "How to use this lesson",
    mover: "Move forward and back", abajo: "Down arrow = next slide", arriba: "Up arrow = previous slide", barrita: "Use the toolbar", cuadritos: "Squares = see all slides",
    lupa: "Drag with your finger or mouse", juega: "Play!", start: "Press START, then drag or tap", reintenta: "Play again to beat your score", importante: "Important:", termina: "finish each game before you move to the next slide.",
    a_jugar: "Your turn!", siguiente: "Next slide ↓", de_nuevo: "Play again", cuidado: "⚠️ Watch out", claves: "🔑 Key words", calentamiento: "Warm-up", mini: "Mini-exam", reto: "Final challenge", resultados: "My results",
    ejemplo: "E.g.:", corregido: "✓ Corrected fact:", de_tus_notas: "From your notes", pregunta: "Question", de: "of", correctas: "correct", puntos: "points", calificacion: "Your grade", repasa: "⚠️ Review these", perfecto: "Perfect, no mistakes!", nada_repasar: "Nothing to review yet. Play first!",
    primer_intento: "on the first try", verdadero: "True", falso: "False", revisar: "Check my order", banco: "Word bank · drag each word into its gap", elige_coche: "Choose your car", listo: "Ready!", vidas: "Lives", nivel: "Level", tiempo: "Time's up!", respuesta: "The answer was",
    ganaste: "You won the race!", segundo: "Second place!", tercero: "Third place", sigue: "Keep practicing", cima: "You reached the top!", buen_intento: "Good try", castillo_ok: "You defended the castle!", castillo_mal: "The castle fell…", game_over: "GAME OVER", suerte: "Better luck next time!", press_start: "PRESS START",
    gira: "Spin the wheel with your finger", o_toca: "Or tap here to spin", vale: "This question is worth", ronda: "Round", cargando: "Building your guide…", sabias: "Did you know…?", otro_dato: "Another one!", desbloquea: "Unlock your full guide", vista_previa: "Preview", slide: "slide",
    como_jugar: "How to play", iniciar: "Start",
    instr_carrera: "Pick your car and race: answer each question before time runs out. Right answers speed you up and overtake; wrong ones let others pass you.",
    instr_montana: "Climb the mountain: every right answer is a jump to the next platform; every mistake, a slip down.",
    instr_castillo: "Defend the castle: answer right to shoot the arrow before the soldiers reach the tower. You have 3 lives.",
    instr_swipe: "Read the card and sort it with your finger: swipe right if it is true, left if it is false (or use the buttons).",
    instr_superdato: "Complete the super fact: tap a word from the bank and then the gap it belongs to, or drag it. Watch out: there are extra words.",
    instr_match: "Make the pairs: tap a term and then its definition, or drag it there. If you miss, the card comes back.",
    instr_sort: "Sort each card into its group: tap it and then the group, or drag it.",
    instr_rank: "Put the steps in order: tap a card and then its numbered slot, or drag it. When you finish, press Check my order.",
    instr_ruleta: "Spin the wheel with your finger to see how many points the question is worth, then answer it. It's the final challenge!",
    instr_quiz: "Mini-exam: one question at a time, no timer. At the end you'll see your grade and what to review.",
    vf_express: "True or false express", contrarreloj: "Against the clock", instr_swipe: "Against the clock: you get 7 seconds per card and the timer runs for all of them. Read fast and sort with your finger: right if it is true, left if it is false (or use the buttons).",
    instr_puertas: "Move with the keyboard arrows or the on-screen arrows: ◀ ▶ to walk and ▲ ▼ on the ladders. Each door opens by answering a question: the right answer is the key. Watch out for the guards; you have 3 lives. Reach the exit at the top.",
    puertas: "Doors", puertas_ok: "You escaped the tower!", puertas_mal: "They caught you…", llega_puerta: "Walk to the door and answer to open it", controles: "◀ ▶ walk · ▲ ▼ ladders · keyboard or on-screen arrows", salida: "EXIT",
    elige_nave: "Choose your ship", elige_caballo: "Choose your horse", elige_dragon: "Choose your dragon" },
  fr: { portada_tag: "Guide d'étude", aprender: "Qu'est-ce que tu vas apprendre ?", bloque: "Bloc", pista: "Indice", antes: "Avant de commencer", como_usar: "Comment utiliser ce guide",
    mover: "Avance et recule", abajo: "Flèche en bas = slide suivante", arriba: "Flèche en haut = slide précédente", barrita: "Utilise la barre", cuadritos: "Carrés = voir toutes les slides",
    lupa: "Glisse avec le doigt ou la souris", juega: "Joue !", start: "Appuie sur START, puis glisse ou touche", reintenta: "Rejoue pour battre ton score", importante: "Important :", termina: "termine chaque jeu avant de passer à la slide suivante.",
    a_jugar: "À toi de jouer !", siguiente: "Slide suivante ↓", de_nuevo: "Rejouer", cuidado: "⚠️ Attention", claves: "🔑 Mots-clés", calentamiento: "Échauffement", mini: "Mini-examen", reto: "Défi final", resultados: "Mes résultats",
    ejemplo: "Ex. :", corregido: "✓ Donnée corrigée :", de_tus_notas: "De tes notes", pregunta: "Question", de: "sur", correctas: "bonnes réponses", puntos: "points", calificacion: "Ta note", repasa: "⚠️ À revoir", perfecto: "Parfait, aucune erreur !", nada_repasar: "Rien à revoir pour l'instant. Joue d'abord !",
    primer_intento: "du premier coup", verdadero: "Vrai", falso: "Faux", revisar: "Vérifier mon ordre", banco: "Banque de mots · glisse chaque mot dans son trou", elige_coche: "Choisis ta voiture", listo: "Prêt !", vidas: "Vies", nivel: "Niveau", tiempo: "Temps écoulé !", respuesta: "La réponse était",
    ganaste: "Tu as gagné la course !", segundo: "Deuxième place !", tercero: "Troisième place", sigue: "Continue à t'entraîner", cima: "Tu es au sommet !", buen_intento: "Bel essai", castillo_ok: "Tu as défendu le château !", castillo_mal: "Le château est tombé…", game_over: "GAME OVER", suerte: "Better luck next time!", press_start: "PRESS START",
    gira: "Fais tourner la roue avec le doigt", o_toca: "Ou touche ici pour tourner", vale: "Cette question vaut", ronda: "Manche", cargando: "Création de ton guide…", sabias: "Le savais-tu ?", otro_dato: "Un autre !", desbloquea: "Débloque ton guide complet", vista_previa: "Aperçu", slide: "slide",
    como_jugar: "Comment jouer ?", iniciar: "Commencer",
    instr_carrera: "Choisis ta voiture et fonce : réponds à chaque question avant la fin du temps. Une bonne réponse accélère et dépasse ; une erreur, et on te dépasse.",
    instr_montana: "Grimpe la montagne : chaque bonne réponse est un saut vers la plateforme suivante ; chaque erreur, une glissade.",
    instr_castillo: "Défends le château : réponds bien pour tirer la flèche avant que les soldats n'atteignent la tour. Tu as 3 vies.",
    instr_swipe: "Lis la carte et classe-la avec ton doigt : glisse à droite si c'est vrai, à gauche si c'est faux (ou utilise les boutons).",
    instr_superdato: "Complète le super fait : touche un mot de la banque puis le trou où il va, ou glisse-le. Attention : il y a des mots en trop.",
    instr_match: "Forme les paires : touche un terme puis sa définition, ou glisse-le dessus. Si tu te trompes, la carte revient.",
    instr_sort: "Classe chaque carte dans son groupe : touche-la puis le groupe, ou glisse-la.",
    instr_rank: "Mets les étapes dans l'ordre : touche une carte puis sa case numérotée, ou glisse-la. À la fin, appuie sur Vérifier mon ordre.",
    instr_ruleta: "Fais tourner la roue avec le doigt pour voir combien de points vaut la question, puis réponds. C'est le défi final !",
    instr_quiz: "Mini-examen : une question à la fois, sans chrono. À la fin, tu verras ta note et ce qu'il faut revoir.",
    vf_express: "Vrai ou faux express", contrarreloj: "Contre la montre", instr_swipe: "Contre la montre : tu as 7 secondes par carte et le chrono tourne pour toutes. Lis vite et classe avec ton doigt : à droite si c'est vrai, à gauche si c'est faux (ou utilise les boutons).",
    instr_puertas: "Déplace-toi avec les flèches du clavier ou celles de l'écran : ◀ ▶ pour marcher et ▲ ▼ sur les échelles. Chaque porte s'ouvre en répondant à une question : la bonne réponse est la clé. Attention aux gardes ; tu as 3 vies. Rejoins la sortie en haut.",
    puertas: "Portes", puertas_ok: "Tu t'es échappé de la tour !", puertas_mal: "Ils t'ont attrapé…", llega_puerta: "Marche jusqu'à la porte et réponds pour l'ouvrir", controles: "◀ ▶ marcher · ▲ ▼ échelles · clavier ou flèches de l'écran", salida: "SORTIE",
    elige_nave: "Choisis ton vaisseau", elige_caballo: "Choisis ton cheval", elige_dragon: "Choisis ton dragon" },
};
export const t = (idioma, clave) => (TEXTOS[idioma] ?? TEXTOS.es)[clave] ?? TEXTOS.es[clave] ?? clave;

// Mezcla con semilla (para que la misma guía salga igual en todos los aparatos de la familia).
export function mezclar(arr, semilla = 1) {
  const a = arr.slice(); let s = (semilla >>> 0) || 1;
  const r = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export function semillaDe(texto) { let h = 2166136261; for (const ch of String(texto)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

// Normaliza un cartucho (v1.0, 1.1 o 1.2) a la forma que usa el reproductor.
export function normalizar(entrada) {
  const c = JSON.parse(JSON.stringify(entrada ?? {}));
  c.plan ??= {};
  c.plan.identidad ??= {};
  c.plan.identidad.titulo ??= c.plan.materia ?? "Guía de estudio";
  c.plan.identidad.subtitulo ??= "";
  c.plan.identidad.emojis_portada ??= ["📘", "✏️", "🧠", "⭐"];
  c.plan.identidad.objetivos ??= [];
  c.plan.identidad.retratos_portada ??= [];
  c.plan.identidad.paleta = paletaDe(c);
  c.plan.idioma_guia = ["es", "en", "fr"].includes(c.plan.idioma_guia) ? c.plan.idioma_guia : "es";
  c.plan.perfil_edad ??= "juvenil";
  c.plan.puntos_dificiles ??= [];
  c.plan.grado ??= "";
  c.bloques = (c.bloques ?? []).map((b, i) => ({
    ...b, id: b.id ?? `b${i + 1}`, titulo: b.titulo ?? `${i + 1}`,
    pistas: (b.pistas ?? []).map((p, j) => ({ ...p, id: p.id ?? `b${i + 1}p${j + 1}`, ideas: p.ideas ?? [], emoji: p.emoji ?? "💡" })),
    actividades: Array.isArray(b.actividades) ? b.actividades : aplanar(b.actividades),
    mini_examen: b.mini_examen ?? [],
  }));
  c.calentamiento ??= []; c.reto_final ??= [];
  // índice por id y datos derivados
  c.porId = {};
  c.bloques.forEach((b) => [...b.actividades, ...b.mini_examen].forEach((a) => { if (a?.id) c.porId[a.id] = a; }));
  c.bloqueDePunto = {};
  c.bloques.forEach((b) => b.actividades.forEach((a) => { if (a.punto_dificil) c.bloqueDePunto[a.punto_dificil] = b.id; }));
  // calentamiento y reto final: si no vienen, se arman con lo que hay
  if (!c.calentamiento.length) c.calentamiento = c.bloques.slice(0, 2).flatMap((b) => b.actividades.filter((a) => a.tipo === "opcion_multiple" && a.dificultad !== "retadora").slice(0, 3).map((a) => a.id)).slice(0, 6);
  if (!c.reto_final.length) c.reto_final = mezclar(c.bloques.flatMap((b) => b.actividades.filter((a) => ["opcion_multiple", "verdadero_falso", "completar"].includes(a.tipo)).map((a) => a.id)), 99).slice(0, 16);
  c.semilla = semillaDe(c.plan.identidad.titulo + c.bloques.length);
  return c;
}
// Las actividades pueden venir agrupadas por tipo (formato del Generador); aquí se aplanan.
function aplanar(obj) {
  if (!obj || typeof obj !== "object") return [];
  const out = [];
  for (const [tipo, lista] of Object.entries(obj)) for (const a of lista ?? []) out.push({ ...a, tipo: a.tipo ?? tipo });
  return out;
}

// ---------- Estante de juegos: qué contenido va a qué juego ----------
// Plantillas por mecánica (las de pixel art). Se eligen al azar sin repetir dentro de la guía.
export const PLANTILLAS = {
  carrera: ["ciudad_neon", "espacio", "hipodromo", "dragones"], // coches, naves, caballos y dragones: misma mecánica, distinto personaje
  montana: ["nevada", "volcan", "aurora"],
  castillo: ["noche", "amanecer", "dragon"],
  puertas: ["torre", "mansion", "bodega"],
  swipe: ["arcade", "cartas", "neon"],
  superdato: ["laboratorio", "pergamino", "terminal"],
  match: ["planeta", "estacion", "luna"],
  sort: ["naves", "cofres", "portales"],
  rank: ["cohetes", "escalera", "vagones"],
  ruleta: ["luces", "casino", "neon"],
  quiz: ["consola", "tablet", "pizarra"],
};

export function armarSlides(c) {
  const idioma = c.plan.idioma_guia;
  const usadas = new Set();
  let n = 0;
  const elegir = (juego) => {
    const lista = PLANTILLAS[juego] ?? ["base"];
    const libres = lista.filter((p) => !usadas.has(juego + ":" + p));
    const opciones = libres.length ? libres : lista;
    const p = opciones[(c.semilla + n++) % opciones.length];
    usadas.add(juego + ":" + p);
    return p;
  };
  const S = [];
  S.push({ k: "portada", t: c.plan.identidad.titulo, blk: -1 });
  S.push({ k: "tutorial", t: t(idioma, "como_usar"), blk: -1 });
  if (c.calentamiento.length) S.push({ k: "carrera", t: `🔥 ${t(idioma, "calentamiento")}`, ids: c.calentamiento, tag: t(idioma, "calentamiento"), blk: 0, plantilla: elegir("carrera"), calentamiento: true });
  const quizJuegos = ["carrera", "puertas", "montana", "castillo"];
  c.bloques.forEach((b, bi) => {
    const nb = bi + 1;
    // teoría: 2 o 3 pistas por slide; la última slide de teoría del bloque lleva "Ojo" y "Palabras clave"
    const pistas = b.pistas;
    const grupos = [];
    for (let i = 0; i < pistas.length; i += 3) {
      const resto = pistas.length - i;
      grupos.push(pistas.slice(i, i + (resto === 4 ? 2 : 3)));
    }
    if (!grupos.length) grupos.push([]);
    // Si la primera pista del grupo trae `titulo_pagina`, la slide se titula así (como las páginas "Clue" de Lumio).
    grupos.forEach((g, gi) => S.push({ k: "teoria", t: g[0]?.titulo_pagina || `${t(idioma, "pista")} · ${b.titulo}${grupos.length > 1 ? ` (${gi + 1})` : ""}`, b, bi, pistas: g, parte: gi + 1, ultima: gi === grupos.length - 1, tag: `${t(idioma, "pista")} · ${t(idioma, "bloque")} ${nb}`, blk: bi }));
    const acts = b.actividades;
    const mc = acts.filter((a) => a.tipo === "opcion_multiple" || a.tipo === "completar").map((a) => a.id);
    if (mc.length) { const juego = quizJuegos[bi % quizJuegos.length]; S.push({ k: juego, t: `${{ carrera: "🏎️", puertas: "🚪", montana: "🧗", castillo: "🏰" }[juego]} ${b.titulo}`, ids: mc, tag: `${t(idioma, "bloque")} ${nb}`, blk: bi, plantilla: elegir(juego) }); }
    const vf = acts.filter((a) => a.tipo === "verdadero_falso");
    if (vf.length) S.push({ k: "swipe", t: `⏱ ${t(idioma, "vf_express")}`, items: vf, tag: `${t(idioma, "bloque")} ${nb}`, blk: bi, plantilla: elegir("swipe") });
    acts.filter((a) => a.tipo === "super_dato").forEach((a) => S.push({ k: "superdato", t: "⭐ Súper dato", a, tag: `${t(idioma, "bloque")} ${nb}`, blk: bi, plantilla: elegir("superdato") }));
    acts.filter((a) => a.tipo === "conceptos").forEach((a) => S.push({ k: "match", t: "🧩 Mix & match", a, tag: `${t(idioma, "bloque")} ${nb}`, blk: bi, plantilla: elegir("match") }));
    acts.filter((a) => a.tipo === "quien_es_quien").forEach((a) => S.push({ k: "match", t: "🖼️ ¿Quién es quién?", a, tag: `${t(idioma, "bloque")} ${nb}`, blk: bi, plantilla: elegir("match"), retratos: true }));
    acts.filter((a) => a.tipo === "ordenar").forEach((a) => S.push({ k: "rank", t: "🔢 Rank order", a, tag: `${t(idioma, "bloque")} ${nb}`, blk: bi, plantilla: elegir("rank") }));
    acts.filter((a) => a.tipo === "clasificar").forEach((a) => S.push({ k: "sort", t: "🗂️ Super sort", a, tag: `${t(idioma, "bloque")} ${nb}`, blk: bi, plantilla: elegir("sort") }));
    if (b.mini_examen.length) S.push({ k: "quiz", t: `✅ ${t(idioma, "mini")} ${nb} · ${b.titulo}`, ids: b.mini_examen.map((x) => x.id), tag: `${t(idioma, "mini")} ${nb}`, blk: bi, plantilla: elegir("quiz") });
  });
  if (c.reto_final.length) S.push({ k: "ruleta", t: `🏆 ${t(idioma, "reto")}`, ids: c.reto_final, tag: t(idioma, "reto"), blk: -1, plantilla: elegir("ruleta") });
  S.push({ k: "resultados", t: t(idioma, "resultados"), blk: -1 });
  return recortar(S, c);
}

// Presupuesto de slides (Documento 2): si sobran juegos, se recortan en este orden:
// segundo ordenar/clasificar del bloque → completar extra → V/F extra. Nunca teoría, mini-exámenes ni reto final.
function recortar(S, c) {
  const tope = Math.min(40, Math.max(15, Number(c.plan.presupuesto_slides) || 40));
  const quitar = (filtro) => { const i = S.findLastIndex(filtro); if (i >= 0) S.splice(i, 1); };
  let guarda = 50;
  while (S.length > tope && guarda-- > 0) {
    const vistos = {};
    let hecho = false;
    for (let i = S.length - 1; i >= 0; i--) { const s = S[i]; if (s.k === "rank" || s.k === "sort") { const k = s.blk + s.k; vistos[k] = (vistos[k] ?? 0) + 1; if (vistos[k] > 1) { S.splice(i, 1); hecho = true; break; } } }
    if (hecho) continue;
    const antes = S.length; quitar((s) => s.k === "swipe"); if (S.length < antes) continue;
    break;
  }
  return S;
}

// Vista previa gratis: portada, primera pista y primer juego. El resto se bloquea.
export function recortarVistaPrevia(c) {
  const v = JSON.parse(JSON.stringify({ version_formato: c.version_formato, plan: c.plan, bloques: [], calentamiento: [], reto_final: [] }));
  const b0 = c.bloques[0];
  if (b0) {
    const acts = b0.actividades;
    const juego = acts.filter((a) => a.tipo === "opcion_multiple" || a.tipo === "completar").slice(0, 6);
    v.bloques.push({ id: b0.id, titulo: b0.titulo, pistas: b0.pistas.slice(0, 3), actividades: juego, mini_examen: [] });
  }
  v.plan = { ...v.plan, presupuesto_slides: 40 };
  v.vista_previa = true;
  v.bloques_totales = c.bloques.length;
  v.actividades_totales = c.bloques.reduce((n, b) => n + b.actividades.length + b.mini_examen.length, 0);
  return v;
}

export const formatoDePista = (pista, indice, total) => {
  if (pista.formato) return pista.formato;
  const e = pista.esquema?.tipo;
  if (e === "linea_tiempo") return "linea_tiempo";
  if (e === "comparacion") return "comparacion";
  if (e === "mapa" || e === "partes") return "categorias";
  if (e === "ciclo" || e === "causa_efecto") return "lista_iconos";
  if (pista.imagenes?.length) return "retratos";
  return "tarjetas";
};
