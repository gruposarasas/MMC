import { fijarCobertura } from '@/acciones/contabilidad';
import { BotonAccion } from '@/components/FormAccion';
import { SelectorPeriodo } from '@/components/Periodo';
import { TabsContabilidad } from '@/components/TabsContabilidad';
import { Tile } from '@/components/Tile';
import { Titulo } from '@/components/Titulo';
import { exigirContabilidad, mesALiquidar, ultimoDia } from '@/lib/contabilidad';
import { db } from '@/lib/db';
import { fecha, nombreMes, numero, periodo, pesos } from '@/lib/formato';
import { type Params, param } from '@/lib/url';

export const metadata = { title: 'Equipo · Contabilidad · GM-CONTROL' };

type Persona = { id: number; nombre: string; apellido: string; cuil: string; puesto: string; ingreso: string | null; cobertura: 'art' | 'seguro' | null };
type Novedad = { persona: string; desde: string; hasta: string | null; dias: number | null; monto: number | null };

// Lo que el contador necesita del equipo: ART o seguro de cada uno y las novedades del mes para liquidar sueldos.
export default async function EquipoContable({ searchParams }: { searchParams: Promise<Params> }) {
  const q = await exigirContabilidad();
  const admin = q.rol === 'admin';
  const sp = await searchParams;
  const inicio = mesALiquidar();
  const mes = /^\d{4}-(0[1-9]|1[0-2])$/.test(param(sp, 'p')) ? param(sp, 'p') : inicio;
  const desde = `${mes}-01`;
  const hasta = ultimoDia(mes);
  const sql = db();
  const nombre = sql`trim(e.nombre || ' ' || e.apellido)`;
  const [equipo, altas, bajas, vacaciones, licencias, adelantos] = await Promise.all([
    sql<Persona[]>`select id, nombre, apellido, cuil, puesto, ingreso, cobertura from empleados where activo order by apellido, nombre`,
    sql<Novedad[]>`select ${nombre} persona, e.ingreso desde, null hasta, null dias, null monto from empleados e where e.ingreso between ${desde} and ${hasta} order by e.ingreso`,
    sql<Novedad[]>`select ${nombre} persona, e.egreso desde, null hasta, null dias, null monto from empleados e where e.egreso between ${desde} and ${hasta} order by e.egreso`,
    // Días de vacaciones aprobadas que caen en el mes.
    sql<Novedad[]>`select ${nombre} persona, v.desde, v.hasta, (least(v.hasta, ${hasta}::date) - greatest(v.desde, ${desde}::date) + 1) dias, null monto
                   from vacaciones v join empleados e on e.id = v.empleado_id
                   where v.estado = 'aprobada' and v.desde <= ${hasta} and v.hasta >= ${desde} order by v.desde`,
    sql<Novedad[]>`select ${nombre} persona, c.desde, c.hasta, (least(c.hasta, ${hasta}::date) - greatest(c.desde, ${desde}::date) + 1) dias, null monto
                   from certificados c join empleados e on e.id = c.empleado_id
                   where c.desde <= ${hasta} and c.hasta >= ${desde} order by c.desde`,
    sql<Novedad[]>`select ${nombre} persona, a.fecha_pago desde, null hasta, null dias, a.monto
                   from adelantos a join empleados e on e.id = a.empleado_id
                   where a.estado = 'aprobado' and a.descontar_en = ${desde} order by e.apellido`,
  ]);
  const cuenta = (c: Persona['cobertura']) => equipo.filter((e) => e.cobertura === c).length;
  const hayNovedades = altas.length + bajas.length + vacaciones.length + licencias.length + adelantos.length > 0;

  const Lista = ({ titulo, filas, texto }: { titulo: string; filas: Novedad[]; texto: (n: Novedad) => string }) =>
    filas.length ? (
      <div style={{ marginBottom: 12 }}>
        <b style={{ fontSize: 14 }}>{titulo}</b>
        <div className="lista-mi">
          {filas.map((n, i) => (
            <div key={i}><span>{n.persona}</span><span style={{ fontSize: 13 }}>{texto(n)}</span></div>
          ))}
        </div>
      </div>
    ) : null;

  return (
    <>
      <div className="cabeza">
        <Titulo modulo="contabilidad" titulo="Equipo">
          ART o seguro de cada persona y las novedades del mes para liquidar los sueldos.
        </Titulo>
        <div className="acciones">
          <SelectorPeriodo base="/contabilidad/equipo" params={sp} p={periodo(mes)} soloMes inicio={{ valor: inicio, texto: 'Mes a liquidar' }} />
        </div>
      </div>
      <TabsContabilidad actual="/contabilidad/equipo" admin={admin} mes={mes === inicio ? undefined : mes} />

      <div className="grilla2">
        <div className="caja">
          <h2>Novedades de {nombreMes(mes)}</h2>
          <p className="sub">Altas, bajas, vacaciones, licencias médicas y adelantos a descontar.</p>
          <Lista titulo="Altas" filas={altas} texto={(n) => `Ingresó el ${fecha(n.desde)}`} />
          <Lista titulo="Bajas" filas={bajas} texto={(n) => `Egresó el ${fecha(n.desde)}`} />
          <Lista titulo="Vacaciones" filas={vacaciones} texto={(n) => `${fecha(n.desde).slice(0, 5)} al ${fecha(n.hasta).slice(0, 5)} · ${n.dias} días en el mes`} />
          <Lista titulo="Licencias médicas" filas={licencias} texto={(n) => `${fecha(n.desde).slice(0, 5)} al ${fecha(n.hasta).slice(0, 5)} · ${n.dias} días en el mes`} />
          <Lista titulo="Adelantos a descontar" filas={adelantos} texto={(n) => pesos(n.monto)} />
          {!hayNovedades && <p className="vacio">Sin novedades este mes.</p>}
        </div>
        <div>
          <div className="tiles" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <Tile titulo="Con ART" valor={numero(cuenta('art'))} />
            <Tile titulo="Con seguro" valor={numero(cuenta('seguro'))} />
            <Tile titulo="Sin definir" valor={numero(cuenta(null))} />
          </div>
        </div>
      </div>

      <div className="caja">
        <h2>ART o seguro</h2>
        <p className="sub">{admin ? 'Elegí para cada persona si va con ART o con seguro.' : 'Lo elige Grupo Modesto.'} Equipo activo: {equipo.length} personas.</p>
        <div className="tabla-env">
          <table className="t">
            <thead><tr><th>Persona</th><th>CUIL</th><th>Ingreso</th><th>Cobertura</th></tr></thead>
            <tbody>
              {equipo.map((e) => (
                <tr key={e.id} data-persona={`${e.nombre} ${e.apellido}`}>
                  <td><span className="principal">{e.nombre} {e.apellido}</span>{e.puesto && <div className="chico">{e.puesto}</div>}</td>
                  <td className="num">{e.cuil || '—'}</td>
                  <td className="num">{e.ingreso ? fecha(e.ingreso) : '—'}</td>
                  <td>
                    {admin ? (
                      <div className="pildoras" role="group" aria-label={`Cobertura de ${e.nombre}`}>
                        {(['art', 'seguro'] as const).map((c) => (
                          <BotonAccion key={c} accion={fijarCobertura} campos={{ id: e.id, valor: e.cobertura === c ? '' : c }} className={`chip-btn${e.cobertura === c ? ' on' : ''}`} titulo={e.cobertura === c ? `Quitar ${c === 'art' ? 'ART' : 'seguro'}` : `Poner ${c === 'art' ? 'ART' : 'seguro'}`}>
                            {c === 'art' ? 'ART' : 'Seguro'}
                          </BotonAccion>
                        ))}
                      </div>
                    ) : e.cobertura ? (
                      <span className={`chip ${e.cobertura === 'art' ? 'bien' : 'alerta'}`}>{e.cobertura === 'art' ? 'ART' : 'Seguro'}</span>
                    ) : (
                      <span className="chico">Sin definir</span>
                    )}
                  </td>
                </tr>
              ))}
              {!equipo.length && <tr><td colSpan={4} className="vacio">No hay personas cargadas en Equipo.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
