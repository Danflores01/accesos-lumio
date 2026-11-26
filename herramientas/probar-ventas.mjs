// Candado de las cuentas: ¿qué compras cuentan como VENTA?
//
//   node herramientas/probar-ventas.mjs        (Node 22.18 o más nuevo; no usa internet ni la base)
//
// El 10 nov 2026 el panel decía «5 ventas · $500» y Mercado Pago solo había cobrado 3 ($300). Las otras 2 eran compras
// marcadas como pagadas a mano en el panel, sin cobro, y el sistema contaba como venta todo lo «pagado» que no fuera
// con código. Desde entonces una compra solo es venta si de verdad se cobró (funciones/sparked/extras.ts, ventaCobrada).
// Esta prueba repite las 9 compras pagadas de ese mes y exige 3 ventas y $300; con el código anterior da 5 y $500.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { ventaCobrada, tipoSinCobro, confirmadaAMano, calcularCostos, impuestosDelMes, inicioDiaVentas } = await import(pathToFileURL(path.join(REPO, "funciones", "sparked", "extras.ts")).href);
let mal = 0;
const revisar = (cond, texto) => { console.log((cond ? "ok   " : "FALLA") + " " + texto); if (!cond) mal++; };

// ---------- La regla, caso por caso ----------
const P = { estado: "pagada" };
revisar(ventaCobrada({ ...P, metodo_pago: "tarjeta", mp_estado: "approved" }) === true, "tarjeta aprobada por Mercado Pago: es venta");
revisar(ventaCobrada({ ...P, metodo_pago: "oxxo", mp_estado: "approved" }) === true, "OXXO aprobado por Mercado Pago: es venta");
revisar(ventaCobrada({ ...P, metodo_pago: "manual" }) === true, "confirmada a mano y cobrada por fuera: es venta");
revisar(ventaCobrada({ ...P, stripe_session_id: "cs_x" }) === true, "cobrada por Stripe: es venta");
revisar(ventaCobrada({ ...P, metodo_pago: "codigo" }) === false, "código gratis: no es venta");
revisar(ventaCobrada({ ...P, metodo_pago: "cortesia" }) === false, "cortesía: no es venta");
revisar(ventaCobrada({ ...P, metodo_pago: null, mp_estado: null }) === false, "marcada como pagada a mano sin decir cómo se cobró: no es venta");
revisar(ventaCobrada({ ...P, metodo_pago: "tarjeta", mp_estado: "refunded" }) === false, "reembolsada en Mercado Pago: deja de ser venta");
revisar(ventaCobrada({ ...P, metodo_pago: "oxxo", mp_estado: "pending" }) === false, "OXXO todavía sin pagar: no es venta");
revisar(ventaCobrada({ estado: "pendiente", metodo_pago: "tarjeta", mp_estado: "approved" }) === false, "compra que no está pagada: no es venta");
revisar(tipoSinCobro({ ...P, metodo_pago: "codigo" }) === "codigo" && tipoSinCobro({ ...P, metodo_pago: null }) === "cortesia" && tipoSinCobro({ ...P, metodo_pago: "cortesia" }) === "cortesia" && tipoSinCobro({ ...P, mp_estado: "approved" }) === null, "lo que no se cobró se separa en «con código» y «cortesía»");
revisar(confirmadaAMano({ ...P, metodo_pago: null }) && confirmadaAMano({ ...P, metodo_pago: "manual" }) && confirmadaAMano({ ...P, metodo_pago: "cortesia" }) && !confirmadaAMano({ ...P, metodo_pago: "codigo" }) && !confirmadaAMano({ ...P, metodo_pago: "tarjeta", mp_estado: "approved" }), "solo a las confirmadas a mano se les puede cambiar cobrada ↔ cortesía");

