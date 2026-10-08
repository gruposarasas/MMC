// Renglones de una factura de compra o gasto. Solo servidor.
import type postgres from 'postgres';
import { hoy, redondear } from './formato';
import { falla } from './form';

export type Item = { descripcion: string; cantidad: number; unidad: string; precio: number; alicuota: number };
type Tx = postgres.TransactionSql<Record<string, unknown>> | postgres.Sql<Record<string, unknown>>;

const finito = (x: unknown, min = -1e12, max = 1e12) => typeof x === 'number' && Number.isFinite(x) && x >= min && x <= max;

/** Valida los renglones que llegan del formulario o de un Excel. */
export function validarItems(crudo: unknown): Item[] {
  if (!Array.isArray(crudo)) return [];
  if (crudo.length > 300) falla('La factura tiene demasiados renglones (máximo 300).');
  const out: Item[] = [];
  for (const [i, r] of crudo.entries()) {
    const x = r as Record<string, unknown>;
    const descripcion = typeof x?.descripcion === 'string' ? x.descripcion.trim().slice(0, 200) : '';
    if (!descripcion) continue;
    if (!finito(x.cantidad, 0.0001) || !finito(x.precio) || !finito(x.alicuota, 0, 100))
      falla(`Revisá el renglón ${i + 1} (${descripcion}): cantidad, precio o IVA.`);
    out.push({
      descripcion,
      cantidad: redondear(x.cantidad as number, 3),
      unidad: typeof x.unidad === 'string' ? x.unidad.trim().slice(0, 20) : '',
      precio: redondear(x.precio as number, 4),
      alicuota: redondear(x.alicuota as number, 2),
    });
  }
  return out;
}

/** Neto e IVA con el mismo redondeo que las columnas calculadas de la base. */
export function totalesItems(items: Item[]) {
  let neto = 0;
  let iva = 0;
  for (const i of items) {
    const n = redondear(i.cantidad * i.precio);
    neto += n;
    iva += redondear((n * i.alicuota) / 100);
  }
  const alics = [...new Set(items.map((i) => i.alicuota))];
  return { neto: redondear(neto), iva: redondear(iva), alicuota: alics.length === 1 ? alics[0] : 0 };
}

/**
 * Reemplaza los renglones de un comprobante. Los que se llaman igual que un insumo de Costos
 * quedan vinculados y, si se pide, le actualizan el costo.
 */
export async function guardarItems(
  tx: Tx,
  egresoId: number,
  items: Item[],
  opc: { moneda: 'ARS' | 'USD'; cotizacion: number; actualizarCostos: boolean; dolar: number | null },
) {
  await tx`delete from egreso_items where egreso_id = ${egresoId}`;
  if (!items.length) return 0;
  const nombres = [...new Set(items.map((i) => i.descripcion.toLowerCase()))];
  const insumos = await tx<{ id: number; nombre: string; moneda: 'ARS' | 'USD' }[]>`
    select id, lower(nombre) nombre, moneda from insumos where lower(nombre) in ${tx(nombres)}`;
  const porNombre = new Map(insumos.map((i) => [i.nombre, i]));
  const filas = items.map((it, orden) => ({ ...it, egreso_id: egresoId, orden, insumo_id: porNombre.get(it.descripcion.toLowerCase())?.id ?? null }));
  await tx`insert into egreso_items ${tx(filas, 'egreso_id', 'orden', 'descripcion', 'insumo_id', 'cantidad', 'unidad', 'precio', 'alicuota')}`;
  let actualizados = 0;
  if (opc.actualizarCostos) {
    for (const it of items) {
      const ins = porNombre.get(it.descripcion.toLowerCase());
      if (!ins || it.precio <= 0) continue;
      let costo: number | null = null;
      if (ins.moneda === opc.moneda) costo = it.precio;
      else if (opc.moneda === 'USD' && ins.moneda === 'ARS') costo = it.precio * opc.cotizacion;
      else if (opc.moneda === 'ARS' && ins.moneda === 'USD' && opc.dolar) costo = it.precio / opc.dolar;
      if (costo == null) continue;
      await tx`update insumos set costo = ${redondear(costo, 4)}, actualizado = ${hoy()} where id = ${ins.id}`;
      actualizados++;
    }
  }
  return actualizados;
}

/** Productos ya comprados y los insumos, para autocompletar los renglones. */
export async function sugerenciasItems(sql: Tx, tipo: 'compra' | 'gasto') {
  const filas = await sql<{ nombre: string; unidad: string; precio: number; moneda: 'ARS' | 'USD'; insumo: boolean }[]>`
    select distinct on (lower(nombre)) nombre, unidad, precio, moneda,
           exists (select 1 from insumos s where lower(s.nombre) = lower(x.nombre)) insumo from (
      select i.descripcion nombre, i.unidad, i.precio, e.moneda, e.fecha, 1 prioridad
        from egreso_items i join egresos e on e.id = i.egreso_id where e.tipo = ${tipo}
      union all
      select nombre, unidad, costo, moneda, actualizado, 2 from insumos
    ) x
    order by lower(nombre), prioridad, fecha desc
    limit 500`;
  return filas;
}
