// Gift cards de Vistapueblo: sesiones, altas y consultas. Solo servidor.
import { randomBytes, randomInt } from 'node:crypto';
import QRCode from 'qrcode';
import { NextResponse } from 'next/server';
import { db } from './supabase';
import { leer, hmac, igualSeguro, COOKIE_VP_ADMIN, COOKIE_VP_CAJA, COOKIE_VP_LOCAL } from './sesion';
import { envRuntime, URL_PUBLICA } from './config';
import { hoyMendoza, sumarDias, type NuevaTarjeta, type Modo } from './vistapueblo';

/** Contraseña del backoffice: VISTAPUEBLO_PASSWORD o, si no está cargada, la de administración. */
export const claveBackoffice = () => envRuntime('VISTAPUEBLO_PASSWORD') || envRuntime('ADMIN_PASSWORD') || '';

export const linkTarjeta = (token: string) => `${URL_PUBLICA}/vistapueblo/g/${token}`;

export async function esAdminVP() {
  return (await leer(COOKIE_VP_ADMIN)) === 'ok';
}

// ------------------------------------------------------------ locales
export type Local = { id: string; nombre: string; orden: number; porcentaje: number; pin: string; pin_version: number; activo: boolean; clave: string; clave_version: number };

export async function locales(): Promise<Local[]> {
  const { data, error } = await db().from('vp_locales').select('id, nombre, orden, porcentaje, pin, pin_version, activo, clave, clave_version').order('orden').order('nombre');
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

/** El local que entró a su panel (cookie "local:versión de la clave"). */
export async function localActual() {
  const v = await leer(COOKIE_VP_LOCAL);
  if (!v) return null;
  const [id, version] = v.split(':');
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await db().from('vp_locales').select('id, nombre, porcentaje, clave_version, activo').eq('id', id).maybeSingle();
  if (!data || String(data.clave_version) !== version) return null;
  return { id: data.id as string, nombre: data.nombre as string, porcentaje: Number(data.porcentaje), clave_version: data.clave_version as number };
}

const ALFA_CLAVE = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export const nuevaClaveLocal = () => Array.from({ length: 8 }, () => ALFA_CLAVE[randomInt(ALFA_CLAVE.length)]).join('');

// ------------------------------------------------------------ tarjetas
export type Tarjeta = {
  id: string; numero: number; token: string; codigo: string; nombre: string; mail: string; whatsapp: string;
  monto: number; saldo: number; vence: string; todos_los_locales: boolean; locales: string[]; mensaje: string; lote: string;
  modo: Modo; impresa: boolean; anulada: boolean; anulada_at: string | null; enviada_wa_at: string | null; enviada_mail_at: string | null; vista_at: string | null; created_at: string;
};
const COLS = 'id, numero, token, codigo, nombre, mail, whatsapp, monto, saldo, vence, todos_los_locales, locales, mensaje, lote, modo, impresa, anulada, anulada_at, enviada_wa_at, enviada_mail_at, vista_at, created_at';

const ALFABETO = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // sin 0/O ni 1/I para tipear sin errores
const bloque = () => Array.from({ length: 4 }, () => ALFABETO[randomInt(ALFABETO.length)]).join('');
const nuevoCodigo = () => `VP-${bloque()}-${bloque()}`;
const nuevoToken = () => randomBytes(24).toString('base64url');

export type Opciones = { vence: string; todos: boolean; locales: string[]; mensaje: string; lote: string; modo: Modo; impresa: boolean };

/** Crea las gift cards (de a una o un lote del Excel). */
export async function crearTarjetas(filas: NuevaTarjeta[], o: Opciones) {
  const base = { vence: o.vence, todos_los_locales: o.todos, locales: o.todos ? [] : o.locales, mensaje: o.mensaje, lote: o.lote, modo: o.modo, impresa: o.impresa };
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

export async function tarjetaPorNumero(numero: number) {
  if (!Number.isSafeInteger(numero) || numero <= 0) return null;
  const { data } = await db().from('vp_tarjetas').select(COLS).eq('numero', numero).maybeSingle();
  return (data as Tarjeta | null) ?? null;
}

export async function tarjetasPorIds(ids: string[]) {
  const v = ids.filter((x) => /^[0-9a-f-]{36}$/i.test(x)).slice(0, 100);
  if (!v.length) return [];
  const { data, error } = await db().from('vp_tarjetas').select(COLS).in('id', v).order('numero');
  if (error) throw error;
  return (data || []) as Tarjeta[];
}

export async function tarjetaPorId(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await db().from('vp_tarjetas').select(COLS).eq('id', id).maybeSingle();
  return (data as Tarjeta | null) ?? null;
}

export type Consumo = {
  id: string; numero: number; tarjeta_id: string; local_id: string; monto: number; porcentaje: number; a_cargo_local: number; a_cargo_vp: number;
  cajero: string; anulado: boolean; anulado_motivo: string; created_at: string; ticket: number; personas: number | null; perdido: number;
  local?: string; tarjeta?: { numero: number; nombre: string } | null;
};
const COLS_CONSUMO = 'id, numero, tarjeta_id, local_id, monto, porcentaje, a_cargo_local, a_cargo_vp, cajero, anulado, anulado_motivo, created_at, ticket, personas, perdido, vp_locales(nombre), vp_tarjetas(numero, nombre)';

function armarConsumo(c: Record<string, unknown>): Consumo {
  return {
    ...(c as unknown as Consumo),
    porcentaje: Number(c.porcentaje),
    local: (c.vp_locales as { nombre: string } | null)?.nombre ?? '',
    ticket: Number(c.ticket ?? c.monto),
    tarjeta: c.vp_tarjetas ? { numero: (c.vp_tarjetas as { numero: number }).numero, nombre: (c.vp_tarjetas as { nombre: string }).nombre || 'Al portador' } : null,
  };
}

export async function consumosDeTarjeta(id: string) {
  const { data, error } = await db().from('vp_consumos').select(COLS_CONSUMO).eq('tarjeta_id', id).order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(armarConsumo);
}

/** Consumos entre dos días ('aaaa-mm-dd', inclusive, en Mendoza), opcionalmente de un local. Incluye los anulados (marcados). */
export async function consumosEntre(desde: string, hasta: string, localId?: string) {
  const ini = new Date(`${desde}T03:00:00Z`).toISOString(); // 00:00 en Mendoza (UTC-3)
  const fin = new Date(`${sumarDias(hasta, 1)}T03:00:00Z`).toISOString();
  let q = db().from('vp_consumos').select(COLS_CONSUMO).gte('created_at', ini).lt('created_at', fin);
  if (localId) q = q.eq('local_id', localId);
  const { data, error } = await q.order('created_at', { ascending: false }).limit(10000);
  if (error) throw error;
  return (data || []).map(armarConsumo);
}

/** Consumos de un mes ('aaaa-mm'), opcionalmente de un local. */
export async function consumosDelMes(mes: string, localId?: string) {
  const [a, m] = mes.split('-').map(Number);
  const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return consumosEntre(`${mes}-01`, `${mes}-${String(ultimo).padStart(2, '0')}`, localId);
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
      ventas: de.reduce((s, c) => s + c.ticket, 0),
    };
  });
  const total = filas.reduce((s, f) => ({ cantidad: s.cantidad + f.cantidad, consumido: s.consumido + f.consumido, local: s.local + f.local, vp: s.vp + f.vp, ventas: s.ventas + f.ventas }), { cantidad: 0, consumido: 0, local: 0, vp: 0, ventas: 0 });
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

