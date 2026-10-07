// Formatos y fechas. Se usa en el servidor y en el cliente.
export const ZONA = 'America/Argentina/Mendoza';
export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** Fecha de hoy en Mendoza, AAAA-MM-DD. */
export const hoy = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(d);
export const mesActual = () => hoy().slice(0, 7);

const fmt = (dec: number) =>
  new Intl.NumberFormat('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
const f0 = fmt(0);
const f2 = fmt(2);

export const pesos = (n: number | null | undefined, dec: 0 | 2 = 2) => {
  const v = Number(n) || 0;
  const s = (dec ? f2 : f0).format(Math.abs(v));
  return `${v < 0 ? '−' : ''}$ ${s}`;
};
export const dolares = (n: number | null | undefined) => `US$ ${f2.format(Number(n) || 0)}`;
export const numero = (n: number | null | undefined, dec = 0) =>
  new Intl.NumberFormat('es-AR', { maximumFractionDigits: dec }).format(Number(n) || 0);
export const porcentaje = (n: number | null | undefined, dec = 1) =>
  n == null || !Number.isFinite(n) ? '—' : `${new Intl.NumberFormat('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(n)} %`;

/** dd/mm/aaaa */
export const fecha = (iso: string | null | undefined) => {
  if (!iso) return '';
  const [a, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
};
/** dd/mm */
export const fechaCorta = (iso: string | null | undefined) => (iso ? fecha(iso).slice(0, 5) : '');
export const nombreMes = (ym: string) => {
  const [a, m] = ym.split('-').map(Number);
  return `${MESES[m - 1]} ${a}`;
};
export const mesCorto = (ym: string) => {
  const [a, m] = ym.split('-').map(Number);
  return `${MESES_CORTOS[m - 1]} ${String(a).slice(2)}`;
};
export const diaSemana = (iso: string) => DIAS[new Date(`${iso}T12:00:00Z`).getUTCDay()];

export function sumarDias(iso: string, n: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function sumarMeses(ym: string, n: number) {
  const [a, m] = ym.split('-').map(Number);
  const t = a * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
}
export const diasEntre = (desde: string, hasta: string) =>
  Math.round((Date.parse(`${hasta}T12:00:00Z`) - Date.parse(`${desde}T12:00:00Z`)) / 86_400_000);

export function esFecha(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

// ---------- período (?p=AAAA-MM o ?p=AAAA) ----------
export type Periodo = {
  valor: string;
  tipo: 'mes' | 'anio';
  desde: string; // inclusive
  hasta: string; // exclusivo
  etiqueta: string;
  anterior: string;
  siguiente: string;
  actual: boolean;
};

export function periodo(p?: string | null): Periodo {
  const ahora = mesActual();
  if (p && /^\d{4}$/.test(p)) {
    const a = Number(p);
    return {
      valor: p,
      tipo: 'anio',
      desde: `${a}-01-01`,
      hasta: `${a + 1}-01-01`,
      etiqueta: `Año ${a}`,
      anterior: String(a - 1),
      siguiente: String(a + 1),
      actual: ahora.startsWith(p),
    };
  }
  const ym = p && /^\d{4}-(0[1-9]|1[0-2])$/.test(p) ? p : ahora;
  const sig = sumarMeses(ym, 1);
  const etiqueta = nombreMes(ym);
  return {
    valor: ym,
    tipo: 'mes',
    desde: `${ym}-01`,
    hasta: `${sig}-01`,
    etiqueta: etiqueta[0].toUpperCase() + etiqueta.slice(1),
    anterior: sumarMeses(ym, -1),
    siguiente: sig,
    actual: ym === ahora,
  };
}

// ---------- números escritos a mano o leídos de un Excel ----------
/** Acepta 1234.56, "1.234,56", "$ 1.234", "(500)", "1,234.56". */
export function aNumero(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string') return null;
  let s = v.trim().replace(/\s|\$|ARS|USD|U\$S|US\$/gi, '');
  if (!s || s === '-') return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) {
    neg = true;
    s = s.slice(1, -1);
  }
  if (s.endsWith('-')) {
    neg = true;
    s = s.slice(0, -1);
  }
  if (s.startsWith('-') || s.startsWith('−')) {
    neg = !neg;
    s = s.slice(1);
  }
  const coma = s.lastIndexOf(',');
  const punto = s.lastIndexOf('.');
  if (coma > -1 && punto > -1) {
    s = coma > punto ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (coma > -1) {
    s = (s.match(/,/g) || []).length > 1 ? s.replace(/,/g, '') : s.replace(',', '.');
  } else if (punto > -1 && ((s.match(/\./g) || []).length > 1 || /^\d{1,3}\.\d{3}$/.test(s))) {
    s = s.replace(/\./g, '');
  }
  if (!/^\d*\.?\d+$/.test(s) && !/^\d+\.?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? (neg ? -n : n) : null;
}

export const redondear = (n: number, dec = 2) => Math.round((n + Number.EPSILON) * 10 ** dec) / 10 ** dec;

/** Para inputs: 1234.5 → "1234,5" */
export const aTexto = (n: number | null | undefined) =>
  n == null || n === 0 ? '' : String(redondear(Number(n), 4)).replace('.', ',');

export const nombreCompleto = (e: { nombre: string; apellido?: string | null }) =>
  [e.nombre, e.apellido].filter(Boolean).join(' ');

export const soloDigitos = (s: string) => s.replace(/\D/g, '');

/** Link de WhatsApp a un número argentino (10 dígitos con característica). */
export function linkWhatsapp(tel: string, texto?: string) {
  let n = soloDigitos(tel);
  if (n.startsWith('549')) n = n.slice(3);
  else if (n.startsWith('54')) n = n.slice(2);
  if (n.startsWith('0')) n = n.slice(1);
  if (n.length === 12) n = n.replace(/^(\d{2,4})15(\d{6,8})$/, '$1$2'); // 261 15 4xxxxxx
  const base = n.length >= 10 ? `https://wa.me/549${n}` : 'https://wa.me/';
  return texto ? `${base}?text=${encodeURIComponent(texto)}` : base;
}
