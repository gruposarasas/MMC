// Pasa un FormData a un objeto: los campos repetidos (listas) quedan como arreglos.
const LISTAS = new Set(['puestos_extra', 'disponibilidad', 'idiomas']);

export function datosDelForm(f: FormData): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  for (const [k, v] of f.entries()) {
    if (typeof v !== 'string') continue;
    if (LISTAS.has(k)) (o[k] = (o[k] as string[]) || []), (o[k] as string[]).push(v);
    else o[k] = v;
  }
  for (const k of LISTAS) o[k] = o[k] || [];
  return o;
}
