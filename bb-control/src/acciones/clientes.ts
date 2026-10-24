'use server';
// Semáforo de clientes: alta, edición y criterios. Solo administración.
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { guardarAjuste } from '@/lib/ajustes';
import { db } from '@/lib/db';
import { type Estado, entero, falla, intentar, numero, texto, tilde, volver } from '@/lib/form';
import { limpiarCuit } from '@/lib/proveedores';
import { CRITERIOS_DEFECTO, type Criterios, INDICADORES, type Indicador } from '@/lib/semaforo';
import { exigirAdmin } from '@/lib/sesion';

const opcional = (f: FormData, k: string, max?: number) => (texto(f, k) ? numero(f, k, { min: 0, max }) : null);
const listo = () => revalidatePath('/clientes', 'layout');

export async function guardarCliente(_: Estado, f: FormData): Promise<Estado> {
  await exigirAdmin();
  return intentar(async () => {
    const id = entero(f, 'id');
    const nombre = texto(f, 'nombre', 120).replace(/\s+/g, ' ') || falla('Poné el nombre del cliente.');
    const cuit = limpiarCuit(texto(f, 'cuit', 20));
    if (cuit && cuit.length !== 11) falla('El CUIT tiene que tener 11 números.');
    const c = {
      nombre, cuit,
      alias: texto(f, 'alias', 500).split(/[,;\n]/).map((x) => x.trim()).filter(Boolean).slice(0, 20),
      locales: Math.max(1, entero(f, 'locales') ?? 1),
      kilos_mes: opcional(f, 'kilos_mes'), kilos_desde_ventas: tilde(f, 'kilos_desde_ventas'),
      descuento_pct: numero(f, 'descuento_pct', { min: 0, max: 99 }), forma_pago: texto(f, 'forma_pago', 60) || 'Transferencia',
      plazo_dias: Math.min(entero(f, 'plazo_dias') ?? 0, 365), comision_pct: numero(f, 'comision_pct', { min: 0, max: 99 }),
      precio_kg: opcional(f, 'precio_kg'), notas: texto(f, 'notas', 1000), activo: id ? tilde(f, 'activo') : true,
      email: texto(f, 'email', 120), telefono: texto(f, 'telefono', 60), direccion: texto(f, 'direccion', 200),
    };
    if (!c.kilos_desde_ventas && c.kilos_mes == null) falla('Poné los kilos que compra por mes (o tildá "kilos según sus ventas").');
    const sql = db();
    const [otro] = await sql`select id from clientes where lower(nombre) = lower(${nombre}) and id <> ${id ?? 0}`;
    if (otro) falla(`Ya hay un cliente que se llama ${nombre}.`);
    let nuevoId = id;
    if (id) await sql`update clientes set ${sql(c)} where id = ${id}`;
    else [{ id: nuevoId }] = (await sql`insert into clientes ${sql(c)} returning id`) as unknown as { id: number }[];
    listo();
    redirect(volver(f, `/clientes/${nuevoId}`));
  });
}

export async function borrarCliente(f: FormData) {
  await exigirAdmin();
  const id = entero(f, 'id');
  if (id) await db()`delete from clientes where id = ${id}`;
  listo();
  redirect('/clientes');
}

/** Crea el cliente con el nombre que tiene una máquina en Activos, para completarle los datos. */
export async function crearClienteDesde(f: FormData) {
  await exigirAdmin();
  const nombre = texto(f, 'nombre', 120).replace(/\s+/g, ' ');
  if (!nombre) return;
  const sql = db();
  const [c] = await sql`insert into clientes (nombre, kilos_mes) values (${nombre}, null) on conflict (lower(nombre)) do update set nombre = clientes.nombre returning id`;
  listo();
  redirect(`/clientes/${c.id}?editar=1`);
}

export async function guardarCriterios(_: Estado, f: FormData): Promise<Estado> {
  await exigirAdmin();
  return intentar(async () => {
    const productoId = entero(f, 'productoId');
    const cr: Criterios = {
      productoId,
      kgPorUnidad: numero(f, 'kgPorUnidad', { min: 0.001, dec: 3 }) || 1,
      precioKg: opcional(f, 'precioKg'),
      costoKg: opcional(f, 'costoKg'),
      tasaMensual: numero(f, 'tasaMensual', { min: 0, max: 100 }),
      tasaMaquinasAnual: numero(f, 'tasaMaquinasAnual', { min: 0, max: 100 }),
      vidaUtilMeses: Math.max(1, entero(f, 'vidaUtilMeses') ?? CRITERIOS_DEFECTO.vidaUtilMeses),
      serviceMaquinaMes: numero(f, 'serviceMaquinaMes', { min: 0 }),
      rubrosCafe: f.getAll('rubro_cafe').map((x) => String(x).trim()).filter(Boolean).slice(0, 50),
      umbrales: { ...CRITERIOS_DEFECTO.umbrales },
      pesos: { ...CRITERIOS_DEFECTO.pesos },
    };
    if (!productoId && (!cr.precioKg || !cr.costoKg)) falla('Elegí el producto de referencia o poné el precio y el costo del kilo.');
    for (const k of Object.keys(INDICADORES) as Indicador[]) {
      const verde = numero(f, `${k}_verde`, { requerido: `Poné el valor verde de ${INDICADORES[k].nombre}.` });
      const rojo = numero(f, `${k}_rojo`, { requerido: `Poné el valor rojo de ${INDICADORES[k].nombre}.` });
      if (INDICADORES[k].mejorAlto ? verde <= rojo : verde >= rojo) {
        falla(`${INDICADORES[k].nombre}: el valor verde tiene que ser ${INDICADORES[k].mejorAlto ? 'mayor' : 'menor'} que el rojo.`);
      }
      cr.umbrales[k] = [verde, rojo];
      cr.pesos[k] = numero(f, `${k}_peso`, { min: 0, max: 100 });
    }
    if (!Object.values(cr.pesos).some((p) => p > 0)) falla('Al menos una variable tiene que pesar.');
    await guardarAjuste('semaforo', cr);
    listo();
    return { ok: 'Criterios guardados. El semáforo ya está recalculado.' };
  });
}
