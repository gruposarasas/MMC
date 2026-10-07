import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Healthcheck para Easypanel: responde 200 si la base contesta.
export async function GET() {
  try {
    await db()`select 1`;
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
