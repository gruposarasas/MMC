// Cookies firmadas con HMAC (SESSION_SECRET). Solo servidor.
import { createHmac, randomInt, scryptSync, timingSafeEqual, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export const COOKIE_ADMIN = 'bb_a';
export const COOKIE_EQUIPO = 'bb_e';
export const COOKIE_CONTADOR = 'bb_c';

const DIA = 24 * 60 * 60;
const DURACION = { [COOKIE_ADMIN]: 7 * DIA, [COOKIE_EQUIPO]: 180 * DIA, [COOKIE_CONTADOR]: 30 * DIA } as const;
type Nombre = keyof typeof DURACION;

function secreto() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error('SESSION_SECRET tiene que tener al menos 32 caracteres');
  return s;
}

const firma = (datos: string) => createHmac('sha256', secreto()).update(datos).digest('base64url');

function firmar(nombre: Nombre, valor: string) {
  const exp = Math.floor(Date.now() / 1000) + DURACION[nombre];
  const datos = `${nombre}|${valor}|${exp}`;
  return `${Buffer.from(datos).toString('base64url')}.${firma(datos)}`;
}

function verificar(nombre: Nombre, token: string | undefined): string | null {
  if (!token) return null;
  const [b, f] = token.split('.');
  if (!b || !f) return null;
  const datos = Buffer.from(b, 'base64url').toString();
  const esperado = Buffer.from(firma(datos));
  const recibido = Buffer.from(f);
  if (esperado.length !== recibido.length || !timingSafeEqual(esperado, recibido)) return null;
  const [n, valor, exp] = datos.split('|');
  if (n !== nombre || !valor || Number(exp) < Date.now() / 1000) return null;
  return valor;
}

const opciones = (nombre: Nombre) => ({
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
  c.set(nombre, firmar(nombre, valor), opciones(nombre));
}

export async function borrar(nombre: Nombre) {
  const c = await cookies();
  c.set(nombre, '', { ...opciones(nombre), maxAge: 0 });
}

export function igualSeguro(a: string, b: string) {
  const x = createHmac('sha256', 'cmp').update(a).digest();
  const y = createHmac('sha256', 'cmp').update(b).digest();
  return timingSafeEqual(x, y);
}

// ---------- administración ----------
export const esAdmin = async () => (await leer(COOKIE_ADMIN)) === 'admin';

/** Para server actions y páginas del panel: si no hay sesión, vuelve al ingreso. */
export async function exigirAdmin() {
  if (!(await esAdmin())) redirect('/ingresar');
}

// ---------- equipo ----------
export async function empleadoSesion(): Promise<number | null> {
  const v = await leer(COOKIE_EQUIPO);
  const id = Number(v);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Clave del contador: 8 letras y números fáciles de leer (sin 0/o, 1/l/i), como "k7mp-3xra". */
export function claveContador() {
  const letras = 'abcdefghjkmnpqrstuvwxyz23456789';
  const c = Array.from({ length: 8 }, () => letras[randomInt(0, letras.length)]).join('');
  return `${c.slice(0, 4)}-${c.slice(4)}`;
}

/** Clave numérica de 6 dígitos para la app del equipo. */
export const nuevaClave = () => String(randomInt(0, 1_000_000)).padStart(6, '0');

export function hashClave(clave: string) {
  const sal = randomBytes(16).toString('base64url');
  return `${sal}:${scryptSync(clave, sal, 32).toString('base64url')}`;
}

export function claveCorrecta(clave: string, hash: string | null) {
  if (!hash) return false;
  const [sal, h] = hash.split(':');
  if (!sal || !h) return false;
  const a = scryptSync(clave, sal, 32);
  const b = Buffer.from(h, 'base64url');
  return a.length === b.length && timingSafeEqual(a, b);
}
