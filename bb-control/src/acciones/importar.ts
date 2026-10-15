'use server';
// Importación desde Excel de compras, gastos, productos, insumos y proveedores. El navegador lee el archivo;
// acá se valida todo de nuevo antes de guardar.
import { revalidatePath } from 'next/cache';
import { leerDolar } from '@/lib/ajustes';
import { dolarDe } from '@/lib/dolar';
import { db } from '@/lib/db';
import { esFecha, hoy, redondear } from '@/lib/formato';
import { ErrorForm, entero } from '@/lib/form';
import { normalizar } from '@/lib/importar';
import { guardarItems, totalesItems, validarItems } from '@/lib/items';
import { ListaProveedores, limpiarCuit } from '@/lib/proveedores';
import { exigirAdmin } from '@/lib/sesion';

export type Resultado = { error?: string; nuevos?: number; actualizados?: number; detalle?: string; hasta?: string };

const s = (x: unknown, max: number) => (typeof x === 'string' ? x.trim().slice(0, max) : '');
const n = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && Math.abs(x) < 1e13 ? x : null);

type ComprobanteIn = {
  fila?: number; fecha?: string; vencimiento?: string | null; proveedor?: string; cuit?: string; comprobante?: string; numero?: string;
  rubro?: string; moneda?: string; cotizacion?: number; cotizacionAuto?: boolean; pagado?: boolean | null; notas?: string; items?: unknown[]; neto?: number; iva?: number; otros?: number;
};

