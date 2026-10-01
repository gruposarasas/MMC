'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { RONDAS, ronda, participantes, tabla, empateEnCorte, type Barista, type Puntaje, type Fase, type Fila } from '@/lib/rondas';
import { toast } from '../Toast';
import { fPuntaje } from './PantallaTorneo';

type Estado = { fase: Fase; pantalla: 'auto' | Fase; baristas: Barista[]; puntajes: Puntaje[]; avance: Record<string, number> };
type Act = (c: Record<string, unknown>, ok?: string) => Promise<Estado | null>;

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
  const [ver, setVer] = useState<Fase>(inicial.fase);
  const [lista, setLista] = useState('');
  const act: Act = async (c, ok) => { const j = await pedir(c); if (j) { setE(j); if (ok) toast(ok); } return j; };
  // Se actualiza sola para ver lo que cargan los jurados (salvo mientras se está escribiendo).
  useEffect(() => {
    const t = setInterval(async () => {
      if (document.hidden || document.activeElement?.tagName === 'INPUT') return;
      const r = await fetch('/api/admin/baristas', { cache: 'no-store' }).catch(() => null);
      if (r?.ok) setE(await r.json());
    }, 10000);
    return () => clearInterval(t);
  }, []);
  const actual = ronda(e.fase);
  const r = ronda(ver);
  const filas = useMemo(() => tabla(participantes(r.n, e.baristas, e.puntajes)), [r.n, e.baristas, e.puntajes]);
  const conPuntaje = filas.filter((f) => f.puntaje != null).length;
  const editable = r.n === actual.n; // las rondas cerradas no se editan: para corregirlas, "Volver"
  const empate = empateEnCorte(filas, r.pasan);
  const sig = RONDAS[RONDAS.findIndex((x) => x.fase === r.fase) + 1];

  return (
    <>
      <div className="fila">
        <div>
          <h1>Torneo de Baristas</h1>
          <p className="sub" style={{ marginBottom: 0 }}>Ronda en curso: <b>{actual.titulo}</b>. Lo que cargás acá se ve en la pantalla en unos segundos.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <a className="btn chico" href="/baristas" target="_blank" rel="noopener">Abrir pantalla</a>
          <select className="buscar" style={{ minWidth: 0 }} aria-label="Qué muestra la pantalla" value={e.pantalla} onChange={(x) => act({ accion: 'pantalla', valor: x.target.value })}>
            <option value="auto">Pantalla: ronda en curso</option>
            {RONDAS.map((x) => <option key={x.fase} value={x.fase}>Pantalla: {x.titulo}</option>)}
          </select>
        </div>
      </div>

      <nav className="tr-tabs" aria-label="Rondas">
        {RONDAS.map((x) => (
          <button key={x.fase} className={ver === x.fase ? 'on' : ''} aria-pressed={ver === x.fase} onClick={() => setVer(x.fase)} disabled={x.n > actual.n}>
            {x.titulo}{x.fase === e.fase ? ' · en curso' : ''}
          </button>
        ))}
      </nav>

      <div className="tarj tabla" style={{ marginTop: 14 }}>
        <div className="fila">
          <h2 style={{ margin: 0, fontSize: 17, color: 'var(--arena)' }}>
            {r.titulo} · {filas.length} baristas · {conPuntaje} con puntaje · {r.fase === 'final' ? 'gana el mayor puntaje' : `pasan ${r.pasan}`}
          </h2>
          {r.fase === e.fase && sig && (
            <button
              className="btn chico"
              onClick={() => confirm(`¿Cerrar la ${r.titulo}? Pasan los ${r.pasan} mejores a la ${sig.titulo} y la pantalla la empieza a mostrar.`) && act({ accion: 'cerrar' }, `${r.titulo} cerrada.`)}
            >
              Cerrar {r.titulo} y pasar los {r.pasan} mejores
            </button>
          )}
          {r.n < actual.n && (
            <button className="btn chico linea" onClick={() => confirm(`¿Volver a la ${r.titulo}? Se borran las rondas siguientes y sus puntajes.`) && act({ accion: 'volver', fase: r.fase }, `Volviste a la ${r.titulo}.`).then((j) => j && setVer(r.fase))}>
              Volver a la {r.titulo}
            </button>
          )}
        </div>
        <p className="ayuda">
          Cuando los <b>3 jurados</b> cargan su planilla en <Link className="link" href="/jurado">/jurado</Link>, el puntaje y el espresso se calculan solos (promedio de los 3, menos los descuentos de los jueces fiscales en <b>Desc.</b>). Si hace falta, se pueden cargar a mano: de 1 a 9 con un decimal (por ejemplo 8,5). Guardá con Enter o con el botón. <b>Empates</b>: a igual puntaje, pasa el de mejor <b>espresso</b>; si también empatan, el jurado desempata (en la Ronda 3 y la final, por la bebida de autor) cargando <b>Desempate</b>: el número más alto queda arriba.
          {r.fase === 'r3' && ' Los puestos 3 y 4 de esta ronda son el 3° y 4° puesto del torneo.'}
        </p>
        {empate && <p className="pill off" style={{ marginTop: 8 }}>Hay un empate en el puesto {r.pasan}, justo en el corte: cargá el espresso y, si siguen empatados, usá Desempate antes de cerrar.</p>}
        <table>
          <thead><tr><th>Pos.</th><th>Barista</th><th>Turno</th><th>Jurados</th><th>Puntaje</th><th>Espresso</th><th>Desc.</th><th>Desempate</th><th></th></tr></thead>
          <tbody>
            {filas.map((f, i) => (
              <FilaBarista key={f.id + r.n + (f.puntuado_at || '') + f.desempate + (f.espresso ?? '') + f.descuento + (e.avance[`${f.id}:${r.n}`] || 0)} f={f} n={r.n} jurados={e.avance[`${f.id}:${r.n}`] || 0} pos={f.puntaje == null ? null : i + 1} corte={i === r.pasan - 1} editable={editable} act={act} />
            ))}
            {!filas.length && <tr><td colSpan={9}>{r.n === 1 ? 'Todavía no hay participantes.' : 'Esta ronda empieza cuando se cierra la anterior.'}</td></tr>}
          </tbody>
        </table>
      </div>

      {ver === 'r1' && (
        <div className="form">
          <h2 style={{ margin: 0, fontSize: 18, color: 'var(--arena)' }}>Agregar participantes</h2>
          <p className="ayuda">Uno por línea. Si querés, agregá la cafetería con un guion: <b>Juan Pérez - Café Central</b>. El horario y la mesa se cargan con &quot;Editar&quot;.</p>
          <div className="campo" style={{ marginTop: 8 }}>
            <textarea aria-label="Lista de participantes" value={lista} onChange={(x) => setLista(x.target.value)} rows={4} style={{ width: '100%', padding: 12, borderRadius: 12, border: '1.5px solid var(--linea)', background: 'rgba(255,255,255,.05)', color: 'var(--crema)', font: 'inherit' }} placeholder={'Juan Pérez - Café Central\nMaría Gómez'} />
          </div>
          <button className="btn chico" style={{ marginTop: 10 }} disabled={!lista.trim()} onClick={async () => { if (await act({ accion: 'agregar', lista }, 'Participantes agregados.')) setLista(''); }}>
            Agregar
          </button>
        </div>
      )}
      <p className="ayuda" style={{ marginTop: 16 }}><Link className="link" href="/admin">← Volver al back office</Link></p>
    </>
  );
}

