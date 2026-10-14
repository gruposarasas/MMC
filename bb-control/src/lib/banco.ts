// Planificación de pagos: todo lo que hay que pagar en los próximos meses, real o estimado. Solo servidor.
import { leerDolar } from './ajustes';
import { TIPOS, type TipoObligacion } from './contabilidad';
import { db } from './db';
import { hoy, mesActual, nombreMes, sumarMeses } from './formato';

export const CATEGORIAS = {
  echeqs: 'Echeqs',
  deudas: 'Préstamos y planes',
  proveedores: 'Proveedores',
  impuestos: 'Impuestos',
  fijos: 'Gastos fijos',
  sueldos: 'Sueldos',
} as const;
export type Categoria = keyof typeof CATEGORIAS;

export type Item = {
  fecha: string;
  categoria: Categoria | 'cobros';
  concepto: string;
  detalle: string;
  monto: number; // en pesos
  estimado: boolean;
  href: string;
};
export type MesPlan = { mes: string; items: Item[]; total: number; cobros: number; por: Record<Categoria, number>; saldo: number | null };
export type Plan = { vencido: Item[]; meses: MesPlan[]; saldoBancos: number | null; cuentas: number; avisos: string[] };

const vacio = (): Record<Categoria, number> => ({ echeqs: 0, deudas: 0, proveedores: 0, impuestos: 0, fijos: 0, sueldos: 0 });
const dia = (ym: string, d: number) => {
  const ultimo = new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0)).getUTCDate();
  return `${ym}-${String(Math.min(Math.max(d, 1), ultimo)).padStart(2, '0')}`;
};

