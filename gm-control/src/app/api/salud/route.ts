import { db } from '@/lib/db';
import { explicarError } from '../../../../scripts/conexion.mjs';

export const dynamic = 'force-dynamic';

// Healthcheck: responde 200 si la base contesta; si no, dice por qué (sin datos secretos).
export async function GET() {
  try {
    await db()`select count(*) from _migraciones`;
    return Response.json({ ok: true, app: 'ok', base: 'ok' });
  } catch (e) {
    return Response.json({ ok: false, app: 'ok', base: explicarError(e) }, { status: 503 });
  }
}
