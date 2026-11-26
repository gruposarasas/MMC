import { NextResponse } from 'next/server';
import { borrar, COOKIE_VP_CAJA } from '@/lib/sesion';

export async function POST() {
  await borrar(COOKIE_VP_CAJA);
  return NextResponse.json({ ok: true });
}
