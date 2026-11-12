import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
import { escribir, COOKIE_EMPRESA } from '@/lib/sesion';
import { permitir, superado, ip } from '@/lib/limite';
import { claveCorrecta } from '@/lib/trabajo-servidor';

export async function POST(req: Request) {
  const dir = await ip();
  if (superado(`te-fallo:${dir}`, 10, 900)) return NextResponse.json({ error: 'Demasiados intentos. Esperá unos minutos.' }, { status: 429 });
  const j = await req.json().catch(() => ({}));
  const mail = String(j.mail ?? '').trim().toLowerCase().slice(0, 200);
  const clave = String(j.clave ?? '').slice(0, 100);
  const { data } = mail ? await db().from('tb_empresas').select('id, clave_hash, clave_version, oculta').eq('mail', mail).maybeSingle() : { data: null };
  if (!data || !(await claveCorrecta(clave, data.clave_hash))) {
    permitir(`te-fallo:${dir}`, 10, 900);
    return NextResponse.json({ error: 'El mail o la clave no son correctos.' }, { status: 401 });
  }
  if (data.oculta) return NextResponse.json({ error: 'Esta cuenta está suspendida. Comunicate con AEHGA.' }, { status: 403 });
  await escribir(COOKIE_EMPRESA, `${data.id}:${data.clave_version}`);
  return NextResponse.json({ ok: true });
}
