-- SparkEd · compras.de_prueba: marcar una compra pagada como «compra de prueba» (26 nov 2026). Solo agrega; no borra ni cambia nada.
-- Aplicada en Supabase el 26 nov 2026 como "sparked_compras_de_prueba".
--
-- Qué pidió Daniel (26 nov 2026): compró con su propio dinero un paquete de 3 guías ($199, aprobado por Mercado Pago)
-- para probarlo y pidió «márcalo como compra de prueba, ya que el dinero que usé para hacer la prueba salió de ventas
-- reales». Esa compra no debe contar como venta en ningún lugar del panel (Resumen, ventas de hoy y del mes, Paquetes,
-- Costos e impuestos ni la ronda de la guardia), pero sus guías siguen en su saldo y funcionan igual: no se borra, no se
-- reembolsa y no se toca nada en Mercado Pago.
--
-- Cómo se usa: la regla ventaCobrada (funciones/sparked/extras.ts) devuelve false cuando de_prueba es true, y tipoSinCobro
-- dice "prueba" (ni venta, ni cortesía, ni código). El panel la muestra como «Compra de prueba (no cuenta como venta)» y
-- la pone o la quita con POST /admin/compras/<id>/prueba { de_prueba: true | false }, con confirmación.
-- Es distinto de cuentas.de_prueba (cuentas simuladas de las pruebas automáticas, con teléfonos de prueba): aquí la
-- cuenta es real y solo esa compra se aparta de las cuentas del dinero.
--
-- La función "sparked" 2026-11-25.4 (la desplegada antes de este cambio) funciona igual con esta migración aplicada.
alter table public.compras add column if not exists de_prueba boolean not null default false;
comment on column public.compras.de_prueba is 'Compra de prueba (por ejemplo, Daniel probando con su propio dinero): no cuenta como venta en ningún lugar del panel; el saldo, la entrega y Mercado Pago no cambian. Distinto de cuentas.de_prueba (cuentas simuladas).';
