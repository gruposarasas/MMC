// Horas del mes de cada persona, con su horario semanal (adaptado de la app de Sara). Puro: sin base de datos.
//
// - Cada jornada cuenta de la entrada a la salida (fichada o la que cargó administración), redondeado al cuarto de
//   hora más cercano, con un máximo por jornada para atajar errores.
// - Sin salida: hasta que administración la resuelva, la jornada suma 0. Si la rechaza, también.
// - Llegada tarde: más de la tolerancia después del inicio del tramo de su horario.
// - Ausencia: un día de su horario ya terminado, sin fichar, que no es feriado ni está de vacaciones o con certificado.
// - Extra: lo trabajado en el día por encima de la jornada de su horario (en un día que no trabaja, todo). Los
//   feriados van aparte (se pagan doble).

export type Tramo = [string, string]; // ["09:00", "13:00"]
export type Horario = Record<string, Tramo[]>; // "0" = domingo … "6" = sábado
export type Reglas = { toleranciaMin: number; redondeoMin: number; margenSalidaMin: number; topeH: number };

export const REGLAS_DEFECTO: Reglas = { toleranciaMin: 5, redondeoMin: 15, margenSalidaMin: 120, topeH: 14 };
export const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
/** Instante de una hora de Mendoza (UTC−3 todo el año). */
export const instante = (fecha: string, hhmm: string) => Date.parse(`${fecha}T${hhmm.slice(0, 5)}:00-03:00`);
/** Fecha y hora de Mendoza de un instante. */
export const fechaDe = (ms: number) => new Date(ms - 3 * 36e5).toISOString().slice(0, 10);
export const horaDe = (ms: number) => new Date(ms - 3 * 36e5).toISOString().slice(11, 16);
export const diaSemana = (fecha: string) => new Date(`${fecha}T12:00:00Z`).getUTCDay();
/** Último día del mes (YYYY-MM). */
export const ultimoDia = (mes: string) => new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0)).toISOString().slice(0, 10);
export const sumarDia = (fecha: string, n: number) => new Date(Date.parse(`${fecha}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

/** Horario válido (tramos con horas bien escritas, ordenados), o null si no tiene ninguno. */
export function limpiarHorario(h: unknown): Horario | null {
  if (!h || typeof h !== 'object') return null;
  const out: Horario = {};
  for (let d = 0; d < 7; d++) {
    const tramos = (h as Record<string, unknown>)[String(d)];
    if (!Array.isArray(tramos)) continue;
    const ok = tramos.filter((t): t is Tramo => Array.isArray(t) && HORA.test(String(t[0])) && HORA.test(String(t[1])) && t[0] !== t[1])
      .map((t) => [t[0], t[1]] as Tramo).sort((a, b) => a[0].localeCompare(b[0]));
    if (ok.length) out[String(d)] = ok.slice(0, 3);
  }
  return Object.keys(out).length ? out : null;
}

export const tramosDe = (h: Horario | null, fecha: string): Tramo[] => h?.[String(diaSemana(fecha))] ?? [];
const finDe = (fecha: string, t: Tramo) => instante(fecha, t[1]) + (t[1] <= t[0] ? 864e5 : 0);
/** Horas de la jornada de su horario ese día. */
export const jornadaDe = (h: Horario | null, fecha: string) =>
  tramosDe(h, fecha).reduce((a, t) => a + (finDe(fecha, t) - instante(fecha, t[0])) / 36e5, 0);

/** "9 a 13 y 15 a 19" */
export const textoTramos = (t: Tramo[]) => t.map(([a, b]) => `${hCorta(a)} a ${hCorta(b)}`).join(' y ');
const hCorta = (h: string) => (h.endsWith(':00') ? String(Number(h.slice(0, 2))) : `${Number(h.slice(0, 2))}:${h.slice(3, 5)}`);

/** El tramo del horario al que corresponde una entrada: el de inicio más cercano. */
export function tramoDeEntrada(h: Horario | null, fecha: string, entradaMs: number): Tramo | null {
  let mejor: Tramo | null = null;
  for (const t of tramosDe(h, fecha)) if (!mejor || Math.abs(entradaMs - instante(fecha, t[0])) < Math.abs(entradaMs - instante(fecha, mejor[0]))) mejor = t;
  return mejor;
}

/** Minutos tarde contra su horario (0 si llegó a tiempo o entró fuera de horario; null si ese día no tiene horario). */
export function minutosTarde(h: Horario | null, fecha: string, entradaMs: number): number | null {
  const t = tramoDeEntrada(h, fecha, entradaMs);
  if (!t) return null;
  if (entradaMs >= finDe(fecha, t)) return 0; // entró después de terminar su horario: no es tarde, es fuera de horario
  return Math.max(0, Math.round((entradaMs - instante(fecha, t[0])) / 6e4));
}

/**
 * Hasta cuándo puede marcar la salida de una entrada: el fin de su tramo + el margen, sin pasar el máximo por jornada.
 * Si entró fuera de su horario (después de que terminó) o ese día no tiene horario, hasta el máximo por jornada.
 */
export function corteSalida(h: Horario | null, fecha: string, entradaMs: number, r: Reglas): number {
  const tope = entradaMs + r.topeH * 36e5;
  const t = tramoDeEntrada(h, fecha, entradaMs);
  if (!t || entradaMs >= finDe(fecha, t)) return tope;
  return Math.min(finDe(fecha, t) + r.margenSalidaMin * 6e4, tope);
}

/** Redondea horas al múltiplo de "minutos" más cercano. */
export const redondear = (horas: number, minutos: number) => (Math.round((horas * 60) / minutos) * minutos) / 60;

export type Jornada = {
  id: number; fecha: string; lugarId: number | null; entradaMs: number; salidaMs: number | null; salidaPor: 'qr' | 'admin' | null;
  minutosTarde: number | null; pedidoMs: number | null; pedidoNota: string; rechazada: boolean; manual: boolean; nota: string;
};
export type Licencia = { desde: string; hasta: string; tipo: 'vacaciones' | 'certificado' };
export type DatosMes = {
  mes: string; // YYYY-MM
  jornadas: Jornada[];
  horario: Horario | null;
  feriados: Map<string, string>;
  licencias: Licencia[];
  ingreso?: string | null;
  egreso?: string | null;
  reglas: Reglas;
  ahoraMs: number;
};
export type EstadoJornada = 'ok' | 'en_curso' | 'sin_salida' | 'pedida' | 'rechazada';
export type DiaJornada = Jornada & { horas: number; estado: EstadoJornada; tarde: boolean; feriado: string | null; recortada: boolean; corteMs: number };

export function horasDelMes(d: DatosMes) {
  const r = d.reglas;
  const conLicencia = (f: string) => d.licencias.some((l) => l.desde <= f && f <= l.hasta);
  const jornadas: DiaJornada[] = [...d.jornadas].sort((a, b) => a.entradaMs - b.entradaMs).map((j) => {
    const corteMs = corteSalida(d.horario, j.fecha, j.entradaMs, r);
    let estado: EstadoJornada = 'ok';
    if (j.salidaMs == null) {
      if (j.rechazada) estado = 'rechazada';
      else if (j.pedidoMs != null) estado = 'pedida';
      else estado = corteMs > d.ahoraMs ? 'en_curso' : 'sin_salida';
    }
    const bruto = j.salidaMs == null ? 0 : Math.max(0, redondear((j.salidaMs - j.entradaMs) / 36e5, r.redondeoMin));
    return {
      ...j, corteMs, estado, horas: Math.min(bruto, r.topeH), recortada: bruto > r.topeH,
      tarde: (j.minutosTarde ?? 0) > r.toleranciaMin && !d.feriados.has(j.fecha) && !conLicencia(j.fecha), feriado: d.feriados.get(j.fecha) ?? null,
    };
  });

  // Días del mes que ya pasaron (hoy cuenta si ya terminó su horario), dentro de su ingreso y su egreso.
  const desde = `${d.mes}-01`;
  const finMes = ultimoDia(d.mes);
  const hoy = fechaDe(d.ahoraMs);
  const fichados = new Set(jornadas.map((j) => j.fecha));
  const ausencias: string[] = [];
  const porDia = new Map<string, number>();
  for (const j of jornadas) porDia.set(j.fecha, (porDia.get(j.fecha) ?? 0) + j.horas);
  let esperadas = 0;
  for (let f = desde; f <= finMes; f = sumarDia(f, 1)) {
    if (d.ingreso && f < d.ingreso) continue;
    if (d.egreso && f > d.egreso) break;
    const tramos = tramosDe(d.horario, f);
    if (!tramos.length || d.feriados.has(f) || conLicencia(f)) continue;
    const termino = Math.max(...tramos.map((t) => finDe(f, t))) <= d.ahoraMs;
    if (f > hoy || (f === hoy && !termino)) continue;
    esperadas += jornadaDe(d.horario, f);
    if (!fichados.has(f)) ausencias.push(f);
  }

  let normales = 0;
  let feriado = 0;
  let extra = 0;
  for (const [f, h] of porDia) {
    if (d.feriados.has(f)) { feriado += h; continue; }
    normales += h;
    if (d.horario) extra += Math.max(0, h - jornadaDe(d.horario, f)); // sin horario no hay contra qué medir
  }
  const tardes = jornadas.filter((j) => j.tarde).length;
  return {
    jornadas, ausencias, esperadas, normales, feriado, extra, tardes,
    trabajadas: normales + feriado,
    dias: porDia.size,
    sinResolver: jornadas.filter((j) => j.estado === 'sin_salida' || j.estado === 'pedida').length,
    enCurso: jornadas.find((j) => j.estado === 'en_curso') ?? null,
    presentismo: tardes === 0 && ausencias.length === 0,
  };
}
export type ResumenHoras = ReturnType<typeof horasDelMes>;

/** "7,25" */
export const formatoHoras = (h: number) => h.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
