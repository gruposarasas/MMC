import Link from 'next/link';
import { Titulo } from '@/components/Titulo';
import { FormEmpleado, type Empleado } from '@/components/FormEmpleado';
import { Pedidos } from '@/components/Pedidos';
import { Tile } from '@/components/Tile';
import { Ventana } from '@/components/Ventana';
import { db } from '@/lib/db';
import { cumpleanos, pedidosPendientes } from '@/lib/equipo';
import { diaSemana, fecha, hoy, linkWhatsapp, MESES, nombreCompleto } from '@/lib/formato';
import { type Params, param, url } from '@/lib/url';
import { antiguedad, proximoCumple } from '@/lib/vacaciones';

export const metadata = { title: 'Equipo · BB-CONTROL' };

const iniciales = (e: { nombre: string; apellido: string }) => `${e.nombre[0] ?? ''}${e.apellido[0] ?? ''}`.toUpperCase();

export default async function Equipo({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const bajas = param(sp, 'ver') === 'bajas';
  const h = hoy();
  const sql = db();
  const [gente, pedidos, cumples, vacaciones] = await Promise.all([
    sql<Empleado[]>`select * from empleados where activo = ${!bajas} order by nombre, apellido`,
    pedidosPendientes(),
    cumpleanos(60),
    sql`select v.*, e.nombre, e.apellido from vacaciones v join empleados e on e.id = v.empleado_id
        where v.estado = 'aprobada' and v.hasta >= ${h} order by v.desde limit 12`,
  ]);
  const deVacaciones = vacaciones.filter((v) => (v.desde as string) <= h);
  const cumplesMes = gente.filter((e) => e.nacimiento?.slice(5, 7) === h.slice(5, 7)).length;
  const cerrar = url('/equipo', sp, { nuevo: null });

  // Todos los cumpleaños, por mes.
  const porMes = MESES.map((m, i) => ({
    mes: m,
    gente: gente
      .filter((e) => e.nacimiento && Number(e.nacimiento.slice(5, 7)) === i + 1)
      .sort((a, b) => a.nacimiento!.slice(8).localeCompare(b.nacimiento!.slice(8))),
  }));

  return (
    <>
      <div className="cabeza">
        <Titulo modulo="equipo" titulo="Equipo">
          Datos de cada persona, cumpleaños, vacaciones, certificados, uniforme y adelantos. Cada uno pide desde su app en <b>/mi</b>.
        </Titulo>
        <div className="acciones">
          <Link className="btn vino" href={url('/equipo', sp, { nuevo: 1 })} scroll={false}>+ Nueva persona</Link>
        </div>
      </div>

      {!bajas && (
        <div className="tiles">
          <Tile titulo="Personas en el equipo" valor={gente.length} oscuro />
          <Tile titulo="Pedidos para responder" valor={pedidos.length} sub={pedidos.length ? 'Abajo los podés aprobar' : 'Nada pendiente'} />
          <Tile titulo="De vacaciones hoy" valor={deVacaciones.length} sub={deVacaciones.map((v) => v.nombre as string).join(', ') || ' '} />
          <Tile titulo={`Cumpleaños en ${MESES[Number(h.slice(5, 7)) - 1]}`} valor={cumplesMes} sub={cumples[0] ? `Próximo: ${cumples[0].nombre} (${cumples[0].faltan === 0 ? 'hoy' : fecha(cumples[0].fecha).slice(0, 5)})` : ' '} />
        </div>
      )}

      {!bajas && pedidos.length > 0 && (
        <div className="caja">
          <h2>Pedidos del equipo</h2>
          <p className="sub">Lo que pidieron desde su app.</p>
          <Pedidos pedidos={pedidos} />
        </div>
      )}

      {!bajas && (
        <div className="grilla2" style={{ marginBottom: 18 }}>
          <div className="caja">
            <h2>Próximos cumpleaños</h2>
            <p className="sub">Los próximos 60 días. ¡A festejar!</p>
            {cumples.length ? (
              cumples.map((c) => (
                <div key={c.id} className={`cumple${c.faltan === 0 ? ' hoy' : ''}`}>
                  <span>
                    <b>{nombreCompleto(c)}</b> cumple {c.cumple}
                  </span>
                  <span className="chico" style={{ color: 'var(--tinta2)', fontSize: 13 }}>
                    {c.faltan === 0 ? '🎂 ¡Hoy!' : c.faltan === 1 ? 'Mañana' : `${diaSemana(c.fecha)} ${fecha(c.fecha).slice(0, 5)} · en ${c.faltan} días`}
                  </span>
                </div>
              ))
            ) : (
              <p className="vacio">No hay cumpleaños en los próximos 60 días (o faltan fechas de nacimiento).</p>
            )}
            <details style={{ marginTop: 10 }}>
              <summary style={{ cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>Ver todos los cumpleaños del año</summary>
              <div className="grilla3" style={{ marginTop: 10 }}>
                {porMes.filter((m) => m.gente.length).map((m) => (
                  <div key={m.mes} style={{ fontSize: 14 }}>
                    <b style={{ textTransform: 'capitalize' }}>{m.mes}</b>
                    {m.gente.map((e) => (
                      <div key={e.id}>{e.nacimiento!.slice(8)} · {nombreCompleto(e)}</div>
                    ))}
                  </div>
                ))}
              </div>
            </details>
          </div>
          <div className="caja">
            <h2>Vacaciones</h2>
            <p className="sub">Aprobadas, de hoy en adelante.</p>
            {vacaciones.length ? (
              vacaciones.map((v) => (
                <div key={v.id as number} className="cumple">
                  <span>
                    <Link href={`/equipo/${v.empleado_id}?tab=vacaciones`}><b>{nombreCompleto(v as { nombre: string; apellido: string })}</b></Link>
                    {(v.desde as string) <= h && <span className="chip bien" style={{ marginLeft: 8 }}>De vacaciones</span>}
                  </span>
                  <span style={{ color: 'var(--tinta2)', fontSize: 13 }}>{fecha(v.desde as string).slice(0, 5)} al {fecha(v.hasta as string)} · {v.dias as number} días</span>
                </div>
              ))
            ) : (
              <p className="vacio">No hay vacaciones agendadas.</p>
            )}
          </div>
        </div>
      )}

      <div className="filtros">
        <div className="pildoras">
          <Link className={!bajas ? 'on' : ''} href="/equipo">Activos</Link>
          <Link className={bajas ? 'on' : ''} href="/equipo?ver=bajas">Bajas</Link>
        </div>
      </div>
      <div className="tabla-env">
        <table className="t">
          <thead>
            <tr>
              <th>Persona</th>
              <th>WhatsApp</th>
              <th>Antigüedad</th>
              <th>Cumpleaños</th>
              <th>App</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {gente.map((e) => {
              const c = e.nacimiento ? proximoCumple(e.nacimiento, h) : null;
              return (
                <tr key={e.id}>
                  <td>
                    <Link href={`/equipo/${e.id}`} className="persona" style={{ textDecoration: 'none' }}>
                      <span className="avatar">{iniciales(e)}</span>
                      <span>
                        <b>{nombreCompleto(e)}</b>
                        <small>{[e.puesto, e.area].filter(Boolean).join(' · ') || 'Sin puesto'}</small>
                      </span>
                    </Link>
                  </td>
                  <td>{e.telefono ? <a href={linkWhatsapp(e.telefono)} target="_blank" rel="noopener">{e.telefono}</a> : <span className="chico">—</span>}</td>
                  <td className="chico">{bajas ? `Baja ${fecha(e.egreso)}` : antiguedad(e.ingreso, h) || '—'}</td>
                  <td className="chico">{e.nacimiento ? `${fecha(e.nacimiento).slice(0, 5)}${c && c.faltan <= 7 ? (c.faltan === 0 ? ' · ¡hoy!' : ` · en ${c.faltan} días`) : ''}` : '—'}</td>
                  <td>{e.clave_hash ? <span className="chip bien">Tiene clave</span> : <span className="chip">Sin clave</span>}</td>
                  <td><Link className="ico" href={`/equipo/${e.id}`}>Ver ficha</Link></td>
                </tr>
              );
            })}
            {!gente.length && (
              <tr><td colSpan={6} className="vacio">{bajas ? 'No hay bajas.' : 'Todavía no cargaste a nadie. Tocá "Nueva persona".'}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {param(sp, 'nuevo') && (
        <Ventana titulo="Nueva persona" cerrar={cerrar}>
          <FormEmpleado volver="/equipo" />
        </Ventana>
      )}
    </>
  );
}
