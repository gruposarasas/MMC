// Banco de trabajo AEHGA: listas fijas y validaciones. Las usan los formularios y el servidor.

export const DEPARTAMENTOS = [
  'Capital', 'Godoy Cruz', 'Guaymallén', 'Las Heras', 'Luján de Cuyo', 'Maipú', 'Lavalle', 'San Martín', 'Junín',
  'Rivadavia', 'Santa Rosa', 'La Paz', 'Tunuyán', 'Tupungato', 'San Carlos', 'San Rafael', 'General Alvear', 'Malargüe',
  'Otra provincia',
] as const;

/** Puestos de gastronomía y hotelería (clave → nombre). */
export const PUESTOS: [string, string][] = [
  ['mozo', 'Mozo/a · Camarero/a'],
  ['cocinero', 'Cocinero/a'],
  ['ayudante_cocina', 'Ayudante de cocina'],
  ['jefe_cocina', 'Jefe/a de cocina · Chef'],
  ['pastelero', 'Pastelero/a · Panadero/a'],
  ['parrillero', 'Parrillero/a · Pizzero/a'],
  ['bachero', 'Bachero/a'],
  ['barista', 'Barista'],
  ['bartender', 'Bartender · Barman'],
  ['sommelier', 'Sommelier'],
  ['cajero', 'Cajero/a'],
  ['recepcionista', 'Recepcionista · Front desk'],
  ['conserje', 'Conserje · Botones'],
  ['mucama', 'Mucama · Housekeeping'],
  ['ama_llaves', 'Ama de llaves · Gobernanta'],
  ['encargado', 'Encargado/a · Jefe/a de salón'],
  ['gerente', 'Gerente · Administración'],
  ['eventos', 'Eventos · Banquetes'],
  ['delivery', 'Delivery · Cadete'],
  ['mantenimiento', 'Mantenimiento'],
  ['limpieza', 'Limpieza'],
  ['seguridad', 'Seguridad'],
  ['guia', 'Guía de turismo · Enoturismo'],
  ['ventas', 'Ventas · Reservas · Marketing'],
  ['otro', 'Otro'],
];
export const nombrePuesto = (k: string) => PUESTOS.find((p) => p[0] === k)?.[1] ?? k;

export const DISPONIBILIDAD: [string, string][] = [
  ['completa', 'Jornada completa'],
  ['media', 'Media jornada'],
  ['noche', 'Turno noche'],
  ['finde', 'Fines de semana'],
  ['temporada', 'Temporada'],
  ['eventos', 'Eventos'],
];
export const nombreDisp = (k: string) => DISPONIBILIDAD.find((p) => p[0] === k)?.[1] ?? k;

/** Jornada de una vacante. */
export const JORNADAS: [string, string][] = DISPONIBILIDAD;

export const IDIOMAS: [string, string][] = [
  ['ingles', 'Inglés'],
  ['portugues', 'Portugués'],
  ['frances', 'Francés'],
  ['italiano', 'Italiano'],
  ['aleman', 'Alemán'],
];
export const nombreIdioma = (k: string) => IDIOMAS.find((p) => p[0] === k)?.[1] ?? k;

export const TIPOS_EMPRESA: [string, string][] = [
  ['hotel', 'Hotel · Hospedaje'],
  ['restaurante', 'Restaurante'],
  ['bar', 'Bar'],
  ['cafeteria', 'Cafetería'],
  ['bodega', 'Bodega'],
  ['catering', 'Catering · Eventos'],
  ['otro', 'Otro'],
];
export const nombreTipo = (k: string) => TIPOS_EMPRESA.find((p) => p[0] === k)?.[1] ?? k;

export const ESTADOS_POSTULACION: [string, string][] = [
  ['nueva', 'Nueva'],
  ['vista', 'Vista'],
  ['contactado', 'Contactado'],
  ['descartado', 'Descartado'],
];

export const CV_TIPOS = ['application/pdf', 'image/jpeg', 'image/png'] as const;
export const CV_MAX = 5 * 1024 * 1024;

export const MAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
export const soloDigitos = (s: string) => (s || '').replace(/\D/g, '');
export const limpiar = (s: unknown, max: number) => String(s ?? '').trim().replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').slice(0, max);

