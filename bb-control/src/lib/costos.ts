// Ingeniería de costos de un producto. Se usa en el servidor y en el cliente.
export type Insumo = { id: number; nombre: string; unidad: string; moneda: 'ARS' | 'USD'; costo: number };
export type LineaReceta = { id: number; insumo_id: number; cantidad: number; merma_pct: number };
export type Producto = { precio: number; iva_alicuota: number; variables_pct: number; margen_objetivo: number };

export const costoUnitarioArs = (i: Pick<Insumo, 'moneda' | 'costo'>, dolar: number | null) =>
  i.moneda === 'USD' ? (dolar ? i.costo * dolar : NaN) : i.costo;

/** Costo de una línea: la merma agranda la cantidad que hay que comprar. */
export const costoLinea = (l: Pick<LineaReceta, 'cantidad' | 'merma_pct'>, unitario: number) =>
  (l.cantidad / (1 - (l.merma_pct || 0) / 100)) * unitario;

export function calcular(p: Producto, receta: LineaReceta[], insumos: Map<number, Insumo>, dolar: number | null) {
  let directo = 0;
  let faltaDolar = false;
  for (const l of receta) {
    const ins = insumos.get(l.insumo_id);
    if (!ins) continue;
    const u = costoUnitarioArs(ins, dolar);
    if (Number.isNaN(u)) {
      faltaDolar = true;
      continue;
    }
    directo += costoLinea(l, u);
  }
  const variables = (p.precio * (p.variables_pct || 0)) / 100;
  const total = directo + variables;
  const margen = p.precio - total;
  const margenPct = p.precio > 0 ? (margen / p.precio) * 100 : null;
  const markup = directo > 0 ? (p.precio / directo - 1) * 100 : null;
  // Precio que deja el margen objetivo después de costos variables.
  const divisor = 1 - (p.margen_objetivo + (p.variables_pct || 0)) / 100;
  const sugerido = divisor > 0 ? directo / divisor : null;
  return {
    directo,
    variables,
    total,
    margen,
    margenPct,
    markup,
    sugerido,
    sugeridoConIva: sugerido != null ? sugerido * (1 + p.iva_alicuota / 100) : null,
    precioConIva: p.precio * (1 + p.iva_alicuota / 100),
    faltaDolar,
  };
}
