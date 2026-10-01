// Jurados del torneo: sesión, planillas y cálculo del puntaje de la ronda. Solo servidor.
import { db } from './supabase';
import { leer, COOKIE_JURADO } from './sesion';
import { estadoTorneo } from './torneo';
import { RONDAS, participantes, tabla } from './rondas';
import { resultado, itemsDe, type Evaluacion, type Valores } from './planilla';

export async function juradoActual() {
  const valor = await leer(COOKIE_JURADO);
  if (!valor) return null;
  const [n, version] = valor.split(':');
  const { data } = await db().from('jurados').select('n, clave_version').eq('n', Number(n)).maybeSingle();
  if (!data || String(data.clave_version) !== version) return null;
  return data.n as number;
}

type FilaEval = Evaluacion & { barista_id: string; ronda: number; updated_at: string };

export async function evaluaciones(filtro: { ronda?: number; barista?: string; jurado?: number } = {}) {
  let q = db().from('evaluaciones').select('barista_id, ronda, jurado, valores, comentario, updated_at');
  if (filtro.ronda) q = q.eq('ronda', filtro.ronda);
  if (filtro.barista) q = q.eq('barista_id', filtro.barista);
  if (filtro.jurado) q = q.eq('jurado', filtro.jurado);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []) as FilaEval[];
}

/** Lo que ve el jurado: la ronda en curso, sus participantes por turno y su propia planilla de cada uno. */
export async function vistaJurado(n: number) {
  const e = await estadoTorneo();
  const r = RONDAS.find((x) => x.fase === e.fase)!;
  const filas = tabla(participantes(r.n, e.baristas, e.puntajes.map((p) => ({ ...p, puntaje: null }))));
  const mias = await evaluaciones({ ronda: r.n, jurado: n });
  const de = new Map(mias.map((m) => [m.barista_id, m]));
  return {
    jurado: n,
    ronda: { n: r.n, titulo: r.titulo },
    items: itemsDe(r.n),
    baristas: filas.map((f) => ({ id: f.id, nombre: f.nombre, turno: f.turnoRonda, valores: de.get(f.id)?.valores || {}, comentario: de.get(f.id)?.comentario || '' })),
  };
}

/** Recalcula el puntaje oficial de un barista en una ronda si los 3 jurados ya completaron su planilla. */
export async function recalcular(baristaId: string, n: number) {
  const [evs, { data: p }] = await Promise.all([
    evaluaciones({ ronda: n, barista: baristaId }),
    db().from('puntajes').select('semilla, puntaje, espresso, desempate, descuento, puntuado_at').eq('barista_id', baristaId).eq('ronda', n).maybeSingle(),
  ]);
  const res = resultado(n, evs, (p?.descuento as number) || 0);
  if (!res) return null;
  const cambia = res.puntaje !== (p?.puntaje == null ? null : Number(p.puntaje));
  const { error } = await db().from('puntajes').upsert({
    barista_id: baristaId,
    ronda: n,
    semilla: p?.semilla ?? null,
    puntaje: res.puntaje,
    espresso: res.espresso,
    desempate: p?.desempate ?? 0,
    descuento: p?.descuento ?? 0,
    puntuado_at: cambia || !p?.puntuado_at ? new Date().toISOString() : p.puntuado_at,
  });
  if (error) throw error;
  return res;
}

/** Guarda la planilla de un jurado. Solo para la ronda en curso y sus participantes. */
export async function guardarEvaluacion(jurado: number, baristaId: string, n: number, valores: Valores, comentario: string) {
  const e = await estadoTorneo();
  const actual = RONDAS.find((r) => r.fase === e.fase)!.n;
  if (n !== actual) return 'Esa ronda no está en curso. Recargá la página.';
  if (!participantes(n, e.baristas, e.puntajes).some((f) => f.id === baristaId)) return 'Ese barista no compite en esta ronda.';
  const { error } = await db().from('evaluaciones').upsert({ barista_id: baristaId, ronda: n, jurado, valores, comentario, updated_at: new Date().toISOString() });
  if (error) throw error;
  await recalcular(baristaId, n);
  return null;
}

/** Cuántos jurados completaron la planilla de cada barista en cada ronda (para administración). */
export async function avanceJurados() {
  const evs = await evaluaciones();
  const n: Record<string, number> = {};
  for (const ev of evs) if (itemsDe(ev.ronda).every((i) => typeof ev.valores?.[i.k] === 'number')) n[`${ev.barista_id}:${ev.ronda}`] = (n[`${ev.barista_id}:${ev.ronda}`] || 0) + 1;
  return n;
}

/** Devolución para el barista: sus planillas de cada ronda en la que los 3 jurados ya puntuaron, sin nombres. */
export async function devolucion(baristaId: string) {
  const [evs, { data: ps }] = await Promise.all([
    evaluaciones({ barista: baristaId }),
    db().from('puntajes').select('ronda, puntaje, descuento').eq('barista_id', baristaId),
  ]);
  return RONDAS.map((r) => {
    const deRonda = evs.filter((e) => e.ronda === r.n).sort((a, b) => a.jurado - b.jurado);
    const p = (ps || []).find((x) => x.ronda === r.n);
    const res = resultado(r.n, deRonda, (p?.descuento as number) || 0);
    if (!res) return null;
    return {
      ronda: r.titulo,
      items: itemsDe(r.n),
      jurados: deRonda.map((e) => ({ n: e.jurado, valores: e.valores, comentario: e.comentario })),
      totales: res.totales,
      promedio: res.promedio,
      descuento: (p?.descuento as number) || 0,
      puntaje: p?.puntaje == null ? res.puntaje : Number(p.puntaje),
    };
  }).filter((x) => x != null);
}

/** Claves de los 3 jurados (solo administración). */
export async function accesosJurados() {
  const { data, error } = await db().from('jurados').select('n, clave').order('n');
  if (error) throw error;
  return (data || []).map((j) => ({ n: j.n as number, clave: (j.clave as string) || '' }));
}
export type AccesoJurado = Awaited<ReturnType<typeof accesosJurados>>[number];
