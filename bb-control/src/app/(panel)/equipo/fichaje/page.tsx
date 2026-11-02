import Link from 'next/link';
import { headers } from 'next/headers';
import {
  agregarFeriado, borrarFeriado, borrarLugar, borrarPantalla, crearPantalla, guardarLugar, guardarReglas, nuevoLinkPantalla, traerFeriados,
} from '@/acciones/fichaje';
import { FijarUbicacion } from '@/components/FijarUbicacion';
import { BotonAccion, FormAccion } from '@/components/FormAccion';
import { TabsEquipo } from '@/components/TabsEquipo';
import { Titulo } from '@/components/Titulo';
import { Ventana } from '@/components/Ventana';
import { db } from '@/lib/db';
import { reglasFichaje } from '@/lib/fichaje';
import { fecha, hoy } from '@/lib/formato';
import { DIAS_SEMANA, diaSemana } from '@/lib/horas';
import { type Params, param, url } from '@/lib/url';

export const metadata = { title: 'Fichaje · BB-CONTROL' };

type Lugar = { id: number; nombre: string; direccion: string; lat: number | null; lng: number | null; radio_m: number; activo: boolean; personas: number; pantallas: number };
type Pantalla = { id: number; lugar_id: number; lugar: string; nombre: string; token_hash: string | null; codigo: string | null; codigo_vence: Date | null; visto: Date | null };