// ---------- Las 9 compras pagadas de noviembre de 2026 (sin datos de nadie: método, estado, monto y hora) ----------
const mp = (metodo, pagada_en) => ({ estado: "pagada", monto_mxn: "100.00", metodo_pago: metodo, mp_estado: "approved", pagada_en });
const codigo = (pagada_en) => ({ estado: "pagada", monto_mxn: "0.00", metodo_pago: "codigo", mp_estado: null, pagada_en });
const aMano = (pagada_en) => ({ estado: "pagada", monto_mxn: "100.00", metodo_pago: null, mp_estado: null, pagada_en });
const compras = [
  mp("tarjeta", "2026-11-08T17:20:00Z"), mp("oxxo", "2026-11-09T16:12:00Z"), mp("tarjeta", "2026-11-11T01:01:00Z"),
  codigo("2026-11-08T01:02:00Z"), codigo("2026-11-09T23:07:00Z"), codigo("2026-11-10T15:33:00Z"), codigo("2026-11-11T01:21:00Z"),
  aMano("2026-11-08T17:48:00Z"), aMano("2026-11-10T01:52:00Z"),
];
const base = { trabajos: [], previasDeGuias: [], tipos: [], ajusteTc: 18.5, hoy: "2026-11-10", dias: 30, servicios: [] };
const r = calcularCostos({ ...base, compras });
const m = r.ingresos.mes;
revisar(m.ventas === 3 && m.mxn === 300, `noviembre 2026: 3 ventas cobradas y $300 (salió ${m.ventas} y $${m.mxn}; el código anterior daba 5 y $500)`);
revisar(m.con_codigo === 4 && m.cortesias === 2, `noviembre 2026: 4 guías con código y 2 de cortesía, que no son ventas (salió ${m.con_codigo} y ${m.cortesias})`);
revisar(r.balance.mes.ingresos_mxn === 300, `el balance del mes parte de $300 (salió $${r.balance.mes.ingresos_mxn})`);
const dia = (f) => r.por_dia.find((d) => d.fecha === f) ?? {};
revisar(dia("2026-11-08").ventas === 1 && dia("2026-11-09").ventas === 1 && dia("2026-11-10").ventas === 1 && dia("2026-11-10").ingresos_mxn === 100, "por día (hora de México): una venta el 8, una el 9 y una el 10 de noviembre");
const imp = impuestosDelMes({ iva: 16, isrModo: "resico", isrTasa: 0 }, m.mxn, m.ventas);
revisar(imp.cobrado_mxn === 300 && imp.iva_mxn === 41.38, `los impuestos se calculan sobre $300: IVA $41.38 (salió sobre $${imp.cobrado_mxn}, IVA $${imp.iva_mxn})`);
// Con una confirmada a mano que sí se cobró por fuera, esa sí suma.
const r2 = calcularCostos({ ...base, compras: [...compras, { estado: "pagada", monto_mxn: "100.00", metodo_pago: "manual", mp_estado: null, pagada_en: "2026-11-10T18:00:00Z" }] });
revisar(r2.ingresos.mes.ventas === 4 && r2.ingresos.mes.mxn === 400, "una guía cobrada por fuera y confirmada a mano sí suma como venta (4 y $400)");

// ---------- Paquete de 3 guías (24 nov 2026): el paquete cobrado es UNA venta; las guías hechas con su saldo no ----------
revisar(ventaCobrada({ ...P, metodo_pago: "saldo" }) === false && tipoSinCobro({ ...P, metodo_pago: "saldo" }) === "saldo", "guía hecha con el saldo de un paquete: no es venta ni cortesía (se cuenta aparte)");
revisar(!confirmadaAMano({ ...P, metodo_pago: "saldo" }), "a una guía hecha con saldo no se le puede «cambiar a cobrada por fuera»");
const paquete = (metodo, mp_estado, pagada_en) => ({ estado: "pagada", monto_mxn: "199.00", metodo_pago: metodo, mp_estado, pagada_en, producto: "paquete3" });
const deSaldo = (pagada_en) => ({ estado: "pagada", monto_mxn: "0.00", metodo_pago: "saldo", mp_estado: null, pagada_en, producto: "guia" });
const r3 = calcularCostos({ ...base, compras: [...compras, paquete("spei", "approved", "2026-11-10T16:00:00Z"), deSaldo("2026-11-10T16:30:00Z"), deSaldo("2026-11-10T17:30:00Z"), paquete("cortesia", null, "2026-11-10T19:00:00Z"), { ...paquete("oxxo", "pending", null), estado: "pendiente" }] });
revisar(r3.ingresos.mes.ventas === 4 && r3.ingresos.mes.mxn === 499, `un paquete cobrado por SPEI suma UNA venta de $199: 4 ventas y $499 (salió ${r3.ingresos.mes.ventas} y $${r3.ingresos.mes.mxn})`);
revisar(r3.ingresos.mes.de_paquete === 2 && r3.ingresos.mes.cortesias === 3 && r3.ingresos.mes.con_codigo === 4, `las 2 guías hechas con saldo no son ventas ni cortesías; un paquete de cortesía tampoco es venta (salió ${r3.ingresos.mes.de_paquete} de paquete y ${r3.ingresos.mes.cortesias} cortesías)`);

