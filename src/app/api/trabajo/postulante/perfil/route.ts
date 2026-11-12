import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
import { permitir } from '@/lib/limite';
import { escribir, COOKIE_POSTULANTE } from '@/lib/sesion';
import { validarPostulante, validarClave } from '@/lib/trabajo';
import { postulanteActual, subirCv, borrarCv, hashClave } from '@/lib/trabajo-servidor';
import { datosDelForm } from '../../formulario';

/** El postulante actualiza sus datos, su CV (opcional), si su perfil está visible y, si quiere, su clave. */
export async function POST(req: Request) {
  const p = await postulanteActual();
  if (!p) return NextResponse.json({ error: 'Tu sesión venció. Volvé a entrar.' }, { status: 401 });
  if (!permitir(`tp-perfil:${p.id}`, 30, 600)) return NextResponse.json({ error: 'Esperá un momento y probá de nuevo.' }, { status: 429 });
  const f = await req.formData().catch(() => null);
  if (!f) return NextResponse.json({ error: 'Datos inválidos.' }, { status: 400 });
  const j = datosDelForm(f);
  const { datos, error } = validarPostulante(j);
  if (error || !datos) return NextResponse.json({ error }, { status: 400 });
  const cambios: Record<string, unknown> = { ...datos, visible: j.visible !== 'false', updated_at: new Date().toISOString() };

  if (j.clave) {
    const e = validarClave(j.clave);
    if (e) return NextResponse.json({ error: e }, { status: 400 });
    cambios.clave_hash = await hashClave(String(j.clave));
  }
  const archivo = f.get('cv');
  let nuevo: { path: string; tipo: string } | null = null;
  if (archivo instanceof File && archivo.size) {
    try {
      nuevo = await subirCv(p.id, archivo);
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 400 });
    }
    cambios.cv_path = nuevo.path;
    cambios.cv_tipo = nuevo.tipo;
  }
  const { data, error: e } = await db().from('tb_postulantes').update(cambios).eq('id', p.id).select('clave_version').single();
  if (e) {
    if (nuevo) await borrarCv(nuevo.path);
    if (e.code === '23505') return NextResponse.json({ error: 'Ese mail ya lo usa otro perfil.' }, { status: 409 });
    console.error('[trabajo] perfil', e.message);
    return NextResponse.json({ error: 'No se pudo guardar. Probá de nuevo.' }, { status: 500 });
  }
  if (nuevo) await borrarCv(p.cv_path);
  if (cambios.clave_hash) {
    // Clave nueva: cierra las otras sesiones y deja abierta esta.
    const v = data.clave_version + 1;
    await db().from('tb_postulantes').update({ clave_version: v }).eq('id', p.id);
    await escribir(COOKIE_POSTULANTE, `${p.id}:${v}`);
  }
  return NextResponse.json({ ok: true });
}