function FilaBarista({ f, n, jurados, pos, corte, editable, act }: { f: Fila; n: number; jurados: number; pos: number | null; corte: boolean; editable: boolean; act: Act }) {
  const [pts, setPts] = useState(entrada(f.puntaje));
  const [esp, setEsp] = useState(entrada(f.espresso));
  const [des, setDes] = useState(String(f.desempate || 0));
  const [desc, setDesc] = useState(String(f.descuento || 0));
  const auto = jurados === 3; // el puntaje sale de las planillas de los 3 jurados
  const guardar = () => act({ accion: 'puntaje', id: f.id, ronda: n, puntaje: pts, espresso: esp, desempate: des, descuento: desc }, auto ? 'Guardado.' : pts ? `Puntaje de ${f.nombre}: ${pts}` : 'Puntaje borrado.');
  return (
    <tr style={corte ? { borderBottom: '3px solid var(--arena)' } : undefined}>
      <td><b>{pos ?? '—'}</b>{f.semilla != null && <div className="ayuda">llegó {f.semilla}°</div>}</td>
      <td>
        <b>{f.nombre}</b>{f.cafeteria && <span style={{ color: 'rgba(243,233,220,.6)' }}> · {f.cafeteria}</span>}
        {n === 1 && (
          <div className="acciones" style={{ marginTop: 4 }}>
            <button className="link" onClick={() => {
              const nom = prompt('Nombre del barista', f.nombre); if (nom == null) return;
              const c = prompt('Cafetería (opcional)', f.cafeteria); if (c == null) return;
              const t = prompt('Horario y mesa de la Ronda 1 (por ejemplo: Sáb 10:30 · Mesa 1)', f.turno); if (t == null) return;
              act({ accion: 'editar', id: f.id, nombre: nom, cafeteria: c, turno: t }, 'Guardado.');
            }}>Editar</button>
            <button className="link" style={{ color: 'var(--mal)' }} onClick={() => confirm(`¿Borrar a ${f.nombre} del torneo?`) && act({ accion: 'borrar', id: f.id }, 'Borrado.')}>Borrar</button>
          </div>
        )}
      </td>
      <td style={{ whiteSpace: 'nowrap' }}>{f.turnoRonda || '—'}</td>
      <td><span className={`pill ${auto ? 'ok' : ''}`}>{jurados}/3</span></td>
      {editable ? (
        <>
          <td>
            <input className="buscar" style={{ minWidth: 0, width: 90, fontWeight: 700 }} inputMode="decimal" aria-label={`Puntaje de ${f.nombre}`} placeholder="—" value={pts} disabled={auto} title={auto ? 'Sale de las planillas de los 3 jurados' : undefined} onChange={(x) => setPts(x.target.value)} onKeyDown={(x) => x.key === 'Enter' && guardar()} />
          </td>
          <td>
            <input className="buscar" style={{ minWidth: 0, width: 80 }} inputMode="decimal" aria-label={`Espresso de ${f.nombre}`} placeholder="—" value={esp} disabled={auto} onChange={(x) => setEsp(x.target.value)} onKeyDown={(x) => x.key === 'Enter' && guardar()} />
          </td>
          <td>
            <input className="buscar" style={{ minWidth: 0, width: 56 }} inputMode="numeric" aria-label={`Descuentos de los jueces fiscales para ${f.nombre}`} value={desc} onChange={(x) => setDesc(x.target.value)} onKeyDown={(x) => x.key === 'Enter' && guardar()} />
          </td>
          <td>
            <input className="buscar" style={{ minWidth: 0, width: 64 }} inputMode="numeric" aria-label={`Desempate del jurado para ${f.nombre}`} value={des} onChange={(x) => setDes(x.target.value)} onKeyDown={(x) => x.key === 'Enter' && guardar()} />
          </td>
          <td><button className="btn chico" onClick={guardar}>Guardar</button></td>
        </>
      ) : (
        <>
          <td><b>{fPuntaje(f.puntaje)}</b></td>
          <td>{f.espresso == null ? '' : fPuntaje(f.espresso)}</td>
          <td>{f.descuento ? `−${f.descuento}` : ''}</td>
          <td>{f.desempate || ''}</td>
          <td />
        </>
      )}
    </tr>
  );
}
