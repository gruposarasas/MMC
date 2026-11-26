import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
import { permitir } from '@/lib/limite';
import { cajaActual } from '@/lib/vistapueblo-servidor';
import { pesos, fechaLarga } from '@/lib/vistapueblo';

const MENSAJES: Record<string, string> = {
  caja_invalida: 'Esta caja ya no es válida (cambió el PIN del local). Volvé a configurarla.',
  no_existe: 'Esta gift card no existe.',
  anulada: 'Esta gift card está anulada.',
  local_no_incluido: 'Esta gift card no vale en este local.',
  monto_invalido: 'Escribí el monto del consumo.',
};

/** La caja registra un consumo con la gift card. Todo se valida en la base, en una sola transacción. */
export async function POST(req: Request) {
  const caja = await cajaActual();
  if (!caja) return NextResponse.json({ error: 'Este celular no está configurado como caja. Entrá con el PIN del local.' }, { status: 401 });
  if (!permitir(`vp-consumo:${caja.id}`, 60, 600)) return NextResponse.json({ error: 'Demasiados consumos seguidos. Esperá un momento.' }, { status: 429 });
  const j = await req.json().catch(() => ({}));
  const monto = Math.round(Number(String(j.monto ?? '').replace(/\D/g, '')));
  const { data, error } = await db().rpc('vp_consumir', {
    p_token: String(j.token ?? ''), p_local: caja.id, p_pin_version: caja.pin_version, p_monto: monto, p_cajero: String(j.cajero ?? ''),
  });
  if (error) {
    console.error('[vistapueblo] consumo', error.message);
    return NextResponse.json({ error: 'No se pudo registrar. Probá de nuevo.' }, { status: 500 });
  }
  const r = data as { estado: string; saldo?: number; vence?: string };
  if (r.estado === 'ok') return NextResponse.json({ ok: true, ...r });
  const msj = r.estado === 'saldo_insuficiente' ? `El saldo no alcanza: quedan ${pesos(r.saldo ?? 0)}.`
    : r.estado === 'vencida' ? `Esta gift card venció el ${fechaLarga(r.vence ?? '')}.`
    : MENSAJES[r.estado] ?? 'No se pudo registrar.';
  return NextResponse.json({ error: msj, estado: r.estado }, { status: 409 });
}
