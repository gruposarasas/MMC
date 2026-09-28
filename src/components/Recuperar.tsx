'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import recursos from '@/lib/recursos.json';
import type { Via } from '@/lib/validar';

export function Recuperar() {
  const router = useRouter();
  const [via, setVia] = useState<Via>('mail');
  const [valor, setValor] = useState('');
  const [err, setErr] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function recuperar(ev: React.FormEvent) {
    ev.preventDefault();
    const c = via === 'mail' ? valor.trim().toLowerCase() : valor.replace(/\D/g, '');
    if (!c) return setErr(via === 'mail' ? 'Escribí tu mail.' : 'Escribí tu número.');
    setEnviando(true);
    try {
      const r = await fetch('/api/recuperar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ via, contacto: c }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErr(j.error || 'No pudimos buscar tus cupones. Probá de nuevo.');
        setEnviando(false);
        return;
      }
      router.replace('/billetera?aviso=rec');
      router.refresh();
    } catch {
      setErr('Sin conexión. Revisá tu internet y probá de nuevo.');
      setEnviando(false);
    }
  }

  return (
    <div className="tel-in">
      <Link className="link" href="/">← Volver</Link>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="logo" src={recursos.logo} alt="Mundial de Café by Bruno Brown" style={{ width: 150, marginTop: 18 }} />
      <h1 className="h1" style={{ fontSize: 26 }}>Recuperá tus cupones</h1>
      <p className="lead">Escribí el mail o el WhatsApp con el que te registraste.</p>
      <form onSubmit={recuperar} noValidate>
        <div className="campo">
          <div className="seg" role="group" aria-label="Cómo te registraste">
            {(['mail', 'wa'] as const).map((v) => (
              <button key={v} type="button" className={via === v ? 'on' : ''} aria-pressed={via === v} onClick={() => { setVia(v); setValor(''); setErr(''); }}>
                {v === 'mail' ? 'Mail' : 'WhatsApp'}
              </button>
            ))}
          </div>
        </div>
        <div className={`campo ${err ? 'error' : ''}`}>
          {via === 'mail' ? (
            <>
              <label htmlFor="recCon">Tu mail</label>
              <input id="recCon" type="email" inputMode="email" autoComplete="email" placeholder="nombre@mail.com" value={valor} onChange={(e) => setValor(e.target.value)} maxLength={200} />
            </>
          ) : (
            <>
              <label htmlFor="recCon">Tu WhatsApp</label>
              <input id="recCon" type="tel" inputMode="tel" autoComplete="tel" placeholder="261 555 1234" value={valor} onChange={(e) => setValor(e.target.value)} maxLength={20} />
            </>
          )}
          {err && <div className="err" role="alert">{err}</div>}
        </div>
        <button className="btn" type="submit" disabled={enviando}>{enviando ? 'Buscando…' : 'Ver mis cupones'}</button>
      </form>
    </div>
  );
}
