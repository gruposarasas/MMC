import Link from 'next/link';
import { Titulo } from '@/components/Titulo';
import { borrarEgreso, guardarEgreso, marcarPagado } from '@/acciones/egresos';
import { ImportesEgreso, type ItemForm } from '@/components/Factura';
import { Importador } from '@/components/Importador';
import { deshacerImportacionEgresos } from '@/acciones/importar';
import { BotonAccion, FormAccion } from '@/components/FormAccion';
import { SelectorPeriodo } from '@/components/Periodo';
import { Delta, Tile } from '@/components/Tile';
import { Ventana } from '@/components/Ventana';
import { CampoPago } from '@/components/CampoPago';
import { leerDolar } from '@/lib/ajustes';
import { db } from '@/lib/db';
import { dolares, fecha, fechaCorta, hoy, numero, periodo, pesos, porcentaje } from '@/lib/formato';
import { sugerenciasItems } from '@/lib/items';
import { type Params, param, url } from '@/lib/url';

type Egreso = {
  id: number; fecha: string; rubro_id: number; rubro: string; proveedor: string; comprobante: string; numero: string; descripcion: string;
  cantidad: number | null; unidad: string; moneda: 'ARS' | 'USD'; cotizacion: number; neto: number; iva_alicuota: number; iva: number; otros: number;
  total: number; neto_ars: number; iva_ars: number; total_ars: number; pagado: boolean; fecha_pago: string | null; vencimiento: string | null; medio_pago: string; notas: string;
};

const TEXTOS = {
  compra: {
    titulo: 'Compras',
    bajada: 'Todo lo que es mercadería: café verde, importación, tostado, packaging e insumos para vender.',
    nuevo: '+ Nueva compra',
    singular: 'compra',
    vacio: 'No hay compras cargadas',
  },
  gasto: {
    titulo: 'Gastos',
    bajada: 'Todo lo que no es mercadería: alquiler, servicios, impuestos, cargas sociales (F.931), inversiones y demás.',
    nuevo: '+ Nuevo gasto',
    singular: 'gasto',
    vacio: 'No hay gastos cargados',
  },
};

const COMPROBANTES = ['Factura A', 'Factura B', 'Factura C', 'Ticket', 'Recibo', 'Despacho de importación', 'F.931', 'Boleta de impuestos', 'Sin comprobante'];
const MEDIOS = ['Transferencia', 'Efectivo', 'Cheque / Echeq', 'Tarjeta', 'Débito automático', 'Mercado Pago'];

