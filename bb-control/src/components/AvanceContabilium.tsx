import { type Carga, cargaViva, leerCarga } from '@/lib/contabilium';
import { numero } from '@/lib/formato';
import { Refrescar } from './Refrescar';

const cuando = (iso: string) => new Date(iso).toLocaleString('es-AR', { timeZone: 'America/Argentina/Mendoza', dateStyle: 'short', timeStyle: 'short' });

/** Avance de la carga de Contabilium en segundo plano (se actualiza solo mientras corre). */
export async function AvanceContabilium({ compacto }: { compacto?: boolean }) {
  const c: Carga | null = await leerCarga();
  if (!c) return null;
  const viva = cargaViva(c);
  if (viva) {
    const pct = c.total ? Math.round((c.hechos / c.total) * 100) : null;
    return (
      <div className="aviso avance-carga" role="status">
        <Refrescar cada={4000} />
        <b>Trayendo de Contabilium…</b> {c.etapa}{c.total ? `: ${numero(c.hechos)} de ${numero(c.total)}` : ''}.
        {pct != null && <span className="barra" aria-hidden><i style={{ width: `${pct}%` }} /></span>}
        {!compacto && <span className="chico"> Se puede seguir usando la app; esto se actualiza solo.</span>}
      </div>
    );
  }
  if (compacto && c.ok) return null;
  if (c.corriendo) {
    return <div className="aviso mal">La carga de Contabilium se cortó ({c.etapa}, {cuando(c.actualizado)}). Volvé a tocar el botón: sigue desde donde quedó.</div>;
  }
  return (
    <div className={`aviso ${c.ok ? 'ok' : 'mal'}`}>
      Última carga de Contabilium ({cuando(c.actualizado)}): {c.mensaje}
    </div>
  );
}
