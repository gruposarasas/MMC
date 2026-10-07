import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'BB-CONTROL · Bruno Brown',
    short_name: 'BB-CONTROL',
    description: 'La app de Bruno Brown para el equipo y la administración.',
    lang: 'es-AR',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#281722',
    theme_color: '#281722',
    icons: [
      { src: '/icono-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icono-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icono-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
