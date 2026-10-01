import { NextResponse } from 'next/server';
import { juradoActual, vistaJurado, guardarEvaluacion } from '@/lib/jurados';
import { itemsDe, valorItem, type Valores } from '@/lib/planilla';
import { permitir } from '@/lib/limite';

export const dynamic = 'force-dynamic';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET() {
  const n = await juradoActual();
  if (!n) return NextResponse.json({ error: 'Tu sesión venció. Volvé a entrar.' }, { status: 401 });
  return NextResponse.json(await vistaJurado(n), { headers: { 'cache-control': 'no-store' } });
}

/** El jurado guarda su planilla de un barista en la ronda en curso. */
export async function POST(req: Request) {
  const n = await juradoActual();
  if (!n) return NextResponse.json({ error: 'Tu sesión venció. Volvé a entrar.' }, { status: 401 });
  if (!permitir(`jurado:${n}`, 60, 60)) return NextResponse.json({ error: 'Esperá un momento.' }, { status: 429 });
  const j = await req.json().catch(() => ({}));
  const ronda = Number(j.ronda);
  if (!UUID.test(String(j.barista)) || ![1, 2, 3, 4].includes(ronda)) return NextResponse.json({ error: 'Datos inválidos.' }, { status: 400 });
  const valores: Valores = {};
  for (const it of itemsDe(ronda)) {
    const v = valorItem(j.valores?.[it.k]);
    if (Number.isNaN(v)) return NextResponse.json({ error: `${it.t}: el puntaje va de 1 a 9, con un decimal (por ejemplo 8,5).` }, { status: 400 });
    if (v != null) valores[it.k] = v;
  }
  const comentario = String(j.comentario ?? '').trim().slice(0, 500);
  const err = await guardarEvaluacion(n, j.barista, ronda, valores, comentario);
  if (err) return NextResponse.json({ error: err }, { status: 409 });
  return NextResponse.json(await vistaJurado(n));
}
