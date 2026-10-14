import Link from 'next/link';
import { FormDeuda } from '@/components/Banco';
import { TabsBanco } from '@/components/TabsBanco';
import { Tile } from '@/components/Tile';
import { Titulo } from '@/components/Titulo';
import { Ventana } from '@/components/Ventana';
import { leerDolar } from '@/lib/ajustes';
import { TIPOS_PASIVO } from '@/lib/cuotas';
import { db } from '@/lib/db';
import { dolares, fecha, hoy, numero, pesos, porcentaje, sumarMeses } from '@/lib/formato';
import { type Params, param, url } from '@/lib/url';

export const metadata = { title: 'Préstamos y deudas · BB-CONTROL' };

type Fila = {
  id: number; tipo: string; nombre: string; acreedor: string; moneda: 'ARS' | 'USD'; capital: number; tasa: number | null; activo: boolean;
  cuotas: number; pagadas: number; pendiente: number; capital_pend: number; proxima: string | null; proxima_monto: number | null; vencidas: number;
};

export default async function Deudas({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const h = hoy();
  const finMes = `${sumarMeses(h.slice(0, 7), 1)}-01`;
  const sql = db();
  const [lista, rubros, dolar] = await Promise.all([
    sql<Fila[]>`
      select p.id, p.tipo, p.nombre, p.acreedor, p.moneda, p.capital, p.tasa, p.activo,
        count(c.id)::int cuotas, count(c.pagada_el)::int pagadas,
        coalesce(sum(c.total) filter (where c.pagada_el is null), 0) pendiente,
        coalesce(sum(c.capital) filter (where c.pagada_el is null), 0) capital_pend,
        min(c.vencimiento) filter (where c.pagada_el is null) proxima,
        (select x.total from pasivo_cuotas x where x.pasivo_id = p.id and x.pagada_el is null order by x.vencimiento, x.numero limit 1) proxima_monto,
        count(*) filter (where c.pagada_el is null and c.vencimiento < ${h})::int vencidas
      from pasivos p left join pasivo_cuotas c on c.pasivo_id = p.id
      group by p.id order by p.activo desc, (count(c.id) = count(c.pagada_el)), min(c.vencimiento) filter (where c.pagada_el is null) nulls last, p.nombre`,
    sql<{ id: number; nombre: string }[]>`select id, nombre from rubros where tipo = 'gasto' and activo order by orden, nombre`,
    leerDolar(),
  ]);
  const enPesos = (n: number, m: string) => (m === 'USD' ? n * (dolar?.valor ?? 0) : n);
  const activos = lista.filter((p) => p.activo);
  const pendiente = activos.reduce((a, p) => a + enPesos(p.pendiente, p.moneda), 0);
  const capital = activos.reduce((a, p) => a + enPesos(p.capital_pend, p.moneda), 0);
  const [mes] = await sql`
    select coalesce(sum(c.total), 0) total, count(*)::int n from pasivo_cuotas c join pasivos p on p.id = c.pasivo_id
    where p.activo and c.pagada_el is null and c.vencimiento < ${finMes} and p.moneda = 'ARS'`;
  const vencidas = activos.reduce((a, p) => a + p.vencidas, 0);
  const rubroDefecto = rubros.find((r) => /banco|financ|interes/i.test(r.nombre))?.id ?? null;
  const cerrar = url('/banco/deudas', sp, { nuevo: null });

  return (
    <>
      <div className="cabeza">
        <Titulo modulo="banco" titulo="Préstamos y deudas">
          Préstamos, planes de pago, leasing y deudas en cuotas. El cronograma se arma solo y se puede corregir cuota por cuota.
        </Titulo>
        <div className="acciones">
          <Link className="btn vino" href={url('/banco/deudas', sp, { nuevo: 1 })} scroll={false}>+ Préstamo o deuda</Link>
        </div>
      </div>
      <TabsBanco actual="/banco/deudas" />

      <div className="tiles">
        <Tile titulo="Deuda pendiente" valor={pesos(pendiente, 0)} oscuro sub="Todas las cuotas que faltan, con intereses" />
        <Tile titulo="Capital pendiente" valor={pesos(capital, 0)} sub="Sin intereses" />
        <Tile titulo="Cuotas de este mes" valor={pesos(mes.total, 0)} sub={`${numero(mes.n)} cuotas sin pagar`} />
        <Tile titulo="Cuotas vencidas" valor={numero(vencidas)} sub={vencidas ? 'Marcalas pagadas si ya se debitaron' : 'Ninguna'} />
      </div>

      <div className="tabla-env">
        <table className="t">
          <thead>
            <tr>
              <th>Deuda</th>
              <th>Cuotas</th>
              <th>Próxima</th>
              <th className="der">Pendiente</th>
              <th><span className="sr">Ver</span></th>
            </tr>
          </thead>
          <tbody>
            {lista.map((p) => {
              const fmt = (n: number) => (p.moneda === 'USD' ? dolares(n) : pesos(n, 0));
              const terminado = p.cuotas > 0 && p.pagadas === p.cuotas;
              return (
                <tr key={p.id} style={!p.activo || terminado ? { opacity: 0.6 } : undefined}>
                  <td className="corta">
                    <Link className="principal" href={`/banco/deudas/${p.id}`} style={{ textDecoration: 'none' }}>{p.nombre}</Link>
                    <div className="chico">{[TIPOS_PASIVO[p.tipo], p.acreedor, p.tasa != null ? `TNA ${porcentaje(p.tasa, 1)}` : ''].filter(Boolean).join(' · ')}</div>
                  </td>
                  <td>
                    <div className="progreso" aria-label={`${p.pagadas} de ${p.cuotas} cuotas pagadas`}>
                      <i style={{ width: `${p.cuotas ? (p.pagadas / p.cuotas) * 100 : 0}%` }} />
                    </div>
                    <span className="chico">{p.pagadas} de {p.cuotas} pagadas{p.vencidas ? ` · ${p.vencidas} vencidas` : ''}</span>
                  </td>
                  <td className="num">
                    {terminado ? <span className="chip bien">Cancelado</span> : p.proxima ? <>{fecha(p.proxima)}<div className="chico">{fmt(p.proxima_monto ?? 0)}</div></> : '—'}
                  </td>
                  <td className="der num principal">{fmt(p.pendiente)}</td>
                  <td><Link className="ico" href={`/banco/deudas/${p.id}`}>Ver cuotas</Link></td>
                </tr>
              );
            })}
            {!lista.length && <tr><td colSpan={5} className="vacio">No hay préstamos ni deudas cargadas.</td></tr>}
          </tbody>
        </table>
      </div>

      {param(sp, 'nuevo') && (
        <Ventana titulo="Préstamo o deuda nueva" cerrar={cerrar} ancha>
          <FormDeuda rubros={rubros} rubroDefecto={rubroDefecto} />
        </Ventana>
      )}
    </>
  );
}
