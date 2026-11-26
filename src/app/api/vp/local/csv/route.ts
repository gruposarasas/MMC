import { NextResponse } from 'next/server';
import { localActual, respuestaCsv, filasMetricas } from '@/lib/vistapueblo-servidor';
import { FECHA_RE } from '@/lib/vistapueblo';

/** Excel del panel del local: solo sus consumos. */
export async function GET(req: Request) {
  const l = await localActual();
  if (!l) return new NextResponse('Sesión vencida', { status: 401 });
  const u = new URL(req.url);
  const desde = u.searchParams.get('desde') || '', hasta = u.searchParams.get('hasta') || '';
  if (!FECHA_RE.test(desde) || !FECHA_RE.test(hasta)) return new NextResponse('Fechas inválidas', { status: 400 });
  const r = await filasMetricas(desde, hasta, l.id);
  return respuestaCsv(r.nombre, r.filas);
}
