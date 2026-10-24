// Semáforo de clientes: lo que deja cada cliente por mes, descontando el descuento, el costo del café, el plazo de
// pago, la comisión del medio de cobro y las máquinas que tiene instaladas (amortización, costo del capital y service).
// Puro: lo usan las páginas (el servidor carga los datos).
import { numero } from './formato';
import { claveNombre } from './proveedores';

export const INDICADORES = {
  margen: { nombre: 'Margen neto', unidad: '%', mejorAlto: true, ayuda: 'Resultado del mes sobre lo que paga el cliente' },
  recupero: { nombre: 'Recupero de las máquinas', unidad: 'meses', mejorAlto: false, ayuda: 'Meses para recuperar la inversión con lo que deja' },
  kgMaquina: { nombre: 'Kilos por máquina', unidad: 'kg/mes', mejorAlto: true, ayuda: 'Café por máquina de café instalada' },
  plazo: { nombre: 'Plazo de pago', unidad: 'días', mejorAlto: false, ayuda: 'Días que tarda en pagar' },
  descuento: { nombre: 'Descuento', unidad: '%', mejorAlto: false, ayuda: 'Descuento sobre la lista' },
} as const;
export type Indicador = keyof typeof INDICADORES;

export type Criterios = {
  productoId: number | null; // precio y costo del kilo desde un producto de Costos
  kgPorUnidad: number; // kilos de esa presentación
  precioKg: number | null; // a mano (sin IVA)
  costoKg: number | null;
  tasaMensual: number; // % por mes en pesos: costo del plazo de pago
  tasaMaquinasAnual: number; // % por año en dólares: costo del capital puesto en máquinas (su valor ya sigue al dólar)
  vidaUtilMeses: number; // amortización de las máquinas
  serviceMaquinaMes: number; // $ por equipo por mes (mantenimiento)
  rubrosCafe: string[] | null; // rubros de Contabilium que cuentan como café para los kilos (vacío = los que dicen "café")
  umbrales: Record<Indicador, [number, number]>; // [verde, rojo]
  pesos: Record<Indicador, number>;
};

export const CRITERIOS_DEFECTO: Criterios = {
  productoId: null,
  kgPorUnidad: 1,
  precioKg: null,
  costoKg: null,
  tasaMensual: 3,
  tasaMaquinasAnual: 10,
  vidaUtilMeses: 60,
  serviceMaquinaMes: 0,
  rubrosCafe: null,
  umbrales: { margen: [20, 5], recupero: [18, 36], kgMaquina: [40, 15], plazo: [7, 45], descuento: [5, 20] },
  pesos: { margen: 35, recupero: 25, kgMaquina: 20, plazo: 10, descuento: 10 },
};

/** Meses de recupero en texto: "nunca" si no deja nada para devolver la inversión. */
export const meses = (m: number | null) => (m == null || m === 0 ? '—' : m === Infinity ? 'nunca' : `${numero(m, m < 10 ? 1 : 0)} meses`);

/** Valor de una variable del semáforo en texto. */
export function textoIndicador(k: Indicador, v: number | null): string {
  if (v == null) return '—';
  if (k === 'margen') return `${numero(v, 1)} %`;
  if (k === 'recupero') return v === 0 ? 'sin máquinas' : meses(v);
  if (k === 'kgMaquina') return `${numero(v, 1)} kg`;
  if (k === 'plazo') return v ? `${numero(v)} días` : 'contado';
  return `${numero(v, 1)} %`;
}

export type Color = 'verde' | 'amarillo' | 'rojo' | 'gris';
export const colorDe = (p: number): Color => (p >= 67 ? 'verde' : p >= 40 ? 'amarillo' : 'rojo');

/** 100 en el umbral verde (o mejor), 0 en el rojo (o peor), lineal en el medio. */
export function puntaje(valor: number | null, [verde, rojo]: [number, number], mejorAlto: boolean): number {
  if (valor == null || !Number.isFinite(valor)) return mejorAlto ? 0 : valor === Infinity ? 0 : 100;
  if (verde === rojo) return (mejorAlto ? valor >= verde : valor <= verde) ? 100 : 0;
  const t = (valor - rojo) / (verde - rojo);
  return Math.round(Math.min(1, Math.max(0, t)) * 100);
}

export type ClienteBase = {
  id: number; nombre: string; alias: string[]; cuit: string; locales: number; kilos_mes: number | null; kilos_desde_ventas: boolean;
  descuento_pct: number; forma_pago: string; plazo_dias: number; comision_pct: number; precio_kg: number | null; notas: string; activo: boolean;
  email?: string; telefono?: string; direccion?: string; contabilium_id?: string;
};
export type Maquina = { id: number; categoria: string; descripcion: string; marca: string; numero: string; cliente: string; inversion: number | null };

