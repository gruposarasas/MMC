'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import recursos from '@/lib/recursos.json';
import { Camiseta } from '../Camiseta';
import { toast } from '../Toast';

type Presente = { id: string; n: string };
type Ganador = { id: number; nombre: string; cuando: string };
type Estado = { abierto: boolean; presentes: Presente[]; ganadores: Ganador[] };
type Fase = 'espera' | 'cuenta' | 'ganador';

const MAX_VISIBLES = 160;
const SEGUNDOS = 10;

export function PantallaSorteo({ inicial, qr, url }: { inicial: Estado; qr: string; url: string }) {
  const [e, setE] = useState<Estado>(inicial);
  const [fase, setFase] = useState<Fase>('espera');
  const [cuenta, setCuenta] = useState(SEGUNDOS);
  const [ganador, setGanador] = useState<{ nombre: string; entre: number } | null>(null);
  const [nuevos, setNuevos] = useState<Set<string>>(new Set());
  const conocidos = useRef(new Set(inicial.presentes.map((p) => p.id)));

  // Actualización permanente mientras se espera.
  useEffect(() => {
    if (fase !== 'espera') return;
    let vivo = true;
    const traer = async () => {
      const r = await fetch('/api/admin/sorteo', { cache: 'no-store' }).catch(() => null);
      if (!r || !vivo) return;
      if (r.status === 401) return toast('La sesión de administración venció. Volvé a entrar.');
      if (!r.ok) return;
      const j: Estado = await r.json();
      const n = new Set<string>();
      for (const p of j.presentes) if (!conocidos.current.has(p.id)) { n.add(p.id); conocidos.current.add(p.id); }
      if (n.size) setNuevos(n);
      setE(j);
    };
    const t = setInterval(traer, 3000);
    return () => { vivo = false; clearInterval(t); };
  }, [fase]);

  const accion = useCallback(async (a: string) => {
    const r = await fetch('/api/admin/sorteo', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ accion: a }) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (!r || !r.ok) { toast(j.error || 'Algo falló. Probá de nuevo.'); return null; }
    return j;
  }, []);

  async function sortear() {
    if (!disponibles.length) return toast('No hay presentes para sortear.');
    const j = await accion('sortear');
    if (!j?.ganador) return;
    setGanador({ nombre: j.ganador.nombre, entre: j.ganador.entre });
    setCuenta(SEGUNDOS);
    setFase('cuenta');
  }

  // Cuenta regresiva.
  useEffect(() => {
    if (fase !== 'cuenta') return;
    if (cuenta <= 0) {
      const t = setTimeout(() => setFase('ganador'), 700);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setCuenta((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [fase, cuenta]);

  const disponibles = e.presentes;
  const visibles = disponibles.slice(-MAX_VISIBLES);

  const pantallaCompleta = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen().catch(() => {});
  };

  return (
    <div className={`sx fase-${fase}`}>
      <div className="sx-banda" aria-hidden="true" />
      <header className="sx-cab">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={recursos.logoOsc} alt="Mundial de Café by Bruno Brown" className="sx-logo" />
        <h1>¡Quiero la camiseta de <span>Enzo</span>!</h1>
        <div className="sx-contador" aria-live="polite"><b>{disponibles.length}</b><span>presentes</span></div>
      </header>

      {fase === 'espera' && (
        <>
          <main className="sx-nombres" aria-label="Personas presentes">
            {visibles.length === 0 && <p className="sx-vacio">Esperando a los primeros presentes…</p>}
            {visibles.map((p) => (
              <span key={p.id} className={`sx-chip ${nuevos.has(p.id) ? 'nuevo' : ''}`}>{p.n}</span>
            ))}
            {disponibles.length > MAX_VISIBLES && <span className="sx-chip mas">y {disponibles.length - MAX_VISIBLES} más</span>}
          </main>
          <footer className="sx-pie">
            <div className="sx-qr" dangerouslySetInnerHTML={{ __html: qr }} />
            <div>
              <b>{e.abierto ? '¿Estás acá? ¡Participá!' : 'El sorteo todavía no está abierto'}</b>
              <p>Entrá a <strong>{url.replace('https://', '')}</strong> y tocá <strong>&quot;Estoy presente&quot;</strong> en tu billetera.</p>
            </div>
            <Camiseta ancho={130} className="sx-cam" />
          </footer>
        </>
      )}

      {fase === 'cuenta' && ganador && <Show nombres={disponibles.map((p) => p.n)} cuenta={cuenta} />}

      {fase === 'ganador' && ganador && (
        <div className="sx-ganador" role="dialog" aria-label="Ganador">
          <Papelitos />
          <Camiseta ancho={200} className="sx-gcam" />
          <p className="sx-glabel">¡La camiseta de Enzo es para…!</p>
          <p className="sx-gnombre">{ganador.nombre}</p>
          <p className="sx-gentre">Sorteado entre {ganador.entre} presentes</p>
        </div>
      )}

      {/* Controles del operador */}
      <nav className="sx-ctrl" aria-label="Controles del sorteo">
        {fase === 'espera' && (
          <>
            <button className="sx-sortear" onClick={sortear} disabled={!disponibles.length}>SORTEAR</button>
            <button onClick={async () => { const j = await accion(e.abierto ? 'cerrar' : 'abrir'); if (j) setE(j); }}>
              {e.abierto ? 'Cerrar inscripción' : 'Abrir inscripción'}
            </button>
          </>
        )}
        {fase === 'ganador' && (
          <>
            <button onClick={() => { setGanador(null); setFase('espera'); }}>Volver</button>
            <button onClick={() => { setGanador(null); setFase('espera'); setTimeout(sortear, 50); }}>Sortear otra vez</button>
          </>
        )}
        <button onClick={pantallaCompleta}>Pantalla completa</button>
        {fase === 'espera' && (
          <>
            <button
              onClick={async () => {
                if (!confirm('¿Reiniciar el sorteo? Se borran los presentes y los ganadores anteriores.')) return;
                const j = await accion('limpiar');
                if (j) { conocidos.current = new Set(); setE(j); }
              }}
            >
              Reiniciar
            </button>
            <Link href="/admin">Salir</Link>
          </>
        )}
        {e.ganadores.length > 0 && fase === 'espera' && (
          <span className="sx-hist">Ganadores: {e.ganadores.map((g) => g.nombre).join(' · ')}</span>
        )}
      </nav>
    </div>
  );
}

/** Los nombres rebotan por la pantalla mientras corre la cuenta regresiva. */
function Show({ nombres, cuenta }: { nombres: string[]; cuenta: number }) {
  const elegidos = useMemo(() => {
    const a = [...nombres];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a.slice(0, 48);
  }, [nombres]);
  const refs = useRef<(HTMLSpanElement | null)[]>([]);
  const cuentaRef = useRef(cuenta);
  cuentaRef.current = cuenta;

  useEffect(() => {
    const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const W = window.innerWidth, H = window.innerHeight;
    const cuerpos = elegidos.map(() => ({
      x: Math.random() * (W - 200), y: 120 + Math.random() * (H - 260),
      vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 6,
      r: (Math.random() - 0.5) * 30, vr: (Math.random() - 0.5) * 4,
    }));
    let raf = 0;
    const paso = () => {
      const turbo = 1 + (SEGUNDOS - cuentaRef.current) * 0.35; // cada vez más rápido
      cuerpos.forEach((c, i) => {
        const el = refs.current[i];
        if (!el) return;
        if (!reducido) {
          c.x += c.vx * turbo; c.y += c.vy * turbo; c.r += c.vr * turbo;
          const w = el.offsetWidth, h = el.offsetHeight;
          if (c.x < 0 || c.x > W - w) { c.vx *= -1; c.x = Math.max(0, Math.min(W - w, c.x)); }
          if (c.y < 90 || c.y > H - h - 20) { c.vy *= -1; c.y = Math.max(90, Math.min(H - h - 20, c.y)); }
        }
        el.style.transform = `translate(${c.x}px, ${c.y}px) rotate(${c.r}deg)`;
      });
      raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(raf);
  }, [elegidos]);

  return (
    <div className="sx-show" aria-live="assertive">
      {elegidos.map((n, i) => (
        <span key={i} ref={(el) => { refs.current[i] = el; }} className={`sx-vuela t${i % 4}`}>{n}</span>
      ))}
      <div className={`sx-cuenta ${cuenta === 0 ? 'cero' : ''}`} key={cuenta}>{cuenta}</div>
    </div>
  );
}

function Papelitos() {
  const piezas = useMemo(
    () => Array.from({ length: 140 }, (_, i) => ({
      left: Math.random() * 100, delay: Math.random() * 2.5, dur: 3 + Math.random() * 3,
      color: ['#D71920', '#ffffff', '#D71920', '#C2A27B', '#281722'][i % 5], w: 8 + Math.random() * 10, rot: Math.random() * 360,
    })),
    [],
  );
  return (
    <div className="sx-papelitos" aria-hidden="true">
      {piezas.map((p, i) => (
        <i key={i} style={{ left: `${p.left}%`, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s`, background: p.color, width: p.w, height: p.w * 0.45, transform: `rotate(${p.rot}deg)` }} />
      ))}
    </div>
  );
}
