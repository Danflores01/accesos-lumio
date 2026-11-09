// Idioma del sitio público de SparkEd (portada, crear.html y listo.html): español por defecto, inglés si el visitante lo
// elige con el selector «ES | EN» del encabezado o con ?lang=en en la dirección. Se recuerda en localStorage.
// El reproductor (guia.html) tiene sus propios textos según el idioma de cada guía: este módulo no lo toca.
//
// Cómo se usa (ver docs/CRITERIOS-FASE-2.md, sección 24):
//  - HTML fijo:  <h2 data-i18n="como.titulo">Así se hace tu guía</h2>
//                <input data-i18n-attr="placeholder:crear.colegio_ph">   (varios: "title:clave1;alt:clave2")
//                <span data-i18n="crear.conteo" data-i18n-vars='{"n":3,"max":25}'></span>
//  - JavaScript: t("clave", { n: 3 }) da el texto plano en el idioma activo; th(...) lo da con las variables escapadas
//                para HTML; marca("clave", vars) da un <span data-i18n> que se traduce solo al cambiar de idioma.
//  - Textos que manda el servidor (avance de la guía, errores): textoServidor(texto).
// Al cambiar de idioma se actualizan el atributo lang del documento y todos los [data-i18n] sin recargar, y se avisa
// a quien se haya suscrito con alCambiarIdioma(fn) (por ejemplo, para volver a llenar un <select>).

import { CONFIG } from "./config.js";

const CLAVE_LS = "sparked_idioma";
export const IDIOMAS = ["es", "en"];

