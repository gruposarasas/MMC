'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { LLAVE, NOMBRE_RONDA, clasificacion, type Barista, type Partido, type Ronda } from '@/lib/llaves';
import { toast } from '../Toast';
import { fPuntaje } from './PantallaTorneo';

type Estado = { fase: 'clasificacion' | 'playoff'; pantalla: 'auto' | 'clasificacion' | 'llaves'; baristas: Barista[]; partidos: Partido[] };

async function pedir(cuerpo: Record<string, unknown>): Promise<Estado | null> {
  try {
    const r = await fetch('/api/admin/baristas', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { toast(j.error || 'Algo falló. Probá de nuevo.'); return null; }
    return j;
  } catch {
    toast('Sin conexión. Probá de nuevo.');
    return null;
  }
}

const entrada = (n: number | null) => (n == null ? '' : n.toFixed(1).replace('.', ','));

export function AdminTorneo({ inicial }: { inicial: Estado }) {
  const [e, setE] = useState<Estado>(inicial);
  const [lista, setLista] = useState('');
  const orden = useMemo(() => clasificacion(e.baristas), [e.baristas]);
  const nombre = useMemo(() => new Map(e.baristas.map((b) => [b.id, b.nombre])), [e.baristas]);
  const act = async (c: Record<string, unknown>, ok?: string) => { const j = await pedir(c); if (j) { setE(j); if (ok) toast(ok); } return j; };
  const conPuntaje = orden.filter((b) => b.puntaje != null).length;

  return (
    <>
      <div className="fila">
        <div>
          <h1>Torneo de Baristas</h1>
          <p className="sub" style={{ marginBottom: 0 }}>
            {e.fase === 'playoff' ? 'Fase de playoff.' : 'Fase de clasificación.'} Lo que cargás acá se ve en la pantalla en unos segundos.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <a className="btn chico" href="/baristas" target="_blank" rel="noopener">Abrir pantalla</a>
          <select className="buscar" style={{ minWidth: 0 }} aria-label="Qué muestra la pantalla" value={e.pantalla} onChange={(x) => act({ accion: 'pantalla', valor: x.target.value })}>
            <option value="auto">Pantalla: automática</option>
            <option value="clasificacion">Pantalla: clasificación</option>
            <option value="llaves">Pantalla: llaves</option>
          </select>
        </div>
      </div>

      {/* ---------------- playoff ---------------- */}
      {e.fase === 'playoff' && (
        <div style={{ marginTop: 14 }}>
          {(['octavos', 'cuartos', 'semis', 'tercero', 'final'] as Ronda[]).map((r) => (
            <div className="tarj" key={r} style={{ marginTop: 12 }}>
              <h2 style={{ margin: '0 0 8px', fontSize: 17, color: 'var(--arena)' }}>{NOMBRE_RONDA[r]}</h2>
              <div className="marcas" style={{ marginTop: 0 }}>
                {LLAVE.filter((d) => d.ronda === r).map((d) => {
                  const p = e.partidos.find((x) => x.id === d.id);
                  return <TarjetaPartido key={d.id + (p?.a || '') + (p?.b || '') + (p?.ganador || '') + (p?.puntaje_a ?? '') + (p?.puntaje_b ?? '')} id={d.id} p={p} nombre={nombre} act={act} />;
                })}
              </div>
            </div>
          ))}
        </div>
      )}
      {/* ---------------- participantes ---------------- */}
      <div className="form">
        <h2 style={{ margin: 0, fontSize: 18, color: 'var(--arena)' }}>Agregar participantes</h2>
        <p className="ayuda">Uno por línea. Si querés, agregá la cafetería con un guion: <b>Juan Pérez - Café Central</b>. Podés pegar la lista entera de una vez.</p>
        <div className="campo" style={{ marginTop: 8 }}>
          <textarea aria-label="Lista de participantes" value={lista} onChange={(x) => setLista(x.target.value)} rows={5} style={{ width: '100%', padding: 12, borderRadius: 12, border: '1.5px solid var(--linea)', background: 'rgba(255,255,255,.05)', color: 'var(--crema)', font: 'inherit' }} placeholder={'Juan Pérez - Café Central\nMaría Gómez'} />
        </div>
        <button className="btn chico" style={{ marginTop: 10 }} disabled={!lista.trim()} onClick={async () => { if (await act({ accion: 'agregar', lista }, 'Participantes agregados.')) setLista(''); }}>
          Agregar
        </button>
      </div>

      {/* ---------------- clasificación ---------------- */}
      <div className="tarj tabla" style={{ marginTop: 14 }}>
        <div className="fila">
          <h2 style={{ margin: 0, fontSize: 17, color: 'var(--arena)' }}>Clasificación · {e.baristas.length} participantes · {conPuntaje} con puntaje</h2>
          {e.fase === 'clasificacion' ? (
            <button className="btn chico" onClick={() => confirm('¿Armar las llaves de octavos con los 16 primeros? La pantalla pasa a mostrar el playoff.') && act({ accion: 'generar' }, 'Llaves armadas.')}>
              Armar llaves con los 16 primeros
            </button>
          ) : (
            <button className="btn chico linea" onClick={() => confirm('¿Volver a la clasificación? Se borran las llaves y todos los resultados del playoff.') && act({ accion: 'clasificacion' }, 'Volviste a la clasificación.')}>
              Volver a la clasificación
            </button>
          )}
        </div>
        <p className="ayuda">Puntaje de 1 a 10 con un decimal (por ejemplo 8,5). Guardá con Enter o con el botón. <b>Desempate</b>: a igual puntaje, el número más alto queda arriba.</p>
        <table>
          <thead><tr><th>Pos.</th><th>Barista</th><th>Puntaje</th><th>Desempate</th><th></th></tr></thead>
          <tbody>
            {orden.map((b, i) => <FilaBarista key={b.id + (b.puntuado_at || '') + b.desempate} b={b} pos={b.puntaje == null ? null : i + 1} act={act} />)}
            {!orden.length && <tr><td colSpan={5}>Todavía no hay participantes.</td></tr>}
          </tbody>
        </table>
      </div>

      <p className="ayuda" style={{ marginTop: 16 }}><Link className="link" href="/admin">← Volver al back office</Link></p>
    </>
  );
}

function FilaBarista({ b, pos, act }: { b: Barista; pos: number | null; act: (c: Record<string, unknown>, ok?: string) => Promise<Estado | null> }) {
  const [pts, setPts] = useState(entrada(b.puntaje));
  const [des, setDes] = useState(String(b.desempate || 0));
  const guardar = () => act({ accion: 'puntaje', id: b.id, puntaje: pts, desempate: des }, pts ? `Puntaje de ${b.nombre}: ${pts}` : 'Puntaje borrado.');
  return (
    <tr>
      <td><b>{pos ?? '—'}</b></td>
      <td>
        <b>{b.nombre}</b>{b.cafeteria && <span style={{ color: 'rgba(243,233,220,.6)' }}> · {b.cafeteria}</span>}
        <div className="acciones" style={{ marginTop: 4 }}>
          <button className="link" onClick={() => {
            const n = prompt('Nombre del barista', b.nombre); if (n == null) return;
            const c = prompt('Cafetería (opcional)', b.cafeteria); if (c == null) return;
            act({ accion: 'editar', id: b.id, nombre: n, cafeteria: c }, 'Guardado.');
          }}>Editar</button>
          <button className="link" style={{ color: 'var(--mal)' }} onClick={() => confirm(`¿Borrar a ${b.nombre} del torneo?`) && act({ accion: 'borrar', id: b.id }, 'Borrado.')}>Borrar</button>
        </div>
      </td>
      <td>
        <input className="buscar" style={{ minWidth: 0, width: 90, fontWeight: 700 }} inputMode="decimal" aria-label={`Puntaje de ${b.nombre}`} placeholder="—" value={pts} onChange={(x) => setPts(x.target.value)} onKeyDown={(x) => x.key === 'Enter' && guardar()} />
      </td>
      <td>
        <input className="buscar" style={{ minWidth: 0, width: 64 }} inputMode="numeric" aria-label={`Desempate de ${b.nombre}`} value={des} onChange={(x) => setDes(x.target.value)} onKeyDown={(x) => x.key === 'Enter' && guardar()} />
      </td>
      <td><button className="btn chico" onClick={guardar}>Guardar</button></td>
    </tr>
  );
}

function TarjetaPartido({ id, p, nombre, act }: { id: string; p?: Partido; nombre: Map<string, string>; act: (c: Record<string, unknown>, ok?: string) => Promise<Estado | null> }) {
  const [pa, setPa] = useState(entrada(p?.puntaje_a ?? null));
  const [pb, setPb] = useState(entrada(p?.puntaje_b ?? null));
  const listo = !!(p?.a && p?.b);
  const n = (x?: string | null) => (x ? nombre.get(x) || '—' : 'A definir');
  const lado = (x: string | null | undefined, v: string, set: (s: string) => void) => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px auto', gap: 8, alignItems: 'center', marginTop: 6 }}>
      <span style={{ fontWeight: 700, color: p?.ganador && p.ganador === x ? 'var(--arena)' : undefined }}>{p?.ganador && p.ganador === x ? '✓ ' : ''}{n(x)}</span>
      <input className="buscar" style={{ minWidth: 0, width: 80 }} inputMode="decimal" placeholder="Pts." aria-label={`Puntaje de ${n(x)}`} value={v} onChange={(z) => set(z.target.value)} disabled={!listo} />
      <button className="link" disabled={!listo} onClick={() => act({ accion: 'resultado', partido: id, puntaje_a: pa, puntaje_b: pb, ganador: x }, `Gana ${n(x)}.`)}>Gana</button>
    </div>
  );
  return (
    <div className="marca" style={{ gridTemplateColumns: '1fr' }}>
      <div>
        <div className="fila"><h3>{id === 'F' ? 'Final' : id === 'T' ? 'Tercer puesto' : `Partido ${id}`}</h3>{p?.ganador && <span className="pill ok">Definido</span>}</div>
        {lado(p?.a, pa, setPa)}
        {lado(p?.b, pb, setPb)}
        <div className="acciones">
          <button className="link" disabled={!listo} onClick={() => act({ accion: 'resultado', partido: id, puntaje_a: pa, puntaje_b: pb }, 'Puntajes guardados.')}>Guardar puntajes</button>
          {p?.ganador && <button className="link" style={{ color: 'var(--mal)' }} onClick={() => confirm('¿Borrar el ganador de este partido? Se borran también los resultados que dependen de él.') && act({ accion: 'resultado', partido: id, puntaje_a: null, puntaje_b: null, ganador: null }, 'Resultado borrado.')}>Borrar resultado</button>}
        </div>
        <p className="ayuda" style={{ marginTop: 6 }}>{fPuntaje(p?.puntaje_a ?? null)} a {fPuntaje(p?.puntaje_b ?? null)}. Si los puntajes son distintos, gana el mayor al guardar.</p>
      </div>
    </div>
  );
}
