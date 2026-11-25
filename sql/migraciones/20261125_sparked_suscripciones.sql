-- SparkEd · suscripción mensual «Guías ilimitadas» por 349 MXN al mes (25 nov 2026). Solo agrega; no borra ni cambia nada.
-- Aplicada en Supabase el 25 nov 2026 como "sparked_suscripciones".
--
-- Qué trae (plan en _equipo/suscripciones/PLAN.md, decisiones de Daniel del 23 al 25 nov 2026):
--   1) suscripciones: una fila por suscripción de una cuenta (la cuenta es el número de WhatsApp, tabla cuentas). El cobro
--      mensual lo hace Mercado Pago Suscripciones (preapproval sin plan); aquí se guarda el estado y hasta cuándo está pagada.
--   2) suscripcion_cobros: cada cobro que Mercado Pago intentó. El id del pago es único: un aviso repetido no alarga dos
--      veces el periodo. Un cobro solo cuenta como venta si Mercado Pago lo aprobó (regla ventaCobrada).
--   3) compras.suscripcion_id: la guía hecha con la suscripción (metodo_pago = 'suscripcion', sin cobro: no es venta).
--   4) pruebas_usadas.suscripcion_id: qué suscripción gastó la prueba gratis (una por WhatsApp y una por tarjeta).
--   5) Ajustes: sparked_suscripcion ('no' = apagada · 'probadores' = solo los números de la lista · 'si' = pública),
--      sparked_suscripcion_precio (349) y sparked_suscripcion_probadores (lista de WhatsApp, vacía).
--   6) sparked_registrar_cobro: paso atómico que anota un cobro y, si quedó aprobado, alarga el periodo UNA sola vez.
--
-- Estados de una suscripción:
--   pendiente  → se creó y falta que la familia termine en Mercado Pago (o que llegue su primer cobro)
--   en_prueba  → 7 días gratis; puede crear guías. Al terminar, Mercado Pago hace el primer cobro
--   activa     → pagada hasta periodo_fin; puede crear guías
--   en_gracia  → un cobro falló y Mercado Pago lo reintenta: abre sus guías, no crea nuevas
--   cancelada  → ya no se cobra; conserva lo pagado hasta periodo_fin
--   vencida    → terminó porque no se pudo cobrar
--   abandonada → nunca se terminó de contratar (o se le negó la prueba gratis)
--
-- La función "sparked" 2026-11-24.3 (la desplegada antes de este cambio) funciona igual con esta migración aplicada.

-- ---------- 1) Suscripciones ----------
create table if not exists public.suscripciones (
  id                     uuid primary key default gen_random_uuid(),
  cuenta_id              uuid not null references public.cuentas(id) on delete restrict,
  estado                 text not null default 'pendiente' check (estado in ('pendiente', 'en_prueba', 'activa', 'en_gracia', 'cancelada', 'vencida', 'abandonada')),
  motor                  text not null default 'mercadopago',
  frecuencia             text not null default 'mensual',     -- el plan anual queda para después
  precio_mxn             numeric(10,2) not null,
  correo_pago            text,                                -- correo con el que paga en Mercado Pago (payer_email)
  con_prueba             boolean not null default false,      -- se contrató con los 7 días gratis
  primer_cobro_en        timestamptz,                         -- fecha pedida a Mercado Pago para el primer cobro (fin de la prueba o de lo ya pagado); nulo = se cobra al suscribirse
  prueba_hasta           timestamptz,
  acepto_en              timestamptz,                         -- cuándo marcó la casilla del cobro automático
  acepto_texto           text,                                -- el texto que aceptó
  mp_preapproval_id      text,
  mp_estado              text,                                -- pending · authorized · paused · cancelled
  mp_init_point          text,                                -- página de Mercado Pago para terminar de suscribirse
  mp_medio               text,                                -- visa, master, debvisa… (nunca datos de la tarjeta)
  mp_error               text,                                -- último problema con Mercado Pago, para que Daniel lo vea
  mp_revisado_en         timestamptz,
  periodo_inicio         timestamptz,
  periodo_fin            timestamptz,                         -- hasta cuándo tiene derecho (prueba o mes pagado)
  proximo_cobro          timestamptz,
  aviso_renovacion_en    timestamptz,                         -- cuándo salió el último aviso de cobro
  aviso_renovacion_para  timestamptz,                         -- de qué cobro avisó
  gracia_desde           timestamptz,
  gracia_hasta           timestamptz,
  cancelada_en           timestamptz,
  cancelada_por          text check (cancelada_por in ('familia', 'daniel', 'mercadopago', 'sistema')),
  cancelada_mp_en        timestamptz,                         -- cuándo confirmó Mercado Pago que ya no cobra
  motivo_fin             text,
  vencida_en             timestamptz,
  revisar                boolean not null default false,      -- bandera para el panel; nunca bloquea
  revisar_motivo         text,
  aviso_uso_prueba_en    timestamptz,                         -- aviso a Daniel: más de 15 guías durante la prueba
  de_prueba              boolean not null default false,      -- de las pruebas automáticas (no es de una familia)
  creada_en              timestamptz not null default now(),
  actualizada_en         timestamptz not null default now()
);
-- Una sola suscripción «viva» por cuenta. (Una cancelada que sigue pagada puede convivir con la nueva.)
create unique index if not exists suscripciones_una_viva on public.suscripciones (cuenta_id) where estado in ('pendiente', 'en_prueba', 'activa', 'en_gracia');
create unique index if not exists suscripciones_preapproval on public.suscripciones (mp_preapproval_id) where mp_preapproval_id is not null;
create index if not exists suscripciones_cuenta on public.suscripciones (cuenta_id, creada_en desc);
create index if not exists suscripciones_estado on public.suscripciones (estado);
comment on table public.suscripciones is 'SparkEd: suscripción mensual «Guías ilimitadas». El cobro lo hace Mercado Pago (preapproval); aquí vive el estado y hasta cuándo está pagada.';

