import Link from 'next/link';
import recursos from '@/lib/recursos.json';

type Tile = { href: string; ic: string; titulo: string; texto: string; ok?: boolean };

/** Accesos de la billetera: votar el stand, conocer a los baristas y el mapa del evento. */
export function Secciones({ stand, barista }: { stand: string; barista: string }) {
  const tiles: Tile[] = [
    { href: '/votar', ic: recursos.ic_estrella, titulo: 'Stand más lindo', texto: stand },
    { href: '/torneo', ic: recursos.ic_taza, titulo: 'Baristas', texto: barista },
    { href: '/mapa', ic: recursos.ic_planta, titulo: 'Mapa', texto: 'Encontrá cada stand' },
  ];
  return (
    <nav className="secs" aria-label="Más del Mundial">
      {tiles.map((t) => (
        <Link key={t.href} href={t.href} className="sec-t">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={t.ic} alt="" />
          <b>{t.titulo}</b>
          <span>{t.texto}</span>
        </Link>
      ))}
    </nav>
  );
}

/** Encabezado de las secciones del visitante, con la vuelta a la billetera. */
export function CabSeccion({ volver = '/billetera', texto = 'Mis cupones' }: { volver?: string; texto?: string }) {
  return (
    <div className="cab-sec">
      <Link href={volver} className="link">← {texto}</Link>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={recursos.logo} alt="Mundial de Café" />
    </div>
  );
}

/** Foto del barista, o sus iniciales si todavía no subió una. */
export function FotoBarista({ foto, nombre, t = 64 }: { foto: string; nombre: string; t?: number }) {
  const ini = nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
  return foto ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="foto-b" src={foto} alt="" style={{ width: t, height: t }} />
  ) : (
    <span className="foto-b ini" style={{ width: t, height: t, fontSize: t * 0.36 }} aria-hidden="true">{ini}</span>
  );
}