// ------------------------------------------------------------ QR que cambia y permiso de cobro
// La tarjeta digital muestra un QR que cambia cada 30 segundos: lleva el N° de la tarjeta, la ventana de tiempo y una firma.
// No lleva el token del link, así que una captura de pantalla no sirve después de un minuto y medio.
// El voucher impreso lleva un QR fijo (el papel es el que vale), con otra firma.
export const VENTANA_QR = 30;
export const ventanaActual = () => Math.floor(Date.now() / 1000 / VENTANA_QR);
const firmaQr = (id: string, w: number) => hmac(`vpq|${id}|${w}`).slice(0, 16);
const firmaImpresa = (id: string) => hmac(`vpi|${id}`).slice(0, 16);

export const claveQr = (t: { id: string; numero: number }, w = ventanaActual()) => `${t.numero}.${w}.${firmaQr(t.id, w)}`;
export const claveImpresa = (t: { id: string; numero: number }) => `${t.numero}.p.${firmaImpresa(t.id)}`;
export const linkCobro = (clave: string) => `${URL_PUBLICA}/vistapueblo/c/${clave}`;

/** Número de 6 cifras que acompaña al QR (por si la cámara no lee): cambia con el QR. */
export function numeroVivo(id: string, w = ventanaActual()) {
  return String(parseInt(hmac(`vpn|${id}|${w}`, 'hex').slice(0, 12), 16) % 1_000_000).padStart(6, '0');
}
export function numeroVivoValido(id: string, n: string) {
  const ahora = ventanaActual();
  return /^\d{6}$/.test(n) && [0, 1, 2].some((d) => igualSeguro(n, numeroVivo(id, ahora - d)));
}

