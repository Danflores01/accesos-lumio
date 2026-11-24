-- SparkEd · cuentas, saldo de guías y paquete de 3 guías por 199 MXN (24 nov 2026). Solo agrega; no borra ni cambia nada.
-- Aplicada en Supabase el 24 nov 2026 como "sparked_cuentas_paquete3".
--
-- Qué trae (plan en _equipo/suscripciones/PLAN.md, decisiones de Daniel del 24 nov 2026):
--   1) cuentas: una por número de WhatsApp (formato internacional, igual que compras.telefono), con correo de respaldo.
--      No hay contraseñas: se entra con un código de 6 dígitos que llega por WhatsApp (o por correo).
--   2) cuenta_codigos: los códigos de entrada. Solo se guarda su huella; caducan en minutos y se queman a los 5 intentos.
--   3) cuenta_sesiones: dispositivos con la cuenta abierta (máximo 2, como las guías). Solo se guarda la huella del pase.
--   4) cuenta_saldo_movimientos: el LIBRO del saldo de guías. Cada +3 (compra de un paquete), cada −1 (guía creada) y
--      cada +1 (devolución porque la guía falló) queda anotado con su fecha, su compra y su guía. El saldo que ve la
--      familia es la suma del libro, así que siempre cuadra y nunca se pierde una guía pagada.
--   5) compras.producto ('guia' por omisión, 'paquete3' para el paquete) y compras.cuenta_id.
--   6) Ajustes: sparked_paquete3 ('no' = apagado), sparked_paquete3_precio (199) y sparked_paquete3_dias (90).
--   7) pruebas_usadas y cuentas.prueba_gratis_usada_en: lo necesario para la regla ya aprobada de la suscripción futura
--      (una sola prueba gratis por WhatsApp y por tarjeta). Hoy nada las usa: la suscripción todavía no se construye.
--
-- Cómo se lleva el saldo:
--   · Un ABONO es un movimiento con cambio > 0 (compra de un paquete, devolución o ajuste a favor). Cada abono es un
--     «lote» con su fecha de vencimiento (vence_en): 90 días desde la compra.
--   · Un DESCUENTO es un movimiento con cambio < 0 y dice de qué lote sale (lote_id). Siempre se gasta primero el lote
--     que vence antes.
--   · Lo que queda de un lote = su abono + la suma de sus descuentos. Saldo vigente = lo que queda en los lotes que no
--     han vencido. Lo que queda en lotes vencidos son guías que vencieron sin usarse.
--   · Una devolución es un abono nuevo (+1) que apunta al descuento que devuelve (revierte_id) y hereda el vencimiento
--     de su lote (con un mínimo de 24 horas, para que nadie pierda una guía porque la nuestra falló el último día).
--
-- La función "sparked" 2026-11-17.5 (la desplegada antes de este cambio) funciona igual con esta migración aplicada.

-- ---------- 1) Cuentas ----------
create table if not exists public.cuentas (
  id                      uuid primary key default gen_random_uuid(),
  telefono                text not null unique,              -- WhatsApp en formato internacional: "+52" y 10 dígitos
  correo                  text,                              -- correo de respaldo (para el código si WhatsApp falla)
  nombre                  text,
  telefono_verificado_en  timestamptz,                       -- cuándo se comprobó el número con un código por WhatsApp
  correo_verificado_en    timestamptz,                       -- cuándo se comprobó el correo con un código
  de_prueba               boolean not null default false,    -- cuenta de las pruebas automáticas (no es de una familia)
  prueba_gratis_usada_en  timestamptz,                       -- suscripción futura: este WhatsApp ya usó su prueba gratis
  creada_en               timestamptz not null default now(),
  ultimo_acceso_en        timestamptz
);
comment on table public.cuentas is 'SparkEd: una cuenta por número de WhatsApp. Dentro vive el saldo de guías (paquetes) y, más adelante, la suscripción.';

