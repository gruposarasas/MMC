import { NextResponse } from 'next/server';
import { estadoTorneo } from '@/lib/torneo';
import { permitir, ip } from '@/lib/limite';

export const dynamic = 'force-dynamic';

/** Estado público del torneo, para la pantalla /baristas (solo lectura). */
export async function GET() {
  if (!permitir(`torneo:${await ip()}`, 120, 60)) return NextResponse.json({ error: 'Esperá un momento.' }, { status: 429 });
  const e = await estadoTorneo();
  return NextResponse.json(
    {
      fase: e.fase,
      pantalla: e.pantalla,
      baristas: e.baristas.map(({ id, nombre, cafeteria, puntaje, puntuado_at, desempate, created_at }) => ({ id, nombre, cafeteria, puntaje, puntuado_at, desempate, created_at })),
      partidos: e.partidos,
    },
    { headers: { 'cache-control': 'no-store' } },
  );
}