export default async function Fichaje({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const anio = /^\d{4}$/.test(param(sp, 'anio')) ? param(sp, 'anio') : hoy().slice(0, 4);
  const sql = db();
  const [lugares, pantallas, feriados, reglas, h] = await Promise.all([
    sql<Lugar[]>`select l.*, (select count(*)::int from empleados e where e.lugar_id = l.id and e.activo) personas,
                 (select count(*)::int from pantallas p where p.lugar_id = l.id) pantallas from lugares l order by not l.activo, l.nombre`,
    sql<Pantalla[]>`select p.*, l.nombre lugar from pantallas p join lugares l on l.id = p.lugar_id order by l.nombre, p.id`,
    sql<{ fecha: string; nombre: string }[]>`select fecha, nombre from feriados where extract(year from fecha) = ${Number(anio)} order by fecha`,
    reglasFichaje(),
    headers(),
  ]);
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? '';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  const origen = `${proto}://${host}`;
  const base = '/equipo/fichaje';
  const cerrar = url(base, sp, { lugar: null });
  const lugarParam = param(sp, 'lugar');
  const editando = lugarParam && lugarParam !== 'nuevo' ? lugares.find((l) => l.id === Number(lugarParam)) : null;
  const ahora = Date.now();
  const cuando = (d: Date) => new Date(d).toLocaleString('es-AR', { timeZone: 'America/Argentina/Mendoza', dateStyle: 'short', timeStyle: 'short' });

  return (
    <>
      <div className="cabeza">
        <Titulo modulo="equipo" titulo="Fichaje">
          Dónde se ficha, las pantallas con el QR, los feriados y las reglas para contar las horas. Cada persona ficha desde su app ({origen}/mi), en el lugar y con el QR de la pantalla.
        </Titulo>
        <div className="acciones">
          <Link className="btn vino" href={url(base, sp, { lugar: 'nuevo' })} scroll={false}>+ Lugar</Link>
        </div>
      </div>
      <TabsEquipo actual="/equipo/fichaje" />

      <div className="caja">
        <h2>Lugares</h2>
        <p className="sub">Para fichar hay que estar dentro del radio del lugar. Para cargar la ubicación, pará en el lugar con el celular y tocá "Fijar la ubicación desde acá" (o pegá las coordenadas de Google Maps).</p>
        <div className="tabla-env">
          <table className="t">
            <thead><tr><th>Lugar</th><th>Ubicación</th><th className="der">Radio</th><th className="der">Personas</th><th><span className="sr">Acciones</span></th></tr></thead>
            <tbody>
              {lugares.map((l) => (
                <tr key={l.id}>
                  <td><span className="principal">{l.nombre}</span>{!l.activo && <span className="chip" style={{ marginLeft: 6 }}>Inactivo</span>}{l.direccion && <div className="chico">{l.direccion}</div>}</td>
                  <td>
                    {l.lat != null && l.lng != null
                      ? <a className="link chico" href={`https://www.google.com/maps?q=${l.lat},${l.lng}`} target="_blank" rel="noopener">{l.lat.toFixed(5)}, {l.lng.toFixed(5)}</a>
                      : <span className="chip mal">Sin ubicación</span>}
                    <div style={{ marginTop: 6 }}><FijarUbicacion id={l.id} /></div>
                  </td>
                  <td className="der num">{l.radio_m} m</td>
                  <td className="der num">{l.personas || '—'}</td>
                  <td>
                    <div className="iconos">
                      <Link className="ico" href={url(base, sp, { lugar: l.id })} scroll={false}>Editar</Link>
                      <BotonAccion accion={borrarLugar} campos={{ id: l.id }} className="ico mal" confirmar={`¿Borrar ${l.nombre}? Si ya tiene fichajes, queda inactivo.`}>Borrar</BotonAccion>
                    </div>
                  </td>
                </tr>
              ))}
              {!lugares.length && <tr><td colSpan={5} className="vacio">Todavía no hay lugares. Tocá "+ Lugar" (por ejemplo: Depósito, Oficina).</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="caja">
        <h2>Pantallas del QR</h2>
        <p className="sub">
          Una tablet o una PC en cada lugar muestra el QR, que cambia cada 5 segundos. Creá la pantalla y abrí el link de activación en ese equipo
          (vale 2 días y una sola vez). Dejala prendida en {origen}/pantalla.
        </p>
        <div className="lista-mi">
          {pantallas.map((p) => {
            const pendiente = p.codigo && p.codigo_vence && new Date(p.codigo_vence).getTime() > ahora;
            const link = `${origen}/pantalla/activar/${p.codigo}`;
            return (
              <div key={p.id} style={{ flexWrap: 'wrap' }}>
                <span>
                  {p.lugar}{p.nombre ? ` · ${p.nombre}` : ''}
                  <small>
                    {p.token_hash ? (p.visto && ahora - new Date(p.visto).getTime() < 3 * 60_000 ? 'Activada y mostrando el QR ahora' : `Activada${p.visto ? ` · vista por última vez ${cuando(p.visto)}` : ''}`) : 'Sin activar'}
                  </small>
                  {pendiente && <small>Link de activación: <a className="link" href={link}>{link}</a></small>}
                </span>
                <span className="acciones">
                  <BotonAccion accion={nuevoLinkPantalla} campos={{ id: p.id }} className="btn chico claro"
                    confirmar={p.token_hash ? 'Cuando se active el link nuevo en otro equipo, el actual deja de mostrar el QR. ¿Seguir?' : undefined}>
                    {pendiente ? 'Otro link' : 'Link de activación'}
                  </BotonAccion>
                  <BotonAccion accion={borrarPantalla} campos={{ id: p.id }} className="ico mal" confirmar="¿Borrar esta pantalla? Deja de mostrar el QR.">Borrar</BotonAccion>
                </span>
              </div>
            );
          })}
          {!pantallas.length && <p className="vacio" style={{ margin: 0 }}>Todavía no hay pantallas.</p>}
        </div>
        {lugares.some((l) => l.activo) && (
          <FormAccion accion={crearPantalla} boton="Crear pantalla" className="form" claseBoton="btn chico" limpiar>
            <label className="campo">
              <span>Lugar</span>
              <select name="lugar_id" required>{lugares.filter((l) => l.activo).map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}</select>
            </label>
            <label className="campo"><span>Nombre <em>(opcional)</em></span><input name="nombre" placeholder="Ej.: tablet de la entrada" /></label>
          </FormAccion>
        )}
      </div>

      <div className="grilla2">
        <div className="caja">
          <div className="caja-cab">
            <div>
              <h2>Feriados {anio}</h2>
              <p className="sub" style={{ margin: 0 }}>Las horas de un feriado se muestran aparte (se pagan doble) y ese día no cuenta como ausencia.</p>
            </div>
            <nav className="periodo" aria-label="Año">
              <Link href={`${base}?anio=${Number(anio) - 1}`} aria-label="Año anterior">‹</Link>
              <span className="act" style={{ minWidth: 60 }}>{anio}</span>
              <Link href={`${base}?anio=${Number(anio) + 1}`} aria-label="Año siguiente">›</Link>
            </nav>
          </div>
          <FormAccion accion={traerFeriados} boton={`Traer los feriados nacionales de ${anio}`} className="linea-form" claseBoton="btn chico claro">
            <input type="hidden" name="anio" value={anio} />
          </FormAccion>
          <div className="lista-mi" style={{ marginTop: 8 }}>
            {feriados.map((f) => (
              <div key={f.fecha}>
                <span>{DIAS_SEMANA[diaSemana(f.fecha)]} {fecha(f.fecha)}<small>{f.nombre}</small></span>
                <BotonAccion accion={borrarFeriado} campos={{ fecha: f.fecha }} className="ico mal" confirmar="¿Quitar este feriado?">Quitar</BotonAccion>
              </div>
            ))}
            {!feriados.length && <p className="vacio" style={{ margin: 0 }}>No hay feriados cargados en {anio}.</p>}
          </div>
          <FormAccion accion={agregarFeriado} boton="Agregar" className="form" claseBoton="btn chico" limpiar>
            <label className="campo"><span>Fecha</span><input type="date" name="fecha" required /></label>
            <label className="campo"><span>Nombre</span><input name="nombre" placeholder="Ej.: Santiago Apóstol (Mendoza)" /></label>
          </FormAccion>
        </div>

        <div className="caja">
          <h2>Reglas</h2>
          <p className="sub">Cómo se cuentan las horas. Al cambiarlas se recalcula todo.</p>
          <FormAccion accion={guardarReglas} boton="Guardar reglas">
            <label className="campo"><span>Tolerancia para llegar tarde (min)</span><input name="toleranciaMin" type="number" min={0} max={60} defaultValue={reglas.toleranciaMin} /></label>
            <label className="campo">
              <span>Redondeo de cada jornada</span>
              <select name="redondeoMin" defaultValue={String(reglas.redondeoMin)}>
                {[1, 5, 10, 15, 30].map((m) => <option key={m} value={m}>{m === 1 ? 'Sin redondeo' : `${m} minutos`}</option>)}
              </select>
            </label>
            <label className="campo">
              <span>Para marcar la salida después del horario (min)</span>
              <input name="margenSalidaMin" type="number" min={15} max={720} defaultValue={reglas.margenSalidaMin} />
              <span className="ayuda">Pasado ese tiempo, queda "sin salida" y la persona avisa a qué hora salió.</span>
            </label>
            <label className="campo"><span>Máximo de horas por jornada</span><input name="topeH" inputMode="decimal" defaultValue={String(reglas.topeH)} /></label>
          </FormAccion>
        </div>
      </div>

      {lugarParam && (lugarParam === 'nuevo' || editando) && (
        <Ventana titulo={editando ? `Editar ${editando.nombre}` : 'Lugar nuevo'} cerrar={cerrar}>
          <FormAccion accion={guardarLugar}>
            {editando && <input type="hidden" name="id" value={editando.id} />}
            <label className="campo ancho"><span>Nombre</span><input name="nombre" defaultValue={editando?.nombre} required placeholder="Ej.: Depósito" /></label>
            <label className="campo ancho"><span>Dirección <em>(opcional)</em></span><input name="direccion" defaultValue={editando?.direccion} /></label>
            <label className="campo">
              <span>Coordenadas <em>(opcional)</em></span>
              <input name="coordenadas" defaultValue={editando?.lat != null ? `${editando.lat}, ${editando.lng}` : ''} placeholder="-32.8895, -68.8458" />
              <span className="ayuda">En Google Maps, tocá el lugar y copiá los números. O después usá "Fijar la ubicación desde acá".</span>
            </label>
            <label className="campo"><span>Radio (metros)</span><input name="radio_m" type="number" min={20} max={2000} defaultValue={editando?.radio_m ?? 80} /></label>
            {editando && <label className="casilla ancho"><input type="checkbox" name="activo" defaultChecked={editando.activo} /> Activo (se puede fichar)</label>}
          </FormAccion>
        </Ventana>
      )}
    </>
  );
}
