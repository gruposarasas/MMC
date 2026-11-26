import Link from 'next/link';
import { redirect } from 'next/navigation';
import { leerClave, tarjetaPorNumero, validarClave, cajaActual, consumosDeTarjeta, localesPublicos } from '@/lib/vistapueblo-servidor';
import { dondeVale } from '@/lib/vistapueblo';
import { PantallaCobro, Mensaje } from '@/components/vistapueblo/Paginas';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Cobrar gift card · Vistapueblo', manifest: '/vistapueblo/app.webmanifest' };

/** Lo que abre la cámara de la caja al escanear el QR de una gift card. */
export default async function CobrarQr({ params }: { params: Promise<{ clave: string }> }) {
  const { clave } = await params;
  const c = leerClave(decodeURIComponent(clave));
  const t = c ? await tarjetaPorNumero(c.numero) : null;
  const v = t && c ? validarClave(t, c) : 'invalido';
  if (!t || !c || v === 'invalido') return <Mensaje titulo="Este QR no es válido">
    <p className="vp-ayuda">No corresponde a ninguna gift card de Vistapueblo.</p>
  </Mensaje>;

  const caja = await cajaActual();
  if (!caja) {
    if (c.w === null) redirect(`/vistapueblo/g/${t.token}`); // voucher impreso escaneado por su dueño: ve su tarjeta
    return <Mensaje titulo="Este QR es para la caja">
      <p className="vp-ayuda">Se escanea con el celular de la caja del restaurante. Si sos el cajero, configurá este celular con el PIN del local y volvé a escanearlo.</p>
      <Link className="vp-btn" href="/vistapueblo/caja">Configurar la caja</Link>
    </Mensaje>;
  }
  if (v === 'vencido') return <Mensaje titulo="Este QR ya cambió" caja={caja.nombre}>
    <p className="vp-ayuda">El QR de la gift card cambia cada 30 segundos (así una captura de pantalla no sirve). Pedile al cliente que te muestre su pantalla y escanealo de nuevo.</p>
  </Mensaje>;

  const [consumos, ls] = await Promise.all([consumosDeTarjeta(t.id), localesPublicos()]);
  return <PantallaCobro t={t} caja={caja} consumos={consumos} donde={dondeVale(t.todos_los_locales, t.locales, ls)} />;
}
