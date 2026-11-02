import QRCode from 'qrcode';
import { db } from '@/lib/db';
import { horaDe } from '@/lib/horas';
import { pantallaActual } from '@/lib/pantalla';
import { payloadQR } from '@/lib/qr';

export const dynamic = 'force-dynamic';

// Cuánto tiempo queda a la vista cada fichaje al lado del QR.
const SEGUNDOS_A_LA_VISTA = 20;

/** Código vigente para la pantalla del lugar. Solo responde a una pantalla activada (cookie). */
export async function GET() {
  const p = await pantallaActual();
  const sinCache = { 'Cache-Control': 'no-store' };
  if (!p) return Response.json({ error: 'Pantalla no activada.' }, { status: 403, headers: sinCache });
  const ahora = Date.now();
  const q = payloadQR(p.lugar_id, ahora);
  const svg = await QRCode.toString(q.payload, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#281722', light: '#FFFFFF' } });
  const sql = db();
  const desde = new Date(ahora - SEGUNDOS_A_LA_VISTA * 1000);
  const recientes = await sql<{ id: number; nombre: string; apellido: string; entrada: Date; salida: Date | null }[]>`
    select f.id, e.nombre, e.apellido, f.entrada, f.salida from fichajes f join empleados e on e.id = f.empleado_id
    where f.lugar_id = ${p.lugar_id} and not f.manual and (f.entrada >= ${desde} or (f.salida >= ${desde} and f.salida_por = 'qr'))
    order by greatest(f.entrada, coalesce(f.salida, f.entrada)) desc limit 4`;
  if (!p.visto || ahora - new Date(p.visto).getTime() > 60_000) await sql`update pantallas set visto = now() where id = ${p.id}`;
  const fichajes = recientes.map((f) => {
    const esSalida = f.salida != null && new Date(f.salida).getTime() >= desde.getTime();
    return { id: `${f.id}${esSalida ? 's' : 'e'}`, tipo: esSalida ? 'salida' : 'entrada', hora: horaDe(new Date(esSalida ? f.salida! : f.entrada).getTime()), nombre: `${f.nombre} ${f.apellido}`.trim() };
  });
  return Response.json({ svg, ventana: q.ventana, restanteMs: q.restanteMs, ahora, fichajes }, { headers: sinCache });
}
