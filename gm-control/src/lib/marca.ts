// Identidad de Grupo Modesto: figuras de trazo con las curvas de nivel del isotipo y la guarda
// de las tres historias (Modesto, Bastante y La Social).
export const FIGURAS = {
  kpi: '/img/kpi.png',
  ventas: '/img/ventas.png',
  compras: '/img/compras.png',
  gastos: '/img/gastos.png',
  proveedores: '/img/proveedores.png',
  sueldos: '/img/sueldos.png',
  equipo: '/img/equipo.png',
  costos: '/img/costos.png',
  contabilidad: '/img/contabilidad.png',
  ajustes: '/img/ajustes.png',
} as const;
export type Modulo = keyof typeof FIGURAS;
export const GUARDA = '/img/guarda.png';
