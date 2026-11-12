import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
import { ESTADOS_POSTULACION } from '@/lib/trabajo';
import { empresaActual } from '@/lib/trabajo-servidor';

/** La empresa marca una postulación a su vacante: nueva, vista, contactado o descartado. */
export async function POST(req: Request) {
  const e = await empresaActual();
  if (!e) return NextResponse.json({ error: 'Tu sesión venció. Volvé a entrar.' }, { status: 401 });
  const j = await req.json().catch(() => ({}));
  const ok = (s: unknown) => typeof s === 'string' && /^[0-9a-f-]{36}$/i.test(s);
  if (!ok(j.vacante) || !ok(j.postulante) || !ESTADOS_POSTULACION.some(([k]) => k === j.estado)) return NextResponse.json({ error: 'Datos inválidos.' }, { status: 400 });
  const { data: v } = await db().from('tb_vacantes').select('id').eq('id', j.vacante).eq('empresa_id', e.id).maybeSingle();
  if (!v) return NextResponse.json({ error: 'Esa vacante no es tuya.' }, { status: 403 });
  const { error } = await db().from('tb_postulaciones').update({ estado: j.estado }).eq('vacante_id', j.vacante).eq('postulante_id', j.postulante);
  if (error) return NextResponse.json({ error: 'No se pudo guardar. Probá de nuevo.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
