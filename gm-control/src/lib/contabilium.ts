// Conexión con la API de Contabilium (plan Full o superior). Solo servidor.
// Autenticación: POST /token con grant_type=client_credentials, client_id = email de la API y
// client_secret = API Key (Mi cuenta → Configuración → API → Credenciales). Después, GET /api/... con Bearer.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { guardarAjuste, leerAjuste } from './ajustes';
import { aNumero, hoy, redondear, sumarDias } from './formato';
import { guardarVentas, type VentaNueva } from './guardarVentas';
import { nombreComprobante, tipoCanonico } from './importar';

const BASE = () => (process.env.CONTABILIUM_URL || 'https://rest.contabilium.com').replace(/\/+$/, '');

// ---------- credenciales (variables de entorno o guardadas cifradas en ajustes) ----------
type Guardadas = { email: string; iv: string; tag: string; dato: string };
export type Estado = { fecha: string; ok: boolean; mensaje: string };
export type ConfigContabilium = { auto: boolean };

const llave = () => createHash('sha256').update(`${process.env.SESSION_SECRET ?? ''}|contabilium`).digest();

function cifrar(texto: string) {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', llave(), iv);
  const dato = Buffer.concat([c.update(texto, 'utf8'), c.final()]);
  return { iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), dato: dato.toString('base64') };
}
function descifrar(g: Guardadas) {
  const d = createDecipheriv('aes-256-gcm', llave(), Buffer.from(g.iv, 'base64'));
  d.setAuthTag(Buffer.from(g.tag, 'base64'));
  return Buffer.concat([d.update(Buffer.from(g.dato, 'base64')), d.final()]).toString('utf8');
}

export async function credenciales(): Promise<{ email: string; clave: string; origen: 'entorno' | 'ajustes' } | null> {
  const e = process.env.CONTABILIUM_EMAIL;
  const k = process.env.CONTABILIUM_API_KEY;
  if (e && k) return { email: e.trim(), clave: k.trim(), origen: 'entorno' };
  const g = await leerAjuste<Guardadas>('contabilium_credenciales');
  if (!g) return null;
  try {
    return { email: g.email, clave: descifrar(g), origen: 'ajustes' };
  } catch {
    return null; // cambió SESSION_SECRET: hay que cargarlas de nuevo
  }
}

export async function guardarCredenciales(email: string, clave: string) {
  await guardarAjuste('contabilium_credenciales', { email, ...cifrar(clave) });
  tokenCache = null;
}

export const leerEstado = () => leerAjuste<Estado>('contabilium_estado');
export const leerConfig = async () => (await leerAjuste<ConfigContabilium>('contabilium_config')) ?? { auto: true };

// ---------- cliente HTTP ----------
let tokenCache: { email: string; token: string; vence: number } | null = null;
let ultimaLlamada = 0;

class ErrorContabilium extends Error {}

async function pedirToken(email: string, clave: string) {
  if (tokenCache && tokenCache.email === email && Date.now() < tokenCache.vence - 5 * 60_000) return tokenCache.token;
  let res: Response;
  try {
    res = await fetch(`${BASE()}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: email, client_secret: clave }).toString(),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new ErrorContabilium('No se pudo conectar con Contabilium. Probá de nuevo en un rato.');
  }
  if (res.status === 400 || res.status === 401) throw new ErrorContabilium('Contabilium rechazó el email o la API Key. Revisalos en Mi cuenta → Configuración → API.');
  if (!res.ok) throw new ErrorContabilium(`Contabilium respondió con un error (${res.status}) al iniciar sesión.`);
  const d = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number };
  if (!d.access_token) throw new ErrorContabilium('Contabilium no devolvió el acceso. Revisá que la cuenta tenga plan Full o superior.');
  tokenCache = { email, token: d.access_token, vence: Date.now() + (Number(d.expires_in) || 86_399) * 1000 };
  return d.access_token;
}

/** GET a la API, respetando el límite de pedidos (≈2 por segundo) y reintentando un 401 o un 429. */
async function get(ruta: string, params: Record<string, string | number> = {}, reintento = 0): Promise<unknown> {
  const cred = await credenciales();
  if (!cred) throw new ErrorContabilium('Falta conectar Contabilium (Ajustes → Contabilium).');
  const token = await pedirToken(cred.email, cred.clave);
  const espera = ultimaLlamada + 550 - Date.now();
  if (espera > 0) await new Promise((r) => setTimeout(r, espera));
  ultimaLlamada = Date.now();
  const url = new URL(`${BASE()}/api${ruta}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  let res: Response;
  try {
    res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, signal: AbortSignal.timeout(30_000) });
  } catch {
    throw new ErrorContabilium('Se cortó la conexión con Contabilium. Probá de nuevo.');
  }
  if (res.status === 401 && reintento < 1) {
    tokenCache = null;
    return get(ruta, params, reintento + 1);
  }
  if (res.status === 429 && reintento < 2) {
    await new Promise((r) => setTimeout(r, 3000));
    return get(ruta, params, reintento + 1);
  }
  if (res.status === 403) throw new ErrorContabilium('Contabilium negó el acceso (403): la API está disponible desde el plan Full.');
  if (!res.ok) throw new ErrorContabilium(`Contabilium respondió con un error (${res.status}).`);
  return res.json();
}