// ---------- Suscripción mensual (25 nov 2026): la venta es cada COBRO aprobado; las guías hechas con ella no ----------
revisar(ventaCobrada({ ...P, metodo_pago: "suscripcion" }) === false && tipoSinCobro({ ...P, metodo_pago: "suscripcion" }) === "suscripcion", "guía hecha con la suscripción: no es venta ni cortesía (se cuenta aparte)");
revisar(!confirmadaAMano({ ...P, metodo_pago: "suscripcion" }), "a una guía hecha con la suscripción no se le puede «cambiar a cobrada por fuera»");
const cobroSus = (mp_estado, pagada_en) => ({ estado: "pagada", monto_mxn: "349.00", metodo_pago: "tarjeta", mp_estado, pagada_en, producto: "suscripcion" });
const deSus = (pagada_en) => ({ estado: "pagada", monto_mxn: "0.00", metodo_pago: "suscripcion", mp_estado: null, pagada_en, producto: "guia" });
const r4 = calcularCostos({ ...base, compras: [...compras, cobroSus("approved", "2026-11-10T16:00:00Z"), cobroSus("rejected", "2026-11-10T16:05:00Z"), cobroSus("refunded", "2026-11-09T16:00:00Z"), deSus("2026-11-10T16:30:00Z"), deSus("2026-11-10T17:30:00Z"), deSus("2026-11-10T18:30:00Z")] });
revisar(r4.ingresos.mes.ventas === 4 && r4.ingresos.mes.mxn === 649 && r4.ingresos.mes.cobros_suscripcion === 1, `un cobro de suscripción aprobado suma UNA venta de $349; el rechazado y el reembolsado no: 4 ventas y $649 (salió ${r4.ingresos.mes.ventas} y $${r4.ingresos.mes.mxn})`);
revisar(r4.ingresos.mes.de_suscripcion === 3 && r4.ingresos.mes.cortesias === 2 && r4.ingresos.mes.de_paquete === 0, `las 3 guías hechas con la suscripción no son ventas ni cortesías (salió ${r4.ingresos.mes.de_suscripcion} de suscripción y ${r4.ingresos.mes.cortesias} cortesías)`);
revisar(r.ingresos.mes.ventas === 3 && r.ingresos.mes.mxn === 300 && r.ingresos.mes.de_suscripcion === 0 && r.ingresos.mes.cobros_suscripcion === 0, "sin suscripciones, noviembre sigue en 3 ventas y $300");

