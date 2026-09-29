import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
import { leer, COOKIE_VISITANTE } from '@/lib/sesion';
import { permitir } from '@/lib/limite';
import { inscripcion } from '@/lib/sorteo';

/** El visitante confirma que está presente para el sorteo. */
export async function POST() {
  const vid = await leer(COOKIE_VISITANTE);
  if (!vid) return NextResponse.json({ error: 'Tu sesión venció. Volvé a entrar.' }, { status: 401 });
  if (!permitir(`presente:${vid}`, 10, 60)) return NextResponse.json({ error: 'Esperá un momento.' }, { status: 429 });
  const ins = await inscripcion();
  if (!ins.habilitada)
    return NextResponse.json(
      { error: ins.ventana === 'antes' ? 'Todavía no: podés poner presente el domingo 4 de octubre a partir de las 18 hs.' : 'La inscripción al sorteo ya cerró.' },
      { status: 409 },
    );
  const { error } = await db().from('visitantes').update({ presente_at: new Date().toISOString() }).eq('id', vid).is('presente_at', null);
  if (error) return NextResponse.json({ error: 'No se pudo confirmar. Probá de nuevo.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
