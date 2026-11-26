-- Gift cards de Vistapueblo (demo), en /vistapueblo.
--   · vp_locales: los restaurantes del complejo, con el % del consumo que absorbe cada uno y el PIN de su caja.
--   · vp_tarjetas: cada gift card (monto, saldo, vencimiento, locales donde vale). Se usa por partes hasta agotar el saldo.
--   · vp_consumos: cada uso en una caja, con el reparto del costo (local / Vistapueblo) congelado al momento del consumo.
-- Todo pasa por el servidor con la service role: RLS activado, sin políticas, sin permisos para anon/authenticated.

create table public.vp_locales (
  id           uuid primary key default gen_random_uuid(),
  nombre       text not null unique check (length(nombre) between 2 and 60),
  orden        integer not null default 100,
  porcentaje   numeric(5,2) not null default 0 check (porcentaje between 0 and 100),  -- % del consumo que absorbe el local
  pin          text not null unique check (pin ~ '^[0-9]{4}$'),
  pin_version  integer not null default 1,      -- cambiar el PIN cierra las cajas abiertas
  activo       boolean not null default true,
  created_at   timestamptz not null default now()
);

-- Los PIN se sortean acá (el repositorio es público): se ven y se cambian en el backoffice → Locales.
with l(nombre, orden, porcentaje) as (values
  ('Modesto Alvear', 1, 30), ('La Social', 2, 0), ('Piba', 3, 0), ('Candel', 4, 0),
  ('Vino Bien', 5, 0), ('Urrutigoity', 6, 0), ('Sushi Club', 7, 0), ('Queen', 8, 0)),
p as (select g::text pin, row_number() over (order by random()) n from generate_series(1000, 9999) g)
insert into public.vp_locales (nombre, orden, porcentaje, pin)
select l.nombre, l.orden, l.porcentaje, p.pin from l join p on p.n = l.orden;

create table public.vp_tarjetas (
  id               uuid primary key default gen_random_uuid(),
  numero           bigint generated always as identity (start with 1001) unique,
  token            text not null unique check (token ~ '^[A-Za-z0-9_-]{24,64}$'),   -- va en el link y el QR
  codigo           text not null unique check (codigo ~ '^VP-[0-9A-Z]{4}-[0-9A-Z]{4}$'), -- para tipear si el QR no lee
  nombre           text not null check (length(nombre) between 2 and 120),
  mail             text not null default '' check (length(mail) <= 200),
  whatsapp         text not null default '' check (whatsapp ~ '^[0-9]{0,13}$'),
  monto            integer not null check (monto between 1000 and 10000000),
  saldo            integer not null check (saldo >= 0 and saldo <= monto),
  vence            date not null,
  todos_los_locales boolean not null default true,
  locales          uuid[] not null default '{}',
  mensaje          text not null default '' check (length(mensaje) <= 300),
  lote             text not null default '' check (length(lote) <= 80),
  anulada          boolean not null default false,
  anulada_at       timestamptz,
  enviada_wa_at    timestamptz,
  enviada_mail_at  timestamptz,
  vista_at         timestamptz,
  created_at       timestamptz not null default now(),
  check (todos_los_locales or cardinality(locales) > 0)
);
create index vp_tarjetas_creada on public.vp_tarjetas (created_at desc);

create table public.vp_consumos (
  id            uuid primary key default gen_random_uuid(),
  numero        bigint generated always as identity (start with 1) unique,
  tarjeta_id    uuid not null references public.vp_tarjetas (id) on delete cascade,
  local_id      uuid not null references public.vp_locales (id),
  monto         integer not null check (monto > 0),
  porcentaje    numeric(5,2) not null,     -- % que absorbía el local en ese momento
  a_cargo_local integer not null,          -- lo absorbe el local
  a_cargo_vp    integer not null,          -- lo cubre Vistapueblo (se descuenta del alquiler del local)
  cajero        text not null default '' check (length(cajero) <= 60),
  anulado       boolean not null default false,
  anulado_at    timestamptz,
  anulado_motivo text not null default '' check (length(anulado_motivo) <= 200),
  created_at    timestamptz not null default now()
);
create index vp_consumos_fecha on public.vp_consumos (created_at desc);
create index vp_consumos_local on public.vp_consumos (local_id, created_at desc);
create index vp_consumos_tarjeta on public.vp_consumos (tarjeta_id);

