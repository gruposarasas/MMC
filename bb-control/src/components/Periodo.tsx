import Link from 'next/link';
import { mesActual, type Periodo } from '@/lib/formato';
import { type Params, url } from '@/lib/url';

/** ‹ Octubre 2026 › con acceso a "mes" / "año". */
export function SelectorPeriodo({ base, params, p, soloMes }: { base: string; params: Params; p: Periodo; soloMes?: boolean }) {
  const limpio = { ...params, editar: undefined, nuevo: undefined, copiar: undefined, importar: undefined };
  return (
    <nav className="periodo" aria-label="Período">
      <Link href={url(base, limpio, { p: p.anterior })} aria-label="Período anterior">‹</Link>
      <span className="act">{p.etiqueta}</span>
      <Link href={url(base, limpio, { p: p.siguiente })} aria-label="Período siguiente">›</Link>
      {!soloMes &&
        (p.tipo === 'mes' ? (
          <Link className="tipo" href={url(base, limpio, { p: p.valor.slice(0, 4) })}>Ver año</Link>
        ) : (
          <Link className="tipo" href={url(base, limpio, { p: p.actual ? mesActual() : `${p.valor}-12` })}>Ver mes</Link>
        ))}
      {!p.actual && (
        <Link className="tipo" href={url(base, limpio, { p: null })}>Hoy</Link>
      )}
    </nav>
  );
}
