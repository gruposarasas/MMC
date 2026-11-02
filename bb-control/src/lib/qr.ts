// QR rotativo de la pantalla de cada lugar (como en la app de Sara): BB|{lugarId}|{ventana}|{firma}.
// La ventana cambia cada 5 segundos; la firma son los primeros 5 bytes de HMAC-SHA256 con una clave derivada de
// SESSION_SECRET. Se acepta la ventana actual o la anterior: una foto o un código reenviado no sirven. Solo servidor.
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const DURACION_VENTANA_MS = 5000;
export const COOKIE_PANTALLA = 'bb_p';
export const ventanaDe = (ms: number) => Math.floor(ms / DURACION_VENTANA_MS);

const clave = () => createHash('sha256').update(`${process.env.SESSION_SECRET ?? ''}|qr-fichaje`).digest();
const firmar = (lugarId: number, ventana: number) => createHmac('sha256', clave()).update(`${lugarId}|${ventana}`).digest().subarray(0, 5).toString('hex');

export function payloadQR(lugarId: number, ahoraMs: number) {
  const ventana = ventanaDe(ahoraMs);
  return { payload: `BB|${lugarId}|${ventana}|${firmar(lugarId, ventana)}`, ventana, restanteMs: (ventana + 1) * DURACION_VENTANA_MS - ahoraMs };
}

/** El lugar del QR si es válido; si no, el motivo para mostrarle a la persona. */
export function leerQR(payload: string, ahoraMs: number): { lugarId: number } | { error: string } {
  const partes = String(payload ?? '').trim().split('|');
  if (partes.length !== 4 || partes[0] !== 'BB') return { error: 'Ese no es el QR de fichaje. Escaneá el de la pantalla del lugar.' };
  const [, l, v, firma] = partes;
  if (!/^\d+$/.test(l) || !/^\d+$/.test(v) || !/^[0-9a-f]{10}$/.test(firma)) return { error: 'QR inválido.' };
  const lugarId = Number(l);
  const ventana = Number(v);
  const actual = ventanaDe(ahoraMs);
  if (ventana > actual) return { error: 'QR inválido.' };
  if (actual - ventana > 1) return { error: 'El QR venció. Escaneá el que está en la pantalla ahora.' };
  if (!timingSafeEqual(Buffer.from(firmar(lugarId, ventana), 'hex'), Buffer.from(firma, 'hex'))) return { error: 'QR inválido.' };
  return { lugarId };
}

export { distanciaM } from './geo';

/** Huella de un token (cookie de la pantalla o del teléfono): lo que se guarda en la base. */
export const huella = (token: string) => createHash('sha256').update(`bb|${token}`).digest('base64url');
