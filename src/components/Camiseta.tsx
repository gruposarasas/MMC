import { useId } from 'react';

/** Camiseta blanca con la banda roja cruzada. */
export function Camiseta({ ancho = 120, className, style }: { ancho?: number; className?: string; style?: React.CSSProperties }) {
  const id = useId().replace(/:/g, '');
  const cuerpo = 'M70 18 L88 10 Q100 22 112 10 L130 18 L178 44 L160 84 L142 74 L142 188 L58 188 L58 74 L40 84 L22 44 Z';
  return (
    <svg viewBox="0 0 200 200" width={ancho} height={ancho} className={className} style={style} aria-hidden="true">
      <defs>
        <clipPath id={`c${id}`}><path d={cuerpo} /></clipPath>
      </defs>
      <path d={cuerpo} fill="#fff" />
      <g clipPath={`url(#c${id})`}>
        <path d="M18 70 L62 26 L190 170 L150 206 Z" fill="#D71920" />
      </g>
      <path d="M88 10 Q100 22 112 10" fill="none" stroke="#D71920" strokeWidth="5" strokeLinecap="round" />
      <path d={cuerpo} fill="none" stroke="#281722" strokeWidth="4" strokeLinejoin="round" />
    </svg>
  );
}
