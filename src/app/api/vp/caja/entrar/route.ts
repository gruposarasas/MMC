import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
import { escribir, igualSeguro, COOKIE_VP_CAJA } from '@/lib/sesion';
import { permitir, superado, ip } from '@/lib/limite';

/** El cajero elige su local y pone el PIN: este dispositivo queda como la caja de ese local. */
export async function POST(req: Request) {
  const dir = await ip();
  const j = await req.json().catch(() => ({}));
  const local = String(j.local ?? '');
  if (superado(`vpc-fallo:${dir}`, 8, 900) || superado(`vpc-fallo-l:${local}`, 15, 900))
    return NextResponse.json({ error: 'Demasiados intentos. Esperá unos minutos.' }, { status: 429 });
  if (!/^[0-9a-f-]{36}$/i.test(local)) return NextResponse.json({ error: 'Elegí tu local.' }, { status: 400 });
  const { data } = await db().from('vp_locales').select('id, pin, pin_version, activo').eq('id', local).maybeSingle();
  const pin = String(j.pin ?? '').replace(/\D/g, '');
  if (!data || !data.activo || !igualSeguro(pin, data.pin)) {
    permitir(`vpc-fallo:${dir}`, 8, 900);
    permitir(`vpc-fallo-l:${local}`, 15, 900);
    return NextResponse.json({ error: 'El PIN no es correcto.' }, { status: 401 });
  }
  await escribir(COOKIE_VP_CAJA, `${data.id}:${data.pin_version}`);
  return NextResponse.json({ ok: true });
}