/** Edad cumplida a hoy a partir de 'aaaa-mm-dd'. */
export function edadDe(nac: string, hoy = new Date()) {
  const [a, m, d] = nac.split('-').map(Number);
  let e = hoy.getFullYear() - a;
  if (hoy.getMonth() + 1 < m || (hoy.getMonth() + 1 === m && hoy.getDate() < d)) e--;
  return e;
}

/** Link de WhatsApp: los números de Argentina sin el 54 se completan con 549. */
export function linkWhatsapp(n: string, texto?: string) {
  let d = soloDigitos(n).replace(/^0+/, '');
  if (d.length === 10) d = `549${d}`;
  else if (d.length === 12 && d.startsWith('54') && !d.startsWith('549')) d = `549${d.slice(2)}`;
  return `https://wa.me/${d}${texto ? `?text=${encodeURIComponent(texto)}` : ''}`;
}

const enLista = (lista: readonly (string | [string, string])[], v: string) => lista.some((x) => (Array.isArray(x) ? x[0] : x) === v);
const deLista = (lista: [string, string][], v: unknown) => (Array.isArray(v) ? [...new Set(v.map(String))].filter((x) => enLista(lista, x)) : []);

export type DatosPostulante = {
  nombre: string; nacimiento: string; mail: string; whatsapp: string;
  direccion: string; localidad: string; departamento: string;
  puesto: string; puestos_extra: string[]; puesto_otro: string; puesto_actual: string;
  experiencia: number; disponibilidad: string[]; idiomas: string[]; movilidad: boolean; sobre_mi: string;
};

