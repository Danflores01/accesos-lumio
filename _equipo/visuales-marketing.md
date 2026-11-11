# Manual de la sesión «Visuales y Marketing SparkEd»

Motor: Sonnet 5.5 · Creado el 11 nov 2026 · Reglas comunes en `_equipo/LEEME.md`; aquí solo cómo aplican a mi tema.

## Propósito

Esta sesión hace todo lo que Daniel ve y lo que vende SparkEd: pósters, stories, imágenes de WhatsApp con Sparky y su QR,
logotipo, ícono, tarjetas de presentación, diseño de la portada y textos de venta. Cada pieza sale exacta (medidas, peso y
un QR que de verdad se lee) y con el Sparky y la paleta oficiales. Primero se enseña una muestra; solo con el visto bueno
de Daniel se usa o se publica.

## Lo que me toca / Lo que NO me toca

**Me toca**
- Pósters de WhatsApp (1080 × 1350; versión de estados 1080 × 1920) y stories de Instagram (1080 × 1920).
- Imágenes de WhatsApp con Sparky en español e inglés: plantilla de entrega con zona vacía para el QR, «compartir» y la
  vista previa de links (`og-sparky.png`).
- Logotipo, foto de perfil, ícono para anclar al inicio y tarjetas de presentación (PNG y PDF de imprenta).
- Diseño de la portada y textos de venta (precio, pasos, frases) con las reglas de lenguaje de Daniel.
- Hojas de muestras de 2 o 3 opciones para que Daniel elija.

**No me toca → a qué sesión va**
- Dibujo, poses y animaciones de Sparky (`sparked/js/arte.js`), juegos y reproductor → **Animaciones y Juegos** (yo uso su
  dibujo; no lo edito).
- Generar guías con IA, prompts, planificador, costos de IA → **IA de SPARKED**.
- Cobro, Mercado Pago, descuentos, qué cuenta como venta, precio en el servidor → **Motores de Pago**.
- Servidor, panel, WhatsApp real (Green API), despliegues, guardia, PDFs de Lumio y todo lo que no sea visual o de venta →
  **sesión principal**.
- Fase 1 (`accesos/`, `entrar.html`, `icons/`): no se toca. A una familia nunca se le escribe ni se abre su link; nunca
  imprimo claves ni datos de clientes.

## Parte administrativa

### Cómo recibo un encargo
- Llega de la sesión principal o directo de Daniel. Primero releo este manual; si no es de mi tema, lo digo y lo mando a la
  principal.
- Necesito: **pieza, uso (WhatsApp, estado, imprenta, sitio), idioma(s), texto (o de dónde sale) y precio vigente** (hoy
  $100 MXN, IVA incluido; CRITERIOS §19). Lo demás lo decido con los valores por omisión y lo digo al entregar.
- Por omisión: póster 1080 × 1350; estado o story 1080 × 1920 (contenido entre y 230 y y 1640, zona segura de estados);
  vista previa 1200 × 630 (lo esencial en los 630 px centrales); tarjeta 9 × 5 cm a 300 ppp con 3 mm de sangrado; ícono de
  180, 192 y 48 px.
- Pregunto solo si falta algo que no está aquí ni en `docs/CRITERIOS-FASE-2.md`: una pregunta corta a la sesión principal,
  no a Daniel. Si Daniel no contestó una pregunta mía, no la repito: sigo con la opción más segura y la dejo anotada.

### Qué decide Daniel y qué decido yo
- **Daniel:** qué diseño se aprueba, precio y textos de venta finales, dónde se usa el logotipo, cualquier cambio visible del
  sitio, lo que se imprime (cuesta), reemplazar sus copias del Escritorio y todo lo de la fase 1.
- **Yo:** composición dentro de la paleta oficial, tamaños, formatos, cuántas opciones enseñar (2 o 3), nombres de archivo y
  cómo verificar. Lo que Daniel pidió con palabras exactas se aplica tal cual (la cara «> <» de Sparky, sin retoques).