// Diccionario: clave → [español, inglés]. Las variables van entre llaves: {n}, {max}, {nombre}…
// Variables cuyo nombre empieza con "fecha" se escriben como fecha en el idioma activo (vienen en formato ISO).
const TEXTOS = {
  // ---------- Comunes ----------
  "nav.crear": ["Crear mi guía", "Create my guide"],
  "nav.ver": ["Ver una guía", "See a guide"],
  "nav.idioma": ["Idioma", "Language"],
  "pie": ["SparkEd · Guías de estudio interactivas", "SparkEd · Interactive study guides"],
  "tu_guia": ["Tu guía", "Your guide"],
  "tu_correo": ["tu correo", "your email"],
  "error.servidor": ["Algo salió mal. Intenta de nuevo en un momento.", "Something went wrong. Please try again in a moment."],

  // ---------- Portada (index.html) ----------
  "titulo.inicio": ["SparkEd · Bienvenido", "SparkEd · Welcome"],
  "hero.sello": ["Hecha con tus apuntes", "Made from your notes"],
  "hero.titulo": ["Convierte tu temario en una <em>guía de estudio interactiva</em>", "Turn your syllabus into an <em>interactive study guide</em>"],
  "hero.texto": ["Sube fotos de tu temario, de tu libro de texto o de tus apuntes, y Sparky arma tu guía: teoría a todo color y juegos que se califican solos. Estudia jugando en cualquier dispositivo que tengas.",
    "Upload photos of your syllabus, your textbook or your notes, and Sparky builds your guide: full-color lessons and games that grade themselves. Study by playing on any device you have."],
  "hero.titulo2": ["Diferentes tipos de información requieren <em>diferentes métodos de estudio</em>", "Different types of information require <em>different study methods</em>"],
  "hero.texto2": ["Por eso en SparkEd convertimos tu temario y tus apuntes en una guía interactiva, sin importar el grado o la materia que estés cursando.", "That is why at SparkEd we turn your syllabus and your notes into an interactive guide, no matter the grade or subject you are taking."],
  "hero.texto3": ["Estudia jugando en cualquier dispositivo que tengas.", "Study by playing on any device you have."],
  "hero.demo": ["▶ Mira una guía real", "▶ See a real guide"],
  "chip.precio": ["Una guía: $100 MXN, IVA incluido", "One guide: $100 MXN, VAT included"],
  "chip.acceso": ["7 días de acceso ilimitado a tu guía", "7 days of unlimited access to your guide"],
  "chip.dispositivos": ["Hasta 2 dispositivos por familia", "Up to 2 devices per family"],
  "sparky.consejo": ["Consejo de Sparky:", "Sparky's tip:"],
  "sparky.primer_consejo": ["Sube tu temario y con eso ya puedo armar tu guía. Si además me compartes dos o tres fotos de tus apuntes, la hago todavía más específica.", "Upload your syllabus and that is enough for me to build your guide. If you also share two or three photos of your notes, I make it even more specific."],
  "ejemplo.titulo": ["Guía de ejemplo: De las primeras aldeas al mundo global", "Sample guide: From the first villages to the global world"],
  "ejemplo.etiqueta": ["HISTORIA 1°", "HISTORY · GRADE 7"],
  "ejemplo.detalle": ["3 bloques · 25 slides · teoría con imágenes reales, juegos, mini quizzes y reto final", "3 units · 25 slides · lessons with real images, games, mini quizzes and a final challenge"],
  "como.titulo": ["Así se hace tu guía", "How your guide is made"],
  "como.paso1": ["1. Tomas fotos de tu temario<small>o de tu libro de texto o de tus apuntes, hasta 25 páginas</small>", "1. You take photos of your syllabus<small>or of your textbook or your notes, up to 25 pages</small>"],
  "como.paso2": ["2. Sparky las convierte en una guía<small>en unos minutos</small>", "2. Sparky turns them into a guide<small>in a few minutes</small>"],
  "como.paso3": ["3. Juegas y estudias<small>con tus propios temas</small>", "3. You play and study<small>with your own topics</small>"],
  "como.para": ["<b>Una guía: $100 MXN, IVA incluido.</b> 7 días de acceso ilimitado a tu guía, hasta 2 dispositivos. Cada link es de una sola familia. La guía sale de lo que tú subas, con cada dato verificado, y primero ves una vista previa gratis.",
    "<b>One guide: $100 MXN, VAT included.</b> 7 days of unlimited access to your guide, on up to 2 devices. Each link belongs to one family only. The guide is built from what you upload, with every fact checked, and you see a free preview first."],
  "demo.titulo": ["Así se ve una guía de verdad", "This is what a real guide looks like"],
  "demo.texto": ["Historia Universal de 1° de secundaria: teoría con fotografías reales, juegos, mini quizzes, líneas del tiempo y palabras clave.",
    "World History for 7th grade: lessons with real photographs, games, mini quizzes, timelines and key words."],
  "demo.probar": ["▶ Probar la guía de ejemplo", "▶ Try the sample guide"],
  "demo.marco": ["Guía de ejemplo", "Sample guide"],
  "precio.pildora": ["Una guía", "One guide"],
  "precio.iva": ["MXN · IVA incluido", "MXN · VAT included"],
  "precio.l2": ["Hasta 2 dispositivos por familia: por ejemplo, el celular de mamá y el iPad del alumno", "Up to 2 devices per family: for example, mom's phone and the student's iPad"],
  "precio.l3": ["Teoría visual, juegos, mini-exámenes y reto final", "Visual lessons, games, mini quizzes and a final challenge"],
  "precio.l4": ["Vista previa gratis antes de pagar", "Free preview before you pay"],
  "precio.l5": ["Te la mandamos por correo (por WhatsApp, próximamente)", "We send it to you by email (WhatsApp coming soon)"],
  "precio.l5.wa": ["Te la mandamos por correo y por WhatsApp", "We send it to you by email and by WhatsApp"],
  "faq.titulo": ["Preguntas rápidas", "Quick questions"],
  "faq.p1": ["¿Cómo recibo la guía?", "How do I get the guide?"],
  "faq.r1": ["Al pagar, el link de tu guía aparece en pantalla. Además, te la mandamos por correo con un código QR (el envío por WhatsApp llegará próximamente). El alumno la abre en su iPad, en la computadora o en el celular.",
    "Once you pay, the link to your guide appears on screen. We also send it to you by email with a QR code (WhatsApp delivery is coming soon). The student opens it on an iPad, a computer or a phone."],
  "faq.r1.wa": ["Al pagar, el link de tu guía aparece en pantalla. Además, te la mandamos por correo con un código QR y por WhatsApp. El alumno la abre en su iPad, en la computadora o en el celular.",
    "Once you pay, the link to your guide appears on screen. We also send it to you by email with a QR code and by WhatsApp. The student opens it on an iPad, a computer or a phone."],
  "faq.p2": ["¿Qué pasa si la abro en más de 2 dispositivos?", "What happens if I open it on more than 2 devices?"],
  "faq.r2": ["El tercer dispositivo ve el aviso «Acceso en uso en otros dispositivos». Cada link es de una sola familia.",
    "The third device sees the notice “Access in use on other devices.” Each link belongs to one family only."],
  "faq.p3": ["¿La información es correcta?", "Is the information correct?"],
  "faq.r3": ["Cada dato sale de los apuntes o del temario y se verifica contra fuentes confiables. Si tus apuntes traen un error, la guía lo señala con la corrección.",
    "Every fact comes from the notes or the syllabus and is checked against reliable sources. If your notes have a mistake, the guide points it out with the correction."],

  // ---------- Caja de comentarios (portada) ----------
  "com.titulo": ["Cuéntanos qué te pareció", "Tell us what you thought"],
  "com.texto": ["Leemos todos los comentarios; nos ayudan a mejorar.", "We read every comment; they help us improve."],
  "com.nombre": ["Tu nombre", "Your name"],
  "com.soy": ["Soy… (opcional)", "I am… (optional)"],
  "com.soy_elige": ["Elige una opción", "Choose an option"],
  "com.soy_mama_papa": ["Mamá o papá", "A mom or dad"],
  "com.soy_alumno": ["Alumno", "A student"],
  "com.soy_docente": ["Docente", "A teacher"],
  "com.soy_otro": ["Otro", "Other"],
  "com.estrellas": ["Tu calificación", "Your rating"],
  "com.estrella_n": ["{n} de 5 estrellas", "{n} out of 5 stars"],
  "com.comentario": ["Tu comentario", "Your comment"],
  "com.ph": ["¿Qué te gustó? ¿Qué podemos mejorar?", "What did you like? What can we improve?"],
  "com.contador": ["{n} de 600 letras (mínimo 10)", "{n} of 600 characters (minimum 10)"],
  "com.permiso": ["Pueden publicar mi comentario con mi nombre", "You may publish my comment with my name"],
  "com.enviar": ["Enviar comentario", "Send comment"],
  "com.enviando": ["Enviando…", "Sending…"],
  "com.err_nombre": ["Escribe tu nombre.", "Enter your name."],
  "com.err_texto": ["Escribe tu comentario (de 10 a 600 letras).", "Write your comment (10 to 600 characters)."],
  "com.err_estrellas": ["Elige de 1 a 5 estrellas.", "Choose 1 to 5 stars."],
  "com.err_limite": ["Ya recibimos varios comentarios desde este dispositivo. Inténtalo mañana.", "We already received several comments from this device. Please try again tomorrow."],
  "com.err_guardar": ["No pudimos guardar tu comentario. Inténtalo más tarde.", "We couldn't save your comment. Please try again later."],
  "com.gracias_t": ["¡Gracias por tu comentario!", "Thank you for your comment!"],
  "com.gracias": ["Lo leeremos con mucho gusto. Gente como tú nos ayuda a hacer mejores guías.", "We will gladly read it. People like you help us make better guides."],
  "com.otro": ["Enviar otro comentario", "Send another comment"],

  // ---------- Crear (crear.html) ----------
  "titulo.crear": ["SparkEd · Crea tu guía personalizada", "SparkEd · Create your custom guide"],
  "crear.sello": ["TU GUÍA PERSONALIZADA", "YOUR CUSTOM GUIDE"],
  "crear.titulo": ["Arrastra tu contenido para hacer tu guía", "Drop in your content to make your guide"],
  "crear.grado": ["Grado", "Grade"],
  "crear.materia": ["Materia", "Subject"],
  "crear.colegio": ["Colegio (opcional)", "School (optional)"],
  "crear.colegio_ph": ["Para identificar tu guía", "To identify your guide"],
  "crear.zona": ["<b>Toca para elegir fotos o PDF</b>, o arrástralos aquí", "<b>Tap to choose photos or PDFs</b>, or drag them here"],
  "crear.zona_ayuda": ["Hasta 25 páginas · fotos del temario, del libro de texto o de tus apuntes. Mientras más claras, mejor.", "Up to 25 pages · photos of your syllabus, your textbook or your notes. The clearer, the better."],
  "crear.boton": ["✨ Crear mi guía", "✨ Create my guide"],
  "crear.nota": ["Primero ves una vista previa gratis. Tus fotos se borran solas.", "You see a free preview first. Your photos are deleted automatically."],
  "crear.elige_grado": ["Elige el grado", "Choose the grade"],
  "crear.elige_materia": ["Elige la materia", "Choose the subject"],
  "crear.conteo": ["{n} de {max} páginas", "{n} of {max} pages"],
  "crear.quitar": ["Quitar", "Remove"],
  "error.maximo": ["Máximo {max} páginas por guía.", "Up to {max} pages per guide."],
  "error.pdf": ["No pude leer ese PDF.", "I couldn't read that PDF."],
  "error.imagen": ["Formato de imagen no reconocido: {nombre}", "Image format not recognized: {nombre}"],
  "error.grado_materia": ["Elige el grado y la materia.", "Choose the grade and the subject."],
  "error.sin_paginas": ["Sube al menos una página.", "Upload at least one page."],
  "error.subir": ["No se pudo subir {nombre}", "Couldn't upload {nombre}"],
  "espera.generando": ["Generando tu guía…", "Creating your guide…"],
  "espera.terminando": ["Terminando tu guía…", "Finishing your guide…"],
  "espera.preparando": ["Preparando tus páginas", "Preparing your pages"],
  "espera.subiendo": ["Subiendo página {n} de {total}", "Uploading page {n} of {total}"],
  "espera.sabias": ["¿Sabías que…?", "Did you know…?"],
  "espera.fuente": ["Fuente: {fuente}", "Source: {fuente}"],
  "espera.estimado": ["⏱️ Tiempo estimado: unos {n} minutos", "⏱️ Estimated time: about {n} minutes"],
  "espera.casi": ["Ya casi está…", "Almost there…"],
  "espera.menos_minuto": ["Falta menos de un minuto", "Less than a minute to go"],
  "espera.un_minuto": ["Falta alrededor de un minuto", "About a minute to go"],
  "espera.minutos": ["Faltan unos {n} minutos", "About {n} minutes to go"],
  "boton.reintentar": ["Intentar de nuevo", "Try again"],
  "fallo.titulo": ["No pude leer bien tus páginas 😕", "I couldn't read your pages well 😕"],
  "fallo.texto": ["Prueba con fotos más claras, con buena luz y la página completa.", "Try clearer photos, with good light and the whole page showing."],
  "fallo.volver": ["Volver a intentar", "Try again"],
  "retomar.fallo": ["No pudimos terminar tu guía anterior.", "We couldn't finish your previous guide."],
  "retomar.otra": ["Puedes intentarlo de nuevo aquí.", "You can try again here."],
  "vp.nota": ["Vista previa gratis: portada, primera pista y un juego. Lo demás se abre al pagar.", "Free preview: cover, first clue and one game. The rest unlocks when you pay."],
  "vp.ver": ["▶ Ver la vista previa", "▶ See the preview"],
  "vp.ver_nota": ["Se abre en pantalla completa (mejor con el teléfono en horizontal). Al final hay un botón para volver aquí.", "It opens in full screen (best with the phone turned sideways). At the end there is a button to come back here."],
  "vp.pantalla": ["Ver en pantalla completa ↗", "See in full screen ↗"],
  "vp.marco": ["Vista previa de tu guía", "Preview of your guide"],
  "contacto.nombre": ["Nombre de quien pide la guía", "Name of the person ordering the guide"],
  "contacto.telefono": ["Teléfono (WhatsApp, próximamente)", "Phone (WhatsApp, coming soon)"],
  "contacto.telefono.wa": ["WhatsApp", "WhatsApp"],
  "contacto.telefono2": ["Confirma tu teléfono", "Confirm your phone"],
  "contacto.telefono2.wa": ["Confirma tu WhatsApp", "Confirm your WhatsApp"],
  "contacto.correo": ["Correo", "Email"],
  "contacto.correo2": ["Confirma tu correo", "Confirm your email"],
  "contacto.lada": ["Lada del país", "Country code"],
  "contacto.coinciden": ["Coinciden", "They match"],
  "contacto.oxxo": ["Los pagos en OXXO pueden tardar varias horas o días en acreditarse. Si tienes que estudiar ahora, utiliza otro método de pago.", "OXXO payments can take several hours or days to clear. If you need to study now, use another payment method."],
  "contacto.otra": ["¿Quieres generar otra guía?", "Want to create another guide?"],
  "contacto.err_tel2": ["Los teléfonos no coinciden. Revísalos.", "The phone numbers don't match. Please check them."],
  "contacto.err_correo2": ["Los correos no coinciden. Revísalos.", "The emails don't match. Please check them."],
  "contacto.pagar": ["🔓 Desbloquear la guía entera por ${precio}", "🔓 Unlock the full guide for ${precio} MXN"],
  "contacto.nota": ["7 días de acceso ilimitado a tu guía · 2 dispositivos por familia · IVA incluido", "7 days of unlimited access to your guide · 2 devices per family · VAT included"],
  "contacto.err_nombre": ["Escribe el nombre de quien pide la guía.", "Enter the name of the person ordering the guide."],
  "contacto.err_tel": ["Escribe un teléfono válido (en México, 10 dígitos).", "Enter a valid phone number (10 digits in Mexico)."],
  "contacto.err_correo": ["Escribe un correo válido.", "Enter a valid email address."],
  "codigo.etiqueta": ["¿Tienes un código? Escríbelo aquí", "Have a code? Enter it here"],
  "codigo.ph": ["Opcional", "Optional"],
  "codigo.error": ["Ese código no es válido.", "That code is not valid."],
  "pago.titulo": ["Pago", "Payment"],
  "pago.preparando": ["Preparando tu pago…", "Getting your payment ready…"],
  "pago.abriendo": ["Abriendo Mercado Pago…", "Opening Mercado Pago…"],
  "pago.apartada": ["Tu guía está apartada 🎟️", "Your guide is reserved 🎟️"],
  "pago.manual": ["El pago en línea se está configurando. Te contactamos por WhatsApp para completar tu compra y activar tu guía.", "Online payment is being set up. We will contact you on WhatsApp to complete your purchase and activate your guide."],
  "pago.folio": ["Folio: {folio}", "Order number: {folio}"],
  "pago.guardalo": ["Guárdalo. En cuanto se confirme el pago, el link de tu guía aparece aquí y te la mandamos por correo.", "Keep it. As soon as the payment is confirmed, the link to your guide appears here and we send it to you by email."],
  "pago.confirmar_wa": ["💬 Confirmar por WhatsApp", "💬 Confirm on WhatsApp"],
  "pago.esperando": ["Esperando la confirmación del pago…", "Waiting for the payment to be confirmed…"],
  "pend.oxxo_t": ["Tu pago en OXXO está en camino 🧾", "Your OXXO payment is on its way 🧾"],
  "pend.oxxo": ["Tu pago en OXXO puede tardar hasta 1 hora en reflejarse. En cuanto se confirme, tu guía se activa sola y te llega al correo {correo}.", "Your OXXO payment can take up to 1 hour to show up. As soon as it is confirmed, your guide turns on by itself and arrives at {correo}."],
  "pend.oxxo_vence": ["Si todavía no pagas, tienes hasta el <b>{fecha}</b> para llevar tu ficha a cualquier tienda OXXO.", "If you haven't paid yet, you have until <b>{fecha}</b> to take your payment slip to any OXXO store."],
  "pend.oxxo_ficha": ["🧾 Ver mi ficha de pago", "🧾 See my payment slip"],
  "pend.spei_t": ["Tu transferencia SPEI está en camino 🏦", "Your SPEI transfer is on its way 🏦"],
  "pend.spei": ["Tu transferencia por SPEI puede tardar hasta 1 hora en reflejarse. En cuanto se confirme, tu guía se activa sola y te llega al correo {correo}.", "Your SPEI transfer can take up to 1 hour to show up. As soon as it is confirmed, your guide turns on by itself and arrives at {correo}."],
  "pend.spei_vence": ["Si todavía no transfieres, tienes hasta el <b>{fecha}</b> para hacer la transferencia con los datos de tu ficha.", "If you haven't transferred yet, you have until <b>{fecha}</b> to make the transfer with the details on your slip."],
  "pend.spei_ficha": ["🏦 Ver los datos para transferir", "🏦 See the transfer details"],
  "pend.tarjeta_t": ["Mercado Pago está revisando tu pago 💳", "Mercado Pago is reviewing your payment 💳"],
  "pend.tarjeta": ["La revisión de un pago con tarjeta puede tardar unos minutos. En cuanto se apruebe, tu guía se activa sola y te llega al correo {correo}.", "Reviewing a card payment can take a few minutes. As soon as it is approved, your guide turns on by itself and arrives at {correo}."],
  "pend.otro": ["En cuanto se confirme el pago, tu guía se activa sola y te llega al correo {correo}.", "As soon as the payment is confirmed, your guide turns on by itself and arrives at {correo}."],
  "wa.mensaje": ["Hola 👋 Aquí está tu guía interactiva de SparkEd: *{titulo}*\n\nÁbrela en tu iPad, en la computadora o en el celular:\n{link}\n\nEs para nuestra familia: vale 7 días y hasta en 2 dispositivos. ¡A estudiar jugando! 🚀",
    "Hi 👋 Here is your interactive SparkEd guide: *{titulo}*\n\nOpen it on your iPad, a computer or a phone:\n{link}\n\nIt is for our family only: it works for 7 days and on up to 2 devices. Let's study by playing! 🚀"],

  // ---------- Listo (listo.html) ----------
  "titulo.listo": ["SparkEd · Tu guía está lista", "SparkEd · Your guide is ready"],
  "titulo.terminando": ["SparkEd · Tu guía se está terminando", "SparkEd · Your guide is being finished"],
  "titulo.revisando": ["SparkEd · Estamos revisando tu guía", "SparkEd · We are reviewing your guide"],
  "listo.confirmando": ["Confirmando tu compra…", "Confirming your purchase…"],
  "listo.sin_compra_t": ["No encontramos tu compra", "We couldn't find your purchase"],
  "listo.sin_compra": ["Abre el link que te mandamos por correo, o vuelve a la <a href=\"index.html\">página principal</a>.", "Open the link we sent you by email, or go back to the <a href=\"index.html\">home page</a>."],
  "listo.esperando_nota": ["Esta página se actualiza sola. Cuando se confirme el pago, también te mandamos tu guía por correo.", "This page updates by itself. Once the payment is confirmed, we also send you your guide by email."],
  "listo.pendiente_nota": ["Puedes cerrar esta página: no necesitas volver a pagar. Esta página se actualiza sola. Folio: <b>{folio}</b>.", "You can close this page: you don't need to pay again. This page updates by itself. Order number: <b>{folio}</b>."],
  "listo.vencido_t": ["El plazo para pagar terminó", "The time to pay has ended"],
  "listo.fallido_t": ["El pago no se completó", "The payment was not completed"],
  "listo.vencido": ["Mercado Pago canceló este pago porque no se completó a tiempo. No se realizó ningún cargo. Puedes intentarlo de nuevo con tarjeta, en OXXO o por SPEI.", "Mercado Pago canceled this payment because it was not completed in time. You were not charged. You can try again with a card, at OXXO or by SPEI transfer."],
  "listo.fallido": ["Mercado Pago no pudo completar tu pago. No se realizó ningún cargo. Puedes intentarlo de nuevo con tarjeta, en OXXO o por SPEI.", "Mercado Pago could not complete your payment. You were not charged. You can try again with a card, at OXXO or by SPEI transfer."],
  "listo.reintentar": ["🔁 Intentar de nuevo", "🔁 Try again"],
  "listo.inicio": ["Volver al inicio", "Back to home"],
  "listo.codigo_ok": ["Tu código se aplicó ✅", "Your code was applied ✅"],
  "listo.pago_ok": ["Tu pago se confirmó ✅", "Your payment was confirmed ✅"],
  "listo.terminando": ["Tu guía completa se está terminando: tarda unos 4 minutos. Te avisamos por correo en cuanto esté lista.", "Your full guide is being finished: it takes about 4 minutes. We will email you as soon as it is ready."],
  "listo.term_jugar": ["Mientras se termina, ya puedes abrirla y jugar los primeros bloques.", "While it finishes, you can already open it and play the first units."],
  "listo.term_espera": ["Se abre en cuanto la guía esté completa. Esta página cambia sola cuando esté lista.", "It opens as soon as the guide is complete. This page changes by itself when it is ready."],
  "listo.revisando": ["Estamos revisando tu guía; te avisamos por correo en cuanto esté lista.", "We are reviewing your guide; we will email you as soon as it is ready."],
  "listo.revisando_nota": ["No necesitas hacer nada más. Folio: <b>{folio}</b>.", "You don't need to do anything else. Order number: <b>{folio}</b>."],
  "listo.rev_jugar": ["Mientras tanto, ya puedes abrirla y jugar los primeros bloques.", "In the meantime, you can already open it and play the first units."],
  "listo.rev_espera": ["Tu link ya está apartado: se abre en cuanto la guía esté completa.", "Your link is already reserved: it opens as soon as the guide is complete."],
  "link.tu_link": ["Tu link", "Your link"],
  "link.abrir": ["▶ Abrir la guía", "▶ Open the guide"],
  "link.copiar": ["📋 Copiar link", "📋 Copy link"],
  "link.copiado": ["✓ Copiado", "✓ Copied"],
  "link.whatsapp": ["💬 Mandar por WhatsApp", "💬 Send by WhatsApp"],
  "listo.lista": ["¡Tu guía está lista! 🎉", "Your guide is ready! 🎉"],
  "listo.qr": ["El alumno puede escanear este código con su iPad.", "The student can scan this code with an iPad."],
  "listo.acceso_t": ["Cómo funciona tu acceso", "How your access works"],
  "listo.acceso1": ["Tienes <b>7 días de acceso ilimitado a tu guía</b>, desde hoy.", "You have <b>7 days of unlimited access to your guide</b>, starting today."],
  "listo.acceso1_fecha": ["Tienes <b>7 días de acceso ilimitado a tu guía</b>, desde hoy hasta el <b>{fecha}</b>.", "You have <b>7 days of unlimited access to your guide</b>, from today until <b>{fecha}</b>."],
  "listo.acceso2": ["Se abre en <b>2 dispositivos</b>: por ejemplo, tu celular y el iPad del alumno. Al tercer dispositivo le aparece el aviso «Acceso en uso en otros dispositivos».", "It opens on <b>2 devices</b>: for example, your phone and the student's iPad. The third device sees the notice “Access in use on other devices.”"],
  "listo.acceso3": ["No compartas el link en otros chats: cada link es de una sola familia.", "Don't share the link in other chats: each link belongs to one family only."],
  "listo.acceso4": ["Guarda este link. También te mandamos tu guía por correo (a <b>{correo}</b>).", "Save this link. We also send you your guide by email (to <b>{correo}</b>)."],
  "listo.otra": ["✨ Crea otra guía", "✨ Create another guide"],
};

