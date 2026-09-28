// Consultas a la base. Solo servidor, siempre con la service role.
// Nunca devolver codigo ni clave a las pantallas del visitante.
import { db } from './supabase';
import { leer, COOKIE_VISITANTE, COOKIE_MARCA, COOKIE_ADMIN } from './sesion';

export const COLS_PUBLICAS = 'id, nombre, stand, beneficio, condiciones, creditos, logo_path, emblema, vence, sucursales';

export type MarcaPublica = {
  id: string;
  nombre: string;
  stand: string;
  beneficio: string;
  condiciones: string;
  creditos: number;
  logo_path: string | null;
  emblema: string;
  vence: string;
  sucursales: string;
};

export type Marca = MarcaPublica & {
  orden: number;
  codigo: string;
  clave: string;
  clave_version: number;
  activa: boolean;
  responsable: string;
  tel_responsable: string;
  enviado_at: string | null;
  eliminada: boolean;
};

export type Visitante = {
  id: string;
  nombre: string;
  nacimiento: string;
  mail: string | null;
  whatsapp: string | null;
  novedades: boolean;
  created_at: string;
};

export type Canje = {
  id: string;
  numero: number;
  visitante_id: string;
  marca_id: string;
  beneficio: string;
  post_evento: boolean;
  created_at: string;
};

/** Trae todas las filas, de a 1000 (el límite de la API de Supabase). */
async function todo<T>(consulta: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const filas: T[] = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await consulta(desde, desde + 999);
    if (error) throw error;
    filas.push(...(data || []));
    if (!data || data.length < 1000) return filas;
  }
}

// ------------------------------------------------------------ visitante
export async function visitanteActual() {
  const id = await leer(COOKIE_VISITANTE);
  if (!id) return null;
  const { data } = await db().from('visitantes').select('id, nombre, mail, whatsapp').eq('id', id).maybeSingle();
  return data as Pick<Visitante, 'id' | 'nombre' | 'mail' | 'whatsapp'> | null;
}

export async function billetera(visitanteId: string) {
  const [marcas, canjes] = await Promise.all([
    db()
      .from('marcas')
      .select(COLS_PUBLICAS)
      .eq('activa', true)
      .eq('eliminada', false)
      .neq('beneficio', '')
      .order('orden'),
    db()
      .from('canjes')
      .select('id, numero, marca_id, beneficio, created_at, marcas(nombre)')
      .eq('visitante_id', visitanteId)
      .order('created_at', { ascending: false }),
  ]);
  if (marcas.error) throw marcas.error;
  if (canjes.error) throw canjes.error;
  const usados = new Map<string, number>();
  for (const c of canjes.data || []) usados.set(c.marca_id, (usados.get(c.marca_id) || 0) + 1);
  return {
    marcas: (marcas.data || []) as MarcaPublica[],
    usados,
    canjes: (canjes.data || []).map((c) => ({
      id: c.id as string,
      numero: c.numero as number,
      beneficio: c.beneficio as string,
      created_at: c.created_at as string,
      marca: ((c.marcas as unknown as { nombre: string } | null)?.nombre) || '',
    })),
  };
}

export async function marcaParaCanje(visitanteId: string, marcaId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(marcaId)) return null;
  const { data: m } = await db()
    .from('marcas')
    .select(COLS_PUBLICAS)
    .eq('id', marcaId)
    .eq('activa', true)
    .eq('eliminada', false)
    .neq('beneficio', '')
    .maybeSingle();
  if (!m) return null;
  const [{ count }, { data: it }] = await Promise.all([
    db().from('canjes').select('id', { count: 'exact', head: true }).eq('visitante_id', visitanteId).eq('marca_id', marcaId),
    db().from('intentos_canje').select('bloqueado_hasta').eq('visitante_id', visitanteId).eq('marca_id', marcaId).maybeSingle(),
  ]);
  const hasta = it?.bloqueado_hasta ? new Date(it.bloqueado_hasta).getTime() : 0;
  return {
    marca: m as MarcaPublica,
    usados: count || 0,
    bloqueoSeg: hasta > Date.now() ? Math.ceil((hasta - Date.now()) / 1000) : 0,
  };
}

// ------------------------------------------------------------ marca
export async function marcaActual() {
  const valor = await leer(COOKIE_MARCA);
  if (!valor) return null;
  const [id, version] = valor.split(':');
  const { data } = await db().from('marcas').select('*').eq('id', id).maybeSingle();
  const m = data as Marca | null;
  if (!m || m.eliminada || String(m.clave_version) !== version) return null;
  return m;
}

export async function canjesDeMarca(marcaId: string) {
  const filas = await todo((d, h) =>
    db()
      .from('canjes')
      .select('id, numero, post_evento, created_at, visitantes(nombre)')
      .eq('marca_id', marcaId)
      .order('created_at', { ascending: false })
      .range(d, h),
  );
  return filas.map((c) => ({
    id: c.id as string,
    numero: c.numero as number,
    post_evento: c.post_evento as boolean,
    created_at: c.created_at as string,
    visitante: ((c.visitantes as unknown as { nombre: string } | null)?.nombre) || '',
  }));
}

// ------------------------------------------------------------ administración
export async function esAdmin() {
  return (await leer(COOKIE_ADMIN)) === 'ok';
}

export async function todasLasMarcas() {
  const { data, error } = await db().from('marcas').select('*').order('orden').order('created_at');
  if (error) throw error;
  return (data || []) as Marca[];
}

export async function todosLosCanjes() {
  return (await todo((d, h) =>
    db().from('canjes').select('*').order('created_at', { ascending: false }).range(d, h),
  )) as Canje[];
}

export async function todosLosVisitantes() {
  return (await todo((d, h) =>
    db().from('visitantes').select('id, nombre, nacimiento, mail, whatsapp, novedades, created_at').order('created_at', { ascending: false }).range(d, h),
  )) as Visitante[];
}

export async function resumenAdmin() {
  const { data, error } = await db().rpc('resumen_admin');
  if (error) throw error;
  return data as {
    visitantes: number;
    canjes: number;
    con_canje: number;
    post_evento: number;
    ranking: { id: string; nombre: string; canjes: number }[];
  };
}
