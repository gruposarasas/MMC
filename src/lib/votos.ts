// Votaciones del público (stand más lindo y barista favorito) y perfiles de los baristas. Solo servidor.
import { db } from './supabase';
import { todo } from './datos';
import { leer, COOKIE_BARISTA } from './sesion';
import { urlLogo } from './config';

// ------------------------------------------------------------ stand más lindo
export type MarcaVoto = { id: string; nombre: string; stand: string; logo: string; emblema: string };

/** Marcas que se pueden votar: las que administración marcó para la votación del stand más lindo (y no eliminadas). */
export async function marcasParaVotar(): Promise<MarcaVoto[]> {
  const { data, error } = await db().from('marcas').select('id, nombre, stand, logo_path, emblema').eq('eliminada', false).eq('en_votacion', true).order('orden').order('nombre');
  if (error) throw error;
  return (data || []).map((m) => ({ id: m.id, nombre: m.nombre, stand: m.stand, logo: urlLogo(m.logo_path), emblema: m.emblema }));
}

export async function votoStandDe(visitanteId: string) {
  const { data } = await db().from('votos_stand').select('marca_id').eq('visitante_id', visitanteId).maybeSingle();
  return (data?.marca_id as string) || null;
}

/** Cuenta los votos por id. */
async function contar(tabla: 'votos_stand' | 'votos_barista', col: 'marca_id' | 'barista_id') {
  const filas = await todo((d, h) => db().from(tabla).select(col).order('visitante_id').range(d, h));
  const n = new Map<string, number>();
  for (const f of filas as Record<string, string>[]) n.set(f[col], (n.get(f[col]) || 0) + 1);
  return { n, total: filas.length };
}

/** Ranking del stand más lindo (todas las marcas, de más a menos votos). */
export async function rankingStand() {
  const [ms, { n, total }] = await Promise.all([marcasParaVotar(), contar('votos_stand', 'marca_id')]);
  const filas = ms.map((m) => ({ ...m, votos: n.get(m.id) || 0 })).sort((a, b) => b.votos - a.votos || a.nombre.localeCompare(b.nombre));
  return { filas, total, ganadores: ganadores(filas) };
}

/** Los que tienen más votos (puede haber empate). Nadie gana con cero votos. */
function ganadores<T extends { votos: number }>(filas: T[]) {
  const max = filas[0]?.votos || 0;
  return max ? filas.filter((f) => f.votos === max) : [];
}

// ------------------------------------------------------------ baristas
export type PerfilBarista = {
  id: string;
  nombre: string;
  cafeteria: string;
  foto: string;
  historia: string;
  hobby: string;
  experiencia: string;
  por_que: string;
};

const COLS_PERFIL = 'id, nombre, cafeteria, foto_path, historia, hobby, experiencia, por_que';
const perfil = (b: Record<string, unknown>): PerfilBarista => ({
  id: b.id as string,
  nombre: b.nombre as string,
  cafeteria: (b.cafeteria as string) || '',
  foto: urlLogo(b.foto_path as string | null),
  historia: (b.historia as string) || '',
  hobby: (b.hobby as string) || '',
  experiencia: (b.experiencia as string) || '',
  por_que: (b.por_que as string) || '',
});

/** Todos los baristas del torneo, con su perfil público, en orden alfabético. */
export async function perfilesBaristas(): Promise<PerfilBarista[]> {
  const { data, error } = await db().from('baristas').select(COLS_PERFIL).order('nombre');
  if (error) throw error;
  return (data || []).map(perfil);
}

export async function perfilBarista(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await db().from('baristas').select(COLS_PERFIL).eq('id', id).maybeSingle();
  return data ? perfil(data) : null;
}

export async function votoBaristaDe(visitanteId: string) {
  const { data } = await db().from('votos_barista').select('barista_id').eq('visitante_id', visitanteId).maybeSingle();
  return (data?.barista_id as string) || null;
}

/** Cantidad de mensajes de aliento visibles que recibió cada barista. */
export async function cantidadMensajes() {
  const filas = await todo((d, h) => db().from('mensajes_barista').select('barista_id').eq('oculto', false).order('id').range(d, h));
  const n = new Map<string, number>();
  for (const f of filas as { barista_id: string }[]) n.set(f.barista_id, (n.get(f.barista_id) || 0) + 1);
  return n;
}

/** Ranking del barista favorito del público. */
export async function rankingBarista() {
  const [bs, { n, total }] = await Promise.all([perfilesBaristas(), contar('votos_barista', 'barista_id')]);
  const filas = bs.map((b) => ({ id: b.id, nombre: b.nombre, cafeteria: b.cafeteria, foto: b.foto, votos: n.get(b.id) || 0 })).sort((a, b) => b.votos - a.votos || a.nombre.localeCompare(b.nombre));
  return { filas, total, ganadores: ganadores(filas) };
}

/** Mensajes de un barista (para su panel) o de todos (para administración). */
export async function mensajes(baristaId?: string, conOcultos = false) {
  let q = db().from('mensajes_barista').select('id, barista_id, texto, oculto, created_at, visitantes(nombre), baristas(nombre)').order('created_at', { ascending: false }).limit(1000);
  if (baristaId) q = q.eq('barista_id', baristaId);
  if (!conOcultos) q = q.eq('oculto', false);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map((m) => ({
    id: m.id as number,
    baristaId: m.barista_id as string,
    barista: ((m.baristas as unknown as { nombre: string } | null)?.nombre) || '',
    de: ((m.visitantes as unknown as { nombre: string } | null)?.nombre) || '',
    texto: m.texto as string,
    oculto: m.oculto as boolean,
    cuando: m.created_at as string,
  }));
}

// ------------------------------------------------------------ sesión del barista
export async function baristaActual() {
  const valor = await leer(COOKIE_BARISTA);
  if (!valor) return null;
  const [id, version] = valor.split(':');
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await db().from('baristas').select(`${COLS_PERFIL}, clave_version, perfil_at`).eq('id', id).maybeSingle();
  if (!data || String(data.clave_version) !== version) return null;
  return { ...perfil(data), perfil_at: data.perfil_at as string | null };
}

/** Accesos de los baristas para administración (incluye la clave: nunca mandarlo a pantallas públicas). */
export async function accesosBaristas() {
  const { data, error } = await db().from('baristas').select('id, nombre, cafeteria, clave, tel, foto_path, historia, por_que, perfil_at').order('orden').order('created_at');
  if (error) throw error;
  return (data || []).map((b) => ({
    id: b.id as string,
    nombre: b.nombre as string,
    clave: (b.clave as string) || '',
    tel: (b.tel as string) || '',
    foto: urlLogo(b.foto_path as string | null),
    completo: !!(b.historia && b.por_que),
    perfil_at: b.perfil_at as string | null,
  }));
}
export type AccesoBarista = Awaited<ReturnType<typeof accesosBaristas>>[number];
