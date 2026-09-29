'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import recursos from '@/lib/recursos.json';
import { LLAVE, NOMBRE_RONDA, clasificacion, type Barista, type Partido } from '@/lib/llaves';

type Estado = { fase: 'clasificacion' | 'playoff'; pantalla: 'auto' | 'clasificacion' | 'llaves'; baristas: Barista[]; partidos: Partido[] };

export const fPuntaje = (n: number | null) => (n == null ? '—' : n.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }));

/** Pantalla para proyectar el torneo de baristas. Se actualiza sola cada 3 segundos. */
export function PantallaTorneo({ inicial }: { inicial: Estado }) {
  const [e, setE] = useState<Estado>(inicial);
  const [recien, setRecien] = useState<Set<string>>(new Set());
  const previo = useRef(new Map(inicial.baristas.map((b) => [b.id, b.puntuado_at])));

  useEffect(() => {
    let vivo = true;
    const t = setInterval(async () => {
      if (document.hidden) return;
      const r = await fetch('/api/baristas', { cache: 'no-store' }).catch(() => null);
      if (!r?.ok || !vivo) return;
      const j: Estado = await r.json();
      const nuevos = new Set<string>();
      for (const b of j.baristas) if (b.puntuado_at && previo.current.get(b.id) !== b.puntuado_at) nuevos.add(b.id);
      previo.current = new Map(j.baristas.map((b) => [b.id, b.puntuado_at]));
      if (nuevos.size) {
        setRecien(nuevos);
        setTimeout(() => vivo && setRecien(new Set()), 6000);
      }
      setE(j);
    }, 3000);
    return () => { vivo = false; clearInterval(t); };
  }, []);

  const vista = e.pantalla === 'auto' ? (e.fase === 'playoff' ? 'llaves' : 'clasificacion') : e.pantalla;
  const compitieron = e.baristas.filter((b) => b.puntaje != null).length;

  return (
    <div className="tb">
      <header className="tb-cab">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={recursos.logo} alt="Mundial de Café by Bruno Brown" className="tb-logo" />
        <div className="tb-tit">
          <h1>Torneo de Baristas</h1>
          <p>{vista === 'llaves' ? 'Playoff' : 'Clasificación · 1ª fase'}</p>
        </div>
        {vista === 'clasificacion' && (
          <div className="tb-cuenta"><b>{compitieron}</b><span>/ {e.baristas.length} compitieron</span></div>
        )}
      </header>
      {vista === 'clasificacion' ? <Clasificacion baristas={e.baristas} recien={recien} /> : <Llaves baristas={e.baristas} partidos={e.partidos} />}
    </div>
  );
}

function Clasificacion({ baristas, recien }: { baristas: Barista[]; recien: Set<string> }) {
  const orden = useMemo(() => clasificacion(baristas), [baristas]);
  const porCol = Math.max(16, Math.ceil(orden.length / 2));
  const alto = 74 / porCol; // vh por fila
  const ultimo = useMemo(
    () => [...baristas].filter((b) => b.puntuado_at).sort((x, y) => (y.puntuado_at || '').localeCompare(x.puntuado_at || ''))[0],
    [baristas],
  );
  const posUltimo = ultimo ? orden.findIndex((b) => b.id === ultimo.id) + 1 : 0;

  if (!orden.length) return <p className="tb-vacio">Pronto empieza el torneo.</p>;
  return (
    <>
      <div className="tb-tabla" style={{ height: `${alto * porCol}vh` }}>
        <div className="tb-zona" style={{ height: `${alto * Math.min(16, porCol)}vh` }} aria-hidden="true"><span>Clasifican a octavos</span></div>
        {orden.map((b, i) => {
          const col = i < porCol ? 0 : 1;
          const fila = i % porCol;
          return (
            <div
              key={b.id}
              className={`tb-fila ${b.puntaje == null ? 'pend' : ''} ${i < 16 && b.puntaje != null ? 'clasif' : ''} ${recien.has(b.id) ? 'recien' : ''} ${i < 3 && b.puntaje != null ? `podio p${i + 1}` : ''}`}
              style={{ top: `${fila * alto}vh`, left: col ? '50.5%' : '0', height: `${alto - 0.5}vh`, fontSize: `${Math.min(2.6, alto * 0.5)}vh` }}
            >
              <span className="tb-pos">{b.puntaje == null ? '' : i + 1}</span>
              <span className="tb-nom">
                {b.nombre}
                {b.cafeteria && <small>{b.cafeteria}</small>}
              </span>
              <span className="tb-pts">{fPuntaje(b.puntaje)}</span>
            </div>
          );
        })}
      </div>
      {ultimo && (
        <div className="tb-ultimo" key={ultimo.id + ultimo.puntuado_at}>
          Último puntaje: <b>{ultimo.nombre}</b> · {fPuntaje(ultimo.puntaje)} · <b>P{posUltimo}</b>
        </div>
      )}
    </>
  );
}

