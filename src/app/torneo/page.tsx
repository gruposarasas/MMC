import Link from 'next/link';
import { redirect } from 'next/navigation';
import { visitanteActual } from '@/lib/datos';
import { perfilesBaristas, votoBaristaDe, rankingBarista, cantidadMensajes } from '@/lib/votos';
import { votosAbiertos, VOTOS_TEXTO } from '@/lib/config';
import { CabSeccion, FotoBarista } from '@/components/Secciones';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Los baristas · Mundial de Café' };

export default async function Torneo() {
  const v = await visitanteActual();
  if (!v) redirect('/');
  const abierto = votosAbiertos();
  const [bs, voto, ranking, msj] = await Promise.all([perfilesBaristas(), votoBaristaDe(v.id), abierto ? null : rankingBarista(), cantidadMensajes()]);
  const favorito = bs.find((b) => b.id === voto);
  return (
    <div className="tel">
      <div className="tel-in">
        <CabSeccion />
        <h1 className="h1">Los baristas</h1>
        <p className="lead">Conocé a los {bs.length} baristas del torneo, mandales un mensaje de aliento y elegí a tu favorito.</p>
        {ranking?.ganadores.length ? (
          <section className="ganador-v" aria-label="Barista favorito del público">
            <p>{ranking.ganadores.length > 1 ? 'Empate: los favoritos del público' : 'El barista favorito del público'}</p>
            {ranking.ganadores.map((g) => (
              <Link key={g.id} href={`/torneo/${g.id}`} className="ganador-it">
                <FotoBarista foto={g.foto} nombre={g.nombre} t={84} />
                <div><b>{g.nombre}</b><span>{g.cafeteria}</span></div>
              </Link>
            ))}
          </section>
        ) : (
          <div className="fav-aviso">
            {favorito ? (
              <p>Tu favorito: <b>{favorito.nombre}</b>. {abierto ? VOTOS_TEXTO : ''}</p>
            ) : abierto ? (
              <p><b>Votá a tu barista favorito.</b> El más votado por el público gana un premio. Se vota una sola vez. {VOTOS_TEXTO}</p>
            ) : (
              <p>La votación del barista favorito cerró.</p>
            )}
          </div>
        )}
        <p style={{ margin: '14px 0 0' }}>
          <Link className="link" href="/competencia">Ver la competencia en vivo →</Link>
        </p>
        <div className="baristas-l">
          {bs.map((b) => (
            <Link key={b.id} href={`/torneo/${b.id}`} className="barista-it">
              <FotoBarista foto={b.foto} nombre={b.nombre} t={56} />
              <div>
                <b>{b.nombre}{b.id === voto && <em className="fav"> ★ tu favorito</em>}</b>
                <span>{[b.cafeteria, msj.get(b.id) ? `${msj.get(b.id)} mensaje${msj.get(b.id) === 1 ? '' : 's'} de aliento` : ''].filter(Boolean).join(' · ')}</span>
              </div>
              <i aria-hidden="true">›</i>
            </Link>
          ))}
          {!bs.length && <p className="lead">Pronto vas a ver acá a los baristas del torneo.</p>}
        </div>
      </div>
    </div>
  );
}
