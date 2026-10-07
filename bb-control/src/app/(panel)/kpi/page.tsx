import Link from 'next/link';
import { Titulo } from '@/components/Titulo';
import { Columnas } from '@/components/Columnas';
import { Pedidos } from '@/components/Pedidos';
import { SelectorPeriodo } from '@/components/Periodo';
import { Delta } from '@/components/Tile';
import { db } from '@/lib/db';
import { cumpleanos, pedidosPendientes } from '@/lib/equipo';
import { fecha, hoy, mesCorto, nombreMes, periodo, pesos, porcentaje, sumarDias, sumarMeses } from '@/lib/formato';
import { type Mes, pctDe, resultado, serieMensual } from '@/lib/kpi';
import { type Params, param, url } from '@/lib/url';

export const metadata = { title: 'KPI · BB-CONTROL' };

const SERIES = [
  { k: 'costos', nombre: 'Costos (compras)', color: 'var(--s-costos)' },
  { k: 'gastos', nombre: 'Gastos', color: 'var(--s-gastos)' },
  { k: 'sueldos', nombre: 'Sueldos', color: 'var(--s-sueldos)' },
  { k: 'rent', nombre: 'Rentabilidad', color: 'var(--s-rent)' },
] as const;

export default async function Kpi({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const p = periodo(param(sp, 'p'));
  const conIva = param(sp, 'b') === 'iva';
  const esAnio = p.tipo === 'anio';
  const ultimo = esAnio ? `${p.valor}-12` : p.valor;
  // Mes: los 12 meses que terminan en el elegido. Año: ese año y el anterior (para comparar).
  const primero = esAnio ? `${Number(p.valor) - 1}-01` : sumarMeses(ultimo, -11);
  const h = hoy();
  const sql = db();
  const [serie, porRubro, pedidos, cumples, vencimientos, [carga]] = await Promise.all([
    serieMensual(primero, ultimo),
    sql`select r.nombre, r.tipo, sum(${conIva ? sql`e.total_ars` : sql`e.neto_ars`}) total from egresos e join rubros r on r.id = e.rubro_id
        where e.fecha >= ${p.desde} and e.fecha < ${p.hasta} group by 1, 2 order by 3 desc limit 10`,
    pedidosPendientes(),
    cumpleanos(7),
    sql`select id, tipo, proveedor, descripcion, total_ars, vencimiento from egresos
        where not pagado and vencimiento is not null and vencimiento <= ${sumarDias(h, 7)} order by vencimiento limit 8`,
    sql`select
          (select count(*) from ventas where fecha >= ${p.desde} and fecha < ${p.hasta}) ventas,
          (select count(*) from egresos where tipo = 'compra' and fecha >= ${p.desde} and fecha < ${p.hasta}) compras,
          (select count(*) from egresos where tipo = 'gasto' and fecha >= ${p.desde} and fecha < ${p.hasta}) gastos,
          (select count(*) from sueldos where periodo >= ${p.desde} and periodo < ${p.hasta}) sueldos,
          (select count(*) from sueldos where periodo >= ${p.desde} and periodo < ${p.hasta} and not pagado) sueldos_sin_pagar`,
  ]);

  const visibles: Mes[] = esAnio ? serie.filter((m) => m.mes.startsWith(p.valor)) : serie;
  const actual = resultado(esAnio ? visibles : serie.slice(-1), conIva);
  const anterior = resultado(esAnio ? serie.filter((m) => !m.mes.startsWith(p.valor)) : serie.slice(-2, -1), conIva);
  const textoAnt = esAnio ? 'vs. año anterior' : 'vs. mes anterior';
  const base = '/kpi';
  const filas = visibles.map((m) => ({ m, r: resultado([m], conIva) }));
  const total = resultado(visibles, conIva);
  let acumulado = 0;

  const enCien = actual.ventas > 0;
  const partes = SERIES.map((s) => ({ ...s, valor: Math.max(actual[s.k], 0) }));
  const sumaPartes = partes.reduce((a, s) => a + s.valor, 0) || 1;

  const sinCargar = [
    !carga.ventas && 'las ventas (importá el Excel de Contabilium)',
    !carga.compras && 'las compras',
    !carga.gastos && 'los gastos',
    !carga.sueldos && 'los sueldos',
  ].filter(Boolean) as string[];

  return (
    <>
      <div className="cabeza">
        <Titulo modulo="kpi" eti="Tablero" titulo="KPI">
          Ventas − costos − gastos − sueldos = rentabilidad. {conIva ? 'Montos con IVA.' : 'Montos sin IVA (lo correcto para medir rentabilidad).'}
        </Titulo>
        <div className="acciones">
          <div className="pildoras">
            <Link className={!conIva ? 'on' : ''} href={url(base, sp, { b: null })}>Sin IVA</Link>
            <Link className={conIva ? 'on' : ''} href={url(base, sp, { b: 'iva' })}>Con IVA</Link>
          </div>
          <SelectorPeriodo base={base} params={sp} p={p} />
        </div>
      </div>

      {sinCargar.length > 0 && (p.actual || p.valor < h.slice(0, 7)) && (
        <div className="aviso">
          Falta cargar en {p.etiqueta.toLowerCase()}: {sinCargar.join(', ')}. Hasta que no esté todo, la rentabilidad no es real.
        </div>
      )}

      <div className="tiles kpi">
        <div className="tile oscuro heroe">
          <div className="t">Rentabilidad · {p.etiqueta.toLowerCase()}</div>
          <div className="v">{pesos(actual.rent, 0)}</div>
          <div className="s" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span>{porcentaje(pctDe(actual.rent, actual.ventas))} de las ventas</span>
            <Delta actual={actual.rent} anterior={anterior.rent} texto={textoAnt} />
          </div>
        </div>
        <div className="tile">
          <div className="t"><i className="punto" style={{ background: 'var(--s-ventas)' }} />Ventas</div>
          <div className="v">{pesos(actual.ventas, 0)}</div>
          <div className="s"><Delta actual={actual.ventas} anterior={anterior.ventas} texto={textoAnt} /></div>
        </div>
        {SERIES.slice(0, 3).map((s) => (
          <div className="tile" key={s.k}>
            <div className="t"><i className="punto" style={{ background: s.color }} />{s.nombre}</div>
            <div className="v">{pesos(actual[s.k], 0)}</div>
            <div className="s" style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <span>{porcentaje(pctDe(actual[s.k], actual.ventas))}</span>
              <Delta actual={actual[s.k]} anterior={anterior[s.k]} subeEsBueno={false} texto={textoAnt} />
            </div>
          </div>
        ))}
      </div>

      <div className="grilla2" style={{ marginBottom: 18 }}>
        <div className="caja">
          <h2>De cada $100 que vendemos</h2>
          <p className="sub">{p.etiqueta}. {actual.inversion > 0 && `Los gastos incluyen ${pesos(actual.inversion, 0)} de inversiones.`}</p>
          {enCien ? (
            <>
              <div className="cien" role="img" aria-label="Reparto de las ventas">
                {partes.filter((s) => s.valor > 0).map((s) => (
                  <i key={s.k} style={{ width: `${(s.valor / sumaPartes) * 100}%`, background: s.color }} title={`${s.nombre}: ${porcentaje((s.valor / actual.ventas) * 100)}`} />
                ))}
              </div>
              <div className="leyenda">
                {SERIES.map((s) => (
                  <span key={s.k}>
                    <i className="punto" style={{ background: s.color }} />
                    {s.nombre} <b>{pesos(actual.ventas ? (actual[s.k] / actual.ventas) * 100 : 0, 2).replace('$ ', '$')}</b>
                  </span>
                ))}
              </div>
              {actual.rent < 0 && <div className="aviso mal" style={{ marginTop: 12, marginBottom: 0 }}>Se gastó {pesos(-actual.rent, 0)} más de lo que se vendió.</div>}
            </>
          ) : (
            <p className="vacio">Sin ventas en el período.</p>
          )}
        </div>
        <div className="caja">
          <h2>Cashflow</h2>
          <p className="sub">Plata que entra menos plata que sale (con IVA, incluye inversiones).</p>
          <div className="tiles" style={{ marginBottom: 0 }}>
            <div className="tile" style={{ background: 'var(--sup2)' }}>
              <div className="t">{esAnio ? 'Del año' : 'Del mes'}</div>
              <div className="v" style={{ color: actual.flujo < 0 ? 'var(--mal)' : undefined }}>{pesos(actual.flujo, 0)}</div>
            </div>
            <div className="tile" style={{ background: 'var(--sup2)' }}>
              <div className="t">{esAnio ? 'Año anterior' : 'Últimos 12 meses'}</div>
              <div className="v" style={{ color: (esAnio ? anterior.flujo : total.flujo) < 0 ? 'var(--mal)' : undefined }}>{pesos(esAnio ? anterior.flujo : total.flujo, 0)}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grilla2" style={{ marginBottom: 18 }}>
        <div className="caja">
          <h2>Ventas por mes</h2>
          <p className="sub">{conIva ? 'Con IVA' : 'Sin IVA'} · últimos 12 meses</p>
          <Columnas
            color="var(--s-ventas)"
            resaltar={esAnio ? undefined : p.valor}
            datos={visibles.map((m) => {
              const r = resultado([m], conIva);
              return { clave: m.mes, etiqueta: mesCorto(m.mes).slice(0, 3), valor: r.ventas, detalle: nombreMes(m.mes) };
            })}
          />
        </div>
        <div className="caja">
          <h2>Rentabilidad por mes</h2>
          <p className="sub">Verde gana, bordó pierde · {conIva ? 'con IVA' : 'sin IVA'}</p>
          <Columnas
            color="var(--s-rent)"
            colorNegativo="var(--s-costos)"
            resaltar={esAnio ? undefined : p.valor}
            datos={filas.map(({ m, r }) => ({
              clave: m.mes,
              etiqueta: mesCorto(m.mes).slice(0, 3),
              valor: r.rent,
              detalle: `${nombreMes(m.mes)} · ${porcentaje(pctDe(r.rent, r.ventas))} de las ventas`,
            }))}
          />
        </div>
      </div>

      <div className="caja" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '18px 20px 6px' }}>
          <h2>Mes a mes</h2>
          <p className="sub">Cada gasto como % de las ventas. El cashflow es con IVA.</p>
        </div>
        <div className="tabla-env" style={{ border: 0, borderRadius: 0 }}>
          <table className="t">
            <thead>
              <tr>
                <th>Mes</th>
                <th className="der">Ventas</th>
                <th className="der">Costos</th>
                <th className="der">Gastos</th>
                <th className="der">Sueldos</th>
                <th className="der">Rentabilidad</th>
                <th className="der">Cashflow</th>
                <th className="der">Acumulado</th>
              </tr>
            </thead>
            <tbody>
              {filas.map(({ m, r }) => {
                acumulado += r.flujo;
                const pc = (x: number) => <div className="chico">{porcentaje(pctDe(x, r.ventas), 0)}</div>;
                return (
                  <tr key={m.mes} className={m.mes === p.valor ? 'marcada' : ''}>
                    <td><Link href={url(base, sp, { p: m.mes })} style={{ textTransform: 'capitalize', fontWeight: 600, textDecoration: 'none' }}>{mesCorto(m.mes)}</Link></td>
                    <td className="der num">{pesos(r.ventas, 0)}</td>
                    <td className="der num">{pesos(r.costos, 0)}{r.ventas > 0 && pc(r.costos)}</td>
                    <td className="der num">{pesos(r.gastos, 0)}{r.ventas > 0 && pc(r.gastos)}</td>
                    <td className="der num">{pesos(r.sueldos, 0)}{r.ventas > 0 && pc(r.sueldos)}</td>
                    <td className={`der num principal${r.rent < 0 ? ' neg' : ''}`}>{pesos(r.rent, 0)}{r.ventas > 0 && pc(r.rent)}</td>
                    <td className={`der num${r.flujo < 0 ? ' neg' : ''}`}>{pesos(r.flujo, 0)}</td>
                    <td className={`der num${acumulado < 0 ? ' neg' : ''}`}>{pesos(acumulado, 0)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td className="der num">{pesos(total.ventas, 0)}</td>
                <td className="der num">{pesos(total.costos, 0)}<div className="chico">{porcentaje(pctDe(total.costos, total.ventas), 0)}</div></td>
                <td className="der num">{pesos(total.gastos, 0)}<div className="chico">{porcentaje(pctDe(total.gastos, total.ventas), 0)}</div></td>
                <td className="der num">{pesos(total.sueldos, 0)}<div className="chico">{porcentaje(pctDe(total.sueldos, total.ventas), 0)}</div></td>
                <td className={`der num${total.rent < 0 ? ' neg' : ''}`}>{pesos(total.rent, 0)}<div className="chico">{porcentaje(pctDe(total.rent, total.ventas), 0)}</div></td>
                <td className={`der num${total.flujo < 0 ? ' neg' : ''}`}>{pesos(total.flujo, 0)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="grilla2" style={{ marginTop: 18 }}>
        <div className="caja">
          <h2>En qué se va la plata</h2>
          <p className="sub">Compras y gastos por rubro · {p.etiqueta.toLowerCase()}</p>
          {porRubro.length ? (
            <div className="barras">
              {porRubro.map((r) => (
                <div key={`${r.tipo}-${r.nombre}`} className="barra-f">
                  <span className="n" title={r.nombre as string}>{r.nombre as string}</span>
                  <span className="pista"><i style={{ width: `${(Number(r.total) / Number(porRubro[0].total || 1)) * 100}%`, background: r.tipo === 'compra' ? 'var(--s-costos)' : 'var(--s-gastos)' }} /></span>
                  <span className="v">{pesos(r.total as number, 0)}<small>{porcentaje(pctDe(Number(r.total), actual.ventas), 0)}</small></span>
                </div>
              ))}
              <div className="leyenda" style={{ marginTop: 4, fontSize: 12.5, color: 'var(--tinta2)' }}>
                <span><i className="punto" style={{ background: 'var(--s-costos)' }} />Compras</span>
                <span><i className="punto" style={{ background: 'var(--s-gastos)' }} />Gastos</span>
                <span>% sobre ventas</span>
              </div>
            </div>
          ) : (
            <p className="vacio">Sin compras ni gastos cargados.</p>
          )}
        </div>
        <div className="caja">
          <h2>Para hoy</h2>
          <p className="sub">Lo que conviene mirar.</p>
          {vencimientos.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <b style={{ fontSize: 14 }}>Pagos que vencen</b>
              <div className="lista-mi">
                {vencimientos.map((v) => (
                  <div key={v.id as number}>
                    <Link href={`/${v.tipo === 'compra' ? 'compras' : 'gastos'}?estado=pendiente&p=${(v.vencimiento as string).slice(0, 4)}`} style={{ textDecoration: 'none' }}>
                      {(v.proveedor as string) || (v.descripcion as string)}
                      <small>{(v.vencimiento as string) < h ? 'Vencido el' : 'Vence el'} {fecha(v.vencimiento as string)}</small>
                    </Link>
                    <span className={`num ${(v.vencimiento as string) < h ? 'chip mal' : ''}`}>{pesos(v.total_ars as number, 0)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {carga.sueldos_sin_pagar > 0 && <div className="aviso">{carga.sueldos_sin_pagar === 1 ? 'Hay 1 sueldo' : `Hay ${carga.sueldos_sin_pagar} sueldos`} de {p.etiqueta.toLowerCase()} sin pagar. <Link href={`/sueldos?p=${p.tipo === 'mes' ? p.valor : ''}`}>Ver sueldos</Link></div>}
          {cumples.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <b style={{ fontSize: 14 }}>Cumpleaños de la semana</b>
              <div className="lista-mi">
                {cumples.map((c) => (
                  <div key={c.id}><span>{c.nombre} {c.apellido}</span><span style={{ fontSize: 13 }}>{c.faltan === 0 ? '🎂 ¡Hoy!' : fecha(c.fecha).slice(0, 5)}</span></div>
                ))}
              </div>
            </div>
          )}
          {pedidos.length > 0 && (
            <div>
              <b style={{ fontSize: 14 }}>Pedidos del equipo</b>
              <Pedidos pedidos={pedidos.slice(0, 4)} />
              {pedidos.length > 4 && <Link className="link" href="/equipo">Ver los {pedidos.length}</Link>}
            </div>
          )}
          {!vencimientos.length && !cumples.length && !pedidos.length && !carga.sueldos_sin_pagar && <p className="vacio">Todo en orden.</p>}
        </div>
      </div>
    </>
  );
}
