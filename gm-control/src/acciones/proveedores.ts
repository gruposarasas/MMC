'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { type Estado, entero, falla, intentar, texto, tilde, volver } from '@/lib/form';
import { ListaProveedores, claveNombre, limpiarCuit } from '@/lib/proveedores';
import { exigirAdmin } from '@/lib/sesion';

const revalidar = () => {
  revalidatePath('/proveedores');
  revalidatePath('/compras');
  revalidatePath('/gastos');
  revalidatePath('/kpi');
};

export async function guardarProveedor(_: Estado, f: FormData): Promise<Estado> {
  await exigirAdmin();
  return intentar(async () => {
    const id = entero(f, 'id');
    const nombre = texto(f, 'nombre', 120).replace(/\s+/g, ' ') || falla('Poné el nombre.');
    const cuit = limpiarCuit(texto(f, 'cuit', 20));
    if (cuit && cuit.length !== 11) falla('El CUIT tiene que tener 11 números.');
    const email = texto(f, 'email', 120);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) falla('El mail no es válido.');
    const rubro_id = entero(f, 'rubro_id');
    const sql = db();
    if (rubro_id && !(await sql`select 1 from rubros where id = ${rubro_id}`).length) falla('Elegí el rubro.');

    const lista = await ListaProveedores.cargar(sql);
    const mismoCuit = cuit ? lista.buscar('', cuit) : null;
    if (mismoCuit && mismoCuit.id !== id) falla(`Ese CUIT ya es de «${mismoCuit.nombre}».`);
    const mismoNombre = lista.buscar(nombre);
    if (mismoNombre && mismoNombre.id !== id) falla(`Ya existe «${mismoNombre.nombre}». Si es el mismo, editalo o unilos.`);
    const p = {
      nombre, cuit, rubro_id, email,
      contacto: texto(f, 'contacto', 120),
      telefono: texto(f, 'telefono', 60),
      cbu: texto(f, 'cbu', 60),
      notas: texto(f, 'notas', 1000),
      activo: id ? tilde(f, 'activo') : true,
    };
    if (id) {
      const [antes] = await sql`select nombre, alias from proveedores where id = ${id}`;
      if (!antes) falla('No se encontró el proveedor.');
      // El nombre anterior queda guardado para reconocerlo en los Excel viejos.
      const alias = (antes.alias as string[]).filter((a) => claveNombre(a) !== claveNombre(nombre));
      if (claveNombre(antes.nombre) !== claveNombre(nombre) && !alias.some((a) => claveNombre(a) === claveNombre(antes.nombre))) alias.push(antes.nombre as string);
      await sql`update proveedores set ${sql({ ...p, alias })} where id = ${id}`;
    } else {
      await sql`insert into proveedores ${sql(p)}`;
    }
    revalidar();
    redirect(volver(f, '/proveedores'));
  });
}

/** Pasa todos los comprobantes de un proveedor repetido al que queda, y borra el repetido. */
export async function unirProveedores(_: Estado, f: FormData): Promise<Estado> {
  await exigirAdmin();
  return intentar(async () => {
    const origen = entero(f, 'id') ?? falla('Falta el proveedor.');
    const destino = entero(f, 'destino') ?? falla('Elegí con qué proveedor unirlo.');
    if (origen === destino) falla('Elegí otro proveedor.');
    await db().begin(async (tx) => {
      const [o] = await tx`select * from proveedores where id = ${origen} for update`;
      const [d] = await tx`select * from proveedores where id = ${destino} for update`;
      if (!o || !d) falla('No se encontró el proveedor.');
      await tx`update egresos set proveedor_id = ${destino} where proveedor_id = ${origen}`;
      await tx`delete from proveedores where id = ${origen}`;
      const alias = [...new Set([...(d.alias as string[]), o.nombre as string, ...(o.alias as string[])])].filter((a) => claveNombre(a) !== claveNombre(d.nombre));
      // Lo que el que queda no tenía, lo toma del repetido.
      const completar = Object.fromEntries(
        ['cuit', 'contacto', 'telefono', 'email', 'cbu', 'notas'].filter((k) => !d[k] && o[k]).map((k) => [k, o[k]]),
      );
      await tx`update proveedores set ${tx({ ...completar, alias, rubro_id: d.rubro_id ?? o.rubro_id })} where id = ${destino}`;
    });
    revalidar();
    redirect(volver(f, '/proveedores'));
  });
}

export async function borrarProveedor(f: FormData) {
  await exigirAdmin();
  const id = entero(f, 'id');
  // Solo si no tiene comprobantes: si los tiene, se desactiva o se une con otro.
  if (id) await db()`delete from proveedores p where id = ${id} and not exists (select 1 from egresos where proveedor_id = p.id)`;
  revalidar();
}