// Grados y materias: el valor que se manda al servidor sigue en español; solo cambia lo que se ve.
const GRADOS_EN = { "1° Primaria": "Grade 1 (1° Primaria)", "2° Primaria": "Grade 2 (2° Primaria)", "3° Primaria": "Grade 3 (3° Primaria)", "4° Primaria": "Grade 4 (4° Primaria)", "5° Primaria": "Grade 5 (5° Primaria)", "6° Primaria": "Grade 6 (6° Primaria)", "1° Secundaria": "Grade 7 (1° Secundaria)", "2° Secundaria": "Grade 8 (2° Secundaria)", "3° Secundaria": "Grade 9 (3° Secundaria)", "1° Preparatoria": "Grade 10 (1° Preparatoria)", "2° Preparatoria": "Grade 11 (2° Preparatoria)", "3° Preparatoria": "Grade 12 (3° Preparatoria)", "Universidad": "University" };
const MATERIAS_EN = { "Historia": "History", "Español": "Spanish", "Matemáticas": "Math", "Ciencias": "Science", "Química": "Chemistry", "Biología": "Biology", "Física": "Physics", "Geografía": "Geography", "Formación Cívica y Ética": "Civics and Ethics", "Inglés": "English", "Francés": "French", "Otra": "Other" };
export const nombreGrado = (g) => (idioma() === "en" && GRADOS_EN[g]) || g;
export const nombreMateria = (m) => (idioma() === "en" && MATERIAS_EN[m]) || m;

