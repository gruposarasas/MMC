import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'GM-CONTROL · Grupo Modesto',
  description: 'Ventas, compras, gastos, sueldos, equipo, costos y KPI de Grupo Modesto.',
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: 'GM-CONTROL', statusBarStyle: 'black-translucent' },
  icons: { icon: '/favicon.png', apple: '/apple-touch-icon.png' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#45302D',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR">
      <head>
        <link rel="preload" href="/fonts/nunito-sans-latin-400-normal.woff2" as="font" type="font/woff2" crossOrigin="" />
        <link rel="preload" href="/fonts/nunito-sans-latin-700-normal.woff2" as="font" type="font/woff2" crossOrigin="" />
      </head>
      <body>{children}</body>
    </html>
  );
}
