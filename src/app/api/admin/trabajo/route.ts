import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
import { esAdmin } from '@/lib/datos';

/** Administración oculta o vuelve a mostrar un postulante, una empresa o una vacante. */
export async function POST(req: Request) {
  if (!(await esAdmin())) return NextResponse.json({ error: 'Tu sesión venció.' }, { status: 401 });
  const j = await req.json().catch(() => ({}));
  const tabla = { postulante: ['tb_postulantes', 'oculto'], empresa: ['tb_empresas', 'oculta'], vacante: ['tb_vacantes', 'oculta'] }[String(j.tipo)] as [string, string] | undefined;
  if (!tabla || typeof j.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(j.id)) return NextResponse.json({ error: 'Datos inválidos.' }, { status: 400 });
  const { error } = await db().from(tabla[0]).update({ [tabla[1]]: j.ocultar === true }).eq('id', j.id);
  if (error) return NextResponse.json({ error: 'No se pudo guardar.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
