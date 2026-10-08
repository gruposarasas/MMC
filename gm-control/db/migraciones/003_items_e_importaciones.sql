-- Compras y gastos como una factura con varios renglones, e importación desde Excel
-- de compras, gastos, productos e insumos.

-- Cada importación dice de qué es (las de ventas ya cargadas quedan como 'venta').
alter table importaciones add column tipo text not null default 'venta'
  check (tipo in ('venta', 'compra', 'gasto', 'producto', 'insumo'));

-- Clave para no duplicar un comprobante al reimportar (tipo|proveedor|comprobante|número).
alter table egresos add column clave text unique;
alter table egresos add column importacion_id bigint references importaciones (id) on delete set null;

-- Renglones de la factura. Precio unitario sin IVA, en la moneda del comprobante.
create table egreso_items (
  id bigserial primary key,
  egreso_id bigint not null references egresos (id) on delete cascade,
  orden int not null default 0,
  descripcion text not null check (length(trim(descripcion)) > 0),
  insumo_id int references insumos (id) on delete set null,
  cantidad numeric(14, 3) not null default 1,
  unidad text not null default '',
  precio numeric(16, 4) not null default 0,
  alicuota numeric(5, 2) not null default 21 check (alicuota >= 0 and alicuota <= 100),
  neto numeric(16, 2) generated always as (round(cantidad * precio, 2)) stored,
  iva numeric(16, 2) generated always as (round(round(cantidad * precio, 2) * alicuota / 100, 2)) stored
);
create index egreso_items_egreso on egreso_items (egreso_id);
alter table egreso_items enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on egreso_items from anon, authenticated;
    revoke all on sequence egreso_items_id_seq from anon, authenticated;
  end if;
end $$;
