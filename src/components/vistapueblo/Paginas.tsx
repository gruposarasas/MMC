// Piezas de servidor que comparten la tarjeta del cliente (/g) y la pantalla de cobro de la caja (/c).
import Link from 'next/link';
import { permisoCobro, type Tarjeta, type Consumo } from '@/lib/vistapueblo-servidor';
import { pesos, fechaLarga, diaHora, estadoTarjeta, nombreDe, MODOS } from '@/lib/vistapueblo';
import { TarjetaVP } from './Tarjeta';
import { Cobrar } from './Caja';
import { Salir } from './Comun';

export function AvisoEstado({ t }: { t: Tarjeta }) {
  const e = estadoTarjeta(t);
  if (e === 'anulada') return <p className="vp-aviso anulada">Esta gift card fue anulada.</p>;
  if (e === 'vencida') return <p className="vp-aviso vencida">Esta gift card venció el {fechaLarga(t.vence)}.</p>;
  if (e === 'agotada') return <p className="vp-aviso agotada">Esta gift card ya se usó{t.modo === 'unico' ? '' : ' completa'}. ¡Gracias por visitarnos!</p>;
  return null;
}

export function InfoTarjeta({ t, consumos, donde, caja }: { t: Tarjeta; consumos: Consumo[]; donde: string; caja?: boolean }) {
  const e = estadoTarjeta(t);
  const vigentes = consumos.filter((c) => !c.anulado);
  const usado = vigentes.reduce((s, c) => s + c.monto, 0);
  return (
    <section className="vp-info">
      <div className="vp-saldo">
        <div className="vp-saldo-num"><span>Saldo disponible</span><b>{pesos(e === 'vencida' || e === 'anulada' ? 0 : t.saldo)}</b></div>
        <div className="vp-barra" aria-hidden="true"><i style={{ width: `${Math.round((t.saldo / t.monto) * 100)}%` }} /></div>
        <small>{usado ? `${caja ? 'Usó' : 'Usaste'} ${pesos(usado)} de ${pesos(t.monto)}.` : MODOS[t.modo].enTarjeta}</small>
      </div>
      {t.mensaje && <p className="vp-mensaje">“{t.mensaje}”</p>}
      <dl className="vp-datos">
        <div><dt>Dónde usarla</dt><dd>{donde}</dd></div>
        <div><dt>Vence</dt><dd>{fechaLarga(t.vence)}</dd></div>
        <div><dt>Cómo se usa</dt><dd>{MODOS[t.modo].titulo}: {MODOS[t.modo].ayuda.toLowerCase()}</dd></div>
      </dl>
      {vigentes.length > 0 && (
        <div className="vp-historial">
          <h3>{caja ? 'Consumos' : 'Tus consumos'}</h3>
          <ul>{vigentes.map((c) => <li key={c.id}><span>{diaHora(c.created_at)} · {c.local}</span><b>− {pesos(c.monto)}</b></li>)}</ul>
        </div>
      )}
    </section>
  );
}

export function BarraCaja({ nombre }: { nombre: string }) {
  return (
    <div className="vp-barra-caja">
      <span>Caja: <b>{nombre}</b></span>
      <Salir url="/api/vp/caja/salir" texto="Cambiar" />
    </div>
  );
}

/** La caja cobra: llega acá escaneando un QR válido (el que cambia de la pantalla del cliente o el del voucher impreso). */
export function PantallaCobro({ t, caja, consumos, donde }: { t: Tarjeta; caja: { id: string; nombre: string }; consumos: Consumo[]; donde: string }) {
  const e = estadoTarjeta(t);
  const vale = t.todos_los_locales || t.locales.includes(caja.id);
  return (
    <main className="vp-gift">
      <BarraCaja nombre={caja.nombre} />
      <TarjetaVP nombre={nombreDe(t.nombre)} monto={t.monto} vence={t.vence} numero={t.numero} />
      {e === 'anulada' || e === 'vencida' || e === 'agotada' ? <AvisoEstado t={t} />
        : !vale ? <p className="vp-aviso anulada">Esta gift card no vale en {caja.nombre}. Vale en: {donde}.</p>
        : <Cobrar id={t.id} permiso={permisoCobro(t.id, caja.id)} saldo={t.saldo} nombre={nombreDe(t.nombre)} local={caja.nombre} modo={t.modo} />}
      <InfoTarjeta t={t} consumos={consumos} donde={donde} caja />
      <footer className="vp-pie"><Link className="vp-link tenue" href="/vistapueblo/caja">Ir a la caja</Link></footer>
    </main>
  );
}

/** Pantalla de un solo mensaje (QR vencido, inválido, etc.). */
export function Mensaje({ titulo, children, caja }: { titulo: string; children?: React.ReactNode; caja?: string }) {
  return (
    <main className="vp-caja">
      {caja && <BarraCaja nombre={caja} />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="vp-caja-logo" src="/vistapueblo/logo-beige.png" alt="Vistapueblo" />
      <div className="vp-panel vp-mensaje-panel">
        <h2>{titulo}</h2>
        {children}
      </div>
    </main>
  );
}
