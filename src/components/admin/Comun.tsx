'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import recursos from '@/lib/recursos.json';
import { toast } from '../Toast';

export function EntrarAdmin() {
  const router = useRouter();
  const [pass, setPass] = useState('');
  const [enviando, setEnviando] = useState(false);
  async function entrar(ev: React.FormEvent) {
    ev.preventDefault();
    setEnviando(true);
    const r = await fetch('/api/admin/entrar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: pass }) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setEnviando(false);
    if (!r || !r.ok) return toast(j.error || 'No pudimos entrar.');
    router.refresh();
  }
  return (
    <div className="tel" style={{ maxWidth: 460 }}>
      <div className="tel-in">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="logo" src={recursos.logo} alt="Mundial de Café" style={{ width: 160 }} />
        <h1 className="h1" style={{ fontSize: 26 }}>Back office</h1>
        <p className="lead">Entrá con la contraseña de la organización.</p>
        <form onSubmit={entrar}>
          <div className="campo">
            <label htmlFor="aPass">Contraseña</label>
            <input id="aPass" type="password" autoComplete="current-password" value={pass} onChange={(e) => setPass(e.target.value)} />
          </div>
          <button className="btn" type="submit" disabled={enviando || !pass}>{enviando ? 'Entrando…' : 'Entrar'}</button>
        </form>
      </div>
    </div>
  );
}

export function SalirAdmin() {
  const router = useRouter();
  return (
    <button className="salir" onClick={async () => { await fetch('/api/admin/salir', { method: 'POST' }).catch(() => {}); router.refresh(); }}>
      Salir
    </button>
  );
}

/** fetch JSON con manejo de errores y aviso. Devuelve el JSON o null si falló. */
export async function pedir(url: string, metodo: string, cuerpo?: unknown) {
  try {
    const r = await fetch(url, { method: metodo, headers: { 'content-type': 'application/json' }, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      toast(j.error || 'Algo falló. Probá de nuevo.');
      return null;
    }
    return j;
  } catch {
    toast('Sin conexión. Probá de nuevo.');
    return null;
  }
}

export async function copiar(texto: string, ok: string) {
  try {
    await navigator.clipboard.writeText(texto);
    toast(ok);
  } catch {
    toast('No se pudo copiar.');
  }
}
