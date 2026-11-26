import { NextResponse } from 'next/server';
import { borrar, COOKIE_VP_LOCAL } from '@/lib/sesion';

export async function POST() {
  await borrar(COOKIE_VP_LOCAL);
  return NextResponse.json({ ok: true });
}
