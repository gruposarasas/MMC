-- Jurados del torneo: 3 usuarios (Jurado 1, 2 y 3) que cargan su planilla de cada barista en cada ronda.
-- Cuando los 3 completaron la planilla de un barista, el puntaje de la ronda se calcula solo
-- (promedio de los 3 jurados menos los descuentos de los jueces fiscales) y el barista ve la devolución.

create table public.jurados (
  n             smallint primary key check (n between 1 and 3),
  clave         text unique,
  clave_version integer not null default 1
);
insert into public.jurados (n) values (1), (2), (3);

create table public.evaluaciones (
  barista_id  uuid not null references public.baristas (id) on delete cascade,
  ronda       smallint not null check (ronda between 1 and 4),
  jurado      smallint not null references public.jurados (n),
  valores     jsonb not null default '{}'::jsonb,          -- puntaje de cada ítem de la planilla
  comentario  text not null default '' check (length(comentario) <= 500),
  updated_at  timestamptz not null default now(),
  primary key (barista_id, ronda, jurado)
);
create index evaluaciones_ronda on public.evaluaciones (ronda);

-- Puntos que descuentan los jueces fiscales (1 por cada "No cumple").
alter table public.puntajes add column descuento smallint not null default 0 check (descuento between 0 and 20);

alter table public.jurados      enable row level security;
alter table public.evaluaciones enable row level security;
revoke all on public.jurados, public.evaluaciones from anon, authenticated;
