import { db } from '@/lib/db';
import { empleadoSesion, esAdmin } from '@/lib/sesion';

// Muestra un certificado: a administración o a la persona que lo subió.
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response('No encontrado', { status: 404 });
  const admin = await esAdmin();
  const empleado = admin ? null : await empleadoSesion();
  if (!admin && !empleado) return new Response('No autorizado', { status: 401 });
  const [a] = await db()`
    select a.nombre, a.tipo, a.datos from archivos a
    where a.id = ${id} and (${admin} or exists (select 1 from certificados c where c.archivo_id = a.id and c.empleado_id = ${empleado ?? 0}))`;
  if (!a) return new Response('No encontrado', { status: 404 });
  return new Response(new Uint8Array(a.datos as Buffer), {
    headers: {
      'Content-Type': a.tipo as string,
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(a.nombre as string)}`,
      'Cache-Control': 'private, no-store',
      // El visor de PDF de Chrome no anda con sandbox; las fotos sí lo llevan.
      ...(a.tipo === 'application/pdf' ? {} : { 'Content-Security-Policy': "sandbox; default-src 'none'; img-src 'self'; style-src 'unsafe-inline'" }),
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
