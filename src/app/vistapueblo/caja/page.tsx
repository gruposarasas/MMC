import { redirect } from 'next/navigation';
import { cajaActual, localesPublicos, consumosDeHoy, tarjetaPorCodigo, claveImpresa, claveQr, numeroVivoValido } from '@/lib/vistapueblo-servidor';
import { permitir } from '@/lib/limite';
import { pesos, diaHora } from '@/lib/vistapueblo';
import { ConfigurarCaja, CodigoManual } from '@/components/vistapueblo/Caja';
import { Salir, AutoRecarga } from '@/components/vistapueblo/Comun';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Caja · Gift cards Vistapueblo', manifest: '/vistapueblo/app.webmanifest' };

export default async function Caja({ searchParams }: { searchParams: Promise<{ volver?: string; codigo?: string; n?: string }> }) {
  const sp = await searchParams;
  const caja = await cajaActual();
  const volver = sp.volver && /^\/vistapueblo\/[gc]\/[A-Za-z0-9_.-]+$/.test(sp.volver) ? sp.volver : undefined;
  if (!caja)
    return (
      <main className="vp-caja">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="vp-caja-logo" src="/vistapueblo/logo-beige.png" alt="Vistapueblo" />
        <ConfigurarCaja locales={await localesPublicos()} volver={volver} />
      </main>
    );

  // Código escrito a mano: el voucher impreso alcanza con el código; la digital pide además el número de 6 cifras que ve el cliente.
  let error = '';
  if (sp.codigo) {
    if (!permitir(`vp-codigo:${caja.id}`, 30, 600)) error = 'Demasiados intentos. Esperá unos minutos.';
    else {
      const t = await tarjetaPorCodigo(sp.codigo);
      const n = (sp.n || '').replace(/\D/g, '');
      if (!t) error = 'No encontramos una gift card con ese código. Revisalo.';
      else if (t.impresa) redirect(`/vistapueblo/c/${claveImpresa(t)}`);
      else if (!n) error = 'Es una gift card digital: escribí también el número de 6 cifras que el cliente ve debajo del QR.';
      else if (numeroVivoValido(t.id, n)) redirect(`/vistapueblo/c/${claveQr(t)}`);
      else error = 'El número no coincide o ya cambió. Pedile al cliente el número que ve ahora.';
    }
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
          <li>Escanealo con la cámara de este celular (el QR cambia cada 30 segundos: escanealo en el momento).</li>
          <li>Cargá el total del ticket y las personas de la mesa, y confirmá.</li>
        </ol>
        <CodigoManual inicial={sp.codigo} />
        {error && <p className="vp-error">{error}</p>}
      </div>
      <div className="vp-panel">
        <div className="vp-titulo"><h2>Hoy en {caja.nombre}</h2><b>{pesos(hoy.reduce((s, c) => s + c.monto, 0))}</b></div>
        {hoy.length > 0 && <p className="vp-ayuda">{hoy.length} {hoy.length === 1 ? 'mesa' : 'mesas'} · {hoy.reduce((s, c) => s + (c.personas || 0), 0)} personas · tickets por {pesos(hoy.reduce((s, c) => s + c.ticket, 0))}</p>}
        {hoy.length ? (
          <ul className="vp-lista simple">
            {hoy.map((c) => <li key={c.id}><span>{diaHora(c.created_at).slice(6)} · N° {c.numero} · {c.tarjeta?.nombre}{c.personas ? ` · ${c.personas} pers.` : ''}{c.cajero ? ` · ${c.cajero}` : ''}</span><b>{pesos(c.monto)}</b></li>)}
          </ul>
        ) : <p className="vp-vacio">Todavía no hay consumos hoy.</p>}
      </div>
    </main>
  );
}
