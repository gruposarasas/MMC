import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { db } from '@/lib/supabase';
import { soloAdmin, validarMarca, nuevaClave, errorUnico } from '@/lib/admin';
import { subirLogo } from '@/lib/logos';

/** Crear marca. Genera la clave; el código viene del formulario. */
export async function POST(req: Request) {
  const no = await soloAdmin();
  if (no) return no;
  const j = await req.json().catch(() => ({}));
  const v = validarMarca(j);
  if ('error' in v) return NextResponse.json({ error: v.error }, { status: 400 });

  const id = randomUUID();
  let logo_path: string | null = null;
  try {
    if (typeof j.logo === 'string' && j.logo.startsWith('data:')) logo_path = await subirLogo(id, j.logo);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
  const { data: ult } = await db().from('marcas').select('orden').order('orden', { ascending: false }).limit(1).maybeSingle();
  const clave = await nuevaClave(v.ok.nombre);
  const { error } = await db().from('marcas').insert({ id, ...v.ok, clave, logo_path, orden: (ult?.orden || 0) + 1 });
  if (error) return NextResponse.json({ error: errorUnico(error) || 'No se pudo crear la marca.' }, { status: error.code === '23505' ? 409 : 500 });
  return NextResponse.json({ ok: true, clave });
}
