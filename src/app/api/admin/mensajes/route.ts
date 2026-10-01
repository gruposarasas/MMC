import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
import { soloAdmin } from '@/lib/admin';

/** Ocultar o volver a mostrar un mensaje de aliento. */
export async function POST(req: Request) {
  const no = await soloAdmin();
  if (no) return no;
  const j = await req.json().catch(() => ({}));
  const id = Number(j.id);
  if (!Number.isInteger(id) || id < 1) return NextResponse.json({ error: 'Datos inválidos.' }, { status: 400 });
  const { error } = await db().from('mensajes_barista').update({ oculto: j.oculto === true }).eq('id', id);
  if (error) return NextResponse.json({ error: 'No se pudo guardar.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
