-- Migración "valido_hasta_por_clase" (aplicada en Supabase el 2026-10-20).
-- "Válido hasta": hora fija opcional en la que termina una clase. Nulo = comportamiento de siempre
-- (cada link vive vigencia_horas desde que se envía). Compatible hacia atrás.

alter table public.clases add column if not exists valido_hasta timestamptz;

-- Una clase limitada (no libre) cuya hora fija ya pasó cuenta como inactiva: todos sus links quedan
-- en 'clase_inactiva' sin que nadie haga nada. Se consulta la clase desde dentro de la función para no
-- cambiar su firma ni tocar accesos_vista ni consumir_acceso (ambas la llaman con (a, c.activa, c.libre)).
create or replace function public.estado_acceso(a public.accesos, clase_activa boolean, libre boolean default false)
returns text language sql stable set search_path = public as $$
  select case
    when not clase_activa then 'clase_inactiva'
    when (not libre) and exists (
      select 1 from public.clases c
      where c.id = a.clase_id and c.valido_hasta is not null and c.valido_hasta < now()
    ) then 'clase_inactiva'
    when a.revocado then 'revocado'
    when a.enviado_en is null then 'borrador'
    when libre then (case when a.primer_uso_en is not null then 'abierto' else 'pendiente' end)
    when now() > a.expira_en then 'expirado'
    when a.primer_uso_en is not null
         and now() > a.primer_uso_en + make_interval(mins => a.minutos_tras_apertura) then 'cerrado'
    when a.usos >= a.max_usos then 'agotado'
    when a.primer_uso_en is not null then 'abierto'
    else 'pendiente'
  end
$$;

-- No hace falta ninguna función nueva para "enviar hasta hora fija": la función admin actualiza el acceso
-- directamente (enviado_en = ahora, expira_en = valido_hasta) cuando la clase tiene hora fija.
