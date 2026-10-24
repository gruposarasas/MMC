// Conexión con la API de Contabilium (plan Full o superior). Solo servidor.
// Autenticación: POST /token con grant_type=client_credentials, client_id = email de la API y
// client_secret = API Key (Mi cuenta → Configuración → API → Credenciales). Después, GET /api/... con Bearer.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { guardarAjuste, leerAjuste } from './ajustes';
import { db } from './db';
import { aNumero, hoy, mesActual, redondear, sumarDias, sumarMeses } from './formato';
import { guardarVentas, type VentaNueva } from './guardarVentas';
import { claveVenta, nombreComprobante, tipoCanonico } from './importar';
import { kilosPorUnidad } from './kilos';
import { ListaProveedores } from './proveedores';

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
  if (res.status === 429 && reintento < 4) {
    // Límite de la API (25 pedidos cada 10 segundos): se espera cada vez más.
    await new Promise((r) => setTimeout(r, [3000, 6000, 12000, 20000][reintento]));
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
    // La búsqueda a veces trae un solo importe (sin separar el IVA): las ventas a las que ya se les separó con sus
    // productos lo conservan, así no cambian en cada sincronización.
    const sinIva = ventas.filter((v) => v.iva === 0).map((v) => claveVenta(v));
    if (sinIva.length) {
      const antes = await db()<{ clave: string; neto: number; iva: number; otros: number; total: number }[]>`
        select clave, neto, iva, otros, total from ventas where clave = any(${sinIva}) and detalle_el is not null and iva <> 0`;
      const porClave = new Map(antes.map((x) => [x.clave, x]));
      for (const v of ventas) {
        const a = v.iva === 0 ? porClave.get(claveVenta(v)) : undefined;
        if (a && Math.abs(Number(a.total) - v.total) < 1) Object.assign(v, { neto: Number(a.neto), iva: Number(a.iva), otros: Number(a.otros) });
      }
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

const plural = (n: number, palabra: string) => `${n} ${palabra}${n === 1 ? '' : 's'}`;

// ---------- catálogo de productos ----------
/** Rubros de Contabilium por id (para el catálogo y para los renglones de las ventas). */
async function rubrosContabilium() {
  const r = (await get('/conceptos/rubros').catch(() => [])) as unknown;
  const lista = Array.isArray(r) ? r : Array.isArray((r as Pagina)?.Items) ? ((r as Pagina).Items as unknown[]) : [];
  const m = new Map<string, string>();
  for (const x of lista as Record<string, unknown>[]) if (x.Id != null && x.Nombre) m.set(String(x.Id), String(x.Nombre));
  return m;
}

export async function traerProductos() {
  const [rubros, conceptos] = await Promise.all([rubrosContabilium(), todasLasPaginas('/conceptos/search', { filtro: '' }, 100)]);
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
        categoria: (rubros.get(String(p.IdRubro ?? p.idRubro)) || String(p.Rubro ?? '')).slice(0, 60),
        precio: redondear(precio),
        iva: iva >= 0 && iva <= 100 ? iva : 21,
        codigo: String(p.Codigo ?? '').slice(0, 40),
      };
    })
    .filter((p): p is NonNullable<typeof p> => !!p);
}

/** Crea o actualiza los productos de Costos con los de Contabilium (nombre, rubro, precio e IVA). */
export async function sincronizarCatalogo() {
  const lista = await traerProductos();
  if (!lista.length) throw new ErrorContabilium('Contabilium no devolvió productos.');
  const nuevos = await db().begin(async (tx) => {
    let n = 0;
    for (const p of lista) {
      const [existe] = await tx`select id from productos where lower(nombre) = lower(${p.nombre}) and presentacion = '' limit 1`;
      if (existe) {
        await tx`update productos set precio = ${p.precio}, iva_alicuota = ${p.iva},
                   categoria = case when ${p.categoria} <> '' then ${p.categoria} else categoria end
                 where id = ${existe.id as number}`;
      } else {
        await tx`insert into productos (nombre, categoria, precio, iva_alicuota, notas)
                 values (${p.nombre}, ${p.categoria}, ${p.precio}, ${p.iva}, ${p.codigo ? `Código Contabilium: ${p.codigo}` : ''})`;
        n++;
      }
    }
    return n;
  });
  return { nuevos, actualizados: lista.length - nuevos, mensaje: `${lista.length} productos del catálogo (${plural(nuevos, 'nuevo')})` };
}