export async function ModuloEgresos({ tipo, sp }: { tipo: 'compra' | 'gasto'; sp: Params }) {
  const T = TEXTOS[tipo];
  const base = tipo === 'compra' ? '/compras' : '/gastos';
  const p = periodo(param(sp, 'p'));
  const ant = periodo(p.anterior);
  const q = param(sp, 'q');
  const rubro = Number(param(sp, 'rubro')) || 0;
  const estado = param(sp, 'estado'); // 'pendiente'
  const sql = db();

  const filtro = sql`
    e.tipo = ${tipo} and e.fecha >= ${p.desde} and e.fecha < ${p.hasta}
    ${rubro ? sql`and e.rubro_id = ${rubro}` : sql``}
    ${estado === 'pendiente' ? sql`and not e.pagado` : sql``}
    ${q ? sql`and (e.proveedor ilike ${'%' + q + '%'} or e.descripcion ilike ${'%' + q + '%'} or e.numero ilike ${'%' + q + '%'})` : sql``}`;

  const [lista, [tot], [totAnt], porRubro, [pend], rubros, proveedores, dolar, porProducto, importaciones] = await Promise.all([
    sql<Egreso[]>`select e.*, r.nombre rubro from egresos e join rubros r on r.id = e.rubro_id
                  where ${filtro} order by e.fecha desc, e.id desc limit 400`,
    sql`select count(*) n, coalesce(sum(neto_ars),0) neto, coalesce(sum(iva_ars),0) iva, coalesce(sum(total_ars),0) total from egresos e where ${filtro}`,
    sql`select coalesce(sum(total_ars),0) total from egresos where tipo = ${tipo} and fecha >= ${ant.desde} and fecha < ${ant.hasta}`,
    sql`select r.id, r.nombre, count(*) n, sum(e.total_ars) total from egresos e join rubros r on r.id = e.rubro_id
        where e.tipo = ${tipo} and e.fecha >= ${p.desde} and e.fecha < ${p.hasta} group by 1, 2 order by 4 desc`,
    sql`select count(*) n, coalesce(sum(total_ars),0) total, min(vencimiento) proximo from egresos where tipo = ${tipo} and not pagado`,
    sql<{ id: number; nombre: string; activo: boolean }[]>`select id, nombre, activo from rubros where tipo = ${tipo} order by orden, nombre`,
    sql`select proveedor from egresos where tipo = ${tipo} and proveedor <> '' group by 1 order by max(fecha) desc limit 300`,
    leerDolar(),
    sql<{ producto: string; unidad: string; cantidad: number; neto: number; facturas: number }[]>`
      select min(i.descripcion) producto, i.unidad, sum(i.cantidad) cantidad, sum(round(i.neto * e.cotizacion, 2)) neto, count(distinct e.id)::int facturas
      from egreso_items i join egresos e on e.id = i.egreso_id
      where e.tipo = ${tipo} and e.fecha >= ${p.desde} and e.fecha < ${p.hasta}
      group by lower(i.descripcion), i.unidad order by 4 desc limit 12`,
    sql`select * from importaciones where tipo = ${tipo} order by id desc limit 6`,
  ]);

  const cerrar = url(base, sp, { editar: null, nuevo: null, copiar: null, importar: null });
  const idEdit = Number(param(sp, 'editar')) || Number(param(sp, 'copiar')) || 0;
  const fuente = idEdit ? (await sql<Egreso[]>`select * from egresos where id = ${idEdit} and tipo = ${tipo}`)[0] : null;
  const editando = param(sp, 'editar') && fuente ? fuente : null;
  const copiando = param(sp, 'copiar') && fuente ? fuente : null;
  const v = editando ?? copiando;
  const abierto = param(sp, 'nuevo') || editando;
  const itemsV = v ? await sql<ItemForm[]>`select descripcion, cantidad, unidad, precio, alicuota from egreso_items where egreso_id = ${v.id} order by orden, id` : [];
  const sugerencias = abierto ? await sugerenciasItems(sql, tipo) : [];
  const totalRubros = porRubro.reduce((a, r) => a + Number(r.total), 0);
  const filtrado = !!(q || rubro || estado);

  return (
    <>
      <div className="cabeza">
        <Titulo modulo={tipo === 'compra' ? 'compras' : 'gastos'} titulo={T.titulo}>
          {T.bajada}
        </Titulo>
        <div className="acciones">
          <SelectorPeriodo base={base} params={sp} p={p} />
          <Link className="btn claro" href={url(base, sp, { importar: 1, nuevo: null, editar: null, copiar: null })} scroll={false}>Importar Excel</Link>
          <Link className="btn vino" href={url(base, sp, { nuevo: 1, editar: null, copiar: null })} scroll={false}>{T.nuevo}</Link>
        </div>
      </div>

      <div className="tiles">
        <Tile titulo="Total con IVA" valor={pesos(tot.total, 0)} oscuro sub={p.tipo === 'mes' ? <>{ant.etiqueta}: {pesos(totAnt.total, 0)}</> : undefined}>
          {p.tipo === 'mes' && !filtrado && <Delta actual={tot.total} anterior={totAnt.total} subeEsBueno={false} />}
        </Tile>
        <Tile titulo="Neto sin IVA" valor={pesos(tot.neto, 0)} sub="Es lo que cuenta para la rentabilidad" />
        <Tile titulo="IVA (crédito fiscal)" valor={pesos(tot.iva, 0)} sub={`${numero(tot.n)} comprobantes`} />
        <Tile titulo="Pendiente de pago" valor={pesos(pend.total, 0)} sub={pend.n ? `${pend.n} sin pagar${pend.proximo ? ` · vence ${fecha(pend.proximo)}` : ''}` : 'Todo pagado'}>
          {pend.n > 0 && estado !== 'pendiente' && (
            <Link className="link" style={{ fontSize: 13 }} href={url(base, sp, { estado: 'pendiente', p: hoy().slice(0, 4) })}>Ver pendientes</Link>
          )}
        </Tile>
      </div>

      {porRubro.length > 0 && (
        <div className="caja">
          <h2>Por rubro</h2>
          <p className="sub">Total con IVA de {p.etiqueta.toLowerCase()}. Tocá un rubro para filtrar.</p>
          <div className="barras">
            {porRubro.map((r) => (
              <Link key={r.id} href={url(base, sp, { rubro: rubro === r.id ? null : r.id })} className="barra-f" style={{ textDecoration: 'none', opacity: rubro && rubro !== r.id ? 0.5 : 1 }}>
                <span className="n" title={r.nombre}>{r.nombre}</span>
                <span className="pista"><i style={{ width: `${(Number(r.total) / (Number(porRubro[0].total) || 1)) * 100}%`, background: tipo === 'compra' ? 'var(--s-costos)' : 'var(--s-gastos)' }} /></span>
                <span className="v">{pesos(r.total, 0)}<small>{porcentaje((Number(r.total) / (totalRubros || 1)) * 100, 0)}</small></span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {porProducto.length > 0 && (
        <div className="caja">
          <h2>{tipo === 'compra' ? 'Qué se compró' : 'Detalle por concepto'}</h2>
          <p className="sub">Productos de las facturas de {p.etiqueta.toLowerCase()}, sin IVA y en pesos.</p>
          <div className="tabla-env">
            <table className="t">
              <thead><tr><th>Producto</th><th className="der">Cantidad</th><th className="der">Neto</th><th className="der">Precio promedio</th><th className="der">Facturas</th></tr></thead>
              <tbody>
                {porProducto.map((x) => (
                  <tr key={`${x.producto}-${x.unidad}`}>
                    <td className="principal">{x.producto}</td>
                    <td className="der num">{numero(x.cantidad, 2)} {x.unidad}</td>
                    <td className="der num">{pesos(x.neto, 0)}</td>
                    <td className="der num chico">{x.cantidad ? `${pesos(x.neto / x.cantidad)}${x.unidad ? ` / ${x.unidad}` : ''}` : '—'}</td>
                    <td className="der num">{x.facturas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="filtros">
        <form className="filtros" style={{ margin: 0 }} action={base}>
          <input type="hidden" name="p" value={p.valor} />
          {rubro > 0 && <input type="hidden" name="rubro" value={rubro} />}
          {estado && <input type="hidden" name="estado" value={estado} />}
          <input type="search" name="q" defaultValue={q} placeholder="Buscar proveedor, detalle o número" aria-label="Buscar" />
        </form>
        <div className="pildoras">
          <Link className={!estado ? 'on' : ''} href={url(base, sp, { estado: null })}>Todos</Link>
          <Link className={estado === 'pendiente' ? 'on' : ''} href={url(base, sp, { estado: 'pendiente' })}>Sin pagar</Link>
        </div>
        {rubro > 0 && (
          <div className="pildoras">
            <Link className="on" href={url(base, sp, { rubro: null })}>{rubros.find((r) => r.id === rubro)?.nombre} ×</Link>
          </div>
        )}
      </div>

      <div className="tabla-env">
        <table className="t">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Proveedor</th>
              <th>Rubro</th>
              <th className="der">Neto</th>
              <th className="der">IVA</th>
              <th className="der">Total</th>
              <th>Pago</th>
              <th><span className="sr">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            {lista.map((e) => (
              <tr key={e.id}>
                <td className="num">{fecha(e.fecha)}</td>
                <td className="corta" title={[e.proveedor, e.descripcion].filter(Boolean).join(' · ')}>
                  <span className="principal">{e.proveedor || e.descripcion}</span>
                  <div className="chico">
                    {[e.comprobante, e.numero].filter(Boolean).join(' ')}
                    {e.proveedor && e.descripcion ? ` · ${e.descripcion}` : ''}
                    {e.cantidad ? ` · ${numero(e.cantidad, 3)} ${e.unidad}` : ''}
                  </div>
                </td>
                <td className="chico">{e.rubro}</td>
                <td className="der num">{pesos(e.neto_ars)}</td>
                <td className="der num">{pesos(e.iva_ars)}</td>
                <td className="der num principal">
                  {pesos(e.total_ars)}
                  {e.moneda === 'USD' && <div className="chico">{dolares(e.total)} a {numero(e.cotizacion, 2)}</div>}
                </td>
                <td>
                  {e.pagado ? (
                    <span className="chip bien" title={e.medio_pago}>Pagado{e.fecha_pago && e.fecha_pago !== e.fecha ? ` ${fecha(e.fecha_pago).slice(0, 5)}` : ''}</span>
                  ) : (
                    <span className={`chip ${e.vencimiento && e.vencimiento < hoy() ? 'mal' : 'alerta'}`}>
                      {e.vencimiento ? `Vence ${fecha(e.vencimiento).slice(0, 5)}` : 'Sin pagar'}
                    </span>
                  )}
                </td>
                <td>
                  <div className="iconos">
                    {!e.pagado && <BotonAccion accion={marcarPagado} campos={{ id: e.id }} titulo="Marcar como pagado hoy">Pagar</BotonAccion>}
                    <Link className="ico" href={url(base, sp, { editar: e.id, copiar: null, nuevo: null })} scroll={false}>Editar</Link>
                    <Link className="ico" href={url(base, sp, { copiar: e.id, editar: null, nuevo: 1 })} scroll={false} title="Cargar otro igual (ej.: el alquiler del mes que viene)">Repetir</Link>
                    <BotonAccion accion={borrarEgreso} campos={{ id: e.id }} confirmar={`¿Borrar este ${T.singular}?`} className="ico mal">Borrar</BotonAccion>
                  </div>
                </td>
              </tr>
            ))}
            {!lista.length && (
              <tr>
                <td colSpan={8} className="vacio">{T.vacio} en {p.etiqueta.toLowerCase()}{filtrado ? ' con esos filtros' : ''}.</td>
              </tr>
            )}
          </tbody>
          {lista.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={3}>Total {filtrado ? 'filtrado' : p.etiqueta.toLowerCase()}</td>
                <td className="der num">{pesos(tot.neto)}</td>
                <td className="der num">{pesos(tot.iva)}</td>
                <td className="der num">{pesos(tot.total)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {tot.n > lista.length && <p className="mas">Se muestran {lista.length} de {numero(tot.n)}. Los totales incluyen todos.</p>}

      {importaciones.length > 0 && (
        <details className="caja" style={{ marginTop: 18 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Importaciones anteriores</summary>
          <div className="tabla-env" style={{ marginTop: 12 }}>
            <table className="t">
              <thead><tr><th>Archivo</th><th>Período</th><th className="der">Nuevos</th><th className="der">Actualizados</th><th className="der">Total</th><th /></tr></thead>
              <tbody>
                {importaciones.map((i) => (
                  <tr key={i.id as number}>
                    <td className="corta">{i.archivo as string}</td>
                    <td className="chico num">{i.desde ? `${fechaCorta(i.desde as string)} al ${fecha(i.hasta as string)}` : '—'}</td>
                    <td className="der num">{i.nuevas as number}</td>
                    <td className="der num">{i.actualizadas as number}</td>
                    <td className="der num">{pesos(i.total as number, 0)}</td>
                    <td>
                      <BotonAccion accion={deshacerImportacionEgresos} campos={{ id: i.id as number }} className="ico mal" confirmar="Se borran todos los comprobantes que vinieron (o se actualizaron) con esta importación. ¿Seguro?">
                        Deshacer
                      </BotonAccion>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {param(sp, 'importar') && (
        <Ventana titulo={`Importar ${T.titulo.toLowerCase()} desde Excel`} cerrar={cerrar} ancha>
          <Importador tipo={tipo} rubros={rubros.filter((r) => r.activo).map(({ id, nombre }) => ({ id, nombre }))} dolar={dolar?.valor ?? null} destino={base} />
        </Ventana>
      )}

      {abierto && (
        <Ventana titulo={editando ? `Editar ${T.singular}` : copiando ? `Repetir ${T.singular}` : T.nuevo.replace('+ ', '')} cerrar={cerrar} ancha>
          <FormAccion accion={guardarEgreso} key={`${editando?.id ?? ''}-${copiando?.id ?? ''}`}>
            <input type="hidden" name="tipo" value={tipo} />
            <input type="hidden" name="volver" value={cerrar} />
            {editando && <input type="hidden" name="id" value={editando.id} />}
            <label className="campo">
              <span>Fecha</span>
              <input type="date" name="fecha" defaultValue={editando?.fecha ?? hoy()} required />
            </label>
            <label className="campo">
              <span>Rubro</span>
              <select name="rubro_id" defaultValue={v?.rubro_id ?? (rubro || '')} required>
                <option value="" disabled>Elegí…</option>
                {rubros.filter((r) => r.activo || r.id === v?.rubro_id).map((r) => (
                  <option key={r.id} value={r.id}>{r.nombre}</option>
                ))}
              </select>
            </label>
            <label className="campo">
              <span>Proveedor</span>
              <input name="proveedor" list="proveedores" defaultValue={v?.proveedor} autoComplete="off" />
              <datalist id="proveedores">
                {proveedores.map((x) => <option key={x.proveedor as string} value={x.proveedor as string} />)}
              </datalist>
            </label>
            <label className="campo">
              <span>Comprobante</span>
              <input name="comprobante" list="comprobantes" defaultValue={v?.comprobante ?? 'Factura A'} autoComplete="off" />
              <datalist id="comprobantes">{COMPROBANTES.map((c) => <option key={c} value={c} />)}</datalist>
            </label>
            <label className="campo">
              <span>Número <em>(opcional)</em></span>
              <input name="numero" defaultValue={editando?.numero} />
            </label>
            <label className="campo">
              <span>Detalle <em>{tipo === 'compra' ? '(opcional)' : ''}</em></span>
              <input name="descripcion" defaultValue={itemsV.length ? '' : v?.descripcion} placeholder={tipo === 'compra' ? 'Si lo dejás vacío, usa el primer producto' : 'Ej.: luz de octubre'} />
            </label>
            <ImportesEgreso
              modo={editando || copiando ? (itemsV.length ? 'items' : 'total') : tipo === 'compra' ? 'items' : 'total'}
              items={itemsV}
              sugerencias={sugerencias}
              alicuotaDefecto={21}
              moneda={v?.moneda}
              cotizacion={v?.cotizacion}
              dolar={dolar?.valor}
              neto={v?.neto}
              alicuota={v ? v.iva_alicuota : 21}
              iva={v?.iva}
              otros={v?.otros}
            />
            <CampoPago pagado={editando ? editando.pagado : true} fechaPago={editando?.fecha_pago ?? ''} vencimiento={editando?.vencimiento ?? ''} />
            <label className="campo">
              <span>Medio de pago</span>
              <input name="medio_pago" list="medios" defaultValue={v?.medio_pago ?? 'Transferencia'} />
              <datalist id="medios">{MEDIOS.map((m) => <option key={m} value={m} />)}</datalist>
            </label>
            <label className="campo ancho">
              <span>Notas</span>
              <textarea name="notas" defaultValue={v?.notas} />
            </label>
          </FormAccion>
        </Ventana>
      )}
    </>
  );
}
