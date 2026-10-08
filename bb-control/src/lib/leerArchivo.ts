// Lee un Excel (.xlsx) o un CSV en el navegador y devuelve sus filas.
import { type Celda, leerCsv } from './importar';

export async function leerArchivo(f: File, sirve: (filas: Celda[][]) => boolean): Promise<Celda[][]> {
  const nombre = f.name.toLowerCase();
  if (nombre.endsWith('.xls')) throw new Error('Ese archivo es .xls (Excel viejo). Abrilo y guardalo como .xlsx, o bajalo de nuevo en .xlsx o .csv.');
  if (nombre.endsWith('.csv') || nombre.endsWith('.txt')) return leerCsv(await f.text());
  const { default: leerXlsx } = await import('read-excel-file/web-worker');
  const hojas = await leerXlsx(f);
  const hoja = hojas.find((h) => sirve(h.data as Celda[][])) ?? hojas[0];
  return (hoja?.data ?? []) as Celda[][];
}
