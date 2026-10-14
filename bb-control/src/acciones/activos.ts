'use server';
// Activos e importaciones de equipos. Solo administración.
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { CATEGORIAS_ACTIVO, ESTADOS_ACTIVO, GASTOS_IMPORTACION } from '@/lib/activos';
import { db } from '@/lib/db';
import { type Estado, entero, falla, fechaForm, intentar, numero, texto, volver } from '@/lib/form';
import { normalizar } from '@/lib/importar';
import { exigirAdmin } from '@/lib/sesion';

const moneda = (f: FormData, k = 'moneda') => (texto(f, k) === 'ARS' ? 'ARS' : 'USD');
/** Número opcional: vacío queda sin cargar (null), no en 0. */
const opcional = (f: FormData, k: string) => (texto(f, k) ? numero(f, k, { min: 0 }) : null);

export async function guardarActivo(_: Estado, f: FormData): Promise<Estado> {
  await exigirAdmin();
  return intentar(async () => {
    const id = entero(f, 'id');
    const categoria = texto(f, 'categoria', 12);
    if (!Object.hasOwn(CATEGORIAS_ACTIVO, categoria)) falla('Elegí qué tipo de activo es.');
    const estado = texto(f, 'estado', 12);
    if (!Object.hasOwn(ESTADOS_ACTIVO, estado)) falla('Elegí dónde está.');
    const cliente = texto(f, 'cliente', 120).replace(/\s+/g, ' ');
    if (estado === 'cliente' && !cliente) falla('Poné en qué cliente está instalada.');
    const numeroSerie = texto(f, 'numero', 60);
    const importacion_id = entero(f, 'importacion_id');
    const sql = db();
    let mon = moneda(f);
    if (importacion_id) {
      const [l] = await sql`select moneda from activo_importaciones where id = ${importacion_id}`;
      if (!l) falla('Elegí la importación.');
      mon = l.moneda as 'ARS' | 'USD'; // el costo de mercadería va en la moneda de la importación
    }
    const a = {
      categoria, numero: numeroSerie, descripcion: texto(f, 'descripcion', 160) || falla('Poné la descripción (ej.: La Marzocco Linea Mini).'),
      marca: texto(f, 'marca', 60), modelo: texto(f, 'modelo', 60), estado, cliente,
      ubicacion: texto(f, 'ubicacion', 160), instalada: fechaForm(f, 'instalada'), importacion_id, moneda: mon,
      costo_mercaderia: opcional(f, 'costo_mercaderia'), costo_otros: numero(f, 'costo_otros', { min: 0 }),
      valor_estimado: opcional(f, 'valor_estimado'), alta: fechaForm(f, 'alta'), notas: texto(f, 'notas', 1000),
      clave: numeroSerie ? `${categoria}|${normalizar(numeroSerie)}` : null,
    };
    if (a.clave) {
      const [otro] = await sql`select descripcion from activos where clave = ${a.clave} and id <> ${id ?? 0}`;
      if (otro) falla(`Ya hay un activo con el número ${numeroSerie} (${otro.descripcion}).`);
    }
    if (id) await sql`update activos set ${sql(a)} where id = ${id}`;
    else await sql`insert into activos ${sql(a)}`;
    revalidatePath('/activos', 'layout');
    redirect(volver(f, '/activos'));
  });
}

export async function borrarActivo(f: FormData) {
  await exigirAdmin();
  const id = entero(f, 'id');
  if (id) await db()`delete from activos where id = ${id}`;
  revalidatePath('/activos', 'layout');
}

export async function guardarImportacionActivos(_: Estado, f: FormData): Promise<Estado> {
  await exigirAdmin();
  return intentar(async () => {
    const id = entero(f, 'id');
    const mon = moneda(f);
    const l: Record<string, unknown> = {
      nombre: texto(f, 'nombre', 120) || falla('Poné un nombre (ej.: Importación La Marzocco marzo 2026).'),
      fecha: fechaForm(f, 'fecha'), origen: texto(f, 'origen', 120), moneda: mon,
      cotizacion: mon === 'USD' ? numero(f, 'cotizacion', { requerido: 'Poné el dólar de la importación.', min: 0.0001, dec: 4 }) : 1,
      mercaderia: numero(f, 'mercaderia', { min: 0 }),
      unidades: entero(f, 'unidades') ?? falla('Poné cuántas unidades se importaron.'),
      notas: texto(f, 'notas', 1000),
    };
    for (const k of Object.keys(GASTOS_IMPORTACION)) {
      l[k] = numero(f, k, { min: 0 });
      l[`${k}_moneda`] = moneda(f, `${k}_moneda`);
    }
    const sql = db();
    if (id) await sql`update activo_importaciones set ${sql(l)} where id = ${id}`;
    else await sql`insert into activo_importaciones ${sql(l)}`;
    // Los activos de esta importación quedan en su moneda.
    if (id) await sql`update activos set moneda = ${mon} where importacion_id = ${id}`;
    revalidatePath('/activos', 'layout');
    redirect(volver(f, '/activos/importaciones'));
  });
}

export async function borrarImportacionActivos(f: FormData) {
  await exigirAdmin();
  const id = entero(f, 'id');
  if (id) await db()`delete from activo_importaciones where id = ${id}`;
  revalidatePath('/activos', 'layout');
}
