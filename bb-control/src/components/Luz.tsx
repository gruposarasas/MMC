import type { Color } from '@/lib/semaforo';

export const TEXTO_LUZ: Record<Color, string> = { verde: 'Verde', amarillo: 'Amarillo', rojo: 'Rojo', gris: 'Faltan datos' };

/** Luz del semáforo, con texto (no solo color). */
export function Luz({ color, grande, puntos, titulo }: { color: Color; grande?: boolean; puntos?: number; titulo?: string }) {
  return (
    <span className={`luz luz-${color}${grande ? ' grande' : ''}`} title={titulo ?? TEXTO_LUZ[color]}>
      <i aria-hidden />
      <span>{TEXTO_LUZ[color]}{puntos != null && color !== 'gris' ? <small> · {puntos}</small> : null}</span>
    </span>
  );
}
