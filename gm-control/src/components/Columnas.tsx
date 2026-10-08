'use client';
import { useEffect, useRef, useState } from 'react';
import { pesos } from '@/lib/formato';

export type Punto = { clave: string; etiqueta: string; valor: number; detalle?: string };

const compacto = new Intl.NumberFormat('es-AR', { notation: 'compact', maximumFractionDigits: 1 });
const H = 200;
const IZQ = 46;
const ARR = 18;
const ABA = 22;

/** Columnas de una sola serie (sin leyenda: el título dice qué es). Negativas hacia abajo en otro color. */
export function Columnas({ datos, color, colorNegativo = 'var(--s-costos)', resaltar }: { datos: Punto[]; color: string; colorNegativo?: string; resaltar?: string }) {
  const [activo, setActivo] = useState<number | null>(null);
  // El SVG se dibuja al ancho real de la caja para que el texto no se achique.
  const ref = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(640);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  if (!datos.length) return null;
  const max = Math.max(0, ...datos.map((d) => d.valor));
  const min = Math.min(0, ...datos.map((d) => d.valor));
  const rango = max - min || 1;
  const alto = H - ARR - ABA;
  const y = (v: number) => ARR + ((max - v) / rango) * alto;
  const y0 = y(0);
  const slot = (W - IZQ) / datos.length;
  const ancho = Math.min(24, slot * 0.62);
  const r = Math.min(4, ancho / 2);
  // Sin etiquetas pegadas: se saltea la que queda a menos de 14 px del cero.
  const ticks = [...new Set(min < 0 ? [max, 0, min] : [max, max / 2, 0])].filter((t) => t === 0 || Math.abs(y(t) - y0) >= 14);
  const iMax = datos.reduce((m, d, i) => (d.valor > datos[m].valor ? i : m), 0);
  const paso = Math.max(1, Math.ceil(30 / slot));

  const barra = (x: number, v: number) => {
    const top = y(v);
    if (Math.abs(top - y0) < 0.5) return '';
    if (v >= 0) {
      const rr = Math.min(r, y0 - top);
      return `M${x},${y0}V${top + rr}Q${x},${top} ${x + rr},${top}H${x + ancho - rr}Q${x + ancho},${top} ${x + ancho},${top + rr}V${y0}Z`;
    }
    const rr = Math.min(r, top - y0);
    return `M${x},${y0}V${top - rr}Q${x},${top} ${x + rr},${top}H${x + ancho - rr}Q${x + ancho},${top} ${x + ancho},${top - rr}V${y0}Z`;
  };

  const a = activo != null ? datos[activo] : null;
  return (
    <div className="columnas" ref={ref} onMouseLeave={() => setActivo(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label="Gráfico de columnas">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={IZQ} x2={W} y1={y(t)} y2={y(t)} stroke={t === 0 ? 'rgba(69,48,45,.25)' : 'rgba(69,48,45,.08)'} strokeWidth="1" />
            <text className="eje" x={IZQ - 8} y={y(t) + 4} textAnchor="end">{compacto.format(t)}</text>
          </g>
        ))}
        {datos.map((d, i) => {
          const x = IZQ + slot * i + (slot - ancho) / 2;
          const mostrarEtiqueta = paso === 1 || i % paso === 0 || i === datos.length - 1;
          return (
            <g
              key={d.clave}
              className="mes"
              tabIndex={0}
              onMouseEnter={() => setActivo(i)}
              onFocus={() => setActivo(i)}
              onBlur={() => setActivo(null)}
              aria-label={`${d.etiqueta}: ${pesos(d.valor, 0)}`}
            >
              <rect className="hit" x={IZQ + slot * i} y={ARR - 10} width={slot} height={alto + 10} fill="transparent" rx="6" />
              <path className="c" d={barra(x, d.valor)} fill={d.valor < 0 ? colorNegativo : color} opacity={activo == null || activo === i ? 1 : 0.55} />
              {d.clave === resaltar && <rect x={IZQ + slot * i + 2} y={H - ABA + 3} width={slot - 4} height="2" fill="var(--vino)" />}
              {mostrarEtiqueta && (
                <text className="eje" x={x + ancho / 2} y={H - 6} textAnchor="middle">{d.etiqueta}</text>
              )}
              {i === iMax && d.valor > 0 && activo == null && (
                <text className="valor" x={x + ancho / 2} y={y(d.valor) - 5} textAnchor="middle">{compacto.format(d.valor)}</text>
              )}
            </g>
          );
        })}
      </svg>
      {a && activo != null && (
        <div className="tip" style={{ left: `${((IZQ + slot * activo + slot / 2) / W) * 100}%`, top: `${(Math.min(y(a.valor), y0) / H) * 100}%`, marginTop: -8 }}>
          <b>{pesos(a.valor, 0)}</b>
          {a.detalle}
        </div>
      )}
    </div>
  );
}