-- ---------- 2) Códigos de entrada ----------
create table if not exists public.cuenta_codigos (
  id             bigint generated always as identity primary key,
  telefono       text not null,
  canal          text not null check (canal in ('whatsapp', 'correo')),
  codigo_sha256  text not null,                              -- huella del código; el código nunca se guarda
  correo         text,                                       -- correo escrito al pedir el código (cuenta nueva o respaldo nuevo)
  nombre         text,
  envio          text,                                       -- enviado | fallido | sin_motor | sin_whatsapp | simulado…
  origen         text,                                       -- huella de la conexión (no se guarda la dirección)
  expira_en      timestamptz not null,
  intentos       integer not null default 0,
  usado_en       timestamptz,
  creado_en      timestamptz not null default now()
);
create index if not exists cuenta_codigos_telefono on public.cuenta_codigos (telefono, creado_en desc);
create index if not exists cuenta_codigos_origen on public.cuenta_codigos (origen, creado_en desc);
create index if not exists cuenta_codigos_creado on public.cuenta_codigos (creado_en desc);
comment on table public.cuenta_codigos is 'SparkEd: códigos de 6 dígitos para entrar a una cuenta. Solo la huella; caducan en minutos.';

-- ---------- 3) Sesiones (dispositivos con la cuenta abierta) ----------
create table if not exists public.cuenta_sesiones (
  id             uuid primary key default gen_random_uuid(),
  cuenta_id      uuid not null references public.cuentas(id) on delete cascade,
  token_sha256   text not null unique,                       -- huella del pase que vive en el navegador
  canal          text,                                       -- cómo se comprobó: whatsapp | correo
  dispositivo    text,                                       -- nombre corto ("iPhone", "Computadora con Windows")
  origen         text,                                       -- huella de la conexión
  creada_en      timestamptz not null default now(),
  ultimo_uso_en  timestamptz not null default now(),
  expira_en      timestamptz not null,
  cerrada_en     timestamptz
);
create index if not exists cuenta_sesiones_abiertas on public.cuenta_sesiones (cuenta_id) where cerrada_en is null;
comment on table public.cuenta_sesiones is 'SparkEd: dispositivos con una cuenta abierta (máximo 2 por cuenta). Solo la huella del pase.';

-- ---------- 4) Libro del saldo de guías ----------
create table if not exists public.cuenta_saldo_movimientos (
  id           bigint generated always as identity primary key,
  cuenta_id    uuid not null references public.cuentas(id) on delete restrict,
  cambio       integer not null check (cambio <> 0),         -- +3 compra · −1 guía · +1 devolución · ±n ajuste
  motivo       text not null check (motivo in ('compra', 'guia', 'devolucion', 'ajuste')),
  compra_id    uuid references public.compras(id) on delete set null,  -- compra: el paquete pagado · guia y devolucion: la compra (sin cobro) de esa guía
  guia_id      uuid references public.guias(id) on delete set null,
  lote_id      bigint references public.cuenta_saldo_movimientos(id),  -- en un descuento: de qué abono sale
  revierte_id  bigint references public.cuenta_saldo_movimientos(id),  -- en una devolución: qué descuento devuelve
  vence_en     timestamptz,                                  -- en un abono: hasta cuándo se pueden usar esas guías
  de_prueba    boolean not null default false,               -- movimiento de las pruebas automáticas (no es de una familia)
  nota         text,
  creado_en    timestamptz not null default now(),
  constraint cuenta_saldo_forma check ((cambio > 0 and lote_id is null and vence_en is not null) or (cambio < 0 and lote_id is not null))
);
-- Un solo abono por paquete pagado: si el aviso de Mercado Pago llega repetido, el segundo no suma nada.
create unique index if not exists cuenta_saldo_un_abono_por_compra on public.cuenta_saldo_movimientos (compra_id) where motivo = 'compra';
-- Una sola devolución por guía descontada.
create unique index if not exists cuenta_saldo_una_devolucion on public.cuenta_saldo_movimientos (revierte_id) where revierte_id is not null;
create index if not exists cuenta_saldo_cuenta on public.cuenta_saldo_movimientos (cuenta_id, creado_en desc);
create index if not exists cuenta_saldo_lote on public.cuenta_saldo_movimientos (lote_id) where lote_id is not null;
create index if not exists cuenta_saldo_compra on public.cuenta_saldo_movimientos (compra_id) where compra_id is not null;
comment on table public.cuenta_saldo_movimientos is 'SparkEd: libro del saldo de guías de cada cuenta (abonos con vencimiento y descuentos por lote). El saldo es la suma del libro.';

