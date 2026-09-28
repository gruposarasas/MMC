import { NextResponse } from 'next/server';
import { escribir, igualSeguro, COOKIE_ADMIN } from '@/lib/sesion';
import { permitir, superado, ip } from '@/lib/limite';
import { envRuntime } from '@/lib/config';

export async function POST(req: Request) {
  const dir = await ip();
  if (superado(`afallo:${dir}`, 5, 900) || superado('afallo:*', 30, 900))
    return NextResponse.json({ error: 'Demasiados intentos. Esperá unos minutos.' }, { status: 429 });
  let pass = '';
  try {
    pass = String((await req.json()).password ?? '');
  } catch {}
  const real = envRuntime('ADMIN_PASSWORD') || '';
  if (!real || !pass || !igualSeguro(pass, real)) {
    permitir(`afallo:${dir}`, 5, 900);
    permitir('afallo:*', 30, 900);
    return NextResponse.json({ error: 'Contraseña incorrecta.' }, { status: 401 });
  }
  await escribir(COOKIE_ADMIN, 'ok');
  return NextResponse.json({ ok: true });
}