// ---------- productos de cada venta ----------
export type Renglon = {
  orden: number; codigo: string; concepto: string; concepto_id: string; rubro: string; cantidad: number; precio: number;
  bonificacion: number; neto: number; iva_alicuota: number | null; kilos: number | null;
};

/**
 * Renglones de un comprobante (de /comprobantes/getById). Los netos se ajustan para que sumen el neto de la venta
 * (cubre precios con IVA incluido y descuentos generales); en las notas de crédito, cantidades y netos van en negativo.
 */
export function renglones(det: Record<string, unknown>, netoVenta: number, rubros: Map<string, string>, catalogo = new Map<string, string>()): Renglon[] {
  const lista = (Array.isArray(det?.Items) ? det.Items : Array.isArray(det?.items) ? det.items : []) as Record<string, unknown>[];
  const signo = netoVenta < 0 ? -1 : 1;
  const crudos = lista
    .map((it, i) => {
      const concepto = String(it.Concepto ?? it.Nombre ?? it.Descripcion ?? '').replace(/\s+/g, ' ').trim().slice(0, 200);
      const cantidad = Math.abs(monto(it.Cantidad ?? 1));
      const precio = monto(it.PrecioUnitario ?? it.Precio);
      const bonificacion = Math.min(Math.max(monto(it.Bonificacion), 0), 100);
      const alic = aNumero(it.Iva as string | number);
      return {
        orden: i + 1, codigo: String(it.Codigo ?? '').trim().slice(0, 60), concepto, concepto_id: String(it.IdConcepto ?? '').replace(/^null$/, ''),
        rubro: (rubros.get(String(it.IdRubro ?? '')) || String(it.Rubro ?? '') || catalogo.get(concepto.toLowerCase()) || '').slice(0, 80),
        cantidad, precio, bonificacion, sub: cantidad * precio * (1 - bonificacion / 100),
        iva_alicuota: alic != null && [0, 2.5, 5, 10.5, 21, 27].includes(Math.abs(alic)) ? Math.abs(alic) : null,
      };
    })
    .filter((x) => x.concepto || x.sub);
  const suma = crudos.reduce((a, x) => a + x.sub, 0);
  const factor = suma > 0 && netoVenta ? Math.abs(netoVenta) / suma : 1;
  return crudos.map(({ sub, ...x }) => {
    const kpu = kilosPorUnidad(x.concepto);
    return { ...x, cantidad: redondear(x.cantidad * signo, 3), neto: redondear(sub * factor * signo), kilos: kpu == null ? null : redondear(x.cantidad * kpu * signo, 3) };
  });
}

