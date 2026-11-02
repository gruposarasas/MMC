'use client';
import { useEffect, useRef, useState } from 'react';

type Fichado = { id: string; tipo: 'entrada' | 'salida'; hora: string; nombre: string };
type Respuesta = { svg: string; ventana: number; restanteMs: number; ahora: number; fichajes: Fichado[] };

const DURACION = 5000;
const formatoHora = new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Mendoza', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

// El QR lo genera el servidor en cada ventana de 5 s; la barra y el reloj usan la hora del servidor. Si se corta
// internet, se oculta el QR: uno viejo no sirve. (Adaptado de la pantalla de la app de Sara.)
export function PantallaQR({ lugar }: { lugar: string }) {
  const [qr, setQr] = useState<Respuesta | null>(null);
  const [sinConexion, setSinConexion] = useState(false);
  const [ahora, setAhora] = useState<number | null>(null);
  const [completa, setCompleta] = useState(true);
  const diferencia = useRef(0); // hora del servidor − hora del equipo

  useEffect(() => {
    let cancelado = false;
    let espera: ReturnType<typeof setTimeout>;
    const pedir = async () => {
      const t0 = Date.now();
      try {
        const r = await fetch('/api/qr', { cache: 'no-store' });
        if (r.status === 403) { window.location.reload(); return; }
        if (!r.ok) throw new Error(String(r.status));
        const d: Respuesta = await r.json();
        const t1 = Date.now();
        diferencia.current = d.ahora - (t0 + t1) / 2;
        if (cancelado) return;
        setQr(d);
        setSinConexion(false);
        espera = setTimeout(pedir, Math.max(d.restanteMs - (t1 - t0) / 2, 0) + 40);
      } catch {
        if (cancelado) return;
        setSinConexion(true);
        espera = setTimeout(pedir, 2000);
      }
    };
    pedir();
    return () => { cancelado = true; clearTimeout(espera); };
  }, []);

  useEffect(() => {
    const i = setInterval(() => setAhora(Date.now() + diferencia.current), 100);
    return () => clearInterval(i);
  }, []);

  // Que la pantalla no se apague (tablets) y botón de pantalla completa.
  useEffect(() => {
    let bloqueo: { release: () => Promise<void> } | null = null;
    const pedirBloqueo = async () => {
      try {
        bloqueo = (await (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<typeof bloqueo> } }).wakeLock?.request('screen')) ?? null;
      } catch { /* no disponible */ }
    };
    const alVolver = () => { if (document.visibilityState === 'visible') pedirBloqueo(); };
    const alCambiar = () => setCompleta(!!document.fullscreenElement);
    pedirBloqueo();
    alCambiar();
    document.addEventListener('visibilitychange', alVolver);
    document.addEventListener('fullscreenchange', alCambiar);
    return () => {
      bloqueo?.release().catch(() => {});
      document.removeEventListener('visibilitychange', alVolver);
      document.removeEventListener('fullscreenchange', alCambiar);
    };
  }, []);

  // El código vale para su ventana y la siguiente: si pasó más, no se muestra.
  const vigente = !!qr && ahora !== null && Math.floor(ahora / DURACION) - qr.ventana <= 1 && !sinConexion;
  const restante = ahora === null ? 0 : DURACION - (ahora % DURACION);
  const fichados = sinConexion ? [] : qr?.fichajes ?? [];

  return (
    <div className="kiosco">
      {fichados.length > 0 && (
        <aside className="fichados" aria-live="polite" aria-label="Últimos fichajes">
          {fichados.map((f) => (
            <div className="fichado" key={f.id}>
              <div className="sin-foto">{f.nombre[0]}</div>
              <div><b>{f.nombre}</b><span className={f.tipo}>{f.tipo === 'entrada' ? 'Entrada' : 'Salida'} · {f.hora}</span></div>
            </div>
          ))}
        </aside>
      )}
      <img src="/b-crema.png" alt="Bruno Brown" style={{ width: 56, marginBottom: 10 }} />
      <p style={{ color: 'var(--arena)', margin: '0 0 12px', letterSpacing: '.08em', textTransform: 'uppercase', fontSize: 13 }}>{lugar}</p>
      <h1>Fichá tu entrada y salida</h1>
      <p style={{ color: 'var(--arena)', marginTop: 8, maxWidth: 420 }}>Abrí tu app de Bruno Brown, tocá Fichar y escaneá este código. Cambia cada 5 segundos.</p>
      <div className="qrbig" aria-live="polite">
        {vigente
          ? <div className="qr-svg" data-ventana={qr!.ventana} dangerouslySetInnerHTML={{ __html: qr!.svg }} />
          : <div className="qr-espera">{sinConexion ? 'Sin conexión. Reintentando…' : 'Cargando…'}</div>}
      </div>
      <div className="barra-qr"><i style={{ width: `${vigente ? (restante / DURACION) * 100 : 0}%` }} /></div>
      <p style={{ fontSize: 40, fontWeight: 700, marginTop: 16 }} aria-label="Hora">{ahora !== null ? formatoHora.format(new Date(ahora)) : ''}</p>
      {!completa && (
        <button className="link" style={{ marginTop: 18, color: 'var(--arena)', background: 'none', border: 0 }}
          onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})}>
          Pantalla completa
        </button>
      )}
    </div>
  );
}
