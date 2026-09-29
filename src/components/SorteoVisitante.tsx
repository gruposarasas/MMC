'use client';
import { useEffect, useState } from 'react';
import { SORTEO_TEXTO, SORTEO_DNI, type Ventana } from '@/lib/config';
import { Camiseta } from './Camiseta';
import { toast } from './Toast';

type Estado = { ventana: Ventana; habilitada: boolean; presente: boolean };

/** Tarjeta del sorteo en la billetera, con el botón "Estoy presente". */
export function SorteoVisitante({ inicial }: { inicial: Estado }) {
  const [e, setE] = useState<Estado>(inicial);
  const [enviando, setEnviando] = useState(false);

  // Se actualiza sola: el domingo a las 18 aparece el botón sin recargar,
  // y si administración reinicia el sorteo, vuelve a aparecer.
  useEffect(() => {
    if (e.ventana === 'cerrada' && !e.habilitada && !e.presente) return;
    const t = setInterval(async () => {
      if (document.hidden) return;
      const r = await fetch('/api/sorteo/estado', { cache: 'no-store' }).catch(() => null);
      if (r?.ok) setE(await r.json());
    }, 15000);
    return () => clearInterval(t);
  }, [e.ventana, e.habilitada, e.presente]);

  async function confirmar() {
    setEnviando(true);
    const r = await fetch('/api/sorteo/presente', { method: 'POST' }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setEnviando(false);
    if (!r || !r.ok) return toast(j.error || 'No se pudo confirmar. Probá de nuevo.');
    setE((x) => ({ ...x, presente: true }));
    toast('¡Listo! Ya estás participando. Mirá la pantalla gigante.');
  }

  return (
    <section className="sorteo-card" aria-labelledby="sorteoTit">
      <Camiseta ancho={84} className="sorteo-cam" />
      <div>
        <h2 id="sorteoTit">¡Quiero la camiseta de Enzo!</h2>
        <p className="sorteo-cuando">{SORTEO_TEXTO}</p>
        {e.presente ? (
          <p className="sorteo-ok" role="status">✓ Estás participando. ¡Suerte!</p>
        ) : e.habilitada ? (
          <>
            <p>¿Estás en el Mundial? Confirmalo para entrar al sorteo.</p>
            <button className="sorteo-btn" onClick={confirmar} disabled={enviando}>{enviando ? 'Un momento…' : 'Estoy presente'}</button>
          </>
        ) : e.ventana === 'cerrada' ? (
          <p className="sorteo-nota">La inscripción al sorteo ya cerró.</p>
        ) : (
          <p className="sorteo-nota">Ya estás inscripto. El domingo, a partir de las 18 hs, tocá acá &quot;Estoy presente&quot; para entrar al sorteo.</p>
        )}
        <p className="sorteo-dni">{SORTEO_DNI}</p>
      </div>
    </section>
  );
}

/** Aviso del sorteo en la pantalla de registro. */
export function SorteoAviso() {
  return (
    <section className="sorteo-card sorteo-aviso" aria-label="Sorteo de la camiseta de Enzo">
      <Camiseta ancho={70} className="sorteo-cam" />
      <div>
        <h2>¡Quiero la camiseta de Enzo!</h2>
        <p className="sorteo-cuando">{SORTEO_TEXTO}</p>
        <p>Registrate y, el domingo a partir de las 18 hs, tocá &quot;Estoy presente&quot; en tu billetera para participar.</p>
        <p className="sorteo-dni">{SORTEO_DNI}</p>
      </div>
    </section>
  );
}
