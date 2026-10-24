-- Detalle de Contabilium: los productos de cada venta (la búsqueda de comprobantes trae solo los totales; los renglones
-- se piden uno por uno con /comprobantes/getById) y los datos de contacto de los clientes.
create table venta_items (
  id bigserial primary key,
  venta_id bigint not null references ventas (id) on delete cascade,
  orden int not null default 0,
  codigo text not null default '',
  concepto text not null default '',
  concepto_id text not null default '',          -- IdConcepto de Contabilium
  rubro text not null default '',
  cantidad numeric(14, 3) not null default 0,    -- negativa en las notas de crédito
  precio numeric(16, 2) not null default 0,      -- unitario, como viene en el comprobante
  bonificacion numeric(6, 2) not null default 0,
  neto numeric(16, 2) not null default 0,        -- sin IVA; los renglones suman el neto de la venta
  iva_alicuota numeric(5, 2),
  kilos numeric(14, 3)                           -- cantidad × kilos por unidad, si el nombre dice el peso
);
create index venta_items_venta on venta_items (venta_id);
create index venta_items_concepto on venta_items (lower(concepto));
alter table venta_items enable row level security;

-- Cuándo se trajeron los renglones de la venta (vacío = falta pedirlos).
alter table ventas add column detalle_el timestamptz;

alter table clientes add column contabilium_id text not null default '';
alter table clientes add column email text not null default '';
alter table clientes add column telefono text not null default '';
alter table clientes add column direccion text not null default '';

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on venta_items from anon, authenticated;
    revoke all on sequence venta_items_id_seq from anon, authenticated;
  end if;
end $$;
