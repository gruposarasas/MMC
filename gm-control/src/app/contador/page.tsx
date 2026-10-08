import { redirect } from 'next/navigation';
import { quienContabilidad } from '@/lib/contabilidad';
import { IngresoContador } from './IngresoContador';

export const metadata = { title: 'Contador · GM-CONTROL' };
export const dynamic = 'force-dynamic';

export default async function Contador() {
  if (await quienContabilidad()) redirect('/contabilidad');
  return (
    <div className="ingreso">
      <img className="deco" src="/img/curvas.png" alt="" style={{ width: 170, right: -30, top: 30 }} />
      <div className="ingreso-c">
        <img src="/gm-crema.png" alt="Grupo Modesto" />
        <h1>GM-CONTROL</h1>
        <p>Contabilidad de Grupo Modesto. Entrá con el mail y la clave que te pasaron.</p>
        <IngresoContador />
        <p style={{ marginTop: 22, fontSize: 14 }}>
          ¿Sos de Grupo Modesto? <a href="/ingresar">Administración</a> · <a href="/mi">Equipo</a>
        </p>
      </div>
    </div>
  );
}
