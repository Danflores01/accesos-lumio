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
    primer_intento: "al primer intento", salir_pantalla: "Salir de pantalla completa", verdadero: "Verdadero", falso: "Falso", revisar: "Revisar mi orden", banco: "Banco de palabras · arrastra cada una a su hueco", elige_coche: "Elige tu coche", listo: "¡Listo!", vidas: "Vidas", nivel: "Nivel", tiempo: "¡Se acabó el tiempo!", respuesta: "La respuesta era",
    ganaste: "¡Ganaste la carrera!", segundo: "¡Segundo lugar!", tercero: "Tercer lugar", sigue: "Sigue practicando", cima: "¡Llegaste a la cima!", buen_intento: "Buen intento", castillo_ok: "¡Defendiste el castillo!", castillo_mal: "Cayó el castillo…", game_over: "GAME OVER", suerte: "Better luck next time!", press_start: "PRESS START",
    gira: "Gira la ruleta con el dedo", o_toca: "O toca aquí para girar", vale: "Esta pregunta vale", ronda: "Ronda", cargando: "Generando tu guía…", sabias: "¿Sabías que…?", otro_dato: "¡Otro dato!", desbloquea: "Desbloquea tu guía entera", vista_previa: "Vista previa", slide: "slide",
    como_jugar: "¿Cómo se juega?", iniciar: "Iniciar",
    instr_carrera: "A correr: contesta cada pregunta antes de que se acabe el tiempo. Si aciertas, aceleras y rebasas; si fallas, te rebasan.",
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
    elige_nave: "Elige tu nave", elige_caballo: "Elige tu caballo", elige_dragon: "Elige tu dragón",
    // Juegos nuevos (8 nov 2026): elige tu personaje, enemigos, clavados de pingüino y el perro con sus platos.
    quien_ser: "¿Quién quieres ser?", p_sparky: "Sparky", p_princesa: "Princesa guerrera",
    instr_enemigos: "Vence a los enemigos: cada enemigo es una pregunta. Si contestas bien, tu personaje lo derrota y avanza; si fallas, el enemigo te golpea, pierdes una vida y ese enemigo vuelve más adelante. Tienes 3 vidas.",
    enemigos: "Enemigos", enemigo: "Enemigo", enemigos_ok: "¡Venciste a todos los enemigos!", enemigos_mal: "¡Inténtalo de nuevo!", enemigos_vencidos: "enemigos vencidos",
    enemigos_animo: "Perdiste tus 3 vidas. Repasa la pista y vuelve a intentarlo: cada pregunta que repasas te hace más fuerte.", repasar_pista: "📖 Repasar la pista",
    instr_pinguino: "Clavados de pingüino: contesta cada pregunta antes de que se acabe el tiempo. Si aciertas, el pingüino hace un clavado espectacular y el jurado le da 10. Si fallas, el clavado sale mal y el jurado da notas bajas. Al final verás el promedio del jurado.",
    pinguino: "Clavados de pingüino", jurado: "Jurado", promedio: "Promedio del jurado", ping_oro: "¡Clavados de campeonato!", ping_plata: "¡Muy buenos clavados!", ping_bronce: "Buen intento", ping_sigue: "Sigue practicando",
    clavados: "¡Triple mortal!|¡Tirabuzón!|¡Bala de cañón!|¡Clavado de cisne!|¡Doble mortal hacia atrás!", fallas: "¡Panzazo!|¡Resbalón!|¡Choque con el hielo!|¡Se quedó corto!|¡De cabeza en la nieve!",
    instr_perro: "Lee la afirmación y llévala al plato correcto: arrástrala, o tócala y luego toca el plato. Si aciertas, el perro se la come feliz. Si no, el perro la regresa y te explica por qué.",
    perro: "El perro y su plato", perro_listo: "¡El perro quedó feliz!",
    // Reporte final (7 nov 2026): calificación sobre toda la guía y "Qué te conviene repasar" por bloque.
    como_te_fue: "¿Cómo te fue?", avance: "Avance", actividades: "actividades", calif_final: "Calificación",
    te_faltan: "Te faltan {n} actividades. Tu calificación sube cuando las contestes.", te_falta_una: "Te falta 1 actividad. Tu calificación sube cuando la contestes.",
    ir_pendiente: "Ir a la primera actividad sin contestar", completo: "¡Contestaste todas las actividades!", sobre_total: "La calificación cuenta todas las actividades de la guía.",
    que_repasar: "Qué te conviene repasar", dominado: "Dominado", reforzar: "A reforzar", sin_contestar: "Sin contestar", bien: "bien", mal: "mal", ver_pista: "Ver pista", todo_bien: "Todo bien en este bloque.",
    animo_dominado: "¡Lo dominas! Un repaso rápido antes del examen y listo.", animo_reforzar: "Vas por buen camino. Repasa estas pistas y vuelve a jugar: ¡tú puedes!", animo_sin: "Aún no empiezas este bloque. Juega sus actividades y descubre todo lo que ya sabes.", animo_pendiente: "¡Ya empezaste! Termina sus actividades para ver todo lo que dominas.",
    para_papas: "Para mamá o papá", papas_avance: "Avance: {x} de {y} actividades ({p} %). Calificación sobre toda la guía: {z} %.",
    papas_domina: "Domina: {lista}.", papas_reforzar: "Conviene reforzar: {lista}.", papas_sin: "Falta contestar: {lista}.",
    papas_falta: "Sugerencia: que termine las actividades que faltan; la calificación se actualiza sola.", papas_repasar: "Sugerencia: repasen juntos las pistas marcadas y vuelvan a jugar esos juegos.", papas_ok: "Sugerencia: un repaso rápido de las pistas antes del examen es suficiente.",
    examenes: "Mini-exámenes y reto",
    // Compartir resultados (7 nov 2026): texto para WhatsApp e imagen PNG para mamá o papá.
    compartir: "Compartir resultados", comp_whatsapp: "Enviar por WhatsApp", comp_imagen: "Guardar como imagen", comp_cerrar: "Cerrar",
    comp_repasar: "Repasar", comp_mas: "y {n} temas más", comp_mas1: "y 1 tema más", comp_error: "No se pudo compartir. Intenta de nuevo.", comp_guardada: "Imagen guardada en tus descargas.",
    comp_generando: "Preparando la imagen…", comp_locale: "es-MX" },
  en: { portada_tag: "Study guide", aprender: "What will you learn today?", bloque: "Block", pista: "Clue", antes: "Before you start", como_usar: "How to use this lesson",
    mover: "Move forward and back", abajo: "Down arrow = next slide", arriba: "Up arrow = previous slide", barrita: "Use the toolbar", cuadritos: "Squares = see all slides",
    lupa: "Drag with your finger or mouse", juega: "Play!", start: "Press START, then drag or tap", reintenta: "Play again to beat your score", importante: "Important:", termina: "finish each game before you move to the next slide.",
    a_jugar: "Your turn!", siguiente: "Next slide ↓", de_nuevo: "Play again", cuidado: "⚠️ Watch out", claves: "🔑 Key words", calentamiento: "Warm-up", mini: "Mini-exam", reto: "Final challenge", resultados: "My results",
    ejemplo: "E.g.:", corregido: "✓ Corrected fact:", de_tus_notas: "From your notes", pregunta: "Question", de: "of", correctas: "correct", puntos: "points", calificacion: "Your grade", repasa: "⚠️ Review these", perfecto: "Perfect, no mistakes!", nada_repasar: "Nothing to review yet. Play first!",
    primer_intento: "on the first try", salir_pantalla: "Exit full screen", verdadero: "True", falso: "False", revisar: "Check my order", banco: "Word bank · drag each word into its gap", elige_coche: "Choose your car", listo: "Ready!", vidas: "Lives", nivel: "Level", tiempo: "Time's up!", respuesta: "The answer was",
    ganaste: "You won the race!", segundo: "Second place!", tercero: "Third place", sigue: "Keep practicing", cima: "You reached the top!", buen_intento: "Good try", castillo_ok: "You defended the castle!", castillo_mal: "The castle fell…", game_over: "GAME OVER", suerte: "Better luck next time!", press_start: "PRESS START",
    gira: "Spin the wheel with your finger", o_toca: "Or tap here to spin", vale: "This question is worth", ronda: "Round", cargando: "Building your guide…", sabias: "Did you know…?", otro_dato: "Another one!", desbloquea: "Unlock your full guide", vista_previa: "Preview", slide: "slide",
    como_jugar: "How to play", iniciar: "Start",
    instr_carrera: "Race time: answer each question before time runs out. Right answers speed you up and overtake; wrong ones let others pass you.",
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
    elige_nave: "Choose your ship", elige_caballo: "Choose your horse", elige_dragon: "Choose your dragon",
    quien_ser: "Who do you want to be?", p_sparky: "Sparky", p_princesa: "Warrior princess",
    instr_enemigos: "Defeat the enemies: each enemy is a question. If you answer right, your character defeats it and moves on; if you are wrong, the enemy hits you, you lose a life and that enemy comes back later. You have 3 lives.",
    enemigos: "Enemies", enemigo: "Enemy", enemigos_ok: "You defeated every enemy!", enemigos_mal: "Try again!", enemigos_vencidos: "enemies defeated",
    enemigos_animo: "You lost your 3 lives. Review the clue and try again: every question you review makes you stronger.", repasar_pista: "📖 Review the clue",
    instr_pinguino: "Penguin diving: answer each question before time runs out. If you are right, the penguin does an amazing dive and the judges give it a 10. If you are wrong, the dive goes wrong and the judges give low scores. At the end you will see the judges' average.",
    pinguino: "Penguin diving", jurado: "Judges", promedio: "Judges' average", ping_oro: "Championship dives!", ping_plata: "Very good dives!", ping_bronce: "Good try", ping_sigue: "Keep practicing",
    clavados: "Triple flip!|Twist!|Cannonball!|Swan dive!|Double back flip!", fallas: "Belly flop!|Slip!|Ice crash!|Too short!|Head first in the snow!",
    instr_perro: "Read the statement and take it to the right bowl: drag it, or tap it and then tap the bowl. If you are right, the dog happily eats it. If not, the dog pushes it back and tells you why.",
    perro: "The dog and its bowl", perro_listo: "The dog is happy!",
    como_te_fue: "How did you do?", avance: "Progress", actividades: "activities", calif_final: "Grade",
    te_faltan: "You have {n} activities left. Your grade goes up when you answer them.", te_falta_una: "You have 1 activity left. Your grade goes up when you answer it.",
    ir_pendiente: "Go to the first unanswered activity", completo: "You answered every activity!", sobre_total: "The grade counts every activity in the guide.",
    que_repasar: "What you should review", dominado: "Mastered", reforzar: "Needs review", sin_contestar: "Not answered", bien: "right", mal: "wrong", ver_pista: "See clue", todo_bien: "All good in this block.",
    animo_dominado: "You've got it! A quick review before the test and you're ready.", animo_reforzar: "You're on the right track. Review these clues and play again: you can do it!", animo_sin: "You haven't started this block yet. Play its activities and find out how much you already know.", animo_pendiente: "You've started! Finish its activities to see everything you know.",
    para_papas: "For mom or dad", papas_avance: "Progress: {x} of {y} activities ({p} %). Grade for the whole guide: {z} %.",
    papas_domina: "Mastered: {lista}.", papas_reforzar: "Needs review: {lista}.", papas_sin: "Not answered yet: {lista}.",
    papas_falta: "Tip: have them finish the missing activities; the grade updates by itself.", papas_repasar: "Tip: go over the marked clues together and play those games again.", papas_ok: "Tip: a quick review of the clues before the test is enough.",
    examenes: "Mini-exams and challenge",
    compartir: "Share results", comp_whatsapp: "Send by WhatsApp", comp_imagen: "Save as image", comp_cerrar: "Close",
    comp_repasar: "Review", comp_mas: "and {n} more topics", comp_mas1: "and 1 more topic", comp_error: "Could not share. Please try again.", comp_guardada: "Image saved to your downloads.",
    comp_generando: "Preparing the image…", comp_locale: "en-US" },
  fr: { portada_tag: "Guide d'étude", aprender: "Qu'est-ce que tu vas apprendre ?", bloque: "Bloc", pista: "Indice", antes: "Avant de commencer", como_usar: "Comment utiliser ce guide",
    mover: "Avance et recule", abajo: "Flèche en bas = slide suivante", arriba: "Flèche en haut = slide précédente", barrita: "Utilise la barre", cuadritos: "Carrés = voir toutes les slides",
    lupa: "Glisse avec le doigt ou la souris", juega: "Joue !", start: "Appuie sur START, puis glisse ou touche", reintenta: "Rejoue pour battre ton score", importante: "Important :", termina: "termine chaque jeu avant de passer à la slide suivante.",
    a_jugar: "À toi de jouer !", siguiente: "Slide suivante ↓", de_nuevo: "Rejouer", cuidado: "⚠️ Attention", claves: "🔑 Mots-clés", calentamiento: "Échauffement", mini: "Mini-examen", reto: "Défi final", resultados: "Mes résultats",
    ejemplo: "Ex. :", corregido: "✓ Donnée corrigée :", de_tus_notas: "De tes notes", pregunta: "Question", de: "sur", correctas: "bonnes réponses", puntos: "points", calificacion: "Ta note", repasa: "⚠️ À revoir", perfecto: "Parfait, aucune erreur !", nada_repasar: "Rien à revoir pour l'instant. Joue d'abord !",
    primer_intento: "du premier coup", salir_pantalla: "Quitter le plein écran", verdadero: "Vrai", falso: "Faux", revisar: "Vérifier mon ordre", banco: "Banque de mots · glisse chaque mot dans son trou", elige_coche: "Choisis ta voiture", listo: "Prêt !", vidas: "Vies", nivel: "Niveau", tiempo: "Temps écoulé !", respuesta: "La réponse était",
    ganaste: "Tu as gagné la course !", segundo: "Deuxième place !", tercero: "Troisième place", sigue: "Continue à t'entraîner", cima: "Tu es au sommet !", buen_intento: "Bel essai", castillo_ok: "Tu as défendu le château !", castillo_mal: "Le château est tombé…", game_over: "GAME OVER", suerte: "Better luck next time!", press_start: "PRESS START",
    gira: "Fais tourner la roue avec le doigt", o_toca: "Ou touche ici pour tourner", vale: "Cette question vaut", ronda: "Manche", cargando: "Création de ton guide…", sabias: "Le savais-tu ?", otro_dato: "Un autre !", desbloquea: "Débloque ton guide complet", vista_previa: "Aperçu", slide: "slide",
    como_jugar: "Comment jouer ?", iniciar: "Commencer",
    instr_carrera: "À toi de courir : réponds à chaque question avant la fin du temps. Une bonne réponse accélère et dépasse ; une erreur, et on te dépasse.",
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
    elige_nave: "Choisis ton vaisseau", elige_caballo: "Choisis ton cheval", elige_dragon: "Choisis ton dragon",
    quien_ser: "Qui veux-tu être ?", p_sparky: "Sparky", p_princesa: "Princesse guerrière",
    instr_enemigos: "Bats les ennemis : chaque ennemi est une question. Si tu réponds bien, ton personnage le bat et avance ; si tu te trompes, l'ennemi te frappe, tu perds une vie et cet ennemi revient plus tard. Tu as 3 vies.",
    enemigos: "Ennemis", enemigo: "Ennemi", enemigos_ok: "Tu as battu tous les ennemis !", enemigos_mal: "Essaie encore !", enemigos_vencidos: "ennemis battus",
    enemigos_animo: "Tu as perdu tes 3 vies. Revois l'indice et réessaie : chaque question revue te rend plus fort.", repasar_pista: "📖 Revoir l'indice",
    instr_pinguino: "Plongeons de pingouin : réponds à chaque question avant la fin du temps. Si tu as raison, le pingouin fait un plongeon spectaculaire et le jury lui donne 10. Si tu te trompes, le plongeon rate et le jury donne de mauvaises notes. À la fin, tu verras la moyenne du jury.",
    pinguino: "Plongeons de pingouin", jurado: "Jury", promedio: "Moyenne du jury", ping_oro: "Des plongeons de champion !", ping_plata: "Très bons plongeons !", ping_bronce: "Bel essai", ping_sigue: "Continue à t'entraîner",
    clavados: "Triple salto !|Vrille !|Bombe !|Saut de l'ange !|Double salto arrière !", fallas: "Plat ventre !|Glissade !|Choc contre la glace !|Trop court !|La tête dans la neige !",
    instr_perro: "Lis l'affirmation et porte-la dans la bonne gamelle : glisse-la, ou touche-la puis touche la gamelle. Si tu as raison, le chien la mange tout content. Sinon, le chien la repousse et t'explique pourquoi.",
    perro: "Le chien et sa gamelle", perro_listo: "Le chien est content !",
    como_te_fue: "Comment ça s'est passé ?", avance: "Progression", actividades: "activités", calif_final: "Note",
    te_faltan: "Il te reste {n} activités. Ta note monte quand tu y réponds.", te_falta_una: "Il te reste 1 activité. Ta note monte quand tu y réponds.",
    ir_pendiente: "Aller à la première activité sans réponse", completo: "Tu as répondu à toutes les activités !", sobre_total: "La note compte toutes les activités du guide.",
    que_repasar: "Ce que tu dois revoir", dominado: "Maîtrisé", reforzar: "À revoir", sin_contestar: "Sans réponse", bien: "juste", mal: "faux", ver_pista: "Voir l'indice", todo_bien: "Tout va bien dans ce bloc.",
    animo_dominado: "Tu maîtrises ! Une révision rapide avant l'examen et c'est bon.", animo_reforzar: "Tu es sur la bonne voie. Revois ces indices et rejoue : tu peux le faire !", animo_sin: "Tu n'as pas encore commencé ce bloc. Joue ses activités et découvre tout ce que tu sais déjà.", animo_pendiente: "Tu as commencé ! Termine ses activités pour voir tout ce que tu maîtrises.",
    para_papas: "Pour maman ou papa", papas_avance: "Progression : {x} sur {y} activités ({p} %). Note sur tout le guide : {z} %.",
    papas_domina: "Maîtrisé : {lista}.", papas_reforzar: "À revoir : {lista}.", papas_sin: "Sans réponse : {lista}.",
    papas_falta: "Conseil : qu'il ou elle termine les activités qui manquent ; la note se met à jour toute seule.", papas_repasar: "Conseil : revoyez ensemble les indices marqués et rejouez ces jeux.", papas_ok: "Conseil : une révision rapide des indices avant l'examen suffit.",
    examenes: "Mini-examens et défi",
    compartir: "Partager les résultats", comp_whatsapp: "Envoyer par WhatsApp", comp_imagen: "Enregistrer en image", comp_cerrar: "Fermer",
    comp_repasar: "À revoir", comp_mas: "et {n} autres thèmes", comp_mas1: "et 1 autre thème", comp_error: "Impossible de partager. Réessaie.", comp_guardada: "Image enregistrée dans tes téléchargements.",
    comp_generando: "Préparation de l'image…", comp_locale: "fr-FR" },
};
export const t = (idioma, clave) => (TEXTOS[idioma] ?? TEXTOS.es)[clave] ?? TEXTOS.es[clave] ?? clave;

