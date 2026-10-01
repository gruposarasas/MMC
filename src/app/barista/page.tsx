import Link from 'next/link';
import { baristaActual, mensajes } from '@/lib/votos';
import { diaHora } from '@/lib/formato';
import { nombreCorto } from '@/lib/sorteo';
import { FotoBarista } from '@/components/Secciones';
import { devolucion } from '@/lib/jurados';
import { fPuntaje } from '@/lib/rondas';
import { EntrarBarista, SalirBarista, FormPerfil } from '@/components/PanelBarista';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Tu perfil de barista · Mundial de Café' };

export default async function PanelDeBarista() {
  const b = await baristaActual();
  if (!b) return <EntrarBarista />;
  const [ms, dev] = await Promise.all([mensajes(b.id), devolucion(b.id)]);
  return (
    <div className="bo" style={{ gridTemplateColumns: '1fr', maxWidth: 760 }}>
      <section>
        <div className="fila">
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <FotoBarista foto={b.foto} nombre={b.nombre} t={64} />
            <div>
              <h1>{b.nombre}</h1>
              <p className="sub" style={{ margin: '2px 0 0' }}>{b.cafeteria || 'Torneo de Baristas'}</p>
            </div>
          </div>
          <SalirBarista />
        </div>
        {dev.map((d) => (
          <section key={d.ronda} className="dev" aria-label={`Devolución de la ${d.ronda}`}>
            <h3>Devolución del jurado · {d.ronda}</h3>
            <table>
              <thead><tr><th>Preparación</th>{d.jurados.map((j) => <th key={j.n} className="n">Jurado {j.n}</th>)}</tr></thead>
              <tbody>
                {d.items.map((i) => (
                  <tr key={i.k}><td>{i.t}</td>{d.jurados.map((j) => <td key={j.n} className="n">{fPuntaje(j.valores[i.k] ?? null)}</td>)}</tr>
                ))}
                <tr className="tot"><td>Puntaje de cada jurado</td>{d.totales.map((t, k) => <td key={k} className="n">{fPuntaje(t)}</td>)}</tr>
              </tbody>
            </table>
            {d.jurados.filter((j) => j.comentario).map((j) => (
              <p key={j.n} className="com"><b>Jurado {j.n}:</b> {j.comentario}</p>
            ))}
            <p className="ayuda">Promedio de los 3 jurados: {fPuntaje(d.promedio)}{d.descuento ? ` · Descuentos de los jueces fiscales: −${d.descuento}` : ''}</p>
            <div className="final"><span>Tu puntaje en la {d.ronda}</span><b>{fPuntaje(d.puntaje)}</b></div>
          </section>
        ))}
        <FormPerfil nombre={b.nombre} inicial={{ foto: b.foto, historia: b.historia, hobby: b.hobby, experiencia: b.experiencia, por_que: b.por_que }} />
        <div className="tarj" style={{ marginTop: 14 }}>
          <h2 style={{ margin: '0 0 4px', fontSize: 17, color: 'var(--arena)' }}>Mensajes de aliento · {ms.length}</h2>
          <p className="ayuda" style={{ marginTop: 0 }}>Te los manda el público desde la app. Recargá la página para ver los nuevos.</p>
          {ms.length ? ms.map((m) => (
            <div key={m.id} className="msj">
              <p>{m.texto}</p>
              <span>{nombreCorto(m.de)} · {diaHora(m.cuando)}</span>
            </div>
          )) : <p style={{ margin: '8px 0 0' }}>Todavía no recibiste mensajes. ¡Completá tu perfil para que el público te conozca!</p>}
        </div>
        <p className="ayuda" style={{ marginTop: 16 }}><Link className="link" href="/baristas">Ver los puntajes del torneo →</Link></p>
      </section>
    </div>
  );
}
