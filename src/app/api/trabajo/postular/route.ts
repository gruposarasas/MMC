import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
import { permitir } from '@/lib/limite';
import { limpiar } from '@/lib/trabajo';
import { postulanteActual, vacante } from '@/lib/trabajo-servidor';

/** El postulante (con sesión) se postula a una vacante abierta, con un mensaje opcional. */
export async function POST(req: Request) {
  const p = await postulanteActual();
  if (!p) return NextResponse.json({ error: 'Para postularte primero cargá tu CV o entrá con tu clave.' }, { status: 401 });
  if (p.oculto) return NextResponse.json({ error: 'Tu perfil está suspendido. Comunicate con AEHGA.' }, { status: 403 });
  if (!permitir(`tp-post:${p.id}`, 30, 3600)) return NextResponse.json({ error: 'Esperá un rato y probá de nuevo.' }, { status: 429 });
  const j = await req.json().catch(() => ({}));
  const v = await vacante(String(j.vacante ?? ''));
  if (!v || !v.abierta || v.oculta || v.empresa?.oculta) return NextResponse.json({ error: 'Esta vacante ya no está disponible.' }, { status: 404 });
  const { error } = await db().from('tb_postulaciones').insert({ vacante_id: v.id, postulante_id: p.id, mensaje: limpiar(j.mensaje, 500) });
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Ya te postulaste a esta vacante.' }, { status: 409 });
    return NextResponse.json({ error: 'No se pudo enviar. Probá de nuevo.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
