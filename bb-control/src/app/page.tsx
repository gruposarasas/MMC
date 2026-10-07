import { redirect } from 'next/navigation';
import { empleadoSesion, esAdmin } from '@/lib/sesion';

export default async function Inicio() {
  if (await esAdmin()) redirect('/kpi');
  if (await empleadoSesion()) redirect('/mi');
  return (
    <div className="ingreso">
      <img className="deco" src="/img/ic_planta.png" alt="" style={{ width: 190, right: -40, top: 30 }} />
      <div className="ingreso-c">
        <img src="/b-crema.png" alt="Bruno Brown" />
        <h1>BB-CONTROL</h1>
        <p>La app de Bruno Brown.</p>
        <div className="opciones">
          <a href="/mi">
            <b>Soy del equipo</b>
            <small>Vacaciones, adelantos, certificados y uniforme.</small>
          </a>
          <a href="/ingresar">
            <b>Administración</b>
            <small>Ventas, compras, gastos, sueldos y KPI.</small>
          </a>
        </div>
      </div>
    </div>
  );
}
