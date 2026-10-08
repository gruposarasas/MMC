// Arma URLs internas cambiando algunos parámetros y dejando el resto.
export type Params = Record<string, string | string[] | undefined>;

export function url(base: string, params: Params, cambios: Record<string, string | number | null | undefined> = {}) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === 'string' && v !== '') q.set(k, v);
  }
  for (const [k, v] of Object.entries(cambios)) {
    if (v == null || v === '') q.delete(k);
    else q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `${base}?${s}` : base;
}

export const param = (p: Params, k: string) => (typeof p[k] === 'string' ? (p[k] as string) : '');
