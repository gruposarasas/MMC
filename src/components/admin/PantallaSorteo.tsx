'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import recursos from '@/lib/recursos.json';
import { SORTEO_DNI, SORTEO_PRESENTE, type Ventana } from '@/lib/config';
import { Camiseta } from '../Camiseta';
import { toast } from '../Toast';

type Presente = { id: string; n: string };
type Ganador = { id: number; vid: string; nombre: string; cuando: string };
type Estado = { ventana: Ventana; prueba: boolean; habilitada: boolean; presentes: Presente[]; ganadores: Ganador[] };
type Fase = 'espera' | 'ruleta' | 'ganador';

const MAX_VISIBLES = 160;
const DURACION = 10000; // la ruleta gira 10 segundos
const EN_RUEDA = 50; // casilleros de la ruleta (el ganador sale entre TODOS los presentes)

export function PantallaSorteo({ inicial, qr, url }: { inicial: Estado; qr: string; url: string }) {
  const [e, setE] = useState<Estado>(inicial);
  const [fase, setFase] = useState<Fase>('espera');
  const [ganador, setGanador] = useState<{ id: string; nombre: string; entre: number } | null>(null);
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
    setGanador({ id: j.ganador.id, nombre: j.ganador.nombre, entre: j.ganador.entre });
    setFase('ruleta');
  }

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
              <b>{e.habilitada ? '¿Estás acá? ¡Participá!' : e.ventana === 'antes' ? SORTEO_PRESENTE : 'La inscripción cerró'}</b>
              <p>Entrá a <strong>{url.replace('https://', '')}</strong> y tocá <strong>&quot;Estoy presente&quot;</strong> en tu billetera.{e.prueba && ' (modo prueba)'}</p>
              <p className="sx-dni">{SORTEO_DNI}</p>
            </div>
            <Camiseta ancho={130} className="sx-cam" />
          </footer>
        </>
      )}

      {fase === 'ruleta' && ganador && (
        <Ruleta
          presentes={disponibles.filter((p) => p.id === ganador.id || !e.ganadores.some((g) => g.vid === p.id))}
          ganadorId={ganador.id}
          entre={ganador.entre}
          onFin={() => setFase('ganador')}
        />
      )}

      {fase === 'ganador' && ganador && (
        <div className="sx-ganador" role="dialog" aria-label="Ganador">
          <Papelitos />
          <Camiseta ancho={200} className="sx-gcam" />
          <p className="sx-glabel">¡La camiseta de Enzo es para…!</p>
          <p className="sx-gnombre">{ganador.nombre}</p>
          <p className="sx-gentre">Sorteado entre {ganador.entre} presentes</p>
          <p className="sx-gdni">{SORTEO_DNI}</p>
        </div>
      )}

      {/* Controles del operador */}
      <nav className="sx-ctrl" aria-label="Controles del sorteo">
        {fase === 'espera' && (
          <>
            <button className="sx-sortear" onClick={sortear} disabled={!disponibles.length}>SORTEAR</button>
            <button
              title="Uso interno: &quot;Estoy presente&quot; se habilita solo el domingo 4 de 18 a 20 hs. El modo prueba lo habilita fuera de ese horario, para ensayar."
              onClick={async () => { const j = await accion(e.prueba ? 'cerrar' : 'abrir'); if (j) setE(j); }}
            >
              {e.prueba ? 'Quitar modo prueba' : 'Modo prueba'}
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

const mezclar = <T,>(a: T[]) => {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
};

/**
 * Ruleta de casino: hasta 50 casilleros con nombres alrededor de una rueda y una
 * bolilla que los recorre, rapidísimo al principio y cada vez más lento, mientras
 * el nombre que toca pasa grande por el centro. Frena en el ganador, que ya eligió
 * el servidor entre TODOS los presentes (la rueda muestra hasta 50 de ellos).
 */
function Ruleta({ presentes, ganadorId, entre, onFin }: { presentes: Presente[]; ganadorId: string; entre: number; onFin: () => void }) {
  const slots = useMemo(() => {
    const g = presentes.find((p) => p.id === ganadorId) ?? { id: ganadorId, n: '…' };
    return mezclar([g, ...mezclar(presentes.filter((p) => p.id !== ganadorId)).slice(0, EN_RUEDA - 1)]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const n = slots.length;
  const gi = slots.findIndex((s) => s.id === ganadorId);
  const [act, setAct] = useState(0);
  const [paso, setPaso] = useState(0);
  const [ms, setMs] = useState(40);
  const [resta, setResta] = useState(DURACION / 1000);
  const [fin, setFin] = useState(false);
  const [R, setR] = useState(0); // radio de la rueda en px
  const alFin = useRef(onFin);
  alFin.current = onFin;

  useEffect(() => {
    const medir = () => setR(Math.round(Math.min(window.innerHeight * 0.39, window.innerWidth * 0.3)));
    medir();
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  }, []);

  useEffect(() => {
    const vueltas = n === 1 ? 10 : n < 8 ? 6 : n < 20 ? 4 : 3;
    const pasos = vueltas * n + gi;
    // Cada paso tarda más que el anterior: arranca rapidísimo y frena como la bolilla.
    const pesos = Array.from({ length: pasos }, (_, k) => 1 + 18 * Math.pow(k / pasos, 3));
    const escala = (DURACION - 400) / pesos.reduce((a, b) => a + b, 0);
    const inicio = performance.now();
    let k = 0;
    let t: ReturnType<typeof setTimeout>;
    const tick = () => {
      k++;
      setAct(k % n);
      setPaso(k);
      if (k >= pasos) {
        setFin(true);
        setResta(0);
        t = setTimeout(() => alFin.current(), 2400);
        return;
      }
      setMs(Math.round(pesos[k] * escala));
      t = setTimeout(tick, pesos[k] * escala);
    };
    t = setTimeout(tick, pesos[0] * escala);
    const reloj = setInterval(() => setResta(Math.max(0, Math.ceil((DURACION - (performance.now() - inicio)) / 1000))), 100);
    return () => { clearTimeout(t); clearInterval(reloj); };
  }, [n, gi]);

  const paso360 = 360 / n;
  // Casilleros alternados rojo y ciruela, como la ruleta del casino.
  const fondo = useMemo(
    () => `conic-gradient(from ${-paso360 / 2}deg, ${slots.map((_, i) => `${i % 2 ? '#281722' : '#D71920'} ${i * paso360}deg ${(i + 1) * paso360}deg`).join(', ')})`,
    [slots, paso360],
  );
  if (!R) return null;
  const hub = Math.round(R * 0.5); // radio del centro
  const largo = R - hub - 26; // largo del texto de cada casillero
  const fuente = Math.max(10, Math.min(24, (2 * Math.PI * (hub + largo * 0.6)) / n * 0.55));
  const bolaR = R - 13;
  const angBola = paso * paso360; // siempre crece: la bolilla gira hacia adelante

  return (
    <div className={`sx-ruleta ${fin ? 'fin' : ''}`}>
      <div className="sx-rueda" style={{ width: R * 2, height: R * 2, background: fondo }} aria-hidden="true">
        {slots.map((s, i) => {
          const a = i * paso360;
          const der = a <= 180; // mitad derecha: se lee hacia afuera; izquierda: hacia adentro
          return (
            <span
              key={s.id}
              className={`sx-casillero ${i === act ? 'toca' : ''} ${fin && i === act ? 'gana' : ''}`}
              style={{
                width: largo,
                fontSize: fuente,
                transform: der ? `rotate(${a - 90}deg) translate(${hub + 8}px, -50%)` : `rotate(${a + 90}deg) translate(${-(hub + 8 + largo)}px, -50%)`,
                textAlign: der ? 'right' : 'left',
              }}
            >
              {s.n}
            </span>
          );
        })}
        <span
          className="sx-bolilla"
          style={{ transform: `rotate(${angBola}deg) translateY(${-bolaR}px)`, transitionDuration: `${Math.min(ms, 450)}ms` }}
        />
        <div className="sx-hub" style={{ width: hub * 2, height: hub * 2 }}>
          <div className="sx-resta">{fin ? '¡Ganador!' : resta}</div>
          <div className="sx-nombre-centro" key={paso} style={{ fontSize: Math.round(hub * 0.26) }}>{slots[act]?.n}</div>
          <div className="sx-entre">Entre {entre} presentes</div>
        </div>
      </div>
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