function Llaves({ baristas, partidos }: { baristas: Barista[]; partidos: Partido[] }) {
  const nombre = useMemo(() => new Map(baristas.map((b) => [b.id, b.nombre])), [baristas]);
  const mapa = useMemo(() => new Map(partidos.map((p) => [p.id, p])), [partidos]);
  const semilla = useMemo(() => {
    const m = new Map<string, number>();
    for (const def of LLAVE) {
      const p = mapa.get(def.id);
      if (def.semillas && p) { if (p.a) m.set(p.a, def.semillas[0]); if (p.b) m.set(p.b, def.semillas[1]); }
    }
    return m;
  }, [mapa]);
  if (!partidos.length) return <p className="tb-vacio">Las llaves se arman al terminar la clasificación.</p>;

  const card = (id: string) => {
    const p = mapa.get(id);
    const lado = (x: string | null | undefined, pts: number | null | undefined) => {
      const gano = p?.ganador && p.ganador === x;
      const perdio = p?.ganador && x && p.ganador !== x;
      return (
        <div className={`tb-lado ${gano ? 'gano' : ''} ${perdio ? 'perdio' : ''}`}>
          {x && semilla.has(x) && <span className="tb-sem">{semilla.get(x)}</span>}
          <span className="tb-lnom">{x ? nombre.get(x) || '—' : 'A definir'}</span>
          <span className="tb-lpts">{pts == null ? '' : fPuntaje(pts)}</span>
        </div>
      );
    };
    return (
      <div className="tb-partido" key={id}>
        {lado(p?.a, p?.puntaje_a)}
        {lado(p?.b, p?.puntaje_b)}
      </div>
    );
  };
  const col = (ids: string[], titulo: string) => (
    <div className="tb-col">
      <h3>{titulo}</h3>
      <div className="tb-col-in">{ids.map(card)}</div>
    </div>
  );
  const final = mapa.get('F');
  const campeon = final?.ganador ? nombre.get(final.ganador) : null;
  const tercero = mapa.get('T')?.ganador;

  return (
    <div className="tb-llaves">
      {col(['O1', 'O2', 'O3', 'O4'], 'Octavos')}
      {col(['C1', 'C2'], 'Cuartos')}
      {col(['S1'], 'Semifinal')}
      <div className="tb-col tb-centro">
        <div className={`tb-campeon ${campeon ? 'si' : ''}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={recursos.estrellaSola} alt="" />
          <span>{campeon ? 'Campeón' : NOMBRE_RONDA.final}</span>
          {campeon && <b>{campeon}</b>}
        </div>
        {card('F')}
        <h3 className="tb-h3-t">{NOMBRE_RONDA.tercero}</h3>
        {card('T')}
        {tercero && <p className="tb-tercero">3° {nombre.get(tercero)}</p>}
      </div>
      {col(['S2'], 'Semifinal')}
      {col(['C3', 'C4'], 'Cuartos')}
      {col(['O5', 'O6', 'O7', 'O8'], 'Octavos')}
    </div>
  );
}