// ---------- Compra de prueba (Daniel, 26 nov 2026): compró un paquete con su propio dinero para probar; no es venta ----------
// «Márcalo como compra de prueba, ya que el dinero que usé para hacer la prueba salió de ventas reales.» La marca
// (compras.de_prueba, puesta o quitada en el panel) aparta esa compra de TODAS las cuentas; quitarla la vuelve a contar.
// El saldo de sus guías y la entrega no cambian, y en Mercado Pago no se toca nada.
const dePrueba = { ...P, metodo_pago: "tarjeta", mp_estado: "approved", de_prueba: true };
revisar(ventaCobrada(dePrueba) === false && tipoSinCobro(dePrueba) === "prueba", "una compra aprobada por Mercado Pago y marcada como compra de prueba: NO es venta (ni cortesía, ni código)");
revisar(ventaCobrada({ ...dePrueba, de_prueba: false }) === true && tipoSinCobro({ ...dePrueba, de_prueba: false }) === null, "al quitar la marca de prueba, la misma compra vuelve a contar como venta");
revisar(ventaCobrada({ ...P, metodo_pago: "manual", de_prueba: true }) === false && ventaCobrada({ ...P, stripe_session_id: "cs_x", de_prueba: true }) === false, "la marca de prueba manda también sobre lo cobrado por fuera o por Stripe");
revisar(ventaCobrada({ ...P, metodo_pago: "tarjeta", mp_estado: "approved", de_prueba: null }) === true && confirmadaAMano(dePrueba) === false, "sin la marca (nula o ausente) todo sigue como antes, y a una compra de Mercado Pago de prueba no se le puede «cambiar a cobrada por fuera»");
const paqPrueba = (de_prueba) => ({ ...paquete("tarjeta", "approved", "2026-11-10T19:23:00Z"), de_prueba });
const r5 = calcularCostos({ ...base, compras: [...compras, paqPrueba(true)] });
revisar(r5.ingresos.mes.ventas === 3 && r5.ingresos.mes.mxn === 300 && r5.ingresos.mes.cortesias === 2 && r5.ingresos.mes.con_codigo === 4 && r5.balance.mes.ingresos_mxn === 300, `el paquete de prueba de $199 no suma como venta ni como cortesía: noviembre sigue en 3 ventas y $300 (salió ${r5.ingresos.mes.ventas} y $${r5.ingresos.mes.mxn}, ${r5.ingresos.mes.cortesias} cortesías)`);
const d10 = r5.por_dia.find((d) => d.fecha === "2026-11-10") ?? {};
revisar(d10.ventas === 1 && d10.ingresos_mxn === 100, `el 10 de noviembre sigue con una venta de $100: el paquete de prueba tampoco entra en la tabla por día (salió ${d10.ventas} y $${d10.ingresos_mxn})`);
revisar(impuestosDelMes({ iva: 16, isrModo: "resico", isrTasa: 0 }, r5.ingresos.mes.mxn, r5.ingresos.mes.ventas).cobrado_mxn === 300, "los impuestos se calculan sin la compra de prueba (sobre $300)");
const r6 = calcularCostos({ ...base, compras: [...compras, paqPrueba(false)] });
revisar(r6.ingresos.mes.ventas === 4 && r6.ingresos.mes.mxn === 499, `con la marca quitada, el mismo paquete vuelve a ser UNA venta de $199: 4 ventas y $499 (salió ${r6.ingresos.mes.ventas} y $${r6.ingresos.mes.mxn})`);

// ---------- El «día de ventas» del Resumen termina a las 11 pm de México (pedido de Daniel, 11 nov 2026) ----------
// Horas en UTC; México = UTC−6. 22:59 de México (04:59 UTC del día siguiente) todavía es «hoy»; 23:00 ya es mañana.
const dv = (iso) => inicioDiaVentas(Date.parse(iso));
revisar(dv("2026-11-11T00:30:00Z").hoy === "2026-11-10T05:00:00.000Z", "una venta a las 6:30 pm de México sigue contando como de hoy (antes se cortaba a las 6 pm)");
revisar(dv("2026-11-11T04:59:00Z").hoy === "2026-11-10T05:00:00.000Z", "a las 10:59 pm de México todavía es el mismo día de ventas");
revisar(dv("2026-11-11T05:00:00Z").hoy === "2026-11-11T05:00:00.000Z", "a las 11:00 pm de México empieza el día siguiente");
revisar(dv("2026-12-01T04:30:00Z").mes === "2026-11-01T05:00:00.000Z" && dv("2026-12-01T05:30:00Z").mes === "2026-12-01T05:00:00.000Z", "el mes también cambia a las 11 pm de México del último día");
revisar(/inicioDiaVentas\(Date\.now\(\)\)/.test(fs.readFileSync(path.join(REPO, "funciones", "sparked", "index.ts"), "utf8")), "el Resumen usa ese corte (inicioDiaVentas)");

