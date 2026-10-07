// Identidad compartida con la app del Mundial de Café: figuras geométricas y guarda.
export const FIGURAS = {
  kpi: '/img/estrellaSola.png',
  ventas: '/img/ic_taza.png',
  compras: '/img/ic_grano.png',
  gastos: '/img/ic_ondas.png',
  sueldos: '/img/ic_jarra.png',
  equipo: '/img/ic_flor.png',
  costos: '/img/ic_chemex.png',
  ajustes: '/img/ic_reloj.png',
} as const;
export type Modulo = keyof typeof FIGURAS;
export const GUARDA = '/img/guarda.png';