-- Registra un consumo en una sola transacción: bloquea la tarjeta, así dos cajas a la vez nunca superan el saldo.
-- Devuelve un estado en vez de lanzar errores.
create function public.vp_consumir(p_token text, p_local uuid, p_pin_version integer, p_monto integer, p_cajero text)
returns jsonb
language plpgsql set search_path = public, pg_temp
as $$
declare
  t vp_tarjetas%rowtype;
  l vp_locales%rowtype;
  c vp_consumos%rowtype;
  local_part integer;
begin
  select * into l from vp_locales where id = p_local;
  if not found or not l.activo or l.pin_version <> p_pin_version then
    return jsonb_build_object('estado', 'caja_invalida');
  end if;

  select * into t from vp_tarjetas where token = p_token for update;
  if not found then return jsonb_build_object('estado', 'no_existe'); end if;
  if t.anulada then return jsonb_build_object('estado', 'anulada'); end if;
  if hoy_mendoza() > t.vence then return jsonb_build_object('estado', 'vencida', 'vence', t.vence); end if;
  if not t.todos_los_locales and not (p_local = any (t.locales)) then
    return jsonb_build_object('estado', 'local_no_incluido');
  end if;
  if p_monto is null or p_monto <= 0 then return jsonb_build_object('estado', 'monto_invalido'); end if;
  if p_monto > t.saldo then return jsonb_build_object('estado', 'saldo_insuficiente', 'saldo', t.saldo); end if;

  local_part := round(p_monto * l.porcentaje / 100.0);
  insert into vp_consumos (tarjeta_id, local_id, monto, porcentaje, a_cargo_local, a_cargo_vp, cajero)
  values (t.id, l.id, p_monto, l.porcentaje, local_part, p_monto - local_part, left(coalesce(trim(p_cajero), ''), 60))
  returning * into c;
  update vp_tarjetas set saldo = saldo - p_monto where id = t.id;

  return jsonb_build_object('estado', 'ok', 'numero', c.numero, 'creado', c.created_at, 'monto', p_monto,
    'saldo', t.saldo - p_monto, 'local', l.nombre, 'nombre', t.nombre, 'tarjeta', t.numero);
end $$;

-- Administración anula un consumo (por error de carga): devuelve el monto al saldo y lo saca de la cuenta corriente.
create function public.vp_anular_consumo(p_consumo uuid, p_motivo text)
returns jsonb
language plpgsql set search_path = public, pg_temp
as $$
declare c vp_consumos%rowtype;
begin
  select * into c from vp_consumos where id = p_consumo for update;
  if not found then return jsonb_build_object('estado', 'no_existe'); end if;
  if c.anulado then return jsonb_build_object('estado', 'ya_anulado'); end if;
  perform 1 from vp_tarjetas where id = c.tarjeta_id for update;
  update vp_consumos set anulado = true, anulado_at = now(), anulado_motivo = left(coalesce(trim(p_motivo), ''), 200) where id = c.id;
  update vp_tarjetas set saldo = least(monto, saldo + c.monto) where id = c.tarjeta_id;
  return jsonb_build_object('estado', 'ok');
end $$;

alter table public.vp_locales  enable row level security;
alter table public.vp_tarjetas enable row level security;
alter table public.vp_consumos enable row level security;
revoke all on public.vp_locales, public.vp_tarjetas, public.vp_consumos from anon, authenticated;
revoke execute on function public.vp_consumir(text, uuid, integer, integer, text) from public, anon, authenticated;
revoke execute on function public.vp_anular_consumo(uuid, text) from public, anon, authenticated;
grant execute on function public.vp_consumir(text, uuid, integer, integer, text) to service_role;
grant execute on function public.vp_anular_consumo(uuid, text) to service_role;
