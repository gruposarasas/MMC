// Lectura del Excel de ventas de Contabilium (o cualquier planilla parecida).
// Corre en el navegador: detecta la fila de títulos, adivina qué es cada columna
// y arma las ventas. El servidor vuelve a validar todo antes de guardar.
import { aNumero, esFecha, redondear } from './formato';

export type Celda = string | number | boolean | Date | null | undefined;

export type Campo =
  | 'ignorar'
  | 'fecha'
  | 'comprobante'
  | 'puntoVenta'
  | 'numero'
  | 'cliente'
  | 'cuit'
  | 'neto'
  | 'iva'
  | 'otros'
  | 'total'
  | 'estado';

export const CAMPOS: { id: Campo; nombre: string }[] = [
  { id: 'ignorar', nombre: '— No usar —' },
  { id: 'fecha', nombre: 'Fecha' },
  { id: 'comprobante', nombre: 'Tipo de comprobante' },
  { id: 'puntoVenta', nombre: 'Punto de venta' },
  { id: 'numero', nombre: 'Número' },
  { id: 'cliente', nombre: 'Cliente' },
  { id: 'cuit', nombre: 'CUIT / DNI' },
  { id: 'neto', nombre: 'Neto sin IVA (se suman)' },
  { id: 'iva', nombre: 'IVA (se suman)' },
  { id: 'otros', nombre: 'Percepciones / otros (se suman)' },
  { id: 'total', nombre: 'Total con IVA' },
  { id: 'estado', nombre: 'Estado (saltea anuladas)' },
];

export const normalizar = (s: unknown) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[°º.:/_()$-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Qué campo parece ser un título de columna. */
export function adivinar(titulo: unknown): Campo {
  const h = normalizar(titulo);
  if (!h) return 'ignorar';
  if (/^fecha( de)?( emision| comprobante| cbte| factura)?$/.test(h)) return 'fecha';
  if (/^(tipo( de)?( comprobante| cbte)?|comprobante tipo|cbte tipo|tipo cbte|comprobante)$/.test(h)) return 'comprobante';
  if (/^(punto( de)? venta|pto( de)? vta|pto( de)? venta|p ?v|pv)$/.test(h)) return 'puntoVenta';
  if (/^(n(ro|umero|um)?( de)?( comprobante| cbte| factura)?|comprobante n(ro|umero)?|n(ro|umero) desde)$/.test(h)) return 'numero';
  if (/^(cliente|razon social|denominacion( receptor| comprador)?|nombre( cliente)?|cliente razon social|nombre y apellido)$/.test(h)) return 'cliente';
  if (/^(cuit( dni)?|cuit cliente|dni|nro doc(umento)?( receptor)?|documento|cuit dni cliente|cuit dni)$/.test(h)) return 'cuit';
  if (/^(imp(orte)? )?(neto( gravado| no gravado)?|no gravado|exento|op exentas|subtotal( sin iva)?)( \d.*)?$/.test(h) || h === 'imp neto gravado' || h === 'imp op exentas') return 'neto';
  if (/^(imp(orte)? |total )?iva( \d+([ ,]\d+)?( ?%)?)?$/.test(h)) return 'iva';
  if (/(percep|otros tributos|otros impuestos|imp(uestos)? internos|retenc)/.test(h)) return 'otros';
  if (/^(imp(orte)? )?total( comprobante| con iva| ars| factura)?$|^monto total$/.test(h)) return 'total';
  if (/^estado$/.test(h)) return 'estado';
  return 'ignorar';
}

/** Fila de títulos: la de las primeras 20 que más columnas reconoce (con fecha y algún importe). */
export function filaTitulos(filas: Celda[][]) {
  let mejor = -1;
  let puntos = 0;
  filas.slice(0, 20).forEach((f, i) => {
    const c = f.map(adivinar);
    if (!c.includes('fecha') || !(c.includes('total') || c.includes('neto'))) return;
    const p = c.filter((x) => x !== 'ignorar').length;
    if (p > puntos) {
      puntos = p;
      mejor = i;
    }
  });
  return mejor;
}

export function aFecha(v: Celda): string | null {
  if (v == null || v === '') return null;
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null;
    // read-excel-file devuelve las fechas en UTC a medianoche.
    return `${v.getUTCFullYear()}-${String(v.getUTCMonth() + 1).padStart(2, '0')}-${String(v.getUTCDate()).padStart(2, '0')}`;
  }
  if (typeof v === 'number') {
    if (v < 20000 || v > 80000) return null; // número de serie de Excel
    const d = new Date(Math.round((v - 25569) * 86400) * 1000);
    return d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) {
    const r = `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    return esFecha(r) ? r : null;
  }
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})\b/);
  if (m) {
    const a = m[3].length === 2 ? `20${m[3]}` : m[3];
    const r = `${a}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    return esFecha(r) ? r : null;
  }
  return null;
}

