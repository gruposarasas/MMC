// La pantalla del QR de un lugar (tablet o PC), reconocida por su cookie. Solo servidor.
import { cookies } from 'next/headers';
import { db } from './db';
import { COOKIE_PANTALLA, huella } from './qr';

export async function pantallaActual() {
  const token = (await cookies()).get(COOKIE_PANTALLA)?.value;
  if (!token) return null;
  const [p] = await db()<{ id: number; nombre: string; lugar_id: number; lugar: string; visto: Date | null }[]>`
    select p.id, p.nombre, p.lugar_id, l.nombre lugar, p.visto from pantallas p join lugares l on l.id = p.lugar_id
    where p.token_hash = ${huella(token)} and p.activa and l.activo`;
  return p ?? null;
}
