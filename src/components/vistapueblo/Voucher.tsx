// Voucher impreso de Vistapueblo: papel claro (gasta poca tinta), logo carbón, monto en Cinzel y QR fijo.
// Lo usan la página de impresión (servidor) y la vista previa del backoffice (cliente).
import { pesos, fechaLarga, MODOS, type Modo } from '@/lib/vistapueblo';

export type DatosVoucher = { numero?: number; nombre: string; monto: number; vence: string; donde: string; modo: Modo; mensaje: string; codigo?: string; qr?: string };

/** QR de muestra para la vista previa (no se puede escanear). */
const QR_MUESTRA = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 21 21" shape-rendering="crispEdges"><path fill="#282929" d="M0 0h7v7H0zM14 0h7v7h-7zM0 14h7v7H0z"/><path fill="#fff" d="M1 1h5v5H1zM15 1h5v5h-5zM1 15h5v5H1z"/><path fill="#282929" d="M2 2h3v3H2zM16 2h3v3h-3zM2 16h3v3H2zM9 1h1v2H9zM11 3h2v1h-2zM8 5h2v2H8zM9 8h3v1H9zM13 9h2v2h-2zM8 11h2v1H8zM10 13h1v3h-1zM12 12h2v1h-2zM15 14h2v2h-2zM18 12h2v1h-2zM13 17h3v1h-3zM17 18h2v2h-2zM8 18h2v2H8zM12 19h1v1h-1zM1 9h2v1H1zM4 10h2v1H4zM2 12h1v1H2z"/></svg>`;

export function Voucher({ v, formato = 'a4', muestra }: { v: DatosVoucher; formato?: 'a4' | 'ticket'; muestra?: boolean }) {
  return (
    <article className={`vp-voucher ${formato}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="vp-voucher-arbol" src="/vistapueblo/arbol-carbon.png" alt="" />
      <div className="vp-voucher-izq">
        <div className="vp-voucher-cab">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/vistapueblo/logo-carbon.png" alt="Vistapueblo · Inversión & Desarrollo" />
          <span>Gift card</span>
        </div>
        <div className="vp-voucher-monto">{pesos(v.monto)}</div>
        <div className="vp-voucher-para">Para: {v.nombre ? <b>{v.nombre}</b> : <span className="linea" aria-label="espacio para escribir el nombre" />}</div>
        <dl className="vp-voucher-datos">
          <div><dt>Vale en</dt><dd>{v.donde}</dd></div>
          <div><dt>Válida hasta</dt><dd>{v.vence ? fechaLarga(v.vence) : '—'}</dd></div>
          <div><dt>Uso</dt><dd>{MODOS[v.modo].titulo}: {MODOS[v.modo].ayuda.toLowerCase()}</dd></div>
        </dl>
        {v.mensaje && <p className="vp-voucher-msj">“{v.mensaje}”</p>}
      </div>
      <div className="vp-voucher-der">
        <div className="vp-voucher-qr" dangerouslySetInnerHTML={{ __html: v.qr || QR_MUESTRA }} />
        <p className="vp-voucher-cod">{v.codigo || 'VP-XXXX-XXXX'}</p>
        <p className="vp-voucher-ayuda">Presentalo en la caja{v.numero ? ` · N° ${v.numero}` : ''}</p>
        {muestra && <p className="vp-voucher-muestra">Vista previa</p>}
      </div>
    </article>
  );
}
