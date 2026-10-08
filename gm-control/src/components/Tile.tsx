import { porcentaje } from '@/lib/formato';

/** Variación contra el período anterior. "subeEsBueno" decide el color (ventas sí, gastos no). */
export function Delta({ actual, anterior, subeEsBueno = true, texto = 'vs. mes anterior' }: { actual: number; anterior: number; subeEsBueno?: boolean; texto?: string }) {
  if (!anterior) return null;
  const v = ((actual - anterior) / Math.abs(anterior)) * 100;
  if (!Number.isFinite(v)) return null;
  const dir = Math.abs(v) < 0.5 ? 'igual' : (v > 0) === subeEsBueno ? 'sube' : 'baja';
  return (
    <span className={`delta ${dir}`} title={texto}>
      {v > 0 ? '▲' : v < 0 ? '▼' : '='} {porcentaje(Math.abs(v), 0)} <span className="sr">{texto}</span>
    </span>
  );
}

export function Tile({ titulo, valor, sub, color, oscuro, children }: { titulo: string; valor: React.ReactNode; sub?: React.ReactNode; color?: string; oscuro?: boolean; children?: React.ReactNode }) {
  return (
    <div className={`tile${oscuro ? ' oscuro' : ''}`}>
      <div className="t">
        {color && <i className="punto" style={{ background: color }} aria-hidden />}
        {titulo}
      </div>
      <div className="v">{valor}</div>
      {sub && <div className="s">{sub}</div>}
      {children}
    </div>
  );
}