-- ---------- 5) Compras: qué se compró y de qué cuenta ----------
alter table public.compras
  add column if not exists producto  text not null default 'guia',
  add column if not exists cuenta_id uuid references public.cuentas(id) on delete set null;
comment on column public.compras.producto is 'Qué se compró: guia (una guía; las de antes del 24 nov 2026 quedan así) o paquete3 (saldo de 3 guías)';
comment on column public.compras.cuenta_id is 'Cuenta de SparkEd a la que pertenece: el paquete que compró o la guía que hizo con su saldo (metodo_pago = saldo)';
create index if not exists compras_cuenta on public.compras (cuenta_id) where cuenta_id is not null;

-- ---------- 6) Ajustes del paquete (apagado hasta que Daniel lo encienda) ----------
insert into public.config (clave, valor) values
  ('sparked_paquete3', 'no'),
  ('sparked_paquete3_precio', '199'),
  ('sparked_paquete3_dias', '90')
on conflict (clave) do nothing;

-- ---------- 7) Prueba gratis de la suscripción futura: una por WhatsApp y una por tarjeta ----------
create table if not exists public.pruebas_usadas (
  id              bigint generated always as identity primary key,
  cuenta_id       uuid references public.cuentas(id) on delete set null,
  telefono        text,                                      -- WhatsApp que ya usó su prueba gratis
  huella_tarjeta  text,                                      -- huella de la tarjeta que ya usó una prueba gratis
  usada_en        timestamptz not null default now()
);
create unique index if not exists pruebas_usadas_telefono on public.pruebas_usadas (telefono) where telefono is not null;
create unique index if not exists pruebas_usadas_tarjeta on public.pruebas_usadas (huella_tarjeta) where huella_tarjeta is not null;
comment on table public.pruebas_usadas is 'SparkEd (suscripción futura, todavía sin usar): quién ya gastó su prueba gratis. Una por WhatsApp y una por tarjeta.';

-- ---------- Funciones del saldo (pasos atómicos) ----------
-- Los lotes de una cuenta y lo que queda de cada uno.
create or replace function public.sparked_lotes_de_saldo(p_cuenta uuid)
returns table (lote bigint, motivo text, abono integer, quedan integer, vence timestamptz, de_prueba boolean, creado timestamptz, compra uuid)
language sql
stable
set search_path = public
as $$
  select l.id, l.motivo, l.cambio,
         (l.cambio + coalesce((select sum(d.cambio) from public.cuenta_saldo_movimientos d where d.lote_id = l.id), 0))::integer,
         l.vence_en, l.de_prueba, l.creado_en, l.compra_id
    from public.cuenta_saldo_movimientos l
   where l.cuenta_id = p_cuenta and l.cambio > 0 and l.lote_id is null
   order by l.vence_en, l.id;
$$;

-- Gasta UNA guía del saldo vigente. Paso atómico: bloquea la cuenta mientras descuenta, así dos pestañas (o dos
-- dispositivos) a la vez no pueden gastar la misma guía y el saldo nunca queda negativo. Sin saldo vigente no devuelve
-- ninguna fila. Gasta primero el lote que vence antes.
create or replace function public.sparked_usar_guia_de_saldo(p_cuenta uuid, p_compra uuid default null, p_guia uuid default null, p_nota text default null)
returns table (res_movimiento bigint, res_lote bigint, res_vence timestamptz, res_quedan integer)
language plpgsql
set search_path = public
as $$
declare
  v_lote bigint; v_vence timestamptz; v_prueba boolean; v_mov bigint;