// Textos que manda el servidor (avance de la guía y errores). En inglés se traducen los conocidos; uno desconocido
// se cambia por un mensaje general en inglés para que nunca aparezca español en la versión en inglés.
const SERVIDOR_EN = [
  [/^Preparando (tus|las) páginas/, () => "Preparing your pages 📖"],
  [/^Leyendo tus fotos.*\((\d+) de (\d+)\)/, (m) => `Reading your photos 📖 (${m[1]} of ${m[2]})`],
  [/^Planeando tu guía/, () => "Planning your guide 🧭"],
  [/^Escribiendo el bloque (\d+) de (\d+)/, (m) => `Writing unit ${m[1]} of ${m[2]} ✍️`],
  [/^Revisando que todo esté perfecto/, () => "Checking that everything is perfect ✅"],
  [/^Arreglando detallitos/, () => "Fixing small details 🔧"],
  [/^Revisando la ortografía/, () => "Checking the spelling ✍️"],
  [/^Verificando los datos/, () => "Checking the facts 🔎"],
  [/^Buscando las fotografías/, () => "Finding the photographs 🖼️"],
  [/^Armando tu guía/, () => "Putting your guide together 🧩"],
  [/^¡Tu guía está lista!/, () => "Your guide is ready! 🎉"],
  [/^Estamos revisando tu guía/, () => "We are reviewing your guide; we will email you as soon as it is ready."],
  [/no parecen material de estudio/i, () => "The photos don't look like study material. Upload notes, textbook pages or syllabi."],
  [/No se pudo leer ninguna foto/i, () => "None of the photos could be read. Try clearer photos, with good light and the whole page showing."],
  [/generador todavía no está encendido/i, () => "The guide maker is not turned on yet. Let us know on WhatsApp and we will turn it on."],
  [/^No pudimos terminar tu guía/, () => "We couldn't finish your guide. Try again with clearer photos."],
  [/código no es válido/i, () => "That code is not valid."],
  [/^Escribe tu nombre/, () => "Enter your name."],
  [/^Escribe tu comentario/, () => "Write your comment (10 to 600 characters)."],
  [/^Elige de 1 a 5 estrellas/, () => "Choose 1 to 5 stars."],
  [/^Ya recibimos varios comentarios/, () => "We already received several comments from this device. Please try again tomorrow."],
  [/^No pudimos guardar tu comentario/, () => "We couldn't save your comment. Please try again later."],
  [/borrador no existe o ya venció/i, () => "That draft doesn't exist or has expired. Please start your guide again."],
  [/No llegaron las páginas/i, () => "The pages didn't arrive. Try uploading them again."],
  [/compra no existe/i, () => "That purchase doesn't exist."],
  [/compra ya no está activa/i, () => "This purchase is no longer active. Order your guide again from the home page."],
  [/pago en línea no está disponible/i, () => "Online payment is not available right now. Write to us on WhatsApp to complete your purchase."],
  [/motor de pagos aún no está configurado/i, () => "Online payment is not set up yet. Write to us on WhatsApp to complete your purchase."],
];
export function textoServidor(texto) {
  const s = String(texto ?? "");
  if (idioma() !== "en" || !s) return s;
  for (const [re, fn] of SERVIDOR_EN) { const m = s.match(re); if (m) return fn(m); }
  return /[áéíóúñ¿¡]|\b(tu|tus|la|el|de|que|por|para)\b/i.test(s) ? TEXTOS["error.servidor"][1] : s;
}