export function leerClave(s: string) {
  const m = /^(\d{1,9})\.(p|\d{1,12})\.([A-Za-z0-9_-]{16})$/.exec(s);
  return m ? { numero: Number(m[1]), w: m[2] === 'p' ? null : Number(m[2]), firma: m[3] } : null;
}

/** El QR vale durante la ventana actual y las dos anteriores (hasta 90 segundos). */
export function validarClave(t: { id: string; impresa: boolean }, c: NonNullable<ReturnType<typeof leerClave>>): 'ok' | 'vencido' | 'invalido' {
  if (c.w === null) return t.impresa && igualSeguro(c.firma, firmaImpresa(t.id)) ? 'ok' : 'invalido';
  if (!igualSeguro(c.firma, firmaQr(t.id, c.w))) return 'invalido';
  const ahora = ventanaActual();
  return c.w <= ahora && c.w >= ahora - 2 ? 'ok' : 'vencido';
}

/** Permiso para cobrar una tarjeta en una caja durante 15 minutos (se da al escanear un QR válido). */
export function permisoCobro(id: string, localId: string) {
  const exp = Math.floor(Date.now() / 1000) + 15 * 60;
  return `${exp}.${hmac(`vpp|${id}|${localId}|${exp}`).slice(0, 22)}`;
}
export function permisoValido(p: string, id: string, localId: string) {
  const m = /^(\d{10})\.([A-Za-z0-9_-]{22})$/.exec(p || '');
  return !!m && Number(m[1]) >= Date.now() / 1000 && igualSeguro(m[2], hmac(`vpp|${id}|${localId}|${m[1]}`).slice(0, 22));
}

export const qrSvg = (texto: string) =>
  QRCode.toString(texto, { type: 'svg', errorCorrectionLevel: 'M', margin: 0, color: { dark: '#282929', light: '#ffffff' } });

/** Lo que la tarjeta del cliente necesita para mostrar el QR vivo. */
export async function qrVivo(t: { id: string; numero: number }) {
  const w = ventanaActual();
  return { w, svg: await qrSvg(linkCobro(claveQr(t, w))), numero: numeroVivo(t.id, w), restan: (w + 1) * VENTANA_QR * 1000 - Date.now() };
}