begin
  perform 1 from public.cuentas c where c.id = p_cuenta for update;
  if not found then return; end if;
  select l.lote, l.vence, l.de_prueba into v_lote, v_vence, v_prueba
    from public.sparked_lotes_de_saldo(p_cuenta) l
   where l.quedan > 0 and l.vence > now()
   order by l.vence asc, l.lote asc
   limit 1;
  if v_lote is null then return; end if;
  insert into public.cuenta_saldo_movimientos (cuenta_id, cambio, motivo, compra_id, guia_id, lote_id, de_prueba, nota)
  values (p_cuenta, -1, 'guia', p_compra, p_guia, v_lote, coalesce(v_prueba, false), p_nota)
  returning id into v_mov;
  return query
    select v_mov, v_lote, v_vence,
           coalesce((select sum(l2.quedan) from public.sparked_lotes_de_saldo(p_cuenta) l2 where l2.quedan > 0 and l2.vence > now()), 0)::integer;
end;
$$;

-- Devuelve la guía de un descuento (la guía falló o las fotos no sirvieron). Una sola vez por descuento: si ya se había
-- devuelto no devuelve ninguna fila. La guía devuelta conserva el vencimiento de su lote, con un mínimo de horas de gracia.
create or replace function public.sparked_devolver_guia_de_saldo(p_movimiento bigint, p_nota text default null, p_gracia_horas integer default 24)
returns table (res_movimiento bigint, res_cuenta uuid, res_vence timestamptz, res_quedan integer)
language plpgsql
set search_path = public
as $$
declare
  v_cuenta uuid; v_cambio integer; v_compra uuid; v_guia uuid; v_lote bigint; v_prueba boolean; v_vence timestamptz; v_id bigint;
begin
  select m.cuenta_id, m.cambio, m.compra_id, m.guia_id, m.lote_id, m.de_prueba
    into v_cuenta, v_cambio, v_compra, v_guia, v_lote, v_prueba
    from public.cuenta_saldo_movimientos m
   where m.id = p_movimiento and m.motivo = 'guia' and m.cambio < 0;
  if v_cuenta is null then return; end if;
  perform 1 from public.cuentas c where c.id = v_cuenta for update;
  select greatest(l.vence_en, now() + make_interval(hours => greatest(0, coalesce(p_gracia_horas, 24)))) into v_vence
    from public.cuenta_saldo_movimientos l where l.id = v_lote;
  v_vence := coalesce(v_vence, now() + interval '24 hours');
  insert into public.cuenta_saldo_movimientos (cuenta_id, cambio, motivo, compra_id, guia_id, revierte_id, vence_en, de_prueba, nota)
  values (v_cuenta, -v_cambio, 'devolucion', v_compra, v_guia, p_movimiento, v_vence, coalesce(v_prueba, false), p_nota)
  on conflict (revierte_id) where revierte_id is not null do nothing
  returning id into v_id;
  if v_id is null then return; end if;
  return query
    select v_id, v_cuenta, v_vence,
           coalesce((select sum(l2.quedan) from public.sparked_lotes_de_saldo(v_cuenta) l2 where l2.quedan > 0 and l2.vence > now()), 0)::integer;
end;
$$;

-- Abona guías a una cuenta: 'compra' (paquete pagado; una sola vez por compra) o 'ajuste' (Daniel suma a mano o una
-- prueba automática). Si ese paquete ya se había abonado no devuelve ninguna fila.
create or replace function public.sparked_abonar_saldo(p_cuenta uuid, p_guias integer, p_motivo text, p_dias integer, p_compra uuid default null, p_de_prueba boolean default false, p_nota text default null)
returns table (res_movimiento bigint, res_vence timestamptz, res_quedan integer)
language plpgsql
set search_path = public
as $$
declare
  v_id bigint; v_vence timestamptz;
begin
  if p_guias is null or p_guias <= 0 or p_guias > 100 or p_motivo not in ('compra', 'ajuste') then return; end if;
  if p_motivo = 'compra' and p_compra is null then return; end if;
  perform 1 from public.cuentas c where c.id = p_cuenta for update;
  if not found then return; end if;
  v_vence := now() + make_interval(days => greatest(0, coalesce(p_dias, 90)));
  insert into public.cuenta_saldo_movimientos (cuenta_id, cambio, motivo, compra_id, vence_en, de_prueba, nota)
  values (p_cuenta, p_guias, p_motivo, p_compra, v_vence, coalesce(p_de_prueba, false), p_nota)
  on conflict (compra_id) where motivo = 'compra' do nothing
  returning id into v_id;
  if v_id is null then return; end if;
  return query
    select v_id, v_vence,
           coalesce((select sum(l2.quedan) from public.sparked_lotes_de_saldo(p_cuenta) l2 where l2.quedan > 0 and l2.vence > now()), 0)::integer;
