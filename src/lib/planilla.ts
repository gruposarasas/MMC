// Planilla de los jurados: qué puntúa cada jurado en cada ronda y cómo sale el puntaje.
// Reglas puras (se usan en el servidor y en las pantallas). Para cambiar la planilla, se toca solo este archivo.
//
// Rondas 1 y 2: espresso y flat white. Ronda 3 y final: suma la bebida de autor.

export type Item = { k: string; t: string; rondas: number[] };

export const ESCALA = { min: 1, max: 9 }; // con un decimal

export const ITEMS: Item[] = [
  { k: 'espresso', t: 'Espresso', rondas: [1, 2, 3, 4] },
  { k: 'leche', t: 'Flat white', rondas: [1, 2, 3, 4] },
  { k: 'autor', t: 'Bebida de autor', rondas: [3, 4] }, // desde la Ronda 3 se promedia con el espresso y el flat white
];

/** Ítem que se usa para desempatar (el puntaje del espresso). */
export const ITEM_DESEMPATE = 'espresso';

export const JURADOS = [1, 2, 3] as const;

/** La ficha técnica (de 0 a 1, con un decimal) la carga este jurado en su planilla y se suma al puntaje final. */
export const JURADO_FICHA = 2;
export const FICHA = { min: 0, max: 1 };

/** Ficha técnica de un barista en una ronda: la que cargó el Jurado 2 (0 si todavía no la cargó). */
export const fichaDe = (evs: Evaluacion[]) => Number(evs.find((e) => e.jurado === JURADO_FICHA)?.valores?.ficha) || 0;

export const itemsDe = (ronda: number) => ITEMS.filter((i) => i.rondas.includes(ronda));

export type Valores = Record<string, number>;
export type Evaluacion = { jurado: number; valores: Valores; comentario: string };

const r1 = (n: number) => Math.round(n * 10) / 10;
const prom = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** Valor de un ítem: de 1 a 9 con un decimal ("8,5" u "8.5"). null si está vacío; NaN si es inválido. */
export function valorItem(v: unknown): number | null {
  if (v === null || v === undefined || String(v).trim() === '') return null;
  const n = Number(String(v).replace(',', '.'));
  if (!Number.isFinite(n) || n < ESCALA.min || n > ESCALA.max) return NaN;
  return r1(n);
}

/** La planilla del jurado está completa para esa ronda. */
export const completa = (ronda: number, v: Valores | undefined) => !!v && itemsDe(ronda).every((i) => typeof v[i.k] === 'number');

/** Puntaje de un jurado: promedio de sus ítems. null si la planilla no está completa. */
export function totalJurado(ronda: number, v: Valores | undefined) {
  if (!completa(ronda, v)) return null;
  return r1(prom(itemsDe(ronda).map((i) => v![i.k])));
}

/**
 * Puntaje de la ronda: promedio de los 3 jurados menos los descuentos de los jueces fiscales (nunca menos de 1),
 * más la ficha técnica que carga el Jurado 2 (de 0 a 1). Espresso (para desempatar): promedio del espresso de los 3. null si falta alguna planilla.
 */
export function resultado(ronda: number, evs: Evaluacion[], descuento: number) {
  const ficha = fichaDe(evs);
  const totales = JURADOS.map((n) => totalJurado(ronda, evs.find((e) => e.jurado === n)?.valores));
  if (totales.some((t) => t == null)) return null;
  const promedio = r1(prom(totales as number[]));
  return {
    totales: totales as number[],
    promedio,
    ficha,
    puntaje: r1(Math.max(ESCALA.min, promedio - descuento) + ficha),
    espresso: r1(prom(JURADOS.map((n) => evs.find((e) => e.jurado === n)!.valores[ITEM_DESEMPATE]))),
  };
}
