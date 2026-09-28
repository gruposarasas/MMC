// Cookies firmadas con HMAC (SESSION_SECRET). Solo servidor.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

export const COOKIE_VISITANTE = 'mc_v';
export const COOKIE_MARCA = 'mc_m';
export const COOKIE_ADMIN = 'mc_a';

const DIA = 24 * 60 * 60;
export const DURACION = { [COOKIE_VISITANTE]: 365 * DIA, [COOKIE_MARCA]: 30 * DIA, [COOKIE_ADMIN]: DIA / 2 } as const;
type Nombre = keyof typeof DURACION;

function secreto() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error('SESSION_SECRET tiene que tener al menos 32 caracteres');
  return s;
}

const firma = (datos: string) => createHmac('sha256', secreto()).update(datos).digest('base64url');

export function firmar(nombre: Nombre, valor: string) {
  const exp = Math.floor(Date.now() / 1000) + DURACION[nombre];
  const datos = `${nombre}|${valor}|${exp}`;
  return `${Buffer.from(datos).toString('base64url')}.${firma(datos)}`;
}

export function verificar(nombre: Nombre, token: string | undefined): string | null {
  if (!token) return null;
  const [b, f] = token.split('.');
  if (!b || !f) return null;
  let datos: string;
  try {
    datos = Buffer.from(b, 'base64url').toString();
  } catch {
    return null;
  }
  const esperado = Buffer.from(firma(datos));
  const recibido = Buffer.from(f);
  if (esperado.length !== recibido.length || !timingSafeEqual(esperado, recibido)) return null;
  const [n, valor, exp] = datos.split('|');
  if (n !== nombre || !valor || Number(exp) < Date.now() / 1000) return null;
  return valor;
}

export const opcionesCookie = (nombre: Nombre) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: DURACION[nombre],
});

export async function leer(nombre: Nombre) {
  const c = await cookies();
  return verificar(nombre, c.get(nombre)?.value);
}

export async function escribir(nombre: Nombre, valor: string) {
  const c = await cookies();
  c.set(nombre, firmar(nombre, valor), opcionesCookie(nombre));
}

export async function borrar(nombre: Nombre) {
  const c = await cookies();
  c.set(nombre, '', { ...opcionesCookie(nombre), maxAge: 0 });
}

export function igualSeguro(a: string, b: string) {
  const x = createHmac('sha256', 'cmp').update(a).digest();
  const y = createHmac('sha256', 'cmp').update(b).digest();
  return timingSafeEqual(x, y);
}
