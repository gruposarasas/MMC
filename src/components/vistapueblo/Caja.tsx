'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { pesos, nombreDe, type Modo } from '@/lib/vistapueblo';
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

type Listo = { numero: number; monto: number; ticket: number; saldo: number; perdido: number; local: string; nombre: string };

/**
 * El cajero carga el total del ticket y las personas de la mesa: la gift card paga hasta su saldo
 * y el resto lo paga el cliente aparte. En "consumo total" la tarjeta se usa una sola vez.
 */
export function Cobrar({ id, permiso, saldo, nombre, local, modo }: { id: string; permiso: string; saldo: number; nombre: string; local: string; modo: Modo }) {
  const router = useRouter();
  const [ticket, setTicket] = useState('');
  const [personas, setPersonas] = useState(0);
  const [otras, setOtras] = useState(false);
  const [cajero, setCajero] = useState('');
  const [paso, setPaso] = useState<'datos' | 'confirmar'>('datos');
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState<Listo | null>(null);
  useEffect(() => { try { setCajero(localStorage.getItem('vp-cajero') || ''); } catch {} }, []);
  const total = Number(ticket.replace(/\D/g, '')) || 0;
  const conGift = Math.min(total, saldo);
  const aparte = total - conGift;
  const pierde = modo === 'unico' ? saldo - conGift : 0;

  if (listo) return <ConsumoValido {...listo} onCerrar={() => { setListo(null); router.refresh(); }} />;

  return (
    <div className="vp-cobrar">
      <h2>Cobrar en {local}</h2>
      {modo === 'unico' && <p className="vp-modo-aviso"><b>Consumo total:</b> esta gift card se usa una sola vez.</p>}
      {paso === 'datos' ? (
        <form onSubmit={(e) => {
          e.preventDefault();
          if (!total) return toast('Escribí el total del ticket.');
          if (!personas) return toast('Elegí cuántas personas hay en la mesa.');
          setPaso('confirmar');
        }}>
          <div className="vp-campo"><label htmlFor="cTicket">Total del ticket</label>
            <div className="vp-monto-input"><span>$</span>
              <input id="cTicket" inputMode="numeric" autoComplete="off" value={total ? total.toLocaleString('es-AR') : ''} onChange={(e) => setTicket(e.target.value)} placeholder="0" />
            </div>
            <p className="vp-ayuda">Saldo de la gift card: <b>{pesos(saldo)}</b></p>
          </div>
          {total > 0 && (
            <dl className="vp-reparto">
              <div><dt>Se paga con la gift card</dt><dd>{pesos(conGift)}</dd></div>
              <div className={aparte ? 'on' : ''}><dt>El cliente paga aparte</dt><dd>{pesos(aparte)}</dd></div>
              {pierde > 0 && <div className="mal"><dt>Queda sin usar y se pierde</dt><dd>{pesos(pierde)}</dd></div>}
            </dl>
          )}
          <div className="vp-campo"><span className="vp-label">Personas en la mesa</span>
            <div className="vp-personas">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => <button key={n} type="button" className={personas === n && !otras ? 'on' : ''} aria-pressed={personas === n && !otras} onClick={() => { setOtras(false); setPersonas(n); }}>{n}</button>)}
              <button type="button" className={otras ? 'on' : ''} aria-pressed={otras} onClick={() => { setOtras(true); setPersonas(0); }}>Más</button>
            </div>
            {otras && <input className="vp-personas-mas" inputMode="numeric" aria-label="Cantidad de personas" placeholder="¿Cuántas?" autoFocus
              value={personas || ''} onChange={(e) => setPersonas(Math.min(99, Number(e.target.value.replace(/\D/g, '')) || 0))} />}
          </div>
          <div className="vp-campo"><label htmlFor="cCajero">Cajero (opcional)</label>
            <input id="cCajero" maxLength={60} value={cajero} onChange={(e) => { setCajero(e.target.value); try { localStorage.setItem('vp-cajero', e.target.value); } catch {} }} placeholder="Tu nombre" /></div>
          <button className="vp-btn" type="submit" disabled={!total || !personas}>Continuar</button>
        </form>
      ) : (
        <div>
          <p className="vp-confirmar">¿Descontar <b>{pesos(conGift)}</b> de la gift card de <b>{nombre}</b>?</p>
          <dl className="vp-reparto">
            <div><dt>Ticket</dt><dd>{pesos(total)} · {personas} {personas === 1 ? 'persona' : 'personas'}</dd></div>
            <div className={aparte ? 'on' : ''}><dt>Paga aparte</dt><dd>{pesos(aparte)}</dd></div>
            <div><dt>{modo === 'unico' ? 'La gift card queda' : 'Le quedan'}</dt><dd>{modo === 'unico' ? 'usada' : pesos(saldo - conGift)}</dd></div>
            {pierde > 0 && <div className="mal"><dt>Se pierde</dt><dd>{pesos(pierde)}</dd></div>}
          </dl>
          <button className="vp-btn" type="button" disabled={enviando} onClick={async () => {
            setEnviando(true);
            const r = await enviar('/api/vp/consumir', { id, permiso, monto: conGift, ticket: total, personas, cajero });
            setEnviando(false);
            if (r) setListo(r as unknown as Listo);
            else router.refresh();
          }}>{enviando ? 'Registrando…' : 'Sí, cobrar'}</button>
          <button className="vp-btn linea" type="button" onClick={() => setPaso('datos')}>Volver</button>
        </div>
      )}
    </div>
  );
}

