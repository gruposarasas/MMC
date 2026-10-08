'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { guardarAjuste } from '@/lib/ajustes';
import { db } from '@/lib/db';
import { hoy } from '@/lib/formato';
import { type Estado, entero, falla, intentar, numero, texto, volver } from '@/lib/form';
import { exigirAdmin } from '@/lib/sesion';

const refrescar = () => {
  revalidatePath('/costos', 'layout');
};

export async function guardarDolar(_: Estado, f: FormData): Promise<Estado> {
  await exigirAdmin();
  return intentar(async () => {
    const valor = numero(f, 'dolar', { requerido: 'Poné la cotización.', min: 1, dec: 2 });
    await guardarAjuste('dolar', { valor, fecha: hoy() });
    refrescar();
    revalidatePath('/compras');
    revalidatePath('/ajustes');
    return { ok: 'Cotización guardada.' };
  });
}

export async function guardarInsumo(_: Estado, f: FormData): Promise<Estado> {
  await exigirAdmin();
  return intentar(async () => {
    const id = entero(f, 'id');
    const i = {
      nombre: texto(f, 'nombre', 100) || falla('Poné el nombre.'),
      categoria: texto(f, 'categoria', 60),
      unidad: texto(f, 'unidad', 15) || 'u',
      moneda: texto(f, 'moneda') === 'USD' ? 'USD' : 'ARS',
      costo: numero(f, 'costo', { requerido: 'Poné el costo.', min: 0, dec: 4 }),
      actualizado: hoy(),
      notas: texto(f, 'notas', 500),
    };
    const sql = db();
    const [otro] = await sql`select id from insumos where lower(nombre) = lower(${i.nombre}) and id is distinct from ${id}`;
    if (otro) falla('Ya hay un insumo con ese nombre.');
    if (id) await sql`update insumos set ${sql(i)} where id = ${id}`;
    else await sql`insert into insumos ${sql(i)}`;
    refrescar();
    redirect(volver(f, '/costos?ver=insumos'));
  });
}

export async function borrarInsumo(f: FormData) {
  await exigirAdmin();
  const id = entero(f, 'id');
  if (!id) return;
  const sql = db();
  const [uso] = await sql`select count(*) n from receta where insumo_id = ${id}`;
  if (Number(uso.n) === 0) await sql`delete from insumos where id = ${id}`;
  refrescar();
}

export async function guardarProducto(_: Estado, f: FormData): Promise<Estado> {
  await exigirAdmin();
  return intentar(async () => {
    const id = entero(f, 'id');
    const p = {
      nombre: texto(f, 'nombre', 100) || falla('Poné el nombre.'),
      categoria: texto(f, 'categoria', 60),
      presentacion: texto(f, 'presentacion', 60),
      precio: numero(f, 'precio', { min: 0 }),
      iva_alicuota: numero(f, 'iva_alicuota', { min: 0, max: 100 }),
      variables_pct: numero(f, 'variables_pct', { min: 0, max: 90 }),
      margen_objetivo: numero(f, 'margen_objetivo', { min: 0, max: 95 }),
      notas: texto(f, 'notas', 1000),
    };
    const sql = db();
    let nuevo = id;
    if (id) await sql`update productos set ${sql(p)} where id = ${id}`;
    else [{ id: nuevo }] = (await sql`insert into productos ${sql(p)} returning id`) as unknown as { id: number }[];
    refrescar();
    redirect(id ? volver(f, `/costos/${id}`) : `/costos/${nuevo}`);
  });
}

export async function borrarProducto(f: FormData) {
  await exigirAdmin();
  const id = entero(f, 'id');
  if (id) await db()`delete from productos where id = ${id}`;
  refrescar();
  redirect('/costos');
}

export async function duplicarProducto(f: FormData) {
  await exigirAdmin();
  const id = entero(f, 'id');
  if (!id) return;
  const nuevo = await db().begin(async (sql) => {
    const [p] = await sql`
      insert into productos (nombre, categoria, presentacion, precio, iva_alicuota, variables_pct, margen_objetivo, notas)
      select nombre || ' (copia)', categoria, presentacion, precio, iva_alicuota, variables_pct, margen_objetivo, notas from productos where id = ${id}
      returning id`;
    await sql`insert into receta (producto_id, insumo_id, cantidad, merma_pct, orden)
              select ${p.id}, insumo_id, cantidad, merma_pct, orden from receta where producto_id = ${id}`;
    return p.id as number;
  });
  refrescar();
  redirect(`/costos/${nuevo}`);
}

export async function agregarLinea(_: Estado, f: FormData): Promise<Estado> {
  await exigirAdmin();
  return intentar(async () => {
    const producto_id = entero(f, 'producto_id') ?? falla('Falta el producto.');
    const insumo_id = entero(f, 'insumo_id') ?? falla('Elegí el insumo.');
    const cantidad = numero(f, 'cantidad', { requerido: 'Poné la cantidad.', min: 0.0001, dec: 4 });
    const merma = numero(f, 'merma_pct', { min: 0, max: 99 });
    await db()`insert into receta (producto_id, insumo_id, cantidad, merma_pct, orden)
               values (${producto_id}, ${insumo_id}, ${cantidad}, ${merma},
                       (select coalesce(max(orden), 0) + 1 from receta where producto_id = ${producto_id}))`;
    refrescar();
    return { ok: 'Agregado.' };
  });
}

export async function actualizarLinea(_: Estado, f: FormData): Promise<Estado> {
  await exigirAdmin();
  return intentar(async () => {
    const id = entero(f, 'id') ?? falla('Falta la línea.');
    const cantidad = numero(f, 'cantidad', { requerido: 'Poné la cantidad.', min: 0.0001, dec: 4 });
    const merma = numero(f, 'merma_pct', { min: 0, max: 99 });
    await db()`update receta set cantidad = ${cantidad}, merma_pct = ${merma} where id = ${id}`;
    refrescar();
    return { ok: 'Guardado.' };
  });
}

export async function borrarLinea(f: FormData) {
  await exigirAdmin();
  const id = entero(f, 'id');
  if (id) await db()`delete from receta where id = ${id}`;
  refrescar();
}