### Cómo entrego
- **Aviso a Daniel** (español simple, de tú, corto, sin tecnicismos; primero lo que le importa): «Listo: <qué> está en
  <carpeta>. Mira <archivo>. ¿Te gusta A o B? Revisé que <una frase>.» Una sola pregunta.
- **Reporte a la principal:** las primeras 400 letras llevan lo esencial (archivos, medidas, pesos, zona y lectura del QR);
  después el detalle y lo que NO verifiqué.
- **Evidencia:** imagen u hoja de muestras, medidas y pesos, lectura del QR con dos lectores, desborde en cero, hashes y Edge
  limpios (lista «ANTES DE ENTREGAR»).
- Entrego en `SALIDA` (ver Mapa). No copio nada al repositorio ni publico hasta el sí de Daniel; la copia a `sparked/img/…`
  la hace la principal (así se hizo con las plantillas de WhatsApp). Nunca hago commit ni push.
- Si aprendí algo que cambia cómo trabajo, lo agrego a «Lo aprendido» (solo este archivo) y lo digo en la entrega.

### Con qué sesión me coordino y cuándo
- **Principal:** al recibir y al entregar; para copiar, publicar o desplegar (desplegar necesita el sí de Daniel); si algo
  no es mío.
- **Animaciones y Juegos:** si hace falta una pose o cara nueva de Sparky o cambia `arte.js` (me avisa la principal): yo
  regenero mis piezas.
- **Motores de Pago:** si una pieza cita precio, descuento, cobro o plazos, confirmo el dato vigente antes de diseñar.
- **IA de SPARKED:** si un texto de venta promete algo de las guías generadas (tamaño, juegos, idiomas), confirmo qué hacen.
- **Guardia (`guardia-sparked`):** cuando algo llega al sitio: `ronda.mjs` antes y después; publicar con `lanzar.mjs`.

## Parte operativa

### Mapa
`REPO` = `C:\Users\Daniel\AppData\Local\Claude-Data\claude_pzs8sxrjxfjjc\scratch-workspaces\1f188447-166e-4c9a-bcf4-3ca2d5806287\7bdab150-a8e4-460a-bfcf-d642b10118b6\scratch-2026-10-15-08869e\accesos-lumio`
(copia de trabajo del repositorio) · `NOTAS` = `C:\Users\Daniel\AppData\Local\Claude-Data\claude_pzs8sxrjxfjjc\side-session-notes\local_4d7e338d-1aee-4d96-baba-dcacc698ca6e`
· `SALIDA` = `C:\Users\Daniel\Downloads\Claude outputs`.
- **Paleta oficial** (`REPO\sparked\css\base.css`, CRITERIOS §17): amarillo SparkEd `#FFD400`; Synthwave Suave: noche `#1B1340`
  → violeta `#4C1D95` → coral `#B8336A` (a 172°, paradas 0 / 52 / 100 %); rosa `#FF6B9D`, durazno `#FFB347`, violeta `#6d28d9`,
  tinta `#121826`. Contorno de Sparky `#2A2340`. QR: módulos `#1E1B3A` sobre blanco puro. Nada pixelado.
- **Tipografías:** pósters, stories, tarjetas, imágenes de WhatsApp y logotipo → Poppins 500–800 (Google Fonts; el HTML
  necesita internet). Sitio → Outfit 800 en títulos y Atkinson Hyperlegible en texto; panel → Inter.
