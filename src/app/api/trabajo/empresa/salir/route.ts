import { NextResponse } from 'next/server';
import { borrar, COOKIE_EMPRESA } from '@/lib/sesion';

export async function POST() {
  await borrar(COOKIE_EMPRESA);
  return NextResponse.json({ ok: true });
}
