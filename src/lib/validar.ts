// Validación del registro. La usan el formulario y el servidor.
import { pad, edad } from './formato';

export type Via = 'mail' | 'wa';

export type DatosRegistro = {
  nombre: string;
  dia: string;
  mes: string;
  anio: string;
  via: Via;
  contacto: string;
  acepto: boolean;
  novedades: boolean;
};

export type Errores = Partial<Record<'nombre' | 'nac' | 'contacto' | 'acepto', string>>;

export const limpiarNombre = (s: string) => (s || '').trim().replace(/\s+/g, ' ');
export const limpiarContacto = (via: Via, c: string) =>
  via === 'mail' ? (c || '').trim().toLowerCase() : (c || '').replace(/\D/g, '');

export const MAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

export function validarRegistro(f: DatosRegistro): { errores: Errores; nacimiento?: string } {
  const e: Errores = {};
  const nom = limpiarNombre(f.nombre);
  if (nom.length > 120 || nom.split(' ').length < 2 || !/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' .-]+$/.test(nom))
    e.nombre = 'Escribí tu nombre y tu apellido.';

  let nacimiento: string | undefined;
  if (!f.dia || !f.mes || !f.anio) e.nac = 'Elegí día, mes y año.';
  else {
    const d = new Date(Date.UTC(+f.anio, +f.mes - 1, +f.dia));
    if (d.getUTCMonth() !== +f.mes - 1 || d.getUTCDate() !== +f.dia || +f.anio < 1901) e.nac = 'Esa fecha no existe. Revisá el día.';
    else {
      nacimiento = `${f.anio}-${pad(f.mes)}-${pad(f.dia)}`;
      if (edad(nacimiento) < 13) e.nac = 'Tenés que tener 13 años o más para registrarte.';
    }
  }

  const c = (f.contacto || '').trim();
  if (f.via === 'mail') {
    if (!MAIL_RE.test(c) || c.length > 200) e.contacto = 'Revisá el mail: tiene que ser como nombre@mail.com.';
  } else {
    const d = c.replace(/\D/g, '');
    if (d.length < 10 || d.length > 11) e.contacto = 'Escribí el número con característica: 10 números, por ejemplo 261 555 1234.';
  }
  if (!f.acepto) e.acepto = 'Para darte los beneficios necesitamos que aceptes.';
  return { errores: e, nacimiento };
}
