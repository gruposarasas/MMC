// Importación de compras, gastos, productos e insumos desde Excel o CSV.
// Corre en el navegador: reconoce las columnas, arma los datos y el servidor vuelve a validar.
import { aNumero, redondear } from './formato';
import { aFecha, type Celda, esNotaCredito, normalizar } from './importar';

export type TipoImportacion = 'compra' | 'gasto' | 'producto' | 'insumo' | 'proveedor';
type Def = { id: string; nombre: string; re: RegExp; suma?: boolean };
export type Esquema = { campos: Def[]; requiere: string[][]; modelo: string[][]; ayuda: string };

const NUMERO = /^(n(ro|umero|um)?( de)?( comprobante| cbte| factura)?|comprobante n(ro|umero)?|n(ro|umero) desde|factura n(ro|umero)?)$/;
const PV = /^(punto( de)? venta|pto( de)? vta|pto( de)? venta|p ?v|pv)$/;

const EGRESO: Esquema = {
  ayuda: 'Una fila por producto (varias filas con el mismo número de comprobante forman una factura) o una fila por comprobante con sus totales.',
  campos: [
    { id: 'fecha', nombre: 'Fecha', re: /^fecha( de)?( emision| comprobante| cbte| factura| compra)?$/ },
    { id: 'vencimiento', nombre: 'Vencimiento', re: /^(vencimiento|fecha( de)? (vencimiento|vto|pago)|vto)$/ },
    { id: 'proveedor', nombre: 'Proveedor', re: /^(proveedor|razon social|denominacion( emisor| vendedor)?|nombre( proveedor)?|emisor)$/ },
    { id: 'cuit', nombre: 'CUIT', re: /^(cuit( proveedor| emisor| dni)?|nro doc( emisor)?|documento)$/ },
    { id: 'comprobante', nombre: 'Tipo de comprobante', re: /^(tipo( de)?( comprobante| cbte)?|comprobante|cbte tipo|tipo cbte)$/ },
    { id: 'puntoVenta', nombre: 'Punto de venta', re: PV },
    { id: 'numero', nombre: 'Número', re: NUMERO },
    { id: 'rubro', nombre: 'Rubro', re: /^(rubro|categoria|cuenta|tipo( de)? gasto|clasificacion|concepto( de)? gasto)$/ },
    { id: 'producto', nombre: 'Producto / detalle', re: /^(producto|articulo|item|descripcion( del)?( producto| articulo| item)?|detalle|concepto)$/ },
    { id: 'cantidad', nombre: 'Cantidad', re: /^(cant(idad)?|unidades|kilos)$/ },
    { id: 'unidad', nombre: 'Unidad', re: /^(unidad( de medida)?|u ?m|medida)$/ },
    { id: 'precio', nombre: 'Precio unitario sin IVA', re: /^(precio( unitario| unit| u)?( sin iva| neto| s iva)?|p ?unit(ario)?|costo unitario|valor unitario)$/ },
    { id: 'alicuota', nombre: 'Alícuota de IVA (%)', re: /^(alicuota( de)?( iva)?|% ?iva|iva ?%|tasa( de)? iva)$/ },
    { id: 'neto', nombre: 'Neto sin IVA (se suman)', suma: true, re: /^((imp(orte)? )?(neto( gravado| no gravado)?|no gravado|exento|op exentas|subtotal( sin iva)?)( \d.*)?|imp neto gravado|imp op exentas)$/ },
    { id: 'iva', nombre: 'IVA $ (se suman)', suma: true, re: /^(imp(orte)? |total )?iva( \d+([ ,]\d+)?( ?%)?)?$/ },
    { id: 'otros', nombre: 'Percepciones / otros (se suman)', suma: true, re: /(percep|otros tributos|otros impuestos|imp(uestos)? internos|retenc)/ },
    { id: 'total', nombre: 'Total con IVA', re: /^((imp(orte)? )?total( comprobante| con iva| ars| factura)?|monto( total)?|importe)$/ },
    { id: 'moneda', nombre: 'Moneda', re: /^moneda$/ },
    { id: 'cotizacion', nombre: 'Cotización', re: /^(cotizacion|tipo( de)? cambio|tc)$/ },
    { id: 'pagado', nombre: 'Pagado / estado', re: /^(estado( de pago)?|pagad[oa]|pago)$/ },
    { id: 'notas', nombre: 'Notas', re: /^(notas?|observaciones?|comentarios?)$/ },
  ],
  requiere: [['fecha', 'precio'], ['fecha', 'total'], ['fecha', 'neto']],
  modelo: [
    ['Fecha', 'Proveedor', 'CUIT', 'Comprobante', 'Número', 'Rubro', 'Producto', 'Cantidad', 'Unidad', 'Precio unitario sin IVA', 'IVA %', 'Percepciones', 'Pagado'],
    ['05/10/2026', 'Molino Cuyano', '30-12345678-9', 'Factura A', '0001-00001234', 'Harinas y premezclas', 'Harina 000 x 25 kg', '40', 'u', '18500', '10,5', '', 'Sí'],
    ['05/10/2026', 'Molino Cuyano', '30-12345678-9', 'Factura A', '0001-00001234', 'Harinas y premezclas', 'Harina 0000 x 25 kg', '20', 'u', '21000', '10,5', '', 'Sí'],
    ['07/10/2026', 'Lácteos del Valle', '30-98765432-1', 'Factura A', '0003-00000456', 'Lácteos, huevos y quesos', 'Manteca x 5 kg', '12', 'u', '42000', '21', '3500', 'No'],
  ],
};

