import { NextResponse } from 'next/server';
import { borrar, COOKIE_BARISTA } from '@/lib/sesion';

export async function POST() {
  await borrar(COOKIE_BARISTA);
  return NextResponse.json({ ok: true });
}
