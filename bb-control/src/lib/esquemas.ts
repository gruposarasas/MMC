// Importación de compras, gastos, productos e insumos desde Excel o CSV.
// Corre en el navegador: reconoce las columnas, arma los datos y el servidor vuelve a validar.
import { aNumero, redondear } from './formato';
import { aFecha, type Celda, esNotaCredito, normalizar } from './importar';

export type TipoImportacion = 'compra' | 'gasto' | 'producto' | 'insumo' | 'proveedor' | 'echeq' | 'activo' | 'cliente';
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
    ['05/10/2026', 'Exportadora Santos', '30-12345678-9', 'Factura A', '0001-00001234', 'Café verde (importación)', 'Café verde Brasil', '690', 'kg', '9000', '10,5', '', 'Sí'],
    ['05/10/2026', 'Exportadora Santos', '30-12345678-9', 'Factura A', '0001-00001234', 'Café verde (importación)', 'Café verde Colombia', '345', 'kg', '11500', '10,5', '', 'Sí'],
    ['07/10/2026', 'Bolsas Cuyo', '30-98765432-1', 'Factura A', '0003-00000456', 'Packaging', 'Bolsa 1 kg con válvula', '1000', 'u', '850', '21', '3500', 'No'],
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
    ['Café tostado Brasil', 'Café en grano', 'Bolsa 1 kg', '22000', '21', '5', '40'],
    ['Café tostado Brasil', 'Café en grano', 'Bolsa 250 g', '6500', '21', '5', '45'],
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
    ['Café verde Brasil Santos', 'Café', 'kg', 'USD', '6,20'],
    ['Bolsa 1 kg con válvula', 'Packaging', 'u', 'ARS', '850'],
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
    ['Exportadora Santos', '30-12345678-9', 'Café verde (importación)', 'Juan Pérez', '261 555-1234', 'ventas@santos.com', 'santos.cafe.verde'],
    ['Bolsas Cuyo SRL', '30-98765432-1', 'Packaging', 'María', '261 444-5678', '', ''],
  ],
};

const ECHEQ: Esquema = {
  ayuda: 'Una fila por echeq, como el listado que exporta el home banking (emitidos o recibidos). Los anulados o rechazados quedan registrados pero no se cuentan.',
  campos: [
    { id: 'numero', nombre: 'Número', re: /^(n(ro|umero)?( de)?( cheque| echeq| cheq)?|cheque( n(ro|umero))?|id( echeq| cheque)?|numero( de)? cheque|nro cheque)$/ },
    { id: 'emision', nombre: 'Fecha de emisión', re: /^(fecha( de)? emision|emision|f ?emision|fecha( de)? libramiento)$/ },
    { id: 'pago', nombre: 'Fecha de pago', re: /^(fecha( de)? (pago|cobro|vencimiento|deposito|acreditacion)|vencimiento|fecha|f ?pago|pago|fecha pago)$/ },
    { id: 'monto', nombre: 'Monto', re: /^(monto|importe|valor|importe( del)? (cheque|echeq)|monto( del)? (cheque|echeq))$/ },
    { id: 'tercero', nombre: 'Beneficiario / librador', re: /^(beneficiario|librador|razon social|denominacion|nombre|emisor|tenedor|cliente|proveedor|a la orden de)( (beneficiario|librador|emisor))?$/ },
    { id: 'cuit', nombre: 'CUIT', re: /^(cuit|cuil|cuit cuil|nro doc|documento)( (del )?(beneficiario|librador|emisor))?$/ },
    { id: 'estado', nombre: 'Estado', re: /^(estado|situacion|status)( (del )?(cheque|echeq))?$/ },
    { id: 'banco', nombre: 'Banco', re: /^(banco|entidad|banco (emisor|librador|girado))$/ },
    { id: 'notas', nombre: 'Notas', re: /^(notas?|observaciones?|motivo|concepto|referencia|caracter)$/ },
  ],
  requiere: [['pago', 'monto']],
  modelo: [
    ['Número', 'Fecha de emisión', 'Fecha de pago', 'Beneficiario', 'CUIT', 'Monto', 'Estado'],
    ['00012345', '01/10/2026', '30/11/2026', 'Exportadora Santos', '30-12345678-9', '1.250.000,00', 'Emitido'],
    ['00012346', '01/10/2026', '30/12/2026', 'Bolsas Cuyo', '30-98765432-1', '480.000,00', 'Emitido'],
  ],
};