-- ---------- 2) Cobros ----------
create table if not exists public.suscripcion_cobros (
  id                uuid primary key default gen_random_uuid(),
  suscripcion_id    uuid not null references public.suscripciones(id) on delete restrict,
  mp_payment_id     text not null,                            -- id del pago en Mercado Pago
  mp_factura_id     text,                                     -- id de la cuota (authorized_payment)
  mp_estado         text,                                     -- estado del pago en Mercado Pago: approved, rejected, refunded…
  mp_detalle        text,
  estado            text not null check (estado in ('aprobado', 'pendiente', 'rechazado', 'reembolsado', 'revisar')),
  monto_mxn         numeric(10,2) not null default 0,
  metodo            text,
  cobrado_en        timestamptz,
  periodo_desde     timestamptz,
  periodo_hasta     timestamptz,
  periodo_aplicado  boolean not null default false,           -- este cobro ya alargó el periodo (una sola vez)
  de_prueba         boolean not null default false,
  creado_en         timestamptz not null default now(),
  actualizado_en    timestamptz not null default now()
);
-- Un solo renglón por pago de Mercado Pago: el aviso repetido no cobra ni alarga dos veces.
create unique index if not exists suscripcion_cobros_pago on public.suscripcion_cobros (mp_payment_id);
create index if not exists suscripcion_cobros_suscripcion on public.suscripcion_cobros (suscripcion_id, creado_en desc);
comment on table public.suscripcion_cobros is 'SparkEd: cobros de cada suscripción. Solo es venta el que Mercado Pago aprobó (mp_estado = approved).';

-- ---------- 3) Guías hechas con la suscripción y registro de pruebas gratis ----------
alter table public.compras add column if not exists suscripcion_id uuid references public.suscripciones(id) on delete set null;
comment on column public.compras.suscripcion_id is 'Suscripción con la que se hizo esta guía (metodo_pago = suscripcion). No es una venta: la venta es cada cobro mensual.';
create index if not exists compras_suscripcion on public.compras (suscripcion_id) where suscripcion_id is not null;

alter table public.pruebas_usadas add column if not exists suscripcion_id uuid references public.suscripciones(id) on delete set null;
comment on table public.pruebas_usadas is 'SparkEd: quién ya gastó su prueba gratis de la suscripción. Una por WhatsApp y una por tarjeta (huella; nunca los datos de la tarjeta).';

-- ---------- 4) Ajustes (apagada hasta que Daniel la abra) ----------
insert into public.config (clave, valor) values
  ('sparked_suscripcion', 'no'),
  ('sparked_suscripcion_precio', '349'),
  ('sparked_suscripcion_probadores', '')
on conflict (clave) do nothing;

-- ---------- 5) Anotar un cobro (paso atómico) ----------
-- Anota (o actualiza) el cobro de un pago de Mercado Pago y, si quedó aprobado, alarga el periodo de la suscripción UNA
-- sola vez por pago. Bloquea la suscripción mientras trabaja: dos avisos del mismo pago a la vez no alargan dos veces.
--   · El periodo nuevo llega hasta p_periodo_hasta (la fecha del próximo cobro que dice Mercado Pago) si es razonable;
--     si no, un mes después del periodo anterior (o del cobro, si no había periodo o el cobro llegó muy tarde).
--   · Un cobro aprobado deja la suscripción «activa». Si estaba cancelada sigue cancelada (conserva el mes que pagó); si
--     estaba vencida o abandonada y la cuenta ya tiene otra suscripción viva, no cambia de estado.
-- Sin la suscripción o sin id de pago no devuelve ninguna fila.
create or replace function public.sparked_registrar_cobro(
  p_suscripcion uuid, p_mp_payment_id text, p_mp_factura_id text, p_mp_estado text, p_mp_detalle text,
  p_estado text, p_monto numeric, p_metodo text, p_cobrado_en timestamptz, p_periodo_hasta timestamptz default null)
