import { redirect } from 'next/navigation';
import { contadorSesion } from '@/lib/contabilidad';
import { empleadoSesion, esAdmin } from '@/lib/sesion';

export default async function Inicio() {
  if (await esAdmin()) redirect('/kpi');
  if (await empleadoSesion()) redirect('/mi');
  if (await contadorSesion()) redirect('/contabilidad');
  return (
    <div className="ingreso">
      <img className="deco" src="/img/curvas.png" alt="" style={{ width: 190, right: -40, top: 30 }} />
      <div className="ingreso-c">
        <img className="logo" src="/img/grupo-modesto-crema.png" alt="Grupo Modesto · Donde nacen tres historias" />
        <h1>GM-CONTROL</h1>
        <p>La app de Grupo Modesto.</p>
        <div className="opciones">
          <a href="/mi">
            <b>Soy del equipo</b>
            <small>Vacaciones, adelantos, certificados y uniforme.</small>
          </a>
          <a href="/ingresar">
            <b>Administración</b>
            <small>Ventas, compras, gastos, sueldos y KPI.</small>
          </a>
          <a href="/contador">
            <b>Soy el contador</b>
            <small>F.931, IVA, Ingresos Brutos y novedades del mes.</small>
          </a>
        </div>
      </div>
    </div>
  );
}
