import { NextResponse } from 'next/server';
import { estadoTorneo } from '@/lib/torneo';
import { permitir, ip } from '@/lib/limite';

export const dynamic = 'force-dynamic';

/** Estado público del torneo, para la pantalla /competencia (solo lectura). */
export async function GET() {
  if (!permitir(`torneo:${await ip()}`, 120, 60)) return NextResponse.json({ error: 'Esperá un momento.' }, { status: 429 });
  return NextResponse.json(await estadoTorneo(), { headers: { 'cache-control': 'no-store' } });
}
