import { NextResponse } from 'next/server';
import { borrar, COOKIE_VISITANTE } from '@/lib/sesion';

export async function POST() {
  await borrar(COOKIE_VISITANTE);
  return NextResponse.json({ ok: true });
}