type Pagina = { Items?: unknown; items?: unknown; TotalPage?: number; totalPage?: number };
async function todasLasPaginas(ruta: string, params: Record<string, string | number>, maxPaginas = 60) {
  const items: Record<string, unknown>[] = [];
  for (let page = 1; page <= maxPaginas; page++) {
    const r = (await get(ruta, { ...params, page, pageSize: 50 })) as Pagina | unknown[];
    const lista = Array.isArray(r) ? r : Array.isArray(r?.Items) ? r.Items : Array.isArray(r?.items) ? r.items : r?.Items ? [r.Items] : [];
    items.push(...(lista as Record<string, unknown>[]));
    const total = Array.isArray(r) ? null : Number(r?.TotalPage ?? r?.totalPage ?? NaN);
    if (!lista.length || lista.length < 50 || (Number.isFinite(total) && page >= (total as number))) break;
  }
  return items;
}

// ---------- prueba de conexión ----------
/** Prueba el acceso y trae una muestra de las últimas ventas para comparar con lo que muestra Contabilium. */
export async function probarConexion() {
  try {
    const info = (await get('/usuarios/obtenerinfo')) as Record<string, unknown>;
    const nombre = String(info?.RazonSocial || info?.NombreFantasia || 'la cuenta');
    const r = (await get('/comprobantes/search', { fechaDesde: sumarDias(hoy(), -30), fechaHasta: hoy(), page: 1, pageSize: 50 })) as Pagina;
    const lista = (Array.isArray(r?.Items) ? r.Items : []) as Record<string, unknown>[];
    const muestra = lista.map(mapearVenta).filter((v): v is VentaNueva => !!v).slice(0, 3);
    return { ok: true as const, nombre, cuit: String(info?.CUIT ?? info?.Cuit ?? ''), muestra, campos: Object.keys(lista[0] ?? {}).slice(0, 40) };
  } catch (e) {
    return { ok: false as const, error: e instanceof ErrorContabilium ? e.message : 'No se pudo probar la conexión.' };
  }
}

// ---------- ventas ----------
const monto = (x: unknown) => aNumero(x as string | number) ?? 0;

/** Facturas, notas de crédito y de débito: lo demás (cotizaciones, remitos, presupuestos) no es venta. */
export function clasificar(tipo: string) {
  const t = tipoCanonico(tipo);
  if (/^NC[ABCEM]?$/.test(t)) return 'nc';
  if (/^(FCE?|ND)[ABCEM]?$/.test(t)) return 'venta';
  return null;
}

