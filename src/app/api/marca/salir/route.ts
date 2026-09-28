import { NextResponse } from 'next/server';
import { borrar, COOKIE_MARCA } from '@/lib/sesion';

export async function POST() {
  await borrar(COOKIE_MARCA);
  return NextResponse.json({ ok: true });
}
