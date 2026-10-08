import { salirAdmin } from '@/acciones/sesion';
import { salirContador } from '@/acciones/contabilidad';
import { Nav } from '@/components/Nav';
import { db } from '@/lib/db';
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
          <img src="/gm-crema.png" alt="" />
          <span>
            <b>GM-CONTROL</b>
            <small>{contador ? `Contador · ${contador}` : 'Grupo Modesto'}</small>
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
      <main className="contenido">{children}</main>
    </div>
  );
}
