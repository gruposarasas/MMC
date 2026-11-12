import { vacantesAbiertas } from '@/lib/trabajo-servidor';
import { DEPARTAMENTOS, PUESTOS } from '@/lib/trabajo';
import { TarjetaVacante } from '@/components/trabajo/Tarjetas';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Vacantes · Banco de Trabajo AEHGA' };

export default async function Vacantes({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const puesto = PUESTOS.some(([k]) => k === sp.puesto) ? sp.puesto! : '';
  const dep = (DEPARTAMENTOS as readonly string[]).includes(sp.dep || '') ? sp.dep! : '';
  const vs = await vacantesAbiertas({ puesto, dep });
  return (
    <section>
      <h1 className="bt-h1">Vacantes</h1>
      <form className="bt-filtros" method="get">
        <select name="puesto" defaultValue={puesto} aria-label="Puesto">
          <option value="">Todos los puestos</option>
          {PUESTOS.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
        </select>
        <select name="dep" defaultValue={dep} aria-label="Departamento">
          <option value="">Toda Mendoza</option>
          {DEPARTAMENTOS.map((d) => <option key={d}>{d}</option>)}
        </select>
        <button className="bt-btn chico" type="submit">Filtrar</button>
      </form>
      <p className="bt-meta">{vs.length === 1 ? '1 vacante abierta' : `${vs.length} vacantes abiertas`}</p>
      {vs.length ? <div className="bt-grilla">{vs.map((v) => <TarjetaVacante key={v.id} v={v} />)}</div>
        : <p className="bt-vacio">No hay vacantes con esos filtros. Cargá tu CV igual: las empresas también buscan en la base.</p>}
    </section>
  );
}
