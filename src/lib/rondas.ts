// Torneo de baristas: reglas puras (se usan en el servidor y en las pantallas).
//   Ronda 1: todos, pasan 16 · Ronda 2: pasan 6 · Ronda 3: pasan 2 (3° y 4° puesto) · Final: 1 vs 1.
// Cada ronda se puntúa de cero, de 1 a 9 con un decimal. Empates: mejor espresso; si persiste, el jurado.

export type Barista = { id: string; nombre: string; cafeteria: string; turno: string; orden: number; created_at: string };

export type Puntaje = {
  barista_id: string;
  ronda: number;
  semilla: number | null;
  puntaje: number | null;
  espresso: number | null; // desempate: a igual puntaje, pasa el de mejor espresso
  desempate: number; // si también empatan en el espresso, decide el jurado (más alto va primero)
  descuento?: number; // puntos que descuentan los jueces fiscales
  puntuado_at: string | null;
};

export type Fase = 'r1' | 'r2' | 'r3' | 'final';

export const RONDAS: { fase: Fase; n: number; titulo: string; pasan: number; aviso: string; dia: string }[] = [
  { fase: 'r1', n: 1, titulo: 'Ronda 1', pasan: 16, aviso: 'Pasan a la Ronda 2', dia: 'Sábado 3' },
  { fase: 'r2', n: 2, titulo: 'Ronda 2', pasan: 6, aviso: 'Pasan a la Ronda 3', dia: 'Domingo 4' },
  { fase: 'r3', n: 3, titulo: 'Ronda 3', pasan: 2, aviso: 'Pasan a la Final', dia: 'Domingo 4' },
  { fase: 'final', n: 4, titulo: 'Final', pasan: 1, aviso: 'Campeón', dia: 'Domingo 4' },
];
export const ronda = (f: Fase) => RONDAS.find((r) => r.fase === f)!;

/** Turnos de las rondas 2, 3 y la final según el puesto con que llega cada barista (cronograma oficial). */
export const TURNOS: Record<number, Record<number, string>> = {
  2: {
    1: 'Dom 10:00 · Mesa 1', 16: 'Dom 10:00 · Mesa 2', 10: 'Dom 10:00 · Mesa 3',
    2: 'Dom 10:30 · Mesa 1', 15: 'Dom 10:30 · Mesa 2', 9: 'Dom 10:30 · Mesa 3',
    3: 'Dom 11:00 · Mesa 1', 14: 'Dom 11:00 · Mesa 2', 8: 'Dom 11:00 · Mesa 3',
    4: 'Dom 11:30 · Mesa 1', 13: 'Dom 11:30 · Mesa 2', 7: 'Dom 11:30 · Mesa 3',
    5: 'Dom 12:00 · Mesa 1', 12: 'Dom 12:00 · Mesa 2',
    6: 'Dom 12:30 · Mesa 1', 11: 'Dom 12:30 · Mesa 2',
  },
  3: {
    1: 'Dom 17:00 · Mesa 1', 3: 'Dom 17:00 · Mesa 2', 5: 'Dom 17:00 · Mesa 3',
    2: 'Dom 17:30 · Mesa 1', 4: 'Dom 17:30 · Mesa 2', 6: 'Dom 17:30 · Mesa 3',
  },
  4: { 1: 'Dom 18:30 · Mesa 1', 2: 'Dom 18:30 · Mesa 2' },
};

/** Orden de salida de cada ronda (para listar a quienes todavía no compitieron). */
const ordenTurno = (t: string) => t.replace(/^(Sáb|Dom) /, (m) => (m.startsWith('Sáb') ? '1 ' : '2 '));

export type Fila = Barista & { semilla: number | null; puntaje: number | null; espresso: number | null; desempate: number; descuento: number; puntuado_at: string | null; turnoRonda: string };

/** Participantes de una ronda con su puntaje. La ronda 1 incluye a todos los baristas. */
export function participantes(n: number, baristas: Barista[], puntajes: Puntaje[]): Fila[] {
  const deRonda = new Map(puntajes.filter((p) => p.ronda === n).map((p) => [p.barista_id, p]));
  const lista = n === 1 ? baristas : baristas.filter((b) => deRonda.has(b.id));
  return lista.map((b) => {
    const p = deRonda.get(b.id);
    const semilla = p?.semilla ?? null;
    return {
      ...b,
      semilla,
      puntaje: p?.puntaje ?? null,
      espresso: p?.espresso ?? null,
      desempate: p?.desempate ?? 0,
      descuento: p?.descuento ?? 0,
      puntuado_at: p?.puntuado_at ?? null,
      turnoRonda: n === 1 ? b.turno : (semilla != null && TURNOS[n]?.[semilla]) || '',
    };
  });
}

/** Tabla de una ronda: primero con puntaje (mayor a menor; a igual puntaje, mejor espresso; después el desempate del jurado);
 * después los que faltan, por turno. */
export function tabla(filas: Fila[]) {
  const con = filas.filter((f) => f.puntaje != null);
  const sin = filas.filter((f) => f.puntaje == null);
  con.sort(
    (x, y) =>
      Number(y.puntaje) - Number(x.puntaje) ||
      (y.espresso ?? 0) - (x.espresso ?? 0) ||
      y.desempate - x.desempate ||
      (x.puntuado_at || '').localeCompare(y.puntuado_at || ''),
  );
  sin.sort(
    (x, y) => ordenTurno(x.turnoRonda || '9').localeCompare(ordenTurno(y.turnoRonda || '9')) || (x.semilla ?? 99) - (y.semilla ?? 99) || x.orden - y.orden,
  );
  return [...con, ...sin];
}

/** Hay empate sin resolver justo en el corte (el último que pasa y el primero que queda afuera). */
export function empateEnCorte(orden: Fila[], pasan: number) {
  const a = orden[pasan - 1], b = orden[pasan];
  return !!(a && b && a.puntaje != null && b.puntaje != null && a.puntaje === b.puntaje && (a.espresso ?? 0) === (b.espresso ?? 0) && a.desempate === b.desempate);
}

/** Puntaje con un decimal y coma: 8,5. */
export const fPuntaje = (n: number | null) => (n == null ? '—' : n.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
