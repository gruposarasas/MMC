-- Torneo de baristas: clasificación (puntaje de 1 a 10 con un decimal) y playoff de 16.

create table public.baristas (
  id           uuid primary key default gen_random_uuid(),
  nombre       text not null check (length(btrim(nombre)) between 1 and 80),
  cafeteria    text not null default '' check (length(cafeteria) <= 80),
  puntaje      numeric(3,1) check (puntaje between 1 and 10),
  puntuado_at  timestamptz,
  desempate    smallint not null default 0,   -- a igual puntaje, más alto va primero
  created_at   timestamptz not null default now()
);

-- Estado del torneo: una sola fila.
create table public.torneo (
  id          smallint primary key default 1 check (id = 1),
  fase        text not null default 'clasificacion' check (fase in ('clasificacion', 'playoff')),
  pantalla    text not null default 'auto' check (pantalla in ('auto', 'clasificacion', 'llaves')),
  updated_at  timestamptz not null default now()
);
insert into public.torneo default values;

-- Partidos del playoff. Octavos O1–O8, cuartos C1–C4, semis S1–S2, tercer puesto T, final F.
create table public.partidos (
  id          text primary key check (id in ('O1','O2','O3','O4','O5','O6','O7','O8','C1','C2','C3','C4','S1','S2','T','F')),
  a           uuid references public.baristas (id) on delete set null,
  b           uuid references public.baristas (id) on delete set null,
  puntaje_a   numeric(3,1) check (puntaje_a between 0 and 10),
  puntaje_b   numeric(3,1) check (puntaje_b between 0 and 10),
  ganador     uuid references public.baristas (id) on delete set null,
  updated_at  timestamptz not null default now()
);

alter table public.baristas enable row level security;
alter table public.torneo   enable row level security;
alter table public.partidos enable row level security;
revoke all on public.baristas, public.torneo, public.partidos from anon, authenticated;