export async function importarEgresos(datos: {
  tipo: 'compra' | 'gasto';
  archivo: string;
  rubroDefecto: number;
  pagado: boolean;
  actualizarCostos: boolean;
  comprobantes: ComprobanteIn[];
}): Promise<Resultado> {
  await exigirAdmin();
  const tipo = datos?.tipo === 'compra' ? 'compra' : 'gasto';
  const lista = Array.isArray(datos?.comprobantes) ? datos.comprobantes : [];
  if (!lista.length) return { error: 'No hay comprobantes para importar.' };
  if (lista.length > 10000) return { error: 'Demasiados comprobantes en un archivo (máximo 10.000).' };
  const sql = db();
  const rubros = await sql<{ id: number; nombre: string }[]>`select id, nombre from rubros where tipo = ${tipo}`;
  const rubroDefecto = rubros.find((r) => r.id === Number(datos.rubroDefecto));
  if (!rubroDefecto) return { error: 'Elegí el rubro para los comprobantes que no traen uno.' };
  const porNombre = new Map(rubros.map((r) => [normalizar(r.nombre), r.id]));
  const dolar = (await leerDolar())?.valor ?? null;

  try {
    // Validación completa antes de tocar la base.
    let sinRubro = 0;
    // El dólar BNA de cada fecha, una sola consulta por fecha.
    const memo = new Map<string, Promise<number | null>>();
    const dolarDel = (f: string) => {
      if (!memo.has(f)) memo.set(f, dolarDe(f));
      return memo.get(f)!;
    };
    const filas = await Promise.all(lista.map(async (c, i) => {
      const fila = Number(c?.fila) || i + 1;
      const fecha = s(c?.fecha, 10);
      if (!esFecha(fecha)) throw new ErrorForm(`Fila ${fila}: la fecha no es válida.`);
      const moneda = c.moneda === 'USD' ? 'USD' : 'ARS';
      const cotizacionAuto = moneda === 'USD' && c.cotizacionAuto === true;
      const pagadoFila = typeof c.pagado === 'boolean' ? c.pagado : !!datos.pagado;
      const cotizacion = moneda !== 'USD' ? 1 : cotizacionAuto ? ((await dolarDel(pagadoFila ? fecha : hoy())) ?? n(c.cotizacion)) : n(c.cotizacion);
      if (!cotizacion || cotizacion <= 0) throw new ErrorForm(`Fila ${fila}: falta la cotización del dólar.`);
      const items = validarItems(c.items);
      const t = items.length ? totalesItems(items) : { neto: n(c.neto), iva: n(c.iva), alicuota: 0 };
      if (t.neto == null || t.iva == null) throw new ErrorForm(`Fila ${fila}: los importes no son válidos.`);
      const otros = n(c.otros ?? 0);
      if (otros == null) throw new ErrorForm(`Fila ${fila}: las percepciones no son válidas.`);
      const rubroTxt = normalizar(c.rubro);
      let rubro_id = rubroTxt ? porNombre.get(rubroTxt) : undefined;
      if (!rubro_id) {
        rubro_id = rubroDefecto.id;
        if (rubroTxt) sinRubro++;
      }
      const vencimiento = s(c.vencimiento, 10);
      const pagado = typeof c.pagado === 'boolean' ? c.pagado : !!datos.pagado;
      const proveedor = s(c.proveedor, 120);
      const comprobante = s(c.comprobante, 40);
      const numero = s(c.numero, 40);
      const cuit = s(c.cuit, 20);
      const unidades = [...new Set(items.map((x) => x.unidad))];
      return {
        items,
        cuit,
        egreso: {
          tipo, fecha, rubro_id, proveedor, comprobante, numero,
          descripcion: items.length ? items[0].descripcion + (items.length > 1 ? ` y ${items.length - 1} más` : '') : s(c.notas, 300),
          cantidad: items.length && unidades.length === 1 && unidades[0] ? redondear(items.reduce((a, x) => a + x.cantidad, 0), 3) : null,
          unidad: items.length && unidades.length === 1 ? unidades[0] : '',
          moneda, cotizacion, cotizacion_auto: cotizacionAuto, neto: t.neto, iva_alicuota: t.alicuota, iva: t.iva, otros: redondear(otros),
          pagado, fecha_pago: pagado ? fecha : null, vencimiento: !pagado && esFecha(vencimiento) ? vencimiento : null,
          medio_pago: '', notas: items.length ? s(c.notas, 1000) : '',
          // Sin número, la clave usa fecha, proveedor y total: reimportar el mismo archivo no duplica.
          clave: numero
            ? `${tipo}|${normalizar(cuit || proveedor)}|${normalizar(comprobante)}|${normalizar(numero)}`
            : `${tipo}|${fecha}|${normalizar(cuit || proveedor)}|${normalizar(comprobante)}|sn|${redondear(t.neto + t.iva + otros)}`,
        },
      };
    }));

    const fechas = filas.map((f) => f.egreso.fecha).sort();
    const total = redondear(filas.reduce((a, f) => a + (f.egreso.neto + f.egreso.iva + f.egreso.otros) * f.egreso.cotizacion, 0));
    const r = await sql.begin(async (tx) => {
      const [imp] = await tx`
        insert into importaciones (tipo, archivo, filas, desde, hasta, total)
        values (${tipo}, ${s(datos.archivo, 160) || 'archivo'}, ${filas.length}, ${fechas[0]}, ${fechas[fechas.length - 1]}, ${total})
        returning id`;
      let nuevos = 0;
      let costos = 0;
      let proveedores = 0;
      const lista = await ListaProveedores.cargar(tx);
      for (const f of filas) {
        let proveedor_id: number | null = null;
        if (f.egreso.proveedor) {
          const p = await lista.buscarOCrear(tx, f.egreso.proveedor, f.cuit, f.egreso.rubro_id);
          proveedor_id = p.id;
          if (p.nuevo) proveedores++;
        }
        const e = { ...f.egreso, proveedor_id, importacion_id: imp.id as number };
        const [fila] = f.egreso.clave
          ? await tx`insert into egresos ${tx(e)} on conflict (clave) do update set
              fecha = excluded.fecha, rubro_id = excluded.rubro_id, proveedor = excluded.proveedor, proveedor_id = excluded.proveedor_id, comprobante = excluded.comprobante,
              numero = excluded.numero, descripcion = excluded.descripcion, cantidad = excluded.cantidad, unidad = excluded.unidad,
              moneda = excluded.moneda, cotizacion = excluded.cotizacion, cotizacion_auto = excluded.cotizacion_auto, neto = excluded.neto, iva_alicuota = excluded.iva_alicuota,
              iva = excluded.iva, otros = excluded.otros, importacion_id = excluded.importacion_id
            returning id, (xmax = 0) nuevo`
          : await tx`insert into egresos ${tx(e)} returning id, true nuevo`;
        if (fila.nuevo) nuevos++;
        costos += await guardarItems(tx, fila.id as number, f.items, {
          moneda: f.egreso.moneda as 'ARS' | 'USD', cotizacion: f.egreso.cotizacion, actualizarCostos: !!datos.actualizarCostos, dolar,
        });
      }
      await tx`update importaciones set nuevas = ${nuevos}, actualizadas = ${filas.length - nuevos} where id = ${imp.id}`;
      return { nuevos, costos, proveedores };
    });
    revalidatePath(tipo === 'compra' ? '/compras' : '/gastos');
    revalidatePath('/kpi');
    if (r.proveedores) revalidatePath('/proveedores');
    if (r.costos) revalidatePath('/costos', 'layout');
    const detalle = [
      sinRubro ? `${sinRubro} con un rubro que no existe quedaron en "${rubroDefecto.nombre}"` : '',
      r.costos ? `se actualizó el costo de ${r.costos} insumos` : '',
      r.proveedores ? `se ${r.proveedores === 1 ? 'agregó 1 proveedor nuevo' : `agregaron ${r.proveedores} proveedores nuevos`} a la lista` : '',
    ].filter(Boolean).join('; ');
    return { nuevos: r.nuevos, actualizados: filas.length - r.nuevos, detalle, hasta: fechas[fechas.length - 1] };
  } catch (e) {
    if (e instanceof ErrorForm) return { error: e.message };
    throw e;
  }
}

