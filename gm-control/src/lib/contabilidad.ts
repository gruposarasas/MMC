// Contabilidad: quién entra (administración o el contador), qué carga el contador cada mes y el gasto
// que genera cada obligación en Gastos. Solo servidor.
import { redirect } from 'next/navigation';
import type postgres from 'postgres';
import { db } from './db';
import { hoy, mesActual, nombreMes, pesos, fecha, sumarDias, sumarMeses } from './formato';
import { ListaProveedores } from './proveedores';
import { COOKIE_CONTADOR, esAdmin, leer } from './sesion';

export type Quien = { rol: 'admin' | 'contador'; id: number; nombre: string };
type Tx = postgres.TransactionSql<Record<string, unknown>>;

/** La sesión del contador lleva el principio del hash de su clave: con una clave nueva, las sesiones viejas dejan de valer. */
export const versionClave = (hash: string) => hash.slice(0, 12);

export async function contadorSesion(): Promise<Quien | null> {
  const [id, ver] = ((await leer(COOKIE_CONTADOR)) ?? '').split('.');
  if (!Number(id) || !ver) return null;
  const [c] = await db()`select id, nombre, clave_hash from contadores where id = ${Number(id)} and activo`;
  if (!c || !c.clave_hash || versionClave(c.clave_hash as string) !== ver) return null;
  return { rol: 'contador', id: c.id as number, nombre: c.nombre as string };
}

export async function quienContabilidad(): Promise<Quien | null> {
  if (await esAdmin()) return { rol: 'admin', id: 0, nombre: 'Administración' };
  return contadorSesion();
}

/** Administración o el contador; si no, al ingreso del contador. */
export async function exigirContabilidad(): Promise<Quien> {
  const q = await quienContabilidad();
  if (!q) redirect('/contador');
  return q;
}

export const TIPOS = {
  f931: { nombre: 'F.931 (cargas sociales)', corto: 'F.931', clase: 'cargas', ente: 'ARCA', comprobante: 'F.931', gasto: true },
  iva: { nombre: 'IVA', corto: 'IVA', clase: '', ente: 'ARCA', comprobante: '', gasto: false },
  iibb: { nombre: 'Ingresos Brutos', corto: 'IIBB', clase: 'impuestos', ente: 'ATM Mendoza', comprobante: 'Boleta de impuestos', gasto: true },
} as const;
export type TipoObligacion = keyof typeof TIPOS;
export const esTipo = (x: string): x is TipoObligacion => Object.hasOwn(TIPOS, x);

export type Obligacion = {
  id: number; mes: string; razon_id: number; tipo: TipoObligacion; monto: number | null; vencimiento: string | null; nota: string;
  cargado_por: string; actualizado: string; pagado_el: string | null; pagado_por: string; egreso_id: number | null;
};

export type EstadoObligacion = 'sin_cargar' | 'pendiente' | 'vencida' | 'pagada';
export function estadoObligacion(o: Pick<Obligacion, 'monto' | 'vencimiento' | 'pagado_el'> | undefined, dia = hoy()): EstadoObligacion {
  if (!o || o.monto == null) return 'sin_cargar';
  if (o.pagado_el) return 'pagada';
  return o.vencimiento && o.vencimiento < dia ? 'vencida' : 'pendiente';
}

/** El mes que se liquida es el anterior al actual (en octubre se paga lo de septiembre). */
export const mesALiquidar = () => sumarMeses(mesActual(), -1);
export const ultimoDia = (ym: string) => sumarDias(`${sumarMeses(ym, 1)}-01`, -1);

export async function anotar(tx: Tx, obligacionId: number, quien: string, que: string) {
  await tx`insert into contab_historial (obligacion_id, quien, que) values (${obligacionId}, ${quien}, ${que})`;
}

export const describirCarga = (monto: number, vencimiento: string | null) =>
  `${pesos(monto)}${vencimiento ? `, vence el ${fecha(vencimiento)}` : ''}`;

/**
 * F.931 e Ingresos Brutos van a Gastos como un gasto del mes liquidado, a pagar con su vencimiento (así entran
 * en el KPI y en los pagos que vencen). El IVA no: el KPI trabaja sin IVA.
 */
export async function sincronizarGasto(tx: Tx, obligacionId: number) {
  const [o] = await tx`
    select o.*, r.nombre razon, (select count(*) from razones_sociales where activo)::int razones
    from contab_obligaciones o join razones_sociales r on r.id = o.razon_id where o.id = ${obligacionId}`;
  if (!o) return;
  const t = TIPOS[o.tipo as TipoObligacion];
  const monto = o.monto == null ? 0 : Number(o.monto);
  if (!t.gasto || !monto) {
    if (o.egreso_id) {
      await tx`update contab_obligaciones set egreso_id = null where id = ${o.id as number}`;
      await tx`delete from egresos where id = ${o.egreso_id as number}`;
    }
    return;
  }
  const mes = (o.mes as string).slice(0, 7);
  const pagado = !!o.pagado_el;
  // Lo que se actualiza siempre. El rubro y el proveedor, si alguien los cambió en Gastos, se respetan.
  const datos = {
    fecha: ultimoDia(mes),
    descripcion: `${t.corto} ${nombreMes(mes)}${(o.razones as number) > 1 ? ` · ${o.razon}` : ''}`,
    neto: monto, iva: 0, iva_alicuota: 0, otros: 0, moneda: 'ARS', cotizacion: 1,
    pagado, fecha_pago: pagado ? (o.pagado_el as string) : null, vencimiento: pagado ? null : (o.vencimiento as string | null),
  };
  const clave = `contab|${o.id}`;
  const [existe] = await tx`select id from egresos where id = ${(o.egreso_id as number) ?? 0} or clave = ${clave} limit 1`;
  let egresoId = existe?.id as number | undefined;
  if (egresoId) {
    await tx`update egresos set ${tx(datos)} where id = ${egresoId}`;
  } else {
    const [rubro] = await tx`select id from rubros where tipo = 'gasto' and clase = ${t.clase} and activo order by orden, id limit 1`;
    if (!rubro) return; // sin rubro de esa clase no se puede crear
    const prov = await (await ListaProveedores.cargar(tx)).buscarOCrear(tx, t.ente, '', rubro.id as number);
    [{ id: egresoId }] = (await tx`
      insert into egresos ${tx({ ...datos, tipo: 'gasto', rubro_id: rubro.id as number, proveedor_id: prov.id, proveedor: '', comprobante: t.comprobante, numero: '', unidad: '', medio_pago: '', notas: 'Lo cargó el contador en Contabilidad.', clave })}
      returning id`) as unknown as { id: number }[];
  }
  if (egresoId !== o.egreso_id) await tx`update contab_obligaciones set egreso_id = ${egresoId!} where id = ${o.id as number}`;
}
