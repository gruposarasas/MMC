-- Contabilidad: el contador carga cada mes lo que hay que pagar (F.931, IVA e Ingresos Brutos) de cada
-- razón social, con monto, vencimiento, nota y archivos. Solo administración lo marca pagado.

create table razones_sociales (
  id serial primary key,
  nombre text not null unique check (length(trim(nombre)) between 2 and 80),
  cuit text not null default '',          -- solo los 11 números
  orden int not null default 0,
  activo boolean not null default true
);
insert into razones_sociales (nombre) values ('Grupo Modesto');

-- Acceso del contador (o de cada persona del estudio): mail y clave. Entra solo a Contabilidad.
create table contadores (
  id serial primary key,
  nombre text not null check (length(trim(nombre)) >= 2),
  email text not null unique,             -- en minúsculas
  clave_hash text,
  activo boolean not null default true,
  ultimo_ingreso timestamptz,
  creado timestamptz not null default now()
);

create table contab_obligaciones (
  id bigserial primary key,
  mes date not null check (extract(day from mes) = 1),          -- período que se liquida
  razon_id int not null references razones_sociales (id),
  tipo text not null check (tipo in ('f931', 'iva', 'iibb')),
  monto numeric(16, 2) check (monto >= 0),
  vencimiento date,
  nota text not null default '',
  cargado_por text not null default '',
  actualizado timestamptz not null default now(),
  pagado_el date,
  pagado_por text not null default '',
  egreso_id bigint references egresos (id) on delete set null,  -- el gasto que se creó en Gastos (F.931 e IIBB)
  unique (mes, razon_id, tipo)
);

create table contab_archivos (
  id bigserial primary key,
  obligacion_id bigint not null references contab_obligaciones (id) on delete cascade,
  archivo_id uuid not null references archivos (id) on delete cascade,
  subido_por text not null default '',
  creado timestamptz not null default now()
);
create index contab_archivos_obligacion on contab_archivos (obligacion_id);

-- Quién hizo qué en cada obligación.
create table contab_historial (
  id bigserial primary key,
  obligacion_id bigint not null references contab_obligaciones (id) on delete cascade,
  quien text not null,
  que text not null,
  creado timestamptz not null default now()
);
create index contab_historial_obligacion on contab_historial (obligacion_id);

-- ART o seguro de cada persona del equipo.
alter table empleados add column cobertura text check (cobertura in ('art', 'seguro'));

alter table razones_sociales enable row level security;
alter table contadores enable row level security;
alter table contab_obligaciones enable row level security;
alter table contab_archivos enable row level security;
alter table contab_historial enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on razones_sociales, contadores, contab_obligaciones, contab_archivos, contab_historial from anon, authenticated;
    revoke all on sequence razones_sociales_id_seq, contadores_id_seq, contab_obligaciones_id_seq, contab_archivos_id_seq,
      contab_historial_id_seq from anon, authenticated;
  end if;
end $$;