export async function importarProductos(datos: { archivo: string; filas: Record<string, unknown>[] }): Promise<Resultado> {
  await exigirAdmin();
  const lista = Array.isArray(datos?.filas) ? datos.filas.slice(0, 5000) : [];
  if (!lista.length) return { error: 'No hay productos para importar.' };
  const pct = (x: unknown, def: number | null) => {
    const v = n(x);
    return v == null ? def : Math.min(Math.max(v, 0), 95);
  };
  const sql = db();
  const r = await sql.begin(async (tx) => {
    let nuevos = 0;
    for (const p of lista) {
      const nombre = s(p.nombre, 100);
      if (!nombre) continue;
      const presentacion = s(p.presentacion, 60);
      const datosP = {
        nombre, presentacion, categoria: s(p.categoria, 60), notas: s(p.notas, 1000),
        iva_alicuota: pct(p.iva, null), precio: n(p.precio) != null ? redondear(Math.max(n(p.precio)!, 0)) : null,
        variables_pct: pct(p.variables, null), margen_objetivo: pct(p.margen, null),
      };
      const [existe] = await tx`select id from productos where lower(nombre) = lower(${nombre}) and lower(presentacion) = lower(${presentacion}) limit 1`;
      // Lo que no vino en el Excel no se pisa.
      const cambios = Object.fromEntries(Object.entries(datosP).filter(([k, v]) => v !== null && (v !== '' || k === 'nombre' || k === 'presentacion')));
      if (existe) await tx`update productos set ${tx(cambios)} where id = ${existe.id as number}`;
      else {
        await tx`insert into productos ${tx({ ...datosP, iva_alicuota: datosP.iva_alicuota ?? 21, precio: datosP.precio ?? 0, variables_pct: datosP.variables_pct ?? 0, margen_objetivo: datosP.margen_objetivo ?? 40 })}`;
        nuevos++;
      }
    }
    await tx`insert into importaciones (tipo, archivo, filas, nuevas, actualizadas) values ('producto', ${s(datos.archivo, 160) || 'archivo'}, ${lista.length}, ${nuevos}, ${lista.length - nuevos})`;
    return nuevos;
  });
  revalidatePath('/costos', 'layout');
  return { nuevos: r, actualizados: lista.length - r };
}

