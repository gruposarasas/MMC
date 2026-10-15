// Dólar del Banco Nación (billete, el "oficial"): se trae solo y queda como dólar de referencia de toda la app.
// Fuente: dolarapi.com (publica el del BNA); si no responde, la página del BNA. Solo servidor.
import { type Dolar, guardarAjuste, leerDolar } from './ajustes';
import { db } from './db';
import { aNumero, hoy } from './formato';

export type Cotizacion = { compra: number | null; venta: number; fecha: string; fuente: 'BNA' };
const URL_API = () => process.env.DOLAR_URL || 'https://dolarapi.com/v1/dolares/oficial';
const URL_BNA = () => process.env.DOLAR_BNA_URL || 'https://www.bna.com.ar/Personas';
const URL_HISTORIA = () => process.env.DOLAR_HISTORIA_URL || 'https://api.argentinadatos.com/v1/cotizaciones/dolares/oficial';

const razonable = (c: Cotizacion) => c.venta > 10 && c.venta < 1_000_000 && (c.compra == null || (c.compra > 0 && c.compra <= c.venta));

async function desdeApi(): Promise<Cotizacion> {
  const r = await fetch(URL_API(), { signal: AbortSignal.timeout(10_000), headers: { accept: 'application/json' }, cache: 'no-store' });
  if (!r.ok) throw new Error(`dolarapi respondió ${r.status}`);
  const j = (await r.json()) as { compra?: number; venta?: number; fechaActualizacion?: string };
  const fecha = j.fechaActualizacion ? new Date(j.fechaActualizacion) : new Date();
  return { compra: Number(j.compra) || null, venta: Number(j.venta), fecha: hoy(Number.isNaN(fecha.getTime()) ? new Date() : fecha), fuente: 'BNA' };
}

/** La primera tabla de la página del BNA es la de billetes: "Dolar U.S.A | compra | venta". */
async function desdeBna(): Promise<Cotizacion> {
  const r = await fetch(URL_BNA(), {
    signal: AbortSignal.timeout(15_000), cache: 'no-store',
    headers: { 'user-agent': 'Mozilla/5.0 (BB-CONTROL)', accept: 'text/html' },
  });
  if (!r.ok) throw new Error(`bna.com.ar respondió ${r.status}`);
  const m = (await r.text()).match(/Dolar\s*U\.?\s*S\.?\s*A\.?\s*<\/td>\s*<td[^>]*>\s*([\d.,]+)\s*<\/td>\s*<td[^>]*>\s*([\d.,]+)/i);
  if (!m) throw new Error('no se encontró la cotización en bna.com.ar');
  return { compra: aNumero(m[1]), venta: aNumero(m[2]) ?? 0, fecha: hoy(), fuente: 'BNA' };
}

export async function traerDolarBna(): Promise<Cotizacion> {
  const errores: string[] = [];
  for (const fuente of [desdeApi, desdeBna]) {
    try {
      const c = await fuente();
      if (razonable(c)) return c;
      errores.push(`${fuente.name}: valor raro (${c.venta})`);
    } catch (e) {
      errores.push(e instanceof Error ? e.message : String(e));
    }
  }
  throw new Error(errores.join(' · '));
}

/** Si está en automático, trae el dólar del BNA, lo deja como referencia y lo anota en el historial. */
export async function actualizarDolar(forzar = false): Promise<{ ok: boolean; dolar?: Dolar; error?: string }> {
  const actual = await leerDolar();
  if (!forzar && actual && actual.auto === false) return { ok: false, error: 'El dólar está en manual.' };
  try {
    const c = await traerDolarBna();
    const dolar: Dolar = { valor: c.venta, compra: c.compra, fecha: c.fecha, fuente: 'BNA', actualizado: new Date().toISOString(), auto: true };
    await guardarAjuste('dolar', dolar);
    await db()`insert into dolar_historial (fecha, compra, venta, fuente) values (${c.fecha}, ${c.compra}, ${c.venta}, ${c.fuente})
               on conflict (fecha) do update set compra = excluded.compra, venta = excluded.venta, fuente = excluded.fuente, actualizado = now()`;
    await aplicarAEgresos(c.venta);
    return { ok: true, dolar };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Para mostrar: el dólar de hoy y cuánto cambió contra el día anterior con cotización. */
export async function dolarDelDia() {
  const dolar = await leerDolar();
  if (!dolar) return null;
  const [ant] = await db()`select fecha, venta from dolar_historial where fecha < ${dolar.fecha} order by fecha desc limit 1`;
  const anterior = ant ? Number(ant.venta) : null;
  return { ...dolar, anterior, variacion: anterior ? ((dolar.valor - anterior) / anterior) * 100 : null, fechaAnterior: (ant?.fecha as string) ?? null };
}

/** Las compras y gastos en dólares con dólar BNA que todavía no se pagaron pasan al dólar de hoy. */
export async function aplicarAEgresos(valor: number) {
  if (!(valor > 0)) return 0;
  const r = await db()`update egresos set cotizacion = ${valor} where moneda = 'USD' and cotizacion_auto and not pagado and cotizacion <> ${valor}`;
  return r.count;
}

/** Dólar BNA (venta) de una fecha: el último del historial hasta ese día; si no hay, el de referencia de hoy. */
export async function dolarDe(fecha: string): Promise<number | null> {
  const [h] = await db()`select venta from dolar_historial where fecha <= ${fecha} order by fecha desc limit 1`;
  if (h && fecha < hoy()) return Number(h.venta);
  return (await leerDolar())?.valor ?? (h ? Number(h.venta) : null);
}

/** La primera vez, trae el historial del dólar oficial (BNA) para tener la cotización de cualquier fecha pasada. */
export async function completarHistorial() {
  const [{ n }] = await db()`select count(*)::int n from dolar_historial`;
  if ((n as number) > 200) return 0;
  const r = await fetch(URL_HISTORIA(), { signal: AbortSignal.timeout(30_000), cache: 'no-store' });
  if (!r.ok) throw new Error(`historial respondió ${r.status}`);
  const lista = (await r.json()) as { compra?: number; venta?: number; fecha?: string }[];
  const filas = (Array.isArray(lista) ? lista : [])
    .map((x) => ({ fecha: String(x.fecha ?? '').slice(0, 10).replace(/\//g, '-'), compra: Number(x.compra) || null, venta: Number(x.venta), fuente: 'BNA' }))
    .filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x.fecha) && x.venta > 0);
  const sql = db();
  for (let i = 0; i < filas.length; i += 1000) {
    await sql`insert into dolar_historial ${sql(filas.slice(i, i + 1000))} on conflict (fecha) do nothing`;
  }
  return filas.length;
}
