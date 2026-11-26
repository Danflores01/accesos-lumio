-- SparkEd · suscripción mensual: cambiar el método de pago SIN cancelar (25 nov 2026). Solo agrega; no borra ni cambia nada.
-- Aplicada en Supabase el 25 nov 2026 como "sparked_suscripcion_metodo_de_pago".
--
-- Qué pidió Daniel (25 nov 2026): que funcione «como Xbox». La cuenta tiene un método de pago; si el cobro no pasa, se le
-- pregunta «¿Quieres cambiar tu método de pago?» y un botón le deja agregar otra tarjeta de crédito o débito, sin
-- cancelar la suscripción. También puede cambiarla cuando quiera.
--
-- Cómo se hace (funciones/sparked/suscripcion.ts): la tarjeta nueva se pone en la página de Mercado Pago, en un contrato
-- de cobro nuevo («preapproval») de la MISMA suscripción. El contrato anterior se cancela solo después de que Mercado Pago
-- confirma el nuevo, y la suscripción pasa al contrato nuevo en un paso atómico. La suscripción (su fila, su folio, su
-- periodo y sus guías) es la misma de siempre: lo único que cambia es con qué contrato cobra Mercado Pago.
--   · Activa o en prueba: el contrato nuevo empieza a cobrar el día en que termina lo ya pagado (o la prueba). Sin cobro
--     doble, sin perder días y sin otra prueba gratis.
--   · En gracia (un cobro no pasó): el contrato nuevo cobra al autorizarse y, con el cobro aprobado, vuelve a activa.
--   · Si la familia abandona a la mitad, el contrato anterior sigue intacto.
--
-- Qué trae:
--   1) suscripcion_cambios_pago: una fila por cada intento de cambiar el método de pago, con su contrato nuevo.
--   2) suscripciones.mp_tarjeta: los últimos 4 dígitos de la tarjeta con la que cobra, si Mercado Pago los deja ver
--      (para decir «Tarjeta terminada en 1234»). Nunca se guarda una tarjeta.
--   3) suscripcion_cobros.mp_preapproval_id: con qué contrato se hizo cada cobro.
--   4) sparked_aplicar_cambio_pago: el paso atómico que pasa la suscripción al contrato nuevo.
--
-- Estados de un cambio:
--   pendiente  → la familia tiene el link de Mercado Pago y no ha terminado (o está terminando)
--   aplicado   → Mercado Pago confirmó el contrato nuevo, se canceló el anterior y la suscripción ya cobra con el nuevo
--   descartado → no se aplicó (motivo); su contrato nuevo se cancela en Mercado Pago para que nunca cobre
--
-- La función "sparked" 2026-11-25.2 (la desplegada antes de este cambio) funciona igual con esta migración aplicada.

-- ---------- 1) Cambios de método de pago ----------
create table if not exists public.suscripcion_cambios_pago (
  id                       uuid primary key default gen_random_uuid(),
  suscripcion_id           uuid not null references public.suscripciones(id) on delete restrict,
  estado                   text not null default 'pendiente' check (estado in ('pendiente', 'aplicado', 'descartado')),
  motivo                   text,                              -- por qué se descartó: sin_terminar · reemplazado · cancelado_en_mercadopago · ya_se_cobro · fecha_no_coincide · cobro_muy_cerca · fecha_no_respetada · suscripcion_terminada · no_se_pudo_cancelar_el_anterior · mercadopago_no_respondio
  estado_al_pedir          text,                              -- cómo estaba la suscripción al pedirlo: en_prueba · activa · en_gracia
  inmediato                boolean not null default false,    -- true = había un cobro sin pasar: el contrato nuevo cobra al autorizarse
  primer_cobro_en          timestamptz,                       -- fecha pedida a Mercado Pago para el primer cobro del contrato nuevo (fin de lo ya pagado o de la prueba); nulo = cobra al autorizarse
  correo_pago              text,                              -- correo con el que paga en Mercado Pago (payer_email del contrato nuevo)
  mp_preapproval_id        text,                              -- el contrato NUEVO en Mercado Pago
  mp_estado                text,                              -- pending · authorized · cancelled
  mp_init_point            text,                              -- página de Mercado Pago para poner la tarjeta nueva
  mp_medio                 text,                              -- visa, master, debvisa… (nunca datos de la tarjeta)
  mp_tarjeta               text,                              -- últimos 4 dígitos de la tarjeta nueva, si Mercado Pago los deja ver
  mp_error                 text,
  mp_preapproval_anterior  text,                              -- el contrato que reemplaza (se anota al empezar a aplicarlo)
  aplicando_desde          timestamptz,                       -- candado: un solo proceso aplica el cambio
  anterior_cancelado_en    timestamptz,                       -- cuándo confirmó Mercado Pago que el contrato anterior ya no cobra
  nuevo_cancelado_en       timestamptz,                       -- descartado: cuándo confirmó Mercado Pago que el contrato nuevo ya no cobra
  aplicado_en              timestamptz,
  de_prueba                boolean not null default false,    -- de las pruebas automáticas (no es de una familia)
  creado_en                timestamptz not null default now(),
  actualizado_en           timestamptz not null default now()
);
-- Un solo cambio en curso por suscripción, y un contrato de Mercado Pago pertenece a un solo cambio.
create unique index if not exists suscripcion_cambios_pago_uno_pendiente on public.suscripcion_cambios_pago (suscripcion_id) where estado = 'pendiente';
create unique index if not exists suscripcion_cambios_pago_contrato on public.suscripcion_cambios_pago (mp_preapproval_id) where mp_preapproval_id is not null;
create index if not exists suscripcion_cambios_pago_suscripcion on public.suscripcion_cambios_pago (suscripcion_id, creado_en desc);
create index if not exists suscripcion_cambios_pago_anterior on public.suscripcion_cambios_pago (mp_preapproval_anterior) where mp_preapproval_anterior is not null;
comment on table public.suscripcion_cambios_pago is 'SparkEd: cambios de método de pago de una suscripción. Cada uno es un contrato nuevo en Mercado Pago; el anterior se cancela solo después de confirmar el nuevo.';