/** Pantalla de consumo registrado: bronce a pantalla completa, con la hora en movimiento. */
function ConsumoValido({ numero, monto, ticket, saldo, perdido, local, nombre, onCerrar }: Listo & { onCerrar: () => void }) {
  return (
    <div className="vp-valido" role="alert">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/vistapueblo/logo-blanco.png" alt="Vistapueblo" className="vp-valido-logo" />
      <div className="vp-valido-ok" aria-hidden="true">✓</div>
      <p className="vp-valido-t">Consumo registrado</p>
      <p className="vp-valido-monto">{pesos(monto)}</p>
      <p>{nombreDe(nombre)} · {local}</p>
      {ticket > monto && <p className="vp-valido-aparte">El cliente paga aparte {pesos(ticket - monto)}</p>}
      <Reloj />
      <p className="vp-valido-n">Consumo N° {numero} · {saldo ? `le quedan ${pesos(saldo)}` : perdido ? `gift card usada (se perdieron ${pesos(perdido)})` : 'gift card usada completa'}</p>
      <button type="button" className="vp-btn blanco" onClick={onCerrar}>Listo</button>
    </div>
  );
}

/** Si el QR no lee: el código de la tarjeta y, si es digital, el número de 6 cifras que ve el cliente debajo del QR. */
export function CodigoManual({ inicial = '' }: { inicial?: string }) {
  const router = useRouter();
  const [c, setC] = useState(inicial.toUpperCase().slice(0, 14));
  const [n, setN] = useState('');
  return (
    <form className="vp-codigo" onSubmit={(e) => { e.preventDefault(); router.push(`/vistapueblo/caja?codigo=${encodeURIComponent(c)}&n=${encodeURIComponent(n)}`); }}>
      <p className="vp-codigo-t">¿El QR no lee? Escribí los datos de la tarjeta</p>
      <div className="vp-fila2">
        <div><label htmlFor="cCod">Código</label>
          <input id="cCod" autoCapitalize="characters" autoComplete="off" placeholder="VP-XXXX-XXXX" value={c} onChange={(e) => setC(e.target.value.toUpperCase())} maxLength={14} /></div>
        <div><label htmlFor="cNum">Número de 6 cifras <small>(no va en las impresas)</small></label>
          <input id="cNum" inputMode="numeric" autoComplete="off" placeholder="000000" value={n} onChange={(e) => setN(e.target.value.replace(/\D/g, '').slice(0, 6))} /></div>
      </div>
      <button className="vp-btn chico" type="submit" disabled={c.replace(/[^0-9A-Z]/gi, '').length < 10}>Buscar</button>
    </form>
  );
}
