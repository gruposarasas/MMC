import QRCode from 'qrcode';
import { esAdmin } from '@/lib/datos';
import { URL_PUBLICA } from '@/lib/config';
import { estadoSorteo } from '@/lib/sorteo';
import { EntrarAdmin } from '@/components/admin/Comun';
import { PantallaSorteo } from '@/components/admin/PantallaSorteo';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sorteo · Mundial de Café' };

export default async function Sorteo() {
  if (!(await esAdmin())) return <EntrarAdmin />;
  const [inicial, qr] = await Promise.all([
    estadoSorteo(),
    QRCode.toString(URL_PUBLICA, { type: 'svg', errorCorrectionLevel: 'M', margin: 0, color: { dark: '#281722', light: '#ffffff' } }),
  ]);
  return (
    <PantallaSorteo
      qr={qr}
      url={URL_PUBLICA}
      inicial={inicial}
    />
  );
}
