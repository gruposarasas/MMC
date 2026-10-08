// Días de vacaciones por antigüedad (Ley de Contrato de Trabajo, art. 150 y 153).
// La antigüedad se cuenta al 31 de diciembre del año. Son días corridos.
import { diasEntre } from './formato';

export function diasQueCorresponden(ingreso: string | null, anio: number, manual?: number | null) {
  if (manual != null) return manual;
  if (!ingreso) return 14;
  const fin = `${anio}-12-31`;
  if (ingreso > fin) return 0;
  const dias = diasEntre(ingreso, fin);
  const meses = dias / 30.44;
  if (meses < 6) return Math.floor(dias / 20); // 1 día cada 20 trabajados
  const anios = dias / 365.25;
  if (anios < 5) return 14;
  if (anios < 10) return 21;
  if (anios < 20) return 28;
  return 35;
}

/** "2 años y 3 meses" */
export function antiguedad(ingreso: string | null, hasta: string) {
  if (!ingreso || ingreso > hasta) return '';
  const [a1, m1, d1] = ingreso.split('-').map(Number);
  const [a2, m2, d2] = hasta.split('-').map(Number);
  let meses = (a2 - a1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0);
  const anios = Math.floor(meses / 12);
  meses -= anios * 12;
  const p = [];
  if (anios) p.push(`${anios} ${anios === 1 ? 'año' : 'años'}`);
  if (meses) p.push(`${meses} ${meses === 1 ? 'mes' : 'meses'}`);
  return p.join(' y ') || 'menos de un mes';
}

export function edad(nacimiento: string | null, hasta: string) {
  if (!nacimiento) return null;
  const [a1, m1, d1] = nacimiento.split('-').map(Number);
  const [a2, m2, d2] = hasta.split('-').map(Number);
  return a2 - a1 - (m2 < m1 || (m2 === m1 && d2 < d1) ? 1 : 0);
}

/** Próximo cumpleaños desde hoy (incluye hoy): fecha y días que faltan. */
export function proximoCumple(nacimiento: string, hoy: string) {
  const [, m, d] = nacimiento.split('-');
  const anio = Number(hoy.slice(0, 4));
  const fechaCumple = (a: number) => {
    // 29/2 en años no bisiestos se festeja el 28/2.
    const bis = (a % 4 === 0 && a % 100 !== 0) || a % 400 === 0;
    return `${a}-${m}-${m === '02' && d === '29' && !bis ? '28' : d}`;
  };
  let f = fechaCumple(anio);
  if (f < hoy) f = fechaCumple(anio + 1);
  return { fecha: f, faltan: diasEntre(hoy, f), cumple: Number(f.slice(0, 4)) - Number(nacimiento.slice(0, 4)) };
}
