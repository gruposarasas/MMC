'use server';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { type Estado, entero, falla, intentar, texto, tilde } from '@/lib/form';
import { exigirAdmin } from '@/lib/sesion';

const CLASES = ['operativo', 'impuestos', 'cargas', 'inversion'];

export async function guardarRubro(_: Estado, f: FormData): Promise<Estado> {
  await exigirAdmin();
  return intentar(async () => {
    const id = entero(f, 'id');
    const tipo = texto(f, 'tipo') === 'compra' ? 'compra' : 'gasto';
    const nombre = texto(f, 'nombre', 80) || falla('Poné el nombre del rubro.');
    const clase = tipo === 'compra' ? 'operativo' : CLASES.includes(texto(f, 'clase')) ? texto(f, 'clase') : 'operativo';
    const sql = db();
    const [otro] = await sql`select id from rubros where tipo = ${tipo} and lower(nombre) = lower(${nombre}) and id is distinct from ${id}`;
    if (otro) falla('Ya hay un rubro con ese nombre.');
    if (id) await sql`update rubros set nombre = ${nombre}, clase = ${clase}, activo = ${tilde(f, 'activo')} where id = ${id}`;
    else
      await sql`insert into rubros (tipo, nombre, clase, orden)
                values (${tipo}, ${nombre}, ${clase}, (select coalesce(max(orden), 0) + 1 from rubros where tipo = ${tipo}))`;
    revalidatePath('/ajustes');
    revalidatePath('/compras');
    revalidatePath('/gastos');
    return { ok: id ? 'Guardado.' : 'Rubro agregado.' };
  });
}
