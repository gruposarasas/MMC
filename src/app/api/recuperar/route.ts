import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
import { escribir, COOKIE_VISITANTE } from '@/lib/sesion';
import { permitir, ip } from '@/lib/limite';

export async function POST(req: Request) {
  const dir = await ip();
  if (!permitir(`rec:${dir}`, 10, 60) || !permitir('rec:*', 300, 60))
    return NextResponse.json({ error: 'Demasiados intentos. Esperá un minuto y probá de nuevo.' }, { status: 429 });

  let via: 'mail' | 'wa', c: string;
  try {
    const j = await req.json();
    via = j.via === 'wa' ? 'wa' : 'mail';
    c = via === 'mail' ? String(j.contacto ?? '').trim().toLowerCase().slice(0, 200) : String(j.contacto ?? '').replace(/\D/g, '').slice(0, 11);
  } catch {
    return NextResponse.json({ error: 'Datos inválidos.' }, { status: 400 });
  }
  if (!c) return NextResponse.json({ error: via === 'mail' ? 'Escribí tu mail.' : 'Escribí tu número.' }, { status: 400 });

  const { data } = await db().from('visitantes').select('id').eq(via === 'mail' ? 'mail' : 'whatsapp', c).maybeSingle();
  if (!data)
    return NextResponse.json({ error: `No encontramos cupones con ${via === 'mail' ? 'ese mail' : 'ese número'}. Revisalo o registrate.` }, { status: 404 });

  await escribir(COOKIE_VISITANTE, data.id);
  return NextResponse.json({ ok: true });
}
