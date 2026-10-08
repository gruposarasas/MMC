import Link from 'next/link';
import { borrarObligacion, guardarObligacion, marcarObligacionPagada, quitarArchivoContable } from '@/acciones/contabilidad';
import { SubirArchivo } from '@/components/Contabilidad';
import { BotonAccion, FormAccion } from '@/components/FormAccion';
import { SelectorPeriodo } from '@/components/Periodo';
import { TabsContabilidad } from '@/components/TabsContabilidad';
import { Tile } from '@/components/Tile';
import { Titulo } from '@/components/Titulo';
import { estadoObligacion, exigirContabilidad, mesALiquidar, type Obligacion, TIPOS, type TipoObligacion } from '@/lib/contabilidad';
import { db } from '@/lib/db';
import { aTexto, fecha, hoy, nombreMes, numero, periodo, pesos, sumarMeses } from '@/lib/formato';
import { formatoCuit } from '@/lib/proveedores';
import { type Params, param } from '@/lib/url';

export const metadata = { title: 'Contabilidad · GM-CONTROL' };

const ESTADOS = {
  sin_cargar: ['Sin cargar', ''],
  pendiente: ['A pagar', 'alerta'],
  vencida: ['Vencida', 'mal'],
  pagada: ['Pagada', 'bien'],
} as const;

type Razon = { id: number; nombre: string; cuit: string; activo: boolean };
type Archivo = { id: number; obligacion_id: number; archivo_id: string; nombre: string; tamano: number; subido_por: string; creado: string };
type Historia = { id: number; obligacion_id: number; quien: string; que: string; creado: string };

