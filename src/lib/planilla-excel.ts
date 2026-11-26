// Lector mínimo de planillas en el navegador, sin librerías: .xlsx (la primera hoja, como texto) y .csv.
// Un .xlsx es un zip con XML adentro: se descomprime con DecompressionStream y se lee con DOMParser.

async function inflar(datos: Uint8Array): Promise<Uint8Array> {
  const flujo = new Blob([datos as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(flujo).arrayBuffer());
}

async function abrirZip(buf: ArrayBuffer, quiero: (nombre: string) => boolean): Promise<Map<string, string>> {
  const b = new Uint8Array(buf);
  const v = new DataView(buf);
  let fin = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 66_000); i--) if (v.getUint32(i, true) === 0x06054b50) { fin = i; break; }
  if (fin < 0) throw new Error('No es un archivo de Excel (.xlsx).');
  const total = v.getUint16(fin + 10, true);
  let p = v.getUint32(fin + 16, true);
  const out = new Map<string, string>();
  const texto = new TextDecoder();
  for (let n = 0; n < total; n++) {
    if (v.getUint32(p, true) !== 0x02014b50) throw new Error('El archivo de Excel está dañado.');
    const metodo = v.getUint16(p + 10, true);
    const tam = v.getUint32(p + 20, true);
    const largoNombre = v.getUint16(p + 28, true), extra = v.getUint16(p + 30, true), coment = v.getUint16(p + 32, true);
    const local = v.getUint32(p + 42, true);
    const nombre = texto.decode(b.subarray(p + 46, p + 46 + largoNombre));
    p += 46 + largoNombre + extra + coment;
    if (!quiero(nombre)) continue;
    const ini = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
    const crudo = b.subarray(ini, ini + tam);
    out.set(nombre, texto.decode(metodo === 0 ? crudo : await inflar(crudo)));
  }
  return out;
}

const columna = (ref: string) => {
  const letras = /^[A-Z]+/.exec(ref)?.[0] ?? 'A';
  return [...letras].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;
};

/** Primera hoja de un .xlsx como filas de texto. */
export async function leerXlsx(buf: ArrayBuffer): Promise<string[][]> {
  const archivos = await abrirZip(buf, (n) => n === 'xl/sharedStrings.xml' || /^xl\/worksheets\/sheet\d+\.xml$/.test(n));
  const hojas = [...archivos.keys()].filter((n) => n.startsWith('xl/worksheets/')).sort((a, b) => Number(/\d+/.exec(a)![0]) - Number(/\d+/.exec(b)![0]));
  if (!hojas.length) throw new Error('El Excel no tiene hojas.');
  const xml = (s: string) => new DOMParser().parseFromString(s, 'application/xml');
  const compartidos = archivos.has('xl/sharedStrings.xml')
    ? [...xml(archivos.get('xl/sharedStrings.xml')!).getElementsByTagName('si')].map((si) => [...si.getElementsByTagName('t')].map((t) => t.textContent ?? '').join(''))
    : [];
  const hoja = xml(archivos.get(hojas[0])!);
  const filas: string[][] = [];
  for (const fila of [...hoja.getElementsByTagName('row')]) {
    const r: string[] = [];
    for (const c of [...fila.getElementsByTagName('c')]) {
      const i = columna(c.getAttribute('r') ?? '');
      const t = c.getAttribute('t');
      const valor = c.getElementsByTagName('v')[0]?.textContent ?? '';
      r[i] = t === 's' ? compartidos[Number(valor)] ?? '' : t === 'inlineStr' ? [...c.getElementsByTagName('t')].map((x) => x.textContent ?? '').join('') : valor;
    }
    filas.push(Array.from(r, (x) => (x ?? '').trim()));
  }
  return filas.filter((f) => f.some(Boolean));
}

/** CSV con coma o punto y coma (Excel en español usa punto y coma). */
export function leerCsv(texto: string): string[][] {
  const t = texto.replace(/^﻿/, '');
  const primera = t.split(/\r?\n/, 1)[0] ?? '';
  const sep = (primera.match(/;/g)?.length ?? 0) > (primera.match(/,/g)?.length ?? 0) ? ';' : ',';
  const filas: string[][] = [];
  let fila: string[] = [], campo = '', comillas = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (comillas) {
      if (ch === '"' && t[i + 1] === '"') { campo += '"'; i++; }
      else if (ch === '"') comillas = false;
      else campo += ch;
    } else if (ch === '"') comillas = true;
    else if (ch === sep) { fila.push(campo.trim()); campo = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && t[i + 1] === '\n') i++;
      fila.push(campo.trim()); filas.push(fila); fila = []; campo = '';
    } else campo += ch;
  }
  if (campo || fila.length) { fila.push(campo.trim()); filas.push(fila); }
  return filas.filter((f) => f.some(Boolean));
}
