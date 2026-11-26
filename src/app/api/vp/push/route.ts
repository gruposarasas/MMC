import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
import { permitir, ip } from '@/lib/limite';
import { tarjetaPorToken } from '@/lib/vistapueblo-servidor';

// Solo servicios de notificaciones de los navegadores: el servidor les manda un POST en cada consumo.
const SERVICIOS = ['fcm.googleapis.com', 'android.googleapis.com', 'push.services.mozilla.com', 'push.apple.com', 'notify.windows.com'];
const servicioValido = (u: string) => {
  try {
    const h = new URL(u).hostname;
    return SERVICIOS.some((s) => h === s || h.endsWith(`.${s}`));
  } catch {
    return false;
  }
};

/** El cliente activa los avisos de su tarjeta en este celular. */
export async function POST(req: Request) {
  if (!permitir(`vp-push:${await ip()}`, 20, 600)) return NextResponse.json({ error: 'Más despacio.' }, { status: 429 });
  const j = await req.json().catch(() => ({}));
  const t = await tarjetaPorToken(String(j.token ?? ''));
  if (!t) return NextResponse.json({ error: 'No existe.' }, { status: 404 });
  const sub = j.sub as { endpoint?: string; keys?: { p256dh?: string; auth?: string } } | undefined;
  const endpoint = String(sub?.endpoint ?? '');
  const p256dh = String(sub?.keys?.p256dh ?? '');
  const auth = String(sub?.keys?.auth ?? '');
  if (!/^https:\/\/[^\s]{10,990}$/.test(endpoint) || !servicioValido(endpoint) || !/^[A-Za-z0-9_-]{20,200}$/.test(p256dh) || !/^[A-Za-z0-9_-]{8,100}$/.test(auth))
    return NextResponse.json({ error: 'Datos inválidos.' }, { status: 400 });
  const { error } = await db().from('vp_suscripciones').upsert({ tarjeta_id: t.id, endpoint, p256dh, auth }, { onConflict: 'endpoint' });
  if (error) return NextResponse.json({ error: 'No se pudo guardar.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
