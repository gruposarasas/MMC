import Link from 'next/link';
import { notFound } from 'next/navigation';
import { borrarJornada, guardarJornada } from '@/acciones/fichaje';
import { BotonAccion, FormAccion } from '@/components/FormAccion';
import { ResolverSalida } from '@/components/ResolverSalida';
import { TabsEquipo } from '@/components/TabsEquipo';
import { Tile } from '@/components/Tile';
import { Titulo } from '@/components/Titulo';
import { Ventana } from '@/components/Ventana';
import { db } from '@/lib/db';
import { horasDelEquipo } from '@/lib/fichaje';
import { fecha, hoy, mesActual, nombreCompleto, nombreMes, sumarMeses } from '@/lib/formato';
import { DIAS_SEMANA, diaSemana, formatoHoras, horaDe, textoTramos } from '@/lib/horas';
import { type Params, param, url } from '@/lib/url';

export const metadata = { title: 'Horas de una persona · BB-CONTROL' };

const ESTADO: Record<string, [string, string]> = {
  en_curso: ['bien', 'Trabajando'], sin_salida: ['mal', 'Sin salida'], pedida: ['alerta', 'Salida pedida'], rechazada: ['mal', 'Rechazada'],
};

export default async function HorasPersona({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Params> }) {
  const { id: idTxt } = await params;
  const sp = await searchParams;
  const id = Number(idTxt);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const mes = /^\d{4}-\d{2}$/.test(param(sp, 'p')) ? param(sp, 'p') : mesActual();
  const [{ filas, lugares, feriados }, listaLugares] = await Promise.all([
    horasDelEquipo(mes, id),
    db()<{ id: number; nombre: string }[]>`select id, nombre from lugares where activo order by nombre`,
  ]);
  const fila = filas[0];
  if (!fila) notFound();
  const { e, horario, licencias, r } = fila;
  const base = `/equipo/horas/${id}`;
  const cerrar = url(base, sp, { editar: null, nueva: null });
  const editar = r.jornadas.find((j) => j.id === Number(param(sp, 'editar')));
  const formulario = editar || param(sp, 'nueva');

  return (
    <>
      <p style={{ margin: '0 0 8px' }}><Link className="link" href={`/equipo/horas?p=${mes}`}>← Horas del equipo</Link></p>
      <div className="cabeza">
        <Titulo modulo="equipo" eti="Horas" titulo={nombreCompleto(e)}>
          {horario
            ? Object.entries(horario).map(([d, t]) => `${DIAS_SEMANA[Number(d)].slice(0, 3)} ${textoTramos(t)}`).join(' · ')
            : <>Sin horario cargado: <Link className="link" href={`/equipo/${id}?tab=horario`}>cargalo en su ficha</Link>.</>}
        </Titulo>
        <div className="acciones">
          <nav className="periodo" aria-label="Mes">
            <Link href={`${base}?p=${sumarMeses(mes, -1)}`} aria-label="Mes anterior">‹</Link>
            <span className="act">{nombreMes(mes)}</span>
            <Link href={`${base}?p=${sumarMeses(mes, 1)}`} aria-label="Mes siguiente">›</Link>
          </nav>
          <Link className="btn vino" href={url(base, sp, { nueva: 1, editar: null })} scroll={false}>+ Cargar jornada</Link>
        </div>
      </div>
      <TabsEquipo actual="/equipo/horas" />

      <div className="tiles">
        <Tile titulo="Horas trabajadas" valor={formatoHoras(r.trabajadas)} oscuro sub={`${r.dias} días${horario ? ` · su horario: ${formatoHoras(r.esperadas)} h` : ''}`} />
        <Tile titulo="Extra" valor={formatoHoras(r.extra)} sub={r.feriado ? `${formatoHoras(r.feriado)} h en feriados (doble)` : 'Por encima de su horario'} />
        <Tile titulo="Llegadas tarde" valor={String(r.tardes)} sub={`${r.ausencias.length} ${r.ausencias.length === 1 ? 'ausencia' : 'ausencias'}`} />
        <Tile titulo="Presentismo" valor={!horario ? '—' : r.presentismo ? 'Sí' : 'No'} sub={r.sinResolver ? `${r.sinResolver} salidas sin resolver` : 'Sin pendientes'} />
      </div>

      <div className="tabla-env">
        <table className="t">
          <thead>
            <tr><th>Día</th><th>Entrada</th><th>Salida</th><th className="der">Horas</th><th>Lugar</th><th>Estado</th><th><span className="sr">Acciones</span></th></tr>
          </thead>
          <tbody>
            {r.jornadas.map((j) => (
              <tr key={j.id}>
                <td className="num">{DIAS_SEMANA[diaSemana(j.fecha)].slice(0, 3)} {fecha(j.fecha).slice(0, 5)}{j.feriado && <div className="chico">Feriado: {j.feriado}</div>}</td>
                <td className="num">{horaDe(j.entradaMs)}{j.tarde && <div className="chico" style={{ color: 'var(--mal)' }}>{j.minutosTarde} min tarde</div>}</td>
                <td className="num">
                  {j.salidaMs ? horaDe(j.salidaMs) : '—'}
                  {j.salidaPor === 'admin' && <div className="chico">Cargada por administración</div>}
                  {j.pedidoMs && !j.salidaMs && <div className="chico">Pidió {horaDe(j.pedidoMs)}{j.pedidoNota ? `: ${j.pedidoNota}` : ''}</div>}
                </td>
                <td className="der num principal">{j.estado === 'ok' ? formatoHoras(j.horas) : '—'}{j.recortada && <div className="chico">recortada al máximo</div>}</td>
                <td className="chico">{(j.lugarId && lugares.get(j.lugarId)) || '—'}{j.manual ? ' · a mano' : ''}{j.nota ? ` · ${j.nota}` : ''}</td>
                <td>
                  {ESTADO[j.estado] ? <span className={`chip ${ESTADO[j.estado][0]}`}>{ESTADO[j.estado][1]}</span> : <span className="chip bien">OK</span>}
                  {(j.estado === 'sin_salida' || j.estado === 'pedida') && <div style={{ marginTop: 6 }}><ResolverSalida id={j.id} pedida={j.pedidoMs ? horaDe(j.pedidoMs) : null} /></div>}
                </td>
                <td>
                  <div className="iconos">
                    <Link className="ico" href={url(base, sp, { editar: j.id, nueva: null })} scroll={false}>Editar</Link>
                    <BotonAccion accion={borrarJornada} campos={{ id: j.id }} className="ico mal" confirmar="¿Borrar esta jornada?">Borrar</BotonAccion>
                  </div>
                </td>
              </tr>
            ))}
            {!r.jornadas.length && <tr><td colSpan={7} className="vacio">No fichó en {nombreMes(mes).toLowerCase()}.</td></tr>}
          </tbody>
        </table>
      </div>

      {(r.ausencias.length > 0 || licencias.length > 0 || feriados.size > 0) && (
        <div className="grilla2" style={{ marginTop: 18 }}>
          {r.ausencias.length > 0 && (
            <div className="caja">
              <h2>Ausencias</h2>
              <p className="sub">Días de su horario sin fichar, sin feriado, vacaciones ni certificado.</p>
              <p style={{ margin: 0 }}>{r.ausencias.map((f) => `${DIAS_SEMANA[diaSemana(f)].slice(0, 3)} ${fecha(f).slice(0, 5)}`).join(' · ')}</p>
            </div>
          )}
          {(licencias.length > 0 || feriados.size > 0) && (
            <div className="caja">
              <h2>Licencias y feriados</h2>
              <div className="lista-mi">
                {licencias.map((l, i) => <div key={i}><span>{l.tipo === 'vacaciones' ? 'Vacaciones' : 'Certificado'}</span><span className="chico">{fecha(l.desde).slice(0, 5)} al {fecha(l.hasta).slice(0, 5)}</span></div>)}
                {[...feriados].map(([f, n]) => <div key={f}><span>Feriado{n ? `: ${n}` : ''}</span><span className="chico">{fecha(f).slice(0, 5)}</span></div>)}
              </div>
            </div>
          )}
        </div>
      )}

      {formulario && (
        <Ventana titulo={editar ? 'Corregir jornada' : 'Cargar jornada'} cerrar={cerrar}>
          <FormAccion accion={guardarJornada}>
            <input type="hidden" name="volver" value={cerrar} />
            <input type="hidden" name="empleado_id" value={id} />
            {editar && <input type="hidden" name="id" value={editar.id} />}
            <label className="campo"><span>Día</span><input type="date" name="fecha" defaultValue={editar?.fecha ?? hoy()} max={hoy()} required /></label>
            <label className="campo"><span>Entrada</span><input type="time" name="entrada" defaultValue={editar ? horaDe(editar.entradaMs) : ''} required /></label>
            <label className="campo"><span>Salida <em>(vacía si todavía está)</em></span><input type="time" name="salida" defaultValue={editar?.salidaMs ? horaDe(editar.salidaMs) : ''} /></label>
            <label className="campo">
              <span>Lugar</span>
              <select name="lugar_id" defaultValue={editar?.lugarId ?? ''}>
                <option value="">—</option>
                {listaLugares.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
              </select>
            </label>
            <label className="campo ancho"><span>Nota <em>(por qué se carga a mano)</em></span><input name="nota" defaultValue={editar?.nota} placeholder="Ej.: se quedó sin batería" /></label>
          </FormAccion>
        </Ventana>
      )}
    </>
  );
}
