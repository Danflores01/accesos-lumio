-- SparkEd · borrar códigos de descuento desde el panel (10 nov 2026). Solo agrega; no borra nada.
--
-- «Borrar» en el panel es un borrado suave: la fila se queda (para no perder el historial de intentos y de compras que
-- usaron el código), pero el código queda apagado (activo = false) y con la fecha en borrado_en. Con borrado_en lleno:
-- no aparece en la lista del panel, no se puede volver a encender y, si alguien lo escribe, cuenta como «borrado».
-- La función sparked_usar_codigo no cambia: ya rechaza los códigos apagados.
-- La función "sparked" 2026-11-10.2 funciona igual antes y después de aplicar este archivo.

alter table public.codigos add column if not exists borrado_en timestamptz;
comment on column public.codigos.borrado_en is 'Cuándo se borró el código en el panel (borrado suave; vacío = no borrado)';
