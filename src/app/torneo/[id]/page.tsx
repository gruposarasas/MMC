import { notFound, redirect } from 'next/navigation';
import { visitanteActual } from '@/lib/datos';
import { perfilBarista, votoBaristaDe, cantidadMensajes } from '@/lib/votos';
import { votosAbiertos } from '@/lib/config';
import { CabSeccion, FotoBarista } from '@/components/Secciones';
import { AccionesBarista } from '@/components/AccionesBarista';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Barista · Mundial de Café' };

const BLOQUES = [
  ['historia', 'Su historia'],
  ['experiencia', 'Su experiencia'],
  ['hobby', 'Su hobby'],
  ['por_que', '¿Por qué merece ganar el Mundial de Café?'],
] as const;

export default async function Barista({ params }: { params: Promise<{ id: string }> }) {
  const v = await visitanteActual();
  if (!v) redirect('/');
  const { id } = await params;
  const [b, voto, msj] = await Promise.all([perfilBarista(id), votoBaristaDe(v.id), cantidadMensajes()]);
  if (!b) notFound();
  const vacio = BLOQUES.every(([k]) => !b[k]);
  return (
    <div className="tel">
      <div className="tel-in">
        <CabSeccion volver="/torneo" texto="Los baristas" />
        <div className="perfil-cab">
          <FotoBarista foto={b.foto} nombre={b.nombre} t={132} />
          <h1 className="h1" style={{ margin: '14px 0 2px' }}>{b.nombre}</h1>
          {b.cafeteria && <p className="lead">{b.cafeteria}</p>}
        </div>
        {vacio ? (
          <p className="lead" style={{ marginTop: 18 }}>{b.nombre.split(' ')[0]} todavía no completó su perfil. ¡Mandale aliento igual!</p>
        ) : (
          BLOQUES.filter(([k]) => b[k]).map(([k, t]) => (
            <section key={k} className={`perfil-b ${k === 'por_que' ? 'destacado' : ''}`}>
              <h2>{t}</h2>
              <p>{b[k]}</p>
            </section>
          ))
        )}
        <AccionesBarista id={b.id} nombre={b.nombre} voto={voto} abierto={votosAbiertos()} mensajes={msj.get(b.id) || 0} />
      </div>
    </div>
  );
}
