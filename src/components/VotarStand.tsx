'use client';
import { useMemo, useState } from 'react';
import { Emb } from './Emb';
import { toast } from './Toast';
import { VOTOS_TEXTO } from '@/lib/config';
import type { MarcaVoto } from '@/lib/votos';

/** Votación del stand más lindo: el visitante elige una marca y vota una sola vez. */
export function VotarStand({ marcas, voto: inicial, abierto }: { marcas: MarcaVoto[]; voto: string | null; abierto: boolean }) {
  const [voto, setVoto] = useState(inicial);
  const [elegida, setElegida] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [enviando, setEnviando] = useState(false);
  const lista = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? marcas.filter((m) => `${m.nombre} ${m.stand}`.toLowerCase().includes(t)) : marcas;
  }, [q, marcas]);
  const votada = marcas.find((m) => m.id === voto);
  const sel = marcas.find((m) => m.id === elegida);

  async function votar() {
    if (!sel || !confirm(`¿Votar a ${sel.nombre} como el stand más lindo? Se puede votar una sola vez.`)) return;
    setEnviando(true);
    const r = await fetch('/api/votar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ tipo: 'stand', id: sel.id }) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setEnviando(false);
    if (!r || !r.ok) return toast(j.error || 'No se pudo votar. Probá de nuevo.');
    setVoto(sel.id);
    toast('¡Gracias por votar!');
  }

  if (votada)
    return (
      <div className="voto-ok">
        <Emb logoUrl={votada.logo} emblema={votada.emblema} nombre={votada.nombre} t={72} />
        <div>
          <p>Tu voto</p>
          <b>{votada.nombre}</b>
          <span>{abierto ? VOTOS_TEXTO : 'La votación cerró.'}</span>
        </div>
      </div>
    );
  if (!abierto) return <p className="lead">La votación ya cerró.</p>;

  return (
    <>
      <input className="buscar-v" type="search" placeholder="Buscar marca" aria-label="Buscar marca" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="votables" role="radiogroup" aria-label="Marcas">
        {lista.map((m) => (
          <button key={m.id} role="radio" aria-checked={elegida === m.id} className={`votable ${elegida === m.id ? 'on' : ''}`} onClick={() => setElegida(m.id)}>
            <Emb logoUrl={m.logo} emblema={m.emblema} nombre={m.nombre} t={56} />
            <b>{m.nombre}</b>
            {m.stand && <span>{m.stand}</span>}
          </button>
        ))}
        {!lista.length && <p className="lead">No encontramos esa marca.</p>}
      </div>
      <div className="votar-bar">
        <button className="btn" disabled={!sel || enviando} onClick={votar}>
          {enviando ? 'Votando…' : sel ? `Votar a ${sel.nombre}` : 'Elegí un stand'}
        </button>
      </div>
    </>
  );
}
