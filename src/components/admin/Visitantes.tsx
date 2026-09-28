'use client';
import { useMemo, useState } from 'react';
import { copiar } from './Comun';

export type FilaVisitante = { id: string; nombre: string; nac: string; nacTxt: string; edad: number; mail: string; wa: string; registro: string; registroTxt: string; canjes: number; novedades: boolean };

const MAX = 500;

export function AdminVisitantes({ filas }: { filas: FilaVisitante[] }) {
  const [q, setQ] = useState('');
  const ls = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? filas.filter((v) => (v.nombre + ' ' + v.mail + ' ' + v.wa).toLowerCase().includes(t)) : filas;
  }, [q, filas]);

  const tsv = () =>
    [['Nombre', 'Nacimiento', 'Mail', 'WhatsApp', 'Registro', 'Canjes', 'Acepta novedades'], ...filas.map((v) => [v.nombre, v.nac, v.mail, v.wa, v.registro, v.canjes, v.novedades ? 'Sí' : 'No'])]
      .map((r) => r.map((c) => String(c).replace(/[\t\n\r]/g, ' ')).join('\t'))
      .join('\n');

  return (
    <>
      <div className="fila">
        <div>
          <h1>Visitantes</h1>
          <p className="sub" style={{ marginBottom: 0 }}>{filas.length} registrados. &quot;Copiar para Sheets&quot; copia la tabla entera para pegarla en una planilla.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input className="buscar" aria-label="Buscar visitantes" placeholder="Buscar por nombre o contacto" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="btn chico" onClick={() => copiar(tsv(), 'Copiado. Pegalo en la primera celda de una planilla.')}>Copiar para Sheets</button>
          <a className="btn chico linea" href="/api/admin/csv/visitantes" download>Descargar CSV</a>
        </div>
      </div>
      <div className="tarj tabla" style={{ marginTop: 14 }}>
        <table>
          <thead><tr><th>Nombre</th><th>Nacimiento</th><th>Contacto</th><th>Registro</th><th>Canjes</th><th>Novedades</th></tr></thead>
          <tbody>
            {ls.length ? ls.slice(0, MAX).map((v) => (
              <tr key={v.id}>
                <td><b>{v.nombre}</b></td>
                <td>{v.nacTxt} <span style={{ color: 'rgba(243,233,220,.5)' }}>({v.edad})</span></td>
                <td>{v.mail || v.wa}</td>
                <td>{v.registroTxt}</td>
                <td>{v.canjes}</td>
                <td>{v.novedades ? <span className="pill ok">Sí</span> : <span className="pill">No</span>}</td>
              </tr>
            )) : <tr><td colSpan={6}>No hay visitantes con esa búsqueda.</td></tr>}
          </tbody>
        </table>
        {ls.length > MAX && <p className="mas">Se muestran los primeros {MAX} de {ls.length}. Usá el buscador o descargá el CSV para ver todos.</p>}
      </div>
    </>
  );
}
