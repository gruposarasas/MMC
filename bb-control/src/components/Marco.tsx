import { salirAdmin } from '@/acciones/sesion';
import { salirContador } from '@/acciones/contabilidad';
import Link from 'next/link';
import { Nav } from '@/components/Nav';
import { db } from '@/lib/db';
import { dolarDelDia } from '@/lib/dolar';
import { fecha, hoy, pesos, porcentaje } from '@/lib/formato';
import { GUARDA } from '@/lib/marca';

/** Barra lateral y contenido del panel. El contador la ve solo con Contabilidad. */
export async function Marco({ contador, children }: { contador?: string; children: React.ReactNode }) {
  const pendientes = contador
    ? 0
    : Number(
        (
          await db()`
            select (select count(*) from vacaciones where estado = 'pendiente')
                 + (select count(*) from adelantos where estado = 'pendiente')
                 + (select count(*) from uniformes where estado = 'pedido')
                 + (select count(*) from certificados where not visto) as n`
        )[0].n,
      );
  return (
    <div className="panel">
      <aside className="lateral">
        <a className="marca-bb" href={contador ? '/contabilidad' : '/kpi'}>
          <img src="/b-crema.png" alt="" />
          <span>
            <b>BB-CONTROL</b>
            <small>{contador ? `Contador · ${contador}` : 'Bruno Brown'}</small>
          </span>
        </a>
        <Nav pendientes={pendientes} contador={!!contador} />
        <div className="pie">
          <form action={contador ? salirContador : salirAdmin}>
            <button>Cerrar sesión</button>
          </form>
        </div>
        <img className="guarda-lat" src={GUARDA} alt="" />
      </aside>
      <main className="contenido">
        {!contador && <DolarDelDia />}
        {children}
      </main>
    </div>
  );
}

/** El dólar BNA del día, chiquito arriba a la derecha (lleva a donde se configura). */
async function DolarDelDia() {
  const d = await dolarDelDia().catch(() => null);
  if (!d) {
    return (
      <div className="barra-sup">
        <Link className="dolar-bna" href="/ajustes#dolar">Cargá el dólar</Link>
      </div>
    );
  }
  const v = d.variacion;
  const flecha = v == null || Math.abs(v) < 0.05 ? null : v > 0 ? 'sube' : 'baja';
  const hora = d.actualizado
    ? new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Mendoza', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(d.actualizado))
    : '';
  const titulo = [
    d.fuente === 'manual' ? 'Dólar fijo cargado a mano' : `Dólar BNA billete${d.compra ? ` · compra ${pesos(d.compra)}` : ''} · venta ${pesos(d.valor)}`,
    `del ${fecha(d.fecha)}${hora ? `, actualizado ${hora}` : ''}`,
    d.anterior ? `anterior (${fecha(d.fechaAnterior)}): ${pesos(d.anterior)}` : '',
  ].filter(Boolean).join(' · ');
  return (
    <div className="barra-sup">
      <Link className="dolar-bna" href="/ajustes#dolar" title={titulo} aria-label={titulo}>
        {d.fuente === 'manual' ? 'Dólar fijo' : 'Dólar BNA'} <b className="num">{pesos(d.valor, Number.isInteger(d.valor) ? 0 : 2)}</b>
        {flecha && <span className={flecha}>{flecha === 'sube' ? '▲' : '▼'} {porcentaje(Math.abs(v!), 1)}</span>}
        {d.fecha !== hoy() && <span className="viejo">{fecha(d.fecha).slice(0, 5)}</span>}
      </Link>
    </div>
  );
}