returns table (res_cobro uuid, res_nuevo boolean, res_estado_anterior text, res_aplicado boolean, res_antes text, res_ahora text, res_periodo_inicio timestamptz, res_periodo_fin timestamptz)
language plpgsql
set search_path = public
as $$
declare
  s public.suscripciones%rowtype;
  v_id uuid; v_prev text; v_ya boolean := false; v_nuevo boolean := false; v_aplicado boolean := false;
  v_cuando timestamptz; v_base timestamptz; v_fin timestamptz; v_estado text; v_otra boolean;
begin
  if coalesce(p_mp_payment_id, '') = '' or p_estado not in ('aprobado', 'pendiente', 'rechazado', 'reembolsado', 'revisar') then return; end if;
  select * into s from public.suscripciones x where x.id = p_suscripcion for update;
  if not found then return; end if;
  v_cuando := coalesce(p_cobrado_en, now());
  select c.id, c.estado, c.periodo_aplicado into v_id, v_prev, v_ya from public.suscripcion_cobros c where c.mp_payment_id = p_mp_payment_id for update;
  if v_id is null then
    insert into public.suscripcion_cobros (suscripcion_id, mp_payment_id, mp_factura_id, mp_estado, mp_detalle, estado, monto_mxn, metodo, cobrado_en, de_prueba)
    values (p_suscripcion, p_mp_payment_id, p_mp_factura_id, p_mp_estado, p_mp_detalle, p_estado, coalesce(p_monto, 0), p_metodo, case when p_estado = 'aprobado' then v_cuando end, s.de_prueba)
    on conflict (mp_payment_id) do nothing
    returning id into v_id;
    if v_id is null then
      select c.id, c.estado, c.periodo_aplicado into v_id, v_prev, v_ya from public.suscripcion_cobros c where c.mp_payment_id = p_mp_payment_id for update;
    else
      v_nuevo := true; v_ya := false;
    end if;
  end if;
  if not v_nuevo then
    update public.suscripcion_cobros c
       set mp_estado = p_mp_estado, mp_detalle = p_mp_detalle, estado = p_estado,
           monto_mxn = coalesce(p_monto, c.monto_mxn), metodo = coalesce(p_metodo, c.metodo), mp_factura_id = coalesce(p_mp_factura_id, c.mp_factura_id),
           cobrado_en = case when p_estado = 'aprobado' then coalesce(c.cobrado_en, v_cuando) else c.cobrado_en end, actualizado_en = now()
     where c.id = v_id and (c.estado is distinct from p_estado or c.mp_estado is distinct from p_mp_estado);
  end if;
  v_estado := s.estado;
  if p_estado = 'aprobado' and not coalesce(v_ya, false) then
    v_base := case when s.periodo_fin is null or v_cuando > s.periodo_fin + interval '25 days' then v_cuando else s.periodo_fin end;
    v_fin := v_base + interval '1 month';
    if p_periodo_hasta is not null and p_periodo_hasta between v_cuando + interval '20 days' and v_cuando + interval '45 days' then v_fin := p_periodo_hasta; end if;
    if s.periodo_fin is not null and v_fin < s.periodo_fin then v_fin := s.periodo_fin; end if;
    if s.estado in ('pendiente', 'en_prueba', 'activa', 'en_gracia') then
      v_estado := 'activa';
    elsif s.estado in ('vencida', 'abandonada') then
      select exists (select 1 from public.suscripciones o where o.cuenta_id = s.cuenta_id and o.id <> s.id and o.estado in ('pendiente', 'en_prueba', 'activa', 'en_gracia')) into v_otra;
      if not v_otra then v_estado := 'activa'; end if;
    end if;
    update public.suscripciones x
       set estado = v_estado, periodo_inicio = v_base, periodo_fin = v_fin,
           proximo_cobro = case when v_estado = 'activa' then v_fin else x.proximo_cobro end,
           gracia_desde = null, gracia_hasta = null,
           vencida_en = case when v_estado = 'activa' then null else x.vencida_en end,
           motivo_fin = case when v_estado = 'activa' then null else x.motivo_fin end,
           actualizada_en = now()
     where x.id = s.id;
    update public.suscripcion_cobros c set periodo_aplicado = true, periodo_desde = v_base, periodo_hasta = v_fin, actualizado_en = now() where c.id = v_id;
    v_aplicado := true;
  end if;
  return query
    select v_id, v_nuevo, v_prev, v_aplicado, s.estado, x.estado, x.periodo_inicio, x.periodo_fin from public.suscripciones x where x.id = s.id;
end;
$$;

-- Nadie entra directo a estas tablas ni a esta función: todo pasa por la función "sparked" con la llave de servicio.
do $$
declare t text;
begin
  foreach t in array array['suscripciones', 'suscripcion_cobros'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

revoke execute on function public.sparked_registrar_cobro(uuid, text, text, text, text, text, numeric, text, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.sparked_registrar_cobro(uuid, text, text, text, text, text, numeric, text, timestamptz, timestamptz) to service_role;
