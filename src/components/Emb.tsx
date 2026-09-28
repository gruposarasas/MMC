import { urlLogo } from '@/lib/config';
import recursos from '@/lib/recursos.json';

type Props = { logo?: string | null; logoUrl?: string; emblema: string; nombre: string; t: number };

/** Logo de la marca sobre fondo blanco o, si no tiene, su figura. */
export function Emb({ logo, logoUrl, emblema, nombre, t }: Props) {
  const src = logoUrl ?? urlLogo(logo);
  if (src)
    return (
      <span className="logo-tile" style={{ width: t, height: t }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={nombre} />
      </span>
    );
  const ic = (recursos as Record<string, string>)['ic_' + emblema] || recursos.ic_taza;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={ic} alt="" style={{ width: t, height: t, borderRadius: 10 }} />;
}
