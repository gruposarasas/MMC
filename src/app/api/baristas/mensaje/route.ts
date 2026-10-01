import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
import { leer, COOKIE_VISITANTE } from '@/lib/sesion';
import { permitir } from '@/lib/limite';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Mensaje de aliento de un visitante a un barista. */
export async function POST(req: Request) {
  const vid = await leer(COOKIE_VISITANTE);
  if (!vid) return NextResponse.json({ error: 'Tu sesión venció. Volvé a entrar.' }, { status: 401 });
  const j = await req.json().catch(() => ({}));
  const bid = String(j.barista ?? '');
  const texto = String(j.texto ?? '').trim().replace(/\s+/g, ' ');
  if (!UUID.test(bid)) return NextResponse.json({ error: 'Datos inválidos.' }, { status: 400 });
  if (!texto) return NextResponse.json({ error: 'Escribí tu mensaje.' }, { status: 400 });
  if (texto.length > 280) return NextResponse.json({ error: 'El mensaje puede tener hasta 280 caracteres.' }, { status: 400 });
  if (!permitir(`msj:${vid}:${bid}`, 3, 3600) || !permitir(`msj:${vid}`, 12, 3600))
    return NextResponse.json({ error: 'Ya le mandaste varios mensajes. Probá más tarde.' }, { status: 429 });
  const { data: b } = await db().from('baristas').select('id').eq('id', bid).maybeSingle();
  if (!b) return NextResponse.json({ error: 'Ese barista no está en el torneo.' }, { status: 404 });
  const { error } = await db().from('mensajes_barista').insert({ barista_id: bid, visitante_id: vid, texto });
  if (error) return NextResponse.json({ error: 'No se pudo enviar. Probá de nuevo.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
