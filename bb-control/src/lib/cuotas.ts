// Cronograma de cuotas de un préstamo o plan de pagos. Puro: lo usan el formulario (vista previa) y el servidor.
import { redondear } from './formato';

export type Sistema = 'frances' | 'aleman' | 'fija' | 'unica';
export const SISTEMAS: Record<Sistema, string> = {
  frances: 'Francés (cuota fija con tasa)',
  aleman: 'Alemán (capital fijo, cuota que baja)',
  fija: 'Cuota fija informada (plan de pagos)',
  unica: 'Un solo pago',
};

export const TIPOS_PASIVO: Record<string, string> = {
  prestamo: 'Préstamo', plan: 'Plan de pagos', leasing: 'Leasing', tarjeta: 'Tarjeta', deuda: 'Deuda', otro: 'Otro',
};

export type CuotaPlan = { numero: number; vencimiento: string; capital: number; interes: number; iva: number; otros: number; total: number };

/** Misma fecha N meses después; si el mes es más corto, el último día (31/01 → 28/02). */
export function sumarMesesDia(iso: string, n: number) {
  const [a, m, d] = iso.split('-').map(Number);
  const t = a * 12 + (m - 1) + n;
  const anio = Math.floor(t / 12);
  const mes = (t % 12) + 1;
  const ultimo = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  return `${anio}-${String(mes).padStart(2, '0')}-${String(Math.min(d, ultimo)).padStart(2, '0')}`;
}

export function cronograma(o: {
  capital: number;
  tasa: number | null; // TNA en %
  cuotas: number;
  primera: string; // AAAA-MM-DD
  sistema: Sistema;
  cuotaFija?: number | null; // para "fija": el valor de la cuota que informa el plan
  ivaIntereses?: boolean; // 21 % sobre los intereses
  otros?: number; // seguro o gastos por cuota
}): CuotaPlan[] {
  const n = o.sistema === 'unica' ? 1 : Math.max(1, Math.min(600, Math.round(o.cuotas)));
  const P = Math.max(0, o.capital);
  const i = Math.max(0, o.tasa ?? 0) / 1200;
  const otros = redondear(Math.max(0, o.otros ?? 0));
  const out: CuotaPlan[] = [];
  let saldo = P;
  const cuotaFrances = i > 0 ? (P * i) / (1 - (1 + i) ** -n) : P / n;
  const capFija = o.sistema === 'fija' ? (P > 0 ? P / n : Math.max(0, o.cuotaFija ?? 0)) : P / n;
  for (let k = 1; k <= n; k++) {
    let capital: number;
    let interes: number;
    if (o.sistema === 'frances') {
      interes = redondear(saldo * i);
      capital = k === n ? saldo : redondear(cuotaFrances - interes);
    } else if (o.sistema === 'aleman') {
      interes = redondear(saldo * i);
      capital = k === n ? saldo : redondear(P / n);
    } else if (o.sistema === 'fija') {
      capital = k === n && P > 0 ? saldo : redondear(capFija);
      interes = redondear(Math.max(0, (o.cuotaFija ?? capital) - capital));
    } else {
      capital = P;
      interes = redondear(P * i);
    }
    capital = redondear(capital);
    saldo = redondear(saldo - capital);
    const iva = o.ivaIntereses ? redondear(interes * 0.21) : 0;
    out.push({ numero: k, vencimiento: sumarMesesDia(o.primera, k - 1), capital, interes, iva, otros, total: redondear(capital + interes + iva + otros) });
  }
  return out;
}
