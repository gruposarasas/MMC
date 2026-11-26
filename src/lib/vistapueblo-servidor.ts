// Gift cards de Vistapueblo: sesiones, altas y consultas. Solo servidor.
import { randomBytes, randomInt } from 'node:crypto';
import { db } from './supabase';
import { leer, COOKIE_VP_ADMIN, COOKIE_VP_CAJA } from './sesion';
import { envRuntime, URL_PUBLICA } from './config';
import { hoyMendoza, type NuevaTarjeta } from './vistapueblo';

/** Contraseña del backoffice: VISTAPUEBLO_PASSWORD o, si no está cargada, la de administración. */
export const claveBackoffice = () => envRuntime('VISTAPUEBLO_PASSWORD') || envRuntime('ADMIN_PASSWORD') || '';

export const linkTarjeta = (token: string) => `${URL_PUBLICA}/vistapueblo/g/${token}`;

export async function esAdminVP() {
  return (await leer(COOKIE_VP_ADMIN)) === 'ok';
}

// ------------------------------------------------------------ locales
export type Local = { id: string; nombre: string; orden: number; porcentaje: number; pin: string; pin_version: number; activo: boolean };

export async function locales(): Promise<Local[]> {
  const { data, error } = await db().from('vp_locales').select('id, nombre, orden, porcentaje, pin, pin_version, activo').order('orden').order('nombre');
  if (error) throw error;
  return (data || []).map((l) => ({ ...l, porcentaje: Number(l.porcentaje) })) as Local[];
}

/** Locales sin el PIN, para pantallas que no son de administración. */
export async function localesPublicos() {
  return (await locales()).filter((l) => l.activo).map(({ id, nombre }) => ({ id, nombre }));
}

/** La caja de este dispositivo (cookie "local:versión del PIN"). */
export async function cajaActual() {
  const v = await leer(COOKIE_VP_CAJA);
  if (!v) return null;
  const [id, version] = v.split(':');
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await db().from('vp_locales').select('id, nombre, pin_version, activo').eq('id', id).maybeSingle();
  if (!data || !data.activo || String(data.pin_version) !== version) return null;
  return { id: data.id as string, nombre: data.nombre as string, pin_version: data.pin_version as number };
}

// ------------------------------------------------------------ tarjetas
export type Tarjeta = {
  id: string; numero: number; token: string; codigo: string; nombre: string; mail: string; whatsapp: string;
  monto: number; saldo: number; vence: string; todos_los_locales: boolean; locales: string[]; mensaje: string; lote: string;
  anulada: boolean; anulada_at: string | null; enviada_wa_at: string | null; enviada_mail_at: string | null; vista_at: string | null; created_at: string;
};
const COLS = 'id, numero, token, codigo, nombre, mail, whatsapp, monto, saldo, vence, todos_los_locales, locales, mensaje, lote, anulada, anulada_at, enviada_wa_at, enviada_mail_at, vista_at, created_at';

const ALFABETO = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // sin 0/O ni 1/I para tipear sin errores
const bloque = () => Array.from({ length: 4 }, () => ALFABETO[randomInt(ALFABETO.length)]).join('');
const nuevoCodigo = () => `VP-${bloque()}-${bloque()}`;
const nuevoToken = () => randomBytes(24).toString('base64url');

export type Opciones = { vence: string; todos: boolean; locales: string[]; mensaje: string; lote: string };

/** Crea las gift cards (de a una o un lote del Excel). */
export async function crearTarjetas(filas: NuevaTarjeta[], o: Opciones) {
  const base = { vence: o.vence, todos_los_locales: o.todos, locales: o.todos ? [] : o.locales, mensaje: o.mensaje, lote: o.lote };
  const creadas: Tarjeta[] = [];
  for (let i = 0; i < filas.length; i += 200) {
    const tanda = filas.slice(i, i + 200);
    for (let intento = 0; ; intento++) {
      const { data, error } = await db()
        .from('vp_tarjetas')
        .insert(tanda.map((f) => ({ ...base, ...f, saldo: f.monto, token: nuevoToken(), codigo: nuevoCodigo() })))
        .select(COLS);
      if (!error) {
        creadas.push(...((data || []) as Tarjeta[]));
        break;
      }
      // Un código repetido es muy raro: se vuelve a sortear la tanda.
      if (error.code !== '23505' || intento >= 3) throw error;
    }
  }
  return creadas;
}

export async function tarjetaPorToken(token: string) {
  if (!/^[A-Za-z0-9_-]{24,64}$/.test(token)) return null;
  const { data } = await db().from('vp_tarjetas').select(COLS).eq('token', token).maybeSingle();
  return (data as Tarjeta | null) ?? null;
}

