import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
import { escribir, COOKIE_VP_LOCAL } from '@/lib/sesion';
import { permitir, superado, ip } from '@/lib/limite';

/** El encargado de un local entra a su panel con la clave del local. */
export async function POST(req: Request) {
  const dir = await ip();
  if (superado(`vpl-fallo:${dir}`, 8, 900)) return NextResponse.json({ error: 'Demasiados intentos. Esperá unos minutos.' }, { status: 429 });
  const j = await req.json().catch(() => ({}));
  const clave = String(j.clave ?? '').toUpperCase().replace(/[^0-9A-Z]/g, '');
  const { data } = /^[0-9A-Z]{8}$/.test(clave) ? await db().from('vp_locales').select('id, clave_version').eq('clave', clave).maybeSingle() : { data: null };
  if (!data) {
    permitir(`vpl-fallo:${dir}`, 8, 900);
    return NextResponse.json({ error: 'La clave no es correcta.' }, { status: 401 });
  }
  await escribir(COOKIE_VP_LOCAL, `${data.id}:${data.clave_version}`);
  return NextResponse.json({ ok: true });
}