/** Pide uno por uno los renglones de las ventas de Contabilium del rango que todavía no los tienen. */
export async function completarProductos(desde: string, hasta: string, opc: { limite?: number; avance?: (hechos: number, total: number) => Promise<void> } = {}) {
  const sql = db();
  const faltan = await sql<{ id: number; cid: string; neto: number; iva: number; total: number }[]>`
    select id, datos->>'contabilium_id' cid, neto, iva, total from ventas
    where fecha >= ${desde} and fecha <= ${hasta} and detalle_el is null and coalesce(datos->>'contabilium_id', '') <> ''
    order by fecha desc, id desc ${opc.limite ? sql`limit ${opc.limite}` : sql``}`;
  if (!faltan.length) return { hechas: 0, renglones: 0, fallas: 0, total: 0, mensaje: 'Los productos de cada venta ya estaban.' };
  const [rubros, cat] = await Promise.all([
    rubrosContabilium(),
    sql<{ n: string; categoria: string }[]>`select lower(nombre) n, max(categoria) categoria from productos where categoria <> '' group by 1`,
  ]);
  const catalogo = new Map(cat.map((x) => [x.n, x.categoria]));
  let hechas = 0;
  let cuantos = 0;
  let fallas = 0;
  let seguidas = 0;
  let ultimoError = '';
  for (const [i, v] of faltan.entries()) {
    try {
      const det = ((await get('/comprobantes/getById', { id: v.cid })) ?? {}) as Record<string, unknown>;
      // Si la búsqueda no permitió separar el IVA (un solo importe), se separa con los renglones.
      const conDetalle = Number(v.iva) === 0 ? mapearVenta(det) : null;
      const corregir = conDetalle && conDetalle.iva !== 0 && Math.abs(conDetalle.total - Number(v.total)) < 1 ? conDetalle : null;
      const items = renglones(det, corregir ? corregir.neto : Number(v.neto), rubros, catalogo);
      await sql.begin(async (tx) => {
        await tx`select id from ventas where id = ${v.id} for update`;
        if (corregir) await tx`update ventas set neto = ${corregir.neto}, iva = ${corregir.iva}, otros = ${corregir.otros} where id = ${v.id}`;
        await tx`delete from venta_items where venta_id = ${v.id}`;
        if (items.length) await tx`insert into venta_items ${tx(items.map((x) => ({ ...x, venta_id: v.id })))}`;
        await tx`update ventas set detalle_el = now() where id = ${v.id}`;
      });
      hechas++;
      cuantos += items.length;
      seguidas = 0;
    } catch (e) {
      fallas++;
      seguidas++;
      ultimoError = e instanceof Error ? e.message : String(e);
      if (e instanceof ErrorContabilium && /Falta conectar|rechazó|plan Full/.test(e.message)) throw e;
      if (!hechas && seguidas >= 5) throw new ErrorContabilium(`Contabilium no devolvió el detalle de las ventas: ${ultimoError}`);
      if (seguidas >= 20) throw new ErrorContabilium(`Se cortó la conexión con Contabilium después de ${hechas} ventas: ${ultimoError}`);
    }
    if (opc.avance && (i % 10 === 9 || i === faltan.length - 1)) await opc.avance(i + 1, faltan.length);
  }
  const mensaje = `Productos de ${hechas} ventas (${cuantos} renglones)${fallas ? `; ${fallas} no se pudieron traer y se reintentan en la próxima` : ''}.`;
  return { hechas, renglones: cuantos, fallas, total: faltan.length, mensaje };
}