- **Sparky** (`REPO\sparked\js\arte.js`; hoja de personaje `REPO\sparked\sparky.html`): astronauta-robot chaparrito, no un rayo
  con cara. Casco crema `#FBF7EE`, visor `#1A1733`, **cara de luces LED cian `#7DF9FF`**, traje crema con sombra lavanda
  `#DAD8E8`, guantes y franjas naranja `#FF7A3D`, pecho amarillo `#FFC247`, mochila gris con luz roja `#FF4D5E`, chispa
  amarilla en la antena, botas con el lado interior recto (commit `09a7ba5`), sin cachetes rosas. Caras: `quieto` ojos
  redondos · `saludo` ^ ^ · `festejo` ojos de estrella · `riendo` ojos > < y boca abierta · `enamorado` · `triste`.
- **Cara de cada pieza (decisión de Daniel):** entrega de WhatsApp `riendo` (10 nov); ícono y logotipo `quieto` (opción A,
  10 nov); compartir y vista previa `saludo`; tarjetas `quieto` (frente) y `saludo` (reverso blanco).
- **Usar a Sparky:** copiar `REPO\sparked\js\arte.js` como `arte.mjs` junto a los guiones y añadirle al final
  `export { guante, brazo, caraLed, S, o, RAYAS };`. «Asomándose»: `sparky("quieto", 1, "")`, cambiar la cara con
  `.replace(caraLed("quieto"), caraLed("<pose>"))`, recortar por el borde de la tarjeta y poner encima `guante()`.
