import { NextResponse } from 'next/server';
import { borrar, COOKIE_POSTULANTE } from '@/lib/sesion';

export async function POST() {
  await borrar(COOKIE_POSTULANTE);
  return NextResponse.json({ ok: true });
}
