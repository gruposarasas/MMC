import { NextResponse } from 'next/server';
import { escribir, igualSeguro, COOKIE_VP_ADMIN } from '@/lib/sesion';
import { permitir, superado, ip } from '@/lib/limite';
import { claveBackoffice } from '@/lib/vistapueblo-servidor';

export async function POST(req: Request) {
  const dir = await ip();
  if (superado(`vpa-fallo:${dir}`, 5, 900)) return NextResponse.json({ error: 'Demasiados intentos. Esperá unos minutos.' }, { status: 429 });
  const pass = String((await req.json().catch(() => ({}))).password ?? '');
  const real = claveBackoffice();
  if (!real || !pass || !igualSeguro(pass, real)) {
    permitir(`vpa-fallo:${dir}`, 5, 900);
    return NextResponse.json({ error: 'Contraseña incorrecta.' }, { status: 401 });
  }
  await escribir(COOKIE_VP_ADMIN, 'ok');
  return NextResponse.json({ ok: true });
}
