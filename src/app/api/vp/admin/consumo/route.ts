import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
import { esAdminVP } from '@/lib/vistapueblo-servidor';

/** Anula un consumo cargado por error: el monto vuelve al saldo de la gift card y sale de la cuenta corriente. */
export async function POST(req: Request) {
  if (!(await esAdminVP())) return NextResponse.json({ error: 'Tu sesión venció. Volvé a entrar.' }, { status: 401 });
  const j = await req.json().catch(() => ({}));
  if (!/^[0-9a-f-]{36}$/i.test(String(j.id))) return NextResponse.json({ error: 'Falta el consumo.' }, { status: 400 });
  const { data, error } = await db().rpc('vp_anular_consumo', { p_consumo: j.id, p_motivo: String(j.motivo ?? '') });
  if (error) return NextResponse.json({ error: 'No se pudo anular.' }, { status: 500 });
  if ((data as { estado: string }).estado !== 'ok') return NextResponse.json({ error: 'Ese consumo ya estaba anulado.' }, { status: 409 });
  return NextResponse.json({ ok: true });
}
