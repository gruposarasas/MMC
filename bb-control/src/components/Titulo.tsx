import { FIGURAS, type Modulo } from '@/lib/marca';

/** Título de módulo con su figura del Mundial de Café. */
export function Titulo({ modulo, eti = 'Módulo', titulo, children }: { modulo: Modulo; eti?: string; titulo: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="titulo">
      <img className="fig" src={FIGURAS[modulo]} alt="" />
      <div>
        <div className="eti">{eti}</div>
        <h1>{titulo}</h1>
        {children && <p>{children}</p>}
      </div>
    </div>
  );
}