export async function importarInsumos(datos: { archivo: string; filas: Record<string, unknown>[] }): Promise<Resultado> {
  await exigirAdmin();
  const lista = Array.isArray(datos?.filas) ? datos.filas.slice(0, 5000) : [];
  if (!lista.length) return { error: 'No hay insumos para importar.' };
  const sql = db();
  const r = await sql.begin(async (tx) => {
    let nuevos = 0;
    for (const p of lista) {
      const nombre = s(p.nombre, 100);
      const costo = n(p.costo);
      if (!nombre || costo == null || costo < 0) continue;
      const i = {
        nombre, categoria: s(p.categoria, 60), unidad: s(p.unidad, 15) || 'u', moneda: p.moneda === 'USD' ? 'USD' : 'ARS',
        costo: redondear(costo, 4), actualizado: hoy(), notas: s(p.notas, 500),
      };
      const [existe] = await tx`select id from insumos where lower(nombre) = lower(${nombre})`;
      if (existe) {
        const { nombre: _n, ...cambios } = i;
        void _n;
        if (!cambios.categoria) delete (cambios as Partial<typeof cambios>).categoria;
        if (!cambios.notas) delete (cambios as Partial<typeof cambios>).notas;
        await tx`update insumos set ${tx(cambios)} where id = ${existe.id as number}`;
      } else {
        await tx`insert into insumos ${tx(i)}`;
        nuevos++;
      }
    }
    await tx`insert into importaciones (tipo, archivo, filas, nuevas, actualizadas) values ('insumo', ${s(datos.archivo, 160) || 'archivo'}, ${lista.length}, ${nuevos}, ${lista.length - nuevos})`;
    return nuevos;
  });
  revalidatePath('/costos', 'layout');
  return { nuevos: r, actualizados: lista.length - r };
}

export async function importarProveedores(datos: { archivo: string; filas: Record<string, unknown>[] }): Promise<Resultado> {
  await exigirAdmin();
  const lista = Array.isArray(datos?.filas) ? datos.filas.slice(0, 5000) : [];
  if (!lista.length) return { error: 'No hay proveedores para importar.' };
  const sql = db();
  const r = await sql.begin(async (tx) => {
    const rubros = new Map((await tx<{ id: number; nombre: string }[]>`select id, nombre from rubros order by tipo, orden`).map((x) => [normalizar(x.nombre), x.id]));
    const provs = await ListaProveedores.cargar(tx);
    let nuevos = 0;
    let vistos = 0;
    for (const p of lista) {
      const nombre = s(p.nombre, 120).replace(/\s+/g, ' ');
      if (!nombre) continue;
      vistos++;
      const cuitLimpio = limpiarCuit(p.cuit);
      const cuit = cuitLimpio.length === 11 ? cuitLimpio : '';
      const rubro_id = rubros.get(normalizar(p.rubro)) ?? null;
      const { id, nuevo } = await provs.buscarOCrear(tx, nombre, cuit, rubro_id);
      if (nuevo) nuevos++;
      // Lo que vino en el Excel completa o actualiza; lo que vino vacío no borra nada.
      const cambios = Object.fromEntries(
        Object.entries({ contacto: s(p.contacto, 120), telefono: s(p.telefono, 60), email: s(p.email, 120), cbu: s(p.cbu, 60), notas: s(p.notas, 1000) }).filter(([, v]) => v),
      ) as Record<string, string | number>;
      if (rubro_id) cambios.rubro_id = rubro_id;
      if (Object.keys(cambios).length) await tx`update proveedores set ${tx(cambios)} where id = ${id}`;
    }
    await tx`insert into importaciones (tipo, archivo, filas, nuevas, actualizadas) values ('proveedor', ${s(datos.archivo, 160) || 'archivo'}, ${lista.length}, ${nuevos}, ${vistos - nuevos})`;
    return { nuevos, vistos };
  });
  revalidatePath('/proveedores');
  return { nuevos: r.nuevos, actualizados: r.vistos - r.nuevos };
}

