import Link from 'next/link';
import { Titulo } from '@/components/Titulo';
import { borrarImportacion, borrarVenta, guardarVenta } from '@/acciones/ventas';
import { CamposImportes } from '@/components/CamposImportes';
import { BotonAccion, FormAccion } from '@/components/FormAccion';
import { SelectorPeriodo } from '@/components/Periodo';
import { Delta, Tile } from '@/components/Tile';
import { Ventana } from '@/components/Ventana';
import { Columnas } from '@/components/Columnas';
import { db } from '@/lib/db';
import { fecha, fechaCorta, hoy, periodo, pesos, numero, sumarDias } from '@/lib/formato';
import { type Params, param, url } from '@/lib/url';
import { ImportarVentas } from './ImportarVentas';
import { traerVentasContabilium } from '@/acciones/contabilium';
import { BotonContabilium } from '@/components/Contabilium';
import { credenciales, leerEstado } from '@/lib/contabilium';

export const metadata = { title: 'Ventas · BB-CONTROL' };

type Venta = { id: number; fecha: string; comprobante: string; numero: string; cliente: string; cuit: string; neto: number; iva: number; otros: number; total: number; origen: string; notas: string };

export default async function Ventas({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const p = periodo(param(sp, 'p'));
  const q = param(sp, 'q');
  const comp = param(sp, 'comp');
  const conIva = param(sp, 'iva'); // 'si' | 'no'
  const sql = db();
  const filtro = sql`
    fecha >= ${p.desde} and fecha < ${p.hasta}
    ${q ? sql`and (cliente ilike ${'%' + q + '%'} or numero ilike ${'%' + q + '%'} or cuit ilike ${'%' + q + '%'})` : sql``}
    ${comp ? sql`and comprobante = ${comp}` : sql``}
    ${conIva === 'si' ? sql`and iva <> 0` : conIva === 'no' ? sql`and iva = 0` : sql``}`;

  const ant = periodo(p.anterior);
  const [ventas, [tot], [totAnt], porComp, porDia, importaciones] = await Promise.all([
    sql<Venta[]>`select id, fecha, comprobante, numero, cliente, cuit, neto, iva, otros, total, origen, notas
                 from ventas where ${filtro} order by fecha desc, id desc limit 400`,
    sql`select count(*) n, coalesce(sum(neto),0) neto, coalesce(sum(iva),0) iva, coalesce(sum(otros),0) otros, coalesce(sum(total),0) total,
               count(*) filter (where total < 0) nc from ventas where ${filtro}`,
    sql`select coalesce(sum(total),0) total, coalesce(sum(neto),0) neto from ventas where fecha >= ${ant.desde} and fecha < ${ant.hasta}`,
    sql`select comprobante, count(*) n, sum(total) total from ventas where fecha >= ${p.desde} and fecha < ${p.hasta}
        group by 1 order by 3 desc`,
    p.tipo === 'mes'
      ? sql`select fecha as clave, sum(total) total, sum(neto) neto from ventas where ${filtro} group by 1 order by 1`
      : sql`select to_char(fecha, 'YYYY-MM') as clave, sum(total) total, sum(neto) neto from ventas where ${filtro} group by 1 order by 1`,
    sql`select * from importaciones where tipo = 'venta' order by id desc limit 8`,
  ]);

  const [cred, estadoSync] = await Promise.all([credenciales(), leerEstado()]);
  const base = '/ventas';
  const cerrar = url(base, sp, { editar: null, nuevo: null, importar: null });
  const editar = param(sp, 'editar');
  const enEdicion = editar ? (await sql<Venta[]>`select * from ventas where id = ${Number(editar) || 0}`)[0] : null;
  const comprobantes = porComp.map((c) => c.comprobante as string).filter(Boolean);

  // Serie para el gráfico: todos los días del mes (o los 12 meses del año).
  const serie: { clave: string; etiqueta: string; valor: number; detalle: string }[] = [];
  const mapa = new Map(porDia.map((d) => [String(d.clave), d]));
  if (p.tipo === 'mes') {
    for (let d = p.desde; d < p.hasta; d = sumarDias(d, 1)) {
      if (p.actual && d > hoy()) break;
      const x = mapa.get(d);
      serie.push({ clave: d, etiqueta: d.slice(8), valor: Number(x?.total ?? 0), detalle: `${fecha(d)} · neto ${pesos(Number(x?.neto ?? 0), 0)}` });
    }
  } else {
    for (let m = 1; m <= 12; m++) {
      const k = `${p.valor}-${String(m).padStart(2, '0')}`;
      const x = mapa.get(k);
      serie.push({ clave: k, etiqueta: ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'][m - 1], valor: Number(x?.total ?? 0), detalle: `neto ${pesos(Number(x?.neto ?? 0), 0)}` });
    }
  }

  return (
    <>
      <div className="cabeza">
        <Titulo modulo="ventas" titulo="Ventas">
          Importadas del Excel de Contabilium (un archivo por mes) o cargadas a mano.
        </Titulo>
        <div className="acciones">
          <SelectorPeriodo base={base} params={sp} p={p} />
          {cred && <BotonContabilium accion={traerVentasContabilium} campos={{ p: p.valor }} texto={`Traer de Contabilium`} cargando="Trayendo ventas…" clase="btn vino" />}
          <Link className={cred ? 'btn claro' : 'btn vino'} href={url(base, sp, { importar: 1 })} scroll={false}>Importar Excel</Link>
          <Link className="btn claro" href={url(base, sp, { nuevo: 1 })} scroll={false}>+ Venta a mano</Link>
        </div>
      </div>

      {cred && estadoSync && (
        <p className="sub" style={{ margin: '-8px 0 14px', fontSize: 13, color: estadoSync.ok ? 'var(--tinta3)' : 'var(--mal)' }}>
          Contabilium: {estadoSync.mensaje} ({new Date(estadoSync.fecha).toLocaleString('es-AR', { timeZone: 'America/Argentina/Mendoza', dateStyle: 'short', timeStyle: 'short' })})
        </p>
      )}
      {!cred && (
        <p className="sub" style={{ margin: '-8px 0 14px', fontSize: 13 }}>
          ¿Querés que las ventas se carguen solas? <Link href="/ajustes" className="link">Conectá Contabilium</Link>.
        </p>
      )}

      <div className="tiles">
        <Tile titulo="Total con IVA" valor={pesos(tot.total, 0)} oscuro sub={p.tipo === 'mes' ? <>{ant.etiqueta}: {pesos(totAnt.total, 0)}</> : undefined}>
          {p.tipo === 'mes' && !q && !comp && !conIva && <Delta actual={tot.total} anterior={totAnt.total} />}
        </Tile>
        <Tile titulo="Neto sin IVA" valor={pesos(tot.neto, 0)} sub="Lo que queda para Bruno Brown" />
        <Tile titulo="IVA facturado" valor={pesos(tot.iva, 0)} sub={tot.otros ? `+ ${pesos(tot.otros, 0)} de percepciones` : 'Débito fiscal'} />
        <Tile titulo="Comprobantes" valor={numero(tot.n)} sub={tot.nc ? `${tot.nc} ${tot.nc === 1 ? 'nota' : 'notas'} de crédito` : tot.n ? `Promedio ${pesos(tot.total / tot.n, 0)}` : undefined} />
      </div>

      {serie.some((s) => s.valor) && (
        <div className="caja">
          <h2>{p.tipo === 'mes' ? 'Ventas por día' : 'Ventas por mes'}</h2>
          <p className="sub">Total con IVA{p.tipo === 'mes' ? ` · ${p.etiqueta.toLowerCase()}` : ''}</p>
          <Columnas datos={serie} color="var(--s-ventas)" />
        </div>
      )}

      <div className="filtros">
        <form className="filtros" style={{ margin: 0 }} action={base}>
          <input type="hidden" name="p" value={p.valor} />
          {comp && <input type="hidden" name="comp" value={comp} />}
          {conIva && <input type="hidden" name="iva" value={conIva} />}
          <input type="search" name="q" defaultValue={q} placeholder="Buscar cliente, CUIT o número" aria-label="Buscar" />
        </form>
        <div className="pildoras">
          <Link className={!conIva ? 'on' : ''} href={url(base, sp, { iva: null })}>Todas</Link>
          <Link className={conIva === 'si' ? 'on' : ''} href={url(base, sp, { iva: 'si' })}>Con IVA</Link>
          <Link className={conIva === 'no' ? 'on' : ''} href={url(base, sp, { iva: 'no' })}>Sin IVA</Link>
        </div>
        {porComp.length > 1 && (
          <div className="pildoras">
            <Link className={!comp ? 'on' : ''} href={url(base, sp, { comp: null })}>Todos los comprobantes</Link>
            {porComp.map((c) => (
              <Link key={c.comprobante || '-'} className={comp === c.comprobante ? 'on' : ''} href={url(base, sp, { comp: c.comprobante || null })}>
                {c.comprobante || 'Sin tipo'}<span className="num">{c.n}</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="tabla-env">
        <table className="t">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Comprobante</th>
              <th>Cliente</th>
              <th className="der">Neto</th>
              <th className="der">IVA</th>
              <th className="der">Total</th>
              <th><span className="sr">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            {ventas.map((v) => (
              <tr key={v.id}>
                <td className="num">{fecha(v.fecha)}</td>
                <td>
                  <span className="principal">{v.comprobante || '—'}</span>
                  <div className="chico num">{v.numero}</div>
                </td>
                <td className="corta" title={v.cliente}>
                  {v.cliente || <span className="chico">Consumidor final</span>}
                  {v.cuit && <div className="chico">{v.cuit}</div>}
                </td>
                <td className={`der num${v.neto < 0 ? ' neg' : ''}`}>{pesos(v.neto)}</td>
                <td className={`der num${v.iva < 0 ? ' neg' : ''}`}>{pesos(v.iva)}</td>
                <td className={`der num principal${v.total < 0 ? ' neg' : ''}`}>{pesos(v.total)}</td>
                <td>
                  <div className="iconos">
                    <Link className="ico" href={url(base, sp, { editar: v.id })} scroll={false}>Editar</Link>
                    <BotonAccion accion={borrarVenta} campos={{ id: v.id }} confirmar="¿Borrar esta venta?" className="ico mal">Borrar</BotonAccion>
                  </div>
                </td>
              </tr>
            ))}
            {!ventas.length && (
              <tr>
                <td colSpan={7} className="vacio">
                  No hay ventas en {p.etiqueta.toLowerCase()}{q || comp || conIva ? ' con esos filtros' : ''}. Importá el Excel de Contabilium del mes.
                </td>
              </tr>
            )}
          </tbody>
          {ventas.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={3}>Total {q || comp || conIva ? 'filtrado' : p.etiqueta.toLowerCase()}</td>
                <td className="der num">{pesos(tot.neto)}</td>
                <td className="der num">{pesos(tot.iva)}</td>
                <td className="der num">{pesos(tot.total)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {tot.n > ventas.length && <p className="mas">Se muestran las últimas {ventas.length} de {numero(tot.n)}. Los totales incluyen todas.</p>}

      {importaciones.length > 0 && (
        <details className="caja" style={{ marginTop: 18 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Importaciones anteriores</summary>
          <div className="tabla-env" style={{ marginTop: 12 }}>
            <table className="t">
              <thead>
                <tr><th>Archivo</th><th>Cuándo</th><th>Período</th><th className="der">Nuevas</th><th className="der">Actualizadas</th><th className="der">Total</th><th /></tr>
              </thead>
              <tbody>
                {importaciones.map((i) => (
                  <tr key={i.id as number}>
                    <td className="corta">{i.archivo as string}</td>
                    <td className="chico">{new Date(i.creado as string).toLocaleString('es-AR', { timeZone: 'America/Argentina/Mendoza', dateStyle: 'short', timeStyle: 'short' })}</td>
                    <td className="chico num">{fechaCorta(i.desde as string)} al {fecha(i.hasta as string)}</td>
                    <td className="der num">{i.nuevas as number}</td>
                    <td className="der num">{i.actualizadas as number}</td>
                    <td className="der num">{pesos(i.total as number, 0)}</td>
                    <td>
                      <BotonAccion accion={borrarImportacion} campos={{ id: i.id as number }} className="ico mal"
                        confirmar="Se borran todas las ventas que vinieron (o se actualizaron) con esta importación. ¿Seguro?">
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
        <Ventana titulo="Importar ventas de Contabilium" cerrar={cerrar} ancha>
          <ImportarVentas />
        </Ventana>
      )}

      {(param(sp, 'nuevo') || enEdicion) && (
        <Ventana titulo={enEdicion ? 'Editar venta' : 'Nueva venta'} cerrar={cerrar}>
          <FormAccion accion={guardarVenta}>
            <input type="hidden" name="volver" value={cerrar} />
            {enEdicion && <input type="hidden" name="id" value={enEdicion.id} />}
            <label className="campo">
              <span>Fecha</span>
              <input type="date" name="fecha" defaultValue={enEdicion?.fecha ?? hoy()} required />
            </label>
            <label className="campo">
              <span>Comprobante</span>
              <input name="comprobante" list="comprobantes" defaultValue={enEdicion?.comprobante ?? 'Factura B'} />
              <datalist id="comprobantes">
                {[...new Set(['Factura A', 'Factura B', 'Factura C', 'Nota de crédito A', 'Nota de crédito B', 'Sin factura', ...comprobantes])].map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>
            <label className="campo">
              <span>Número <em>(opcional)</em></span>
              <input name="numero" defaultValue={enEdicion?.numero} placeholder="0001-00001234" />
            </label>
            <label className="campo">
              <span>Cliente</span>
              <input name="cliente" defaultValue={enEdicion?.cliente} />
            </label>
            <label className="campo">
              <span>CUIT / DNI <em>(opcional)</em></span>
              <input name="cuit" defaultValue={enEdicion?.cuit} inputMode="numeric" />
            </label>
            <CamposImportes neto={enEdicion?.neto} iva={enEdicion?.iva} otros={enEdicion?.otros} alicuota={enEdicion ? (enEdicion.neto && enEdicion.iva ? Math.round((enEdicion.iva / enEdicion.neto) * 1000) / 10 : 0) : 21} />
            <label className="campo ancho">
              <span>Notas</span>
              <textarea name="notas" defaultValue={enEdicion?.notas} />
            </label>
            <p className="ayuda ancho" style={{ margin: 0, fontSize: 12.5, color: 'var(--tinta3)' }}>
              Las notas de crédito van con importes negativos.
            </p>
          </FormAccion>
        </Ventana>
      )}
    </>
  );
}
