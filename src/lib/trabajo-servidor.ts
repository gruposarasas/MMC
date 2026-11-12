// Banco de trabajo AEHGA: sesiones, claves, CV y consultas. Solo servidor.
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { db } from './supabase';
import { leer, COOKIE_POSTULANTE, COOKIE_EMPRESA } from './sesion';
import { CV_MAX, edadDe, type Filtros } from './trabajo';

const scrypt = promisify(scryptCb) as (clave: string, sal: Buffer, largo: number) => Promise<Buffer>;

// ------------------------------------------------------------ claves
export async function hashClave(clave: string) {
  const sal = randomBytes(16);
  const h = await scrypt(clave, sal, 64);
  return `s1$${sal.toString('base64')}$${h.toString('base64')}`;
}

export async function claveCorrecta(clave: string, guardado: string) {
  const [v, sal, h] = guardado.split('$');
  if (v !== 's1' || !sal || !h) return false;
  const esperado = Buffer.from(h, 'base64');
  const calc = await scrypt(clave, Buffer.from(sal, 'base64'), esperado.length);
  return calc.length === esperado.length && timingSafeEqual(calc, esperado);
}

// ------------------------------------------------------------ sesiones
const COLS_POSTULANTE =
  'id, nombre, nacimiento, mail, whatsapp, direccion, localidad, departamento, puesto, puestos_extra, puesto_otro, puesto_actual, experiencia, disponibilidad, idiomas, movilidad, sobre_mi, cv_path, cv_tipo, visible, oculto, created_at, updated_at';

export type Postulante = {
  id: string; nombre: string; nacimiento: string; mail: string; whatsapp: string;
  direccion: string; localidad: string; departamento: string;
  puesto: string; puestos_extra: string[]; puesto_otro: string; puesto_actual: string;
  experiencia: number; disponibilidad: string[]; idiomas: string[]; movilidad: boolean; sobre_mi: string;
  cv_path: string | null; cv_tipo: string | null; visible: boolean; oculto: boolean; created_at: string; updated_at: string;
};

export type Empresa = { id: string; nombre: string; tipo: string; cuit: string; departamento: string; direccion: string; contacto: string; mail: string; whatsapp: string; oculta: boolean; created_at: string };
const COLS_EMPRESA = 'id, nombre, tipo, cuit, departamento, direccion, contacto, mail, whatsapp, oculta, created_at';

/** Valor de la cookie: "id:version". Una clave nueva (version + 1) cierra las sesiones abiertas. */
async function idDeCookie(nombre: typeof COOKIE_POSTULANTE | typeof COOKIE_EMPRESA) {
  const v = await leer(nombre);
  if (!v) return null;
  const [id, version] = v.split(':');
  return /^[0-9a-f-]{36}$/i.test(id) ? { id, version } : null;
}

export async function postulanteActual(): Promise<Postulante | null> {
  const c = await idDeCookie(COOKIE_POSTULANTE);
  if (!c) return null;
  const { data } = await db().from('tb_postulantes').select(`${COLS_POSTULANTE}, clave_version`).eq('id', c.id).maybeSingle();
  if (!data || String(data.clave_version) !== c.version) return null;
  return data as unknown as Postulante;
}

export async function empresaActual(): Promise<Empresa | null> {
  const c = await idDeCookie(COOKIE_EMPRESA);
  if (!c) return null;
  const { data } = await db().from('tb_empresas').select(`${COLS_EMPRESA}, clave_version`).eq('id', c.id).maybeSingle();
  if (!data || String(data.clave_version) !== c.version || data.oculta) return null;
  return data as unknown as Empresa;
}

// ------------------------------------------------------------ CV
function tipoArchivo(buf: Buffer): 'application/pdf' | 'image/jpeg' | 'image/png' | null {
  if (buf.subarray(0, 5).toString() === '%PDF-') return 'application/pdf';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  return null;
}
const EXT = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' } as const;

/** Sube el CV al bucket privado. Valida tipo (por el contenido, no por el nombre) y tamaño. */
export async function subirCv(postulanteId: string, archivo: File) {
  if (archivo.size > CV_MAX) throw new Error('El CV pesa más de 5 MB. Probá con un PDF más liviano o una foto más chica.');
  const buf = Buffer.from(await archivo.arrayBuffer());
  const tipo = tipoArchivo(buf);
  if (!tipo) throw new Error('El CV tiene que ser un PDF o una foto JPG o PNG.');
  const path = `${postulanteId}/cv-${randomBytes(6).toString('hex')}.${EXT[tipo]}`;
  const { error } = await db().storage.from('cvs').upload(path, buf, { contentType: tipo, upsert: false });
  if (error) throw new Error('No se pudo subir el CV. Probá de nuevo.');
  return { path, tipo };
}

