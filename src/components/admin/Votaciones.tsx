'use client';
import { useMemo, useState } from 'react';
import { toast } from '../Toast';

type Msj = { id: number; barista: string; baristaId: string; de: string; texto: string; oculto: boolean; cuando: string };

/** Mensajes de aliento: administración puede ocultar los que no correspondan. */
export function MensajesAdmin({ inicial }: { inicial: Msj[] }) {
  const [ms, setMs] = useState(inicial);
  const [f, setF] = useState('');
  const baristas = useMemo(() => [...new Map(inicial.map((m) => [m.baristaId, m.barista])).entries()].sort((a, b) => a[1].localeCompare(b[1])), [inicial]);
  const lista = f ? ms.filter((m) => m.baristaId === f) : ms;
  async function alternar(m: Msj) {
    const r = await fetch('/api/admin/mensajes', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: m.id, oculto: !m.oculto }) }).catch(() => null);
    if (!r?.ok) return toast('No se pudo guardar. Probá de nuevo.');
    setMs((xs) => xs.map((x) => (x.id === m.id ? { ...x, oculto: !m.oculto } : x)));
    toast(m.oculto ? 'El barista vuelve a ver el mensaje.' : 'Mensaje oculto.');
  }
  return (
    <div className="tarj tabla" style={{ marginTop: 14 }}>
      <div className="fila">
        <h2 style={{ margin: 0, fontSize: 17, color: 'var(--arena)' }}>Mensajes de aliento · {ms.length}</h2>
        <select className="buscar" style={{ minWidth: 0 }} value={f} onChange={(e) => setF(e.target.value)} aria-label="Filtrar por barista">
          <option value="">Todos los baristas</option>
          {baristas.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
        </select>
      </div>
      <p className="ayuda">Cada barista ve los suyos en su perfil. Si alguno no corresponde, ocultalo.</p>
      <table>
        <thead><tr><th>Cuándo</th><th>Para</th><th>De</th><th>Mensaje</th><th /></tr></thead>
        <tbody>
          {lista.map((m) => (
            <tr key={m.id} style={m.oculto ? { opacity: 0.45 } : undefined}>
              <td style={{ whiteSpace: 'nowrap' }}>{m.cuando}</td>
              <td>{m.barista}</td>
              <td>{m.de}</td>
              <td>{m.texto}</td>
              <td><button className="link" onClick={() => alternar(m)}>{m.oculto ? 'Mostrar' : 'Ocultar'}</button></td>
            </tr>
          ))}
          {!lista.length && <tr><td colSpan={5}>Todavía no hay mensajes.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
