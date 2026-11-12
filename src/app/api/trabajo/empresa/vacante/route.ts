import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
import { permitir } from '@/lib/limite';
import { validarVacante } from '@/lib/trabajo';
import { empresaActual } from '@/lib/trabajo-servidor';

/**
 * La empresa publica o edita una vacante (`id` vacío = nueva), o la cierra, la reabre o la borra (`accion`).
 */
export async function POST(req: Request) {
  const e = await empresaActual();
  if (!e) return NextResponse.json({ error: 'Tu sesión venció. Volvé a entrar.' }, { status: 401 });
  if (!permitir(`te-vac:${e.id}`, 40, 3600)) return NextResponse.json({ error: 'Esperá un momento y probá de nuevo.' }, { status: 429 });
  const j = await req.json().catch(() => null);
  if (!j) return NextResponse.json({ error: 'Datos inválidos.' }, { status: 400 });
  const id = typeof j.id === 'string' && /^[0-9a-f-]{36}$/i.test(j.id) ? j.id : null;

  if (j.accion) {
    if (!id) return NextResponse.json({ error: 'Falta la vacante.' }, { status: 400 });
    const q = db().from('tb_vacantes');
    const r =
      j.accion === 'cerrar' ? await q.update({ abierta: false, updated_at: new Date().toISOString() }).eq('id', id).eq('empresa_id', e.id)
      : j.accion === 'abrir' ? await q.update({ abierta: true, updated_at: new Date().toISOString() }).eq('id', id).eq('empresa_id', e.id)
      : j.accion === 'borrar' ? await q.delete().eq('id', id).eq('empresa_id', e.id)
      : null;
    if (!r) return NextResponse.json({ error: 'Acción inválida.' }, { status: 400 });
    if (r.error) return NextResponse.json({ error: 'No se pudo guardar. Probá de nuevo.' }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const { datos, error } = validarVacante(j);
  if (error || !datos) return NextResponse.json({ error }, { status: 400 });
  if (id) {
    const { error: err } = await db().from('tb_vacantes').update({ ...datos, updated_at: new Date().toISOString() }).eq('id', id).eq('empresa_id', e.id);
    if (err) return NextResponse.json({ error: 'No se pudo guardar. Probá de nuevo.' }, { status: 500 });
    return NextResponse.json({ ok: true, id });
  }
  const { data, error: err } = await db().from('tb_vacantes').insert({ ...datos, empresa_id: e.id }).select('id').single();
  if (err) return NextResponse.json({ error: 'No se pudo publicar. Probá de nuevo.' }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}
