-- SparkEd: cobro con Mercado Pago (Checkout Pro, México). Aplicada el 7 nov 2026.
-- Solo agrega columnas a compras: no borra ni cambia nada de lo que ya existe (pago manual y Stripe siguen igual).
alter table public.compras
  add column if not exists mp_preferencia_id text,
  add column if not exists mp_pago_id        text,
  add column if not exists mp_estado         text,
  add column if not exists metodo_pago       text,
  add column if not exists mp_ficha_url      text,
  add column if not exists mp_vence_en       timestamptz,
  add column if not exists mp_actualizado_en timestamptz;

comment on column public.compras.mp_preferencia_id is 'Mercado Pago: id de la preferencia de Checkout Pro (el link de pago)';
comment on column public.compras.mp_pago_id        is 'Mercado Pago: id del último pago recibido para esta compra';
comment on column public.compras.mp_estado         is 'Mercado Pago: estado de ese pago (approved, pending, in_process, rejected, cancelled, refunded, revisar_monto)';
comment on column public.compras.metodo_pago       is 'Cómo se pagó o se está pagando: tarjeta, oxxo, spei, mercadopago u otro';
comment on column public.compras.mp_ficha_url      is 'Mercado Pago: ficha de OXXO o datos para la transferencia SPEI';
comment on column public.compras.mp_vence_en       is 'Mercado Pago: fecha límite para pagar en OXXO o por SPEI';
comment on column public.compras.mp_actualizado_en is 'Última vez que se anotó información de Mercado Pago en esta compra';
