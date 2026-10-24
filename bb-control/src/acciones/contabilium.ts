'use server';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { guardarAjuste } from '@/lib/ajustes';
import {
  credenciales, desdeTresMeses, guardarCredenciales, iniciarCarga, probarConexion, sincronizarCatalogo, sincronizarClientes,
  sincronizarProveedores, sincronizarVentas,
} from '@/lib/contabilium';
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
  if (!r.ok) return { error: r.error };
  // Los productos de cada venta se piden uno por uno: van en segundo plano.
  const c = await iniciarCarga(p.desde, fin, {});
  return { ok: `${r.mensaje}${c.ok ? ' Los productos de cada venta se traen en segundo plano.' : ''}` };
}

/** Trae todo de los últimos 3 meses en segundo plano: catálogo, ventas con sus productos, clientes y proveedores. */
export async function traerTodoContabilium(_: Estado): Promise<Estado> {
  await exigirAdmin();
  const r = await iniciarCarga(desdeTresMeses(), hoy(), { catalogo: true, ventas: true, clientes: true, proveedores: true });
  revalidatePath('/ajustes');
  return r.ok ? { ok: 'Empezó. Podés seguir usando la app: el avance se ve acá.' } : { error: r.error };
}

const conError = async (f: () => Promise<{ mensaje: string }>, rutas: string[]): Promise<Estado> => {
  try {
    const r = await f();
    for (const ruta of rutas) revalidatePath(ruta, 'layout');
    return { ok: `Listo: ${r.mensaje}.` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'No se pudo traer la información de Contabilium.' };
  }
};

export async function traerClientesContabilium(_: Estado): Promise<Estado> {
  await exigirAdmin();
  return conError(sincronizarClientes, ['/clientes']);
}

export async function traerProveedoresContabilium(_: Estado): Promise<Estado> {
  await exigirAdmin();
  return conError(sincronizarProveedores, ['/proveedores']);
}

/** Crea o actualiza los productos de Costos con los de Contabilium (nombre, rubro, precio e IVA). */
export async function traerProductosContabilium(_: Estado): Promise<Estado> {
  await exigirAdmin();
  return conError(sincronizarCatalogo, ['/costos']);
}
