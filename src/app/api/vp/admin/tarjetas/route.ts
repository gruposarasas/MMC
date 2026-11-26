import { NextResponse } from 'next/server';
import { esAdminVP, crearTarjetas, locales, linkTarjeta } from '@/lib/vistapueblo-servidor';
import { validarFila, hoyMendoza, type NuevaTarjeta } from '@/lib/vistapueblo';

/** Crea gift cards: una sola o un lote importado del Excel, con el mismo vencimiento, locales y mensaje. */
export async function POST(req: Request) {
  if (!(await esAdminVP())) return NextResponse.json({ error: 'Tu sesión venció. Volvé a entrar.' }, { status: 401 });
  const j = await req.json().catch(() => null);
  if (!j || !Array.isArray(j.filas) || !j.filas.length) return NextResponse.json({ error: 'No hay a quién mandarle gift cards.' }, { status: 400 });
  if (j.filas.length > 2000) return NextResponse.json({ error: 'Hasta 2.000 por vez.' }, { status: 400 });

  const vence = String(j.vence ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(vence) || vence < hoyMendoza()) return NextResponse.json({ error: 'Elegí una fecha de vencimiento de hoy en adelante.' }, { status: 400 });
  const todos = j.todos !== false;
  const ids = new Set((await locales()).filter((l) => l.activo).map((l) => l.id));
  const elegidos = Array.isArray(j.locales) ? [...new Set(j.locales.map(String))].filter((x) => ids.has(x as string)) as string[] : [];
  if (!todos && !elegidos.length) return NextResponse.json({ error: 'Elegí al menos un restaurante.' }, { status: 400 });

  const filas: NuevaTarjeta[] = [];
  for (const [i, f] of (j.filas as Record<string, unknown>[]).entries()) {
    const r = validarFila(f, Number(j.monto) || undefined);
    if (r.error) return NextResponse.json({ error: j.filas.length > 1 ? `Fila ${i + 1}: ${r.error}` : r.error }, { status: 400 });
    filas.push(r.fila!);
  }
  try {
    const ts = await crearTarjetas(filas, {
      vence, todos, locales: elegidos,
      mensaje: String(j.mensaje ?? '').trim().slice(0, 300),
      lote: String(j.lote ?? '').trim().slice(0, 80),
    });
    return NextResponse.json({ ok: true, tarjetas: ts.map((t) => ({ id: t.id, numero: t.numero, nombre: t.nombre, mail: t.mail, whatsapp: t.whatsapp, monto: t.monto, vence: t.vence, codigo: t.codigo, link: linkTarjeta(t.token) })) });
  } catch (e) {
    console.error('[vistapueblo] alta', (e as Error).message);
    return NextResponse.json({ error: 'No se pudieron crear. Probá de nuevo.' }, { status: 500 });
  }
}
