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
const { ventaCobrada, tipoSinCobro, confirmadaAMano, calcularCostos, impuestosDelMes } = await import(pathToFileURL(path.join(REPO, "funciones", "sparked", "extras.ts")).href);
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

// ---------- Que el servidor pida los datos que la regla necesita ----------
// Si una consulta no trae mp_estado, ventaCobrada diría que nada se cobró y el panel mostraría 0 ventas.
const fuentes = ["index.ts", "extras.ts"].map((f) => fs.readFileSync(path.join(REPO, "funciones", "sparked", f), "utf8")).join("\n");
const consultas = [...fuentes.matchAll(/\.from\("compras"\)\.select\("([^"]+)"\)/g)].map((x) => x[1]).filter((s) => s.includes("monto_mxn") && s.includes("metodo_pago") && !s.includes("nombre"));
revisar(consultas.length >= 3 && consultas.every((s) => s.includes("mp_estado") && s.includes("stripe_session_id") && s.includes("estado")), `las ${consultas.length} consultas de cuentas (Resumen, Costos y mes anterior) traen estado, mp_estado y stripe_session_id`);
revisar(/const venta = \(c: any\) => ventaCobrada\(c\);/.test(fuentes) && !/const venta = \(c: any\) => c\.estado === "pagada" && c\.metodo_pago !== "codigo"/.test(fuentes), "el Resumen usa la misma regla (ventaCobrada) y ya no «todo lo pagado que no sea con código»");

console.log(mal ? `\n${mal} FALLAS: las cuentas del panel no coinciden con lo cobrado.` : "\nCuentas bien: solo cuenta como venta lo que de verdad se cobró.");
process.exit(mal ? 1 : 0);
