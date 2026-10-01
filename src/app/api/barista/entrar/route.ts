import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
import { escribir, COOKIE_BARISTA } from '@/lib/sesion';
import { permitir, superado, ip } from '@/lib/limite';

export async function POST(req: Request) {
  const dir = await ip();
  if (superado(`bfallo:${dir}`, 10, 900) || superado('bfallo:*', 100, 600))
    return NextResponse.json({ error: 'Demasiados intentos. Esperá unos minutos.' }, { status: 429 });
  let clave = '';
  try {
    clave = String((await req.json()).clave ?? '').trim().toUpperCase().slice(0, 30);
  } catch {}
  const { data } = clave ? await db().from('baristas').select('id, clave_version').eq('clave', clave).maybeSingle() : { data: null };
  if (!data) {
    permitir(`bfallo:${dir}`, 10, 900);
    permitir('bfallo:*', 100, 600);
    return NextResponse.json({ error: 'Esa clave no corresponde a ningún barista.' }, { status: 401 });
  }
  await escribir(COOKIE_BARISTA, `${data.id}:${data.clave_version}`);
  return NextResponse.json({ ok: true });
}
