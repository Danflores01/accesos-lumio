-- Esquema completo del proyecto Supabase "accesos-lumio" (respaldo de las migraciones aplicadas).
-- Para recrearlo en un proyecto nuevo: pegar todo en el SQL Editor y ejecutar.
-- Después: insertar el hash SHA-256 de la clave de administrador en public.config (clave 'admin_key_sha256').

create extension if not exists pgcrypto;

create table public.clases (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  url_destino text not null,
  activa      boolean not null default true,
  creada_en   timestamptz not null default now()
);

create table public.accesos (
  id                     uuid primary key default gen_random_uuid(),
  token                  text not null unique,
  clase_id               uuid not null references public.clases(id) on delete cascade,
  alumno                 text not null,
  telefono               text,
  nota                   text,
  expira_en              timestamptz not null,
  minutos_tras_apertura  int not null default 5,
  max_usos               int not null default 3,
  usos                   int not null default 0,
  primer_uso_en          timestamptz,
  ultimo_uso_en          timestamptz,
  revocado               boolean not null default false,
  creado_en              timestamptz not null default now(),
  enviado_en             timestamptz default now()   -- nulo = borrador (todavía no vive)
);

create table public.eventos (
  id              bigint generated always as identity primary key,
  acceso_id       uuid references public.accesos(id) on delete cascade,
  token_intentado text,
  resultado       text not null,
  ip              text,
  user_agent      text,
  creado_en       timestamptz not null default now()
);

create table public.config (
  clave text primary key,
  valor text not null
);

create index accesos_clase_idx on public.accesos (clase_id, creado_en desc);
create index eventos_acceso_idx on public.eventos (acceso_id, creado_en desc);
create index eventos_fecha_idx on public.eventos (creado_en desc);

alter table public.clases  enable row level security;
alter table public.accesos enable row level security;
alter table public.eventos enable row level security;
alter table public.config  enable row level security;

create or replace function public.estado_acceso(a public.accesos, clase_activa boolean)
returns text language sql stable set search_path = public as $$
  select case
    when not clase_activa then 'clase_inactiva'
    when a.revocado then 'revocado'
    when a.enviado_en is null then 'borrador'
    when now() > a.expira_en then 'expirado'
    when a.primer_uso_en is not null
         and now() > a.primer_uso_en + make_interval(mins => a.minutos_tras_apertura) then 'cerrado'
    when a.usos >= a.max_usos then 'agotado'
    when a.primer_uso_en is not null then 'abierto'
    else 'pendiente'
  end
$$;

create or replace view public.accesos_vista with (security_invoker = true) as
select
  a.id, a.token, a.clase_id, a.alumno, a.telefono, a.nota,
  a.expira_en, a.minutos_tras_apertura, a.max_usos, a.usos,
  a.primer_uso_en, a.ultimo_uso_en, a.revocado, a.creado_en,
  c.nombre as clase, c.url_destino, c.activa as clase_activa,
  public.estado_acceso(a, c.activa) as estado,
  a.enviado_en
from public.accesos a
join public.clases c on c.id = a.clase_id;

create or replace function public.consultar_acceso(p_token text)
returns table (estado text, alumno text, clase text)
language sql stable set search_path = public as $$
  select v.estado, v.alumno, v.clase from public.accesos_vista v where v.token = p_token
$$;

create or replace function public.consumir_acceso(p_token text, p_ip text, p_ua text)
returns table (estado text, url text, alumno text, clase text)
language plpgsql set search_path = public as $$
declare
  v_id uuid; v_estado text; v_url text; v_alumno text; v_clase text;
begin
  select a.id, public.estado_acceso(a, c.activa), c.url_destino, a.alumno, c.nombre
    into v_id, v_estado, v_url, v_alumno, v_clase
  from public.accesos a join public.clases c on c.id = a.clase_id
  where a.token = p_token
  for update of a;

  if v_id is null then
    insert into public.eventos (acceso_id, token_intentado, resultado, ip, user_agent)
    values (null, left(p_token, 64), 'inexistente', p_ip, left(p_ua, 300));
    return query select 'inexistente'::text, null::text, null::text, null::text;
    return;
  end if;

  if v_estado in ('pendiente', 'abierto') then
    update public.accesos
       set usos = usos + 1, primer_uso_en = coalesce(primer_uso_en, now()), ultimo_uso_en = now()
     where id = v_id;
    v_estado := 'ok';
  end if;

  insert into public.eventos (acceso_id, token_intentado, resultado, ip, user_agent)
  values (v_id, null, v_estado, p_ip, left(p_ua, 300));

  return query select v_estado, case when v_estado = 'ok' then v_url else null end, v_alumno, v_clase;
end $$;

create or replace function public.enviar_acceso(p_id uuid, p_vigencia_horas numeric)
returns setof public.accesos language sql set search_path = public as $$
  update public.accesos
     set enviado_en = now(),
         expira_en = now() + make_interval(mins => greatest(1, round(p_vigencia_horas * 60))::int)
   where id = p_id and enviado_en is null
  returning *;
$$;

revoke all on public.accesos_vista from anon, authenticated;
revoke execute on function public.estado_acceso(public.accesos, boolean) from public, anon, authenticated;
revoke execute on function public.consultar_acceso(text) from public, anon, authenticated;
revoke execute on function public.consumir_acceso(text, text, text) from public, anon, authenticated;
revoke execute on function public.enviar_acceso(uuid, numeric) from public, anon, authenticated;
