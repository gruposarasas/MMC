import { EVENTO_FIN, ZONA } from './config';

export const pad = (n: number | string) => String(n).padStart(2, '0');

/** '2026-10-04' → '04/10/2026' */
export const fDMY = (f: string) => {
  const [y, m, d] = f.split('-');
  return `${d}/${m}/${y}`;
};

/** Fecha de hoy en Mendoza, como 'aaaa-mm-dd'. */
export const hoyMendoza = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

export const vencida = (vence: string) => hoyMendoza() > vence;
export const soloEvento = (vence: string) => !vence || vence <= EVENTO_FIN;

const partes = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('es-AR', { timeZone: ZONA, ...opts }).format(new Date(iso));

/** 'sáb 3 18:42' */
export const diaHora = (iso: string, mes = false) =>
  `${partes(iso, mes ? { weekday: 'short', day: 'numeric', month: 'short' } : { weekday: 'short', day: 'numeric' })} ${partes(iso, { hour: '2-digit', minute: '2-digit', hour12: false })}`;

/** 'sáb 18:42' */
export const diaCortoHora = (iso: string) =>
  `${partes(iso, { weekday: 'short' })} ${partes(iso, { hour: '2-digit', minute: '2-digit', hour12: false })}`;

export const fechaCorta = (iso: string) => partes(iso, { day: 'numeric', month: 'short' });

export const fechaAR = (f: string) => fDMY(f);

export const edad = (nac: string, hoy = hoyMendoza()) => {
  const [ny, nm, nd] = nac.split('-').map(Number);
  const [hy, hm, hd] = hoy.split('-').map(Number);
  let e = hy - ny;
  if (hm < nm || (hm === nm && hd < nd)) e--;
  return e;
};

export const formatoTel = (d: string) => (d.length === 10 ? `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}` : d);

export const numCanje = (n: number) => String(n).padStart(4, '0');