const ACTIVO: Esquema = {
  ayuda: 'Una fila por equipo. Si ya existe uno con el mismo tipo y número de serie, se actualiza.',
  campos: [
    { id: 'categoria', nombre: 'Tipo (máquina, molinillo, tostadora, vehículo)', re: /^(tipo|categoria|clase|rubro)( de)?( equipo| activo)?$/ },
    { id: 'numero', nombre: 'N° de serie / patente', re: /^(n(ro|umero|°)?( de)? ?(serie|inventario|equipo)?|serie|nro serie|numero de serie|s ?n|patente|dominio|inventario|codigo)$/ },
    { id: 'descripcion', nombre: 'Descripción', re: /^(descripcion|equipo|maquina|producto|articulo|detalle|nombre)$/ },
    { id: 'marca', nombre: 'Marca', re: /^marca$/ },
    { id: 'modelo', nombre: 'Modelo', re: /^modelo$/ },
    { id: 'cliente', nombre: 'Cliente (dónde está)', re: /^(cliente|instalad[ao]( en)?|comodato|razon social|local)$/ },
    { id: 'ubicacion', nombre: 'Dirección', re: /^(ubicacion|direccion|domicilio|localidad)$/ },
    { id: 'estado', nombre: 'Estado', re: /^(estado|situacion)$/ },
    { id: 'instalada', nombre: 'Fecha de instalación', re: /^(fecha( de)? (instalacion|entrega|alta)|instalacion|instalada el|entrega)$/ },
    { id: 'valor', nombre: 'Valor estimado', re: /^(valor( estimado| de mercado| actual)?|valuacion|precio( de)? mercado)$/ },
    { id: 'costo', nombre: 'Costo', re: /^(costo( unitario| de compra| mercaderia)?|precio( de)? compra|fob)$/ },
    { id: 'moneda', nombre: 'Moneda', re: /^moneda$/ },
    { id: 'notas', nombre: 'Notas', re: /^(notas?|observaciones?|comentarios?)$/ },
  ],
  requiere: [['descripcion']],
  modelo: [
    ['Tipo', 'N° de serie', 'Descripción', 'Marca', 'Modelo', 'Cliente', 'Dirección', 'Fecha de instalación', 'Valor estimado', 'Moneda'],
    ['Máquina', 'LM12345', 'Máquina espresso 2 grupos', 'La Marzocco', 'Linea PB', 'Café Central', 'San Martín 1200, Mendoza', '15/03/2026', '18000', 'USD'],
    ['Molinillo', 'MZ-889', 'Molinillo a demanda', 'Mazzer', 'Super Jolly', 'Café Central', 'San Martín 1200, Mendoza', '15/03/2026', '1800', 'USD'],
    ['Vehículo', 'AF123BC', 'Camioneta de reparto', 'Toyota', 'Hilux', '', '', '', '35000', 'USD'],
  ],
};

const CLIENTE: Esquema = {
  ayuda: 'Una fila por cliente. Si ya existe uno con el mismo nombre, se actualizan sus datos.',
  campos: [
    { id: 'nombre', nombre: 'Cliente', re: /^(cliente|nombre|nombre fantasia|fantasia|marca)$/ },
    { id: 'alias', nombre: 'Razón social u otros nombres', re: /^(razon social|alias|otros nombres|denominacion)$/ },
    { id: 'cuit', nombre: 'CUIT', re: /^(cuit|cuil|cuit cuil)$/ },
    { id: 'locales', nombre: 'Locales', re: /^(locales|sucursales|cantidad( de)? locales)$/ },
    { id: 'kilos', nombre: 'Kilos por mes', re: /^(kilos?( por mes| mes| mensuales)?|kg( por mes| mes)?|consumo( mensual)?( kg)?)$/ },
    { id: 'descuento', nombre: 'Descuento %', re: /^(descuento|desc|bonificacion)( %)?$/ },
    { id: 'forma', nombre: 'Forma de pago', re: /^(forma( de)? pago|medio( de)? pago|condicion( de)? (pago|venta))$/ },
    { id: 'plazo', nombre: 'Plazo de pago (días)', re: /^(plazo( de)?( pago)?( dias)?|dias( de)? pago|dias)$/ },
    { id: 'comision', nombre: 'Comisión del cobro %', re: /^(comision|costo( del)? cobro)( %)?$/ },
    { id: 'precio', nombre: 'Precio especial por kg', re: /^(precio( especial)?( por)? kg|precio)$/ },
    { id: 'notas', nombre: 'Notas', re: /^(notas?|observaciones?)$/ },
  ],
  requiere: [['nombre']],
  modelo: [
    ['Cliente', 'Razón social', 'CUIT', 'Locales', 'Kilos por mes', 'Descuento %', 'Forma de pago', 'Plazo de pago (días)'],
    ['Entre Dos', 'Entre Dos SRL', '30-71111111-1', '6', '180', '15', 'Echeq', '30'],
    ['Café Central', '', '', '1', '25', '5', 'Transferencia', '0'],
  ],
};

