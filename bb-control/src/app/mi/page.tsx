import Link from 'next/link';
import { actualizarMisDatos, cancelarVacaciones, pedirAdelanto, pedirUniforme, pedirVacaciones, subirCertificado } from '@/acciones/mi';
import { salirEquipo } from '@/acciones/sesion';
import { ArchivoInput } from '@/components/ArchivoInput';
import { BotonAccion, FormAccion } from '@/components/FormAccion';
import type { Empleado } from '@/components/FormEmpleado';
import { db } from '@/lib/db';
import { cumpleanos } from '@/lib/equipo';
import { fecha, hoy, MESES, nombreMes, pesos } from '@/lib/formato';
import { empleadoSesion } from '@/lib/sesion';
import { type Params, param } from '@/lib/url';
import { diasQueCorresponden, proximoCumple } from '@/lib/vacaciones';
import { IngresoEquipo } from './IngresoEquipo';

export const metadata = { title: 'Mi app · Bruno Brown' };
export const dynamic = 'force-dynamic';

const SECCIONES = [
  { id: 'vacaciones', nombre: 'Vacaciones', bajada: 'Pedir días' },
  { id: 'adelanto', nombre: 'Adelanto', bajada: 'Pedir plata a cuenta' },
  { id: 'certificado', nombre: 'Certificado', bajada: 'Mandar el médico' },
  { id: 'uniforme', nombre: 'Uniforme', bajada: 'Pedir ropa' },
  { id: 'sueldos', nombre: 'Mis sueldos', bajada: 'Lo que cobré' },
  { id: 'datos', nombre: 'Mis datos', bajada: 'Teléfono, talles…' },
];
const ESTADO: Record<string, [string, string]> = {
  pendiente: ['alerta', 'Esperando respuesta'], pedido: ['alerta', 'Esperando respuesta'], aprobada: ['bien', 'Aprobadas'], aprobado: ['bien', 'Aprobado'],
  entregado: ['bien', 'Entregado'], rechazada: ['mal', 'No aprobadas'], rechazado: ['mal', 'No aprobado'], cancelada: ['', 'Cancelada'],
};
const Chip = ({ e }: { e: string }) => <span className={`chip ${ESTADO[e]?.[0] ?? ''}`}>{ESTADO[e]?.[1] ?? e}</span>;

