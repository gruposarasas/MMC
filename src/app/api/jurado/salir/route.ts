import { NextResponse } from 'next/server';
import { borrar, COOKIE_JURADO } from '@/lib/sesion';

export async function POST() {
  await borrar(COOKIE_JURADO);
  return NextResponse.json({ ok: true });
}
