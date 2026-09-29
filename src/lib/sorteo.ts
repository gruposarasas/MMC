// Sorteo de la camiseta. Solo servidor.
import { db } from './supabase';
import { todo } from './datos';

export async function sorteoAbierto() {
  const { data } = await db().from('sorteo').select('abierto').eq('id', 1).maybeSingle();
  return !!data?.abierto;
}

/** "Lucía Fernández" → "Lucía F." (para mostrar en pantalla sin exponer apellidos completos). */
export const nombreCorto = (n: string) => {
  const [a, ...r] = n.trim().split(/\s+/);
  return r.length ? `${a} ${r[r.length - 1][0].toUpperCase()}.` : a;
};

/** Estado completo para la pantalla del sorteo. */
export async function estadoSorteo() {
  const [abierto, pres, gan] = await Promise.all([
    sorteoAbierto(),
    todo((d, h) => db().from('visitantes').select('id, nombre').not('presente_at', 'is', null).order('presente_at', { ascending: true }).order('id').range(d, h)),
    db().from('ganadores').select('id, created_at, visitantes(nombre)').order('created_at', { ascending: true }),
  ]);
  return {
    abierto,
    presentes: pres.map((v) => ({ id: v.id as string, n: nombreCorto(v.nombre as string) })),
    ganadores: (gan.data || []).map((g) => ({ id: g.id as number, nombre: ((g.visitantes as unknown as { nombre: string } | null)?.nombre) || '', cuando: g.created_at as string })),
  };
}
