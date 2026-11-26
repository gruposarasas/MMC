import { redirect } from 'next/navigation';
import { cajaActual, localesPublicos, consumosDeHoy, tarjetaPorCodigo } from '@/lib/vistapueblo-servidor';
import { permitir, ip } from '@/lib/limite';
import { pesos, diaHora } from '@/lib/vistapueblo';
import { ConfigurarCaja, CodigoManual } from '@/components/vistapueblo/Caja';
import { Salir, AutoRecarga } from '@/components/vistapueblo/Comun';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Caja · Gift cards Vistapueblo' };

export default async function Caja({ searchParams }: { searchParams: Promise<{ volver?: string; codigo?: string }> }) {
  const sp = await searchParams;
  const caja = await cajaActual();
  const volver = sp.volver && /^\/vistapueblo\/g\/[A-Za-z0-9_-]+$/.test(sp.volver) ? sp.volver : undefined;
  if (!caja)
    return (
      <main className="vp-caja">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="vp-caja-logo" src="/vistapueblo/logo-beige.png" alt="Vistapueblo" />
        <ConfigurarCaja locales={await localesPublicos()} volver={volver} />
      </main>
    );

  let noEncontrada = false;
  if (sp.codigo) {
    if (permitir(`vp-codigo:${await ip()}`, 30, 600)) {
      const t = await tarjetaPorCodigo(sp.codigo);
      if (t) redirect(`/vistapueblo/g/${t.token}`);
    }
    noEncontrada = true;
  }
  const hoy = (await consumosDeHoy(caja.id)).filter((c) => !c.anulado);
  return (
    <main className="vp-caja">
      <AutoRecarga segundos={60} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="vp-caja-logo" src="/vistapueblo/logo-beige.png" alt="Vistapueblo" />
      <div className="vp-panel">
        <div className="vp-titulo"><h2>Caja de {caja.nombre}</h2><Salir url="/api/vp/caja/salir" texto="Cambiar de local" /></div>
        <ol className="vp-pasos">
          <li>El cliente te muestra el QR de su gift card.</li>
          <li>Escanealo con la cámara de este celular.</li>
          <li>Cargá el monto consumido y confirmá.</li>
        </ol>
        <CodigoManual />
        {noEncontrada && <p className="vp-error">No encontramos una gift card con ese código. Revisalo.</p>}
      </div>
      <div className="vp-panel">
        <div className="vp-titulo"><h2>Hoy en {caja.nombre}</h2><b>{pesos(hoy.reduce((s, c) => s + c.monto, 0))}</b></div>
        {hoy.length ? (
          <ul className="vp-lista simple">
            {hoy.map((c) => <li key={c.id}><span>{diaHora(c.created_at).slice(6)} · N° {c.numero} · {c.tarjeta?.nombre}{c.cajero ? ` · ${c.cajero}` : ''}</span><b>{pesos(c.monto)}</b></li>)}
          </ul>
        ) : <p className="vp-vacio">Todavía no hay consumos hoy.</p>}
      </div>
    </main>
  );
}