const PRODUCTO: Esquema = {
  ayuda: 'Una fila por producto. Si ya existe uno con el mismo nombre y presentación, se actualiza.',
  campos: [
    { id: 'nombre', nombre: 'Nombre', re: /^(nombre|producto|articulo|descripcion|item)$/ },
    { id: 'categoria', nombre: 'Categoría', re: /^(categoria|rubro|familia|linea)$/ },
    { id: 'presentacion', nombre: 'Presentación', re: /^(presentacion|formato|tamano|peso|envase)$/ },
    { id: 'precio', nombre: 'Precio de venta sin IVA', re: /^(precio( de)?( venta)?( sin iva| neto| s iva)?|precio lista)$/ },
    { id: 'precioIva', nombre: 'Precio con IVA', re: /^(precio( de venta)? (con|c) iva|precio final|pvp|precio publico)$/ },
    { id: 'iva', nombre: 'IVA %', re: /^(iva|alicuota( de)?( iva)?|% ?iva|iva ?%)$/ },
    { id: 'variables', nombre: 'Costos variables %', re: /^(costos? variables?( %)?|comision(es)?( %)?|variables( %)?)$/ },
    { id: 'margen', nombre: 'Margen objetivo %', re: /^margen( objetivo)?( %)?$/ },
    { id: 'notas', nombre: 'Notas', re: /^(notas?|observaciones?)$/ },
  ],
  requiere: [['nombre']],
  modelo: [
    ['Nombre', 'Categoría', 'Presentación', 'Precio sin IVA', 'IVA %', 'Costos variables %', 'Margen objetivo %'],
    ['Medialunas de manteca', 'Panificados', 'Docena', '9000', '21', '5', '40'],
    ['Sorrentinos de osobuco', 'Pastas', 'Caja x 12', '14000', '21', '5', '45'],
  ],
};

const INSUMO: Esquema = {
  ayuda: 'Una fila por insumo, con su costo por unidad sin IVA. Si ya existe uno con el mismo nombre, se actualiza el costo.',
  campos: [
    { id: 'nombre', nombre: 'Nombre', re: /^(nombre|insumo|producto|articulo|descripcion|item|materia prima)$/ },
    { id: 'categoria', nombre: 'Categoría', re: /^(categoria|rubro|familia)$/ },
    { id: 'unidad', nombre: 'Unidad', re: /^(unidad( de medida)?|u ?m|medida)$/ },
    { id: 'moneda', nombre: 'Moneda', re: /^moneda$/ },
    { id: 'costo', nombre: 'Costo por unidad sin IVA', re: /^(costo( unitario| por unidad| unit)?( sin iva| neto)?|precio( unitario| de compra| compra)?( sin iva| neto)?|valor)$/ },
    { id: 'notas', nombre: 'Notas', re: /^(notas?|observaciones?)$/ },
  ],
  requiere: [['nombre', 'costo']],
  modelo: [
    ['Nombre', 'Categoría', 'Unidad', 'Moneda', 'Costo sin IVA'],
    ['Harina 000', 'Harinas', 'kg', 'ARS', '740'],
    ['Manteca', 'Lácteos', 'kg', 'ARS', '8400'],
  ],
};

