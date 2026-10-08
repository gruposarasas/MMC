import { redirect } from 'next/navigation';
import { esAdmin } from '@/lib/sesion';
import { IngresoAdmin } from './IngresoAdmin';

export const metadata = { title: 'Ingresar · BB-CONTROL' };

export default async function Ingresar() {
  if (await esAdmin()) redirect('/kpi');
  return (
    <div className="ingreso">
      <img className="deco" src="/img/ic_planta.png" alt="" style={{ width: 190, right: -40, top: 30 }} />
      <div className="ingreso-c">
        <img src="/b-crema.png" alt="Bruno Brown" />
        <h1>BB-CONTROL</h1>
        <p>Administración de Bruno Brown.</p>
        <IngresoAdmin />
        <p style={{ marginTop: 22, fontSize: 14 }}>
          ¿Sos del equipo? <a href="/mi">Entrá a tu app</a> · ¿Sos el contador? <a href="/contador">Entrá acá</a>
        </p>
      </div>
    </div>
  );
}