/** Todo lo que vence desde hoy hasta dentro de `cantidad` meses (y lo vencido sin pagar), mes por mes. */
export async function planificacion(cantidad = 12): Promise<Plan> {
  const sql = db();
  const h = hoy();
  const m0 = mesActual();
  const fin = `${sumarMeses(m0, cantidad)}-01`;
  const meses = Array.from({ length: cantidad }, (_, k) => sumarMeses(m0, k));
  const avisos: string[] = [];
  const dolar = (await leerDolar())?.valor ?? null;
  const usd = (monto: number, moneda: string) => (moneda === 'USD' ? monto * (dolar ?? 0) : monto);
  let faltaDolar = false;
  const aPesos = (monto: number, moneda: string) => {
    if (moneda === 'USD' && !dolar) faltaDolar = true;
    return usd(Number(monto), moneda);
  };

  const [echeqs, cuotas, facturas, obligaciones, ultimas, fijos, cargados, sueldos, [equipo], cuentas] = await Promise.all([
    sql`select e.id, e.sentido, e.numero, e.pago, e.monto, e.moneda, coalesce(p.nombre, nullif(e.tercero, ''), 'Sin nombre') quien, c.nombre cuenta
        from echeqs e left join proveedores p on p.id = e.proveedor_id left join cuentas_banco c on c.id = e.cuenta_id
        where e.estado = 'pendiente' and e.pago < ${fin}`,
    sql`select c.id, c.numero, c.vencimiento, c.total, p.id pasivo, p.nombre, p.acreedor, p.moneda,
          (select count(*) from pasivo_cuotas x where x.pasivo_id = p.id)::int de
        from pasivo_cuotas c join pasivos p on p.id = c.pasivo_id
        where c.pagada_el is null and p.activo and c.vencimiento < ${fin}`,
    // Las facturas sin pagar (el F.931 y los IIBB del contador se cuentan en impuestos).
    sql`select id, tipo, proveedor, descripcion, total_ars, coalesce(vencimiento, fecha) fecha
        from egresos where not pagado and coalesce(clave, '') not like 'contab|%' and coalesce(vencimiento, fecha) < ${fin}`,
    sql`select o.id, o.mes, o.tipo, o.monto, o.vencimiento, r.nombre razon from contab_obligaciones o join razones_sociales r on r.id = o.razon_id
        where o.pagado_el is null and o.monto > 0`,
    // Lo último que cargó el contador de cada impuesto: base para estimar los meses que vienen.
    sql`select distinct on (o.razon_id, o.tipo) o.razon_id, o.tipo, o.mes, o.monto, o.vencimiento, r.nombre razon
        from contab_obligaciones o join razones_sociales r on r.id = o.razon_id
        where o.monto is not null and r.activo order by o.razon_id, o.tipo, o.mes desc`,
    sql`select f.*, r.nombre rubro, p.nombre proveedor from fijos f left join rubros r on r.id = f.rubro_id left join proveedores p on p.id = f.proveedor_id
        where f.activo and f.desde < ${fin} and (f.hasta is null or f.hasta >= ${`${m0}-01`})`,
    // Gastos ya cargados en cada mes: si el fijo ya está cargado, no se estima.
    sql`select distinct to_char(fecha, 'YYYY-MM') mes, rubro_id, proveedor_id from egresos where tipo = 'gasto' and fecha >= ${`${m0}-01`} and fecha < ${fin}`,
    sql`select to_char(periodo, 'YYYY-MM') mes, count(*)::int n, coalesce(sum(case when pagado then 0 else neto + extras - descuentos end), 0) pendiente
        from sueldos where periodo >= ${`${sumarMeses(m0, -1)}-01`} and periodo < ${fin} group by 1`,
    sql`select coalesce(sum(sueldo_neto), 0) neto, count(*)::int n from empleados where activo`,
    sql`select moneda, saldo from cuentas_banco where activo`,
  ]);

  const items: Item[] = [];
  for (const e of echeqs) {
    const emitido = e.sentido === 'emitido';
    items.push({
      fecha: e.pago as string, categoria: emitido ? 'echeqs' : 'cobros',
      concepto: `Echeq ${e.numero ? `N° ${e.numero} ` : ''}${emitido ? 'a' : 'de'} ${e.quien}`, detalle: (e.cuenta as string) ?? '',
      monto: aPesos(e.monto as number, e.moneda as string), estimado: false, href: `/banco/echeqs?editar=${e.id}`,
    });
  }
  for (const c of cuotas) {
    items.push({
      fecha: c.vencimiento as string, categoria: 'deudas', concepto: `${c.nombre} · cuota ${c.numero}/${c.de}`, detalle: c.acreedor as string,
      monto: aPesos(c.total as number, c.moneda as string), estimado: false, href: `/banco/deudas/${c.pasivo}`,
    });
  }
  for (const f of facturas) {
    const ruta = f.tipo === 'compra' ? 'compras' : 'gastos';
    items.push({
      fecha: f.fecha as string, categoria: 'proveedores', concepto: (f.proveedor as string) || (f.descripcion as string) || 'Sin proveedor',
      detalle: f.proveedor ? (f.descripcion as string) : '', monto: Number(f.total_ars), estimado: false,
      href: `/${ruta}?estado=pendiente&p=${(f.fecha as string).slice(0, 4)}`,
    });
  }
  const variasRazones = new Set(ultimas.map((u) => u.razon)).size > 1;
  const conRazon = (texto: string, razon: string) => (variasRazones ? `${texto} · ${razon}` : texto);
  for (const o of obligaciones) {
    const periodo = (o.mes as string).slice(0, 7);
    items.push({
      fecha: (o.vencimiento as string) ?? dia(sumarMeses(periodo, 1), 10), categoria: 'impuestos',
      concepto: conRazon(`${TIPOS[o.tipo as TipoObligacion].corto} ${nombreMes(periodo)}`, o.razon as string), detalle: 'Cargado por el contador',
      monto: Number(o.monto), estimado: false, href: `/contabilidad?p=${periodo}`,
    });
  }
  // Los meses que el contador todavía no cargó se estiman con lo último que cargó de cada impuesto.
  for (const u of ultimas) {
    if (!Number(u.monto)) continue;
    const ultimo = (u.mes as string).slice(0, 7);
    const venceDia = u.vencimiento ? Number((u.vencimiento as string).slice(8, 10)) : 10;
    for (let p = sumarMeses(ultimo, 1); sumarMeses(p, 1) < fin.slice(0, 7); p = sumarMeses(p, 1)) {
      if (p < sumarMeses(m0, -1)) continue;
      items.push({
        fecha: dia(sumarMeses(p, 1), venceDia), categoria: 'impuestos',
        concepto: conRazon(`${TIPOS[u.tipo as TipoObligacion].corto} ${nombreMes(p)}`, u.razon as string), detalle: `Estimado con lo de ${nombreMes(ultimo)}`,
        monto: Number(u.monto), estimado: true, href: `/contabilidad?p=${p}`,
      });
    }
  }
  const yaCargado = new Set(cargados.map((c) => `${c.mes}|${c.rubro_id}|${c.proveedor_id}`));
  const cargadoRubro = new Set(cargados.map((c) => `${c.mes}|${c.rubro_id}`));
  const cargadoProv = new Set(cargados.map((c) => `${c.mes}|${c.proveedor_id}`));
  for (const f of fijos) {
    const desde = (f.desde as string).slice(0, 7);
    const hasta = f.hasta ? (f.hasta as string).slice(0, 7) : null;
    for (const m of meses) {
      if (m < desde || (hasta && m > hasta)) continue;
      const cargado = f.rubro_id
        ? f.proveedor_id ? yaCargado.has(`${m}|${f.rubro_id}|${f.proveedor_id}`) : cargadoRubro.has(`${m}|${f.rubro_id}`)
        : f.proveedor_id ? cargadoProv.has(`${m}|${f.proveedor_id}`) : false;
      if (cargado) continue; // ya está en Gastos: si falta pagarlo, aparece en Proveedores
      items.push({
        fecha: dia(m, f.dia as number), categoria: 'fijos', concepto: f.nombre as string,
        detalle: [f.proveedor, f.rubro].filter(Boolean).join(' · '), monto: aPesos(f.monto as number, f.moneda as string),
        estimado: true, href: `/banco/fijos?editar=${f.id}`,
      });
    }
  }
  // Sueldos: los de cada mes se pagan a principio del siguiente. Si no están armados, con el sueldo de referencia.
  const porPeriodo = new Map(sueldos.map((s) => [s.mes as string, s]));
  const referencia = Number(equipo.neto);
  for (const m of meses) {
    const p = sumarMeses(m, -1);
    const s = porPeriodo.get(p);
    if (s ? Number(s.pendiente) > 0 : referencia > 0) {
      items.push({
        fecha: dia(m, 5), categoria: 'sueldos', concepto: `Sueldos de ${nombreMes(p)}`,
        detalle: s ? `${s.n} recibos armados` : `Estimado con el sueldo neto de ${equipo.n} personas`,
        monto: s ? Number(s.pendiente) : referencia, estimado: !s, href: `/sueldos?p=${p}`,
      });
    }
    // Aguinaldo: medio sueldo en junio y en diciembre.
    const mm = m.slice(5, 7);
    if ((mm === '06' || mm === '12') && referencia > 0) {
      items.push({
        fecha: dia(m, mm === '06' ? 30 : 18), categoria: 'sueldos', concepto: `Aguinaldo ${mm === '06' ? 'primer' : 'segundo'} semestre`,
        detalle: 'Estimado: medio sueldo neto de cada persona', monto: referencia / 2, estimado: true, href: '/sueldos',
      });
    }
  }

  // Lo real con fecha pasada es "vencido"; lo estimado del mes en curso queda en el mes.
  const vencido = items.filter((x) => !x.estimado && x.fecha < h && x.categoria !== 'cobros').sort((a, b) => a.fecha.localeCompare(b.fecha));
  const futuros = items.filter((x) => !vencido.includes(x));
  const saldoBancos = cuentas.length ? cuentas.reduce((a, c) => a + aPesos(c.saldo as number, c.moneda as string), 0) : null;
  let saldo = saldoBancos == null ? null : saldoBancos - vencido.reduce((a, x) => a + x.monto, 0);
  const resultado: MesPlan[] = meses.map((m) => {
    const del = futuros.filter((x) => (x.fecha < `${m0}-01` ? m === m0 : x.fecha.startsWith(m))).sort((a, b) => a.fecha.localeCompare(b.fecha));
    const por = vacio();
    let cobros = 0;
    for (const x of del) {
      if (x.categoria === 'cobros') cobros += x.monto;
      else por[x.categoria] += x.monto;
    }
    const total = Object.values(por).reduce((a, b) => a + b, 0);
    if (saldo != null) saldo = saldo - total + cobros;
    return { mes: m, items: del, total, cobros, por, saldo };
  });
  if (faltaDolar) avisos.push('Hay montos en dólares y no está cargada la cotización: cargala en Costos o en Ajustes para que se sumen.');
  return { vencido, meses: resultado, saldoBancos, cuentas: cuentas.length, avisos };
}
