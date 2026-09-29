// Torneo de baristas: acceso a datos. Solo servidor.
import { db } from './supabase';
import { LLAVE, clasificacion, recalcular, type Barista, type Partido } from './llaves';

export type Pantalla = 'auto' | 'clasificacion' | 'llaves';
export type EstadoTorneo = { fase: 'clasificacion' | 'playoff'; pantalla: Pantalla; baristas: Barista[]; partidos: Partido[] };

const num = (v: unknown) => (v == null ? null : Number(v));

export async function estadoTorneo(): Promise<EstadoTorneo> {
  const [t, b, p] = await Promise.all([
    db().from('torneo').select('fase, pantalla').eq('id', 1).maybeSingle(),
    db().from('baristas').select('*').order('created_at'),
    db().from('partidos').select('id, a, b, puntaje_a, puntaje_b, ganador'),
  ]);
  if (b.error) throw b.error;
  return {
    fase: (t.data?.fase as EstadoTorneo['fase']) || 'clasificacion',
    pantalla: (t.data?.pantalla as Pantalla) || 'auto',
    baristas: (b.data || []).map((x) => ({ ...x, puntaje: num(x.puntaje) })) as Barista[],
    partidos: (p.data || []).map((x) => ({ ...x, puntaje_a: num(x.puntaje_a), puntaje_b: num(x.puntaje_b) })) as Partido[],
  };
}

async function guardarPartidos(ps: Partido[]) {
  if (!ps.length) return;
  const ahora = new Date().toISOString();
  const { error } = await db().from('partidos').upsert(ps.map((p) => ({ ...p, updated_at: ahora })));
  if (error) throw error;
}

/** Arma los octavos con los 16 primeros de la clasificación y pasa a la fase de playoff. */
export async function generarLlaves() {
  const e = await estadoTorneo();
  const orden = clasificacion(e.baristas).filter((b) => b.puntaje != null);
  if (orden.length < 16) return `Hacen falta 16 baristas con puntaje: hay ${orden.length}.`;
  const vacios = new Map<string, Partido>();
  for (const def of LLAVE) {
    const [s1, s2] = def.semillas || [0, 0];
    vacios.set(def.id, { id: def.id, a: def.semillas ? orden[s1 - 1].id : null, b: def.semillas ? orden[s2 - 1].id : null, puntaje_a: null, puntaje_b: null, ganador: null });
  }
  await guardarPartidos([...vacios.values()]);
  await db().from('torneo').update({ fase: 'playoff', updated_at: new Date().toISOString() }).eq('id', 1);
  return null;
}

export async function volverAClasificacion() {
  await db().from('partidos').delete().neq('id', '');
  await db().from('torneo').update({ fase: 'clasificacion', updated_at: new Date().toISOString() }).eq('id', 1);
}

/** Carga el resultado de un partido. Si hay puntajes distintos y no se eligió ganador, gana el mayor. */
export async function cargarResultado(id: string, puntajeA: number | null, puntajeB: number | null, ganador: string | null | undefined) {
  const e = await estadoTorneo();
  const mapa = new Map(e.partidos.map((p) => [p.id, p]));
  const p = mapa.get(id);
  if (!p) return 'Ese partido no existe todavía.';
  if (!p.a || !p.b) return 'Todavía no están definidos los dos baristas de este partido.';
  let g = ganador === undefined ? p.ganador : ganador;
  if (ganador === undefined && puntajeA != null && puntajeB != null && puntajeA !== puntajeB) g = puntajeA > puntajeB ? p.a : p.b;
  if (g && g !== p.a && g !== p.b) return 'El ganador tiene que ser uno de los dos baristas.';
  const nuevo = { ...p, puntaje_a: puntajeA, puntaje_b: puntajeB, ganador: g };
  mapa.set(id, nuevo);
  await guardarPartidos([nuevo, ...recalcular(mapa)]);
  return null;
}
