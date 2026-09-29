import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
import { leer, COOKIE_VISITANTE } from '@/lib/sesion';
import { sorteoAbierto } from '@/lib/sorteo';

export const dynamic = 'force-dynamic';

/** Estado del sorteo para el visitante: si está abierto y si ya confirmó que está presente. */
export async function GET() {
  const vid = await leer(COOKIE_VISITANTE);
  if (!vid) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 });
  const [abierto, { data }] = await Promise.all([sorteoAbierto(), db().from('visitantes').select('presente_at').eq('id', vid).maybeSingle()]);
  return NextResponse.json({ abierto, presente: !!data?.presente_at }, { headers: { 'cache-control': 'no-store' } });
}
