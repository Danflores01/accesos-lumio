-- Migración "dispositivos_por_acceso" (aplicada en Supabase el 2026-10-20).
-- Regla de familia: cada link de una clase limitada acepta hasta clases.max_dispositivos aparatos distintos.
-- Compatible hacia atrás: un acceso sin aparatos registrados sigue funcionando igual que antes y empieza a
-- registrar aparatos a partir de ahora; si no llega p_dispositivo (cliente antiguo), no se aplica la regla.

alter table public.clases add column if not exists max_dispositivos int not null default 2;

create table if not exists public.acceso_dispositivos (
  acceso_id          uuid not null references public.accesos(id) on delete cascade,
  dispositivo_sha256 text not null,
  primero_en         timestamptz not null default now(),
  ultimo_en          timestamptz not null default now(),
  ip                 text,
  user_agent         text,
  primary key (acceso_id, dispositivo_sha256)
);
alter table public.acceso_dispositivos enable row level security;
revoke all on public.acceso_dispositivos from anon, authenticated;

-- La vista conserva sus columnas en el mismo orden y agrega tres al final.
create or replace view public.accesos_vista with (security_invoker = true) as
select
  a.id, a.token, a.clase_id, a.alumno, a.telefono, a.nota,
  a.expira_en, a.minutos_tras_apertura, a.max_usos, a.usos,
  a.primer_uso_en, a.ultimo_uso_en, a.revocado, a.creado_en,
  c.nombre as clase, c.url_destino, c.activa as clase_activa,
  public.estado_acceso(a, c.activa, c.libre) as estado,
  a.enviado_en,
  c.libre as clase_libre,
  c.max_dispositivos,
  (select count(*) from public.acceso_dispositivos d where d.acceso_id = a.id)::int as dispositivos,
  (select count(*) from public.eventos e where e.acceso_id = a.id and e.resultado = 'otro_dispositivo')::int as otros_dispositivos
from public.accesos a
join public.clases c on c.id = a.clase_id;

create or replace function public.consumir_acceso(p_token text, p_ip text, p_ua text, p_dispositivo text default null)
returns table (estado text, url text, alumno text, clase text)
language plpgsql set search_path = public as $$
declare
  v_id uuid; v_estado text; v_url text; v_alumno text; v_clase text;
  v_libre boolean; v_max_disp int; v_hash text; v_conocido boolean; v_n int;
begin
  select a.id, public.estado_acceso(a, c.activa, c.libre), c.url_destino, a.alumno, c.nombre, c.libre, c.max_dispositivos
    into v_id, v_estado, v_url, v_alumno, v_clase, v_libre, v_max_disp
  from public.accesos a
  join public.clases c on c.id = a.clase_id
  where a.token = p_token
  for update of a;

  if v_id is null then
    insert into public.eventos (acceso_id, token_intentado, resultado, ip, user_agent)
    values (null, left(p_token, 64), 'inexistente', p_ip, left(p_ua, 300));
    return query select 'inexistente'::text, null::text, null::text, null::text;
    return;
  end if;

  if v_estado in ('pendiente', 'abierto') then
    -- Regla de familia (solo clases limitadas y solo si el cliente manda su secreto de aparato).
    if not coalesce(v_libre, false) and coalesce(p_dispositivo, '') <> '' then
      v_hash := encode(sha256(convert_to(p_dispositivo, 'UTF8')), 'hex');
      select exists (select 1 from public.acceso_dispositivos d where d.acceso_id = v_id and d.dispositivo_sha256 = v_hash)
        into v_conocido;
      if v_conocido then
        update public.acceso_dispositivos
           set ultimo_en = now(), ip = p_ip, user_agent = left(p_ua, 300)
         where acceso_id = v_id and dispositivo_sha256 = v_hash;
      else
        select count(*) into v_n from public.acceso_dispositivos d where d.acceso_id = v_id;
        if v_n >= coalesce(v_max_disp, 2) then
          insert into public.eventos (acceso_id, token_intentado, resultado, ip, user_agent)
          values (v_id, null, 'otro_dispositivo', p_ip, left(p_ua, 300));
          return query select 'otro_dispositivo'::text, null::text, v_alumno, v_clase;
          return;
        end if;
        insert into public.acceso_dispositivos (acceso_id, dispositivo_sha256, ip, user_agent)
        values (v_id, v_hash, p_ip, left(p_ua, 300));
      end if;
    end if;

    update public.accesos
       set usos = usos + 1,
           primer_uso_en = coalesce(primer_uso_en, now()),
           ultimo_uso_en = now()
     where id = v_id;
    v_estado := 'ok';
  end if;

  insert into public.eventos (acceso_id, token_intentado, resultado, ip, user_agent)
  values (v_id, null, v_estado, p_ip, left(p_ua, 300));

  return query select v_estado,
                      case when v_estado = 'ok' then v_url else null end,
                      v_alumno, v_clase;
end $$;

-- La firma vieja de 3 parámetros desaparece: las llamadas con 3 parámetros caen en la nueva (p_dispositivo = null).
drop function if exists public.consumir_acceso(text, text, text);

revoke execute on function public.consumir_acceso(text, text, text, text) from public, anon, authenticated;
