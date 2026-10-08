import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  borrarAdelanto, borrarCertificado, borrarUniforme, cambiarActivo, cargarAdelanto, cargarCertificado, cargarUniforme, cargarVacaciones, resolverVacaciones,
} from '@/acciones/equipo';
import { ArchivoInput } from '@/components/ArchivoInput';
import { BotonAccion, FormAccion } from '@/components/FormAccion';
import { FormEmpleado, type Empleado } from '@/components/FormEmpleado';
import { GenerarClave } from '@/components/GenerarClave';
import { Pedidos } from '@/components/Pedidos';
import { Tile } from '@/components/Tile';
import { Ventana } from '@/components/Ventana';
import { db } from '@/lib/db';
import { pedidosPendientes } from '@/lib/equipo';
import { fecha, hoy, linkWhatsapp, nombreCompleto, nombreMes, pesos } from '@/lib/formato';
import { type Params, param, url } from '@/lib/url';
import { antiguedad, diasQueCorresponden, edad, proximoCumple } from '@/lib/vacaciones';

export const metadata = { title: 'Ficha · GM-CONTROL' };

const PESTANAS = [
  { id: 'datos', nombre: 'Datos' },
  { id: 'vacaciones', nombre: 'Vacaciones' },
  { id: 'certificados', nombre: 'Certificados' },
  { id: 'uniforme', nombre: 'Uniforme' },
  { id: 'adelantos', nombre: 'Adelantos' },
  { id: 'sueldos', nombre: 'Sueldos' },
];

const ESTADO_CHIP: Record<string, string> = {
  aprobada: 'bien', aprobado: 'bien', entregado: 'bien', pendiente: 'alerta', pedido: 'alerta', rechazada: 'mal', rechazado: 'mal', cancelada: '',
};

