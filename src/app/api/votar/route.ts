import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
import { leer, COOKIE_VISITANTE } from '@/lib/sesion';
import { permitir } from '@/lib/limite';
import { votosAbiertos } from '@/lib/config';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Voto del visitante: stand más lindo o barista favorito. Una sola vez cada uno, hasta el domingo 20 hs. */
export async function POST(req: Request) {
  const vid = await leer(COOKIE_VISITANTE);
  if (!vid) return NextResponse.json({ error: 'Tu sesión venció. Volvé a entrar.' }, { status: 401 });
  if (!permitir(`votar:${vid}`, 10, 60)) return NextResponse.json({ error: 'Esperá un momento.' }, { status: 429 });
  if (!votosAbiertos()) return NextResponse.json({ error: 'La votación ya cerró.' }, { status: 409 });
  const j = await req.json().catch(() => ({}));
  const id = String(j.id ?? '');
  if (!UUID.test(id) || !['stand', 'barista'].includes(j.tipo)) return NextResponse.json({ error: 'Datos inválidos.' }, { status: 400 });

  const stand = j.tipo === 'stand';
  const existe = stand
    ? await db().from('marcas').select('id').eq('id', id).eq('eliminada', false).maybeSingle()
    : await db().from('baristas').select('id').eq('id', id).maybeSingle();
  if (!existe.data) return NextResponse.json({ error: stand ? 'Esa marca no está en la votación.' : 'Ese barista no está en el torneo.' }, { status: 404 });

  const { error } = stand
    ? await db().from('votos_stand').insert({ visitante_id: vid, marca_id: id })
    : await db().from('votos_barista').insert({ visitante_id: vid, barista_id: id });
  if (error?.code === '23505') return NextResponse.json({ error: 'Ya votaste. Se puede votar una sola vez.' }, { status: 409 });
  if (error) return NextResponse.json({ error: 'No se pudo guardar tu voto. Probá de nuevo.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
