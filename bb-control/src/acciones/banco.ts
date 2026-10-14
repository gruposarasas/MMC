'use server';
// Banco: cuentas, echeqs, préstamos y deudas en cuotas, y gastos fijos. Solo administración.
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type postgres from 'postgres';
import { cronograma, type Sistema, SISTEMAS } from '@/lib/cuotas';
import { db } from '@/lib/db';
import { type Estado, entero, falla, fechaForm, intentar, numero, texto, tilde, volver } from '@/lib/form';
import { hoy } from '@/lib/formato';
import { normalizar } from '@/lib/importar';
import { ListaProveedores, limpiarCuit } from '@/lib/proveedores';
import { exigirAdmin } from '@/lib/sesion';

type Tx = postgres.TransactionSql<Record<string, unknown>>;
const moneda = (f: FormData) => (texto(f, 'moneda') === 'USD' ? 'USD' : 'ARS');
const mesForm = (f: FormData, k: string, requerido?: string) => {
  const v = texto(f, k, 7);
  if (!v) return requerido ? falla(requerido) : null;
  if (!/^20\d\d-(0[1-9]|1[0-2])$/.test(v)) falla('Revisá el mes.');
  return `${v}-01`;
};
const listo = (...rutas: string[]) => {
  revalidatePath('/banco', 'layout');
  revalidatePath('/kpi');
  for (const r of rutas) revalidatePath(r);
};

/** Proveedor elegido de la lista o nuevo (como en compras y gastos). */
async function proveedorDe(tx: Tx, f: FormData, rubroId: number | null) {
  const id = entero(f, 'proveedor_id');
  if (id) {
    if (!(await tx`select 1 from proveedores where id = ${id}`).length) falla('Elegí el proveedor de la lista.');
    return id;
  }
  const nuevo = texto(f, 'proveedor_nuevo', 120).replace(/\s+/g, ' ');
  if (!nuevo) return null;
  const cuit = limpiarCuit(texto(f, 'proveedor_cuit', 20));
  if (cuit && cuit.length !== 11) falla('El CUIT del proveedor nuevo tiene que tener 11 números.');
  return (await (await ListaProveedores.cargar(tx)).buscarOCrear(tx, nuevo, cuit, rubroId)).id;
}

// ---------- cuentas ----------
export async function guardarCuenta(_: Estado, f: FormData): Promise<Estado> {
  await exigirAdmin();
  return intentar(async () => {
    const id = entero(f, 'id');
    const nombre = texto(f, 'nombre', 80) || falla('Poné el nombre de la cuenta (ej.: Galicia cuenta corriente).');
    const c = {
      nombre, banco: texto(f, 'banco', 60), moneda: moneda(f), saldo: numero(f, 'saldo'),
      saldo_al: fechaForm(f, 'saldo_al') ?? hoy(), activo: id ? tilde(f, 'activo') : true,
    };
    const sql = db();
    if (id) await sql`update cuentas_banco set ${sql(c)} where id = ${id}`;
    else await sql`insert into cuentas_banco ${sql({ ...c, orden: 0 })}`;
    listo();
    return { ok: 'Guardado.' };
  });
}

// ---------- echeqs ----------
/** Las facturas que paga un echeq quedan pagadas con su fecha de pago; si se desvinculan, vuelven a pendientes. */
async function desvincular(tx: Tx, echeqId: number, egresos?: number[]) {
  const ids = egresos ?? (await tx`select egreso_id from echeq_egresos where echeq_id = ${echeqId}`).map((r) => r.egreso_id as number);
  if (!ids.length) return;
  await tx`update egresos set pagado = false, vencimiento = coalesce(fecha_pago, vencimiento), fecha_pago = null, medio_pago = ''
           where id in ${tx(ids)} and medio_pago = 'Cheque / Echeq'`;
  await tx`delete from echeq_egresos where echeq_id = ${echeqId} and egreso_id in ${tx(ids)}`;
}

