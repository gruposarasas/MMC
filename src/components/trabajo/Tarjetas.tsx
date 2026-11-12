import Link from 'next/link';
import { nombrePuesto, nombreDisp, nombreIdioma, linkWhatsapp } from '@/lib/trabajo';
import { fechaCorta } from './fechas';

type P = {
  id: string; nombre: string; edad: number; mail: string; whatsapp: string; direccion: string; localidad: string; departamento: string;
  puesto: string; puestos_extra?: string[]; puesto_otro: string; puesto_actual: string; experiencia: number;
  disponibilidad: string[]; idiomas: string[]; movilidad: boolean; sobre_mi: string; cv_path: string | null;
};

const exp = (n: number) => (n === 0 ? 'Sin experiencia' : n === 1 ? '1 año de experiencia' : `${n >= 30 ? '30 o más' : n} años de experiencia`);

/** Tarjeta de un postulante para la empresa: datos para filtrar de un vistazo, contacto y CV. */
export function TarjetaPostulante({ p, extra, para }: { p: P; extra?: React.ReactNode; para?: string }) {
  const puestos = [p.puesto, ...(p.puestos_extra || [])].map((k) => (k === 'otro' && p.puesto_otro ? p.puesto_otro : nombrePuesto(k)));
  const saludo = `Hola ${p.nombre.split(' ')[0]}, te escribimos por tu CV del Banco de Trabajo de AEHGA${para ? ` (${para})` : ''}.`;
  return (
    <article className="bt-tarj bt-pers">
      <header>
        <div>
          <h3>{p.nombre}</h3>
          <p className="bt-meta">{p.edad} años · {p.localidad ? `${p.localidad}, ` : ''}{p.departamento}</p>
        </div>
        {extra}
      </header>
      <p className="bt-puestos">{puestos.map((x) => <span key={x}>{x}</span>)}</p>
      <ul className="bt-datos">
        <li>{exp(p.experiencia)}{p.puesto_actual ? ` · ${p.puesto_actual}` : ''}</li>
        <li>📍 {p.direccion}</li>
        {p.disponibilidad.length > 0 && <li>🕒 {p.disponibilidad.map(nombreDisp).join(' · ')}</li>}
        {(p.idiomas.length > 0 || p.movilidad) && <li>{[...p.idiomas.map(nombreIdioma), p.movilidad ? 'Movilidad propia' : ''].filter(Boolean).join(' · ')}</li>}
      </ul>
      {p.sobre_mi && <p className="bt-sobre">{p.sobre_mi}</p>}
      <div className="bt-contacto">
        {p.cv_path && <a className="bt-btn chico" href={`/api/trabajo/cv/${p.id}`} target="_blank" rel="noopener noreferrer">Ver CV</a>}
        <a className="bt-btn chico wa" href={linkWhatsapp(p.whatsapp, saludo)} target="_blank" rel="noopener noreferrer">WhatsApp</a>
        <a className="bt-btn chico linea" href={`mailto:${p.mail}?subject=${encodeURIComponent('Búsqueda laboral · Banco de Trabajo AEHGA')}`}>Mail</a>
      </div>
    </article>
  );
}

type V = { id: string; titulo: string; puesto: string; departamento: string; jornada: string; sueldo: string; created_at: string; empresa?: { nombre: string; tipo: string } | null };

export function TarjetaVacante({ v, href }: { v: V; href?: string }) {
  return (
    <Link className="bt-tarj bt-vac" href={href ?? `/trabajo/vacantes/${v.id}`}>
      <span className="bt-tag">{nombrePuesto(v.puesto)}</span>
      <h3>{v.titulo}</h3>
      <p className="bt-meta">{v.empresa?.nombre ? `${v.empresa.nombre} · ` : ''}{v.departamento} · {nombreDisp(v.jornada)}</p>
      <p className="bt-pie">{v.sueldo ? <b>{v.sueldo}</b> : <span />}<span>{fechaCorta(v.created_at)}</span></p>
    </Link>
  );
}
