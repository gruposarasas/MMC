import { contadorSesion } from '@/lib/contabilidad';
import { db } from '@/lib/db';
import { empleadoSesion, esAdmin } from '@/lib/sesion';

// Muestra un archivo: administración ve todos; cada persona del equipo, sus certificados; el contador, los de contabilidad.
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response('No encontrado', { status: 404 });
  const admin = await esAdmin();
  const empleado = admin ? null : await empleadoSesion();
  const contador = admin || empleado ? null : await contadorSesion();
  if (!admin && !empleado && !contador) return new Response('No autorizado', { status: 401 });
  const [a] = await db()`
    select a.nombre, a.tipo, a.datos from archivos a
    where a.id = ${id} and (
      ${admin}
      or exists (select 1 from certificados c where c.archivo_id = a.id and c.empleado_id = ${empleado ?? 0})
      or (${!!contador} and exists (select 1 from contab_archivos c where c.archivo_id = a.id)))`;
  if (!a) return new Response('No encontrado', { status: 404 });
  const tipo = a.tipo as string;
  // Fotos y PDF se ven en el navegador; Excel, CSV, TXT y ZIP se descargan.
  const seVe = tipo === 'application/pdf' || tipo.startsWith('image/');
  return new Response(new Uint8Array(a.datos as Buffer), {
    headers: {
      'Content-Type': tipo,
      'Content-Disposition': `${seVe ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(a.nombre as string)}`,
      'Cache-Control': 'private, no-store',
      // El visor de PDF de Chrome no anda con sandbox; lo demás sí lo lleva.
      ...(tipo === 'application/pdf' ? {} : { 'Content-Security-Policy': "sandbox; default-src 'none'; img-src 'self'; style-src 'unsafe-inline'" }),
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
