import Link from 'next/link';
import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Banco de Trabajo · AEHGA',
  description: 'Banco de trabajo gastronómico y hotelero de la Asociación Empresaria Hotelero Gastronómica y Afines de Mendoza.',
  robots: { index: true, follow: true },
  icons: { icon: '/trabajo/icono.png', apple: '/trabajo/icono.png' },
};
export const viewport: Viewport = { themeColor: '#ffffff' };

export default function LayoutTrabajo({ children }: { children: React.ReactNode }) {
  return (
    <div className="bt">
      <header className="bt-cab">
        <Link href="/trabajo" className="bt-marca" aria-label="Banco de Trabajo AEHGA, inicio">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/trabajo/isotipo.png" alt="" width={46} height={38} />
          <span><b>Banco de Trabajo</b><small>AEHGA · Mendoza</small></span>
        </Link>
        <nav aria-label="Banco de trabajo">
          <Link href="/trabajo/vacantes">Vacantes</Link>
          <Link href="/trabajo/postulante">Busco trabajo</Link>
          <Link href="/trabajo/empresa">Busco personal</Link>
        </nav>
      </header>
      <div className="bt-cuerpo">{children}</div>
      <footer className="bt-pie-sitio">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/trabajo/logo.png" alt="AEHGA · Asociación Empresaria Hotelero Gastronómica y Afines de Mendoza" width={150} />
        <p>Banco de trabajo gastronómico y hotelero de Mendoza.</p>
      </footer>
    </div>
  );
}
