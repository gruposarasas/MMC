'use client';
import { useState } from 'react';

export function CampoPago({ pagado, fechaPago, vencimiento }: { pagado: boolean; fechaPago: string; vencimiento: string }) {
  const [si, setSi] = useState(pagado);
  return (
    <>
      <label className="casilla ancho" style={{ marginTop: 4 }}>
        <input type="checkbox" name="pagado" checked={si} onChange={(e) => setSi(e.target.checked)} />
        Ya está pagado
      </label>
      {si ? (
        <label className="campo">
          <span>Fecha de pago <em>(si es otra)</em></span>
          <input type="date" name="fecha_pago" defaultValue={fechaPago} />
        </label>
      ) : (
        <label className="campo">
          <span>Vence el</span>
          <input type="date" name="vencimiento" defaultValue={vencimiento} />
        </label>
      )}
    </>
  );
}
