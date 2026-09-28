import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Toaster } from '@/components/Toast';

export const metadata: Metadata = {
  title: 'Mundial de Café · Beneficios',
  description: 'Tus cupones de descuento del Mundial de Café by Bruno Brown.',
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: 'Mundial Café', statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#281722',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        <link rel="icon" href="/icono-192.png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body>
        <main id="app">{children}</main>
        <Toaster />
      </body>
    </html>
  );
}
