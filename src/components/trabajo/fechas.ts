const ZONA = 'America/Argentina/Mendoza';
/** "hoy", "ayer" o "12/11". */
export function fechaCorta(iso: string) {
  const f = (d: Date) => d.toLocaleDateString('es-AR', { timeZone: ZONA, day: '2-digit', month: '2-digit' });
  const hoy = new Date();
  const ayer = new Date(hoy.getTime() - 86_400_000);
  const d = new Date(iso);
  return f(d) === f(hoy) ? 'hoy' : f(d) === f(ayer) ? 'ayer' : f(d);
}
