'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { esFecha, redondear } from '@/lib/formato';
import { type Estado, entero, falla, fechaForm, intentar, numero, texto, volver } from '@/lib/form';
import { claveVenta, type FilaVenta } from '@/lib/importar';
import { exigirAdmin } from '@/lib/sesion';

export async function guardarVenta(_: Estado, f: FormData): Promise<Estado> {
  await exigirAdmin();
  return intentar(async () => {
    const id = entero(f, 'id');
    const v = {
      fecha: fechaForm(f, 'fecha', 'Poné la fecha.')!,
      comprobante: texto(f, 'comprobante', 40),
      numero: texto(f, 'numero', 40),
      cliente: texto(f, 'cliente', 120),
      cuit: texto(f, 'cuit', 20),
      neto: numero(f, 'neto'),
      iva: numero(f, 'iva'),
      otros: numero(f, 'otros'),
      notas: texto(f, 'notas', 500),
    };
    const total = redondear(v.neto + v.iva + v.otros);
    if (!total) falla('Poné el importe.');
    const clave = v.numero ? claveVenta({ ...v, total }) : null;
    const sql = db();
    if (clave) {
      const [otra] = await sql`select id from ventas where clave = ${clave} and id is distinct from ${id}`;
      if (otra) falla('Ya hay una venta con ese comprobante y número.');
    }
    if (id) {
      await sql`update ventas set ${sql({ ...v, total, clave })} where id = ${id}`;
    } else {
      await sql`insert into ventas ${sql({ ...v, total, clave, origen: 'manual' })}`;
    }
    revalidatePath('/ventas');
    redirect(volver(f, '/ventas'));
  });
}

export async function borrarVenta(f: FormData) {
  await exigirAdmin();
  const id = entero(f, 'id');
  if (id) await db()`delete from ventas where id = ${id}`;
  revalidatePath('/ventas');
}

export async function borrarImportacion(f: FormData) {
  await exigirAdmin();
  const id = entero(f, 'id');
  if (!id) return;
  await db().begin(async (sql) => {
    await sql`delete from ventas where importacion_id = ${id}`;
    await sql`delete from importaciones where id = ${id}`;
  });
  revalidatePath('/ventas');
}

const n = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && Math.abs(x) < 1e13 ? redondear(x) : null);
const s = (x: unknown, max: number) => (typeof x === 'string' ? x.trim().slice(0, max) : '');

export type ResultadoImportacion = { error?: string; filas?: number; comprobantes?: number; nuevas?: number; actualizadas?: number; hasta?: string };

export async function importarVentas(datos: { archivo: string; filas: FilaVenta[] }): Promise<ResultadoImportacion> {
  await exigirAdmin();
  if (!datos || !Array.isArray(datos.filas) || !datos.filas.length) return { error: 'No hay ventas para importar.' };
  if (datos.filas.length > 30000) return { error: 'El archivo tiene demasiadas filas (máximo 30.000).' };

  // Valida y agrupa por comprobante: si el Excel trae una fila por producto, se suman.
  type Fila = { fecha: string; comprobante: string; numero: string; cliente: string; cuit: string; neto: number; iva: number; otros: number; total: number; clave: string; datos: Record<string, string>; origen: string };
  const grupos = new Map<string, Fila>();
  for (const r of datos.filas) {
    const fecha = s(r?.fecha, 10);
    const [neto, iva, otros, total] = [n(r?.neto), n(r?.iva), n(r?.otros), n(r?.total)];
    if (!esFecha(fecha) || neto == null || iva == null || otros == null || total == null)
      return { error: `La fila ${Number(r?.fila) || '?'} no es válida.` };
    const v = {
      fecha,
      comprobante: s(r.comprobante, 40),
      numero: s(r.numero, 40),
      cliente: s(r.cliente, 120),
      cuit: s(r.cuit, 20),
      neto,
      iva,
      otros,
      total,
    };
    const clave = claveVenta(v);
    const g = grupos.get(clave);
    if (g) {
      g.neto = redondear(g.neto + neto);
      g.iva = redondear(g.iva + iva);
      g.otros = redondear(g.otros + otros);
      g.total = redondear(g.total + total);
    } else {
      const extra: Record<string, string> = {};
      if (r.datos && typeof r.datos === 'object')
        for (const [k, val] of Object.entries(r.datos).slice(0, 60)) extra[s(k, 60)] = s(val, 200);
      grupos.set(clave, { ...v, clave, datos: extra, origen: 'contabilium' });
    }
  }

  const filas = [...grupos.values()];
  const fechas = filas.map((f) => f.fecha).sort();
  const total = redondear(filas.reduce((a, f) => a + f.total, 0));
  const sql = db();
  const r = await sql.begin(async (tx) => {
    const [imp] = await tx`
      insert into importaciones (archivo, filas, desde, hasta, total)
      values (${s(datos.archivo, 160) || 'archivo'}, ${datos.filas.length}, ${fechas[0]}, ${fechas[fechas.length - 1]}, ${total})
      returning id`;
    let nuevas = 0;
    for (let i = 0; i < filas.length; i += 500) {
      const lote = filas.slice(i, i + 500).map((f) => ({ ...f, importacion_id: imp.id }));
      const res = await tx`
        insert into ventas ${tx(lote, 'fecha', 'comprobante', 'numero', 'cliente', 'cuit', 'neto', 'iva', 'otros', 'total', 'clave', 'datos', 'origen', 'importacion_id')}
        on conflict (clave) do update set
          fecha = excluded.fecha, comprobante = excluded.comprobante, numero = excluded.numero,
          cliente = excluded.cliente, cuit = excluded.cuit, neto = excluded.neto, iva = excluded.iva,
          otros = excluded.otros, total = excluded.total, datos = excluded.datos,
          origen = excluded.origen, importacion_id = excluded.importacion_id
        returning (xmax = 0) as nueva`;
      nuevas += res.filter((x) => x.nueva).length;
    }
    const actualizadas = filas.length - nuevas;
    await tx`update importaciones set nuevas = ${nuevas}, actualizadas = ${actualizadas} where id = ${imp.id}`;
    return { nuevas, actualizadas };
  });
  revalidatePath('/ventas');
  revalidatePath('/kpi');
  return { filas: datos.filas.length, comprobantes: filas.length, ...r, hasta: fechas[fechas.length - 1] };
}
