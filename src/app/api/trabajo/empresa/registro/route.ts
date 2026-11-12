import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
import { escribir, COOKIE_EMPRESA } from '@/lib/sesion';
import { permitir, ip } from '@/lib/limite';
import { validarEmpresa, validarClave } from '@/lib/trabajo';
import { hashClave } from '@/lib/trabajo-servidor';

/** Alta de un hotel, restaurante u otro establecimiento. Queda con la sesión iniciada. */
export async function POST(req: Request) {
  if (!permitir(`te-alta:${await ip()}`, 5, 3600)) return NextResponse.json({ error: 'Demasiados registros desde esta conexión. Probá más tarde.' }, { status: 429 });
  const j = await req.json().catch(() => null);
  if (!j) return NextResponse.json({ error: 'Datos inválidos.' }, { status: 400 });
  const { datos, error } = validarEmpresa(j);
  if (error || !datos) return NextResponse.json({ error }, { status: 400 });
  const errClave = validarClave(j.clave);
  if (errClave) return NextResponse.json({ error: errClave }, { status: 400 });
  if (j.acepto !== true) return NextResponse.json({ error: 'Tenés que aceptar cuidar los datos de los postulantes.' }, { status: 400 });
  const { data, error: e } = await db().from('tb_empresas').insert({ ...datos, clave_hash: await hashClave(String(j.clave)) }).select('id').single();
  if (e) {
    if (e.code === '23505') return NextResponse.json({ error: 'Ya hay una empresa registrada con ese mail. Entrá con tu clave.' }, { status: 409 });
    console.error('[trabajo] alta empresa', e.message);
    return NextResponse.json({ error: 'No se pudo guardar. Probá de nuevo.' }, { status: 500 });
  }
  await escribir(COOKIE_EMPRESA, `${data.id}:1`);
  return NextResponse.json({ ok: true });
}
