'use client';
import { useState } from 'react';
import { toast } from './Toast';

/** Perfil del barista: votarlo como favorito (una sola vez) y mandarle un mensaje de aliento. */
export function AccionesBarista({ id, nombre, voto: inicial, abierto, mensajes }: { id: string; nombre: string; voto: string | null; abierto: boolean; mensajes: number }) {
  const [voto, setVoto] = useState(inicial);
  const [texto, setTexto] = useState('');
  const [n, setN] = useState(mensajes);
  const [enviando, setEnviando] = useState(false);
  const primer = nombre.split(' ')[0];

  async function post(url: string, cuerpo: object) {
    setEnviando(true);
    const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setEnviando(false);
    if (!r || !r.ok) { toast(j.error || 'Algo falló. Probá de nuevo.'); return false; }
    return true;
  }

  async function votar() {
    if (!confirm(`¿Elegir a ${nombre} como tu barista favorito? Se puede votar una sola vez.`)) return;
    if (await post('/api/votar', { tipo: 'barista', id })) { setVoto(id); toast(`¡Votaste a ${primer}!`); }
  }

  async function mandar(ev: React.FormEvent) {
    ev.preventDefault();
    if (!texto.trim()) return;
    if (await post('/api/baristas/mensaje', { barista: id, texto })) { setTexto(''); setN((x) => x + 1); toast(`Mensaje enviado. ¡${primer} lo va a ver!`); }
  }

  return (
    <>
      <section className="perfil-fav">
        {voto === id ? (
          <p className="sorteo-ok">★ Es tu barista favorito</p>
        ) : voto ? (
          <p>Ya votaste a tu barista favorito.</p>
        ) : abierto ? (
          <>
            <p>El barista más votado por el público gana un premio.</p>
            <button className="btn vino" onClick={votar} disabled={enviando}>★ Es mi favorito</button>
          </>
        ) : (
          <p>La votación del barista favorito cerró.</p>
        )}
      </section>
      <form className="perfil-msj" onSubmit={mandar}>
        <h2>Mandale aliento a {primer}</h2>
        <p className="ayuda" style={{ marginTop: 0 }}>{n ? `Ya recibió ${n} mensaje${n === 1 ? '' : 's'} de aliento.` : 'Sé el primero en darle aliento.'} Lo lee solo {primer}.</p>
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={280} rows={3} placeholder={`¡Vamos, ${primer}!`} aria-label={`Mensaje para ${nombre}`} />
        <div className="fila" style={{ marginTop: 8 }}>
          <span className="ayuda" style={{ margin: 0 }}>{texto.length}/280</span>
          <button className="btn chico" type="submit" disabled={enviando || !texto.trim()}>Enviar</button>
        </div>
      </form>
    </>
  );
}