export async function tarjetaPorCodigo(codigo: string) {
  const c = codigo.toUpperCase().replace(/[^0-9A-Z]/g, '');
  const m = /^VP([0-9A-Z]{4})([0-9A-Z]{4})$/.exec(c);
  if (!m) return null;
  const { data } = await db().from('vp_tarjetas').select(COLS).eq('codigo', `VP-${m[1]}-${m[2]}`).maybeSingle();
  return (data as Tarjeta | null) ?? null;
}

export async function tarjetaPorId(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await db().from('vp_tarjetas').select(COLS).eq('id', id).maybeSingle();
  return (data as Tarjeta | null) ?? null;
}

export type Consumo = {
  id: string; numero: number; tarjeta_id: string; local_id: string; monto: number; porcentaje: number; a_cargo_local: number; a_cargo_vp: number;
  cajero: string; anulado: boolean; anulado_motivo: string; created_at: string;
  local?: string; tarjeta?: { numero: number; nombre: string } | null;
};
const COLS_CONSUMO = 'id, numero, tarjeta_id, local_id, monto, porcentaje, a_cargo_local, a_cargo_vp, cajero, anulado, anulado_motivo, created_at, vp_locales(nombre), vp_tarjetas(numero, nombre)';

function armarConsumo(c: Record<string, unknown>): Consumo {
  return {
    ...(c as unknown as Consumo),
    porcentaje: Number(c.porcentaje),
    local: (c.vp_locales as { nombre: string } | null)?.nombre ?? '',
    tarjeta: (c.vp_tarjetas as { numero: number; nombre: string } | null) ?? null,
  };
}

export async function consumosDeTarjeta(id: string) {
  const { data, error } = await db().from('vp_consumos').select(COLS_CONSUMO).eq('tarjeta_id', id).order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(armarConsumo);
}

/** Consumos de un mes ('aaaa-mm'), opcionalmente de un local. Incluye los anulados (marcados). */
export async function consumosDelMes(mes: string, localId?: string) {
  const [a, m] = mes.split('-').map(Number);
  const desde = new Date(Date.UTC(a, m - 1, 1, 3)).toISOString(); // 00:00 en Mendoza (UTC-3)
  const hasta = new Date(Date.UTC(a, m, 1, 3)).toISOString();
  let q = db().from('vp_consumos').select(COLS_CONSUMO).gte('created_at', desde).lt('created_at', hasta);
  if (localId) q = q.eq('local_id', localId);
  const { data, error } = await q.order('created_at', { ascending: false }).limit(5000);
  if (error) throw error;
  return (data || []).map(armarConsumo);
}

/** Consumos de hoy en una caja (para el cierre del cajero). */
export async function consumosDeHoy(localId: string) {
  const hoy = hoyMendoza();
  const desde = new Date(`${hoy}T03:00:00Z`).toISOString();
  const { data, error } = await db().from('vp_consumos').select(COLS_CONSUMO).eq('local_id', localId).gte('created_at', desde).order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(armarConsumo);
}

/** Cuenta corriente del mes: por local, lo consumido y el reparto entre el local y Vistapueblo. */
export async function cuentaCorriente(mes: string) {
  const [cs, ls] = await Promise.all([consumosDelMes(mes), locales()]);
  const validos = cs.filter((c) => !c.anulado);
  const filas = ls.map((l) => {
    const de = validos.filter((c) => c.local_id === l.id);
    return {
      id: l.id, nombre: l.nombre, porcentaje: l.porcentaje, cantidad: de.length,
      consumido: de.reduce((s, c) => s + c.monto, 0),
      local: de.reduce((s, c) => s + c.a_cargo_local, 0),
      vp: de.reduce((s, c) => s + c.a_cargo_vp, 0),
    };
  });
  const total = filas.reduce((s, f) => ({ cantidad: s.cantidad + f.cantidad, consumido: s.consumido + f.consumido, local: s.local + f.local, vp: s.vp + f.vp }), { cantidad: 0, consumido: 0, local: 0, vp: 0 });
  return { filas, total, consumos: cs };
}

/** Todas las tarjetas (las últimas 2000). */
export async function todasLasTarjetas() {
  const { data, error } = await db().from('vp_tarjetas').select(COLS).order('created_at', { ascending: false }).limit(2000);
  if (error) throw error;
  return (data || []) as Tarjeta[];
}

/** Meses con consumos, para el selector de la cuenta corriente (siempre incluye el actual). */
export async function mesesConConsumos(actual: string) {
  const { data } = await db().from('vp_consumos').select('created_at').order('created_at', { ascending: true }).limit(1);
  const primero = data?.[0]?.created_at ? new Date(data[0].created_at as string).toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Mendoza' }).slice(0, 7) : actual;
  const out: string[] = [];
  let [a, m] = actual.split('-').map(Number);
  while (out.length < 24) {
    const k = `${a}-${String(m).padStart(2, '0')}`;
    out.push(k);
    if (k <= primero) break;
    m--;
    if (!m) { m = 12; a--; }
  }
  return out;
}
