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
