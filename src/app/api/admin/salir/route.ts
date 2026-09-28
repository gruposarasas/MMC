import { NextResponse } from 'next/server';
import { borrar, COOKIE_ADMIN } from '@/lib/sesion';

export async function POST() {
  await borrar(COOKIE_ADMIN);
  return NextResponse.json({ ok: true });
}
