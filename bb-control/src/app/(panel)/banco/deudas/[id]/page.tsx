import Link from 'next/link';
import { notFound } from 'next/navigation';
import { borrarCuota, borrarPasivo, editarPasivo, guardarCuota, pagarCuota } from '@/acciones/banco';
import { BotonAccion, FormAccion } from '@/components/FormAccion';
import { TabsBanco } from '@/components/TabsBanco';
import { Tile } from '@/components/Tile';
import { Titulo } from '@/components/Titulo';
import { Ventana } from '@/components/Ventana';
import { SISTEMAS, type Sistema, TIPOS_PASIVO } from '@/lib/cuotas';
import { db } from '@/lib/db';
import { aTexto, dolares, fecha, hoy, pesos, porcentaje } from '@/lib/formato';
import { type Params, param, url } from '@/lib/url';

export const metadata = { title: 'Préstamo · BB-CONTROL' };

type Cuota = { id: number; numero: number; vencimiento: string; capital: number; interes: number; iva: number; otros: number; total: number; pagada_el: string | null; egreso_id: number | null };

export default async function Deuda({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Params> }) {
  const { id: idTxt } = await params;
  const sp = await searchParams;
  const id = Number(idTxt);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const sql = db();
  const [[p], cuotas, rubros] = await Promise.all([
    sql`select p.*, r.nombre rubro from pasivos p left join rubros r on r.id = p.rubro_id where p.id = ${id}`,
    sql<Cuota[]>`select * from pasivo_cuotas where pasivo_id = ${id} order by numero`,
    sql<{ id: number; nombre: string }[]>`select id, nombre from rubros where tipo = 'gasto' and activo order by orden, nombre`,
  ]);
  if (!p) notFound();
  const usd = p.moneda === 'USD';
  const fmt = (n: number) => (usd ? dolares(n) : pesos(n));
  const h = hoy();
  const pendientes = cuotas.filter((c) => !c.pagada_el);
  const sum = (xs: Cuota[], k: keyof Cuota) => xs.reduce((a, c) => a + Number(c[k]), 0);
  const base = `/banco/deudas/${id}`;
  const cuotaParam = param(sp, 'cuota');
  const cuotaEdit = cuotaParam && cuotaParam !== 'nueva' ? cuotas.find((c) => c.id === Number(cuotaParam)) : null;
  const cerrar = url(base, sp, { cuota: null });

  return (
    <>
      <p style={{ margin: '0 0 8px' }}><Link className="link" href="/banco/deudas">← Préstamos y deudas</Link></p>
      <div className="cabeza">
        <Titulo modulo="banco" eti={TIPOS_PASIVO[p.tipo as string]} titulo={p.nombre as string}>
          {[p.acreedor, p.capital ? `Capital ${fmt(p.capital as number)}` : '', p.tasa != null ? `TNA ${porcentaje(p.tasa as number, 1)}` : '',
            SISTEMAS[p.sistema as Sistema]].filter(Boolean).join(' · ')}
        </Titulo>
        <div className="acciones">
          <Link className="btn claro" href={url(base, sp, { cuota: 'nueva' })} scroll={false}>+ Agregar cuota</Link>
        </div>
      </div>
      <TabsBanco actual="/banco/deudas" />

      <div className="tiles">
        <Tile titulo="Pendiente" valor={fmt(sum(pendientes, 'total'))} oscuro sub={`${pendientes.length} cuotas por pagar`} />
        <Tile titulo="Pagado" valor={fmt(sum(cuotas.filter((c) => c.pagada_el), 'total'))} sub={`${cuotas.length - pendientes.length} de ${cuotas.length} cuotas`} />
        <Tile titulo="Próxima cuota" valor={pendientes[0] ? fmt(pendientes[0].total) : '—'} sub={pendientes[0] ? `Vence el ${fecha(pendientes[0].vencimiento)}` : 'No quedan cuotas'} />
        <Tile titulo="Intereses, IVA y gastos" valor={fmt(sum(cuotas, 'interes') + sum(cuotas, 'iva') + sum(cuotas, 'otros'))} sub={p.rubro ? `Van a Gastos (${p.rubro}) al pagar cada cuota` : 'No se cargan en Gastos'} />
      </div>

      <div className="tabla-env">
        <table className="t">
          <thead>
            <tr>
              <th>N°</th><th>Vence</th><th className="der">Capital</th><th className="der">Interés</th><th className="der">IVA</th>
              <th className="der">Otros</th><th className="der">Cuota</th><th>Estado</th><th><span className="sr">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            {cuotas.map((c) => (
              <tr key={c.id}>
                <td className="num">{c.numero}</td>
                <td className="num">{fecha(c.vencimiento)}</td>
                <td className="der num">{fmt(c.capital)}</td>
                <td className="der num">{fmt(c.interes)}</td>
                <td className="der num">{c.iva ? fmt(c.iva) : '—'}</td>
                <td className="der num">{c.otros ? fmt(c.otros) : '—'}</td>
                <td className="der num principal">{fmt(c.total)}</td>
                <td>
                  {c.pagada_el ? <span className="chip bien">Pagada {fecha(c.pagada_el).slice(0, 5)}</span>
                    : <span className={`chip ${c.vencimiento < h ? 'mal' : 'alerta'}`}>{c.vencimiento < h ? 'Vencida' : 'A pagar'}</span>}
                </td>
                <td>
                  <div className="iconos">
                    {c.pagada_el ? (
                      <BotonAccion accion={pagarCuota} campos={{ id: c.id, pagada: 'no' }} confirmar={c.egreso_id ? '¿Volver a pendiente? Se borra el gasto de intereses que se había cargado.' : '¿Volver a pendiente?'}>Deshacer</BotonAccion>
                    ) : (
                      <>
                        <BotonAccion accion={pagarCuota} campos={{ id: c.id }} titulo={`Marcar pagada la cuota ${c.numero}`}>Pagar</BotonAccion>
                        <Link className="ico" href={url(base, sp, { cuota: c.id })} scroll={false}>Editar</Link>
                        <BotonAccion accion={borrarCuota} campos={{ id: c.id }} className="ico mal" confirmar={`¿Borrar la cuota ${c.numero}?`}>Borrar</BotonAccion>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!cuotas.length && <tr><td colSpan={9} className="vacio">No tiene cuotas. Agregalas con "+ Agregar cuota".</td></tr>}
          </tbody>
          {cuotas.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={2}>Total</td>
                <td className="der num">{fmt(sum(cuotas, 'capital'))}</td>
                <td className="der num">{fmt(sum(cuotas, 'interes'))}</td>
                <td className="der num">{fmt(sum(cuotas, 'iva'))}</td>
                <td className="der num">{fmt(sum(cuotas, 'otros'))}</td>
                <td className="der num">{fmt(sum(cuotas, 'total'))}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <details className="caja" style={{ marginTop: 18 }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Editar datos o borrar</summary>
        <div style={{ marginTop: 12 }}>
          <FormAccion accion={editarPasivo}>
            <input type="hidden" name="id" value={id} />
            <label className="campo">
              <span>Qué es</span>
              <select name="tipo" defaultValue={p.tipo as string}>
                {Object.entries(TIPOS_PASIVO).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
              </select>
            </label>
            <label className="campo"><span>Nombre</span><input name="nombre" defaultValue={p.nombre as string} required /></label>
            <label className="campo"><span>Acreedor</span><input name="acreedor" defaultValue={p.acreedor as string} /></label>
            <label className="campo">
              <span>Intereses y gastos van a</span>
              <select name="rubro_id" defaultValue={(p.rubro_id as number) ?? ''}>
                <option value="">No cargarlos en Gastos</option>
                {rubros.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
              </select>
            </label>
            <label className="campo ancho"><span>Notas</span><input name="notas" defaultValue={p.notas as string} /></label>
            <label className="casilla ancho"><input type="checkbox" name="activo" defaultChecked={p.activo as boolean} /> Activo (cuenta en la planificación)</label>
          </FormAccion>
          <div style={{ marginTop: 14 }}>
            <BotonAccion accion={borrarPasivo} campos={{ id }} className="btn claro chico" confirmar="Se borra con todas sus cuotas (los gastos de intereses ya cargados quedan). ¿Seguro?">
              Borrar préstamo
            </BotonAccion>
          </div>
        </div>
      </details>

      {cuotaParam && (cuotaEdit || cuotaParam === 'nueva') && (
        <Ventana titulo={cuotaEdit ? `Cuota ${cuotaEdit.numero}` : 'Agregar cuota'} cerrar={cerrar}>
          <FormAccion accion={guardarCuota} key={cuotaParam}>
            <input type="hidden" name="pasivo_id" value={id} />
            {cuotaEdit && <input type="hidden" name="id" value={cuotaEdit.id} />}
            <label className="campo"><span>Vence</span><input type="date" name="vencimiento" defaultValue={cuotaEdit?.vencimiento} required /></label>
            <label className="campo"><span>Capital</span><input name="capital" inputMode="decimal" defaultValue={aTexto(cuotaEdit?.capital)} /></label>
            <label className="campo"><span>Interés</span><input name="interes" inputMode="decimal" defaultValue={aTexto(cuotaEdit?.interes)} /></label>
            <label className="campo"><span>IVA</span><input name="iva" inputMode="decimal" defaultValue={aTexto(cuotaEdit?.iva)} /></label>
            <label className="campo"><span>Seguro y gastos</span><input name="otros" inputMode="decimal" defaultValue={aTexto(cuotaEdit?.otros)} /></label>
            <p className="sub ancho" style={{ margin: 0 }}>Copiá los montos del cronograma del banco. En {usd ? 'dólares' : 'pesos'}.</p>
          </FormAccion>
        </Ventana>
      )}
    </>
  );
}