export async function borrarCv(path: string | null) {
  if (path) await db().storage.from('cvs').remove([path]).catch(() => null);
}

/** Link temporal (2 minutos) para ver un CV. */
export async function linkCv(path: string) {
  const { data, error } = await db().storage.from('cvs').createSignedUrl(path, 120);
  if (error || !data) return null;
  return data.signedUrl;
}

// ------------------------------------------------------------ buscador de CVs
export const POR_PAGINA = 24;

/** Fecha de nacimiento límite para una edad (cumplida a hoy). */
function nacidoAntesDe(edad: number) {
  const h = new Date();
  return `${h.getFullYear() - edad}-${String(h.getMonth() + 1).padStart(2, '0')}-${String(h.getDate()).padStart(2, '0')}`;
}

/** Escapa lo que escribe la empresa para usarlo en un filtro de PostgREST. */
const paraBuscar = (q: string) => q.replace(/[%_,()*\\:."']/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);

export async function buscarPostulantes(f: Filtros) {
  let q = db()
    .from('tb_postulantes')
    .select('id, nombre, nacimiento, mail, whatsapp, direccion, localidad, departamento, puesto, puestos_extra, puesto_otro, puesto_actual, experiencia, disponibilidad, idiomas, movilidad, sobre_mi, cv_path, updated_at', { count: 'exact' })
    .eq('visible', true)
    .eq('oculto', false);
  if (f.dep) q = q.eq('departamento', f.dep);
  if (f.puesto) q = q.or(`puesto.eq.${f.puesto},puestos_extra.cs.{${f.puesto}}`);
  if (f.edadMin) q = q.lte('nacimiento', nacidoAntesDe(+f.edadMin));
  if (f.edadMax) {
    // tiene a lo sumo edadMax años: nació después del día en que cumpliría edadMax + 1
    q = q.gt('nacimiento', nacidoAntesDe(+f.edadMax + 1));
  }
  if (f.exp) q = q.gte('experiencia', +f.exp);
  if (f.disp) q = q.contains('disponibilidad', [f.disp]);
  if (f.idioma) q = q.contains('idiomas', [f.idioma]);
  if (f.mov) q = q.eq('movilidad', true);
  const texto = paraBuscar(f.q);
  if (texto) {
    for (const palabra of texto.split(' ').slice(0, 4)) {
      const p = `%${palabra}%`;
      q = q.or(`nombre.ilike.${p},localidad.ilike.${p},direccion.ilike.${p},puesto_actual.ilike.${p},puesto_otro.ilike.${p},sobre_mi.ilike.${p}`);
    }
  }
  const desde = (f.pag - 1) * POR_PAGINA;
  const { data, error, count } = await q.order('updated_at', { ascending: false }).range(desde, desde + POR_PAGINA - 1);
  if (error) throw error;
  return {
    total: count ?? 0,
    filas: (data || []).map((p) => ({ ...p, edad: edadDe(p.nacimiento as string) })),
  };
}
export type Resultado = Awaited<ReturnType<typeof buscarPostulantes>>['filas'][number];

// ------------------------------------------------------------ vacantes
const COLS_VACANTE = 'id, empresa_id, puesto, titulo, descripcion, departamento, jornada, sueldo, abierta, oculta, created_at, updated_at';
export type Vacante = {
  id: string; empresa_id: string; puesto: string; titulo: string; descripcion: string; departamento: string; jornada: string; sueldo: string;
  abierta: boolean; oculta: boolean; created_at: string; updated_at: string;
  empresa?: { nombre: string; tipo: string; departamento: string } | null;
};

/** Vacantes abiertas para el público, con filtro opcional por puesto y departamento. */
export async function vacantesAbiertas(f: { puesto?: string; dep?: string } = {}, limite = 200) {
  let q = db().from('tb_vacantes').select(`${COLS_VACANTE}, empresa:tb_empresas!inner(nombre, tipo, departamento, oculta)`).eq('abierta', true).eq('oculta', false).eq('empresa.oculta', false);
  if (f.puesto) q = q.eq('puesto', f.puesto);
  if (f.dep) q = q.eq('departamento', f.dep);
  const { data, error } = await q.order('created_at', { ascending: false }).limit(limite);
  if (error) throw error;
  return (data || []) as unknown as Vacante[];
}

export async function vacante(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await db().from('tb_vacantes').select(`${COLS_VACANTE}, empresa:tb_empresas(nombre, tipo, departamento, oculta)`).eq('id', id).maybeSingle();
  return (data as unknown as (Vacante & { empresa: { oculta: boolean } | null }) | null) ?? null;
}

/** Vacantes de una empresa con la cantidad de postulantes. */
export async function vacantesDeEmpresa(empresaId: string) {
  const { data, error } = await db().from('tb_vacantes').select(`${COLS_VACANTE}, tb_postulaciones(estado)`).eq('empresa_id', empresaId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((v) => {
    const ps = (v.tb_postulaciones as { estado: string }[]) || [];
    return { ...(v as unknown as Vacante), postulantes: ps.length, nuevas: ps.filter((p) => p.estado === 'nueva').length };
  });
}

/** Postulantes de una vacante (para la empresa dueña). */
export async function postulantesDeVacante(vacanteId: string) {
  const { data, error } = await db()
    .from('tb_postulaciones')
    .select('estado, mensaje, created_at, p:tb_postulantes(id, nombre, nacimiento, mail, whatsapp, direccion, localidad, departamento, puesto, puesto_otro, puesto_actual, experiencia, disponibilidad, idiomas, movilidad, sobre_mi, cv_path, oculto)')
    .eq('vacante_id', vacanteId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || [])
    .filter((x) => x.p && !(x.p as unknown as { oculto: boolean }).oculto)
    .map((x) => {
      const p = x.p as unknown as Postulante;
      return { estado: x.estado as string, mensaje: x.mensaje as string, cuando: x.created_at as string, p: { ...p, edad: edadDe(p.nacimiento) } };
    });
}

/** Postulaciones de un postulante, con la vacante y la empresa. */
export async function postulacionesDe(postulanteId: string) {
  const { data, error } = await db()
    .from('tb_postulaciones')
    .select('estado, created_at, v:tb_vacantes(id, titulo, puesto, departamento, abierta, empresa:tb_empresas(nombre))')
    .eq('postulante_id', postulanteId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((x) => ({ estado: x.estado as string, cuando: x.created_at as string, v: x.v as unknown as { id: string; titulo: string; puesto: string; departamento: string; abierta: boolean; empresa: { nombre: string } | null } | null }));
}

// ------------------------------------------------------------ administración
export async function resumenTrabajo() {
  const base = (tabla: string) => db().from(tabla).select('*', { count: 'exact', head: true });
  type Q = ReturnType<typeof base>;
  const n = async (tabla: string, filtro?: (q: Q) => Q) => {
    const { count } = await (filtro ? filtro(base(tabla)) : base(tabla));
    return count ?? 0;
  };
  const [postulantes, conCv, empresas, vacantes, abiertas, postulaciones, vistas] = await Promise.all([
    n('tb_postulantes'),
    n('tb_postulantes', (q) => q.not('cv_path', 'is', null)),
    n('tb_empresas'),
    n('tb_vacantes'),
    n('tb_vacantes', (q) => q.eq('abierta', true)),
    n('tb_postulaciones'),
    n('tb_vistas_cv'),
  ]);
  return { postulantes, conCv, empresas, vacantes, abiertas, postulaciones, vistas };
}

export async function listasAdminTrabajo() {
  const [p, e, v] = await Promise.all([
    db().from('tb_postulantes').select('id, nombre, mail, whatsapp, departamento, puesto, cv_path, visible, oculto, created_at').order('created_at', { ascending: false }).limit(500),
    db().from('tb_empresas').select('id, nombre, tipo, cuit, departamento, contacto, mail, whatsapp, oculta, created_at').order('created_at', { ascending: false }).limit(500),
    db().from('tb_vacantes').select('id, titulo, puesto, departamento, abierta, oculta, created_at, empresa:tb_empresas(nombre)').order('created_at', { ascending: false }).limit(500),
  ]);
  return {
    postulantes: p.data || [],
    empresas: e.data || [],
    vacantes: ((v.data || []) as unknown as { id: string; titulo: string; puesto: string; departamento: string; abierta: boolean; oculta: boolean; created_at: string; empresa: { nombre: string } | null }[]),
  };
}
