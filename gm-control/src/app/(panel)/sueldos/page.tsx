import Link from 'next/link';
import { Titulo } from '@/components/Titulo';
import { armarMes, borrarSueldo, guardarSueldo, pagarSueldo, pagarTodos } from '@/acciones/sueldos';
import { BotonAccion, FormAccion } from '@/components/FormAccion';
import { SelectorPeriodo } from '@/components/Periodo';
import { Delta, Tile } from '@/components/Tile';
import { Ventana } from '@/components/Ventana';
import { db } from '@/lib/db';
import { aTexto, fecha, hoy, nombreCompleto, periodo, pesos } from '@/lib/formato';
import { type Params, param, url } from '@/lib/url';

export const metadata = { title: 'Sueldos · GM-CONTROL' };

type Fila = {
  id: number; empleado_id: number; nombre: string; apellido: string; puesto: string; bruto: number; neto: number; extras: number;
  descuentos: number; pagado: boolean; fecha_pago: string | null; medio_pago: string; notas: string;
};

export default async function Sueldos({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const pp = param(sp, 'p');
  const p = periodo(/^\d{4}$/.test(pp) ? `${pp}-01` : pp);
  const ant = periodo(p.anterior);
  const mes = p.valor;
  const sql = db();
  const [filas, [antTot], [cargas], adelantos, sinSueldo] = await Promise.all([
    sql<Fila[]>`select s.*, e.nombre, e.apellido, e.puesto from sueldos s join empleados e on e.id = s.empleado_id
                where s.periodo = ${p.desde} order by e.nombre, e.apellido`,
    sql`select coalesce(sum(neto + extras), 0) costo from sueldos where periodo = ${ant.desde}`,
    sql`select coalesce(sum(e.neto_ars), 0) total from egresos e join rubros r on r.id = e.rubro_id
        where e.tipo = 'gasto' and r.clase = 'cargas' and e.fecha >= ${p.desde} and e.fecha < ${p.hasta}`,
    sql`select a.*, e.nombre, e.apellido from adelantos a join empleados e on e.id = a.empleado_id
        where a.estado = 'aprobado' and a.descontar_en = ${p.desde} order by a.fecha_pago`,
    sql<{ id: number; nombre: string; apellido: string }[]>`select id, nombre, apellido from empleados e where activo
        and not exists (select 1 from sueldos s where s.empleado_id = e.id and s.periodo = ${p.desde}) order by nombre`,
  ]);

  const t = filas.reduce(
    (a, f) => {
      const costo = f.neto + f.extras;
      const aPagar = costo - f.descuentos;
      a.bruto += f.bruto;
      a.neto += f.neto;
      a.extras += f.extras;
      a.desc += f.descuentos;
      a.costo += costo;
      a.aPagar += aPagar;
      if (f.pagado) a.pagado += aPagar;
      else a.pendientes++;
      return a;
    },
    { bruto: 0, neto: 0, extras: 0, desc: 0, costo: 0, aPagar: 0, pagado: 0, pendientes: 0 },
  );

  const base = '/sueldos';
  const cerrar = url(base, sp, { editar: null, nuevo: null });
  const editar = Number(param(sp, 'editar')) || 0;
  const enEdicion = editar ? filas.find((f) => f.id === editar) : null;
  const nuevo = param(sp, 'nuevo');

  return (
    <>
      <div className="cabeza">
        <Titulo modulo="sueldos" titulo="Sueldos">
          Lo que se le paga a cada persona del equipo en el mes. Las cargas sociales (F.931) van en Gastos.
        </Titulo>
        <div className="acciones">
          <SelectorPeriodo base={base} params={sp} p={p} soloMes />
          {filas.length > 0 && sinSueldo.length > 0 && (
            <Link className="btn claro" href={url(base, sp, { nuevo: 1 })} scroll={false}>+ Agregar persona</Link>
          )}
        </div>
      </div>

      <div className="tiles">
        <Tile titulo="Costo de sueldos" valor={pesos(t.costo, 0)} oscuro sub="Neto + extras (va al KPI)">
          <Delta actual={t.costo} anterior={antTot.costo} subeEsBueno={false} />
        </Tile>
        <Tile titulo="A pagar" valor={pesos(t.aPagar, 0)} sub={t.desc ? `Descontando ${pesos(t.desc, 0)} de adelantos` : 'Sin adelantos que descontar'} />
        <Tile titulo="Ya pagado" valor={pesos(t.pagado, 0)} sub={t.pendientes ? `Faltan ${t.pendientes}` : filas.length ? 'Todos pagados' : ''} />
        <Tile titulo="Cargas sociales (F.931)" valor={pesos(cargas.total, 0)} sub={`Costo laboral total ${pesos(t.costo + Number(cargas.total), 0)}`} />
      </div>

      {filas.length === 0 ? (
        <div className="caja" style={{ textAlign: 'center', padding: 36 }}>
          <h2>Todavía no armaste los sueldos de {p.etiqueta.toLowerCase()}</h2>
          <p className="sub" style={{ margin: '6px auto 16px', maxWidth: 520 }}>
            Se crea una línea por cada persona activa con su sueldo de referencia (lo cargás en su ficha de Equipo) y se descuentan los adelantos aprobados para este mes. Después podés ajustar cada uno.
          </p>
          <form action={armarMes}>
            <input type="hidden" name="mes" value={mes} />
            <button className="btn vino">Armar sueldos de {p.etiqueta.toLowerCase()}</button>
          </form>
        </div>
      ) : (
        <>
          <div className="tabla-env">
            <table className="t">
              <thead>
                <tr>
                  <th>Persona</th>
                  <th className="der">Bruto</th>
                  <th className="der">Neto</th>
                  <th className="der">Extras</th>
                  <th className="der">Adelantos</th>
                  <th className="der">A pagar</th>
                  <th>Estado</th>
                  <th><span className="sr">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={f.id}>
                    <td>
                      <Link href={`/equipo/${f.empleado_id}?tab=sueldos`} className="principal" style={{ textDecoration: 'none' }}>{nombreCompleto(f)}</Link>
                      <div className="chico">{f.puesto}{f.notas ? ` · ${f.notas}` : ''}</div>
                    </td>
                    <td className="der num chico">{f.bruto ? pesos(f.bruto, 0) : '—'}</td>
                    <td className="der num">{pesos(f.neto, 0)}</td>
                    <td className="der num">{f.extras ? pesos(f.extras, 0) : '—'}</td>
                    <td className="der num">{f.descuentos ? `−${pesos(f.descuentos, 0)}` : '—'}</td>
                    <td className="der num principal">{pesos(f.neto + f.extras - f.descuentos, 0)}</td>
                    <td>
                      {f.pagado ? <span className="chip bien">Pagado {f.fecha_pago ? fecha(f.fecha_pago).slice(0, 5) : ''}</span> : <span className="chip alerta">Sin pagar</span>}
                    </td>
                    <td>
                      <div className="iconos">
                        {!f.pagado && <BotonAccion accion={pagarSueldo} campos={{ id: f.id }} titulo="Marcar como pagado hoy">Pagar</BotonAccion>}
                        <Link className="ico" href={url(base, sp, { editar: f.id })} scroll={false}>Editar</Link>
                        <BotonAccion accion={borrarSueldo} campos={{ id: f.id }} className="ico mal" confirmar="¿Sacar a esta persona de los sueldos del mes?">Quitar</BotonAccion>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td className="der num">{pesos(t.bruto, 0)}</td>
                  <td className="der num">{pesos(t.neto, 0)}</td>
                  <td className="der num">{pesos(t.extras, 0)}</td>
                  <td className="der num">{t.desc ? `−${pesos(t.desc, 0)}` : '—'}</td>
                  <td className="der num">{pesos(t.aPagar, 0)}</td>
                  <td colSpan={2}>
                    {t.pendientes > 0 && (
                      <BotonAccion accion={pagarTodos} campos={{ mes }} className="btn chico" confirmar={`¿Marcar los ${t.pendientes} sueldos pendientes como pagados hoy?`}>
                        Pagar todos
                      </BotonAccion>
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          {sinSueldo.length > 0 && (
            <div className="aviso" style={{ marginTop: 12 }}>
              {sinSueldo.length === 1 ? 'Falta' : 'Faltan'} {sinSueldo.map((e) => nombreCompleto(e)).join(', ')}.{' '}
              <form action={armarMes} style={{ display: 'inline' }}>
                <input type="hidden" name="mes" value={mes} />
                <button className="link">Agregar con su sueldo de referencia</button>
              </form>
            </div>
          )}
        </>
      )}

      {adelantos.length > 0 && (
        <div className="caja" style={{ marginTop: 18 }}>
          <h2>Adelantos que se descuentan este mes</h2>
          <div className="lista-mi" style={{ marginTop: 8 }}>
            {adelantos.map((a) => (
              <div key={a.id as number}>
                <span>{nombreCompleto(a as { nombre: string; apellido: string })}<small>{a.motivo as string} · pagado el {fecha(a.fecha_pago as string)}</small></span>
                <b className="num">{pesos(a.monto as number, 0)}</b>
              </div>
            ))}
          </div>
        </div>
      )}

      {(enEdicion || nuevo) && (
        <Ventana titulo={enEdicion ? `Sueldo de ${nombreCompleto(enEdicion)}` : 'Agregar sueldo'} cerrar={cerrar}>
          <p className="sub" style={{ marginTop: -8 }}>{p.etiqueta}</p>
          <FormAccion accion={guardarSueldo}>
            <input type="hidden" name="volver" value={cerrar} />
            <input type="hidden" name="mes" value={mes} />
            {enEdicion ? (
              <input type="hidden" name="empleado_id" value={enEdicion.empleado_id} />
            ) : (
              <label className="campo ancho">
                <span>Persona</span>
                <select name="empleado_id" required defaultValue="">
                  <option value="" disabled>Elegí…</option>
                  {sinSueldo.map((e) => <option key={e.id} value={e.id}>{nombreCompleto(e)}</option>)}
                </select>
              </label>
            )}
            <label className="campo">
              <span>Bruto <em>(del recibo)</em></span>
              <input name="bruto" inputMode="decimal" defaultValue={aTexto(enEdicion?.bruto)} />
            </label>
            <label className="campo">
              <span>Neto <em>(lo que cobra)</em></span>
              <input name="neto" inputMode="decimal" defaultValue={aTexto(enEdicion?.neto)} required />
            </label>
            <label className="campo">
              <span>Extras <em>(horas, bonos, premios)</em></span>
              <input name="extras" inputMode="decimal" defaultValue={aTexto(enEdicion?.extras)} />
            </label>
            <label className="campo">
              <span>Adelantos y descuentos</span>
              <input name="descuentos" inputMode="decimal" defaultValue={aTexto(enEdicion?.descuentos)} />
            </label>
            <label className="casilla ancho">
              <input type="checkbox" name="pagado" defaultChecked={enEdicion?.pagado} /> Ya está pagado
            </label>
            <label className="campo">
              <span>Fecha de pago</span>
              <input type="date" name="fecha_pago" defaultValue={enEdicion?.fecha_pago ?? hoy()} />
            </label>
            <label className="campo">
              <span>Medio de pago</span>
              <input name="medio_pago" list="medios" defaultValue={enEdicion?.medio_pago || 'Transferencia'} />
              <datalist id="medios">{['Transferencia', 'Efectivo', 'Recibo bancario'].map((m) => <option key={m} value={m} />)}</datalist>
            </label>
            <label className="campo ancho">
              <span>Notas</span>
              <input name="notas" defaultValue={enEdicion?.notas} />
            </label>
          </FormAccion>
        </Ventana>
      )}
    </>
  );
}
