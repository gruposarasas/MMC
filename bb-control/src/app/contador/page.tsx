import { redirect } from 'next/navigation';
import { quienContabilidad } from '@/lib/contabilidad';
import { IngresoContador } from './IngresoContador';

export const metadata = { title: 'Contador · BB-CONTROL' };
export const dynamic = 'force-dynamic';

export default async function Contador() {
  if (await quienContabilidad()) redirect('/contabilidad');
  return (
    <div className="ingreso">
      <img className="deco" src="/img/ic_copa.png" alt="" style={{ width: 170, right: -30, top: 30 }} />
      <div className="ingreso-c">
        <img src="/b-crema.png" alt="Bruno Brown" />
        <h1>BB-CONTROL</h1>
        <p>Contabilidad de Bruno Brown. Entrá con el mail y la clave que te pasaron.</p>
        <IngresoContador />
        <p style={{ marginTop: 22, fontSize: 14 }}>
          ¿Sos de Bruno Brown? <a href="/ingresar">Administración</a> · <a href="/mi">Equipo</a>
        </p>
      </div>
    </div>
  );
}
