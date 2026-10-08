'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { leerDolar } from '@/lib/ajustes';
import { guardarArchivo } from '@/lib/archivos';
import { db } from '@/lib/db';
import { fecha, hoy } from '@/lib/formato';
import { guardarItems, totalesItems, validarItems } from '@/lib/items';
import { type Estado, entero, falla, fechaForm, intentar, numero, texto, tilde, volver } from '@/lib/form';
import { ListaProveedores, limpiarCuit } from '@/lib/proveedores';
import { exigirAdmin } from '@/lib/sesion';

const ruta = (tipo: string) => (tipo === 'compra' ? '/compras' : '/gastos');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function guardarEgreso(_: Estado, f: FormData): Promise<Estado> {
  await exigirAdmin();
  return intentar(async () => {
    const tipo = texto(f, 'tipo') === 'compra' ? 'compra' : 'gasto';
    const id = entero(f, 'id');
    const rubro_id = entero(f, 'rubro_id') ?? falla('Elegí el rubro.');
    const sql = db();
    const [rubro] = await sql`select tipo from rubros where id = ${rubro_id}`;
    if (!rubro || rubro.tipo !== tipo) falla('Elegí el rubro.');
    const moneda = texto(f, 'moneda') === 'USD' ? 'USD' : 'ARS';
    const fecha = fechaForm(f, 'fecha', 'Poné la fecha.')!;
    const pagado = tilde(f, 'pagado');
    const porItems = texto(f, 'modo') === 'items';
    let items: ReturnType<typeof validarItems> = [];
    if (porItems) {
      try {
        items = validarItems(JSON.parse(texto(f, 'items', 500_000) || '[]'));
      } catch (err) {
        if (err instanceof SyntaxError) falla('No se pudieron leer los productos. Probá de nuevo.');
        throw err;
      }
      if (!items.length) falla('Agregá al menos un producto, o elegí "Solo el total".');
    }
    const t = totalesItems(items);
    const unidades = [...new Set(items.map((i) => i.unidad))];
    const descripcion = texto(f, 'descripcion', 300) || (items.length ? items[0].descripcion + (items.length > 1 ? ` y ${items.length - 1} más` : '') : '');
    const e = {
      tipo,
      fecha,
      rubro_id,
      comprobante: texto(f, 'comprobante', 40),
      numero: texto(f, 'numero', 40),
      descripcion,
      // Si todos los renglones tienen la misma unidad, se guarda la cantidad total (ej.: kg de café).
      cantidad: porItems && unidades.length === 1 && unidades[0] ? items.reduce((a, i) => a + i.cantidad, 0) : null,
      unidad: porItems && unidades.length === 1 ? unidades[0] : '',
      moneda,
      cotizacion: moneda === 'USD' ? numero(f, 'cotizacion', { requerido: 'Poné la cotización del dólar.', min: 0.0001, dec: 4 }) : 1,
      neto: porItems ? t.neto : numero(f, 'neto'),
      iva_alicuota: porItems ? t.alicuota : numero(f, 'iva_alicuota', { min: 0, max: 100 }),
      iva: porItems ? t.iva : numero(f, 'iva'),
      otros: numero(f, 'otros'),
      pagado,
      fecha_pago: pagado ? (fechaForm(f, 'fecha_pago') ?? fecha) : null,
      vencimiento: pagado ? null : fechaForm(f, 'vencimiento'),
      medio_pago: texto(f, 'medio_pago', 40),
      notas: texto(f, 'notas', 1000),
    };
    if (!e.neto && !e.iva && !e.otros) falla(porItems ? 'Poné los precios de los productos.' : 'Poné el importe.');
    // El proveedor se elige de la lista; uno nuevo se agrega a la lista al guardar.
    const provId = entero(f, 'proveedor_id');
    const provNuevo = texto(f, 'proveedor_nuevo', 120).replace(/\s+/g, ' ');
    const provCuit = limpiarCuit(texto(f, 'proveedor_cuit', 20));
    if (provNuevo && provCuit && provCuit.length !== 11) falla('El CUIT del proveedor nuevo tiene que tener 11 números.');
    if (!provId && !provNuevo) {
      if (tipo === 'compra') falla('Elegí el proveedor.');
      if (!e.descripcion) falla('Elegí el proveedor o poné un detalle.');
    }
    // La foto o el PDF: el leído con la cámara o uno adjuntado a mano.
    const leido = texto(f, 'archivo_id', 40);
    if (leido && (!UUID.test(leido) || !(await sql`select 1 from lecturas_factura where archivo_id = ${leido} and tipo = ${tipo}`).length)) {
      falla('No se encontró la foto de la factura. Leela de nuevo.');
    }
    const archivo_id = (await guardarArchivo(f, 'adjunto')) ?? (leido || null);
    const dolar = (await leerDolar())?.valor ?? null;
    await sql.begin(async (tx) => {
      let proveedor_id: number | null = null;
      if (provId) {
        if (!(await tx`select 1 from proveedores where id = ${provId}`).length) falla('Elegí el proveedor de la lista.');
        proveedor_id = provId;
      } else if (provNuevo) {
        proveedor_id = (await (await ListaProveedores.cargar(tx)).buscarOCrear(tx, provNuevo, provCuit, rubro_id)).id;
      }
      const datos = { ...e, proveedor_id, proveedor: '', ...(archivo_id ? { archivo_id } : {}) };
      let egresoId = id;
      if (id) {
        const [antes] = await tx`select archivo_id from egresos where id = ${id} and tipo = ${tipo} for update`;
        if (!antes) falla('No se encontró el comprobante.');
        await tx`update egresos set ${tx(datos)} where id = ${id}`;
        if (archivo_id && antes.archivo_id && antes.archivo_id !== archivo_id) await tx`delete from archivos where id = ${antes.archivo_id as string}`;
      } else {
        [{ id: egresoId }] = (await tx`insert into egresos ${tx(datos)} returning id`) as unknown as { id: number }[];
      }
      if (leido) await tx`delete from lecturas_factura where archivo_id = ${leido}`;
      await guardarItems(tx, egresoId!, items, { moneda, cotizacion: e.cotizacion, actualizarCostos: tilde(f, 'actualizar_costos'), dolar });
    });
    revalidatePath('/costos', 'layout');
    if (provNuevo) revalidatePath('/proveedores');
    revalidatePath(ruta(tipo));
    redirect(volver(f, ruta(tipo)));
  });
}

