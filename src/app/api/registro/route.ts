import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
import { escribir, COOKIE_VISITANTE } from '@/lib/sesion';
import { permitir, ip } from '@/lib/limite';
import { validarRegistro, limpiarNombre, limpiarContacto, type DatosRegistro } from '@/lib/validar';

export async function POST(req: Request) {
  const dir = await ip();
  if (!permitir(`reg:${dir}`, 30, 60) || !permitir('reg:*', 600, 60))
    return NextResponse.json({ error: 'Hay muchos registros al mismo tiempo. Esperá un minuto y probá de nuevo.' }, { status: 429 });

  let b: DatosRegistro;
  try {
    const j = await req.json();
    b = {
      nombre: String(j.nombre ?? ''),
      dia: String(j.dia ?? ''),
      mes: String(j.mes ?? ''),
      anio: String(j.anio ?? ''),
      via: j.via === 'wa' ? 'wa' : 'mail',
      contacto: String(j.contacto ?? '').slice(0, 200),
      acepto: j.acepto === true,
      novedades: j.novedades === true,
    };
  } catch {
    return NextResponse.json({ error: 'Datos inválidos.' }, { status: 400 });
  }

  const { errores, nacimiento } = validarRegistro(b);
  if (Object.keys(errores).length || !nacimiento) return NextResponse.json({ errores }, { status: 400 });

  const contacto = limpiarContacto(b.via, b.contacto);
  const { data, error } = await db().rpc('registrar_visitante', {
    p_nombre: limpiarNombre(b.nombre),
    p_nacimiento: nacimiento,
    p_mail: b.via === 'mail' ? contacto : null,
    p_whatsapp: b.via === 'wa' ? contacto : null,
    p_novedades: b.novedades,
  });
  if (error || !data?.id) {
    console.error('[registro]', error);
    return NextResponse.json({ error: 'No pudimos registrarte. Probá de nuevo en un momento.' }, { status: 500 });
  }
  await escribir(COOKIE_VISITANTE, data.id);
  return NextResponse.json({ ya_existia: !!data.ya_existia });
}
