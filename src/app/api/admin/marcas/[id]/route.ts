import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
import { soloAdmin, validarMarca, nuevaClave, nuevoCodigo, errorUnico } from '@/lib/admin';
import { subirLogo } from '@/lib/logos';

type Ctx = { params: Promise<{ id: string }> };

async function buscar(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await db().from('marcas').select('id, nombre, clave_version, eliminada').eq('id', id).maybeSingle();
  return data;
}

/** Editar todo. */
export async function PATCH(req: Request, { params }: Ctx) {
  const no = await soloAdmin();
  if (no) return no;
  const m = await buscar((await params).id);
  if (!m || m.eliminada) return NextResponse.json({ error: 'No existe esa marca.' }, { status: 404 });
  const j = await req.json().catch(() => ({}));
  const v = validarMarca(j);
  if ('error' in v) return NextResponse.json({ error: v.error }, { status: 400 });

  const cambios: Record<string, unknown> = { ...v.ok };
  try {
    if (j.logo === 'quitar') cambios.logo_path = null;
    else if (typeof j.logo === 'string' && j.logo.startsWith('data:')) cambios.logo_path = await subirLogo(m.id, j.logo);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
  const { error } = await db().from('marcas').update(cambios).eq('id', m.id);
  if (error) return NextResponse.json({ error: errorUnico(error) || 'No se pudieron guardar los cambios.' }, { status: error.code === '23505' ? 409 : 500 });
  return NextResponse.json({ ok: true });
}

/** Acciones puntuales: cambiar código, nueva clave, reabrir, eliminar. */
export async function POST(req: Request, { params }: Ctx) {
  const no = await soloAdmin();
  if (no) return no;
  const m = await buscar((await params).id);
  if (!m || m.eliminada) return NextResponse.json({ error: 'No existe esa marca.' }, { status: 404 });
  const { accion } = await req.json().catch(() => ({}));
  const upd = (c: Record<string, unknown>) => db().from('marcas').update(c).eq('id', m.id);

  switch (accion) {
    case 'codigo': {
      for (let i = 0; i < 5; i++) {
        const codigo = await nuevoCodigo();
        const { error } = await upd({ codigo });
        if (!error) return NextResponse.json({ ok: true, codigo });
        if (error.code !== '23505') break;
      }
      return NextResponse.json({ error: 'No se pudo cambiar el código.' }, { status: 500 });
    }
    case 'clave': {
      const clave = await nuevaClave(m.nombre);
      const { error } = await upd({ clave, clave_version: m.clave_version + 1 });
      if (error) return NextResponse.json({ error: 'No se pudo generar la clave.' }, { status: 500 });
      return NextResponse.json({ ok: true, clave });
    }
    case 'reabrir': {
      const { error } = await upd({ enviado_at: null });
      if (error) return NextResponse.json({ error: 'No se pudo reabrir.' }, { status: 500 });
      return NextResponse.json({ ok: true });
    }
    case 'eliminar': {
      const { error } = await upd({ eliminada: true, activa: false });
      if (error) return NextResponse.json({ error: 'No se pudo eliminar.' }, { status: 500 });
      return NextResponse.json({ ok: true });
    }
  }
  return NextResponse.json({ error: 'Acción desconocida.' }, { status: 400 });
}
