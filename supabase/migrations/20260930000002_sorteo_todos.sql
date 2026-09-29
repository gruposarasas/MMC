-- Cada sorteo es entre TODOS los presentes, incluso quienes salieron antes
-- (si el ganador no aparece, se vuelve a sortear con los mismos participantes).
-- La tabla ganadores queda como historial.
create or replace function public.sortear() returns jsonb
language plpgsql set search_path = public, pg_temp
as $$
declare
  v visitantes%rowtype;
  presentes integer;
begin
  perform 1 from sorteo where id = 1 for update;  -- un sorteo a la vez
  select count(*) into presentes from visitantes where presente_at is not null;
  if presentes = 0 then
    return jsonb_build_object('estado', 'sin_presentes');
  end if;
  select * into v from visitantes where presente_at is not null order by random() limit 1;
  insert into ganadores (visitante_id) values (v.id);
  return jsonb_build_object('estado', 'ok', 'id', v.id, 'nombre', v.nombre, 'entre', presentes);
end $$;

revoke execute on function public.sortear() from public, anon, authenticated;
grant execute on function public.sortear() to service_role;
