import Link from 'next/link';
import { vacantesAbiertas } from '@/lib/trabajo-servidor';
import { TarjetaVacante } from '@/components/trabajo/Tarjetas';

export const dynamic = 'force-dynamic';

export default async function Portada() {
  const vs = await vacantesAbiertas({}, 6);
  return (
    <>
      <section className="bt-hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/trabajo/isotipo.png" alt="" className="bt-hero-iso" />
        <h1>Trabajo en gastronomía y hotelería en Mendoza</h1>
        <p>Cargá tu CV una sola vez y que te encuentren los hoteles y restaurantes. O, si tenés un establecimiento, encontrá a tu próximo equipo.</p>
        <div className="bt-dos-botones">
          <Link className="bt-gran" href="/trabajo/postulante">
            <b>Busco trabajo</b>
            <span>Cargá tu CV y postulate a las vacantes</span>
          </Link>
          <Link className="bt-gran oscuro" href="/trabajo/empresa">
            <b>Busco personal</b>
            <span>Buscá CVs y publicá vacantes</span>
          </Link>
        </div>
      </section>
      <section>
        <div className="bt-titulo">
          <h2>Últimas vacantes</h2>
          <Link className="bt-link" href="/trabajo/vacantes">Ver todas →</Link>
        </div>
        {vs.length ? <div className="bt-grilla">{vs.map((v) => <TarjetaVacante key={v.id} v={v} />)}</div>
          : <p className="bt-vacio">Todavía no hay vacantes publicadas. Cargá tu CV y te van a encontrar igual.</p>}
      </section>
      <section className="bt-pasos">
        <div><b>1</b><h3>Cargá tu CV</h3><p>En PDF o con una foto desde el celular. Dejá tu WhatsApp, tu mail y el puesto que buscás.</p></div>
        <div><b>2</b><h3>Te encuentran</h3><p>Los hoteles y restaurantes buscan por puesto, zona, edad y experiencia.</p></div>
        <div><b>3</b><h3>Te contactan</h3><p>Te escriben directo por WhatsApp o mail. También podés postularte a las vacantes.</p></div>
      </section>
    </>
  );
}
