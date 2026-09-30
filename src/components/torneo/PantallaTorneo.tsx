'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import recursos from '@/lib/recursos.json';
import { ronda, participantes, tabla, type Barista, type Puntaje, type Fase, type Fila } from '@/lib/rondas';

type Estado = { fase: Fase; pantalla: 'auto' | Fase; baristas: Barista[]; puntajes: Puntaje[] };

export const fPuntaje = (n: number | null) => (n == null ? '—' : n.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
const clave = (p: Puntaje) => `${p.barista_id}:${p.ronda}`;

/** Pantalla para proyectar el torneo de baristas. Se actualiza sola cada 3 segundos. */
export function PantallaTorneo({ inicial }: { inicial: Estado }) {
  const [e, setE] = useState<Estado>(inicial);
  const [recien, setRecien] = useState<Set<string>>(new Set());
  const previo = useRef(new Map(inicial.puntajes.map((p) => [clave(p), p.puntuado_at])));

  useEffect(() => {
    let vivo = true;
    const t = setInterval(async () => {
      if (document.hidden) return;
      const r = await fetch('/api/baristas', { cache: 'no-store' }).catch(() => null);
      if (!r?.ok || !vivo) return;
      const j: Estado = await r.json();
      const nuevos = new Set<string>();
      for (const p of j.puntajes) if (p.puntuado_at && previo.current.get(clave(p)) !== p.puntuado_at) nuevos.add(p.barista_id);
      previo.current = new Map(j.puntajes.map((p) => [clave(p), p.puntuado_at]));
      if (nuevos.size) {
        setRecien(nuevos);
        setTimeout(() => vivo && setRecien(new Set()), 6000);
      }
      setE(j);
    }, 3000);
    return () => { vivo = false; clearInterval(t); };
  }, []);

  const vista: Fase = e.pantalla === 'auto' ? e.fase : e.pantalla;
  const r = ronda(vista);
  const filas = useMemo(() => tabla(participantes(r.n, e.baristas, e.puntajes)), [r.n, e.baristas, e.puntajes]);
  const compitieron = filas.filter((f) => f.puntaje != null).length;

  return (
    <div className="tb">
      <header className="tb-cab">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={recursos.logo} alt="Mundial de Café by Bruno Brown" className="tb-logo" />
        <div className="tb-tit">
          <h1>Torneo de Baristas</h1>
          <p>{r.titulo} · {r.dia}{vista !== 'final' ? ` · Pasan ${r.pasan}` : ''}</p>
        </div>
        {vista !== 'final' && (
          <div className="tb-cuenta"><b>{compitieron}</b><span>/ {filas.length} compitieron</span></div>
        )}
      </header>
      {vista === 'final' ? (
        <Final filas={filas} e={e} recien={recien} />
      ) : (
        <Tabla filas={filas} pasan={r.pasan} aviso={r.aviso} podio={vista === 'r3'} recien={recien} />
      )}
    </div>
  );
}

function Tabla({ filas, pasan, aviso, podio, recien }: { filas: Fila[]; pasan: number; aviso: string; podio: boolean; recien: Set<string> }) {
  const dos = filas.length > 16;
  const porCol = dos ? Math.ceil(filas.length / 2) : Math.max(filas.length, 1);
  const alto = Math.min(9, 74 / porCol); // vh por fila
  const fuente = Math.min(3.6, alto * 0.48);
  const ultimo = useMemo(() => [...filas].filter((f) => f.puntuado_at).sort((x, y) => (y.puntuado_at || '').localeCompare(x.puntuado_at || ''))[0], [filas]);
  const posUltimo = ultimo ? filas.findIndex((f) => f.id === ultimo.id) + 1 : 0;

  if (!filas.length) return <p className="tb-vacio">Pronto empieza esta ronda.</p>;
  return (
    <>
      <div className={`tb-tabla ${dos ? '' : 'una'}`} style={{ height: `${alto * porCol}vh` }}>
        <div className="tb-zona" style={{ height: `${alto * Math.min(pasan, porCol)}vh` }} aria-hidden="true"><span>{aviso}</span></div>
        {filas.map((f, i) => {
          const col = dos && i >= porCol ? 1 : 0;
          const fila = dos ? i % porCol : i;
          const puntuado = f.puntaje != null;
          const puesto = podio && puntuado && (i === 2 || i === 3) ? `${i + 1}° puesto` : '';
          return (
            <div
              key={f.id}
              className={`tb-fila ${puntuado ? '' : 'pend'} ${i < pasan && puntuado ? 'clasif' : ''} ${recien.has(f.id) ? 'recien' : ''} ${i < 3 && puntuado ? `podio p${i + 1}` : ''}`}
              style={{ top: `${fila * alto}vh`, left: col ? '50.5%' : '0', height: `${alto - 0.5}vh`, fontSize: `${fuente}vh` }}
            >
              <span className="tb-pos">{puntuado ? i + 1 : ''}</span>
              <span className="tb-nom">
                {f.nombre}
                {f.cafeteria && <small>{f.cafeteria}</small>}
                {f.semilla != null && <small className="tb-llego">llegó {f.semilla}°</small>}
                {puesto && <em className="tb-puesto">{puesto}</em>}
              </span>
              <span className={puntuado ? 'tb-pts' : 'tb-turno'}>{puntuado ? fPuntaje(f.puntaje) : f.turnoRonda || '—'}</span>
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

function Final({ filas, e, recien }: { filas: Fila[]; e: Estado; recien: Set<string> }) {
  // Finalistas en el orden en que llegaron (1° y 2° de la ronda 3).
  const finalistas = [...filas].sort((x, y) => (x.semilla ?? 9) - (y.semilla ?? 9));
  const definidos = filas.length === 2 && filas.every((f) => f.puntaje != null) && !(filas[0].puntaje === filas[1].puntaje && filas[0].desempate === filas[1].desempate);
  const campeon = definidos ? filas[0] : null; // tabla() ya ordenó por puntaje y desempate
  const r3 = useMemo(() => tabla(participantes(3, e.baristas, e.puntajes)), [e.baristas, e.puntajes]);
  const tercero = r3[2]?.puntaje != null ? r3[2] : null;
  const cuarto = r3[3]?.puntaje != null ? r3[3] : null;
  const segundo = campeon ? filas[1] : null;

  if (!finalistas.length) return <p className="tb-vacio">La final se juega al terminar la Ronda 3.</p>;
  return (
    <div className="tb-final">
      <div className="tb-duelo">
        {finalistas.map((f, k) => (
          <div key={f.id} className={`tb-finalista ${campeon?.id === f.id ? 'campeon' : ''} ${campeon && campeon.id !== f.id ? 'sub' : ''} ${recien.has(f.id) ? 'recien' : ''}`}>
            <span className="tb-fsem">Llegó {f.semilla}°{f.turnoRonda ? ` · ${f.turnoRonda.replace(/^Dom /, '')}` : ''}</span>
            <b className="tb-fnom">{f.nombre}</b>
            {f.cafeteria && <span className="tb-fcaf">{f.cafeteria}</span>}
            <span className="tb-fpts">{fPuntaje(f.puntaje)}</span>
            {campeon?.id === f.id && <span className="tb-fcorona">Campeón</span>}
            {k === 0 && <span className="tb-vs" aria-hidden="true">VS</span>}
          </div>
        ))}
      </div>
      <div className="tb-podio">
        {[
          ['1°', campeon],
          ['2°', segundo],
          ['3°', tercero],
          ['4°', cuarto],
        ].map(([l, f]) => (
          <div key={l as string} className={`tb-escalon ${f ? '' : 'vacio'}`}>
            <span>{l as string}</span>
            <b>{f ? (f as Fila).nombre : 'A definir'}</b>
          </div>
        ))}
      </div>
      {campeon && (
        <div className="tb-estrella" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={recursos.estrellaSola} alt="" />
        </div>
      )}
    </div>
  );
}