const txt = (v: Celda, max = 120) => {
  if (v == null) return '';
  if (v instanceof Date) return aFecha(v) ?? '';
  return String(v).trim().slice(0, max);
};

export type FilaVenta = {
  fila: number;
  fecha: string;
  comprobante: string;
  numero: string;
  cliente: string;
  cuit: string;
  neto: number;
  iva: number;
  otros: number;
  total: number;
  datos: Record<string, string>;
};

export type Resultado = {
  filas: FilaVenta[];
  errores: { fila: number; motivo: string }[];
  salteadas: { fila: number; motivo: string }[];
};

// Ojo: "Factura de Crédito Electrónica MiPyME" es una factura, no una nota de crédito.
export const esNotaCredito = (comprobante: string) => /^n\s?\/?\s?c\b|^nc[a-z]?\b|nota( de)? cr[eé]d/i.test(comprobante.trim());

export function convertir(filas: Celda[][], titulos: number, mapa: Campo[]): Resultado {
  const res: Resultado = { filas: [], errores: [], salteadas: [] };
  const nombres = (filas[titulos] || []).map((t, i) => txt(t, 60) || `Columna ${i + 1}`);
  const col = (c: Campo) => mapa.map((m, i) => (m === c ? i : -1)).filter((i) => i >= 0);
  const uno = (f: Celda[], c: Campo) => {
    const i = col(c)[0];
    return i == null ? undefined : f[i];
  };
  const suma = (f: Celda[], c: Campo) => {
    const cols = col(c);
    if (!cols.length) return null;
    let s = 0;
    let alguno = false;
    for (const i of cols) {
      const n = aNumero(f[i] as string | number);
      if (n != null) {
        s += n;
        alguno = true;
      }
    }
    return alguno ? s : null;
  };

  for (let r = titulos + 1; r < filas.length; r++) {
    const f = filas[r] || [];
    const n = r + 1; // número de fila como en Excel
    if (f.every((c) => c == null || String(c).trim() === '')) continue;
    const estado = txt(uno(f, 'estado'));
    if (/anulad/i.test(estado)) {
      res.salteadas.push({ fila: n, motivo: 'Anulada' });
      continue;
    }
    const fecha = aFecha(uno(f, 'fecha'));
    let neto = suma(f, 'neto');
    const iva = suma(f, 'iva') ?? 0;
    const otros = suma(f, 'otros') ?? 0;
    let total = suma(f, 'total');
    if (!fecha) {
      if (neto != null || total != null) res.salteadas.push({ fila: n, motivo: 'Sin fecha (¿fila de totales?)' });
      else res.salteadas.push({ fila: n, motivo: 'Sin fecha' });
      continue;
    }
    if (neto == null && total == null) {
      res.errores.push({ fila: n, motivo: 'No tiene importes' });
      continue;
    }
    if (total == null) total = (neto ?? 0) + iva + otros;
    if (neto == null) neto = total - iva - otros;
    const comprobante = txt(uno(f, 'comprobante'), 40);
    let signo = 1;
    if (esNotaCredito(comprobante) && total > 0) signo = -1;
    let numero = txt(uno(f, 'numero'), 40);
    const pv = txt(uno(f, 'puntoVenta'), 10);
    if (pv && numero && !numero.includes('-') && /^\d+$/.test(pv) && /^\d+$/.test(numero)) {
      numero = `${pv.padStart(4, '0')}-${numero.padStart(8, '0')}`;
    }
    const datos: Record<string, string> = {};
    f.forEach((c, i) => {
      const v = txt(c, 200);
      if (v) datos[nombres[i]] = v;
    });
    res.filas.push({
      fila: n,
      fecha,
      comprobante,
      numero,
      cliente: txt(uno(f, 'cliente')),
      cuit: txt(uno(f, 'cuit'), 20),
      neto: redondear(neto * signo),
      iva: redondear(iva * signo),
      otros: redondear(otros * signo),
      total: redondear(total * signo),
      datos,
    });
  }
  return res;
}

