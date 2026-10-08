import { SelectorPeriodo } from '@/components/Periodo';
import { TabsContabilidad } from '@/components/TabsContabilidad';
import { Tile } from '@/components/Tile';
import { Titulo } from '@/components/Titulo';
import { exigirContabilidad, mesALiquidar } from '@/lib/contabilidad';
import { db } from '@/lib/db';
import { mesActual, mesCorto, nombreMes, periodo, pesos, sumarMeses } from '@/lib/formato';
import { type Params, param } from '@/lib/url';

export const metadata = { title: 'IVA estimado · BB-CONTROL' };

type Fila = { mes: string; debito: number; credito: number; percepciones: number; declarado: number | null };

// IVA estimado con lo cargado en la app: débito (IVA de las ventas) menos crédito (IVA de compras y gastos).
export default async function IvaEstimado({ searchParams }: { searchParams: Promise<Params> }) {
  const q = await exigirContabilidad();
  const sp = await searchParams;
  const inicio = mesALiquidar();
  const mes = /^\d{4}-(0[1-9]|1[0-2])$/.test(param(sp, 'p')) ? param(sp, 'p') : inicio;
  const filas = await db()<Fila[]>`
    with m as (select generate_series(${`${sumarMeses(mes, -5)}-01`}::date, ${`${mes}-01`}::date, interval '1 month')::date mes)
    select to_char(m.mes, 'YYYY-MM') mes,
      (select coalesce(sum(v.iva), 0) from ventas v where v.fecha >= m.mes and v.fecha < m.mes + interval '1 month') debito,
      (select coalesce(sum(e.iva_ars), 0) from egresos e where e.fecha >= m.mes and e.fecha < m.mes + interval '1 month') credito,
      (select coalesce(sum(round(e.otros * e.cotizacion, 2)), 0) from egresos e where e.fecha >= m.mes and e.fecha < m.mes + interval '1 month') percepciones,
      (select sum(o.monto) from contab_obligaciones o where o.mes = m.mes and o.tipo = 'iva') declarado
    from m order by m.mes`;
  const f = filas[filas.length - 1];
  const saldo = f.debito - f.credito;
  const enCurso = mes === mesActual();

  return (
    <>
      <div className="cabeza">
        <Titulo modulo="contabilidad" titulo="IVA estimado">
          Débito fiscal (el IVA de las ventas) menos crédito fiscal (el IVA de las compras y los gastos), con lo cargado en la app.
          Es una guía para ir viendo el mes: lo que se paga es lo que declara el contador.
        </Titulo>
        <div className="acciones">
          <SelectorPeriodo base="/contabilidad/iva" params={sp} p={periodo(mes)} soloMes inicio={{ valor: inicio, texto: 'Mes a liquidar' }} />
        </div>
      </div>
      <TabsContabilidad actual="/contabilidad/iva" admin={q.rol === 'admin'} mes={mes === inicio ? undefined : mes} />

      <div className="tiles">
        <Tile titulo="Débito (ventas)" valor={pesos(f.debito, 0)} />
        <Tile titulo="Crédito (compras y gastos)" valor={pesos(f.credito, 0)} />
        <Tile titulo={saldo < 0 ? 'Saldo a favor estimado' : 'A pagar estimado'} valor={pesos(Math.abs(saldo), 0)} oscuro sub={enCurso ? 'El mes está en curso' : nombreMes(mes)} />
        <Tile
          titulo="Declarado por el contador"
          valor={f.declarado == null ? '—' : pesos(f.declarado, 0)}
          sub={f.declarado == null ? 'Todavía no lo cargó' : `Diferencia con lo estimado: ${pesos(f.declarado - Math.max(saldo, 0), 0)}`}
        />
      </div>

      <div className="caja">
        <h2>Últimos 6 meses</h2>
        <p className="sub">
          Las percepciones y otros impuestos de las facturas de compra (de IVA y de Ingresos Brutos, juntos) no se restan acá:
          si son percepciones de IVA, el saldo real es menor.
        </p>
        <div className="tabla-env">
          <table className="t">
            <thead>
              <tr>
                <th>Mes</th>
                <th className="der">Débito</th>
                <th className="der">Crédito</th>
                <th className="der">Estimado</th>
                <th className="der">Percepciones y otros</th>
                <th className="der">Declarado</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((x) => {
                const s = x.debito - x.credito;
                return (
                  <tr key={x.mes} style={x.mes === mes ? { fontWeight: 700 } : undefined}>
                    <td>{mesCorto(x.mes)}</td>
                    <td className="der num">{pesos(x.debito, 0)}</td>
                    <td className="der num">{pesos(x.credito, 0)}</td>
                    <td className="der num">{s < 0 ? `A favor ${pesos(-s, 0)}` : pesos(s, 0)}</td>
                    <td className="der num chico">{pesos(x.percepciones, 0)}</td>
                    <td className="der num">{x.declarado == null ? '—' : pesos(x.declarado, 0)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
