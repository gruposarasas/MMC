-- Votaciones del público y perfiles de los baristas.
--   · Stand más lindo: cada visitante vota una sola vez a una marca.
--   · Barista favorito: cada visitante vota una sola vez a un barista.
--   · Mensajes de aliento de los visitantes a los baristas (administración puede ocultarlos).
--   · Cada barista entra con su clave a /barista y completa su perfil.

alter table public.baristas
  add column clave         text unique,
  add column clave_version integer not null default 1,
  add column tel           text not null default '' check (tel ~ '^[0-9]{0,13}$'),
  add column foto_path     text,
  add column historia      text not null default '' check (length(historia) <= 700),
  add column hobby         text not null default '' check (length(hobby) <= 200),
  add column experiencia   text not null default '' check (length(experiencia) <= 700),
  add column por_que       text not null default '' check (length(por_que) <= 700),
  add column perfil_at     timestamptz;

create table public.votos_stand (
  visitante_id uuid primary key references public.visitantes (id) on delete cascade,  -- un voto por visitante
  marca_id     uuid not null references public.marcas (id) on delete cascade,
  created_at   timestamptz not null default now()
);
create index votos_stand_marca on public.votos_stand (marca_id);

create table public.votos_barista (
  visitante_id uuid primary key references public.visitantes (id) on delete cascade,  -- un voto por visitante
  barista_id   uuid not null references public.baristas (id) on delete cascade,
  created_at   timestamptz not null default now()
);
create index votos_barista_barista on public.votos_barista (barista_id);

create table public.mensajes_barista (
  id           bigint generated always as identity primary key,
  barista_id   uuid not null references public.baristas (id) on delete cascade,
  visitante_id uuid not null references public.visitantes (id) on delete cascade,
  texto        text not null check (length(btrim(texto)) between 1 and 280),
  oculto       boolean not null default false,
  created_at   timestamptz not null default now()
);
create index mensajes_barista_barista on public.mensajes_barista (barista_id, created_at desc);

alter table public.votos_stand      enable row level security;
alter table public.votos_barista    enable row level security;
alter table public.mensajes_barista enable row level security;
revoke all on public.votos_stand, public.votos_barista, public.mensajes_barista from anon, authenticated;