/** CSV con ; , o tabulación como separador. */
export function leerCsv(texto: string): Celda[][] {
  const t = texto.replace(/^﻿/, '');
  const primera = t.split(/\r?\n/, 1)[0] || '';
  const sep = [';', '\t', ','].map((s) => [s, primera.split(s).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const filas: Celda[][] = [];
  let fila: string[] = [];
  let campo = '';
  let comillas = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (comillas) {
      if (c === '"') {
        if (t[i + 1] === '"') {
          campo += '"';
          i++;
        } else comillas = false;
      } else campo += c;
    } else if (c === '"') comillas = true;
    else if (c === sep) {
      fila.push(campo);
      campo = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      fila.push(campo);
      filas.push(fila);
      fila = [];
      campo = '';
    } else campo += c;
  }
  if (campo || fila.length) {
    fila.push(campo);
    filas.push(fila);
  }
  return filas;
}

/** Clave para no duplicar al reimportar el mismo comprobante. */
/**
 * Tipo de comprobante en código corto, para que "Factura A", "FCA", "FC A" o "1 - Factura A"
 * (Excel de Contabilium, de ARCA o la API) sean el mismo comprobante.
 */
export function tipoCanonico(texto: string) {
  const t = normalizar(texto).replace(/^\d+ ?-? ?/, '');
  const m = t.match(/^(fce|fc|nc|nd|n ?c|n ?d) ?([abcem])?$/);
  if (m) return m[1].replace(' ', '').toUpperCase() + (m[2]?.toUpperCase() ?? '');
  const letra = t.match(/ ([abcem])$/)?.[1]?.toUpperCase() ?? '';
  const fce = /credito electronica/.test(t);
  if (/^factura( de credito electronica( mipyme)?)?( [abcem])?$/.test(t)) return (fce ? 'FCE' : 'FC') + letra;
  if (/^nota( de)? credito( de credito electronica( mipyme)?)?( [abcem])?$/.test(t)) return 'NC' + letra;
  if (/^nota( de)? debito( de credito electronica( mipyme)?)?( [abcem])?$/.test(t)) return 'ND' + letra;
  return t;
}

/** Nombre para mostrar a partir del código de Contabilium (FCA → Factura A). */
export function nombreComprobante(codigo: string) {
  const m = codigo.trim().toUpperCase().match(/^(FCE|FC|NC|ND)\s*([ABCEM])?$/);
  if (!m) return codigo.trim();
  const base = { FCE: 'Factura de crédito electrónica', FC: 'Factura', NC: 'Nota de crédito', ND: 'Nota de débito' }[m[1] as 'FC'];
  return m[2] ? `${base} ${m[2]}` : base;
}

export function claveVenta(v: Pick<FilaVenta, 'fecha' | 'comprobante' | 'numero' | 'cliente' | 'total'>) {
  const c = tipoCanonico(v.comprobante);
  return v.numero ? `${c}|${normalizar(v.numero)}` : `${v.fecha}|${c}|${normalizar(v.cliente)}|${v.total}`;
}