end;
$$;

-- Quita guías del saldo vigente (ajuste de Daniel). Nunca deja el saldo negativo: quita lo que haya, empezando por lo
-- que vence antes, y dice cuántas quitó.
create or replace function public.sparked_quitar_saldo(p_cuenta uuid, p_guias integer, p_nota text default null)
returns table (res_quitadas integer, res_quedan integer)
language plpgsql
set search_path = public
as $$
declare
  v record; v_faltan integer; v_toma integer; v_quitadas integer := 0;
begin
  if p_guias is null or p_guias <= 0 then return; end if;
  perform 1 from public.cuentas c where c.id = p_cuenta for update;
  if not found then return; end if;
  v_faltan := p_guias;
  for v in select l.lote, l.quedan, l.de_prueba from public.sparked_lotes_de_saldo(p_cuenta) l where l.quedan > 0 and l.vence > now() order by l.vence asc, l.lote asc loop
    exit when v_faltan <= 0;
    v_toma := least(v.quedan, v_faltan);
    insert into public.cuenta_saldo_movimientos (cuenta_id, cambio, motivo, lote_id, de_prueba, nota)
    values (p_cuenta, -v_toma, 'ajuste', v.lote, coalesce(v.de_prueba, false), p_nota);
    v_faltan := v_faltan - v_toma; v_quitadas := v_quitadas + v_toma;
  end loop;
  return query
    select v_quitadas,
           coalesce((select sum(l2.quedan) from public.sparked_lotes_de_saldo(p_cuenta) l2 where l2.quedan > 0 and l2.vence > now()), 0)::integer;
end;
$$;

-- ---------- Funciones de entrada (códigos y sesiones) ----------
-- Revisa un código SIN gastarlo. 'ok' = coincide con un código vigente de ese número; 'mal' = no coincide (se cuenta
-- el intento en todos los códigos vigentes de ese número: a los p_max_intentos se queman); 'sin_codigo' = no hay
-- ningún código vigente. Un candado por número evita que dos intentos a la vez se cuenten como uno.
create or replace function public.sparked_revisar_codigo(p_telefono text, p_codigo_sha256 text, p_max_intentos integer default 5)
returns table (res_estado text, res_codigo bigint, res_canal text, res_correo text, res_nombre text)
language plpgsql
set search_path = public
as $$
declare
  v_id bigint; v_canal text; v_correo text; v_nombre text; n integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('sparked_cuenta_codigo:' || p_telefono, 0));
  select c.id, c.canal, c.correo, c.nombre into v_id, v_canal, v_correo, v_nombre
    from public.cuenta_codigos c
   where c.telefono = p_telefono and c.usado_en is null and c.expira_en > now()
     and c.intentos < p_max_intentos and c.codigo_sha256 = p_codigo_sha256
   order by c.creado_en desc
   limit 1;
  if v_id is not null then
    return query select 'ok'::text, v_id, v_canal, v_correo, v_nombre;
    return;
  end if;
  update public.cuenta_codigos c set intentos = c.intentos + 1
   where c.telefono = p_telefono and c.usado_en is null and c.expira_en > now() and c.intentos < p_max_intentos;
  get diagnostics n = row_count;
  return query select (case when n > 0 then 'mal' else 'sin_codigo' end)::text, null::bigint, null::text, null::text, null::text;
end;
$$;

-- Abre una sesión en un dispositivo. Paso atómico (bloquea la cuenta): gasta el código (una sola vez) y respeta el
-- máximo de dispositivos. Con el máximo ya abierto responde 'limite' sin gastar el código, salvo que se pida cerrar la
-- sesión más antigua (p_cerrar_antigua). 'codigo_usado' = otra petición ya gastó ese código.
create or replace function public.sparked_abrir_sesion(p_cuenta uuid, p_codigo bigint, p_token_sha256 text, p_canal text, p_dispositivo text, p_origen text, p_dias integer default 60, p_max integer default 2, p_cerrar_antigua boolean default false)
returns table (res_estado text, res_sesion uuid, res_abiertas integer, res_cerradas integer)
language plpgsql
set search_path = public
as $$
declare
  v_tel text; n integer; v_usado bigint; v_sesion uuid; v_cerradas integer := 0;