-- ---------- 2) Con qué tarjeta cobra (solo los últimos 4 dígitos) ----------
alter table public.suscripciones add column if not exists mp_tarjeta text;
comment on column public.suscripciones.mp_tarjeta is 'Últimos 4 dígitos de la tarjeta con la que cobra Mercado Pago, si los deja ver. Nunca se guarda una tarjeta.';

-- ---------- 2b) Con qué contrato se hizo cada cobro ----------
-- Con dos contratos de la misma suscripción (el de siempre y el del cambio) hace falta saber cuál cobró: así se nota
-- un cobro del contrato anterior después del cambio y nunca se confunde con la mensualidad del nuevo.
alter table public.suscripcion_cobros add column if not exists mp_preapproval_id text;
comment on column public.suscripcion_cobros.mp_preapproval_id is 'Contrato de Mercado Pago («preapproval») que hizo este cobro, si se sabe. Nulo en los cobros anteriores al 25 nov 2026.';

-- ---------- 3) Aplicar un cambio (paso atómico) ----------
-- La suscripción pasa al contrato nuevo y el cambio queda «aplicado», las dos cosas o ninguna. Solo se llama cuando
-- Mercado Pago ya confirmó que el contrato nuevo está autorizado y que el anterior quedó cancelado. Bloquea la
-- suscripción mientras trabaja: dos avisos a la vez no lo aplican dos veces.
--   res_estado: aplicado · ya_aplicado · descartado (el cambio ya no está pendiente) · suscripcion_terminada (ya no
--   tiene un contrato que cobre) · no_coincide (la suscripción ya no cobra con el contrato que este cambio reemplaza).
-- Sin el cambio o sin su suscripción no devuelve ninguna fila.
create or replace function public.sparked_aplicar_cambio_pago(p_cambio uuid, p_medio text default null)
returns table (res_estado text, res_suscripcion uuid, res_estado_suscripcion text, res_anterior text, res_nuevo text)
language plpgsql
set search_path = public
as $$
declare
  k public.suscripcion_cambios_pago%rowtype;
  s public.suscripciones%rowtype;
  v_sus uuid;
begin
  select x.suscripcion_id into v_sus from public.suscripcion_cambios_pago x where x.id = p_cambio;
  if v_sus is null then return; end if;
  select * into s from public.suscripciones x where x.id = v_sus for update;
  if not found then return; end if;
  select * into k from public.suscripcion_cambios_pago x where x.id = p_cambio for update;
  if not found then return; end if;
  if k.estado = 'aplicado' then
    return query select 'ya_aplicado'::text, s.id, s.estado, k.mp_preapproval_anterior, k.mp_preapproval_id; return;
  end if;
  if k.estado <> 'pendiente' or k.mp_preapproval_id is null then
    return query select 'descartado'::text, s.id, s.estado, k.mp_preapproval_anterior, k.mp_preapproval_id; return;
  end if;
  if s.estado not in ('en_prueba', 'activa', 'en_gracia') then
    return query select 'suscripcion_terminada'::text, s.id, s.estado, k.mp_preapproval_anterior, k.mp_preapproval_id; return;
  end if;
  if k.mp_preapproval_anterior is distinct from s.mp_preapproval_id then
    return query select 'no_coincide'::text, s.id, s.estado, k.mp_preapproval_anterior, k.mp_preapproval_id; return;
  end if;
  update public.suscripciones x
     set mp_preapproval_id = k.mp_preapproval_id, mp_estado = 'authorized', mp_medio = coalesce(p_medio, k.mp_medio), mp_tarjeta = k.mp_tarjeta,
         mp_init_point = null, correo_pago = coalesce(k.correo_pago, x.correo_pago), mp_error = null, mp_revisado_en = now(), actualizada_en = now()
   where x.id = s.id;
  update public.suscripcion_cambios_pago x
     set estado = 'aplicado', aplicado_en = now(), mp_estado = 'authorized', mp_medio = coalesce(p_medio, x.mp_medio), aplicando_desde = null,
         mp_error = null, actualizado_en = now()
   where x.id = k.id;
  return query select 'aplicado'::text, s.id, s.estado, s.mp_preapproval_id, k.mp_preapproval_id;
end;
$$;

-- Nadie entra directo a esta tabla ni a esta función: todo pasa por la función "sparked" con la llave de servicio.
alter table public.suscripcion_cambios_pago enable row level security;
revoke all on public.suscripcion_cambios_pago from anon, authenticated;

revoke execute on function public.sparked_aplicar_cambio_pago(uuid, text) from public, anon, authenticated;
grant execute on function public.sparked_aplicar_cambio_pago(uuid, text) to service_role;
