-- Clientes para el semáforo de rentabilidad: lo que compran, el descuento, cómo pagan y las máquinas que tienen
-- (las máquinas salen de Activos, por el nombre del cliente o de sus locales).
create table clientes (
  id serial primary key,
  nombre text not null check (length(trim(nombre)) > 0),   -- ej.: Entre Dos (sus locales: "Entre Dos Palmares", etc.)
  alias text[] not null default '{}',                       -- otros nombres en Ventas o en Activos (razón social)
  cuit text not null default '',
  locales int not null default 1 check (locales >= 1),
  kilos_mes numeric(12, 2),                                 -- consumo de café por mes
  kilos_desde_ventas boolean not null default false,        -- estimar los kilos con lo facturado en Ventas
  descuento_pct numeric(5, 2) not null default 0 check (descuento_pct >= 0 and descuento_pct < 100),
  forma_pago text not null default 'Transferencia',
  plazo_dias int not null default 0 check (plazo_dias >= 0 and plazo_dias <= 365),
  comision_pct numeric(5, 2) not null default 0 check (comision_pct >= 0 and comision_pct < 100),  -- del medio de cobro
  precio_kg numeric(16, 2),                                 -- precio de lista especial por kg (sin IVA); vacío = el general
  notas text not null default '',
  activo boolean not null default true,
  creado timestamptz not null default now()
);
create unique index clientes_nombre on clientes (lower(nombre));
alter table clientes enable row level security;

alter table importaciones drop constraint if exists importaciones_tipo_check;
alter table importaciones add constraint importaciones_tipo_check
  check (tipo in ('venta', 'compra', 'gasto', 'producto', 'insumo', 'proveedor', 'echeq', 'activo', 'cliente'));

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on clientes from anon, authenticated;
    revoke all on sequence clientes_id_seq from anon, authenticated;
  end if;
end $$;
