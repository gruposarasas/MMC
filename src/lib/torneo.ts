// Torneo de baristas: acceso a datos. Solo servidor.
import { db } from './supabase';
import { RONDAS, participantes, tabla, empateEnCorte, type Barista, type Puntaje, type Fase } from './rondas';

export type Pantalla = 'auto' | Fase;
export type EstadoTorneo = { fase: Fase; pantalla: Pantalla; baristas: Barista[]; puntajes: Puntaje[] };

export async function estadoTorneo(): Promise<EstadoTorneo> {
  const [t, b, p] = await Promise.all([
    db().from('torneo').select('fase, pantalla').eq('id', 1).maybeSingle(),
    db().from('baristas').select('id, nombre, cafeteria, turno, orden, created_at').order('orden').order('created_at'),
    db().from('puntajes').select('barista_id, ronda, semilla, puntaje, espresso, desempate, descuento, puntuado_at'),
  ]);
  if (b.error) throw b.error;
  if (p.error) throw p.error;
  return {
    fase: (t.data?.fase as Fase) || 'r1',
    pantalla: (t.data?.pantalla as Pantalla) || 'auto',
    baristas: (b.data || []) as Barista[],
    puntajes: (p.data || []).map((x) => ({ ...x, puntaje: x.puntaje == null ? null : Number(x.puntaje), espresso: x.espresso == null ? null : Number(x.espresso) })) as Puntaje[],
  };
}

/** Guarda el puntaje de un barista en una ronda en la que compite. */
export async function puntuar(baristaId: string, n: number, puntaje: number | null, espresso: number | null, desempate: number) {
  const e = await estadoTorneo();
  const actual = RONDAS.find((r) => r.fase === e.fase)!.n;
  if (n > actual) return 'Esa ronda todavía no empezó.';
  if (n < actual) return 'Esa ronda ya está cerrada. Para corregirla, volvé a esa ronda.';
  const previo = e.puntajes.find((p) => p.barista_id === baristaId && p.ronda === n);
  if (n > 1 && !previo) return 'Ese barista no compite en esta ronda.';
  if (n === 1 && !e.baristas.some((b) => b.id === baristaId)) return 'Ese barista no existe.';
  const cambia = puntaje !== (previo?.puntaje ?? null);
  const fila = {
    barista_id: baristaId,
    ronda: n,
    semilla: previo?.semilla ?? null,
    puntaje,
    espresso,
    desempate,
    // La hora de puntuación sirve para desempatar y para resaltarlo en la pantalla.
    puntuado_at: puntaje == null ? null : cambia ? new Date().toISOString() : previo?.puntuado_at ?? new Date().toISOString(),
  };
  const { error } = await db().from('puntajes').upsert(fila);
  if (error) throw error;
  return null;
}

/** Cierra la ronda actual: los mejores pasan a la siguiente con su puesto como semilla. */
export async function cerrarRonda() {
  const e = await estadoTorneo();
  const i = RONDAS.findIndex((r) => r.fase === e.fase);
  const r = RONDAS[i], sig = RONDAS[i + 1];
  if (!sig) return 'La final no se cierra: el campeón sale de los puntajes de la final.';
  const orden = tabla(participantes(r.n, e.baristas, e.puntajes)).filter((f) => f.puntaje != null);
  if (orden.length < r.pasan) return `Para cerrar la ${r.titulo} hacen falta ${r.pasan} baristas con puntaje: hay ${orden.length}.`;
  if (empateEnCorte(orden, r.pasan)) return `Hay un empate en el puesto ${r.pasan}, justo en el corte. Cargá el puntaje del espresso; si también empatan, usá "Desempate" antes de cerrar.`;
  const filas = orden.slice(0, r.pasan).map((f, k) => ({ barista_id: f.id, ronda: sig.n, semilla: k + 1, puntaje: null, espresso: null, desempate: 0, puntuado_at: null }));
  await db().from('puntajes').delete().gte('ronda', sig.n);
  const { error } = await db().from('puntajes').insert(filas);
  if (error) throw error;
  await db().from('torneo').update({ fase: sig.fase, updated_at: new Date().toISOString() }).eq('id', 1);
  return null;
}

/** Vuelve a una ronda anterior: borra las rondas posteriores y sus puntajes. */
export async function volverARonda(fase: Fase) {
  const r = RONDAS.find((x) => x.fase === fase);
  if (!r) return 'Ronda inválida.';
  await db().from('puntajes').delete().gt('ronda', r.n);
  await db().from('torneo').update({ fase, updated_at: new Date().toISOString() }).eq('id', 1);
  return null;
}
