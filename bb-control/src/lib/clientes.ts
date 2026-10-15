// Datos del semáforo de clientes: criterios, clientes, sus máquinas (de Activos) y lo facturado (de Ventas). Solo servidor.
import { type Importacion, reposicionActivo } from './activos';
import { leerAjuste, leerDolar } from './ajustes';
import { calcular } from './costos';
import { datosCostos } from './datosCostos';
import { db } from './db';
import { mesActual, sumarMeses } from './formato';
import { asignador, calcularCliente, type ClienteBase, type Criterios, criteriosCon, type Maquina } from './semaforo';

type Activo = {
  id: number; categoria: string; descripcion: string; marca: string; numero: string; cliente: string; moneda: 'ARS' | 'USD';
  costo_mercaderia: number | null; costo_otros: number; importacion_id: number | null; valor_estimado: number | null;
};

export const MESES_VENTAS = 3;

export async function criterios() {
  const sql = db();
  const [guardado, dolar] = await Promise.all([leerAjuste<Partial<Criterios>>('semaforo'), leerDolar()]);
  const cr = criteriosCon(guardado);
  let origen: string | null = null;
  // Precio y costo del kilo desde un producto de Costos (su costo sigue al dólar del día).
  if (cr.productoId) {
    const [p] = await sql`select * from productos where id = ${cr.productoId}`;
    if (p) {
      const { mapa, receta } = await datosCostos();
      const r = calcular(
        { precio: Number(p.precio), iva_alicuota: Number(p.iva_alicuota), variables_pct: Number(p.variables_pct), margen_objetivo: Number(p.margen_objetivo) },
        receta.filter((x) => x.producto_id === p.id), mapa, dolar?.valor ?? null,
      );
      const kg = Number(cr.kgPorUnidad) || 1;
      cr.precioKg = Number(p.precio) / kg;
      cr.costoKg = r.directo / kg;
      origen = `${p.nombre}${p.presentacion ? ` (${p.presentacion})` : ''}`;
    }
  }
  return { cr, origen, dolar: dolar?.valor ?? null };
}

export async function datosSemaforo() {
  const sql = db();
  const hasta = `${mesActual()}-01`;
  const desde = `${sumarMeses(mesActual(), -MESES_VENTAS)}-01`;
  const [{ cr, origen, dolar }, clientes, activos, importaciones, ventas] = await Promise.all([
    criterios(),
    sql<ClienteBase[]>`select * from clientes order by lower(nombre)`,
    sql<Activo[]>`select id, categoria, descripcion, marca, numero, cliente, moneda, costo_mercaderia, costo_otros, importacion_id, valor_estimado
                  from activos where estado = 'cliente' order by cliente, descripcion`,
    sql<Importacion[]>`select * from activo_importaciones`,
    sql<{ cliente: string; cuit: string; neto: number }[]>`
      select cliente, cuit, coalesce(sum(neto), 0) neto from ventas where fecha >= ${desde} and fecha < ${hasta} group by 1, 2`,
  ]);
  const lotes = new Map(importaciones.map((l) => [l.id, l]));
  const activosDe = (c: ClienteBase) => c.activo;
  const asignar = asignador(clientes.filter(activosDe));

  // Inversión de cada equipo: costo de reposición al dólar de hoy; si no tiene costo, su valor estimado.
  const maquinasPor = new Map<number, Maquina[]>();
  const sinCliente: (Maquina & { inversion: number | null })[] = [];
  for (const a of activos) {
    const rep = reposicionActivo(a, a.importacion_id ? lotes.get(a.importacion_id) : null, dolar);
    const estimado = a.valor_estimado == null ? null : Number(a.valor_estimado) * (a.moneda === 'USD' ? (dolar ?? 0) : 1) || null;
    const m: Maquina = { id: a.id, categoria: a.categoria, descripcion: a.descripcion, marca: a.marca, numero: a.numero, cliente: a.cliente, inversion: rep ?? estimado };
    const id = asignar(a.cliente);
    if (id == null) sinCliente.push(m);
    else maquinasPor.set(id, [...(maquinasPor.get(id) ?? []), m]);
  }
  const facturado = new Map<number, number>();
  for (const v of ventas) {
    const id = asignar(v.cliente, v.cuit);
    if (id != null) facturado.set(id, (facturado.get(id) ?? 0) + Number(v.neto));
  }
  const filas = clientes.map((c) => {
    const maquinas = maquinasPor.get(c.id) ?? [];
    const fact = facturado.has(c.id) ? facturado.get(c.id)! / MESES_VENTAS : null;
    return { c, maquinas, facturadoMes: fact, r: calcularCliente(c, maquinas, fact, cr) };
  });
  return { cr, origen, dolar, filas, sinCliente, desde, hasta };
}
