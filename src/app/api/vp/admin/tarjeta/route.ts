import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
import { esAdminVP } from '@/lib/vistapueblo-servidor';

/** Acciones sobre una gift card: anular, reactivar, marcar enviada por WhatsApp o mail, cambiar el vencimiento. */
export async function POST(req: Request) {
  if (!(await esAdminVP())) return NextResponse.json({ error: 'Tu sesión venció. Volvé a entrar.' }, { status: 401 });
  const j = await req.json().catch(() => ({}));
  const ids = (Array.isArray(j.ids) ? j.ids : [j.id]).map(String).filter((x: string) => /^[0-9a-f-]{36}$/i.test(x));
  if (!ids.length) return NextResponse.json({ error: 'Falta la gift card.' }, { status: 400 });
  const ahora = new Date().toISOString();
  const cambios: Record<string, unknown> | null =
    j.accion === 'anular' ? { anulada: true, anulada_at: ahora }
    : j.accion === 'reactivar' ? { anulada: false, anulada_at: null }
    : j.accion === 'enviada_wa' ? { enviada_wa_at: ahora }
    : j.accion === 'enviada_mail' ? { enviada_mail_at: ahora }
    : j.accion === 'vence' && /^\d{4}-\d{2}-\d{2}$/.test(String(j.vence)) ? { vence: j.vence }
    : null;
  if (!cambios) return NextResponse.json({ error: 'Acción inválida.' }, { status: 400 });
  const { error } = await db().from('vp_tarjetas').update(cambios).in('id', ids);
  if (error) return NextResponse.json({ error: 'No se pudo guardar.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
