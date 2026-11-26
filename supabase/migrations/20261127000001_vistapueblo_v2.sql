-- Gift cards de Vistapueblo, segunda parte:
--   · tarjetas impresas (voucher en papel, con QR fijo) y modo de uso: billetera (saldo en varias visitas) o consumo total (una sola vez);
--   · cada consumo guarda el ticket total, las personas de la mesa y, en consumo total, el saldo que se perdió;
--   · cada local tiene una clave para entrar a su panel (/vistapueblo/local);
--   · avisos al cliente en el celular (notificaciones push) y la configuración que necesitan.

-- Tarjetas -------------------------------------------------------------------------------------------
alter table public.vp_tarjetas drop constraint if exists vp_tarjetas_nombre_check;
alter table public.vp_tarjetas add constraint vp_tarjetas_nombre_check check (length(nombre) <= 120);   -- impresa: puede ir sin nombre
alter table public.vp_tarjetas
  add column modo    text    not null default 'saldo' check (modo in ('saldo', 'unico')),
  add column impresa boolean not null default false;

-- Consumos -------------------------------------------------------------------------------------------
alter table public.vp_consumos
  add column ticket   integer,
  add column personas smallint check (personas between 1 and 99),
  add column perdido  integer not null default 0 check (perdido >= 0);   -- consumo total: lo que quedó sin usar
update public.vp_consumos set ticket = monto where ticket is null;
alter table public.vp_consumos alter column ticket set not null;
alter table public.vp_consumos add constraint vp_consumos_ticket_check check (ticket >= monto);

-- Clave del panel de cada local (se sortea acá: el repositorio es público) ----------------------------
alter table public.vp_locales add column clave text, add column clave_version integer not null default 1;
update public.vp_locales l
   set clave = (select string_agg(substr('23456789ABCDEFGHJKLMNPQRSTUVWXYZ', 1 + floor(random() * 32)::int, 1), '')
                  from generate_series(1, 8) where l.id is not null);
alter table public.vp_locales alter column clave set not null;
alter table public.vp_locales add constraint vp_locales_clave_key unique (clave);
alter table public.vp_locales add constraint vp_locales_clave_check check (clave ~ '^[0-9A-Z]{8}$');

-- Avisos push ----------------------------------------------------------------------------------------
create table public.vp_suscripciones (
  id          uuid primary key default gen_random_uuid(),
  tarjeta_id  uuid not null references public.vp_tarjetas (id) on delete cascade,
  endpoint    text not null unique check (length(endpoint) <= 1000),
  p256dh      text not null check (length(p256dh) <= 200),
  auth        text not null check (length(auth) <= 100),
  created_at  timestamptz not null default now()
);
create index vp_suscripciones_tarjeta on public.vp_suscripciones (tarjeta_id);

-- Claves VAPID de las notificaciones (las genera el servidor la primera vez).
create table public.vp_config (
  clave  text primary key,
  valor  text not null
);

-- Consumo: ahora con ticket, personas y modo consumo total ------------------------------------------
drop function public.vp_consumir(text, uuid, integer, integer, text);
create function public.vp_consumir(p_token text, p_local uuid, p_pin_version integer, p_monto integer, p_cajero text,
                                   p_ticket integer default null, p_personas integer default null)
returns jsonb
language plpgsql set search_path = public, pg_temp
as $$
declare
  t vp_tarjetas%rowtype;
  l vp_locales%rowtype;
  c vp_consumos%rowtype;
  local_part integer;
  v_ticket integer;
  v_perdido integer := 0;
  v_saldo integer;
begin
  select * into l from vp_locales where id = p_local;
  if not found or not l.activo or l.pin_version <> p_pin_version then
    return jsonb_build_object('estado', 'caja_invalida');
  end if;

  select * into t from vp_tarjetas where token = p_token for update;
  if not found then return jsonb_build_object('estado', 'no_existe'); end if;
  if t.anulada then return jsonb_build_object('estado', 'anulada'); end if;
  if t.saldo <= 0 then return jsonb_build_object('estado', 'agotada'); end if;
  if hoy_mendoza() > t.vence then return jsonb_build_object('estado', 'vencida', 'vence', t.vence); end if;
  if not t.todos_los_locales and not (p_local = any (t.locales)) then
    return jsonb_build_object('estado', 'local_no_incluido');
  end if;
  if p_monto is null or p_monto <= 0 then return jsonb_build_object('estado', 'monto_invalido'); end if;
  if p_monto > t.saldo then return jsonb_build_object('estado', 'saldo_insuficiente', 'saldo', t.saldo); end if;
  v_ticket := coalesce(p_ticket, p_monto);
  if v_ticket < p_monto or v_ticket > 100000000 then return jsonb_build_object('estado', 'ticket_invalido'); end if;

  if t.modo = 'unico' then
    v_perdido := t.saldo - p_monto;      -- consumo total: la tarjeta se usa una vez y lo que sobra se pierde
    v_saldo := 0;
  else
    v_saldo := t.saldo - p_monto;
  end if;

  local_part := round(p_monto * l.porcentaje / 100.0);
  insert into vp_consumos (tarjeta_id, local_id, monto, porcentaje, a_cargo_local, a_cargo_vp, cajero, ticket, personas, perdido)
  values (t.id, l.id, p_monto, l.porcentaje, local_part, p_monto - local_part, left(coalesce(trim(p_cajero), ''), 60),
          v_ticket, case when p_personas between 1 and 99 then p_personas end, v_perdido)
  returning * into c;
  update vp_tarjetas set saldo = v_saldo where id = t.id;

  return jsonb_build_object('estado', 'ok', 'numero', c.numero, 'creado', c.created_at, 'monto', p_monto, 'ticket', v_ticket,
    'perdido', v_perdido, 'saldo', v_saldo, 'local', l.nombre, 'nombre', t.nombre, 'tarjeta', t.numero, 'tarjeta_id', t.id);
end $$;

-- Anular devuelve también lo que se había perdido en un consumo total.
create or replace function public.vp_anular_consumo(p_consumo uuid, p_motivo text)
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
  update vp_tarjetas set saldo = least(monto, saldo + c.monto + c.perdido) where id = c.tarjeta_id;
  return jsonb_build_object('estado', 'ok');
end $$;

alter table public.vp_suscripciones enable row level security;
alter table public.vp_config        enable row level security;
revoke all on public.vp_suscripciones, public.vp_config from anon, authenticated;
revoke execute on function public.vp_consumir(text, uuid, integer, integer, text, integer, integer) from public, anon, authenticated;
grant execute on function public.vp_consumir(text, uuid, integer, integer, text, integer, integer) to service_role;
