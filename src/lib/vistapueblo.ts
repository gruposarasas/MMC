// Gift cards de Vistapueblo (demo): valores fijos y formatos. Los usan las pantallas y el servidor.

export const MONTOS = [10000, 30000, 50000, 100000] as const;

export const ZONA = 'America/Argentina/Mendoza';

/** $ 100.000 */
export const pesos = (n: number) => `$ ${Math.round(n).toLocaleString('es-AR')}`;

/** 'aaaa-mm-dd' → 'dd/mm/aaaa' */
export const fechaLarga = (d: string) => (d ? d.slice(0, 10).split('-').reverse().join('/') : '');

/** Fecha y hora en Mendoza: '26/11 21:43' */
export function diaHora(iso: string) {
  const d = new Date(iso);
  const f = d.toLocaleDateString('es-AR', { timeZone: ZONA, day: '2-digit', month: '2-digit' });
  const h = d.toLocaleTimeString('es-AR', { timeZone: ZONA, hour: '2-digit', minute: '2-digit', hour12: false });
  return `${f} ${h}`;
}

/** Hoy en Mendoza: 'aaaa-mm-dd' */
export const hoyMendoza = () => new Date().toLocaleDateString('en-CA', { timeZone: ZONA });

/** Mes actual en Mendoza: 'aaaa-mm' */
export const mesActual = () => hoyMendoza().slice(0, 7);

export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const nombreMes = (m: string) => `${MESES[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;

/** Suma días a 'aaaa-mm-dd'. */
export function sumarDias(d: string, n: number) {
  const f = new Date(`${d}T12:00:00Z`);
  f.setUTCDate(f.getUTCDate() + n);
  return f.toISOString().slice(0, 10);
}

export const soloDigitos = (s: string) => (s || '').replace(/\D/g, '');
export const MAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

/** WhatsApp para wa.me: los números de Argentina sin el 54 se completan con 549. */
export function numeroWhatsapp(n: string) {
  let d = soloDigitos(n).replace(/^0+/, '');
  if (d.length === 10) d = `549${d}`;
  else if (d.length === 12 && d.startsWith('54') && !d.startsWith('549')) d = `549${d.slice(2)}`;
  return d;
}

export type EstadoTarjeta = 'anulada' | 'vencida' | 'agotada' | 'parcial' | 'sin_usar';
export const ESTADOS: Record<EstadoTarjeta, string> = {
  sin_usar: 'Sin usar',
  parcial: 'Usada en parte',
  agotada: 'Usada completa',
  vencida: 'Vencida',
  anulada: 'Anulada',
};

export function estadoTarjeta(t: { anulada: boolean; vence: string; saldo: number; monto: number }, hoy = hoyMendoza()): EstadoTarjeta {
  if (t.anulada) return 'anulada';
  if (t.saldo <= 0) return 'agotada';
  if (t.vence < hoy) return 'vencida';
  return t.saldo < t.monto ? 'parcial' : 'sin_usar';
}

/** Dónde vale la tarjeta, en texto. */
export function dondeVale(todos: boolean, ids: string[], locales: { id: string; nombre: string }[]) {
  if (todos) return 'Todos los restaurantes de Vistapueblo';
  const n = locales.filter((l) => ids.includes(l.id)).map((l) => l.nombre);
  return n.length > 1 ? `${n.slice(0, -1).join(', ')} y ${n[n.length - 1]}` : n[0] || '';
}

/** Mensaje de WhatsApp para mandar la gift card. */
export function textoWhatsapp(t: { nombre: string; monto: number; vence: string }, donde: string, link: string) {
  const nombre = t.nombre.split(' ')[0];
  return `¡Hola ${nombre}! 🎁 Vistapueblo te regala una gift card de ${pesos(t.monto)} para disfrutar en ${donde === 'Todos los restaurantes de Vistapueblo' ? 'los restaurantes de Vistapueblo' : donde}.\n\nVale hasta el ${fechaLarga(t.vence)}. Mostrá el código QR en la caja:\n${link}`;
}

export type NuevaTarjeta = { nombre: string; mail: string; whatsapp: string; monto: number };

/** Valida una fila (de a una o del Excel). Devuelve la fila limpia o el error. */
export function validarFila(f: Partial<Record<'nombre' | 'mail' | 'whatsapp' | 'monto', unknown>>, montoPorDefecto?: number): { fila?: NuevaTarjeta; error?: string } {
  const nombre = String(f.nombre ?? '').trim().replace(/\s+/g, ' ').slice(0, 120);
  if (nombre.length < 2) return { error: 'Falta el nombre.' };
  const mail = String(f.mail ?? '').trim().toLowerCase();
  if (mail && !MAIL_RE.test(mail)) return { error: `El mail "${mail}" no es válido.` };
  const whatsapp = soloDigitos(String(f.whatsapp ?? '')).replace(/^0+/, '');
  if (whatsapp && (whatsapp.length < 10 || whatsapp.length > 13)) return { error: `El WhatsApp "${f.whatsapp}" no es válido (10 números con característica).` };
  if (!mail && !whatsapp) return { error: 'Falta el mail o el WhatsApp.' };
  const crudo = soloDigitos(String(f.monto ?? '').replace(/[.,]00$/, ''));
  const monto = crudo ? Number(crudo) : montoPorDefecto;
  if (!monto || !(MONTOS as readonly number[]).includes(monto)) return { error: `El monto tiene que ser ${MONTOS.map(pesos).join(', ')}.` };
  return { fila: { nombre, mail, whatsapp, monto } };
}

// ------------------------------------------------------------ modo de uso e impresas
export type Modo = 'saldo' | 'unico';
export const MODOS: Record<Modo, { titulo: string; ayuda: string; enTarjeta: string }> = {
  saldo: { titulo: 'Billetera', ayuda: 'Usa el saldo en una o varias visitas.', enTarjeta: 'Podés usarla en una o varias visitas hasta agotar el saldo.' },
  unico: { titulo: 'Consumo total', ayuda: 'Se usa una sola vez; si se consume menos, la diferencia se pierde.', enTarjeta: 'Se usa en un solo consumo: aprovechala completa.' },
};
export const esModo = (m: unknown): m is Modo => m === 'saldo' || m === 'unico';

/** El nombre de la tarjeta, o "Al portador" si es un voucher impreso sin nombre. */
export const nombreDe = (n: string | null | undefined) => (n && n.trim()) || 'Al portador';

// ------------------------------------------------------------ rangos de fechas para métricas
export const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Primer día del mes 'aaaa-mm' y último. */
export function limitesMes(mes: string) {
  const [a, m] = mes.split('-').map(Number);
  const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return { desde: `${mes}-01`, hasta: `${mes}-${String(ultimo).padStart(2, '0')}` };
}

export function mesAnterior(mes: string) {
  const [a, m] = mes.split('-').map(Number);
  return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, '0')}`;
}

