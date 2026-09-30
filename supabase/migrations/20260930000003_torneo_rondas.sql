-- Torneo de baristas por rondas de puntaje:
--   Ronda 1: todos (pasan 16) · Ronda 2: 16 (pasan 6) · Ronda 3: 6 (pasan 2; 3° y 4° puesto) · Final: 1 vs 1.
-- Cada ronda se puntúa de cero (1 a 10 con un decimal). Reemplaza al playoff de llaves.

drop table if exists public.partidos;

alter table public.baristas drop column if exists puntaje;
alter table public.baristas drop column if exists puntuado_at;
alter table public.baristas drop column if exists desempate;
alter table public.baristas add column orden integer not null default 1000;   -- orden de competencia en la ronda 1
alter table public.baristas add column turno text not null default '' check (length(turno) <= 40); -- "Sáb 10:30 · Mesa 1"

-- Quién compite en cada ronda y con qué puntaje. La ronda 1 incluye a todos los baristas
-- (la fila se crea al puntuar); las rondas 2, 3 y la final (4) se crean al cerrar la ronda anterior.
create table public.puntajes (
  barista_id   uuid not null references public.baristas (id) on delete cascade,
  ronda        smallint not null check (ronda between 1 and 4),
  semilla      smallint,                       -- puesto con el que llegó desde la ronda anterior
  puntaje      numeric(3,1) check (puntaje between 1 and 10),
  desempate    smallint not null default 0,    -- a igual puntaje, más alto va primero
  puntuado_at  timestamptz,
  primary key (barista_id, ronda)
);
create index puntajes_ronda on public.puntajes (ronda);

alter table public.torneo drop constraint if exists torneo_fase_check;
alter table public.torneo drop constraint if exists torneo_pantalla_check;
update public.torneo set fase = 'r1', pantalla = 'auto';
alter table public.torneo alter column fase set default 'r1';
alter table public.torneo add constraint torneo_fase_check check (fase in ('r1', 'r2', 'r3', 'final'));
alter table public.torneo add constraint torneo_pantalla_check check (pantalla in ('auto', 'r1', 'r2', 'r3', 'final'));

alter table public.puntajes enable row level security;
revoke all on public.puntajes from anon, authenticated;
