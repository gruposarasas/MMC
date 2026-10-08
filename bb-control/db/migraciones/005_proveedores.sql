-- Lista de proveedores: las compras y los gastos eligen uno de la lista en vez de escribirlo,
-- así se corrige un nombre una sola vez y cambia en todos sus comprobantes.

create table proveedores (
  id serial primary key,
  nombre text not null check (length(trim(nombre)) > 0),
  cuit text not null default '',                              -- solo los 11 números
  rubro_id int references rubros (id) on delete set null,     -- rubro habitual: se elige solo al cargar
  contacto text not null default '',
  telefono text not null default '',
  email text not null default '',
  cbu text not null default '',                               -- CBU o alias para pagarle
  notas text not null default '',
  alias text[] not null default '{}',                         -- nombres anteriores (para reconocerlo al importar)
  activo boolean not null default true,
  creado timestamptz not null default now()
);
create unique index proveedores_nombre on proveedores (lower(nombre));
create unique index proveedores_cuit on proveedores (cuit) where cuit <> '';
alter table proveedores enable row level security;

alter table egresos add column proveedor_id int references proveedores (id);
create index egresos_proveedor on egresos (proveedor_id);

-- Los proveedores que ya estaban escritos en las compras y gastos pasan a la lista.
insert into proveedores (nombre)
select distinct on (lower(trim(proveedor))) trim(proveedor)
from egresos where trim(proveedor) <> ''
order by lower(trim(proveedor)), fecha desc;

update egresos e set proveedor_id = p.id
from proveedores p where lower(trim(e.proveedor)) = lower(p.nombre);

update proveedores p set rubro_id = (
  select e.rubro_id from egresos e where e.proveedor_id = p.id
  group by e.rubro_id order by count(*) desc, max(e.fecha) desc limit 1
);

-- El nombre que se ve en cada comprobante es siempre el de la lista.
create function egresos_nombre_proveedor() returns trigger language plpgsql set search_path = public as $$
begin
  if new.proveedor_id is not null then
    select nombre into new.proveedor from proveedores where id = new.proveedor_id;
  end if;
  return new;
end $$;
create trigger egresos_nombre_proveedor before insert or update of proveedor_id, proveedor on egresos
  for each row execute function egresos_nombre_proveedor();

create function proveedores_renombrar() returns trigger language plpgsql set search_path = public as $$
begin
  update egresos set proveedor = new.nombre where proveedor_id = new.id and proveedor <> new.nombre;
  return new;
end $$;
create trigger proveedores_renombrar after update of nombre on proveedores
  for each row execute function proveedores_renombrar();

-- La lista se puede importar desde Excel.
alter table importaciones drop constraint if exists importaciones_tipo_check;
alter table importaciones add constraint importaciones_tipo_check
  check (tipo in ('venta', 'compra', 'gasto', 'producto', 'insumo', 'proveedor'));

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on proveedores from anon, authenticated;
    revoke all on sequence proveedores_id_seq from anon, authenticated;
  end if;
end $$;