export const ESQUEMAS: Record<TipoImportacion, Esquema> = {
  compra: EGRESO, gasto: EGRESO, producto: PRODUCTO, insumo: INSUMO, proveedor: PROVEEDOR, echeq: ECHEQ, activo: ACTIVO, cliente: CLIENTE,
};

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
  cotizacionAuto: boolean;
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
    // Sin cotización en el Excel, va el dólar BNA (el del día del pago, o el de hoy si está sin pagar).
    const cotizacionAuto = moneda === 'USD' && num(L.uno(f, 'cotizacion') as Celda) == null;
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
        rubro: txt(L.uno(f, 'rubro'), 80), moneda, cotizacion, cotizacionAuto, pagado: siNo(L.uno(f, 'pagado') as Celda), notas: txt(L.uno(f, 'notas'), 300),
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

// ---------- echeqs ----------
export type EcheqImport = { fila: number; numero: string; emision: string | null; pago: string; monto: number; tercero: string; cuit: string; estado: 'pendiente' | 'pagado' | 'anulado' | 'rechazado'; banco: string; notas: string };
/** "Pagado", "Cobrado", "Acreditado" → pagado; "Anulado", "Repudiado", "Devuelto" → anulado; "Rechazado" → rechazado; lo demás, pendiente. */
export function estadoEcheqDe(v: unknown): EcheqImport['estado'] {
  const t = normalizar(v);
  if (/rechaz/.test(t)) return 'rechazado';
  if (/(anulad|repudiad|devuelt|cancelad|caducad)/.test(t)) return 'anulado';
  if (/(pagad|cobrad|acreditad|debitad|depositad)/.test(t)) return 'pagado';
  return 'pendiente';
}
export function convertirEcheqs(filas: Celda[][], titulos: number, mapa: string[]) {
  const L = lector(filas, titulos, mapa);
  const out: EcheqImport[] = [];
  const errores: Aviso[] = [];
  for (let r = titulos + 1; r < filas.length; r++) {
    const f = filas[r] || [];
    if (vacia(f)) continue;
    const pago = aFecha(L.uno(f, 'pago') as Celda);
    const monto = num(L.uno(f, 'monto') as Celda);
    if (!pago || monto == null || monto === 0) {
      errores.push({ fila: r + 1, motivo: !pago ? 'Sin fecha de pago (¿fila de totales?)' : 'Sin monto' });
      continue;
    }
    out.push({
      fila: r + 1, numero: txt(L.uno(f, 'numero'), 40), emision: aFecha(L.uno(f, 'emision') as Celda), pago, monto: redondear(Math.abs(monto)),
      tercero: txt(L.uno(f, 'tercero'), 120), cuit: txt(L.uno(f, 'cuit'), 20).replace(/\D/g, ''), estado: estadoEcheqDe(L.uno(f, 'estado')),
      banco: txt(L.uno(f, 'banco'), 60), notas: txt(L.uno(f, 'notas'), 300),
    });
  }
  return { filas: out, errores };
}

