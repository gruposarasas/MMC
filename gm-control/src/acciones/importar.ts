'use server';
// Importación desde Excel de compras, gastos, productos, insumos y proveedores. El navegador lee el archivo;
// acá se valida todo de nuevo antes de guardar.
import { revalidatePath } from 'next/cache';
import { leerDolar } from '@/lib/ajustes';
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
  rubro?: string; moneda?: string; cotizacion?: number; pagado?: boolean | null; notas?: string; items?: unknown[]; neto?: number; iva?: number; otros?: number;
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
    const filas = lista.map((c, i) => {
      const fila = Number(c?.fila) || i + 1;
      const fecha = s(c?.fecha, 10);
      if (!esFecha(fecha)) throw new ErrorForm(`Fila ${fila}: la fecha no es válida.`);
      const moneda = c.moneda === 'USD' ? 'USD' : 'ARS';
      const cotizacion = moneda === 'USD' ? n(c.cotizacion) : 1;
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
          moneda, cotizacion, neto: t.neto, iva_alicuota: t.alicuota, iva: t.iva, otros: redondear(otros),
          pagado, fecha_pago: pagado ? fecha : null, vencimiento: !pagado && esFecha(vencimiento) ? vencimiento : null,
          medio_pago: '', notas: items.length ? s(c.notas, 1000) : '',
          // Sin número, la clave usa fecha, proveedor y total: reimportar el mismo archivo no duplica.
          clave: numero
            ? `${tipo}|${normalizar(cuit || proveedor)}|${normalizar(comprobante)}|${normalizar(numero)}`
            : `${tipo}|${fecha}|${normalizar(cuit || proveedor)}|${normalizar(comprobante)}|sn|${redondear(t.neto + t.iva + otros)}`,
        },
      };
    });

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
              moneda = excluded.moneda, cotizacion = excluded.cotizacion, neto = excluded.neto, iva_alicuota = excluded.iva_alicuota,
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