export const PRESETS = [
  ['hoy', 'Hoy'], ['7d', 'Últimos 7 días'], ['30d', 'Últimos 30 días'], ['mes', 'Este mes'], ['mes_pasado', 'Mes pasado'], ['90d', 'Últimos 90 días'], ['todo', 'Desde el inicio'],
] as const;
export type Preset = (typeof PRESETS)[number][0];

export function rangoPreset(p: string, inicio = '2026-11-01'): { desde: string; hasta: string } {
  const hoy = hoyMendoza();
  if (p === 'hoy') return { desde: hoy, hasta: hoy };
  if (p === '7d') return { desde: sumarDias(hoy, -6), hasta: hoy };
  if (p === '30d') return { desde: sumarDias(hoy, -29), hasta: hoy };
  if (p === '90d') return { desde: sumarDias(hoy, -89), hasta: hoy };
  if (p === 'mes_pasado') return limitesMes(mesAnterior(mesActual()));
  if (p === 'todo') return { desde: inicio, hasta: hoy };
  return { desde: `${mesActual()}-01`, hasta: hoy };
}

/** Cantidad de días entre dos fechas 'aaaa-mm-dd', inclusive. */
export const diasEntre = (desde: string, hasta: string) => Math.round((Date.parse(`${hasta}T12:00:00Z`) - Date.parse(`${desde}T12:00:00Z`)) / 86400000) + 1;

export const porcentaje = (parte: number, total: number) => (total ? Math.round((parte / total) * 1000) / 10 : 0);
