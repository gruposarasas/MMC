-- GM-CONTROL · esquema inicial.
-- Todo el acceso es desde el servidor con DATABASE_URL. Si la base es de Supabase,
-- RLS queda activado y sin políticas: la API pública (anon) no ve ninguna tabla.

create extension if not exists pgcrypto;

-- ---------- ajustes ----------
create table ajustes (
  clave text primary key,
  valor jsonb not null,
  actualizado timestamptz not null default now()
);

-- ---------- rubros de compras y gastos ----------
-- clase: para el tablero. 'cargas' = F.931, 'impuestos', 'inversion' (equipos, mejoras), 'operativo' (el resto).
create table rubros (
  id serial primary key,
  tipo text not null check (tipo in ('compra', 'gasto')),
  nombre text not null check (length(trim(nombre)) > 0),
  clase text not null default 'operativo' check (clase in ('operativo', 'impuestos', 'cargas', 'inversion')),
  orden int not null default 0,
  activo boolean not null default true,
  unique (tipo, nombre)
);

-- ---------- ventas (importadas de Contabilium o cargadas a mano) ----------
create table importaciones (
  id bigserial primary key,
  archivo text not null,
  filas int not null,
  nuevas int not null default 0,
  actualizadas int not null default 0,
  desde date,
  hasta date,
  total numeric(16, 2) not null default 0,
  creado timestamptz not null default now()
);

create table ventas (
  id bigserial primary key,
  fecha date not null,
  comprobante text not null default '',      -- Factura A, Factura B, NC A, ...
  numero text not null default '',           -- 0003-00001234
  cliente text not null default '',
  cuit text not null default '',
  neto numeric(16, 2) not null default 0,    -- sin IVA (gravado + no gravado + exento)
  iva numeric(16, 2) not null default 0,
  otros numeric(16, 2) not null default 0,   -- percepciones y otros tributos
  total numeric(16, 2) not null default 0,   -- con IVA
  origen text not null default 'manual' check (origen in ('contabilium', 'manual')),
  clave text unique,                         -- comprobante|número: evita duplicados al reimportar
  importacion_id bigint references importaciones (id) on delete set null,
  notas text not null default '',
  datos jsonb,                               -- fila original del Excel
  creado timestamptz not null default now()
);
create index ventas_fecha on ventas (fecha);

-- ---------- compras (mercadería) y gastos (todo lo demás) ----------
create table egresos (
  id bigserial primary key,
  tipo text not null check (tipo in ('compra', 'gasto')),
  fecha date not null,
  rubro_id int not null references rubros (id),
  proveedor text not null default '',
  comprobante text not null default '',
  numero text not null default '',
  descripcion text not null default '',
  cantidad numeric(14, 3),
  unidad text not null default '',
  moneda text not null default 'ARS' check (moneda in ('ARS', 'USD')),
  cotizacion numeric(14, 4) not null default 1 check (cotizacion > 0),
  neto numeric(16, 2) not null default 0,
  iva_alicuota numeric(5, 2) not null default 0,
  iva numeric(16, 2) not null default 0,
  otros numeric(16, 2) not null default 0,
  total numeric(16, 2) generated always as (neto + iva + otros) stored,
  neto_ars numeric(16, 2) generated always as (round((neto + otros) * cotizacion, 2)) stored,  -- sin IVA
  iva_ars numeric(16, 2) generated always as (round(iva * cotizacion, 2)) stored,
  total_ars numeric(16, 2) generated always as (round((neto + iva + otros) * cotizacion, 2)) stored,
  pagado boolean not null default true,
  fecha_pago date,
  vencimiento date,
  medio_pago text not null default '',
  notas text not null default '',
  creado timestamptz not null default now()
);
create index egresos_tipo_fecha on egresos (tipo, fecha);

-- ---------- equipo ----------
create table empleados (
  id serial primary key,
  nombre text not null,
  apellido text not null default '',
  dni text unique,
  cuil text not null default '',
  nacimiento date,
  ingreso date,
  egreso date,
  puesto text not null default '',
  area text not null default '',
  telefono text not null default '',
  mail text not null default '',
  direccion text not null default '',
  emergencia text not null default '',       -- contacto de emergencia
  obra_social text not null default '',
  cbu text not null default '',              -- CBU o alias
  talle_remera text not null default '',
  talle_pantalon text not null default '',
  talle_calzado text not null default '',
  sueldo_bruto numeric(16, 2) not null default 0,
  sueldo_neto numeric(16, 2) not null default 0,
  dias_vacaciones int,                       -- si está vacío se calcula por antigüedad (LCT)
  activo boolean not null default true,
  clave_hash text,                           -- clave de la app del equipo
  notas text not null default '',
  creado timestamptz not null default now()
);

create table sueldos (
  id bigserial primary key,
  empleado_id int not null references empleados (id),
  periodo date not null check (extract(day from periodo) = 1),
  bruto numeric(16, 2) not null default 0,
  neto numeric(16, 2) not null default 0,
  extras numeric(16, 2) not null default 0,       -- horas extra, bonos, premios
  descuentos numeric(16, 2) not null default 0,   -- adelantos y otros descuentos
  pagado boolean not null default false,
  fecha_pago date,
  medio_pago text not null default '',
  notas text not null default '',
  creado timestamptz not null default now(),
  unique (empleado_id, periodo)
);

