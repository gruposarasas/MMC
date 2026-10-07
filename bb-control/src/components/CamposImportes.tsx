'use client';
import { useState } from 'react';
import { aNumero, aTexto, pesos, redondear } from '@/lib/formato';

const ALICUOTAS = [21, 10.5, 27, 0];
const cercana = (a: number) => ALICUOTAS.reduce((m, x) => (Math.abs(x - a) < Math.abs(m - a) ? x : m), 21);

type Props = {
  neto?: number;
  alicuota?: number;
  iva?: number;
  otros?: number;
  conMoneda?: boolean;
  moneda?: 'ARS' | 'USD';
  cotizacion?: number;
  dolar?: number | null;
  etiquetaOtros?: string;
};

/** Neto, IVA, otros y total enlazados: se puede cargar el neto o directamente el total con IVA. */
export function CamposImportes(p: Props) {
  const [neto, setNeto] = useState(aTexto(p.neto));
  const [alic, setAlic] = useState(String(cercana(p.alicuota ?? 21)));
  const [iva, setIva] = useState(aTexto(p.iva));
  const [otros, setOtros] = useState(aTexto(p.otros));
  const [moneda, setMoneda] = useState(p.moneda ?? 'ARS');
  const [cot, setCot] = useState(aTexto(p.moneda === 'USD' ? p.cotizacion : (p.dolar ?? undefined)));
  const num = (s: string) => aNumero(s) ?? 0;
  const total = redondear(num(neto) + num(iva) + num(otros));
  const [totalTxt, setTotalTxt] = useState<string | null>(null);

  const conIva = (n: number, a: number) => redondear((n * a) / 100);

  function cambiarNeto(v: string) {
    setNeto(v);
    setTotalTxt(null);
    setIva(aTexto(conIva(num(v), Number(alic))));
  }
  function cambiarAlic(v: string) {
    setAlic(v);
    setTotalTxt(null);
    setIva(aTexto(conIva(num(neto), Number(v))));
  }
  function cambiarTotal(v: string) {
    setTotalTxt(v);
    const t = num(v);
    const a = Number(alic);
    const n = redondear((t - num(otros)) / (1 + a / 100));
    setNeto(aTexto(n));
    setIva(aTexto(redondear(t - num(otros) - n)));
  }

  const enPesos = moneda === 'USD' ? total * num(cot) : total;
  return (
    <>
      {p.conMoneda && (
        <>
          <label className="campo">
            <span>Moneda</span>
            <select name="moneda" value={moneda} onChange={(e) => setMoneda(e.target.value as 'ARS' | 'USD')}>
              <option value="ARS">Pesos</option>
              <option value="USD">Dólares</option>
            </select>
          </label>
          {moneda === 'USD' ? (
            <label className="campo">
              <span>Cotización del dólar</span>
              <input name="cotizacion" inputMode="decimal" value={cot} onChange={(e) => setCot(e.target.value)} required />
            </label>
          ) : (
            <input type="hidden" name="cotizacion" value="1" />
          )}
        </>
      )}
      <label className="campo">
        <span>Neto sin IVA</span>
        <input name="neto" inputMode="decimal" value={neto} onChange={(e) => cambiarNeto(e.target.value)} placeholder="0" />
      </label>
      <label className="campo">
        <span>Alícuota de IVA</span>
        <select name="iva_alicuota" value={alic} onChange={(e) => cambiarAlic(e.target.value)}>
          {ALICUOTAS.map((a) => (
            <option key={a} value={a}>
              {a === 0 ? 'Sin IVA' : `${String(a).replace('.', ',')} %`}
            </option>
          ))}
        </select>
      </label>
      <label className="campo">
        <span>IVA</span>
        <input name="iva" inputMode="decimal" value={iva} onChange={(e) => { setIva(e.target.value); setTotalTxt(null); }} placeholder="0" />
      </label>
      <label className="campo">
        <span>{p.etiquetaOtros ?? 'Percepciones / otros impuestos'}</span>
        <input name="otros" inputMode="decimal" value={otros} onChange={(e) => { setOtros(e.target.value); setTotalTxt(null); }} placeholder="0" />
      </label>
      <label className="campo">
        <span>Total con IVA <em>(si lo escribís, calcula el neto)</em></span>
        <input inputMode="decimal" value={totalTxt ?? aTexto(total)} onChange={(e) => cambiarTotal(e.target.value)} placeholder="0" />
      </label>
      <div className="resumen-calc">
        <span>Neto <b>{pesos(num(neto))}</b></span>
        <span>IVA <b>{pesos(num(iva))}</b></span>
        {num(otros) !== 0 && <span>Otros <b>{pesos(num(otros))}</b></span>}
        <span>Total <b>{moneda === 'USD' ? `US$ ${aTexto(total) || 0}` : pesos(total)}</b></span>
        {moneda === 'USD' && <span>En pesos <b>{num(cot) ? pesos(enPesos) : 'falta la cotización'}</b></span>}
      </div>
    </>
  );
}
