-- Migración "sparked_fase2" (aplicada en Supabase el 2026-11-06).
-- Fase 2 de SparkEd: biblioteca de guías, guías personalizadas, trabajos de generación, compras y progreso.
-- TODO ES ADITIVO: no cambia accesos, acceso_dispositivos, eventos, consumir_acceso, estado_acceso ni la vista
-- accesos_vista. Los links activos de Lumio siguen funcionando igual.
--
-- Cómo conviven las guías con los accesos de siempre: cada guía publicada tiene una "clase" propia
-- (clases.tipo = 'guia') y cada compra crea un acceso normal dentro de esa clase, con 7 días de vigencia
-- y 2 aparatos. Así el panel, Renovar, los estados y la regla de familia funcionan sin tocar nada.

-- ---------- Colegios (clasificación por colegio y grado, fase 1) ----------
create table if not exists public.colegios (
  id        uuid primary key default gen_random_uuid(),
  nombre    text not null unique,
  activo    boolean not null default true,
  orden     int not null default 0,
  creado_en timestamptz not null default now()
);
insert into public.colegios (nombre, orden) values
  ('Colegio Cumbres', 1), ('Colegio Green Oaks', 2), ('Colegio Regina', 3)
on conflict (nombre) do nothing;

alter table public.clases add column if not exists colegio_id uuid references public.colegios(id);
alter table public.clases add column if not exists grado text;
alter table public.clases add column if not exists materia text;
-- 'lumio' = clase de siempre con link a Lumio · 'guia' = clase que abre una guía de SparkEd
alter table public.clases add column if not exists tipo text not null default 'lumio';

-- ---------- Guías (el cartucho y su estado) ----------
create table if not exists public.guias (
  id            uuid primary key default gen_random_uuid(),
  estado        text not null default 'borrador',      -- borrador | publicada | archivada
  origen        text not null default 'biblioteca',    -- biblioteca | personalizada
  titulo        text,
  colegio_id    uuid references public.colegios(id),
  grado         text,
  materia       text,
  examen        text,
  fecha_examen  date,
  idioma        text,
  perfil_edad   text,
  paleta        text,
  cartucho      jsonb,                                  -- la guía completa (solo la entrega el servidor con clave y aparato)
  vista_previa  jsonb,                                  -- las 3 slides gratis
  reporte       jsonb,                                  -- verificación: citas, correcciones, temas completados, costos
  version       int not null default 1,
  clase_id      uuid references public.clases(id),
  borrador_id   uuid,
  costo_mxn     numeric(10,2) not null default 0,
  creada_en     timestamptz not null default now(),
  publicada_en  timestamptz,
  archivada_en  timestamptz,
  borrar_en     timestamptz                             -- guías personalizadas: 7 días después del pago
);
create index if not exists guias_publicadas_idx on public.guias (colegio_id, grado, materia) where estado = 'publicada';

-- ---------- Borradores (Servicio 2: lo que sube el cliente antes de pagar; se borran a las 24 h) ----------
create table if not exists public.borradores (
  id             uuid primary key default gen_random_uuid(),
  clave          text not null unique,                  -- clave al azar; vive en el navegador del cliente
  servicio       int not null default 2,
  colegio_id     uuid references public.colegios(id),
  colegio_texto  text,
  grado          text,
  materia        text,
  paginas        int not null default 0,
  archivos       jsonb not null default '[]'::jsonb,    -- [{ruta, nombre, tipo, tamano}] en el bucket "materiales"
  estado         text not null default 'subiendo',      -- subiendo | generando | vista_previa | pagado | listo | fallido | expirado
  trabajo_id     uuid,
  guia_id        uuid references public.guias(id),
  nombre         text,                                  -- solo se llenan al oprimir Pagar
  telefono       text,
  correo         text,
  stripe_session_id text,
  creado_en      timestamptz not null default now(),
  expira_en      timestamptz not null default now() + interval '24 hours',
  pagado_en      timestamptz
);

