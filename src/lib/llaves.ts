// Torneo de baristas: reglas puras (se usan en el servidor y en las pantallas).

export type Barista = {
  id: string;
  nombre: string;
  cafeteria: string;
  puntaje: number | null;
  puntuado_at: string | null;
  desempate: number;
  created_at: string;
};

export type Partido = {
  id: string;
  a: string | null;
  b: string | null;
  puntaje_a: number | null;
  puntaje_b: number | null;
  ganador: string | null;
};

export type Ronda = 'octavos' | 'cuartos' | 'semis' | 'tercero' | 'final';

/**
 * Llave como en el Mundial: 1 y 2 quedan en mitades opuestas y solo se cruzan en la final.
 * Octavos por semilla; el resto toma ganadores (o perdedores, para el tercer puesto).
 */
export const LLAVE: { id: string; ronda: Ronda; semillas?: [number, number]; de?: [string, string]; perdedores?: boolean }[] = [
  { id: 'O1', ronda: 'octavos', semillas: [1, 16] },
  { id: 'O2', ronda: 'octavos', semillas: [8, 9] },
  { id: 'O3', ronda: 'octavos', semillas: [5, 12] },
  { id: 'O4', ronda: 'octavos', semillas: [4, 13] },
  { id: 'O5', ronda: 'octavos', semillas: [3, 14] },
  { id: 'O6', ronda: 'octavos', semillas: [6, 11] },
  { id: 'O7', ronda: 'octavos', semillas: [7, 10] },
  { id: 'O8', ronda: 'octavos', semillas: [2, 15] },
  { id: 'C1', ronda: 'cuartos', de: ['O1', 'O2'] },
  { id: 'C2', ronda: 'cuartos', de: ['O3', 'O4'] },
  { id: 'C3', ronda: 'cuartos', de: ['O5', 'O6'] },
  { id: 'C4', ronda: 'cuartos', de: ['O7', 'O8'] },
  { id: 'S1', ronda: 'semis', de: ['C1', 'C2'] },
  { id: 'S2', ronda: 'semis', de: ['C3', 'C4'] },
  { id: 'T', ronda: 'tercero', de: ['S1', 'S2'], perdedores: true },
  { id: 'F', ronda: 'final', de: ['S1', 'S2'] },
];

export const NOMBRE_RONDA: Record<Ronda, string> = {
  octavos: 'Octavos de final',
  cuartos: 'Cuartos de final',
  semis: 'Semifinales',
  tercero: 'Tercer puesto',
  final: 'Final',
};

/** Clasificación: primero los que tienen puntaje (mayor a menor, desempate, quién compitió antes); después los que faltan. */
export function clasificacion(bs: Barista[]) {
  const con = bs.filter((b) => b.puntaje != null);
  const sin = bs.filter((b) => b.puntaje == null);
  con.sort(
    (x, y) =>
      Number(y.puntaje) - Number(x.puntaje) ||
      y.desempate - x.desempate ||
      (x.puntuado_at || '').localeCompare(y.puntuado_at || ''),
  );
  sin.sort((x, y) => x.created_at.localeCompare(y.created_at) || x.nombre.localeCompare(y.nombre));
  return [...con, ...sin];
}

export const perdedor = (p: Partido) => (p.ganador ? (p.ganador === p.a ? p.b : p.a) : null);

/**
 * Recalcula quién juega cada partido según los resultados anteriores.
 * Si cambian los participantes de un partido, se borran su resultado y su ganador.
 */
export function recalcular(actual: Map<string, Partido>): Partido[] {
  const cambiados: Partido[] = [];
  for (const def of LLAVE) {
    if (!def.de) continue;
    const p = actual.get(def.id) || { id: def.id, a: null, b: null, puntaje_a: null, puntaje_b: null, ganador: null };
    const [x, y] = def.de.map((id) => actual.get(id));
    const a = x ? (def.perdedores ? perdedor(x) : x.ganador) : null;
    const b = y ? (def.perdedores ? perdedor(y) : y.ganador) : null;
    let nuevo = p;
    if (p.a !== a || p.b !== b) nuevo = { ...p, a, b, puntaje_a: null, puntaje_b: null, ganador: null };
    else if (p.ganador && p.ganador !== a && p.ganador !== b) nuevo = { ...p, ganador: null };
    if (nuevo !== p || !actual.has(def.id)) {
      actual.set(def.id, nuevo);
      cambiados.push(nuevo);
    }
  }
  return cambiados;
}
