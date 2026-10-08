'use server';
// Lee la foto o el PDF de una factura con Claude y deja los datos listos para el formulario de compra o gasto.
import { guardarDatos, tipoReal } from '@/lib/archivos';
import { db } from '@/lib/db';
import { ErrorLector, leerFactura, sePuedeLeer } from '@/lib/lectorFacturas';
import { ip, permitir } from '@/lib/limite';
import { exigirAdmin } from '@/lib/sesion';

export type EstadoLectura = { error?: string; ok?: string; lectura?: string };

const MAX = 8 * 1024 * 1024;

export async function leerFacturaAccion(_: unknown, f: FormData): Promise<EstadoLectura> {
  await exigirAdmin();
  const tipo = f.get('tipo') === 'gasto' ? 'gasto' : 'compra';
  const a = f.get('factura');
  if (!(a instanceof File) || !a.size) return { error: 'Elegí la foto o el PDF de la factura.' };
  if (a.size > MAX) return { error: 'El archivo pesa más de 8 MB. Sacá la foto de nuevo o mandá un PDF más liviano.' };
  if (!permitir(`factura:${await ip()}`, 30, 600)) return { error: 'Leíste muchas facturas seguidas. Probá en unos minutos.' };
  const datos = Buffer.from(await a.arrayBuffer());
  const mime = tipoReal(datos);
  if (!mime || !sePuedeLeer(mime)) return { error: 'Tiene que ser una foto (JPG, PNG o WebP) o un PDF.' };

  const sql = db();
  const rubros = await sql<{ nombre: string }[]>`select nombre from rubros where tipo = ${tipo} and activo order by orden, nombre`;
  try {
    const leida = await leerFactura(datos, mime, rubros.map((r) => r.nombre));
    if (!leida.es_comprobante) return { error: 'Eso no parece una factura o comprobante. Probá con otra foto.' };
    const archivo = await guardarDatos(a.name || 'factura', mime, datos);
    await sql`delete from lecturas_factura where creado < now() - interval '7 days'`;
    const [r] = await sql`insert into lecturas_factura (tipo, datos, archivo_id) values (${tipo}, ${sql.json(leida as never)}, ${archivo}) returning id`;
    return { ok: 'Factura leída.', lectura: r.id as string };
  } catch (e) {
    if (e instanceof ErrorLector) return { error: e.message };
    console.error('[factura]', e);
    return { error: 'No se pudo leer la factura. Probá de nuevo o cargala a mano.' };
  }
}