export default async function Mi({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const id = await empleadoSesion();
  const sql = db();
  const [e] = id ? await sql<Empleado[]>`select * from empleados where id = ${id} and activo` : [];
  if (!e) {
    return (
      <div className="ingreso">
        <img className="deco" src="/img/ic_planta.png" alt="" style={{ width: 190, right: -40, top: 30 }} />
        <div className="ingreso-c">
          <img src="/b-crema.png" alt="Bruno Brown" />
          <h1>Equipo Bruno Brown</h1>
          <p>Entrá con tu DNI y la clave que te dio administración.</p>
          <IngresoEquipo />
        </div>
      </div>
    );
  }

  const s = SECCIONES.some((x) => x.id === param(sp, 's')) ? param(sp, 's') : '';
  const h = hoy();
  const anio = Number(h.slice(0, 4));
  const [vacaciones, adelantos, certificados, uniformes, sueldos, cumples] = await Promise.all([
    sql`select * from vacaciones where empleado_id = ${e.id} order by desde desc limit 20`,
    sql`select * from adelantos where empleado_id = ${e.id} order by creado desc limit 20`,
    sql`select id, desde, hasta, motivo, archivo_id, creado from certificados where empleado_id = ${e.id} order by desde desc limit 20`,
    sql`select * from uniformes where empleado_id = ${e.id} order by creado desc limit 20`,
    sql`select * from sueldos where empleado_id = ${e.id} order by periodo desc limit 12`,
    cumpleanos(31),
  ]);
  const corresponden = diasQueCorresponden(e.ingreso, anio, e.dias_vacaciones);
  const tomados = vacaciones.filter((v) => v.estado === 'aprobada' && (v.desde as string).startsWith(String(anio))).reduce((a, v) => a + (v.dias as number), 0);
  const miCumple = e.nacimiento ? proximoCumple(e.nacimiento, h) : null;
  const pendientes = [...vacaciones, ...adelantos, ...uniformes].filter((x) => x.estado === 'pendiente' || x.estado === 'pedido').length;

  return (
    <div className="mi">
      <header className="mi-cab">
        <img className="deco" src="/img/ic_flor.png" alt="" style={{ width: 130, right: -26, top: 'calc(14px + env(safe-area-inset-top, 0px))' }} />
        <div className="fila">
          <Link href="/mi"><img src="/b-crema.png" alt="Bruno Brown" /></Link>
          <form action={salirEquipo}><button>Salir</button></form>
        </div>
        <h1>{miCumple?.faltan === 0 ? `¡Feliz cumple, ${e.nombre}! 🎂` : `Hola, ${e.nombre}`}</h1>
        <p>{e.puesto || 'Equipo Bruno Brown'}</p>
      </header>
      <div className="mi-in">
        {!s && (
          <>
            <div className="mi-tiles">
              <div className="tile"><div className="t">Vacaciones {anio}</div><div className="v">{Math.max(corresponden - tomados, 0)} días</div><div className="s">te quedan de {corresponden}</div></div>
              <div className="tile"><div className="t">Pedidos</div><div className="v">{pendientes}</div><div className="s">esperando respuesta</div></div>
            </div>
            <div className="mi-menu">
              {SECCIONES.map((x) => (
                <Link key={x.id} href={`/mi?s=${x.id}`}>{x.nombre}<small>{x.bajada}</small></Link>
              ))}
            </div>
            {cumples.length > 0 && (
              <div className="caja">
                <h2>Cumpleaños que se vienen</h2>
                <div className="lista-mi">
                  {cumples.map((c) => (
                    <div key={c.id}>
                      <span>{c.nombre} {c.apellido}</span>
                      <span style={{ fontSize: 13, color: 'var(--tinta2)' }}>{c.faltan === 0 ? '🎂 ¡Hoy!' : `${fecha(c.fecha).slice(0, 5)}`}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {s && (
          <p style={{ margin: '0 0 12px' }}><Link href="/mi" className="link">← Volver</Link></p>
        )}

        {s === 'vacaciones' && (
          <>
            <div className="caja">
              <h2>Pedir vacaciones</h2>
              <p className="sub">Te quedan {Math.max(corresponden - tomados, 0)} días de {corresponden} en {anio}. Son días corridos.</p>
              <FormAccion accion={pedirVacaciones} boton="Enviar pedido" limpiar claseBoton="btn vino ancho">
                <label className="campo"><span>Me voy el</span><input type="date" name="desde" min={h} required /></label>
                <label className="campo"><span>Hasta <em>(último día de vacaciones)</em></span><input type="date" name="hasta" min={h} required /></label>
                <label className="campo ancho"><span>Comentario <em>(opcional)</em></span><input name="nota" /></label>
              </FormAccion>
            </div>
            <div className="caja">
              <h2>Mis vacaciones</h2>
              <div className="lista-mi">
                {vacaciones.map((v) => (
                  <div key={v.id as number}>
                    <span>{fecha(v.desde as string)} al {fecha(v.hasta as string)}<small>{v.dias as number} días{v.respuesta ? ` · ${v.respuesta}` : ''}</small></span>
                    <span className="acciones">
                      <Chip e={v.estado as string} />
                      {v.estado === 'pendiente' && <BotonAccion accion={cancelarVacaciones} campos={{ id: v.id as number }} className="ico mal" confirmar="¿Cancelar este pedido?">Cancelar</BotonAccion>}
                    </span>
                  </div>
                ))}
                {!vacaciones.length && <p className="vacio">Todavía no pediste vacaciones.</p>}
              </div>
            </div>
          </>
        )}

        {s === 'adelanto' && (
          <>
            <div className="caja">
              <h2>Pedir un adelanto</h2>
              <p className="sub">Se descuenta de tu sueldo del mes. Administración te avisa cuando lo aprueba.</p>
              <FormAccion accion={pedirAdelanto} boton="Enviar pedido" limpiar claseBoton="btn vino ancho">
                <label className="campo"><span>¿Cuánto necesitás?</span><input name="monto" inputMode="decimal" required placeholder="$" /></label>
                <label className="campo"><span>Motivo <em>(opcional)</em></span><input name="motivo" /></label>
              </FormAccion>
            </div>
            <div className="caja">
              <h2>Mis adelantos</h2>
              <div className="lista-mi">
                {adelantos.map((a) => (
                  <div key={a.id as number}>
                    <span><b className="num">{pesos(a.monto as number, 0)}</b><small>{fecha(hoy(new Date(a.creado as string)))}{a.descontar_en ? ` · se descuenta en ${nombreMes((a.descontar_en as string).slice(0, 7))}` : ''}</small></span>
                    <Chip e={a.estado as string} />
                  </div>
                ))}
                {!adelantos.length && <p className="vacio">No pediste adelantos.</p>}
              </div>
            </div>
          </>
        )}

        {s === 'certificado' && (
          <>
            <div className="caja">
              <h2>Mandar un certificado médico</h2>
              <p className="sub">Sacale una foto clara o subí el PDF.</p>
              <FormAccion accion={subirCertificado} boton="Enviar certificado" limpiar claseBoton="btn vino ancho">
                <label className="campo"><span>Desde</span><input type="date" name="desde" defaultValue={h} required /></label>
                <label className="campo"><span>Hasta</span><input type="date" name="hasta" /></label>
                <label className="campo ancho"><span>Motivo <em>(opcional)</em></span><input name="motivo" /></label>
                <label className="campo ancho"><span>Foto o PDF</span><ArchivoInput name="archivo" required /></label>
              </FormAccion>
            </div>
            <div className="caja">
              <h2>Mis certificados</h2>
              <div className="lista-mi">
                {certificados.map((c) => (
                  <div key={c.id as number}>
                    <span>{fecha(c.desde as string)}{c.hasta !== c.desde ? ` al ${fecha(c.hasta as string)}` : ''}<small>{c.motivo as string}</small></span>
                    {c.archivo_id && <a className="ico" href={`/api/archivos/${c.archivo_id}`} target="_blank" rel="noopener">Ver</a>}
                  </div>
                ))}
                {!certificados.length && <p className="vacio">No mandaste certificados.</p>}
              </div>
            </div>
          </>
        )}

        {s === 'uniforme' && (
          <>
            <div className="caja">
              <h2>Pedir uniforme</h2>
              <FormAccion accion={pedirUniforme} boton="Enviar pedido" limpiar claseBoton="btn vino ancho">
                <label className="campo"><span>¿Qué necesitás?</span>
                  <select name="prenda" required defaultValue="">
                    <option value="" disabled>Elegí…</option>
                    {['Remera', 'Delantal', 'Buzo', 'Campera', 'Gorra', 'Pantalón', 'Zapatillas', 'Otra cosa'].map((p) => <option key={p}>{p}</option>)}
                  </select>
                </label>
                <label className="campo"><span>Talle</span><input name="talle" defaultValue={e.talle_remera} /></label>
                <label className="campo"><span>Cantidad</span><input name="cantidad" inputMode="numeric" defaultValue="1" /></label>
                <label className="campo"><span>Comentario <em>(opcional)</em></span><input name="nota" /></label>
              </FormAccion>
            </div>
            <div className="caja">
              <h2>Mi uniforme</h2>
              <div className="lista-mi">
                {uniformes.map((u) => (
                  <div key={u.id as number}>
                    <span>{u.cantidad as number} × {u.prenda as string}{u.talle ? ` (${u.talle})` : ''}<small>{u.fecha_entrega ? `Entregado el ${fecha(u.fecha_entrega as string)}` : `Pedido el ${fecha(hoy(new Date(u.creado as string)))}`}</small></span>
                    <Chip e={u.estado as string} />
                  </div>
                ))}
                {!uniformes.length && <p className="vacio">Sin entregas registradas.</p>}
              </div>
            </div>
          </>
        )}

        {s === 'sueldos' && (
          <div className="caja">
            <h2>Mis sueldos</h2>
            <div className="lista-mi">
              {sueldos.map((x) => (
                <div key={x.id as number}>
                  <span style={{ textTransform: 'capitalize' }}>{MESES[Number((x.periodo as string).slice(5, 7)) - 1]} {(x.periodo as string).slice(0, 4)}
                    <small style={{ textTransform: 'none' }}>{x.descuentos ? `Adelantos descontados ${pesos(x.descuentos as number, 0)}` : 'Sin descuentos'}{x.pagado ? ` · pagado ${fecha(x.fecha_pago as string)}` : ' · todavía no se pagó'}</small>
                  </span>
                  <b className="num">{pesos((x.neto as number) + (x.extras as number) - (x.descuentos as number), 0)}</b>
                </div>
              ))}
              {!sueldos.length && <p className="vacio">Todavía no hay sueldos cargados.</p>}
            </div>
          </div>
        )}

        {s === 'datos' && (
          <div className="caja">
            <h2>Mis datos</h2>
            <p className="sub">Mantenelos al día, así te ubicamos y te damos el talle justo.</p>
            <FormAccion accion={actualizarMisDatos} claseBoton="btn vino ancho">
              <label className="campo"><span>WhatsApp</span><input name="telefono" inputMode="tel" defaultValue={e.telefono} /></label>
              <label className="campo"><span>Mail</span><input name="mail" type="email" defaultValue={e.mail} /></label>
              <label className="campo ancho"><span>Dirección</span><input name="direccion" defaultValue={e.direccion} /></label>
              <label className="campo ancho"><span>Contacto de emergencia</span><input name="emergencia" defaultValue={e.emergencia} placeholder="Nombre y teléfono" /></label>
              <label className="campo"><span>Obra social</span><input name="obra_social" defaultValue={e.obra_social} /></label>
              <label className="campo"><span>CBU o alias</span><input name="cbu" defaultValue={e.cbu} /></label>
              <label className="campo"><span>Talle remera</span><input name="talle_remera" defaultValue={e.talle_remera} /></label>
              <label className="campo"><span>Talle pantalón</span><input name="talle_pantalon" defaultValue={e.talle_pantalon} /></label>
              <label className="campo"><span>Talle calzado</span><input name="talle_calzado" defaultValue={e.talle_calzado} /></label>
            </FormAccion>
          </div>
        )}
      </div>
      <img className="guarda-pie" src="/img/guarda.png" alt="" />
    </div>
  );
}
