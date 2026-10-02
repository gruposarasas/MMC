import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
import { marcaActual } from '@/lib/datos';
import { EVENTO_FIN } from '@/lib/config';
import { subirLogo } from '@/lib/logos';
import { permitir } from '@/lib/limite';

export async function POST(req: Request) {
  const m = await marcaActual();
  if (!m) return NextResponse.json({ error: 'Tu sesión venció. Volvé a entrar.' }, { status: 401 });
  if (m.enviado_at) return NextResponse.json({ error: 'El cupón ya fue enviado. Pedile cambios a la organización.' }, { status: 409 });
  if (!permitir(`menviar:${m.id}`, 10, 300)) return NextResponse.json({ error: 'Esperá un momento y probá de nuevo.' }, { status: 429 });

  let j: { beneficio?: unknown; condiciones?: unknown; creditos?: unknown; vence?: unknown; sucursales?: unknown; logo?: unknown };
  try {
    j = await req.json();
  } catch {
    return NextResponse.json({ error: 'Datos inválidos.' }, { status: 400 });
  }
  const beneficio = String(j.beneficio ?? '').trim().replace(/\s+/g, ' ');
  if (!beneficio) return NextResponse.json({ error: 'Escribí el beneficio que vas a dar.' }, { status: 400 });
  if (beneficio.length > 34) return NextResponse.json({ error: 'El beneficio tiene que ser corto: hasta 34 caracteres.' }, { status: 400 });
  const condiciones = String(j.condiciones ?? '').trim().slice(0, 240);
  const creditos = j.creditos === undefined ? m.creditos : Number(j.creditos);
  if (!Number.isInteger(creditos) || creditos < 1 || creditos > 10) return NextResponse.json({ error: 'La cantidad de usos va de 1 a 10.' }, { status: 400 });
  const vence = String(j.vence || EVENTO_FIN);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(vence) || isNaN(Date.parse(vence)) || vence < EVENTO_FIN)
    return NextResponse.json({ error: 'El vencimiento no puede ser antes del 4 de octubre.' }, { status: 400 });
  const sucursales = String(j.sucursales ?? '').trim().slice(0, 300);

  let logo_path = m.logo_path;
  const logo = String(j.logo ?? 'mantener');
  try {
    if (logo === 'quitar') logo_path = null;
    else if (logo !== 'mantener') logo_path = await subirLogo(m.id, logo);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }

  const { data, error } = await db()
    .from('marcas')
    // Al enviarlo, el cupón se publica. Administración lo puede ocultar después.
    .update({ beneficio, condiciones, creditos, vence, sucursales, logo_path, activa: true, enviado_at: new Date().toISOString() })
    .eq('id', m.id)
    .is('enviado_at', null)
    .select('id')
    .maybeSingle();
  if (error) return NextResponse.json({ error: 'No se pudo enviar. Probá de nuevo.' }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'El cupón ya fue enviado.' }, { status: 409 });
  return NextResponse.json({ ok: true });
}
