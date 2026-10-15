'use client';
import { pesos } from '@/lib/formato';

/**
 * Cotización de una compra o gasto en dólares: el dólar BNA (se actualiza solo mientras no se paga y al pagarla queda
 * el del día del pago) o un dólar fijo escrito a mano.
 */
export function CotizacionDolar({ auto, setAuto, cot, setCot, dolar }: {
  auto: boolean; setAuto: (v: boolean) => void; cot: string; setCot: (v: string) => void; dolar?: number | null;
}) {
  return (
    <div className="campo">
      <span>Cotización del dólar</span>
      {auto ? (
        <div className="cot-bna">
          <b className="num">{dolar ? pesos(dolar) : 'sin dólar cargado'}</b> BNA hoy
        </div>
      ) : (
        <input name="cotizacion" aria-label="Cotización del dólar" inputMode="decimal" value={cot} onChange={(e) => setCot(e.target.value)} required />
      )}
      <label className="casilla cot-casilla">
        <input type="checkbox" name="cotizacion_auto" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
        Dólar BNA: sin pagar se actualiza solo; al pagarla queda el del día del pago
      </label>
    </div>
  );
}