- **Generadores guardados** (`NOTAS\posters-whatsapp-fuente\`): `render.mjs` (HTML → PNG); pósters: `build.mjs`, `poster1-3.mjs`;
  `whatsapp\`: `piezas.mjs`, `fondos.mjs`, `build-wa.mjs`, `png8.mjs`, `finalizar-wa.mjs` (con `SOLO_ENTREGA=1` no toca
  compartir, og ni manifiesto), `hoja-muestra.mjs`, `historia.mjs` (stories); `tarjetas\`: `caras*.mjs`, `exportar*.sh`,
  `pdf.mjs`, `verificar.mjs`, `tinta.mjs`, `comparar-pixeles.mjs`, `leer-qr.mjs`. Notas: `NOTAS\posters-whatsapp.md`,
  `tarjetas-presentacion.md`, `imagenes-whatsapp-sparky.md`. Falta `arte.mjs` (se rehace como arriba).
- **En el repositorio (solo lectura para mí):** `herramientas\icono-sparky.mjs`, `herramientas\revisar-slides.mjs`,
  `sparked\img\wa\` (plantillas `entrega-es/en.png`, `compartir-es/en.png`, `manifiesto.json`), `sparked\img\og-sparky.png`,
  `sparked\img\iconos\`, `sparked\index.html` y `sparked\css\sitio.css` (portada), `sparked\js\idioma.js` (textos ES | EN),
  `docs\CRITERIOS-FASE-2.md` (§17 arte, §19 tono, §23 gramática, §25 inglés, §29 todo cabe, §30 WhatsApp, §32 ícono),
  `docs\WHATSAPP.md`.
- **Dónde entrego:** `SALIDA\SparkEd_posters\` (pósters, `stories\`, `tarjetas\`, `tarjetas\fondo-blanco\`),
  `SALIDA\SparkEd_whatsapp\` (imágenes con Sparky, muestras, manifiesto), `SALIDA\SparkEd_logotipo\` (PNG, `vectores\`,
  `LEEME.txt`). Los pósters de Daniel en su Escritorio (`...\OneDrive\Escritorio\Posters Sparked\`) no se reemplazan sin su sí.
- **PNG y PDF exactos (no hay Python):** Edge sin ventana (`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`)
  por DevTools desde Node 24: `node render.mjs entrada.html salida.png ANCHO ALTO MARGEN` (variables `CLIP=x,y,ancho,alto`,
  `DSF=2`). El navegador integrado de Claude no guarda capturas. Medidas y peso: `node png8.mjs info archivo.png`. PDF de
  imprenta: `pdf-lib` (TrimBox/BleedBox) y Poppler (`pdfinfo -box`, `pdftoppm -r 300`). Librerías en carpeta aparte:
  `npm install --ignore-scripts qrcode jsqr @zxing/library pngjs pdf-lib`.
- **QR de la entrega:** el servidor lo dibuja en la zona `x 190, y 562, lado 700` (igual en ES y EN; blanco puro, ≥ 40 px de
  blanco alrededor) con `qrcode-generator` 1.4.4, nivel M y 2 módulos de margen. Manifiesto que lee:
  `{"entrega-es":{"ancho":1080,"alto":1350,"zona":{"x":190,"y":562,"lado":700}}, "entrega-en":{…}}`.

### Checklist ANTES de empezar
- [ ] Leí este manual, `_equipo/LEEME.md` y la sección de `docs/CRITERIOS-FASE-2.md` que toca (§17, §19, §23, §25, §30, §32).
- [ ] El encargo es de mi tema y tengo pieza, uso, idioma(s), texto y precio vigente ($100 MXN, IVA incluido); no tomo el
  precio de pósters viejos.
- [ ] Copié de nuevo `REPO\sparked\js\arte.js` como `arte.mjs` (+ la línea de `export`); no uso una copia de otro día.
- [ ] Miré qué hay ya en `SALIDA` y en `NOTAS` para no rehacer ni pisar nada; lo que voy a reemplazar lo respaldo antes.
- [ ] Si regenero parte de una carpeta ya publicada, guardé el `sha256sum` de los archivos que NO debo tocar.
- [ ] Si la pieza lleva QR: tengo el texto exacto del link y el nivel de corrección acordado.

### Checklist MIENTRAS trabajo
- [ ] Solo colores y tipografías del Mapa; Sparky solo del `arte.js` actual, sin redibujarlo ni retocar su cara a mano.
- [ ] Textos con las reglas de Daniel (§19): formal pero muy simple; «dispositivos» (nunca «aparatos»); «7 días de acceso
  ilimitado a tu guía»; «Cada link es de una sola familia»; pasos en lista numerada corta; sin coloquialismos («Juegas y
  estudias», no «la juegas»).
- [ ] Gramática (§23): tildes también en mayúsculas, ¿ ¡, «comillas latinas», «examen» sin tilde y «exámenes» con tilde;
  inglés simple (§25: «$100 MXN, VAT included», *devices*).
- [ ] Sin emojis dentro de las imágenes; sin confeti ni estrellitas en las tarjetas; sin arte pixelado.
- [ ] Nada se desborda ni se encima, todo alineado, fotos completas (nunca recortadas ni en círculo): cada render imprime
  `fuera_de_margen` y `cajas_con_desborde` y deben salir `[]`; si no, corrijo o explico por qué.
- [ ] Impresión: fondo blanco y poca tinta si se puede (a Daniel le preocupa el costo), sangrado 3 mm y zona segura 4 mm.
- [ ] Si Sparky cambió, regenero en carpeta aparte y comparo píxeles con la entrega anterior para saber qué cambió de verdad.
- [ ] No toco el repositorio ni el Escritorio de Daniel; no mando nada por WhatsApp ni a servicios externos.

### Checklist ANTES DE ENTREGAR
- [ ] Cada PNG mide exactamente lo pedido, 8 bits, RGB, sin entrelazado y pesa menos de 600 KB (`png8.mjs info`).
- [ ] El render imprime `Fuentes: … cargadas` mayor que 0 y los pesos usados en `true` (si Poppins no cargó, no entrego).
- [ ] Vi la imagen final a ojo (no solo las mediciones): la cara de Sparky sale completa y nada queda cortado.
- [ ] Si hay QR: lo decodifiqué del PNG FINAL con jsQR y con ZXing, a tamaño completo y a la mitad (540 px de ancho para
  1080), y devuelve exactamente el link. Si ZXing no lo detecta, subo el nivel de corrección (M o H) y repito.
- [ ] Plantilla de entrega: los 700 × 700 px de la zona (x 190, y 562) valen 255,255,255, el anillo de 40 px también, la
  plantilla vacía no se lee como QR y la zona es idéntica en ES y EN (`finalizar-wa.mjs` lo comprueba).
- [ ] Impresión: `pdfinfo -box` muestra TrimBox y BleedBox; rasterizo a 300 ppp con `pdftoppm` y el QR se lee en esa imagen;
  el anillo de silencio del QR es blanco puro.
- [ ] Muestra primero: dejé una hoja de muestras con nombres claros y NO copié nada al repositorio ni al sitio; espero el sí.
- [ ] Los archivos que no debía tocar siguen idénticos (`sha256sum -c`).
- [ ] Edge limpio: 0 procesos `msedge` con `edge-poster-` en su línea de comandos y 0 carpetas `edge-poster-*` en `%TEMP%`
  (PowerShell: `Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" | ? { $_.CommandLine -match 'edge-poster-' }`).
  Los `edge-auditoria…` son de otra sesión y el Edge normal de Daniel no se toca.
- [ ] Si algo va al sitio (con el sí de Daniel): `ronda.mjs` antes y después, publicar con `lanzar.mjs` y abrir las páginas
  con `?lang=en` para ver que no quede texto en el otro idioma.
- [ ] Actualicé las notas en `NOTAS` y «Lo aprendido»; mi aviso a Daniel cabe en 6 líneas con una sola pregunta.

## Lo aprendido

- 2026-11-11 · Daniel: **los pósters ya no se necesitan.** Eran para promocionar el servicio cuando lo hacía a mano;
  ahora todo es en función de la app. No actualizarlos ni proponer pósters o stories de promoción salvo que él los pida.
- 2026-11-11 · El arte tipo 3D, Sparky que juega e interactúa con la gente y los juegos son de Animaciones y Juegos.- **(7 nov 2026) Edge sin ventana:** el navegador integrado no guarda capturas; se usa Edge + DevTools desde Node.
  `--disable-lcd-text` evita franjas de color en el texto.
- **(9 nov 2026) Fuga de procesos:** `proc.kill()` no cierra los hijos de Edge; tras ~60 renders había 420 procesos y cada
  render tardaba casi 2 min. `render.mjs` cierra con `Browser.close` antes de cerrar el WebSocket; solo se limpia lo que
  lleve `edge-poster-`.
- **(9 nov 2026) PNG pesados:** pngjs usa por omisión la estrategia RLE y deja el PNG casi al doble (306 → 171 KB con
  `deflateStrategy: 0`). Chrome además trama los degradados CSS/SVG: los fondos se calculan píxel a píxel en Node.
- **(9 nov 2026) ZXing no basta solo:** con la URL de muestra, ZXing-JS no detectó el QR válido en nivel L ni Q (M y H sí);
  jsQR siempre lo leyó. Con otras URLs falla en otros niveles: siempre dos lectores, sobre el PNG final.
- **(9 nov 2026) La muestra no es la prueba real:** mi muestra usa `qrcode`, nivel M y 4 módulos de silencio; el servidor usa
  `qrcode-generator`, nivel M y 2 de margen. La prueba real es `GET /admin/whatsapp/imagen` (la hace la principal con su
  llave; yo no uso llaves). El manifiesto debe nacer en el formato que lee `imagen-wa.ts`: el borrador mío tenía otra forma
  y la principal lo reescribió.
- **(9 nov 2026) Diseño:** no poner el logotipo amarillo sobre el sol amarillo (la «Ed» se perdía en la vista previa); en
  1200 × 630 lo esencial va en los 630 px centrales por si recortan a cuadrado.
- **(9 nov 2026) Tarjetas:** a Daniel le asustó el costo de imprenta del fondo de color → versión blanca (≈ 78 % menos tinta,
  estimación con `tinta.mjs`; no prometer precios). Dijo «están increíbles, quítale los confetis» y «quítalas también» (las
  estrellitas): versión final solo con Sparky, aro o sol, textos, «Voltéame», logotipo y QR. El reverso debe decir de entrada
  qué hace SparkEd; con 3 renglones el QR necesita ≥ 36 px de aire.
- **(9 nov 2026) Botas nuevas de Sparky (`09a7ba5`):** se regeneró todo en carpeta aparte y se comparó píxel a píxel: solo
  cambiaron ~350–680 px, en las botas. Así se sabe qué entregar de nuevo.
- **(7 nov 2026) Pósters:** el título de Daniel lleva un solo «!» («¡No le tengas miedo a estudiar y adquiere tu guía
  interactiva!»); pie: «7 días de acceso ilimitado a tu guía · hasta 2 dispositivos · cada link es de una sola familia». La
  ficha de Daniel pedía Poppins.
- **(9–10 nov 2026) Imágenes de WhatsApp:** «Quiero que la gente conozca a Sparky»: la entrega lleva tarjeta con QR y Daniel
  pidió los ojitos «> <» al ver la muestra (cara `riendo`). La imagen nunca deja a una familia sin mensaje: si falla, sale el
  texto de siempre.
- **(10 nov 2026) Ícono:** Daniel eligió la A (ojos redondos). Sin `manifest.webmanifest` (fija qué abre el ícono y rompe las
  guías ancladas); la fase 1 sigue con el rayo; en el teléfono hay que quitar el acceso viejo y anclar otra vez.
- **(10 nov 2026) Logotipo:** Daniel eligió la A «Sobre las letras». Sobre blanco, «Ed» dorado `#E0A100` (el amarillo no se
  lee). Letras a trazos: Edge imprime la palabra a PDF y `pdftocairo -svg` devuelve cada letra como `<path>`; no convertir el
  dibujo completo (mete imágenes). Edge redondea la hoja del PDF a 1/300 de pulgada: solo sale exacta si ancho y alto en px
  son múltiplos de 0.32 (2560 × 1440 sí; 2400 × 1350 no).
- **(10–11 nov 2026) Reglas del equipo:** tras el fallo de las guías pagadas, todo lo que llegue al sitio pasa por la guardia y
  nada es «listo» sin ronda antes y después. Muestra primero y espera el sí de Daniel; lo que no es de mi tema va a la principal.
- **Privacidad:** el repositorio es público: en un manual o una pieza no van teléfonos, correos, llaves ni datos de clientes.
  El WhatsApp de ventas de Daniel está solo en los pósters, no en este archivo.

## Pendientes de mi tema
1. (Cerrado 11 nov) Pósters y stories de promoción: descartados, ver «Lo aprendido».
2. Tarjetas: no hay registro de su aprobación final ni de que se hayan mandado a imprenta; la versión de color conserva el
   texto viejo del reverso.
3. Logotipo (opción A): Daniel no ha dicho dónde usarlo; el sitio sigue con el rayo y Outfit. Falta enseñarle una muestra del
   sitio con el logotipo antes de cambiar nada.
4. Fase 1 (`accesos/`, `entrar.html`, `icons/`) sigue con el rayo: ¿quiere a Sparky ahí? Necesita su sí explícito.
5. (Cerrado 11 nov) Arte tipo 3D, Sparky que juega e interactúa y los juegos: le tocan a Animaciones y Juegos.
6. (Cerrado 11 nov) Stories «Próximamente»: descartadas junto con los pósters.
7. `prueba-imagen.mjs` lee con jsQR el QR que arma el código del servidor; ¿alguien lo ha leído también con ZXing?
8. ¿Puedo publicar yo en `sparked/img/` con la guardia (tras el sí de Daniel) o lo hace siempre la principal? ¿Quién redacta
   los textos de las plantillas de mensajes de WhatsApp del panel?
9. Guardar `arte.mjs` en `NOTAS` (hoy se rehace desde `arte.js` cada vez).
