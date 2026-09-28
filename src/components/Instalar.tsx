'use client';
import { useEffect, useState } from 'react';

type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
const CLAVE = 'mc-instalar-oculto';

/** Invita a agregar la app a la pantalla de inicio del celular. */
export function Instalar() {
  const [modo, setModo] = useState<'android' | 'ios' | 'manual' | null>(null);
  const [evento, setEvento] = useState<PromptEvent | null>(null);

  useEffect(() => {
    const instalada = window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone;
    let oculto = false;
    try {
      oculto = localStorage.getItem(CLAVE) === '1';
    } catch {}
    if (instalada || oculto) return;
    const ua = navigator.userAgent;
    const ios = /iPhone|iPad|iPod/.test(ua) || (ua.includes('Mac') && 'ontouchend' in document);
    if (ios) {
      setModo('ios');
      return;
    }
    const f = (e: Event) => {
      e.preventDefault();
      setEvento(e as PromptEvent);
      setModo('android');
    };
    window.addEventListener('beforeinstallprompt', f);
    // Si el navegador no ofrece instalar solo, mostramos cómo hacerlo desde el menú.
    const t = setTimeout(() => setModo((m) => m ?? (/Android/.test(ua) ? 'manual' : null)), 2500);
    const ok = () => setModo(null);
    window.addEventListener('appinstalled', ok);
    return () => {
      window.removeEventListener('beforeinstallprompt', f);
      window.removeEventListener('appinstalled', ok);
      clearTimeout(t);
    };
  }, []);

  if (!modo) return null;
  const cerrar = () => {
    setModo(null);
    try {
      localStorage.setItem(CLAVE, '1');
    } catch {}
  };

  return (
    <div className="instalar" role="region" aria-label="Agregar a la pantalla de inicio">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icono-192.png" alt="" width={44} height={44} />
      <div>
        <b>Tené tus cupones a un toque</b>
        {modo === 'android' && <p>Agregá la app a la pantalla de inicio de tu celular.</p>}
        {modo === 'ios' && (
          <p>
            Tocá <span aria-label="Compartir">Compartir</span> <IconoCompartir /> abajo y después <b>&quot;Agregar a inicio&quot;</b>.
          </p>
        )}
        {modo === 'manual' && <p>Abrí el menú ⋮ del navegador y tocá <b>&quot;Agregar a la pantalla principal&quot;</b>.</p>}
        <div className="instalar-b">
          {modo === 'android' && evento && (
            <button
              className="cu-usar"
              onClick={async () => {
                await evento.prompt();
                const r = await evento.userChoice.catch(() => null);
                if (r?.outcome === 'accepted') setModo(null);
              }}
            >
              Agregar
            </button>
          )}
          <button className="link" onClick={cerrar}>Ahora no</button>
        </div>
      </div>
    </div>
  );
}

function IconoCompartir() {
  return (
    <svg width="14" height="17" viewBox="0 0 14 17" aria-hidden="true" style={{ verticalAlign: '-2px' }}>
      <path d="M7 1v10M3.5 4.5 7 1l3.5 3.5M2 8H1v8h12V8h-1" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
