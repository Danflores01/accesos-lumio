-- SparkEd · códigos de descuento y entrega en dos tiempos (7 nov 2026). No borra nada: solo agrega.
--
-- 1) Códigos que Daniel crea en el panel (para sus pruebas y para regalar accesos):
--    tipo "gratis" = la guía sale sin costo; tipo "porcentaje" = descuento de "valor" % sobre el precio.
-- 2) Registro de cada intento de código (para el tope de 5 intentos fallidos por hora y para revisar abusos).
-- 3) Compras: el código usado, el descuento y cuándo se contó su uso; y cuándo salió el correo de "guía completa".
-- 4) Trabajos: cuándo se avisó a Daniel que el trabajo "resto" de una guía pagada falló (un solo aviso por falla).

create table if not exists public.codigos (
  id         uuid primary key default gen_random_uuid(),
  codigo     text not null unique,                       -- siempre en mayúsculas y sin espacios
  tipo       text not null default 'gratis' check (tipo in ('gratis', 'porcentaje')),
  valor      numeric(5,2) not null default 100 check (valor > 0 and valor <= 100),
  usos_max   integer check (usos_max is null or usos_max > 0), -- vacío = sin límite
  usos       integer not null default 0 check (usos >= 0),
  activo     boolean not null default true,
  expira_en  timestamptz,                                -- vacío = no caduca
  nota       text,
  creado_en  timestamptz not null default now()
);

create table if not exists public.codigo_intentos (
  id         bigserial primary key,
  codigo     text,                                       -- lo que escribió la familia (normalizado)
  codigo_id  uuid references public.codigos(id) on delete set null,
  resultado  text not null,                              -- ok | no_existe | apagado | vencido | agotado | bloqueado
  telefono   text,
  correo     text,
  ip         text,
  compra_id  uuid references public.compras(id) on delete set null,
  creado_en  timestamptz not null default now()
);
create index if not exists codigo_intentos_creado_en on public.codigo_intentos (creado_en desc);

alter table public.compras
  add column if not exists codigo          text,
  add column if not exists descuento_mxn   numeric(10,2),
  add column if not exists codigo_usado_en timestamptz,
  add column if not exists correo_lista_en timestamptz;
comment on column public.compras.codigo is 'Código de descuento usado en esta compra (mayúsculas)';
comment on column public.compras.descuento_mxn is 'Pesos que descontó el código (precio de lista menos lo cobrado)';
comment on column public.compras.codigo_usado_en is 'Cuándo se sumó el uso del código (una sola vez por compra)';
comment on column public.compras.correo_lista_en is 'Cuándo se mandó el correo de "tu guía completa está lista" (una sola vez)';

alter table public.trabajos add column if not exists aviso_error_en timestamptz;
comment on column public.trabajos.aviso_error_en is 'Cuándo se avisó a Daniel que este trabajo falló (se limpia al reintentar)';

-- Suma (o devuelve) un uso de forma atómica. Sin p_forzar solo suma si el código sigue activo, no caducó y tiene usos
-- libres: así dos familias no pueden gastar al mismo tiempo el último uso de un código gratis.
create or replace function public.sparked_usar_codigo(p_codigo text, p_forzar boolean default false, p_delta integer default 1)
returns setof public.codigos
language sql
as $$
  update public.codigos
     set usos = greatest(0, usos + p_delta)
   where codigo = p_codigo
     and (p_forzar or p_delta < 0 or (activo and (expira_en is null or expira_en > now()) and (usos_max is null or usos < usos_max)))
  returning *;
$$;

-- Nadie entra directo a estas tablas ni a la función: todo pasa por la función "sparked" con la llave de servicio.
alter table public.codigos enable row level security;
alter table public.codigo_intentos enable row level security;
revoke all on public.codigos from anon, authenticated;
revoke all on public.codigo_intentos from anon, authenticated;
revoke execute on function public.sparked_usar_codigo(text, boolean, integer) from public, anon, authenticated;
grant execute on function public.sparked_usar_codigo(text, boolean, integer) to service_role;
