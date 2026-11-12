import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
import { permitir } from '@/lib/limite';
import { esAdmin } from '@/lib/datos';
import { empresaActual, postulanteActual, linkCv } from '@/lib/trabajo-servidor';

/**
 * Abre el CV de un postulante con un link temporal. Lo pueden ver: una empresa con sesión (queda registrado),
 * el propio postulante y administración.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse('No encontrado', { status: 404 });
  const [empresa, yo, admin] = await Promise.all([empresaActual(), postulanteActual(), esAdmin()]);
  const propio = yo?.id === id;
  if (!empresa && !propio && !admin) return NextResponse.redirect(new URL('/trabajo/empresa', _req.url));
  if (empresa && !propio && !admin && !permitir(`tb-cv:${empresa.id}`, 120, 3600))
    return new NextResponse('Abriste demasiados CV en poco tiempo. Esperá un rato.', { status: 429 });
  const { data } = await db().from('tb_postulantes').select('cv_path, oculto, visible').eq('id', id).maybeSingle();
  if (!data?.cv_path || (!propio && !admin && data.oculto)) return new NextResponse('Este CV no está disponible.', { status: 404 });
  if (empresa && !propio && !admin) await db().from('tb_vistas_cv').insert({ empresa_id: empresa.id, postulante_id: id });
  const url = await linkCv(data.cv_path);
  if (!url) return new NextResponse('No se pudo abrir el CV. Probá de nuevo.', { status: 500 });
  return NextResponse.redirect(url, { headers: { 'Cache-Control': 'no-store' } });
}
