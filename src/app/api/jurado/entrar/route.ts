import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
import { escribir, COOKIE_JURADO } from '@/lib/sesion';
import { permitir, superado, ip } from '@/lib/limite';

export async function POST(req: Request) {
  const dir = await ip();
  if (superado(`jfallo:${dir}`, 10, 900) || superado('jfallo:*', 60, 600))
    return NextResponse.json({ error: 'Demasiados intentos. Esperá unos minutos.' }, { status: 429 });
  let clave = '';
  let n = 0;
  try {
    const j = await req.json();
    clave = String(j.clave ?? '').trim().toUpperCase().slice(0, 30);
    n = Number(j.n) || 0;
  } catch {}
  // El jurado elige su número (1, 2 o 3) y escribe la clave: los tres pueden tener la misma.
  const { data } = clave && [1, 2, 3].includes(n) ? await db().from('jurados').select('n, clave_version').eq('n', n).eq('clave', clave).maybeSingle() : { data: null };
  if (!data) {
    permitir(`jfallo:${dir}`, 10, 900);
    permitir('jfallo:*', 60, 600);
    return NextResponse.json({ error: 'Esa clave no corresponde a ningún jurado.' }, { status: 401 });
  }
  await escribir(COOKIE_JURADO, `${data.n}:${data.clave_version}`);
  return NextResponse.json({ ok: true });
}
