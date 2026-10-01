import { redirect } from 'next/navigation';
import { visitanteActual } from '@/lib/datos';
import { marcasParaVotar, votoStandDe, rankingStand } from '@/lib/votos';
import { votosAbiertos, VOTOS_TEXTO } from '@/lib/config';
import { CabSeccion } from '@/components/Secciones';
import { VotarStand } from '@/components/VotarStand';
import { Emb } from '@/components/Emb';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'El stand más lindo · Mundial de Café' };

export default async function Votar() {
  const v = await visitanteActual();
  if (!v) redirect('/');
  const abierto = votosAbiertos();
  const [marcas, voto, ranking] = await Promise.all([marcasParaVotar(), votoStandDe(v.id), abierto ? null : rankingStand()]);
  return (
    <div className="tel">
      <div className="tel-in">
        <CabSeccion />
        <h1 className="h1">El stand más lindo</h1>
        {ranking?.ganadores.length ? (
          <section className="ganador-v" aria-label="Ganador">
            <p>{ranking.ganadores.length > 1 ? 'Empate: los stands más lindos del Mundial' : 'El stand más lindo del Mundial'}</p>
            {ranking.ganadores.map((g) => (
              <div key={g.id} className="ganador-it">
                <Emb logoUrl={g.logo} emblema={g.emblema} nombre={g.nombre} t={84} />
                <div><b>{g.nombre}</b><span>{g.stand}</span></div>
              </div>
            ))}
          </section>
        ) : (
          <p className="lead">
            Recorré el Mundial y votá el stand que más te gustó. Se puede votar <b>una sola vez</b>. {abierto ? VOTOS_TEXTO : ''}
          </p>
        )}
        <div style={{ marginTop: 18 }}>
          <VotarStand marcas={marcas} voto={voto} abierto={abierto} />
        </div>
      </div>
    </div>
  );
}
