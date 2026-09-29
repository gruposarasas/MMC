import Link from 'next/link';
import { redirect } from 'next/navigation';
import { visitanteActual, billetera } from '@/lib/datos';
import { fDMY, soloEvento, vencida, diaCortoHora, formatoTel } from '@/lib/formato';
import recursos from '@/lib/recursos.json';
import { Emb } from '@/components/Emb';
import { Salir } from '@/components/Salir';
import { AvisoInicial } from '@/components/Toast';
import { Instalar } from '@/components/Instalar';
import { SorteoVisitante } from '@/components/SorteoVisitante';
import { sorteoAbierto } from '@/lib/sorteo';
import { db } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const AVISOS: Record<string, string> = {
  ya: 'Ya estabas registrado: acá están tus cupones.',
  rec: 'Listo: estos son tus cupones.',
};

export default async function Billetera({ searchParams }: { searchParams: Promise<{ aviso?: string }> }) {
  const v = await visitanteActual();
  if (!v) redirect('/');
  const { aviso } = await searchParams;
  const [{ marcas, usados, canjes }, abierto, pres] = await Promise.all([
    billetera(v.id),
    sorteoAbierto(),
    db().from('visitantes').select('presente_at').eq('id', v.id).maybeSingle(),
  ]);
  const primer = v.nombre.split(' ')[0];

  const cupones = marcas.map((m) => {
    const vc = vencida(m.vence);
    const r = vc ? 0 : Math.max(0, m.creditos - (usados.get(m.id) || 0));
    return { m, vc, r };
  });
  const disp = cupones.reduce((a, c) => a + c.r, 0);
  const lugares = cupones.filter((c) => c.r > 0).length;

  return (
    <div className="tel">
      {aviso && AVISOS[aviso] && <AvisoInicial texto={AVISOS[aviso]} />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="deco" src={recursos.ic_flor} alt="" style={{ width: 150, right: -50, top: -30 }} />
      <div className="tel-in">
        <div className="saludo">
          <div>
            <p>Hola,</p>
            <b>{primer}</b>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={recursos.logo} alt="Mundial de Café" style={{ width: 118 }} />
        </div>
        <p className="guardado">
          Tus cupones están guardados con {v.mail ? <>tu mail <b>{v.mail}</b></> : <>tu WhatsApp <b>{formatoTel(v.whatsapp || '')}</b></>}. Con él los recuperás desde cualquier celular.
        </p>
        <SorteoVisitante abiertoIni={abierto} presenteIni={!!pres.data?.presente_at} />
        <Instalar />
        <p className="resumen-b">
          {disp
            ? `Tenés ${disp} beneficio${disp > 1 ? 's' : ''} para usar en ${lugares === 1 ? '1 cafetería' : `${lugares} cafeterías`}.`
            : cupones.length
              ? 'Ya usaste todos tus beneficios. ¡Gracias por venir!'
              : 'Todavía no hay cupones cargados. Volvé en un rato.'}
        </p>
        {cupones.map(({ m, vc, r }) => (
          <article key={m.id} className={`cupon ${r ? '' : 'agotado'}`}>
            <div className="emb">
              <Emb logo={m.logo_path} emblema={m.emblema} nombre={m.nombre} t={58} />
            </div>
            <div className="cu">
              <div className="cu-marca">
                {m.nombre} <span>{m.stand}</span>
              </div>
              <div className="cu-benef">{m.beneficio}</div>
              <p className="cu-cond">{m.condiciones}</p>
              <p className="cu-vence">{vc ? `Venció el ${fDMY(m.vence)}` : soloEvento(m.vence) ? 'Válido durante el Mundial' : `Vence el ${fDMY(m.vence)}`}</p>
              {!vc && !soloEvento(m.vence) && m.sucursales && <p className="cu-suc">Después del Mundial, también en {m.sucursales}</p>}
              <div className="cu-pie">
                <div className="granos" aria-label={`Te quedan ${r} de ${m.creditos}`}>
                  {Array.from({ length: m.creditos }, (_, i) => (
                    <i key={i} className={i < m.creditos - r ? 'usado' : ''} />
                  ))}
                  <span>{vc ? 'Vencido' : r ? `${r} de ${m.creditos}` : 'Usado'}</span>
                </div>
                {r > 0 && (
                  <Link className="cu-usar" href={`/canjear/${m.id}`}>
                    Usar
                  </Link>
                )}
              </div>
            </div>
          </article>
        ))}
        {canjes.length > 0 && (
          <div className="hist">
            <h2>Tus canjes</h2>
            {canjes.map((c) => (
              <div className="hist-it" key={c.id}>
                <div>
                  {c.marca}
                  <br />
                  <span>{c.beneficio}</span>
                </div>
                <span>{diaCortoHora(c.created_at)}</span>
              </div>
            ))}
          </div>
        )}
        <p style={{ marginTop: 28, textAlign: 'center' }}>
          <Salir nombre={primer} />
        </p>
      </div>
    </div>
  );
}