// ---------- clientes y proveedores ----------
type Tercero = { id: string; nombre: string; razon: string; cuit: string; email: string; telefono: string; direccion: string; condicion: string; contacto: string };
const txt = (x: unknown, max = 120) => String(x ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

export function mapearTercero(x: Record<string, unknown>): Tercero | null {
  const razon = txt(x.RazonSocial ?? x.razonSocial);
  const fantasia = txt(x.NombreFantasia ?? x.nombreFantasia);
  const nombre = fantasia || razon;
  if (!nombre) return null;
  const doc = String(x.NroDoc ?? x.nroDoc ?? x.Documento ?? x.Cuit ?? '').replace(/\D/g, '');
  return {
    id: String(x.Id ?? x.id ?? ''), nombre, razon: razon || nombre, cuit: doc.length === 11 ? doc : '',
    email: txt(x.Email ?? x.email), telefono: txt(x.Telefono ?? x.telefono ?? x.Celular, 60),
    direccion: [x.Domicilio, x.Ciudad, x.Provincia].map((d) => txt(d)).filter(Boolean).join(', ').slice(0, 200),
    condicion: txt(x.CondicionVenta ?? x.condicionVenta, 60), contacto: txt(x.PersonaContacto ?? x.Contacto),
  };
}

/**
 * Clientes de Contabilium con CUIT (los consumidores finales no). Uno por CUIT: los que compraron en los últimos
 * 3 meses entran activos al semáforo, con los kilos estimados con sus ventas. De los que ya estaban solo se completa
 * lo vacío (CUIT, mail, teléfono, dirección) y se suman sus otros nombres.
 */
export async function sincronizarClientes() {
  const crudos = await todasLasPaginas('/clientes/search', { filtro: '' }, 400);
  const porCuit = new Map<string, Tercero[]>();
  for (const t of crudos.map(mapearTercero)) if (t?.cuit) porCuit.set(t.cuit, [...(porCuit.get(t.cuit) ?? []), t]);
  const sql = db();
  const desde = `${sumarMeses(mesActual(), -3)}-01`;
  const [compras, existentes] = await Promise.all([
    sql<{ c: string }[]>`select distinct regexp_replace(cuit, '[^0-9]', '', 'g') c from ventas where fecha >= ${desde} and cuit <> '' and neto > 0`,
    sql<{ id: number; nombre: string; alias: string[]; cuit: string; email: string; telefono: string; direccion: string; contabilium_id: string }[]>`
      select id, nombre, alias, cuit, email, telefono, direccion, contabilium_id from clientes`,
  ]);
  const compraron = new Set(compras.map((x) => x.c));
  const yaCuit = new Map(existentes.filter((c) => c.cuit).map((c) => [c.cuit, c]));
  const yaNombre = new Map<string, (typeof existentes)[number]>();
  for (const c of existentes) for (const n of [c.nombre, ...c.alias]) if (!yaNombre.has(n.toLowerCase())) yaNombre.set(n.toLowerCase(), c);
  let nuevos = 0;
  let actualizados = 0;
  let activos = 0;
  await sql.begin(async (tx) => {
    for (const [cuit, ts] of porCuit) {
      const nombres = [...new Set(ts.flatMap((t) => [t.nombre, t.razon]))];
      const t = ts[0];
      const c = yaCuit.get(cuit) ?? nombres.map((n) => yaNombre.get(n.toLowerCase())).find(Boolean);
      if (c) {
        const alias = [...new Set([...c.alias, ...nombres.filter((n) => n.toLowerCase() !== c.nombre.toLowerCase())])].slice(0, 20);
        await tx`update clientes set
                   cuit = case when cuit = '' then ${cuit} else cuit end, contabilium_id = ${t.id}, alias = ${alias},
                   email = case when email = '' then ${t.email} else email end,
                   telefono = case when telefono = '' then ${t.telefono} else telefono end,
                   direccion = case when direccion = '' then ${t.direccion} else direccion end
                 where id = ${c.id}`;
        actualizados++;
        continue;
      }
      const activo = compraron.has(cuit);
      const plazo = Number(t.condicion.match(/\d{1,3}/)?.[0] ?? 0);
      let nombre = nombres[0];
      if (yaNombre.has(nombre.toLowerCase())) nombre = `${nombre} (${cuit})`;
      await tx`insert into clientes ${tx({
        nombre, alias: nombres.slice(1), cuit, contabilium_id: t.id, email: t.email, telefono: t.telefono, direccion: t.direccion,
        kilos_mes: null, kilos_desde_ventas: true, forma_pago: t.condicion.replace(/(?:^|[\s,-]+)\d{1,3}\s*(?:d[ií]as?|d)?\.?\s*$/i, '').trim() || t.condicion || 'Transferencia',
        plazo_dias: Math.min(plazo, 365), activo, notas: 'Traído de Contabilium',
      })}`;
      yaNombre.set(nombre.toLowerCase(), { id: 0, nombre, alias: [], cuit, email: '', telefono: '', direccion: '', contabilium_id: t.id });
      nuevos++;
      if (activo) activos++;
    }
  });
  const compro = activos === 1 ? '1 compró en los últimos 3 meses y entra al semáforo' : `${activos} compraron en los últimos 3 meses y entran al semáforo`;
  return { nuevos, actualizados, activos, mensaje: `${porCuit.size} clientes con CUIT (${plural(nuevos, 'nuevo')}${activos ? `; ${compro}` : ''})` };
}

/** Proveedores de Contabilium: se reconocen por CUIT o por nombre; de los que ya estaban solo se completa lo vacío. */
export async function sincronizarProveedores() {
  const lista = (await todasLasPaginas('/proveedores/search', { filtro: '' }, 200)).map(mapearTercero).filter((t): t is Tercero => !!t);
  const nuevos = await db().begin(async (tx) => {
    const provs = await ListaProveedores.cargar(tx);
    let n = 0;
    for (const t of lista) {
      const { id, nuevo } = await provs.buscarOCrear(tx, t.razon, t.cuit, null);
      if (nuevo) n++;
      await tx`update proveedores set
                 contacto = case when contacto = '' then ${t.contacto} else contacto end,
                 telefono = case when telefono = '' then ${t.telefono} else telefono end,
                 email = case when email = '' then ${t.email} else email end,
                 notas = case when notas = '' then ${t.direccion} else notas end
               where id = ${id}`;
    }
    return n;
  });
  return { nuevos, actualizados: lista.length - nuevos, mensaje: `${lista.length} proveedores (${plural(nuevos, 'nuevo')})` };
}

// ---------- carga en segundo plano ----------
export type Carga = {
  corriendo: boolean; etapa: string; hechos: number; total: number; inicio: string; actualizado: string;
  desde: string; hasta: string; ok?: boolean; mensaje?: string;
};
export const leerCarga = () => leerAjuste<Carga>('contabilium_carga');
/** Una carga marcada "corriendo" que no avanzó en 3 minutos se cortó (por ejemplo, se reinició el servidor). */
export const cargaViva = (c: Carga | null) => !!c?.corriendo && Date.now() - new Date(c.actualizado).getTime() < 3 * 60_000;

/** Desde el primer día de hace 3 meses: los 3 meses completos que usa el semáforo y el mes en curso. */
export const desdeTresMeses = () => `${sumarMeses(mesActual(), -3)}-01`;

type Pasos = { catalogo?: boolean; clientes?: boolean; proveedores?: boolean; ventas?: boolean };

/** Arranca la carga y vuelve enseguida; el avance queda en ajustes ('contabilium_carga'). */
export async function iniciarCarga(desde: string, hasta: string, pasos: Pasos) {
  if (!(await credenciales())) return { ok: false as const, error: 'Falta conectar Contabilium (Ajustes → Contabilium).' };
  if (cargaViva(await leerCarga())) return { ok: false as const, error: 'Ya se está trayendo información de Contabilium. Esperá a que termine.' };
  const ahora = new Date().toISOString();
  await guardarAjuste('contabilium_carga', { corriendo: true, etapa: 'Empezando', hechos: 0, total: 0, inicio: ahora, actualizado: ahora, desde, hasta } satisfies Carga);
  void correrCarga(desde, hasta, pasos);
  return { ok: true as const };
}

async function correrCarga(desde: string, hasta: string, pasos: Pasos) {
  const estado = (await leerCarga())!;
  let guardado = 0;
  const avance = async (etapa: string, hechos = 0, total = 0, forzar = true) => {
    Object.assign(estado, { etapa, hechos, total, actualizado: new Date().toISOString() });
    if (forzar || Date.now() - guardado > 4000) {
      guardado = Date.now();
      await guardarAjuste('contabilium_carga', estado);
    }
  };
  const partes: string[] = [];
  try {
    if (pasos.catalogo) {
      await avance('Trayendo el catálogo de productos');
      partes.push((await sincronizarCatalogo()).mensaje);
    }
    if (pasos.ventas) {
      await avance('Trayendo las ventas');
      const r = await sincronizarVentas(desde, hasta);
      if (!r.ok) throw new ErrorContabilium(r.error);
      partes.push(r.mensaje.replace(/\.$/, ''));
    }
    if (pasos.clientes) {
      await avance('Trayendo los clientes');
      partes.push((await sincronizarClientes()).mensaje);
    }
    if (pasos.proveedores) {
      await avance('Trayendo los proveedores');
      partes.push((await sincronizarProveedores()).mensaje);
    }
    await avance('Trayendo los productos de cada venta');
    const p = await completarProductos(desde, hasta, { avance: (h, t) => avance('Trayendo los productos de cada venta', h, t, false) });
    partes.push(p.mensaje.replace(/\.$/, ''));
    Object.assign(estado, { corriendo: false, ok: true, etapa: 'Listo', mensaje: `${partes.join('. ')}.`, actualizado: new Date().toISOString() });
  } catch (e) {
    if (!(e instanceof ErrorContabilium)) console.error('[contabilium] carga', e);
    const error = e instanceof Error ? e.message : 'No se pudo terminar de traer la información.';
    Object.assign(estado, { corriendo: false, ok: false, etapa: 'Se cortó', mensaje: `${partes.length ? `${partes.join('. ')}. ` : ''}${error}`, actualizado: new Date().toISOString() });
  }
  await guardarAjuste('contabilium_carga', estado).catch(() => {});
}