export async function guardarEcheq(_: Estado, f: FormData): Promise<Estado> {
  await exigirAdmin();
  return intentar(async () => {
    const id = entero(f, 'id');
    const sentido = texto(f, 'sentido') === 'recibido' ? 'recibido' : 'emitido';
    const pago = fechaForm(f, 'pago', `Poné la fecha de ${sentido === 'emitido' ? 'pago' : 'cobro'}.`)!;
    const monto = numero(f, 'monto', { requerido: 'Poné el monto.', min: 0.01 });
    const cuenta_id = entero(f, 'cuenta_id');
    const numeroEcheq = texto(f, 'numero', 40);
    const banco = texto(f, 'banco', 60);
    const egresos = f.getAll('egresos').map((x) => Number(x)).filter((x) => Number.isInteger(x) && x > 0);
    const sql = db();
    await sql.begin(async (tx) => {
      const proveedor_id = sentido === 'emitido' ? await proveedorDe(tx, f, null) : null;
      const tercero = sentido === 'recibido' ? texto(f, 'tercero', 120) || falla('Poné quién te dio el echeq.') : '';
      if (sentido === 'emitido' && !proveedor_id) falla('Elegí a quién se lo diste.');
      const e = {
        sentido, cuenta_id, numero: numeroEcheq, banco, proveedor_id, tercero, cuit: limpiarCuit(texto(f, 'cuit', 20)),
        emision: fechaForm(f, 'emision'), pago, moneda: moneda(f), monto, notas: texto(f, 'notas', 500),
        clave: numeroEcheq ? `${sentido}|${cuenta_id ?? normalizar(banco)}|${normalizar(numeroEcheq)}` : null,
      };
      const [otro] = e.clave ? await tx`select id from echeqs where clave = ${e.clave} and id <> ${id ?? 0}` : [];
      if (otro) falla(`Ya hay un echeq ${sentido} con el número ${numeroEcheq}.`);
      let echeqId = id;
      if (id) {
        const [antes] = await tx`update echeqs set ${tx(e)} where id = ${id} returning estado`;
        if (!antes) falla('No se encontró el echeq.');
      } else {
        [{ id: echeqId }] = (await tx`insert into echeqs ${tx(e)} returning id`) as unknown as { id: number }[];
      }
      // Facturas que paga (solo los emitidos que siguen vigentes).
      const [{ estado }] = await tx`select estado from echeqs where id = ${echeqId!}`;
      const vigente = sentido === 'emitido' && (estado === 'pendiente' || estado === 'pagado');
      const antes = (await tx`select egreso_id from echeq_egresos where echeq_id = ${echeqId!}`).map((x) => x.egreso_id as number);
      const quedan = vigente ? egresos : [];
      await desvincular(tx, echeqId!, antes.filter((x) => !quedan.includes(x)));
      if (quedan.length) {
        const validos = await tx`select id from egresos where id in ${tx(quedan)} and (not pagado or id in ${tx(antes.length ? antes : [0])})`;
        const ids = validos.map((v) => v.id as number);
        for (const eg of ids) await tx`insert into echeq_egresos (echeq_id, egreso_id) values (${echeqId!}, ${eg}) on conflict do nothing`;
        if (ids.length)
          await tx`update egresos set pagado = true, fecha_pago = ${pago}, vencimiento = null, medio_pago = 'Cheque / Echeq' where id in ${tx(ids)}`;
      }
    });
    listo('/compras', '/gastos');
    redirect(volver(f, '/banco/echeqs'));
  });
}

export async function estadoEcheq(f: FormData) {
  await exigirAdmin();
  const id = entero(f, 'id');
  const estado = texto(f, 'estado', 12);
  if (!id || !['pendiente', 'pagado', 'anulado', 'rechazado'].includes(estado)) return;
  await db().begin(async (tx) => {
    await tx`update echeqs set estado = ${estado}, cerrado_el = ${estado === 'pendiente' ? null : hoy()} where id = ${id}`;
    // Si no se pagó, las facturas que cancelaba vuelven a estar pendientes.
    if (estado === 'anulado' || estado === 'rechazado') await desvincular(tx, id);
  });
  listo('/compras', '/gastos');
}

export async function borrarEcheq(f: FormData) {
  await exigirAdmin();
  const id = entero(f, 'id');
  if (!id) return;
  await db().begin(async (tx) => {
    await desvincular(tx, id);
    await tx`delete from echeqs where id = ${id}`;
  });
  listo('/compras', '/gastos');
}

// ---------- préstamos y deudas ----------
const TIPOS_PASIVO = ['prestamo', 'plan', 'leasing', 'tarjeta', 'deuda', 'otro'];

