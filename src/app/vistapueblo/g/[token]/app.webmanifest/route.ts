import { tarjetaPorToken } from '@/lib/vistapueblo-servidor';
import { pesos } from '@/lib/vistapueblo';

/** Manifiesto de cada tarjeta: si el cliente la agrega a la pantalla de inicio, el ícono abre su gift card. */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = await tarjetaPorToken(token);
  if (!t) return new Response('No existe', { status: 404 });
  return Response.json({
    name: `Gift card Vistapueblo ${pesos(t.monto)}`,
    short_name: 'Gift card',
    lang: 'es-AR',
    start_url: `/vistapueblo/g/${token}`,
    scope: '/vistapueblo/',
    display: 'standalone',
    background_color: '#1f2020',
    theme_color: '#282929',
    icons: [{ src: '/vistapueblo/icono.png', sizes: '512x512', type: 'image/png', purpose: 'any' }],
  }, { headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'no-store' } });
}
