// Guarda ventas (del Excel o de la API de Contabilium) sin duplicar. Solo servidor.
import { db } from './db';
import { redondear } from './formato';
import { claveVenta } from './importar';

export type VentaNueva = {
  fecha: string; comprobante: string; numero: string; cliente: string; cuit: string;
  neto: number; iva: number; otros: number; total: number; datos: Record<string, unknown>;
};

/**
 * Agrupa por comprobante (si vienen renglones de un mismo comprobante, se suman) y hace upsert por la clave
 * tipo|número. Con `archivo` deja registrada la importación para poder deshacerla.
 */
export async function guardarVentas(lista: VentaNueva[], opc: { archivo: string | null; filasArchivo?: number }) {
  const grupos = new Map<string, VentaNueva & { clave: string }>();
  for (const v of lista) {
    const clave = claveVenta(v);
    const g = grupos.get(clave);
    if (g) {
      g.neto = redondear(g.neto + v.neto);
      g.iva = redondear(g.iva + v.iva);
      g.otros = redondear(g.otros + v.otros);
      g.total = redondear(g.total + v.total);
    } else grupos.set(clave, { ...v, clave });
  }
  const filas = [...grupos.values()].map((f) => ({ ...f, origen: 'contabilium' }));
  const fechas = filas.map((f) => f.fecha).sort();
  if (!filas.length) return { comprobantes: 0, nuevas: 0, actualizadas: 0, desde: null, hasta: null };
  const total = redondear(filas.reduce((a, f) => a + f.total, 0));
  const sql = db();
  const r = await sql.begin(async (tx) => {
    let impId: number | null = null;
    if (opc.archivo != null) {
      const [imp] = await tx`
        insert into importaciones (tipo, archivo, filas, desde, hasta, total)
        values ('venta', ${opc.archivo.slice(0, 160) || 'archivo'}, ${opc.filasArchivo ?? lista.length}, ${fechas[0]}, ${fechas[fechas.length - 1]}, ${total})
        returning id`;
      impId = imp.id as number;
    }
    let nuevas = 0;
    for (let i = 0; i < filas.length; i += 500) {
      const lote = filas.slice(i, i + 500).map((f) => ({ ...f, datos: tx.json(f.datos as never), importacion_id: impId }));
      const res = await tx`
        insert into ventas ${tx(lote, 'fecha', 'comprobante', 'numero', 'cliente', 'cuit', 'neto', 'iva', 'otros', 'total', 'clave', 'datos', 'origen', 'importacion_id')}
        on conflict (clave) do update set
          fecha = excluded.fecha, comprobante = excluded.comprobante, numero = excluded.numero,
          cliente = excluded.cliente, cuit = case when excluded.cuit <> '' then excluded.cuit else ventas.cuit end,
          neto = excluded.neto, iva = excluded.iva, otros = excluded.otros, total = excluded.total, datos = excluded.datos,
          origen = excluded.origen, importacion_id = coalesce(excluded.importacion_id, ventas.importacion_id)
        returning (xmax = 0) as nueva`;
      nuevas += res.filter((x) => x.nueva).length;
    }
    if (impId) await tx`update importaciones set nuevas = ${nuevas}, actualizadas = ${filas.length - nuevas} where id = ${impId}`;
    return { nuevas, actualizadas: filas.length - nuevas };
  });
  return { comprobantes: filas.length, ...r, desde: fechas[0], hasta: fechas[fechas.length - 1] };
}
