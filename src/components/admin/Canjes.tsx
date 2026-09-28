'use client';
import { useMemo, useState } from 'react';

export type FilaCanje = { id: string; numero: string; cuando: string; marcaId: string; marca: string; beneficio: string; visitante: string };

const MAX = 500;

export function AdminCanjes({ filas, marcas }: { filas: FilaCanje[]; marcas: { id: string; nombre: string }[] }) {
  const [fm, setFm] = useState('todas');
  const ls = useMemo(() => (fm === 'todas' ? filas : filas.filter((c) => c.marcaId === fm)), [fm, filas]);
  return (
    <>
      <div className="fila">
        <div>
          <h1>Canjes</h1>
          <p className="sub" style={{ marginBottom: 0 }}>Cada beneficio usado, con hora y visitante. Sirve para liquidar con cada cafetería.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select className="buscar" aria-label="Filtrar por cafetería" style={{ minWidth: 200 }} value={fm} onChange={(e) => setFm(e.target.value)}>
            <option value="todas">Todas las cafeterías</option>
            {marcas.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
          </select>
          <a className="btn chico linea" href="/api/admin/csv/canjes" download>Descargar CSV</a>
        </div>
      </div>
      <div className="tarj tabla" style={{ marginTop: 14 }}>
        <table>
          <thead><tr><th>N°</th><th>Día y hora</th><th>Cafetería</th><th>Beneficio</th><th>Visitante</th></tr></thead>
          <tbody>
            {ls.length ? ls.slice(0, MAX).map((c) => (
              <tr key={c.id}><td>{c.numero}</td><td>{c.cuando}</td><td>{c.marca}</td><td>{c.beneficio}</td><td>{c.visitante}</td></tr>
            )) : <tr><td colSpan={5}>Todavía no hay canjes.</td></tr>}
          </tbody>
        </table>
        {ls.length > MAX && <p className="mas">Se muestran los últimos {MAX} de {ls.length}. Descargá el CSV para ver todos.</p>}
      </div>
    </>
  );
}
