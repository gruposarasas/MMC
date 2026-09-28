'use client';
import { useEffect, useState } from 'react';

export function toast(texto: string) {
  window.dispatchEvent(new CustomEvent('mc-toast', { detail: texto }));
}

export function Toaster() {
  const [t, setT] = useState<{ texto: string; n: number } | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const f = (e: Event) => {
      setT({ texto: (e as CustomEvent<string>).detail, n: Date.now() });
      clearTimeout(timer);
      timer = setTimeout(() => setT(null), 2800);
    };
    window.addEventListener('mc-toast', f);
    return () => {
      window.removeEventListener('mc-toast', f);
      clearTimeout(timer);
    };
  }, []);
  return t ? (
    <div className="toast" role="status" aria-live="polite" key={t.n}>
      {t.texto}
    </div>
  ) : null;
}

/** Muestra un aviso al cargar la página y lo saca de la URL. */
export function AvisoInicial({ texto }: { texto: string }) {
  useEffect(() => {
    toast(texto);
    const u = new URL(window.location.href);
    u.searchParams.delete('aviso');
    window.history.replaceState(null, '', u.pathname + u.search);
  }, [texto]);
  return null;
}
