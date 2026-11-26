import { pesos, fechaLarga } from '@/lib/vistapueblo';

/** La gift card tal como la ve el cliente (y la vista previa del backoffice). */
export function TarjetaVP({ nombre, monto, vence, numero, chica }: { nombre: string; monto: number; vence: string; numero?: number; chica?: boolean }) {
  return (
    <div className={`vp-card${chica ? ' chica' : ''}`} role="img" aria-label={`Gift card de Vistapueblo por ${pesos(monto)} para ${nombre}, válida hasta el ${fechaLarga(vence)}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="vp-card-arbol" src="/vistapueblo/arbol-beige.png" alt="" />
      <div className="vp-card-arriba">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="vp-card-logo" src="/vistapueblo/logo-beige.png" alt="Vistapueblo" />
        <span className="vp-card-tipo">Gift card</span>
      </div>
      <div className="vp-card-monto">{pesos(monto)}</div>
      <div className="vp-card-para">Para <b>{nombre || 'Nombre del cliente'}</b></div>
      <div className="vp-card-abajo">
        <span>Válida hasta {vence ? fechaLarga(vence) : '—'}</span>
        {numero ? <span>N° {numero}</span> : null}
      </div>
    </div>
  );
}