const kb = (n: number) => (n > 1024 * 1024 ? `${numero(n / 1024 / 1024, 1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const cuando = (ts: string) =>
  new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Mendoza', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(ts));

export default async function Contabilidad({ searchParams }: { searchParams: Promise<Params> }) {
  const q = await exigirContabilidad();
  const admin = q.rol === 'admin';
  const sp = await searchParams;
  const inicio = mesALiquidar();
  const mes = /^\d{4}-(0[1-9]|1[0-2])$/.test(param(sp, 'p')) ? param(sp, 'p') : inicio;
  const p = periodo(mes);
  const dia = `${mes}-01`;
  const sql = db();
  const [razones, obligaciones, [ant], archivos, historial] = await Promise.all([
    sql<Razon[]>`select id, nombre, cuit, activo from razones_sociales
                 where activo or id in (select razon_id from contab_obligaciones where mes = ${dia}) order by orden, id`,
    sql<Obligacion[]>`select * from contab_obligaciones where mes = ${dia}`,
    sql`select coalesce(sum(monto), 0) total, count(monto)::int n from contab_obligaciones where mes = ${`${sumarMeses(mes, -1)}-01`}`,
    sql<Archivo[]>`
      select ca.id, ca.obligacion_id, ca.subido_por, ca.creado, a.id archivo_id, a.nombre, a.tamano
      from contab_archivos ca join archivos a on a.id = ca.archivo_id join contab_obligaciones o on o.id = ca.obligacion_id
      where o.mes = ${dia} order by ca.creado`,
    sql<Historia[]>`
      select h.* from contab_historial h join contab_obligaciones o on o.id = h.obligacion_id
      where o.mes = ${dia} order by h.creado desc, h.id desc`,
  ]);

  const cargadas = obligaciones.filter((o) => o.monto != null);
  const total = cargadas.reduce((a, o) => a + Number(o.monto), 0);
  const pagado = cargadas.filter((o) => o.pagado_el).reduce((a, o) => a + Number(o.monto), 0);
  const aPagar = cargadas.filter((o) => !o.pagado_el);
  const proximo = aPagar.map((o) => o.vencimiento).filter(Boolean).sort()[0];
  const faltan = razones.filter((r) => r.activo).length * Object.keys(TIPOS).length - cargadas.length;
  const h = hoy();

  return (
    <>
      <div className="cabeza">
        <Titulo modulo="contabilidad" titulo="Contabilidad">
          {admin
            ? 'El contador carga cada mes el F.931, el IVA y los Ingresos Brutos, con sus archivos. Vos los marcás pagados. El F.931 y los Ingresos Brutos pasan solos a Gastos.'
            : `Cargá el monto, el vencimiento y los archivos de cada obligación. Grupo Modesto la marca pagada cuando la paga.`}
        </Titulo>
        <div className="acciones">
          <SelectorPeriodo base="/contabilidad" params={sp} p={p} soloMes inicio={{ valor: inicio, texto: 'Mes a liquidar' }} />
        </div>
      </div>

      <TabsContabilidad actual="/contabilidad" admin={admin} mes={mes === inicio ? undefined : mes} />

      <div className="tiles">
        <Tile titulo={`Total ${nombreMes(mes)}`} valor={pesos(total, 0)} oscuro sub={`Mes anterior: ${ant.n ? pesos(ant.total, 0) : 'sin cargar'}`} />
        <Tile titulo="A pagar" valor={pesos(total - pagado, 0)} sub={aPagar.length ? `${aPagar.length} sin pagar${proximo ? ` · vence ${fecha(proximo)}` : ''}` : cargadas.length ? 'Todo pagado' : '—'} />
        <Tile titulo="Pagado" valor={pesos(pagado, 0)} />
        <Tile titulo="Falta cargar" valor={numero(Math.max(faltan, 0))} sub={faltan > 0 ? 'obligaciones de este mes' : 'Está todo cargado'} />
      </div>

      {razones.map((r) => (
        <div className="caja" key={r.id} data-razon={r.nombre}>
          <h2>{r.nombre}</h2>
          <p className="sub">{r.cuit ? `CUIT ${formatoCuit(r.cuit)} · ` : ''}Período {nombreMes(mes)}</p>
          <div className="obligaciones">
            {(Object.keys(TIPOS) as TipoObligacion[]).map((t) => {
              const o = obligaciones.find((x) => x.razon_id === r.id && x.tipo === t);
              const est = estadoObligacion(o, h);
              const pagada = est === 'pagada';
              const arch = o ? archivos.filter((a) => a.obligacion_id === o.id) : [];
              const hist = o ? historial.filter((x) => x.obligacion_id === o.id) : [];
              const form = (
                <FormAccion accion={guardarObligacion} boton={o?.monto != null ? 'Guardar cambios' : 'Guardar'} claseBoton="btn chico">
                  <input type="hidden" name="mes" value={mes} />
                  <input type="hidden" name="razon_id" value={r.id} />
                  <input type="hidden" name="tipo" value={t} />
                  <label className="campo">
                    <span>Monto a pagar</span>
                    <input name="monto" inputMode="decimal" required placeholder="Ej.: 1.250.000,50" defaultValue={o?.monto == null ? '' : aTexto(o.monto) || '0'} />
                  </label>
                  <label className="campo">
                    <span>Vencimiento</span>
                    <input name="vencimiento" type="date" defaultValue={o?.vencimiento ?? ''} />
                  </label>
                  <label className="campo ancho">
                    <span>Nota <em>(opcional)</em></span>
                    <input name="nota" maxLength={500} defaultValue={o?.nota} placeholder={t === 'iva' ? 'Ej.: saldo a favor del mes anterior' : ''} />
                  </label>
                </FormAccion>
              );
              return (
                <div className={`obligacion ${est}`} key={`${t}-${o ? new Date(o.actualizado).getTime() : ''}-${o?.pagado_el ?? ''}`} data-tipo={t}>
                  <div className="ob-cab">
                    <b>{TIPOS[t].nombre}</b>
                    <span className={`chip ${ESTADOS[est][1]}`}>{ESTADOS[est][0]}</span>
                  </div>
                  {o?.monto != null ? (
                    <div>
                      <div className="ob-monto num">{pesos(o.monto)}</div>
                      <div className="chico">
                        {o.vencimiento ? `Vence el ${fecha(o.vencimiento)}` : 'Sin vencimiento'}
                        {o.cargado_por && ` · cargó ${o.cargado_por}`}
                      </div>
                    </div>
                  ) : (
                    <div className="chico">Todavía no se cargó el monto.</div>
                  )}
                  {o?.nota && <div className="chico">{o.nota}</div>}
                  {pagada && <div className="chico" style={{ color: 'var(--bien)', fontWeight: 600 }}>Pagada el {fecha(o!.pagado_el)}</div>}
                  {admin && o?.egreso_id && (
                    <div className="chico">
                      Está en los gastos de {nombreMes(mes)}{pagada ? '' : ', a pagar'}. <Link className="link" href={`/gastos?p=${mes}`}>Ver</Link>
                    </div>
                  )}

                  {arch.length > 0 && (
                    <ul className="ob-archivos">
                      {arch.map((a) => (
                        <li key={a.id}>
                          <a className="link" href={`/api/archivos/${a.archivo_id}`} target="_blank" rel="noopener">{a.nombre}</a>
                          <span className="chico">{kb(a.tamano)} · {a.subido_por}</span>
                          {!pagada && (
                            <BotonAccion accion={quitarArchivoContable} campos={{ id: a.id }} confirmar={`¿Quitar ${a.nombre}?`} className="ico mal" titulo={`Quitar ${a.nombre}`}>
                              Quitar
                            </BotonAccion>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}

                  {!pagada &&
                    (o?.monto != null ? (
                      <details className="ob-editar">
                        <summary>Cambiar monto o vencimiento</summary>
                        {form}
                      </details>
                    ) : (
                      form
                    ))}

                  <div className="ob-acciones">
                    {!pagada && <SubirArchivo mes={mes} razon={r.id} tipo={t} titulo={`${TIPOS[t].nombre} ${r.nombre}`} />}
                    {admin && o?.monto != null && !pagada && (
                      <BotonAccion accion={marcarObligacionPagada} campos={{ id: o.id }} className="btn vino chico" confirmar={`¿Marcar pagado ${TIPOS[t].corto} por ${pesos(o.monto)}?`}>
                        Marcar pagada
                      </BotonAccion>
                    )}
                    {admin && pagada && (
                      <BotonAccion accion={marcarObligacionPagada} campos={{ id: o!.id, pagada: 'no' }} className="ico" confirmar="¿Volver a pendiente?">
                        Deshacer el pago
                      </BotonAccion>
                    )}
                    {o && !pagada && (
                      <BotonAccion accion={borrarObligacion} campos={{ id: o.id }} className="ico mal" confirmar="Se borra lo cargado de esta obligación, con sus archivos. ¿Seguro?">
                        Borrar
                      </BotonAccion>
                    )}
                  </div>

                  {hist.length > 0 && (
                    <details className="ob-historial">
                      <summary>Historial ({hist.length})</summary>
                      <ul>
                        {hist.map((x) => (
                          <li key={x.id}><span className="num">{cuando(x.creado)}</span> · <b>{x.quien}</b>: {x.que}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <p className="mas">
        Lo pagado no se puede cambiar{admin ? ' (primero hay que deshacer el pago)' : ''}. Cada carga, archivo y pago queda en el historial.
      </p>
    </>
  );
}