// Mezcla con semilla (para que la misma guía salga igual en todos los dispositivos de la familia).
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
  // El duelo (Sparky contra el dragón) puede venir como lista propia del bloque, "duelo": [...], con preguntas en el
  // formato de la opción múltiple (así lo escribe el generador), o como "juego": "duelo" sobre las actividades del bloque.
  c.bloques.forEach((b) => {
    b.duelo = Array.isArray(b.duelo) ? b.duelo.filter(Boolean).map((a) => ({ tipo: "opcion_multiple", ...a })) : [];
    // A veces el generador escribe las preguntas del duelo dentro de las actividades con "tipo": "duelo": se pasan a
    // la lista del duelo (con su id y en formato de opción múltiple) para que se jueguen y cuenten en la calificación.
    const sueltas = b.actividades.filter((a) => a?.tipo === "duelo");
    if (sueltas.length) {
      b.actividades = b.actividades.filter((a) => a?.tipo !== "duelo");
      const ya = new Set(b.duelo.map((a) => a.id));
      sueltas.forEach((a) => { if (!a.id || !ya.has(a.id)) b.duelo.push({ ...a, tipo: Array.isArray(a.opciones) || a.respuesta == null ? "opcion_multiple" : "completar" }); });
    }
    [...b.actividades, ...b.mini_examen, ...b.duelo].forEach((a) => { if (a?.id) c.porId[a.id] = a; });
  });
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
  enemigos: ["bosque", "cueva", "desierto"],
  pinguino: ["polo", "aurora", "atardecer"],
  puertas: ["torre", "mansion", "bodega"], // alias viejo: se juega como enemigos
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
  // Calentamiento: va justo después del tutorial, salvo que el plan pida otra "primera_actividad" (un juego del bloque 1);
  // entonces el calentamiento se juega al terminar el bloque 1, para que lo primero sea lo que decidió el plan.
  const calent = c.calentamiento.length ? { k: "carrera", t: `🔥 ${t(idioma, "calentamiento")}`, ids: c.calentamiento, tag: t(idioma, "calentamiento"), blk: 0, plantilla: "formula1", calentamiento: true } : null;
  const calentDespues = !!calent && !!c.primera_actividad && c.primera_actividad !== "calentamiento";
  if (calent && !calentDespues) S.push(calent);
  c.bloques.forEach((b, bi) => {
    const nb = bi + 1;
    // teoría: 2 o 3 pistas por slide; la última slide de teoría del bloque lleva "Ojo" y "Palabras clave".
    // Nada se desborda (Daniel, 7 nov 2026): una pista muy larga se parte en slides de continuación (1/2), (2/2) por
    // viñetas, y un grupo con mucho texto se reparte en más slides. El reproductor afina después midiendo de verdad.
    // Los grupos son los de siempre (la inteligencia artificial escribe `titulo_pagina` pensando en ellos). Si una pista
    // del grupo pesa demasiado, el grupo se vuelve una serie: lo de antes en una slide, cada parte de la pista sola, lo
    // de después en otra; todas con el mismo título y (1/3), (2/3), (3/3).
    const pistas = b.pistas;
    const grupos = [];
    for (let i = 0; i < pistas.length; i += 3) {
      const resto = pistas.length - i;
      grupos.push(pistas.slice(i, i + (resto === 4 ? 2 : 3)));
    }
    if (!grupos.length) grupos.push([]);
    // Si la primera pista del grupo trae `titulo_pagina`, la slide se titula así (como las páginas "Clue" de Lumio).
    grupos.forEach((g, gi) => {
      const base = g[0]?.titulo_pagina || null, serie = `${b.id}-${gi + 1}`;
      const paginas = [];
      let juntas = [];
      g.forEach((p) => {
        if (pesoPista(p) <= PESO_PISTA_MAX) { juntas.push(p); return; }
        if (juntas.length) paginas.push(juntas); juntas = [];
        partirPista(p, PESO_PARTE).forEach((q) => paginas.push([q]));
      });
      if (juntas.length || !paginas.length) paginas.push(juntas);
      paginas.forEach((pg) => S.push({ k: "teoria", base, b, bi, pistas: pg, serie, numero: gi + 1, tag: `${t(idioma, "pista")} · ${t(idioma, "bloque")} ${nb}`, blk: bi }));
    });
    const acts = b.actividades;
    // Juegos del bloque, agrupados por tipo; después se colocan en el orden que pide el plan (b.orden).
    const por = {};
    const add = (tipo, s) => (por[tipo] ??= []).push(s);
    const mc = acts.filter((a) => a.tipo === "opcion_multiple" || a.tipo === "completar").map((a) => a.id);
    // El juego de preguntas del bloque (y el tipo de verdadero o falso) se decide al final, en repartir(), con las reglas
    // de Daniel. "juego": "duelo" (formato de la demo) y la lista "duelo" del generador piden duelo, como mecanica_quiz.
    if (mc.length) add("opcion_multiple", { k: "carrera", pregunta: true, pedida: b.juego === "duelo" ? "duelo" : b.mecanica_quiz, bt: b.titulo, t: `🎮 ${b.titulo}`, ids: mc, tag: `${t(idioma, "bloque")} ${nb}`, blk: bi });
    const vf = acts.filter((a) => a.tipo === "verdadero_falso");
    if (vf.length) add("verdadero_falso", { k: "swipe", vf: true, t: `⏱ ${t(idioma, "vf_express")}`, items: vf, tag: `${t(idioma, "bloque")} ${nb}`, blk: bi });
    acts.filter((a) => a.tipo === "super_dato").forEach((a) => add("super_dato", { k: "superdato", t: "⭐ Súper dato", a, tag: `${t(idioma, "bloque")} ${nb}`, blk: bi, plantilla: elegir("superdato") }));
    acts.filter((a) => a.tipo === "conceptos").forEach((a) => add("conceptos", { k: "match", t: "🧩 Mix & match", a, tag: `${t(idioma, "bloque")} ${nb}`, blk: bi, plantilla: elegir("match") }));
    acts.filter((a) => a.tipo === "quien_es_quien").forEach((a) => add("quien_es_quien", { k: "match", t: "🖼️ ¿Quién es quién?", a, tag: `${t(idioma, "bloque")} ${nb}`, blk: bi, plantilla: elegir("match"), retratos: true }));
    acts.filter((a) => a.tipo === "ordenar").forEach((a) => add("ordenar", { k: "rank", t: "🔢 Rank order", a, tag: `${t(idioma, "bloque")} ${nb}`, blk: bi, plantilla: elegir("rank") }));
    acts.filter((a) => a.tipo === "clasificar").forEach((a) => add("clasificar", { k: "sort", t: "🗂️ Super sort", a, tag: `${t(idioma, "bloque")} ${nb}`, blk: bi, plantilla: elegir("sort") }));
    // Duelo del bloque (lista "duelo" del generador) y mini-examen: por defecto cierran el bloque, en ese orden.
    if (b.duelo.length) add("duelo", { k: "carrera", pregunta: true, pedida: "duelo", bt: b.titulo, t: `⚔️ ${b.titulo}`, ids: b.duelo.map((x) => x.id), tag: `${t(idioma, "bloque")} ${nb}`, blk: bi });
    if (b.mini_examen.length) add("mini_examen", { k: "quiz", t: `✅ ${t(idioma, "mini")} ${nb} · ${b.titulo}`, ids: b.mini_examen.map((x) => x.id), tag: `${t(idioma, "mini")} ${nb}`, blk: bi, plantilla: elegir("quiz") });
    // Orden variado (Daniel, 7 nov 2026): el plan trae en b.orden los tipos en el orden en que se juegan; lo que no
    // mencione va después, en el orden de siempre. "completar" se juega junto con la opción múltiple.
    const ORDEN_BASE = ["opcion_multiple", "verdadero_falso", "super_dato", "conceptos", "quien_es_quien", "ordenar", "clasificar", "duelo", "mini_examen"];
    const pedido = Array.isArray(b.orden) ? b.orden.map((x) => (x === "completar" ? "opcion_multiple" : String(x))) : [];
    [...new Set([...pedido, ...ORDEN_BASE])].forEach((tipo) => (por[tipo] ?? []).forEach((s) => S.push(s)));
    if (calentDespues && bi === 0) S.push(calent);
  });
  if (c.reto_final.length) S.push({ k: "ruleta", t: `🏆 ${t(idioma, "reto")}`, ids: c.reto_final, tag: t(idioma, "reto"), blk: -1, plantilla: elegir("ruleta") });
  S.push({ k: "resultados", t: t(idioma, "resultados"), blk: -1 });
  retitular(S, idioma);
  return repartir(recortar(S, c), c, idioma, elegir);
}

