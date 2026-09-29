import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
import { soloAdmin } from '@/lib/admin';
import { estadoSorteo as estado } from '@/lib/sorteo';

export const dynamic = 'force-dynamic';

/** Estado para la pantalla del sorteo (se consulta cada pocos segundos). */
export async function GET() {
  const no = await soloAdmin();
  if (no) return no;
  return NextResponse.json(await estado(), { headers: { 'cache-control': 'no-store' } });
}

/** Acciones: abrir, cerrar, sortear, limpiar (borra presentes y ganadores). */
export async function POST(req: Request) {
  const no = await soloAdmin();
  if (no) return no;
  const { accion } = await req.json().catch(() => ({}));
  if (accion === 'abrir' || accion === 'cerrar') {
    const { error } = await db().from('sorteo').update({ abierto: accion === 'abrir', updated_at: new Date().toISOString() }).eq('id', 1);
    if (error) return NextResponse.json({ error: 'No se pudo cambiar el estado.' }, { status: 500 });
    return NextResponse.json(await estado());
  }
  if (accion === 'sortear') {
    const { data, error } = await db().rpc('sortear');
    if (error) return NextResponse.json({ error: 'No se pudo sortear.' }, { status: 500 });
    if (data?.estado === 'sin_presentes') return NextResponse.json({ error: 'No hay presentes para sortear.' }, { status: 409 });
    return NextResponse.json({ ganador: { id: data.id, nombre: data.nombre, entre: data.entre } });
  }
  if (accion === 'limpiar') {
    const a = await db().from('ganadores').delete().gt('id', 0);
    const b = await db().from('visitantes').update({ presente_at: null }).not('presente_at', 'is', null);
    if (a.error || b.error) return NextResponse.json({ error: 'No se pudo reiniciar.' }, { status: 500 });
    return NextResponse.json(await estado());
  }
  return NextResponse.json({ error: 'Acción desconocida.' }, { status: 400 });
}
