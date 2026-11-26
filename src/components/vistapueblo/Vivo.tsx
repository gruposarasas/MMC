'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { pesos } from '@/lib/vistapueblo';

type Qr = { w: number; svg?: string; numero?: string; restan: number };
type Respuesta = Qr & { saldo: number; n: number; ultimo: { monto: number; local: string } | null };

/**
 * QR de la tarjeta del cliente: cambia cada 30 segundos (una captura de pantalla no sirve).
 * Mientras está abierta, consulta cada pocos segundos: si la caja registra un consumo, el cliente lo ve al instante.
 */
export function QrVivo({ token, codigo, inicial, consumos }: { token: string; codigo: string; inicial: Required<Qr>; consumos: number }) {
  const router = useRouter();
  const [qr, setQr] = useState({ svg: inicial.svg, numero: inicial.numero, w: inicial.w });
  const [fin, setFin] = useState(() => Date.now() + inicial.restan);
  const [ahora, setAhora] = useState(() => Date.now());
  const [aviso, setAviso] = useState<{ monto: number; local: string; saldo: number } | null>(null);
  const n = useRef(consumos);
  const w = useRef(inicial.w);
  const ocupado = useRef(false);

  const consultar = useCallback(async () => {
    if (ocupado.current || document.visibilityState !== 'visible') return;
    ocupado.current = true;
    try {
      const r = await fetch(`/api/vp/vivo?t=${encodeURIComponent(token)}&w=${w.current}`, { cache: 'no-store' });
      if (!r.ok) return;
      const d = (await r.json()) as Respuesta;
      if (d.svg && d.numero) { w.current = d.w; setQr({ svg: d.svg, numero: d.numero, w: d.w }); }
      setFin(Date.now() + d.restan);
      if (d.n > n.current && d.ultimo) { setAviso({ ...d.ultimo, saldo: d.saldo }); router.refresh(); }
      n.current = d.n;
    } catch { /* sin conexión: se reintenta en la próxima vuelta */ } finally { ocupado.current = false; }
  }, [token, router]);

  useEffect(() => {
    const reloj = setInterval(() => setAhora(Date.now()), 1000);
    const sondeo = setInterval(consultar, 5000);
    const volver = () => { if (document.visibilityState === 'visible') consultar(); };
    document.addEventListener('visibilitychange', volver);
    return () => { clearInterval(reloj); clearInterval(sondeo); document.removeEventListener('visibilitychange', volver); };
  }, [consultar]);
  useEffect(() => { if (ahora >= fin) consultar(); }, [ahora, fin, consultar]);

  const restan = Math.max(0, Math.ceil((fin - ahora) / 1000));
  return (
    <>
      <section className="vp-qr vivo" aria-live="polite">
        <div className="vp-qr-img" dangerouslySetInnerHTML={{ __html: qr.svg }} />
        <div>
          <p className="vp-qr-t">Mostrale este QR al cajero</p>
          <p className="vp-qr-cambia"><span className="vp-qr-anillo" style={{ ['--p' as string]: `${(restan / 30) * 100}%` }} aria-hidden="true" />Cambia en {restan} s</p>
          <p className="vp-qr-c">{codigo}<br /><span>{qr.numero.slice(0, 3)} {qr.numero.slice(3)}</span></p>
          <p className="vp-qr-nota">Una captura de pantalla no sirve: el código cambia solo.</p>
        </div>
      </section>
      {aviso && (
        <div className="vp-valido cliente" role="alert">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/vistapueblo/logo-blanco.png" alt="Vistapueblo" className="vp-valido-logo" />
          <div className="vp-valido-ok" aria-hidden="true">✓</div>
          <p className="vp-valido-t">¡Listo! Se descontaron</p>
          <p className="vp-valido-monto">{pesos(aviso.monto)}</p>
          <p>en {aviso.local}</p>
          <p className="vp-valido-n">{aviso.saldo ? `Te quedan ${pesos(aviso.saldo)}` : 'Usaste toda la gift card. ¡Gracias por visitarnos!'}</p>
          <button type="button" className="vp-btn blanco" onClick={() => setAviso(null)}>Ver mi gift card</button>
        </div>
      )}
    </>
  );
}

const aBytes = (b64: string) => {
  const s = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
};

/** "Avisame cuando la use": notificación en el celular en cada consumo (aunque la página esté cerrada). */
export function ActivarAvisos({ token, clave }: { token: string; clave: string }) {
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'activo' | 'no' | 'iphone' | 'bloqueado' | 'trabajando'>('cargando');
  useEffect(() => {
    (async () => {
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const instalada = window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return setEstado(ios && !instalada ? 'iphone' : 'no');
      if (Notification.permission === 'denied') return setEstado('bloqueado');
      const reg = await navigator.serviceWorker.getRegistration('/vistapueblo/').catch(() => undefined);
      const sub = await reg?.pushManager.getSubscription().catch(() => null);
      setEstado(sub && Notification.permission === 'granted' ? 'activo' : 'listo');
    })();
  }, []);

  if (estado === 'cargando' || estado === 'no') return null;
  if (estado === 'activo') return <p className="vp-avisos ok">🔔 Te avisamos en este celular cada vez que la uses.</p>;
  if (estado === 'bloqueado') return <p className="vp-avisos">Las notificaciones están bloqueadas para esta página. Podés habilitarlas desde la configuración del navegador.</p>;
  if (estado === 'iphone') return <p className="vp-avisos">🔔 Para recibir un aviso cada vez que la uses, agregala a tu pantalla de inicio: tocá <b>Compartir</b> y después <b>Agregar a inicio</b>, y abrila desde ahí.</p>;
  return (
    <button type="button" className="vp-avisos-btn" disabled={estado === 'trabajando'} onClick={async () => {
      setEstado('trabajando');
      try {
        if ((await Notification.requestPermission()) !== 'granted') return setEstado('bloqueado');
        const reg = await navigator.serviceWorker.register('/vistapueblo/sw.js', { scope: '/vistapueblo/' });
        await navigator.serviceWorker.ready;
        const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: aBytes(clave) }));
        const r = await fetch('/api/vp/push', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token, sub: sub.toJSON() }) });
        setEstado(r.ok ? 'activo' : 'listo');
      } catch {
        setEstado('listo');
      }
    }}>{estado === 'trabajando' ? 'Activando…' : '🔔 Avisame cada vez que la use'}</button>
  );
}