// ---------- Reparto de plantillas sin repeticiones seguidas (Daniel, 8 nov 2026) ----------
// Reglas: la selección es aleatoria pero fija para cada guía (c.semilla); nunca dos actividades del mismo tipo seguidas
// (aunque haya teoría en medio o se cruce de un bloque al siguiente); la misma plantilla de juego de preguntas no se repite
// en la guía si hay otras disponibles y, si no queda más remedio, va separada por al menos 15 slides; el primer juego de
// preguntas del bloque 1 nunca es una carrera (el calentamiento ya es una carrera y la vista previa debe mostrar dos
// formatos distintos). Si el bloque trae "mecanica_quiz" (carrera, montana, castillo, enemigos, duelo o pinguino) se
// respeta salvo que rompa estas reglas. El verdadero o falso se reparte entre el contra reloj (swipe) y el perro.
export const JUEGOS_PREGUNTA = [
  { k: "carrera", plantilla: "ciudad_neon" }, { k: "carrera", plantilla: "hipodromo" }, { k: "carrera", plantilla: "dragones" }, { k: "carrera", plantilla: "espacio" },
  { k: "enemigos" }, { k: "montana" }, { k: "castillo" }, { k: "duelo" }, { k: "pinguino" },
];
const ICONO_JUEGO = { carrera: "🏎️", enemigos: "👾", puertas: "👾", montana: "🧗", castillo: "🏰", duelo: "⚔️", pinguino: "🐧" };
const NO_ACTIVIDAD = new Set(["portada", "tutorial", "teoria", "resultados", "candado", "terminando"]);
const SEPARACION = 15;
const claveJuego = (j) => j.k + (j.k === "carrera" ? ":" + (j.plantilla ?? "") : "");
function repartir(S, c, idioma, elegir) {
  let s0 = (c.semilla ^ 0x9E3779B9) >>> 0 || 1;
  const azar = () => (s0 = (s0 * 1664525 + 1013904223) >>> 0) / 4294967296;
  const esAct = (s) => !NO_ACTIVIDAD.has(s.k);
  const flexible = (s) => s.pregunta || s.vf;
  // Usos de cada plantilla de preguntas (índices de slide). Las fijas (calentamiento, duelos del generador) cuentan desde
  // el principio para que una plantilla elegida antes no las repita.
  const usos = {};
  const usar = (clave, i) => (usos[clave] ??= []).push(i);
  S.forEach((s, i) => { if (!flexible(s) && JUEGOS_PREGUNTA.some((j) => j.k === s.k)) usar(claveJuego(s), i); });
  const anterior = (i) => { for (let j = i - 1; j >= 0; j--) if (esAct(S[j])) return S[j]; return null; };
  const siguienteFija = (i) => { for (let j = i + 1; j < S.length; j++) if (esAct(S[j])) return flexible(S[j]) ? null : S[j]; return null; };
  const lejos = (clave, i) => (usos[clave] ?? []).every((u) => Math.abs(u - i) >= SEPARACION);
  const primeraB1 = S.find((s) => s.pregunta && s.blk === 0);
  const tomar = (lista) => lista[Math.floor(azar() * lista.length)];
  S.forEach((s, i) => {
    if (!flexible(s)) return;
    const prev = anterior(i)?.k, next = siguienteFija(i)?.k;
    if (s.pregunta) {
      let cand = JUEGOS_PREGUNTA.filter((j) => j.k !== prev && j.k !== next && !(s === primeraB1 && j.k === "carrera"));
      if (!cand.length) cand = JUEGOS_PREGUNTA.filter((j) => j.k !== "carrera");
      const libres = cand.filter((j) => !usos[claveJuego(j)]);
      const separadas = cand.filter((j) => lejos(claveJuego(j), i));
      let pool = libres.length ? libres : separadas.length ? separadas : cand;
      if (!libres.length && !separadas.length) {
        // Sin remedio: la que se usó más lejos de aquí.
        const dist = (j) => Math.min(...(usos[claveJuego(j)] ?? [Infinity]).map((u) => Math.abs(u - i)));
        const mejor = Math.max(...pool.map(dist)); pool = pool.filter((j) => dist(j) === mejor);
      }
      const pedida = s.pedida === "puertas" ? "enemigos" : s.pedida;
      const deseadas = pool.filter((j) => j.k === pedida);
      // Sin pedido, se prefiere una mecánica que todavía no salga en la guía (variedad: no tres carreras con otro animal).
      const nuevas = pool.filter((j) => !Object.keys(usos).some((u) => u.split(":")[0] === j.k));
      const j = tomar(deseadas.length ? deseadas : nuevas.length ? nuevas : pool);
      s.k = j.k; s.plantilla = j.k === "carrera" ? j.plantilla : j.k === "duelo" ? undefined : elegir(j.k);
      s.t = `${ICONO_JUEGO[j.k]} ${s.bt}`;
      usar(claveJuego(j), i);
    } else {
      const usados = (k) => S.filter((x) => x.k === k && !x.vf).length;
      let cand = ["swipe", "perro"].filter((k) => k !== prev && k !== next);
      if (!cand.length) cand = ["swipe", "perro"].filter((k) => k !== prev);
      if (!cand.length) cand = ["perro"];
      const menos = Math.min(...cand.map(usados));
      const k = tomar(cand.filter((x) => usados(x) === menos));
      s.k = k; delete s.vf;
      if (k === "perro") { s.t = `🐶 ${t(idioma, "perro")}`; delete s.plantilla; } else { s.t = `⏱ ${t(idioma, "vf_express")}`; s.plantilla = elegir("swipe"); }
    }
    delete s.pregunta; delete s.pedida; delete s.bt;
  });
  // Actividades fijas del mismo tipo seguidas (por ejemplo, dos Mix & match del mismo bloque): se intercambia la segunda
  // con otra actividad posterior del mismo bloque si así ya no queda nada repetido junto.
  const acts = () => S.map((x, i) => [x, i]).filter(([x]) => esAct(x));
  const pares = () => { const A = acts(); let n = 0; for (let a = 0; a + 1 < A.length; a++) if (A[a][0].k === A[a + 1][0].k) n++; return n; };
  for (let vuelta = 0; vuelta < 6; vuelta++) {
    const antes = pares(); if (!antes) break;
    const A = acts(); let mejoro = false;
    for (let a = 0; a + 1 < A.length && !mejoro; a++) {
      if (A[a][0].k !== A[a + 1][0].k) continue;
      const [x, ix] = A[a + 1];
      for (let b = a + 2; b < A.length; b++) {
        const [y, iy] = A[b];
        if (y.blk !== x.blk || x.calentamiento || y.calentamiento) continue;
        S[ix] = y; S[iy] = x;
        if (pares() < antes) { mejoro = true; break; }
        S[ix] = x; S[iy] = y;
      }
    }
    if (!mejoro) break;
  }
  return S;
}