// ---------- activos ----------
export type ActivoImport = {
  fila: number; categoria: string; numero: string; descripcion: string; marca: string; modelo: string; cliente: string; ubicacion: string;
  estado: string; instalada: string | null; valor: number | null; costo: number | null; moneda: 'ARS' | 'USD' | ''; notas: string;
};
/** Tipo de activo a partir de un texto. Con `estricto` (para adivinar por la descripción), sin coincidencia devuelve vacío. */
export function categoriaActivoDe(v: unknown, estricto = false): string {
  const t = normalizar(v);
  if (!t) return '';
  if (/(molin|molino|grinder)/.test(t)) return 'molinillo';
  if (/tostad/.test(t)) return 'tostadora';
  if (/(camionet|auto|vehicul|utilitari|furgon|moto|camion|pick)/.test(t)) return 'vehiculo';
  if (/(maquina|cafetera|espresso|express)/.test(t)) return 'maquina';
  if (estricto) return '';
  return /otro/.test(t) ? 'otro' : 'equipo';
}
export function estadoActivoDe(v: unknown, cliente: string): string {
  const t = normalizar(v);
  if (/(baja|vendid|robad)/.test(t)) return 'baja';
  if (/(repar|servicio tecnico|taller)/.test(t)) return 'reparacion';
  if (/(deposito|stock|guardad)/.test(t)) return 'deposito';
  if (/(uso|propi|local)/.test(t)) return 'uso';
  return cliente ? 'cliente' : t ? 'deposito' : '';
}
export function convertirActivos(filas: Celda[][], titulos: number, mapa: string[]) {
  const L = lector(filas, titulos, mapa);
  const out: ActivoImport[] = [];
  const errores: Aviso[] = [];
  for (let r = titulos + 1; r < filas.length; r++) {
    const f = filas[r] || [];
    if (vacia(f)) continue;
    const descripcion = txt(L.uno(f, 'descripcion'), 160);
    if (!descripcion) {
      errores.push({ fila: r + 1, motivo: 'Sin descripción' });
      continue;
    }
    const cliente = txt(L.uno(f, 'cliente'), 120);
    const m = normalizar(L.uno(f, 'moneda'));
    out.push({
      fila: r + 1, categoria: categoriaActivoDe(L.uno(f, 'categoria')) || categoriaActivoDe(descripcion, true), numero: txt(L.uno(f, 'numero'), 60),
      descripcion, marca: txt(L.uno(f, 'marca'), 60), modelo: txt(L.uno(f, 'modelo'), 60), cliente, ubicacion: txt(L.uno(f, 'ubicacion'), 160),
      estado: estadoActivoDe(L.uno(f, 'estado'), cliente), instalada: aFecha(L.uno(f, 'instalada') as Celda),
      valor: num(L.uno(f, 'valor') as Celda), costo: num(L.uno(f, 'costo') as Celda),
      moneda: !m ? '' : /^(usd|us|u ?s ?s?|dol|dolar(es)?)$/.test(m) || m.includes('dolar') ? 'USD' : 'ARS', notas: txt(L.uno(f, 'notas'), 500),
    });
  }
  return { filas: out, errores };
}

// ---------- clientes ----------
export type ClienteImport = {
  fila: number; nombre: string; alias: string; cuit: string; locales: number | null; kilos: number | null; descuento: number | null;
  forma: string; plazo: number | null; comision: number | null; precio: number | null; notas: string;
};
export function convertirClientes(filas: Celda[][], titulos: number, mapa: string[]) {
  const L = lector(filas, titulos, mapa);
  const out: ClienteImport[] = [];
  const errores: Aviso[] = [];
  for (let r = titulos + 1; r < filas.length; r++) {
    const f = filas[r] || [];
    if (vacia(f)) continue;
    const nombre = txt(L.uno(f, 'nombre'), 120);
    if (!nombre) {
      errores.push({ fila: r + 1, motivo: 'Sin nombre' });
      continue;
    }
    let forma = txt(L.uno(f, 'forma'), 60);
    // "Echeq 30 días", "Cta. cte. 15" → el plazo sale de la forma de pago si no hay columna de plazo.
    const enForma = forma.match(/(\d{1,3})/);
    let plazo = num(L.uno(f, 'plazo') as Celda);
    if (plazo == null && enForma) {
      plazo = Number(enForma[1]);
      forma = forma.replace(/(?:^|[\s,-]+)(?:a\s+)?\d{1,3}\s*(?:d[ií]as?|d)?\.?\s*$/i, '').trim() || forma;
    }
    out.push({
      fila: r + 1, nombre, alias: txt(L.uno(f, 'alias'), 200), cuit: txt(L.uno(f, 'cuit'), 20).replace(/\D/g, ''),
      locales: num(L.uno(f, 'locales') as Celda), kilos: num(L.uno(f, 'kilos') as Celda), descuento: alicuotaDe(L.uno(f, 'descuento') as Celda),
      forma, plazo, comision: alicuotaDe(L.uno(f, 'comision') as Celda), precio: num(L.uno(f, 'precio') as Celda), notas: txt(L.uno(f, 'notas'), 500),
    });
  }
  return { filas: out, errores };
}