/** A qué cliente corresponde un nombre (de un local en Activos o de una factura en Ventas): el de nombre más largo que lo empiece. */
export function asignador(clientes: Pick<ClienteBase, 'id' | 'nombre' | 'alias' | 'cuit'>[]) {
  const claves = clientes
    .flatMap((c) => [c.nombre, ...c.alias].map((n) => ({ id: c.id, k: claveNombre(n) })))
    .filter((x) => x.k.length >= 3)
    .sort((a, b) => b.k.length - a.k.length);
  const porCuit = new Map(clientes.filter((c) => c.cuit).map((c) => [c.cuit, c.id]));
  return (nombre: string, cuit = '') => {
    const c = cuit.replace(/\D/g, '');
    if (c && porCuit.has(c)) return porCuit.get(c)!;
    const k = claveNombre(nombre);
    return k ? (claves.find((x) => k === x.k || k.startsWith(x.k))?.id ?? null) : null;
  };
}

export type Resultado = ReturnType<typeof calcularCliente>;

export function calcularCliente(c: ClienteBase, maquinas: Maquina[], facturadoMes: number | null, cr: Criterios, kilosFacturados: number | null = null) {
  const precio = Number(c.precio_kg ?? cr.precioKg ?? 0);
  const costoKg = Number(cr.costoKg ?? 0);
  const desc = Number(c.descuento_pct) / 100;
  const tasa = Number(cr.tasaMensual) / 100;
  const plazo = Number(c.plazo_dias);
  const comision = Number(c.comision_pct) / 100;
  const faltan: string[] = [];
  if (!precio) faltan.push('el precio del kilo');
  if (!costoKg) faltan.push('el costo del kilo');
  const kilosVentas = facturadoMes != null && precio ? facturadoMes / (precio * (1 - desc)) : null;
  // Con los productos de cada venta (Contabilium), los kilos de café facturados; si no, estimados con lo facturado.
  const kilos = c.kilos_desde_ventas ? (kilosFacturados || kilosVentas || 0) : Number(c.kilos_mes ?? 0);
  if (!kilos) faltan.push(c.kilos_desde_ventas ? 'ventas de los últimos meses' : 'los kilos por mes');

  const bruto = kilos * precio;
  const descuento = bruto * desc;
  const neto = bruto - descuento;
  const costoCafe = kilos * costoKg;
  const margenBruto = neto - costoCafe;
  const financiero = neto * tasa * (plazo / 30);
  const cobro = neto * comision;
  const inversion = maquinas.reduce((a, m) => a + (m.inversion ?? 0), 0);
  const sinValor = maquinas.filter((m) => m.inversion == null).length;
  const amortizacion = inversion / Math.max(1, Number(cr.vidaUtilMeses));
  const capital = inversion * (Number(cr.tasaMaquinasAnual) / 100 / 12);
  const service = maquinas.length * Number(cr.serviceMaquinaMes);
  const costoMaquinas = amortizacion + capital + service;
  const resultado = margenBruto - financiero - cobro - costoMaquinas;
  // Lo que queda por mes para devolver la inversión (antes de amortizarla y de su costo de capital).
  const aporte = margenBruto - financiero - cobro - service;
  const cafeteras = maquinas.filter((m) => m.categoria === 'maquina').length;
  const valores: Record<Indicador, number | null> = {
    margen: neto > 0 ? (resultado / neto) * 100 : null,
    recupero: inversion > 0 ? (aporte > 0 ? inversion / aporte : Infinity) : 0,
    kgMaquina: cafeteras ? kilos / cafeteras : null,
    plazo,
    descuento: Number(c.descuento_pct),
  };
  const puntos = {} as Record<Indicador, number>;
  let suma = 0;
  let pesos = 0;
  for (const k of Object.keys(INDICADORES) as Indicador[]) {
    // Sin máquinas de café, "kilos por máquina" no cuenta.
    if (k === 'kgMaquina' && valores.kgMaquina == null) continue;
    puntos[k] = puntaje(valores[k], cr.umbrales[k], INDICADORES[k].mejorAlto);
    suma += puntos[k] * cr.pesos[k];
    pesos += cr.pesos[k];
  }
  const score = pesos ? Math.round(suma / pesos) : 0;
  const pierde = resultado < 0;
  const color: Color = faltan.length ? 'gris' : pierde ? 'rojo' : colorDe(score);
  // Kilos por mes que hacen falta para cubrir las máquinas (resultado = 0).
  const porKilo = precio * (1 - desc) * (1 - tasa * (plazo / 30) - comision) - costoKg;
  const kilosEquilibrio = costoMaquinas > 0 && porKilo > 0 ? costoMaquinas / porKilo : costoMaquinas > 0 ? null : 0;
  return {
    precio, costoKg, kilos, kilosVentas, kilosFacturados, bruto, descuento, neto, costoCafe, margenBruto, financiero, cobro, inversion, sinValor,
    amortizacion, capital, service, costoMaquinas, resultado, aporte, cafeteras, valores, puntos, score, color, pierde, faltan,
    porKilo, kilosEquilibrio,
  };
}

/** Criterios guardados, completando lo que falte con los de fábrica. */
export function criteriosCon(guardado: Partial<Criterios> | null): Criterios {
  const g = guardado ?? {};
  return {
    ...CRITERIOS_DEFECTO,
    ...g,
    umbrales: { ...CRITERIOS_DEFECTO.umbrales, ...(g.umbrales ?? {}) },
    pesos: { ...CRITERIOS_DEFECTO.pesos, ...(g.pesos ?? {}) },
  };
}
