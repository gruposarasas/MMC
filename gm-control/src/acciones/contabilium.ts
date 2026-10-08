'use server';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { guardarAjuste } from '@/lib/ajustes';
import { credenciales, guardarCredenciales, probarConexion, sincronizarVentas, traerProductos } from '@/lib/contabilium';
import { hoy, periodo, sumarDias } from '@/lib/formato';
import { type Estado, intentar, falla, texto, tilde } from '@/lib/form';
import { exigirAdmin } from '@/lib/sesion';

export type EstadoConexion = Estado & { muestra?: { fecha: string; comprobante: string; numero: string; cliente: string; neto: number; iva: number; total: number }[]; campos?: string[] };

export async function conectarContabilium(_: EstadoConexion, f: FormData): Promise<EstadoConexion> {
  await exigirAdmin();
  return intentar(async () => {
    const email = texto(f, 'email', 120);
    const clave = texto(f, 'clave', 300);
    const cred = await credenciales();
    if (!email) falla('Poné el email de la API de Contabilium.');
    // Si deja la clave vacía, se vuelve a probar la que ya estaba guardada.
    if (clave) await guardarCredenciales(email, clave);
    else if (!cred) falla('Poné la API Key.');
    else if (cred.origen === 'ajustes' && cred.email !== email) await guardarCredenciales(email, cred.clave);
    const r = await probarConexion();
    if (!r.ok) {
      if (clave) await db()`delete from ajustes where clave = 'contabilium_credenciales'`;
      falla(r.error);
      return;
    }
    revalidatePath('/ajustes');
    revalidatePath('/ventas');
    return { ok: `Conectado con ${r.nombre}${r.cuit ? ` (CUIT ${r.cuit})` : ''}.`, muestra: r.muestra, campos: r.campos };
  }) as Promise<EstadoConexion>;
}

export async function desconectarContabilium() {
  await exigirAdmin();
  await db()`delete from ajustes where clave in ('contabilium_credenciales', 'contabilium_estado')`;
  revalidatePath('/ajustes');
  revalidatePath('/ventas');
}

export async function configurarContabilium(f: FormData) {
  await exigirAdmin();
  await guardarAjuste('contabilium_config', { auto: tilde(f, 'auto') });
  revalidatePath('/ajustes');
}

/** Trae de Contabilium las ventas del período que se está mirando (mes o año). */
export async function traerVentasContabilium(_: Estado, f: FormData): Promise<Estado> {
  await exigirAdmin();
  const p = periodo(texto(f, 'p', 7));
  if (p.desde > hoy()) return { error: 'Ese período todavía no empezó.' };
  const ultimo = sumarDias(p.hasta, -1); // p.hasta es el primer día del período siguiente
  const fin = ultimo > hoy() ? hoy() : ultimo;
  const r = await sincronizarVentas(p.desde, fin);
  revalidatePath('/ventas');
  revalidatePath('/kpi');
  revalidatePath('/ajustes');
  return r.ok ? { ok: r.mensaje } : { error: r.error };
}

/** Crea o actualiza los productos de Costos con los de Contabilium (nombre, rubro, precio e IVA). */
export async function traerProductosContabilium(_: Estado): Promise<Estado> {
  await exigirAdmin();
  let lista: Awaited<ReturnType<typeof traerProductos>>;
  try {
    lista = await traerProductos();
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'No se pudieron traer los productos.' };
  }
  if (!lista.length) return { error: 'Contabilium no devolvió productos.' };
  const sql = db();
  const nuevos = await sql.begin(async (tx) => {
    let n = 0;
    for (const p of lista) {
      const [existe] = await tx`select id from productos where lower(nombre) = lower(${p.nombre}) and presentacion = '' limit 1`;
      if (existe) {
        await tx`update productos set precio = ${p.precio}, iva_alicuota = ${p.iva},
                   categoria = case when ${p.categoria} <> '' then ${p.categoria} else categoria end
                 where id = ${existe.id as number}`;
      } else {
        await tx`insert into productos (nombre, categoria, precio, iva_alicuota, notas)
                 values (${p.nombre}, ${p.categoria}, ${p.precio}, ${p.iva}, ${p.codigo ? `Código Contabilium: ${p.codigo}` : ''})`;
        n++;
      }
    }
    return n;
  });
  revalidatePath('/costos', 'layout');
  return { ok: `Listo: ${nuevos} productos nuevos y ${lista.length - nuevos} actualizados desde Contabilium.` };
}
