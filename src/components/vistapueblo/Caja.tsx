'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { pesos } from '@/lib/vistapueblo';
import { toast } from '../Toast';
import { enviar, Reloj } from './Comun';

/** Primera vez en un celular: el cajero elige su local y pone el PIN. */
export function ConfigurarCaja({ locales, volver }: { locales: { id: string; nombre: string }[]; volver?: string }) {
  const router = useRouter();
  const [local, setLocal] = useState('');
  const [pin, setPin] = useState('');
  const [enviando, setEnviando] = useState(false);
  return (
    <form className="vp-panel vp-caja-conf" onSubmit={async (e) => {
      e.preventDefault();
      setEnviando(true);
      const r = await enviar('/api/vp/caja/entrar', { local, pin });
      setEnviando(false);
      if (r) { toast('Listo: este celular quedó como caja.'); if (volver) router.push(volver); router.refresh(); }
    }}>
      <h2>Configurar la caja</h2>
      <p className="vp-ayuda">Se hace una sola vez en cada celular o computadora de la caja. Después solo escaneás el QR de la gift card con la cámara.</p>
      <div className="vp-campo"><label htmlFor="cLocal">Tu local</label>
        <select id="cLocal" value={local} onChange={(e) => setLocal(e.target.value)}>
          <option value="">Elegí…</option>
          {locales.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
        </select></div>
      <div className="vp-campo"><label htmlFor="cPin">PIN del local</label>
        <input id="cPin" className="vp-pin-input" inputMode="numeric" autoComplete="off" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} placeholder="••••" /></div>
      <button className="vp-btn" type="submit" disabled={enviando || !local || pin.length !== 4}>{enviando ? 'Entrando…' : 'Guardar caja'}</button>
    </form>
  );
}

/** El cajero carga el monto consumido y lo descuenta de la gift card. */
export function Cobrar({ token, saldo, nombre, local }: { token: string; saldo: number; nombre: string; local: string }) {
  const router = useRouter();
  const [monto, setMonto] = useState('');
  const [cajero, setCajero] = useState('');
  const [paso, setPaso] = useState<'monto' | 'confirmar'>('monto');
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState<{ numero: number; monto: number; saldo: number; local: string; nombre: string } | null>(null);
  useEffect(() => { try { setCajero(localStorage.getItem('vp-cajero') || ''); } catch {} }, []);
  const n = Number(monto.replace(/\D/g, '')) || 0;

  if (listo) return <ConsumoValido {...listo} onCerrar={() => { setListo(null); setMonto(''); setPaso('monto'); router.refresh(); }} />;

  return (
    <div className="vp-cobrar">
      <h2>Cobrar en {local}</h2>
      {paso === 'monto' ? (
        <form onSubmit={(e) => { e.preventDefault(); if (!n) return toast('Escribí el monto del consumo.'); if (n > saldo) return toast(`El saldo no alcanza: quedan ${pesos(saldo)}.`); setPaso('confirmar'); }}>
          <div className="vp-campo"><label htmlFor="cMonto">Monto del consumo</label>
            <div className="vp-monto-input"><span>$</span>
              <input id="cMonto" inputMode="numeric" autoComplete="off" value={n ? n.toLocaleString('es-AR') : ''} onChange={(e) => setMonto(e.target.value)} placeholder="0" />
            </div>
            <p className="vp-ayuda">Saldo disponible: <b>{pesos(saldo)}</b> · <button type="button" className="vp-link" onClick={() => setMonto(String(saldo))}>Usar todo el saldo</button></p>
          </div>
          <div className="vp-campo"><label htmlFor="cCajero">Cajero (opcional)</label>
            <input id="cCajero" maxLength={60} value={cajero} onChange={(e) => { setCajero(e.target.value); try { localStorage.setItem('vp-cajero', e.target.value); } catch {} }} placeholder="Tu nombre" /></div>
          <button className="vp-btn" type="submit" disabled={!n}>Continuar</button>
        </form>
      ) : (
        <div>
          <p className="vp-confirmar">¿Descontar <b>{pesos(n)}</b> de la gift card de <b>{nombre}</b>?<br />Le van a quedar <b>{pesos(saldo - n)}</b>.</p>
          <button className="vp-btn" type="button" disabled={enviando} onClick={async () => {
            setEnviando(true);
            const r = await enviar('/api/vp/consumir', { token, monto: n, cajero });
            setEnviando(false);
            if (r) setListo(r as unknown as { numero: number; monto: number; saldo: number; local: string; nombre: string });
            else router.refresh();
          }}>{enviando ? 'Registrando…' : 'Sí, cobrar'}</button>
          <button className="vp-btn linea" type="button" onClick={() => setPaso('monto')}>Volver</button>
        </div>
      )}
    </div>
  );
}

/** Pantalla de consumo registrado: bronce a pantalla completa, con la hora en movimiento. */
function ConsumoValido({ numero, monto, saldo, local, nombre, onCerrar }: { numero: number; monto: number; saldo: number; local: string; nombre: string; onCerrar: () => void }) {
  return (
    <div className="vp-valido" role="alert">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/vistapueblo/logo-blanco.png" alt="Vistapueblo" className="vp-valido-logo" />
      <div className="vp-valido-ok" aria-hidden="true">✓</div>
      <p className="vp-valido-t">Consumo registrado</p>
      <p className="vp-valido-monto">{pesos(monto)}</p>
      <p>{nombre} · {local}</p>
      <Reloj />
      <p className="vp-valido-n">Consumo N° {numero} · le quedan {pesos(saldo)}</p>
      <button type="button" className="vp-btn blanco" onClick={onCerrar}>Listo</button>
    </div>
  );
}

/** Si el QR no lee, el cajero escribe el código de la tarjeta. */
export function CodigoManual() {
  const router = useRouter();
  const [c, setC] = useState('');
  return (
    <form className="vp-codigo" onSubmit={(e) => { e.preventDefault(); router.push(`/vistapueblo/caja?codigo=${encodeURIComponent(c)}`); }}>
      <label htmlFor="cCod">¿El QR no lee? Escribí el código de la tarjeta</label>
      <div className="vp-inline">
        <input id="cCod" autoCapitalize="characters" autoComplete="off" placeholder="VP-XXXX-XXXX" value={c} onChange={(e) => setC(e.target.value.toUpperCase())} maxLength={14} />
        <button className="vp-btn chico" type="submit" disabled={c.replace(/[^0-9A-Z]/gi, '').length < 10}>Buscar</button>
      </div>
    </form>
  );
}