export async function crearPasivo(_: Estado, f: FormData): Promise<Estado> {
  await exigirAdmin();
  return intentar(async () => {
    const tipo = texto(f, 'tipo', 12);
    if (!TIPOS_PASIVO.includes(tipo)) falla('Elegí qué es.');
    const sistema = texto(f, 'sistema', 10) as Sistema;
    if (!Object.hasOwn(SISTEMAS, sistema)) falla('Elegí cómo se paga.');
    const nombre = texto(f, 'nombre', 100) || falla('Poné un nombre (ej.: Préstamo Galicia equipos).');
    const capital = numero(f, 'capital', { min: 0 });
    const tasa = texto(f, 'tasa') ? numero(f, 'tasa', { min: 0, max: 1000, dec: 3 }) : null;
    const cuotas = sistema === 'unica' ? 1 : (entero(f, 'cuotas') ?? falla('Poné la cantidad de cuotas.'));
    if (cuotas > 600) falla('Son demasiadas cuotas.');
    const primera = fechaForm(f, 'primera', 'Poné la fecha de la primera cuota.')!;
    const cuotaFija = sistema === 'fija' ? numero(f, 'cuota_fija', { requerido: 'Poné el valor de la cuota.', min: 0.01 }) : null;
    if (sistema !== 'fija' && !capital) falla('Poné el capital (lo que te prestaron o lo que debés).');
    if ((sistema === 'frances' || sistema === 'aleman') && tasa == null) falla('Poné la tasa nominal anual (0 si no tiene interés).');
    const rubro_id = entero(f, 'rubro_id');
    const plan = cronograma({ capital, tasa, cuotas, primera, sistema, cuotaFija, ivaIntereses: tilde(f, 'iva_intereses'), otros: numero(f, 'otros', { min: 0 }) });
    const id = await db().begin(async (tx) => {
      if (rubro_id && !(await tx`select 1 from rubros where id = ${rubro_id} and tipo = 'gasto'`).length) falla('Elegí el rubro de gastos.');
      const [p] = await tx`insert into pasivos ${tx({
        tipo, nombre, acreedor: texto(f, 'acreedor', 100), moneda: moneda(f), capital: capital || plan.reduce((a, c) => a + c.capital, 0),
        tasa, sistema, rubro_id, notas: texto(f, 'notas', 1000),
      })} returning id`;
      await tx`insert into pasivo_cuotas ${tx(plan.map(({ total, ...c }) => ({ ...c, pasivo_id: p.id as number })))}`;
      return p.id as number;
    });
    listo();
    redirect(`/banco/deudas/${id}`);
  });
}

export async function editarPasivo(_: Estado, f: FormData): Promise<Estado> {
  await exigirAdmin();
  return intentar(async () => {
    const id = entero(f, 'id') ?? falla('Falta el préstamo.');
    const tipo = texto(f, 'tipo', 12);
    if (!TIPOS_PASIVO.includes(tipo)) falla('Elegí qué es.');
    const sql = db();
    await sql`update pasivos set ${sql({
      tipo, nombre: texto(f, 'nombre', 100) || falla('Poné un nombre.'), acreedor: texto(f, 'acreedor', 100),
      rubro_id: entero(f, 'rubro_id'), notas: texto(f, 'notas', 1000), activo: tilde(f, 'activo'),
    })} where id = ${id}`;
    listo();
    return { ok: 'Guardado.' };
  });
}

export async function borrarPasivo(f: FormData) {
  await exigirAdmin();
  const id = entero(f, 'id');
  if (id) await db()`delete from pasivos where id = ${id}`;
  listo();
  redirect('/banco/deudas');
}

export async function guardarCuota(_: Estado, f: FormData): Promise<Estado> {
  await exigirAdmin();
  return intentar(async () => {
    const id = entero(f, 'id');
    const pasivo = entero(f, 'pasivo_id') ?? falla('Falta el préstamo.');
    const c = {
      vencimiento: fechaForm(f, 'vencimiento', 'Poné el vencimiento.')!,
      capital: numero(f, 'capital', { min: 0 }), interes: numero(f, 'interes', { min: 0 }),
      iva: numero(f, 'iva', { min: 0 }), otros: numero(f, 'otros', { min: 0 }),
    };
    if (!c.capital && !c.interes && !c.iva && !c.otros) falla('La cuota no puede ser 0.');
    const sql = db();
    if (id) {
      const r = await sql`update pasivo_cuotas set ${sql(c)} where id = ${id} and pasivo_id = ${pasivo} and pagada_el is null returning id`;
      if (!r.length) falla('Esa cuota ya está pagada: deshacé el pago para cambiarla.');
    } else {
      const [{ n }] = await sql`select coalesce(max(numero), 0) + 1 n from pasivo_cuotas where pasivo_id = ${pasivo}`;
      await sql`insert into pasivo_cuotas ${sql({ ...c, pasivo_id: pasivo, numero: n as number })}`;
    }
    listo();
    return { ok: 'Guardado.' };
  });
}

export async function borrarCuota(f: FormData) {
  await exigirAdmin();
  const id = entero(f, 'id');
  if (id) await db()`delete from pasivo_cuotas where id = ${id} and pagada_el is null`;
  listo();
}

