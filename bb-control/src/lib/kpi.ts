// Números del tablero: un renglón por mes. Solo servidor.
import { db } from './db';
import { sumarMeses } from './formato';

export type Mes = {
  mes: string;
  ventas_neto: number;
  ventas_total: number;
  compras_neto: number;
  compras_total: number;
  gastos_neto: number;
  gastos_total: number;
  inversion_neto: number;
  inversion_total: number;
  cargas: number;
  sueldos: number;
};

/** Meses desde `desde` hasta `hasta` (AAAA-MM, inclusive). */
export async function serieMensual(desde: string, hasta: string): Promise<Mes[]> {
  const d = `${desde}-01`;
  const h = `${sumarMeses(hasta, 1)}-01`;
  return db()<Mes[]>`
    with m as (select to_char(x, 'YYYY-MM') mes from generate_series(${d}::date, ${`${hasta}-01`}::date, interval '1 month') x),
    v as (select to_char(fecha, 'YYYY-MM') mes, sum(neto) neto, sum(total) total from ventas
          where fecha >= ${d} and fecha < ${h} group by 1),
    c as (select to_char(fecha, 'YYYY-MM') mes, sum(neto_ars) neto, sum(total_ars) total from egresos
          where tipo = 'compra' and fecha >= ${d} and fecha < ${h} group by 1),
    g as (select to_char(e.fecha, 'YYYY-MM') mes, sum(e.neto_ars) neto, sum(e.total_ars) total,
                 coalesce(sum(e.neto_ars) filter (where r.clase = 'inversion'), 0) inv_neto,
                 coalesce(sum(e.total_ars) filter (where r.clase = 'inversion'), 0) inv_total,
                 coalesce(sum(e.neto_ars) filter (where r.clase = 'cargas'), 0) cargas
          from egresos e join rubros r on r.id = e.rubro_id
          where e.tipo = 'gasto' and e.fecha >= ${d} and e.fecha < ${h} group by 1),
    s as (select to_char(periodo, 'YYYY-MM') mes, sum(neto + extras) costo from sueldos
          where periodo >= ${d} and periodo < ${h} group by 1)
    select m.mes,
      coalesce(v.neto, 0) ventas_neto, coalesce(v.total, 0) ventas_total,
      coalesce(c.neto, 0) compras_neto, coalesce(c.total, 0) compras_total,
      coalesce(g.neto, 0) gastos_neto, coalesce(g.total, 0) gastos_total,
      coalesce(g.inv_neto, 0) inversion_neto, coalesce(g.inv_total, 0) inversion_total,
      coalesce(g.cargas, 0) cargas, coalesce(s.costo, 0) sueldos
    from m left join v using (mes) left join c using (mes) left join g using (mes) left join s using (mes)
    order by m.mes`;
}

export type Resultado = { ventas: number; costos: number; gastos: number; sueldos: number; rent: number; flujo: number; inversion: number; cargas: number };

/** Suma meses con la base elegida: sin IVA (rentabilidad) o con IVA. El flujo siempre es con IVA. */
export function resultado(meses: Mes[], conIva: boolean): Resultado {
  const r = { ventas: 0, costos: 0, gastos: 0, sueldos: 0, rent: 0, flujo: 0, inversion: 0, cargas: 0 };
  for (const m of meses) {
    r.ventas += conIva ? m.ventas_total : m.ventas_neto;
    r.costos += conIva ? m.compras_total : m.compras_neto;
    r.gastos += conIva ? m.gastos_total : m.gastos_neto;
    r.inversion += conIva ? m.inversion_total : m.inversion_neto;
    r.cargas += m.cargas;
    r.sueldos += m.sueldos;
    r.flujo += m.ventas_total - m.compras_total - m.gastos_total - m.sueldos;
  }
  r.rent = r.ventas - r.costos - r.gastos - r.sueldos;
  return r;
}

export const pctDe = (x: number, ventas: number) => (ventas ? (x / ventas) * 100 : null);
