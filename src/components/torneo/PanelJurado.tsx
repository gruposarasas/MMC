'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import recursos from '@/lib/recursos.json';
import { ESCALA, completa, totalJurado, type Item, type Valores } from '@/lib/planilla';
import { toast } from '../Toast';

type B = { id: string; nombre: string; turno: string; valores: Valores; comentario: string };
type Vista = { jurado: number; ronda: { n: number; titulo: string }; items: Item[]; baristas: B[] };

const txt = (n: number | undefined) => (n == null ? '' : String(n).replace('.', ','));
const fmt = (n: number | null) => (n == null ? '—' : n.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }));

export function EntrarJurado() {
  const router = useRouter();
  const [clave, setClave] = useState('');
  const [n, setN] = useState(0);
  const [enviando, setEnviando] = useState(false);
  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    const r = await fetch('/api/jurado/entrar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ clave, n }) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setEnviando(false);
    if (!r?.ok) return toast(j.error || 'No pudimos entrar. Probá de nuevo.');
    router.refresh();
  }
  return (
    <div className="tel" style={{ maxWidth: 460 }}>
      <div className="tel-in">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="logo" src={recursos.logo} alt="Mundial de Café" style={{ width: 160 }} />
        <h1 className="h1" style={{ fontSize: 26 }}>Jurado del torneo</h1>
        <p className="lead">Elegí qué jurado sos y entrá con tu clave para cargar tu planilla de cada barista.</p>
        <form onSubmit={entrar}>
          <div className="campo">
            <label>Soy el</label>
            <div className="seg" style={{ gridTemplateColumns: 'repeat(3,1fr)' }} role="radiogroup" aria-label="Número de jurado">
              {[1, 2, 3].map((x) => (
                <button key={x} type="button" role="radio" aria-checked={n === x} className={n === x ? 'on' : ''} onClick={() => setN(x)}>Jurado {x}</button>
              ))}
            </div>
          </div>
          <div className="campo">
            <label htmlFor="jClave">Tu clave</label>
            <input id="jClave" autoCapitalize="characters" autoComplete="off" inputMode="numeric" placeholder="Tu clave" value={clave} onChange={(e) => setClave(e.target.value)} maxLength={30} />
          </div>
          <button className="btn" type="submit" disabled={enviando || !clave.trim() || !n}>{enviando ? 'Entrando…' : n ? `Entrar como Jurado ${n}` : 'Elegí tu número de jurado'}</button>
        </form>
      </div>
    </div>
  );
}

/** Panel del jurado: la ronda en curso, sus baristas por turno y su planilla de cada uno. */
export function PanelJurado({ inicial }: { inicial: Vista }) {
  const router = useRouter();
  const [v, setV] = useState(inicial);
  const [abierto, setAbierto] = useState<string | null>(null);
  const hechos = v.baristas.filter((b) => completa(v.ronda.n, b.valores)).length;

  // Se actualiza sola (por ejemplo, cuando administración cierra la ronda), salvo con una planilla abierta.
  useEffect(() => {
    if (abierto) return;
    const t = setInterval(async () => {
      if (document.hidden) return;
      const r = await fetch('/api/jurado', { cache: 'no-store' }).catch(() => null);
      if (r?.status === 401) return router.refresh();
      if (r?.ok) setV(await r.json());
    }, 20000);
    return () => clearInterval(t);
  }, [abierto, router]);

  return (
    <div className="tel jur" style={{ maxWidth: 640 }}>
      <div className="tel-in">
        <div className="fila">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={recursos.logo} alt="Mundial de Café" style={{ width: 110 }} />
          <button className="link" onClick={async () => { await fetch('/api/jurado/salir', { method: 'POST' }).catch(() => {}); router.refresh(); }}>Salir</button>
        </div>
        <h1 className="h1" style={{ fontSize: 28 }}>Jurado {v.jurado} · {v.ronda.titulo}</h1>
        <p className="lead">{hechos} de {v.baristas.length} planillas completas. Cada ítem va de {ESCALA.min} a {ESCALA.max}, con un decimal.</p>
        <div className="jur-lista">
          {v.baristas.map((b) => (
            <FilaJurado key={b.id + v.ronda.n} b={b} v={v} abierto={abierto === b.id} abrir={() => setAbierto(abierto === b.id ? null : b.id)} guardado={(nv) => { setV(nv); setAbierto(null); }} />
          ))}
          {!v.baristas.length && <p className="lead">Esta ronda todavía no tiene participantes.</p>}
        </div>
      </div>
    </div>
  );
}

function FilaJurado({ b, v, abierto, abrir, guardado }: { b: B; v: Vista; abierto: boolean; abrir: () => void; guardado: (v: Vista) => void }) {
  const [val, setVal] = useState<Record<string, string>>(() => Object.fromEntries(v.items.map((i) => [i.k, txt(b.valores[i.k])])));
  const [com, setCom] = useState(b.comentario);
  const [enviando, setEnviando] = useState(false);
  const ok = completa(v.ronda.n, b.valores);
  const aMedias = !ok && Object.keys(b.valores).length > 0;
  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    const r = await fetch('/api/jurado', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ barista: b.id, ronda: v.ronda.n, valores: val, comentario: com }) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setEnviando(false);
    if (!r?.ok) return toast(j.error || 'No se pudo guardar. Probá de nuevo.');
    toast(`Planilla de ${b.nombre} guardada.`);
    guardado(j);
  }
  return (
    <div className={`jur-it ${abierto ? 'abierto' : ''}`}>
      <button className="jur-cab" onClick={abrir} aria-expanded={abierto}>
        <span>
          <b>{b.nombre}</b>
          <small>{b.turno || 'Sin turno'}</small>
        </span>
        {ok ? <span className="pill ok">✓ {fmt(totalJurado(v.ronda.n, b.valores))}</span> : aMedias ? <span className="pill">A medias</span> : <span className="pill off">Pendiente</span>}
      </button>
      {abierto && (
        <form className="jur-form" onSubmit={guardar}>
          {v.items.map((i) => (
            <label key={i.k} className="jur-campo">
              <span>{i.t}</span>
              <input inputMode="decimal" placeholder="—" value={val[i.k] || ''} onChange={(e) => setVal((x) => ({ ...x, [i.k]: e.target.value }))} aria-label={`${i.t} de ${b.nombre}`} />
            </label>
          ))}
          <label className="jur-campo col">
            <span>Comentario para el barista (opcional)</span>
            <textarea className="area" rows={3} maxLength={500} value={com} onChange={(e) => setCom(e.target.value)} placeholder="Lo ve el barista en su devolución, firmado como Jurado N." />
          </label>
          <button className="btn" type="submit" disabled={enviando}>{enviando ? 'Guardando…' : 'Guardar planilla'}</button>
        </form>
      )}
    </div>
  );
}
