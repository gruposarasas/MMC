'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { leerDolar } from '@/lib/ajustes';
import { db } from '@/lib/db';
import { hoy } from '@/lib/formato';
import { guardarItems, totalesItems, validarItems } from '@/lib/items';
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
    const porItems = texto(f, 'modo') === 'items';
    let items: ReturnType<typeof validarItems> = [];
    if (porItems) {
      try {
        items = validarItems(JSON.parse(texto(f, 'items', 500_000) || '[]'));
      } catch (err) {
        if (err instanceof SyntaxError) falla('No se pudieron leer los productos. Probá de nuevo.');
        throw err;
      }
      if (!items.length) falla('Agregá al menos un producto, o elegí "Solo el total".');
    }
    const t = totalesItems(items);
    const unidades = [...new Set(items.map((i) => i.unidad))];
    const descripcion = texto(f, 'descripcion', 300) || (items.length ? items[0].descripcion + (items.length > 1 ? ` y ${items.length - 1} más` : '') : '');
    const e = {
      tipo,
      fecha,
      rubro_id,
      proveedor: texto(f, 'proveedor', 120),
      comprobante: texto(f, 'comprobante', 40),
      numero: texto(f, 'numero', 40),
      descripcion,
      // Si todos los renglones tienen la misma unidad, se guarda la cantidad total (ej.: kg de café).
      cantidad: porItems && unidades.length === 1 && unidades[0] ? items.reduce((a, i) => a + i.cantidad, 0) : null,
      unidad: porItems && unidades.length === 1 ? unidades[0] : '',
      moneda,
      cotizacion: moneda === 'USD' ? numero(f, 'cotizacion', { requerido: 'Poné la cotización del dólar.', min: 0.0001, dec: 4 }) : 1,
      neto: porItems ? t.neto : numero(f, 'neto'),
      iva_alicuota: porItems ? t.alicuota : numero(f, 'iva_alicuota', { min: 0, max: 100 }),
      iva: porItems ? t.iva : numero(f, 'iva'),
      otros: numero(f, 'otros'),
      pagado,
      fecha_pago: pagado ? (fechaForm(f, 'fecha_pago') ?? fecha) : null,
      vencimiento: pagado ? null : fechaForm(f, 'vencimiento'),
      medio_pago: texto(f, 'medio_pago', 40),
      notas: texto(f, 'notas', 1000),
    };
    if (!e.neto && !e.iva && !e.otros) falla(porItems ? 'Poné los precios de los productos.' : 'Poné el importe.');
    if (!e.proveedor && !e.descripcion) falla('Poné el proveedor o una descripción.');
    const dolar = (await leerDolar())?.valor ?? null;
    await sql.begin(async (tx) => {
      let egresoId = id;
      if (id) {
        const r = await tx`update egresos set ${tx(e)} where id = ${id} and tipo = ${tipo} returning id`;
        if (!r.length) falla('No se encontró el comprobante.');
      } else {
        [{ id: egresoId }] = (await tx`insert into egresos ${tx(e)} returning id`) as unknown as { id: number }[];
      }
      await guardarItems(tx, egresoId!, items, { moneda, cotizacion: e.cotizacion, actualizarCostos: tilde(f, 'actualizar_costos'), dolar });
    });
    revalidatePath('/costos', 'layout');
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
