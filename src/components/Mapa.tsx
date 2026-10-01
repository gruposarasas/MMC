'use client';
import { useRef, useState } from 'react';

const NIVELES = [1, 1.6, 2.4, 3.4];

/** Mapa del evento con zoom: botones + y −, o doble toque. El mapa se puede arrastrar cuando está ampliado. */
export function Mapa() {
  const [i, setI] = useState(0);
  const caja = useRef<HTMLDivElement>(null);
  function zoom(n: number, x = 0.5, y = 0.5) {
    const c = caja.current;
    const nuevo = Math.max(0, Math.min(NIVELES.length - 1, n));
    if (!c || nuevo === i) return;
    // Mantiene centrado el punto tocado (o el centro) al cambiar el zoom.
    const k = NIVELES[nuevo] / NIVELES[i];
    const cx = (c.scrollLeft + c.clientWidth * x) * k - c.clientWidth * x;
    const cy = (c.scrollTop + c.clientHeight * y) * k - c.clientHeight * y;
    setI(nuevo);
    requestAnimationFrame(() => c.scrollTo(cx, cy));
  }
  return (
    <div className="mapa">
      <div
        className="mapa-caja"
        ref={caja}
        onDoubleClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          zoom(i === NIVELES.length - 1 ? 0 : i + 1, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/img/mapa.jpg" alt="Mapa de los stands del Mundial de Café en Bodega Arizu" style={{ width: `${NIVELES[i] * 100}%` }} draggable={false} />
      </div>
      <div className="mapa-zoom">
        <button onClick={() => zoom(i - 1)} disabled={i === 0} aria-label="Alejar">−</button>
        <button onClick={() => zoom(i + 1)} disabled={i === NIVELES.length - 1} aria-label="Acercar">+</button>
      </div>
    </div>
  );
}
