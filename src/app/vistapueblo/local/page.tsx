import { localActual } from '@/lib/vistapueblo-servidor';
import { EntrarLocal, Salir, AutoRecarga } from '@/components/vistapueblo/Comun';
import { Metricas, leerRango } from '@/components/vistapueblo/Metricas';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Panel del local · Gift cards Vistapueblo', manifest: '/vistapueblo/app.webmanifest' };

/** Panel de cada restaurante: sus consumos con gift card, métricas y lo que Vistapueblo le descuenta del alquiler. */
export default async function PanelLocal({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const l = await localActual();
  if (!l) return <EntrarLocal />;
  const { desde, hasta } = leerRango(await searchParams);
  return (
    <div className="vp-bo">
      <AutoRecarga />
      <header className="vp-bo-cab">
        <span className="vp-bo-marca">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/vistapueblo/logo-beige.png" alt="Vistapueblo" />
          <span>{l.nombre}</span>
        </span>
        <nav aria-label="Secciones"><a className="on" href="/vistapueblo/local">Gift cards</a></nav>
        <Salir url="/api/vp/local/salir" />
      </header>
      <section className="vp-bo-cuerpo">
        <h1 className="vp-h1">Gift cards en {l.nombre}</h1>
        <p className="vp-sub">Hoy tu local absorbe el <b>{l.porcentaje}%</b> de cada consumo con gift card; el resto lo cubre Vistapueblo y se descuenta del alquiler a fin de mes.</p>
        <Metricas desde={desde} hasta={hasta} localId={l.id} base="/vistapueblo/local" csv={`/api/vp/local/csv?desde=${desde}&hasta=${hasta}`} detalle />
      </section>
    </div>
  );
}