// ---------- Nada se desborda (Daniel, 7 nov 2026) ----------
// Peso aproximado de una pista (caracteres que ocupa en la slide). Sirve para repartir antes de medir; el reproductor
// mide de verdad cada slide y, si aún no cabe, baja la letra (de 22 a 18 px) y, si tampoco, la divide con dividirSlide().
const largo = (x) => String(x ?? "").length;
const PESO_PISTA_MAX = 1300, PESO_PARTE = 1000;
export function pesoPista(p) {
  let n = 70 + largo(p.titulo);
  n += (p.ideas ?? []).reduce((a, x) => a + largo(x) + 45, 0);
  n += (p.ideas_apoyo ?? []).reduce((a, x) => a + largo(x) + 10, 0);
  if (p.ejemplo) n += largo(p.ejemplo) + 45;
  n += (p.correcciones ?? []).reduce((a, cr) => a + largo(cr.dato_correcto ?? cr.mensaje) + largo(cr.dato_apuntes) + 60, 0);
  if (p.clave) n += largo(p.clave) + 60;
  if (p.conclusion) n += largo(p.conclusion) + 60;
  if (p.dato_rapido) n += 90;
  if ((p.imagenes ?? []).some((x) => x?.url)) n += 240;
  if (p.esquema?.tipo) n += 140 + (p.esquema.elementos ?? []).reduce((a, e) => a + largo(e.nombre) + largo(e.detalle) + 35, 0);
  return n;
}
// Separa un texto en frases completas (nunca a media frase).
const frases = (x) => String(x ?? "").split(/(?<=[.!?;])\s+(?=\S)/).map((f) => f.trim()).filter(Boolean);
// Lo que va al final de la pista (síntesis y cajas) y lo que va al principio (imágenes y dato rápido).
const COLA = ["ejemplo", "correcciones", "clave", "conclusion", "esquema"];
const CABEZA = ["imagenes", "dato_rapido", "ideas_apoyo"];
const tieneCola = (p) => COLA.some((k) => p[k] && (!Array.isArray(p[k]) || p[k].length));
function parteDe(p, ideas, cabeza, cola) {
  const q = { ...p, ideas, partida: true };
  if (!cabeza) CABEZA.forEach((k) => delete q[k]);
  if (!cola) COLA.forEach((k) => delete q[k]);
  return q;
}
// Parte una pista larga por viñetas en trozos de peso parecido. Si trae una sola viñeta enorme, la parte por frases.
// Si son pocas viñetas pero mucho extra (esquema, ejemplo, clave…), el extra pasa a la parte siguiente.
export function partirPista(p, limite = PESO_PARTE) {
  let ideas = (p.ideas ?? []).map(String);
  if (ideas.length < 2) ideas = ideas.flatMap(frases);
  // trozos parejos: si hacen falta k partes, cada una lleva más o menos el total / k (se corta entre viñetas)
  const total = ideas.reduce((n, x) => n + largo(x) + 45, 0);
  const k = Math.max(1, Math.ceil(total / limite)), objetivo = total / k;
  const trozos = [];
  let actual = [], peso = 0;
  ideas.forEach((x) => { const w = largo(x) + 45; if (actual.length && trozos.length < k - 1 && peso + w / 2 > objetivo) { trozos.push(actual); actual = []; peso = 0; } actual.push(x); peso += w; });
  if (actual.length) trozos.push(actual);
  if (trozos.length < 2) {
    if (!tieneCola(p) || !ideas.length) return [p];
    return [parteDe(p, ideas, true, false), parteDe(p, [], false, true)];
  }
  return trozos.map((g, i) => parteDe(p, g, i === 0, i === trozos.length - 1));
}
// Divide una slide de teoría que no cupo: si tiene varias pistas, las reparte en dos slides; si tiene una, la parte en
// dos por viñetas (o por frases, o separa el esquema y las cajas). Devuelve las dos slides nuevas o null si ya no se puede.
export function dividirSlide(s) {
  const ps = s.pistas ?? [];
  if (ps.length > 1) {
    const mitad = Math.ceil(ps.length / 2);
    return [{ ...s, pistas: ps.slice(0, mitad) }, { ...s, pistas: ps.slice(mitad) }];
  }
  const p = ps[0]; if (!p) return null;
  let ideas = (p.ideas ?? []).map(String);
  if (ideas.length < 2) ideas = ideas.flatMap(frases);
  let a, b;
  if (ideas.length >= 2) {
    // mitad por peso, sin cortar viñetas
    const total = ideas.reduce((n, x) => n + largo(x) + 45, 0);
    let corte = 1, acum = largo(ideas[0]) + 45;
    while (corte < ideas.length - 1 && acum + (largo(ideas[corte]) + 45) / 2 < total / 2) { acum += largo(ideas[corte]) + 45; corte++; }
    a = parteDe(p, ideas.slice(0, corte), true, false); b = parteDe(p, ideas.slice(corte), false, true);
  } else if (tieneCola(p) && ideas.length) {
    a = parteDe(p, ideas, true, false); b = parteDe(p, [], false, true);
  } else return null;
  return [{ ...s, pistas: [a] }, { ...s, pistas: [b] }];
}
// Títulos, numeración y marcas de las slides de teoría después de repartir: las slides de una misma serie (una pista o
// un grupo que no cupo en una) llevan (1/2), (2/2); "parte" da los colores y "ultima" pone "Ojo con esto" y "Palabras
// clave" solo en la última slide de teoría del bloque.
export function retitular(S, idioma) {
  const porBloque = {};
  S.forEach((s) => { if (s.k === "teoria") (porBloque[s.bi] ??= []).push(s); });
  Object.values(porBloque).forEach((lista) => {
    const numeros = new Set(lista.map((s) => s.numero));
    lista.forEach((s, i) => {
      const serie = lista.filter((x) => x.serie === s.serie);
      const k = serie.length, j = serie.indexOf(s) + 1;
      const base = s.base || `${t(idioma, "pista")} · ${s.b.titulo}${numeros.size > 1 ? ` (${s.numero})` : ""}`;
      s.t = k > 1 ? `${base} (${j}/${k})` : base;
      s.parte = i + 1; s.ultima = i === lista.length - 1;
    });
  });
  return S;
}

