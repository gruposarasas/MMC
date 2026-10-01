import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
import { baristaActual } from '@/lib/votos';
import { subirImagen } from '@/lib/logos';
import { permitir } from '@/lib/limite';

/** El barista guarda su perfil: foto, historia, hobby, experiencia y por qué merece ganar. */
export async function POST(req: Request) {
  const b = await baristaActual();
  if (!b) return NextResponse.json({ error: 'Tu sesión venció. Volvé a entrar.' }, { status: 401 });
  if (!permitir(`bperfil:${b.id}`, 20, 600)) return NextResponse.json({ error: 'Esperá un momento y probá de nuevo.' }, { status: 429 });
  const j = await req.json().catch(() => null);
  if (!j) return NextResponse.json({ error: 'Datos inválidos.' }, { status: 400 });
  const t = (k: string, max: number) => String(j[k] ?? '').trim().replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').slice(0, max);
  const cambios: Record<string, unknown> = {
    historia: t('historia', 700),
    hobby: t('hobby', 200),
    experiencia: t('experiencia', 700),
    por_que: t('por_que', 700),
    perfil_at: new Date().toISOString(),
  };
  const foto = String(j.foto ?? 'mantener');
  try {
    if (foto === 'quitar') cambios.foto_path = null;
    else if (foto !== 'mantener') cambios.foto_path = await subirImagen(`baristas/${b.id}`, foto, 'La foto');
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
  const { error } = await db().from('baristas').update(cambios).eq('id', b.id);
  if (error) return NextResponse.json({ error: 'No se pudo guardar. Probá de nuevo.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
