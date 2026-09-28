import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
import { leer, COOKIE_VISITANTE } from '@/lib/sesion';
import { permitir, ip } from '@/lib/limite';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  const vid = await leer(COOKIE_VISITANTE);
  if (!vid) return NextResponse.json({ error: 'Tu sesión venció. Volvé a entrar.' }, { status: 401 });
  if (!permitir(`canje:${vid}`, 20, 60) || !permitir(`canje-ip:${await ip()}`, 300, 60))
    return NextResponse.json({ error: 'Esperá un momento y probá de nuevo.' }, { status: 429 });

  let marca = '', codigo = '';
  try {
    const j = await req.json();
    marca = String(j.marca ?? '');
    codigo = String(j.codigo ?? '');
  } catch {}
  if (!UUID.test(marca) || !/^[0-9]{4}$/.test(codigo)) return NextResponse.json({ error: 'Datos inválidos.' }, { status: 400 });

  const { data, error } = await db().rpc('canjear', { p_visitante: vid, p_marca: marca, p_codigo: codigo });
  if (error) {
    console.error('[canjear]', error);
    return NextResponse.json({ error: 'No pudimos validar el código. Probá de nuevo.' }, { status: 500 });
  }
  if (data?.estado === 'sin_visitante') return NextResponse.json({ error: 'Tu sesión venció. Volvé a entrar.' }, { status: 401 });
  return NextResponse.json(data);
}
