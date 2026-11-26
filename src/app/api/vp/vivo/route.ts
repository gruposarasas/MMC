import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
import { permitir } from '@/lib/limite';
import { tarjetaPorToken, qrVivo, ventanaActual, VENTANA_QR } from '@/lib/vistapueblo-servidor';

/** La tarjeta abierta del cliente pregunta cada pocos segundos: QR nuevo (si cambió la ventana), saldo y último consumo. */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const token = u.searchParams.get('t') || '';
  if (!permitir(`vp-vivo:${token.slice(0, 16)}`, 40, 60)) return NextResponse.json({ error: 'Más despacio.' }, { status: 429 });
  const t = await tarjetaPorToken(token);
  if (!t) return NextResponse.json({ error: 'No existe.' }, { status: 404 });
  const w = ventanaActual();
  const { data } = await db().from('vp_consumos').select('monto, vp_locales(nombre)').eq('tarjeta_id', t.id).eq('anulado', false).order('created_at', { ascending: false });
  const cs = (data || []) as unknown as { monto: number; vp_locales: { nombre: string } | null }[];
  const qr = Number(u.searchParams.get('w')) === w ? { w, restan: (w + 1) * VENTANA_QR * 1000 - Date.now() } : await qrVivo(t);
  return NextResponse.json(
    { ...qr, saldo: t.saldo, n: cs.length, ultimo: cs[0] ? { monto: cs[0].monto, local: cs[0].vp_locales?.nombre ?? '' } : null },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
