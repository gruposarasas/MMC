// Lectura de formularios en server actions. Solo servidor.
import { aNumero, esFecha, redondear } from './formato';

export type Estado = { error?: string; ok?: string; clave?: string } | null;

export class ErrorForm extends Error {}
export const falla = (msg: string): never => {
  throw new ErrorForm(msg);
};

export const texto = (f: FormData, k: string, max = 300) => String(f.get(k) ?? '').trim().slice(0, max);

export function numero(f: FormData, k: string, opc: { requerido?: string; min?: number; max?: number; dec?: number } = {}) {
  const crudo = texto(f, k, 40);
  if (!crudo) {
    if (opc.requerido) falla(opc.requerido);
    return 0;
  }
  const n = aNumero(crudo);
  if (n == null) return falla(`Revisá el número "${crudo}".`);
  if (opc.min != null && n < opc.min) falla(`El valor ${crudo} es menor que ${opc.min}.`);
  if (opc.max != null && n > opc.max) falla(`El valor ${crudo} es mayor que ${opc.max}.`);
  return redondear(n, opc.dec ?? 2);
}

export function fechaForm(f: FormData, k: string, requerido?: string) {
  const v = texto(f, k, 10);
  if (!v) {
    if (requerido) falla(requerido);
    return null;
  }
  if (!esFecha(v)) falla('Revisá la fecha.');
  return v;
}

export const tilde = (f: FormData, k: string) => f.get(k) === 'on' || f.get(k) === '1' || f.get(k) === 'true';

export function entero(f: FormData, k: string) {
  const n = Number(texto(f, k, 12));
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** URL interna a la que volver después de guardar. */
export function volver(f: FormData, porDefecto: string) {
  const v = texto(f, 'volver', 500);
  // Solo rutas internas: nada de "//otro.com" ni barras invertidas (el navegador las toma como "/").
  return v.startsWith('/') && !v.startsWith('//') && !v.includes('\\') ? v : porDefecto;
}

/** Envuelve una server action: convierte ErrorForm en { error } y deja pasar el redirect. */
export async function intentar(fn: () => Promise<Estado | void>): Promise<Estado> {
  try {
    return (await fn()) ?? null;
  } catch (e) {
    if (e instanceof ErrorForm) return { error: e.message };
    throw e;
  }
}