// ---------- Idioma activo ----------
let actual = "es";
try {
  const pedido = new URLSearchParams(location.search).get("lang");
  if (IDIOMAS.includes(pedido)) { actual = pedido; localStorage.setItem(CLAVE_LS, pedido); }
  else if (IDIOMAS.includes(localStorage.getItem(CLAVE_LS))) actual = localStorage.getItem(CLAVE_LS);
} catch {}
export const idioma = () => actual;
export const locale = () => (actual === "en" ? "en-US" : "es-MX");
export const fecha = (iso) => { const d = new Date(iso); return isNaN(d) ? String(iso ?? "") : d.toLocaleString(locale(), { dateStyle: "long", timeStyle: "short" }); };

const escHtml = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function rellenar(plantilla, vars, escapar) {
  return plantilla.replace(/\{(\w+)\}/g, (todo, k) => {
    if (!vars || !(k in vars)) return todo;
    const v = k.startsWith("fecha") ? fecha(vars[k]) : vars[k];
    return escapar ? escHtml(v) : String(v ?? "");
  });
}
// WhatsApp según el servidor (GET /publico → { whatsapp: true|false }): si existe la clave "x.wa" y WhatsApp está
// encendido, t(), th(), marca() y los [data-i18n] usan "x.wa"; si no, "x". Mientras el servidor no responda (o responda
// 404) cuenta como apagado. El resultado se guarda en sessionStorage y, al llegar, se vuelve a pintar como al cambiar de idioma.
let whatsapp = false;
try { whatsapp = sessionStorage.getItem("sparked_wa") === "1"; } catch {}
export const whatsappEncendido = () => whatsapp;
const claveWa = (clave) => (whatsapp && TEXTOS[clave + ".wa"] ? clave + ".wa" : clave);
// Texto plano (para textContent, alert, WhatsApp). Si la clave no existe, regresa la clave tal cual.
export function t(clave, vars) { const par = TEXTOS[claveWa(clave)]; return par ? rellenar(par[actual === "en" ? 1 : 0] ?? par[0], vars, false) : clave; }
// Texto para innerHTML: las variables se escapan (nombres, correos, folios); el texto fijo del diccionario puede traer <b>, <em>…
export function th(clave, vars) { const par = TEXTOS[claveWa(clave)]; return par ? rellenar(par[actual === "en" ? 1 : 0] ?? par[0], vars, true) : escHtml(clave); }
// <span data-i18n> que se vuelve a traducir solo al cambiar de idioma.
export function marca(clave, vars, etiqueta = "span", extra = "") {
  const v = vars ? ` data-i18n-vars="${escHtml(JSON.stringify(vars))}"` : "";
  return `<${etiqueta} data-i18n="${clave}"${v}${extra ? " " + extra : ""}>${th(clave, vars)}</${etiqueta}>`;
}
// Cambia la clave de un elemento ya pintado (por ejemplo, «Copiar link» → «✓ Copiado»).
export function poner(el, clave, vars) {
  if (!el) return;
  el.dataset.i18n = clave;
  if (vars) el.dataset.i18nVars = JSON.stringify(vars); else delete el.dataset.i18nVars;
  traducirElemento(el);
}

