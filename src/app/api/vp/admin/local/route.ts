import { randomInt } from 'node:crypto';
import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
import { esAdminVP, nuevaClaveLocal } from '@/lib/vistapueblo-servidor';

/** Cambia el % que absorbe un local, lo activa o desactiva, le da un PIN nuevo (cierra sus cajas abiertas) o una clave nueva para su panel. */
export async function POST(req: Request) {
  if (!(await esAdminVP())) return NextResponse.json({ error: 'Tu sesión venció. Volvé a entrar.' }, { status: 401 });
  const j = await req.json().catch(() => ({}));
  if (!/^[0-9a-f-]{36}$/i.test(String(j.id))) return NextResponse.json({ error: 'Falta el local.' }, { status: 400 });
  const cambios: Record<string, unknown> = {};
  if (j.porcentaje !== undefined) {
    const p = Number(String(j.porcentaje).replace(',', '.'));
    if (!Number.isFinite(p) || p < 0 || p > 100) return NextResponse.json({ error: 'El porcentaje va de 0 a 100.' }, { status: 400 });
    cambios.porcentaje = Math.round(p * 100) / 100;
  }
  if (typeof j.activo === 'boolean') cambios.activo = j.activo;
  if (j.nuevoPin) {
    const { data } = await db().from('vp_locales').select('pin, pin_version').eq('id', j.id).single();
    const { data: usados } = await db().from('vp_locales').select('pin');
    const ocupados = new Set((usados || []).map((u) => u.pin));
    let pin = '';
    do pin = String(randomInt(1000, 10000)); while (ocupados.has(pin));
    cambios.pin = pin;
    cambios.pin_version = (data?.pin_version ?? 1) + 1;
  }
  if (j.nuevaClave) {
    const { data } = await db().from('vp_locales').select('clave_version').eq('id', j.id).single();
    cambios.clave = nuevaClaveLocal();
    cambios.clave_version = (data?.clave_version ?? 1) + 1;   // cierra los paneles abiertos con la clave anterior
  }
  if (!Object.keys(cambios).length) return NextResponse.json({ error: 'Nada para cambiar.' }, { status: 400 });
  let { error } = await db().from('vp_locales').update(cambios).eq('id', j.id);
  if (error?.code === '23505' && cambios.clave) ({ error } = await db().from('vp_locales').update({ ...cambios, clave: nuevaClaveLocal() }).eq('id', j.id));
  if (error) return NextResponse.json({ error: 'No se pudo guardar.' }, { status: 500 });
  return NextResponse.json({ ok: true, pin: cambios.pin });
}
