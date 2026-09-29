-- Sorteo de la camiseta de Enzo entre los inscriptos que confirmen que están presentes.

alter table public.visitantes add column presente_at timestamptz;
create index visitantes_presentes on public.visitantes (presente_at) where presente_at is not null;

-- Estado del sorteo: una sola fila.
create table public.sorteo (
  id          smallint primary key default 1 check (id = 1),
  abierto     boolean not null default false,   -- si los visitantes pueden tocar "Estoy presente"
  updated_at  timestamptz not null default now()
);
insert into public.sorteo default values;

create table public.ganadores (
  id            bigserial primary key,
  visitante_id  uuid not null references public.visitantes (id) on delete cascade,
  created_at    timestamptz not null default now()
);

-- Elige al azar un presente que todavía no haya ganado y lo registra.
create function public.sortear() returns jsonb
language plpgsql set search_path = public, pg_temp
as $$
declare
  v visitantes%rowtype;
  presentes integer;
begin
  perform 1 from sorteo where id = 1 for update;  -- un sorteo a la vez
  select count(*) into presentes from visitantes x
  where x.presente_at is not null and not exists (select 1 from ganadores g where g.visitante_id = x.id);
  if presentes = 0 then
    return jsonb_build_object('estado', 'sin_presentes');
  end if;
  select * into v from visitantes x
  where x.presente_at is not null and not exists (select 1 from ganadores g where g.visitante_id = x.id)
  order by random() limit 1;
  insert into ganadores (visitante_id) values (v.id);
  return jsonb_build_object('estado', 'ok', 'id', v.id, 'nombre', v.nombre, 'entre', presentes);
end $$;

alter table public.sorteo    enable row level security;
alter table public.ganadores enable row level security;
revoke all on public.sorteo, public.ganadores from anon, authenticated;
revoke all on sequence public.ganadores_id_seq from anon, authenticated;
revoke execute on function public.sortear() from public, anon, authenticated;
grant execute on function public.sortear() to service_role;
