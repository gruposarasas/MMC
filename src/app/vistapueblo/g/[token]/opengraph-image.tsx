import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ImageResponse } from 'next/og';
import { tarjetaPorToken } from '@/lib/vistapueblo-servidor';
import { pesos, fechaLarga } from '@/lib/vistapueblo';

// Vista previa del link (WhatsApp, mail): la gift card con el monto y el nombre.
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Gift card de Vistapueblo';

const dataUrl = async (archivo: string) => `data:image/png;base64,${(await readFile(path.join(process.cwd(), 'public/vistapueblo', archivo))).toString('base64')}`;

export default async function Imagen({ params }: { params: Promise<{ token: string }> }) {
  const t = await tarjetaPorToken((await params).token);
  const [logo, arbol] = await Promise.all([dataUrl('logo-beige.png'), dataUrl('arbol-beige.png')]);
  const beige = '#BFB797';
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1d1e1e' }}>
        <div style={{ width: 960, height: 540, borderRadius: 36, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '48px 56px', position: 'relative', overflow: 'hidden', background: 'linear-gradient(135deg, #343535 0%, #282929 55%, #202121 100%)', border: `2px solid rgba(191,183,151,.45)` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={arbol} width={520} height={364} style={{ position: 'absolute', right: -90, bottom: -60, opacity: 0.08 }} alt="" />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logo} width={250} height={165} alt="" />
            <div style={{ color: beige, fontSize: 30, letterSpacing: 10, textTransform: 'uppercase', marginTop: 12 }}>Gift card</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ color: beige, fontSize: 112, fontWeight: 700, lineHeight: 1 }}>{t ? pesos(t.monto) : 'Gift card'}</div>
            {t && t.nombre && <div style={{ color: "#efeadb", fontSize: 38, marginTop: 14 }}>{`Para ${t.nombre}`}</div>}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'rgba(239,234,219,.75)', fontSize: 26, borderTop: '2px solid #8B7851', paddingTop: 18 }}>
            <span>{t ? `Válida hasta ${fechaLarga(t.vence)}` : 'Restaurantes de Vistapueblo'}</span>
            <span>{t ? `N° ${t.numero}` : ''}</span>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