// ---------- Que el servidor pida los datos que la regla necesita ----------
// Si una consulta no trae mp_estado, ventaCobrada diría que nada se cobró y el panel mostraría 0 ventas.
// Y si no trae de_prueba, una compra de prueba volvería a contar como venta.
const fuentes = ["index.ts", "extras.ts", "cuenta.ts"].map((f) => fs.readFileSync(path.join(REPO, "funciones", "sparked", f), "utf8")).join("\n");
const consultas = [...fuentes.matchAll(/\.from\("compras"\)\.select\("([^"]+)"\)/g)].map((x) => x[1]).filter((s) => s.includes("monto_mxn") && s.includes("metodo_pago") && !s.includes("nombre"));
revisar(consultas.length >= 4 && consultas.every((s) => s.includes("mp_estado") && s.includes("stripe_session_id") && s.includes("estado") && s.includes("de_prueba")), `las ${consultas.length} consultas de cuentas (Resumen, Costos, mes anterior y Paquetes) traen estado, mp_estado, stripe_session_id y de_prueba`);
revisar(/accion === "prueba" && m === "POST"/.test(fuentes) && /update\(\{ de_prueba: b\.de_prueba \}\)/.test(fuentes) && /Solo una compra pagada se puede marcar como compra de prueba/.test(fuentes), "el servidor tiene POST /admin/compras/<id>/prueba para poner o quitar la marca de compra de prueba (solo en compras pagadas)");
revisar(/esCompraDePrueba/.test(fuentes) && /paquetes_de_prueba:/.test(fuentes) && /compra_de_prueba: esCompraDePrueba\(x\)/.test(fuentes), "la sección Paquetes aparta las compras de prueba de los paquetes vendidos y cobrados, y lo dice en cada fila");
const panel = fs.readFileSync(path.join(REPO, "sparked", "panel.html"), "utf8");
revisar(/Compra de prueba<\/b> \(no cuenta como venta\)/.test(panel) && /Marcar como compra de prueba/.test(panel) && /Quitar marca de prueba/.test(panel) && /\/compras\/\$\{[^}]+\}\/prueba`/.test(panel), "el panel muestra «Compra de prueba (no cuenta como venta)» y trae los botones «Marcar como compra de prueba» y «Quitar marca de prueba»");
revisar(/pendientes: cuenta\(C, \(c\) => c\.estado === "pendiente" && !esPaquete\(c\)\)/.test(fuentes) && /const dePaquete = \(c: any\) => tipoSinCobro\(c\) === "saldo";/.test(fuentes), "el Resumen cuenta los paquetes aparte de las guías, y las guías hechas con saldo aparte de las cortesías");
revisar(/const venta = \(c: any\) => ventaCobrada\(c\);/.test(fuentes) && !/const venta = \(c: any\) => c\.estado === "pagada" && c\.metodo_pago !== "codigo"/.test(fuentes), "el Resumen usa la misma regla (ventaCobrada) y ya no «todo lo pagado que no sea con código»");

revisar(/const deSuscripcion = \(c: any\) => tipoSinCobro\(c\) === "suscripcion";/.test(fuentes) && /suscripciones: await resumenSuscripciones\(/.test(fuentes), "el Resumen cuenta aparte las guías hechas con la suscripción y trae los cobros de suscripción en su propio bloque");
revisar(/producto: "suscripcion" \}\)\);/.test(fuentes) && /\.from\("suscripcion_cobros"\)\.select\("mp_estado, monto_mxn, cobrado_en"\)\.eq\("de_prueba", false\)/.test(fuentes), "Costos e impuestos suman los cobros de suscripción con la misma regla (ventaCobrada) y sin los de prueba");

console.log(mal ? `\n${mal} FALLAS: las cuentas del panel no coinciden con lo cobrado.` : "\nCuentas bien: solo cuenta como venta lo que de verdad se cobró.");
process.exit(mal ? 1 : 0);