const PROVEEDOR: Esquema = {
  ayuda: 'Una fila por proveedor. Si ya existe (mismo CUIT o mismo nombre), se completan los datos que falten o cambien.',
  campos: [
    { id: 'nombre', nombre: 'Nombre o razón social', re: /^(nombre|proveedor|razon social|denominacion|empresa)$/ },
    { id: 'cuit', nombre: 'CUIT', re: /^(cuit|cuil|nro doc|documento|cuit cuil)$/ },
    { id: 'rubro', nombre: 'Rubro habitual', re: /^(rubro|categoria|tipo|cuenta)$/ },
    { id: 'contacto', nombre: 'Contacto', re: /^(contacto|persona( de contacto)?|vendedor|responsable)$/ },
    { id: 'telefono', nombre: 'Teléfono', re: /^(tel(efono)?|celular|whatsapp|movil)$/ },
    { id: 'email', nombre: 'Mail', re: /^(e ?mail|mail|correo( electronico)?)$/ },
    { id: 'cbu', nombre: 'CBU o alias', re: /^(cbu|cvu|alias|cbu alias|cbu o alias|datos bancarios)$/ },
    { id: 'notas', nombre: 'Notas', re: /^(notas?|observaciones?|comentarios?)$/ },
  ],
  requiere: [['nombre']],
  modelo: [
    ['Nombre', 'CUIT', 'Rubro', 'Contacto', 'Teléfono', 'Mail', 'CBU o alias'],
    ['Molino Cuyano', '30-12345678-9', 'Harinas y premezclas', 'Juan Pérez', '261 555-1234', 'ventas@molinocuyano.com', 'molino.cuyano'],
    ['Lácteos del Valle SRL', '30-98765432-1', 'Lácteos, huevos y quesos', 'María', '261 444-5678', '', ''],
  ],
};

export const ESQUEMAS: Record<TipoImportacion, Esquema> = { compra: EGRESO, gasto: EGRESO, producto: PRODUCTO, insumo: INSUMO, proveedor: PROVEEDOR };

export const adivinarCon = (e: Esquema, titulo: unknown) => {
  const h = normalizar(titulo);
  return (h && e.campos.find((c) => c.re.test(h))?.id) || 'ignorar';
};

/** La fila de títulos: la de las primeras 20 que más columnas reconoce y tiene las obligatorias. */
export function filaTitulosCon(e: Esquema, filas: Celda[][]) {
  let mejor = -1;
  let puntos = 0;
  filas.slice(0, 20).forEach((f, i) => {
    const c = f.map((t) => adivinarCon(e, t));
    if (!e.requiere.some((r) => r.every((x) => c.includes(x)))) return;
    const p = c.filter((x) => x !== 'ignorar').length;
    if (p > puntos) {
      puntos = p;
      mejor = i;
    }
  });
  return mejor;
}

