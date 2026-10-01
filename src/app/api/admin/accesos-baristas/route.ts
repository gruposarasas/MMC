import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
import { soloAdmin, nuevaClave } from '@/lib/admin';
import { accesosBaristas } from '@/lib/votos';

export const dynamic = 'force-dynamic';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Accesos de los baristas a su perfil: generar claves y cargar su WhatsApp. */
export async function POST(req: Request) {
  const no = await soloAdmin();
  if (no) return no;
  const j = await req.json().catch(() => ({}));
  const mal = (error: string, status = 400) => NextResponse.json({ error }, { status });

  if (j.accion === 'claves') {
    // Genera la clave de los que todavía no tienen.
    const { data } = await db().from('baristas').select('id, nombre').is('clave', null);
    for (const b of data || []) await db().from('baristas').update({ clave: await nuevaClave(b.nombre, 'baristas') }).eq('id', b.id).is('clave', null);
  } else if (j.accion === 'clave') {
    // Clave nueva: cierra la sesión abierta con la anterior.
    if (!UUID.test(String(j.id))) return mal('Datos inválidos.');
    const { data: b } = await db().from('baristas').select('nombre, clave_version').eq('id', j.id).maybeSingle();
    if (!b) return mal('Ese barista no existe.', 404);
    await db().from('baristas').update({ clave: await nuevaClave(b.nombre, 'baristas'), clave_version: (b.clave_version as number) + 1 }).eq('id', j.id);
  } else if (j.accion === 'tel') {
    if (!UUID.test(String(j.id))) return mal('Datos inválidos.');
    const tel = String(j.tel ?? '').replace(/\D/g, '').slice(0, 13);
    if (tel && tel.length < 10) return mal('El WhatsApp tiene que tener al menos 10 números, con código de área.');
    await db().from('baristas').update({ tel }).eq('id', j.id);
  } else if (j.accion !== 'listar') return mal('Acción desconocida.');

  return NextResponse.json({ accesos: await accesosBaristas() });
}
