import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BB-CONTROL · Bruno Brown',
  description: 'Ventas, compras, gastos, sueldos, equipo, costos y KPI de Bruno Brown.',
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: 'BB-CONTROL', statusBarStyle: 'black-translucent' },
  icons: { icon: '/favicon.png', apple: '/apple-touch-icon.png' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#281722',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR">
      <head>
        <link rel="preload" href="/fonts/poppins-latin-400-normal.woff2" as="font" type="font/woff2" crossOrigin="" />
        <link rel="preload" href="/fonts/poppins-latin-700-normal.woff2" as="font" type="font/woff2" crossOrigin="" />
      </head>
      <body>{children}</body>
    </html>
  );
}
