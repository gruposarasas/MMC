/** Manifiesto de las pantallas de Vistapueblo (caja, panel del local, backoffice): el ícono abre la caja. Cada gift card tiene el suyo. */
export function GET() {
  return Response.json({
    name: 'Gift cards Vistapueblo',
    short_name: 'Vistapueblo',
    lang: 'es-AR',
    start_url: '/vistapueblo/caja',
    scope: '/vistapueblo/',
    display: 'standalone',
    background_color: '#1f2020',
    theme_color: '#282929',
    icons: [{ src: '/vistapueblo/icono.png', sizes: '512x512', type: 'image/png', purpose: 'any' }],
  }, { headers: { 'Content-Type': 'application/manifest+json' } });
}