export async function importarEcheqs(datos: { archivo: string; sentido: string; cuenta: number; filas: Record<string, unknown>[] }): Promise<Resultado> {
  await exigirAdmin();
  const lista = Array.isArray(datos?.filas) ? datos.filas.slice(0, 5000) : [];
  if (!lista.length) return { error: 'No hay echeqs para importar.' };
  const sentido = datos.sentido === 'recibido' ? 'recibido' : 'emitido';
  const sql = db();
  const cuenta = Number(datos.cuenta) ? (await sql`select id from cuentas_banco where id = ${Number(datos.cuenta)}`)[0]?.id as number | undefined : undefined;
  const ESTADOS = ['pendiente', 'pagado', 'anulado', 'rechazado'];
  try {
    const r = await sql.begin(async (tx) => {
      const provs = await ListaProveedores.cargar(tx);
      const [imp] = await tx`insert into importaciones (tipo, archivo, filas) values ('echeq', ${s(datos.archivo, 160) || 'archivo'}, ${lista.length}) returning id`;
      let nuevos = 0;
      let vistos = 0;
      let vinculadas = 0;
      for (const [i, e] of lista.entries()) {
        const pago = s(e.pago, 10);
        const monto = n(e.monto);
        if (!esFecha(pago) || !monto || monto <= 0) throw new ErrorForm(`Fila ${Number(e.fila) || i + 1}: falta la fecha de pago o el monto.`);
        const emision = s(e.emision, 10);
        const numero = s(e.numero, 40);
        const banco = s(e.banco, 60);
        const tercero = s(e.tercero, 120);
        const cuit = limpiarCuit(e.cuit);
        // Al beneficiario de un emitido se lo busca en la lista de proveedores (no se crea).
        const prov = sentido === 'emitido' && (tercero || cuit) ? provs.buscar(tercero, cuit) : null;
        const fila = {
          sentido, cuenta_id: cuenta ?? null, numero, banco, proveedor_id: prov?.id ?? null, tercero, cuit,
          emision: esFecha(emision) ? emision : null, pago, moneda: 'ARS', monto: redondear(monto),
          estado: ESTADOS.includes(String(e.estado)) ? String(e.estado) : 'pendiente', notas: s(e.notas, 300),
          clave: numero ? `${sentido}|${cuenta ?? normalizar(banco)}|${normalizar(numero)}` : `${sentido}|${pago}|${redondear(monto)}|${normalizar(tercero || cuit)}`,
          importacion_id: imp.id as number,
        };
        const [x] = await tx`insert into echeqs ${tx({ ...fila, cerrado_el: fila.estado === 'pendiente' ? null : hoy() })}
          on conflict (clave) do update set pago = excluded.pago, monto = excluded.monto, emision = coalesce(excluded.emision, echeqs.emision),
            tercero = excluded.tercero, cuit = excluded.cuit, proveedor_id = coalesce(echeqs.proveedor_id, excluded.proveedor_id),
            estado = case when excluded.estado = 'pendiente' then echeqs.estado else excluded.estado end,
            cerrado_el = case when excluded.estado = 'pendiente' or echeqs.estado = excluded.estado then echeqs.cerrado_el else excluded.cerrado_el end,
            importacion_id = excluded.importacion_id
          returning id, estado, proveedor_id, (xmax = 0) nuevo`;
        vistos++;
        if (x.nuevo) nuevos++;
        // Si paga una factura sin pagar del mismo proveedor y por el mismo monto, queda vinculada y pagada.
        if (sentido === 'emitido' && x.proveedor_id && (x.estado === 'pendiente' || x.estado === 'pagado')
          && !(await tx`select 1 from echeq_egresos where echeq_id = ${x.id as number}`).length) {
          const facturas = await tx`select id from egresos where proveedor_id = ${x.proveedor_id as number} and not pagado
                                    and abs(total_ars - ${redondear(monto)}) <= 1 limit 2`;
          if (facturas.length === 1) {
            await tx`insert into echeq_egresos (echeq_id, egreso_id) values (${x.id as number}, ${facturas[0].id as number})`;
            await tx`update egresos set pagado = true, fecha_pago = ${pago}, vencimiento = null, medio_pago = 'Cheque / Echeq',
                     cotizacion = case when moneda = 'USD' and cotizacion_auto then coalesce((select (valor->>'valor')::numeric from ajustes where clave = 'dolar'), cotizacion) else cotizacion end where id = ${facturas[0].id as number}`;
            vinculadas++;
          }
        }
      }
      await tx`update importaciones set nuevas = ${nuevos}, actualizadas = ${vistos - nuevos} where id = ${imp.id}`;
      return { nuevos, vistos, vinculadas };
    });
    revalidatePath('/banco', 'layout');
    revalidatePath('/kpi');
    if (r.vinculadas) {
      revalidatePath('/compras');
      revalidatePath('/gastos');
    }
    return {
      nuevos: r.nuevos, actualizados: r.vistos - r.nuevos,
      detalle: r.vinculadas ? `${r.vinculadas === 1 ? 'se marcó pagada 1 factura' : `se marcaron pagadas ${r.vinculadas} facturas`} que coincide${r.vinculadas === 1 ? '' : 'n'} en proveedor y monto` : '',
    };
  } catch (e) {
    if (e instanceof ErrorForm) return { error: e.message };
    throw e;
  }
}

