'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PRESETS, rangoPreset, limitesMes, nombreMes, FECHA_RE } from '@/lib/vistapueblo';

/** Filtros de las métricas: atajos, mes, fechas a elección y local. Todo va en la URL (se puede compartir). */
export function FiltroMetricas({ base, desde, hasta, local, locales, meses, inicio }: {
  base: string; desde: string; hasta: string; local: string; locales?: { id: string; nombre: string }[]; meses: string[]; inicio: string;
}) {
  const router = useRouter();
  const [d, setD] = useState(desde);
  const [h, setH] = useState(hasta);
  const ir = (x: { desde: string; hasta: string; local?: string }) => {
    const p = new URLSearchParams(base.includes('?') ? base.split('?')[1] : '');
    p.set('desde', x.desde);
    p.set('hasta', x.hasta);
    const l = x.local ?? local;
    if (l) p.set('local', l); else p.delete('local');
    router.push(`${base.split('?')[0]}?${p.toString()}`);
  };
  const activo = PRESETS.find(([k]) => { const r = rangoPreset(k, inicio); return r.desde === desde && r.hasta === hasta; })?.[0];
  const mesSel = meses.find((m) => { const r = limitesMes(m); return r.desde === desde && (r.hasta === hasta || hasta.startsWith(m)); }) ?? '';
  return (
    <div className="vp-filtro">
      <div className="vp-chips" role="group" aria-label="Período">
        {PRESETS.map(([k, n]) => {
          const r = rangoPreset(k, inicio);
          const on = activo === k;
          return <button key={k} type="button" className={on ? 'on' : ''} aria-pressed={on} onClick={() => { setD(r.desde); setH(r.hasta); ir(r); }}>{n}</button>;
        })}
      </div>
      <div className="vp-filtro-fila">
        <label>Mes
          <select value={mesSel} onChange={(e) => { if (!e.target.value) return; const r = limitesMes(e.target.value); setD(r.desde); setH(r.hasta); ir(r); }}>
            <option value="">Elegí…</option>
            {meses.map((m) => <option key={m} value={m}>{nombreMes(m)}</option>)}
          </select>
        </label>
        <form className="vp-filtro-rango" onSubmit={(e) => { e.preventDefault(); if (FECHA_RE.test(d) && FECHA_RE.test(h)) ir(d <= h ? { desde: d, hasta: h } : { desde: h, hasta: d }); }}>
          <label>Desde <input type="date" value={d} onChange={(e) => setD(e.target.value)} /></label>
          <label>Hasta <input type="date" value={h} onChange={(e) => setH(e.target.value)} /></label>
          <button type="submit" className="vp-btn chico" disabled={d === desde && h === hasta}>Aplicar</button>
        </form>
        {locales && (
          <label>Local
            <select value={local} onChange={(e) => ir({ desde, hasta, local: e.target.value })}>
              <option value="">Todos los locales</option>
              {locales.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
            </select>
          </label>
        )}
      </div>
    </div>
  );
}
