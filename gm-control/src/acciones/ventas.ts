'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { esFecha, redondear } from '@/lib/formato';
import { type Estado, entero, falla, fechaForm, intentar, numero, texto, volver } from '@/lib/form';
import { guardarVentas, type VentaNueva } from '@/lib/guardarVentas';
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
    const [imp] = await sql`select tipo from importaciones where id = ${id}`;
    if (imp?.tipo !== 'venta') return;
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

  const lista: VentaNueva[] = [];
  for (const r of datos.filas) {
    const fecha = s(r?.fecha, 10);
    const [neto, iva, otros, total] = [n(r?.neto), n(r?.iva), n(r?.otros), n(r?.total)];
    if (!esFecha(fecha) || neto == null || iva == null || otros == null || total == null)
      return { error: `La fila ${Number(r?.fila) || '?'} no es válida.` };
    const extra: Record<string, string> = {};
    if (r.datos && typeof r.datos === 'object')
      for (const [k, val] of Object.entries(r.datos).slice(0, 60)) extra[s(k, 60)] = s(val, 200);
    lista.push({ fecha, comprobante: s(r.comprobante, 40), numero: s(r.numero, 40), cliente: s(r.cliente, 120), cuit: s(r.cuit, 20), neto, iva, otros, total, datos: extra });
  }
  const r = await guardarVentas(lista, { archivo: s(datos.archivo, 160) || 'archivo', filasArchivo: datos.filas.length });
  revalidatePath('/ventas');
  revalidatePath('/kpi');
  return { filas: datos.filas.length, comprobantes: r.comprobantes, nuevas: r.nuevas, actualizadas: r.actualizadas, hasta: r.hasta ?? undefined };
}