export async function importarActivos(datos: { archivo: string; categoria: string; moneda: string; filas: Record<string, unknown>[] }): Promise<Resultado> {
  await exigirAdmin();
  const lista = Array.isArray(datos?.filas) ? datos.filas.slice(0, 5000) : [];
  if (!lista.length) return { error: 'No hay activos para importar.' };
  const CATS = ['maquina', 'molinillo', 'tostadora', 'vehiculo', 'equipo', 'otro'];
  const ESTADOS = ['cliente', 'deposito', 'uso', 'reparacion', 'baja'];
  const categoriaDefecto = CATS.includes(datos.categoria) ? datos.categoria : 'maquina';
  const monedaDefecto = datos.moneda === 'ARS' ? 'ARS' : 'USD';
  const sql = db();
  const r = await sql.begin(async (tx) => {
    let nuevos = 0;
    let vistos = 0;
    for (const a of lista) {
      const descripcion = s(a.descripcion, 160);
      if (!descripcion) continue;
      vistos++;
      const categoria = CATS.includes(String(a.categoria)) ? String(a.categoria) : categoriaDefecto;
      const numero = s(a.numero, 60);
      const cliente = s(a.cliente, 120);
      const instalada = s(a.instalada, 10);
      const valor = n(a.valor);
      const costo = n(a.costo);
      const fila = {
        categoria, numero, descripcion, marca: s(a.marca, 60), modelo: s(a.modelo, 60), cliente, ubicacion: s(a.ubicacion, 160),
        estado: ESTADOS.includes(String(a.estado)) ? String(a.estado) : cliente ? 'cliente' : ['vehiculo', 'tostadora'].includes(categoria) ? 'uso' : 'deposito',
        instalada: esFecha(instalada) ? instalada : null, moneda: a.moneda === 'ARS' || a.moneda === 'USD' ? String(a.moneda) : monedaDefecto,
        valor_estimado: valor != null && valor >= 0 ? redondear(valor) : null, costo_mercaderia: costo != null && costo >= 0 ? redondear(costo) : null,
        notas: s(a.notas, 1000),
        clave: numero ? `${categoria}|${normalizar(numero)}` : `${categoria}|${normalizar(descripcion)}|${normalizar(cliente)}|sn`,
      };
      // Lo que no vino en el Excel no se pisa.
      const [x] = await tx`insert into activos ${tx(fila)} on conflict (clave) do update set
          descripcion = excluded.descripcion, marca = coalesce(nullif(excluded.marca, ''), activos.marca), modelo = coalesce(nullif(excluded.modelo, ''), activos.modelo),
          cliente = case when excluded.cliente <> '' then excluded.cliente else activos.cliente end,
          ubicacion = coalesce(nullif(excluded.ubicacion, ''), activos.ubicacion), estado = excluded.estado,
          instalada = coalesce(excluded.instalada, activos.instalada), valor_estimado = coalesce(excluded.valor_estimado, activos.valor_estimado),
          costo_mercaderia = coalesce(excluded.costo_mercaderia, activos.costo_mercaderia), notas = coalesce(nullif(excluded.notas, ''), activos.notas)
        returning (xmax = 0) nuevo`;
      if (x.nuevo) nuevos++;
    }
    await tx`insert into importaciones (tipo, archivo, filas, nuevas, actualizadas) values ('activo', ${s(datos.archivo, 160) || 'archivo'}, ${lista.length}, ${nuevos}, ${vistos - nuevos})`;
    return { nuevos, vistos };
  });
  revalidatePath('/activos', 'layout');
  return { nuevos: r.nuevos, actualizados: r.vistos - r.nuevos };
}

/** Deshace una importación de compras o gastos: borra los comprobantes que vinieron con ella. */
export async function deshacerImportacionEgresos(f: FormData) {
  await exigirAdmin();
  const id = entero(f, 'id');
  if (!id) return;
  await db().begin(async (sql) => {
    await sql`delete from egresos where importacion_id = ${id}`;
    await sql`delete from importaciones where id = ${id} and tipo in ('compra', 'gasto')`;
  });
  revalidatePath('/compras');
  revalidatePath('/gastos');
  revalidatePath('/kpi');
}
