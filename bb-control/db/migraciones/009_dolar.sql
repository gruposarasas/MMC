-- Dólar BNA del día (lo trae la app sola) con su historial, para ver cómo cambia y para el costo de reposición.
create table dolar_historial (
  fecha date primary key,
  compra numeric(14, 4),
  venta numeric(14, 4) not null check (venta > 0),
  fuente text not null default 'BNA',
  actualizado timestamptz not null default now()
);
alter table dolar_historial enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on dolar_historial from anon, authenticated;
  end if;
end $$;