/** Planilla modelo en CSV (separado por ; para que el Excel en castellano la abra en columnas). */
export const planillaModelo = (e: Esquema) =>
  '﻿' + e.modelo.map((f) => f.map((c) => (/[;"\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(';')).join('\r\n');

// ---------- lectura de celdas ----------
const txt = (v: Celda, max = 120) => (v == null ? '' : v instanceof Date ? (aFecha(v) ?? '') : String(v).trim().slice(0, max));
const num = (v: Celda) => (v == null || v === '' ? null : aNumero(v as string | number));
/** "21", "21%", "10,5" o "0,21" → 21 / 10.5 */
export function alicuotaDe(v: Celda): number | null {
  const n = num(typeof v === 'string' ? v.replace('%', '') : v);
  if (n == null) return null;
  const a = n > 0 && n < 1 ? n * 100 : n;
  return a >= 0 && a <= 100 ? redondear(a, 2) : null;
}
const siNo = (v: Celda): boolean | null => {
  const t = normalizar(v);
  if (!t) return null;
  if (/^(si|s|pagad[oa]|cancelad[oa]|ok|x|true|1)$/.test(t)) return true;
  if (/^(no|n|pendiente|impag[oa]|a pagar|debe|false|0)$/.test(t)) return false;
  return null;
};

type Lector = { uno: (f: Celda[], c: string) => Celda; suma: (f: Celda[], c: string) => number | null; tiene: (c: string) => boolean; nombres: string[] };
function lector(filas: Celda[][], titulos: number, mapa: string[]): Lector {
  const cols = (c: string) => mapa.map((m, i) => (m === c ? i : -1)).filter((i) => i >= 0);
  return {
    nombres: (filas[titulos] || []).map((t, i) => txt(t, 60) || `Columna ${i + 1}`),
    tiene: (c) => mapa.includes(c),
    uno: (f, c) => {
      const i = cols(c)[0];
      return i == null ? undefined : f[i];
    },
    suma: (f, c) => {
      let s = 0;
      let alguno = false;
      for (const i of cols(c)) {
        const n = num(f[i]);
        if (n != null) {
          s += n;
          alguno = true;
        }
      }
      return alguno ? s : null;
    },
  };
}
const vacia = (f: Celda[]) => f.every((c) => c == null || String(c).trim() === '');

// ---------- compras y gastos ----------
export type ItemImport = { descripcion: string; cantidad: number; unidad: string; precio: number; alicuota: number };
export type ComprobanteImport = {
  fila: number;
  fecha: string;
  vencimiento: string | null;
  proveedor: string;
  cuit: string;
  comprobante: string;
  numero: string;
  rubro: string;
  moneda: 'ARS' | 'USD';
  cotizacion: number;
  pagado: boolean | null;
  notas: string;
  items: ItemImport[];
  neto: number;
  iva: number;
  otros: number;
};
export type Aviso = { fila: number; motivo: string };
export type ResultadoEgresos = { comprobantes: ComprobanteImport[]; errores: Aviso[]; salteadas: Aviso[]; filas: number };

export function convertirEgresos(filas: Celda[][], titulos: number, mapa: string[], opc: { alicuota: number; dolar: number | null }): ResultadoEgresos {
  const L = lector(filas, titulos, mapa);
  const res: ResultadoEgresos = { comprobantes: [], errores: [], salteadas: [], filas: 0 };
  const grupos = new Map<string, ComprobanteImport & { otrosVistos: number[] }>();
  let ultimaSinNumero = '';
  for (let r = titulos + 1; r < filas.length; r++) {
    const f = filas[r] || [];
    const n = r + 1;
    if (vacia(f)) continue;
    res.filas++;
    const estado = txt(L.uno(f, 'pagado'));
    if (/anulad/i.test(estado)) {
      res.salteadas.push({ fila: n, motivo: 'Anulado' });
      continue;
    }
    const fecha = aFecha(L.uno(f, 'fecha') as Celda);
    if (!fecha) {
      res.salteadas.push({ fila: n, motivo: 'Sin fecha (¿fila de totales?)' });
      continue;
    }
    const proveedor = txt(L.uno(f, 'proveedor'));
    const comprobante = txt(L.uno(f, 'comprobante'), 40);
    let numero = txt(L.uno(f, 'numero'), 40);
    const pv = txt(L.uno(f, 'puntoVenta'), 10);
    if (pv && numero && !numero.includes('-') && /^\d+$/.test(pv) && /^\d+$/.test(numero)) numero = `${pv.padStart(4, '0')}-${numero.padStart(8, '0')}`;
    const cuit = txt(L.uno(f, 'cuit'), 20);
    const monedaTxt = normalizar(L.uno(f, 'moneda'));
    // "U$S" queda como "u s" después de normalizar.
    const moneda: 'ARS' | 'USD' = /^(usd|us|u ?s ?s?|dol|dolar(es)?)$/.test(monedaTxt) || monedaTxt.includes('dolar') ? 'USD' : 'ARS';
    let cotizacion = 1;
    if (moneda === 'USD') {
      const c = num(L.uno(f, 'cotizacion') as Celda) ?? opc.dolar;
      if (!c || c <= 0) {
        res.errores.push({ fila: n, motivo: 'Está en dólares y falta la cotización' });
        continue;
      }
      cotizacion = c;
    }
    const signo = esNotaCredito(comprobante) ? -1 : 1;

    // ¿Es un renglón de producto?
    const producto = txt(L.uno(f, 'producto'), 200);
    const cantidad = num(L.uno(f, 'cantidad') as Celda);
    const precio = num(L.uno(f, 'precio') as Celda);
    const alicCol = alicuotaDe(L.uno(f, 'alicuota') as Celda);
    const netoF = L.suma(f, 'neto');
    const ivaF = L.suma(f, 'iva');
    const otrosF = L.suma(f, 'otros') ?? 0;
    const totalF = num(L.uno(f, 'total') as Celda);
    let item: ItemImport | null = null;
    if (producto && (precio != null || netoF != null || totalF != null)) {
      const cant = cantidad && cantidad !== 0 ? Math.abs(cantidad) : 1;
      const alic = alicCol ?? (netoF && ivaF != null ? redondear((ivaF / netoF) * 100, 1) : opc.alicuota);
      let unit = precio;
      if (unit == null && netoF != null) unit = netoF / cant;
      if (unit == null && totalF != null) unit = (totalF - otrosF) / (1 + alic / 100) / cant;
      item = { descripcion: producto, cantidad: cant, unidad: txt(L.uno(f, 'unidad'), 20), precio: redondear(Math.abs(unit ?? 0) * signo, 4), alicuota: alic };
    } else if (netoF == null && totalF == null) {
      res.errores.push({ fila: n, motivo: 'No tiene importes' });
      continue;
    }

    let clave: string;
    if (numero) clave = `${fecha}|${normalizar(cuit || proveedor)}|${normalizar(comprobante)}|${normalizar(numero)}`;
    else {
      // Sin número: los renglones seguidos del mismo día y proveedor forman una factura.
      const base = `${fecha}|${normalizar(proveedor)}|${normalizar(comprobante)}|sn`;
      clave = item && ultimaSinNumero.startsWith(base) ? ultimaSinNumero : `${base}|${n}`;
      ultimaSinNumero = clave;
    }
    let g = grupos.get(clave);
    if (!g) {
      g = {
        fila: n, fecha, vencimiento: aFecha(L.uno(f, 'vencimiento') as Celda), proveedor, cuit, comprobante, numero,
        rubro: txt(L.uno(f, 'rubro'), 80), moneda, cotizacion, pagado: siNo(L.uno(f, 'pagado') as Celda), notas: txt(L.uno(f, 'notas'), 300),
        items: [], neto: 0, iva: 0, otros: 0, otrosVistos: [],
      };
      grupos.set(clave, g);
    }
    if (otrosF) g.otrosVistos.push(otrosF * signo);
    if (item) g.items.push(item);
    else {
      let neto = netoF;
      const iva = ivaF ?? 0;
      if (neto == null) neto = (totalF ?? 0) - iva - otrosF;
      g.neto = redondear(g.neto + neto * signo);
      g.iva = redondear(g.iva + iva * signo);
    }
  }
  for (const g of grupos.values()) {
    // Las percepciones de la factura suelen repetirse en cada renglón: si son todas iguales, van una vez.
    const v = g.otrosVistos;
    g.otros = redondear(v.length && v.every((x) => x === v[0]) && g.items.length > 1 ? v[0] : v.reduce((a, b) => a + b, 0));
    const { otrosVistos, ...c } = g;
    void otrosVistos;
    res.comprobantes.push(c);
  }
  return res;
}

export const totalesComprobante = (c: Pick<ComprobanteImport, 'items' | 'neto' | 'iva' | 'otros'>) => {
  if (!c.items.length) return { neto: c.neto, iva: c.iva, total: redondear(c.neto + c.iva + c.otros) };
  let neto = 0;
  let iva = 0;
  for (const i of c.items) {
    const n = redondear(i.cantidad * i.precio);
    neto += n;
    iva += redondear((n * i.alicuota) / 100);
  }
  return { neto: redondear(neto), iva: redondear(iva), total: redondear(neto + iva + c.otros) };
};

// ---------- productos ----------
export type ProductoImport = { fila: number; nombre: string; categoria: string; presentacion: string; precio: number | null; iva: number; variables: number | null; margen: number | null; notas: string };
export function convertirProductos(filas: Celda[][], titulos: number, mapa: string[]) {
  const L = lector(filas, titulos, mapa);
  const out: ProductoImport[] = [];
  const errores: Aviso[] = [];
  for (let r = titulos + 1; r < filas.length; r++) {
    const f = filas[r] || [];
    if (vacia(f)) continue;
    const nombre = txt(L.uno(f, 'nombre'), 100);
    if (!nombre) {
      errores.push({ fila: r + 1, motivo: 'Sin nombre' });
      continue;
    }
    const iva = alicuotaDe(L.uno(f, 'iva') as Celda) ?? 21;
    let precio = num(L.uno(f, 'precio') as Celda);
    const conIva = num(L.uno(f, 'precioIva') as Celda);
    if (precio == null && conIva != null) precio = redondear(conIva / (1 + iva / 100));
    out.push({
      fila: r + 1, nombre, categoria: txt(L.uno(f, 'categoria'), 60), presentacion: txt(L.uno(f, 'presentacion'), 60), precio, iva,
      variables: alicuotaDe(L.uno(f, 'variables') as Celda), margen: alicuotaDe(L.uno(f, 'margen') as Celda), notas: txt(L.uno(f, 'notas'), 500),
    });
  }
  return { filas: out, errores };
}

// ---------- insumos ----------
export type InsumoImport = { fila: number; nombre: string; categoria: string; unidad: string; moneda: 'ARS' | 'USD'; costo: number; notas: string };
export function convertirInsumos(filas: Celda[][], titulos: number, mapa: string[]) {
  const L = lector(filas, titulos, mapa);
  const out: InsumoImport[] = [];
  const errores: Aviso[] = [];
  for (let r = titulos + 1; r < filas.length; r++) {
    const f = filas[r] || [];
    if (vacia(f)) continue;
    const nombre = txt(L.uno(f, 'nombre'), 100);
    const costo = num(L.uno(f, 'costo') as Celda);
    if (!nombre || costo == null || costo < 0) {
      errores.push({ fila: r + 1, motivo: !nombre ? 'Sin nombre' : 'Sin costo' });
      continue;
    }
    const m = normalizar(L.uno(f, 'moneda'));
    out.push({
      fila: r + 1, nombre, categoria: txt(L.uno(f, 'categoria'), 60), unidad: txt(L.uno(f, 'unidad'), 15) || 'u',
      moneda: /^(usd|us|u ?s ?s?|dol|dolar(es)?)$/.test(m) || m.includes('dolar') ? 'USD' : 'ARS', costo: redondear(costo, 4), notas: txt(L.uno(f, 'notas'), 500),
    });
  }
  return { filas: out, errores };
}

// ---------- proveedores ----------
export type ProveedorImport = { fila: number; nombre: string; cuit: string; rubro: string; contacto: string; telefono: string; email: string; cbu: string; notas: string };
export function convertirProveedores(filas: Celda[][], titulos: number, mapa: string[]) {
  const L = lector(filas, titulos, mapa);
  const out: ProveedorImport[] = [];
  const errores: Aviso[] = [];
  for (let r = titulos + 1; r < filas.length; r++) {
    const f = filas[r] || [];
    if (vacia(f)) continue;
    const nombre = txt(L.uno(f, 'nombre'), 120).replace(/\s+/g, ' ');
    if (!nombre) {
      errores.push({ fila: r + 1, motivo: 'Sin nombre' });
      continue;
    }
    const cuit = txt(L.uno(f, 'cuit'), 20).replace(/\D/g, '');
    out.push({
      fila: r + 1, nombre, cuit: cuit.length === 11 ? cuit : '', rubro: txt(L.uno(f, 'rubro'), 80), contacto: txt(L.uno(f, 'contacto'), 120),
      telefono: txt(L.uno(f, 'telefono'), 60), email: txt(L.uno(f, 'email'), 120), cbu: txt(L.uno(f, 'cbu'), 60), notas: txt(L.uno(f, 'notas'), 500),
    });
  }
  return { filas: out, errores };
}
