import Link from 'next/link';
import { notFound } from 'next/navigation';
import QRCode from 'qrcode';
import { db } from '@/lib/supabase';
import { tarjetaPorToken, consumosDeTarjeta, cajaActual, localesPublicos, esAdminVP, linkTarjeta } from '@/lib/vistapueblo-servidor';
import { pesos, fechaLarga, diaHora, dondeVale, estadoTarjeta } from '@/lib/vistapueblo';
import { TarjetaVP } from '@/components/vistapueblo/Tarjeta';
import { Cobrar } from '@/components/vistapueblo/Caja';
import { Salir } from '@/components/vistapueblo/Comun';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }) {
  const t = await tarjetaPorToken((await params).token);
  if (!t) return { title: 'Gift card · Vistapueblo' };
  return {
    title: `Gift card de ${pesos(t.monto)} · Vistapueblo`,
    description: `Para ${t.nombre}. Válida hasta el ${fechaLarga(t.vence)} en los restaurantes de Vistapueblo.`,
  };
}

/**
 * La gift card: la ve el cliente (con el QR para mostrar en la caja) y, si la abre una caja configurada,
 * el cajero registra el consumo desde acá.
 */
export default async function GiftCard({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = await tarjetaPorToken(token);
  if (!t) notFound();
  const [caja, ls, consumos, admin] = await Promise.all([cajaActual(), localesPublicos(), consumosDeTarjeta(t.id), esAdminVP()]);
  if (!caja && !admin && !t.vista_at) await db().from('vp_tarjetas').update({ vista_at: new Date().toISOString() }).eq('id', t.id);
  const qr = await QRCode.toString(linkTarjeta(t.token), { type: 'svg', errorCorrectionLevel: 'M', margin: 0, color: { dark: '#282929', light: '#ffffff' } });
  const estado = estadoTarjeta(t);
  const donde = dondeVale(t.todos_los_locales, t.locales, ls);
  const vigentes = consumos.filter((c) => !c.anulado);
  const vale = t.todos_los_locales || (caja ? t.locales.includes(caja.id) : false);
  const usado = t.monto - t.saldo;

  return (
    <main className="vp-gift">
      {caja && (
        <div className="vp-barra-caja">
          <span>Caja: <b>{caja.nombre}</b></span>
          <Salir url="/api/vp/caja/salir" texto="Cambiar" />
        </div>
      )}
      <TarjetaVP nombre={t.nombre} monto={t.monto} vence={t.vence} numero={t.numero} />

      {estado === 'anulada' || estado === 'vencida' || estado === 'agotada' ? (
        <p className={`vp-aviso ${estado}`}>{estado === 'anulada' ? 'Esta gift card fue anulada.' : estado === 'vencida' ? `Esta gift card venció el ${fechaLarga(t.vence)}.` : 'Esta gift card ya se usó completa. ¡Gracias por visitarnos!'}</p>
      ) : caja ? (
        vale ? <Cobrar token={t.token} saldo={t.saldo} nombre={t.nombre} local={caja.nombre} />
          : <p className="vp-aviso anulada">Esta gift card no vale en {caja.nombre}. Vale en: {donde}.</p>
      ) : (
        <section className="vp-qr">
          <div className="vp-qr-img" dangerouslySetInnerHTML={{ __html: qr }} />
          <div>
            <p className="vp-qr-t">Mostrá este código en la caja</p>
            <p className="vp-qr-c">{t.codigo}</p>
          </div>
        </section>
      )}

      <section className="vp-info">
        <div className="vp-saldo">
          <div className="vp-saldo-num"><span>Saldo disponible</span><b>{pesos(estado === 'vencida' || estado === 'anulada' ? 0 : t.saldo)}</b></div>
          <div className="vp-barra" aria-hidden="true"><i style={{ width: `${Math.round((t.saldo / t.monto) * 100)}%` }} /></div>
          <small>{usado ? `Usaste ${pesos(usado)} de ${pesos(t.monto)}.` : 'Todavía no la usaste: podés gastarla en una o varias visitas.'}</small>
        </div>
        {t.mensaje && <p className="vp-mensaje">“{t.mensaje}”</p>}
        <dl className="vp-datos">
          <div><dt>Dónde usarla</dt><dd>{donde}</dd></div>
          <div><dt>Vence</dt><dd>{fechaLarga(t.vence)}</dd></div>
        </dl>
        {vigentes.length > 0 && (
          <div className="vp-historial">
            <h3>Tus consumos</h3>
            <ul>{vigentes.map((c) => <li key={c.id}><span>{diaHora(c.created_at)} · {c.local}</span><b>− {pesos(c.monto)}</b></li>)}</ul>
          </div>
        )}
      </section>

      <footer className="vp-pie">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/vistapueblo/logo-beige.png" alt="Vistapueblo · Inversión & Desarrollo" />
        {!caja && <Link className="vp-link tenue" href={`/vistapueblo/caja?volver=/vistapueblo/g/${t.token}`}>¿Sos cajero? Configurá tu caja</Link>}
      </footer>
    </main>
  );
}