// ------------------------------------------------------------ métricas
export async function metricas(desde: string, hasta: string, localId?: string) {
  const ini = new Date(`${desde}T03:00:00Z`).toISOString();
  const fin = new Date(`${sumarDias(hasta, 1)}T03:00:00Z`).toISOString();
  const [cs, ls, em] = await Promise.all([
    consumosEntre(desde, hasta, localId),
    locales(),
    db().from('vp_tarjetas').select('id, monto, saldo, anulada, impresa').gte('created_at', ini).lt('created_at', fin).limit(10000),
  ]);
  const v = cs.filter((c) => !c.anulado);
  const suma = (xs: Consumo[], f: (c: Consumo) => number) => xs.reduce((s, c) => s + f(c), 0);
  const resumen = (xs: Consumo[]) => {
    const conPersonas = xs.filter((c) => c.personas);
    return {
      visitas: xs.length,
      personas: suma(conPersonas, (c) => c.personas || 0),
      mesasConPersonas: conPersonas.length,
      clientes: new Set(xs.map((c) => c.tarjeta_id)).size,
      consumido: suma(xs, (c) => c.monto),
      local: suma(xs, (c) => c.a_cargo_local),
      vp: suma(xs, (c) => c.a_cargo_vp),
      ventas: suma(xs, (c) => c.ticket),
      perdido: suma(xs, (c) => c.perdido),
    };
  };
  const total = resumen(v);
  const porLocal = ls
    .map((l) => ({ id: l.id, nombre: l.nombre, porcentaje: l.porcentaje, ...resumen(v.filter((c) => c.local_id === l.id)) }))
    .filter((f) => (localId ? f.id === localId : f.visitas > 0 || ls.some((l) => l.id === f.id && l.activo)));
  // Por día (o por mes, si el rango es largo) y por hora del día, en Mendoza.
  const dia = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Mendoza' });
  const hora = (iso: string) => Number(new Date(iso).toLocaleTimeString('en-GB', { timeZone: 'America/Argentina/Mendoza', hour: '2-digit', hour12: false }).slice(0, 2)) % 24;
  const largo = Date.parse(hasta) - Date.parse(desde) > 92 * 86400000;
  const claves: string[] = [];
  for (let d = desde; d <= hasta && claves.length < 800; d = sumarDias(d, 1)) { const k = largo ? d.slice(0, 7) : d; if (claves[claves.length - 1] !== k) claves.push(k); }
  const porFecha = claves.map((k) => { const xs = v.filter((c) => dia(c.created_at).startsWith(k)); return { k, consumido: suma(xs, (c) => c.monto), visitas: xs.length, personas: suma(xs, (c) => c.personas || 0) }; });
  const porHora = Array.from({ length: 24 }, (_, h) => ({ h, visitas: v.filter((c) => hora(c.created_at) === h).length }));
  const emitidas = (em.data || []).filter((t) => !t.anulada);
  return {
    total, porLocal, porFecha, agrupado: largo ? 'mes' as const : 'dia' as const, porHora, consumos: cs,
    emitidas: { cantidad: emitidas.length, monto: emitidas.reduce((s, t) => s + t.monto, 0), usadas: emitidas.filter((t) => t.saldo < t.monto).length, impresas: emitidas.filter((t) => t.impresa).length },
  };
}

// ------------------------------------------------------------ avisos push al cliente
let claves: { publica: string; privada: string } | null = null;

/** Claves VAPID de las notificaciones: se generan solas la primera vez y quedan en la base. */
export async function vapid() {
  if (claves) return claves;
  const leerClaves = async () => {
    const { data } = await db().from('vp_config').select('clave, valor').in('clave', ['vapid_publica', 'vapid_privada']);
    const pub = data?.find((x) => x.clave === 'vapid_publica')?.valor as string | undefined;
    const priv = data?.find((x) => x.clave === 'vapid_privada')?.valor as string | undefined;
    return pub && priv ? { publica: pub, privada: priv } : null;
  };
  let k = await leerClaves();
  if (!k) {
    const { default: webpush } = await import('web-push');
    const n = webpush.generateVAPIDKeys();
    await db().from('vp_config').upsert([{ clave: 'vapid_publica', valor: n.publicKey }, { clave: 'vapid_privada', valor: n.privateKey }], { onConflict: 'clave', ignoreDuplicates: true });
    k = await leerClaves();
  }
  if (!k) throw new Error('No se pudieron crear las claves de las notificaciones');
  claves = k;
  return k;
}

/** Manda un aviso a los celulares que lo activaron para esta tarjeta. Nunca frena el consumo. */
export async function avisar(tarjetaId: string, aviso: { title: string; body: string; url: string }) {
  try {
    const { data } = await db().from('vp_suscripciones').select('id, endpoint, p256dh, auth').eq('tarjeta_id', tarjetaId);
    if (!data?.length) return;
    const [{ default: webpush }, k] = await Promise.all([import('web-push'), vapid()]);
    await Promise.all(data.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(aviso), {
          vapidDetails: { subject: URL_PUBLICA, publicKey: k.publica, privateKey: k.privada }, TTL: 6 * 3600, timeout: 5000,
        });
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await db().from('vp_suscripciones').delete().eq('id', s.id);
        else console.error('[vistapueblo] aviso', code, (e as Error).message);
      }
    }));
  } catch (e) {
    console.error('[vistapueblo] avisos', (e as Error).message);
  }
}

