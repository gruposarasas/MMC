'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '../Toast';

/** POST con JSON. Muestra el error en un aviso y devuelve la respuesta (o null si falló). */
export async function enviar(url: string, cuerpo?: object): Promise<Record<string, unknown> | null> {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: cuerpo ? JSON.stringify(cuerpo) : undefined }).catch(() => null);
  const j = r ? await r.json().catch(() => ({})) : {};
  if (!r || !r.ok) {
    toast((j as { error?: string }).error || 'Algo falló. Revisá la conexión y probá de nuevo.');
    return null;
  }
  return j as Record<string, unknown>;
}

export function Salir({ url, texto = 'Salir' }: { url: string; texto?: string }) {
  const router = useRouter();
  return <button type="button" className="vp-link" onClick={async () => { await enviar(url); router.refresh(); }}>{texto}</button>;
}

/** Recarga la página cada tanto, para ver los consumos nuevos sin tocar nada. */
export function AutoRecarga({ segundos = 30 }: { segundos?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === 'visible') router.refresh(); }, segundos * 1000);
    return () => clearInterval(t);
  }, [router, segundos]);
  return null;
}

/** Reloj con segundos en movimiento (si está quieto, es una captura de pantalla). */
export function Reloj() {
  const [ahora, setAhora] = useState<Date | null>(null);
  useEffect(() => {
    setAhora(new Date());
    const t = setInterval(() => setAhora(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!ahora) return <span className="vp-reloj">--:--:--</span>;
  return <span className="vp-reloj">{ahora.toLocaleTimeString('es-AR', { timeZone: 'America/Argentina/Mendoza', hour12: false })}</span>;
}

export function EntrarAdmin() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [enviando, setEnviando] = useState(false);
  return (
    <div className="vp-entrar">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/vistapueblo/logo-beige.png" alt="Vistapueblo" />
      <h1>Gift cards</h1>
      <p>Backoffice de Vistapueblo</p>
      <form onSubmit={async (e) => { e.preventDefault(); setEnviando(true); const r = await enviar('/api/vp/admin/entrar', { password }); setEnviando(false); if (r) router.refresh(); }}>
        <label htmlFor="vpPass">Contraseña</label>
        <input id="vpPass" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button className="vp-btn" type="submit" disabled={enviando || !password}>{enviando ? 'Entrando…' : 'Entrar'}</button>
      </form>
    </div>
  );
}

/** Ingreso al panel de un local con su clave. */
export function EntrarLocal() {
  const router = useRouter();
  const [clave, setClave] = useState('');
  const [enviando, setEnviando] = useState(false);
  return (
    <div className="vp-entrar">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/vistapueblo/logo-beige.png" alt="Vistapueblo" />
      <h1>Panel del local</h1>
      <p>Gift cards de Vistapueblo: consumos, métricas y cuenta corriente de tu restaurante.</p>
      <form onSubmit={async (e) => { e.preventDefault(); setEnviando(true); const r = await enviar('/api/vp/local/entrar', { clave }); setEnviando(false); if (r) router.refresh(); }}>
        <label htmlFor="vpClave">Clave del local</label>
        <input id="vpClave" autoCapitalize="characters" autoComplete="off" spellCheck={false} value={clave} onChange={(e) => setClave(e.target.value.toUpperCase())} maxLength={12} />
        <button className="vp-btn" type="submit" disabled={enviando || clave.replace(/[^0-9A-Z]/g, '').length < 8}>{enviando ? 'Entrando…' : 'Entrar'}</button>
      </form>
    </div>
  );
}

/** Abre el diálogo de impresión apenas carga la página (una sola vez). */
export function AutoImprimir() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 600);
    return () => clearTimeout(t);
  }, []);
  return <button type="button" className="vp-btn" onClick={() => window.print()}>🖨 Imprimir</button>;
}
