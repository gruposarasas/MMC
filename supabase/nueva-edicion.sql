-- Preparar la base para una nueva edición del Mundial de Café.
--
-- NO se corre sola ni es una migración. Antes de usarla:
--   1. Bajá un respaldo de la edición anterior (ver docs/PROXIMA-EDICION.md, paso 1).
--   2. Reemplazá 2027-10-03 por el ÚLTIMO día del evento nuevo (en todos los lugares de este archivo).
--   3. Elegí si conservás a los visitantes (bloque 4): conservarlos les permite recuperar la billetera
--      con el mismo mail o WhatsApp; borrarlos deja la base vacía.
-- Todo va en una transacción: si algo falla, no cambia nada.

begin;

-- 1. Fecha de fin del evento ----------------------------------------------------------------
--    Vencimiento mínimo de los cupones y valor por defecto (el mínimo se vuelve a poner al final,
--    después de actualizar las marcas).
alter table public.marcas drop constraint marcas_vence_check;
alter table public.marcas alter column vence set default '2027-10-03';

--    Los canjes después de esta fecha quedan como "post_evento" (en sucursales).
do $$
declare d text;
begin
  d := pg_get_functiondef('public.canjear(uuid,uuid,text)'::regprocedure);
  d := regexp_replace(d, 'date ''\d{4}-\d{2}-\d{2}''', 'date ''2027-10-03''');
  execute d;
end $$;

-- 2. Datos del evento anterior ----------------------------------------------------------------
delete from public.canjes;
delete from public.intentos_canje;
delete from public.votos_stand;
delete from public.votos_barista;
delete from public.mensajes_barista;
delete from public.ganadores;
update public.sorteo set abierto = false, updated_at = now();
alter sequence public.canje_numero restart with 1;

-- 3. Torneo de baristas: se borran los baristas, sus puntajes y las planillas de los jurados ----
delete from public.evaluaciones;
delete from public.puntajes;
delete from public.baristas;
update public.torneo set fase = 'r1', pantalla = 'auto', updated_at = now();
--    Claves nuevas de los jurados: se generan desde /admin/baristas. Acá solo se invalidan las viejas.
update public.jurados set clave = null, clave_version = clave_version + 1;

-- 4. Visitantes (elegí UNA opción) ---------------------------------------------------------------
--    a) Conservarlos, pero sin la marca de "presente" del sorteo anterior:
update public.visitantes set presente_at = null;
--    b) Borrarlos todos (descomentá la línea y comentá la de arriba):
-- delete from public.visitantes;

-- 5. Marcas: quedan cargadas, pero sin cupón, ocultas y con claves nuevas -----------------------
--    El código de caja y la clave se regeneran para que nadie use los del año anterior.
update public.marcas set
  beneficio     = '',
  condiciones   = '',
  creditos      = 1,
  activa        = false,
  en_votacion   = false,
  vence         = '2027-10-03',
  sucursales    = '',
  enviado_at    = null,
  clave_version = clave_version + 1,
  updated_at    = now();
--    Códigos de caja nuevos: todos distintos entre sí y distintos de los del año anterior.
with m as (select id, row_number() over (order by random()) n from public.marcas),
     c as (select g::text codigo, row_number() over (order by random()) n
           from generate_series(1000, 9999) g
           where g::text not in (select codigo from public.marcas))
update public.marcas t set codigo = c.codigo from m join c using (n) where t.id = m.id;
--    Las claves de acceso nuevas se generan desde /admin → Beneficios → "Nueva clave" (marca por marca).
--    Las marcas que no vuelven se pueden eliminar desde el mismo panel (se ocultan y conservan su historial).

alter table public.marcas add constraint marcas_vence_check check (vence >= date '2027-10-03');

commit;