export async function borrarEgreso(f: FormData) {
  await exigirAdmin();
  const id = entero(f, 'id');
  if (id) {
    const sql = db();
    const [e] = await sql`delete from egresos where id = ${id} returning archivo_id`;
    if (e?.archivo_id) await sql`delete from archivos where id = ${e.archivo_id as string}`;
  }
  revalidatePath('/compras');
  revalidatePath('/gastos');
}

export async function marcarPagado(f: FormData) {
  await exigirAdmin();
  const id = entero(f, 'id');
  if (!id) return;
  await db().begin(async (tx) => {
    await tx`update egresos set pagado = true, fecha_pago = ${hoy()}, vencimiento = null where id = ${id}`;
    // Si es el F.931 o los Ingresos Brutos que cargó el contador, también queda pagado en Contabilidad.
    const [o] = await tx`update contab_obligaciones set pagado_el = ${hoy()}, pagado_por = 'Administración'
                         where egreso_id = ${id} and pagado_el is null and monto is not null returning id`;
    if (o) await tx`insert into contab_historial (obligacion_id, quien, que) values (${o.id as number}, 'Administración', ${`La marcó pagada desde Gastos el ${fecha(hoy())}`})`;
  });
  revalidatePath('/compras');
  revalidatePath('/gastos');
  revalidatePath('/contabilidad', 'layout');
}
