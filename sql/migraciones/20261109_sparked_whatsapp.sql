-- SparkEd: entrega de guías por WhatsApp (Green API) y comando "compartir". Solo añade; no borra nada.
-- Aplicada en Supabase el 9 nov 2026 como "sparked_whatsapp_entrega".
alter table public.compras add column if not exists wa_estado text, add column if not exists wa_enviado_en timestamptz, add column if not exists wa_detalle text;
create table if not exists public.wa_mensajes (
  id bigint generated always as identity primary key,
  creado_en timestamptz not null default now(),
  direccion text not null check (direccion in ('entrada','salida','interno')),
  tipo text not null,
  chat text,
  compra_id uuid references public.compras(id) on delete set null,
  estado text,
  id_mensaje text,
  detalle text
);
create unique index if not exists wa_mensajes_entrada_unica on public.wa_mensajes (id_mensaje) where direccion = 'entrada' and id_mensaje is not null;
create index if not exists wa_mensajes_chat_fecha on public.wa_mensajes (chat, creado_en desc);
create index if not exists wa_mensajes_fecha on public.wa_mensajes (creado_en desc);
create index if not exists wa_mensajes_id_mensaje on public.wa_mensajes (id_mensaje);
alter table public.wa_mensajes enable row level security;
comment on table public.wa_mensajes is 'Bitácora de WhatsApp (Green API) de SparkEd: entregas, comando compartir, pruebas, avisos. No guarda el texto de los mensajes.';
