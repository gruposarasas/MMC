import type { Metadata, Viewport } from 'next';
import { URL_PUBLICA } from '@/lib/config';

export const metadata: Metadata = {
  metadataBase: new URL(URL_PUBLICA),
  title: 'Gift cards · Vistapueblo',
  description: 'Gift cards para los restaurantes de Vistapueblo.',
  robots: { index: false, follow: false },
  icons: { icon: '/vistapueblo/icono.png', apple: '/vistapueblo/icono.png' },
};
export const viewport: Viewport = { themeColor: '#282929' };

export default function LayoutVistapueblo({ children }: { children: React.ReactNode }) {
  return (
    <div className="vp">
      {/* Cinzel: la letra con serifas del logo de Vistapueblo. */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700&display=swap" precedence="default" />
      {children}
    </div>
  );
}
