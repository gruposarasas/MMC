import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
import { escribir, COOKIE_POSTULANTE } from '@/lib/sesion';
import { permitir, ip } from '@/lib/limite';
import { validarPostulante, validarClave } from '@/lib/trabajo';
import { hashClave, subirCv, borrarCv } from '@/lib/trabajo-servidor';
import { datosDelForm } from '../../formulario';

/** Alta del postulante: datos, clave y CV (multipart). Queda con la sesión iniciada. */
export async function POST(req: Request) {
  if (!permitir(`tb-alta:${await ip()}`, 10, 3600)) return NextResponse.json({ error: 'Demasiados registros desde esta conexión. Probá más tarde.' }, { status: 429 });
  const f = await req.formData().catch(() => null);
  if (!f) return NextResponse.json({ error: 'Datos inválidos.' }, { status: 400 });
  const j = datosDelForm(f);
  const { datos, error } = validarPostulante(j);
  if (error || !datos) return NextResponse.json({ error }, { status: 400 });
  const errClave = validarClave(j.clave);
  if (errClave) return NextResponse.json({ error: errClave }, { status: 400 });
  if (j.acepto !== 'true') return NextResponse.json({ error: 'Para publicar tu CV tenés que aceptar el uso de tus datos.' }, { status: 400 });
  const archivo = f.get('cv');
  if (!(archivo instanceof File) || !archivo.size) return NextResponse.json({ error: 'Subí tu CV en PDF o una foto (JPG o PNG).' }, { status: 400 });

  const { data: ya } = await db().from('tb_postulantes').select('id').eq('mail', datos.mail).maybeSingle();
  if (ya) return NextResponse.json({ error: 'Ya hay un perfil con ese mail. Entrá con tu clave para actualizarlo.' }, { status: 409 });

  const id = crypto.randomUUID();
  let cv: { path: string; tipo: string };
  try {
    cv = await subirCv(id, archivo);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
  const { error: e } = await db().from('tb_postulantes').insert({ id, ...datos, cv_path: cv.path, cv_tipo: cv.tipo, clave_hash: await hashClave(String(j.clave)) });
  if (e) {
    await borrarCv(cv.path);
    if (e.code === '23505') return NextResponse.json({ error: 'Ya hay un perfil con ese mail. Entrá con tu clave para actualizarlo.' }, { status: 409 });
    console.error('[trabajo] alta postulante', e.message);
    return NextResponse.json({ error: 'No se pudo guardar. Probá de nuevo.' }, { status: 500 });
  }
  await escribir(COOKIE_POSTULANTE, `${id}:1`);
  return NextResponse.json({ ok: true });
}
