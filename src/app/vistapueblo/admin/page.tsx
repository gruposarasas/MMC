import Link from 'next/link';
import { esAdminVP, locales as todosLosLocales, todasLasTarjetas, cuentaCorriente, mesesConConsumos, linkTarjeta } from '@/lib/vistapueblo-servidor';
import { pesos, diaHora, dondeVale, estadoTarjeta, mesActual, nombreMes, hoyMendoza, nombreDe } from '@/lib/vistapueblo';
import { URL_PUBLICA } from '@/lib/config';
import { EntrarAdmin, Salir, AutoRecarga } from '@/components/vistapueblo/Comun';
import { NuevaTarjeta, ImportarExcel, ImprimirVouchers } from '@/components/vistapueblo/Emitir';
import { ListaTarjetas, EditorLocales, AnularConsumo } from '@/components/vistapueblo/Admin';
import { Metricas, leerRango } from '@/components/vistapueblo/Metricas';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Backoffice · Gift cards Vistapueblo', manifest: '/vistapueblo/app.webmanifest' };

const TABS = [['resumen', 'Resumen'], ['metricas', 'Métricas'], ['nueva', 'Nueva'], ['importar', 'Importar Excel'], ['imprimir', 'Imprimir'], ['tarjetas', 'Gift cards'], ['cuenta', 'Cuenta corriente'], ['locales', 'Locales']] as const;
type Tab = (typeof TABS)[number][0];

