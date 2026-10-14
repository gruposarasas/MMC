// Activos: costo de cada equipo = mercadería por unidad + gastos de la importación divididos por las unidades
// importadas (transporte, gastos de importación, despachante y otros). Puro: lo usan las páginas y los formularios.

export const CATEGORIAS_ACTIVO = {
  maquina: 'Máquinas de café',
  molinillo: 'Molinillos',
  tostadora: 'Tostadoras',
  vehiculo: 'Vehículos',
  equipo: 'Otros equipos',
  otro: 'Otros',
} as const;
export const SINGULAR: Record<keyof typeof CATEGORIAS_ACTIVO, string> = {
  maquina: 'Máquina de café', molinillo: 'Molinillo', tostadora: 'Tostadora', vehiculo: 'Vehículo', equipo: 'Equipo', otro: 'Otro',
};
export type CategoriaActivo = keyof typeof CATEGORIAS_ACTIVO;

export const ESTADOS_ACTIVO = {
  cliente: 'Instalada en cliente',
  deposito: 'En depósito',
  uso: 'En uso propio',
  reparacion: 'En reparación',
  baja: 'Vendida o de baja',
} as const;
export type EstadoActivo = keyof typeof ESTADOS_ACTIVO;

export const GASTOS_IMPORTACION = {
  transporte: 'Transporte (flete y seguro)',
  gastos_importacion: 'Gastos de importación (derechos, tasas, aduana)',
  despachante: 'Despachante',
  otros: 'Otros gastos',
} as const;
export type GastoImportacion = keyof typeof GASTOS_IMPORTACION;

export type Moneda = 'ARS' | 'USD';
export type Importacion = {
  id: number; nombre: string; moneda: Moneda; cotizacion: number; mercaderia: number; unidades: number;
  transporte: number; transporte_moneda: Moneda; gastos_importacion: number; gastos_importacion_moneda: Moneda;
  despachante: number; despachante_moneda: Moneda; otros: number; otros_moneda: Moneda;
};
export type ActivoCosto = { moneda: Moneda; costo_mercaderia: number | null; costo_otros: number; importacion_id: number | null };

const enPesos = (monto: number, moneda: Moneda, cotizacion: number) => Number(monto) * (moneda === 'USD' ? cotizacion : 1);

/** Gastos de una importación en pesos (cada uno con su moneda, al dólar de la importación) y por unidad. */
export function gastosImportacion(l: Importacion) {
  const cot = Number(l.cotizacion) || 1;
  const detalle = (Object.keys(GASTOS_IMPORTACION) as GastoImportacion[]).map((k) => ({
    concepto: k, monto: Number(l[k]), moneda: l[`${k}_moneda`] as Moneda, pesos: enPesos(l[k], l[`${k}_moneda`] as Moneda, cot),
  }));
  const total = detalle.reduce((a, d) => a + d.pesos, 0);
  const unidades = Math.max(1, Number(l.unidades) || 1);
  const mercaderiaUnidad = Number(l.mercaderia) / unidades;
  const porUnidad = total / unidades;
  return {
    detalle, total, porUnidad, mercaderiaUnidad,
    mercaderiaPesos: enPesos(l.mercaderia, l.moneda, cot),
    costoUnidadPesos: enPesos(mercaderiaUnidad, l.moneda, cot) + porUnidad,
  };
}

/**
 * Costo de un activo en pesos. Con importación: mercadería por unidad (la del activo o la del lote) al dólar de la
 * importación + su parte de los gastos. Sin importación: mercadería + otros costos al dólar de hoy.
 */
export function costoActivo(a: ActivoCosto, l: Importacion | null | undefined, dolarHoy: number | null) {
  if (l) {
    const g = gastosImportacion(l);
    const cot = Number(l.cotizacion) || 1;
    const merc = a.costo_mercaderia != null ? Number(a.costo_mercaderia) : g.mercaderiaUnidad;
    const mercaderia = enPesos(merc, l.moneda, cot);
    const otros = enPesos(a.costo_otros, l.moneda, cot);
    const total = mercaderia + g.porUnidad + otros;
    return { mercaderia, gastos: g.porUnidad, otros, total, dolares: total / cot, completo: true };
  }
  const cot = a.moneda === 'USD' ? dolarHoy : 1;
  if (a.costo_mercaderia == null && !Number(a.costo_otros)) return { mercaderia: 0, gastos: 0, otros: 0, total: 0, dolares: null, completo: false };
  const base = Number(a.costo_mercaderia ?? 0) + Number(a.costo_otros);
  if (!cot) return { mercaderia: 0, gastos: 0, otros: 0, total: 0, dolares: a.moneda === 'USD' ? base : null, completo: false };
  return {
    mercaderia: Number(a.costo_mercaderia ?? 0) * cot, gastos: 0, otros: Number(a.costo_otros) * cot, total: base * cot,
    dolares: a.moneda === 'USD' ? base : dolarHoy ? (base * cot) / dolarHoy : null, completo: true,
  };
}
