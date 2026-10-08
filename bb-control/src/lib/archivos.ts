// Archivos adjuntos (certificados, facturas y archivos de contabilidad). Se guardan en la base. Solo servidor.
import { db } from './db';
import { falla } from './form';

const MAX = 8 * 1024 * 1024;

export function tipoReal(b: Buffer): string | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP') return 'image/webp';
  if (b.subarray(0, 5).toString() === '%PDF-') return 'application/pdf';
  if (b.subarray(4, 8).toString() === 'ftyp' && /^(heic|heix|mif1|msf1|hevc)/.test(b.subarray(8, 12).toString())) return 'image/heic';
  return null;
}

/** Guarda el archivo del formulario (si vino) y devuelve su id. */
export async function guardarArchivo(f: FormData, campo: string, requerido?: string): Promise<string | null> {
  const a = f.get(campo);
  if (!(a instanceof File) || a.size === 0) {
    if (requerido) falla(requerido);
    return null;
  }
  if (a.size > MAX) falla('El archivo pesa más de 8 MB. Sacale una foto de nuevo o mandá un PDF más liviano.');
  const datos = Buffer.from(await a.arrayBuffer());
  const tipo = tipoReal(datos);
  if (!tipo) falla('El archivo tiene que ser una foto (JPG, PNG) o un PDF.');
  return guardarDatos(a.name, tipo!, datos);
}

export async function guardarDatos(nombreOriginal: string, tipo: string, datos: Buffer): Promise<string> {
  const nombre = (nombreOriginal || 'archivo').replace(/[^\w.\- ]+/g, '_').slice(0, 100);
  const [r] = await db()`insert into archivos (nombre, tipo, tamano, datos) values (${nombre}, ${tipo}, ${datos.length}, ${datos}) returning id`;
  return r.id as string;
}

const EXCEL = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * Archivos de contabilidad: fotos, PDF, Excel (.xlsx o .xls), CSV, TXT o ZIP. El tipo se mira en el contenido,
 * no solo en el nombre.
 */
export function tipoContable(b: Buffer, nombre: string): string | null {
  const ext = nombre.toLowerCase().split('.').pop() ?? '';
  const real = tipoReal(b);
  if (real) return real;
  if (b.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) return ext === 'xlsx' ? EXCEL : ext === 'zip' ? 'application/zip' : null;
  if (b.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))) return ext === 'xls' ? 'application/vnd.ms-excel' : null;
  if ((ext === 'csv' || ext === 'txt') && !b.subarray(0, 4096).includes(0)) return ext === 'csv' ? 'text/csv' : 'text/plain';
  return null;
}

/** Guarda un archivo de contabilidad del formulario y devuelve su id. */
export async function guardarArchivoContable(f: FormData, campo: string): Promise<string> {
  const a = f.get(campo);
  if (!(a instanceof File) || a.size === 0) falla('Elegí el archivo.');
  const archivo = a as File;
  if (archivo.size > MAX) falla('El archivo pesa más de 8 MB.');
  const datos = Buffer.from(await archivo.arrayBuffer());
  const tipo = tipoContable(datos, archivo.name);
  if (!tipo) falla('Subí un PDF, Excel, CSV, TXT, ZIP o una foto.');
  return guardarDatos(archivo.name, tipo!, datos);
}
