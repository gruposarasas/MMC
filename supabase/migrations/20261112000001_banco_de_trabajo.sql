-- Banco de trabajo de AEHGA (gastronomía y hotelería), en /trabajo.
--   · Postulantes: cargan su CV (PDF, JPG o PNG), sus datos de contacto, dirección y puestos que buscan.
--   · Empresas (hoteles, restaurantes…): se registran solas, buscan CVs y publican vacantes.
--   · Postulaciones: un postulante se postula una vez a cada vacante.
-- Todo pasa por el servidor con la service role: RLS activado, sin políticas, y sin permisos para anon/authenticated.

create table public.tb_postulantes (
  id              uuid primary key default gen_random_uuid(),
  nombre          text not null check (length(nombre) between 3 and 120),
  nacimiento      date not null check (nacimiento > date '1900-01-01'),
  mail            text not null unique check (mail = lower(mail) and length(mail) <= 200 and mail ~ '^[^[:space:]@]+@[^[:space:]@]+\.[a-z]{2,}$'),
  whatsapp        text not null check (whatsapp ~ '^[0-9]{10,13}$'),
  direccion       text not null default '' check (length(direccion) <= 150),
  localidad       text not null default '' check (length(localidad) <= 80),
  departamento    text not null check (length(departamento) between 2 and 40),
  puesto          text not null check (length(puesto) between 2 and 40),          -- puesto principal que busca
  puestos_extra   text[] not null default '{}' check (cardinality(puestos_extra) <= 2),
  puesto_otro     text not null default '' check (length(puesto_otro) <= 60),     -- si eligió "Otro"
  puesto_actual   text not null default '' check (length(puesto_actual) <= 120),  -- puesto actual o último
  experiencia     smallint not null default 0 check (experiencia between 0 and 60),
  disponibilidad  text[] not null default '{}',
  idiomas         text[] not null default '{}',
  movilidad       boolean not null default false,
  sobre_mi        text not null default '' check (length(sobre_mi) <= 600),
  cv_path         text,
  cv_tipo         text check (cv_tipo is null or cv_tipo in ('application/pdf', 'image/jpeg', 'image/png')),
  clave_hash      text not null,
  clave_version   integer not null default 1,
  visible         boolean not null default true,    -- el postulante puede pausar su perfil
  oculto          boolean not null default false,   -- administración lo puede ocultar
  acepto_at       timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index tb_postulantes_busqueda on public.tb_postulantes (departamento, puesto) where visible and not oculto;
create index tb_postulantes_extra on public.tb_postulantes using gin (puestos_extra);

create table public.tb_empresas (
  id              uuid primary key default gen_random_uuid(),
  nombre          text not null check (length(nombre) between 2 and 120),
  tipo            text not null check (tipo in ('hotel', 'restaurante', 'bar', 'cafeteria', 'bodega', 'catering', 'otro')),
  cuit            text not null default '' check (cuit ~ '^[0-9]{0,11}$'),
  departamento    text not null check (length(departamento) between 2 and 40),
  direccion       text not null default '' check (length(direccion) <= 150),
  contacto        text not null default '' check (length(contacto) <= 80),
  mail            text not null unique check (mail = lower(mail) and length(mail) <= 200 and mail ~ '^[^[:space:]@]+@[^[:space:]@]+\.[a-z]{2,}$'),
  whatsapp        text not null check (whatsapp ~ '^[0-9]{10,13}$'),
  clave_hash      text not null,
  clave_version   integer not null default 1,
  oculta          boolean not null default false,
  created_at      timestamptz not null default now()
);

create table public.tb_vacantes (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.tb_empresas (id) on delete cascade,
  puesto          text not null check (length(puesto) between 2 and 40),
  titulo          text not null check (length(titulo) between 3 and 100),
  descripcion     text not null default '' check (length(descripcion) <= 2000),
  departamento    text not null check (length(departamento) between 2 and 40),
  jornada         text not null check (length(jornada) between 2 and 40),
  sueldo          text not null default '' check (length(sueldo) <= 80),
  abierta         boolean not null default true,
  oculta          boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index tb_vacantes_abiertas on public.tb_vacantes (created_at desc) where abierta and not oculta;
create index tb_vacantes_empresa on public.tb_vacantes (empresa_id);

create table public.tb_postulaciones (
  vacante_id      uuid not null references public.tb_vacantes (id) on delete cascade,
  postulante_id   uuid not null references public.tb_postulantes (id) on delete cascade,
  mensaje         text not null default '' check (length(mensaje) <= 500),
  estado          text not null default 'nueva' check (estado in ('nueva', 'vista', 'contactado', 'descartado')),
  created_at      timestamptz not null default now(),
  primary key (vacante_id, postulante_id)
);
create index tb_postulaciones_postulante on public.tb_postulaciones (postulante_id);

-- Qué empresa abrió qué CV (para cuidar los datos personales).
create table public.tb_vistas_cv (
  id              bigint generated always as identity primary key,
  empresa_id      uuid references public.tb_empresas (id) on delete set null,
  postulante_id   uuid not null references public.tb_postulantes (id) on delete cascade,
  created_at      timestamptz not null default now()
);
create index tb_vistas_cv_postulante on public.tb_vistas_cv (postulante_id, created_at desc);

alter table public.tb_postulantes   enable row level security;
alter table public.tb_empresas      enable row level security;
alter table public.tb_vacantes      enable row level security;
alter table public.tb_postulaciones enable row level security;
alter table public.tb_vistas_cv     enable row level security;
revoke all on public.tb_postulantes, public.tb_empresas, public.tb_vacantes, public.tb_postulaciones, public.tb_vistas_cv from anon, authenticated;

-- Bucket privado para los CV (PDF, JPG o PNG, hasta 5 MB). Se ven solo con links firmados que arma el servidor.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cvs', 'cvs', false, 5242880, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;