export default async function Backoffice({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (!(await esAdminVP())) return <EntrarAdmin />;
  const sp = await searchParams;
  const tab: Tab = (TABS.map((t) => t[0]) as string[]).includes(sp.tab || '') ? (sp.tab as Tab) : 'resumen';
  return (
    <div className="vp-bo">
      <header className="vp-bo-cab">
        <Link href="/vistapueblo/admin" className="vp-bo-marca">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/vistapueblo/logo-beige.png" alt="Vistapueblo" />
          <span>Gift cards</span>
        </Link>
        <nav aria-label="Secciones">
          {TABS.map(([k, n]) => <Link key={k} href={`/vistapueblo/admin?tab=${k}`} className={tab === k ? 'on' : ''} aria-current={tab === k ? 'page' : undefined}>{n}</Link>)}
        </nav>
        <Salir url="/api/vp/admin/salir" />
      </header>
      <section className="vp-bo-cuerpo">{await Seccion({ tab, sp })}</section>
    </div>
  );
}

async function Seccion({ tab, sp }: { tab: Tab; sp: Record<string, string | undefined> }) {
  const ls = await todosLosLocales();
  const activos = ls.filter((l) => l.activo).map(({ id, nombre }) => ({ id, nombre }));

  if (tab === 'nueva') return <NuevaTarjeta locales={activos} />;
  if (tab === 'importar') return <ImportarExcel locales={activos} />;
  if (tab === 'imprimir') return <ImprimirVouchers locales={activos} />;

  if (tab === 'metricas') {
    const { desde, hasta } = leerRango(sp);
    const local = sp.local && ls.some((l) => l.id === sp.local) ? sp.local : undefined;
    return (
      <>
        <AutoRecarga />
        <h1 className="vp-h1">Métricas</h1>
        <Metricas desde={desde} hasta={hasta} localId={local} base="/vistapueblo/admin?tab=metricas" locales={ls.map(({ id, nombre }) => ({ id, nombre }))}
          csv={`/api/vp/admin/csv?tipo=metricas&desde=${desde}&hasta=${hasta}${local ? `&local=${local}` : ''}`} detalle={!!local} />
      </>
    );
  }

  if (tab === 'locales')
    return (
      <>
        <h1 className="vp-h1">Locales</h1>
        <p className="vp-sub">El <b>%</b> es la parte de cada consumo que absorbe el local; el resto lo cubre Vistapueblo y se descuenta del alquiler. Si lo cambiás, vale para los consumos de ahí en adelante. El <b>PIN</b> es para configurar la caja de cada local (en <Link className="vp-link" href="/vistapueblo/caja">/vistapueblo/caja</Link>). La <b>clave del panel</b> es para que el encargado de cada local vea sus consumos, métricas y cuenta corriente en <Link className="vp-link" href="/vistapueblo/local">/vistapueblo/local</Link>.</p>
        <EditorLocales locales={ls} url={URL_PUBLICA} />
      </>
    );

  if (tab === 'tarjetas') {
    const ts = await todasLasTarjetas();
    return (
      <>
        <h1 className="vp-h1">Gift cards</h1>
        <ListaTarjetas filas={ts.map((t) => ({
          id: t.id, numero: t.numero, nombre: nombreDe(t.nombre), mail: t.mail, impresa: t.impresa, modo: t.modo, whatsapp: t.whatsapp, monto: t.monto, saldo: t.saldo, vence: t.vence,
          estado: estadoTarjeta(t), donde: dondeVale(t.todos_los_locales, t.locales, ls), link: linkTarjeta(t.token), lote: t.lote,
          enviada: !!(t.enviada_wa_at || t.enviada_mail_at), vista: !!t.vista_at, creada: t.created_at,
        }))} />
      </>
    );
  }

  if (tab === 'cuenta') {
    const actual = mesActual();
    const mes = /^\d{4}-\d{2}$/.test(sp.mes || '') ? sp.mes! : actual;
    const [cc, meses] = await Promise.all([cuentaCorriente(mes), mesesConConsumos(actual)]);
    const local = sp.local && cc.filas.some((f) => f.id === sp.local) ? sp.local : '';
    const detalle = cc.consumos.filter((c) => !local || c.local_id === local);
    return (
      <>
        <AutoRecarga />
        <div className="vp-titulo">
          <h1 className="vp-h1">Cuenta corriente · {nombreMes(mes)}</h1>
          <form method="get" className="vp-inline vp-mes">
            <input type="hidden" name="tab" value="cuenta" />
            <select name="mes" defaultValue={mes} aria-label="Mes">{meses.map((m) => <option key={m} value={m}>{nombreMes(m)}</option>)}</select>
            <button className="vp-btn chico" type="submit">Ver</button>
          </form>
        </div>
        <p className="vp-sub">Lo que Vistapueblo cubre de cada consumo se descuenta del alquiler de ese local a fin de mes. Los consumos anulados no cuentan.</p>
        <div className="vp-tabla">
          <table>
            <thead><tr><th>Local</th><th className="n">%</th><th className="n">Consumos</th><th className="n">Consumido</th><th className="n">Absorbe el local</th><th className="n">A cargo de Vistapueblo<br /><small>se descuenta del alquiler</small></th><th className="n">Venta total<br /><small>tickets</small></th><th /></tr></thead>
            <tbody>
              {cc.filas.map((f) => (
                <tr key={f.id} className={local === f.id ? 'sel' : ''}>
                  <td><Link className="vp-link" href={`/vistapueblo/admin?tab=cuenta&mes=${mes}&local=${f.id}`}>{f.nombre}</Link></td>
                  <td className="n">{f.porcentaje}%</td><td className="n">{f.cantidad}</td><td className="n">{pesos(f.consumido)}</td>
                  <td className="n">{pesos(f.local)}</td><td className="n"><b>{pesos(f.vp)}</b></td><td className="n">{pesos(f.ventas)}</td>
                  <td><a className="vp-link" href={`/api/vp/admin/csv?mes=${mes}&local=${f.id}`}>Excel</a></td>
                </tr>
              ))}
              <tr className="tot"><td>Total</td><td /><td className="n">{cc.total.cantidad}</td><td className="n">{pesos(cc.total.consumido)}</td><td className="n">{pesos(cc.total.local)}</td><td className="n"><b>{pesos(cc.total.vp)}</b></td><td className="n">{pesos(cc.total.ventas)}</td>
                <td><a className="vp-link" href={`/api/vp/admin/csv?mes=${mes}`}>Excel</a></td></tr>
            </tbody>
          </table>
        </div>
        <div className="vp-titulo" style={{ marginTop: 24 }}>
          <h2>Detalle{local ? ` · ${cc.filas.find((f) => f.id === local)?.nombre}` : ''}</h2>
          {local && <Link className="vp-link" href={`/vistapueblo/admin?tab=cuenta&mes=${mes}`}>Ver todos los locales</Link>}
        </div>
        <TablaConsumos consumos={detalle} />
      </>
    );
  }

  // resumen
  const [ts, cc] = await Promise.all([todasLasTarjetas(), cuentaCorriente(mesActual())]);
  const hoy = hoyMendoza();
  const vivas = ts.filter((t) => !t.anulada);
  const emitido = vivas.reduce((s, t) => s + t.monto, 0);
  const consumido = vivas.reduce((s, t) => s + (t.monto - t.saldo), 0);
  const disponible = vivas.filter((t) => t.vence >= hoy).reduce((s, t) => s + t.saldo, 0);
  const vencido = vivas.filter((t) => t.vence < hoy).reduce((s, t) => s + t.saldo, 0);
  return (
    <>
      <AutoRecarga />
      <h1 className="vp-h1">Resumen</h1>
      <div className="vp-stats seis">
        <div><b>{vivas.length}</b><span>gift cards emitidas · {pesos(emitido)}</span></div>
        <div><b>{pesos(consumido)}</b><span>consumido en los restaurantes</span></div>
        <div><b>{pesos(disponible)}</b><span>saldo vigente sin usar</span></div>
        <div><b>{pesos(vencido)}</b><span>saldo vencido sin usar</span></div>
        <div><b>{cc.consumos.filter((c) => !c.anulado).reduce((s, c) => s + (c.personas || 0), 0)}</b><span>personas vinieron este mes</span></div>
        <div><b>{pesos(cc.total.ventas)}</b><span>venta total en los locales este mes</span></div>
      </div>
      <p className="vp-ayuda"><Link className="vp-link" href="/vistapueblo/admin?tab=metricas">Ver todas las métricas →</Link></p>
      <div className="vp-titulo" style={{ marginTop: 22 }}>
        <h2>{nombreMes(mesActual())[0].toUpperCase() + nombreMes(mesActual()).slice(1)} por local</h2>
        <Link className="vp-link" href="/vistapueblo/admin?tab=cuenta">Cuenta corriente →</Link>
      </div>
      <div className="vp-barras">
        {cc.filas.filter((f) => f.consumido).map((f) => (
          <div key={f.id} className="vp-barra-local">
            <span>{f.nombre}</span>
            <i style={{ width: `${Math.max(3, (f.consumido / Math.max(1, ...cc.filas.map((x) => x.consumido))) * 100)}%` }} />
            <em>{pesos(f.consumido)}</em>
          </div>
        ))}
        {!cc.total.consumido && <p className="vp-vacio">Todavía no hay consumos este mes.</p>}
      </div>
      <h2 style={{ marginTop: 22 }}>Últimos consumos <small className="vp-sub">(se actualiza solo)</small></h2>
      <TablaConsumos consumos={cc.consumos.slice(0, 15)} />
    </>
  );
}

function TablaConsumos({ consumos }: { consumos: Awaited<ReturnType<typeof cuentaCorriente>>['consumos'] }) {
  if (!consumos.length) return <p className="vp-vacio">No hay consumos.</p>;
  return (
    <div className="vp-tabla">
      <table>
        <thead><tr><th>N°</th><th>Día y hora</th><th>Local</th><th>Gift card</th><th className="n">Personas</th><th className="n">Ticket</th><th className="n">Gift card</th><th className="n">Local</th><th className="n">Vistapueblo</th><th /></tr></thead>
        <tbody>
          {consumos.map((c) => (
            <tr key={c.id} className={c.anulado ? 'anulado' : ''}>
              <td>{c.numero}</td><td>{diaHora(c.created_at)}</td><td>{c.local}{c.cajero ? <small>{c.cajero}</small> : null}</td>
              <td><Link className="vp-link" href={`/vistapueblo/admin/tarjeta/${c.tarjeta_id}`}>N° {c.tarjeta?.numero} · {c.tarjeta?.nombre}</Link></td>
              <td className="n">{c.personas ?? '—'}</td><td className="n">{pesos(c.ticket)}</td><td className="n">{pesos(c.monto)}</td><td className="n">{pesos(c.a_cargo_local)} <small>{c.porcentaje}%</small></td><td className="n">{pesos(c.a_cargo_vp)}</td>
              <td>{c.anulado ? <small title={c.anulado_motivo}>Anulado</small> : <AnularConsumo id={c.id} />}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
