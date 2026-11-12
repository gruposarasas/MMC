import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
import { borrar, COOKIE_POSTULANTE } from '@/lib/sesion';
import { postulanteActual, borrarCv } from '@/lib/trabajo-servidor';

/** El postulante borra su perfil, su CV y sus postulaciones. */
export async function POST() {
  const p = await postulanteActual();
  if (!p) return NextResponse.json({ error: 'Tu sesión venció. Volvé a entrar.' }, { status: 401 });
  const { error } = await db().from('tb_postulantes').delete().eq('id', p.id);
  if (error) return NextResponse.json({ error: 'No se pudo borrar. Probá de nuevo.' }, { status: 500 });
  await borrarCv(p.cv_path);
  await borrar(COOKIE_POSTULANTE);
  return NextResponse.json({ ok: true });
}
