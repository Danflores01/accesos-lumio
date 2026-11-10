-- Entrada al panel con correo y contraseña (10 nov 2026): intentos de entrada, para frenar a quien pruebe contraseñas.
-- Aditiva. No guarda contraseñas ni direcciones: "origen" es una huella de la conexión.
create table if not exists public.acceso_intentos (
  id bigint generated always as identity primary key,
  creado_en timestamptz not null default now(),
  origen text,
  correo text,
  ok boolean not null default false
);
create index if not exists acceso_intentos_creado_en on public.acceso_intentos (creado_en desc);
-- Solo entra la llave de servicio (sin políticas, como el resto de las tablas).
alter table public.acceso_intentos enable row level security;
