-- SparkEd: comentarios de la portada y tipos de cambio del DOF (ficha de costos del panel). Solo añade; no borra nada.
-- Aplicada en Supabase el 9 nov 2026 como "sparked_comentarios_y_tipos_cambio". RLS activado y sin políticas: solo entra la llave de servicio.
create table if not exists public.comentarios (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  texto text not null,
  estrellas smallint not null check (estrellas between 1 and 5),
  relacion text check (relacion in ('mama_papa','alumno','docente','otro')),
  permiso_publicar boolean not null default false,
  idioma text check (idioma in ('es','en')),
  estado text not null default 'nuevo' check (estado in ('nuevo','leido','destacado','oculto')),
  ip_hash text,                       -- sha256 de la IP con sal; nunca se guarda la IP
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz
);
create index if not exists comentarios_ip_idx on public.comentarios (ip_hash, creado_en desc);
create index if not exists comentarios_estado_idx on public.comentarios (estado, creado_en desc);
alter table public.comentarios enable row level security;

-- Un renglón por día publicado en el DOF (tipo de cambio para solventar obligaciones denominadas en dólares).
create table if not exists public.tipos_cambio (
  fecha date primary key,             -- fecha de publicación en el DOF
  mxn_por_usd numeric(10,4) not null check (mxn_por_usd > 0),
  fuente text not null,               -- "DOF" (API abierta del DOF) o "Banxico" (API SIE, opcional)
  obtenido_en timestamptz not null default now()
);
alter table public.tipos_cambio enable row level security;