/** Marca la cuota pagada hoy. Si el préstamo tiene rubro, el interés, el IVA y los gastos de la cuota van a Gastos. */
export async function pagarCuota(f: FormData) {
  await exigirAdmin();
  const id = entero(f, 'id');
  if (!id) return;
  const pagar = f.get('pagada') !== 'no';
  await db().begin(async (tx) => {
    const [c] = await tx`
      select c.*, p.nombre, p.acreedor, p.moneda, p.rubro_id, (select count(*) from pasivo_cuotas x where x.pasivo_id = p.id)::int de
      from pasivo_cuotas c join pasivos p on p.id = c.pasivo_id where c.id = ${id} for update of c`;
    if (!c) return;
    if (!pagar) {
      await tx`update pasivo_cuotas set pagada_el = null, egreso_id = null where id = ${id}`;
      if (c.egreso_id) await tx`delete from egresos where id = ${c.egreso_id as number}`;
      return;
    }
    if (c.pagada_el) return;
    let egreso: number | null = null;
    const costo = Number(c.interes) + Number(c.otros);
    if (c.rubro_id && costo + Number(c.iva) > 0) {
      const prov = c.acreedor ? (await (await ListaProveedores.cargar(tx)).buscarOCrear(tx, c.acreedor as string, '', c.rubro_id as number)).id : null;
      const dolar = c.moneda === 'USD' ? Number((await tx`select valor->>'valor' v from ajustes where clave = 'dolar'`)[0]?.v) || null : 1;
      if (dolar) {
        [{ id: egreso }] = (await tx`insert into egresos ${tx({
          tipo: 'gasto', fecha: c.vencimiento as string, rubro_id: c.rubro_id as number, proveedor_id: prov, proveedor: '',
          comprobante: 'Resumen bancario', numero: '', descripcion: `Intereses y gastos cuota ${c.numero}/${c.de} · ${c.nombre}`,
          unidad: '', moneda: c.moneda as string, cotizacion: dolar, neto: costo, iva_alicuota: Number(c.iva) ? 21 : 0, iva: Number(c.iva), otros: 0,
          pagado: true, fecha_pago: hoy(), medio_pago: 'Débito automático', notas: 'Se cargó al pagar la cuota en Banco.', clave: `cuota|${id}`,
        })} returning id`) as unknown as { id: number }[];
      }
    }
    await tx`update pasivo_cuotas set pagada_el = ${hoy()}, egreso_id = ${egreso} where id = ${id}`;
  });
  listo('/gastos');
}

// ---------- gastos fijos ----------
export async function guardarFijo(_: Estado, f: FormData): Promise<Estado> {
  await exigirAdmin();
  return intentar(async () => {
    const id = entero(f, 'id');
    const desde = mesForm(f, 'desde', 'Poné desde qué mes.')!;
    const hasta = mesForm(f, 'hasta');
    if (hasta && hasta < desde) falla('El mes "hasta" es anterior a "desde".');
    const rubro_id = entero(f, 'rubro_id');
    const sql = db();
    await sql.begin(async (tx) => {
      if (rubro_id && !(await tx`select 1 from rubros where id = ${rubro_id} and tipo = 'gasto'`).length) falla('Elegí el rubro de gastos.');
      const x = {
        nombre: texto(f, 'nombre', 100) || falla('Poné el nombre (ej.: Alquiler depósito).'),
        monto: numero(f, 'monto', { requerido: 'Poné el monto de cada mes.', min: 0.01 }), moneda: moneda(f),
        dia: Math.min(Math.max(entero(f, 'dia') ?? 10, 1), 31), rubro_id, proveedor_id: await proveedorDe(tx, f, rubro_id),
        desde, hasta, notas: texto(f, 'notas', 500), activo: id ? tilde(f, 'activo') : true,
      };
      if (id) await tx`update fijos set ${tx(x)} where id = ${id}`;
      else await tx`insert into fijos ${tx(x)}`;
    });
    listo();
    redirect(volver(f, '/banco/fijos'));
  });
}

export async function borrarFijo(f: FormData) {
  await exigirAdmin();
  const id = entero(f, 'id');
  if (id) await db()`delete from fijos where id = ${id}`;
  listo();
}

/** Agrega como gasto fijo uno que se repite en Gastos (sugerencia). */
export async function agregarFijoSugerido(f: FormData) {
  await exigirAdmin();
  const nombre = texto(f, 'nombre', 100);
  const monto = Number(texto(f, 'monto'));
  if (!nombre || !(monto > 0)) return;
  const sql = db();
  await sql`insert into fijos ${sql({
    nombre, monto, moneda: 'ARS', dia: Math.min(Math.max(entero(f, 'dia') ?? 10, 1), 31), rubro_id: entero(f, 'rubro_id'),
    proveedor_id: entero(f, 'proveedor_id'), desde: `${hoy().slice(0, 7)}-01`, hasta: null, notas: 'Agregado desde las sugerencias.', activo: true,
  })}`;
  listo();
}