begin
  select c.telefono into v_tel from public.cuentas c where c.id = p_cuenta for update;
  if v_tel is null then
    return query select 'sin_cuenta'::text, null::uuid, 0, 0;
    return;
  end if;
  select count(*)::integer into n from public.cuenta_sesiones s where s.cuenta_id = p_cuenta and s.cerrada_en is null and s.expira_en > now();
  if n >= p_max and not coalesce(p_cerrar_antigua, false) then
    return query select 'limite'::text, null::uuid, n, 0;
    return;
  end if;
  if p_codigo is not null then
    update public.cuenta_codigos c set usado_en = now()
     where c.id = p_codigo and c.telefono = v_tel and c.usado_en is null and c.expira_en > now()
    returning c.id into v_usado;
    if v_usado is null then
      return query select 'codigo_usado'::text, null::uuid, n, 0;
      return;
    end if;
    -- Los demás códigos vigentes de ese número dejan de servir.
    update public.cuenta_codigos c set usado_en = now() where c.telefono = v_tel and c.usado_en is null;
  end if;
  if n >= p_max then
    with viejas as (
      select s.id from public.cuenta_sesiones s
       where s.cuenta_id = p_cuenta and s.cerrada_en is null and s.expira_en > now()
       order by s.ultimo_uso_en asc, s.creada_en asc
       limit (n - p_max + 1)
    )
    update public.cuenta_sesiones s set cerrada_en = now() from viejas where s.id = viejas.id;
    get diagnostics v_cerradas = row_count;
  end if;
  insert into public.cuenta_sesiones (cuenta_id, token_sha256, canal, dispositivo, origen, expira_en)
  values (p_cuenta, p_token_sha256, p_canal, left(coalesce(p_dispositivo, ''), 80), p_origen, now() + make_interval(days => greatest(1, coalesce(p_dias, 60))))
  returning id into v_sesion;
  update public.cuentas c set ultimo_acceso_en = now() where c.id = p_cuenta;
  return query select 'ok'::text, v_sesion, (n - v_cerradas + 1), v_cerradas;
end;
$$;

-- Nadie entra directo a estas tablas ni a estas funciones: todo pasa por la función "sparked" con la llave de servicio.
do $$
declare t text;
begin
  foreach t in array array['cuentas', 'cuenta_codigos', 'cuenta_sesiones', 'cuenta_saldo_movimientos', 'pruebas_usadas'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

revoke execute on function public.sparked_lotes_de_saldo(uuid) from public, anon, authenticated;
revoke execute on function public.sparked_usar_guia_de_saldo(uuid, uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.sparked_devolver_guia_de_saldo(bigint, text, integer) from public, anon, authenticated;
revoke execute on function public.sparked_abonar_saldo(uuid, integer, text, integer, uuid, boolean, text) from public, anon, authenticated;
revoke execute on function public.sparked_quitar_saldo(uuid, integer, text) from public, anon, authenticated;
revoke execute on function public.sparked_revisar_codigo(text, text, integer) from public, anon, authenticated;
revoke execute on function public.sparked_abrir_sesion(uuid, bigint, text, text, text, text, integer, integer, boolean) from public, anon, authenticated;
grant execute on function public.sparked_lotes_de_saldo(uuid) to service_role;
grant execute on function public.sparked_usar_guia_de_saldo(uuid, uuid, uuid, text) to service_role;
grant execute on function public.sparked_devolver_guia_de_saldo(bigint, text, integer) to service_role;
grant execute on function public.sparked_abonar_saldo(uuid, integer, text, integer, uuid, boolean, text) to service_role;
grant execute on function public.sparked_quitar_saldo(uuid, integer, text) to service_role;
grant execute on function public.sparked_revisar_codigo(text, text, integer) to service_role;
grant execute on function public.sparked_abrir_sesion(uuid, bigint, text, text, text, text, integer, integer, boolean) to service_role;