export default async function Ficha({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Params> }) {
  const { id: idTxt } = await params;
  const sp = await searchParams;
  const id = Number(idTxt);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const sql = db();
  const [e] = await sql<Empleado[]>`select * from empleados where id = ${id}`;
  if (!e) notFound();
  const tab = PESTANAS.some((t) => t.id === param(sp, 'tab')) ? param(sp, 'tab') : 'datos';
  const h = hoy();
  const anio = Number(h.slice(0, 4));
  const base = `/equipo/${id}`;

  const [vacaciones, certificados, uniformes, adelantos, sueldos, pedidos] = await Promise.all([
    sql`select * from vacaciones where empleado_id = ${id} order by desde desc`,
    sql`select * from certificados where empleado_id = ${id} order by desde desc`,
    sql`select * from uniformes where empleado_id = ${id} order by coalesce(fecha_entrega, creado::date) desc`,
    sql`select * from adelantos where empleado_id = ${id} order by creado desc`,
    sql`select * from sueldos where empleado_id = ${id} order by periodo desc limit 24`,
    pedidosPendientes(id),
  ]);

  const corresponden = diasQueCorresponden(e.ingreso, anio, e.dias_vacaciones);
  const tomados = vacaciones
    .filter((v) => v.estado === 'aprobada' && (v.desde as string).startsWith(String(anio)))
    .reduce((a, v) => a + (v.dias as number), 0);
  const cumple = e.nacimiento ? proximoCumple(e.nacimiento, h) : null;
  const cerrar = url(base, sp, { editar: null });
  const msgApp = `Hola ${e.nombre}! Esta es tu app de Grupo Modesto para pedir vacaciones, adelantos, uniforme y mandar certificados.`;

  const Dato = ({ t, v }: { t: string; v: React.ReactNode }) => (
    <div>
      <span>{t}</span>
      <b>{v || '—'}</b>
    </div>
  );

  return (
    <>
      <p style={{ margin: '0 0 10px' }}><Link href="/equipo" className="link">← Equipo</Link></p>
      <div className="cabeza">
        <div className="persona">
          <span className="avatar grande">{`${e.nombre[0] ?? ''}${e.apellido[0] ?? ''}`.toUpperCase()}</span>
          <span>
            <h1>{nombreCompleto(e)}</h1>
            <p style={{ margin: 0 }}>
              {[e.puesto, e.area].filter(Boolean).join(' · ') || 'Sin puesto'}
              {!e.activo && <span className="chip mal" style={{ marginLeft: 8 }}>Baja {fecha(e.egreso)}</span>}
            </p>
          </span>
        </div>
        <div className="acciones">
          {e.telefono && <a className="btn claro" href={linkWhatsapp(e.telefono)} target="_blank" rel="noopener">WhatsApp</a>}
          <Link className="btn" href={url(base, sp, { editar: 1 })} scroll={false}>Editar datos</Link>
        </div>
      </div>

      <div className="tiles">
        <Tile titulo="Antigüedad" valor={antiguedad(e.ingreso, h) || '—'} sub={e.ingreso ? `Desde el ${fecha(e.ingreso)}` : 'Falta la fecha de ingreso'} />
        <Tile titulo={`Vacaciones ${anio}`} valor={`${Math.max(corresponden - tomados, 0)} días`} sub={`Le corresponden ${corresponden}, tomó ${tomados}`} />
        <Tile titulo="Cumpleaños" valor={e.nacimiento ? fecha(e.nacimiento).slice(0, 5) : '—'} sub={cumple ? (cumple.faltan === 0 ? `¡Hoy cumple ${cumple.cumple}!` : `Cumple ${cumple.cumple} en ${cumple.faltan} días`) : 'Falta la fecha de nacimiento'} />
        <Tile titulo="Sueldo neto de referencia" valor={pesos(e.sueldo_neto, 0)} sub={e.sueldo_bruto ? `Bruto ${pesos(e.sueldo_bruto, 0)}` : ' '} />
      </div>

      {pedidos.length > 0 && (
        <div className="caja">
          <h2>Pedidos pendientes</h2>
          <Pedidos pedidos={pedidos} conNombre={false} />
        </div>
      )}

      <nav className="pestanas" aria-label="Secciones">
        {PESTANAS.map((t) => (
          <Link key={t.id} href={url(base, {}, { tab: t.id === 'datos' ? null : t.id })} className={tab === t.id ? 'on' : ''} scroll={false}>{t.nombre}</Link>
        ))}
      </nav>

      {tab === 'datos' && (
        <>
          <div className="caja">
            <div className="datos">
              <Dato t="DNI" v={e.dni} />
              <Dato t="CUIL" v={e.cuil} />
              <Dato t="Nacimiento" v={e.nacimiento && `${fecha(e.nacimiento)} (${edad(e.nacimiento, h)} años)`} />
              <Dato t="Ingreso" v={fecha(e.ingreso)} />
              <Dato t="WhatsApp" v={e.telefono} />
              <Dato t="Mail" v={e.mail} />
              <Dato t="Dirección" v={e.direccion} />
              <Dato t="Contacto de emergencia" v={e.emergencia} />
              <Dato t="Obra social" v={e.obra_social} />
              <Dato t="CBU / alias" v={e.cbu} />
              <Dato t="Talles" v={[e.talle_remera && `remera ${e.talle_remera}`, e.talle_pantalon && `pantalón ${e.talle_pantalon}`, e.talle_calzado && `calzado ${e.talle_calzado}`].filter(Boolean).join(' · ')} />
              <Dato t="Días de vacaciones" v={e.dias_vacaciones != null ? `${e.dias_vacaciones} (fijo)` : `${corresponden} (por antigüedad)`} />
            </div>
            {e.notas && <p style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>{e.notas}</p>}
          </div>
          <div className="grilla2">
            <div className="caja">
              <h2>App del equipo</h2>
              <p className="sub">Entra en <b>/mi</b> con su DNI y una clave de 6 números. Si se la olvida, generale una nueva.</p>
              {e.activo ? (
                <GenerarClave id={e.id} tiene={!!e.clave_hash} telefono={e.telefono} dni={e.dni ?? ''} mensaje={msgApp} />
              ) : (
                <p className="vacio">Está de baja: no puede entrar.</p>
              )}
            </div>
            <div className="caja">
              <h2>{e.activo ? 'Dar de baja' : 'Volver a dar de alta'}</h2>
              <p className="sub">{e.activo ? 'Deja de aparecer en el equipo y en los sueldos de los meses que vienen. No se borra nada.' : 'Vuelve a aparecer en el equipo.'}</p>
              <BotonAccion accion={cambiarActivo} campos={{ id: e.id, activo: e.activo ? '0' : '1' }} className={e.activo ? 'btn claro' : 'btn'} confirmar={e.activo ? `¿Dar de baja a ${e.nombre}?` : undefined}>
                {e.activo ? 'Dar de baja' : 'Dar de alta'}
              </BotonAccion>
            </div>
          </div>
        </>
      )}

      {tab === 'vacaciones' && (
        <div className="grilla2">
          <div className="caja">
            <h2>Historial</h2>
            <p className="sub">Por la Ley de Contrato de Trabajo le corresponden {corresponden} días corridos en {anio}.</p>
            <div className="lista-mi">
              {vacaciones.map((v) => (
                <div key={v.id as number}>
                  <span>
                    {fecha(v.desde as string)} al {fecha(v.hasta as string)} · {v.dias as number} días
                    <small>{[v.nota, v.respuesta].filter(Boolean).join(' · ')}</small>
                  </span>
                  <span className="acciones">
                    <span className={`chip ${ESTADO_CHIP[v.estado as string]}`}>{v.estado as string}</span>
                    {v.estado === 'aprobada' && (v.hasta as string) >= h && (
                      <BotonAccion accion={resolverVacaciones} campos={{ id: v.id as number, estado: 'cancelada' }} className="ico mal" confirmar="¿Cancelar estas vacaciones?">Cancelar</BotonAccion>
                    )}
                  </span>
                </div>
              ))}
              {!vacaciones.length && <p className="vacio">Sin vacaciones registradas.</p>}
            </div>
          </div>
          <div className="caja">
            <h2>Agendar vacaciones</h2>
            <p className="sub">Quedan aprobadas directamente.</p>
            <FormAccion accion={cargarVacaciones} limpiar>
              <input type="hidden" name="empleado_id" value={id} />
              <label className="campo"><span>Desde</span><input type="date" name="desde" required /></label>
              <label className="campo"><span>Hasta</span><input type="date" name="hasta" required /></label>
              <label className="campo ancho"><span>Nota</span><input name="nota" /></label>
            </FormAccion>
          </div>
        </div>
      )}

      {tab === 'certificados' && (
        <div className="grilla2">
          <div className="caja">
            <h2>Certificados médicos</h2>
            <div className="lista-mi">
              {certificados.map((c) => (
                <div key={c.id as number}>
                  <span>
                    {fecha(c.desde as string)}{c.hasta !== c.desde ? ` al ${fecha(c.hasta as string)}` : ''}
                    <small>{(c.motivo as string) || 'Sin motivo'}{!c.visto ? ' · nuevo' : ''}</small>
                  </span>
                  <span className="acciones">
                    {c.archivo_id && <a className="ico" href={`/api/archivos/${c.archivo_id}`} target="_blank" rel="noopener">Ver</a>}
                    <BotonAccion accion={borrarCertificado} campos={{ id: c.id as number }} className="ico mal" confirmar="¿Borrar este certificado?">Borrar</BotonAccion>
                  </span>
                </div>
              ))}
              {!certificados.length && <p className="vacio">Sin certificados.</p>}
            </div>
          </div>
          <div className="caja">
            <h2>Cargar un certificado</h2>
            <FormAccion accion={cargarCertificado} limpiar>
              <input type="hidden" name="empleado_id" value={id} />
              <label className="campo"><span>Desde</span><input type="date" name="desde" required /></label>
              <label className="campo"><span>Hasta</span><input type="date" name="hasta" /></label>
              <label className="campo ancho"><span>Motivo</span><input name="motivo" /></label>
              <label className="campo ancho"><span>Foto o PDF</span><ArchivoInput name="archivo" /></label>
            </FormAccion>
          </div>
        </div>
      )}

      {tab === 'uniforme' && (
        <div className="grilla2">
          <div className="caja">
            <h2>Entregas de uniforme</h2>
            <div className="lista-mi">
              {uniformes.map((u) => (
                <div key={u.id as number}>
                  <span>
                    {u.cantidad as number} × {u.prenda as string}{u.talle ? ` (talle ${u.talle})` : ''}
                    <small>{u.fecha_entrega ? `Entregado el ${fecha(u.fecha_entrega as string)}` : `Pedido el ${fecha(hoy(new Date(u.creado as string)))}`}{u.nota ? ` · ${u.nota}` : ''}</small>
                  </span>
                  <span className="acciones">
                    <span className={`chip ${ESTADO_CHIP[u.estado as string]}`}>{u.estado as string}</span>
                    <BotonAccion accion={borrarUniforme} campos={{ id: u.id as number }} className="ico mal" confirmar="¿Borrar este registro?">Borrar</BotonAccion>
                  </span>
                </div>
              ))}
              {!uniformes.length && <p className="vacio">Sin entregas registradas.</p>}
            </div>
          </div>
          <div className="caja">
            <h2>Registrar una entrega</h2>
            <FormAccion accion={cargarUniforme} limpiar>
              <input type="hidden" name="empleado_id" value={id} />
              <label className="campo"><span>Prenda</span>
                <input name="prenda" list="prendas" required />
                <datalist id="prendas">{['Remera', 'Delantal', 'Buzo', 'Campera', 'Gorra', 'Pantalón', 'Zapatillas'].map((p) => <option key={p} value={p} />)}</datalist>
              </label>
              <label className="campo"><span>Talle</span><input name="talle" defaultValue={e.talle_remera} /></label>
              <label className="campo"><span>Cantidad</span><input name="cantidad" inputMode="numeric" defaultValue="1" /></label>
              <label className="campo"><span>Fecha</span><input type="date" name="fecha_entrega" defaultValue={h} /></label>
              <label className="campo ancho"><span>Nota</span><input name="nota" /></label>
            </FormAccion>
          </div>
        </div>
      )}

      {tab === 'adelantos' && (
        <div className="grilla2">
          <div className="caja">
            <h2>Adelantos</h2>
            <div className="lista-mi">
              {adelantos.map((a) => (
                <div key={a.id as number}>
                  <span>
                    <b className="num">{pesos(a.monto as number, 0)}</b>
                    <small>
                      {[a.motivo, a.fecha_pago && `pagado ${fecha(a.fecha_pago as string)}`, a.descontar_en && `se descuenta en ${nombreMes((a.descontar_en as string).slice(0, 7))}`].filter(Boolean).join(' · ')}
                    </small>
                  </span>
                  <span className="acciones">
                    <span className={`chip ${ESTADO_CHIP[a.estado as string]}`}>{a.estado as string}</span>
                    <BotonAccion accion={borrarAdelanto} campos={{ id: a.id as number }} className="ico mal" confirmar="¿Borrar este adelanto?">Borrar</BotonAccion>
                  </span>
                </div>
              ))}
              {!adelantos.length && <p className="vacio">Sin adelantos.</p>}
            </div>
          </div>
          <div className="caja">
            <h2>Cargar un adelanto</h2>
            <p className="sub">Queda aprobado y se descuenta en el sueldo del mes que elijas.</p>
            <FormAccion accion={cargarAdelanto} limpiar>
              <input type="hidden" name="empleado_id" value={id} />
              <label className="campo"><span>Monto</span><input name="monto" inputMode="decimal" required /></label>
              <label className="campo"><span>Pagado el</span><input type="date" name="fecha_pago" defaultValue={h} /></label>
              <label className="campo"><span>Se descuenta en</span><input type="month" name="descontar_en" defaultValue={h.slice(0, 7)} /></label>
              <label className="campo"><span>Motivo</span><input name="motivo" /></label>
            </FormAccion>
          </div>
        </div>
      )}

      {tab === 'sueldos' && (
        <div className="tabla-env">
          <table className="t">
            <thead>
              <tr><th>Mes</th><th className="der">Bruto</th><th className="der">Neto</th><th className="der">Extras</th><th className="der">Descuentos</th><th className="der">Cobró</th><th>Estado</th></tr>
            </thead>
            <tbody>
              {sueldos.map((s) => (
                <tr key={s.id as number}>
                  <td><Link href={`/sueldos?p=${(s.periodo as string).slice(0, 7)}`} style={{ textTransform: 'capitalize' }}>{nombreMes((s.periodo as string).slice(0, 7))}</Link></td>
                  <td className="der num">{pesos(s.bruto as number, 0)}</td>
                  <td className="der num">{pesos(s.neto as number, 0)}</td>
                  <td className="der num">{pesos(s.extras as number, 0)}</td>
                  <td className="der num">{pesos(s.descuentos as number, 0)}</td>
                  <td className="der num principal">{pesos((s.neto as number) + (s.extras as number) - (s.descuentos as number), 0)}</td>
                  <td>{s.pagado ? <span className="chip bien">Pagado</span> : <span className="chip alerta">Sin pagar</span>}</td>
                </tr>
              ))}
              {!sueldos.length && <tr><td colSpan={7} className="vacio">Todavía no tiene sueldos cargados.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {param(sp, 'editar') && (
        <Ventana titulo={`Editar a ${e.nombre}`} cerrar={cerrar}>
          <FormEmpleado e={e} volver={cerrar} />
        </Ventana>
      )}
    </>
  );
}