// ------------------------------------------------------------ descargas para Excel
const celda = (v: unknown) => {
  const s = String(v ?? '');
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
/** CSV con punto y coma y BOM: Excel en español lo abre bien con doble clic. */
export function respuestaCsv(nombre: string, filas: unknown[][]) {
  return new NextResponse('﻿' + filas.map((f) => f.map(celda).join(';')).join('\r\n'), {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(nombre)}`, 'Cache-Control': 'no-store' },
  });
}

/** Planilla de métricas: resumen, reparto, por local, por día y detalle. */
export async function filasMetricas(desde: string, hasta: string, localId?: string) {
  const m = await metricas(desde, hasta, localId);
  const t = m.total;
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0);
  const fecha = (d: string) => d.split('-').reverse().join('/');
  const nombreLocal = localId ? m.porLocal[0]?.nombre ?? '' : 'Todos los locales';
  const filas: unknown[][] = [
    [`Métricas de gift cards Vistapueblo · ${nombreLocal}`], [`Del ${fecha(desde)} al ${fecha(hasta)}`], [],
    ['Personas que vinieron con la promoción', t.personas], ['Mesas (consumos)', t.visitas], ['Gift cards distintas usadas', t.clientes],
    ['Consumido con gift cards', t.consumido], ['Venta total de esas mesas', t.ventas], ['Pagado aparte por los clientes', t.ventas - t.consumido],
    ['Absorben los locales', t.local, `${pct(t.local, t.consumido)}%`], ['Cubre Vistapueblo (se descuenta del alquiler)', t.vp, `${pct(t.vp, t.consumido)}%`],
    ['Saldo sin usar en consumo total', t.perdido], [],
    ['Por local'], ['Local', 'Mesas', 'Personas', 'Consumido', '% del total', '% que absorbe', 'Absorbe el local', 'Cubre Vistapueblo', 'Venta total'],
    ...m.porLocal.map((f) => [f.nombre, f.visitas, f.personas, f.consumido, `${pct(f.consumido, t.consumido)}%`, `${f.consumido ? pct(f.local, f.consumido) : f.porcentaje}%`, f.local, f.vp, f.ventas]),
    [], [m.agrupado === 'mes' ? 'Por mes' : 'Por día'], [m.agrupado === 'mes' ? 'Mes' : 'Día', 'Mesas', 'Personas', 'Consumido'],
    ...m.porFecha.map((f) => [m.agrupado === 'mes' ? f.k : fecha(f.k), f.visitas, f.personas, f.consumido]),
    [], ['Detalle'], ['N° consumo', 'Fecha y hora', 'Local', 'Gift card', 'Cliente', 'Cajero', 'Personas', 'Ticket', 'Con gift card', 'Pagado aparte', '%', 'Absorbe el local', 'Cubre Vistapueblo', 'Estado'],
  ];
  for (const c of m.consumos) {
    const d = new Date(c.created_at);
    const cuando = `${d.toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Mendoza' })} ${d.toLocaleTimeString('es-AR', { timeZone: 'America/Argentina/Mendoza', hour: '2-digit', minute: '2-digit', hour12: false })}`;
    filas.push([c.numero, cuando, c.local, c.tarjeta?.numero ?? '', c.tarjeta?.nombre ?? '', c.cajero, c.personas ?? '', c.ticket, c.monto, c.ticket - c.monto, c.porcentaje,
      c.anulado ? 0 : c.a_cargo_local, c.anulado ? 0 : c.a_cargo_vp, c.anulado ? `Anulado${c.anulado_motivo ? `: ${c.anulado_motivo}` : ''}` : 'OK']);
  }
  return { filas, nombre: `Vistapueblo - Métricas ${nombreLocal} ${desde} a ${hasta}.csv` };
}