// Presupuesto de slides (Documento 2): si sobran juegos, se recortan en este orden:
// segundo ordenar/clasificar del bloque → completar extra → V/F extra. Nunca teoría, mini-exámenes ni reto final.
function recortar(S, c) {
  const tope = Math.min(40, Math.max(15, Number(c.plan.presupuesto_slides) || 40));
  const quitar = (filtro) => { const i = S.findLastIndex(filtro); if (i >= 0) S.splice(i, 1); };
  let guarda = 50;
  // Las slides de continuación de una pista (1/2, 2/2) no cuentan: partir la teoría para que quepa no quita juegos.
  const extras = () => S.filter((s) => s.k === "teoria").length - new Set(S.filter((s) => s.k === "teoria").map((s) => s.serie)).size;
  while (S.length - extras() > tope && guarda-- > 0) {
    const vistos = {};
    let hecho = false;
    for (let i = S.length - 1; i >= 0; i--) { const s = S[i]; if (s.k === "rank" || s.k === "sort") { const k = s.blk + s.k; vistos[k] = (vistos[k] ?? 0) + 1; if (vistos[k] > 1) { S.splice(i, 1); hecho = true; break; } } }
    if (hecho) continue;
    const antes = S.length; quitar((s) => s.k === "swipe"); if (S.length < antes) continue;
    break;
  }
  return S;
}