create table vacaciones (
  id bigserial primary key,
  empleado_id int not null references empleados (id),
  desde date not null,
  hasta date not null,
  dias int generated always as (hasta - desde + 1) stored,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aprobada', 'rechazada', 'cancelada')),
  nota text not null default '',
  respuesta text not null default '',
  creado timestamptz not null default now(),
  resuelto timestamptz,
  check (hasta >= desde)
);

create table archivos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  tipo text not null,
  tamano int not null,
  datos bytea not null,
  creado timestamptz not null default now()
);

create table certificados (
  id bigserial primary key,
  empleado_id int not null references empleados (id),
  desde date not null,
  hasta date not null,
  motivo text not null default '',
  archivo_id uuid references archivos (id) on delete set null,
  visto boolean not null default false,
  creado timestamptz not null default now(),
  check (hasta >= desde)
);

create table uniformes (
  id bigserial primary key,
  empleado_id int not null references empleados (id),
  prenda text not null,
  talle text not null default '',
  cantidad int not null default 1 check (cantidad > 0),
  estado text not null default 'pedido' check (estado in ('pedido', 'entregado', 'rechazado')),
  fecha_entrega date,
  nota text not null default '',
  creado timestamptz not null default now()
);

create table adelantos (
  id bigserial primary key,
  empleado_id int not null references empleados (id),
  monto numeric(16, 2) not null check (monto > 0),
  motivo text not null default '',
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aprobado', 'rechazado')),
  fecha_pago date,
  descontar_en date check (descontar_en is null or extract(day from descontar_en) = 1),  -- mes de sueldo en que se descuenta
  respuesta text not null default '',
  creado timestamptz not null default now(),
  resuelto timestamptz
);

-- ---------- costos ----------
create table insumos (
  id serial primary key,
  nombre text not null unique,
  categoria text not null default '',
  unidad text not null default 'kg',
  moneda text not null default 'ARS' check (moneda in ('ARS', 'USD')),
  costo numeric(16, 4) not null default 0 check (costo >= 0),   -- por unidad
  actualizado date not null default current_date,
  notas text not null default ''
);

create table productos (
  id serial primary key,
  nombre text not null,
  categoria text not null default '',
  presentacion text not null default '',
  precio numeric(16, 2) not null default 0,              -- precio de venta sin IVA
  iva_alicuota numeric(5, 2) not null default 21,
  variables_pct numeric(5, 2) not null default 0,        -- comisiones, IIBB, etc. sobre el precio
  margen_objetivo numeric(5, 2) not null default 40,
  activo boolean not null default true,
  notas text not null default '',
  creado timestamptz not null default now()
);

create table receta (
  id serial primary key,
  producto_id int not null references productos (id) on delete cascade,
  insumo_id int not null references insumos (id),
  cantidad numeric(14, 4) not null check (cantidad > 0),
  merma_pct numeric(5, 2) not null default 0 check (merma_pct >= 0 and merma_pct < 100),
  orden int not null default 0
);

-- ---------- RLS: sin políticas, solo el servidor ----------
do $$
declare t text;
begin
  foreach t in array array['ajustes','rubros','importaciones','ventas','egresos','empleados','sueldos','vacaciones',
                           'archivos','certificados','uniformes','adelantos','insumos','productos','receta'] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- ---------- datos iniciales ----------
insert into rubros (tipo, nombre, clase, orden) values
  ('compra', 'Harinas y premezclas', 'operativo', 1),
  ('compra', 'Lácteos, huevos y quesos', 'operativo', 2),
  ('compra', 'Manteca, grasas y aceites', 'operativo', 3),
  ('compra', 'Azúcar, chocolate y repostería', 'operativo', 4),
  ('compra', 'Carnes, fiambres y rellenos', 'operativo', 5),
  ('compra', 'Frutas y verduras', 'operativo', 6),
  ('compra', 'Café e insumos de cafetería', 'operativo', 7),
  ('compra', 'Bebidas', 'operativo', 8),
  ('compra', 'Packaging y descartables', 'operativo', 9),
  ('compra', 'Fletes de mercadería', 'operativo', 10),
  ('compra', 'Otra mercadería', 'operativo', 11),
  ('gasto', 'Alquiler', 'operativo', 1),
  ('gasto', 'Servicios (luz, gas, agua, internet)', 'operativo', 2),
  ('gasto', 'Honorarios profesionales', 'operativo', 3),
  ('gasto', 'Marketing y publicidad', 'operativo', 4),
  ('gasto', 'Logística y reparto', 'operativo', 5),
  ('gasto', 'Mantenimiento de hornos, equipos y locales', 'operativo', 6),
  ('gasto', 'Software y suscripciones', 'operativo', 7),
  ('gasto', 'Bancos y comisiones', 'operativo', 8),
  ('gasto', 'Seguros', 'operativo', 9),
  ('gasto', 'Vehículos, foodtrucks y combustible', 'operativo', 10),
  ('gasto', 'Limpieza, higiene y bromatología', 'operativo', 11),
  ('gasto', 'Cargas sociales (F.931)', 'cargas', 12),
  ('gasto', 'Impuestos (IIBB, Ganancias, tasas)', 'impuestos', 13),
  ('gasto', 'Inversiones (equipos y mejoras)', 'inversion', 14),
  ('gasto', 'Otros gastos', 'operativo', 15);
