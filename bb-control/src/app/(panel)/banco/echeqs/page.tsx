import Link from 'next/link';
import { borrarEcheq, estadoEcheq } from '@/acciones/banco';
import { FormEcheq, type EcheqForm, type FacturaPendiente } from '@/components/Banco';
import type { OpcionProveedor } from '@/components/ElegirProveedor';
import { BotonAccion } from '@/components/FormAccion';
import { Importador } from '@/components/Importador';
import { TabsBanco } from '@/components/TabsBanco';
import { Tile } from '@/components/Tile';
import { Titulo } from '@/components/Titulo';
import { Ventana } from '@/components/Ventana';
import { db } from '@/lib/db';
import { dolares, fecha, hoy, numero, pesos, sumarMeses } from '@/lib/formato';
import { type Params, param, url } from '@/lib/url';

export const metadata = { title: 'Echeqs · BB-CONTROL' };

type Fila = EcheqForm & { estado: 'pendiente' | 'pagado' | 'anulado' | 'rechazado'; cerrado_el: string | null; quien: string; cuenta: string | null; facturas: number };

export default async function Echeqs({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const sentido = param(sp, 'ver') === 'recibidos' ? 'recibido' : 'emitido';
  const todos = param(sp, 'estado') === 'todos';
  const q = param(sp, 'q');
  const h = hoy();
  const sql = db();
  const [lista, [tot], cuentas] = await Promise.all([
    sql<Fila[]>`
      select e.*, coalesce(p.nombre, nullif(e.tercero, ''), 'Sin nombre') quien, c.nombre cuenta,
        (select count(*) from echeq_egresos x where x.echeq_id = e.id)::int facturas
      from echeqs e left join proveedores p on p.id = e.proveedor_id left join cuentas_banco c on c.id = e.cuenta_id
      where e.sentido = ${sentido} ${todos ? sql`` : sql`and e.estado = 'pendiente'`}
        ${q ? sql`and (coalesce(p.nombre, e.tercero) ilike ${'%' + q + '%'} or e.numero ilike ${'%' + q + '%'})` : sql``}
      order by ${todos ? sql`e.pago desc` : sql`e.pago`}, e.id limit 500`,
    sql`select
          coalesce(sum(monto) filter (where sentido = 'emitido' and estado = 'pendiente' and moneda = 'ARS'), 0) emitidos,
          count(*) filter (where sentido = 'emitido' and estado = 'pendiente')::int n_emitidos,
          min(pago) filter (where sentido = 'emitido' and estado = 'pendiente' and pago >= ${h}) proximo,
          coalesce(sum(monto) filter (where sentido = 'emitido' and estado = 'pendiente' and pago < ${`${sumarMeses(h.slice(0, 7), 1)}-01`} and moneda = 'ARS'), 0) este_mes,
          coalesce(sum(monto) filter (where sentido = 'recibido' and estado = 'pendiente' and moneda = 'ARS'), 0) recibidos,
          count(*) filter (where sentido = 'recibido' and estado = 'pendiente')::int n_recibidos,
          count(*) filter (where estado = 'pendiente' and pago < ${h})::int sin_marcar
        from echeqs`,
    sql<{ id: number; nombre: string }[]>`select id, nombre from cuentas_banco where activo order by orden, id`,
  ]);

  const cerrar = url('/banco/echeqs', sp, { nuevo: null, editar: null, importar: null });
  const idEdit = Number(param(sp, 'editar')) || 0;
  const editando = idEdit ? ((await sql<Fila[]>`select * from echeqs where id = ${idEdit}`)[0] ?? null) : null;
  const abierto = param(sp, 'nuevo') || editando;
  const [proveedores, facturas, vinculadas] = abierto
    ? await Promise.all([
        sql<OpcionProveedor[]>`select id, nombre, cuit, rubro_id, alias from proveedores where activo or id = ${editando?.proveedor_id ?? 0} order by lower(nombre)`,
        // Facturas sin pagar (y las que ya paga este echeq).
        sql<FacturaPendiente[]>`
          select e.id, e.proveedor_id, e.fecha, trim(concat_ws(' ', nullif(e.comprobante, ''), nullif(e.numero, ''), '· ' || nullif(e.descripcion, ''))) detalle,
                 e.total_ars total, e.vencimiento
          from egresos e where e.proveedor_id is not null
            and (not e.pagado or e.id in (select egreso_id from echeq_egresos where echeq_id = ${idEdit}))
          order by e.fecha limit 1000`,
        sql`select egreso_id from echeq_egresos where echeq_id = ${idEdit}`,
      ])
    : [[], [], []];
  const verbo = sentido === 'emitido' ? 'Debitado' : 'Cobrado';

  return (
    <>
      <div className="cabeza">
        <Titulo modulo="banco" titulo="Echeqs">
          Los emitidos (que vamos a pagar) y los recibidos (que vamos a cobrar), con su fecha de pago. Cargalos a mano o importá el listado del home banking.
        </Titulo>
        <div className="acciones">
          <Link className="btn claro" href={url('/banco/echeqs', sp, { importar: 1, nuevo: null, editar: null })} scroll={false}>Importar Excel</Link>
          <Link className="btn vino" href={url('/banco/echeqs', sp, { nuevo: 1, editar: null, importar: null })} scroll={false}>+ Nuevo echeq</Link>
        </div>
      </div>
      <TabsBanco actual="/banco/echeqs" />

      <div className="tiles">
        <Tile titulo="Emitidos por pagar" valor={pesos(tot.emitidos, 0)} oscuro sub={`${numero(tot.n_emitidos)} echeqs${tot.proximo ? ` · el próximo vence ${fecha(tot.proximo)}` : ''}`} />
        <Tile titulo="Vencen este mes" valor={pesos(tot.este_mes, 0)} sub="Emitidos con fecha de pago de este mes" />
        <Tile titulo="Recibidos por cobrar" valor={pesos(tot.recibidos, 0)} sub={`${numero(tot.n_recibidos)} echeqs`} />
      </div>
      {tot.sin_marcar > 0 && (
        <div className="aviso">
          Hay {tot.sin_marcar} {tot.sin_marcar === 1 ? 'echeq' : 'echeqs'} con fecha pasada que siguen pendientes. Si ya se debitaron o cobraron, marcalos para que no cuenten como deuda.
        </div>
      )}

      <div className="filtros">
        <form className="filtros" style={{ margin: 0 }} action="/banco/echeqs">
          {sentido === 'recibido' && <input type="hidden" name="ver" value="recibidos" />}
          {todos && <input type="hidden" name="estado" value="todos" />}
          <input type="search" name="q" defaultValue={q} placeholder="Buscar nombre o número" aria-label="Buscar echeq" />
        </form>
        <div className="pildoras">
          <Link className={sentido === 'emitido' ? 'on' : ''} href={url('/banco/echeqs', sp, { ver: null })}>Emitidos</Link>
          <Link className={sentido === 'recibido' ? 'on' : ''} href={url('/banco/echeqs', sp, { ver: 'recibidos' })}>Recibidos</Link>
        </div>
        <div className="pildoras">
          <Link className={!todos ? 'on' : ''} href={url('/banco/echeqs', sp, { estado: null })}>Pendientes</Link>
          <Link className={todos ? 'on' : ''} href={url('/banco/echeqs', sp, { estado: 'todos' })}>Todos</Link>
        </div>
      </div>

      <div className="tabla-env">
        <table className="t">
          <thead>
            <tr>
              <th>{sentido === 'emitido' ? 'Pago' : 'Cobro'}</th>
              <th>{sentido === 'emitido' ? 'A la orden de' : 'Librador'}</th>
              <th>Número</th>
              <th className="der">Monto</th>
              <th>Estado</th>
              <th><span className="sr">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            {lista.map((e) => (
              <tr key={e.id}>
                <td className="num">{fecha(e.pago)}</td>
                <td className="corta">
                  <span className="principal">{e.quien}</span>
                  <div className="chico">
                    {[e.cuenta ?? e.banco, e.facturas ? `paga ${e.facturas} ${e.facturas === 1 ? 'factura' : 'facturas'}` : '', e.notas].filter(Boolean).join(' · ')}
                  </div>
                </td>
                <td className="num chico">{e.numero || '—'}</td>
                <td className="der num principal">{e.moneda === 'USD' ? dolares(e.monto) : pesos(e.monto)}</td>
                <td>
                  {e.estado === 'pendiente' ? (
                    <span className={`chip ${e.pago < h ? 'mal' : 'alerta'}`}>{e.pago < h ? 'Fecha pasada' : 'Pendiente'}</span>
                  ) : e.estado === 'pagado' ? (
                    <span className="chip bien">{verbo}{e.cerrado_el ? ` ${fecha(e.cerrado_el).slice(0, 5)}` : ''}</span>
                  ) : (
                    <span className="chip">{e.estado === 'anulado' ? 'Anulado' : 'Rechazado'}</span>
                  )}
                </td>
                <td>
                  <div className="iconos">
                    {e.estado === 'pendiente' ? (
                      <>
                        <BotonAccion accion={estadoEcheq} campos={{ id: e.id, estado: 'pagado' }} titulo={`Marcar ${verbo.toLowerCase()}`}>{verbo}</BotonAccion>
                        <BotonAccion accion={estadoEcheq} campos={{ id: e.id, estado: sentido === 'emitido' ? 'anulado' : 'rechazado' }} className="ico mal"
                          confirmar={sentido === 'emitido' ? '¿Anular el echeq? Las facturas que pagaba vuelven a quedar pendientes.' : '¿Marcarlo rechazado?'}>
                          {sentido === 'emitido' ? 'Anular' : 'Rechazado'}
                        </BotonAccion>
                      </>
                    ) : (
                      <BotonAccion accion={estadoEcheq} campos={{ id: e.id, estado: 'pendiente' }} confirmar="¿Volver a pendiente?">Deshacer</BotonAccion>
                    )}
                    <Link className="ico" href={url('/banco/echeqs', sp, { editar: e.id, nuevo: null })} scroll={false}>Editar</Link>
                    <BotonAccion accion={borrarEcheq} campos={{ id: e.id }} className="ico mal" confirmar="¿Borrar este echeq? Las facturas que pagaba vuelven a quedar pendientes.">Borrar</BotonAccion>
                  </div>
                </td>
              </tr>
            ))}
            {!lista.length && (
              <tr><td colSpan={6} className="vacio">{todos ? 'No hay echeqs cargados.' : `No hay echeqs ${sentido === 'emitido' ? 'emitidos' : 'recibidos'} pendientes.`}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {param(sp, 'importar') && (
        <Ventana titulo="Importar echeqs desde Excel" cerrar={cerrar} ancha>
          <Importador tipo="echeq" destino="/banco/echeqs" cuentas={cuentas} />
        </Ventana>
      )}
      {abierto && (
        <Ventana titulo={editando ? 'Editar echeq' : 'Nuevo echeq'} cerrar={cerrar} ancha>
          <FormEcheq
            key={editando?.id ?? 'nuevo'}
            e={editando}
            cuentas={cuentas}
            proveedores={proveedores}
            facturas={facturas}
            vinculadas={vinculadas.map((v) => v.egreso_id as number)}
            volver={cerrar}
            sentidoInicial={sentido}
          />
        </Ventana>
      )}
    </>
  );
}