-- ---------- Trabajos (la cadena de generación, un paso por ejecución) ----------
create table if not exists public.trabajos (
  id             uuid primary key default gen_random_uuid(),
  tipo           text not null default 'generar',
  borrador_id    uuid references public.borradores(id) on delete cascade,
  guia_id        uuid references public.guias(id) on delete cascade,
  alcance        text not null default 'completa',      -- vista_previa | completa | resto
  paso           text not null default 'inicio',
  estado         text not null default 'pendiente',     -- pendiente | corriendo | listo | error
  progreso       jsonb not null default '{}'::jsonb,    -- {paso, indice, total, mensaje}
  datos          jsonb not null default '{}'::jsonb,    -- inventarios, plan, bloques, verificación
  error          text,
  intentos       int not null default 0,
  costo_usd      numeric(10,5) not null default 0,
  tokens_entrada bigint not null default 0,
  tokens_salida  bigint not null default 0,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

-- ---------- Solicitudes sin guía (Servicio 1: lista de demanda para Daniel) ----------
create table if not exists public.solicitudes (
  id             uuid primary key default gen_random_uuid(),
  colegio_id     uuid references public.colegios(id),
  colegio_texto  text,
  grado          text,
  materia        text,
  nombre         text,
  telefono       text,
  correo         text,
  estado         text not null default 'sin_guia',      -- sin_guia | avisada | convertida
  guia_id        uuid references public.guias(id),
  creada_en      timestamptz not null default now()
);

-- ---------- Compras (ficha que sobrevive a la guía, para cuentas y estadísticas) ----------
create table if not exists public.compras (
  id                uuid primary key default gen_random_uuid(),
  guia_id           uuid references public.guias(id) on delete set null,
  acceso_id         uuid references public.accesos(id) on delete set null,
  borrador_id       uuid references public.borradores(id) on delete set null,
  stripe_session_id text unique,
  monto_mxn         numeric(10,2),
  moneda            text not null default 'mxn',
  estado            text not null default 'pendiente',  -- pendiente | pagada | reembolsada | fallida
  nombre            text,
  telefono          text,
  correo            text,
  colegio_texto     text,
  grado             text,
  materia           text,
  titulo            text,
  creada_en         timestamptz not null default now(),
  pagada_en         timestamptz
);

-- ---------- Progreso del alumno (por link y por aparato; se reanuda donde se quedó) ----------
create table if not exists public.progreso (
  acceso_id          uuid not null references public.accesos(id) on delete cascade,
  dispositivo_sha256 text not null,
  datos              jsonb not null default '{}'::jsonb,
  actualizado_en     timestamptz not null default now(),
  primary key (acceso_id, dispositivo_sha256)
);

-- ---------- Reportes de error desde el reproductor ----------
create table if not exists public.reportes (
  id         uuid primary key default gen_random_uuid(),
  acceso_id  uuid references public.accesos(id) on delete set null,
  guia_id    uuid references public.guias(id) on delete set null,
  slide      int,
  comentario text,
  estado     text not null default 'nuevo',             -- nuevo | revisado
  creado_en  timestamptz not null default now()
);

-- ---------- Datos curiosos de la pantalla de carga (sin IA en vivo) ----------
create table if not exists public.datos_curiosos (
  id        serial primary key,
  texto     text not null,
  nivel     text not null,                              -- peques | primaria | secundaria | prepa
  categoria text not null,
  emoji     text,
  fuente    text,
  estado    text not null default 'publicado',          -- borrador | publicado | apagado
  creado_en timestamptz not null default now()
);

-- Nadie entra directo a estas tablas: todo pasa por la función "sparked" con la llave de servicio.
do $$
declare t text;
begin
  foreach t in array array['colegios','guias','borradores','trabajos','solicitudes','compras','progreso','reportes','datos_curiosos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- Bucket privado para los materiales que suben los clientes y Daniel.
insert into storage.buckets (id, name, public)
values ('materiales', 'materiales', false)
on conflict (id) do nothing;