/** Valida y limpia los datos del postulante. Devuelve los datos o el primer error. */
export function validarPostulante(j: Record<string, unknown>): { datos?: DatosPostulante; error?: string } {
  const nombre = limpiar(j.nombre, 120);
  if (nombre.split(' ').length < 2 || !/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' .-]+$/.test(nombre)) return { error: 'Escribí tu nombre y tu apellido.' };
  const nacimiento = String(j.nacimiento ?? '');
  const f = /^(\d{4})-(\d{2})-(\d{2})$/.exec(nacimiento);
  const d = f ? new Date(Date.UTC(+f[1], +f[2] - 1, +f[3])) : null;
  if (!f || !d || d.getUTCDate() !== +f[3] || +f[1] < 1930) return { error: 'Revisá tu fecha de nacimiento.' };
  const edad = edadDe(nacimiento);
  if (edad < 16 || edad > 90) return { error: 'Para cargar tu CV tenés que tener 16 años o más.' };
  const mail = limpiar(j.mail, 200).toLowerCase();
  if (!MAIL_RE.test(mail)) return { error: 'Revisá el mail: tiene que ser como nombre@mail.com.' };
  const whatsapp = soloDigitos(String(j.whatsapp ?? '')).replace(/^0+/, '');
  if (whatsapp.length < 10 || whatsapp.length > 13) return { error: 'Escribí tu WhatsApp con característica, por ejemplo 261 555 1234.' };
  const departamento = String(j.departamento ?? '');
  if (!enLista(DEPARTAMENTOS, departamento)) return { error: 'Elegí tu departamento.' };
  const direccion = limpiar(j.direccion, 150);
  if (direccion.length < 3) return { error: 'Escribí tu dirección (calle y número).' };
  const puesto = String(j.puesto ?? '');
  if (!enLista(PUESTOS, puesto)) return { error: 'Elegí el puesto que buscás.' };
  const puesto_otro = limpiar(j.puesto_otro, 60);
  const puestos_extra = deLista(PUESTOS, j.puestos_extra).filter((x) => x !== puesto).slice(0, 2);
  if ((puesto === 'otro' || puestos_extra.includes('otro')) && puesto_otro.length < 3) return { error: 'Escribí qué otro puesto buscás.' };
  const experiencia = Math.round(Number(j.experiencia ?? 0));
  if (!Number.isFinite(experiencia) || experiencia < 0 || experiencia > 60) return { error: 'Revisá los años de experiencia.' };
  return {
    datos: {
      nombre, nacimiento, mail, whatsapp, direccion, departamento,
      localidad: limpiar(j.localidad, 80),
      puesto, puestos_extra, puesto_otro: puesto === 'otro' || puestos_extra.includes('otro') ? puesto_otro : '',
      puesto_actual: limpiar(j.puesto_actual, 120),
      experiencia,
      disponibilidad: deLista(DISPONIBILIDAD, j.disponibilidad),
      idiomas: deLista(IDIOMAS, j.idiomas),
      movilidad: j.movilidad === true || j.movilidad === 'true',
      sobre_mi: limpiar(j.sobre_mi, 600),
    },
  };
}

export type DatosEmpresa = { nombre: string; tipo: string; cuit: string; departamento: string; direccion: string; contacto: string; mail: string; whatsapp: string };

export function validarEmpresa(j: Record<string, unknown>): { datos?: DatosEmpresa; error?: string } {
  const nombre = limpiar(j.nombre, 120);
  if (nombre.length < 2) return { error: 'Escribí el nombre del hotel o restaurante.' };
  const tipo = String(j.tipo ?? '');
  if (!enLista(TIPOS_EMPRESA, tipo)) return { error: 'Elegí el tipo de establecimiento.' };
  const cuit = soloDigitos(String(j.cuit ?? ''));
  if (cuit && cuit.length !== 11) return { error: 'El CUIT tiene 11 números (o dejalo vacío).' };
  const departamento = String(j.departamento ?? '');
  if (!enLista(DEPARTAMENTOS, departamento)) return { error: 'Elegí el departamento.' };
  const contacto = limpiar(j.contacto, 80);
  if (contacto.length < 3) return { error: 'Escribí el nombre de la persona de contacto.' };
  const mail = limpiar(j.mail, 200).toLowerCase();
  if (!MAIL_RE.test(mail)) return { error: 'Revisá el mail: tiene que ser como nombre@mail.com.' };
  const whatsapp = soloDigitos(String(j.whatsapp ?? '')).replace(/^0+/, '');
  if (whatsapp.length < 10 || whatsapp.length > 13) return { error: 'Escribí el WhatsApp con característica, por ejemplo 261 555 1234.' };
  return { datos: { nombre, tipo, cuit, departamento, direccion: limpiar(j.direccion, 150), contacto, mail, whatsapp } };
}

export type DatosVacante = { puesto: string; titulo: string; descripcion: string; departamento: string; jornada: string; sueldo: string };

export function validarVacante(j: Record<string, unknown>): { datos?: DatosVacante; error?: string } {
  const puesto = String(j.puesto ?? '');
  if (!enLista(PUESTOS, puesto)) return { error: 'Elegí el puesto.' };
  const titulo = limpiar(j.titulo, 100);
  if (titulo.length < 3) return { error: 'Escribí un título, por ejemplo "Mozo/a para turno noche".' };
  const departamento = String(j.departamento ?? '');
  if (!enLista(DEPARTAMENTOS, departamento)) return { error: 'Elegí el departamento.' };
  const jornada = String(j.jornada ?? '');
  if (!enLista(JORNADAS, jornada)) return { error: 'Elegí la jornada.' };
  return { datos: { puesto, titulo, departamento, jornada, descripcion: limpiar(j.descripcion, 2000), sueldo: limpiar(j.sueldo, 80) } };
}

export const CLAVE_MIN = 6;
export const validarClave = (c: unknown) => (typeof c === 'string' && c.length >= CLAVE_MIN && c.length <= 100 ? null : `La clave tiene que tener al menos ${CLAVE_MIN} caracteres.`);

/** Filtros del buscador de CVs (vienen de la URL). */
export type Filtros = { q: string; dep: string; puesto: string; edadMin: string; edadMax: string; exp: string; disp: string; idioma: string; mov: string; pag: number };

export function leerFiltros(sp: Record<string, string | string[] | undefined>): Filtros {
  const u = (k: string) => { const v = sp[k]; return (Array.isArray(v) ? v[0] : v ?? '').slice(0, 80); };
  return {
    q: u('q').trim(),
    dep: enLista(DEPARTAMENTOS, u('dep')) ? u('dep') : '',
    puesto: enLista(PUESTOS, u('puesto')) ? u('puesto') : '',
    edadMin: /^\d{1,2}$/.test(u('edadMin')) ? u('edadMin') : '',
    edadMax: /^\d{1,2}$/.test(u('edadMax')) ? u('edadMax') : '',
    exp: /^\d{1,2}$/.test(u('exp')) ? u('exp') : '',
    disp: enLista(DISPONIBILIDAD, u('disp')) ? u('disp') : '',
    idioma: enLista(IDIOMAS, u('idioma')) ? u('idioma') : '',
    mov: u('mov') === '1' ? '1' : '',
    pag: Math.max(1, Math.min(200, parseInt(u('pag')) || 1)),
  };
}
