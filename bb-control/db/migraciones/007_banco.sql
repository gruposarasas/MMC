-- Banco: cuentas, echeqs, préstamos y demás deudas en cuotas, y gastos fijos, para planificar los pagos futuros.

create table cuentas_banco (
  id serial primary key,
  nombre text not null check (length(trim(nombre)) > 0),   -- ej.: Galicia cuenta corriente
  banco text not null default '',
  moneda text not null default 'ARS' check (moneda in ('ARS', 'USD')),
  saldo numeric(16, 2) not null default 0,
  saldo_al date,
  orden int not null default 0,
  activo boolean not null default true
);

-- Echeqs emitidos (pagos) y recibidos (cobros) con fecha de pago.
create table echeqs (
  id bigserial primary key,
  sentido text not null default 'emitido' check (sentido in ('emitido', 'recibido')),
  cuenta_id int references cuentas_banco (id) on delete set null,
  numero text not null default '',
  banco text not null default '',                -- de los recibidos: banco del librador
  proveedor_id int references proveedores (id),  -- beneficiario de un emitido
  tercero text not null default '',              -- nombre si no es un proveedor de la lista (o el librador de un recibido)
  cuit text not null default '',
  emision date,
  pago date not null,                            -- fecha de pago (o de cobro)
  moneda text not null default 'ARS' check (moneda in ('ARS', 'USD')),
  monto numeric(16, 2) not null check (monto > 0),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'pagado', 'anulado', 'rechazado')),
  cerrado_el date,                               -- cuándo se debitó, cobró, anuló o rechazó
  notas text not null default '',
  clave text unique,                             -- para no duplicar al reimportar
  importacion_id bigint references importaciones (id) on delete set null,
  creado timestamptz not null default now()
);
create index echeqs_pago on echeqs (pago) where estado = 'pendiente';

-- Facturas de compras o gastos que se pagaron con un echeq.
create table echeq_egresos (
  echeq_id bigint not null references echeqs (id) on delete cascade,
  egreso_id bigint not null references egresos (id) on delete cascade,
  primary key (echeq_id, egreso_id)
);

-- Préstamos, planes de pago, leasing, tarjetas y otras deudas en cuotas.
create table pasivos (
  id serial primary key,
  tipo text not null default 'prestamo' check (tipo in ('prestamo', 'plan', 'leasing', 'tarjeta', 'deuda', 'otro')),
  nombre text not null check (length(trim(nombre)) > 0),
  acreedor text not null default '',
  moneda text not null default 'ARS' check (moneda in ('ARS', 'USD')),
  capital numeric(16, 2) not null default 0,
  tasa numeric(7, 3),                             -- TNA en %
  sistema text not null default 'frances' check (sistema in ('frances', 'aleman', 'fija', 'unica')),
  rubro_id int references rubros (id),           -- si tiene, los intereses de cada cuota pagada van a Gastos
  notas text not null default '',
  activo boolean not null default true,
  creado timestamptz not null default now()
);

create table pasivo_cuotas (
  id bigserial primary key,
  pasivo_id int not null references pasivos (id) on delete cascade,
  numero int not null,
  vencimiento date not null,
  capital numeric(16, 2) not null default 0,
  interes numeric(16, 2) not null default 0,
  iva numeric(16, 2) not null default 0,          -- IVA sobre los intereses
  otros numeric(16, 2) not null default 0,        -- seguros, gastos, impuestos
  total numeric(16, 2) generated always as (capital + interes + iva + otros) stored,
  pagada_el date,
  egreso_id bigint references egresos (id) on delete set null,
  unique (pasivo_id, numero)
);
create index pasivo_cuotas_vencimiento on pasivo_cuotas (vencimiento) where pagada_el is null;

-- Gastos que se repiten todos los meses (alquiler, servicios, seguros…), para proyectarlos.
create table fijos (
  id serial primary key,
  nombre text not null check (length(trim(nombre)) > 0),
  monto numeric(16, 2) not null check (monto > 0),
  moneda text not null default 'ARS' check (moneda in ('ARS', 'USD')),
  dia int not null default 10 check (dia between 1 and 31),
  rubro_id int references rubros (id),
  proveedor_id int references proveedores (id),
  desde date not null check (extract(day from desde) = 1),
  hasta date check (hasta is null or extract(day from hasta) = 1),
  activo boolean not null default true,
  notas text not null default ''
);

alter table importaciones drop constraint if exists importaciones_tipo_check;
alter table importaciones add constraint importaciones_tipo_check
  check (tipo in ('venta', 'compra', 'gasto', 'producto', 'insumo', 'proveedor', 'echeq'));

alter table cuentas_banco enable row level security;
alter table echeqs enable row level security;
alter table echeq_egresos enable row level security;
alter table pasivos enable row level security;
alter table pasivo_cuotas enable row level security;
alter table fijos enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on cuentas_banco, echeqs, echeq_egresos, pasivos, pasivo_cuotas, fijos from anon, authenticated;
    revoke all on sequence cuentas_banco_id_seq, echeqs_id_seq, pasivos_id_seq, pasivo_cuotas_id_seq, fijos_id_seq from anon, authenticated;
  end if;
end $$;
