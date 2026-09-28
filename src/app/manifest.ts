import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Mundial de Café · Beneficios',
    short_name: 'Mundial Café',
    description: 'Tus cupones de descuento del Mundial de Café by Bruno Brown.',
    lang: 'es-AR',
    start_url: '/billetera',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#281722',
    theme_color: '#281722',
    icons: [
      { src: '/icono-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icono-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icono-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
