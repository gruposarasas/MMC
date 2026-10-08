-- La foto o el PDF de la factura queda guardado con la compra o el gasto.
alter table egresos add column archivo_id uuid references archivos (id) on delete set null;

-- Lo que se leyó de una factura, hasta que se guarda la compra (se limpia a los 7 días).
create table lecturas_factura (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('compra', 'gasto')),
  datos jsonb not null,
  archivo_id uuid references archivos (id) on delete set null,
  creado timestamptz not null default now()
);
alter table lecturas_factura enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on lecturas_factura from anon, authenticated;
  end if;
end $$;
