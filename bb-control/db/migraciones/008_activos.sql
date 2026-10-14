-- Activos: máquinas instaladas en clientes, molinillos, tostadoras, vehículos y demás equipos, con su costo
-- (mercadería + gastos de importación prorrateados por unidad) y su valor estimado.

-- Una importación (o compra) de equipos: los gastos se reparten entre las unidades importadas.
create table activo_importaciones (
  id serial primary key,
  nombre text not null check (length(trim(nombre)) > 0),   -- ej.: Importación La Marzocco marzo 2026
  fecha date,
  origen text not null default '',                          -- proveedor del exterior
  moneda text not null default 'USD' check (moneda in ('ARS', 'USD')),   -- de la mercadería
  cotizacion numeric(14, 4) not null default 1 check (cotizacion > 0),   -- dólar de la importación
  mercaderia numeric(16, 2) not null default 0,             -- costo total de la mercadería (FOB)
  unidades int not null default 1 check (unidades > 0),     -- unidades importadas
  transporte numeric(16, 2) not null default 0,
  transporte_moneda text not null default 'USD' check (transporte_moneda in ('ARS', 'USD')),
  gastos_importacion numeric(16, 2) not null default 0,     -- derechos, tasas, aduana, depósito fiscal
  gastos_importacion_moneda text not null default 'ARS' check (gastos_importacion_moneda in ('ARS', 'USD')),
  despachante numeric(16, 2) not null default 0,
  despachante_moneda text not null default 'ARS' check (despachante_moneda in ('ARS', 'USD')),
  otros numeric(16, 2) not null default 0,
  otros_moneda text not null default 'ARS' check (otros_moneda in ('ARS', 'USD')),
  notas text not null default '',
  creado timestamptz not null default now()
);

create table activos (
  id serial primary key,
  categoria text not null default 'maquina' check (categoria in ('maquina', 'molinillo', 'tostadora', 'vehiculo', 'equipo', 'otro')),
  numero text not null default '',            -- n° de serie, de inventario o patente
  descripcion text not null check (length(trim(descripcion)) > 0),
  marca text not null default '',
  modelo text not null default '',
  estado text not null default 'cliente' check (estado in ('cliente', 'deposito', 'uso', 'reparacion', 'baja')),
  cliente text not null default '',           -- dónde está instalada
  ubicacion text not null default '',         -- dirección o local
  instalada date,
  importacion_id int references activo_importaciones (id) on delete set null,
  moneda text not null default 'USD' check (moneda in ('ARS', 'USD')),   -- del costo de mercadería y del valor estimado
  costo_mercaderia numeric(16, 2),            -- por unidad; vacío = mercadería de la importación / unidades
  costo_otros numeric(16, 2) not null default 0,   -- otros costos propios (instalación, flete local…), en la misma moneda
  valor_estimado numeric(16, 2),
  alta date,
  notas text not null default '',
  clave text unique,                          -- para no duplicar al importar
  creado timestamptz not null default now()
);
create index activos_cliente on activos (lower(cliente)) where cliente <> '';

alter table importaciones drop constraint if exists importaciones_tipo_check;
alter table importaciones add constraint importaciones_tipo_check
  check (tipo in ('venta', 'compra', 'gasto', 'producto', 'insumo', 'proveedor', 'echeq', 'activo'));

alter table activo_importaciones enable row level security;
alter table activos enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on activo_importaciones, activos from anon, authenticated;
    revoke all on sequence activo_importaciones_id_seq, activos_id_seq from anon, authenticated;
  end if;
end $$;
