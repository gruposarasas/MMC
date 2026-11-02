import Link from 'next/link';
import { ResolverSalida } from '@/components/ResolverSalida';
import { TabsEquipo } from '@/components/TabsEquipo';
import { Tile } from '@/components/Tile';
import { Titulo } from '@/components/Titulo';
import { db } from '@/lib/db';
import { horasDelEquipo, salidasPendientes } from '@/lib/fichaje';
import { fecha, mesActual, nombreCompleto, nombreMes, numero, sumarMeses } from '@/lib/formato';
import { DIAS_SEMANA, diaSemana, formatoHoras, horaDe } from '@/lib/horas';
import { type Params, param } from '@/lib/url';

export const metadata = { title: 'Horas · BB-CONTROL' };

export default async function Horas({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const mes = /^\d{4}-\d{2}$/.test(param(sp, 'p')) ? param(sp, 'p') : mesActual();
  const sql = db();
  const [{ filas, feriados, reglas }, pendientes, rechazados, [{ lugares }]] = await Promise.all([
    horasDelEquipo(mes),
    salidasPendientes(),
    sql<{ nombre: string; apellido: string; motivo: string; creado: Date }[]>`
      select e.nombre, e.apellido, r.motivo, r.creado from fichajes_rechazados r join empleados e on e.id = r.empleado_id
      where r.creado > now() - interval '7 days' order by r.creado desc limit 30`,
    sql<{ lugares: number }[]>`select count(*)::int lugares from lugares where activo and lat is not null`,
  ]);
  const suma = (k: 'trabajadas' | 'extra' | 'tardes' | 'sinResolver' | 'feriado') => filas.reduce((a, f) => a + f.r[k], 0);
  const ausencias = filas.reduce((a, f) => a + f.r.ausencias.length, 0);
  const sinHorario = filas.filter((f) => f.e.activo && !f.horario).length;
  const cuando = (d: Date) => new Date(d).toLocaleString('es-AR', { timeZone: 'America/Argentina/Mendoza', dateStyle: 'short', timeStyle: 'short' });

  return (
    <>
      <div className="cabeza">
        <Titulo modulo="equipo" titulo="Horas del equipo">
          Lo que fichó cada persona en el mes, contra su horario: horas, extras, llegadas tarde, ausencias y salidas sin marcar.
        </Titulo>
        <div className="acciones">
          <nav className="periodo" aria-label="Mes">
            <Link href={`/equipo/horas?p=${sumarMeses(mes, -1)}`} aria-label="Mes anterior">‹</Link>
            <span className="act">{nombreMes(mes)}</span>
            <Link href={`/equipo/horas?p=${sumarMeses(mes, 1)}`} aria-label="Mes siguiente">›</Link>
          </nav>
        </div>
      </div>
      <TabsEquipo actual="/equipo/horas" />

      {!lugares && (
        <div className="aviso">
          Para fichar falta cargar al menos un lugar con su ubicación y activar la pantalla del QR. <Link href="/equipo/fichaje">Configuralo en Fichaje</Link>.
        </div>
      )}
      {sinHorario > 0 && (
        <div className="aviso">
          {sinHorario === 1 ? 'Una persona no tiene' : `${sinHorario} personas no tienen`} horario cargado: sin horario no se calculan llegadas tarde, ausencias ni extras
          (se carga en su ficha, pestaña Horario).
        </div>
      )}

      <div className="tiles">
        <Tile titulo="Horas trabajadas" valor={formatoHoras(suma('trabajadas'))} oscuro sub={suma('feriado') ? `${formatoHoras(suma('feriado'))} en feriados (se pagan doble)` : `${filas.filter((f) => f.r.dias).length} ${filas.filter((f) => f.r.dias).length === 1 ? 'persona fichó' : 'personas ficharon'}`} />
        <Tile titulo="Horas extra" valor={formatoHoras(suma('extra'))} sub="Por encima de su horario" />
        <Tile titulo="Llegadas tarde" valor={numero(suma('tardes'))} sub={`Más de ${reglas.toleranciaMin} min · ${ausencias} ausencias`} />
        <Tile titulo="Salidas sin marcar" valor={numero(pendientes.length)} sub={pendientes.length ? 'Para resolver (abajo)' : 'Nada pendiente'} />
      </div>

      {pendientes.length > 0 && (
        <div className="caja">
          <h2>Salidas sin marcar</h2>
          <p className="sub">Hasta que las resuelvas, esos días suman 0 horas. Si la persona avisó a qué hora salió, se ve acá.</p>
          <div className="lista-mi">
            {pendientes.map((p) => (
              <div key={p.id} style={{ flexWrap: 'wrap' }}>
                <span>
                  <Link className="link" href={`/equipo/horas/${p.empleado_id}?p=${p.fecha.slice(0, 7)}`}>{nombreCompleto(p)}</Link>
                  <small>
                    {DIAS_SEMANA[diaSemana(p.fecha)]} {fecha(p.fecha)} · entró a las {horaDe(p.j.entradaMs)}
                    {p.j.pedidoMs ? ` · dice que salió a las ${horaDe(p.j.pedidoMs)}${p.pedido_nota ? ` ("${p.pedido_nota}")` : ''}` : ' · no avisó a qué hora salió'}
                  </small>
                </span>
                <ResolverSalida id={p.id} pedida={p.j.pedidoMs ? horaDe(p.j.pedidoMs) : null} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="tabla-env">
        <table className="t">
          <thead>
            <tr>
              <th>Persona</th>
              <th className="der">Días</th>
              <th className="der">Horas</th>
              <th className="der">Del horario</th>
              <th className="der">Extra</th>
              <th className="der">Feriado</th>
              <th className="der">Tarde</th>
              <th className="der">Ausencias</th>
              <th>Presentismo</th>
              <th><span className="sr">Ver</span></th>
            </tr>
          </thead>
          <tbody>
            {filas.map(({ e, horario, r }) => (
              <tr key={e.id}>
                <td>
                  <Link className="principal" href={`/equipo/horas/${e.id}?p=${mes}`} style={{ textDecoration: 'none' }}>{nombreCompleto(e)}</Link>
                  <div className="chico">{e.puesto || '—'}{!horario ? ' · sin horario' : ''}{!e.tiene_telefono ? ' · todavía no fichó' : ''}{r.enCurso ? ' · trabajando ahora' : ''}</div>
                </td>
                <td className="der num">{r.dias || '—'}</td>
                <td className="der num principal">{r.trabajadas ? formatoHoras(r.trabajadas) : '—'}{r.sinResolver ? <div className="chico" style={{ color: 'var(--mal)' }}>{r.sinResolver} sin salida</div> : null}</td>
                <td className="der num chico">{horario ? formatoHoras(r.esperadas) : '—'}</td>
                <td className="der num">{r.extra ? formatoHoras(r.extra) : '—'}</td>
                <td className="der num">{r.feriado ? formatoHoras(r.feriado) : '—'}</td>
                <td className="der num">{r.tardes || '—'}</td>
                <td className="der num">{r.ausencias.length || '—'}</td>
                <td>{!horario ? <span className="chico">—</span> : r.presentismo ? <span className="chip bien">Sí</span> : <span className="chip mal">No</span>}</td>
                <td><Link className="ico" href={`/equipo/horas/${e.id}?p=${mes}`}>Días</Link></td>
              </tr>
            ))}
            {!filas.length && <tr><td colSpan={10} className="vacio">No hay personas activas.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="mas">
        Cada jornada se redondea a {reglas.redondeoMin} minutos. Tarde: más de {reglas.toleranciaMin} minutos después del horario. Presentismo: sin llegadas tarde ni ausencias.
        {feriados.size ? ` Feriados del mes: ${[...feriados].map(([f, n]) => `${fecha(f).slice(0, 5)}${n ? ` (${n})` : ''}`).join(', ')}.` : ''}
      </p>

      {rechazados.length > 0 && (
        <details className="caja" style={{ marginTop: 18 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Intentos de fichar que no se aceptaron (últimos 7 días): {rechazados.length}</summary>
          <div className="lista-mi" style={{ marginTop: 10 }}>
            {rechazados.map((x, i) => (
              <div key={i}><span>{nombreCompleto(x)}<small>{x.motivo}</small></span><span className="chico">{cuando(x.creado)}</span></div>
            ))}
          </div>
        </details>
      )}
    </>
  );
}
