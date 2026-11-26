import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/supabase';
import { tarjetaPorToken, consumosDeTarjeta, cajaActual, localesPublicos, esAdminVP, qrVivo, vapid } from '@/lib/vistapueblo-servidor';
import { pesos, fechaLarga, dondeVale, estadoTarjeta, nombreDe } from '@/lib/vistapueblo';
import { TarjetaVP } from '@/components/vistapueblo/Tarjeta';
import { AvisoEstado, InfoTarjeta, BarraCaja, PantallaCobro } from '@/components/vistapueblo/Paginas';
import { QrVivo, ActivarAvisos } from '@/components/vistapueblo/Vivo';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = await tarjetaPorToken(token);
  if (!t) return { title: 'Gift card · Vistapueblo' };
  return {
    title: `Gift card de ${pesos(t.monto)} · Vistapueblo`,
    description: `${t.nombre ? `Para ${t.nombre}. ` : ''}Válida hasta el ${fechaLarga(t.vence)} en los restaurantes de Vistapueblo.`,
    manifest: `/vistapueblo/g/${token}/app.webmanifest`,
    appleWebApp: { capable: true, title: 'Gift card', statusBarStyle: 'black-translucent' as const },
  };
}

/**
 * La gift card del cliente: QR que cambia cada 30 segundos, saldo e historial.
 * Si la abre una caja: el voucher impreso se cobra desde acá; la digital se cobra escaneando el QR de la pantalla del cliente.
 */
export default async function GiftCard({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = await tarjetaPorToken(token);
  if (!t) notFound();
  const [caja, ls, consumos, admin] = await Promise.all([cajaActual(), localesPublicos(), consumosDeTarjeta(t.id), esAdminVP()]);
  const donde = dondeVale(t.todos_los_locales, t.locales, ls);
  if (caja && t.impresa) return <PantallaCobro t={t} caja={caja} consumos={consumos} donde={donde} />;

  if (!caja && !admin && !t.vista_at) await db().from('vp_tarjetas').update({ vista_at: new Date().toISOString() }).eq('id', t.id);
  const estado = estadoTarjeta(t);
  const usable = estado === 'sin_usar' || estado === 'parcial';
  const [qr, clave] = await Promise.all([usable ? qrVivo(t) : null, usable ? vapid().then((k) => k.publica).catch(() => null) : null]);

  return (
    <main className="vp-gift">
      {caja && <BarraCaja nombre={caja.nombre} />}
      {caja && <p className="vp-aviso">Para cobrar, escaneá con este celular el QR que el cliente tiene en su pantalla.</p>}
      <TarjetaVP nombre={nombreDe(t.nombre)} monto={t.monto} vence={t.vence} numero={t.numero} />
      {usable && qr ? <QrVivo token={t.token} codigo={t.codigo} inicial={qr} consumos={consumos.filter((c) => !c.anulado).length} /> : <AvisoEstado t={t} />}
      {usable && clave && !caja && <ActivarAvisos token={t.token} clave={clave} />}
      <InfoTarjeta t={t} consumos={consumos} donde={donde} />
      <footer className="vp-pie">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/vistapueblo/logo-beige.png" alt="Vistapueblo · Inversión & Desarrollo" />
        {!caja && <Link className="vp-link tenue" href="/vistapueblo/caja">¿Sos cajero? Configurá tu caja</Link>}
      </footer>
    </main>
  );
}
