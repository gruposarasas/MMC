// Límites de intentos en memoria (la app corre en un solo contenedor).
import { headers } from 'next/headers';

const baldes = new Map<string, number[]>();

export function permitir(clave: string, max: number, ventanaSeg: number): boolean {
  const ahora = Date.now();
  const desde = ahora - ventanaSeg * 1000;
  const t = (baldes.get(clave) || []).filter((x) => x > desde);
  if (t.length >= max) {
    baldes.set(clave, t);
    return false;
  }
  t.push(ahora);
  baldes.set(clave, t);
  if (baldes.size > 50_000) limpiar();
  return true;
}

export function superado(clave: string, max: number, ventanaSeg: number): boolean {
  const desde = Date.now() - ventanaSeg * 1000;
  return (baldes.get(clave) || []).filter((x) => x > desde).length >= max;
}

function limpiar() {
  const desde = Date.now() - 3600_000;
  for (const [k, t] of baldes) if (!t.some((x) => x > desde)) baldes.delete(k);
}

export async function ip() {
  const h = await headers();
  return (h.get('x-forwarded-for')?.split(',')[0] || h.get('x-real-ip') || 'local').trim();
}
