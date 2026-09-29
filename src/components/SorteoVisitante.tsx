'use client';
import { useEffect, useState } from 'react';
import { Camiseta } from './Camiseta';
import { toast } from './Toast';

/** Tarjeta del sorteo en la billetera, con el botón "Estoy presente". */
export function SorteoVisitante({ abiertoIni, presenteIni }: { abiertoIni: boolean; presenteIni: boolean }) {
  const [abierto, setAbierto] = useState(abiertoIni);
  const [presente, setPresente] = useState(presenteIni);
  const [enviando, setEnviando] = useState(false);

  // Se actualiza sola: cuando la organización abre el sorteo, aparece el botón.
  useEffect(() => {
    if (presente) return;
    const t = setInterval(async () => {
      if (document.hidden) return;
      const r = await fetch('/api/sorteo/estado', { cache: 'no-store' }).catch(() => null);
      if (!r?.ok) return;
      const j = await r.json();
      setAbierto(j.abierto);
      setPresente(j.presente);
    }, 15000);
    return () => clearInterval(t);
  }, [presente]);

  async function confirmar() {
    setEnviando(true);
    const r = await fetch('/api/sorteo/presente', { method: 'POST' }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setEnviando(false);
    if (!r || !r.ok) return toast(j.error || 'No se pudo confirmar. Probá de nuevo.');
    setPresente(true);
    toast('¡Listo! Ya estás participando. Mirá la pantalla gigante.');
  }

  return (
    <section className="sorteo-card" aria-labelledby="sorteoTit">
      <Camiseta ancho={84} className="sorteo-cam" />
      <div>
        <h2 id="sorteoTit">¡Quiero la camiseta de Enzo!</h2>
        <p>Sorteamos una camiseta entre todos los inscriptos al final del evento.</p>
        {presente ? (
          <p className="sorteo-ok" role="status">✓ Estás participando. ¡Suerte!</p>
        ) : abierto ? (
          <button className="sorteo-btn" onClick={confirmar} disabled={enviando}>{enviando ? 'Un momento…' : 'Estoy presente'}</button>
        ) : (
          <p className="sorteo-nota">Ya estás inscripto. Al final del evento, tocá acá &quot;Estoy presente&quot; para entrar al sorteo.</p>
        )}
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
        <p>Registrate y participá del sorteo de una camiseta entre todos los inscriptos, al final del evento.</p>
      </div>
    </section>
  );
}
