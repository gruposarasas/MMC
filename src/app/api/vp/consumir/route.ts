import { NextResponse, after } from 'next/server';
import { db } from '@/lib/supabase';
import { permitir } from '@/lib/limite';
import { cajaActual, tarjetaPorId, permisoValido, avisar, linkTarjeta } from '@/lib/vistapueblo-servidor';
import { pesos, fechaLarga } from '@/lib/vistapueblo';

const MENSAJES: Record<string, string> = {
  caja_invalida: 'Esta caja ya no es válida (cambió el PIN del local). Volvé a configurarla.',
  no_existe: 'Esta gift card no existe.',
  anulada: 'Esta gift card está anulada.',
  agotada: 'Esta gift card ya se usó.',
  local_no_incluido: 'Esta gift card no vale en este local.',
  monto_invalido: 'Escribí el total del ticket.',
  ticket_invalido: 'El total del ticket no puede ser menor que lo que se paga con la gift card.',
};

/**
 * La caja registra un consumo. Hace falta el permiso que se obtiene al escanear un QR válido
 * (el de la pantalla del cliente, que cambia cada 30 segundos, o el del voucher impreso).
 * El saldo se valida y descuenta en la base, en una sola transacción.
 */
export async function POST(req: Request) {
  const caja = await cajaActual();
  if (!caja) return NextResponse.json({ error: 'Este celular no está configurado como caja. Entrá con el PIN del local.' }, { status: 401 });
  if (!permitir(`vp-consumo:${caja.id}`, 60, 600)) return NextResponse.json({ error: 'Demasiados consumos seguidos. Esperá un momento.' }, { status: 429 });
  const j = await req.json().catch(() => ({}));
  const id = String(j.id ?? '');
  if (!permisoValido(String(j.permiso ?? ''), id, caja.id))
    return NextResponse.json({ error: 'Pasaron más de 15 minutos desde que escaneaste el QR. Pedile al cliente que te lo muestre de nuevo.' }, { status: 403 });
  const t = await tarjetaPorId(id);
  if (!t) return NextResponse.json({ error: MENSAJES.no_existe }, { status: 404 });

  const entero = (v: unknown) => Math.round(Number(String(v ?? '').replace(/\D/g, ''))) || 0;
  const monto = entero(j.monto);
  const ticket = entero(j.ticket) || monto;
  const personas = entero(j.personas);
  const { data, error } = await db().rpc('vp_consumir', {
    p_token: t.token, p_local: caja.id, p_pin_version: caja.pin_version, p_monto: monto, p_cajero: String(j.cajero ?? ''),
    p_ticket: ticket, p_personas: personas >= 1 && personas <= 99 ? personas : null,
  });
  if (error) {
    console.error('[vistapueblo] consumo', error.message);
    return NextResponse.json({ error: 'No se pudo registrar. Probá de nuevo.' }, { status: 500 });
  }
  const r = data as { estado: string; saldo?: number; vence?: string; monto?: number; local?: string; perdido?: number };
  if (r.estado === 'ok') {
    const quedan = r.saldo ? `Te quedan ${pesos(r.saldo)}.` : 'Ya usaste toda la gift card. ¡Gracias por visitarnos!';
    // El aviso al celular del cliente sale después de responder: no demora la pantalla del cajero.
    after(() => avisar(t.id, { title: `Usaste ${pesos(r.monto ?? monto)} en ${r.local}`, body: `Gift card de Vistapueblo N° ${t.numero}. ${quedan}`, url: linkTarjeta(t.token) }));
    return NextResponse.json({ ok: true, ...r });
  }
  const msj = r.estado === 'saldo_insuficiente' ? `El saldo no alcanza: quedan ${pesos(r.saldo ?? 0)}.`
    : r.estado === 'vencida' ? `Esta gift card venció el ${fechaLarga(r.vence ?? '')}.`
    : MENSAJES[r.estado] ?? 'No se pudo registrar.';
  return NextResponse.json({ error: msj, estado: r.estado }, { status: 409 });
}
