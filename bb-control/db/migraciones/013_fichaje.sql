-- Fichaje y horas (adaptado de la app de Sara): cada persona ficha entrada y salida desde su app /mi, con el GPS
-- y el QR rotativo de la pantalla del lugar. Las horas del mes se calculan con su horario semanal.
create table lugares (
  id serial primary key,
  nombre text not null check (length(trim(nombre)) > 0),     -- ej.: Depósito, Oficina, Tostadero
  direccion text not null default '',
  lat double precision,
  lng double precision,
  radio_m int not null default 80 check (radio_m between 20 and 2000),
  activo boolean not null default true,
  creado timestamptz not null default now()
);

-- Tablets o PC que muestran el QR. Se activan con un link de un solo uso; después se reconocen por una cookie.
create table pantallas (
  id serial primary key,
  lugar_id int not null references lugares (id) on delete cascade,
  nombre text not null default '',
  token_hash text unique,
  codigo text unique,
  codigo_vence timestamptz,
  activa boolean not null default true,
  visto timestamptz,
  creado timestamptz not null default now()
);

-- Una fila por jornada: la entrada y, cuando la marca, la salida.
create table fichajes (
  id bigserial primary key,
  empleado_id int not null references empleados (id) on delete cascade,
  lugar_id int references lugares (id) on delete set null,
  fecha date not null,                          -- día de la entrada (Mendoza)
  entrada timestamptz not null,
  salida timestamptz,
  salida_por text check (salida_por in ('qr', 'admin')),
  minutos_tarde int,                            -- contra su horario de ese día (vacío: sin horario)
  pedido_salida timestamptz,                    -- se olvidó de marcar la salida: la hora que pide
  pedido_nota text not null default '',
  rechazada boolean not null default false,     -- administración no aceptó la salida pedida: el día suma 0
  manual boolean not null default false,        -- cargado por administración
  nota text not null default '',
  geo_entrada jsonb,                            -- {lat, lng, precision, distancia}
  geo_salida jsonb,
  creado timestamptz not null default now(),
  check (salida is null or salida > entrada)
);
create index fichajes_empleado on fichajes (empleado_id, fecha);
create index fichajes_fecha on fichajes (fecha);

-- Intentos de fichar que no se aceptaron (ubicación, QR vencido, otro teléfono…), para ayudar si alguien no puede.
create table fichajes_rechazados (
  id bigserial primary key,
  empleado_id int references empleados (id) on delete cascade,
  motivo text not null,
  creado timestamptz not null default now()
);

create table feriados (
  fecha date primary key,
  nombre text not null default ''
);

alter table empleados add column horario jsonb;          -- {"1": [["09:00", "17:00"]], ...} (0 = domingo); vacío = sin horario fijo
alter table empleados add column lugar_id int references lugares (id) on delete set null;   -- dónde ficha habitualmente
alter table empleados add column telefono_ficha text;    -- huella del teléfono con el que ficha (uno por persona)

alter table lugares enable row level security;
alter table pantallas enable row level security;
alter table fichajes enable row level security;
alter table fichajes_rechazados enable row level security;
alter table feriados enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on lugares, pantallas, fichajes, fichajes_rechazados, feriados from anon, authenticated;
    revoke all on sequence lugares_id_seq, pantallas_id_seq, fichajes_id_seq, fichajes_rechazados_id_seq from anon, authenticated;
  end if;
end $$;
