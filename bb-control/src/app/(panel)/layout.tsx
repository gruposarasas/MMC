import { salirAdmin } from '@/acciones/sesion';
import { Nav } from '@/components/Nav';
import { db } from '@/lib/db';
import { GUARDA } from '@/lib/marca';
import { exigirAdmin } from '@/lib/sesion';

export const dynamic = 'force-dynamic';

export default async function Panel({ children }: { children: React.ReactNode }) {
  await exigirAdmin();
  const [p] = await db()`
    select (select count(*) from vacaciones where estado = 'pendiente')
         + (select count(*) from adelantos where estado = 'pendiente')
         + (select count(*) from uniformes where estado = 'pedido')
         + (select count(*) from certificados where not visto) as n`;
  return (
    <div className="panel">
      <aside className="lateral">
        <a className="marca-bb" href="/kpi">
          <img src="/b-crema.png" alt="" />
          <span>
            <b>BB-CONTROL</b>
            <small>Bruno Brown</small>
          </span>
        </a>
        <Nav pendientes={Number(p.n)} />
        <div className="pie">
          <form action={salirAdmin}>
            <button>Cerrar sesión</button>
          </form>
        </div>
        <img className="guarda-lat" src={GUARDA} alt="" />
      </aside>
      <main className="contenido">{children}</main>
    </div>
  );
}
