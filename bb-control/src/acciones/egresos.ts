'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { hoy } from '@/lib/formato';
import { type Estado, entero, falla, fechaForm, intentar, numero, texto, tilde, volver } from '@/lib/form';
import { exigirAdmin } from '@/lib/sesion';

const ruta = (tipo: string) => (tipo === 'compra' ? '/compras' : '/gastos');

export async function guardarEgreso(_: Estado, f: FormData): Promise<Estado> {
  await exigirAdmin();
  return intentar(async () => {
    const tipo = texto(f, 'tipo') === 'compra' ? 'compra' : 'gasto';
    const id = entero(f, 'id');
    const rubro_id = entero(f, 'rubro_id') ?? falla('Elegí el rubro.');
    const sql = db();
    const [rubro] = await sql`select tipo from rubros where id = ${rubro_id}`;
    if (!rubro || rubro.tipo !== tipo) falla('Elegí el rubro.');
    const moneda = texto(f, 'moneda') === 'USD' ? 'USD' : 'ARS';
    const fecha = fechaForm(f, 'fecha', 'Poné la fecha.')!;
    const pagado = tilde(f, 'pagado');
    const cantidadTxt = texto(f, 'cantidad', 20);
    const e = {
      tipo,
      fecha,
      rubro_id,
      proveedor: texto(f, 'proveedor', 120),
      comprobante: texto(f, 'comprobante', 40),
      numero: texto(f, 'numero', 40),
      descripcion: texto(f, 'descripcion', 300),
      cantidad: cantidadTxt ? numero(f, 'cantidad', { min: 0, dec: 3 }) : null,
      unidad: texto(f, 'unidad', 20),
      moneda,
      cotizacion: moneda === 'USD' ? numero(f, 'cotizacion', { requerido: 'Poné la cotización del dólar.', min: 0.0001, dec: 4 }) : 1,
      neto: numero(f, 'neto'),
      iva_alicuota: numero(f, 'iva_alicuota', { min: 0, max: 100 }),
      iva: numero(f, 'iva'),
      otros: numero(f, 'otros'),
      pagado,
      fecha_pago: pagado ? (fechaForm(f, 'fecha_pago') ?? fecha) : null,
      vencimiento: pagado ? null : fechaForm(f, 'vencimiento'),
      medio_pago: texto(f, 'medio_pago', 40),
      notas: texto(f, 'notas', 1000),
    };
    if (!e.neto && !e.iva && !e.otros) falla('Poné el importe.');
    if (!e.proveedor && !e.descripcion) falla('Poné el proveedor o una descripción.');
    if (id) await sql`update egresos set ${sql(e)} where id = ${id} and tipo = ${tipo}`;
    else await sql`insert into egresos ${sql(e)}`;
    revalidatePath(ruta(tipo));
    redirect(volver(f, ruta(tipo)));
  });
}

export async function borrarEgreso(f: FormData) {
  await exigirAdmin();
  const id = entero(f, 'id');
  if (id) await db()`delete from egresos where id = ${id}`;
  revalidatePath('/compras');
  revalidatePath('/gastos');
}

export async function marcarPagado(f: FormData) {
  await exigirAdmin();
  const id = entero(f, 'id');
  if (id) await db()`update egresos set pagado = true, fecha_pago = ${hoy()}, vencimiento = null where id = ${id}`;
  revalidatePath('/compras');
  revalidatePath('/gastos');
}