/** Convierte un comprobante de la API en una venta. El neto y el IVA salen de los renglones si vienen. */
export function mapearVenta(c: Record<string, unknown>): VentaNueva | null {
  const tipo = String(c.TipoFc ?? c.tipoFc ?? c.Tipo ?? '');
  const clase = clasificar(tipo);
  if (!clase) return null;
  const fecha = String(c.FechaEmision ?? c.fechaEmision ?? c.Fecha ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return null;
  const signo = clase === 'nc' ? -1 : 1;
  const a = Math.abs(monto(c.ImporteTotalNeto ?? c.Total));
  const b = Math.abs(monto(c.ImporteTotalBruto));
  const total = a || b;

  let neto: number | null = null;
  let iva = 0;
  const items = Array.isArray(c.Items) ? (c.Items as Record<string, unknown>[]) : [];
  if (items.length) {
    // "Iva" puede venir como alícuota (21) o como importe: si no es una alícuota conocida, es el importe.
    const ALICUOTAS = [0, 2.5, 5, 10.5, 21, 27];
    const renglones = items.map((it) => {
      const sub = Math.abs(monto(it.Cantidad ?? 1)) * Math.abs(monto(it.PrecioUnitario ?? it.Precio)) * (1 - monto(it.Bonificacion) / 100);
      const v = Math.abs(monto(it.Iva ?? it.Alicuota ?? 0));
      return ALICUOTAS.includes(v) ? { sub, alic: v, importe: (sub * v) / 100 } : { sub, alic: sub ? (v / sub) * 100 : 0, importe: v };
    });
    let n = renglones.reduce((acc, r) => acc + r.sub, 0);
    let i = renglones.reduce((acc, r) => acc + r.importe, 0);
    // Si los precios ya incluían IVA (neto + IVA se pasa del total), se separa el IVA de cada renglón.
    if (total && n + i > total + 1) {
      i = renglones.reduce((acc, r) => acc + r.sub - r.sub / (1 + r.alic / 100), 0);
      n = total - i;
    }
    if (n > 0) {
      neto = redondear(n);
      iva = redondear(i);
    }
  }
  if (neto == null) {
    // Sin renglones: si vienen dos importes distintos, el menor es el neto y el mayor el total.
    if (a && b && Math.abs(a - b) > 0.01) {
      neto = Math.min(a, b);
      iva = redondear(Math.max(a, b) - neto);
    } else neto = total;
  }
  const otros = redondear(Math.max(total - neto - iva, 0));
  const pv = String(c.PuntoVenta ?? c.PuntoDeVenta ?? '').replace(/\D/g, '');
  let numero = String(c.Numero ?? c.numero ?? '').trim();
  if (pv && /^\d+$/.test(numero)) numero = `${pv.padStart(4, '0')}-${numero.padStart(8, '0')}`;
  return {
    fecha,
    comprobante: nombreComprobante(tipoCanonico(tipo)) || tipo,
    numero,
    cliente: String(c.RazonSocial ?? c.razonSocial ?? '').trim().slice(0, 120),
    cuit: String(c.NroDoc ?? c.NroDocumento ?? c.Cuit ?? c.CUIT ?? '').trim().slice(0, 20),
    neto: redondear(neto * signo),
    iva: redondear(iva * signo),
    otros: redondear(otros * signo),
    total: redondear(total * signo),
    datos: { contabilium_id: c.Id ?? c.id ?? null, tipo, saldo: c.Saldo ?? null, vencimiento: c.FechaVencimiento ?? null, origen: c.Origen ?? c.Canal ?? null },
  };
}

/** Trae los comprobantes de un rango, en tramos de 7 días (la búsqueda también devuelve cotizaciones). */
export async function traerComprobantes(desde: string, hasta: string) {
  const todos: Record<string, unknown>[] = [];
  for (let d = desde; d <= hasta; d = sumarDias(d, 7)) {
    const fin = sumarDias(d, 6) < hasta ? sumarDias(d, 6) : hasta;
    todos.push(...(await todasLasPaginas('/comprobantes/search', { fechaDesde: d, fechaHasta: fin })));
  }
  return todos;
}

let sincronizando = false;

/** Trae las ventas de Contabilium del rango y las guarda (sin duplicar). Deja el resultado en ajustes. */
export async function sincronizarVentas(desde: string, hasta: string) {
  if (sincronizando) return { ok: false as const, error: 'Ya se están trayendo las ventas. Esperá un momento.' };
  sincronizando = true;
  try {
    const crudos = await traerComprobantes(desde, hasta);
    const vistos = new Set<string>();
    const ventas: VentaNueva[] = [];
    let excluidos = 0;
    for (const c of crudos) {
      const id = String(c.Id ?? c.id ?? '');
      if (id && vistos.has(id)) continue;
      if (id) vistos.add(id);
      const v = mapearVenta(c);
      if (v) ventas.push(v);
      else excluidos++;
    }
    const r = await guardarVentas(ventas, { archivo: null });
    const mensaje = `${r.comprobantes} ventas del ${desde.split('-').reverse().join('/')} al ${hasta.split('-').reverse().join('/')}: ${r.nuevas} nuevas y ${r.actualizadas} actualizadas${excluidos ? ` (${excluidos} cotizaciones u otros comprobantes no se cuentan)` : ''}.`;
    await guardarAjuste('contabilium_estado', { fecha: new Date().toISOString(), ok: true, mensaje } satisfies Estado);
    return { ok: true as const, mensaje, ...r };
  } catch (e) {
    const mensaje = e instanceof ErrorContabilium ? e.message : 'No se pudieron traer las ventas de Contabilium.';
    if (!(e instanceof ErrorContabilium)) console.error('[contabilium]', e);
    await guardarAjuste('contabilium_estado', { fecha: new Date().toISOString(), ok: false, mensaje } satisfies Estado).catch(() => {});
    return { ok: false as const, error: mensaje };
  } finally {
    sincronizando = false;
  }
}

/** Para la sincronización automática: los últimos 35 días (cubre el mes anterior al principio de cada mes). */
export const rangoAutomatico = () => ({ desde: sumarDias(hoy(), -35), hasta: hoy() });

// ---------- productos ----------
export async function traerProductos() {
  const [rubros, conceptos] = await Promise.all([
    get('/conceptos/rubros').catch(() => []) as Promise<unknown>,
    todasLasPaginas('/conceptos/search', { filtro: '' }, 100),
  ]);
  const nombresRubro = new Map<number, string>();
  if (Array.isArray(rubros)) for (const r of rubros as Record<string, unknown>[]) if (r.Id && r.Nombre) nombresRubro.set(Number(r.Id), String(r.Nombre));
  return conceptos
    .map((p) => {
      const nombre = String(p.Nombre ?? p.nombre ?? '').trim();
      if (!nombre) return null;
      const iva = monto(p.Iva ?? p.Alicuota ?? 21);
      let precio = monto(p.Precio ?? p.PrecioUnitario);
      const final = monto(p.PrecioFinal);
      if (!precio && final) precio = redondear(final / (1 + iva / 100));
      return {
        nombre: nombre.slice(0, 100),
        categoria: (nombresRubro.get(Number(p.IdRubro ?? p.idRubro)) || String(p.Rubro ?? '')).slice(0, 60),
        precio: redondear(precio),
        iva: iva >= 0 && iva <= 100 ? iva : 21,
        codigo: String(p.Codigo ?? '').slice(0, 40),
      };
    })
    .filter((p): p is NonNullable<typeof p> => !!p);
}
