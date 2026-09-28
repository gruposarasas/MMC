-- Mundial de Café: esquema base.
-- Todo el acceso pasa por el servidor de Next.js con la service role.
-- RLS activado y sin políticas: con la anon key no se lee ni se escribe nada.

-- ---------------------------------------------------------------- marcas
create table public.marcas (
  id               uuid primary key default gen_random_uuid(),
  orden            integer not null default 1000,
  nombre           text not null unique check (length(btrim(nombre)) between 1 and 80),
  stand            text not null default '' check (length(stand) <= 40),
  beneficio        text not null default '' check (length(beneficio) <= 34),
  condiciones      text not null default '' check (length(condiciones) <= 240),
  creditos         smallint not null default 1 check (creditos between 1 and 10),
  codigo           text not null unique check (codigo ~ '^[0-9]{4}$'),
  clave            text not null unique check (clave ~ '^[A-Z0-9]+-[A-Z0-9]+$'),
  clave_version    integer not null default 1,
  logo_path        text,
  emblema          text not null default 'taza'
                   check (emblema in ('taza','flor','planta','chemex','grano','copa','reloj','jarra','estrella','ondas')),
  activa           boolean not null default false,
  vence            date not null default '2026-10-04' check (vence >= date '2026-10-04'),
  sucursales       text not null default '' check (length(sucursales) <= 300),
  responsable      text not null default '' check (length(responsable) <= 80),
  tel_responsable  text not null default '' check (tel_responsable ~ '^[0-9]{0,13}$'),
  enviado_at       timestamptz,
  eliminada        boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------- visitantes
create table public.visitantes (
  id               uuid primary key default gen_random_uuid(),
  nombre           text not null check (length(nombre) between 3 and 120),
  nacimiento       date not null check (nacimiento > date '1900-01-01'),
  mail             text unique check (mail is null or (mail = lower(mail) and length(mail) <= 200 and mail ~ '^[^[:space:]@]+@[^[:space:]@]+\.[a-z]{2,}$')),
  whatsapp         text unique check (whatsapp is null or whatsapp ~ '^[0-9]{10,11}$'),
  novedades        boolean not null,
  acepto_datos_at  timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  constraint visitantes_un_contacto check (num_nonnulls(mail, whatsapp) = 1)
);
create index visitantes_created_at on public.visitantes (created_at desc);

-- ---------------------------------------------------------------- canjes
create sequence public.canje_numero;

create table public.canjes (
  id               uuid primary key default gen_random_uuid(),
  numero           bigint not null unique default nextval('public.canje_numero'),
  visitante_id     uuid not null references public.visitantes (id) on delete restrict,
  marca_id         uuid not null references public.marcas (id) on delete restrict,
  beneficio        text not null,              -- copia al momento del canje, para liquidar
  post_evento      boolean not null,
  created_at       timestamptz not null default now()
);
alter sequence public.canje_numero owned by public.canjes.numero;
create index canjes_visitante_marca on public.canjes (visitante_id, marca_id);
create index canjes_marca_fecha on public.canjes (marca_id, created_at desc);
create index canjes_fecha on public.canjes (created_at desc);

-- ---------------------------------------------------------------- intentos fallidos
create table public.intentos_canje (
  visitante_id     uuid not null references public.visitantes (id) on delete cascade,
  marca_id         uuid not null references public.marcas (id) on delete cascade,
  fallos           smallint not null default 0,
  bloqueado_hasta  timestamptz,
  primary key (visitante_id, marca_id)
);

-- ---------------------------------------------------------------- utilidades
create function public.hoy_mendoza() returns date
language sql stable set search_path = pg_catalog
as $$ select (now() at time zone 'America/Argentina/Mendoza')::date $$;

create function public.tocar_updated_at() returns trigger
language plpgsql set search_path = pg_catalog
as $$ begin new.updated_at := now(); return new; end $$;

create trigger marcas_updated_at before update on public.marcas
for each row execute function public.tocar_updated_at();

-- ---------------------------------------------------------------- registro
-- Crea el visitante o, si el mail o el WhatsApp ya existen, devuelve esa billetera.
-- Es seguro ante dos registros simultáneos con el mismo contacto.
create function public.registrar_visitante(
  p_nombre text, p_nacimiento date, p_mail text, p_whatsapp text, p_novedades boolean
) returns jsonb
language plpgsql set search_path = public, pg_temp
as $$
declare
  nuevo uuid;
  existente uuid;
begin
  insert into visitantes (nombre, nacimiento, mail, whatsapp, novedades)
  values (p_nombre, p_nacimiento, p_mail, p_whatsapp, p_novedades)
  on conflict do nothing
  returning id into nuevo;

  if nuevo is not null then
    return jsonb_build_object('id', nuevo, 'ya_existia', false);
  end if;

  select id into existente from visitantes
  where (p_mail is not null and mail = p_mail) or (p_whatsapp is not null and whatsapp = p_whatsapp)
  limit 1;
  return jsonb_build_object('id', existente, 'ya_existia', true);
end $$;

-- ---------------------------------------------------------------- canje
-- Valida y registra un canje en una sola transacción.
-- Bloquea la fila del visitante: todos sus canjes pasan de a uno, así que dos
-- pedidos simultáneos nunca superan los créditos.
-- Devuelve un estado en vez de lanzar errores para que el contador de fallos
-- no se pierda con un rollback.
create function public.canjear(p_visitante uuid, p_marca uuid, p_codigo text)
returns jsonb
language plpgsql set search_path = public, pg_temp
as $$
declare
  v        visitantes%rowtype;
  m        marcas%rowtype;
  it       intentos_canje%rowtype;
  usados   integer;
  c        canjes%rowtype;
begin
  select * into v from visitantes where id = p_visitante for update;
  if not found then
    return jsonb_build_object('estado', 'sin_visitante');
  end if;

  select * into m from marcas where id = p_marca;
  if not found or not m.activa or m.eliminada or m.beneficio = '' then
    return jsonb_build_object('estado', 'no_disponible');
  end if;

  insert into intentos_canje (visitante_id, marca_id) values (p_visitante, p_marca)
  on conflict do nothing;
  select * into it from intentos_canje where visitante_id = p_visitante and marca_id = p_marca;

  if it.bloqueado_hasta is not null and it.bloqueado_hasta > now() then
    return jsonb_build_object('estado', 'bloqueado',
      'segundos', ceil(extract(epoch from it.bloqueado_hasta - now()))::int);
  end if;

  if p_codigo is distinct from m.codigo then
    if it.fallos + 1 >= 3 then
      update intentos_canje set fallos = 0, bloqueado_hasta = now() + interval '60 seconds'
      where visitante_id = p_visitante and marca_id = p_marca;
      return jsonb_build_object('estado', 'bloqueado', 'segundos', 60);
    end if;
    update intentos_canje set fallos = fallos + 1
    where visitante_id = p_visitante and marca_id = p_marca;
    return jsonb_build_object('estado', 'codigo_incorrecto', 'quedan', 3 - (it.fallos + 1));
  end if;

  if it.fallos <> 0 then
    update intentos_canje set fallos = 0 where visitante_id = p_visitante and marca_id = p_marca;
  end if;

  if hoy_mendoza() > m.vence then
    return jsonb_build_object('estado', 'vencida', 'vence', m.vence);
  end if;

  select count(*) into usados from canjes where visitante_id = p_visitante and marca_id = p_marca;
  if usados >= m.creditos then
    return jsonb_build_object('estado', 'sin_creditos');
  end if;

  insert into canjes (visitante_id, marca_id, beneficio, post_evento)
  values (p_visitante, p_marca, m.beneficio, hoy_mendoza() > date '2026-10-04')
  returning * into c;

  return jsonb_build_object(
    'estado', 'ok',
    'id', c.id,
    'numero', c.numero,
    'creado', c.created_at,
    'restantes', greatest(0, m.creditos - usados - 1),
    'creditos', m.creditos,
    'marca', m.nombre,
    'beneficio', m.beneficio,
    'nombre', v.nombre
  );
end $$;

-- ---------------------------------------------------------------- resumen del back office
create function public.resumen_admin() returns jsonb
language sql stable set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'visitantes', (select count(*) from visitantes),
    'canjes', (select count(*) from canjes),
    'con_canje', (select count(distinct visitante_id) from canjes),
    'post_evento', (select count(*) from canjes where post_evento),
    'ranking', coalesce((
      select jsonb_agg(jsonb_build_object('id', m.id, 'nombre', m.nombre, 'canjes', coalesce(n.canjes, 0))
                       order by coalesce(n.canjes, 0) desc, m.orden)
      from marcas m
      left join (select marca_id, count(*) canjes from canjes group by marca_id) n on n.marca_id = m.id
      where not m.eliminada or n.canjes > 0
    ), '[]'::jsonb)
  )
$$;

-- ---------------------------------------------------------------- seguridad
alter table public.marcas          enable row level security;
alter table public.visitantes      enable row level security;
alter table public.canjes          enable row level security;
alter table public.intentos_canje  enable row level security;

revoke all on public.marcas, public.visitantes, public.canjes, public.intentos_canje from anon, authenticated;
revoke all on sequence public.canje_numero from anon, authenticated;

revoke execute on function public.registrar_visitante(text, date, text, text, boolean) from public, anon, authenticated;
revoke execute on function public.canjear(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.resumen_admin() from public, anon, authenticated;
revoke execute on function public.hoy_mendoza() from public, anon, authenticated;
revoke execute on function public.tocar_updated_at() from public, anon, authenticated;

grant execute on function public.registrar_visitante(text, date, text, text, boolean) to service_role;
grant execute on function public.canjear(uuid, uuid, text) to service_role;
grant execute on function public.resumen_admin() to service_role;
grant execute on function public.hoy_mendoza() to service_role;