// ---------- Vista previa gratis (Daniel, 9 nov 2026) ----------
// Exactamente 4 slides y el candado: PORTADA, UNA PISTA (una sola página de teoría) y DOS JUEGOS de formato distinto: el
// primer juego de preguntas (nunca una carrera) y otro formato (conceptos, clasificar, verdadero o falso u ordenar).
// Sin tutorial ni calentamiento (sí en la guía completa). El candado dice cuántos bloques y actividades trae la guía.
const OTROS_VP = ["conceptos", "clasificar", "verdadero_falso", "ordenar"];
const pistaDeUnaPagina = (pistas) => pistas.find((p) => pesoPista(p) <= PESO_PISTA_MAX) ?? pistas[0];
// Deja en el cartucho (ya normalizado) solo lo que la vista previa muestra.
export function prepararVistaPrevia(c) {
  const b0 = c.bloques[0];
  c.bloques = b0 ? [{ ...b0, pistas: b0.pistas.length ? [pistaDeUnaPagina(b0.pistas)] : [], mini_examen: [], duelo: [] }] : [];
  c.calentamiento = []; c.reto_final = []; c.primera_actividad = null;
  return c;
}
const SLIDES_OTRO_VP = new Set(["match", "sort", "swipe", "perro", "rank"]);
// De las slides armadas, solo portada, la primera página de teoría y dos juegos de formato distinto del bloque 1.
export function slidesVistaPrevia(S) {
  const portada = S.find((s) => s.k === "portada");
  const pista = S.find((s) => s.k === "teoria");
  const juegos = S.filter((s) => !NO_ACTIVIDAD.has(s.k) && !s.calentamiento && s.blk === 0);
  const esPregunta = (s) => JUEGOS_PREGUNTA.some((j) => j.k === s.k) && s.k !== "carrera";
  const pregunta = juegos.find(esPregunta);
  const otro = juegos.find((s) => s !== pregunta && SLIDES_OTRO_VP.has(s.k) && !s.retratos && s.k !== pregunta?.k)
    ?? juegos.find((s) => s !== pregunta && s.k !== pregunta?.k && !esPregunta(s));
  const dos = pregunta ? [pregunta, otro] : [otro, juegos.find((s) => s !== otro && s.k !== otro?.k)];
  const elegidas = new Set([portada, pista, ...dos].filter(Boolean));
  return S.filter((s) => elegidas.has(s));
}
// Recorte de la vista previa hecho en el navegador (la demo con ?vista=previa); el servidor hace lo mismo.
export function recortarVistaPrevia(c) {
  const v = JSON.parse(JSON.stringify({ version_formato: c.version_formato, plan: c.plan, bloques: [], calentamiento: [], reto_final: [] }));
  const b0 = c.bloques[0];
  if (b0) {
    const acts = b0.actividades;
    const juego = acts.filter((a) => a.tipo === "opcion_multiple" || a.tipo === "completar").slice(0, 6);
    const orden = Array.isArray(b0.orden) ? b0.orden : [];
    const otros = [...new Set([...orden.filter((x) => OTROS_VP.includes(x)), ...OTROS_VP])].filter((k) => acts.some((a) => a.tipo === k)).slice(0, juego.length ? 1 : 2);
    const extra = otros.flatMap((k) => k === "verdadero_falso" ? acts.filter((a) => a.tipo === k) : acts.filter((a) => a.tipo === k).slice(0, 1));
    v.bloques.push({ id: b0.id, titulo: b0.titulo, pistas: b0.pistas.length ? [pistaDeUnaPagina(b0.pistas)] : [], actividades: [...juego, ...extra], mini_examen: [], orden: b0.orden, mecanica_quiz: b0.mecanica_quiz });
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