function traducirElemento(el) {
  const clave = el.dataset.i18n;
  if (clave && TEXTOS[clave]) {
    let vars = null; try { vars = el.dataset.i18nVars ? JSON.parse(el.dataset.i18nVars) : null; } catch {}
    if (el.tagName === "TITLE") el.textContent = t(clave, vars); else el.innerHTML = th(clave, vars);
  }
  if (el.dataset.i18nAttr) for (const par of el.dataset.i18nAttr.split(";")) {
    const [attr, k] = par.split(":").map((x) => x.trim());
    if (attr && k) el.setAttribute(attr, t(k));
  }
  if ("i18nServidor" in el.dataset) el.textContent = textoServidor(el.dataset.i18nServidor);
}
export function aplicar(raiz = document) {
  document.documentElement.lang = actual;
  raiz.querySelectorAll("[data-i18n], [data-i18n-attr], [data-i18n-servidor]").forEach(traducirElemento);
  document.querySelectorAll("[data-idioma]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.idioma === actual)));
}

const oyentes = new Set();
export function alCambiarIdioma(fn) { oyentes.add(fn); return () => oyentes.delete(fn); }
export function cambiarIdioma(nuevo) {
  if (!IDIOMAS.includes(nuevo) || nuevo === actual) return;
  actual = nuevo;
  try { localStorage.setItem(CLAVE_LS, nuevo); } catch {}
  // Si la dirección traía ?lang=, se actualiza para que al recargar o compartir se conserve el idioma elegido.
  try { const u = new URL(location.href); if (u.searchParams.has("lang")) { u.searchParams.set("lang", nuevo); history.replaceState(history.state, "", u); } } catch {}
  aplicar();
  oyentes.forEach((fn) => { try { fn(nuevo); } catch (e) { console.error(e); } });
}

async function consultarWhatsapp() {
  let guardado = null;
  try { guardado = sessionStorage.getItem("sparked_wa"); } catch {}
  if (guardado !== null) return;
  let nuevo = false;
  try { const r = await fetch(`${CONFIG.api}/publico`); nuevo = r.ok && (await r.json().catch(() => ({}))).whatsapp === true; } catch { return; }
  try { sessionStorage.setItem("sparked_wa", nuevo ? "1" : "0"); } catch {}
  if (nuevo === whatsapp) return;
  whatsapp = nuevo;
  aplicar();
  oyentes.forEach((fn) => { try { fn(actual); } catch (e) { console.error(e); } });
}

// Al cargar: traduce la página, conecta los botones «ES | EN» y quita el velo que evita ver el español un instante.
function iniciar() {
  aplicar();
  document.addEventListener("click", (e) => { const b = e.target.closest?.("[data-idioma]"); if (b) { e.preventDefault(); cambiarIdioma(b.dataset.idioma); } });
  document.documentElement.classList.remove("i18n-cargando");
  consultarWhatsapp();
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar); else iniciar();
